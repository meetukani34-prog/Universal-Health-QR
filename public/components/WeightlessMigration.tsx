import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Patient {
  name: string;
  photo?: string;
  blood_group?: string;
}

interface PatientMigrationCardProps {
  patient: Patient;
  isMigrating: boolean;
}

/**
 * PatientMigrationCard - "Drifting" medical history cards
 * Features: Smooth elastic entry, data-stream particle animation, success glow
 */
export const PatientMigrationCard: React.FC<PatientMigrationCardProps> = ({ patient, isMigrating }) => {
  return (
    <AnimatePresence>
      {isMigrating && (
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.7, x: -150, y: 100, rotate: -10 }}
          animate={{
            opacity: 1,
            scale: 1,
            x: 0,
            y: 0,
            rotate: 0,
            transition: {
              type: "spring",
              stiffness: 80,
              damping: 10,
              mass: 0.9,
              restDelta: 0.001
            }
          }}
          exit={{ opacity: 0, scale: 0.9, y: -50 }}
          className="relative max-w-sm p-6 overflow-hidden bg-slate-900 shadow-xl rounded-3xl border border-white/5"
          style={{
            backdropFilter: 'blur(30px)',
            boxShadow: '0 20px 50px rgba(0, 92, 173, 0.15)'
          }}
        >
          {/* Subtle Back Glow */}
          <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full" />

          {/* Card Header */}
          <div className="relative flex items-center gap-4 mb-4">
            <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-full flex items-center justify-center font-bold text-white shadow-lg overflow-hidden">
              {patient.photo ? <img src={patient.photo} alt={patient.name} className="w-full h-full object-cover" /> : patient.name.charAt(0)}
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-white tracking-tight">{patient.name}</h3>
              <p className="text-white/40 text-[0.65rem] font-bold tracking-[0.2em] uppercase">SYNCING TO HOSPITAL CLOUD</p>
            </div>
          </div>

          {/* Medical Data Preview */}
          <div className="relative space-y-3">
             <div className="flex justify-between items-center text-xs">
                <span className="text-white/40">Blood Group</span>
                <span className="text-blue-400 font-bold">{patient.blood_group || '—'}</span>
             </div>
             <div className="flex justify-between items-center text-xs">
                <span className="text-white/40">Handshake Status</span>
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-emerald-400 font-bold"
                >
                  SECURE SYNC
                </motion.span>
             </div>
          </div>

          {/* Success Glow Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_#4ade80]"
          />

          {/* Data-Stream Animation (Particles moving from card) */}
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-20 flex justify-end gap-1 opacity-40 pointer-events-none">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ x: [0, 60], opacity: [1, 0] }}
                transition={{ duration: 1, delay: i * 0.2, repeat: Infinity, ease: 'linear' }}
                className="w-1 h-1 bg-emerald-400 rounded-full"
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
