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

# Patch para Pillow/MoviePy
if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.Resampling.LANCZOS

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Google AI
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- FINANCEIRO ---
def check_and_deduct_credits(user_id: str, cost: int):
    response = supabase.table("profiles").select("credits, plan_tier").eq("id", user_id).execute()
    if not response.data: raise Exception("Usuário não encontrado.")
    user = response.data[0]
    if user["credits"] < cost:
        raise Exception(f"Saldo insuficiente. Necessário: {cost}. Atual: {user['credits']}")
    supabase.table("profiles").update({"credits": user["credits"] - cost}).eq("id", user_id).execute()
    return user["plan_tier"]

# --- MARCA D'ÁGUA ---
def apply_watermark(img: Image.Image, plan: str) -> Image.Image:
    if plan in ["agency", "criação"]: return img.convert("RGB")
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
    else:
        d = ImageDraw.Draw(base)
        try: f = ImageFont.truetype("arial.ttf", 30)
        except: f = ImageFont.load_default()
        d.text((w-200, h-40), "NastIA Studio", fill="white", font=f)
    return base.convert("RGB")

def apply_video_watermark(v_bytes: bytes, plan: str) -> bytes:
    if plan in ["agency", "criação"]: return v_bytes
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
    except: return v_bytes
    finally:
        try: 
            if os.path.exists(path): os.remove(path)
            if os.path.exists(out): os.remove(out)
        except: pass

@app.get("/")
def read_root(): return {"status": "NastIA V3 (Chat Edition) Online 🚀"}

# --- ROTA IMAGEM ---
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
        
        response = client.models.generate_content(
            model=model, contents=contents, 
            config=types.GenerateContentConfig(response_modalities=["IMAGE"])
        )

        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    gen_img = Image.open(io.BytesIO(part.inline_data.data))
                    final_img = apply_watermark(gen_img, user_plan)
                    buf = io.BytesIO()
                    final_img.save(buf, format="JPEG", quality=95)
                    b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
                    return {"image": f"data:image/jpeg;base64,{b64}"}
        raise HTTPException(500, "Sem imagem.")
    except Exception as e:
        print(e); raise HTTPException(500, str(e))

# --- ROTA VÍDEO ---
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
        
        while not operation.done:
            time.sleep(5)
            operation = client.operations.get(operation)

        res = operation.result
        if res and res.generated_videos:
            v_bytes = client.files.download(file=res.generated_videos[0].video)
            final_bytes = apply_video_watermark(v_bytes, user_plan)
            b64 = base64.b64encode(final_bytes).decode('utf-8')
            return {"video": f"data:video/mp4;base64,{b64}"}
        
        raise HTTPException(500, "Sem vídeo.")
    except Exception as e:
        print(f"ERRO: {e}")
        status = 402 if "Saldo" in str(e) else 500
        raise HTTPException(status, str(e))

# ... (Mantenha os imports e o resto do código igual) ...

# --- ROTA DE CHAT (ATUALIZADA: Personas + Formatação) ---
class ChatRequest(BaseModel):
    history: List[Dict[str, str]] 
    persona: str 

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        model = "gemini-3-pro-preview"
        
        # Instrução Base: Força o formato para o botão funcionar
        base_instruction = (
            "Se o usuário pedir uma ideia de imagem ou vídeo, ou se você sugerir um prompt visual, "
            "VOCÊ DEVE iniciar o parágrafo do prompt estritamente com a palavra-chave 'PROMPT: '. "
            "Exemplo: 'Aqui está uma ideia:\nPROMPT: Um gato futurista neon...'. "
            "Se for apenas uma conversa normal, não use esse prefixo."
        )

        # Definição das Personas da Agência
        persona_instruction = ""
        if req.persona == "criativo":
            persona_instruction = "Você é um Diretor de Arte Sênior. Especialista em estética, composição, luz e estilos (Cyberpunk, Minimalista, 3D Render, etc)."
        elif req.persona == "trafego":
            persona_instruction = "Você é um Gestor de Tráfego Pago. Focado em anúncios de alta conversão (Facebook/Google Ads), segmentação de público e ROI."
        elif req.persona == "copy":
            persona_instruction = "Você é um Copywriter de Resposta Direta. Escreve textos persuasivos, gatilhos mentais e roteiros virais para Reels/TikTok."
        elif req.persona == "social":
            persona_instruction = "Você é um Social Media Manager. Especialista em calendários editoriais, engajamento, tendências e planejamento de conteúdo mensal."
        elif req.persona == "seo":
            persona_instruction = "Você é um Especialista em SEO. Focado em palavras-chave, ranqueamento no Google e descrições otimizadas para produtos."
        elif req.persona == "vendas":
            persona_instruction = "Você é um Estrategista de Vendas. Focado em funis de vendas, ofertas irresistíveis e fechamento de negócios."
        else:
            persona_instruction = "Você é um assistente útil da NastIA Studio."

        # Combina as instruções
        full_system_instruction = f"{base_instruction}\n\n{persona_instruction}"

        formatted_contents = []
        for msg in req.history:
            formatted_contents.append(types.Content(
                role=msg["role"],
                parts=[types.Part.from_text(text=msg["parts"])]
            ))

        response = client.models.generate_content(
            model=model,
            contents=formatted_contents,
            config=types.GenerateContentConfig(
                system_instruction=full_system_instruction,
                temperature=0.7,
            )
        )
        
        if response.text:
            return {"response": response.text}
        return {"response": "Estou formulando a estratégia..."}

    except Exception as e:
        print(f"Erro Chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

        # ... (Mantenha todo o código anterior)

# --- ROTA DE CUPOM (CORRIGIDA PARA ACENTOS) ---
class CouponRequest(BaseModel):
    user_id: str
    code: str

@app.post("/redeem-coupon")
async def redeem_coupon_endpoint(req: CouponRequest):
    try:
        response = supabase.rpc("redeem_coupon", {"user_id": req.user_id, "input_code": req.code}).execute()
        
        # Se chegou aqui sem cair no 'except', deu tudo certo
        return {"message": "Cupom resgatado com sucesso!"}

    except Exception as e:
        error_str = str(e)
        print(f"Log Cupom: {error_str}")

        # --- CORREÇÃO DO BUG DO ACENTO ---
        # Se o erro contém 'code': 200 ou "success", significa que funcionou
        # mas o Python falhou ao ler o acento da mensagem de retorno.
        if "'code': 200" in error_str or "success" in error_str:
            return {"message": "Cupom resgatado com sucesso!"}
            
        # Se for erro real (Cupom inválido, expirado, etc)
        detail = "Cupom inválido ou expirado."
        if "Cupom" in error_str: 
             # Tenta limpar a mensagem de erro técnica
             detail = "Cupom inválido."
        
        raise HTTPException(status_code=400, detail=detail)