import React from 'react';
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  Wallet,
  SlidersHorizontal,
} from 'lucide-react';
import { AppBottomNav, AppBottomNavItem } from '../../../components/ui/AppBottomNav';

export type ProviderTabId = 'dashboard' | 'schedule' | 'bookings' | 'earnings' | 'management' | 'profile';

interface ProviderBottomNavProps {
  activeTab: string;
  onTabChange: (tabId: ProviderTabId) => void;
  bookingUpdatesCount?: number;
  showManagementAlert?: boolean;
}

export const ProviderBottomNav: React.FC<ProviderBottomNavProps> = ({
  activeTab,
  onTabChange,
  bookingUpdatesCount = 0,
  showManagementAlert = false,
}) => {
  const NAV_ITEMS: AppBottomNavItem<ProviderTabId>[] = [
    {
      id: 'dashboard',
      label: 'Início',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'schedule',
      label: 'Agenda',
      icon: <CalendarDays className="w-5 h-5" />,
    },
    {
      id: 'bookings',
      label: 'Aulas',
      icon: <Clock className="w-5 h-5" />,
      showBadge: bookingUpdatesCount > 0,
    },
    {
      id: 'earnings',
      label: 'Ganhos',
      icon: <Wallet className="w-5 h-5" />,
    },
    {
      id: 'management',
      label: 'Gestão',
      icon: <SlidersHorizontal className="w-5 h-5" />,
      showBadge: showManagementAlert,
    },
  ];

  return <AppBottomNav ariaLabel="Navegação principal" activeId={activeTab as ProviderTabId} items={NAV_ITEMS} onChange={onTabChange} />;
};
