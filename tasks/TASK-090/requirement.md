# TASK-090 — Aula Agora: wizard e matching automático

TASK: TASK-090
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-09-04

# Objetivo

Implementar a especificação anexada de experiência guiada: endereço,
câmbio e teto de preço, seguida de busca automática e acompanhamento. A imagem
é referência visual, não fonte de regras de categoria, pagamento ou disponibilidade.

# Problema

O preenchimento atual precisa de progressão clara, uma decisão por etapa,
preservação de respostas e integração com os estados reais da Aula Agora.

# Usuário Afetado

STUDENT e INSTRUCTOR; PLATFORM_ADMIN como alvo de regressão de build.

# Escopo

Wizard compartilhado de três etapas visíveis, mapa existente, preços reais do backend,
busca automática sem escolha de profissional, recuperação da solicitação ativa,
feedback de busca/aceite/pagamento/tracking e oferta com countdown no profissional.
Auditoria de dependências e componentes, testes, revisão QA e homologação antes
de commit, push e publicação pelo pipeline DEV canônico.

# Fora de Escopo

Production, bibliotecas concorrentes sem necessidade, preços/candidatos fictícios,
alteração automática do teto, enfraquecimento de RBAC, privacidade ou concorrência.

# Regras de Negócio

- Backend decide disponibilidade, primeiro aceite válido e preço congelado.
- Dinheiro em centavos inteiros; teto ilimitado representado por null.
- Não expor coordenadas exatas do profissional antes da autorização de tracking.
- Preservar confirmação de pagamento server-side e fluxo Stripe existente.
- Preservar agenda dinâmica, bloqueios disciplinares, exclusão de autorreserva,
  idempotência e proteção contra aulas sobrepostas.
- Categoria B selecionada automaticamente; etapa de categoria fora do fluxo por enquanto.
- Não exibir categoria A nem contar categoria como etapa no indicador de progresso.
- Ao fechar e abrir Aula Agora, começar no endereço e reinicializar câmbio,
  teto, etapa e estados transitórios. Persistir somente o último endereço
  confirmado e suas coordenadas, isolados por usuário na sessão. Voltar dentro
  do wizard continua preservando as respostas. Não cancelar nem duplicar uma
  solicitação ativa do backend para reiniciar o formulário.
- Revisão visual aprovada pelo usuário: fundo branco conforme imagem, controles
  amarelos e progresso sem rótulos visíveis de endereço/câmbio/valor. Os nomes
  permanecem acessíveis a leitores de tela. O experimento preto foi descartado.

# Fluxo Principal (Happy Path)

Endereço confirmado → câmbio compatível → teto real →
busca automática → aceite autoritativo → confirmação da aula/pagamento Stripe →
retorno com confirmação backend → detalhes e acompanhamento autorizado.

# Casos de Borda e Exceções

Localização negada, coordenadas inválidas, ausência de candidatos, expiração,
perda de concorrência, desconexão, refresh, duplo envio e pagamento pendente.
Voltar deve preservar respostas; nova busca não deve duplicar solicitação ativa.

# Estados de Erro e Mensagens Amigáveis

Erro inline com recuperação, sem alert/confirm/prompt nativos. Diferenciar
localização indisponível, nenhuma oferta, busca expirada, solicitação atendida e
reconexão; não fabricar estado de chegada nem pagamento confirmado.

# Critérios de Aceite

- AC01: três perguntas sequenciais (endereço, câmbio, valor), progresso, voltar e respostas preservadas; categoria não integra a navegação.
- AC02: endereço confirmado obrigatório e categoria/câmbio válidos de ponta a ponta.
- AC03: teto e contagens reais, sem limite e sem aumento automático de preço.
- AC04: nenhuma lista de candidatos; matching autoritativo e cancelamento da busca.
- AC05: refresh recupera solicitação ativa sem duplicação.
- AC06: dados reais do profissional encontrado, pagamento e tracking respeitam privacidade.
- AC07: oferta do profissional mantém prazo backend e resultado correto de concorrência.
- AC08: design MAZZI, componentes reaproveitados, acessibilidade e mobile 360–430px.
- AC09: testes de navegação, estados, regressão, lint e três builds aprovados.
- AC10: QA e revisão final aprovados antes de commit/push/DEV; Production intocada.

# Dependências

Implementação local TASK-089 e alterações preexistentes preservadas.
Especificação original: anexo `12cf1955-aad4-4e0b-9339-4fb374c14960/pasted-text.txt`.
Workflow: `.agents/workflows/mazzi-feature.md`.

# Decisões Pendentes

Nenhuma pendência de categoria. O usuário confirmou em 2026-09-04: manter
somente B, selecioná-la automaticamente e deixar a tela de categoria fora do
fluxo por enquanto. Esta instrução substitui a seção 11 e a etapa de categoria
da especificação anexada, mantendo a DEC-008.

Evidência concreta: `supabase/migrations/20260904131400_task_089_instant_match_booking_hold.sql`,
linhas 145–146, rejeita categoria diferente de B com `INVALID_PUBLIC_CATEGORY`.
Manter essa trava. A reativação da categoria A exigirá nova aprovação.

# Riscos de Produto

Mostrar A sem suporte integral resulta em uma busca que pode encontrar oferta
mas falhar no aceite. A imagem também usa descrição/ícone incorretos para A;
qualquer implementação deve usar motocicleta para A e automóvel para B.

# Handoff para Tech Lead

Decisão resolvida: seguir com B fixa sem seletor. A implementação completa do
wizard permanece sujeita aos demais critérios e gates; PRODUCT_READY não
significa feature concluída nem autorização para publicar código não validado.

# Evidência de execução inicial

- Branch: feature/premium-ui-v2; HEAD local e origin em
  d2c12ac4247de67676b9d5e9efce1d3536fa5147, ahead/behind 0/0.
- Working tree contém alterações e arquivos novos anteriores; preservados.
- Lista de stashes vazia no momento da inspeção.
- Nenhum código, dependência, banco ou ambiente alterado nesta etapa.
- QA, builds e deploy não executados para esta tarefa; não há declaração de conclusão.
- Nenhum processo auxiliar persistente criado nesta inspeção.
