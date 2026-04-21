import React from 'react';
import { motion } from 'framer-motion';
import { User, Activity, Heart, Calendar, ArrowUpCircle } from 'lucide-react';
import { clsx } from 'clsx';

const Card = ({ children, title, icon: Icon, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8, y: 50, rotateX: 45 }}
    animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
    transition={{ 
      type: "spring", stiffness: 100, damping: 15, delay 
    }}
    className={clsx(
      "glass-card p-6 rounded-[2rem]",
      "flex flex-col gap-4 min-w-[280px]",
      "hover:bg-white/15 transition-all duration-300"
    )}
  >
    <div className="flex items-center gap-3 text-blue-400">
      <div className="p-2 bg-blue-500/10 rounded-xl">
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-sm font-semibold uppercase tracking-widest opacity-60">
        {title}
      </span>
    </div>
    <div className="text-xl font-medium text-white/90">
      {children}
    </div>
  </motion.div>
);

export const CrystallizedDashboard = ({ data }) => {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
      <Card title="Patient Identity" icon={User} delay={0.1}>
        <div className="flex flex-col">
          <span className="text-2xl font-bold">{data.full_name}</span>
          <span className="text-blue-400 font-mono text-base">{data.abha_address}</span>
        </div>
      </Card>

      <Card title="Clinical Profile" icon={Activity} delay={0.2}>
        <div className="flex flex-wrap gap-2">
          {data.chronic_conditions.map((c, i) => (
            <span key={i} className="px-3 py-1 bg-white/5 rounded-full text-sm border border-white/10 uppercase tracking-tighter">
              {c}
            </span>
          ))}
        </div>
      </Card>

      <Card title="Vital Metrics" icon={Heart} delay={0.3}>
        <span className="text-4xl font-black text-rose-400">{data.blood_group}</span>
        <span className="ml-2 opacity-50">Blood Group</span>
      </Card>

      <Card title="Care History" icon={Calendar} delay={0.4}>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{data.last_vaccination_date}</span>
        </div>
        <span className="text-xs uppercase opacity-40">Last Vaccination</span>
      </Card>

      <Card title="Ingestion Pulse" icon={ArrowUpCircle} delay={0.5}>
        <div className="text-emerald-400 font-mono text-xs">
          SYNCED_{new Date(data.ingestion_at).getTime()}
        </div>
        <span className="text-xs uppercase opacity-40">Blockchain Verified Timestamp</span>
      </Card>
    </div>
  );
};
