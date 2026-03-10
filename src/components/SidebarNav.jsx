import React from 'react';
import { BarChart2, ChevronsLeft, ChevronsRight, LogOut, MessageSquare, RefreshCcw } from 'lucide-react';

const SidebarNav = ({
  selectedSeasonName,
  navItems,
  activeTab,
  onSelectTab,
  onSwitchTeam,
  onRequestFeature,
  onAnalyticsPreferences,
  onSignOut,
  isCollapsed,
  onToggleCollapse
}) => (
  <aside
    className={`wp-surface wp-border fixed left-0 top-0 hidden h-full flex-col overflow-y-auto border-r shadow-sm transition-all duration-200 lg:flex ${
      isCollapsed ? 'w-20 p-3' : 'w-64 p-4'
    }`}
  >
    <div className={`${isCollapsed ? 'mb-4' : 'mb-6'}`}>
      <div
        className={`flex items-center ${
          isCollapsed ? 'flex-col justify-center gap-2' : 'justify-between'
        }`}
      >
        {isCollapsed ? (
          <img
            src="/logos/waterpolo-logo-light.png"
            alt="Waterpolo Hub"
            className="h-10 w-10 rounded-xl border border-slate-200 bg-white/90 p-0.5"
          />
        ) : (
          <div className="flex items-center gap-3">
            <img
              src="/logos/waterpolo-logo-light.png"
              alt="Waterpolo Hub"
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white/90 p-0.5"
            />
            <div>
              <p className="text-xl font-black uppercase italic tracking-tight text-slate-900">
                Waterpolo <span className="wp-primary-text">Hub</span>
              </p>
              <p className="text-xs text-slate-500">{selectedSeasonName}</p>
            </div>
          </div>
        )}
        <button
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>
    </div>
    {(() => {
      const primaryItems = navItems.filter((item) => !item.advanced);
      const advancedItems = navItems.filter((item) => item.advanced);

      const renderButton = (item) => (
        <button
          key={item.key}
          className={`flex items-center rounded-xl py-2.5 text-left text-sm font-semibold transition-colors ${
            activeTab === item.key ? 'wp-primary-bg text-white' : 'text-slate-600 hover:bg-slate-100'
          } ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'}`}
          title={isCollapsed ? item.label : undefined}
          onClick={() => onSelectTab(item.key)}
        >
          <span className="shrink-0">{item.icon}</span>
          {!isCollapsed && item.label}
        </button>
      );

      return (
        <nav className="flex flex-col gap-1.5">
          {primaryItems.map(renderButton)}
          {advancedItems.length > 0 && (
            <>
              {!isCollapsed && (
                <div className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Advanced Analysis
                </div>
              )}
              <div className="flex flex-col gap-1.5">{advancedItems.map(renderButton)}</div>
            </>
          )}
        </nav>
      );
    })()}
    <div className="mt-4 space-y-2 pb-1">
      <button
        className={`w-full rounded-xl border border-cyan-200 bg-cyan-50 py-2 text-sm font-semibold text-cyan-700 ${
          isCollapsed ? 'px-2' : 'px-4'
        }`}
        onClick={onRequestFeature}
        title="Request feature"
      >
        {isCollapsed ? <MessageSquare size={16} className="mx-auto" /> : 'Request feature'}
      </button>
      <button
        className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-sm font-semibold text-slate-700 ${
          isCollapsed ? 'px-2' : 'px-4'
        }`}
        onClick={onAnalyticsPreferences}
        title="Analytics preferences"
      >
        {isCollapsed ? <BarChart2 size={16} className="mx-auto" /> : 'Analytics preferences'}
      </button>
      <button
        className={`w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold ${
          isCollapsed ? 'px-2' : 'px-4'
        }`}
        onClick={onSwitchTeam}
        title="Switch team"
      >
        {isCollapsed ? <RefreshCcw size={16} className="mx-auto" /> : 'Switch team'}
      </button>
      <button
        className={`wp-primary-bg w-full rounded-xl py-2 text-sm font-semibold text-white ${
          isCollapsed ? 'px-2' : 'px-4'
        }`}
        onClick={onSignOut}
        title="Sign out"
      >
        {isCollapsed ? <LogOut size={16} className="mx-auto" /> : 'Sign out'}
      </button>
    </div>
  </aside>
);

export default SidebarNav;
