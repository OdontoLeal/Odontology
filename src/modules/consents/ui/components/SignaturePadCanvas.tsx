// src/modules/consents/ui/components/SignaturePadCanvas.tsx
// RF-CON-002 / RQNF-COM-002: lienzo de firma 100% fluido. El tamaño interno del <canvas>
// se recalcula con ResizeObserver (y la densidad de píxeles del dispositivo) sin perder el
// trazo ni la proporción; `touch-action: none` evita que la página se desplace al firmar.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../../shared/ui/components/Button';

export interface SignaturePadCanvasProps {
  onSaveSignature: (dataUrl: string) => void;
  onClear?: () => void;
  /** Proporción ancho / alto del lienzo (por defecto 5:2). */
  aspectRatio?: number;
  /** Alto mínimo en px CSS para que siempre haya espacio cómodo para firmar. */
  minHeight?: number;
}

type Point = { x: number; y: number };

export const SignaturePadCanvas: React.FC<SignaturePadCanvasProps> = ({
  onSaveSignature,
  onClear,
  aspectRatio = 5 / 2,
  minHeight = 180,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Trazos en coordenadas normalizadas (0..1) para redibujar al cambiar de tamaño.
  const strokesRef = useRef<Point[][]>([]);
  const isDrawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const setupContext = (ctx: CanvasRenderingContext2D, dpr: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setupContext(ctx, dpr);
    for (const stroke of strokesRef.current) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * w, stroke[0].y * h);
      if (stroke.length === 1) {
        ctx.lineTo(stroke[0].x * w + 0.01, stroke[0].y * h);
      }
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x * w, stroke[i].y * h);
      }
      ctx.stroke();
    }
  }, []);

  // Ajusta el tamaño interno del canvas al ancho real del contenedor.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const resize = () => {
      const cssWidth = wrapper.clientWidth;
      if (cssWidth <= 0) return;
      const cssHeight = Math.max(minHeight, Math.round(cssWidth / aspectRatio));
      const dpr = window.devicePixelRatio || 1;
      canvas.style.height = `${cssHeight}px`;
      const nextW = Math.round(cssWidth * dpr);
      const nextH = Math.round(cssHeight * dpr);
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
        redraw();
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    window.addEventListener('orientationchange', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', resize);
    };
  }, [aspectRatio, minHeight, redraw]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    strokesRef.current.push([getPoint(e)]);
    isDrawingRef.current = true;
    setHasDrawn(true);
    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    if (!canvas || !ctx || !stroke) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const prev = stroke[stroke.length - 1];
    const next = getPoint(e);
    stroke.push(next);
    ctx.beginPath();
    ctx.moveTo(prev.x * w, prev.y * h);
    ctx.lineTo(next.x * w, next.y * h);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // el puntero ya fue liberado
    }
    isDrawingRef.current = false;
  };

  const handleClear = () => {
    strokesRef.current = [];
    isDrawingRef.current = false;
    redraw();
    setHasDrawn(false);
    onClear?.();
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    onSaveSignature(canvas.toDataURL('image/png'));
  };

  return (
    <div className="min-w-0 space-y-3">
      <div className="relative w-full max-w-full overflow-hidden rounded-2xl border-2 border-dashed border-[#CBD2D9] bg-white p-2 shadow-inner">
        <div ref={wrapperRef} className="w-full min-w-0">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Área de firma manuscrita. Firme con el dedo, lápiz óptico o mouse."
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
            className="block w-full max-w-full cursor-crosshair touch-none select-none"
          />
        </div>

        {/* Guía visual de firma */}
        <div className="pointer-events-none absolute bottom-6 left-4 right-4 flex flex-wrap items-end justify-between gap-x-3 border-b border-[#CBD2D9] pb-1 text-[13px] leading-5 text-[#687380] sm:left-8 sm:right-8">
          <span className="hidden sm:inline">Firme con el dedo o lápiz óptico sobre la línea</span>
          <span>✕ Firma del paciente / acudiente</span>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={!hasDrawn}
          className="min-h-[44px] min-w-[44px] w-full sm:w-auto"
        >
          Borrar firma
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleConfirm}
          disabled={!hasDrawn}
          leftIcon={<span aria-hidden="true">✓</span>}
          className="min-h-[44px] min-w-[44px] w-full sm:w-auto"
        >
          Guardar firma
        </Button>
      </div>
    </div>
  );
};
