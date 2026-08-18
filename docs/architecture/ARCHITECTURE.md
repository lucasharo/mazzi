# ARCHITECTURE.md — Arquitetura Técnica do MAZZI

> **VISÃO GERAL DA ARQUITETURA TÉCNICA (MAZZI Premium V2)**  
> Este documento descreve as decisões estruturais, stack tecnológica, padrões de camadas e contratos de engenharia do repositório.

---

## 1. Stack Tecnológica e Ferramental

| Camada | Tecnologia | Detalhes |
|---|---|---|
| **Linguagem** | TypeScript (Strict Mode) | `strict: true`, `noImplicitAny: true` |
| **Framework UI** | React 19 | Componentes funcionais, hooks e contextos |
| **Bundler / DevServer** | Vite 6 | Multi-app modes: `student`, `instructor`, `admin` |
| **Estilização** | Tailwind CSS v4 | CSS Tokens customizados (`--mazzi-*`) |
| **Ícones e Animações** | Lucide React + Motion | Ícones acessíveis e micro-interações |
| **Backend & DB** | PostgreSQL + PostGIS | Supabase gerenciado, RLS, Triggers e Índices Espaciais |
| **Autenticação** | Supabase Auth (GoTrue) | OTP de 6 dígitos, JWT, Session Hydration |
| **Testes** | Vitest | Testes unitários de domínio, RLS, schemas e UI |

---

## 2. Arquitetura Multi-App (Monolito Modular)

O repositório está organizado como um monolito modular em TypeScript suportando três aplicações especializadas que compartilham o mesmo domínio e design system:

```
src/
├── apps/
│   ├── student/        # App do Aluno (Busca, Agendamento, Aulas, Perfil)
│   ├── instructor/     # Portal do Instrutor (Agenda, Ofertas, Veículos, Ganhos)
│   └── admin/          # Painel Administrativo (Credenciamento, Moderação, Auditoria)
├── domain/             # Lógica de negócio pura e agnóstica de UI
│   ├── availability.ts # Slots, sobreposição e horizonte canônico (60 dias)
│   ├── search.ts       # Matching estrito de busca com geo-raio
│   ├── rbac.ts         # Resolução de permissões por perfil
│   ├── quote.ts        # Cálculo de preços e taxas em centavos
│   └── cancellation.ts # Políticas de cancelamento e reembolso
├── components/         # Design System e componentes compartilhados
│   ├── ui/             # Primitivas (Button, Input, OtpInput, Modal, BookingCard)
│   ├── auth/           # Telas de Login, Cadastro, OTP e AccessDenied
│   └── search/         # Filtros, drawer e cards de prestador
├── lib/                # Clientes de infraestrutura (Supabase, AuthService)
├── utils/              # Utilitários puros (CPF, Idade/Data, Dinheiro)
└── types/              # Definições de tipos TypeScript do sistema
```

---

## 3. Banco de Dados e Segurança de Dados

1. **PostgreSQL com PostGIS**:
   - Tabela `providers` armazena geolocalização como `GEOGRAPHY(Point, 4326)` para cálculos geodésicos em metros.
   - Restrições de exclusão temporal garantem que nenhum instrutor ou veículo possua horários conflitantes.
2. **Row Level Security (RLS)**:
   - Toda tabela possui RLS ativada por padrão (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
   - Usuários comuns acessam exclusivamente seus próprios registros (`auth.uid() = id` ou `auth.uid() = user_id`).
3. **Triggers de Integridade**:
   - Validações críticas de compliance (ex: validação matemática de CPF e idade mínima de 18 anos) são garantidas no banco de dados via triggers `BEFORE INSERT OR UPDATE`.

---

## 4. Padrões de Código e Qualidade

- **Valores Monetários**: Sempre manipulados em inteiros representando centavos (`10000` = R$ 100,00).
- **Tratamento de Erros**: Erros técnicos de infraestrutura não são exibidos diretamente ao usuário final; devem ser traduzidos para mensagens amigáveis em português claro.
- **Portões de Qualidade**: Todo ciclo de desenvolvimento exige:
  1. `npm run lint` (`tsc --noEmit`): 0 erros.
  2. `npm test`: 100% dos testes aprovados.
  3. `npm run build:all`: Compilação íntegra dos três apps (`student`, `instructor`, `admin`).
