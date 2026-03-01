import React from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';

const UtilityDock = ({ onRequestFeature, onAnalyticsPreferences }) => (
  <div className="fixed bottom-24 right-4 z-[115] flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl shadow-slate-900/10 backdrop-blur lg:bottom-6">
    <button
      className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
      onClick={onRequestFeature}
      type="button"
    >
      <Plus size={16} />
      Request feature
    </button>
    <button
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      onClick={onAnalyticsPreferences}
      type="button"
    >
      <SlidersHorizontal size={16} />
      Analytics preferences
    </button>
  </div>
);

export default UtilityDock;
