import { useState } from "react";
import { Key, X, ExternalLink, ShieldAlert, ArrowRight, CheckCircle } from "lucide-react";
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
            alert("Chave inválida. Ela deve começar com 'AIza'.");
            return;
        }
        setLoading(true);
        // Usa 'as any' para evitar erro de tipagem
        const { error } = await supabase.from("profiles").update({ custom_api_key: key } as any).eq("id", userId);
        setLoading(false);

        if (error) alert("Erro ao salvar.");
        else {
            alert("Modo Turbo Ativado!");
            onSuccess();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
            <div className="bg-[#18181b] w-full max-w-md rounded-2xl border border-gray-700 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><Key className="w-5 h-5 text-green-500" /> Configurar Chave</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-200">
                        Siga os passos exatos abaixo para usar o Google AI Studio gratuitamente:
                    </div>

                    <ol className="space-y-4 text-sm text-gray-300 relative border-l border-gray-700 ml-2">
                        <li className="pl-6 relative">
                            <span className="absolute -left-[9px] top-0 w-4 h-4 bg-gray-800 border border-green-500 rounded-full flex items-center justify-center text-[10px] text-green-500 font-bold">1</span>
                            <p>Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 font-bold underline">Google AI Studio</a>.</p>
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute -left-[9px] top-0 w-4 h-4 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center text-[10px]">2</span>
                            <p>Clique no botão azul grande <b>"Create API Key"</b>.</p>
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute -left-[9px] top-0 w-4 h-4 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center text-[10px]">3</span>
                            <p>Selecione a opção <b>"Create API key in new project"</b> (ou "Default Gemini Project" se aparecer).</p>
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute -left-[9px] top-0 w-4 h-4 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center text-[10px]">4</span>
                            <p className="text-yellow-400 font-bold">IMPORTANTE (No Celular):</p>
                            <p>Uma lista vai aparecer. <b>Role a tela para a direita</b> até ver o botão de <b>"Copy"</b> (Copiar).</p>
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute -left-[9px] top-0 w-4 h-4 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center text-[10px]">5</span>
                            <p>Copie a chave que começa com <code>AIza...</code> e volte aqui.</p>
                        </li>
                    </ol>

                    <input
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="Cole sua chave AIza... aqui"
                        className="w-full bg-black border border-gray-600 rounded-lg p-4 text-white focus:border-green-500 outline-none font-mono text-sm"
                    />

                    <button
                        onClick={handleSave}
                        disabled={!key || loading}
                        className={`w-full py-3 rounded-lg font-bold text-white transition-all flex items-center justify-center gap-2 ${key ? "bg-green-600 hover:bg-green-500" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
                    >
                        {loading ? "Salvando..." : <>Ativar Modo Turbo <CheckCircle className="w-4 h-4" /></>}
                    </button>
                </div>
            </div>
        </div>
    );
}