import React from 'react';

const HelpView = () => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-cyan-700">Help</p>
        <h2 className="text-2xl font-semibold">Getting Started & FAQ</h2>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Getting started</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Create a season and team on the Seasons & Teams screen.</li>
            <li>Add players in the Roster tab (photo optional).</li>
            <li>Create a match in Matches and start adding shots in Shotmap.</li>
            <li>Use Analytics for heatmaps and filters.</li>
            <li>Open Players for report cards and comparisons.</li>
          </ol>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Legend</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              Goal
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-orange-400" />
              Saved
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Miss
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-sm bg-slate-900" />
              Penalty shot (P marker)
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Heatmap colors use a viridis scale (low → high). Saved and Miss use the reversed scale.
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">FAQ</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div>
              <div className="font-semibold text-slate-700">Why don’t I see my players?</div>
              Make sure you selected the correct season and team folder.
            </div>
            <div>
              <div className="font-semibold text-slate-700">Can I change a shot?</div>
              Yes. Click a shot in the list, edit details, and save.
            </div>
            <div>
              <div className="font-semibold text-slate-700">What happens if I delete a player?</div>
              Shots remain; the cap number keeps the historical data intact.
            </div>
            <div>
              <div className="font-semibold text-slate-700">Why are some matches missing in reports?</div>
              Check the scope selector in the Players tab. You can include or exclude matches.
            </div>
            <div>
              <div className="font-semibold text-slate-700">Can I export a report?</div>
              Use “Export PDF” in the Players tab.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default HelpView;
