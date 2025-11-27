"use client";

import React, { useRef, useEffect, useState } from "react";
import { Play } from "lucide-react";

interface AdPlayerProps {
    src: string;
    onEnded: () => void;
}

export default function AdPlayer({ src, onEnded }: AdPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasError, setHasError] = useState(false);
    const [needsInteraction, setNeedsInteraction] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Tenta iniciar o vídeo automaticamente
        const playPromise = video.play();

        if (playPromise !== undefined) {
            playPromise.catch((error) => {
                console.log("Autoplay bloqueado pelo navegador (comportamento normal mobile):", error);
                // Se bloquear, avisamos que precisa de um toque do usuário
                setNeedsInteraction(true);
            });
        }
    }, [src]);

    const handleManualPlay = () => {
        if (videoRef.current) {
            videoRef.current.play();
            setNeedsInteraction(false);
        }
    };

    if (hasError) {
        // Fallback se o vídeo falhar totalmente
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <p className="text-yellow-500 animate-pulse font-bold">Processando sua arte...</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-black">
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full object-cover opacity-60"
                muted
                playsInline // CRÍTICO PARA IOS
                webkit-playsinline="true" // CRÍTICO PARA IOS ANTIGO
                onEnded={onEnded}
                onError={() => setHasError(true)}
            />

            {/* Botão de "Toque para assistir" caso o celular bloqueie o autoplay */}
            {needsInteraction && (
                <button
                    onClick={handleManualPlay}
                    className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 text-white cursor-pointer hover:bg-black/50 transition-colors"
                >
                    <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mb-4 shadow-lg animate-bounce">
                        <Play className="w-8 h-8 text-black fill-black ml-1" />
                    </div>
                    <p className="font-bold text-lg">Toque para ver o progresso</p>
                </button>
            )}
        </div>
    );
}