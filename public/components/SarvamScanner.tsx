import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface SarvamScannerProps {
  onScanSuccess?: (data: string) => void;
}

/**
 * SarvamScanner - High-fidelity QR scanner overlay
 * Features: Glowing scanning beam, minimalist design, haptic feedback integration
 */
export const SarvamScanner: React.FC<SarvamScannerProps> = ({ onScanSuccess }) => {
  const controls = useAnimation();

  useEffect(() => {
    // Infinite loop for the glowing scanning beam
    controls.start({
      top: ['0%', '100%', '0%'],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    });

    // Simulate haptic feedback on component mount (optional, depends on trigger)
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [controls]);

  return (
    <div className="sarvam-scanner-container relative w-full max-w-sm aspect-square bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
      {/* The Glowing Beam */}
      <motion.div
        animate={controls}
        className="absolute left-0 w-full h-1 z-20"
        style={{
          background: 'linear-gradient(90deg, transparent, #00f2fe, #00f2fe, transparent)',
          boxShadow: '0 0 15px #00f2fe, 0 0 30px #00f2fe'
        }}
      />

      {/* Scanner Viewfinder Corners */}
      <div className="absolute inset-10 border-2 border-white/20 rounded-3xl pointer-events-none">
        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />
      </div>

      {/* Decorative Particle Stream UI */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: 400, x: Math.random() * 300, opacity: 0 }}
            animate={{ y: -100, opacity: [0, 1, 0] }}
            transition={{ duration: 3, delay: i * 0.5, repeat: Infinity, ease: "linear" }}
            className="absolute w-px h-10 bg-cyan-400"
          />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-12 text-center text-cyan-400/70 text-[0.65rem] font-bold tracking-[0.3em] uppercase">
        Scanning Quantum Identity
      </div>
    </div>
  );
};
