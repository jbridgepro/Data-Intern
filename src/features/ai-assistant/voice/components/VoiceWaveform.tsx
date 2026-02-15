/**
 * File: src/features/ai-assistant/voice/components/VoiceWaveform.tsx
 *
 * Animated waveform visualization component for voice mode.
 * Uses Canvas API for smooth, performant animations.
 */

import { useEffect, useRef, memo } from "react";
import { cn } from "@/lib/utils";

interface VoiceWaveformProps {
  audioLevel: number; // 0-1
  isActive: boolean;
  state: "idle" | "listening" | "processing" | "speaking" | "waiting";
  className?: string;
}

const STATE_COLORS = {
  idle: { primary: "#64748b", secondary: "#94a3b8" },
  listening: { primary: "#ef4444", secondary: "#f87171" },
  processing: { primary: "#f59e0b", secondary: "#fbbf24" },
  speaking: { primary: "#10b981", secondary: "#34d399" },
  waiting: { primary: "#3b82f6", secondary: "#60a5fa" },
};

export const VoiceWaveform = memo(function VoiceWaveform({
  audioLevel,
  isActive,
  state,
  className,
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;
    const colors = STATE_COLORS[state];

    const drawWave = (
      amplitude: number,
      frequency: number,
      phase: number,
      color: string,
      lineWidth: number
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";

      for (let x = 0; x <= width; x++) {
        const y =
          centerY +
          Math.sin((x * frequency * Math.PI) / width + phase) *
            amplitude *
            height *
            0.3;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Calculate amplitude based on audio level and state
      const baseAmplitude = state === "idle" ? 0.1 : 0.2;
      const levelAmplitude = isActive ? audioLevel * 0.8 : 0;
      const amplitude = baseAmplitude + levelAmplitude;

      // Speed varies by state
      const speed =
        state === "processing" ? 0.08 : state === "speaking" ? 0.06 : 0.04;

      phaseRef.current += speed;

      // Draw 3 overlapping waves for depth
      drawWave(
        amplitude * 0.6,
        2,
        phaseRef.current,
        `${colors.secondary}40`,
        3
      );
      drawWave(
        amplitude * 0.8,
        2.5,
        phaseRef.current * 1.2,
        `${colors.secondary}60`,
        2
      );
      drawWave(amplitude, 3, phaseRef.current * 0.8, colors.primary, 2.5);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [audioLevel, isActive, state]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full h-16", className)}
      style={{ width: "100%", height: "64px" }}
    />
  );
});

export default VoiceWaveform;
