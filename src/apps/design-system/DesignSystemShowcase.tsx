import React, { useState } from 'react';
import {
  Car,
  Bike,
  ShieldCheck,
  Star,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  ChevronRight,
  Info,
  MessageSquare,
  XCircle,
  RotateCcw,
  Check,
  Search,
  SlidersHorizontal,
  ArrowLeft,
  Pencil,
  Trash,
  Plus,
  Building2,
  UserCheck,
  CreditCard,
  Ban,
  Send,
  Sparkles,
  Smartphone,
  Monitor,
  Copy,
  CheckCheck,
  FileCode,
  Layers,
  Palette,
  Type,
  ToggleLeft,
  Navigation as NavIcon,
} from 'lucide-react';
import { Button, PrimaryButton, SecondaryButton } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { OtpInput } from '../../components/ui/OtpInput';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Rating } from '../../components/ui/Rating';
import { Price } from '../../components/ui/Price';
import { Avatar } from '../../components/ui/Avatar';
import { Calendar } from '../../components/ui/Calendar';
import { TimePicker, TimeSlot } from '../../components/ui/TimePicker';
import { ProviderCard } from '../../components/ui/ProviderCard';
import { VehicleCard } from '../../components/ui/VehicleCard';
import { BookingCard } from '../../components/ui/BookingCard';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { ModalActionFooter } from '../../components/ui/ModalActionFooter';
import { FloatingActionFooter } from '../../components/ui/FloatingActionFooter';
import { UniversalMap } from '../../components/maps/UniversalMap';
import {
  MOCK_PROVIDERS,
  MOCK_VEHICLES,
  MOCK_BOOKINGS,
} from '../../data/mockData';

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
  | 'bottom-actions'
  | 'cancellation'
  | 'booking'
  | 'chat'
  | 'loading'
  | 'empty-states'
  | 'navigation'
  | 'mobile-patterns';

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
  { id: 'bottom-actions', label: '12. Bottom Action Footers', icon: <NavIcon className="w-4 h-4" /> },
  { id: 'cancellation', label: '13. Padrão de Cancelamento', icon: <XCircle className="w-4 h-4" /> },
  { id: 'booking', label: '14. Fluxo de Agendamento', icon: <CalendarIcon className="w-4 h-4" /> },
  { id: 'chat', label: '15. Componentes de Chat', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'loading', label: '16. Loading & Skeletons', icon: <Clock className="w-4 h-4" /> },
  { id: 'empty-states', label: '17. Empty & Error States', icon: <Info className="w-4 h-4" /> },
  { id: 'navigation', label: '18. Navegação & Tabs', icon: <NavIcon className="w-4 h-4" /> },
  { id: 'mobile-patterns', label: '19. Mobile Patterns (360-430px)', icon: <Smartphone className="w-4 h-4" /> },
];

