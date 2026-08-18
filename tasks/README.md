# tasks/ — Gestão de Tarefas e Handoffs da Equipe MAZZI

Este diretório armazena os artefatos de documentação e handoff para cada entrega no repositório **MAZZI**.

---

## 1. Padrão de Nomenclatura

Cada nova demanda deve ser criada dentro de uma pasta numerada sequencialmente:
- `tasks/TASK-001/`
- `tasks/TASK-002/`
- `tasks/TASK-003/`
...

---

## 2. Artefatos Obrigatórios em Cada Task

Cada pasta `tasks/TASK-XXX/` deve conter os 5 arquivos de ciclo de vida:

| Ordem | Arquivo | Responsável | Status da Task |
|---|---|---|---|
| 1 | `requirement.md` | **MAZZI Product** | `PRODUCT_READY` |
| 2 | `technical-plan.md` | **MAZZI Tech Lead** | `TECH_READY` |
| 3 | `implementation-report.md` | **MAZZI Dev** | `READY_FOR_QA` |
| 4 | `qa-report.md` | **MAZZI QA** | `QA_APPROVED` / `QA_REJECTED` |
| 5 | `final-review.md` | **MAZZI Tech Lead** | `DONE` / `RETURN_TO_DEV` |

---

## 3. Como Iniciar uma Nova Task

1. Copie a pasta `tasks/TEMPLATE/` para `tasks/TASK-XXX/` (ex: `tasks/TASK-001/`);
2. Invoque o agente **MAZZI Product** para preencher `requirement.md`;
3. Siga o fluxo sequencial com os demais agentes.
