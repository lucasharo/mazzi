# MAZZI — Marketplace de Aulas Práticas de Direção

> **"Encontre. Agende. Dirija."**

MAZZI é uma plataforma brasileira que conecta alunos que precisam de aulas práticas de direção (Categorias A e B) a instrutores autônomos credenciados e autoescolas (CFCs) em São Paulo/SP.

---

## 🏛️ Arquitetura do Projeto

O projeto é estruturado em um **Monolito Modular** com três experiências de usuário desacopladas e integradas por um **Design System** coeso:

1. **MAZZI Aluno (`/src/apps/student`):** Interface mobile-first para busca com geolocalização, visualização de perfis e frotas, cotação com proteção contra expiração, checkout transparente, gerenciamento de aulas com check-in, chat e avaliações.
2. **MAZZI Pro (`/src/apps/provider`):** Painel unificado para Instrutores Autônomos e Autoescolas/CFCs com controle de acesso baseado em papéis (RBAC). Gerencia agenda por instrutor ou veículo, ofertas, frotas, compliance e financeiro.
3. **MAZZI Admin (`/src/apps/admin`):** Backoffice executivo e operacional para monitoramento da North Star Metric, taxa de conversão *Search-to-Booking*, fila de aprovação de documentos de compliance, gestão de disputas e trilha de auditoria imutável.

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+ ou 20+
- npm

### Instalação e Execução
```bash
# 1. Instalar dependências
npm install

# 2. Executar em modo desenvolvimento (Porta 3000)
npm run dev

# 3. Executar suíte de testes unitários e de domínio
npm run test

# 4. Executar verificação de tipos e lint
npm run lint

# 5. Gerar build de produção
npm run build
```

---

## 📚 Documentação Técnica

Consulte a pasta `/docs/` para a especificação detalhada:
- `docs/01-product.md` — Visão do produto e posicionamento
- `docs/02-mvp-scope.md` — Escopo rigoroso do MVP
- `docs/03-business-rules.md` — Regras de negócio inegociáveis
- `docs/04-architecture.md` — Arquitetura de software e módulos
- `docs/05-database.md` — Modelo relacional PostgreSQL + PostGIS
- `docs/06-api.md` — Contratos RESTful da API
- `docs/07-auth-rbac.md` — Autenticação e matriz RBAC
- `docs/08-booking.md` — Ciclo de vida da reserva e prevenção de double booking
- `docs/09-payments.md` — Pagamentos, comissão e repasses (Payouts)
- `docs/10-compliance.md` — Módulo de validação de fornecedores
- `docs/11-student-app.md` — Especificação do MAZZI Aluno
- `docs/12-provider-app.md` — Especificação do MAZZI Pro
- `docs/13-admin.md` — Especificação do MAZZI Admin
- `docs/14-security-lgpd.md` — Segurança e conformidade com a LGPD
- `docs/15-testing.md` — Estratégia de testes
- `docs/16-roadmap.md` — Funcionalidades planejadas pós-MVP
- `AGENTS.md` — Diretrizes obrigatórias para agentes e desenvolvedores
# Regras de produto

## Aulas do aluno

Reservas canceladas devem aparecer exclusivamente em **Histórico**. A aba de aulas confirmadas nunca deve exibir reservas com status de cancelamento (`CANCELLED_*`) nem payloads legados que contenham `cancelledAt`, `cancelledBy` ou `cancellationReason`, mesmo que o status recebido ainda seja `CONFIRMED`.

O mesmo contrato vale para o app PRO: a aba principal de aulas é **Confirmadas** e exibe somente reservas confirmadas; canceladas pertencem exclusivamente a **Histórico**.

Além do status, a classificação também é temporal: uma reserva cujo horário final já passou deve aparecer exclusivamente em **Histórico**. A aba **Confirmadas** (e o filtro **Hoje**) exibem apenas aulas confirmadas que ainda não terminaram. Essa regra vale para Student e PRO.
