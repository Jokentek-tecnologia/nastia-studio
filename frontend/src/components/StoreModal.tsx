"use client";
import { X, Check, Zap, Shield, Crown } from "lucide-react";
import axios from "axios";

interface StoreModalProps {
    userId: string;
    currentPlan: string;
    referralCode: string;
    onClose: () => void;
    onUpdate: () => void;
}

export default function StoreModal({ userId, currentPlan, onClose, onUpdate }: StoreModalProps) {
    const handleCheckout = async (priceId: string) => {
        // Redirecionamento simples para Stripe ou sistema de pagamento
        // Substitua pelo seu link de pagamento real se necessário
        alert("Redirecionando para o pagamento...");
    };

    const handleRedeemCoins = async () => {
        try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/redeem-coins`, { user_id: userId });
            alert("Resgatado com sucesso! Agora você é Plus.");
            onUpdate();
            onClose();
        } catch (e) {
            alert("Moedas insuficientes ou erro no resgate.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#18181b] w-full max-w-4xl rounded-3xl border border-gray-800 overflow-hidden flex flex-col md:flex-row relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10 bg-black/50 rounded-full p-2"><X className="w-6 h-6" /></button>

                {/* Free Plan */}
                <div className="flex-1 p-8 border-b md:border-b-0 md:border-r border-gray-800 flex flex-col items-center text-center">
                    <div className="bg-gray-800/50 p-4 rounded-full mb-4"><Shield className="w-8 h-8 text-gray-400" /></div>
                    <h3 className="text-xl font-bold text-white">Starter</h3>
                    <p className="text-gray-400 text-sm mt-2 mb-6">Para experimentar a IA.</p>
                    <ul className="text-left space-y-3 text-sm text-gray-300 mb-8 w-full max-w-xs mx-auto">
                        <li className="flex gap-2"><Check className="w-4 h-4 text-green-500" /> 10 Gerações/dia</li>
                        <li className="flex gap-2"><Check className="w-4 h-4 text-green-500" /> Chat Ilimitado</li>
                        <li className="flex gap-2"><Check className="w-4 h-4 text-green-500" /> Velocidade Padrão</li>
                    </ul>
                    <button className="mt-auto w-full py-3 rounded-xl bg-gray-800 text-gray-400 font-bold cursor-default">Plano Atual</button>
                </div>

                {/* Plus Plan */}
                <div className="flex-1 p-8 bg-gradient-to-b from-[#18181b] to-purple-900/20 flex flex-col items-center text-center relative border-b md:border-b-0 md:border-r border-gray-800">
                    <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">MAIS POPULAR</div>
                    <div className="bg-purple-900/30 p-4 rounded-full mb-4"><Zap className="w-8 h-8 text-purple-400" /></div>
                    <h3 className="text-xl font-bold text-white">Plus</h3>
                    <div className="text-3xl font-bold text-white mt-2">R$ 69,90<span className="text-sm text-gray-400 font-normal">/mês</span></div>
                    <ul className="text-left space-y-3 text-sm text-gray-300 my-8 w-full max-w-xs mx-auto">
                        <li className="flex gap-2"><Check className="w-4 h-4 text-purple-400" /> 500 Créditos/mês</li>
                        <li className="flex gap-2"><Check className="w-4 h-4 text-purple-400" /> Geração de Vídeo (Veo)</li>
                        <li className="flex gap-2"><Check className="w-4 h-4 text-purple-400" /> Provador Virtual</li>
                        <li className="flex gap-2"><Check className="w-4 h-4 text-purple-400" /> Sem Marca d'água</li>
                    </ul>
                    <button onClick={() => handleCheckout("price_plus")} className="mt-auto w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors">Assinar Plus</button>
                    <button onClick={handleRedeemCoins} className="mt-2 text-xs text-yellow-500 hover:underline">Trocar 250 moedas por 1 mês</button>
                </div>

                {/* Pro Plan */}
                <div className="flex-1 p-8 flex flex-col items-center text-center">
                    <div className="bg-yellow-900/20 p-4 rounded-full mb-4"><Crown className="w-8 h-8 text-yellow-500" /></div>
                    <h3 className="text-xl font-bold text-white">Pro</h3>
                    <div className="text-3xl font-bold text-white mt-2">R$ 99,90<span className="text-sm text-gray-400 font-normal">/mês</span></div>
                    <ul className="text-left space-y-3 text-sm text-gray-300 my-8 w-full max-w-xs mx-auto">
                        <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-500" /> 1500 Créditos/mês</li>
                        <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-500" /> Prioridade Máxima</li>
                        <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-500" /> Suporte Dedicado</li>
                        <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-500" /> Acesso Antecipado</li>
                    </ul>
                    <button onClick={() => handleCheckout("price_pro")} className="mt-auto w-full py-3 rounded-xl bg-white text-black hover:bg-gray-200 font-bold transition-colors">Assinar Pro</button>
                </div>
            </div>
        </div>
    );
}