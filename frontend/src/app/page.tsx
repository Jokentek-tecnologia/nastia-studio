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

// Carregamento dinâmico
const ImageEditor = dynamic(() => import("../components/ImageEditor"), { ssr: false, loading: () => <div className="text-white text-center p-10">Carregando...</div> });

const SHORT_ADS = ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4", "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"];
const LONG_ADS = ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"];

const ASPECT_RATIOS = [
    { value: "16:9", label: "Horizontal (16:9)" }, { value: "9:16", label: "Vertical (9:16)" },
    { value: "1:1", label: "Quadrado (1:1)" }, { value: "4:3", label: "Clássico (4:3)" },
    { value: "3:4", label: "Retrato (3:4)" }, { value: "21:9", label: "Cinema (21:9)" },
];

const PERSONAS = [
    { id: "nah", name: "Nah (IA Geral)", role: "Assistente Inteligente", prompt: "Você é a Nah, a IA oficial do NastIA Studio. Você é uma inteligência artificial geral, avançada e criativa, similar ao ChatGPT ou Claude. Você pode ajudar com TUDO: escrever códigos, receitas, textos, tirar dúvidas, traduzir e conversar sobre a vida. Seja sempre simpática, use emojis e respostas diretas." },
    { id: "marketing", name: "Marketing Pro", role: "Especialista em Vendas", prompt: "Você é um especialista em Marketing Digital e Copywriting. Crie textos que vendem, legendas para Instagram, roteiros de anúncios e e-mails persuasivos." },
    { id: "roteiro", name: "Roteirista", role: "Storytelling", prompt: "Você é um roteirista de cinema e Youtube. Crie histórias envolventes, roteiros de vídeos curtos (Reels/TikTok) e descrições de cenas detalhadas para geração de vídeo." },
    { id: "prompt", name: "Mestre dos Prompts", role: "Engenharia de Prompt", prompt: "Você é especialista em criar Prompts técnicos para IAs de imagem e vídeo (Midjourney/Veo). O usuário vai dar uma ideia vaga e você vai transformar em um prompt detalhado, em inglês, especificando luz, câmera, estilo e renderização." },
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
    const [selectedMedia, setSelectedMedia] = useState<any>(null);

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
        if (data) { setCredits(data.credits); setPlan(data.plan_tier); setReferralCode(data.referral_code); setCoins(data.coins || 0); if (data.custom_api_key) setHasCustomKey(true); }
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
        fetchProfile(session.user.id); fetchHistory(session.user.id); fetchNotifications();
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
            setMode("video"); setImageFiles([file]); setResultUrl(null); setPrompt(""); setSelectedMedia(null);
        } catch (e) { }
    };

    const handleEditFromGallery = async (url: string) => { setResultUrl(url); setIsEditorOpen(true); setSelectedMedia(null); }
    const handleMobileEditClick = () => { alert("Para editar, use o chat."); };
    const prepareAd = () => { const list = mode === "image" ? SHORT_ADS : LONG_ADS; setCurrentAdUrl(list[Math.floor(Math.random() * list.length)]); setAdProgress(0); };

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
                    try { const res = await fetch(previousResult); const blob = await res.blob(); const base64Data = await (new Promise((r) => { const reader = new FileReader(); reader.onloadend = () => r(reader.result); reader.readAsDataURL(blob); }) as any); formData.append("from_image", base64Data); } catch (e) { }
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
        // LAYOUT PRINCIPAL: h-screen (Fixo na tela) e overflow-hidden (Sem scroll geral)
        <main className="h-screen bg-[#050505] text-white flex flex-col font-sans overflow-hidden">

            {/* HEADER FIXO */}
            <header className="h-16 shrink-0 border-b border-gray-800 bg-black/50 backdrop-blur-md flex justify-between items-center px-4 z-30">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setMode('home')}>
                    <img src="/app-logo.png" alt="Logo" className="h-8 w-auto" />
                    <div className="hidden sm:block"><h1 className="font-bold text-lg leading-none">NastIA Studio</h1></div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Botões do Header */}
                    <button onClick={() => setIsApiKeyOpen(true)} className={`hidden md:flex items-center gap-2 border px-3 py-1 rounded-full text-xs font-bold hover:scale-105 transition-transform ${hasCustomKey ? "bg-green-900/30 border-green-500 text-green-400" : "bg-gray-800 border-gray-600 text-gray-400"}`}>
                        <Key className="w-3 h-3" /> {hasCustomKey ? "Turbo" : "Grátis"}
                    </button>
                    <button onClick={() => setIsReferralOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-900 to-pink-900 border border-purple-500/30 px-3 py-1 rounded-full hover:scale-105 transition-transform">
                        <Gift className="w-4 h-4 text-pink-400" /> <span className="text-xs font-bold text-pink-100 hidden md:inline">Prêmios</span>
                    </button>
                    <div className="flex flex-col items-end cursor-pointer" onClick={toggleStore}>
                        <div className="flex items-center gap-1 text-yellow-500 font-bold"><Coins className="w-4 h-4" /> <span className="text-sm">{credits}</span></div>
                    </div>
                    <div className="relative">
                        <img src={session.user.user_metadata.avatar_url} className="w-8 h-8 rounded-full border border-gray-700 cursor-pointer" onClick={toggleNotifications} />
                        {showNotifications && (
                            <div className="fixed top-14 right-4 z-50 w-64 bg-[#18181b] border border-gray-700 rounded-xl shadow-2xl p-2" onClick={() => setShowNotifications(false)}>
                                <div className="text-xs font-bold text-gray-400 mb-2 px-2 flex justify-between"><span>Notificações</span><X className="w-3 h-3" /></div>
                                {notifications.length === 0 ? <div className="text-center text-xs text-gray-600 py-2">Nada.</div> : notifications.map(n => <div key={n.id} className="text-xs p-2 hover:bg-gray-800 rounded mb-1">{n.title}</div>)}
                                <div className="border-t border-gray-700 mt-2 pt-2"><button onClick={handleLogout} className="w-full text-left text-xs text-red-400 p-2 hover:bg-red-900/20 rounded flex gap-2 items-center"><LogOut className="w-3 h-3" /> Sair</button></div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ÁREA DE CONTEÚDO (Flexível) */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">

                {/* MENU LATERAL (APENAS DESKTOP - Para não ocupar altura no mobile) */}
                {mode !== 'home' && (
                    <div className="hidden md:flex flex-col gap-2 w-20 bg-[#0f0f10] border-r border-gray-800 items-center py-4 shrink-0">
                        <button onClick={() => setMode("chat")} className={`p-3 rounded-xl transition-all ${mode === "chat" ? "bg-purple-600 text-white" : "text-gray-500 hover:bg-gray-800"}`} title="Chat"><MessageSquare className="w-6 h-6" /></button>
                        <button onClick={() => { setMode("image"); setImageFiles([]); }} className={`p-3 rounded-xl transition-all ${mode === "image" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-800"}`} title="Imagem"><ImageIcon className="w-6 h-6" /></button>
                        <button onClick={() => { setMode("video"); setImageFiles([]); setAspectRatio("16:9"); }} className={`p-3 rounded-xl transition-all ${mode === "video" ? "bg-orange-600 text-white" : "text-gray-500 hover:bg-gray-800"}`} title="Vídeo"><VideoIcon className="w-6 h-6" /></button>
                        <button onClick={() => setMode("gallery")} className={`p-3 rounded-xl transition-all ${mode === "gallery" ? "bg-yellow-600 text-white" : "text-gray-500 hover:bg-gray-800"}`} title="Galeria"><Clock className="w-6 h-6" /></button>
                    </div>
                )}

                {/* MENU TOPO (APENAS MOBILE) */}
                {mode !== 'home' && (
                    <div className="md:hidden flex w-full bg-[#0f0f10] border-b border-gray-800 shrink-0 overflow-x-auto p-2 gap-2">
                        <button onClick={() => setMode("chat")} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === "chat" ? "bg-purple-900/50 text-purple-200" : "text-gray-500"}`}>Chat</button>
                        <button onClick={() => { setMode("image"); setImageFiles([]); }} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === "image" ? "bg-blue-900/50 text-blue-200" : "text-gray-500"}`}>Img</button>
                        <button onClick={() => { setMode("video"); setImageFiles([]); setAspectRatio("16:9"); }} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === "video" ? "bg-orange-900/50 text-orange-200" : "text-gray-500"}`}>Vídeo</button>
                        <button onClick={() => setMode("gallery")} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === "gallery" ? "bg-yellow-900/50 text-yellow-200" : "text-gray-500"}`}>Galeria</button>
                    </div>
                )}

                {/* ÁREA CENTRAL DE TRABALHO */}
                <div className="flex-1 overflow-hidden relative flex flex-col">

                    {/* HOME (Scrollável) */}
                    {mode === 'home' && (
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="max-w-2xl mx-auto space-y-6 pb-20">
                                <div className="text-center py-6">
                                    <h2 className="text-3xl font-bold text-white mb-2">Olá, {session.user.user_metadata.full_name?.split(' ')[0]} 👋</h2>
                                    <p className="text-gray-400">O que você vai criar agora?</p>
                                </div>
                                {/* Cards de Atalho */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div onClick={() => setMode('chat')} className="bg-[#121214] p-5 rounded-2xl border border-gray-800 hover:border-purple-500/50 cursor-pointer group transition-all">
                                        <MessageSquare className="w-8 h-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
                                        <h3 className="font-bold text-white">Chat Inteligente</h3>
                                        <p className="text-xs text-gray-400 mt-1">Converse com a Nah e especialistas.</p>
                                    </div>
                                    <div onClick={() => { setMode('image'); setImageFiles([]); }} className="bg-[#121214] p-5 rounded-2xl border border-gray-800 hover:border-blue-500/50 cursor-pointer group transition-all">
                                        <ImageIcon className="w-8 h-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
                                        <h3 className="font-bold text-white">Criar Imagens</h3>
                                        <p className="text-xs text-gray-400 mt-1">Gere artes incríveis com IA.</p>
                                    </div>
                                    <div onClick={() => { setMode('video'); setImageFiles([]); setAspectRatio("16:9"); }} className="bg-[#121214] p-5 rounded-2xl border border-gray-800 hover:border-orange-500/50 cursor-pointer group transition-all">
                                        <VideoIcon className="w-8 h-8 text-orange-500 mb-3 group-hover:scale-110 transition-transform" />
                                        <h3 className="font-bold text-white">Criar Vídeos</h3>
                                        <p className="text-xs text-gray-400 mt-1">Dê movimento às suas ideias.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODO CRIAÇÃO (SPLIT VIEW NO DESKTOP) */}
                    {(mode === "image" || mode === "video") && (
                        <div className="flex flex-col md:flex-row h-full w-full">
                            {/* COLUNA ESQUERDA: CONTROLES (Scrollável) */}
                            <div className="w-full md:w-[400px] h-full overflow-y-auto border-r border-gray-800 p-4 bg-[#050505]">
                                <div className="space-y-6 pb-20">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        {mode === 'image' ? <ImageIcon className="w-5 h-5 text-blue-500" /> : <VideoIcon className="w-5 h-5 text-orange-500" />}
                                        Configurações
                                    </h3>

                                    <div className="space-y-2">
                                        <label className="text-xs text-gray-400 font-bold uppercase">Formato</label>
                                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-[#121214] text-white border border-gray-700 rounded-xl p-3 text-sm focus:border-white outline-none">
                                            {ASPECT_RATIOS.filter(ratio => mode === "image" || ["16:9", "9:16"].includes(ratio.value)).map(ratio => <option key={ratio.value} value={ratio.value}>{ratio.label}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs text-gray-400 font-bold uppercase">{mode === 'video' ? 'Imagem Guia (Opcional)' : 'Referência (Opcional)'}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {imageFiles.map((file, idx) => (
                                                <div key={idx} className="relative w-20 h-20 bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group">
                                                    <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover opacity-80" />
                                                    <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white hover:bg-red-500"><XCircle className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            {((mode === "image" && imageFiles.length < 5) || (mode === "video" && imageFiles.length < 1)) && (
                                                <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-gray-500 transition-all hover:bg-gray-800">
                                                    <Plus className="w-6 h-6" /><span className="text-[9px] mt-1">Adicionar</span>
                                                </button>
                                            )}
                                            <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" multiple={mode === "image"} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs text-gray-400 font-bold uppercase">Prompt</label>
                                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descreva o que você quer criar..." className="w-full bg-[#121214] border border-gray-700 rounded-xl p-4 text-white h-40 focus:border-white outline-none resize-none" />
                                    </div>

                                    <button onClick={handleGenerate} disabled={loading || !prompt || (credits < currentCost && !hasCustomKey)} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${loading ? "bg-gray-800 text-gray-500" : "bg-white text-black hover:scale-[1.02]"}`}>
                                        {loading ? <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full" /> : <Sparkles className="w-5 h-5" />}
                                        {loading ? "Criando..." : (hasCustomKey ? "Gerar Grátis" : `Gerar (-${currentCost})`)}
                                    </button>
                                </div>
                            </div>

                            {/* COLUNA DIREITA: PREVIEW (Fixo, sem scroll) */}
                            <div className="flex-1 bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                                {resultUrl ? (
                                    <div className="relative max-w-full max-h-full rounded-xl overflow-hidden shadow-2xl border border-gray-800 animate-in zoom-in-95">
                                        {mode === "image" ? <img src={resultUrl} className="max-w-full max-h-[80vh] object-contain" /> : <video src={resultUrl} controls autoPlay loop className="max-w-full max-h-[80vh]" />}
                                        <div className="absolute top-4 right-4 flex gap-2">
                                            <button onClick={() => handleDownload(resultUrl, mode)} className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm"><Download className="w-5 h-5" /></button>
                                            <button onClick={() => handleShare(resultUrl, mode)} className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm"><Share2 className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-600">
                                        <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p>Seu resultado aparecerá aqui.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MODO CHAT (Full Height) */}
                    {mode === "chat" && (
                        <div className="flex h-full w-full">
                            <div className="w-64 bg-[#0f0f10] border-r border-gray-800 p-4 hidden md:flex flex-col gap-2 overflow-y-auto">
                                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Personas</h3>
                                {PERSONAS.map(p => (
                                    <button key={p.id} onClick={() => { setCurrentPersona(p); setChatHistory([]); }} className={`p-3 rounded-xl text-left text-sm font-medium transition-all ${currentPersona.id === p.id ? "bg-purple-900/30 text-purple-200 border border-purple-500/30" : "text-gray-400 hover:bg-gray-800"}`}>
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 flex flex-col bg-[#050505] relative">
                                <div className="md:hidden p-2 border-b border-gray-800">
                                    <select onChange={(e) => { const p = PERSONAS.find(x => x.id === e.target.value); if (p) setCurrentPersona(p); }} className="w-full bg-[#18181b] p-2 rounded text-sm text-white">
                                        {PERSONAS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {chatHistory.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                            <Bot className="w-12 h-12 mb-2" />
                                            <p>Inicie a conversa com {currentPersona.name}</p>
                                        </div>
                                    )}
                                    {chatHistory.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-white text-black' : 'bg-gray-800 text-gray-200'}`}>
                                                {msg.parts}
                                            </div>
                                        </div>
                                    ))}
                                    {chatLoading && <div className="text-xs text-gray-500 animate-pulse ml-4">Digitando...</div>}
                                    <div ref={chatEndRef} />
                                </div>
                                <div className="p-4 bg-[#050505] border-t border-gray-800 flex gap-2">
                                    <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSend()} placeholder="Mensagem..." className="flex-1 bg-[#18181b] border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500" />
                                    <button onClick={handleChatSend} disabled={chatLoading} className="bg-purple-600 p-3 rounded-xl text-white hover:bg-purple-500"><Send className="w-5 h-5" /></button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODO GALERIA (Grid Scrollável) */}
                    {mode === "gallery" && (
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl mx-auto pb-20">
                                {history.map((item) => (
                                    <div key={item.id} onClick={() => setSelectedMedia(item)} className="aspect-square bg-gray-900 rounded-xl overflow-hidden border border-gray-800 relative group cursor-pointer hover:border-white transition-colors">
                                        {item.type === 'image' ? <img src={item.url} className="w-full h-full object-cover" /> : <video src={item.url} className="w-full h-full object-cover" muted />}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Eye className="w-8 h-8 text-white" /></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* FOOTER COMPACTO (Slim) */}
            <footer className="h-8 bg-[#0a0a0a] border-t border-gray-800 flex justify-center items-center gap-4 text-[10px] text-gray-600 shrink-0 z-30">
                <span>© 2025 NastIA Studio</span>
                <span className="w-1 h-1 bg-gray-800 rounded-full"></span>
                <a href="https://instagram.com/nastia.tec" target="_blank" className="hover:text-white">Instagram</a>
                <span className="w-1 h-1 bg-gray-800 rounded-full"></span>
                {referralCode && <span onClick={copyReferral} className="cursor-pointer hover:text-yellow-500">Indique: {referralCode}</span>}
            </footer>

            {/* MODAIS (Mantidos) */}
            {isEditorOpen && resultUrl && <ImageEditor imageUrl={resultUrl} onClose={() => setIsEditorOpen(false)} />}
            {isStoreOpen && <StoreModal userId={session.user.id} currentPlan={plan} referralCode={referralCode} onClose={() => setIsStoreOpen(false)} onUpdate={() => fetchProfile(session.user.id)} />}
            {isReferralOpen && referralCode && <GamifiedReferral userId={session.user.id} referralCode={referralCode} onClose={() => setIsReferralOpen(false)} />}
            {isApiKeyOpen && <ApiKeyModal userId={session.user.id} onClose={() => setIsApiKeyOpen(false)} onSuccess={() => { setHasCustomKey(true); fetchProfile(session.user.id); }} />}
            <SupportWidget userId={session.user.id} userName={session.user.user_metadata.full_name} />

            {/* MODAL MÍDIA MOBILE */}
            {selectedMedia && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in-95" onClick={() => setSelectedMedia(null)}>
                    <div className="max-w-3xl w-full max-h-[90vh] flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                        <div className="flex-1 flex items-center justify-center bg-black rounded-xl overflow-hidden">
                            {selectedMedia.type === 'image' ? <img src={selectedMedia.url} className="max-h-[70vh] w-auto" /> : <video src={selectedMedia.url} controls className="max-h-[70vh] w-auto" />}
                        </div>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => handleDownload(selectedMedia.url, selectedMedia.type)} className="bg-white text-black px-6 py-3 rounded-full font-bold flex gap-2"><Download className="w-5 h-5" /> Baixar</button>
                            <button onClick={() => handleShare(selectedMedia.url, selectedMedia.type)} className="bg-gray-800 text-white px-6 py-3 rounded-full font-bold flex gap-2"><Share2 className="w-5 h-5" /> Compartilhar</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}