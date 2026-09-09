import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_PROFESSIONAL_TERMS_VERSION,
  PROFESSIONAL_TERMS_LEGAL_REVIEW_MARKER,
  PROFESSIONAL_TERMS_V2,
  serializeProfessionalTerms,
} from '../src/domain/professional-terms';

const migration = readFileSync('supabase/migrations/20260909220001_versioned_professional_terms.sql', 'utf8');
const viewer = readFileSync('src/components/provider/ProfessionalTermsViewer.tsx', 'utf8');

describe('TASK-093 professional terms', () => {
  it('publishes immutable v2 content with a stable hash and legal placeholders', () => {
    expect(CURRENT_PROFESSIONAL_TERMS_VERSION).toBe('v2');
    expect(PROFESSIONAL_TERMS_LEGAL_REVIEW_MARKER).toBe('LEGAL_ENTITY_DETAILS_REQUIRED_FOR_PRODUCTION');
    expect(PROFESSIONAL_TERMS_V2.displayVersion).toBe('2.0');
    expect(PROFESSIONAL_TERMS_V2.sections.length).toBeGreaterThanOrEqual(23);
    expect(PROFESSIONAL_TERMS_V2.sections.flatMap((section) => section.paragraphs).join(' ')).toContain('[RAZÃO SOCIAL DA EMPRESA]');
    expect(PROFESSIONAL_TERMS_V2.sections.flatMap((section) => section.paragraphs).join(' ')).toContain('[CNPJ]');
    expect(PROFESSIONAL_TERMS_V2.sections.flatMap((section) => section.paragraphs).join(' ')).toContain('[ENDEREÇO]');
    expect(PROFESSIONAL_TERMS_V2.documentHash).toBe(`sha256:${createHash('sha256').update(serializeProfessionalTerms(PROFESSIONAL_TERMS_V2)).digest('hex')}`);
  });

  it('keeps the backend version and hash authoritative without mass-downgrading active providers', () => {
    expect(migration).toContain("SELECT 'v2'::text");
    expect(migration).toContain('v_current_version text := public.current_mazzi_terms_version()');
    expect(migration).toContain('TERMS_VERSION_NOT_CURRENT');
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.provider_accept_mazzi_terms(uuid, text)");
    expect(migration).toContain("document_hash = 'sha256:c256a7d94920ada35d9a7ad6528cb38a1bf7cdd23e0e336d6b4c48eba2c8b69f'");
    expect(migration).toContain('Do not mass-downgrade active providers');
    expect(migration).not.toContain("SET status = 'DRAFT'::public.provider_status");
  });

  it('requires explicit acknowledgement and exposes an accessible full-text viewer', () => {
    expect(viewer).not.toContain('<Switch');
    expect(viewer).toContain('disabled={isAccepted || !hasReachedEnd || isAccepting}');
    expect(viewer).toContain('onScroll={updateReadProgress}');
    expect(viewer).toContain('aria-labelledby');
    expect(viewer).toContain('terms.sections.map');
    expect(viewer).toContain('PROFESSIONAL_TERMS_LEGAL_REVIEW_MARKER');
    expect(viewer).toContain('overflow-y-auto overscroll-contain');
    expect(viewer).toContain('ModalActionFooter');
    expect(viewer).toContain('portal');
    expect(viewer).not.toContain('footerVariant="wizard"');
  });
});
