"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
    Sparkles, Image as ImageIcon, Video as VideoIcon,
    Film, XCircle, Edit, LogOut, Coins, Gift,
    Share2, Download, Instagram, Globe, MessageCircle, Plus, Copy,
    ArrowRightCircle, Layers, Clock, CheckCircle, Bell, ExternalLink, ChevronDown,
    X
} from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import Login from "../components/Login";
import ChatWidget from "../components/ChatWidget";
import StoreModal from "../components/StoreModal";
import AdPlayer from "../components/AdPlayer";

// Carregamento dinâmico do editor
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

const ASPECT_RATIOS = [
    { value: "16:9", label: "Horizontal (16:9) - Youtube" },
    { value: "9:16", label: "Vertical (9:16) - Stories/Reels" },
    { value: "1:1", label: "Quadrado (1:1) - Feed" },
    { value: "4:3", label: "Clássico (4:3)" },
    { value: "3:4", label: "Retrato (3:4)" },
    { value: "21:9", label: "Cinema (21:9)" },
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

    const [aspectRatio, setAspectRatio] = useState<string>("16:9");

    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentAdUrl, setCurrentAdUrl] = useState("");
    const [pendingResult, setPendingResult] = useState<string | null>(null);
    const [adProgress, setAdProgress] = useState(0);

    const [history, setHistory] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

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

    const fetchNotifications = async () => {
        const { data } = await supabase.from('notifications').select('*').eq('active', true).order('created_at', { ascending: false });
        if (data) setNotifications(data);
    };

    const handleLoginSuccess = async (session: any) => {
        fetchProfile(session.user.id);
        fetchHistory(session.user.id);
        fetchNotifications();
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

    const handleEditFromGallery = async (url: string) => { setResultUrl(url); setIsEditorOpen(true); }
    const handleMobileEditClick = () => { alert("⚠️ Para adicionar textos e elementos gráficos, use o editor no computador.\n\nNo celular, você pode editar pedindo para a IA no chat: 'Edite a imagem para...'"); };

    const prepareAd = () => { const list = mode === "image" ? SHORT_ADS : LONG_ADS; setCurrentAdUrl(list[Math.floor(Math.random() * list.length)]); setAdProgress(0); };

    // Função Auxiliar para converter Blob em Base64
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, _) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    };

    const handleGenerate = async () => {
        if (!prompt) return;

        // Verifica se é edição (tem resultado anterior mas nenhum upload novo)
        const isEditingContext = mode === "image" && resultUrl && imageFiles.length === 0;

        let cost = 5;
        if (mode === "image" && (imageFiles.length > 1 || isEditingContext)) cost = 10;
        if (mode === "video") cost = 20;

        if (credits < cost) { alert(`Saldo insuficiente!`); setIsStoreOpen(true); return; }

        prepareAd();
        setLoading(true);
        const previousResult = resultUrl;
        setResultUrl(null);
        setPendingResult(null);

        const formData = new FormData();
        formData.append("user_id", session.user.id);
        formData.append("aspect_ratio", aspectRatio);

        // Se for edição, ajusta o prompt para contexto
        if (isEditingContext) formData.append("prompt", `EDIT IMAGE: ${prompt}`);
        else formData.append("prompt", prompt);

        try {
            if (mode === "image") {
                if (imageFiles.length > 0) {
                    // Caso 1: Upload de arquivos explícito
                    imageFiles.forEach(file => formData.append("files", file));
                } else if (previousResult && isEditingContext) {
                    // Caso 2: Edição de imagem gerada (Contexto)
                    // Baixa a imagem e converte para Base64 para envio seguro
                    try {
                        const res = await fetch(previousResult);
                        const blob = await res.blob();
                        const base64Data = await blobToBase64(blob);
                        formData.append("from_image", base64Data);
                    } catch (e) {
                        console.error("Erro ao preparar imagem de contexto", e);
                        // Se falhar o fetch, tenta sem imagem (vai gerar do zero)
                    }
                }
            } else {
                // Modo Vídeo
                if (imageFiles.length > 0) formData.append("file_start", imageFiles[0]);
            }

            const endpoint = mode === "image" ? `${process.env.NEXT_PUBLIC_API_URL}/generate-image` : `${process.env.NEXT_PUBLIC_API_URL}/generate-video`;
            const res = await axios.post(endpoint, formData, { headers: { "Content-Type": "multipart/form-data" } });

            fetchProfile(session.user.id);
            fetchHistory(session.user.id);

            const url = res.data.image || res.data.video;
            if (mode === "video") { setResultUrl(url); setLoading(false); } else { setPendingResult(url); }

        } catch (error: any) {
            alert(error.response?.data?.detail || "Erro ao processar.");
            setLoading(false);
            if (mode === "image") setResultUrl(previousResult);
        }
    };

    const handleAdEnded = () => { if (mode === "image" && pendingResult) { setResultUrl(pendingResult); setLoading(false); setPendingResult(null); } };
    const handleSkipAd = () => { if (pendingResult) { setResultUrl(pendingResult); setLoading(false); setPendingResult(null); } };
    const copyReferral = () => { navigator.clipboard.writeText(`https://nastia.com.br?ref=${referralCode}`); alert("Copiado!"); }
    const handleDownload = (url: string, type: string) => { const link = document.createElement("a"); link.href = url; link.download = `NastIA.${type === 'image' ? 'jpg' : 'mp4'}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    const handleShare = async (url: string, type: string) => { if (navigator.share) try { const res = await fetch(url); const blob = await res.blob(); await navigator.share({ files: [new File([blob], "nastia." + (type === 'image' ? 'jpg' : 'mp4'), { type: blob.type })] }); } catch (e) { } else alert("Use Baixar."); };
    useEffect(() => { if (loading) { const i = setInterval(() => setAdProgress(o => (o < 95 ? o + 0.5 : o)), 100); return () => clearInterval(i); } }, [loading]);

    const toggleStore = () => { setIsStoreOpen(!isStoreOpen); setShowNotifications(false); };
    const toggleNotifications = () => { setShowNotifications(!showNotifications); setIsStoreOpen(false); };

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
                    <div className="relative">
                        <button onClick={toggleNotifications} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white relative">
                            <Bell className="w-5 h-5" />
                            {notifications.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#050505]"></span>}
                        </button>
                        {showNotifications && (
                            <div className="fixed top-20 left-4 right-4 z-50 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:w-80 bg-[#18181b] border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className="p-3 border-b border-gray-800 text-xs font-bold text-gray-400 flex justify-between">
                                    <span>Notificações</span>
                                    <button onClick={() => setShowNotifications(false)}><X className="w-4 h-4" /></button>
                                </div>
                                {notifications.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-gray-600">Nada por aqui.</div>
                                ) : (
                                    notifications.map(n => (
                                        <div key={n.id} className="p-3 border-b border-gray-800 hover:bg-gray-800/50">
                                            <h4 className="text-sm font-bold text-white mb-1">{n.title}</h4>
                                            <p className="text-xs text-gray-400 leading-relaxed">{n.message}</p>
                                            {n.link && <a href={n.link} target="_blank" className="text-[10px] text-yellow-500 hover:underline mt-2 block flex items-center gap-1">Ver mais <ExternalLink className="w-3 h-3" /></a>}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end cursor-pointer hover:opacity-80 transition-opacity" onClick={toggleStore}>
                        <div className="flex items-center gap-1.5 text-yellow-500 font-bold">
                            <Coins className="w-4 h-4" />
                            <span>{credits}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 bg-gray-900 px-2 rounded-full border border-gray-800 uppercase">{plan}</div>
                    </div>

                    <img src={session.user.user_metadata.avatar_url} className="w-9 h-9 rounded-full border border-gray-700" />
                    <button onClick={handleLogout} className="p-2 hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-lg"><LogOut className="w-5 h-5" /></button>
                </div>
            </header>

            {isEditorOpen && resultUrl && <ImageEditor imageUrl={resultUrl} onClose={() => setIsEditorOpen(false)} />}
            {isStoreOpen && <StoreModal userId={session.user.id} currentPlan={plan} referralCode={referralCode} onClose={() => setIsStoreOpen(false)} onUpdate={() => fetchProfile(session.user.id)} />}

            {loading && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4 text-center">
                    {pendingResult && (
                        <button onClick={handleSkipAd} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-green-500 text-black px-8 py-4 rounded-full font-bold text-xl shadow-2xl animate-bounce flex items-center gap-2 hover:bg-green-400 transition-all cursor-pointer">
                            <CheckCircle className="w-6 h-6" /> VER RESULTADO AGORA
                        </button>
                    )}
                    <div className="absolute top-8 right-8 flex items-center gap-2 text-yellow-500 animate-pulse z-20">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-bold tracking-widest">{pendingResult ? "PRONTO!" : "CRIANDO..."}</span>
                    </div>
                    <div className="w-full h-full absolute inset-0">
                        <AdPlayer src={currentAdUrl} onEnded={handleAdEnded} />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800"><div className="h-full bg-gradient-to-r from-yellow-500 to-purple-600 transition-all duration-100 ease-linear" style={{ width: `${adProgress}%` }} /></div>
                </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center p-4 py-10 w-full max-w-5xl mx-auto space-y-8">

                <div className="flex w-full bg-gray-900 p-1.5 rounded-2xl border border-gray-800">
                    <button onClick={() => { setMode("image"); setImageFiles([]); }} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${mode === "image" ? "bg-gray-800 text-white" : "text-gray-500"}`}><ImageIcon className="w-5 h-5" /> Imagem</button>
                    <button onClick={() => { setMode("video"); setImageFiles([]); }} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${mode === "video" ? "bg-blue-900/30 text-blue-200" : "text-gray-500"}`}><VideoIcon className="w-5 h-5" /> Vídeo</button>
                    <button onClick={() => { setMode("gallery"); }} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${mode === "gallery" ? "bg-yellow-900/30 text-yellow-200" : "text-gray-500"}`}><Clock className="w-5 h-5" /> Galeria</button>
                </div>

                {mode !== "gallery" && (
                    <>
                        <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-purple-500 opacity-20 group-hover:opacity-50 transition-opacity"></div>

                            {/* SELETOR DE FORMATO (Menu Suspenso) */}
                            <div className="relative w-full mb-4">
                                <div className="relative">
                                    <select
                                        value={aspectRatio}
                                        onChange={(e) => setAspectRatio(e.target.value)}
                                        className="w-full bg-[#18181b] text-white border border-gray-700 rounded-xl p-3 pl-4 appearance-none cursor-pointer focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors text-sm font-medium"
                                    >
                                        {ASPECT_RATIOS.map(ratio => (
                                            <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div className="flex flex-wrap gap-3">
                                    {imageFiles.map((file, idx) => (
                                        <div key={idx} className="relative w-20 h-20 bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group/img">
                                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover opacity-70 group-hover/img:opacity-100 transition-opacity" />
                                            <button onClick={() => removeImage(idx)} className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500"><XCircle className="w-4 h-4" /></button>
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
                                        <Layers className="w-4 h-4" />
                                        <span>Modo Edição Ativo: A IA vai alterar a imagem atual.</span>
                                        <button onClick={handleClearAll} className="ml-auto hover:underline text-gray-400 hover:text-white">Limpar</button>
                                    </div>
                                )}

                                {mode === "video" && imageFiles.length === 0 && (
                                    <p className="text-xs text-blue-400 flex items-center gap-2"><Film className="w-3 h-3" /> Dica: Adicione uma imagem para guiar o vídeo.</p>
                                )}
                            </div>

                            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={isEditing ? "O que mudar?" : "Descreva sua criação..."} className="w-full bg-[#18181b] border border-gray-700 rounded-xl p-4 text-gray-200 h-32 mb-4" />

                            <button onClick={handleGenerate} disabled={loading || !prompt || credits < currentCost} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl ${loading || credits < currentCost ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-white text-black hover:bg-gray-200 hover:scale-[1.01]"}`}>
                                {loading ? <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full" /> : <Sparkles className="w-5 h-5 fill-black" />}
                                {loading ? "Processando..." : (credits < currentCost ? "Saldo Insuficiente" : `${isEditing ? 'Editar Imagem' : 'Gerar'} (-${currentCost})`)}
                            </button>
                        </div>

                        {resultUrl && !loading && (
                            <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                    <h3 className="text-gray-400 flex items-center gap-2 font-medium"><Sparkles className="w-4 h-4 text-green-500" /> Resultado Pronto</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {mode === "image" && <button onClick={() => handleTransformToVideo(null)} className="flex items-center gap-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-blue-500/20"><ArrowRightCircle className="w-3 h-3" /> Animar</button>}

                                        {!isMobile && mode === "image" && (
                                            <button
                                                onClick={() => isMobile ? handleMobileEditClick() : setIsEditorOpen(true)}
                                                className="flex items-center gap-1.5 bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                <Edit className="w-3 h-3" /> Editar
                                            </button>
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
                    </>
                )}

                {mode === "gallery" && (
                    <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl animate-in fade-in">
                        <h3 className="text-white font-bold text-xl mb-6 flex items-center gap-2 border-b border-gray-800 pb-4"><Clock className="w-6 h-6 text-yellow-500" /> Galeria Recente</h3>
                        {history.length === 0 ? (
                            <div className="text-center py-20 text-gray-500"><p>Nada ainda.</p><button onClick={() => setMode("image")} className="mt-4 text-yellow-500 hover:underline">Começar</button></div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {history.map((item) => (
                                    <div key={item.id} className="aspect-square bg-gray-900 rounded-xl overflow-hidden border border-gray-800 relative group">
                                        {item.type === 'image' ? <img src={item.url} className="w-full h-full object-cover" loading="lazy" /> : <video src={item.url} className="w-full h-full object-cover" muted />}
                                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                                            <div className="flex gap-2">
                                                <button onClick={() => handleDownload(item.url, item.type)} className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"><Download className="w-4 h-4" /></button>
                                                {item.type === 'image' && (
                                                    <>
                                                        <button onClick={() => handleTransformToVideo(item.url)} className="p-2 bg-blue-600 text-white rounded-full hover:scale-110 transition-transform" title="Animar"><ArrowRightCircle className="w-4 h-4" /></button>
                                                        <button onClick={() => isMobile ? handleMobileEditClick() : handleEditFromGallery(item.url)} className="p-2 bg-yellow-500 text-black rounded-full hover:scale-110 transition-transform" title="Editar"><Edit className="w-4 h-4" /></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <footer className="w-full py-8 mt-10 border-t border-gray-900 bg-black/80 text-center text-gray-600 text-sm">
                <div className="flex justify-center gap-6 mb-4">
                    <a href="http://instagram.com/nastia.tec" target="_blank" className="hover:text-pink-500 transition-colors flex gap-1 items-center"><Instagram className="w-4 h-4" /> Instagram</a>
                    <a href="https://wa.me/5513996405593" target="_blank" className="hover:text-green-500 transition-colors flex gap-1 items-center"><MessageCircle className="w-4 h-4" /> Whatsapp</a>
                    <a href="https://nastia.com.br" target="_blank" className="hover:text-blue-500 transition-colors flex gap-1 items-center"><Globe className="w-4 h-4" /> nastia.com.br</a>
                </div>
                <div className="mt-4 flex flex-col items-center gap-2">
                    <p>© 2025 NastIA Studio - Jokentek.</p>
                    {referralCode && <div onClick={copyReferral} className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-full border border-gray-800 cursor-pointer hover:border-yellow-500/50 transition-colors group"><Gift className="w-3 h-3 text-yellow-500" /><span className="text-xs group-hover:text-white">Indique e Ganhe: {referralCode}</span><Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>}
                </div>
            </footer>
            <ChatWidget onApplyPrompt={(text) => { setPrompt(text); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </main>
    );
}