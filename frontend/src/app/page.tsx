"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
    Sparkles, Image as ImageIcon, Video as VideoIcon,
    Film, XCircle, Edit, LogOut, Coins, Gift,
    Share2, Download, Instagram, Globe, MessageCircle, Plus, Copy,
    ArrowRightCircle, Layers, Clock, Smartphone, CheckCircle, RectangleHorizontal, RectangleVertical
} from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import Login from "../components/Login";
import ChatWidget from "../components/ChatWidget";
import StoreModal from "../components/StoreModal";
import AdPlayer from "../components/AdPlayer";

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
    const [session, setSession] = useState<any>(null);
    const [credits, setCredits] = useState<number>(0);
    const [plan, setPlan] = useState<string>("free");
    const [referralCode, setReferralCode] = useState<string>("");
    const [authLoading, setAuthLoading] = useState(true);

    const [mode, setMode] = useState<"image" | "video" | "gallery">("image");
    const [prompt, setPrompt] = useState("");
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [isMobile, setIsMobile] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");

    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentAdUrl, setCurrentAdUrl] = useState("");
    const [pendingResult, setPendingResult] = useState<string | null>(null);
    const [adProgress, setAdProgress] = useState(0);

    const [history, setHistory] = useState<any[]>([]);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isStoreOpen, setIsStoreOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check(); window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const fetchProfile = async (userId: string) => {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) { setCredits(data.credits); setPlan(data.plan_tier); setReferralCode(data.referral_code); }
    };

    const fetchHistory = async (userId: string) => {
        const { data } = await supabase.from('generations').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
        if (data) setHistory(data);
    };

    const handleLoginSuccess = async (session: any) => {
        fetchProfile(session.user.id);
        fetchHistory(session.user.id);
        const savedRef = localStorage.getItem("nastia_referrer");
        if (savedRef) {
            try { await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/track-referral`, { user_id: session.user.id, referral_code: savedRef }); localStorage.removeItem("nastia_referrer"); } catch (e) { }
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); if (session) handleLoginSuccess(session); setAuthLoading(false); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => { setSession(session); if (session) handleLoginSuccess(session); else setAuthLoading(false); });
        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => await supabase.auth.signOut();
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { const newFiles = Array.from(e.target.files); if (mode === "video") setImageFiles([newFiles[0]]); else setImageFiles(prev => [...prev, ...newFiles].slice(0, 8)); } };
    const removeImage = (index: number) => { setImageFiles(prev => prev.filter((_, i) => i !== index)); };
    const handleClearAll = () => { setResultUrl(null); setImageFiles([]); setPrompt(""); };

    const handleTransformToVideo = async (targetUrl: string | null) => {
        const urlToUse = targetUrl || resultUrl;
        if (!urlToUse) return;
        try {
            const res = await fetch(urlToUse); const blob = await res.blob(); const file = new File([blob], "base.jpg", { type: "image/jpeg" });
            setMode("video"); setImageFiles([file]); setResultUrl(null); setPrompt(""); window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) { }
    };

    const prepareAd = () => { const list = mode === "image" ? SHORT_ADS : LONG_ADS; setCurrentAdUrl(list[Math.floor(Math.random() * list.length)]); setAdProgress(0); };

    const handleGenerate = async () => {
        if (!prompt) return;
        const isEditingContext = mode === "image" && resultUrl && imageFiles.length === 0;
        let cost = 5;
        if (mode === "image" && (imageFiles.length > 1 || isEditingContext)) cost = 10;
        if (mode === "video") cost = 20;
        if (credits < cost) { alert(`Saldo insuficiente!`); setIsStoreOpen(true); return; }
        prepareAd(); setLoading(true); const previousResult = resultUrl; setResultUrl(null); setPendingResult(null);
        const formData = new FormData(); formData.append("user_id", session.user.id); formData.append("aspect_ratio", aspectRatio);
        if (isEditingContext) formData.append("prompt", `EDIT IMAGE: ${prompt}`); else formData.append("prompt", prompt);

        if (mode === "image") {
            if (imageFiles.length > 0) imageFiles.forEach(file => formData.append("files", file));
            else if (previousResult) { try { const res = await fetch(previousResult); const blob = await res.blob(); const file = new File([blob], "ctx.jpg", { type: "image/jpeg" }); formData.append("files", file); } catch (e) { } }
        } else { if (imageFiles.length > 0) formData.append("file_start", imageFiles[0]); }

        try {
            const endpoint = mode === "image" ? `${process.env.NEXT_PUBLIC_API_URL}/generate-image` : `${process.env.NEXT_PUBLIC_API_URL}/generate-video`;
            const res = await axios.post(endpoint, formData, { headers: { "Content-Type": "multipart/form-data" } });
            fetchProfile(session.user.id); fetchHistory(session.user.id);
            const url = res.data.image || res.data.video;
            if (mode === "video") { setResultUrl(url); setLoading(false); } else { setPendingResult(url); }
        } catch (error: any) { alert(error.response?.data?.detail || "Erro."); setLoading(false); if (mode === "image") setResultUrl(previousResult); }
    };

    const handleAdEnded = () => { if (mode === "image" && pendingResult) { setResultUrl(pendingResult); setLoading(false); setPendingResult(null); } };
    const handleSkipAd = () => { if (pendingResult) { setResultUrl(pendingResult); setLoading(false); setPendingResult(null); } };
    const copyReferral = () => { navigator.clipboard.writeText(`https://nastia.com.br?ref=${referralCode}`); alert("Copiado!"); }
    const handleDownload = (url: string, type: string) => { const link = document.createElement("a"); link.href = url; link.download = `NastIA.${type === 'image' ? 'jpg' : 'mp4'}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    const handleShare = async (url: string, type: string) => { if (navigator.share) try { const res = await fetch(url); const blob = await res.blob(); await navigator.share({ files: [new File([blob], "nastia." + (type === 'image' ? 'jpg' : 'mp4'), { type: blob.type })] }); } catch (e) { } else alert("Use Baixar."); };
    useEffect(() => { if (loading) { const i = setInterval(() => setAdProgress(o => (o < 95 ? o + 0.5 : o)), 100); return () => clearInterval(i); } }, [loading]);

    if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full"></div></div>;
    if (!session) return <Login />;

    const isEditing = mode === "image" && resultUrl && imageFiles.length === 0;
    const currentCost = mode === "image" ? (imageFiles.length > 1 || isEditing ? 10 : 5) : 20;

    return (
        <main className="min-h-screen bg-[#050505] text-white flex flex-col font-sans relative overflow-x-hidden">
            <header className="w-full p-4 border-b border-gray-800 bg-black/50 backdrop-blur-md flex justify-between items-center sticky top-0 z-30">
                <div className="flex items-center gap-3"><img src="/app-logo.png" className="h-10 w-auto object-contain" /><div className="hidden sm:block"><h1 className="font-bold text-lg leading-none">NastIA Studio</h1><p className="text-[10px] text-gray-500">Plataforma Criativa</p></div></div>
                <div className="flex items-center gap-4"><div className="flex flex-col items-end cursor-pointer" onClick={() => setIsStoreOpen(true)}><div className="flex items-center gap-1.5 text-yellow-500 font-bold"><Coins className="w-4 h-4" /> <span>{credits}</span></div><div className="text-[10px] text-gray-500 bg-gray-900 px-2 rounded-full uppercase">{plan}</div></div><img src={session.user.user_metadata.avatar_url} className="w-9 h-9 rounded-full border border-gray-700" /><button onClick={handleLogout} className="p-2 hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-lg"><LogOut className="w-5 h-5" /></button></div>
            </header>

            {isEditorOpen && resultUrl && <ImageEditor imageUrl={resultUrl} onClose={() => setIsEditorOpen(false)} />}
            {isStoreOpen && <StoreModal userId={session.user.id} currentPlan={plan} referralCode={referralCode} onClose={() => setIsStoreOpen(false)} onUpdate={() => fetchProfile(session.user.id)} />}

            {loading && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4 text-center">
                    {pendingResult && <button onClick={handleSkipAd} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-green-500 text-black px-8 py-4 rounded-full font-bold text-xl shadow-2xl animate-bounce flex items-center gap-2"><CheckCircle className="w-6 h-6" /> VER RESULTADO AGORA</button>}
                    <div className="absolute top-8 right-8 flex items-center gap-2 text-yellow-500 animate-pulse z-20"><Sparkles className="w-5 h-5" /><span className="font-bold tracking-widest">{pendingResult ? "PRONTO!" : "CRIANDO..."}</span></div>

                    {/* O ADPLAYER AGORA RODA SEMPRE (NÃO TEM IF ISMOBILE) */}
                    <div className="w-full h-full absolute inset-0"><AdPlayer src={currentAdUrl} onEnded={handleAdEnded} /></div>

                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800"><div className="h-full bg-gradient-to-r from-yellow-500 to-purple-600 transition-all duration-100 ease-linear" style={{ width: `${adProgress}%` }} /></div>
                </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center p-4 py-10 w-full max-w-5xl mx-auto space-y-8">
                <div className="flex w-full bg-gray-900 p-1.5 rounded-2xl border border-gray-800">
                    <button onClick={() => { setMode("image"); setImageFiles([]); }} className={`flex-1 py-3 rounded-xl flex gap-2 font-bold justify-center ${mode === "image" ? "bg-gray-800 text-white" : "text-gray-500"}`}><ImageIcon className="w-5 h-5" /> Imagem</button>
                    <button onClick={() => { setMode("video"); setImageFiles([]); }} className={`flex-1 py-3 rounded-xl flex gap-2 font-bold justify-center ${mode === "video" ? "bg-blue-900/30 text-blue-200" : "text-gray-500"}`}><VideoIcon className="w-5 h-5" /> Vídeo</button>
                    <button onClick={() => { setMode("gallery"); }} className={`flex-1 py-3 rounded-xl flex gap-2 font-bold justify-center ${mode === "gallery" ? "bg-yellow-900/30 text-yellow-200" : "text-gray-500"}`}><Clock className="w-5 h-5" /> Galeria</button>
                </div>

                {mode !== "gallery" && (
                    <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        <div className="flex gap-2 mb-4">
                            <button onClick={() => setAspectRatio("16:9")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border ${aspectRatio === "16:9" ? "bg-white text-black" : "text-gray-500 border-gray-700"}`}><RectangleHorizontal className="w-4 h-4" /> 16:9</button>
                            <button onClick={() => setAspectRatio("9:16")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border ${aspectRatio === "9:16" ? "bg-white text-black" : "text-gray-500 border-gray-700"}`}><RectangleVertical className="w-4 h-4" /> 9:16</button>
                        </div>
                        <div className="flex flex-wrap gap-3 mb-4">
                            {imageFiles.map((file, i) => <div key={i} className="relative w-20 h-20 bg-gray-800 rounded-xl overflow-hidden"><img src={URL.createObjectURL(file)} className="w-full h-full object-cover" /><button onClick={() => removeImage(i)} className="absolute top-0 right-0 bg-black text-white p-1"><XCircle className="w-4 h-4" /></button></div>)}
                            <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center text-gray-500"><Plus className="w-6 h-6" /><span className="text-[9px]">Add</span></button>
                            <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" multiple={mode === "image"} />
                        </div>
                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descreva sua criação..." className="w-full bg-[#18181b] border border-gray-700 rounded-xl p-4 text-gray-200 h-32 mb-4" />
                        <button onClick={handleGenerate} disabled={loading || !prompt || credits < currentCost} className="w-full py-4 rounded-xl font-bold text-lg bg-white text-black hover:bg-gray-200 flex justify-center gap-2 disabled:bg-gray-800 disabled:text-gray-500">{loading ? "Processando..." : `Gerar (-${currentCost})`}</button>
                        {resultUrl && !loading && (
                            <div className="mt-6 rounded-xl overflow-hidden border border-gray-800 bg-black/50 relative">
                                <div className="absolute top-4 right-4 flex gap-2 z-10">
                                    {mode === "image" && <button onClick={() => handleTransformToVideo(null)} className="p-2 bg-blue-600 text-white rounded-lg"><ArrowRightCircle className="w-4 h-4" /></button>}
                                    {!isMobile && mode === "image" && <button onClick={() => setIsEditorOpen(true)} className="p-2 bg-yellow-500 text-black rounded-lg"><Edit className="w-4 h-4" /></button>}
                                    <button onClick={() => handleShare(resultUrl, mode)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"><Share2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDownload(resultUrl, mode)} className="p-2 bg-white text-black rounded-lg"><Download className="w-4 h-4" /></button>
                                </div>
                                {mode === "image" ? <img src={resultUrl} className="w-full max-h-[500px] object-contain" /> : <video src={resultUrl} controls className="w-full max-h-[500px]" />}
                            </div>
                        )}
                    </div>
                )}

                {mode === "gallery" && (
                    <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {history.map((item) => (
                                <div key={item.id} className="aspect-square bg-gray-900 rounded-xl overflow-hidden relative group">
                                    {item.type === 'image' ? <img src={item.url} className="w-full h-full object-cover" /> : <video src={item.url} className="w-full h-full object-cover" muted />}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"><button onClick={() => handleDownload(item.url, item.type)}><Download className="w-6 h-6 text-white" /></button></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <footer className="w-full py-8 mt-10 border-t border-gray-900 bg-black/80 text-center text-gray-600 text-sm"><p>© 2025 NastIA Studio.</p></footer>
            <ChatWidget onApplyPrompt={(text) => { setPrompt(text); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </main>
    );
}