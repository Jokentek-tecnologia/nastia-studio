from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Request
from google import genai
from google.genai import types
from google.oauth2 import service_account
import google.auth.transport.requests
import requests
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from dotenv import load_dotenv
from pathlib import Path
import base64
import io
from PIL import Image
import time
import tempfile
from moviepy.editor import VideoFileClip, ImageClip, CompositeVideoClip
import traceback
from typing import List, Dict
from supabase import create_client, Client
from pydantic import BaseModel
import stripe
import urllib.request

# Patch Pillow
if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.Resampling.LANCZOS

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

SYSTEM_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=SYSTEM_API_KEY)

STRIPE_API_KEY = os.getenv("STRIPE_API_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
stripe.api_key = STRIPE_API_KEY

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

COST_IMAGE = 10
COST_VIDEO = 50
COST_TRYON = 80

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

def check_and_deduct_credits(user_id: str, cost: int):
    response = supabase.table("profiles").select("credits, plan_tier").eq("id", user_id).execute()
    if not response.data: raise Exception("Usuário não encontrado.")
    user = response.data[0]
    if user["credits"] < cost:
        raise Exception(f"Saldo insuficiente. Necessário: {cost}. Atual: {user['credits']}")
    supabase.table("profiles").update({"credits": user["credits"] - cost}).eq("id", user_id).execute()
    return user["plan_tier"]

def refund_credits(user_id: str, cost: int):
    if cost > 0:
        try:
            curr = supabase.table("profiles").select("credits").eq("id", user_id).execute()
            if curr.data:
                supabase.table("profiles").update({"credits": curr.data[0]['credits'] + cost}).eq("id", user_id).execute()
        except: pass

def upload_to_supabase(file_bytes: bytes, file_ext: str, content_type: str) -> str:
    filename = f"{int(time.time())}_{os.urandom(4).hex()}.{file_ext}"
    try:
        supabase.storage.from_("gallery").upload(filename, file_bytes, {"content-type": content_type})
        return f"{SUPABASE_URL}/storage/v1/object/public/gallery/{filename}"
    except Exception as e:
        print(f"Erro Upload: {e}")
        return ""

def save_to_history(user_id: str, type: str, url: str, prompt: str):
    try: supabase.table("generations").insert({"user_id": user_id, "type": type, "url": url, "prompt": prompt}).execute()
    except: pass

def apply_watermark(img: Image.Image, plan: str) -> Image.Image:
    if plan in ["plus", "pro", "agency", "criação"]: return img.convert("RGB")
    try:
        base = img.convert("RGBA")
        w, h = base.size
        logo_path = Path(__file__).parent / "logo.png"
        if logo_path.exists():
            logo = Image.open(logo_path).convert("RGBA")
            lw = int(w * 0.12)
            ar = logo.width / logo.height
            lh = int(lw / ar)
            logo = logo.resize((lw, lh), Image.Resampling.LANCZOS)
            base.paste(logo, (w - lw - int(w*0.03), h - lh - int(w*0.03)), logo)
        return base.convert("RGB")
    except: return img.convert("RGB")

def apply_video_watermark(v_bytes: bytes, plan: str) -> bytes:
    if plan in ["plus", "pro", "agency", "criação"]: return v_bytes
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(v_bytes); tmp_path = tmp.name
        out_path = tmp_path.replace(".mp4", "_wm.mp4")
        logo_path = Path(__file__).parent / "logo.png"
        if logo_path.exists():
            vid = VideoFileClip(tmp_path)
            logo = (ImageClip(str(logo_path)).set_duration(vid.duration).resize(height=vid.h * 0.15).margin(right=8, bottom=8, opacity=0).set_pos(("right", "bottom")))
            final = CompositeVideoClip([vid, logo])
            final.write_videofile(out_path, codec="libx264", audio_codec="aac", preset="ultrafast", threads=2, logger=None)
            vid.close(); final.close()
            with open(out_path, "rb") as f: return f.read()
        return v_bytes
    except: return v_bytes
    finally:
        try: os.remove(tmp_path); os.remove(out_path)
        except: pass

def decode_base64_image(image_string):
    if not image_string: return None
    if "base64," in image_string: image_string = image_string.split("base64,")[1]
    return Image.open(io.BytesIO(base64.b64decode(image_string)))

def get_vertex_token():
    try:
        creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
        if not creds_json: return None
        info = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=["https://www.googleapis.com/auth/cloud-platform"])
        auth_req = google.auth.transport.requests.Request()
        creds.refresh(auth_req)
        return creds.token
    except Exception as e:
        print(f"Erro Auth Vertex: {e}")
        return None

