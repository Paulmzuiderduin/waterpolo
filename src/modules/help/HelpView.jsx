import React from 'react';
import StatTooltipLabel from '../../components/StatTooltipLabel';

const HELP_TOOLTIPS = {
  goal: 'A shot with outcome "Goal" that results in a score.',
  saved: 'A shot blocked or stopped by the goalkeeper/defense.',
  miss: 'A shot that does not result in a goal and is not saved.',
  penalty: 'Penalty shot event marked with a square P marker.',
  seasonTeam: 'All data is scoped to the selected season + team folder.',
  editShot: 'Open a shot from the list, change details, then save.',
  playerDelete: 'Deleting a player does not remove historical shots/events.',
  reportScope: 'Report cards only include selected seasons and matches.'
};

const HelpView = ({ showTooltips = true }) => (
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
          <a
            href="/docs/waterpolo-quickstart.html"
            className="mt-4 inline-block text-xs font-semibold text-cyan-700 underline"
            target="_blank"
            rel="noreferrer"
          >
            Open quickstart guide (3 minutes)
          </a>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Legend</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <StatTooltipLabel label="Goal" tooltip={HELP_TOOLTIPS.goal} enabled={showTooltips} />
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-orange-400" />
              <StatTooltipLabel label="Saved" tooltip={HELP_TOOLTIPS.saved} enabled={showTooltips} />
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <StatTooltipLabel label="Miss" tooltip={HELP_TOOLTIPS.miss} enabled={showTooltips} />
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-sm bg-slate-900" />
              <StatTooltipLabel
                label="Penalty shot (P marker)"
                tooltip={HELP_TOOLTIPS.penalty}
                enabled={showTooltips}
              />
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
              <div className="font-semibold text-slate-700">
                <StatTooltipLabel
                  label="Why don’t I see my players?"
                  tooltip={HELP_TOOLTIPS.seasonTeam}
                  enabled={showTooltips}
                />
              </div>
              Make sure you selected the correct season and team folder.
            </div>
            <div>
              <div className="font-semibold text-slate-700">
                <StatTooltipLabel
                  label="Can I change a shot?"
                  tooltip={HELP_TOOLTIPS.editShot}
                  enabled={showTooltips}
                />
              </div>
              Yes. Click a shot in the list, edit details, and save.
            </div>
            <div>
              <div className="font-semibold text-slate-700">
                <StatTooltipLabel
                  label="What happens if I delete a player?"
                  tooltip={HELP_TOOLTIPS.playerDelete}
                  enabled={showTooltips}
                />
              </div>
              Shots remain; the cap number keeps the historical data intact.
            </div>
            <div>
              <div className="font-semibold text-slate-700">
                <StatTooltipLabel
                  label="Why are some matches missing in reports?"
                  tooltip={HELP_TOOLTIPS.reportScope}
                  enabled={showTooltips}
                />
              </div>
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
