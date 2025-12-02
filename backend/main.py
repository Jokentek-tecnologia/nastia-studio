from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Request
from google import genai
from google.genai import types
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from pathlib import Path
import base64
import io
from PIL import Image, ImageDraw, ImageFont
import time
import tempfile
from moviepy.editor import VideoFileClip, ImageClip, CompositeVideoClip
import traceback
from typing import List, Dict, Optional
from supabase import create_client, Client
from pydantic import BaseModel
import stripe

# --- 1. CONFIGURAÇÕES INICIAIS E AMBIENTE ---

# Patch para compatibilidade de imagem (Pillow)
if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.Resampling.LANCZOS

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Credenciais do Banco de Dados (Supabase)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Chave Mestra do Sistema (Google AI Studio - Sua Conta com Créditos)
SYSTEM_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=SYSTEM_API_KEY)

# Configuração de Pagamento (Stripe)
STRIPE_API_KEY = os.getenv("STRIPE_API_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
stripe.api_key = STRIPE_API_KEY

app = FastAPI()

# Configuração de Segurança (CORS)
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"],
)

# --- 2. DEFINIÇÃO DE PREÇOS E MODELOS ---

# Tabela de Preços (Em Créditos)
COST_IMAGE = 10   # Valor para gerar 1 imagem
COST_VIDEO = 50   # Valor para gerar 1 vídeo

# Modelos de Dados (Pydantic) para evitar erros de leitura
class ChatRequest(BaseModel):
    user_id: str
    history: List[Dict[str, str]]
    persona: str

class ReferralRequest(BaseModel):
    user_id: str
    referral_code: str

class CouponRequest(BaseModel):
    user_id: str
    code: str

# --- 3. FUNÇÕES FINANCEIRAS (CRÉDITOS E COBRANÇA) ---

def check_and_deduct_credits(user_id: str, cost: int):
    """
    Verifica se o usuário tem saldo suficiente.
    Se tiver, desconta imediatamente.
    Retorna o plano do usuário (para saber se põe marca d'água).
    """
    # Busca dados do usuário
    response = supabase.table("profiles").select("credits, plan_tier").eq("id", user_id).execute()
    
    if not response.data: 
        raise Exception("Usuário não encontrado no banco de dados.")
    
    user = response.data[0]
    
    # Verifica Saldo
    if user["credits"] < cost:
        raise Exception(f"Saldo insuficiente. Necessário: {cost}. Atual: {user['credits']}")
    
    # Desconta
    supabase.table("profiles").update({"credits": user["credits"] - cost}).eq("id", user_id).execute()
    
    return user["plan_tier"]

def refund_credits(user_id: str, cost: int):
    """
    REDE DE SEGURANÇA:
    Se a API do Google falhar (erro 500, cota, etc),
    esta função devolve os créditos para o usuário não ficar no prejuízo.
    """
    if cost > 0:
        try:
            print(f"[REEMBOLSO] Iniciando estorno de {cost} créditos para {user_id}...")
            curr = supabase.table("profiles").select("credits").eq("id", user_id).execute()
            if curr.data:
                new_credits = curr.data[0]['credits'] + cost
                supabase.table("profiles").update({"credits": new_credits}).eq("id", user_id).execute()
                print(f"[REEMBOLSO] Sucesso. Novo saldo: {new_credits}")
        except Exception as e:
            print(f"[REEMBOLSO] Falha crítica ao reembolsar: {e}")

# --- 4. FUNÇÕES DE ARQUIVO E MÍDIA ---

def upload_to_supabase(file_bytes: bytes, file_ext: str, content_type: str) -> str:
    """Sobe o arquivo gerado para o Storage e retorna o Link Público"""
    filename = f"{int(time.time())}_{os.urandom(4).hex()}.{file_ext}"
    try:
        supabase.storage.from_("gallery").upload(filename, file_bytes, {"content-type": content_type})
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/gallery/{filename}"
        return public_url
    except Exception as e:
        print(f"Erro Upload Supabase: {e}")
        return ""

def save_to_history(user_id: str, type: str, url: str, prompt: str):
    """Salva na galeria do usuário"""
    try:
        supabase.table("generations").insert({
            "user_id": user_id, 
            "type": type, 
            "url": url, 
            "prompt": prompt
        }).execute()
    except Exception as e:
        print(f"Erro ao salvar histórico: {e}")

