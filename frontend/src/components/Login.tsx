"use client";

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, Loader2 } from 'lucide-react';

export default function Login() {
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        try {
            setLoading(true);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}`, // Volta para a página atual após login
                },
            });
            if (error) throw error;
        } catch (error) {
            alert('Erro ao fazer login com Google. Verifique o console.');
            console.error(error);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans text-white relative overflow-hidden">

            {/* Fundo Decorativo */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[100px]"></div>

            <div className="max-w-md w-full bg-gray-900/50 border border-gray-800 p-8 rounded-2xl backdrop-blur-xl shadow-2xl z-10 text-center space-y-8 animate-in fade-in zoom-in duration-500">

                <div className="space-y-2">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Sparkles className="w-8 h-8 text-black" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        NastIA Studio
                    </h1>
                    <p className="text-gray-400">Entre para começar a criar.</p>
                </div>

                <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full py-4 px-6 bg-white hover:bg-gray-100 text-black font-bold rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02]"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        // Ícone do Google SVG
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    )}
                    {loading ? "Conectando..." : "Entrar com Google"}
                </button>

                <p className="text-xs text-gray-600">
                    Ao entrar, você concorda com os termos de uso da NastIA.
                </p>
            </div>
        </div>
    );
}