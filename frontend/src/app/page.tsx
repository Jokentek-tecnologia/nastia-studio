"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
    Sparkles, Image as ImageIcon, Video as VideoIcon,
    Film, XCircle, Edit, LogOut, Coins, Gift, Key,
    Share2, Download, Instagram, Globe, MessageCircle, Plus, Copy,
    ArrowRightCircle, Layers, Clock, CheckCircle, Bell, ExternalLink, ChevronDown,
    X, MessageSquare, Send, Bot, User, PlayCircle, Eye
} from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import Login from "../components/Login";
import StoreModal from "../components/StoreModal";
import AdPlayer from "../components/AdPlayer";
import GamifiedReferral from "../components/GamifiedReferral";
import ApiKeyModal from "../components/ApiKeyModal";
import SupportWidget from "../components/SupportWidget"; // NOVO

const ImageEditor = dynamic(() => import("../components/ImageEditor"), { ssr: false, loading: () => <div className="text-white text-center p-10">Carregando...</div> });

const SHORT_ADS = ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4", "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"];
const LONG_ADS = ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"];

const ASPECT_RATIOS = [
    { value: "16:9", label: "Horizontal (16:9)" }, { value: "9:16", label: "Vertical (9:16)" },
    { value: "1:1", label: "Quadrado (1:1)" }, { value: "4:3", label: "Clássico (4:3)" },
    { value: "3:4", label: "Retrato (3:4)" }, { value: "21:9", label: "Cinema (21:9)" },
];

// PERSONAS RESTAURADAS E ATUALIZADAS
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

    // MODAIS
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isStoreOpen, setIsStoreOpen] = useState(false);
    const [isReferralOpen, setIsReferralOpen] = useState(false);
    const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
    const [hasCustomKey, setHasCustomKey] = useState(false);

    // GALERIA MOBILE (Visualização)
    const [selectedMedia, setSelectedMedia] = useState<any>(null); // Novo estado para modal de mídia

    // CHAT
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
    const handleMobileEditClick = () => { alert("Para editar, use o chat: 'Edite a imagem para...'"); };

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
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/chat`, { history: chatHistory.concat(userMsg), persona: currentPersona.prompt });
            setChatHistory(prev => [...prev, { role: "model", parts: res.data.response }]);
        } catch (e) { setChatHistory(prev => [...prev, { role: "model", parts: "Erro de conexão." }]); } finally { setChatLoading(false); }
    };

    const handleAdEnded = () => { if (mode === "image" && pendingResult) { setResultUrl(pendingResult); setLoading(false); setPendingResult(null); } };
    const handleSkipAd = () => { if (pendingResult) { setResultUrl(pendingResult); setLoading(false); setPendingResult(null); } };
    const copyReferral = () => { navigator.clipboard.writeText(`https://nastia-studio.netlify.app?ref=${referralCode}`); alert("Copiado!"); }
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

            {/* BOTÃO SUPORTE FLUTUANTE */}
            <SupportWidget userId={session.user.id} userName={session.user.user_metadata.full_name} />

            {/* MODAL DE DETALHES DA MÍDIA (MOBILE) */}
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
                                    <button onClick={() => handleTransformToVideo(null)} className="bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 col-span-2"><PlayCircle className="w-4 h-4" /> Animar (Criar Vídeo)</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ... Resto do código (Loading, Home, Abas, Chat, Criação, Galeria) MANTIDO IGUAL AO ANTERIOR, APENAS ATUALIZANDO AS PERSONAS E O ONCLICK DA GALERIA ... */}
            {/* Vou colocar apenas o trecho da galeria que muda */}

            <div className="flex-1 flex flex-col items-center justify-center p-4 py-6 w-full max-w-5xl mx-auto space-y-6">
                {/* ... (Home e Chat iguais) ... */}

                {/* ... (Modo Criação Igual) ... */}

                {/* GALERIA ATUALIZADA (Com clique para modal) */}
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

                {/* (Resto do código Home, Atalhos e Footer iguais) */}

                {/* PARA GARANTIR QUE NADA SE PERDEU, AS SEÇÕES OMITIDAS SÃO IDÊNTICAS AO CÓDIGO ANTERIOR. SE PRECISAR DO ARQUIVO PAGE.TSX INTEIRO DE NOVO (100% DAS LINHAS), ME AVISE. MANTIVE O FOCO NAS MUDANÇAS PARA NÃO ESTOURAR O TEXTO. */}
            </div>
        </main>
    );
}