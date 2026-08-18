---
description: MAZZI Feature - ciclo completo Product, Lead, Dev, QA e Lead
---

# MAZZI FEATURE (/mazzi-feature)

> **WORKFLOW COMPLETO DE DESENVOLVIMENTO ORIENTADO A AGENTES**  
> Ciclo rigoroso de 5 etapas: **MAZZI Product** → **MAZZI Tech Lead** → **MAZZI Dev** → **MAZZI QA** → **MAZZI Tech Lead (Final Review)**.  
> Obrigatório para qualquer mudança de médio ou alto risco, regras de negócio ou componentes de infraestrutura.

---

## 1. Quando Este Workflow é Mandatório

- Desenvolvimento de novas features ou telas;
- Alteração ou criação de regras de negócio;
- Módulo de Autenticação (Auth), cadastro de usuários e recuperação de senha;
- Fluxos de OTP, validação de CPF, Data de Nascimento e dados sensíveis (LGPD);
- Alterações em schemas do Supabase ou PostgreSQL;
- Criação e aplicação de novas migrations;
- Políticas de Row Level Security (RLS) e regras de RBAC;
- Agendamento de aulas (Booking), slots, disponibilidade e horizonte de 60 dias;
- Regras e políticas de cancelamento e reembolso;
- Integrações e cálculos de pagamentos, taxas e split;
- Segurança, integridade de storage e URLs privadas;
- Mudanças arquiteturais ou refatorações de médio/alto risco.

---

## 2. Ciclo de Execução em 5 Etapas

```
[ ETAPA 0: TASK ] ──────────► Descoberta do próximo ID em tasks/TASK-XXX/
       │
       ▼
[ ETAPA 1: PRODUCT ] ───────► tasks/TASK-XXX/requirement.md (STATUS: PRODUCT_READY)
       │
       ▼
[ ETAPA 2: TECH LEAD ] ─────► tasks/TASK-XXX/technical-plan.md (STATUS: TECH_READY)
       │
       ▼
[ ETAPA 3: DEV ] ───────────► Implementa, testa e cria implementation-report.md (STATUS: READY_FOR_QA)
       │
       ▼
[ ETAPA 4: QA ] ────────────► Audita adversariamente e cria qa-report.md (APROVADO / REPROVADO)
       │
   ┌───┴────────────────────────┐
   ▼                            ▼
[ REPROVADO ]              [ APROVADO ]
   │                            │
   ▼                            ▼
Tech Lead → Dev            [ ETAPA 5: TECH LEAD FINAL REVIEW ]
→ QA novamente                  │
                                ▼
                           tasks/TASK-XXX/final-review.md (STATUS: DONE)
```

---

### ETAPA 0 — INICIALIZAÇÃO DA TASK

Ao receber o comando `/mazzi-feature <solicitação>`:
1. Inspecionar o diretório `tasks/` para identificar o próximo número sequencial disponível (`TASK-001`, `TASK-002`, etc.);
2. Criar o diretório isolado: `tasks/TASK-XXX/`;
3. **Nunca sobrescrever** nenhuma task existente.

---

### ETAPA 1 — MAZZI PRODUCT (Definição de Requisitos)

> **Regra**: Abandone qualquer perspectiva técnica ou de implementação.

### ETAPA 1 — MAZZI PRODUCT (Definição de Requisitos)

> **Regra**: Abandone qualquer perspectiva técnica ou de implementação.

1. Ler [`.agents/roles/product.md`](../roles/product.md), [`docs/product/MVP_RULES.md`](../../docs/product/MVP_RULES.md) e [`docs/product/PRODUCT_DECISIONS.md`](../../docs/product/PRODUCT_DECISIONS.md);
2. Transformar a solicitação em requisitos determinísticos e testáveis;
3. Gerar o arquivo: `tasks/TASK-XXX/requirement.md`;
4. **Conteúdo Obrigatório**:
   - Cabeçalho: `TASK`, `STATUS: PRODUCT_READY`, `OWNER: MAZZI Product`, `LAST_UPDATED`;
   - `# Objetivo`
   - `# Problema`
   - `# Usuário Afetado` (`STUDENT`, `INSTRUCTOR`, `SCHOOL_ADMIN`, `PLATFORM_ADMIN`)
   - `# Escopo` (o que entra nesta entrega)
   - `# Fora de Escopo` (o que explicitamente NÃO entra)
   - `# Regras de Negócio` (contratos mandatórios)
   - `# Fluxo Principal (Happy Path)`
   - `# Casos de Borda e Exceções`
   - `# Estados de Erro e Mensagens Amigáveis`
   - `# Critérios de Aceite` numerados e testáveis (`AC01`, `AC02`, `AC03`...)
   - `# Dependências`
   - `# Decisões Pendentes`
   - `# Riscos de Produto`
   - `# Handoff para Tech Lead`

> [!CAUTION]
> Se houver lacuna ou regra de negócio indefinida: **PARE**. Registre `[DECISÃO DE PRODUTO NECESSÁRIA]` e solicite alinhamento antes de permitir que o Tech Lead planeje.