def apply_watermark(img: Image.Image, plan: str) -> Image.Image:
    """Aplica marca d'água se o plano for Free"""
    if plan in ["plus", "pro", "agency", "criação"]: 
        return img.convert("RGB")
    
    try:
        base = img.convert("RGBA")
        w, h = base.size
        logo_path = Path(__file__).parent / "logo.png"
        
        if logo_path.exists():
            logo = Image.open(logo_path).convert("RGBA")
            lw = int(w * 0.12) # 12% da largura
            ar = logo.width / logo.height
            lh = int(lw / ar)
            logo = logo.resize((lw, lh), Image.Resampling.LANCZOS)
            
            # Margem de 3%
            margin = int(w * 0.03)
            base.paste(logo, (w - lw - margin, h - lh - margin), logo)
            
        return base.convert("RGB")
    except Exception as e:
        print(f"Erro Watermark Imagem: {e}")
        return img.convert("RGB")

def apply_video_watermark(v_bytes: bytes, plan: str) -> bytes:
    """Aplica marca d'água em vídeo se o plano for Free"""
    if plan in ["plus", "pro", "agency", "criação"]: 
        return v_bytes
    
    tmp_path = None
    out_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(v_bytes)
            tmp_path = tmp.name
        
        out_path = tmp_path.replace(".mp4", "_wm.mp4")
        logo_path = Path(__file__).parent / "logo.png"
        
        if logo_path.exists():
            vid = VideoFileClip(tmp_path)
            logo = (ImageClip(str(logo_path))
                    .set_duration(vid.duration)
                    .resize(height=vid.h * 0.15)
                    .margin(right=8, bottom=8, opacity=0)
                    .set_pos(("right", "bottom")))
            
            final = CompositeVideoClip([vid, logo])
            final.write_videofile(out_path, codec="libx264", audio_codec="aac", preset="ultrafast", threads=2, logger=None)
            
            vid.close()
            final.close()
            
            with open(out_path, "rb") as f:
                return f.read()
        return v_bytes
        
    except Exception as e:
        print(f"Erro Watermark Vídeo: {e}")
        return v_bytes
    finally:
        try: 
            if tmp_path and os.path.exists(tmp_path): os.remove(tmp_path)
            if out_path and os.path.exists(out_path): os.remove(out_path)
        except: pass

def decode_base64_image(image_string):
    """Limpa e decodifica imagem vinda do Frontend"""
    if not image_string: return None
    try:
        if "base64," in image_string:
            image_string = image_string.split("base64,")[1]
        image_data = base64.b64decode(image_string)
        return Image.open(io.BytesIO(image_data))
    except Exception as e:
        print(f"Erro Decode: {str(e)}")
        raise HTTPException(status_code=400, detail="Erro ao processar imagem de contexto.")

@app.get("/")
def read_root(): 
    return {"status": "NastIA Studio V15 (Production Release) Online 🚀"}

# --- 5. ROTAS DE GERAÇÃO (IA) ---

