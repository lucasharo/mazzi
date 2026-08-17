export type DevDemoAccount = { name: string; email: string; label: string };
export const DEV_QUICK_LOGIN_PASSWORD = 'Mazzi@2026!';
const make = (names: string[], prefix: string, label: string) => names.map((name, i) => ({ name, email: `${prefix}${String(i + 1).padStart(2, '0')}@mazzi.com.br`, label }));
export const STUDENT_DEMO_ACCOUNTS = make(['Ana Beatriz Souza','Bruno Henrique Lima','Camila Ferreira Alves','Daniel Martins Costa','Eduarda Ribeiro Santos','Felipe Gomes Rocha','Gabriela Nunes Silva','Henrique Almeida Prado','Isabela Carvalho Mendes','Joao Pedro Oliveira'], 'aluno', 'Aluno');
export const INSTRUCTOR_DEMO_ACCOUNTS = make(['Carlos Eduardo Souza','Fernanda Rocha Lima','Marcos Vinicius Prado','Renata Carvalho Silva','Andre Barbosa Nunes','Patricia Gomes Reis','Diego Moreira Alves','Aline Teixeira Costa'], 'instrutor', 'Instrutor');
export const SCHOOL_DEMO_ACCOUNTS = make(['Autoescola Paulista','Autoescola Vila Mariana'], 'autoescola', 'Autoescola');
export const ADMIN_DEMO_ACCOUNTS: DevDemoAccount[] = [{ name: 'Administrador MAZZI', email: 'admin@mazzi.com.br', label: 'Admin' }];
