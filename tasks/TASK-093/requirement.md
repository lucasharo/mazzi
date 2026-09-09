# TASK-093 — Termo versionado de adesão, uso e conduta do PRO

TASK: TASK-093
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-09-09

## Objetivo

Transformar o aceite do termo do PRO em uma experiência completa, versionada,
consultável e auditável, preservando os aceites históricos e exigindo novo
aceite quando uma versão relevante for publicada.

## Problema

O MAZZI registra o aceite atual, mas o profissional não consegue ler o termo
integral antes de aceitar, consultar o documento depois, identificar a versão
aceita ou saber quando o aceite ocorreu.

## Usuário Afetado

- `INSTRUCTOR`
- `SCHOOL_ADMIN` ou responsável autorizado pela autoescola/CFC
- `STUDENT`: não deve ter seu contexto ou identidade alterados por esta feature

## Escopo

- Publicar o conteúdo canônico do Termo de Adesão, Uso e Conduta do Profissional
  MAZZI na versão `v2`/`2.0`.
- Exibir resumo e acesso ao termo integral no MAZZI PRO.
- Exigir ação explícita de leitura/aceite, com checkbox desmarcado por padrão.
- Persistir versão, data/hora, identidade responsável e vínculo ao conteúdo
  imutável, sem apagar aceites `v1`.
- Permitir consulta posterior do termo e do histórico no Perfil/Gestão do PRO.
- Detectar versão atual pendente e manter o gate de ativação no backend.
- Servir o conteúdo localmente pelo bundle versionado; não depender de URL
  externa mutável.
- Manter placeholders de razão social, CNPJ e endereço sem inventar dados.

## Fora de Escopo

- Pagamentos reais, Mercado Pago ou qualquer chamada financeira real.
- Integração oficial com DETRAN/SENATRAN.
- Alteração do contexto ou das notificações do App Aluno.
- Aceite automático, aceite por abertura/scroll/timeout ou checkbox pré-marcado.
- Coleta automática de IP/user-agent.
- Disponibilização em produção antes de revisão jurídica e preenchimento dos
  dados empresariais.

## Regras de Negócio

1. Cada versão publicada é imutável.
2. Aceite de `v1` permanece preservado; o conteúdo de `v1` não será substituído.
3. A versão corrente desta entrega é `v2`/`2.0`.
4. O aceite deve ser explícito e server-side, validando usuário ativo,
   ownership/autorização e versão corrente.
5. Versão antiga, futura ou inexistente deve ser rejeitada pelo backend.
6. O mesmo aceite repetido deve ser idempotente.
7. A aceitação da versão corrente é requisito do lifecycle de ativação quando
   esse gate já existir.
8. A autoescola deve registrar a identidade humana autorizada que aceitou; não
   existe aceite automático da empresa.
9. Os dados empresariais ausentes permanecem como placeholders visíveis apenas
   em DEV e geram o marcador `LEGAL_ENTITY_DETAILS_REQUIRED_FOR_PRODUCTION`.
10. O termo deve deixar claro que é regra interna de marketplace e não
    homologação governamental.

## Fluxo Principal (Happy Path)

1. PRO abre o Perfil/Gestão e vê o status do termo atual.
2. PRO seleciona “Ler termo completo”.
3. O visualizador mostra versão, conteúdo integral e ação de retorno.
4. PRO marca manualmente “Li e aceito...” e seleciona “Aceitar e continuar”.
5. Backend valida a versão corrente e registra o aceite de forma idempotente.
6. Interface mostra versão aceita e data/hora do aceite.
7. O PRO pode abrir novamente o termo e consultar o histórico.

## Casos de Borda e Exceções

- Termo `v1` já aceito: manter histórico e mostrar `v2` como pendente.
- Aceite duplicado: retornar o aceite vigente sem criar corrupção.
- Versão enviada pelo cliente diferente da corrente: rejeitar.
- Usuário inativo, anônimo, sem ownership ou sem autorização de escola:
  rejeitar sem alterar dados.
