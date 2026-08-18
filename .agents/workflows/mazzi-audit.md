---
description: MAZZI Audit - auditoria independente QA seguida de Tech Lead
---

# MAZZI AUDIT (/mazzi-audit)

> **WORKFLOW DE AUDITORIA TÉCNICA E SEGURANÇA INDEPENDENTE**  
> Ciclo em duas etapas: **MAZZI QA** (auditoria adversarial) → **MAZZI Tech Lead** (triagem, classificação e priorização).  
> Projetado para auditar módulos existentes, caçar vulnerabilidades e verificar estabilidade **sem alterar código**.

---

## 1. Princípio Fundamental

> [!IMPORTANT]
> **AUDITORIA PURA (SEM ALTERAÇÃO DE CÓDIGO)**  
> O objetivo exclusivo deste workflow é diagnosticar, auditar e classificar problemas existentes.  
> **Nenhuma correção deve ser implementada automaticamente durante este workflow.** Correções devem ser encaminhadas posteriormente via `/mazzi-feature` ou `/mazzi-quick`.

---

## 2. Ciclo de Execução em 2 Etapas

```
[ COMANDO: /mazzi-audit <escopo> ]
                 │
                 ▼
      ┌─────────────────────┐
      │     MAZZI QA        │ ──► Audita adversariamente comportamento real,
      └─────────────────────┘     testa falhas e lista BUG-001, BUG-002...
                 │
                 ▼
      ┌─────────────────────┐
      │   MAZZI Tech Lead   │ ──► Valida achados, classifica status, define
      └─────────────────────┘     prioridades (P0-P3) e recomenda encaminhamentos
                 │
                 ▼
      [ RELATÓRIO DE AUDITORIA ] ──► Classificação Geral:
                                     - SEM BLOQUEADORES
                                     - ATENÇÃO
                                     - REPROVADO PARA RELEASE
```

---

### ETAPA 1 — MAZZI QA (Auditoria Adversarial de Comportamento Real)

> **Regra**: Assuma que o código existente contém falhas. Não confie em relatórios anteriores ou na suposição de que testes existentes cobrem tudo.

