---
description: MAZZI Quick - pequenas correções com Dev e QA rápido
---

# MAZZI QUICK (/mazzi-quick)

> **WORKFLOW ÁGIL PARA AJUSTES DE BAIXO RISCO**  
> Ciclo simplificado em duas etapas: **MAZZI Dev** → **MAZZI QA Rápido**.  
> Projetado para pequenas correções visuais, textos e bugs pontuais sem necessidade de documentação formal de task.

---

## 1. Quando USAR Este Workflow

- Ajustes de textos, rótulos e mensagens de feedback;
- Correções de espaçamento, padding, margin e alinhamento;
- Ajustes finos de cores, bordas e sombras no CSS/Tailwind;
- Troca ou adição de ícones (Lucide);
- Pequenos ajustes de componentes visuais isolados;
- Correção de bugs pontuais e estritamente delimitados com comportamento óbvio.

---

## 2. Quando NÃO USAR (Bloqueio Mandatório)

**NUNCA use `/mazzi-quick` para:**
- Autenticação ou fluxo de Login/Cadastro/Recuperação de Senha;
- Alterações em schemas do Supabase ou banco de dados PostgreSQL;
- Políticas de Row Level Security (RLS) ou funções de RBAC;
- Criação ou aplicação de migrations;
- Regras de segurança, criptografia ou storage de documentos;
- Validação de CPF, Data de Nascimento ou dados pessoais (LGPD);
- Regras de pagamentos, cobranças, taxas ou reembolsos;
- Fluxo de agendamento (Booking), slots ou disponibilidade;
- Políticas de cancelamento;
- Novas regras de negócio ou alterações comerciais;
- Mudanças arquiteturais ou criação de novas dependências.

> [!CAUTION]
> **REGRA DE BLOQUEIO**: Se a solicitação do usuário envolver qualquer um dos temas acima, **NÃO implemente** via `/mazzi-quick`. Responda imediatamente instruindo o uso do workflow completo: **`/mazzi-feature`**.

---

## 3. Estrutura de Execução

### ETAPA 1 — MAZZI DEV (Implementação Enxuta)
Ao iniciar:
1. Ler [`.agents/agents.md`](../agents.md);
2. Ler [`.agents/roles/dev.md`](../roles/dev.md);
3. Consultar **apenas** a documentação e os arquivos de código diretamente relacionados à solicitação (economia de contexto);
4. Se envolver interface do usuário (UI), consultar a Skill **`ui-ux-pro-max`** e manter os padrões MAZZI Premium V2;
5. Implementar a **menor alteração possível** que resolva o problema;
6. **Não ampliar escopo** nem realizar refatorações não solicitadas;
7. Executar testes unitários relacionados à área afetada;
8. Executar `npm run lint` quando houver alteração em arquivos TypeScript/TSX;
9. **Nunca declarar a tarefa como DONE.**

---

### ETAPA 2 — MAZZI QA (Auditoria Rápida e Independente)
Após a implementação do Dev:
1. Abandonar a perspectiva do Dev e assumir postura crítica de auditor;
2. Ler [`.agents/roles/qa.md`](../roles/qa.md);
3. **Não confiar no relatório do Dev**: revisar o `git diff` real;
4. Verificar se a solicitação foi estritamente atendida sem sobras;
5. Buscar proativamente regressões óbvias em telas ou módulos vizinhos;
6. Se houver UI, verificar:
   - Viewports mobile (**375px**, **390px**, **430px**);
   - Touch targets mínimos (>= 44px);
   - Acessibilidade básica (`aria-label`, contraste e navegação por teclado);
   - Harmonia visual com o design system MAZZI Premium V2;
7. Confirmar ausência de erros no TypeScript (`tsc --noEmit`) e integridade dos testes.

> **Loop de Correção**: Se o QA encontrar falhas ou regressões, devolva para o Dev corrigir antes de finalizar.

---

## 4. Resultado Final do Workflow

O relatório de encerramento do `/mazzi-quick` deve apresentar exclusivamente um dos dois vereditos:

```
Veredito: QUICK APPROVED
```
*ou*
```
Veredito: QUICK REJECTED
```

### Formato de Resposta:
- **Status**: `QUICK APPROVED` ou `QUICK REJECTED`
- **Arquivos Alterados**: Lista de caminhos modificados
- **Testes Executados**: Lista de comandos e testes validados
- **Bugs Encontrados**: Detalhamento se houver reprovação
- **Riscos Restantes**: Avaliação objetiva de impacto

*(Nota: O termo `DONE` nunca deve ser emitido neste workflow, pois é restrito ao Tech Lead no workflow formal `/mazzi-feature`)*.
