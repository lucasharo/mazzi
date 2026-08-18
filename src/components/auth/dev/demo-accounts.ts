export type DevDemoAccount = { name: string; email: string; label: string; role: string };

const make = (names: string[], prefix: string, label: string, role: string): DevDemoAccount[] =>
  names.map((name, i) => ({
    name,
    email: `${prefix}${String(i + 1).padStart(2, '0')}@mazzi.com.br`,
    label,
    role,
  }));

export const STUDENT_DEMO_ACCOUNTS = make(
  [
    'Ana Beatriz Souza',
    'Bruno Henrique Lima',
    'Camila Ferreira Alves',
    'Daniel Martins Costa',
    'Eduarda Ribeiro Santos',
    'Felipe Gomes Rocha',
    'Gabriela Nunes Silva',
    'Henrique Almeida Prado',
    'Isabela Carvalho Mendes',
    'Joao Pedro Oliveira',
  ],
  'aluno',
  'Aluno',
  'STUDENT'
);

export const INSTRUCTOR_DEMO_ACCOUNTS = make(
  [
    'Carlos Eduardo Souza',
    'Fernanda Rocha Lima',
    'Marcos Vinicius Prado',
    'Renata Carvalho Silva',
    'Andre Barbosa Nunes',
    'Patricia Gomes Reis',
    'Diego Moreira Alves',
    'Aline Teixeira Costa',
  ],
  'instrutor',
  'Instrutor',
  'INSTRUCTOR'
);

export const SCHOOL_DEMO_ACCOUNTS = make(
  ['Autoescola Paulista', 'Autoescola Vila Mariana'],
  'autoescola',
  'Autoescola',
  'SCHOOL_ADMIN'
);

export const ADMIN_DEMO_ACCOUNTS: DevDemoAccount[] = [
  { name: 'Administrador MAZZI', email: 'admin@mazzi.com.br', label: 'Admin', role: 'PLATFORM_ADMIN' },
];
