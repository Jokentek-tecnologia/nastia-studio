"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { MessageCircle, X, Send, Sparkles, User, Bot, Copy, ArrowUpRight } from "lucide-react";

interface ChatWidgetProps {
    onApplyPrompt: (text: string) => void;
}

type Message = {
    role: "user" | "model";
    text: string;
};

// NOVAS PERSONAS ADICIONADAS
const PERSONAS = [
    { id: "criativo", name: "🎨 Arte", desc: "Direção Visual" },
    { id: "copy", name: "✍️ Copy", desc: "Legendas e Roteiros" },
    { id: "trafego", name: "📈 Tráfego", desc: "Anúncios Pagos" },
    { id: "social", name: "📅 Social", desc: "Planejamento" },
    { id: "seo", name: "🔍 SEO", desc: "Palavras-chave" },
    { id: "vendas", name: "💰 Vendas", desc: "Estratégia de Funil" },
];

export default function ChatWidget({ onApplyPrompt }: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [persona, setPersona] = useState("criativo");
    const [messages, setMessages] = useState<Message[]>([
        { role: "model", text: "Olá! Sou seu time de marketing completo. Escolha um especialista acima e vamos trabalhar!" }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { role: "user" as const, text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const historyPayload = messages.concat(userMsg).map(m => ({
                role: m.role,
                parts: m.text
            }));

            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
                history: historyPayload,
                persona: persona
            });

            setMessages(prev => [...prev, { role: "model", text: res.data.response }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: "model", text: "Tive um bloqueio criativo. Tente novamente." }]);
        } finally {
            setLoading(false);
        }
    };

    // Função inteligente para extrair apenas o prompt
    const extractPrompt = (text: string) => {
        // Procura onde começa o "PROMPT:" e pega o que vem depois
        const parts = text.split("PROMPT:");
        if (parts.length > 1) {
            return parts[1].trim(); // Retorna só o prompt limpo
        }
        return text; // Fallback
    };

    // Verifica se a mensagem TEM um prompt para mostrar o botão
    const hasPrompt = (text: string) => {
        return text.includes("PROMPT:");
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full shadow-2xl flex items-center justify-center text-black hover:scale-110 transition-transform z-50 group"
            >
                <MessageCircle className="w-7 h-7 group-hover:animate-pulse" />
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-[#050505]"></span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-[#18181b] border border-gray-700 rounded-2xl shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom-10 font-sans overflow-hidden">

            <div className="p-4 bg-[#27272a] border-b border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-500">
                        <Bot className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">Agência NastIA</h3>
                        <p className="text-[10px] text-gray-400">Time de Especialistas</p>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-2 bg-[#0f0f10] border-b border-gray-800 flex gap-1 overflow-x-auto no-scrollbar">
                {PERSONAS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setPersona(p.id)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${persona === p.id
                                ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/30"
                                : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                            }`}
                    >
                        {p.name}
                    </button>
                ))}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0f0f10]">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === "user" ? "bg-gray-700" : "bg-blue-900/30 text-blue-400"}`}>
                            {msg.role === "user" ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        </div>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === "user"
                                ? "bg-gray-800 text-white rounded-tr-none"
                                : "bg-blue-900/10 border border-blue-900/30 text-gray-300 rounded-tl-none"
                            }`}>
                            <p className="whitespace-pre-wrap">{msg.text.replace("PROMPT:", "")}</p>

                            {/* BOTÃO CONDICIONAL: SÓ APARECE SE TIVER "PROMPT:" NA MENSAGEM */}
                            {msg.role === "model" && hasPrompt(msg.text) && (
                                <div className="mt-2 pt-2 border-t border-white/10 flex gap-2">
                                    <button
                                        onClick={() => onApplyPrompt(extractPrompt(msg.text))}
                                        className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-yellow-500/20 hover:bg-yellow-500/30 px-2 py-1.5 rounded text-yellow-500 transition-colors font-bold border border-yellow-500/20"
                                    >
                                        <ArrowUpRight className="w-3 h-3" /> Usar Prompt
                                    </button>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(extractPrompt(msg.text))}
                                        className="flex items-center gap-1 text-[10px] hover:text-white text-gray-500 transition-colors px-2"
                                        title="Copiar Texto"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 bg-blue-900/30 rounded-full flex items-center justify-center text-blue-400"><Sparkles className="w-4 h-4 animate-spin" /></div>
                        <div className="bg-blue-900/10 p-3 rounded-2xl rounded-tl-none text-xs text-gray-500 animate-pulse">Digitando...</div>
                    </div>
                )}
            </div>

            <div className="p-3 bg-[#18181b] border-t border-gray-700">
                <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder={`Fale com ${PERSONAS.find(p => p.id === persona)?.name}...`}
                        className="w-full bg-[#27272a] text-white text-sm rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:ring-1 focus:ring-yellow-500 resize-none h-12 scrollbar-hide"
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="absolute right-2 top-2 p-1.5 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}