export const DesignSystemShowcase: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('foundations');
  const [viewportWidth, setViewportWidth] = useState<'full' | '360' | '390' | '430'>('full');
  const [otpVal, setOtpVal] = useState('');
  const [inputVal, setInputVal] = useState('Av. Paulista, 1000 - Bela Vista');
  const [selectedChip, setSelectedChip] = useState('Imprevisto pessoal');
  const [isBasicModalOpen, setIsBasicModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
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
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setViewportWidth('full')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewportWidth === 'full' ? 'bg-[#f6c945] text-[#202126]' : 'text-slate-300 hover:text-white'
              }`}
              title="Visualização Completa Desktop"
            >
              <Monitor className="w-3.5 h-3.5 inline mr-1" />
              Full
            </button>
            <button
              type="button"
              onClick={() => setViewportWidth('360')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewportWidth === '360' ? 'bg-[#f6c945] text-[#202126]' : 'text-slate-300 hover:text-white'
              }`}
              title="Mobile Pequeno 360px"
            >
              <Smartphone className="w-3.5 h-3.5 inline mr-1" />
              360px
            </button>
            <button
              type="button"
              onClick={() => setViewportWidth('390')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewportWidth === '390' ? 'bg-[#f6c945] text-[#202126]' : 'text-slate-300 hover:text-white'
              }`}
              title="Mobile Médio 390px"
            >
              390px
            </button>
            <button
              type="button"
              onClick={() => setViewportWidth('430')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewportWidth === '430' ? 'bg-[#f6c945] text-[#202126]' : 'text-slate-300 hover:text-white'
              }`}
              title="Mobile Grande 430px"
            >
              430px
            </button>
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
            <button
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
            </button>
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
                      Todas as variantes possuem altura mínima touch de 44px (48px para CTAs primários) e peso tipográfico <code className="font-mono font-bold">font-bold</code>.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* Primary Button */}
                    <div className="p-4 rounded-2xl border border-[#e9e6de] space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Primary (99 Yellow)</h4>
                        <button
                          type="button"
                          onClick={() => copySnippet('<PrimaryButton size="md" leftIcon={<Check className="w-4 h-4" />}>Confirmar</PrimaryButton>')}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Copy Code
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <PrimaryButton size="sm">Small (sm)</PrimaryButton>
                        <PrimaryButton size="md">Medium (md)</PrimaryButton>
                        <PrimaryButton size="lg">Large (lg)</PrimaryButton>
                        <PrimaryButton size="md" leftIcon={<Check className="w-4 h-4 text-slate-950" />}>
                          Com Ícone
                        </PrimaryButton>
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
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Soft Danger */}
                        <button
                          type="button"
                          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-700 font-bold rounded-2xl transition flex items-center gap-2 text-xs shadow-2xs cursor-pointer min-h-[44px]"
                        >
                          <XCircle className="w-4 h-4 text-rose-600" />
                          <span>Cancelar aula (Soft Danger)</span>
                        </button>
                        {/* Solid Danger */}
                        <Button variant="danger" size="md" leftIcon={<XCircle className="w-4 h-4 text-white" />}>
                          Confirmar cancelamento (Solid Danger)
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
                  <Checkbox
                    id="chk-demo"
                    checked={true}
                    onChange={() => {}}
                    label="Li e aceito os termos de cancelamento e reembolso (DEC-013)."
                  />
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
                        <button
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
                        </button>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ProviderCard provider={MOCK_PROVIDERS[0]} onSelect={() => {}} />
                    <VehicleCard vehicle={MOCK_VEHICLES[0]} />
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

              {/* 12. BOTTOM ACTIONS */}
              {activeSection === 'bottom-actions' && (
                <section className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black text-[#202126]">12. Sticky White Bottom Footers</h2>
                      <span className="text-xs font-mono text-slate-400">src/components/ui/ModalActionFooter.tsx</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Padrão Oficial V2: Fundo branco fixo (<code className="font-mono bg-slate-100">bg-white</code>) com botões flutuantes elevados (<code className="font-mono bg-slate-100">rounded-2xl shadow-md</code>) e safe-area.
                    </p>
                  </div>

                  {/* Visual Example of Sticky White Footer */}
                  <div className="border border-slate-200 rounded-3xl overflow-hidden bg-slate-50 shadow-inner">
                    <div className="p-4 space-y-2 text-xs text-slate-600 max-h-36 overflow-y-auto">
                      <p className="font-bold text-slate-900">Conteúdo rolável passa por trás do footer...</p>
                      <p>Linha 1 do conteúdo do modal ou formulário longo...</p>
                      <p>Linha 2 do conteúdo do modal ou formulário longo...</p>
                      <p>Linha 3 do conteúdo do modal ou formulário longo...</p>
                      <p>Linha 4 do conteúdo do modal ou formulário longo...</p>
                    </div>
                    <ModalActionFooter align="between">
                      <SecondaryButton size="md" className="w-1/2 min-h-[48px] rounded-2xl flex items-center justify-center gap-2">
                        <RotateCcw className="w-4 h-4 text-slate-500" />
                        <span>Limpar</span>
                      </SecondaryButton>
                      <PrimaryButton size="md" className="w-1/2 min-h-[48px] rounded-2xl flex items-center justify-center gap-2">
                        <Check className="w-4 h-4 text-slate-950" />
                        <span>Aplicar Filtros</span>
                      </PrimaryButton>
                    </ModalActionFooter>
                  </div>
                </section>
              )}

              {/* 13. CANCELLATION */}
              {activeSection === 'cancellation' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">13. Padrão Visual de Cancelamento (LADO A LADO)</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Composição oficial nos detalhes da aula: <code className="font-mono text-slate-800">[ 💬 Abrir Chat ] [ ✕ Cancelar aula ]</code> dispostos LADO A LADO (50/50) com ambos os botões em <code className="font-mono text-rose-600">font-bold</code>.
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
                      <button
                        type="button"
                        className="w-1/2 min-h-[44px] bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-700 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs shadow-2xs cursor-pointer"
                      >
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span className="font-bold">Cancelar aula</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* 14. BOOKING */}
              {activeSection === 'booking' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">14. Agendamento & TimePicker</h2>
                  </div>
                  <Calendar selectedDate="2026-08-18" onSelectDate={() => {}} />
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
                  </div>
                  <div className="space-y-3">
                    <Skeleton variant="card" />
                    <Skeleton variant="text" />
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

              {/* 18. NAVIGATION */}
              {activeSection === 'navigation' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">18. Navegação & Tabs</h2>
                  </div>
                  <Tabs
                    id="demo-tabs"
                    ariaLabel="Navegação demo"
                    activeTab="t1"
                    onChange={() => {}}
                    tabs={[
                      { id: 't1', label: 'Próximas Aulas' },
                      { id: 't2', label: 'Histórico' },
                    ]}
                  />
                </section>
              )}

              {/* 19. MOBILE PATTERNS */}
              {activeSection === 'mobile-patterns' && (
                <section className="space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-[#202126]">19. Mobile Patterns (360px - 430px)</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Respeito a safe-areas PWA (<code className="font-mono bg-slate-100">env(safe-area-inset-bottom)</code>) e botões de toque mínimo 44-48px.
                    </p>
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
        title="Modal Básico com Sticky White Footer"
        size="sm"
      >
        <div className="space-y-3 text-xs text-slate-700">
          <p>Exemplo de modal utilizando o padrão oficial MAZZI V2 com rodapé branco fixo e botões flutuantes elevados.</p>
        </div>
        <ModalActionFooter align="right">
          <SecondaryButton size="md" onClick={() => setIsBasicModalOpen(false)}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton size="md" onClick={() => setIsBasicModalOpen(false)}>
            Confirmar
          </PrimaryButton>
        </ModalActionFooter>
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
          <ModalActionFooter align="between">
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
              size="md"
              className="w-1/2 min-h-[48px] font-extrabold bg-rose-600 text-white rounded-2xl shadow-md"
              onClick={() => setIsCancelModalOpen(false)}
            >
              <XCircle className="w-4 h-4 text-white mr-1 inline" />
              Confirmar cancelamento
            </Button>
          </ModalActionFooter>
        </div>
      </Modal>
    </div>
  );
};
