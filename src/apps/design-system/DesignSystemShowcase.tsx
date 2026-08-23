import React, { useState } from 'react';
import { Bell, Car, Bike, ShieldCheck, Star, CheckCircle2, AlertTriangle, Clock, History, MapPin, Calendar as CalendarIcon, Calendar as CalendarClock, Calendar as CalendarRange, ChevronRight, Info, MessageSquare, XCircle, RotateCcw, Check, Search, SlidersHorizontal, ArrowLeft, Pencil, Trash, Plus, Building2, UserCheck, UserRound, UserPen, ClipboardList, CreditCard, RefreshCw, Ban, Send, Sparkles, Smartphone, Monitor, Copy, CheckCheck, FileCode, Layers, Palette, Type, ToggleLeft, Navigation as NavIcon, PackageOpen, Home, BookOpen, List, Map, } from 'lucide-react';
import { Button, PrimaryButton, SecondaryButton, ButtonBase } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { OtpInput } from '../../components/ui/OtpInput';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Rating } from '../../components/ui/Rating';
import { BookingCard } from '../../components/ui/BookingCard';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { AppHomeHeader } from '../../components/ui/AppHomeHeader';
import { AppPageHeader } from '../../components/ui/AppPageHeader';
import { AppBottomNav } from '../../components/ui/AppBottomNav';
import { IconButton } from '../../components/ui/IconButton';
import { ListEmptyState } from '../../components/ui/ListEmptyState';
import { ObjectEmptyState } from '../../components/ui/ObjectEmptyState';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { ContentSkeleton } from '../../components/ui/ContentSkeleton';
import { NotificationIndicator } from '../../components/ui/NotificationIndicator';
import { UniversalMap } from '../../components/maps/UniversalMap';
import { SearchHeader } from '../../components/search/SearchHeader';
import { FilterDrawer } from '../../components/search/FilterDrawer';
import { ProviderResultCard } from '../../components/search/ProviderResultCard';
import { MapView } from '../../components/search/MapView';
import { ProviderPublicProfileModal } from '../../components/search/ProviderPublicProfileModal';
import { ProfilePhotoPicker } from '../../components/profile/ProfilePhotoPicker';
import { BookingDetailsModal } from '../student/components/BookingDetailsModal';
import { SlotSelectorModal, addDays, type PublicSlot } from '../student/components/SlotSelectorModal';
import type { PublicSearchProviderResult, SearchRequest } from '../../types';
import { MOCK_BOOKINGS } from '../../data/mockData';

type SectionId =
  | 'foundations'
  | 'typography'
  | 'buttons'
  | 'icon-policy'
  | 'inputs'
  | 'otp'
  | 'chips'
  | 'badges'
  | 'cards'
  | 'alerts'
  | 'modals'
  | 'cancellation'
  | 'booking'
  | 'chat'
  | 'loading'
  | 'empty-states'
  | 'navigation'
  | 'mobile-patterns'
  | 'app-headers'
  | 'component-inventory'
  | 'student-reference';

interface Section {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
}

const SECTIONS: Section[] = [
  { id: 'foundations', label: '1. Foundations & Tokens', icon: <Palette className="w-4 h-4" /> },
  { id: 'typography', label: '2. Tipografia & Pesos', icon: <Type className="w-4 h-4" /> },
  { id: 'buttons', label: '3. Catálogo de Botões', icon: <ToggleLeft className="w-4 h-4" /> },
  { id: 'icon-policy', label: '4. Icon Usage Policy', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'inputs', label: '5. Formulários & Inputs', icon: <FileCode className="w-4 h-4" /> },
  { id: 'otp', label: '6. OTP (8-Dígitos)', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'chips', label: '7. Chips & Filtros', icon: <SlidersHorizontal className="w-4 h-4" /> },
  { id: 'badges', label: '8. Badges & Status', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'cards', label: '9. Cards de Domínio', icon: <Layers className="w-4 h-4" /> },
  { id: 'alerts', label: '10. Alertas & Banners', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'modals', label: '11. Modais & Dialogs', icon: <Layers className="w-4 h-4" /> },
  { id: 'cancellation', label: '13. Padrão de Cancelamento', icon: <XCircle className="w-4 h-4" /> },
  { id: 'booking', label: '14. Dias & Horários', icon: <CalendarIcon className="w-4 h-4" /> },
  { id: 'chat', label: '15. Componentes de Chat', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'loading', label: '16. Loading & Skeletons', icon: <Clock className="w-4 h-4" /> },
  { id: 'empty-states', label: '17. Empty & Error States', icon: <Info className="w-4 h-4" /> },
  { id: 'navigation', label: '18. Navegação & Tabs', icon: <NavIcon className="w-4 h-4" /> },
  { id: 'mobile-patterns', label: '19. Mobile Patterns (360-430px)', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'app-headers', label: '20. Headers dos Apps', icon: <Layers className="w-4 h-4" /> },
  { id: 'component-inventory', label: '21. Inventário Completo', icon: <PackageOpen className="w-4 h-4" /> },
  { id: 'student-reference', label: '22. Referência MAZZI Aluno', icon: <UserRound className="w-4 h-4" /> },
];

const COMPONENT_INVENTORY = [
  ['Ações', 'Button, ButtonBase, PrimaryButton, SecondaryButton, IconButton'],
  ['Formulários', 'Input, Select, OtpInput, Rating'],
  ['Conteúdo', 'Badge, StatusBadge, BookingCard'],
  ['Feedback', 'EmptyState, ErrorState, ListEmptyState, ObjectEmptyState, LoadingScreen'],
  ['Overlays', 'Modal'],
  ['Navegação', 'AppBottomNav, AppHomeHeader, AppPageHeader, NotificationIndicator'],
] as const;

const STUDENT_COMPONENT_INVENTORY = [
  ['Entrada e navegação', 'AppHomeHeader, AppPageHeader, AppBottomNav'],
  ['Busca', 'SearchHeader, FilterDrawer, ProviderResultCard, MapView, ProviderPublicProfileModal'],
  ['Aulas', 'BookingCard, BookingDetailsModal, SlotSelectorModal, CheckoutModal'],
  ['Relacionamento', 'BookingChatPanel, NotificationsPanel, ReviewModal'],
  ['Conta', 'ProfilePhotoPicker, formulário e resumo de perfil'],
] as const;