- Dados empresariais não configurados: mostrar placeholder em DEV e bloquear
  apenas o gate de produção/documentação, não o desenvolvimento local.
- Falha de rede: preservar o checkbox apenas durante a sessão e mostrar erro;
  nunca afirmar aceite sem confirmação do backend.
- Termo longo em viewport de 375px: permitir leitura e navegação sem overflow
  horizontal.

## Estados de Erro e Mensagens Amigáveis

- `TERMS_VERSION_NOT_CURRENT`: “Este termo foi atualizado. Reabra a versão
  mais recente para continuar.”
- `FORBIDDEN`/ownership: “Você não tem autorização para aceitar este termo.”
- `USER_NOT_ACTIVE`: “Sua conta precisa estar ativa para aceitar o termo.”
- falha de rede: “Não foi possível registrar o aceite. Tente novamente.”
- nova versão: “Existe uma nova versão do termo que precisa ser aceita.”

## Critérios de Aceite

- **AC01**: `v2` é o documento canônico corrente e seu conteúdo integral é
  recuperável sem rede externa.
- **AC02**: o PRO consegue abrir e ler o termo completo antes de qualquer aceite.
- **AC03**: checkbox inicia desmarcado e o CTA permanece desabilitado até o
  aceite explícito.
- **AC04**: aceite válido persiste `provider_id`, `user_id`, versão, data/hora e
  referência imutável ao conteúdo.
- **AC05**: retry do mesmo aceite é idempotente.
- **AC06**: `v1` e seus aceites não são apagados ou alterados quando `v2` é
  publicada.
- **AC07**: versão antiga/futura, usuário A no provider B, anônimo e usuário
  não autorizado são rejeitados server-side.
- **AC08**: Perfil/Gestão mostra versão aceita, data/hora e permite reabrir o
  conteúdo; nova versão aparece como pendente.
- **AC09**: gate de ativação continua exigindo a versão corrente, sem bypass
  pelo frontend.
- **AC10**: INSTRUCTOR e identidade autorizada de DRIVING_SCHOOL funcionam sem
  remover papéis Student ou criar usuário duplicado.
- **AC11**: visualização é responsiva, acessível, com foco, headings e áreas
  de toque adequadas.
- **AC12**: dados empresariais continuam placeholders e o marcador de revisão
  legal para produção permanece documentado.

## Dependências

- `compliance_documents` e RPC `provider_accept_mazzi_terms` existentes.
- `current_mazzi_terms_version()` e gate `is_provider_activation_eligible()`.
- RLS/RBAC de compliance e lifecycle do provider.
- Componentes MAZZI Premium V2, especialmente `Modal`, `Button`, `Badge`.

## Decisões Pendentes

- Revisão jurídica profissional do texto antes de qualquer uso comercial/PRD.
- Preenchimento dos dados empresariais definitivos.
- Confirmar com Product/Legal se `v2` deve entrar em ativação estrita para
  providers ativos já existentes ou em rollout controlado. A implementação
  deve preservar histórico e não apagar dados.

## Riscos de Produto

- Publicar `v2` pode exigir novo aceite de profissionais já ativos; o impacto
  deve ser monitorado para evitar indisponibilidade operacional massiva.
- Placeholders jurídicos não podem chegar a produção.
- Conteúdo contratual precisa de revisão profissional para aplicação comercial.

## Handoff para Tech Lead

Auditar o modelo atual e evoluí-lo sem criar sistema paralelo. Preferir uma
fonte canônica imutável no repositório, adicionar somente as colunas/migration
necessárias para versão/hash/histórico, manter RPC server-side e integrar a
consulta ao Perfil/Gestão do PRO. Aplicar migration apenas no Supabase DEV
`bhvpkgonhlujmxvwnxix`, validar ledger, RLS, grants e invariantes.
