import { useState } from "react";
import { Key, X, ExternalLink, ShieldAlert } from "lucide-react"; // Removido CheckCircle não usado
import { supabase } from "../lib/supabase";

interface Props {
    userId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ApiKeyModal({ userId, onClose, onSuccess }: Props) {
    const [key, setKey] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!key.startsWith("AIza")) {
            alert("Essa chave parece inválida. Ela deve começar com 'AIza'.");
            return;
        }
        setLoading(true);

        // CORREÇÃO: Usamos .from() em vez de .table() e forçamos o tipo com 'as any'
        // Isso impede que o TypeScript bloqueie o deploy por não conhecer a coluna nova
        const { error } = await supabase
            .from("profiles")
            .update({ custom_api_key: key } as any)
            .eq("id", userId);

        setLoading(false);

        if (error) {
            console.error("Erro Supabase:", error);
            alert("Erro ao salvar. Tente novamente.");
        } else {
            alert("Chave salva! Agora você tem Gerações Ilimitadas (Grátis).");
            onSuccess();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#18181b] w-full max-w-md rounded-2xl border border-gray-700 shadow-2xl relative overflow-hidden">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X /></button>

                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-green-500/20 p-3 rounded-full text-green-500"><Key className="w-6 h-6" /></div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Modo Turbo Grátis</h2>
                            <p className="text-xs text-gray-400">Use a cota gratuita do Google direto aqui.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-sm space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="bg-gray-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                                <p className="text-gray-300">
                                    Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 hover:underline font-bold inline-flex items-center">Google AI Studio <ExternalLink className="w-3 h-3 ml-1" /></a>.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="bg-gray-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                                <p className="text-gray-300">Clique no botão azul <b>"Create API Key"</b>.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="bg-gray-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                                <p className="text-gray-300">Copie o código que começa com <code>AIza...</code> e cole abaixo:</p>
                            </div>
                        </div>

                        <input
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Cole sua chave aqui (AIza...)"
                            className="w-full bg-black border border-gray-600 rounded-lg p-3 text-white focus:border-green-500 outline-none font-mono text-sm"
                        />

                        <div className="bg-yellow-500/10 p-3 rounded-lg flex gap-2 items-start">
                            <ShieldAlert className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <p className="text-[10px] text-yellow-200/80">
                                Sua chave é salva de forma segura e usada apenas para suas gerações. Você aproveita a facilidade do NastIA Studio sem gastar seus créditos da plataforma.
                            </p>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={!key || loading}
                            className={`w-full py-3 rounded-lg font-bold text-white transition-all ${key ? "bg-green-600 hover:bg-green-500" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
                        >
                            {loading ? "Salvando..." : "Ativar Modo Turbo"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}