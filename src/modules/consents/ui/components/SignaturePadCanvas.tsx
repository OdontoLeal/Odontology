// src/modules/consents/ui/components/SignaturePadCanvas.tsx
import React, { useRef, useState, useEffect } from 'react';
import { Button } from '../../../../shared/ui/components/Button';

export interface SignaturePadCanvasProps {
  onSaveSignature: (dataUrl: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
}

export const SignaturePadCanvas: React.FC<SignaturePadCanvasProps> = ({
  onSaveSignature,
  onClear,
  width = 600,
  height = 240,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onClear?.();
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSaveSignature(dataUrl);
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl border-2 border-dashed border-[#CBD2D9] bg-white p-2 touch-none overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-[220px] cursor-crosshair block"
        />

        {/* Guía visual de firma */}
        <div className="pointer-events-none absolute bottom-8 left-8 right-8 border-b border-[#CBD2D9] flex items-center justify-between text-[11px] text-[#8F99A3]">
          <span>Firme con el dedo o lápiz óptico sobre la línea</span>
          <span>✕ Firma del Paciente / Acudiente</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={handleClear}
          disabled={!hasDrawn}
        >
          Borrar Firma
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={handleConfirm}
          disabled={!hasDrawn}
          leftIcon={<span>✓</span>}
        >
          Guardar Firma
        </Button>
      </div>
    </div>
  );
};
