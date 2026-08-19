import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  SlidersHorizontal,
  User,
} from 'lucide-react';

export type ProviderTabId = 'dashboard' | 'schedule' | 'bookings' | 'management' | 'profile';

interface ProviderBottomNavProps {
  activeTab: string;
  onTabChange: (tabId: ProviderTabId) => void;
  pendingBookingsCount?: number;
}

interface NavItem {
  id: ProviderTabId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const ProviderBottomNav: React.FC<ProviderBottomNavProps> = ({
  activeTab,
  onTabChange,
  pendingBookingsCount = 0,
}) => {
  const NAV_ITEMS: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Início',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'schedule',
      label: 'Agenda',
      icon: <Calendar className="w-5 h-5" />,
    },
    {
      id: 'bookings',
      label: 'Aulas',
      icon: <Clock className="w-5 h-5" />,
      badge: pendingBookingsCount > 0 ? pendingBookingsCount : undefined,
    },
    {
      id: 'management',
      label: 'Gestão',
      icon: <SlidersHorizontal className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: 'Perfil',
      icon: <User className="w-5 h-5" />,
    },
  ];

  return (
    <nav
      aria-label="Navegação Principal MAZZI Pro"
      className="mazzi-bottom-nav grid grid-cols-5 gap-1 shadow-2xl"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`relative flex min-h-[52px] flex-col items-center justify-center rounded-2xl text-[10px] font-extrabold transition duration-150 active:scale-95 ${
              isActive
                ? 'text-[#202126]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span
              className={`relative mb-1 grid h-8 w-8 place-items-center rounded-xl transition ${
                isActive
                  ? 'bg-[#f6c945] text-[#202126] shadow-sm'
                  : 'bg-transparent text-slate-500'
              }`}
            >
              {item.icon}
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-[9px] font-black text-white ring-2 ring-white">
                  {item.badge}
                </span>
              )}
            </span>
            <span className="leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
