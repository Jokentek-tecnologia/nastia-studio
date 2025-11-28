"use client";

import React, { useState } from "react";
import axios from "axios";
import { X, Check, CreditCard, Gift, Share2, Copy, Loader2, Crown, Zap, Link as LinkIcon } from "lucide-react";

const LINKS: Record<string, string> = {
    plus: "https://buy.stripe.com/dRm9ANcPqgrLbHa6Z6awo00",
    pro: "https://buy.stripe.com/28E7sFg1Ca3n8uYdnuawo02",
    pack600: "https://buy.stripe.com/3cI4gtaHiejD8uYgzGawo01"
};

interface StoreModalProps {
    userId: string;
    currentPlan: string;
    referralCode: string;
    onClose: () => void;
    onUpdate: () => void;
}

export default function StoreModal({ userId, currentPlan, referralCode, onClose, onUpdate }: StoreModalProps) {
    const [activeTab, setActiveTab] = useState<"plans" | "coupon">("plans");
    const [couponCode, setCouponCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const PRODUCTS = [
        { id: "free", type: "plan", name: "Free", credits: 100, price: "R$ 0", features: ["100 Créditos/mês", "Com Marca d'água", "Acesso Básico"] },
        { id: "plus", type: "plan", name: "Plus", credits: 500, price: "R$ 69", sub: "/mês", features: ["500 Créditos/mês", "🚫 SEM Marca d'água", "Editor de Imagem"] },
        { id: "pro", type: "plan", name: "PRO", credits: 1000, price: "R$ 99", sub: "/mês", features: ["1000 Créditos/mês", "🚫 SEM Marca d'água", "Prioridade na Fila"] },
        { id: "pack600", type: "pack", name: "Pack Avulso", credits: 600, price: "R$ 99", sub: "/único", features: ["600 Créditos válidos por 1 ano", "Não renova automaticamente", "Ideal para projetos pontuais"] },
    ];

    const handleRedeem = async () => {
        if (!couponCode) return;
        setLoading(true);
        setMessage(null);
        try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/redeem-coupon`, { user_id: userId, code: couponCode });
            setMessage({ type: "success", text: "Sucesso! Créditos adicionados." });
            onUpdate(); setCouponCode("");
        } catch (error: any) {
            setMessage({ type: "error", text: error.response?.data?.detail || "Inválido." });
        } finally { setLoading(false); }
    };

    // GERA O LINK DIRETO PARA COMPARTILHAR
    const copyLink = () => {
        const link = `https://studio.nastia.com.br/?ref=${referralCode}`;
        navigator.clipboard.writeText(link);
        alert("Link de convite copiado! Envie para seus amigos.");
    };

    const getPaymentLink = (productId: string) => {
        const base = LINKS[productId];
        if (!base) return "#";
        return `${base}?client_reference_id=${userId}`;
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-2 sm:p-4 animate-in fade-in zoom-in duration-300 font-sans overflow-y-auto">
            {/* Container Responsivo: Vira coluna no celular */}
            <div className="w-full max-w-5xl bg-[#18181b] rounded-2xl border border-gray-700 shadow-2xl flex flex-col md:flex-row min-h-[80vh] md:max-h-[90vh]">

                {/* SIDEBAR (Topo no mobile, lado no desktop) */}
                <div className="w-full md:w-72 bg-[#202022] p-6 border-b md:border-r border-gray-700 flex flex-col gap-2 shrink-0">
                    <div className="flex justify-between items-center md:block mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-500" /> Premium</h2>
                        <button onClick={onClose} className="md:hidden p-2 text-gray-400"><X className="w-6 h-6" /></button>
                    </div>

                    <button onClick={() => setActiveTab("plans")} className={`p-3 rounded-xl text-left text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "plans" ? "bg-yellow-600 text-white" : "text-gray-400 hover:bg-gray-700 hover:text-white"}`}><CreditCard className="w-4 h-4" /> Planos & Preços</button>
                    <button onClick={() => setActiveTab("coupon")} className={`p-3 rounded-xl text-left text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "coupon" ? "bg-yellow-600 text-white" : "text-gray-400 hover:bg-gray-700 hover:text-white"}`}><Gift className="w-4 h-4" /> Resgatar Código</button>

                    <div className="hidden md:block flex-1"></div>

                    {/* CARD DE INDICAÇÃO MELHORADO */}
                    <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl mt-4">
                        <h3 className="text-blue-400 text-xs font-bold mb-2 flex items-center gap-1"><Share2 className="w-3 h-3" /> INDIQUE E GANHE</h3>
                        <p className="text-gray-400 text-[10px] mb-3 leading-relaxed">
                            Envie seu link. Seu amigo ganha 50 créditos ao entrar e você ganha 100 se ele assinar!
                        </p>
                        <button onClick={copyLink} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                            <LinkIcon className="w-3 h-3" /> Copiar Link de Convite
                        </button>
                    </div>
                </div>

                {/* CONTEÚDO */}
                <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-[#18181b]">
                    <div className="hidden md:flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-white">{activeTab === "plans" ? "Escolha sua opção" : "Área de Cupons"}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400"><X className="w-6 h-6" /></button>
                    </div>

                    {activeTab === "plans" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 pb-10">
                            {PRODUCTS.map((prod) => (
                                <div key={prod.id} className={`p-5 rounded-xl border relative flex flex-col ${currentPlan === prod.id ? "border-yellow-500 bg-yellow-500/5" : prod.type === 'pack' ? "border-blue-500/30 bg-blue-900/10" : "border-gray-700 bg-[#202022]"}`}>
                                    {currentPlan === prod.id && <span className="absolute top-3 right-3 text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">ATUAL</span>}
                                    {prod.type === 'pack' && <span className="absolute top-3 right-3 text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">AVULSO</span>}
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">{prod.name} {prod.type === 'pack' && <Zap className="w-4 h-4 text-blue-400 fill-blue-400" />}</h3>
                                    <div className="text-2xl font-bold text-white my-2">{prod.price}<span className="text-sm text-gray-500 font-normal">{prod.sub}</span></div>
                                    <ul className="space-y-2 my-4 flex-1">{prod.features.map((feat, i) => <li key={i} className="text-xs text-gray-300 flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> {feat}</li>)}</ul>
                                    {prod.id !== 'free' && (
                                        <a href={getPaymentLink(prod.id)} target="_blank" rel="noreferrer" className="block w-full mt-auto">
                                            <button disabled={currentPlan === prod.id && prod.type !== 'pack'} className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${currentPlan === prod.id && prod.type !== 'pack' ? "bg-gray-700 text-gray-500 cursor-not-allowed" : prod.type === 'pack' ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-white text-black hover:bg-gray-200"}`}>
                                                {currentPlan === prod.id && prod.type !== 'pack' ? "Plano Atual" : "Comprar"}
                                            </button>
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === "coupon" && (
                        <div className="max-w-md mx-auto mt-10 text-center pb-10">
                            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-500"><Gift className="w-8 h-8" /></div>
                            <h3 className="text-xl font-bold text-white mb-2">Tem um código promocional?</h3>
                            <p className="text-gray-400 text-sm mb-6">Digite abaixo para adicionar créditos à sua conta.</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="EX: BETA1000" className="flex-1 bg-[#27272a] border border-gray-600 rounded-lg px-4 py-3 text-white outline-none uppercase" />
                                <button onClick={handleRedeem} disabled={loading || !couponCode} className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-lg">{loading ? <Loader2 className="animate-spin" /> : "Resgatar"}</button>
                            </div>
                            {message && <div className={`mt-4 p-3 rounded-lg text-sm text-center ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}