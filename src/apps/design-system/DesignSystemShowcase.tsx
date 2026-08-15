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
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
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
import { UniversalMap } from '../../components/maps/UniversalMap';
import {
  MOCK_PROVIDERS,
  MOCK_VEHICLES,
  MOCK_BOOKINGS,
} from '../../data/mockData';

export const DesignSystemShowcase: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState('2026-08-15');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>({
    startTime: '09:00',
    endTime: '09:50',
    isAvailable: true,
  });
  const [activeTab, setActiveTab] = useState('components');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputVal, setInputVal] = useState('Av. Paulista, 1000 - Bela Vista');
  const [checkboxVal, setCheckboxVal] = useState(true);

  const mockSlots: TimeSlot[] = [
    { startTime: '08:00', endTime: '08:50', isAvailable: true },
    { startTime: '09:00', endTime: '09:50', isAvailable: true },
    { startTime: '10:00', endTime: '10:50', isAvailable: false, isBooked: true },
    { startTime: '11:00', endTime: '11:50', isAvailable: true },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center py-6 px-4 text-slate-900">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-8 space-y-8 text-left">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xl tracking-tighter shadow-xs">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900">MAZZI Design System</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                  Tema Inspirado na 99
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Identidade visual: Amarelo vibrante (#FFC700 / Amber 400), Slate/Carvão de alto contraste, tipografia nítida e componentes de alta conversão.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <Tabs
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'components', label: 'Componentes Base' },
                { id: 'domain-cards', label: 'Cards de Domínio' },
                { id: 'maps', label: 'Mapas & Geolocalização' },
                { id: 'scheduling', label: 'Calendário & Horários' },
                { id: 'states', label: 'Estados Vazios & Feedback' },
              ]}
            />
          </div>
        </div>

        {/* Tab: Components Base */}
        {activeTab === 'components' && (
          <div className="space-y-8">
            {/* Color Palette */}
            <div>
              <h3 className="font-extrabold text-base text-slate-900 mb-3">1. Paleta de Cores (Brand Palette)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-amber-400 text-slate-950 shadow-xs">
                  <span className="font-black text-sm block">99 Amber Primary</span>
                  <span className="text-[11px] font-mono opacity-80">#FFC700 / amber-400</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 text-white shadow-xs">
                  <span className="font-black text-sm block">Deep Charcoal</span>
                  <span className="text-[11px] font-mono opacity-80">#020617 / slate-950</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-100 text-slate-800 border border-slate-200">
                  <span className="font-bold text-sm block">Neutral Light</span>
                  <span className="text-[11px] font-mono opacity-80">#F1F5F9 / slate-100</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500 text-white shadow-xs">
                  <span className="font-bold text-sm block">Success Emerald</span>
                  <span className="text-[11px] font-mono opacity-80">#10B981 / emerald-500</span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div>
              <h3 className="font-extrabold text-base text-slate-900 mb-3">2. Botões (Buttons)</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="md">
                  Primário (99 Yellow)
                </Button>
                <Button variant="secondary" size="md">
                  Secundário (Charcoal)
                </Button>
                <Button variant="outline" size="md">
                  Outline
                </Button>
                <Button variant="ghost" size="md">
                  Ghost
                </Button>
                <Button variant="danger" size="md">
                  Danger
                </Button>
                <Button variant="primary" size="sm" leftIcon={<Car className="w-3.5 h-3.5" />}>
                  Com Ícone
                </Button>
                <Button variant="primary" size="md" isLoading={true}>
                  Carregando
                </Button>
              </div>
            </div>

            {/* Form Inputs */}
            <div>
              <h3 className="font-extrabold text-base text-slate-900 mb-3">3. Campos de Formulário</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Localização ou Ponto de Encontro"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  leftIcon={<MapPin className="w-4 h-4" />}
                />
                <Select
                  label="Categoria de Habilitação"
                  options={[
                    { value: 'B', label: 'Categoria B (Carro)' },
                    { value: 'A', label: 'Categoria A (Moto)' },
                    { value: 'AB', label: 'Categoria AB (Carro e Moto)' },
                  ]}
                />
              </div>
              <div className="mt-3">
                <Checkbox
                  id="chk-terms"
                  checked={checkboxVal}
                  onChange={(checked) => setCheckboxVal(checked)}
                  label="Li e concordo com os termos de agendamento e política de cancelamento MAZZI."
                />
              </div>
            </div>

            {/* Badges & Statuses */}
            <div>
              <h3 className="font-extrabold text-base text-slate-900 mb-3">4. Badges & Indicadores de Status</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary">99 Primary</Badge>
                <Badge variant="default">Default</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="neutral">Neutral Dark</Badge>
                <StatusBadge status="ACTIVE" />
                <StatusBadge status="CONFIRMED" />
                <StatusBadge status="IN_PROGRESS" />
                <StatusBadge status="COMPLETED" />
                <StatusBadge status="UNDER_REVIEW" />
                <StatusBadge status="CANCELLED_BY_STUDENT" />
              </div>
            </div>

            {/* Pricing & Ratings */}
            <div>
              <h3 className="font-extrabold text-base text-slate-900 mb-3">5. Preços & Avaliações</h3>
              <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <Price cents={9500} durationMinutes={50} size="lg" />
                <div className="h-8 w-px bg-slate-300" />
                <Rating value={4.9} count={84} size="md" />
                <div className="h-8 w-px bg-slate-300" />
                <Avatar name="Carlos Silva" size="lg" />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Domain Cards */}
        {activeTab === 'domain-cards' && (
          <div className="space-y-6">
            <h3 className="font-extrabold text-base text-slate-900">Cards de Domínio do Marketplace</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProviderCard provider={MOCK_PROVIDERS[0]} onSelect={() => setIsModalOpen(true)} />
              <VehicleCard vehicle={MOCK_VEHICLES[0]} />
            </div>

            <div className="mt-4">
              <h4 className="font-bold text-sm text-slate-800 mb-2">Card de Reserva (Booking)</h4>
              <BookingCard booking={MOCK_BOOKINGS[0]} onCheckIn={() => alert('Check-in!')} />
            </div>
          </div>
        )}

        {/* Tab: Maps & Geolocation */}
        {activeTab === 'maps' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Mapas & Geolocalização (OpenStreetMap / Leaflet)
                </h3>
                <p className="text-xs text-slate-500">
                  Motor de mapas 100% livre de chaves ou custos, com marcadores estilizados no padrão 99, raio de cobertura e pontos de encontro.
                </p>
              </div>
            </div>

            <UniversalMap
              providers={MOCK_PROVIDERS}
              showCoverageRadius={true}
              height="400px"
              onSelectProvider={(prov) => alert(`Prestador selecionado no mapa: ${prov.name}`)}
            />
          </div>
        )}

        {/* Tab: Scheduling */}
        {activeTab === 'scheduling' && (
          <div className="space-y-6">
            <h3 className="font-extrabold text-base text-slate-900">Agendamento & Seleção de Horários</h3>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-6">
              <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              <TimePicker
                slots={mockSlots}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
              />
            </div>
          </div>
        )}

        {/* Tab: States */}
        {activeTab === 'states' && (
          <div className="space-y-6">
            <h3 className="font-extrabold text-base text-slate-900">Estados de Feedback (Empty / Error / Skeleton)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EmptyState
                title="Nenhuma aula encontrada"
                description="Tente ajustar sua localização ou buscar por outros bairros na cidade de São Paulo."
                actionLabel="Limpar Filtros"
                onAction={() => alert('Filtros limpos!')}
              />
              <ErrorState
                title="Falha ao carregar disponibilidade"
                message="Não foi possível sincronizar a grade de horários deste instrutor. Verifique sua conexão."
                onRetry={() => alert('Tentando novamente...')}
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
              <h4 className="font-bold text-xs text-slate-700">Skeleton Loading Placeholders</h4>
              <Skeleton variant="card" />
              <div className="flex gap-2">
                <Skeleton variant="text" />
                <Skeleton variant="text" />
              </div>
            </div>
          </div>
        )}

        {/* Interactive Modal test */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Modal de Teste do Design System"
          size="sm"
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Este modal utiliza a paleta 99 com botões arredondados e transições fluidas.
            </p>
            <Button variant="primary" size="md" className="w-full" onClick={() => setIsModalOpen(false)}>
              Fechar Modal
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  );
};
