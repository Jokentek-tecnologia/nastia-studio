"use client";

import React, { useState } from "react";
import axios from "axios";
import { X, Check, CreditCard, Gift, Share2, Copy, Loader2, Crown } from "lucide-react";

interface StoreModalProps {
    userId: string;
    currentPlan: string;
    referralCode: string;
    onClose: () => void;
    onUpdate: () => void; // Para atualizar o saldo na tela principal
}

export default function StoreModal({ userId, currentPlan, referralCode, onClose, onUpdate }: StoreModalProps) {
    const [activeTab, setActiveTab] = useState<"plans" | "coupon">("plans");
    const [couponCode, setCouponCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const PLANS = [
        { id: "free", name: "Free", credits: 100, price: "R$ 0", features: ["100 Créditos/mês", "Marca d'água", "Suporte Básico"] },
        { id: "plus", name: "Plus", credits: 500, price: "R$ 69", features: ["500 Créditos/mês", "Marca d'água", "Acesso ao Chat"] },
        { id: "pro", name: "PRO", credits: 1000, price: "R$ 99", features: ["1000 Créditos/mês", "Prioridade na Fila", "Acesso Antecipado"] },
        { id: "agency", name: "Criação", credits: 2500, price: "R$ 199", features: ["2500 Créditos/mês", "SEM Marca d'água", "Licença Comercial"] },
    ];

    const handleRedeem = async () => {
        if (!couponCode) return;
        setLoading(true);
        setMessage(null);

        try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/redeem-coupon`, {
                user_id: userId,
                code: couponCode
            });
            setMessage({ type: "success", text: "Cupom resgatado! Créditos adicionados." });
            onUpdate(); // Atualiza o saldo lá no header
            setCouponCode("");
        } catch (error: any) {
            setMessage({ type: "error", text: error.response?.data?.detail || "Cupom inválido." });
        } finally {
            setLoading(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(`https://nastia.com.br?ref=${referralCode}`);
        alert("Link copiado!");
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300 font-sans">
            <div className="w-full max-w-4xl bg-[#18181b] rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                {/* SIDEBAR */}
                <div className="w-full md:w-64 bg-[#202022] p-6 border-b md:border-r border-gray-700 flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Crown className="w-5 h-5 text-yellow-500" /> Premium
                    </h2>

                    <button onClick={() => setActiveTab("plans")} className={`p-3 rounded-xl text-left text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "plans" ? "bg-yellow-600 text-white" : "text-gray-400 hover:bg-gray-700 hover:text-white"}`}>
                        <CreditCard className="w-4 h-4" /> Planos & Preços
                    </button>
                    <button onClick={() => setActiveTab("coupon")} className={`p-3 rounded-xl text-left text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "coupon" ? "bg-yellow-600 text-white" : "text-gray-400 hover:bg-gray-700 hover:text-white"}`}>
                        <Gift className="w-4 h-4" /> Resgatar Código
                    </button>

                    <div className="flex-1"></div>

                    {/* CARTÃO DE INDICAÇÃO */}
                    <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl mt-4">
                        <h3 className="text-blue-400 text-xs font-bold mb-2 flex items-center gap-1"><Share2 className="w-3 h-3" /> INDIQUE E GANHE</h3>
                        <p className="text-gray-400 text-[10px] mb-3">Ganhe 100 créditos por amigo indicado.</p>
                        <div onClick={copyLink} className="bg-black/40 p-2 rounded border border-gray-600 text-xs text-white font-mono flex justify-between items-center cursor-pointer hover:border-white transition-colors">
                            <span className="truncate">{referralCode}</span>
                            <Copy className="w-3 h-3 text-gray-500" />
                        </div>
                    </div>
                </div>

                {/* CONTEÚDO */}
                <div className="flex-1 p-8 overflow-y-auto bg-[#18181b]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-white">
                            {activeTab === "plans" ? "Escolha seu Plano" : "Área de Cupons"}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400"><X className="w-6 h-6" /></button>
                    </div>

                    {/* ABA PLANOS */}
                    {activeTab === "plans" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {PLANS.map((plan) => (
                                <div key={plan.id} className={`p-5 rounded-xl border relative ${currentPlan === plan.id ? "border-yellow-500 bg-yellow-500/5" : "border-gray-700 bg-[#202022]"}`}>
                                    {currentPlan === plan.id && <span className="absolute top-3 right-3 text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">ATUAL</span>}
                                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                                    <div className="text-3xl font-bold text-white my-2">{plan.price}<span className="text-sm text-gray-500 font-normal">/mês</span></div>
                                    <ul className="space-y-2 my-4">
                                        {plan.features.map((feat, i) => (
                                            <li key={i} className="text-xs text-gray-300 flex items-center gap-2">
                                                <Check className="w-3 h-3 text-green-500" /> {feat}
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        disabled={currentPlan === plan.id}
                                        className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${currentPlan === plan.id
                                            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                                            : "bg-white text-black hover:bg-gray-200"
                                            }`}
                                        onClick={() => alert("Aqui abriríamos o Checkout do Stripe/MercadoPago!")}
                                    >
                                        {currentPlan === plan.id ? "Plano Atual" : "Assinar Agora"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ABA CUPONS */}
                    {activeTab === "coupon" && (
                        <div className="max-w-md mx-auto mt-10 text-center">
                            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-500">
                                <Gift className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Tem um código promocional?</h3>
                            <p className="text-gray-400 text-sm mb-6">Digite abaixo para adicionar créditos à sua conta.</p>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                    placeholder="EX: NASTIA1000"
                                    className="flex-1 bg-[#27272a] border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none placeholder:text-gray-600 font-mono uppercase"
                                />
                                <button
                                    onClick={handleRedeem}
                                    disabled={loading || !couponCode}
                                    className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Resgatar"}
                                </button>
                            </div>

                            {message && (
                                <div className={`mt-4 p-3 rounded-lg text-sm flex items-center justify-center gap-2 ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                    {message.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                    {message.text}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}