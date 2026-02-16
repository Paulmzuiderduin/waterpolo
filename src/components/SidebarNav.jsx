import React from 'react';

const SidebarNav = ({
  selectedSeasonName,
  navItems,
  activeTab,
  onSelectTab,
  onSwitchTeam,
  onSignOut
}) => (
  <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col border-r border-slate-200 bg-white p-6 shadow-sm lg:flex">
    <div className="mb-10">
      <p className="text-xl font-black uppercase italic tracking-tight text-slate-900">
        Waterpolo <span className="text-cyan-700">Hub</span>
      </p>
      <p className="text-xs text-slate-500">{selectedSeasonName}</p>
    </div>
    <nav className="flex flex-col gap-2">
      {navItems.map((item) => (
        <button
          key={item.key}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
            activeTab === item.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => onSelectTab(item.key)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
    <div className="mt-auto space-y-2">
      <button
        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"
        onClick={onSwitchTeam}
      >
        Switch team
      </button>
      <button
        className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        onClick={onSignOut}
      >
        Sign out
      </button>
    </div>
  </aside>
);

export default SidebarNav;
