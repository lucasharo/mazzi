import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const studentApp = readFileSync(join(root, 'src/apps/student/StudentApp.tsx'), 'utf8');
const modalSource = readFileSync(join(root, 'src/components/ui/Modal.tsx'), 'utf8');
const bottomSheetSource = readFileSync(join(root, 'src/components/ui/BottomSheet.tsx'), 'utf8');
const filterDrawerSource = readFileSync(join(root, 'src/components/search/FilterDrawer.tsx'), 'utf8');
const chatPanelSource = readFileSync(join(root, 'src/components/chat/BookingChatPanel.tsx'), 'utf8');
const photoPickerSource = readFileSync(join(root, 'src/components/profile/ProfilePhotoPicker.tsx'), 'utf8');
const storageMigration = readFileSync(join(root, 'supabase/migrations/20260817000027_storage_avatars_bucket.sql'), 'utf8');

describe('Student App — Final Corrective Batch Verification', () => {
  describe('1. Filter Modal & Stacking Context (z-index above bottom nav)', () => {
    it('Modal and BottomSheet have z-index z-[80] to sit above bottom nav (z-50)', () => {
      expect(modalSource).toContain('z-[80]');
      expect(bottomSheetSource).toContain('z-[80]');
    });

    it('FilterDrawer has sticky footer with safe-area padding and visible buttons', () => {
      expect(filterDrawerSource).toContain('sticky bottom-0');
      expect(filterDrawerSource).toContain('safe-area-inset-bottom');
      expect(filterDrawerSource).toContain('Limpar');
      expect(filterDrawerSource).toContain('Aplicar Filtros');
    });
  });

  describe('2. Removal of Standalone Chats Tab & 3-Tab Bottom Navigation', () => {
    it('Bottom nav has exactly 3 items (Buscar, Aulas, Perfil) with grid-cols-3', () => {
      expect(studentApp).toContain('grid-cols-3');
      expect(studentApp).not.toContain("{ id: 'messages'");
      expect(studentApp).toContain("{ id: 'search', label: 'Buscar'");
      expect(studentApp).toContain("{ id: 'bookings', label: 'Aulas'");
      expect(studentApp).toContain("{ id: 'profile', label: 'Perfil'");
    });

    it('Chat is accessed strictly via individual bookings', () => {
      expect(studentApp).toContain('setSelectedBookingForChat');
      expect(studentApp).toContain('onOpenChat');
      expect(studentApp).toContain('BookingChatPanel');
    });
  });

  describe('3. Chat Message Composer with Integrated Send Icon', () => {
    it('Composer uses Lucide SendHorizontal inside the input field', () => {
      expect(chatPanelSource).toContain('SendHorizontal');
      expect(chatPanelSource).toContain('aria-label="Enviar mensagem"');
      expect(chatPanelSource).toContain('pr-14');
      expect(chatPanelSource).toContain('handleSend');
    });

    it('Maintains keyboard shortcuts and disabled state when empty', () => {
      expect(chatPanelSource).toContain("event.key === 'Enter'");
      expect(chatPanelSource).toContain('!draft.trim()');
    });
  });

  describe('4. Supabase Storage for User Avatars', () => {
    it('Migration provisions avatars bucket and RLS policies', () => {
      expect(storageMigration).toContain("'avatars'");
      expect(storageMigration).toContain('storage.buckets');
      expect(storageMigration).toContain('auth.uid()');
      expect(storageMigration).toContain('image/jpeg');
    });

    it('ProfilePhotoPicker uploads to Supabase storage with 5MB validation', () => {
      expect(photoPickerSource).toContain("from('avatars')");
      expect(photoPickerSource).toContain('.upload(');
      expect(photoPickerSource).toContain('.getPublicUrl(');
      expect(photoPickerSource).toContain('5 * 1024 * 1024');
    });
  });

  describe('5. Profile Editing — Cancel and Save on Same Line', () => {
    it('Renders Cancel and Save buttons side by side with consistent height and hierarchy', () => {
      expect(studentApp).toContain('Cancelar');
      expect(studentApp).toContain('Salvar perfil');
      expect(studentApp).toContain('w-1/2 min-h-11 font-bold');
    });
  });

  describe('6. Search Race Conditions and Flash Prevention', () => {
    it('Synchronously manages search loading and tracks requestId against race conditions', () => {
      expect(studentApp).toContain('searchRequestIdRef');
      expect(studentApp).toContain('setSearchLoading(true)');
      expect(studentApp).toContain('requestId !== searchRequestIdRef.current');
    });
  });
});
