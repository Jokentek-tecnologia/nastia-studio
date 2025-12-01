"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
    Sparkles, Image as ImageIcon, Video as VideoIcon,
    Film, XCircle, Edit, LogOut, Coins, Gift, Key,
    Share2, Download, Instagram, Globe, MessageCircle, Plus, Copy,
    ArrowRightCircle, Layers, Clock, CheckCircle, Bell, ExternalLink, ChevronDown,
    X, MessageSquare, Send, Bot, Zap, PlayCircle, Eye, Headphones
} from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import Login from "../components/Login";
import StoreModal from "../components/StoreModal";
import AdPlayer from "../components/AdPlayer";
import GamifiedReferral from "../components/GamifiedReferral";
import ApiKeyModal from "../components/ApiKeyModal";
import SupportWidget from "../components/SupportWidget";

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

const PERSONAS = [
    { id: "nah", name: "Nah (Geral)", role: "Sua Assistente", prompt: "Você é a Nah, a inteligência artificial oficial do NastIA Studio. Seja extremamente simpática, criativa e proativa. Ajude com qualquer dúvida, dê ideias de prompts e explique como usar a plataforma. Use emojis e linguagem acolhedora." },
    { id: "marketing", name: "Marketing Pro", role: "Especialista em Vendas", prompt: "Você é um especialista em Marketing Digital e Copywriting. Crie textos que vendem, legendas para Instagram, roteiros de anúncios e e-mails persuasivos." },
    { id: "roteiro", name: "Roteirista", role: "Storytelling", prompt: "Você é um roteirista de cinema e Youtube. Crie histórias envolventes, roteiros de vídeos curtos (Reels/TikTok) e descrições de cenas detalhadas para geração de vídeo." },
    { id: "prompt", name: "Mestre dos Prompts", role: "Engenharia de Prompt", prompt: "Você é especialista em criar Prompts técnicos para IAs de imagem e vídeo (Midjourney/Veo). O usuário vai dar uma ideia vaga e você vai transformar em um prompt detalhado, em inglês, especificando luz, câmera, estilo e renderização." },
    { id: "social", name: "Social Media", role: "Estrategista", prompt: "Crie calendários de conteúdo, ideias virais e estratégias de engajamento." }
];

