"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
    Sparkles, Image as ImageIcon, Video as VideoIcon, Shirt,
    XCircle, LogOut, Coins, Gift,
    Share2, Download, Instagram, Globe, MessageCircle, Plus,
    ArrowRightCircle, Layers, Clock, CheckCircle, Bell, ExternalLink, ChevronDown,
    X, Send, Bot, PlayCircle, Eye, Upload
} from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import Login from "../components/Login";
import StoreModal from "../components/StoreModal";
import AdPlayer from "../components/AdPlayer";
import GamifiedReferral from "../components/GamifiedReferral";
import SupportWidget from "../components/SupportWidget";

// Carregamento dinâmico
const ImageEditor = dynamic(() => import("../components/ImageEditor"), {
    ssr: false,
    loading: () => <div className="text-white text-center p-10">Carregando...</div>
});

const SHORT_ADS = ["https://lpiotuazwilvxhdjxgjo.supabase.co/storage/v1/object/public/public-assets/VID-20251203-WA0000.mp4"];
const LONG_ADS = ["https://lpiotuazwilvxhdjxgjo.supabase.co/storage/v1/object/public/public-assets/VID-20251203-WA0000.mp4"];

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

    const [mode, setMode] = useState<"home" | "image" | "video" | "gallery" | "chat" | "tryon">("home");
    const [prompt, setPrompt] = useState("");
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [isMobile, setIsMobile] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<string>("16:9");

    const [personFile, setPersonFile] = useState<File | null>(null);
    const [garmentFile, setGarmentFile] = useState<File | null>(null);

    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentAdUrl, setCurrentAdUrl] = useState("");
    const [pendingResult, setPendingResult] = useState<string | null>(null);
    const [adProgress, setAdProgress] = useState(0);
    const [adFinished, setAdFinished] = useState(false);

    const [history, setHistory] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isStoreOpen, setIsStoreOpen] = useState(false);
    const [isReferralOpen, setIsReferralOpen] = useState(false);

    const [selectedMedia, setSelectedMedia] = useState<any>(null);

    const [chatHistory, setChatHistory] = useState<{ role: string, parts: string }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [currentPersona, setCurrentPersona] = useState(PERSONAS[0]);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Efeito para liberar resultado após anúncio
    useEffect(() => {
        if (adFinished && pendingResult) {
            setResultUrl(pendingResult);
            setLoading(false);
            setPendingResult(null);
            setAdFinished(false);
        }
    }, [adFinished, pendingResult]);

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

    const handleLoginSuccess = async (session: any) => { fetchProfile(session.user.id); fetchHistory(session.user.id); fetchNotifications(); };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); if (session) handleLoginSuccess(session); setAuthLoading(false); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => { setSession(session); if (session) handleLoginSuccess(session); else setAuthLoading(false); });
        return () => subscription.unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            if (!["plus", "pro", "agency", "criação"].includes(plan)) { alert("A criação de vídeo é exclusiva para planos Plus e Pro."); setIsStoreOpen(true); return; }
            const res = await fetch(urlToUse); const blob = await res.blob(); const file = new File([blob], "base.jpg", { type: "image/jpeg" });
            setMode("video"); setImageFiles([file]); setResultUrl(null); setPrompt(""); setSelectedMedia(null);
        } catch (e) { }
    };

    const handleEditFromGallery = async (url: string) => { setResultUrl(url); setIsEditorOpen(true); setSelectedMedia(null); }

    const prepareAd = () => {
        const list = mode === "image" || mode === "tryon" ? SHORT_ADS : LONG_ADS;
        setCurrentAdUrl(list[Math.floor(Math.random() * list.length)]);
        setAdProgress(0);
        setAdFinished(false);
    };

    const handleGenerate = async () => {
        if (!prompt) return;
        const isEditingContext = mode === "image" && resultUrl && imageFiles.length === 0;
        let cost = 5;
        if (mode === "image" && (imageFiles.length > 1 || isEditingContext)) cost = 10;
        if (mode === "video") cost = 50;

        if (credits < cost) { alert(`Saldo insuficiente!`); setIsStoreOpen(true); return; }
        if (mode === "video" && !["plus", "pro", "agency", "criação"].includes(plan)) { alert("Vídeos são exclusivos para assinantes Plus e Pro."); setIsStoreOpen(true); return; }

        prepareAd(); setLoading(true); setResultUrl(null); setPendingResult(null);

        const previousResult = resultUrl;
        const formData = new FormData(); formData.append("user_id", session.user.id); formData.append("aspect_ratio", aspectRatio);

        if (isEditingContext) formData.append("prompt", `EDIT IMAGE: ${prompt}`); else formData.append("prompt", prompt);

        try {
            if (mode === "image") {
                if (imageFiles.length > 0) imageFiles.forEach(file => formData.append("files", file));
                else if (previousResult && isEditingContext) { formData.append("context_url", previousResult); }
            } else { if (imageFiles.length > 0) formData.append("file_start", imageFiles[0]); }

            const endpoint = mode === "image" ? `${process.env.NEXT_PUBLIC_API_URL}/generate-image` : `${process.env.NEXT_PUBLIC_API_URL}/generate-video`;
            const res = await axios.post(endpoint, formData, { headers: { "Content-Type": "multipart/form-data" } });

            fetchProfile(session.user.id); fetchHistory(session.user.id);
            setPendingResult(res.data.image || res.data.video);

        } catch (error: any) {
            alert(error.response?.data?.detail || "Erro.");
            setLoading(false);
            if (mode === "image") setResultUrl(previousResult);
        }
    };

    const handleTryOn = async () => {
        if (!personFile || !garmentFile) return alert("Selecione as duas fotos.");
        if (credits < 10) { alert("Saldo insuficiente."); setIsStoreOpen(true); return; }

        prepareAd(); setLoading(true); setResultUrl(null); setPendingResult(null);

        const formData = new FormData();
        formData.append("user_id", session.user.id);
        formData.append("person_image", personFile);
        formData.append("garment_image", garmentFile);

        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/generate-tryon`, formData, { headers: { "Content-Type": "multipart/form-data" } });
            fetchProfile(session.user.id);
            setPendingResult(res.data.image);
        } catch (error: any) {
            alert(error.response?.data?.detail || "Erro.");
            setLoading(false);
        }
    };

    const handleChatSend = async () => {
        if (!chatInput.trim()) return;
        const userMsg = { role: "user", parts: chatInput };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput("");
        setChatLoading(true);
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
                user_id: session.user.id,
                history: chatHistory.concat(userMsg),
                persona: currentPersona.prompt
            });
            setChatHistory(prev => [...prev, { role: "model", parts: res.data.response }]);
        } catch (e) { setChatHistory(prev => [...prev, { role: "model", parts: "Erro de conexão." }]); } finally { setChatLoading(false); }
    };

    const handleAdEnded = () => { setAdFinished(true); };
    const handleSkipAd = () => { setAdFinished(true); };

    const copyReferral = () => { navigator.clipboard.writeText(`https://nastia-studio.netlify.app?ref=${referralCode}`); alert("Link Copiado!"); }
    const handleDownload = (url: string, type: string) => { const link = document.createElement("a"); link.href = url; link.download = `NastIA.${type === 'image' ? 'jpg' : 'mp4'}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    const handleShare = async (url: string, type: string) => { if (navigator.share) try { const res = await fetch(url); const blob = await res.blob(); await navigator.share({ files: [new File([blob], "nastia." + (type === 'image' ? 'jpg' : 'mp4'), { type: blob.type })] }); } catch (e) { } else alert("Use Baixar."); };
    useEffect(() => { if (loading && !adFinished) { const i = setInterval(() => setAdProgress(o => (o < 95 ? o + 0.5 : o)), 100); return () => clearInterval(i); } }, [loading, adFinished]);

    const toggleStore = () => { setIsStoreOpen(!isStoreOpen); setShowNotifications(false); };
    const toggleNotifications = () => { setShowNotifications(!showNotifications); setIsStoreOpen(false); };

    if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full"></div></div>;
    if (!session) return <Login />;

    const isEditing = mode === "image" && resultUrl && imageFiles.length === 0;
    let currentCost = mode === "image" ? (imageFiles.length > 1 || isEditing ? 10 : 10) : 50;

    return (
        <main className="h-screen bg-[#050505] text-white flex flex-col font-sans overflow-hidden">

            {/* HEADER */}
            <header className="h-16 shrink-0 border-b border-gray-800 bg-black/50 backdrop-blur-md flex justify-between items-center px-4 z-30">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setMode('home')}>
                    <img src="/app-logo.png" alt="NastIA" className="h-8 w-auto" />
                    <div className="hidden sm:block"><h1 className="font-bold text-lg leading-none">NastIA Studio</h1></div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsReferralOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-900 to-pink-900 border border-purple-500/30 p-2 md:px-3 md:py-1 rounded-full hover:scale-105 transition-transform"><Gift className="w-4 h-4 text-pink-400" /> <span className="text-xs font-bold text-pink-100 hidden md:inline">Prêmios</span></button>
                    <div className="flex flex-col items-end cursor-pointer hover:opacity-80 transition-opacity" onClick={toggleStore}><div className="flex items-center gap-1 text-yellow-500 font-bold"><Coins className="w-4 h-4" /> <span className="text-sm">{credits}</span></div></div>
                    <div className="relative">
                        <div className="relative cursor-pointer p-2 hover:bg-gray-800 rounded-full" onClick={toggleNotifications}><Bell className="w-5 h-5 text-gray-300" />{notifications.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#050505]"></span>}</div>
                        {showNotifications && (
                            <div className="fixed top-16 right-4 z-50 w-72 bg-[#18181b] border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                                <div className="p-3 border-b border-gray-800 text-xs font-bold text-gray-400 flex justify-between items-center"><span>Notificações</span><button onClick={() => setShowNotifications(false)}><X className="w-4 h-4" /></button></div>
                                <div className="max-h-60 overflow-y-auto bg-[#18181b]">{notifications.length === 0 ? <div className="p-4 text-center text-xs text-gray-600">Nenhuma notificação.</div> : notifications.map(n => <div key={n.id} className="p-3 border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"><h4 className="text-sm font-bold text-white mb-1">{n.title}</h4><p className="text-xs text-gray-400">{n.message}</p></div>)}</div>
                                <div className="p-2 border-t border-gray-700 bg-[#121214]"><button onClick={handleLogout} className="w-full text-left text-xs text-red-400 p-2 hover:bg-red-900/20 rounded flex gap-2 items-center justify-center font-bold"><LogOut className="w-3 h-3" /> Sair da Conta</button></div>
                            </div>
                        )}
                    </div>
                    <img src={session.user.user_metadata.avatar_url} alt="User" className="w-8 h-8 rounded-full border border-gray-700 ml-1" />
                </div>
            </header>

            {isEditorOpen && resultUrl && <ImageEditor imageUrl={resultUrl} onClose={() => setIsEditorOpen(false)} />}
            {isStoreOpen && <StoreModal userId={session.user.id} currentPlan={plan} referralCode={referralCode} onClose={() => setIsStoreOpen(false)} onUpdate={() => fetchProfile(session.user.id)} />}
            {isReferralOpen && referralCode && <GamifiedReferral userId={session.user.id} referralCode={referralCode} onClose={() => setIsReferralOpen(false)} />}
            <SupportWidget userId={session.user.id} userName={session.user.user_metadata.full_name} />

            {/* Modal de Mídia Mobile */}
            {selectedMedia && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedMedia(null)}>
                    <div className="bg-[#18181b] w-full max-w-sm rounded-2xl border border-gray-700 p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-gray-800 pb-2"><h3 className="font-bold text-white">Visualizar</h3><button onClick={() => setSelectedMedia(null)}><X className="w-5 h-5 text-gray-400" /></button></div>
                        <div className="rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center">{selectedMedia.type === 'image' ? <img src={selectedMedia.url} alt="Media" className="w-full h-full object-contain" /> : <video src={selectedMedia.url} controls className="w-full h-full" />}</div>
                        <div className="grid grid-cols-2 gap-2"><button onClick={() => handleDownload(selectedMedia.url, selectedMedia.type)} className="bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Baixar</button><button onClick={() => handleShare(selectedMedia.url, selectedMedia.type)} className="bg-gray-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Share2 className="w-4 h-4" /> Enviar</button>{selectedMedia.type === 'image' && <button onClick={() => handleTransformToVideo(null)} className="bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 col-span-2"><PlayCircle className="w-4 h-4" /> Criar Vídeo</button>}</div>
                    </div>
                </div>
            )}

            {loading && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4 text-center">
                    <div className="animate-pulse text-yellow-500 mb-4"><Sparkles className="w-8 h-8 mx-auto" /></div>
                    <div className="w-full h-full absolute inset-0"><AdPlayer src={currentAdUrl} onEnded={handleAdEnded} /></div>
                    {/* BOTÃO PULAR */}
                    {pendingResult ? (
                        <button onClick={handleSkipAd} className="absolute bottom-10 bg-green-500 text-black px-6 py-3 rounded-full font-bold shadow-lg animate-bounce flex items-center gap-2"><CheckCircle className="w-5 h-5" /> SEU RESULTADO ESTÁ PRONTO!</button>
                    ) : (
                        <div className="absolute bottom-10 bg-black/50 text-white/70 px-4 py-2 rounded-full text-xs backdrop-blur-md">Criando sua arte... {Math.round(adProgress)}%</div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800"><div className="h-full bg-gradient-to-r from-yellow-500 to-purple-600 transition-all duration-100 ease-linear" style={{ width: `${adProgress}%` }} /></div>
                </div>
            )}

            <div className="flex-1 w-full flex flex-col overflow-hidden relative">

                {/* MENU LATERAL */}
                {mode !== 'home' && (
                    <div className="hidden md:flex flex-col gap-2 w-20 bg-[#0f0f10] border-r border-gray-800 items-center py-4 shrink-0 absolute left-0 top-0 bottom-0 z-20">
                        <button onClick={() => setMode("chat")} className={`p-3 rounded-xl transition-all ${mode === "chat" ? "bg-purple-600 text-white" : "text-gray-500 hover:bg-gray-800"}`} title="Chat"><MessageSquare className="w-6 h-6" /></button>
                        <button onClick={() => { setMode("image"); setImageFiles([]); }} className={`p-3 rounded-xl transition-all ${mode === "image" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-800"}`} title="Imagem"><ImageIcon className="w-6 h-6" /></button>
                        <button onClick={() => { setMode("video"); setImageFiles([]); setAspectRatio("16:9"); }} className={`p-3 rounded-xl transition-all ${mode === "video" ? "bg-orange-600 text-white" : "text-gray-500 hover:bg-gray-800"}`} title="Vídeo"><VideoIcon className="w-6 h-6" /></button>
                        <button onClick={() => setMode("tryon")} className={`p-3 rounded-xl transition-all ${mode === "tryon" ? "bg-pink-600 text-white" : "text-gray-500 hover:bg-gray-800"}`} title="Provador"><Shirt className="w-6 h-6" /></button>
                        <button onClick={() => setMode("gallery")} className={`p-3 rounded-xl transition-all ${mode === "gallery" ? "bg-yellow-600 text-white" : "text-gray-500 hover:bg-gray-800"}`} title="Galeria"><Clock className="w-6 h-6" /></button>
                    </div>
                )}

                <div className={`flex-1 overflow-y-auto w-full p-4 py-6 ${mode !== 'home' ? 'md:pl-24' : ''}`}>
                    <div className="w-full max-w-6xl mx-auto space-y-6">

                        {mode === 'home' && (
                            <div className="w-full animate-in fade-in slide-in-from-bottom-4 space-y-8 pb-10 max-w-4xl mx-auto">
                                <div className="text-center py-8"><h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">{session.user.user_metadata.full_name?.split(' ')[0]}</span> 👋</h2><p className="text-lg text-gray-400">Pronto para criar algo incrível?</p></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gradient-to-br from-[#121214] to-[#1a1a1e] border border-gray-800 p-6 rounded-3xl flex flex-col justify-between relative overflow-hidden cursor-pointer hover:border-yellow-500/30 transition-all shadow-xl" onClick={toggleStore}><div className="absolute -top-4 -right-4 p-2 opacity-10"><Coins className="w-24 h-24 text-yellow-500" /></div><span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Saldo Atual</span><div className="flex items-end gap-2 mt-4"><span className="text-4xl font-black text-white">{credits}</span><span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full uppercase font-bold mb-1 border border-yellow-500/20">{plan}</span></div></div>
                                    <div className="bg-gradient-to-br from-[#121214] to-[#1a1a1e] border border-gray-800 p-6 rounded-3xl flex flex-col justify-between cursor-pointer hover:border-purple-500/30 transition-all shadow-xl" onClick={() => setIsReferralOpen(true)}><span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Nível de Prêmios</span><div className="w-full bg-gray-800 h-3 rounded-full mt-4 overflow-hidden relative"><div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full relative" style={{ width: `${Math.min((coins / 250) * 100, 100)}%` }}></div></div><span className="text-xs text-right text-gray-500 mt-2 font-mono">{coins}/250 Moedas</span></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div onClick={() => setMode('chat')} className="bg-[#121214] p-6 rounded-3xl border border-gray-800 hover:border-purple-500/50 cursor-pointer group transition-all hover:bg-[#18181b] shadow-lg"><div className="bg-purple-900/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-purple-400"><MessageSquare className="w-7 h-7" /></div><h3 className="font-bold text-xl text-white">Chat & Nah</h3><p className="text-sm text-gray-400 mt-2 leading-relaxed">Converse e crie roteiros.</p></div>
                                    <div onClick={() => { setMode('image'); setImageFiles([]); }} className="bg-[#121214] p-6 rounded-3xl border border-gray-800 hover:border-blue-500/50 cursor-pointer group transition-all hover:bg-[#18181b] shadow-lg"><div className="bg-blue-900/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-blue-400"><ImageIcon className="w-7 h-7" /></div><h3 className="font-bold text-xl text-white">Gerar Imagens</h3><p className="text-sm text-gray-400 mt-2 leading-relaxed">Crie artes com Nano Banana.</p></div>
                                    <div onClick={() => { setMode('video'); setImageFiles([]); setAspectRatio("16:9"); }} className="bg-[#121214] p-6 rounded-3xl border border-gray-800 hover:border-orange-500/50 cursor-pointer group transition-all hover:bg-[#18181b] shadow-lg"><div className="bg-orange-900/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-orange-400"><VideoIcon className="w-7 h-7" /></div><h3 className="font-bold text-xl text-white">Criar Vídeos</h3><p className="text-sm text-gray-400 mt-2 leading-relaxed">Vídeos cinematográficos.</p></div>
                                    <div onClick={() => setMode('tryon')} className="bg-[#121214] p-6 rounded-3xl border border-gray-800 hover:border-pink-500/50 cursor-pointer group transition-all hover:bg-[#18181b] shadow-lg"><div className="bg-pink-900/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-pink-400"><Shirt className="w-7 h-7" /></div><h3 className="font-bold text-xl text-white">Provador</h3><p className="text-sm text-gray-400 mt-2 leading-relaxed">Vista roupas em fotos.</p></div>
                                </div>
                                <div className="text-center pt-6"><button onClick={() => setMode('gallery')} className="text-sm text-gray-500 hover:text-white flex items-center justify-center gap-2 mx-auto transition-colors"><Clock className="w-4 h-4" /> Ver meu histórico recente</button></div>
                            </div>
                        )}

                        {mode !== 'home' && (
                            <div className="md:hidden flex w-full bg-gray-900 p-1.5 rounded-2xl border border-gray-800 overflow-x-auto shrink-0 mb-4 sticky top-0 z-20 shadow-xl">
                                <button onClick={() => setMode("chat")} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === "chat" ? "bg-purple-900/50 text-purple-200" : "text-gray-500"}`}>Chat</button>
                                <button onClick={() => { setMode("image"); setImageFiles([]); }} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === "image" ? "bg-blue-900/50 text-blue-200" : "text-gray-500"}`}>Img</button>
                                <button onClick={() => { setMode("video"); setImageFiles([]); setAspectRatio("16:9"); }} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === "video" ? "bg-orange-900/50 text-orange-200" : "text-gray-500"}`}>Vídeo</button>
                                <button onClick={() => setMode("tryon")} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === "tryon" ? "bg-pink-900/50 text-pink-200" : "text-gray-500"}`}>Provador</button>
                                <button onClick={() => setMode("gallery")} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === "gallery" ? "bg-yellow-900/50 text-yellow-200" : "text-gray-500"}`}>Galeria</button>
                            </div>
                        )}

                        {mode === "chat" && (
                            <div className="w-full flex flex-col md:flex-row gap-4 h-[65vh] md:h-[calc(100vh-140px)]">
                                <div className="w-full md:w-1/3 bg-[#0f0f10] border border-gray-800 rounded-3xl p-4 overflow-y-auto hidden md:block">
                                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Especialistas</h3>
                                    <div className="space-y-2">{PERSONAS.map(p => <div key={p.id} onClick={() => { setCurrentPersona(p); setChatHistory([]); }} className={`p-4 rounded-2xl cursor-pointer border transition-all ${currentPersona.id === p.id ? "bg-purple-900/20 border-purple-500/50" : "bg-gray-900/30 border-transparent hover:bg-gray-800"}`}><div className="font-bold text-sm text-white">{p.name}</div><div className="text-[10px] text-gray-500 mt-1">{p.role}</div></div>)}</div>
                                </div>
                                <div className="md:hidden w-full"><select onChange={(e) => { const p = PERSONAS.find(x => x.id === e.target.value); if (p) { setCurrentPersona(p); setChatHistory([]); } }} className="w-full bg-[#18181b] text-white p-3 rounded-xl border border-gray-700 outline-none">{PERSONAS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                                <div className="flex-1 bg-[#0f0f10] border border-gray-800 rounded-3xl flex flex-col overflow-hidden relative shadow-inner">
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">{chatHistory.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-600 text-center p-6"><Bot className="w-16 h-16 mb-4 text-purple-900/30" /><p className="text-lg font-bold text-gray-300">Olá! Sou a {currentPersona.name}.</p><p className="text-sm mt-2 max-w-xs">{currentPersona.prompt.split('.')[1]}</p></div>}{chatHistory.map((msg, i) => <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-md ${msg.role === "user" ? "bg-white text-black" : "bg-[#18181b] text-gray-200 border border-gray-800"}`}>{msg.parts}</div></div>)}{chatLoading && <div className="text-gray-500 text-xs animate-pulse ml-4">Digitando...</div>}<div ref={chatEndRef} /></div>
                                    <div className="p-4 border-t border-gray-800 bg-[#0a0a0a] flex gap-2"><input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleChatSend()} placeholder="Digite sua mensagem..." className="flex-1 bg-[#18181b] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-all" /><button onClick={handleChatSend} disabled={chatLoading} className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-xl transition-all shadow-lg"><Send className="w-5 h-5" /></button></div>
                                </div>
                            </div>
                        )}

                        {(mode === "image" || mode === "video") && (
                            <div className="flex flex-col md:flex-row gap-6 w-full h-full max-w-7xl mx-auto items-start">
                                <div className={`flex-1 flex flex-col gap-4 w-full ${resultUrl ? 'md:w-1/3' : 'md:max-w-2xl md:mx-auto'}`}>
                                    <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-purple-500 opacity-20 group-hover:opacity-50 transition-opacity"></div>
                                        <div className="relative w-full mb-4"><div className="relative"><select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-[#18181b] text-white border border-gray-700 rounded-xl p-3 pl-4 appearance-none cursor-pointer focus:border-yellow-500 outline-none text-sm font-medium">{ASPECT_RATIOS.filter(ratio => mode === "image" || ["16:9", "9:16"].includes(ratio.value)).map(ratio => <option key={ratio.value} value={ratio.value}>{ratio.label}</option>)}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" /></div>{mode === "video" && <p className="text-[10px] text-gray-500 mt-1 ml-2">Modo vídeo suporta apenas 16:9 e 9:16.</p>}</div>
                                        <div className="space-y-4 mb-6"><div className="flex flex-wrap gap-3">{imageFiles.map((file, idx) => (<div key={idx} className="relative w-20 h-20 bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group/img"><img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover opacity-70 group-hover/img:opacity-100 transition-opacity" /><button onClick={() => removeImage(idx)} className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500"><XCircle className="w-4 h-4" /></button></div>))}{((mode === "image" && imageFiles.length < 8) || (mode === "video" && imageFiles.length < 1)) && (<button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-gray-500 transition-all hover:bg-gray-800/50"><Plus className="w-6 h-6" /><span className="text-[9px] mt-1">{mode === 'video' ? 'Start Frame' : 'Add'}</span></button>)}<input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" multiple={mode === "image"} /></div>{isEditing && (<div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/20"><Layers className="w-4 h-4" /> <span>Modo Edição Ativo</span> <button onClick={handleClearAll} className="ml-auto hover:underline text-white">Limpar</button></div>)}</div>
                                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={isEditing ? "O que mudar?" : "Descreva sua criação..."} className="w-full bg-[#18181b] border border-gray-700 rounded-xl p-4 text-gray-200 h-40 mb-4 focus:border-yellow-500 outline-none transition-colors resize-none" />
                                        <button onClick={handleGenerate} disabled={loading || !prompt || credits < currentCost} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl ${loading || credits < currentCost ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-white text-black hover:bg-gray-200 hover:scale-[1.01]"}`}>{loading ? <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full" /> : <Sparkles className="w-5 h-5 fill-black" />}{loading ? "Processando..." : (credits < currentCost ? "Saldo Insuficiente" : `Gerar (-${currentCost})`)}</button>
                                    </div>
                                </div>

                                {resultUrl && !loading && (
                                    <div className="flex-1 w-full md:w-2/3 bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-right-4 h-fit sticky top-4">
                                        <div className="flex justify-between items-center mb-4"><h3 className="text-gray-400 flex items-center gap-2 font-medium"><Sparkles className="w-4 h-4 text-green-500" /> Resultado</h3><div className="flex gap-2">{mode === 'image' && <button onClick={() => handleTransformToVideo(resultUrl)} className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors" title="Animar"><PlayCircle className="w-4 h-4" /></button>}<button onClick={() => handleShare(resultUrl, mode)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white"><Share2 className="w-4 h-4" /></button><button onClick={() => handleDownload(resultUrl, mode)} className="p-2 bg-white text-black hover:bg-gray-200 rounded-lg"><Download className="w-4 h-4" /></button></div></div>
                                        <div className="rounded-xl overflow-hidden border border-gray-800 bg-black/50 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">{mode === "image" ? <img src={resultUrl} className="max-w-full max-h-[70vh] object-contain shadow-2xl" alt="Result" /> : <video src={resultUrl} controls autoPlay loop className="max-w-full max-h-[70vh] shadow-2xl" />}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {mode === "tryon" && (
                            <div className="flex flex-col md:flex-row gap-6 w-full h-full max-w-7xl mx-auto items-start">
                                <div className={`flex-1 flex flex-col gap-4 w-full ${resultUrl ? 'md:w-1/3' : 'md:max-w-xl md:mx-auto'}`}>
                                    <div className="bg-[#0f0f10] border border-pink-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 opacity-30"></div>
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6"><Shirt className="w-5 h-5 text-pink-500" /> Provador Virtual</h3>
                                        <div className="space-y-6">
                                            <div className="space-y-2"><label className="text-xs text-gray-400 font-bold uppercase flex justify-between">1. Foto da Pessoa <span>(Corpo Inteiro)</span></label><div className="relative group cursor-pointer" onClick={() => document.getElementById('input-person')?.click()}><div className={`h-40 w-full rounded-xl border-2 border-dashed ${personFile ? 'border-pink-500' : 'border-gray-700'} flex items-center justify-center bg-[#121214] overflow-hidden hover:bg-[#1a1a1e] transition-colors`}>{personFile ? <img src={URL.createObjectURL(personFile)} className="w-full h-full object-cover" alt="pessoa" /> : <div className="text-center text-gray-500"><Upload className="w-8 h-8 mx-auto mb-2" /><span className="text-xs">Toque para enviar</span></div>}</div><input id="input-person" type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setPersonFile(e.target.files[0])} /></div></div>
                                            <div className="space-y-2"><label className="text-xs text-gray-400 font-bold uppercase flex justify-between">2. Foto da Roupa <span>(Fundo Liso)</span></label><div className="relative group cursor-pointer" onClick={() => document.getElementById('input-garment')?.click()}><div className={`h-40 w-full rounded-xl border-2 border-dashed ${garmentFile ? 'border-pink-500' : 'border-gray-700'} flex items-center justify-center bg-[#121214] overflow-hidden hover:bg-[#1a1a1e] transition-colors`}>{garmentFile ? <img src={URL.createObjectURL(garmentFile)} className="w-full h-full object-cover" alt="roupa" /> : <div className="text-center text-gray-500"><Shirt className="w-8 h-8 mx-auto mb-2" /><span className="text-xs">Toque para enviar</span></div>}</div><input id="input-garment" type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setGarmentFile(e.target.files[0])} /></div></div>
                                            <button onClick={handleTryOn} disabled={loading || !personFile || !garmentFile} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg ${loading || !personFile || !garmentFile ? "bg-gray-800 text-gray-500" : "bg-gradient-to-r from-pink-600 to-purple-600 text-white hover:scale-[1.02] transition-transform"}`}>{loading ? "Provando..." : `Vestir Agora (-10 Créditos)`}</button>
                                        </div>
                                    </div>
                                </div>
                                {resultUrl && !loading && (
                                    <div className="flex-1 w-full md:w-2/3 bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-right-4 h-fit sticky top-4">
                                        <div className="flex justify-between items-center mb-4"><h3 className="text-gray-400 flex items-center gap-2 font-medium"><Sparkles className="w-4 h-4 text-pink-500" /> Resultado</h3><div className="flex gap-2"><button onClick={() => handleShare(resultUrl, 'image')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white"><Share2 className="w-4 h-4" /></button><button onClick={() => handleDownload(resultUrl, 'image')} className="p-2 bg-white text-black hover:bg-gray-200 rounded-lg"><Download className="w-4 h-4" /></button></div></div>
                                        <div className="rounded-xl overflow-hidden border border-gray-800 bg-black/50 flex items-center justify-center"><img src={resultUrl} className="max-w-full max-h-[70vh] object-contain shadow-2xl" alt="Result" /></div>
                                    </div>
                                )}
                            </div>
                        )}

                        {mode === "gallery" && (
                            <div className="w-full bg-[#0f0f10] border border-gray-800 rounded-3xl p-6 shadow-2xl animate-in fade-in pb-20 max-w-6xl mx-auto">
                                <h3 className="text-white font-bold text-xl mb-6 border-b border-gray-800 pb-4">Galeria</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {history.map((item) => (
                                        <div key={item.id} onClick={() => setSelectedMedia(item)} className="aspect-square bg-gray-900 rounded-xl overflow-hidden border border-gray-800 relative group cursor-pointer hover:border-white transition-colors">
                                            {item.type === 'image' ? <img src={item.url} className="w-full h-full object-cover" alt="Gallery" /> : <video src={item.url} className="w-full h-full object-cover" muted />}
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Eye className="w-8 h-8 text-white drop-shadow-lg" /></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <footer className="h-[30px] bg-[#0a0a0a] border-t border-gray-900 flex justify-center items-center gap-4 text-[10px] text-gray-600 shrink-0 z-30">
                <span>© 2025 NastIA Studio</span>
                <span className="w-1 h-1 bg-gray-800 rounded-full"></span>
                <a href="https://instagram.com/nastia.tec" target="_blank" rel="noopener noreferrer" className="hover:text-white">Instagram</a>
                <span className="w-1 h-1 bg-gray-800 rounded-full"></span>
                {referralCode && <span onClick={copyReferral} className="cursor-pointer hover:text-yellow-500">Indique: {referralCode}</span>}
            </footer>
        </main>
    );
}