Ao iniciar:
1. Ler [`.agents/agents.md`](file:///d:/mazzi_premium_ui_v2/.agents/agents.md) e [`.agents/roles/qa.md`](file:///d:/mazzi_premium_ui_v2/.agents/roles/qa.md);
2. Ler a estratégia de testes canônica em [`docs/qa/QA_STRATEGY.md`](file:///d:/mazzi_premium_ui_v2/docs/qa/QA_STRATEGY.md);
3. **Auditar o Comportamento Real**:
   - Requisitos de negócio vs. implementação atual;
   - Integridade de tipos (`npm run lint` / `tsc --noEmit`);
   - Cobertura e assertividade da suíte de testes (`npm test`);
   - Compilação dos três apps (`npm run build:all`);
   - Módulo de Autenticação e integridade do Supabase Auth;
   - Validações de segurança no backend (triggers e RLS);
   - Isolamento multi-tenant (usuário A vs usuário B, anon, payload adulterado);
   - Tratamento e sigilo de dados pessoais (CPF, Data de Nascimento, LGPD);
   - Concorrência, duplicidade e double submit;
   - Viewports mobile (**375px**, **390px**, **430px**), touch targets (>= 44px) e acessibilidade;
   - Estados de erro, loading e telas vazias;
   - Riscos de regressão e performance.

4. Para cada problema identificado, gerar uma entrada estruturada `BUG-XXX`:
   - **Severidade**: `BLOCKER`, `CRITICAL`, `HIGH`, `MEDIUM` ou `LOW`;
   - **Arquivo / Componente**: Caminho exato do arquivo;
   - **Passos para Reproduzir**: Sequência clara para reprodução;
   - **Comportamento Esperado**: O que deveria ocorrer;
   - **Comportamento Atual**: O que ocorre de fato;
   - **Evidência**: Logs, erros de console ou payloads;
   - **Impacto**: Impacto operacional ou de segurança;
   - **Recomendação de Solução**: Sugestão técnica.

> [!WARNING]
> O QA **NUNCA** deve corrigir o código silenciosamente durante a auditoria.

---

### ETAPA 2 — MAZZI TECH LEAD (Revisão, Triagem e Priorização)

> **Regra**: Abandone a perspectiva do QA e atue como auditor sênior de arquitetura e risco.

Ao iniciar:
1. Ler [`.agents/roles/tech-lead.md`](file:///d:/mazzi_premium_ui_v2/.agents/roles/tech-lead.md), [`docs/architecture/ARCHITECTURE.md`](file:///d:/mazzi_premium_ui_v2/docs/architecture/ARCHITECTURE.md) e [`docs/architecture/SECURITY_RULES.md`](file:///d:/mazzi_premium_ui_v2/docs/architecture/SECURITY_RULES.md);
2. Revisar criticamente cada achado do QA;
3. Classificar o status técnico de cada bug:
   - `CONFIRMADO`: Problema real verificado e reproduzível;
   - `NÃO REPRODUZIDO`: Não foi possível reproduzir no ambiente auditado;
   - `FALSO POSITIVO`: Comportamento intencional ou restrição esperada pelo contrato;
   - `PRECISA INVESTIGAÇÃO`: Exige instrumentação ou diagnóstico aprofundado.

4. Atribuir a prioridade técnica:
   - **P0**: Vulnerabilidade crítica de segurança, vazamento de dados, quebra de RLS ou fluxo central bloqueado;
   - **P1**: Problema importante que deve ser resolvido antes do lançamento do MVP;
   - **P2**: Problema relevante com impacto moderado, mas sem bloqueio crítico;
   - **P3**: Melhoria cosmética, dívida técnica secundária ou refatoração recomendada.

5. Indicar a ação recomendada para cada item:
   - *Corrigir imediatamente via `/mazzi-feature`* (médio/alto risco);
   - *Corrigir via `/mazzi-quick`* (pequeno ajuste de baixo risco);
   - *Registrar como Dívida Técnica*;
   - *Registrar Decisão de Produto Pendente*;
   - *Nenhuma Ação*.

---

## 3. Formato de Saída Obrigatório do Relatório

Todo comando `/mazzi-audit` deve produzir o relatório final no formato:

```markdown
# Audit Scope
[Detalhamento do escopo e módulos auditados]

# QA Result
[Resumo executivo dos testes e validações executadas pelo QA]

# Bugs Encontrados
### BUG-001 — [Título do Bug]
- **Severidade**: [BLOCKER / CRITICAL / HIGH / MEDIUM / LOW]
- **Arquivo**: [caminho/arquivo.ts]
- **Como Reproduzir**: [passo a passo]
- **Esperado**: [comportamento correto]
- **Atual**: [comportamento observado]
- **Evidência**: [log/erro]
- **Impacto**: [risco associado]
- **Recomendação**: [sugestão de correção]

# Segurança
[Avaliação de vulnerabilidades, permissões, chaves e integridade de dados]

# RLS/RBAC
[Avaliação do isolamento multi-tenant e integridade das policies]

# Regressões
[Impacto ou riscos observados em outros fluxos da aplicação]

# Mobile / Acessibilidade
[Avaliação em viewports 375px/390px/430px, touch targets e atributos ARIA]

# Tech Lead Review
[Análise técnica do Tech Lead com status de cada bug: CONFIRMADO / FALSO POSITIVO...]

# Priorização
| Bug | Severidade | Classificação | Prioridade | Ação Recomendada |
|---|---|---|---|---|
| BUG-001 | CRITICAL | CONFIRMADO | P0 | /mazzi-feature |

# Próximos Passos
[Direcionamentos e recomendações para o usuário ou time de desenvolvimento]

# Resultado Geral
[Escolha exclusiva entre: SEM BLOQUEADORES | ATENÇÃO | REPROVADO PARA RELEASE]
```

*(Nota: O termo `DONE` nunca é utilizado neste workflow)*.