export default function Home() {
    const [session, setSession] = useState<any>(null);
    const [credits, setCredits] = useState<number>(0);
    const [coins, setCoins] = useState<number>(0);
    const [plan, setPlan] = useState<string>("free");
    const [referralCode, setReferralCode] = useState<string>("");
    const [authLoading, setAuthLoading] = useState(true);

    const [mode, setMode] = useState<"home" | "image" | "video" | "gallery" | "chat">("home");
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
    const [isReferralOpen, setIsReferralOpen] = useState(false);
    const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
    const [hasCustomKey, setHasCustomKey] = useState(false);

    // Novo estado para modal de visualização de mídia na galeria mobile
    const [selectedMedia, setSelectedMedia] = useState<any>(null);

    // CHAT STATES
    const [chatHistory, setChatHistory] = useState<{ role: string, parts: string }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [currentPersona, setCurrentPersona] = useState(PERSONAS[0]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check(); window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const fetchProfile = async (userId: string) => {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) {
            setCredits(data.credits);
            setPlan(data.plan_tier);
            setReferralCode(data.referral_code);
            setCoins(data.coins || 0);
            if (data.custom_api_key) setHasCustomKey(true);
        }
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

    useEffect(() => { if (mode === 'chat') chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, mode]);

    const handleLogout = async () => await supabase.auth.signOut();
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { const newFiles = Array.from(e.target.files); if (mode === "video") setImageFiles([newFiles[0]]); else setImageFiles(prev => [...prev, ...newFiles].slice(0, 8)); } };
    const removeImage = (index: number) => { setImageFiles(prev => prev.filter((_, i) => i !== index)); };
    const handleClearAll = () => { setResultUrl(null); setImageFiles([]); setPrompt(""); };

    const handleTransformToVideo = async (targetUrl: string | null) => {
        const urlToUse = targetUrl || resultUrl || selectedMedia?.url;
        if (!urlToUse) return;
        try {
            const res = await fetch(urlToUse); const blob = await res.blob(); const file = new File([blob], "base.jpg", { type: "image/jpeg" });
            setMode("video"); setImageFiles([file]); setResultUrl(null); setPrompt(""); setSelectedMedia(null); window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) { }
    };

    const handleEditFromGallery = async (url: string) => { setResultUrl(url); setIsEditorOpen(true); setSelectedMedia(null); }
    const handleMobileEditClick = () => { alert("Para editar textos e elementos, use um computador. No celular, use o chat para pedir edições à IA."); };

    const prepareAd = () => { const list = mode === "image" ? SHORT_ADS : LONG_ADS; setCurrentAdUrl(list[Math.floor(Math.random() * list.length)]); setAdProgress(0); };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, _) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    };

    const handleGenerate = async () => {
        if (!prompt) return;
        const isEditingContext = mode === "image" && resultUrl && imageFiles.length === 0;
        let cost = 5;
        if (mode === "image" && (imageFiles.length > 1 || isEditingContext)) cost = 10;
        if (mode === "video") cost = 50;
        if (hasCustomKey) cost = 0;

        if (credits < cost && !hasCustomKey) { alert(`Saldo insuficiente!`); setIsStoreOpen(true); return; }

        prepareAd(); setLoading(true); const previousResult = resultUrl; setResultUrl(null); setPendingResult(null);
        const formData = new FormData(); formData.append("user_id", session.user.id); formData.append("aspect_ratio", aspectRatio);

        if (isEditingContext) formData.append("prompt", `EDIT IMAGE: ${prompt}`); else formData.append("prompt", prompt);

        try {
            if (mode === "image") {
                if (imageFiles.length > 0) imageFiles.forEach(file => formData.append("files", file));
                else if (previousResult && isEditingContext) {
                    try { const res = await fetch(previousResult); const blob = await res.blob(); const base64Data = await blobToBase64(blob); formData.append("from_image", base64Data); } catch (e) { }
                }
            } else { if (imageFiles.length > 0) formData.append("file_start", imageFiles[0]); }

            const endpoint = mode === "image" ? `${process.env.NEXT_PUBLIC_API_URL}/generate-image` : `${process.env.NEXT_PUBLIC_API_URL}/generate-video`;
            const res = await axios.post(endpoint, formData, { headers: { "Content-Type": "multipart/form-data" } });
            fetchProfile(session.user.id); fetchHistory(session.user.id);
            const url = res.data.image || res.data.video;
            if (mode === "video") { setResultUrl(url); setLoading(false); } else { setPendingResult(url); }
        } catch (error: any) { alert(error.response?.data?.detail || "Erro."); setLoading(false); if (mode === "image") setResultUrl(previousResult); }
    };

    const handleChatSend = async () => {
        if (!chatInput.trim()) return;
        const userMsg = { role: "user", parts: chatInput };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput("");
        setChatLoading(true);
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/chat`, { user_id: session.user.id, history: chatHistory.concat(userMsg), persona: currentPersona.prompt });
            setChatHistory(prev => [...prev, { role: "model", parts: res.data.response }]);
        } catch (e) { setChatHistory(prev => [...prev, { role: "model", parts: "Erro de conexão." }]); } finally { setChatLoading(false); }
    };

    const handleAdEnded = () => { if (mode === "image" && pendingResult) { setResultUrl(pendingResult); setLoading(false); setPendingResult(null); } };
    const handleSkipAd = () => { if (pendingResult) { setResultUrl(pendingResult); setLoading(false); setPendingResult(null); } };
    const copyReferral = () => { navigator.clipboard.writeText(`https://nastia-studio.netlify.app?ref=${referralCode}`); alert("Link Copiado!"); }
    const handleDownload = (url: string, type: string) => { const link = document.createElement("a"); link.href = url; link.download = `NastIA.${type === 'image' ? 'jpg' : 'mp4'}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    const handleShare = async (url: string, type: string) => { if (navigator.share) try { const res = await fetch(url); const blob = await res.blob(); await navigator.share({ files: [new File([blob], "nastia." + (type === 'image' ? 'jpg' : 'mp4'), { type: blob.type })] }); } catch (e) { } else alert("Use Baixar."); };
    useEffect(() => { if (loading) { const i = setInterval(() => setAdProgress(o => (o < 95 ? o + 0.5 : o)), 100); return () => clearInterval(i); } }, [loading]);

    const toggleStore = () => { setIsStoreOpen(!isStoreOpen); setShowNotifications(false); };
    const toggleNotifications = () => { setShowNotifications(!showNotifications); setIsStoreOpen(false); };

    if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full"></div></div>;
    if (!session) return <Login />;

    const isEditing = mode === "image" && resultUrl && imageFiles.length === 0;
    let currentCost = mode === "image" ? (imageFiles.length > 1 || isEditing ? 10 : 10) : 50;
    if (hasCustomKey) currentCost = 0;

    return (
        <main className="min-h-screen bg-[#050505] text-white flex flex-col font-sans relative overflow-x-hidden">

            <header className="w-full p-4 border-b border-gray-800 bg-black/50 backdrop-blur-md flex justify-between items-center sticky top-0 z-30">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setMode('home')}>
                    <img src="/app-logo.png" alt="NastIA Logo" className="h-10 w-auto object-contain" />
                    <div className="hidden sm:block">
                        <h1 className="font-bold text-lg leading-none">NastIA Studio</h1>
                        <p className="text-[10px] text-gray-500">Plataforma Criativa</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setIsApiKeyOpen(true)} className={`flex items-center gap-2 border p-2 md:px-3 md:py-1.5 rounded-full hover:scale-105 transition-transform ${hasCustomKey ? "bg-green-900/30 border-green-500/50 text-green-400" : "bg-gray-800 border-gray-600 text-gray-400"}`}>
                        <Key className="w-4 h-4" /> <span className="text-xs font-bold hidden md:inline">{hasCustomKey ? "Turbo" : "Grátis"}</span>
                    </button>

                    <button onClick={() => setIsReferralOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-900 to-pink-900 border border-purple-500/30 p-2 md:px-3 md:py-1.5 rounded-full hover:scale-105 transition-transform">
                        <Gift className="w-4 h-4 text-pink-400" /> <span className="text-xs font-bold text-pink-100 hidden md:inline">Prêmios</span>
                    </button>

                    <div className="flex flex-col items-end cursor-pointer hover:opacity-80 transition-opacity" onClick={toggleStore}>
                        <div className="flex items-center gap-1 text-yellow-500 font-bold">
                            <Coins className="w-4 h-4" /> <span className="text-sm">{credits}</span>
                        </div>
                    </div>

                    <div className="relative">
                        <img src={session.user.user_metadata.avatar_url} className="w-9 h-9 rounded-full border border-gray-700 cursor-pointer" onClick={toggleNotifications} />
                        {showNotifications && (
                            <div className="fixed top-16 right-4 z-50 w-64 bg-[#18181b] border border-gray-700 rounded-xl shadow-2xl p-2" onClick={() => setShowNotifications(false)}>
                                <div className="text-xs font-bold text-gray-400 mb-2 px-2 flex justify-between"><span>Notificações</span><X className="w-3 h-3" /></div>
                                <div className="bg-[#18181b]" onClick={(e) => e.stopPropagation()}>
                                    {notifications.length === 0 ? <div className="text-center text-xs text-gray-600 py-2">Nada novo.</div> : notifications.map(n => <div key={n.id} className="text-xs p-2 hover:bg-gray-800 rounded mb-1">{n.title}</div>)}
                                    <div className="border-t border-gray-700 mt-2 pt-2"><button onClick={handleLogout} className="w-full text-left text-xs text-red-400 p-2 hover:bg-red-900/20 rounded flex gap-2 items-center"><LogOut className="w-3 h-3" /> Sair</button></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {isEditorOpen && resultUrl && <ImageEditor imageUrl={resultUrl} onClose={() => setIsEditorOpen(false)} />}
            {isStoreOpen && <StoreModal userId={session.user.id} currentPlan={plan} referralCode={referralCode} onClose={() => setIsStoreOpen(false)} onUpdate={() => fetchProfile(session.user.id)} />}
            {isReferralOpen && referralCode && <GamifiedReferral userId={session.user.id} referralCode={referralCode} onClose={() => setIsReferralOpen(false)} />}
            {isApiKeyOpen && <ApiKeyModal userId={session.user.id} onClose={() => setIsApiKeyOpen(false)} onSuccess={() => { setHasCustomKey(true); fetchProfile(session.user.id); }} />}

            {/* WIDGET DE SUPORTE */}
            <SupportWidget userId={session.user.id} userName={session.user.user_metadata.full_name} />

            {/* MODAL DE MÍDIA MOBILE */}
            {selectedMedia && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedMedia(null)}>
                    <div className="bg-[#18181b] w-full max-w-sm rounded-2xl border border-gray-700 p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                            <h3 className="font-bold text-white">Opções</h3>
                            <button onClick={() => setSelectedMedia(null)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <div className="rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center">
                            {selectedMedia.type === 'image' ? <img src={selectedMedia.url} className="w-full h-full object-contain" /> : <video src={selectedMedia.url} controls className="w-full h-full" />}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleDownload(selectedMedia.url, selectedMedia.type)} className="bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Baixar</button>
                            <button onClick={() => handleShare(selectedMedia.url, selectedMedia.type)} className="bg-gray-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Share2 className="w-4 h-4" /> Enviar</button>
                            {selectedMedia.type === 'image' && (
                                <>
                                    <button onClick={() => handleTransformToVideo(null)} className="bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 col-span-2"><PlayCircle className="w-4 h-4" /> Animar</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

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

            <div className="flex-1 flex flex-col items-center justify-center p-4 py-6 w-full max-w-5xl mx-auto space-y-6">

                {/* --- MODO HOME (DASHBOARD) --- */}
                {mode === 'home' && (
                    <div className="w-full animate-in fade-in slide-in-from-bottom-4 space-y-6">

                        <div className="text-center mb-4">
                            <h2 className="text-2xl font-bold text-white">Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">{session.user.user_metadata.full_name?.split(' ')[0]}</span> 👋</h2>
                            <p className="text-sm text-gray-400">O que vamos criar hoje?</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#121214] border border-gray-800 p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden" onClick={toggleStore}>
                                <div className="absolute top-0 right-0 p-2 opacity-10"><Coins className="w-16 h-16 text-yellow-500" /></div>
                                <span className="text-xs text-gray-400">Seus Créditos</span>
                                <div className="flex items-end gap-1">
                                    <span className="text-2xl font-bold text-white">{credits}</span>
                                    <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded uppercase font-bold mb-1">{plan}</span>
                                </div>
                            </div>
                            <div className="bg-[#121214] border border-gray-800 p-4 rounded-2xl flex flex-col justify-between cursor-pointer" onClick={() => setIsReferralOpen(true)}>
                                <span className="text-xs text-gray-400">Progresso Prêmios</span>
                                <div className="w-full bg-gray-800 h-2 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full" style={{ width: `${Math.min((coins / 250) * 100, 100)}%` }}></div>
                                </div>
                                <span className="text-xs text-right text-gray-500 mt-1">{coins}/250 Moedas</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Ferramentas</h3>
                            <button onClick={() => setMode('chat')} className="w-full bg-[#18181b] hover:bg-[#202024] p-4 rounded-2xl flex items-center gap-4 border border-gray-800 transition-all group">
                                <div className="bg-purple-900/30 p-3 rounded-xl text-purple-400 group-hover:scale-110 transition-transform"><MessageSquare className="w-6 h-6" /></div>
                                <div className="text-left flex-1">
                                    <h4 className="font-bold text-white">Chat & Personas</h4>
                                    <p className="text-xs text-gray-400">Crie textos, roteiros e ideias com IA.</p>
                                </div>
                                <ArrowRightCircle className="w-5 h-5 text-gray-600 group-hover:text-purple-500" />
                            </button>

                            <button onClick={() => { setMode('image'); setImageFiles([]); }} className="w-full bg-[#18181b] hover:bg-[#202024] p-4 rounded-2xl flex items-center gap-4 border border-gray-800 transition-all group">
                                <div className="bg-blue-900/30 p-3 rounded-xl text-blue-400 group-hover:scale-110 transition-transform"><ImageIcon className="w-6 h-6" /></div>
                                <div className="text-left flex-1">
                                    <h4 className="font-bold text-white">Gerar Imagens</h4>
                                    <p className="text-xs text-gray-400">Crie ou edite imagens com Nano Banana.</p>
                                </div>
                                <ArrowRightCircle className="w-5 h-5 text-gray-600 group-hover:text-blue-500" />
                            </button>

                            <button onClick={() => { setMode('video'); setImageFiles([]); setAspectRatio("16:9"); }} className="w-full bg-[#18181b] hover:bg-[#202024] p-4 rounded-2xl flex items-center gap-4 border border-gray-800 transition-all group">
                                <div className="bg-orange-900/30 p-3 rounded-xl text-orange-400 group-hover:scale-110 transition-transform"><VideoIcon className="w-6 h-6" /></div>
                                <div className="text-left flex-1">
                                    <h4 className="font-bold text-white">Criar Vídeos</h4>
                                    <p className="text-xs text-gray-400">Dê vida às suas ideias com Veo 3.1.</p>
                                </div>
                                <ArrowRightCircle className="w-5 h-5 text-gray-600 group-hover:text-orange-500" />
                            </button>
                        </div>

                        {!hasCustomKey && (
                            <div onClick={() => setIsApiKeyOpen(true)} className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/30 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-transform">
                                <div className="bg-green-500/20 p-3 rounded-full text-green-400 animate-pulse"><Zap className="w-6 h-6" /></div>
                                <div>
                                    <h4 className="font-bold text-green-100">Ativar Modo Turbo Grátis</h4>
                                    <p className="text-xs text-green-300/70">Use sua conta do Google para gerar sem gastar créditos.</p>
                                </div>
                            </div>
                        )}

                        <div className="text-center pt-4">
                            <button onClick={() => setMode('gallery')} className="text-xs text-gray-500 hover:text-white flex items-center justify-center gap-1 mx-auto"><Clock className="w-3 h-3" /> Ver meu histórico recente</button>
                        </div>
                    </div>
                )}

                {/* --- MENU DE ABAS --- */}
                {mode !== 'home' && (
                    <div className="flex w-full bg-gray-900 p-1.5 rounded-2xl border border-gray-800 overflow-x-auto shrink-0">
                        <button onClick={() => setMode("chat")} className={`flex-1 min-w-[80px] py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${mode === "chat" ? "bg-purple-900/30 text-purple-200 border border-purple-500/30" : "text-gray-500"}`}><MessageSquare className="w-5 h-5" /> <span className="hidden sm:inline">Chat</span></button>
                        <button onClick={() => { setMode("image"); setImageFiles([]); }} className={`flex-1 min-w-[80px] py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${mode === "image" ? "bg-gray-800 text-white" : "text-gray-500"}`}><ImageIcon className="w-5 h-5" /> <span className="hidden sm:inline">Img</span></button>
                        <button onClick={() => { setMode("video"); setImageFiles([]); setAspectRatio("16:9"); }} className={`flex-1 min-w-[80px] py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${mode === "video" ? "bg-blue-900/30 text-blue-200" : "text-gray-500"}`}><VideoIcon className="w-5 h-5" /> <span className="hidden sm:inline">Vídeo</span></button>
                        <button onClick={() => { setMode("gallery"); }} className={`flex-1 min-w-[80px] py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${mode === "gallery" ? "bg-yellow-900/30 text-yellow-200" : "text-gray-500"}`}><Clock className="w-5 h-5" /> <span className="hidden sm:inline">Galeria</span></button>
                    </div>
                )}

                {/* --- MODO CHAT --- */}
                {mode === "chat" && (
                    <div className="w-full flex flex-col md:flex-row gap-4 h-[70vh] md:h-[600px]">
                        <div className="w-full md:w-1/3 bg-[#0f0f10] border border-gray-800 rounded-3xl p-4 overflow-y-auto hidden md:block">
                            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Especialistas</h3>
                            <div className="space-y-2">
                                {PERSONAS.map(persona => (
                                    <div key={persona.id} onClick={() => { setCurrentPersona(persona); setChatHistory([]); }} className={`p-3 rounded-xl cursor-pointer border transition-all ${currentPersona.id === persona.id ? "bg-purple-900/20 border-purple-500/50" : "bg-gray-900/50 border-transparent hover:bg-gray-800"}`}>
                                        <div className="font-bold text-sm text-white">{persona.name}</div>
                                        <div className="text-[10px] text-gray-500">{persona.role}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="md:hidden w-full">
                            <select onChange={(e) => { const p = PERSONAS.find(p => p.id === e.target.value); if (p) { setCurrentPersona(p); setChatHistory([]); } }} className="w-full bg-[#18181b] text-white p-3 rounded-xl border border-gray-700">
                                {PERSONAS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="flex-1 bg-[#0f0f10] border border-gray-800 rounded-3xl flex flex-col overflow-hidden relative">
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {chatHistory.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-600 text-center p-6">
                                        <Bot className="w-12 h-12 mb-4 text-purple-900/50" />
                                        <p className="text-sm">Olá! Sou {currentPersona.name}.</p>
                                    </div>
                                )}
                                {chatHistory.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${msg.role === "user" ? "bg-white text-black" : "bg-gray-800 text-gray-200"}`}>{msg.parts}</div>
                                    </div>
                                ))}
                                {chatLoading && <div className="text-gray-500 text-xs animate-pulse ml-4">Digitando...</div>}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="p-4 border-t border-gray-800 bg-[#121214] flex gap-2">
                                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleChatSend()} placeholder="Mensagem..." className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none" />
                                <button onClick={handleChatSend} disabled={chatLoading} className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-xl"><Send className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODOS DE CRIAÇÃO --- */}
                {(mode === "image" || mode === "video") && (
                    <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-purple-500 opacity-20 group-hover:opacity-50 transition-opacity"></div>

                        <div className="relative w-full mb-4">
                            <div className="relative">
                                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-[#18181b] text-white border border-gray-700 rounded-xl p-3 pl-4 appearance-none cursor-pointer focus:border-yellow-500 outline-none text-sm font-medium">
                                    {ASPECT_RATIOS.filter(ratio => mode === "image" || ["16:9", "9:16"].includes(ratio.value)).map(ratio => <option key={ratio.value} value={ratio.value}>{ratio.label}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            </div>
                            {mode === "video" && <p className="text-[10px] text-gray-500 mt-1 ml-2">Modo vídeo suporta apenas 16:9 e 9:16.</p>}
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
                                    <Layers className="w-4 h-4" /> <span>Modo Edição Ativo</span> <button onClick={handleClearAll} className="ml-auto hover:underline text-white">Limpar</button>
                                </div>
                            )}
                        </div>

                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={isEditing ? "O que mudar?" : "Descreva sua criação..."} className="w-full bg-[#18181b] border border-gray-700 rounded-xl p-4 text-gray-200 h-32 mb-4 focus:border-yellow-500 outline-none transition-colors" />

                        <button onClick={handleGenerate} disabled={loading || !prompt || (credits < currentCost && !hasCustomKey)} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl ${loading || (credits < currentCost && !hasCustomKey) ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-white text-black hover:bg-gray-200 hover:scale-[1.01]"}`}>
                            {loading ? <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full" /> : <Sparkles className="w-5 h-5 fill-black" />}
                            {loading ? "Processando..." : (hasCustomKey ? "Gerar Grátis (Modo Turbo) ⚡" : (credits < currentCost ? "Saldo Insuficiente" : `Gerar (-${currentCost})`))}
                        </button>
                    </div>
                )}

                {/* --- RESULTADO E GALERIA --- */}
                {resultUrl && !loading && mode !== 'gallery' && mode !== 'home' && (
                    <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-gray-400 flex items-center gap-2 font-medium"><Sparkles className="w-4 h-4 text-green-500" /> Resultado</h3>
                            <div className="flex gap-2">
                                <button onClick={() => handleShare(resultUrl, mode)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white"><Share2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDownload(resultUrl, mode)} className="p-2 bg-white text-black hover:bg-gray-200 rounded-lg"><Download className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="rounded-xl overflow-hidden border border-gray-800 bg-black/50">
                            {mode === "image" ? <img src={resultUrl} className="w-full max-h-[500px] object-contain" /> : <video src={resultUrl} controls autoPlay loop className="w-full max-h-[500px]" />}
                        </div>
                    </div>
                )}

                {mode === "gallery" && (
                    <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl animate-in fade-in">
                        <h3 className="text-white font-bold text-xl mb-6 border-b border-gray-800 pb-4">Galeria</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {history.map((item) => (
                                <div key={item.id} onClick={() => setSelectedMedia(item)} className="aspect-square bg-gray-900 rounded-xl overflow-hidden border border-gray-800 relative group cursor-pointer">
                                    {item.type === 'image' ? <img src={item.url} className="w-full h-full object-cover" /> : <video src={item.url} className="w-full h-full object-cover" muted />}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Eye className="w-8 h-8 text-white drop-shadow-lg" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="w-full py-8 mt-10 border-t border-gray-900 bg-black/80 text-center text-gray-600 text-sm">
                <div className="flex justify-center gap-6 mb-4">
                    <a href="http://instagram.com/nastia.tec" target="_blank" className="hover:text-pink-500 flex gap-1 items-center"><Instagram className="w-4 h-4" /> Instagram</a>
                    <a href="https://nastia.com.br" target="_blank" className="hover:text-blue-500 flex gap-1 items-center"><Globe className="w-4 h-4" /> Site</a>
                </div>
                <div className="mt-4 flex flex-col items-center gap-2">
                    <p>© 2025 NastIA Studio - Jokentek.</p>
                    {referralCode && <div onClick={copyReferral} className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-full border border-gray-800 cursor-pointer hover:border-yellow-500/50 transition-colors group"><Gift className="w-3 h-3 text-yellow-500" /><span className="text-xs group-hover:text-white">Indique e Ganhe: {referralCode}</span><Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>}
                </div>
            </footer>
        </main>
    );
}