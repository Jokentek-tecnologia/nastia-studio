import { useState, useEffect } from "react";
import { Copy, Gift, Coins, Trophy, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import axios from "axios";

interface Props {
    userId: string;
    referralCode: string;
    onClose: () => void;
}

export default function GamifiedReferral({ userId, referralCode, onClose }: Props) {
    const [coins, setCoins] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCoins();
    }, []);

    const fetchCoins = async () => {
        const { data } = await supabase.from('profiles').select('coins').eq('id', userId).single();
        if (data) setCoins(data.coins || 0);
    };

    const copyCode = () => {
        navigator.clipboard.writeText(`https://nastia-studio.netlify.app?ref=${referralCode}`);
        alert("Link copiado!");
    };

    const handleRedeem = async () => {
        if (coins < 250) return;
        if (!confirm("Trocar 250 moedas por 1 Mês de Plano PLUS?")) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("user_id", userId);
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/redeem-coins`, formData);
            alert("SUCESSO! Você agora é membro PLUS! 🎉");
            window.location.reload();
        } catch (e) {
            alert("Erro ao resgatar.");
        } finally {
            setLoading(false);
        }
    };

    const progress = Math.min((coins / 250) * 100, 100);

    return (
        // CLIQUE FORA (OVERLAY): Adicionado onClick={onClose}
        <div
            onClick={onClose}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in"
        >
            {/* CONTEÚDO: Adicionado stopPropagation para não fechar ao clicar dentro */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#121214] w-full max-w-lg rounded-3xl border border-yellow-500/30 shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto"
            >
                <div className="bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 p-6 text-center relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white"><X /></button>
                    <Trophy className="w-16 h-16 text-yellow-200 mx-auto mb-2 drop-shadow-lg animate-bounce" />
                    <h2 className="text-2xl font-black text-white uppercase italic">Indique & Ganhe</h2>
                    <p className="text-yellow-100 text-sm mt-1">Transforme amigos em assinantes!</p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 text-center">
                            <Gift className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                            <p className="text-xs text-gray-400">Cadastro</p>
                            <p className="text-lg font-bold text-white">+100 Créditos</p>
                        </div>
                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 text-center">
                            <Coins className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                            <p className="text-xs text-gray-400">Assinatura</p>
                            <p className="text-lg font-bold text-white">+10 Moedas</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-yellow-500 flex items-center gap-1"><Coins className="w-4 h-4" /> Moedas: {coins}</span>
                            <span className="text-xs text-gray-500">Meta: 250</span>
                        </div>
                        <div className="h-6 w-full bg-gray-900 rounded-full border border-gray-700 relative overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-end pr-2" style={{ width: `${progress}%` }}>
                                {progress > 10 && <span className="text-[10px] font-bold text-black">{Math.floor(progress)}%</span>}
                            </div>
                        </div>
                    </div>

                    <div className="bg-black/40 p-4 rounded-xl border border-dashed border-gray-700">
                        <p className="text-xs text-gray-400 mb-2">Link de Indicação:</p>
                        <div className="flex gap-2">
                            <input readOnly value={`nastia-studio.netlify.app?ref=${referralCode}`} className="flex-1 bg-transparent text-sm text-gray-300 outline-none font-mono truncate" />
                            <button onClick={copyCode} className="text-yellow-500 font-bold text-sm flex items-center gap-1"><Copy className="w-4 h-4" /> Copiar</button>
                        </div>
                    </div>

                    <button
                        onClick={handleRedeem}
                        disabled={coins < 250 || loading}
                        className={`w-full py-4 rounded-xl font-black text-lg uppercase flex items-center justify-center gap-2 ${coins >= 250 ? "bg-gradient-to-r from-yellow-500 to-orange-600 text-white animate-pulse" : "bg-gray-800 text-gray-500 opacity-50"
                            }`}
                    >
                        {loading ? "..." : (coins >= 250 ? "RESGATAR 1 MÊS PLUS! 🎁" : `Faltam ${250 - coins}`)}
                    </button>
                </div>
            </div>
        </div>
    );
}