---

### ETAPA 2 — MAZZI TECH LEAD (Planejamento Técnico)

> **Regra**: Abandone a perspectiva Product. O foco é segurança, arquitetura e integridade.

1. Ler [`.agents/roles/tech-lead.md`](../roles/tech-lead.md), `tasks/TASK-XXX/requirement.md`, [`docs/architecture/ARCHITECTURE.md`](../../docs/architecture/ARCHITECTURE.md) e [`docs/architecture/SECURITY_RULES.md`](../../docs/architecture/SECURITY_RULES.md);
2. Inspecionar o código e módulos existentes relacionados;
3. Gerar o arquivo: `tasks/TASK-XXX/technical-plan.md`;
4. **Conteúdo Obrigatório**:
   - Cabeçalho: `TASK`, `STATUS: TECH_READY`, `OWNER: MAZZI Tech Lead`, `LAST_UPDATED`;
   - `# Resumo Técnico`
   - `# Código Existente Relacionado`
   - `# Arquivos Afetados` (`[NEW]`, `[MODIFY]`, `[DELETE]`)
   - `# Banco de Dados & Migrations Afetadas`
   - `# RLS e RBAC Afetados`
   - `# Estratégia de Implementação` (passo a passo)
   - `# Ordem de Implementação`
   - `# Testes Obrigatórios`
   - `# Riscos e Mitigações`
   - `# O que NÃO Alterar` (módulos vizinhos e contratos congelados)
   - `# Instruções para o MAZZI Dev`

> [!NOTE]
> Se o Tech Lead encontrar ambiguidade de produto ou inconsistência de negócio: emitir status `RETURN_TO_PRODUCT` e devolver para o MAZZI Product.

---

### ETAPA 3 — MAZZI DEV (Implementação e Testes Locais)

> **Regra**: Abandone a perspectiva do Tech Lead. Implemente SOMENTE o escopo aprovado.

1. Ler [`.agents/roles/dev.md`](../roles/dev.md), `requirement.md`, `technical-plan.md`, `MVP_RULES.md`, `ARCHITECTURE.md` e `SECURITY_RULES.md`;
2. Se envolver interface do usuário (UI), utilizar obrigatoriamente a Skill **`ui-ux-pro-max`** e manter os tokens do MAZZI Premium V2;
3. **Diretrizes de Engenharia**:
   - Mudanças mínimas e controladas;
   - TypeScript em modo estrito (`strict: true`);
   - Preservar RLS/RBAC ativas;
   - `service_role` **NUNCA** no frontend;
   - Tratar o frontend como interface de apresentação (validação real no Backend/PostgreSQL);
   - Criar **novas migrations** sequenciais sem alterar migrations aplicadas;
   - Nunca utilizar `float` para dinheiro (usar centavos inteiros);
4. Executar os portões de qualidade locais:
   - `npm run lint` (`tsc --noEmit`): 0 erros;
   - `npm test`: 100% de aprovação;
   - `npm run build:all`: builds íntegros dos 3 apps (`student`, `instructor`, `admin`);
   - Testes e validações reais com Supabase quando aplicável;
5. Gerar o arquivo: `tasks/TASK-XXX/implementation-report.md`;
6. **Conteúdo Obrigatório**:
   - Cabeçalho: `TASK`, `STATUS: READY_FOR_QA`, `OWNER: MAZZI Dev`, `LAST_UPDATED`;
   - `# O que foi Implementado`
   - `# Arquivos Alterados`
   - `# Migrations Criadas e Aplicadas`
   - `# Decisões Técnicas Tomadas`
   - `# Desvios do Plano Técnico`
   - `# Testes Adicionados`
   - `# Testes Executados`
   - `# Resultado do Lint`
   - `# Resultado do Build Student`
   - `# Resultado do Build Instructor`
   - `# Resultado do Build Admin`
   - `# Testes Manuais Realizados`
   - `# Limitações e Riscos Conhecidos`
   - `# Handoff para QA`

> [!WARNING]
> O MAZZI Dev **NUNCA** pode declarar uma TASK como `DONE`.

---

### ETAPA 4 — MAZZI QA (Auditoria Independente e Caça a Falhas)

> **Regra**: Abandone completamente a mentalidade do Dev. Assuma uma postura adversária: **a implementação pode conter falhas ocultas**.

1. Ler [`.agents/roles/qa.md`](../roles/qa.md) e [`docs/qa/QA_STRATEGY.md`](../../docs/qa/QA_STRATEGY.md);
2. Ler `requirement.md` e `technical-plan.md` antes de olhar o relatório do Dev;
3. Inspecionar o `git diff` real e o comportamento no banco/navegador;
4. Avaliar individualmente cada critério de aceite (`AC01`, `AC02`...) com veredito `PASS` ou `FAIL`;
5. **Cenários Mandatórios de Teste**:
   - Happy Path e Negative Paths (entradas nulas, dados inválidos, limites numéricos);
   - Isolamento de dados multi-tenant e RLS (tentativas de acesso cruzado entre usuários);
   - Escalação de privilégios (bloqueio de injeção de roles no payload/user_metadata);
   - Estados de tela (`LOADING`, `EMPTY`, `ERROR`, `SUCCESS`, `DISABLED`);
   - Double submit e concorrência;
   - Viewports mobile (**375px**, **390px**, **430px**), touch targets (>= 44px) e acessibilidade;
   - Regressões em módulos vizinhos;
