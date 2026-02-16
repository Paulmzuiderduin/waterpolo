import React from 'react';
import { Ellipsis } from 'lucide-react';

const MobileNav = ({
  activeTab,
  primaryItems,
  overflowItems,
  mobileMenuOpen,
  onSelectTab,
  onToggleMobileMenu,
  onCloseMobileMenu,
  onOpenPrivacy
}) => (
  <>
    <div className="wp-surface wp-border fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t p-2 lg:hidden">
      {primaryItems.map((item) => (
        <button
          key={item.key}
          className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
            activeTab === item.key ? 'wp-primary-text' : 'text-slate-500'
          }`}
          onClick={() => onSelectTab(item.key)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
      <button
        className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
          overflowItems.some((item) => item.key === activeTab) || activeTab === 'privacy'
            ? 'wp-primary-text'
            : 'text-slate-500'
        }`}
        onClick={onToggleMobileMenu}
      >
        <Ellipsis size={16} />
        More
      </button>
    </div>

    {mobileMenuOpen && (
      <div className="fixed inset-0 z-[60] lg:hidden">
        <button className="absolute inset-0 bg-slate-900/30" onClick={onCloseMobileMenu} />
        <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 shadow-2xl">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
          <div className="grid grid-cols-2 gap-2">
            {overflowItems.map((item) => (
              <button
                key={item.key}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  activeTab === item.key ? 'wp-primary-bg text-white' : 'bg-slate-100 text-slate-700'
                }`}
                onClick={() => onSelectTab(item.key)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            <button
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                activeTab === 'privacy' ? 'wp-primary-bg text-white' : 'bg-slate-100 text-slate-700'
              }`}
              onClick={onOpenPrivacy}
            >
              Privacy
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);

export default MobileNav;
