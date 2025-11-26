"use client";

import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import {
    Download, Type, Square, Circle as CircleIcon,
    X, Trash2, Palette, Layers, MousePointer2,
    Sticker, Image as ImageIcon, Check
} from "lucide-react";

// --- CONFIGURAÇÃO DE ASSETS ---
const FONTS = ["Arial", "Times New Roman", "Courier New", "Impact", "Georgia", "Verdana"];
// Para um app real, carregaríamos Google Fonts aqui.

const STICKERS = ["🔥", "❤️", "✅", "⭐", "🚀", "💡", "🎉", "🇧🇷", "⚠️", "➡️"];
// Usando emojis como stickers para o MVP (são seguros e leves). 
// No futuro, trocaremos por URLs de imagens PNG transparentes.

interface ImageEditorProps {
    imageUrl: string;
    onClose: () => void;
}

export default function ImageEditor({ imageUrl, onClose }: ImageEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

    // Estado da Seleção
    const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);

    // Estado das Ferramentas
    const [activeTab, setActiveTab] = useState<"tools" | "stickers">("tools");
    const [color, setColor] = useState("#ffcc00");
    const [currentFont, setCurrentFont] = useState("Arial");

    // --- INICIALIZAÇÃO ---
    useEffect(() => {
        if (canvasRef.current && containerRef.current) {
            const canvas = new fabric.Canvas(canvasRef.current, {
                height: 500,
                width: 800,
                backgroundColor: "#1a1a1a",
                preserveObjectStacking: true,
            });

            setFabricCanvas(canvas);

            fabric.FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
                .then((img) => {
                    if (!img) return;
                    const scale = Math.min(
                        (canvas.width || 800) / (img.width || 1),
                        (canvas.height || 500) / (img.height || 1)
                    );
                    img.set({
                        scaleX: scale, scaleY: scale,
                        originX: "center", originY: "center",
                        left: (canvas.width || 800) / 2, top: (canvas.height || 500) / 2,
                        selectable: false, evented: false,
                    });
                    canvas.add(img);
                    canvas.sendObjectToBack(img);
                    canvas.renderAll();
                })
                .catch((err) => console.error("Erro imagem:", err));

            // Listeners de Seleção
            canvas.on("selection:created", (e) => updateSelection(e.selected ? e.selected[0] : null));
            canvas.on("selection:updated", (e) => updateSelection(e.selected ? e.selected[0] : null));
            canvas.on("selection:cleared", () => updateSelection(null));

            return () => { canvas.dispose(); };
        }
    }, [imageUrl]);

    const updateSelection = (obj: fabric.Object | null) => {
        setSelectedObject(obj);
        if (obj) {
            if (typeof obj.fill === 'string') setColor(obj.fill);
            // @ts-ignore
            if (obj.fontFamily) setCurrentFont(obj.fontFamily);
        }
    };

    // --- AÇÕES ---

    const addText = () => {
        if (!fabricCanvas) return;
        const text = new fabric.IText("Texto Aqui", {
            left: 100, top: 100,
            fontFamily: currentFont,
            fill: color,
            fontSize: 40, fontWeight: "bold",
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
    };

    const addRect = () => {
        if (!fabricCanvas) return;
        const rect = new fabric.Rect({
            left: 150, top: 150, fill: color, width: 100, height: 100, rx: 10, ry: 10
        });
        fabricCanvas.add(rect);
        fabricCanvas.setActiveObject(rect);
    };

    const addCircle = () => {
        if (!fabricCanvas) return;
        const circle = new fabric.Circle({
            left: 200, top: 200, fill: color, radius: 50
        });
        fabricCanvas.add(circle);
        fabricCanvas.setActiveObject(circle);
    };

    const addSticker = (emoji: string) => {
        if (!fabricCanvas) return;
        const text = new fabric.IText(emoji, {
            left: canvasRef.current!.width! / 2,
            top: canvasRef.current!.height! / 2,
            fontSize: 80,
            selectable: true
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
    };

    const deleteObject = () => {
        if (!fabricCanvas) return;
        const activeObj = fabricCanvas.getActiveObject();
        // @ts-ignore
        if (activeObj && !activeObj.isEditing) {
            fabricCanvas.remove(activeObj);
            fabricCanvas.discardActiveObject();
            fabricCanvas.requestRenderAll();
            setSelectedObject(null);
        }
    };

    // --- PROPRIEDADES ---

    const changeColor = (newColor: string) => {
        setColor(newColor);
        if (fabricCanvas && selectedObject) {
            selectedObject.set({ fill: newColor });
            fabricCanvas.requestRenderAll();
        }
    };

    const changeFont = (newFont: string) => {
        setCurrentFont(newFont);
        if (fabricCanvas && selectedObject && selectedObject.type === 'i-text') {
            // @ts-ignore
            selectedObject.set({ fontFamily: newFont });
            fabricCanvas.requestRenderAll();
        }
    };

    const bringToFront = () => {
        if (fabricCanvas && selectedObject) {
            fabricCanvas.bringObjectToFront(selectedObject);
            fabricCanvas.requestRenderAll();
        }
    };

    const handleDownload = () => {
        if (!fabricCanvas) return;
        const dataURL = fabricCanvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = "Nastia-Pro.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Delete" || e.key === "Backspace") deleteObject();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [fabricCanvas]);

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-in fade-in zoom-in duration-300 font-sans">

            {/* HEADER PRO */}
            <div className="h-16 bg-[#18181b] border-b border-gray-800 flex justify-between items-center px-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <span className="font-bold text-black text-sm">N</span>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">Editor NastIA</h3>
                        <p className="text-gray-500 text-xs">Modo Design</p>
                    </div>
                </div>

                {/* BARRA DE PROPRIEDADES (Só aparece se selecionar algo) */}
                {selectedObject ? (
                    <div className="flex items-center gap-3 bg-[#27272a] px-4 py-1.5 rounded-full border border-gray-700 shadow-xl animate-in slide-in-from-top-2">

                        {/* Cor */}
                        <div className="flex items-center gap-2 group relative">
                            <div className="w-6 h-6 rounded-full border border-gray-500 overflow-hidden cursor-pointer relative">
                                <input type="color" value={color} onChange={(e) => changeColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div style={{ backgroundColor: color }} className="w-full h-full"></div>
                            </div>
                        </div>

                        {/* Fonte (Só para texto) */}
                        {selectedObject.type === 'i-text' && (
                            <>
                                <div className="w-px h-6 bg-gray-600"></div>
                                <select
                                    value={currentFont}
                                    onChange={(e) => changeFont(e.target.value)}
                                    className="bg-transparent text-white text-xs outline-none cursor-pointer"
                                >
                                    {FONTS.map(f => <option key={f} value={f} className="text-black">{f}</option>)}
                                </select>
                            </>
                        )}

                        <div className="w-px h-6 bg-gray-600"></div>

                        <button onClick={bringToFront} className="p-1.5 hover:bg-gray-600 rounded-full transition-colors text-gray-300" title="Trazer para frente">
                            <Layers className="w-4 h-4" />
                        </button>
                        <button onClick={deleteObject} className="p-1.5 hover:bg-red-900/50 rounded-full transition-colors text-red-400" title="Excluir">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="text-gray-500 text-xs italic">Selecione um objeto para editar</div>
                )}

                <div className="flex gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">

                {/* BARRA LATERAL (MENU) */}
                <div className="w-20 bg-[#18181b] border-r border-gray-800 flex flex-col items-center py-6 gap-2 z-10">
                    <SideButton icon={<MousePointer2 />} label="Mover" active={activeTab === 'tools'} onClick={() => setActiveTab('tools')} />
                    <SideButton icon={<Sticker />} label="Adesivos" active={activeTab === 'stickers'} onClick={() => setActiveTab('stickers')} />

                    <div className="flex-1"></div>

                    <button
                        onClick={handleDownload}
                        className="mb-4 w-14 h-14 bg-white rounded-2xl flex flex-col items-center justify-center gap-1 hover:scale-105 transition-transform shadow-lg shadow-white/10"
                    >
                        <Download className="w-5 h-5 text-black" />
                        <span className="text-[9px] font-bold text-black">SALVAR</span>
                    </button>
                </div>

                {/* PAINEL SECUNDÁRIO (FERRAMENTAS) */}
                <div className="w-64 bg-[#202022] border-r border-gray-800 p-4 flex flex-col gap-4 overflow-y-auto">

                    {activeTab === 'tools' && (
                        <>
                            <h4 className="text-white font-bold text-sm mb-2">Básico</h4>
                            <ToolItem icon={<Type />} label="Adicionar Título" onClick={addText} />
                            <ToolItem icon={<Square />} label="Quadrado" onClick={addRect} />
                            <ToolItem icon={<CircleIcon />} label="Círculo" onClick={addCircle} />

                            <div className="mt-4 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                                <p className="text-yellow-200 text-xs">
                                    <span className="font-bold">Dica:</span> Use os cantos dos objetos para redimensionar.
                                </p>
                            </div>
                        </>
                    )}

                    {activeTab === 'stickers' && (
                        <>
                            <h4 className="text-white font-bold text-sm mb-2">Adesivos</h4>
                            <div className="grid grid-cols-4 gap-2">
                                {STICKERS.map(sticker => (
                                    <button
                                        key={sticker}
                                        onClick={() => addSticker(sticker)}
                                        className="aspect-square flex items-center justify-center text-2xl hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        {sticker}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                </div>

                {/* ÁREA DO CANVAS (PALCO) */}
                <div ref={containerRef} className="flex-1 bg-[#0f0f10] flex items-center justify-center relative overflow-auto p-12 bg-grid-pattern">
                    <div className="shadow-2xl shadow-black border border-gray-800 relative">
                        <canvas ref={canvasRef} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Componentes Visuais Menores
function SideButton({ icon, label, onClick, active }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all w-16 group ${active ? "bg-[#27272a] text-white" : "text-gray-500 hover:text-gray-300"
                }`}
        >
            {React.cloneElement(icon, { size: 24, className: active ? "text-yellow-500" : "group-hover:text-white transition-colors" })}
            <span className="text-[10px] font-medium">{label}</span>
        </button>
    )
}

function ToolItem({ icon, label, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 p-3 bg-[#27272a] hover:bg-[#3f3f46] rounded-xl text-gray-200 transition-all text-left group"
        >
            <div className="p-2 bg-black/20 rounded-lg group-hover:bg-black/40 text-yellow-500">
                {React.cloneElement(icon, { size: 18 })}
            </div>
            <span className="text-sm font-medium">{label}</span>
        </button>
    )
}