import { X, Check, Zap, Crown, Star } from "lucide-react";
import axios from "axios";

interface Props {
    userId: string;
    currentPlan: string;
    referralCode: string;
    onClose: () => void;
    onUpdate: () => void;
}

export default function StoreModal({ userId, currentPlan, referralCode, onClose, onUpdate }: Props) {

    const handleCheckout = async (priceId: string, url: string) => {
        // Redirecionamento simples para links de pagamento (Stripe)
        // Substitua pelos seus links reais do Stripe se tiver, ou mantenha a lógica
        window.open(url, "_blank");
    };

    // Links de Exemplo (Substitua pelos seus do Stripe Payment Links)
    const LINK_PLUS = "https://buy.stripe.com/test_plus";
    const LINK_PRO = "https://buy.stripe.com/test_pro";

    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/90 p-0 sm:p-4 backdrop-blur-md animate-in fade-in" onClick={onClose}>
            <div className="bg-[#121214] w-full sm:max-w-4xl h-[90vh] sm:h-auto rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-800 shadow-2xl relative flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>

                {/* Header Fixo */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#121214] z-10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Crown className="w-6 h-6 text-yellow-500" /> Loja NastIA</h2>
                    <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-white hover:bg-gray-700"><X className="w-5 h-5" /></button>
                </div>

                {/* Conteúdo Rolável */}
                <div className="overflow-y-auto p-4 sm:p-8 space-y-8 flex-1">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* PLANO FREE */}
                        <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 flex flex-col">
                            <h3 className="text-gray-400 font-bold uppercase tracking-wider text-sm">Iniciante</h3>
                            <div className="mt-2 mb-4"><span className="text-3xl font-bold text-white">Grátis</span></div>
                            <ul className="space-y-3 text-sm text-gray-300 flex-1 mb-6">
                                <li className="flex gap-2"><Check className="w-4 h-4 text-green-500" /> 100 Créditos/mês</li>
                                <li className="flex gap-2"><Check className="w-4 h-4 text-green-500" /> Acesso ao Chat</li>
                                <li className="flex gap-2"><Check className="w-4 h-4 text-green-500" /> Gerações com Marca d'água</li>
                            </ul>
                            <button disabled className="w-full py-3 rounded-xl font-bold bg-gray-800 text-gray-500">Plano Atual</button>
                        </div>

                        {/* PLANO PLUS */}
                        <div className="bg-gray-900 rounded-2xl p-6 border border-purple-500/30 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold">POPULAR</div>
                            <h3 className="text-purple-400 font-bold uppercase tracking-wider text-sm">Plus</h3>
                            <div className="mt-2 mb-4 flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-white">R$ 69</span>
                                <span className="text-sm text-gray-400">/mês</span>
                            </div>
                            <ul className="space-y-3 text-sm text-gray-300 flex-1 mb-6">
                                <li className="flex gap-2"><Check className="w-4 h-4 text-purple-500" /> 500 Créditos (+Bônus)</li>
                                <li className="flex gap-2"><Check className="w-4 h-4 text-purple-500" /> Sem Marca d'água</li>
                                <li className="flex gap-2"><Check className="w-4 h-4 text-purple-500" /> Acesso ao Vídeo (Veo)</li>
                            </ul>
                            <button onClick={() => handleCheckout("plus", "LINK_DO_SEU_STRIPE_PLUS")} className="w-full py-3 rounded-xl font-bold bg-purple-600 text-white hover:bg-purple-500 transition-all">Assinar Plus</button>
                        </div>

                        {/* PLANO PRO */}
                        <div className="bg-gradient-to-b from-yellow-900/20 to-gray-900 rounded-2xl p-6 border border-yellow-500/30 flex flex-col">
                            <h3 className="text-yellow-500 font-bold uppercase tracking-wider text-sm flex items-center gap-1"><Star className="w-4 h-4 fill-yellow-500" /> Pro</h3>
                            <div className="mt-2 mb-4 flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-white">R$ 99</span>
                                <span className="text-sm text-gray-400">/mês</span>
                            </div>
                            <ul className="space-y-3 text-sm text-gray-300 flex-1 mb-6">
                                <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-500" /> 1.500 Créditos</li>
                                <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-500" /> Suporte Prioritário</li>
                                <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-500" /> Acesso a Ferramentas Beta</li>
                            </ul>
                            <button onClick={() => handleCheckout("pro", "LINK_DO_SEU_STRIPE_PRO")} className="w-full py-3 rounded-xl font-bold bg-yellow-500 text-black hover:bg-yellow-400 transition-all">Assinar Pro</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}