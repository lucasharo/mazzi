// ============================================================================
// MAZZI PLATFORM — SPRINT 12: GOVERNANCE & OPERATIONS ADMIN CONTROL PANEL
// File: src/apps/admin/AdminApp.tsx
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import { dbService } from '../../lib/db-service';
import {
  Provider,
  ComplianceDocument,
  Vehicle,
  Booking,
  AuditLog,
  User,
  UserRole,
} from '../../types';
import {
  DEFAULT_PLATFORM_CONFIGURATION,
  PlatformConfiguration,
} from '../../domain/platform-config';
import { AuthContext } from '../../domain/rbac';
import {
  evaluateProviderEligibility,
  DEFAULT_COMPLIANCE_REQUIREMENTS,
} from '../../domain/compliance';

// Modular components import
import {
  DashboardTab,
  ProvidersTab,
  ComplianceTab,
  VehiclesTab,
  BookingsTab,
  FinancialTab,
  UsersTab,
  AuditTab,
  SettingsTab,
} from './AdminComponents';
import { AdminAnalyticsPanel } from '../../components/analytics/AnalyticsPanels';

export const AdminApp: React.FC = () => {
  const { user } = useAuth();

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Core Data States
  const [providers, setProviders] = useState<Provider[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfiguration>(DEFAULT_PLATFORM_CONFIGURATION);
  const [isLoadingRealData, setIsLoadingRealData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active Session Toggle (Interactive testing for PLATFORM_ADMIN vs SUPPORT)
  const [currentRole, setCurrentRole] = useState<UserRole>('PLATFORM_ADMIN');

  useEffect(() => {
    if (user?.roles && user.roles.length > 0) {
      setCurrentRole(user.roles[0]);
    }
  }, [user]);

  // Load live data from Supabase
  useEffect(() => {
    async function loadRealData() {
      setIsLoadingRealData(true);
      setLoadError(null);
      try {
        const [p, v, b, c, a, configs, u] = await Promise.all([
          dbService.getProviders(),
          dbService.getVehicles(),
          dbService.getBookings(),
          dbService.getComplianceDocs(),
          dbService.getAuditLogs(),
          dbService.getPlatformConfigs(),
          dbService.getUsers(),
        ]);
        setProviders(p);
        setVehicles(v);
        setBookings(b);
        setComplianceDocs(c);
        setAuditLogs(a);
        setUsers(u);
        
        if (configs.length > 0) {
          const mappedConfig = { ...DEFAULT_PLATFORM_CONFIGURATION };
          for (const item of configs) {
            if (item.key in mappedConfig) {
              (mappedConfig as any)[item.key] = item.value;
            }
          }
          setPlatformConfig(mappedConfig);
        }
      } catch (err: any) {
        console.error('Failed to load live database state in AdminApp:', err);
        setLoadError(err?.message || 'Falha ao carregar dados reais do Supabase para o Admin.');
      } finally {
        setIsLoadingRealData(false);
      }
    }
    loadRealData();
  }, [user]);

  // Resolved Session Context
  const activeActor: AuthContext = {
    userId: user?.id || 'AUTH_REQUIRED',
    email: user?.email || 'auth-required@mazzi.local',
    roles: [currentRole],
    status: 'ACTIVE',
  };

  // Helper eligibility evaluator
  const handleEligibilityCheck = (provider: Provider, docs: ComplianceDocument[]) => {
    return evaluateProviderEligibility(provider, docs, DEFAULT_COMPLIANCE_REQUIREMENTS);
  };

  const blockPendingAdminMutation = (action: string) => {
    alert(
      `${action} bloqueado na Sprint 12: esta operação precisa de RPC/endpoint transacional com RBAC, auditoria e persistência real no Supabase.`
    );
  };

  // ==========================================================================
  // PROVIDER STATE TRANSITIONS HANDLERS
  // ==========================================================================
  const handleApproveProvider = (_p: Provider) => {
    blockPendingAdminMutation('Aprovação de prestador');
  };

  const handleRejectProvider = (_p: Provider, _reason: string) => {
    blockPendingAdminMutation('Rejeição de prestador');
  };

  const handleSuspendProvider = (_p: Provider, _reason: string) => {
    blockPendingAdminMutation('Suspensão de prestador');
  };

  const handleBlockProvider = (_p: Provider, _reason: string) => {
    blockPendingAdminMutation('Bloqueio de prestador');
  };

  // ==========================================================================
  // COMPLIANCE DOCUMENTS HANDLERS
  // ==========================================================================
  const handleApproveDoc = (_doc: ComplianceDocument) => {
    blockPendingAdminMutation('Aprovação de documento');
  };

  const handleRejectDoc = (_doc: ComplianceDocument, _reason: string) => {
    blockPendingAdminMutation('Rejeição de documento');
  };

  // ==========================================================================
  // VEHICLE TRANSITION HANDLERS
  // ==========================================================================
  const handleApproveVehicle = (_v: Vehicle) => {
    blockPendingAdminMutation('Aprovação de veículo');
  };

  const handleRejectVehicle = (_v: Vehicle, _reason: string) => {
    blockPendingAdminMutation('Rejeição de veículo');
  };

  const handleBlockVehicle = (_v: Vehicle, _reason: string) => {
    blockPendingAdminMutation('Bloqueio de veículo');
  };

  // ==========================================================================
  // REFUND HANDLER
  // ==========================================================================
  const handleProcessRefund = (_b: Booking) => {
    blockPendingAdminMutation('Estorno administrativo');
  };

  // ==========================================================================
  // USER ROLE MANAGEMENT HANDLER
  // ==========================================================================
  const handleChangeRole = (_userId: string, _newRole: UserRole) => {
    blockPendingAdminMutation('Alteração de papel de usuário');
  };

  // ==========================================================================
  // PLATFORM CONFIGURATION UPDATE HANDLER
  // ==========================================================================
  const handleUpdateConfig = (_updates: Partial<PlatformConfiguration>) => {
    blockPendingAdminMutation('Alteração de configuração da plataforma');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 w-full">
      {/* Top Main Navigation Header */}
      <header className="bg-slate-950 text-white px-6 py-4.5 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black flex items-center justify-center text-xl shadow-md border border-amber-300/20">
            M
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-white">MAZZI</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                GOVERNANCE & OPS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Sprint 12 • Portal Administrativo Geral e Consolidação de Segurança
            </p>
          </div>
        </div>

        {/* PROFILE TOGGLE: INTERACTIVE DEMO TESTING (PLATFORM_ADMIN VS SUPPORT) */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-2xl shrink-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 hidden md:inline">
            Perfil Operador:
          </span>
          <div className="flex bg-slate-950 p-1 rounded-xl text-[11px] font-bold">
            <button
              onClick={() => setCurrentRole('PLATFORM_ADMIN')}
              className={`px-3 py-1.5 rounded-lg transition ${
                currentRole === 'PLATFORM_ADMIN'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ADMIN
            </button>
            <button
              onClick={() => setCurrentRole('SUPPORT')}
              className={`px-3 py-1.5 rounded-lg transition ${
                currentRole === 'SUPPORT'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SUPORTE
            </button>
          </div>
        </div>
      </header>

      {/* Tabs Menu Subheader */}
      <div className="px-6 py-2 border-b border-slate-200 bg-white overflow-x-auto flex gap-1 scrollbar-none shrink-0">
        {[
          { id: 'dashboard', label: 'Visão Geral' },
          { id: 'providers', label: 'Prestadores', count: providers.filter((p) => p.status === 'PENDING_REVIEW').length },
          { id: 'compliance', label: 'Compliance', count: complianceDocs.filter((d) => d.status === 'UNDER_REVIEW').length },
          { id: 'vehicles', label: 'Veículos', count: vehicles.filter((v) => v.status === 'UNDER_REVIEW').length },
          { id: 'bookings', label: 'Reservas' },
          { id: 'financial', label: 'Financeiro' },
          { id: 'analytics', label: 'Analytics' },
          { id: 'users', label: 'Usuários & Papéis' },
          { id: 'audit', label: 'Auditoria' },
          { id: 'settings', label: 'Configurações' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                isActive
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-amber-400 text-slate-950' : 'bg-rose-100 text-rose-700'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* App Workspace */}
      <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
        {isLoadingRealData && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
            Carregando dados reais do Supabase...
          </div>
        )}

        {loadError && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            Falha ao carregar Admin real: {loadError}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardTab
            providers={providers}
            complianceDocs={complianceDocs}
            vehicles={vehicles}
            bookings={bookings}
            auditLogs={auditLogs}
            onNavigate={(target) => setActiveTab(target)}
          />
        )}

        {activeTab === 'providers' && (
          <ProvidersTab
            providers={providers}
            complianceDocs={complianceDocs}
            vehicles={vehicles}
            auditLogs={auditLogs}
            actor={activeActor}
            onApprove={handleApproveProvider}
            onReject={handleRejectProvider}
            onSuspend={handleSuspendProvider}
            onBlock={handleBlockProvider}
            eligibilityChecker={handleEligibilityCheck}
          />
        )}

        {activeTab === 'compliance' && (
          <ComplianceTab
            complianceDocs={complianceDocs}
            actor={activeActor}
            onApproveDoc={handleApproveDoc}
            onRejectDoc={handleRejectDoc}
          />
        )}

        {activeTab === 'vehicles' && (
          <VehiclesTab
            vehicles={vehicles}
            providers={providers}
            onApproveVehicle={handleApproveVehicle}
            onRejectVehicle={handleRejectVehicle}
            onBlockVehicle={handleBlockVehicle}
          />
        )}

        {activeTab === 'bookings' && (
          <BookingsTab
            bookings={bookings}
            auditLogs={auditLogs}
          />
        )}

        {activeTab === 'financial' && (
          <FinancialTab
            bookings={bookings}
            auditLogs={auditLogs}
            actor={activeActor}
            onProcessRefund={handleProcessRefund}
          />
        )}

        {activeTab === 'analytics' && (
          <AdminAnalyticsPanel />
        )}

        {activeTab === 'users' && (
          <UsersTab
            users={users}
            actor={activeActor}
            onChangeRole={handleChangeRole}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTab
            auditLogs={auditLogs}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            config={platformConfig}
            actor={activeActor}
            onUpdateConfig={handleUpdateConfig}
          />
        )}
      </main>
    </div>
  );
};
