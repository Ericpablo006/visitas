"use client";

import { useRef, useState, useCallback } from "react";

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
  }, []);

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#101828";
    ctx.stroke();
    setEmpty(false);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={200}
        className="w-full touch-none rounded-lg border border-black/10 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted">{empty ? "Assine no campo acima com o dedo ou a caneta." : "Assinatura capturada."}</span>
        <button type="button" className="btn-secondary py-1.5 text-xs" onClick={clear}>
          Limpar
        </button>
      </div>
    </div>
  );
}
