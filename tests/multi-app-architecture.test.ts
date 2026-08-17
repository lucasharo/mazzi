import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('independent MAZZI app entrypoints', () => {
  it('exposes the three app roots and dedicated HTML entrypoints', () => {
    expect(read('index.student.html')).toContain('/src/entrypoints/student/main.tsx');
    expect(read('index.instructor.html')).toContain('/src/entrypoints/instructor/main.tsx');
    expect(read('index.admin.html')).toContain('/src/entrypoints/admin/main.tsx');
  });

  it('keeps each production root isolated from the other app implementations', () => {
    expect(read('src/entrypoints/student/StudentRoot.tsx')).not.toContain('ProviderApp');
    expect(read('src/entrypoints/student/StudentRoot.tsx')).not.toContain('AdminApp');
    expect(read('src/entrypoints/instructor/InstructorRoot.tsx')).not.toContain('StudentApp');
    expect(read('src/entrypoints/instructor/InstructorRoot.tsx')).not.toContain('AdminApp');
    expect(read('src/entrypoints/admin/AdminRoot.tsx')).not.toContain('StudentApp');
    expect(read('src/entrypoints/admin/AdminRoot.tsx')).not.toContain('ProviderApp');
  });

  it('uses publishable frontend credentials and rejects privileged browser keys', () => {
    expect(read('src/lib/supabase.ts')).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
    expect(read('src/lib/runtime-env.ts')).toContain('VITE_SUPABASE_SECRET_KEY');
    expect(read('.env.example')).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
    expect(read('.env.example')).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY=');
  });
});