6. Gerar o arquivo: `tasks/TASK-XXX/qa-report.md`;
7. **Conteúdo Obrigatório**:
   - Cabeçalho: `TASK`, `STATUS: QA_APPROVED` (ou `QA_REJECTED`), `OWNER: MAZZI QA`, `LAST_UPDATED`;
   - `# Resultado` (`APROVADO`, `APROVADO COM RESSALVAS` ou `REPROVADO`);
   - `# Ambiente Auditado`;
   - `# Critérios de Aceite` (`AC01 — PASS/FAIL`...);
   - `# Happy Path`;
   - `# Negative Tests`;
   - `# Segurança e RLS/RBAC`;
   - `# Mobile e Responsividade`;
   - `# Acessibilidade (a11y)`;
   - `# Regressão`;
   - `# Bugs Encontrados` (`BUG-XXX` com Severidade, Passos, Esperado, Atual, Evidência);
   - `# Riscos Identificados`;
   - `# Recomendação para o Tech Lead`.

#### Matriz de Severidade de Bugs:
- `BLOCKER`: Impede o fluxo principal → **Reprovação Automática**.
- `CRITICAL`: Falha de segurança, quebra de RLS ou corrupção de dados → **Reprovação Automática**.
- `HIGH`: Regra central incorreta ou regressão funcional importante → **Reprovação** (salvo aceitação documentada pelo Tech Lead).
- `MEDIUM`: Problema funcional com workaround viável.
- `LOW`: Ajuste cosmético ou visual secundário.

---

### LOOP DE REPROVAÇÃO

Se o QA emitir o resultado `REPROVADO`:
1. O relatório retorna ao **MAZZI Tech Lead** para avaliação do impacto;
2. O Tech Lead direciona as correções prioritárias ao **MAZZI Dev**;
3. O Dev implementa as correções e submete novamente ao **MAZZI QA**;
4. Apenas após aprovação do QA o fluxo segue para o encerramento do Tech Lead.

---

### ETAPA 5 — MAZZI TECH LEAD (Homologação e Final Review)

> **Regra**: Somente o Tech Lead possui a prerrogativa de homologar tecnicamente e declarar a TASK como `DONE`.

1. Ler [`.agents/roles/tech-lead.md`](../roles/tech-lead.md);
2. Revisar integralmente `requirement.md`, `technical-plan.md`, `implementation-report.md`, `qa-report.md`, `git diff` e resultados de testes;
3. Gerar o arquivo: `tasks/TASK-XXX/final-review.md`;
4. **Conteúdo Obrigatório**:
   - Cabeçalho: `TASK`, `STATUS: DONE` (ou `RETURN_TO_DEV`), `OWNER: MAZZI Tech Lead`, `LAST_UPDATED`;
   - `# Resultado do QA`
   - `# Avaliação de Bugs e Riscos`
   - `# Avaliação de Segurança e RLS`
   - `# Avaliação Arquitetural`
   - `# Dívida Técnica Conscientemente Assumida`
   - `# Conformidade dos Critérios de Aceite`
   - `# Decisão Final` (`DONE`, `READY_FOR_MERGE` ou `RETURN_TO_DEV`)

#### Requisitos Mandatórios para Declarar `DONE`:
- QA aprovou a entrega;
- 100% dos Critérios de Aceite atendidos;
- Nenhum bug `BLOCKER` ou `CRITICAL`;
- Nenhum bug `HIGH` pendente sem justificativa aceita;
- `npm run lint` com 0 erros;
- `npm test` 100% aprovado;
- `npm run build:all` íntegro;
- Segurança e políticas RLS validadas;
- Riscos residuais formalmente documentados.

---

## 3. Relatório Final de Resumo ao Usuário

Ao concluir uma execução de `/mazzi-feature`, o agente deve apresentar uma tabela resumida com:

| Etapa | Responsável | Artefato Produzido | Status |
|---|---|---|---|
| **Requisitos** | MAZZI Product | `tasks/TASK-XXX/requirement.md` | `PRODUCT_READY` |
| **Plano Técnico** | MAZZI Tech Lead | `tasks/TASK-XXX/technical-plan.md` | `TECH_READY` |
| **Implementação** | MAZZI Dev | `tasks/TASK-XXX/implementation-report.md` | `READY_FOR_QA` |
| **Auditoria QA** | MAZZI QA | `tasks/TASK-XXX/qa-report.md` | `QA_APPROVED` |
| **Homologação** | MAZZI Tech Lead | `tasks/TASK-XXX/final-review.md` | **`DONE`** |

> **Diretriz de Transparência**: Nunca utilizar termos como *"100% perfeito"* ou ocultar ressalvas técnicas; apresente evidências objetivas e testes executados.
