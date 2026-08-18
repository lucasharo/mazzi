import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('TASK-009 — MAZZI Design System & Component Catalog Tests', () => {
  it('ModalActionFooter component exists and uses sticky white background', () => {
    const filePath = path.join(process.cwd(), 'src/components/ui/ModalActionFooter.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('bg-white');
    expect(content).toContain('sticky bottom-0');
    expect(content).toContain('env(safe-area-inset-bottom)');
  });

  it('Modal.tsx uses flush white footer overlay with safe area bottom padding', () => {
    const filePath = path.join(process.cwd(), 'src/components/ui/Modal.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('bg-white');
    expect(content).toContain('border-t');
    expect(content).toContain('env(safe-area-inset-bottom)');
  });

  it('FilterDrawer.tsx uses white modal footer prop with RotateCcw and Check icons', () => {
    const filePath = path.join(process.cwd(), 'src/components/search/FilterDrawer.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('footer={footerContent}');
    expect(content).toContain('RotateCcw');
    expect(content).toContain('Check');
  });

  it('BookingDetailsModal.tsx renders Chat and Cancel buttons side-by-side with font-bold and icons', () => {
    const filePath = path.join(process.cwd(), 'src/apps/student/components/BookingDetailsModal.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('w-1/2');
    expect(content).toContain('font-bold');
    expect(content).toContain('MessageSquare');
    expect(content).toContain('XCircle');
    expect(content).toContain('ArrowLeft');
  });

  it('ProviderApp.tsx renders Chat and Cancel buttons side-by-side with font-bold and icons', () => {
    const filePath = path.join(process.cwd(), 'src/apps/provider/ProviderApp.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('w-1/2');
    expect(content).toContain('font-bold');
    expect(content).toContain('MessageSquare');
    expect(content).toContain('Ban');
    expect(content).toContain('ArrowLeft');
  });

  it('DesignSystemShowcase.tsx contains catalog sections and responsive viewport selector', () => {
    const filePath = path.join(process.cwd(), 'src/apps/design-system/DesignSystemShowcase.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('MAZZI Design System');
    expect(content).toContain('foundations');
    expect(content).toContain('typography');
    expect(content).toContain('buttons');
    expect(content).toContain('icon-policy');
    expect(content).toContain('otp');
    expect(content).toContain('360px');
    expect(content).toContain('390px');
    expect(content).toContain('430px');
  });

  it('docs/DESIGN_SYSTEM.md documentation exists with official guidelines', () => {
    const filePath = path.join(process.cwd(), 'docs/DESIGN_SYSTEM.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('MAZZI OFFICIAL DESIGN SYSTEM');
    expect(content).toContain('Icon Usage Policy');
    expect(content).toContain('Modal Action Footer');
  });
});
