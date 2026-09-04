# AGENTS.md — Diretrizes para Agentes de IA e Desenvolvedores (Projeto MAZZI)

> **ATENÇÃO:** Este documento estabelece as regras obrigatórias e inegociáveis para qualquer agente de IA ou desenvolvedor trabalhando no repositório **MAZZI**.

---

## 1. Regras Fundamentais de Engenharia

1. **Leia a Documentação Primeiro**: Antes de alterar qualquer linha de código ou propor modificações, consulte `/docs/` e este arquivo.
2. **Não Invente Regras de Negócio**: Siga estritamente a especificação oficial em `/docs/`. Se houver uma lacuna, declare `REQUIRES_REGULATORY_VALIDATION` ou solicite alinhamento com o arquiteto/PO.
3. **Não Implemente Funcionalidades Fora do MVP**: Recursos como aulas teóricas, categorias C/D/E, veículo do aluno, pacotes de aulas, gamificação ou IA pedagógica estão explicitamente congelados para versões futuras.
4. **Backend é a Fonte da Verdade (Source of Truth)**: O frontend é uma interface de apresentação. Toda validação de disponibilidade, regras de transição de estado, RBAC, cálculos de preço e confirmação de pagamento residem e são garantidas no Backend.
5. **NUNCA Use Float para Dinheiro**: Todos os valores monetários devem ser manipulados e persistidos em centavos como inteiros (`integer`/`bigint`). Exemplo: R$ 100,00 = `10000`.
6. **NUNCA Permita Double Booking**: O sistema jamais pode permitir que um mesmo instrutor OU um mesmo veículo possua duas aulas sobrepostas no mesmo intervalo de tempo. A trava deve ser atômica e transacional no PostgreSQL.
7. **Pagamentos e Transações Devem Ser Idempotentes**: Webhooks, cobranças, reembolsos e payouts exigem chaves de idempotência (`idempotency_key`) para evitar execuções duplicadas.
8. **Nunca Confie no Frontend para Sucesso de Pagamento**: Um booking só transiciona para `CONFIRMED` após webhook/notificação criptograficamente assinada e verificada pelo backend via Gateway.
9. **Não Simule Integrações Governamentais Oficiais**: Diferencie claramente o "Registro interno MAZZI" de registros em órgãos públicos (DETRAN/SENATRAN). Não crie telas ou mocks fingindo integração oficial inexistente.
10. **Documentos Sensíveis Ficam em Storage Privado**: Nunca exponha URLs públicas permanentes de CNH, CRLV, certificados ou documentos de compliance. Utilize URLs assinadas com expiração temporária.
11. **Autorização Real (RBAC & Multi-tenant)**: Verifique permissões no backend para cada endpoint e recurso. Aluno A não acessa reserva de Aluno B; Autoescola A não tem visibilidade sobre Autoescola B; Staff não executa ações de Admin.
12. **Execução de Testes Obrigatória**: Antes de concluir qualquer sprint ou tarefa, execute a suíte de testes (`npm run test`) e garanta lint (`npm run lint`) e build (`npm run build`) 100% íntegros.
13. **Deploy Somente Validado**: Nunca publique qualquer alteração em um ambiente sem validar integralmente os gates aplicáveis. Quando houver solicitação de deploy, execute e confirme testes, lint, build, CI, baseline do banco e disponibilidade do ambiente publicado; se qualquer etapa falhar, interrompa a publicação até corrigir e validar novamente. Production permanece intocada salvo autorização explícita.
14. **Limpeza de Processos ao Finalizar**: Ao terminar a execução, identifique e encerre tarefas auxiliares e processos temporários que foram criados ou usados pela tarefa e que não estejam mais em uso, para evitar consumo desnecessário de memória. Preserve processos do sistema, processos do usuário, servidores DEV ainda necessários, túneis ativos e qualquer serviço cuja interrupção possa afetar o trabalho; valide os alvos antes de encerrá-los.

---

## 2. Padrões de Código e Arquitetura

- **Linguagem**: TypeScript rigoroso (`strict: true`).
- **Arquitetura Backend**: Monolito Modular bem delimitado por domínios.
- **Banco de Dados**: PostgreSQL + PostGIS (com suporte a restrições de exclusão temporal e índices espaciais).
- **Design System & Reuso de Componentes Visuais**:
  - **Obrigatório** reutilizar os componentes existentes em `src/components/ui/` (`Button`, `IconButton`, `BottomSheet`, `Modal`, `Badge`, `Card`, etc.) e os tokens/variáveis de cores oficiais (`var(--mazzi-*)`, `amber-*`, `emerald-*`, `slate-*`).
  - **O App Aluno (`src/apps/student/`) é a referência de UI/UX (benchmark padrão)** para todas as interfaces da plataforma (PRO/Instrutor, Admin, etc.).
  - Proibido criar tags HTML soltas (como `<button>` sem encapsulamento) — sempre utilize os componentes reutilizáveis do Design System.
- **Skill UI/UX Pro Max**:
  - Aplicar rigorosamente a skill **`ui-ux-pro-max`** em todas as alterações visuais: alvos de toque de no mínimo 44×44px, micro-interações fluidas (transições de 150ms a 300ms `ease-out`), suporte a gestos intuitivos (*swipe-down* para fechar drawers/bottom sheets), suporte a `prefers-reduced-motion` e ícones exclusivamente SVG (Lucide/Phosphor), sem o uso de emojis soltos.
- **Logs e Auditoria**: Registro estruturado de eventos críticos (`AuditLog`) com `actorId`, `action`, `entityType`, `previousValue`, `newValue`, `timestamp`, `ip`.
