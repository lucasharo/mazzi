# 12 — Aplicação MAZZI Pro (Instrutores e Autoescolas)

## Conceito Unificado com RBAC
Uma única aplicação web/PWA atende tanto o instrutor autônomo quanto a autoescola/CFC, adaptando o layout e permissões dinamicamente de acordo com o papel do usuário logado (`INSTRUCTOR`, `SCHOOL_ADMIN`, `SCHOOL_STAFF`).

## Visões e Funcionalidades

### 1. Dashboard do Instrutor Autônomo
- Status cadastral e de compliance (`ACTIVE`, `PENDING_REVIEW`, etc.).
- Próxima aula com contagem regressiva e botão de Check-in / Iniciar Aula.
- Resumo de aulas do dia e da semana.
- Ganhos acumulados e saldo disponível para repasse.
- Alertas de documentos a vencer.

### 2. Dashboard da Autoescola (CFC)
- Resumo operacional da frota e equipe de instrutores.
- Visão unificada de aulas do dia de todos os instrutores.
- Painel de gestão da equipe (`SCHOOL_ADMIN` gerencia instrutores e secretárias `SCHOOL_STAFF`).
- Gestão de frota (veículos categoria A/B, câmbio manual/automático, manutenção).
- Painel financeiro consolidado da autoescola.

### 3. Gestão de Agenda & Disponibilidade
- Visão por Instrutor ou por Veículo.
- Bloqueio de horários (férias, almoço, manutenção do carro).
- Criação de ofertas associando Veículo + Categoria + Duração + Preço em centavos.
