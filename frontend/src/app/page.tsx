"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { 
  Sparkles, Image as ImageIcon, Upload, X, Video as VideoIcon, 
  Film, XCircle, Edit, LogOut, User, Coins, Crown, Gift, 
  Share2, Download, Instagram, Globe, MessageCircle, Plus, Copy,
  ArrowRightCircle, Layers, Clock, Smartphone
} from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import Login from "../components/Login";
import ChatWidget from "../components/ChatWidget";
import StoreModal from "../components/StoreModal";
import AdPlayer from "../components/AdPlayer"; 

// --- IMPORTAÇÃO SEGURA DO EDITOR (EVITA CRASH NO MOBILE) ---
const ImageEditor = dynamic(() => import("../components/ImageEditor"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white">Carregando Editor...</div>
});

const SHORT_ADS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
];
const LONG_ADS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
];

export default function Home() {
  // Auth & Profile
  const [session, setSession] = useState<any>(null);
  const [credits, setCredits] = useState<number>(0);
  const [plan, setPlan] = useState<string>("free");
  const [referralCode, setReferralCode] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(true);

  // App State
  const [mode, setMode] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]); 
  const [isMobile, setIsMobile] = useState(false); // <--- ESTADO DO MOBILE
  
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentAdUrl, setCurrentAdUrl] = useState("");
  const [pendingResult, setPendingResult] = useState<string | null>(null);
  const [adProgress, setAdProgress] = useState(0);
  
  // Galeria (Memória)
  const [history, setHistory] = useState<any[]>([]);

  // Modais
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. DETECÇÃO DE MOBILE ---
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // --- 2. BUSCAR DADOS E HISTÓRICO ---
  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
        setCredits(data.credits);
        setPlan(data.plan_tier);
        setReferralCode(data.referral_code);
    }
  };

  const fetchHistory = async (userId: string) => {
      // Busca as últimas 8 criações
      const { data } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(8);
      
      if (data) setHistory(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
          fetchProfile(session.user.id);
          fetchHistory(session.user.id);
      }
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      if (session) {
          fetchProfile(session.user.id);
          fetchHistory(session.user.id);
      } else setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => await supabase.auth.signOut();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const newFiles = Array.from(e.target.files);
        if (mode === "video") setImageFiles([newFiles[0]]);
        else setImageFiles(prev => [...prev, ...newFiles].slice(0, 8));
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
      setResultUrl(null);
      setImageFiles([]);
      setPrompt("");
  };

  const handleTransformToVideo = async () => {
    if (!resultUrl) return;
    try {
        const res = await fetch(resultUrl);
        const blob = await res.blob();
        const file = new File([blob], "generated_base.jpg", { type: "image/jpeg" });
        
        setMode("video");       
        setImageFiles([file]);  
        setResultUrl(null);     
        setPrompt("");          
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error("Erro ao transformar:", error);
        alert("Erro ao preparar imagem para vídeo.");
    }
  };

  const prepareAd = () => {
    const list = mode === "image" ? SHORT_ADS : LONG_ADS;
    setCurrentAdUrl(list[Math.floor(Math.random() * list.length)]);
    setAdProgress(0);
  };

  const handleGenerate = async () => {
    if (!prompt) return;

    const isEditingContext = mode === "image" && resultUrl && imageFiles.length === 0;

    let cost = 5;
    if (mode === "image" && (imageFiles.length > 1 || isEditingContext)) cost = 10;
    if (mode === "video") cost = 20;

    if (credits < cost) {
        alert(`Saldo insuficiente! Necessário: ${cost}. Abrindo loja...`);
        setIsStoreOpen(true);
        return;
    }

    prepareAd();
    setLoading(true);
    
    const previousResult = resultUrl;
    setResultUrl(null);
    setPendingResult(null);

    const formData = new FormData();
    formData.append("user_id", session.user.id);

    if (isEditingContext) {
        const engineeredPrompt = `INSTRUCTION: EDIT THE ATTACHED IMAGE. Keep the composition, lighting, and main subject exactly as they are. Only apply this specific change: ${prompt}`;
        formData.append("prompt", engineeredPrompt);
    } else {
        formData.append("prompt", prompt);
    }

    if (mode === "image") {
        if (imageFiles.length > 0) {
            imageFiles.forEach(file => formData.append("files", file));
        } else if (previousResult) {
            try {
                const res = await fetch(previousResult);
                const blob = await res.blob();
                const file = new File([blob], "context_image.jpg", { type: "image/jpeg" });
                formData.append("files", file);
            } catch (e) {
                console.error("Erro contexto:", e);
            }
        }
    } else {
        if (imageFiles.length > 0) formData.append("file_start", imageFiles[0]);
    }

    try {
      const endpoint = mode === "image" 
        ? `${process.env.NEXT_PUBLIC_API_URL}/generate-image`
        : `${process.env.NEXT_PUBLIC_API_URL}/generate-video`;

      const res = await axios.post(endpoint, formData, { headers: { "Content-Type": "multipart/form-data" } });

      fetchProfile(session.user.id);
      fetchHistory(session.user.id); // Atualiza a galeria
      
      const url = res.data.image || res.data.video;

      if (mode === "video") {
        setResultUrl(url);
        setLoading(false);
      } else {
        setPendingResult(url);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.detail || "Erro ao gerar.");
      setLoading(false);
      if (mode === "image") setResultUrl(previousResult);
    }
  };

  const copyReferral = () => {
      navigator.clipboard.writeText(`https://nastia.com.br?ref=${referralCode}`);
      alert("Link de indicação copiado!");
  }

  const handleDownload = (url: string, type: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `NastIA-${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (url: string, type: string) => {
     if (navigator.share) {
         try {
             const res = await fetch(url);
             const blob = await res.blob();
             const file = new File([blob], "nastia." + (type==='image'?'jpg':'mp4'), { type: blob.type });
             await navigator.share({ files: [file] });
         } catch (e) {}
     } else alert("Compartilhamento não suportado. Use Baixar.");
  };

  const handleAdEnded = () => {
    if (mode === "image" && pendingResult) {
        setResultUrl(pendingResult);
        setLoading(false);
        setPendingResult(null);
    } 
  };

  useEffect(() => {
    if (loading) {
        const i = setInterval(() => setAdProgress(o => (o < 95 ? o + 0.5 : o)), 100);
        return () => clearInterval(i);
    }
  }, [loading]);

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full"></div></div>;
  if (!session) return <Login />;

  const isEditing = mode === "image" && resultUrl && imageFiles.length === 0;
  const currentCost = mode === "image" ? (imageFiles.length > 1 || isEditing ? 10 : 5) : 20;

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col font-sans relative overflow-x-hidden">
      
      <header className="w-full p-4 border-b border-gray-800 bg-black/50 backdrop-blur-md flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
             <img src="/app-logo.png" alt="NastIA Logo" className="h-10 w-auto object-contain" />
             <div className="hidden sm:block">
                <h1 className="font-bold text-lg leading-none">NastIA Studio</h1>
                <p className="text-[10px] text-gray-500">Plataforma Criativa</p>
             </div>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex flex-col items-end cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setIsStoreOpen(true)}>
                <div className="flex items-center gap-1.5 text-yellow-500 font-bold">
                    <Coins className="w-4 h-4" /> <span>{credits}</span>
                </div>
                <div className="text-[10px] text-gray-500 bg-gray-900 px-2 rounded-full border border-gray-800 uppercase">{plan}</div>
            </div>
            <img src={session.user.user_metadata.avatar_url} className="w-9 h-9 rounded-full border border-gray-700" />
            <button onClick={handleLogout} className="p-2 hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-lg"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {/* MODAIS */}
      {isEditorOpen && resultUrl && <ImageEditor imageUrl={resultUrl} onClose={() => setIsEditorOpen(false)} />}
      
      {isStoreOpen && (
        <StoreModal userId={session.user.id} currentPlan={plan} referralCode={referralCode} onClose={() => setIsStoreOpen(false)} onUpdate={() => fetchProfile(session.user.id)} />
      )}

      {/* --- TELA DE ESPERA BLINDADA --- */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4 text-center">
             <div className="absolute top-8 right-8 flex items-center gap-2 text-yellow-500 animate-pulse z-20">
                <Sparkles className="w-5 h-5" />
                <span className="font-bold tracking-widest">{pendingResult ? "FINALIZANDO..." : "CRIANDO..."}</span>
             </div>
             
             {isMobile ? (
                <div className="flex flex-col items-center gap-6 z-20">
                    <div className="w-20 h-20 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Processando com IA...</h2>
                        <p className="text-gray-400 text-sm max-w-xs mx-auto">Usando GPUs de alta performance. Aguarde sem fechar.</p>
                    </div>
                </div>
             ) : (
                <AdPlayer src={currentAdUrl} onEnded={handleAdEnded} />
             )}
             
             <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800"><div className="h-full bg-gradient-to-r from-yellow-500 to-purple-600 transition-all duration-100 ease-linear" style={{ width: `${adProgress}%` }}/></div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-4 py-10 w-full max-w-3xl mx-auto space-y-8">
        
        <div className="flex w-full bg-gray-900 p-1.5 rounded-2xl border border-gray-800">
            <button onClick={() => {setMode("image"); setImageFiles([]);}} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${mode === "image" ? "bg-gray-800 text-white shadow-lg border border-gray-700" : "text-gray-500 hover:text-gray-300"}`}><ImageIcon className="w-5 h-5" /> Imagem</button>
            <button onClick={() => {setMode("video"); setImageFiles([]);}} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${mode === "video" ? "bg-blue-900/30 text-blue-200 shadow-lg border border-blue-800/50" : "text-gray-500 hover:text-gray-300"}`}><VideoIcon className="w-5 h-5" /> Vídeo</button>
        </div>

        <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-purple-500 opacity-20 group-hover:opacity-50 transition-opacity"></div>
            
            <div className="space-y-4 mb-6">
                <div className="flex flex-wrap gap-3">
                    {imageFiles.map((file, idx) => (
                        <div key={idx} className="relative w-20 h-20 bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group/img">
                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover opacity-70 group-hover/img:opacity-100 transition-opacity" />
                            <button onClick={() => removeImage(idx)} className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500"><XCircle className="w-4 h-4"/></button>
                        </div>
                    ))}
                    {((mode === "image" && imageFiles.length < 8) || (mode === "video" && imageFiles.length < 1)) && (
                        <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-gray-500 transition-all hover:bg-gray-800/50">
                            <Plus className="w-6 h-6" /><span className="text-[9px] mt-1">{mode === 'video' ? 'Start Frame' : 'Add'}</span>
                        </button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" multiple={mode === "image"} />
                </div>
                
                {isEditing && (
                    <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/20">
                        <Layers className="w-4 h-4" /><span>Modo Edição Ativo: A IA vai alterar a imagem atual.</span>
                        <button onClick={handleClearAll} className="ml-auto hover:underline text-gray-400 hover:text-white">Limpar</button>
                    </div>
                )}
                {mode === "video" && imageFiles.length === 0 && <p className="text-xs text-blue-400 flex items-center gap-2"><Film className="w-3 h-3"/> Dica: Adicione uma imagem para guiar o vídeo.</p>}
            </div>

            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={isEditing ? "O que você quer mudar na imagem?" : "Descreva sua criação..."} className="w-full bg-[#18181b] border border-gray-700 rounded-xl p-4 text-gray-200 focus:ring-2 focus:ring-yellow-500 focus:outline-none resize-none h-32 mb-4 placeholder:text-gray-600" />

            <button onClick={handleGenerate} disabled={loading || !prompt || credits < currentCost} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl ${loading || credits < currentCost ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-white text-black hover:bg-gray-200 hover:scale-[1.01]"}`}>
                 {loading ? <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full"/> : <Sparkles className="w-5 h-5 fill-black" />}
                 {loading ? "Processando..." : (credits < currentCost ? "Saldo Insuficiente" : `${isEditing ? 'Editar Imagem' : 'Gerar'} (-${currentCost})`)}
            </button>
        </div>

        {resultUrl && !loading && (
          <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h3 className="text-gray-400 flex items-center gap-2 font-medium"><Sparkles className="w-4 h-4 text-green-500" /> Resultado Pronto</h3>
                <div className="flex flex-wrap gap-2">
                    {mode === "image" && <button onClick={handleTransformToVideo} className="flex items-center gap-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-blue-500/20"><ArrowRightCircle className="w-3 h-3" /> Animar</button>}
                    
                    {/* ESCONDE EDITOR NO MOBILE */}
                    {!isMobile && mode === "image" && (
                        <button onClick={() => setIsEditorOpen(true)} className="flex items-center gap-1.5 bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"><Edit className="w-3 h-3" /> Editar</button>
                    )}
                    
                    <button onClick={() => handleShare(resultUrl, mode)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"><Share2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDownload(resultUrl, mode)} className="p-2 bg-white text-black hover:bg-gray-200 rounded-lg transition-colors shadow-lg shadow-white/10"><Download className="w-4 h-4" /></button>
                </div>
             </div>
             <div className="rounded-xl overflow-hidden border border-gray-800 bg-black/50 relative group">
                {mode === "image" ? <img src={resultUrl} className="w-full max-h-[500px] object-contain" /> : <video src={resultUrl} controls autoPlay loop className="w-full max-h-[500px]" />}
             </div>
          </div>
        )}
      </div>

      {/* --- MEMÓRIA / GALERIA (Item 3) --- */}
      {history.length > 0 && (
        <div className="w-full max-w-5xl mx-auto p-6 border-t border-gray-900">
            <h3 className="text-gray-400 font-bold mb-4 flex items-center gap-2"><Clock className="w-4 h-4"/> Histórico Recente</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {history.map((item) => (
                    <div key={item.id} className="aspect-square bg-gray-900 rounded-xl overflow-hidden border border-gray-800 relative group">
                        {item.type === 'image' ? 
                            <img src={item.url} className="w-full h-full object-cover" /> : 
                            <video src={item.url} className="w-full h-full object-cover" muted />
                        }
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button onClick={() => handleDownload(item.url, item.type)} className="p-2 bg-white text-black rounded-full"><Download className="w-4 h-4"/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      <footer className="w-full py-8 mt-10 border-t border-gray-900 bg-black/80 text-center text-gray-600 text-sm">
         <div className="flex justify-center gap-6 mb-4">
            <a href="#" className="hover:text-pink-500 transition-colors flex gap-1 items-center"><Instagram className="w-4 h-4" /> Instagram</a>
            <a href="#" className="hover:text-green-500 transition-colors flex gap-1 items-center"><MessageCircle className="w-4 h-4" /> Whatsapp</a>
            <a href="#" className="hover:text-blue-500 transition-colors flex gap-1 items-center"><Globe className="w-4 h-4" /> nastia.com.br</a>
         </div>
         <div className="mt-4 flex flex-col items-center gap-2">
            <p>© 2025 NastIA Studio - Jokentek.</p>
            {referralCode && (
                <div onClick={copyReferral} className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-full border border-gray-800 cursor-pointer hover:border-yellow-500/50 transition-colors group">
                    <Gift className="w-3 h-3 text-yellow-500" />
                    <span className="text-xs group-hover:text-white">Indique e Ganhe: {referralCode}</span>
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            )}
         </div>
      </footer>
      <ChatWidget onApplyPrompt={(text) => { setPrompt(text); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
    </main>
  );
}