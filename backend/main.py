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

# Patch para compatibilidade de imagem
if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.Resampling.LANCZOS

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Configurações
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

STRIPE_API_KEY = os.getenv("STRIPE_API_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
stripe.api_key = STRIPE_API_KEY

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- FUNÇÕES AUXILIARES ---
def check_and_deduct_credits(user_id: str, cost: int):
    response = supabase.table("profiles").select("credits, plan_tier").eq("id", user_id).execute()
    if not response.data: raise Exception("Usuário não encontrado.")
    user = response.data[0]
    if user["credits"] < cost:
        raise Exception(f"Saldo insuficiente. Necessário: {cost}. Atual: {user['credits']}")
    supabase.table("profiles").update({"credits": user["credits"] - cost}).eq("id", user_id).execute()
    return user["plan_tier"]

def upload_to_supabase(file_bytes: bytes, file_ext: str, content_type: str) -> str:
    filename = f"{int(time.time())}_{os.urandom(4).hex()}.{file_ext}"
    try:
        supabase.storage.from_("gallery").upload(filename, file_bytes, {"content-type": content_type})
        return f"{SUPABASE_URL}/storage/v1/object/public/gallery/{filename}"
    except Exception as e:
        print(f"Erro Upload Supabase: {e}")
        return ""

def save_to_history(user_id: str, type: str, url: str, prompt: str):
    try:
        supabase.table("generations").insert({"user_id": user_id, "type": type, "url": url, "prompt": prompt}).execute()
    except: pass

def apply_watermark(img: Image.Image, plan: str) -> Image.Image:
    # PLANOS PAGOS NÃO TEM MARCA D'ÁGUA
    if plan in ["plus", "pro", "agency", "criação"]: return img.convert("RGB")
    
    base = img.convert("RGBA")
    w, h = base.size
    logo_path = Path(__file__).parent / "logo.png"
    
    if logo_path.exists():
        try:
            logo = Image.open(logo_path).convert("RGBA")
            lw = int(w * 0.12)
            ar = logo.width / logo.height
            lh = int(lw / ar)
            logo = logo.resize((lw, lh), Image.Resampling.LANCZOS)
            base.paste(logo, (w - lw - int(w*0.03), h - lh - int(w*0.03)), logo)
        except: pass
    return base.convert("RGB")

def apply_video_watermark(v_bytes: bytes, plan: str) -> bytes:
    if plan in ["plus", "pro", "agency", "criação"]: return v_bytes
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(v_bytes)
        path = tmp.name
    out = path.replace(".mp4", "_wm.mp4")
    lp = Path(__file__).parent / "logo.png"
    
    try:
        vid = VideoFileClip(path)
        if lp.exists():
            logo = (ImageClip(str(lp)).set_duration(vid.duration)
                    .resize(height=vid.h * 0.15).margin(right=8, bottom=8, opacity=0)
                    .set_pos(("right", "bottom")))
            final = CompositeVideoClip([vid, logo])
            final.write_videofile(out, codec="libx264", audio_codec="aac", preset="ultrafast", threads=1, logger=None)
            vid.close(); final.close()
            with open(out, "rb") as f: return f.read()
        return v_bytes
    except Exception as e:
        print(f"Erro Video Watermark: {e}")
        return v_bytes
    finally:
        try: 
            if os.path.exists(path): os.remove(path)
            if os.path.exists(out): os.remove(out)
        except: pass

def decode_base64_image(image_string):
    """Decodifica imagem base64 de forma segura."""
    if not image_string: return None
    try:
        if "base64," in image_string:
            image_string = image_string.split("base64,")[1]
        image_data = base64.b64decode(image_string)
        return Image.open(io.BytesIO(image_data))
    except Exception as e:
        print(f"Erro Decode: {str(e)}")
        raise HTTPException(status_code=400, detail="Erro ao processar imagem: from_image (Formato inválido)")

@app.get("/")
def read_root(): return {"status": "NastIA V9 (Final Launch) Online 🚀"}

# --- ROTA IMAGEM (CORRIGIDA PARA EDIÇÃO) ---
@app.post("/generate-image")
async def generate_image(
    prompt: str = Form(...), 
    files: List[UploadFile] = File(None), 
    from_image: str = Form(None), # CAMPO NOVO ADICIONADO
    user_id: str = Form(...),
    aspect_ratio: str = Form("16:9")
):
    try:
        # Define se é edição ou criação
        has_input_image = (files and len(files) > 0) or (from_image is not None)
        
        cost = 10 if has_input_image else 5
        user_plan = check_and_deduct_credits(user_id, cost)
        
        model = "gemini-2.5-flash-image"
        
        # Se não tem imagem de entrada, injeta aspect ratio no prompt
        if not has_input_image:
            ratio_text = "wide 16:9 aspect ratio" if aspect_ratio == "16:9" else "tall 9:16 aspect ratio"
            final_prompt = f"{prompt}. Create this image in {ratio_text}."
        else:
            final_prompt = prompt

        contents_parts = [types.Part.from_text(text=final_prompt)]
        
        # Processa imagem de entrada (Upload ou Contexto)
        input_img = None
        
        if files:
            # Prioridade para Upload
            for file in files:
                f_bytes = await file.read()
                input_img = Image.open(io.BytesIO(f_bytes))
        elif from_image:
            # Se não tem upload, usa o contexto (Base64)
            input_img = decode_base64_image(from_image)

        # Adiciona a imagem ao payload do Gemini se existir
        if input_img:
            if input_img.mode != 'RGB':
                input_img = input_img.convert('RGB')
            contents_parts.append(types.Part.from_image(input_img))
        
        contents = [types.Content(role="user", parts=contents_parts)]
        
        # Configuração
        generation_config = types.GenerateContentConfig(response_modalities=["IMAGE"])
        
        response = client.models.generate_content(
            model=model, 
            contents=contents, 
            config=generation_config
        )

        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    gen_img = Image.open(io.BytesIO(part.inline_data.data))
                    final_img = apply_watermark(gen_img, user_plan)
                    buf = io.BytesIO()
                    final_img.save(buf, format="JPEG", quality=95)
                    public_url = upload_to_supabase(buf.getvalue(), "jpg", "image/jpeg")
                    save_to_history(user_id, "image", public_url, prompt)
                    return {"image": public_url}
                    
        raise HTTPException(500, "O Google não retornou imagem.")
    except Exception as e:
        print(f"Erro Geral Imagem: {e}")
        # Log detalhado no console do server para debug
        traceback.print_exc() 
        raise HTTPException(500, str(e))

# --- ROTA VÍDEO (Veo com suporte a Aspect Ratio nativo) ---
@app.post("/generate-video")
async def generate_video(
    prompt: str = Form(...), 
    file_start: UploadFile = File(None), 
    user_id: str = Form(...),
    aspect_ratio: str = Form("16:9")
):
    try:
        cost = 20
        user_plan = check_and_deduct_credits(user_id, cost)
        model = "veo-3.1-generate-preview"
        
        veo_params = {
            "model": model, 
            "prompt": prompt, 
            "config": types.GenerateVideosConfig(
                number_of_videos=1,
                aspect_ratio=aspect_ratio 
            )
        }

        is_image_animation = False

        if file_start:
            s_bytes = await file_start.read()
            mime = file_start.content_type or "image/jpeg"
            veo_params["image"] = types.Image(image_bytes=s_bytes, mime_type=mime)
            is_image_animation = True

        operation = client.models.generate_videos(**veo_params)
        
        while not operation.done:
            time.sleep(5)
            operation = client.operations.get(operation)

        res = operation.result
        if res and res.generated_videos:
            v_bytes = client.files.download(file=res.generated_videos[0].video)
            
            if is_image_animation or user_plan in ["plus", "pro"]:
                final_bytes = v_bytes
            else:
                final_bytes = apply_video_watermark(v_bytes, user_plan)
            
            public_url = upload_to_supabase(final_bytes, "mp4", "video/mp4")
            save_to_history(user_id, "video", public_url, prompt)
            
            return {"video": public_url}
        
        raise HTTPException(500, "O Google não retornou vídeo.")
    except Exception as e:
        print(f"Erro Vídeo: {e}")
        raise HTTPException(status_code=402 if "Saldo" in str(e) else 500, detail=str(e))

# --- ROTA DE RASTREAMENTO DE INDICAÇÃO (CRÍTICA) ---
class ReferralRequest(BaseModel):
    user_id: str
    referral_code: str

@app.post("/track-referral")
async def track_referral_endpoint(req: ReferralRequest):
    try:
        user_check = supabase.table("profiles").select("referred_by, signup_bonus_given").eq("id", req.user_id).execute()
        if not user_check.data: return {"status": "error", "message": "User not found"}
        
        user_data = user_check.data[0]
        if user_data.get('referred_by') or user_data.get('signup_bonus_given'):
             return {"status": "ignored", "message": "Already referred"}

        referrer = supabase.table("profiles").select("id, credits").eq("referral_code", req.referral_code).execute()
        
        if referrer.data:
            ref_id = referrer.data[0]['id']
            ref_credits = referrer.data[0]['credits']
            
            supabase.table("profiles").update({"credits": ref_credits + 50}).eq("id", ref_id).execute()
            
            supabase.table("profiles").update({
                "referred_by": req.referral_code,
                "signup_bonus_given": True 
            }).eq("id", req.user_id).execute()
            
            return {"status": "success"}
            
        return {"status": "error", "message": "Invalid code"}

    except Exception as e:
        print(f"Referral Error: {e}")
        return {"status": "error"}

# --- ROTA CHAT ---
class ChatRequest(BaseModel): history: List[Dict[str, str]]; persona: str 
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        model = "gemini-3-pro-preview"
        sys_inst = "Se pedir imagem use 'PROMPT: '. " + req.persona
        fmt = [types.Content(role=m["role"], parts=[types.Part.from_text(text=m["parts"])]) for m in req.history]
        res = client.models.generate_content(model=model, contents=fmt, config=types.GenerateContentConfig(system_instruction=sys_inst))
        return {"response": res.text or "..."}
    except Exception as e: raise HTTPException(500, str(e))

# --- ROTA CUPOM ---
class CouponRequest(BaseModel): user_id: str; code: str
@app.post("/redeem-coupon")
async def redeem_coupon_endpoint(req: CouponRequest):
    try:
        supabase.rpc("redeem_coupon", {"user_id": req.user_id, "input_code": req.code}).execute()
        return {"message": "Sucesso!"}
    except Exception as e: 
        if "200" in str(e): return {"message": "Sucesso!"}
        raise HTTPException(400, "Erro cupom")

# --- WEBHOOK STRIPE (Com bônus de 100 créditos) ---
@app.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except: raise HTTPException(400, "Webhook Error")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('client_reference_id')
        amount = session.get('amount_total')
        
        if user_id:
            to_add = 0; new_plan = None
            if amount == 6900: to_add = 500; new_plan = 'plus'
            elif amount == 9900: 
                to_add = 1000
                if session.get('mode') == 'subscription': new_plan = 'pro'
            
            try:
                curr = supabase.table("profiles").select("credits, referred_by").eq("id", user_id).execute()
                u_data = curr.data[0]
                data = {"credits": u_data['credits'] + to_add}
                if new_plan: data["plan_tier"] = new_plan
                supabase.table("profiles").update(data).eq("id", user_id).execute()
                
                ref_code = u_data.get('referred_by')
                if ref_code and new_plan:
                    referrer = supabase.table("profiles").select("id, credits").eq("referral_code", ref_code).execute()
                    if referrer.data:
                        supabase.table("profiles").update({"credits": referrer.data[0]['credits'] + 100}).eq("id", referrer.data[0]['id']).execute()
                        
            except Exception as e: print(f"Stripe Error: {e}")

    return {"status": "success"}