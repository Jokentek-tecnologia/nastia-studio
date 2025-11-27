from fastapi import FastAPI, HTTPException, File, UploadFile, Form
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
from typing import List, Dict
from pydantic import BaseModel
from supabase import create_client, Client

# Patch MoviePy
if not hasattr(Image, 'ANTIALIAS'): Image.ANTIALIAS = Image.Resampling.LANCZOS

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Configs
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- FUNÇÕES DE SUPORTE ---
def check_and_deduct_credits(user_id: str, cost: int):
    response = supabase.table("profiles").select("credits, plan_tier").eq("id", user_id).execute()
    if not response.data: raise Exception("Usuário não encontrado.")
    user = response.data[0]
    if user["credits"] < cost: raise Exception(f"Saldo insuficiente.")
    supabase.table("profiles").update({"credits": user["credits"] - cost}).eq("id", user_id).execute()
    return user["plan_tier"]

def upload_to_supabase(file_bytes: bytes, file_ext: str, content_type: str) -> str:
    filename = f"{int(time.time())}_{os.urandom(4).hex()}.{file_ext}"
    supabase.storage.from_("gallery").upload(filename, file_bytes, {"content-type": content_type})
    # Retorna URL pública
    return f"{SUPABASE_URL}/storage/v1/object/public/gallery/{filename}"

def save_to_history(user_id: str, type: str, url: str, prompt: str):
    # Verifica plano para saber se salva (Free não tem memória, conforme sua regra)
    # Mas para UX, geralmente salvamos tudo. Se quiser bloquear visualização no front, ok.
    # Vou salvar tudo para garantir.
    supabase.table("generations").insert({
        "user_id": user_id, "type": type, "url": url, "prompt": prompt
    }).execute()

def apply_watermark(img: Image.Image, plan: str) -> Image.Image:
    # NOVAS REGRAS: Plus e Pro (e antigos Agency) NÃO tem marca. Só Free tem.
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
            logo = (ImageClip(str(lp)).set_duration(vid.duration).resize(height=vid.h * 0.15).margin(right=8, bottom=8, opacity=0).set_pos(("right", "bottom")))
            final = CompositeVideoClip([vid, logo])
            final.write_videofile(out, codec="libx264", audio_codec="aac", preset="ultrafast", threads=1, logger=None)
            vid.close(); final.close()
            with open(out, "rb") as f: return f.read()
        return v_bytes
    except: return v_bytes
    finally:
        try: os.remove(path); os.remove(out)
        except: pass

@app.get("/")
def read_root(): return {"status": "NastIA V4 (Memory + New Plans) Online 🚀"}

# --- ROTAS ---
@app.post("/generate-image")
async def generate_image(prompt: str = Form(...), files: List[UploadFile] = File(None), user_id: str = Form(...)):
    try:
        num_files = len(files) if files else 0
        cost = 10 if num_files > 1 else 5
        user_plan = check_and_deduct_credits(user_id, cost)
        
        model = "gemini-2.5-flash-image"
        contents = [prompt]
        if files:
            for file in files:
                f_bytes = await file.read()
                img = Image.open(io.BytesIO(f_bytes))
                contents.append(img)
        
        response = client.models.generate_content(model=model, contents=contents, config=types.GenerateContentConfig(response_modalities=["IMAGE"]))

        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    gen_img = Image.open(io.BytesIO(part.inline_data.data))
                    final_img = apply_watermark(gen_img, user_plan)
                    
                    buf = io.BytesIO()
                    final_img.save(buf, format="JPEG", quality=95)
                    img_bytes = buf.getvalue()
                    
                    # 1. Upload para Supabase (Memória Permanente)
                    public_url = upload_to_supabase(img_bytes, "jpg", "image/jpeg")
                    
                    # 2. Salva no Histórico
                    save_to_history(user_id, "image", public_url, prompt)
                    
                    # 3. Retorna URL (Frontend agora usa URL, não base64)
                    return {"image": public_url}
                    
        raise HTTPException(500, "Sem imagem.")
    except Exception as e: print(e); raise HTTPException(500, str(e))

@app.post("/generate-video")
async def generate_video(prompt: str = Form(...), file_start: UploadFile = File(None), user_id: str = Form(...)):
    try:
        cost = 20
        user_plan = check_and_deduct_credits(user_id, cost)
        
        model = "veo-3.1-generate-preview"
        veo_params = {"model": model, "prompt": prompt, "config": types.GenerateVideosConfig(number_of_videos=1)}
        if file_start:
            s_bytes = await file_start.read()
            mime = file_start.content_type or "image/jpeg"
            veo_params["image"] = types.Image(image_bytes=s_bytes, mime_type=mime)

        operation = client.models.generate_videos(**veo_params)
        while not operation.done: time.sleep(5); operation = client.operations.get(operation)

        res = operation.result
        if res and res.generated_videos:
            v_bytes = client.files.download(file=res.generated_videos[0].video)
            final_bytes = apply_video_watermark(v_bytes, user_plan)
            
            public_url = upload_to_supabase(final_bytes, "mp4", "video/mp4")
            save_to_history(user_id, "video", public_url, prompt)
            
            return {"video": public_url}
        
        raise HTTPException(500, "Sem vídeo.")
    except Exception as e: print(e); raise HTTPException(500, str(e))

# ROTA DE CHAT (Mantida)
class ChatRequest(BaseModel):
    history: List[Dict[str, str]] 
    persona: str 
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        model = "gemini-3-pro-preview"
        sys_inst = "Se for pedir imagem use 'PROMPT: '. "
        if req.persona == "criativo": sys_inst += "Você é Diretor de Arte."
        elif req.persona == "trafego": sys_inst += "Você é Gestor de Tráfego."
        elif req.persona == "copy": sys_inst += "Você é Copywriter."
        
        fmt_contents = [types.Content(role=m["role"], parts=[types.Part.from_text(text=m["parts"])]) for m in req.history]
        res = client.models.generate_content(model=model, contents=fmt_contents, config=types.GenerateContentConfig(system_instruction=sys_inst))
        return {"response": res.text or "..."}
    except Exception as e: raise HTTPException(500, str(e))

# ROTA CUPOM (Mantida)
class CouponRequest(BaseModel): user_id: str; code: str
@app.post("/redeem-coupon")
async def redeem_coupon_endpoint(req: CouponRequest):
    try:
        supabase.rpc("redeem_coupon", {"user_id": req.user_id, "input_code": req.code}).execute()
        return {"message": "Sucesso!"}
    except Exception as e: 
        if "200" in str(e): return {"message": "Sucesso!"}
        raise HTTPException(400, "Erro cupom")