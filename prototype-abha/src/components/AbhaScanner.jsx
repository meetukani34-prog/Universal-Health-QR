import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, ShieldCheck, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

export const ScanAuraButton = ({ onScan, isScanning, status }) => {
  return (
    <div className="relative group">
      {/* Scanning Ripple Overlay */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl pointer-events-none"
          />
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onScan}
        className={clsx(
          "relative min-w-[220px] px-8 py-4 rounded-full flex items-center justify-center gap-3",
          "text-white font-medium text-lg tracking-wide",
          "glass-card luminous-aura",
          isScanning ? "opacity-90" : "opacity-100",
          status === 'verified' ? "border-emerald-500/50" : "border-white/20"
        )}
      >
        <AnimatePresence mode="wait">
          {isScanning ? (
            <motion.div
              key="scanning"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            >
              <RefreshCw className="w-6 h-6 text-blue-400" />
            </motion.div>
          ) : status === 'verified' ? (
            <motion.div
              key="verified"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2"
            >
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <span>Identity Verified</span>
            </motion.div>
          ) : (
            <motion.div
              key="initial"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <Scan className="w-6 h-6 text-blue-400" />
              <span>Scan ABHA QR</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};
