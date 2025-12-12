"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, Zap } from "lucide-react";

export default function Login() {
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}`,
                },
            });
            if (error) throw error;
        } catch (error: any) {
            alert(error.message || "Erro ao fazer login");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px]"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[128px]"></div>

            <div className="w-full max-w-md bg-[#121214] border border-gray-800 rounded-3xl p-8 shadow-2xl relative z-10 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg transform rotate-3">
                    <Zap className="w-8 h-8 text-black fill-black" />
                </div>

                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">NastIA Studio</h1>
                <p className="text-gray-400 mb-8">Sua suíte criativa de Inteligência Artificial.</p>

                <div className="space-y-4">
                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5" />
                        )}
                        {loading ? "Conectando..." : "Continuar com Google"}
                    </button>
                    <p className="text-xs text-gray-500 mt-4">
                        Ao continuar, você aceita nossos Termos de Uso e Política de Privacidade.
                    </p>
                </div>
            </div>
        </div>
    );
}