import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, X, Headphones } from "lucide-react";
import axios from "axios";
import { supabase } from "../lib/supabase";

interface Props {
    userId: string;
    userName: string;
}

export default function SupportWidget({ userId, userName }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [msg, setMsg] = useState("");
    const [history, setHistory] = useState<any[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Carrega histórico e ouve novas mensagens (Respostas do suporte)
    useEffect(() => {
        if (isOpen) {
            const fetchMsgs = async () => {
                const { data } = await supabase.from('support_messages').select('*').eq('user_id', userId).order('created_at', { ascending: true });
                if (data) setHistory(data);
            };
            fetchMsgs();

            const channel = supabase.channel('support_chat')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `user_id=eq.${userId}` }, (payload) => {
                    setHistory(prev => [...prev, payload.new]);
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [isOpen, userId]);

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, isOpen]);

    const sendMessage = async () => {
        if (!msg.trim()) return;
        const text = msg;
        setMsg("");

        // 1. Salva no Supabase (Para aparecer na tela)
        await supabase.from('support_messages').insert({ user_id: userId, message: text, sender: 'user' });

        // 2. Envia para o n8n (Para chegar no seu WhatsApp)
        // Substitua pela URL do seu Webhook do n8n
        try {
            await axios.post("SUA_URL_DO_N8N_AQUI", {
                user_id: userId,
                name: userName,
                message: text,
                timestamp: new Date().toISOString()
            });
        } catch (e) { console.error("Erro ao enviar para n8n", e); }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
            {isOpen && (
                <div className="bg-[#18181b] border border-gray-700 w-80 h-96 rounded-2xl shadow-2xl mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
                    <div className="bg-purple-900/20 p-3 border-b border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Headphones className="w-4 h-4 text-purple-400" />
                            <span className="font-bold text-white text-sm">Suporte NastIA</span>
                        </div>
                        <button onClick={() => setIsOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
                    </div>

                    <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#121214]">
                        {history.length === 0 && <p className="text-xs text-gray-500 text-center mt-4">Envie uma mensagem. Respondemos em breve.</p>}
                        {history.map((m) => (
                            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-xl p-2 text-xs ${m.sender === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                                    {m.message}
                                </div>
                            </div>
                        ))}
                        <div ref={scrollRef} />
                    </div>

                    <div className="p-3 border-t border-gray-700 flex gap-2 bg-[#18181b]">
                        <input
                            className="flex-1 bg-black border border-gray-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                            placeholder="Como podemos ajudar?"
                            value={msg}
                            onChange={e => setMsg(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        />
                        <button onClick={sendMessage} className="bg-purple-600 p-2 rounded-lg text-white hover:bg-purple-500"><Send className="w-4 h-4" /></button>
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center"
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
            </button>
        </div>
    );
}