# MAZZI Orchestrator — Guia de Fluxo e Orquestração

> **MISSÃO**: Coordenar e garantir o fluxo sequencial entre os agentes especializados do MAZZI, assegurando que nenhum portão de qualidade ou separação de responsabilidade seja violado.

---

## 1. Fluxo de Vida de uma Task

```
  [ INÍCIO DA DEMANDA ]
           │
           ▼
┌───────────────────────┐
│     MAZZI Product     │ ──> Cria tasks/TASK-XXX/requirement.md (STATUS: PRODUCT_READY)
└───────────────────────┘
           │
           ▼
┌───────────────────────┐
│    MAZZI Tech Lead    │ ──> Cria tasks/TASK-XXX/technical-plan.md (STATUS: TECH_READY)
└───────────────────────┘
           │
           ▼
┌───────────────────────┐
│       MAZZI Dev       │ ──> Implementa, roda lint/test/build e cria
└───────────────────────┘     tasks/TASK-XXX/implementation-report.md (STATUS: READY_FOR_QA)
           │
           ▼
┌───────────────────────┐
│       MAZZI QA        │ ──> Audita requisitos, tenta quebrar a implementação e cria
└───────────────────────┘     tasks/TASK-XXX/qa-report.md
           │
     ┌─────┴────────────────┐
     ▼                      ▼
[ REPROVADO ]          [ APROVADO ]
     │                      │
     ▼                      ▼
┌───────────────────────┐ ┌───────────────────────┐
│  Volta para Tech Lead │ │    MAZZI Tech Lead    │ ──> Emite tasks/TASK-XXX/final-review.md
│     e depois Dev      │ └───────────────────────┘     e declara STATUS: DONE
└───────────────────────┘
```

---

## 2. Regras Invioláveis do Workflow

1. **Separação Rígida**:
   - Product define **O QUE**;
   - Tech Lead planeja **COMO** e aprova no **FINAL**;
   - Dev **PROGRAMA** e **TESTA LOCALMENTE**;
   - QA **AUDITA** e **TENTA QUEBRAR**.
2. **Ninguém Pula Etapas**:
   - O Dev nunca programa sem `technical-plan.md`;
   - O código nunca vai para merge sem `qa-report.md`;
   - Apenas o Tech Lead pode declarar uma task como `DONE`.
3. **Economia de Contexto**:
   - Os agentes não devem varrer o repositório inteiro;
   - Cada agente inicia lendo as fontes canônicas (`MVP_RULES.md`, `ARCHITECTURE.md`, `SECURITY_RULES.md`) e os arquivos da task correspondente (`requirement.md`, `technical-plan.md`, `implementation-report.md`, `qa-report.md`).
