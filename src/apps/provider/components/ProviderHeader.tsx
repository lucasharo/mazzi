import React from 'react';
import {
  Building2,
  UserCheck,
} from 'lucide-react';
import { Provider, UserRole } from '../../../types';
import { AppHomeHeader } from '../../../components/ui/AppHomeHeader';

interface ProviderHeaderProps {
  currentProvider?: Provider;
  currentRole: UserRole;
  userName?: string;
  onOpenNotifications: () => void;
  onRefreshWorkspace: () => void;
  isRefreshing?: boolean;
}

export const ProviderHeader: React.FC<ProviderHeaderProps> = ({
  currentProvider,
  currentRole,
  userName,
  onOpenNotifications,
  onRefreshWorkspace,
  isRefreshing,
}) => {
  const providerName = currentProvider?.name || userName || 'Instrutor';
  const isSchool = currentProvider?.type === 'DRIVING_SCHOOL' || currentRole === 'SCHOOL_STAFF';

  return (
    <header className="bg-transparent text-[var(--mazzi-dark)]">
      <div className="mazzi-provider-content mx-auto w-full max-w-[680px] px-5 pt-5 sm:px-7 lg:max-w-[760px]">
        <AppHomeHeader
          eyebrow={isSchool ? 'Autoescola / CFC' : 'Instrutor MAZZI'}
          eyebrowIcon={isSchool ? <Building2 className="h-3 w-3" aria-hidden="true" /> : <UserCheck className="h-3 w-3" aria-hidden="true" />}
          title={`Olá, ${userName?.split(' ')[0] || providerName}`}
          subtitle="Gerencie sua operação e acompanhe suas aulas."
          onOpenNotifications={onOpenNotifications}
          onRefresh={onRefreshWorkspace}
          isRefreshing={isRefreshing}
          appContext="PRO"
        />
      </div>
    </header>
  );
};