@app.get("/")
def read_root(): return {"status": "NastIA V17 (TryOn Ready) Online 🚀"}

@app.post("/generate-image")
async def generate_image(
    prompt: str = Form(...), 
    files: List[UploadFile] = File(None), 
    from_image: str = Form(None),
    context_url: str = Form(None),
    user_id: str = Form(...),
    aspect_ratio: str = Form("16:9")
):
    cost = COST_IMAGE
    try:
        user_plan = check_and_deduct_credits(user_id, cost)
        has_input_image = (files and len(files) > 0) or (from_image is not None) or (context_url is not None)
        model = "gemini-2.5-flash-image"
        ratio_map = { "16:9": "wide 16:9 aspect ratio", "9:16": "tall 9:16 aspect ratio", "1:1": "square 1:1 aspect ratio", "4:3": "classic 4:3", "3:4": "portrait 3:4", "21:9": "cinematic 21:9" }
        final_prompt = prompt if has_input_image else f"{prompt}. Create this image in {ratio_map.get(aspect_ratio, 'wide 16:9')}, high quality."
        contents_parts = [types.Part.from_text(text=final_prompt)]
        input_img = None
        if files:
            f_bytes = await files[0].read()
            input_img = Image.open(io.BytesIO(f_bytes))
        elif from_image:
            input_img = decode_base64_image(from_image)
        elif context_url:
            try:
                with urllib.request.urlopen(context_url) as response:
                    input_img = Image.open(io.BytesIO(response.read()))
            except: pass

        if input_img:
            if input_img.mode != 'RGB': input_img = input_img.convert('RGB')
            buf = io.BytesIO(); input_img.save(buf, format="JPEG"); 
            contents_parts.append(types.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg"))
        
        response = client.models.generate_content(model=model, contents=[types.Content(role="user", parts=contents_parts)], config=types.GenerateContentConfig(response_modalities=["IMAGE"]))
        if response.candidates and response.candidates[0].content.parts:
            part = response.candidates[0].content.parts[0]
            if part.inline_data:
                gen_img = Image.open(io.BytesIO(part.inline_data.data))
                final_img = apply_watermark(gen_img, user_plan)
                buf = io.BytesIO(); final_img.save(buf, format="JPEG", quality=95)
                public_url = upload_to_supabase(buf.getvalue(), "jpg", "image/jpeg")
                save_to_history(user_id, "image", public_url, prompt)
                return {"image": public_url}
        raise Exception("API Google não retornou imagem.")
    except Exception as e:
        refund_credits(user_id, cost)
        print(f"Erro Imagem: {e}")
        raise HTTPException(500, str(e))

@app.post("/generate-video")
async def generate_video(
    prompt: str = Form(...), 
    file_start: UploadFile = File(None), 
    user_id: str = Form(...),
    aspect_ratio: str = Form("16:9")
):
    cost = COST_VIDEO
    try:
        user_plan = check_and_deduct_credits(user_id, cost)
        model = "veo-3.1-generate-preview"
        veo_params = { "model": model, "prompt": prompt, "config": types.GenerateVideosConfig(number_of_videos=1, aspect_ratio=aspect_ratio) }
        if file_start:
            s_bytes = await file_start.read()
            veo_params["image"] = types.Image(image_bytes=s_bytes, mime_type=file_start.content_type or "image/jpeg")
        operation = client.models.generate_videos(**veo_params)
        while not operation.done:
            time.sleep(5)
            operation = client.operations.get(operation)
        res = operation.result
        if res and res.generated_videos:
            v_bytes = client.files.download(file=res.generated_videos[0].video)
            final_bytes = apply_video_watermark(v_bytes, user_plan)
            public_url = upload_to_supabase(final_bytes, "mp4", "video/mp4")
            save_to_history(user_id, "video", public_url, prompt)
            return {"video": public_url}
        raise Exception("API Veo falhou.")
    except Exception as e:
        refund_credits(user_id, cost)
        print(f"Erro Vídeo: {e}")
        raise HTTPException(500, str(e))

@app.post("/generate-tryon")
async def generate_tryon(
    person_image: UploadFile = File(...),
    garment_image: UploadFile = File(...),
    user_id: str = Form(...),
    category: str = Form("tops")
):
    cost = COST_TRYON
    try:
        check_and_deduct_credits(user_id, cost)
        token = get_vertex_token()
        if not token: raise Exception("Auth Vertex falhou.")
        p_bytes = await person_image.read()
        g_bytes = await garment_image.read()
        p_b64 = base64.b64encode(p_bytes).decode('utf-8')
        g_b64 = base64.b64encode(g_bytes).decode('utf-8')
        PROJECT_ID = "nastia-studio-app"
        REGION = "us-central1"
        endpoint = f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/virtual-try-on-preview-08-04:predict"
        headers = { "Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8" }
        payload = { "instances": [ { "personImage": { "image": { "bytesBase64Encoded": p_b64 } }, "productImages": [ { "image": { "bytesBase64Encoded": g_b64 } } ] } ], "parameters": { "sampleCount": 1 } }
        response = requests.post(endpoint, headers=headers, json=payload)
        if response.status_code != 200: raise Exception(f"Erro Vertex: {response.text}")
        result = response.json()
        if "predictions" in result and len(result["predictions"]) > 0:
            output_bytes = base64.b64decode(result["predictions"][0]["bytesBase64Encoded"])
            public_url = upload_to_supabase(output_bytes, "png", "image/png")
            save_to_history(user_id, "image", public_url, "Provador Virtual")
            return {"image": public_url}
        raise Exception("Sem retorno.")
    except Exception as e:
        refund_credits(user_id, cost)
        print(f"Erro TryOn: {e}")
        raise HTTPException(500, str(e))

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        model = "gemini-2.5-flash"
        sys_inst = "Se pedir imagem use 'PROMPT: '. " + req.persona
        fmt = [types.Content(role=m["role"], parts=[types.Part.from_text(text=m["parts"])]) for m in req.history]
        res = client.models.generate_content(model=model, contents=fmt, config=types.GenerateContentConfig(system_instruction=sys_inst))
        return {"response": res.text or "..."}
    except Exception as e: 
        print(f"Erro Chat: {e}")
        raise HTTPException(500, str(e))

@app.post("/track-referral")
async def track_referral_endpoint(req: ReferralRequest):
    try:
        user_check = supabase.table("profiles").select("referred_by, signup_bonus_given, credits").eq("id", req.user_id).execute()
        if not user_check.data: return {"status": "error"}
        if user_check.data[0].get('referred_by'): return {"status": "ignored"}
        referrer = supabase.table("profiles").select("id, credits").eq("referral_code", req.referral_code).execute()
        if referrer.data:
            supabase.table("profiles").update({"credits": referrer.data[0]['credits'] + 100}).eq("id", referrer.data[0]['id']).execute()
            supabase.table("profiles").update({"referred_by": req.referral_code, "signup_bonus_given": True, "credits": user_check.data[0]['credits'] + 50}).eq("id", req.user_id).execute()
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
        if (user.get('coins') or 0) < 250: raise HTTPException(400, "Saldo insuficiente.")
        supabase.table("profiles").update({"coins": user['coins'] - 250, "plan_tier": "plus", "credits": 1000}).eq("id", user_id).execute()
        return {"status": "success"}
    except Exception as e: raise HTTPException(500, str(e))

@app.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    try: event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except: raise HTTPException(400, "Webhook Error")
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('client_reference_id')
        amount = session.get('amount_total')
        mode = session.get('mode')
        if user_id:
            to_add = 0; new_plan = None
            if amount == 6900: to_add = 500; new_plan = 'plus'
            elif amount == 9900:
                if mode == 'subscription': to_add = 1500; new_plan = 'pro'
                else: to_add = 600
            try:
                curr = supabase.table("profiles").select("credits, referred_by").eq("id", user_id).execute()
                if curr.data:
                    u_data = curr.data[0]
                    data = {"credits": u_data['credits'] + to_add}
                    if new_plan: data["plan_tier"] = new_plan
                    supabase.table("profiles").update(data).eq("id", user_id).execute()
                    if u_data.get('referred_by') and new_plan:
                        referrer = supabase.table("profiles").select("id, credits, coins").eq("referral_code", u_data.get('referred_by')).execute()
                        if referrer.data:
                            rd = referrer.data[0]
                            supabase.table("profiles").update({"credits": rd['credits'] + 100, "coins": (rd.get('coins') or 0) + 10}).eq("id", rd['id']).execute()
            except Exception as e: print(f"Stripe: {e}")
    return {"status": "success"}