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

# --- CONFIGURAÇÃO INICIAL ---

# Patch para compatibilidade de imagem em versões novas do Pillow
if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.Resampling.LANCZOS

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Credenciais do Banco de Dados
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Chave Mestra do Sistema (Sua conta com créditos)
SYSTEM_API_KEY = os.getenv("GEMINI_API_KEY")
# Cliente padrão (será substituído dinamicamente se o usuário tiver chave própria)
client = genai.Client(api_key=SYSTEM_API_KEY)

# Configuração de Pagamento
STRIPE_API_KEY = os.getenv("STRIPE_API_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
stripe.api_key = STRIPE_API_KEY

app = FastAPI()

# Configuração de CORS (Permite que o Frontend acesse o Backend)
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"],
)

# --- PREÇOS E MODELOS DE DADOS ---

COST_IMAGE = 10   # Custo para gerar imagem (se usar chave do sistema)
COST_VIDEO = 50   # Custo para gerar vídeo (se usar chave do sistema)

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

# --- FUNÇÕES DE LÓGICA DE NEGÓCIO (CORE) ---

def get_user_client_and_cost(user_id: str, default_cost: int):
    """
    Lógica Inteligente (BYOK):
    1. Verifica se o usuário salvou uma chave API própria.
    2. Se tiver, usa a chave dele e Custo = 0.
    3. Se não tiver, usa a chave do sistema e cobra Créditos.
    """
    try:
        response = supabase.table("profiles").select("custom_api_key, credits, plan_tier").eq("id", user_id).execute()
        if not response.data: 
            raise Exception("Usuário não encontrado no banco de dados.")
        
        user = response.data[0]
        custom_key = user.get("custom_api_key")

        # Verifica se existe chave customizada válida
        if custom_key and len(custom_key) > 10 and custom_key.startswith("AIza"):
            print(f"[BYOK] Usuário {user_id} usando chave própria. Custo Zero.")
            return genai.Client(api_key=custom_key), 0, user
        else:
            # Usa sistema padrão
            if user["credits"] < default_cost:
                raise Exception(f"Saldo insuficiente. Necessário: {default_cost}. Atual: {user['credits']}")
            
            print(f"[SISTEMA] Usuário {user_id} usando chave do sistema. Custo: {default_cost}")
            return genai.Client(api_key=SYSTEM_API_KEY), default_cost, user
            
    except Exception as e:
        print(f"Erro na verificação de cliente: {e}")
        raise e

def deduct_credits(user_id: str, cost: int, current_credits: int):
    """Remove os créditos do usuário se o custo for maior que zero."""
    if cost > 0:
        supabase.table("profiles").update({"credits": current_credits - cost}).eq("id", user_id).execute()

