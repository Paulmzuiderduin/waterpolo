import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const VisitCounter = ({ siteKey = 'waterpolo' }) => {
  const [total, setTotal] = useState(null);

  useEffect(() => {
    let active = true;
    const mountKey = `__visit_counter_sent_${siteKey}`;

    const loadCounter = async () => {
      const hasSent = typeof window !== 'undefined' && window[mountKey];

      if (!hasSent) {
        try {
          if (typeof window !== 'undefined') window[mountKey] = true;
          const { data, error } = await supabase.rpc('increment_site_visit_total', {
            site_input: siteKey
          });
          if (!error && active) {
            setTotal(Number(data) || 0);
            return;
          }
        } catch {
          // Fall back to read-only load below.
        }
      }

      try {
        const { data, error } = await supabase
          .from('site_visit_totals')
          .select('total')
          .eq('site_key', siteKey)
          .maybeSingle();

        if (!error && data && active) {
          setTotal(Number(data.total) || 0);
        }
      } catch {
        // Keep the widget hidden if the counter cannot be loaded.
      }
    };

    loadCounter();
    return () => {
      active = false;
    };
  }, [siteKey]);

  if (total == null) return null;

  return (
    <div className="fixed bottom-20 left-4 z-[90] rounded-full border border-slate-200 bg-white/92 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur lg:bottom-6">
      Page views: {total.toLocaleString()}
    </div>
  );
};

export default VisitCounter;
