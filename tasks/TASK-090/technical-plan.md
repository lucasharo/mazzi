# TASK-090 — Plano técnico

TASK: TASK-090
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-09-04

# Resumo Técnico

Preservar contratos de matching/checkout/tracking da TASK-089. Aplicar primeiro
a decisão explícita do usuário: B fixa no formulário atual, sem seleção de categoria.
O wizard completo usa três etapas visíveis: endereço, câmbio e valor.

# Código Existente Relacionado

- EXTEND InstantLessonModal: orquestra formulário e estados atuais.
- REUSE Select, Button, Modal, ConfirmableAddressAutocomplete e componentes instant.
- REUSE domínio e serviços de matching, pagamentos, cancelamento e mapa.
- Nenhuma dependência nova para fixar categoria; nenhuma nova tela de categoria.

# Arquivos Afetados

- MODIFY src/apps/student/components/InstantLessonModal.tsx.
- NEW tests/instant-lesson-category.test.tsx.
- MODIFY documentação da decisão e artefatos desta task.

# Banco de Dados & Migrations Afetadas

Nenhuma para categoria fixa: backend já restringe conversão a B.

# RLS e RBAC Afetados

Nenhum; não modificar contratos de autorização.

# Estratégia e Ordem de Implementação

1. Remover estado mutável e seletor de categoria. Usar literal tipado B nas
   consultas e criação já existentes, sem alterar tipos compartilhados A/B.
2. Preservar câmbio, endereço, teto, loading e recuperação existentes.
3. Testar ausência de seleção e envio B antes/depois de alterar câmbio.
4. Executar lint, testes e builds. Registrar resultado sem declarar wizard pronto.
5. Prosseguir na implementação integral do wizard em três etapas; não representar
   categoria como tela vazia, passo pulado visível ou escolha desabilitada.

# Testes Obrigatórios

Ausência de seletor A/B, preços consultados com B, busca criada com B e câmbio
selecionado, regressão de componentes instant, suíte completa, lint e build:all.

# Riscos e Mitigações

A tarefa maior ainda exige QA visual, recuperação e validação DEV completa.
Não publicar nem homologar a tarefa integral apenas pela alteração de categoria.

# O que NÃO Alterar

Enums A/B compartilhados, configuração do profissional, SQL, pagamento, privacidade,
arquivos locais alheios, servidores DEV/túneis e Production.

# Instruções para o MAZZI Dev

Mudança mínima para a decisão atual, padrões visuais existentes (ui-ux-pro-max),
sem bibliotecas novas. Não declarar todos os critérios do wizard como atendidos.
