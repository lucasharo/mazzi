# TASK-076 — MVP Closure

TASK: TASK-076
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-22

## Objetivo

Fechar os gaps do MVP identificados na especificação recebida: seleção completa de ofertas no Student, onboarding real de instrutor no PRO, paginação limitada do mapa, hardening/performance seguro no Supabase e operações administrativas reais dentro do modelo de autorização existente.

## Usuários afetados

STUDENT, INSTRUCTOR, SCHOOL_ADMIN e PLATFORM_ADMIN.

## Escopo

- Preservar todos os booking contexts até a escolha final de `offering_id`.
- Permitir seleção de instrutor e oferta em todos os contextos autônomos e de autoescola.
- Implementar cadastro de instrutor sem autoaceitar convites ou criar senha por autoescola.
- Permitir que um usuário existente adicione apenas o próprio papel `INSTRUCTOR`, de forma idempotente e auditável.
- Carregar páginas adicionais de resultados no mapa até um limite explícito e seguro, respeitando filtros e protegendo contra race conditions.
- Corrigir search paths inseguros e aplicar apenas hardening/performance de banco comprovadamente seguro, sempre em migrations forward-only.
- Habilitar operações Admin existentes somente quando houver RPC transacional com RBAC, auditoria e idempotência.
- Manter pagamento exclusivamente `MOCK_VALIDATION`/fake.
- Homologar Student, PRO e Admin em browser mobile e desktop, publicar Git/Supabase/Cloudflare Pages e atualizar os ambientes DEV.

## Fora de escopo

- Gateway real, Mercado Pago, movimentação de dinheiro real.
- Categorias C/D/E, veículo do aluno, pacotes, gamificação, IA ou integrações DETRAN/SENATRAN.
- Redesign geral ou refatoração estrutural dos arquivos grandes.
- Alteração de migrations já aplicadas ou relaxamento de RLS/RBAC.

## Regras de negócio

- Category B continua sendo a categoria pública do MVP.
- A unidade final da contratação é a oferta; ofertas distintas não podem ser deduplicadas apenas por veículo.
- Booking deve preservar `provider_id`, `instructor_id`, `vehicle_id`, `offering_id`, `quote_id` e `selection_mode = SPECIFIC_INSTRUCTOR`.
- Apenas provider, veículo, compliance, membership e offering elegíveis podem aparecer na busca.
- CPF válido, único e protegido; data de nascimento exige idade mínima de 18 anos; telefone é obrigatório.
- Nenhum usuário comum pode elevar a própria role ou atribuir roles administrativas.
- Double booking de instrutor ou veículo permanece proibido no backend.

## Critérios de aceite

- AC01–AC10: Student seleciona corretamente instrutor, veículo e oferta em todos os casos de multiplicidade descritos na task, incluindo mesmo veículo com ofertas diferentes.
- AC11: Slot pré-selecionado incompatível não é reutilizado.
- AC12: Checkout recebe a oferta final e mantém a atribuição completa do booking.
- AC13–AC19: Novo instrutor pode criar conta, confirmar OTP e obter provider próprio sem elegibilidade pública automática; CPF, idade, role e convite são validados.
- AC20–AC24: Usuário Student existente pode adicionar somente o próprio papel INSTRUCTOR; tentativa de role privilegiada é bloqueada e o fluxo é idempotente/auditável.
- AC25–AC29: Mapa carrega páginas adicionais até `MAX_MAP_RESULTS`, reinicia coleção em filtro/localização, não mistura requests antigos e não duplica markers.
- AC30–AC36: Hardening de search path, grants, índices, RLS initplan e policies preserva a semântica de autorização; PostGIS permanece inalterado.
- AC37–AC42: Operações Admin permitidas são transacionais, RBAC-protegidas, auditáveis e idempotentes; refund continua fake e limitado ao valor pago.
- AC43: Testes locais, browser smoke, migrations LIVE, Git CI e os três projetos DEV do Cloudflare Pages são validados sem P0/P1 conhecido.

## Decisões resolvidas

- O provider inicial de novo instrutor usa o estado canônico `DRAFT`; não é publicamente vendável antes das validações.
- O mapa usa `MAX_MAP_RESULTS = 50`, com deduplicação por provider.

## Handoff para Tech Lead

Mapear funções, enums, grants e policies existentes antes de qualquer migration. Dividir a implementação em mudanças pequenas e reversíveis, validando cada domínio isoladamente.
