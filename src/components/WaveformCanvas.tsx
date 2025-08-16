import React, { useEffect, useRef } from "react";

type Props = { analyser: AnalyserNode | null; height?: number };

export default function WaveformCanvas({ analyser, height = 80 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);

  function draw() {
    const canvas = canvasRef.current;
    const a = analyser;
    if (!canvas || !a) return;
    if (!dataRef.current || dataRef.current.length !== a.fftSize) {
      dataRef.current = new Uint8Array(a.fftSize);
    }
    const data = dataRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    a.getByteTimeDomainData(data);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(91,140,255,0.9)";
    ctx.beginPath();
    const slice = w / data.length;
    let x = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += slice;
    }
    ctx.stroke();
    rafRef.current = requestAnimationFrame(draw);
  }

  useEffect(() => {
    if (!analyser) return;
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyser]);

  return <canvas ref={canvasRef} className="wave" height={height} />;
}