const STUDENT_SEARCH_RESULT: PublicSearchProviderResult = {
  providerId: 'design-system-provider',
  displayName: 'Carlos Alberto Silva',
  providerType: 'INSTRUCTOR',
  verificationBadge: 'Verificado pela plataforma',
  isVerified: true,
  ratingAverage: 4.9,
  ratingCount: 84,
  ratingSource: 'REAL',
  approximateDistanceKm: 1.8,
  roundedDistanceMeters: 1800,
  formattedDistance: '1,8 km',
  neighborhood: 'Pinheiros',
  city: 'São Paulo',
  categories: ['B'],
  transmissions: ['MANUAL'],
  startingPriceInCents: 9500,
  normalizedPricePerFiftyMinInCents: 9500,
  publicOfferings: [{
    id: 'design-system-offering',
    vehicleId: 'design-system-vehicle',
    vehicleTitle: 'Hyundai HB20 2025',
    vehicleType: 'CAR',
    category: 'B',
    transmission: 'MANUAL',
    photos: [],
    durationMinutes: 50,
    priceInCents: 9500,
  }],
  availableSlotCount: 8,
  availableResourceCount: 1,
  nextAvailableSlot: '2026-08-22T09:00:00-03:00',
  publicMapLocation: {
    latitude: -23.5614,
    longitude: -46.7016,
    type: 'NEIGHBORHOOD_CENTROID',
    label: 'Pinheiros, São Paulo',
  },
  rankingScore: 0.96,
};

const previewDateOnly = (() => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
})();

const DESIGN_SYSTEM_PREVIEW_SLOTS: PublicSlot[] = [
  [1, '09:00', '09:50'],
  [1, '10:00', '10:50'],
  [1, '14:00', '14:50'],
  [3, '08:00', '08:50'],
  [3, '16:00', '16:50'],
  [5, '18:30', '19:20'],
].map(([offset, start, end]) => {
  const date = addDays(previewDateOnly, Number(offset));
  return {
    local_date: date,
    local_start_time: String(start),
    local_end_time: String(end),
    slot_start_at: `${date}T${start}:00-03:00`,
    slot_end_at: `${date}T${end}:00-03:00`,
  };
});