@app.post("/generate-image")
async def generate_image(
    prompt: str = Form(...), 
    files: List[UploadFile] = File(None), 
    from_image: str = Form(None),
    user_id: str = Form(...),
    aspect_ratio: str = Form("16:9")
):
    cost = COST_IMAGE
    
    # 1. Cobrança Antecipada
    try:
        user_plan = check_and_deduct_credits(user_id, cost)
    except Exception as e:
        raise HTTPException(status_code=402, detail=str(e))

    try:
        # 2. Configuração do Modelo
        has_input_image = (files and len(files) > 0) or (from_image is not None)
        model = "gemini-2.5-flash-image"
        
        ratio_map = { 
            "16:9": "wide 16:9 aspect ratio", 
            "9:16": "tall 9:16 aspect ratio", 
            "1:1": "square 1:1 aspect ratio", 
            "4:3": "classic 4:3 aspect ratio", 
            "3:4": "portrait 3:4 aspect ratio", 
            "21:9": "cinematic 21:9 aspect ratio" 
        }
        
        if has_input_image:
            final_prompt = prompt
        else:
            ratio_text = ratio_map.get(aspect_ratio, "wide 16:9 aspect ratio")
            final_prompt = f"{prompt}. Create this image in {ratio_text}, high quality, realistic."

        # 3. Preparação da Imagem de Entrada
        contents_parts = [types.Part.from_text(text=final_prompt)]
        input_img = None
        
        if files:
            f_bytes = await files[0].read()
            input_img = Image.open(io.BytesIO(f_bytes))
        elif from_image:
            input_img = decode_base64_image(from_image)

        if input_img:
            if input_img.mode != 'RGB': 
                input_img = input_img.convert('RGB')
            buf = io.BytesIO()
            input_img.save(buf, format="JPEG")
            contents_parts.append(types.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg"))
        
        # 4. Chamada API Google
        response = client.models.generate_content(
            model=model, 
            contents=[types.Content(role="user", parts=contents_parts)], 
            config=types.GenerateContentConfig(response_modalities=["IMAGE"])
        )

        # 5. Processamento do Resultado
        if response.candidates and response.candidates[0].content.parts:
            part = response.candidates[0].content.parts[0]
            if part.inline_data:
                gen_img = Image.open(io.BytesIO(part.inline_data.data))
                final_img = apply_watermark(gen_img, user_plan)
                
                buf = io.BytesIO()
                final_img.save(buf, format="JPEG", quality=95)
                
                public_url = upload_to_supabase(buf.getvalue(), "jpg", "image/jpeg")
                save_to_history(user_id, "image", public_url, prompt)
                
                return {"image": public_url}
        
        # Se chegou aqui, não gerou
        refund_credits(user_id, cost)
        raise Exception("API Google não retornou imagem.")

    except Exception as e:
        refund_credits(user_id, cost) # Devolve créditos
        print(f"Erro Geral Imagem: {e}")
        error_msg = str(e)
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            raise HTTPException(429, "Sistema com alta demanda. Tente novamente em 2 minutos.")
        raise HTTPException(500, error_msg)

@app.post("/generate-video")
async def generate_video(
    prompt: str = Form(...), 
    file_start: UploadFile = File(None), 
    user_id: str = Form(...),
    aspect_ratio: str = Form("16:9")
):
    cost = COST_VIDEO
    
    # 1. Cobrança
    try:
        user_plan = check_and_deduct_credits(user_id, cost)
    except Exception as e:
        raise HTTPException(status_code=402, detail=str(e))

    try:
        # 2. Configuração Veo
        model = "veo-3.1-generate-preview"
        veo_params = { 
            "model": model, 
            "prompt": prompt, 
            "config": types.GenerateVideosConfig(
                number_of_videos=1, 
                aspect_ratio=aspect_ratio 
            ) 
        }

        if file_start:
            s_bytes = await file_start.read()
            mime = file_start.content_type or "image/jpeg"
            veo_params["image"] = types.Image(image_bytes=s_bytes, mime_type=mime)

        # 3. Chamada API
        operation = client.models.generate_videos(**veo_params)
        
        # Loop de espera (Polling)
        while not operation.done:
            time.sleep(5)
            operation = client.operations.get(operation)

        res = operation.result
        
        # 4. Resultado
        if res and res.generated_videos:
            v_bytes = client.files.download(file=res.generated_videos[0].video)
            final_bytes = apply_video_watermark(v_bytes, user_plan)
            
            public_url = upload_to_supabase(final_bytes, "mp4", "video/mp4")
            save_to_history(user_id, "video", public_url, prompt)
            
            return {"video": public_url}
        
        refund_credits(user_id, cost)
        raise Exception("API Veo não entregou vídeo.")
        
    except Exception as e:
        refund_credits(user_id, cost)
        print(f"Erro Vídeo: {e}")
        error_msg = str(e)
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            raise HTTPException(429, "Alta demanda de vídeos! Limite de segurança atingido. Tente em breve.")
        raise HTTPException(500, error_msg)

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        # Chat não cobra, usa sistema direto
        model = "gemini-2.5-flash"
        sys_inst = "Se pedir imagem use 'PROMPT: '. " + req.persona
        
        fmt = [types.Content(role=m["role"], parts=[types.Part.from_text(text=m["parts"])]) for m in req.history]
        
        res = client.models.generate_content(
            model=model, 
            contents=fmt, 
            config=types.GenerateContentConfig(system_instruction=sys_inst)
        )
        return {"response": res.text or "..."}
    except Exception as e: 
        print(f"Erro Chat: {e}")
        raise HTTPException(500, str(e))

# --- 6. ROTAS DE UTILIDADES E GAMIFICAÇÃO ---

@app.post("/track-referral")
async def track_referral_endpoint(req: ReferralRequest):
    try:
        user_check = supabase.table("profiles").select("referred_by, signup_bonus_given, credits").eq("id", req.user_id).execute()
        if not user_check.data: return {"status": "error"}
        
        user_data = user_check.data[0]
        if user_data.get('referred_by') or user_data.get('signup_bonus_given'): 
            return {"status": "ignored"}

        referrer = supabase.table("profiles").select("id, credits").eq("referral_code", req.referral_code).execute()
        if referrer.data:
            ref_id = referrer.data[0]['id']
            # Padrinho: +100
            supabase.table("profiles").update({"credits": referrer.data[0]['credits'] + 100}).eq("id", ref_id).execute()
            # Afilhado: +50
            supabase.table("profiles").update({
                "referred_by": req.referral_code, 
                "signup_bonus_given": True, 
                "credits": user_data['credits'] + 50
            }).eq("id", req.user_id).execute()
            return {"status": "success"}
        return {"status": "error"}
    except: return {"status": "error"}

@app.post("/redeem-coupon")
async def redeem_coupon_endpoint(req: CouponRequest):
    try:
        supabase.rpc("redeem_coupon", {"user_id": req.user_id, "input_code": req.code}).execute()
        return {"message": "Sucesso!"}
    except Exception as e: 
        if "200" in str(e): return {"message": "Sucesso!"}
        raise HTTPException(400, "Erro cupom")

@app.post("/redeem-coins")
async def redeem_coins_endpoint(user_id: str = Form(...)):
    try:
        user_res = supabase.table("profiles").select("coins, plan_tier").eq("id", user_id).execute()
        if not user_res.data: raise HTTPException(404, "User not found")
        
        user = user_res.data[0]
        if (user.get('coins') or 0) < 250: 
            raise HTTPException(400, "Saldo insuficiente.")
            
        supabase.table("profiles").update({
            "coins": user['coins'] - 250, 
            "plan_tier": "plus", 
            "credits": 1000
        }).eq("id", user_id).execute()
        
        return {"status": "success", "message": "Plano Plus ativado!"}
    except Exception as e: raise HTTPException(500, str(e))

# --- 7. STRIPE WEBHOOK ---

@app.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    try: 
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except: 
        raise HTTPException(400, "Webhook Error")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('client_reference_id')
        amount = session.get('amount_total')
        mode = session.get('mode')
        
        if user_id:
            to_add = 0; new_plan = None
            
            # Plus (R$ 69)
            if amount == 6900: 
                to_add = 500
                new_plan = 'plus'
            # Pro ou Pacote (R$ 99)
            elif amount == 9900: 
                if mode == 'subscription':
                    to_add = 1500
                    new_plan = 'pro'
                else:
                    to_add = 600 # Pacote avulso
            
            try:
                curr = supabase.table("profiles").select("credits, referred_by").eq("id", user_id).execute()
                if curr.data:
                    u_data = curr.data[0]
                    data = {"credits": u_data['credits'] + to_add}
                    if new_plan: data["plan_tier"] = new_plan
                    supabase.table("profiles").update(data).eq("id", user_id).execute()
                    
                    # Gamificação: Padrinho ganha Moedas + Créditos
                    ref_code = u_data.get('referred_by')
                    if ref_code and new_plan:
                        referrer = supabase.table("profiles").select("id, credits, coins").eq("referral_code", ref_code).execute()
                        if referrer.data:
                            rd = referrer.data[0]
                            supabase.table("profiles").update({
                                "credits": rd['credits'] + 100, 
                                "coins": (rd.get('coins') or 0) + 10
                            }).eq("id", rd['id']).execute()
            except Exception as e: print(f"Stripe Error: {e}")
    return {"status": "success"}