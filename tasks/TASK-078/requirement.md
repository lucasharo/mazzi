# TASK-078 — Redesign do Admin e reconciliação de governança

TASK: TASK-078
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-26

## Objetivo

Alinhar integralmente o MAZZI Admin ao padrão premium de Aluno e PRO, preservando todas as capacidades administrativas e corrigindo fluxos de governança hoje incompletos ou inconsistentes.

## Problema

O Admin possui visual, feedback, status e comportamentos diferentes dos demais apps. Há labels técnicos, refresh bloqueante, ações nativas por `alert()`, inconsistências potenciais entre selects e o banco, ausência de visualização segura de documentos, falha de configurações e fluxo incompleto para administradores e suporte.

## Usuários afetados

PLATFORM_ADMIN, SUPPORT, INSTRUCTOR, SCHOOL_ADMIN e usuários em fluxos administrativos correlatos.

## Escopo

- Reutilizar componentes, tokens e padrões de Aluno/PRO no Admin.
- Redesenhar todas as áreas preservando: visão geral, prestadores, compliance, veículos, reservas, financeiro, analytics, usuários, auditoria, configurações, perfil e notificações.
- Reconciliar filtros, selects, badges e tipos com os domínios reais do Supabase DEV.
- Apresentar labels amigáveis, sem enums, códigos internos ou paths técnicos na UX principal.
- Implementar refresh stale-while-revalidate e feedback não bloqueante.
- Substituir `alert()` do Admin por feedback compartilhado.
- Implementar visualização segura de documento privado para usuários autorizados.
- Corrigir configurações administrativas com RBAC, persistência e auditoria.
- Permitir a um PLATFORM_ADMIN adicionar PLATFORM_ADMIN ou SUPPORT de modo seguro, idempotente e multi-role.
- Cobrir responsividade, acessibilidade, testes e smoke em Cloudflare DEV.

## Fora de escopo

- Production, `main`, pagamentos reais e qualquer service role no frontend.
- Tornar storage público, expor paths/URLs permanentes ou reduzir RLS/RBAC.
- Remover funcionalidades existentes, criar um novo design system ou alterar apps Aluno/PRO fora de componentes compartilhados necessários.

## Regras de negócio

1. O banco é a autoridade para valores de status e transições permitidas.
2. `UNDER_REVIEW` não pode ser reintroduzido; compliance/veículo usam `IN_REVIEW` quando previsto pelo domínio.
3. Filtro de status não é ação de transição.
4. APPROVED de documento não promove provider automaticamente para ACTIVE.
5. Apenas PLATFORM_ADMIN altera configurações ou concede funções administrativas.
6. SUPPORT não concede nem eleva roles administrativas.
7. Concessão administrativa preserva todas as roles legítimas já existentes e é idempotente.
8. A plataforma mantém ao menos um PLATFORM_ADMIN ativo.
9. Documento privado é visualizado somente por URL temporária/autorizada; bucket permanece privado.
10. Dados visíveis não desaparecem durante refresh em background; falha conserva o último estado válido.
11. Toda mensagem ao usuário deve ser em português natural e sem detalhes técnicos.

## Fluxo principal

1. PLATFORM_ADMIN acessa o Admin e vê dashboard e filas sem jargão técnico.
2. Atualiza dados: conteúdo anterior permanece visível e o ícone indica atualização discreta.
3. Analisa provider, documento ou veículo usando status e ações válidas.
4. Abre documento privado em viewer seguro.
5. Salva configuração permitida e recebe feedback amigável após persistência.
6. Adiciona usuário administrativo existente ou envia convite seguro a novo usuário, escolhendo Administrador da plataforma ou Suporte.

## Casos de borda e exceções

- Falha de refresh conserva dados e informa sem bloquear.
- Documento ausente, URL expirada, tipo não suportado ou usuário não autorizado recebem mensagem amigável sem vazamento.
- Payload de role arbitrária, suporte tentando conceder role, usuário comum e convite repetido são bloqueados/seguros.
- Valores inválidos de configuração não persistem.
- Em telas estreitas, listas densas usam cards ou rolagem controlada sem overflow horizontal da página.

## Estados de erro e mensagens

- Refresh: “Não foi possível atualizar os dados agora. As informações anteriores continuam disponíveis.”
- Documento: “Não foi possível abrir este documento agora.”
- Configuração: “Não foi possível salvar as configurações. Revise os valores e tente novamente.”
- Permissão: “Você não tem permissão para realizar esta ação.”
- Último admin: “A plataforma precisa manter pelo menos um administrador ativo.”

## Critérios de aceite

- **AC01**: Admin reutiliza componentes/tokens MAZZI e não cria identidade visual paralela.
- **AC02**: Todos os selects administrativos documentados usam apenas valores reais do banco ou “Todos” como filtro.
- **AC03**: Nenhum enum, domínio ou texto técnico aparece como informação principal.
- **AC04**: Refresh não desmonta conteúdo já carregado e falha preserva dados.
- **AC05**: Não há `alert()` no fluxo principal do Admin.
- **AC06**: Compliance permite visualização autorizada de PDF/imagem via acesso temporário, sem tornar o bucket público.
- **AC07**: PLATFORM_ADMIN salva configurações permitidas; SUPPORT e usuários comuns não.
- **AC08**: PLATFORM_ADMIN adiciona SUPPORT/PLATFORM_ADMIN preservando multi-role; operações proibidas são bloqueadas.
- **AC09**: Dashboard, filas, auditoria e financeiro usam textos amigáveis e responsivos.
- **AC10**: Testes, lint, builds, CI, baseline quando aplicável e smoke Cloudflare DEV passam; Production permanece intacta.

## Dependências

Supabase DEV `bhvpkgonhlujmxvwnxix`, Cloudflare DEV e componentes compartilhados existentes.

## Decisões pendentes

Nenhuma. Para usuário ainda inexistente, a implementação deve usar convite seguro de backend/Edge Function se o contrato atual não oferecer operação equivalente.

## Riscos de produto

Mudanças de RBAC, settings e storage exigem auditoria server-side. O redesign não pode ocultar ações que o backend ainda permite/nega de forma divergente.

## Handoff para Tech Lead

Auditar código e Supabase DEV antes de decidir migrations/RPCs. Preservar contratos e reutilizar componentes MAZZI compartilhados.
