import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanAuraButton } from './components/AbhaScanner';
import { CrystallizedDashboard } from './components/MedicalCards';
import { mockFetch } from './lib/mockSync';
import { RotateCcw, AlertTriangle } from 'lucide-react';

function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('latent'); // 'latent', 'syncing', 'verified', 'error'
  const [errorCount, setErrorCount] = useState(0);

  const handleScan = useCallback(async () => {
    if (isScanning) return;
    
    setIsScanning(true);
    setStatus('syncing');
    
    try {
      const result = await mockFetch();
      setData(result);
      setStatus('verified');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorCount(prev => prev + 1);
      // Reset error after 3s
      setTimeout(() => setStatus(prev => prev === 'error' ? 'latent' : prev), 3000);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning]);

  const handleReset = () => {
    setData(null);
    setStatus('latent');
    setErrorCount(0);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 overflow-hidden bg-[#0f172a]">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      {/* Main Layout */}
      <div className="z-10 w-full flex flex-col items-center gap-12">
        
        {/* Header / State Indicator */}
        <motion.div 
          className="text-center space-y-2"
          animate={{ opacity: status === 'syncing' ? 0.5 : 1 }}
        >
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white/40 text-sm font-semibold tracking-[0.3em] uppercase"
          >
            Zero-Gravity Health Identity Ingestion
          </motion.div>
          
          <h1 className="text-5xl font-black text-white/90 tracking-tighter">
            ABHA <span className="text-blue-500">Node</span> Ingestion
          </h1>
        </motion.div>

        {/* Action Center */}
        <div className="flex flex-col items-center gap-4">
          <ScanAuraButton 
            onScan={handleScan} 
            isScanning={isScanning} 
            status={status}
          />
          
          <AnimatePresence>
            {status === 'verified' && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={handleReset}
                className="flex items-center gap-2 text-white/40 hover:text-white/60 text-xs font-mono tracking-widest transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>PURGE_SESSION_VOID_STATE</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Dashboard Area (The Crystallization) */}
        <div className="w-full flex justify-center min-h-[400px]">
          <AnimatePresence mode="wait">
            {status === 'latent' && (
              <motion.div
                key="void"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-[3rem] w-full max-w-lg aspect-video h-[200px]"
              >
                <span className="text-white font-mono tracking-[0.5em] text-xs">LATENT_IDENTITY_VOID</span>
              </motion.div>
            )}

            {data && (
              <motion.div 
                key="dashboard"
                layout
                className="w-full flex justify-center"
              >
                <CrystallizedDashboard data={data} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Error Shake & Toast */}
      <AnimatePresence>
        {status === 'error' && (
          <motion.div
            key={`error-${errorCount}`}
            initial={{ x: 10, opacity: 0 }}
            animate={{ 
              x: [0, -10, 10, -10, 10, 0],
              opacity: 1
            }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-12 px-6 py-3 bg-red-500/20 backdrop-blur-xl border border-red-500/50 rounded-2xl flex items-center gap-3 text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
          >
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium">Handshake Rejected: Gravity-Shake Detected</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
