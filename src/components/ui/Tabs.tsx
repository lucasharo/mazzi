import { ButtonBase } from './Button';
import React, { useId, useRef } from 'react';
import { PanelsTopLeft } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  hasPending?: boolean;
  icon?: React.ReactNode;
  panelId?: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'pills' | 'underline';
  className?: string;
  id?: string;
  ariaLabel?: string;
}

export function getTabId(tabListId: string, tabId: string) {
  return `${tabListId}-tab-${tabId}`;
}

export function getTabPanelId(tabListId: string, tabId: string) {
  return `${tabListId}-panel-${tabId}`;
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tabListId: string;
  tabId: string;
  activeTab: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ tabListId, tabId, activeTab, children, ...props }) => (
  <div
    id={getTabPanelId(tabListId, tabId)}
    role="tabpanel"
    aria-labelledby={getTabId(tabListId, tabId)}
    hidden={activeTab !== tabId}
    tabIndex={0}
    {...props}
  >
    {children}
  </div>
);

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  className = '',
  id,
  ariaLabel = 'Seções',
}) => {
  const generatedId = useId().replace(/:/g, '');
  const tabListId = id || `tabs-${generatedId}`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    onChange(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      id={tabListId}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={`flex items-center gap-1.5 p-1 select-none overflow-x-auto scrollbar-thin ${
        variant === 'pills'
          ? 'bg-slate-100/90 rounded-2xl'
          : 'border-b border-slate-200'
      } ${className}`}
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        return (
          <ButtonBase
            key={tab.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={getTabId(tabListId, tab.id)}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={tab.panelId || getTabPanelId(tabListId, tab.id)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`relative flex min-h-11 items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-yellow)] ${
              variant === 'pills'
                ? isActive
                  ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] font-extrabold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                : isActive
                ? 'text-amber-600 border-b-2 border-amber-500 rounded-none pb-2.5 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 rounded-none pb-2.5'
            }`}
          >
            <span aria-hidden="true" className="flex-shrink-0">
              {tab.icon || <PanelsTopLeft className="h-4 w-4" />}
            </span>
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            )}
            {tab.hasPending && (
              <>
                <span className="absolute right-1.5 top-1.5 z-10 h-3 w-3 rounded-full bg-rose-500" aria-hidden="true" />
                <span className="sr-only">Há pendência nesta seção</span>
              </>
            )}
          </ButtonBase>
        );
      })}
    </div>
  );
};