def refund_credits(user_id: str, cost: int):
    """
    Rede de Segurança:
    Se o Google der erro (cota excedida, erro interno), devolve os créditos cobrados.
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

# --- FUNÇÕES DE PROCESSAMENTO DE MÍDIA ---

def upload_to_supabase(file_bytes: bytes, file_ext: str, content_type: str) -> str:
    filename = f"{int(time.time())}_{os.urandom(4).hex()}.{file_ext}"
    try:
        supabase.storage.from_("gallery").upload(filename, file_bytes, {"content-type": content_type})
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/gallery/{filename}"
        return public_url
    except Exception as e:
        print(f"Erro Upload Supabase: {e}")
        return ""

def save_to_history(user_id: str, type: str, url: str, prompt: str):
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
    # Planos pagos ou agência não levam marca d'água
    if plan in ["plus", "pro", "agency", "criação"]: 
        return img.convert("RGB")
    
    try:
        base = img.convert("RGBA")
        w, h = base.size
        logo_path = Path(__file__).parent / "logo.png"
        
        if logo_path.exists():
            logo = Image.open(logo_path).convert("RGBA")
            # Calcula tamanho proporcional (12% da largura da imagem)
            lw = int(w * 0.12)
            ar = logo.width / logo.height
            lh = int(lw / ar)
            logo = logo.resize((lw, lh), Image.Resampling.LANCZOS)
            
            # Posiciona no canto inferior direito com margem
            margin = int(w * 0.03)
            base.paste(logo, (w - lw - margin, h - lh - margin), logo)
            
        return base.convert("RGB")
    except Exception as e:
        print(f"Erro Watermark Imagem: {e}")
        return img.convert("RGB")

def apply_video_watermark(v_bytes: bytes, plan: str) -> bytes:
    # Planos pagos não levam marca d'água
    if plan in ["plus", "pro", "agency", "criação"]: 
        return v_bytes
    
    # Processo complexo de vídeo precisa de arquivos temporários
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
        # Limpeza de arquivos temporários para não lotar o servidor
        try: 
            if tmp_path and os.path.exists(tmp_path): os.remove(tmp_path)
            if out_path and os.path.exists(out_path): os.remove(out_path)
        except: pass

def decode_base64_image(image_string):
    """Limpa e decodifica strings Base64 vindas do Frontend"""
    if not image_string: return None
    try:
        if "base64," in image_string:
            image_string = image_string.split("base64,")[1]
        image_data = base64.b64decode(image_string)
        return Image.open(io.BytesIO(image_data))
    except Exception as e:
        print(f"Erro Decode Base64: {str(e)}")
        raise HTTPException(status_code=400, detail="Imagem inválida enviada para edição.")

@app.get("/")
def read_root(): 
    return {"status": "NastIA V14 (Production Ready) Online 🚀"}

# --- ROTA 1: GERAÇÃO DE IMAGEM ---
@app.post("/generate-image")
async def generate_image(
    prompt: str = Form(...), 
    files: List[UploadFile] = File(None), 
    from_image: str = Form(None),
    user_id: str = Form(...),
    aspect_ratio: str = Form("16:9")
):
    final_cost = 0
    try:
        # 1. Determina quem paga e configura o cliente
        client, final_cost, user_data = get_user_client_and_cost(user_id, COST_IMAGE)
        
        # 2. Cobra adiantado (será estornado se falhar)
        deduct_credits(user_id, final_cost, user_data['credits'])

        try:
            has_input_image = (files and len(files) > 0) or (from_image is not None)
            model = "gemini-2.5-flash-image" # Modelo rápido e eficiente
            
            # Mapeamento de texto para garantir o formato correto
            ratio_map = { 
                "16:9": "wide 16:9 aspect ratio", 
                "9:16": "tall 9:16 aspect ratio", 
                "1:1": "square 1:1 aspect ratio", 
                "4:3": "classic 4:3 aspect ratio", 
                "3:4": "portrait 3:4 aspect ratio", 
                "21:9": "cinematic 21:9 aspect ratio" 
            }
            
            # Montagem do Prompt
            if has_input_image:
                final_prompt = prompt # Edição mantém o prompt do usuário
            else:
                ratio_text = ratio_map.get(aspect_ratio, "wide 16:9 aspect ratio")
                final_prompt = f"{prompt}. Create this image in {ratio_text}, high quality, realistic details."

            contents_parts = [types.Part.from_text(text=final_prompt)]
            
            # Processamento da Imagem de Entrada (Se houver)
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
            
            # Chamada à API
            response = client.models.generate_content(
                model=model, 
                contents=[types.Content(role="user", parts=contents_parts)], 
                config=types.GenerateContentConfig(response_modalities=["IMAGE"])
            )

            # Processamento da Resposta
            if response.candidates and response.candidates[0].content.parts:
                part = response.candidates[0].content.parts[0]
                if part.inline_data:
                    gen_img = Image.open(io.BytesIO(part.inline_data.data))
                    
                    # Aplica marca d'água baseada no plano
                    final_img = apply_watermark(gen_img, user_data['plan_tier'])
                    
                    buf = io.BytesIO()
                    final_img.save(buf, format="JPEG", quality=95)
                    
                    # Upload e Histórico
                    public_url = upload_to_supabase(buf.getvalue(), "jpg", "image/jpeg")
                    save_to_history(user_id, "image", public_url, prompt)
                    
                    return {"image": public_url}
            
            raise Exception("A API do Google não retornou dados de imagem.")

        except Exception as api_error:
            # ERRO DETECTADO: Devolve o dinheiro!
            refund_credits(user_id, final_cost)
            
            err_msg = str(api_error)
            print(f"Erro na API Google: {err_msg}")
            
            if "API_KEY_INVALID" in err_msg or "403" in err_msg: 
                raise HTTPException(400, "Sua Chave API do Google é inválida ou expirou.")
            if "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg: 
                raise HTTPException(429, "Limite de cota atingido. Tente novamente em alguns instantes.")
                
            raise api_error

    except HTTPException as he: raise he
    except Exception as e:
        print(f"Erro Crítico Imagem: {e}")
        traceback.print_exc()
        raise HTTPException(500, str(e))

# --- ROTA 2: GERAÇÃO DE VÍDEO (VEO) ---
@app.post("/generate-video")
async def generate_video(
    prompt: str = Form(...), 
    file_start: UploadFile = File(None), 
    user_id: str = Form(...),
    aspect_ratio: str = Form("16:9")
):
    final_cost = 0
    try:
        # 1. Configura Cliente e Custo
        client, final_cost, user_data = get_user_client_and_cost(user_id, COST_VIDEO)
        
        # 2. Cobra
        deduct_credits(user_id, final_cost, user_data['credits'])

        try:
            model = "veo-3.1-generate-preview"
            
            # Configuração do Veo
            veo_params = { 
                "model": model, 
                "prompt": prompt, 
                "config": types.GenerateVideosConfig(
                    number_of_videos=1, 
                    aspect_ratio=aspect_ratio 
                ) 
            }

            # Vídeo a partir de Imagem (Image-to-Video)
            if file_start:
                s_bytes = await file_start.read()
                mime_type = file_start.content_type or "image/jpeg"
                veo_params["image"] = types.Image(image_bytes=s_bytes, mime_type=mime_type)

            # Inicia Geração (Async)
            operation = client.models.generate_videos(**veo_params)
            
            # Polling (Espera ficar pronto)
            while not operation.done:
                time.sleep(5)
                operation = client.operations.get(operation)

            res = operation.result
            if res and res.generated_videos:
                v_bytes = client.files.download(file=res.generated_videos[0].video)
                
                # Regra de Marca d'água para vídeo
                # Se o usuário trouxe a chave dele, NÃO pomos marca d'água (incentivo)
                # Se pagou com créditos (sistema) e é Free, põe marca.
                user_brought_key = (final_cost == 0)
                is_paid_plan = user_data['plan_tier'] in ["plus", "pro", "agency"]
                
                if not is_paid_plan and not user_brought_key:
                    final_bytes = apply_video_watermark(v_bytes, "free")
                else:
                    final_bytes = v_bytes

                public_url = upload_to_supabase(final_bytes, "mp4", "video/mp4")
                save_to_history(user_id, "video", public_url, prompt)
                return {"video": public_url}
            
            raise Exception("A API Veo finalizou mas não entregou vídeo.")

        except Exception as api_error:
            refund_credits(user_id, final_cost)
            
            err_msg = str(api_error)
            print(f"Erro API Veo: {err_msg}")
            
            if "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg:
                if final_cost == 0:
                    raise HTTPException(429, "Sua cota gratuita pessoal do Google acabou por hoje.")
                else:
                    raise HTTPException(429, "Nossos servidores de vídeo estão lotados. Tente em 2 minutos.")
            
            raise api_error

    except HTTPException as he: raise he
    except Exception as e:
        print(f"Erro Crítico Vídeo: {e}")
        raise HTTPException(500, str(e))

# --- ROTA 3: CHAT INTELIGENTE (PERSONAS) ---
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        # Usa BYOK se disponível, custo zero para chat
        client, _, _ = get_user_client_and_cost(req.user_id, 0)

        # Modelo 2.5 Flash (Rápido e Inteligente)
        model = "gemini-2.5-flash"
        
        sys_inst = "Se pedir imagem use 'PROMPT: '. " + req.persona
        
        # Converte histórico para formato Google
        fmt = [types.Content(role=m["role"], parts=[types.Part.from_text(text=m["parts"])]) for m in req.history]
        
        res = client.models.generate_content(
            model=model, 
            contents=fmt, 
            config=types.GenerateContentConfig(system_instruction=sys_inst)
        )
        
        return {"response": res.text or "..."}
    except Exception as e: 
        print(f"Erro Chat: {e}")
        raise HTTPException(500, f"Erro ao processar chat: {str(e)}")

# --- ROTA 4: INDICAÇÃO GAMIFICADA (REFERRAL) ---
@app.post("/track-referral")
async def track_referral_endpoint(req: ReferralRequest):
    try:
        # Verifica se usuário existe e se já foi indicado
        user_check = supabase.table("profiles").select("referred_by, signup_bonus_given, credits").eq("id", req.user_id).execute()
        if not user_check.data: return {"status": "error", "message": "User not found"}
        
        user_data = user_check.data[0]
        if user_data.get('referred_by') or user_data.get('signup_bonus_given'):
             return {"status": "ignored", "message": "Already referred"}

        # Busca quem indicou
        referrer = supabase.table("profiles").select("id, credits").eq("referral_code", req.referral_code).execute()
        
        if referrer.data:
            ref_id = referrer.data[0]['id']
            ref_credits = referrer.data[0]['credits']
            
            # Bônus para quem indicou (+100)
            supabase.table("profiles").update({"credits": ref_credits + 100}).eq("id", ref_id).execute()
            
            # Bônus para quem entrou (+50)
            current_credits = user_data['credits']
            supabase.table("profiles").update({
                "referred_by": req.referral_code,
                "signup_bonus_given": True,
                "credits": current_credits + 50
            }).eq("id", req.user_id).execute()
            
            return {"status": "success"}
            
        return {"status": "error", "message": "Invalid code"}

    except Exception as e:
        print(f"Referral Error: {e}")
        return {"status": "error"}

# --- ROTA 5: RESGATE DE MOEDAS (GAMIFICAÇÃO) ---
@app.post("/redeem-coins")
async def redeem_coins_endpoint(user_id: str = Form(...)):
    try:
        user_res = supabase.table("profiles").select("coins, plan_tier").eq("id", user_id).execute()
        if not user_res.data: raise HTTPException(404, "User not found")
        
        user = user_res.data[0]
        saldo_moedas = user.get('coins') or 0
        
        if saldo_moedas < 250:
            raise HTTPException(400, f"Saldo insuficiente. Você tem {saldo_moedas}, precisa de 250.")
            
        # Executa a troca: Tira moedas -> Vira Plus -> Ganha 1000 créditos
        supabase.table("profiles").update({
            "coins": saldo_moedas - 250,
            "plan_tier": "plus",
            "credits": 1000 
        }).eq("id", user_id).execute()
        
        return {"status": "success", "message": "Parabéns! Plano Plus ativado com sucesso!"}
    except Exception as e:
        print(f"Redeem Error: {e}")
        raise HTTPException(500, str(e))

# --- ROTA 6: CUPOM ---
@app.post("/redeem-coupon")
async def redeem_coupon_endpoint(req: CouponRequest):
    try:
        supabase.rpc("redeem_coupon", {"user_id": req.user_id, "input_code": req.code}).execute()
        return {"message": "Sucesso!"}
    except Exception as e: 
        # Supabase RPC retorna erro genérico as vezes mesmo com sucesso, tratamos aqui
        if "200" in str(e): return {"message": "Sucesso!"}
        raise HTTPException(400, "Erro ao aplicar cupom. Verifique o código.")

# --- ROTA 7: STRIPE WEBHOOK (PAGAMENTOS) ---
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
        
        if user_id:
            to_add = 0
            new_plan = None
            
            # Lógica de Planos baseada no valor (em centavos)
            if amount == 6900: # R$ 69,00
                to_add = 500
                new_plan = 'plus'
            elif amount == 9900: # R$ 99,00
                to_add = 1000
                new_plan = 'pro'
            
            try:
                # Atualiza o comprador
                curr = supabase.table("profiles").select("credits, referred_by").eq("id", user_id).execute()
                if curr.data:
                    u_data = curr.data[0]
                    data = {"credits": u_data['credits'] + to_add}
                    if new_plan: data["plan_tier"] = new_plan
                    supabase.table("profiles").update(data).eq("id", user_id).execute()
                    
                    # Gamificação: Se tiver padrinho, padrinho ganha
                    ref_code = u_data.get('referred_by')
                    if ref_code and new_plan:
                        referrer = supabase.table("profiles").select("id, credits, coins").eq("referral_code", ref_code).execute()
                        if referrer.data:
                            ref_data = referrer.data[0]
                            # Padrinho ganha 10 Moedas + 100 Créditos
                            new_coins = (ref_data.get('coins') or 0) + 10
                            supabase.table("profiles").update({
                                "credits": ref_data['credits'] + 100,
                                "coins": new_coins
                            }).eq("id", ref_data['id']).execute()
            except Exception as e: 
                print(f"Stripe Error: {e}")

    return {"status": "success"}