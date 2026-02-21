import React from 'react';
import { ChevronsLeft, ChevronsRight, LogOut, RefreshCcw } from 'lucide-react';

const SidebarNav = ({
  selectedSeasonName,
  navItems,
  activeTab,
  onSelectTab,
  onSwitchTeam,
  onSignOut,
  isCollapsed,
  onToggleCollapse
}) => (
  <aside
    className={`wp-surface wp-border fixed left-0 top-0 hidden h-full flex-col border-r shadow-sm transition-all duration-200 lg:flex ${
      isCollapsed ? 'w-20 p-3' : 'w-64 p-6'
    }`}
  >
    <div className={`${isCollapsed ? 'mb-6' : 'mb-10'}`}>
      <div
        className={`flex items-center ${
          isCollapsed ? 'flex-col justify-center gap-2' : 'justify-between'
        }`}
      >
        {isCollapsed ? (
          <p className="text-sm font-black uppercase tracking-tight text-slate-900">WP</p>
        ) : (
          <div>
            <p className="text-xl font-black uppercase italic tracking-tight text-slate-900">
              Waterpolo <span className="wp-primary-text">Hub</span>
            </p>
            <p className="text-xs text-slate-500">{selectedSeasonName}</p>
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
    <nav className="flex flex-col gap-2">
      {navItems.map((item) => (
        <button
          key={item.key}
          className={`flex items-center rounded-xl py-3 text-left text-sm font-semibold transition-colors ${
            activeTab === item.key ? 'wp-primary-bg text-white' : 'text-slate-600 hover:bg-slate-100'
          } ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'}`}
          title={isCollapsed ? item.label : undefined}
          onClick={() => onSelectTab(item.key)}
        >
          <span className="shrink-0">{item.icon}</span>
          {!isCollapsed && item.label}
        </button>
      ))}
    </nav>
    <div className="mt-auto space-y-2">
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
