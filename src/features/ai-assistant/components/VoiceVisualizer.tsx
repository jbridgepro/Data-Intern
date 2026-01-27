/**
 * File: src/features/ai-assistant/components/VoiceVisualizer.tsx
 *
 * Advanced Voice Visualizer ("The Orb").
 * Renders a dynamic, multi-layered orb animation that reacts to audio levels and voice state.
 */

import { useEffect, useRef } from "react";
import type { VoiceState } from "../voice/types";

interface VoiceVisualizerProps {
  state: VoiceState;
  audioLevel: number;
  width?: number;
  height?: number;
}

export const VoiceVisualizer = ({
  state,
  audioLevel,
  width = 400,
  height = 400,
}: VoiceVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const particlesRef = useRef<any[]>([]);

  useEffect(() => {
    particlesRef.current = new Array(50).fill(null).map(() => ({
      angle: Math.random() * Math.PI * 2,
      radius: 50 + Math.random() * 50,
      speed: 0.01 + Math.random() * 0.02,
      offset: Math.random() * Math.PI * 2,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    // We rely on the parent or CSS to set the display size, but here we set internal size
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let phase = 0;

    const render = () => {
      if (!canvas || !ctx) return;

      // Clear with trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; // Slight trail for "motion blur" feel? 
      // Actually standard clear is cleaner for the orb style
      ctx.clearRect(0, 0, width, height);
      
      const centerX = width / 2;
      const centerY = height / 2;

      // Animation parameters
      const isListening = state === "listening";
      const isSpeaking = state === "speaking";
      const isProcessing = state === "processing";
      
      // Dynamic color palette based on state
      // Using HSL for easier manipulation
      let hue = 220; // Blue (Idle)
      let saturation = 60;
      let lightness = 60;
      
      if (isListening) {
        hue = 200; // Cyan/Blue
        saturation = 90;
        lightness = 70;
      } else if (isSpeaking) {
        hue = 150; // Green/Emerald
        saturation = 80;
        lightness = 65;
      } else if (isProcessing) {
        hue = 270; // Purple
        saturation = 80;
        lightness = 70;
      }

      // Base radius breathing
      const breath = Math.sin(phase * 0.05) * 5;
      const audioImpulse = audioLevel * 100; // Scale up audio input
      
      // Draw Orb Layers
      
      // Layer 1: Core Glow
      const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 150);
      coreGradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness + 20}%, 0.8)`);
      coreGradient.addColorStop(0.2, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.4)`);
      coreGradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, 150 + audioImpulse * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = coreGradient;
      ctx.fill();

      // Layer 2: Dynamic Waves/Blobs
      // We simulate a "liquid" surface using sine waves on the radius
      ctx.save();
      ctx.translate(centerX, centerY);
      
      const numPoints = 100;
      ctx.beginPath();
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // Wave synthesis
        const wave1 = Math.sin(angle * 3 + phase * 0.05);
        const wave2 = Math.sin(angle * 5 - phase * 0.03);
        const wave3 = Math.sin(angle * 7 + phase * 0.02);
        
        // Combine waves
        const distortion = (wave1 + wave2 + wave3) * (5 + audioImpulse * 0.2);
        const r = 80 + breath + audioImpulse + distortion;
        
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      
      // Gradient for the liquid surface
      const surfaceGradient = ctx.createLinearGradient(-100, -100, 100, 100);
      surfaceGradient.addColorStop(0, `hsla(${hue - 20}, ${saturation}%, ${lightness}%, 0.8)`);
      surfaceGradient.addColorStop(1, `hsla(${hue + 20}, ${saturation}%, ${lightness}%, 0.8)`);
      
      ctx.fillStyle = surfaceGradient;
      ctx.fill();
      
      // Wireframe overlay for "tech" feel (optional, keeps it cleaner without usually)
      // ctx.strokeStyle = `hsla(${hue}, 90%, 90%, 0.3)`;
      // ctx.lineWidth = 1;
      // ctx.stroke();
      
      ctx.restore();

      // Layer 3: orbiting particles (for Processing state mostly)
      if (isProcessing || isSpeaking) {
         ctx.save();
         ctx.translate(centerX, centerY);
         // Faster rotation for processing
         const rotationSpeed = isProcessing ? 0.05 : 0.01;
         
         particlesRef.current.forEach((p, i) => {
             // Update angle
             p.angle += p.speed + rotationSpeed;
             
             // Draw particle
             const x = Math.cos(p.angle) * (p.radius + audioImpulse * 0.5);
             const y = Math.sin(p.angle) * (p.radius + audioImpulse * 0.5);
             
             ctx.beginPath();
             ctx.arc(x, y, 2, 0, Math.PI * 2);
             ctx.fillStyle = `hsla(${hue}, 100%, 90%, ${0.5 + Math.sin(phase * 0.1 + i) * 0.4})`;
             ctx.fill();
         });
         ctx.restore();
      }

      phase++;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state, audioLevel, width, height]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ width, height }} 
      className="max-w-full max-h-full pointer-events-none"
    />
  );
};