export const DesignSystemShowcase: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('foundations');
  const [viewportWidth, setViewportWidth] = useState<'full' | '360' | '390' | '430'>('full');
  const [otpVal, setOtpVal] = useState('');
  const [inputVal, setInputVal] = useState('Av. Paulista, 1000 - Bela Vista');
  const [selectedChip, setSelectedChip] = useState('Imprevisto pessoal');
  const [isBasicModalOpen, setIsBasicModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [demoRating, setDemoRating] = useState(4);
  const [demoNav, setDemoNav] = useState<'home' | 'lessons' | 'profile'>('home');
  const [demoLessonTab, setDemoLessonTab] = useState<'today' | 'history'>('today');
  const [demoProLessonTab, setDemoProLessonTab] = useState<'all' | 'today' | 'upcoming' | 'history'>('today');
  const [isStudentSlotPreviewOpen, setIsStudentSlotPreviewOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState<SearchRequest>({
    latitude: -23.5614,
    longitude: -46.7016,
    radiusMeters: 10000,
    category: 'B',
    sortBy: 'RECOMMENDED',
  });
  const [studentPreviewTab, setStudentPreviewTab] = useState<'search' | 'bookings' | 'profile'>('search');
  const [studentViewMode, setStudentViewMode] = useState<'list' | 'map'>('list');
  const [studentProfilePhoto, setStudentProfilePhoto] = useState<string | undefined>();
  const [isStudentFilterOpen, setIsStudentFilterOpen] = useState(false);
  const [isStudentProfileOpen, setIsStudentProfileOpen] = useState(false);
  const [isStudentBookingOpen, setIsStudentBookingOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copySnippet = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getContainerWidth = () => {
    switch (viewportWidth) {
      case '360':
        return 'max-w-[360px] mx-auto border-2 border-slate-400 rounded-[32px] overflow-hidden shadow-2xl my-4';
      case '390':
        return 'max-w-[390px] mx-auto border-2 border-slate-400 rounded-[32px] overflow-hidden shadow-2xl my-4';
      case '430':
        return 'max-w-[430px] mx-auto border-2 border-slate-400 rounded-[32px] overflow-hidden shadow-2xl my-4';
      default:
        return 'w-full max-w-6xl mx-auto';
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#202126] font-sans flex flex-col">
      {/* Top Bar Header */}
      <header className="sticky top-0 z-50 bg-[#202126] text-white px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#f6c945] text-[#202126] font-black flex items-center justify-center text-lg tracking-tighter shadow-sm">
              M
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                MAZZI Design System
                <span className="px-2 py-0.5 rounded-full bg-[#f6c945] text-[#202126] text-[10px] font-black uppercase">
                  V2 Official Catalog
                </span>
              </h1>
              <p className="text-[11px] text-slate-300 hidden sm:block">
                Guia visual e de desenvolvimento para interfaces de mobilidade urbana e autoescolas
              </p>
            </div>
          </div>

          {/* Viewport Preview Toolbar */}
          <div className="flex w-full max-w-full items-center gap-1 overflow-x-auto bg-slate-800 p-1 rounded-xl border border-slate-700 sm:w-auto">
            <ButtonBase
              type="button"
              onClick={() => setViewportWidth('full')}
              className={`shrink-0 px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewportWidth === 'full' ? 'bg-[#f6c945] text-[#202126]' : 'text-slate-300 hover:text-white'
              }`}
              title="Visualização Completa Desktop"
            >
              <Monitor className="w-3.5 h-3.5 inline mr-1" />
              Full
            </ButtonBase>
            <ButtonBase
              type="button"
              onClick={() => setViewportWidth('360')}
              className={`shrink-0 px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewportWidth === '360' ? 'bg-[#f6c945] text-[#202126]' : 'text-slate-300 hover:text-white'
              }`}
              title="Mobile Pequeno 360px"
            >
              <Smartphone className="w-3.5 h-3.5 inline mr-1" />
              360px
            </ButtonBase>
            <ButtonBase
              type="button"
              onClick={() => setViewportWidth('390')}
              className={`shrink-0 px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewportWidth === '390' ? 'bg-[#f6c945] text-[#202126]' : 'text-slate-300 hover:text-white'
              }`}
              title="Mobile Médio 390px"
            >
              <Smartphone className="w-3.5 h-3.5 inline mr-1" />
              390px
            </ButtonBase>
            <ButtonBase
              type="button"
              onClick={() => setViewportWidth('430')}
              className={`shrink-0 px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewportWidth === '430' ? 'bg-[#f6c945] text-[#202126]' : 'text-slate-300 hover:text-white'
              }`}
              title="Mobile Grande 430px"
            >
              <Smartphone className="w-3.5 h-3.5 inline mr-1" />
              430px
            </ButtonBase>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-4 md:p-6 gap-6 text-left">
        {/* Desktop Sidebar Navigation */}
        <aside className="w-64 shrink-0 hidden lg:block space-y-1 bg-white p-4 rounded-3xl border border-[#e9e6de] shadow-xs self-start sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 mb-2">
            Navegação do Catálogo
          </p>
          {SECTIONS.map((sec) => (
            <ButtonBase
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer text-left ${
                activeSection === sec.id
                  ? 'bg-[#f6c945] text-[#202126] shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {sec.icon}
              <span className="truncate">{sec.label}</span>
            </ButtonBase>
          ))}
        </aside>

        {/* Content Container */}
        <main className="flex-1 min-w-0">
          {/* Mobile Dropdown Section Selector */}
          <div className="lg:hidden mb-4">
            <label className="block text-xs font-bold text-slate-700 mb-1">Selecione a Seção do Design System:</label>
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value as SectionId)}
              className="w-full bg-white border border-[#e9e6de] rounded-2xl p-3 text-xs font-bold text-[#202126] shadow-xs focus:ring-2 focus:ring-[#f6c945]"
            >
              {SECTIONS.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.label}
                </option>
              ))}
            </select>
          </div>

          <div className={getContainerWidth()}>
            <div className="bg-white rounded-3xl border border-[#e9e6de] p-6 md:p-8 shadow-xs space-y-10">

              {/* 1. FOUNDATIONS */}
              {activeSection === 'foundations' && (
                <section className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black text-[#202126]">1. Foundations & Tokens Visuais</h2>
                      <span className="text-xs font-mono text-slate-400">src/index.css</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Tokens oficiais do MAZZI Premium V2. Utilize variáveis CSS ou utilitários correspondentes.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-[#f7f5ef] border border-[#e9e6de] text-[#202126] space-y-1">
                      <span className="text-xs font-black block">Background</span>
                      <span className="text-[11px] font-mono opacity-80">#f7f5ef</span>
                      <span className="text-[10px] text-slate-500 block">Fundo principal app</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#f6c945] text-[#202126] space-y-1 shadow-xs">
                      <span className="text-xs font-black block">Yellow Primary</span>
                      <span className="text-[11px] font-mono opacity-80">#f6c945</span>
                      <span className="text-[10px] opacity-90 block">Cor de destaque MAZZI</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#202126] text-white space-y-1 shadow-xs">
                      <span className="text-xs font-black block">Dark Charcoal</span>
                      <span className="text-[11px] font-mono opacity-80">#202126</span>
                      <span className="text-[10px] opacity-80 block">Textos & elementos escuros</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-[#e9e6de] text-[#202126] space-y-1 shadow-xs">
                      <span className="text-xs font-black block">Border</span>
                      <span className="text-[11px] font-mono opacity-80">#e9e6de</span>
                      <span className="text-[10px] text-slate-500 block">Bordas e divisores</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                      <span className="text-xs font-black block">Danger Soft</span>
                      <span className="text-[11px] font-mono opacity-80">rose-50 / 200</span>
                      <span className="text-[10px] text-rose-700 block">Gatilhos destrutivos</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-rose-600 text-white space-y-1 shadow-xs">
                      <span className="text-xs font-black block">Danger Solid</span>
                      <span className="text-[11px] font-mono opacity-80">rose-600</span>
                      <span className="text-[10px] text-white/90 block">Ações destrutivas fatais</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-500 text-white space-y-1 shadow-xs">
                      <span className="text-xs font-black block">Success</span>
                      <span className="text-[11px] font-mono opacity-80">emerald-500</span>
                      <span className="text-[10px] text-white/90 block">Confirmações & ativo</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                      <span className="text-xs font-black block">Warning</span>
                      <span className="text-[11px] font-mono opacity-80">amber-50 / 200</span>
                      <span className="text-[10px] text-amber-800 block">Avisos & retenção</span>
                    </div>
                  </div>
                </section>
              )}

              {/* 2. TYPOGRAPHY */}
              {activeSection === 'typography' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">2. Tipografia & Pesos Oficiais</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Regra de consistência: Botões e ações utilizam obrigatoriamente <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-rose-600">font-bold</code> ou <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-rose-600">font-extrabold</code>.
                    </p>
                  </div>

                  <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-[#e9e6de]">
                    <div className="border-b pb-3">
                      <p className="text-[10px] font-mono text-slate-400">Page Title — 24px / font-black</p>
                      <h1 className="text-2xl font-black text-[#202126]">Título de Página MAZZI</h1>
                    </div>
                    <div className="border-b pb-3">
                      <p className="text-[10px] font-mono text-slate-400">Section Title — 18px / font-extrabold</p>
                      <h2 className="text-lg font-extrabold text-[#202126]">Título de Seção Importante</h2>
                    </div>
                    <div className="border-b pb-3">
                      <p className="text-[10px] font-mono text-slate-400">Card Title — 14px / font-bold</p>
                      <h3 className="text-sm font-bold text-[#202126]">Card de Instrutor Credenciado</h3>
                    </div>
                    <div className="border-b pb-3">
                      <p className="text-[10px] font-mono text-slate-400">Body Text — 13px / font-medium</p>
                      <p className="text-xs font-medium text-slate-700 leading-relaxed">
                        Agendamento rápido de aulas práticas de autoescola com instrutores validados.
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-slate-400">Button Label Standard — 12-14px / font-bold (OBRIGATÓRIO)</p>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#202126] bg-[#f6c945] px-3 py-1.5 rounded-xl">
                          Confirmar Horário (font-bold)
                        </span>
                        <span className="font-bold text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                          Cancelar aula (font-bold)
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 3. BUTTONS */}
              {activeSection === 'buttons' && (
                <section className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black text-[#202126]">3. Catálogo Completo de Botões</h2>
                      <span className="text-xs font-mono text-slate-400">src/components/ui/Button.tsx</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      O padrão de ações nos três apps é <code className="font-mono font-bold">size=&quot;sm&quot;</code>, com texto de 12px e alvo touch de 44px. Os tamanhos md e lg abaixo ficam reservados para exceções documentadas. Botões textuais recebem um ícone Lucide por ação; <code className="font-mono">leftIcon</code> e <code className="font-mono">rightIcon</code> permitem substituição explícita.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* Primary Button */}
                    <div className="p-4 rounded-2xl border border-[#e9e6de] space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Primary (99 Yellow)</h4>
                        <ButtonBase
                          type="button"
                          onClick={() => copySnippet('<PrimaryButton size="md" leftIcon={<Check className="w-4 h-4" />}>Confirmar</PrimaryButton>')}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Copy Code
                        </ButtonBase>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <PrimaryButton size="sm">Small (sm)</PrimaryButton>
                        <PrimaryButton size="md">Medium (md)</PrimaryButton>
                        <PrimaryButton size="lg">Large (lg)</PrimaryButton>
                        <PrimaryButton size="md" leftIcon={<Check className="w-4 h-4 text-slate-950" />}>
                          Com Ícone
                        </PrimaryButton>
                        <PrimaryButton size="md" className="min-h-[48px] px-5" leftIcon={<CreditCard className="w-4 h-4" />}>
                          Finalizar pagamento
                        </PrimaryButton>
                        <SecondaryButton size="sm" className="min-h-11" leftIcon={<UserRound className="w-4 h-4" />}>
                          Perfil
                        </SecondaryButton>
                        <PrimaryButton size="sm" className="min-h-11" leftIcon={<CalendarIcon className="w-4 h-4" />}>
                          Agenda
                        </PrimaryButton>
                        <PrimaryButton size="sm" className="min-h-11" leftIcon={<ClipboardList className="w-4 h-4" />}>
                          Detalhes
                        </PrimaryButton>
                        <SecondaryButton size="sm" className="min-h-11" leftIcon={<UserPen className="w-4 h-4" />}>
                          Editar perfil
                        </SecondaryButton>
                        <PrimaryButton size="md" isLoading={true}>
                          Carregando
                        </PrimaryButton>
                        <PrimaryButton size="md" disabled={true}>
                          Desabilitado
                        </PrimaryButton>
                      </div>

                    </div>

                    {/* Secondary & Outline Button */}
                    <div className="p-4 rounded-2xl border border-[#e9e6de] space-y-3">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Secondary & Outline</h4>
                      <div className="flex flex-wrap items-center gap-3">
                        <SecondaryButton size="md">Secundário</SecondaryButton>
                        <Button variant="outline" size="md">
                          Outline
                        </Button>
                        <Button variant="ghost" size="md">
                          Ghost Action
                        </Button>
                        <Button variant="outline" size="md" leftIcon={<MessageSquare className="w-4 h-4 text-slate-600" />}>
                          Abrir Chat
                        </Button>
                      </div>
                    </div>

                    {/* Danger Buttons */}
                    <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-3">
                      <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider">Danger Variants (Soft vs Solid)</h4>
                      <p className="text-xs leading-relaxed text-rose-800">
                        Use <code className="font-mono font-bold">dangerSoft</code> para cancelar uma edição, fechar um formulário ou abrir uma confirmação. Use <code className="font-mono font-bold">danger</code> somente na ação final que efetiva o cancelamento destrutivo.
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Soft Danger */}
                        <Button variant="dangerSoft" size="sm" leftIcon={<XCircle className="w-4 h-4 text-rose-600" />}>
                          Cancelar aula (Soft Danger)
                        </Button>
                        {/* Solid Danger */}
                        <Button variant="danger" size="sm" leftIcon={<XCircle className="w-4 h-4 text-white" />}>
                          Cancelar aula (Solid Danger)
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 4. ICON POLICY */}
              {activeSection === 'icon-policy' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">4. Icon Usage Policy</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Biblioteca oficial: <code className="font-mono text-amber-700">lucide-react</code>. Tamanhos padrão: sm (14-16px), md (16px), lg (18px).
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
                    <p className="font-bold flex items-center gap-2">
                      <Info className="w-4 h-4 text-amber-600" />
                      Regras Oficiais de Ícones no MAZZI:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 font-medium text-amber-950">
                      <li><strong>Quando usar:</strong> Botões de ação funcional importante com símbolo universal claro.</li>
                      <li><strong>Quando NÃO usar:</strong> Ícones apenas decorativos que poluem a interface sem adicionar clareza.</li>
                      <li><strong>Sem emojis:</strong> Proibido usar emojis em botões funcionais do produto.</li>
                      <li><strong>Consistência:</strong> Componentes equivalentes devem usar exatamente os mesmos ícones.</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800">
                      <MessageSquare className="w-4 h-4 text-slate-600" />
                      <span>Chat → MessageSquare</span>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Cancelar → XCircle</span>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800">
                      <RotateCcw className="w-4 h-4 text-slate-500" />
                      <span>Limpar → RotateCcw</span>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Confirmar → Check</span>
                    </div>
                  </div>
                </section>
              )}

              {/* 5. INPUTS */}
              {activeSection === 'inputs' && (
                <section className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black text-[#202126]">5. Formulários & Inputs</h2>
                      <span className="text-xs font-mono text-slate-400">src/components/ui/Input.tsx</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Ponto de Encontro ou Endereço"
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      leftIcon={<MapPin className="w-4 h-4" />}
                    />
                    <Select
                      label="Categoria de Habilitação"
                      options={[
                        { value: 'B', label: 'Categoria B (Carro)' },
                        { value: 'A', label: 'Categoria A (Moto)' },
                      ]}
                    />
                  </div>
                </section>
              )}

              {/* 6. OTP */}
              {activeSection === 'otp' && (
                <section className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black text-[#202126]">6. OTP Input (8 Dígitos)</h2>
                      <span className="text-xs font-mono text-slate-400">src/components/ui/OtpInput.tsx</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Utilizado na autenticação Supabase/Brevo com suporte a colar do clipboard.
                    </p>
                  </div>

                  <div className="p-6 rounded-3xl bg-slate-50 border border-[#e9e6de] space-y-4">
                    <label className="block text-xs font-bold text-slate-700">Código de Verificação OTP (8 dígitos):</label>
                    <OtpInput value={otpVal} onChange={setOtpVal} length={8} />
                    <p className="text-[11px] font-mono text-slate-500">Valor atual: "{otpVal}"</p>
                  </div>
                </section>
              )}

              {/* 7. CHIPS */}
              {activeSection === 'chips' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">7. Chips de Filtro & Motivos</h2>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-700">Chips de Motivo de Cancelamento:</p>
                    <div className="flex flex-wrap gap-2">
                      {['Imprevisto pessoal', 'Mudança de horário', 'Problema de saúde', 'Outro motivo'].map((chip) => (
                        <ButtonBase
                          key={chip}
                          type="button"
                          onClick={() => setSelectedChip(chip)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            selectedChip === chip
                              ? 'bg-[#f6c945] text-[#202126] shadow-2xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {chip}
                        </ButtonBase>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* 8. BADGES */}
              {activeSection === 'badges' && (
                <section className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black text-[#202126]">8. Badges & Indicadores de Status</h2>
                      <span className="text-xs font-mono text-slate-400">src/components/ui/StatusBadge.tsx</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status="ACTIVE" />
                    <StatusBadge status="CONFIRMED" />
                    <StatusBadge status="IN_PROGRESS" />
                    <StatusBadge status="PENDING_PAYMENT" />
                    <StatusBadge status="COMPLETED" />
                    <StatusBadge status="CANCELLED_BY_STUDENT" />
                    <StatusBadge status="EXPIRED" />
                  </div>
                </section>
              )}

              {/* 9. CARDS */}
              {activeSection === 'cards' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">9. Cards de Domínio do Marketplace</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <BookingCard booking={MOCK_BOOKINGS[0]} variant="student" onViewDetails={() => setIsStudentBookingOpen(true)} />
                  </div>
                </section>
              )}

              {/* 10. ALERTS */}
              {activeSection === 'alerts' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">10. Alertas & Banners Informativos</h2>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
                      <p className="font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Reembolso de 100% (DEC-013)
                      </p>
                      <p>Cancelamento realizado com mais de 24 horas de antecedência da aula.</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium space-y-1">
                      <p className="font-bold flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Sem Reembolso (DEC-013)
                      </p>
                      <p>Cancelamento com menos de 6 horas de antecedência.</p>
                    </div>
                  </div>
                </section>
              )}

              {/* 11. MODALS */}
              {activeSection === 'modals' && (
                <section className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black text-[#202126]">11. Modais & Dialogs</h2>
                      <span className="text-xs font-mono text-slate-400">src/components/ui/Modal.tsx</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" size="md" onClick={() => setIsBasicModalOpen(true)}>
                      Abrir Modal Básico
                    </Button>
                    <Button variant="danger" size="md" onClick={() => setIsCancelModalOpen(true)}>
                      Abrir Modal de Cancelamento
                    </Button>
                  </div>
                </section>
              )}

              {/* 13. CANCELLATION */}
              {activeSection === 'cancellation' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">13. Padrão Visual de Cancelamento (LADO A LADO)</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Composição oficial nos detalhes da aula: <code className="font-mono text-slate-800">[ Abrir Chat ] [ Cancelar aula ]</code> lado a lado (50/50). O gatilho usa <code className="font-mono text-rose-700">dangerSoft</code>; a confirmação posterior usa <code className="font-mono text-rose-700">danger</code> sólido.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-[#e9e6de] bg-[#f7f5ef] space-y-3">
                    <p className="text-xs font-extrabold text-[#202126]">Preview nos Detalhes da Aula (Student & Provider):</p>
                    <div className="flex items-center gap-2.5 w-full">
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="w-1/2 min-h-[44px] font-bold text-slate-800 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-xs"
                        leftIcon={<MessageSquare className="w-4 h-4 text-slate-600" />}
                      >
                        Abrir Chat
                      </Button>
                      <Button
                        type="button"
                        variant="dangerSoft"
                        size="sm"
                        className="w-1/2"
                        leftIcon={<XCircle className="w-4 h-4 text-rose-600" />}
                      >
                        Cancelar aula
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {/* 14. BOOKING DAYS AND TIMES */}
              {activeSection === 'booking' && (
                <section className="space-y-6" data-section="booking-schedule">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">14. Agendamento — Dias e Horários</h2>
                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
                      O exemplo abre o mesmo <code className="font-mono font-bold">SlotSelectorModal</code> usado pelo Aluno, com calendário, disponibilidade diária, períodos e resumo da seleção.
                    </p>
                  </div>
                  <div className="mx-auto max-w-[430px] rounded-3xl border border-[var(--mazzi-border)] bg-[var(--mazzi-bg)] p-5 shadow-xs">
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-600">
                        <CalendarClock className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[var(--mazzi-dark)]">Escolha sua aula</h3>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--mazzi-muted)]">Consulte os dias disponíveis e selecione um horário para continuar.</p>
                      </div>
                    </div>
                    <PrimaryButton className="mt-5 w-full" leftIcon={<CalendarIcon className="h-4 w-4" aria-hidden="true" />} onClick={() => setIsStudentSlotPreviewOpen(true)}>
                      Ver dias e horários
                    </PrimaryButton>
                  </div>
                </section>
              )}

              {/* 15. CHAT */}
              {activeSection === 'chat' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">15. Componentes de Chat</h2>
                  </div>

                  <div className="p-4 rounded-3xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="p-3 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 max-w-[80%] space-y-1 shadow-2xs">
                      <p className="font-bold text-slate-900">Instrutor Carlos:</p>
                      <p>Olá! Estarei no ponto de encontro combinado às 09:00.</p>
                      <span className="text-[10px] text-slate-400 block text-right">08:45</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#f6c945] text-[#202126] text-xs font-medium max-w-[80%] ml-auto space-y-1 shadow-2xs">
                      <p>Perfeito, já estou a caminho!</p>
                      <span className="text-[10px] opacity-70 block text-right">08:47</span>
                    </div>
                  </div>
                </section>
              )}

              {/* 16. LOADING */}
              {activeSection === 'loading' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">16. Loading & Skeletons</h2>
                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
                      Skeletons aparecem somente na região de dados que está sendo atualizada. O header, as abas e os controles da tela permanecem visíveis e interativos.
                    </p>
                  </div>
                  <div className="space-y-4 rounded-3xl border border-[var(--mazzi-border)] bg-white p-5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Lista</h3>
                    <ContentSkeleton label="Atualizando lista" />
                    <h3 className="pt-2 text-xs font-black uppercase tracking-wider text-slate-500">Objeto</h3>
                    <ContentSkeleton mode="object" label="Atualizando objeto" />
                    <div className="border-t border-slate-100 pt-4">
                      <LoadingScreen fullscreen={false} label="Carregamento inicial da tela" />
                    </div>
                  </div>
                </section>
              )}

              {/* 17. EMPTY STATES */}
              {activeSection === 'empty-states' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">17. Empty & Error States</h2>
                  </div>
                  <EmptyState
                    title="Nenhuma aula encontrada"
                    description="Não existem aulas agendadas para esta data."
                  />
                </section>
              )}

              {/* 18. NAVIGATION & TEMPORAL CLASSIFICATION */}
              {activeSection === 'navigation' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">18. Navegação, Tabs & Classificação Temporal</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Aulas ativas ficam na aba Próximas. Aulas cujo horário já terminou (scheduled_end_at &lt;= NOW) migram automaticamente para o Histórico.
                    </p>
                  </div>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="min-w-0 space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Aluno — Minhas aulas</h3>
                      <div className="w-full min-w-0 max-w-[430px]">
                        <div role="tablist" aria-label="Aulas" className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-1">
                          {([
                            ['today', 'Hoje', Clock],
                            ['history', 'Histórico', History],
                          ] as const).map(([value, label, Icon]) => (
                            <ButtonBase
                              key={value}
                              role="tab"
                              aria-selected={demoLessonTab === value}
                              type="button"
                              onClick={() => setDemoLessonTab(value)}
                              className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                                demoLessonTab === value
                                  ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-xs'
                                  : 'font-semibold text-slate-600 hover:bg-slate-200/50 hover:text-[var(--mazzi-dark)]'
                              }`}
                            >
                              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              {label}
                            </ButtonBase>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">PRO — Minhas aulas</h3>
                      <div className="w-full min-w-0 max-w-[430px]">
                        <div role="tablist" aria-label="Filtros de aulas" className="mazzi-segmented overflow-x-auto">
                          {([
                            ['all', 'Todas', CalendarRange, 'min-w-[72px]'],
                            ['today', 'Hoje', Clock, 'min-w-[64px]'],
                            ['upcoming', 'Próximas', CalendarClock, 'min-w-[84px]'],
                            ['history', 'Histórico', History, 'min-w-[88px]'],
                          ] as const).map(([value, label, Icon, minWidth]) => (
                            <ButtonBase
                              key={value}
                              type="button"
                              role="tab"
                              onClick={() => setDemoProLessonTab(value)}
                              aria-selected={demoProLessonTab === value}
                              data-active={demoProLessonTab === value}
                              className={`flex ${minWidth} items-center justify-center gap-1.5 whitespace-nowrap !px-1.5`}
                            >
                              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span>{label}</span>
                            </ButtonBase>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Exemplo A: Aula Futura (Aba Próximas)</h4>
                    <div className="p-4 rounded-2xl bg-white border border-[#e9e6de] space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">Instrutor Carlos Silva</span>
                        <StatusBadge status="CONFIRMED" audience="student" />
                      </div>
                      <p className="text-slate-500 font-medium">Data: Amanhã às 14:00 (50 min)</p>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Exemplo B: Aula Passada com status CONFIRMED (Classificada no Histórico)</h4>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">Instrutor Carlos Silva</span>
                        <div className="flex items-center gap-2">
                          <StatusBadge status="CONFIRMED" audience="student" />
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">Terminada (Histórico)</span>
                        </div>
                      </div>
                      <p className="text-slate-500 font-medium">Data: Ontem às 10:00 (Finalizada)</p>
                    </div>
                  </div>
                </section>
              )}

              {/* 19. MOBILE PATTERNS & CHECKOUT MODALS */}
              {activeSection === 'mobile-patterns' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">19. Mobile Patterns & Checkout Modals (Premium V2)</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Respeito a safe-areas PWA (<code className="font-mono bg-slate-100">env(safe-area-inset-bottom)</code>), botões min-height 48px e footers flutuantes sem placas brancas.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f7f5ef] border border-[#e9e6de] space-y-3">
                    <h4 className="text-xs font-bold text-[#202126]">Padrão Visual do Checkout (Confirmar Aula & Confirmar Pagamento)</h4>
                    <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1 font-medium">
                      <li>Banner de ambiente de testes: Nota secundária em fundo âmbar suave.</li>
                      <li>Contador de garantia de preço/hold: Badge âmbar suave discreto ("Este valor fica reservado por mais MM:SS").</li>
                      <li>Resumo financeiro: Hierarquia com destaque no Total.</li>
                      <li>CTA Principal: <code className="font-mono text-amber-800">PrimaryButton</code> min-height 48px, full-width no mobile.</li>
                    </ul>
                  </div>
                </section>
              )}

              {/* 20. APP HOME HEADERS */}
              {activeSection === 'app-headers' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">20. Headers Iniciais dos Apps</h2>
                    <p className="mt-1 text-xs text-slate-600">
                      Componente global usado nas telas iniciais do MAZZI Aluno e MAZZI PRO. A estrutura, a tipografia e as ações permanecem idênticas; apenas o contexto e os textos mudam.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-[#e9e6de] bg-[#f7f5ef] p-5">
                      <AppHomeHeader
                        eyebrow="Aluno MAZZI"
                        eyebrowIcon={<UserRound className="h-3 w-3" aria-hidden="true" />}
                        title="Olá, Ana"
                        subtitle="Encontre sua próxima aula e acompanhe seus agendamentos."
                        onOpenNotifications={() => undefined}
                        onRefresh={() => undefined}
                      />
                    </div>
                    <div className="rounded-3xl border border-[#e9e6de] bg-[#f7f5ef] p-5">
                      <AppHomeHeader
                        eyebrow="Instrutor MAZZI"
                        eyebrowIcon={<UserCheck className="h-3 w-3" aria-hidden="true" />}
                        title="Olá, Carlos"
                        subtitle="Gerencie sua operação e acompanhe suas aulas."
                        onOpenNotifications={() => undefined}
                        onRefresh={() => undefined}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                    <code className="font-mono">src/components/ui/AppHomeHeader.tsx</code>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <NotificationIndicator className="h-full w-full items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--mazzi-border)] bg-white text-[var(--mazzi-dark)] shadow-xs">
                        <Bell className="h-5 w-5" aria-hidden="true" />
                      </span>
                    </NotificationIndicator>
                    <p className="text-xs text-slate-600">NotificationIndicator: exibe a contagem de não lidas somente quando houver notificações.</p>
                  </div>
                </section>
              )}

              {/* 21. COMPLETE COMPONENT INVENTORY */}
              {activeSection === 'component-inventory' && (
                <section className="space-y-8" data-section="component-inventory">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-[#202126]">21. Componentes usados por Aluno e PRO</h2>
                      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
                        Inventário restrito aos componentes alcançáveis pelos entrypoints Student e Instructor. Exemplos sem uso real não fazem parte deste catálogo.
                      </p>
                    </div>
                    <Badge variant="primary" size="md">21 componentes públicos</Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {COMPONENT_INVENTORY.map(([group, components]) => (
                      <div key={group} className="rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
                        <p className="text-xs font-bold text-[var(--mazzi-dark)]">{group}</p>
                        <p className="mt-1 text-xs font-normal leading-relaxed text-slate-500">{components}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h3 className="mazzi-section-title">Ações e status</h3>
                    <div className="space-y-4 rounded-3xl border border-[var(--mazzi-border)] bg-white p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <ButtonBase className="min-h-11 rounded-2xl border border-[var(--mazzi-border)] bg-white px-3.5 text-xs font-bold">ButtonBase</ButtonBase>
                        <Button variant="primary" leftIcon={<Check className="h-4 w-4" aria-hidden="true" />}>Button</Button>
                        <PrimaryButton leftIcon={<CalendarIcon className="h-4 w-4" aria-hidden="true" />}>PrimaryButton</PrimaryButton>
                        <SecondaryButton leftIcon={<UserRound className="h-4 w-4" aria-hidden="true" />}>SecondaryButton</SecondaryButton>
                        <IconButton label="Atualizar exemplo" className="mazzi-icon-button">
                          <RefreshCw className="h-5 w-5" aria-hidden="true" />
                        </IconButton>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge>Default</Badge>
                        <Badge variant="success">Success</Badge>
                        <Badge variant="warning">Warning</Badge>
                        <Badge variant="danger">Danger</Badge>
                        <StatusBadge status="CONFIRMED" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="mazzi-section-title">Formulários e avaliação</h3>
                    <div className="grid gap-4 rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 md:grid-cols-2">
                      <Input label="Endereço" value={inputVal} onChange={(event) => setInputVal(event.target.value)} />
                      <Select label="Categoria" options={[{ value: 'B', label: 'Categoria B' }, { value: 'A', label: 'Categoria A' }]} />
                      <div className="md:col-span-2"><OtpInput value={otpVal} onChange={setOtpVal} length={8} /></div>
                      <div className="md:col-span-2"><Rating value={demoRating} count={24} interactive onChange={setDemoRating} /></div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="mazzi-section-title">Domínio</h3>
                    <div className="grid gap-4">
                      <BookingCard booking={MOCK_BOOKINGS[0]} perspective="STUDENT" onViewDetails={() => undefined} onOpenChat={() => undefined} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="mazzi-section-title">Feedback e estados</h3>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <ListEmptyState title="Nenhum item encontrado" description="A lista ainda não possui registros para este filtro." />
                      <ObjectEmptyState
                        title="Nenhuma próxima aula"
                        description="Quando uma aula for confirmada, ela aparecerá neste resumo."
                        action={<PrimaryButton>Buscar aulas</PrimaryButton>}
                      />
                      <ErrorState message="Não foi possível carregar os dados agora." onRetry={() => undefined} />
                      <div className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5"><LoadingScreen fullscreen={false} label="Atualizando conteúdo" /></div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="mazzi-section-title">Headers e navegação</h3>
                    <div className="space-y-6 rounded-3xl border border-[var(--mazzi-border)] bg-[var(--mazzi-bg)] p-5">
                      <AppPageHeader
                        eyebrow="Sua jornada"
                        title="Minhas aulas"
                        subtitle="Acompanhe seus próximos horários e o histórico."
                        action={<IconButton label="Atualizar aulas" className="mazzi-icon-button"><RefreshCw className="h-5 w-5" aria-hidden="true" /></IconButton>}
                      />
                      <AppBottomNav
                        placement="inline"
                        ariaLabel="Navegação demonstrativa"
                        activeId={demoNav}
                        onChange={setDemoNav}
                        items={[
                          { id: 'home', label: 'Início', icon: <Home className="h-5 w-5" /> },
                          { id: 'lessons', label: 'Aulas', icon: <BookOpen className="h-5 w-5" />, badge: 2 },
                          { id: 'profile', label: 'Perfil', icon: <UserRound className="h-5 w-5" /> },
                        ]}
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* 22. STUDENT APP REFERENCE */}
              {activeSection === 'student-reference' && (
                <section className="space-y-8" data-section="student-reference">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-[#202126]">22. Referência MAZZI Aluno</h2>
                      <p className="mt-1 max-w-3xl text-xs font-normal leading-relaxed text-slate-600">
                        Fonte visual executável para os três PWAs. Os exemplos abaixo usam os mesmos componentes,
                        tokens, tipografia, ícones e tamanhos do aplicativo Aluno.
                      </p>
                    </div>
                    <Badge variant="primary" size="md">Fonte de verdade visual</Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {STUDENT_COMPONENT_INVENTORY.map(([group, components]) => (
                      <div key={group} className="rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
                        <p className="text-xs font-bold text-[var(--mazzi-dark)]">{group}</p>
                        <p className="mt-1 text-xs font-normal leading-relaxed text-slate-500">{components}</p>
                      </div>
                    ))}
                  </div>

                  <div className="-mx-6 w-[calc(100%+3rem)] overflow-hidden rounded-3xl border border-[var(--mazzi-border)] bg-[var(--mazzi-bg)] shadow-xs sm:mx-0 sm:w-full">
                    <div className="mx-auto min-h-[720px] w-full max-w-[430px] bg-[var(--mazzi-bg)] px-2 pb-6 pt-5 sm:px-5">
                      {studentPreviewTab === 'search' && (
                        <div className="space-y-7">
                          <AppHomeHeader
                            eyebrow="Aluno MAZZI"
                            eyebrowIcon={<UserRound className="h-3 w-3" aria-hidden="true" />}
                            title="Olá, Ana"
                            subtitle="Encontre sua próxima aula e acompanhe seus agendamentos."
                            onOpenNotifications={() => undefined}
                            onRefresh={() => undefined}
                          />
                          <SearchHeader
                            searchRequest={studentSearch}
                            onUpdateSearch={(update) => setStudentSearch((current) => ({ ...current, ...update }))}
                            onPerformSearch={() => undefined}
                            currentLocationName="Pinheiros, São Paulo"
                            currentLocation={{ lat: -23.5614, lng: -46.7016 }}
                          />
                          <section aria-labelledby="student-reference-results">
                            <div className="flex items-end justify-between gap-3">
                              <div>
                                <h3 id="student-reference-results" className="mazzi-section-title">Profissionais próximos</h3>
                                <p className="mt-1 text-xs font-semibold text-[var(--mazzi-muted)]">1 profissional encontrado</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <ButtonBase
                                  type="button"
                                  onClick={() => setIsStudentFilterOpen(true)}
                                  className="flex h-11 items-center gap-2 rounded-xl bg-[var(--mazzi-surface-soft)] px-3 text-xs font-bold"
                                >
                                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                                  Filtros
                                </ButtonBase>
                                <div aria-label="Modo de visualização" className="flex rounded-xl bg-[var(--mazzi-surface-soft)] p-1">
                                  <ButtonBase type="button" aria-label="Exibir lista" aria-pressed={studentViewMode === 'list'} onClick={() => setStudentViewMode('list')} className={`grid h-9 w-9 place-items-center rounded-lg ${studentViewMode === 'list' ? 'bg-white shadow-sm' : ''}`}>
                                    <List className="h-4 w-4" aria-hidden="true" />
                                  </ButtonBase>
                                  <ButtonBase type="button" aria-label="Exibir mapa" aria-pressed={studentViewMode === 'map'} onClick={() => setStudentViewMode('map')} className={`grid h-9 w-9 place-items-center rounded-lg ${studentViewMode === 'map' ? 'bg-white shadow-sm' : ''}`}>
                                    <Map className="h-4 w-4" aria-hidden="true" />
                                  </ButtonBase>
                                </div>
                              </div>
                            </div>
                          </section>
                          {studentViewMode === 'list' ? (
                            <ProviderResultCard
                              result={STUDENT_SEARCH_RESULT}
                              onSelect={() => setIsStudentBookingOpen(true)}
                              onViewProfile={() => setIsStudentProfileOpen(true)}
                            />
                          ) : (
                            <MapView
                              results={[STUDENT_SEARCH_RESULT]}
                              selectedProviderId={STUDENT_SEARCH_RESULT.providerId}
                              onSelectProvider={() => setIsStudentProfileOpen(true)}
                              height="320px"
                              userLocation={{ lat: -23.5614, lng: -46.7016 }}
                            />
                          )}
                        </div>
                      )}

                      {studentPreviewTab === 'bookings' && (
                        <div className="space-y-5">
                          <AppPageHeader
                            eyebrow="Sua jornada"
                            title="Minhas aulas"
                            subtitle="Acompanhe seus próximos horários e o histórico."
                            action={<IconButton label="Atualizar aulas" className="mazzi-icon-button"><RefreshCw className="h-5 w-5" aria-hidden="true" /></IconButton>}
                          />
                          <div role="tablist" aria-label="Aulas" className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-1">
                            {([
                              ['today', 'Hoje', Clock],
                              ['history', 'Histórico', History],
                            ] as const).map(([value, label, Icon]) => (
                              <ButtonBase
                                key={value}
                                role="tab"
                                aria-selected={demoLessonTab === value}
                                type="button"
                                onClick={() => setDemoLessonTab(value)}
                                className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                                  demoLessonTab === value
                                    ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-xs'
                                    : 'font-semibold text-slate-600 hover:bg-slate-200/50 hover:text-[var(--mazzi-dark)]'
                                }`}
                              >
                                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                {label}
                              </ButtonBase>
                            ))}
                          </div>
                          <BookingCard
                            booking={MOCK_BOOKINGS[0]}
                            variant="student"
                            onViewDetails={() => setIsStudentBookingOpen(true)}
                            onOpenChat={() => undefined}
                          />
                        </div>
                      )}

                      {studentPreviewTab === 'profile' && (
                        <div className="space-y-5">
                          <AppPageHeader
                            eyebrow="Sua conta"
                            title="Meu Perfil"
                            action={<IconButton label="Editar perfil" className="mazzi-icon-button"><Pencil className="h-5 w-5" aria-hidden="true" /></IconButton>}
                          />
                          <div className="pt-2 text-center">
                            <div className="relative mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-[var(--mazzi-border)] bg-[var(--mazzi-yellow)] text-2xl font-bold shadow-[var(--mazzi-shadow)]">
                              {studentProfilePhoto ? <img src={studentProfilePhoto} alt="Foto do perfil" className="h-full w-full object-cover" /> : 'AS'}
                            </div>
                            <h3 className="mt-4 truncate text-2xl font-bold text-[var(--mazzi-dark)]">Ana Beatriz Souza</h3>
                            <p className="mt-1 truncate text-sm text-[var(--mazzi-muted)]">ana.aluno@mazzi.com.br</p>
                          </div>
                          <div className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
                            <h4 className="text-sm font-bold text-[var(--mazzi-dark)]">Dados do perfil</h4>
                            <dl className="mt-4 space-y-3 text-sm">
                              {[
                                ['Telefone', '(11) 98100-1002'],
                                ['E-mail', 'ana.aluno@mazzi.com.br'],
                                ['CPF', '529.***.***-22'],
                                ['Data de nascimento', '20/08/1998'],
                              ].map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between gap-3">
                                  <dt className="text-slate-500">{label}</dt>
                                  <dd className="truncate font-semibold text-slate-900">{value}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                          <div className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
                            <h4 className="text-sm font-bold text-[var(--mazzi-dark)]">Edição da foto</h4>
                            <div className="mt-4">
                              <ProfilePhotoPicker value={studentProfilePhoto} name="Ana Beatriz Souza" onChange={setStudentProfilePhoto} />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-8">
                        <AppBottomNav
                          placement="inline"
                          ariaLabel="Navegação de referência do app Aluno"
                          activeId={studentPreviewTab}
                          onChange={setStudentPreviewTab}
                          items={[
                            { id: 'search', label: 'Buscar', icon: <Search className="h-5 w-5" /> },
                            { id: 'bookings', label: 'Aulas', icon: <CalendarIcon className="h-5 w-5" /> },
                            { id: 'profile', label: 'Perfil', icon: <UserRound className="h-5 w-5" /> },
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="mazzi-section-title">Overlays e fluxos do Aluno</h3>
                    <div className="space-y-4 rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
                      <p className="text-xs font-normal leading-relaxed text-slate-600">
                        Os fluxos transacionais permanecem componentes únicos do produto. O catálogo referencia as APIs reais sem duplicar marcação ou regras de negócio.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton leftIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />} onClick={() => setIsStudentFilterOpen(true)}>FilterDrawer</SecondaryButton>
                        <SecondaryButton leftIcon={<UserRound className="h-4 w-4" aria-hidden="true" />} onClick={() => setIsStudentProfileOpen(true)}>ProviderPublicProfileModal</SecondaryButton>
                        <SecondaryButton leftIcon={<ClipboardList className="h-4 w-4" aria-hidden="true" />} onClick={() => setIsStudentBookingOpen(true)}>BookingDetailsModal</SecondaryButton>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {['SlotSelectorModal', 'CheckoutModal', 'BookingChatPanel', 'NotificationsPanel', 'ReviewModal', 'ProfilePhotoPicker'].map((name) => (
                          <div key={name} className="rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] px-3 py-2.5 text-xs font-bold text-[var(--mazzi-dark)]">
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

            </div>
          </div>
        </main>
      </div>

      {/* Basic Test Modal */}
      <Modal
        isOpen={isBasicModalOpen}
        onClose={() => setIsBasicModalOpen(false)}
        title="Modal Básico"
        size="sm"
      >
        <div className="space-y-3 text-xs text-slate-700">
          <p>Exemplo do modal compartilhado usado pelos fluxos do Aluno e PRO.</p>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Button variant="dangerSoft" size="sm" onClick={() => setIsBasicModalOpen(false)}>
            Cancelar
          </Button>
          <PrimaryButton size="md" onClick={() => setIsBasicModalOpen(false)}>
            Confirmar
          </PrimaryButton>
        </div>
      </Modal>

      {/* Cancel Confirmation Test Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancelar Agendamento"
        size="md"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Confirmação de Cancelamento (DEC-013)
            </p>
            <p>100% Reembolso garantido por estar a mais de 24h da aula.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="w-1/2 min-h-[48px] font-bold rounded-2xl border-slate-300 bg-white"
              onClick={() => setIsCancelModalOpen(false)}
            >
              <ArrowLeft className="w-4 h-4 text-slate-500 mr-1 inline" />
              Manter aula
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="w-1/2"
              onClick={() => setIsCancelModalOpen(false)}
            >
              <XCircle className="w-4 h-4 text-white mr-1 inline" />
              Confirmar cancelamento
            </Button>
          </div>
        </div>
      </Modal>

      <FilterDrawer
        isOpen={isStudentFilterOpen}
        onClose={() => setIsStudentFilterOpen(false)}
        filters={studentSearch}
        onApplyFilters={(filters) => {
          setStudentSearch((current) => ({ ...current, ...filters }));
          setIsStudentFilterOpen(false);
        }}
        onResetFilters={() => setStudentSearch({ latitude: -23.5614, longitude: -46.7016, radiusMeters: 10000, category: 'B', sortBy: 'RECOMMENDED' })}
      />

      <ProviderPublicProfileModal
        isOpen={isStudentProfileOpen}
        onClose={() => setIsStudentProfileOpen(false)}
        result={STUDENT_SEARCH_RESULT}
        onSelectSlotToBook={() => {
          setIsStudentProfileOpen(false);
          setIsStudentBookingOpen(true);
        }}
      />

      <SlotSelectorModal
        isOpen={isStudentSlotPreviewOpen}
        onClose={() => setIsStudentSlotPreviewOpen(false)}
        offeringId="design-system-preview"
        previewSlots={DESIGN_SYSTEM_PREVIEW_SLOTS}
        instructorName="Carlos Alberto Silva"
        vehicleLabel="Hyundai HB20 2025"
        durationMinutes={50}
        priceInCents={9500}
        transmission="MANUAL"
        onSelect={() => setIsStudentSlotPreviewOpen(false)}
      />

      <BookingDetailsModal
        isOpen={isStudentBookingOpen}
        onClose={() => setIsStudentBookingOpen(false)}
        booking={MOCK_BOOKINGS[0]}
        onOpenChat={() => {
          setIsStudentBookingOpen(false);
        }}
      />
    </div>
  );
};
