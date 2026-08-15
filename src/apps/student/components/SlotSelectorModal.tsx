import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabase';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export interface SlotSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  offeringId: string;
  onSelect: (slot: any) => void;
}

export const SlotSelectorModal: React.FC<SlotSelectorModalProps> = ({
  isOpen,
  onClose,
  offeringId,
  onSelect,
}) => {
  const [slotsByDate, setSlotsByDate] = useState<Record<string, any[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSlots = async () => {
      setIsLoading(true);
      try {
        const fromDate = new Date();
        const toDate = new Date();
        toDate.setDate(fromDate.getDate() + 14);

        const { data, error } = await (supabase as any).rpc('get_available_slots_public', {
          p_offering_id: offeringId,
          p_date_from: fromDate.toISOString().split('T')[0],
          p_date_to: toDate.toISOString().split('T')[0],
        });

        if (error) throw error;

        const grouped = (data || []).reduce((acc: any, slot: any) => {
          const date = slot.local_date;
          if (!acc[date]) acc[date] = [];
          acc[date].push(slot);
          return acc;
        }, {});
        
        setSlotsByDate(grouped);
      } catch (err) {
        console.error('Failed to fetch slots', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSlots();
  }, [isOpen, offeringId]);

  const dates = Object.keys(slotsByDate).sort();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Escolha o Horário" size="md">
      <div className="space-y-6 p-4">
        <div>
          <h3 className="font-bold text-sm text-slate-700 mb-3">Escolha o dia</h3>
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
            {dates.map((date) => {
              const d = new Date(date);
              const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
              const dayNum = d.getDate();
              
              return (
                <button
                  key={date}
                  onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all min-w-[72px] ${
                    selectedDate === date 
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm' 
                      : 'border-slate-200 bg-white hover:border-emerald-200 text-slate-700'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold text-slate-400">{dayName}</span>
                  <span className="text-lg font-black">{dayNum}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div>
            <h3 className="font-bold text-sm text-slate-700 mb-3">Horários disponíveis</h3>
            <div className="grid grid-cols-4 gap-2">
              {slotsByDate[selectedDate].map((slot) => (
                <button
                  key={slot.slot_start_at}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-3 rounded-xl border font-bold transition-all text-sm ${
                    selectedSlot === slot 
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-md' 
                      : 'border-slate-200 bg-white hover:border-emerald-200 text-slate-700'
                  }`}
                >
                  {slot.local_start_time.substring(0, 5)}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          disabled={!selectedSlot}
          className="w-full"
          onClick={() => { onSelect(selectedSlot); onClose(); }}
        >
          Continuar
        </Button>
      </div>
    </Modal>
  );
};
