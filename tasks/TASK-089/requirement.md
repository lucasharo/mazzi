# TASK-089 — Aula Agora: matching instantâneo e chegada em tempo real

TASK: TASK-089
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-09-03

## 1. Objetivo

Adicionar o modo paralelo **Aula Agora** ao MAZZI. O aluno solicita uma aula para o momento atual e informa local, categoria, câmbio e teto máximo de preço. O backend localiza profissionais elegíveis, envia ofertas em pequenas ondas e converte o primeiro aceite válido em uma aula normal do MAZZI. Depois do aceite, o aluno acompanha o deslocamento do profissional até o ponto de encontro.

## 2. Problema

O fluxo atual atende aulas agendadas, mas não atende uma necessidade imediata sem permitir escolha manual do profissional. A nova jornada deve preservar integralmente o agendamento tradicional e adicionar descoberta automática com privacidade, concorrência e agenda protegidas.

## 3. Usuários afetados

Aluno, instrutor autônomo, autoescola e administrador (configurações e auditoria quando necessário).

## 4. Escopo

- Entrada distinta para **Agendar Aula** e **Aula Agora** no Student.
- Configuração do PRO em Gestão: habilitar/desabilitar, preço instantâneo livre por oferta e distância máxima.
- Jornada Student: ponto de encontro, categoria A/B conforme oferta vigente, câmbio MANUAL/AUTOMATIC/NOT_APPLICABLE, teto derivado dos preços elegíveis, busca, cancelamento e estados de matching.
- Jornada PRO: localização operacional, recebimento de offer com countdown de aproximadamente 15 segundos, aceitar/recusar e recuperação após refresh.
- Matching backend com PostGIS, gates de elegibilidade, proteção de conflito, ondas de 3 candidatos e primeiro aceite atômico.
- Conversão para o mesmo lifecycle/booking/payment/review existentes, com snapshot do preço ofertado.
- Tracking pós-match com localização exata somente para o aluno e o profissional vencedor, via realtime/último estado; mapa compartilhado existente.
- Solicitação ao PRO pelo sistema canônico de notificações, usando `app_context=PRO` e destino da oferta.
- Componentes e formatadores existentes reutilizados entre Student e PRO.
- Somente DEV/Sandbox; nenhum pagamento real, nenhuma alteração em Production.

## 5. Fora de escopo

- Substituir ou redesenhar o agendamento tradicional.
- Preço definido ou alterado pelo MAZZI, surge, leilão, ranking primário pelo menor preço ou alteração posterior do preço snapshot.
- Lista para o aluno escolher um PRO específico antes do match.
- Filtro de gênero.
- Novo sistema de booking, pagamento, notificações, mapa, geolocalização ou avaliação.
- Histórico permanente de trajetórias GPS, exposição de coordenadas exatas antes do match ou integração governamental.
- Promessa de ETA rodoviário preciso caso não exista provider de routing aprovado; nesse caso usar cálculo geodésico conservador e documentar a limitação.

## 6. Regras de negócio

1. O preço é definido livremente pelo PRO por oferta. O teto do aluno é somente gate: `PRO_PRICE <= STUDENT_MAX_PRICE`; `Sem limite` é `NULL` e não é número infinito.
2. O matching não pode ranquear primariamente pelo menor preço. Viabilidade, ETA, distância, estabilidade e fairness podem ordenar os candidatos.
3. O candidato precisa ter provider ACTIVE, compliance/termos válidos, veículo ACTIVE, offering ACTIVE, categoria/câmbio compatíveis, Aula Agora habilitada, preço válido, localização recente, sem conflito e sem self-match. Autoescolas devem respeitar instrutor e veículo reais.
4. Configurações canônicas: ETA máximo inicial 30 min; margem de segurança 15 min; onda 3 candidatos; offer 15 s; localização pré-match aproximadamente 20–30 s e stale após aproximadamente 30 s; tracking pós-match aproximadamente 5–10 s.
5. A proteção da próxima aula é dinâmica: `travel_to_student + duration + travel_to_next_booking + 15 min <= time_until_next_booking`, reutilizando a engine de agenda atual. Não usar regra fixa de 70 minutos.
6. Uma busca ativa por aluno e uma Aula Agora ativa por recurso. Refresh deve recuperar a entidade e não criar outra.
7. O primeiro aceite válido vence atomicamente no backend. Aceites concorrentes seguintes retornam erro controlado.
8. Toda request/offer possui expiração e idempotência. Oferta expirada não pode ser aceita.
9. O booking criado usa o preço snapshot e o lifecycle existente. Cancelamento antes do match não gera cobrança.
10. Antes do match o aluno não recebe latitude/longitude exatas individuais. Depois do match recebe somente a localização do vencedor autorizada pelo contrato.
11. O mapa pré-match mostra apenas presença/quantidade ou localização protegida e não permite escolher um PRO.

## 7. Fluxos principais

### Student

`Aula Agora` → confirmar ponto atual → categoria → câmbio → teto de preço → consultar candidatos → iniciar busca → aguardar ondas/aceite → exibir profissional vencedor e acompanhamento até o ponto → convergir para a aula normal.

### PRO

Gestão → habilitar Aula Agora → informar preço e distância → habilitar disponibilidade operacional → permitir localização → receber oferta → aceitar ou recusar → em caso de aceite, criar aula normal e iniciar tracking autorizado.

## 8. Casos de borda e exceções

- Localização negada, ausente ou stale: impedir matching e explicar como corrigir.
- Nenhum candidato ou nenhum aceite: expirar/cancelar request e informar que não foi encontrado profissional dentro dos critérios, sem aumentar o teto.
- Candidato perde corrida, fica indisponível ou oferta expira: seguir próxima onda.
- Conflito de agenda, bloqueio, compliance inválido ou preço alterado depois do snapshot: rejeitar no backend.
- Refresh, reconexão e duas abas: recuperar request/offer idempotentemente.
- Dois PROs aceitam quase simultaneamente: apenas um booking/winner; o outro recebe feedback amigável.
- Autoescola sem instrutor elegível ou veículo compatível: não ofertar.

## 9. Estados e mensagens

Todos os novos componentes devem cobrir `LOADING`, `EMPTY`, `ERROR`, `SUCCESS`, `DISABLED` e `EXPIRED`.

Mensagens públicas: “Confirme sua localização para encontrar um profissional.”, “Nenhum profissional disponível agora.”, “Não encontramos um profissional dentro do valor selecionado.”, “A oferta já foi atendida por outro profissional.” e “A oferta expirou.” Nunca exibir SQLSTATE, nome de RPC ou stack trace.

## 10. Critérios de aceite

- **AC01**: Student exibe Agendar Aula e Aula Agora como opções distintas.
- **AC02**: PRO habilita/desabilita Aula Agora e define preço e raio.
- **AC03**: Student escolhe local, categoria, câmbio e teto derivado de preços reais, incluindo Sem limite.
- **AC04**: O MAZZI não altera nem recomenda preço e não ranqueia automaticamente pelo menor valor.
- **AC05**: Apenas candidatos que passam todos os gates e ETA máximo participam.
- **AC06**: Agenda futura respeita travel + duração + travel + 15 min, sem regra fixa de 70 min.
- **AC07**: Offers expiram em aproximadamente 15 s e dispatch inicial usa ondas de 3.
- **AC08**: Primeiro aceite válido vence atomicamente e concorrência não cria booking duplicado.
- **AC09**: Student pode cancelar enquanto busca e refresh recupera request sem duplicação.
- **AC10**: Após aceite é criado o booking/lifecycle normal com preço snapshot.
- **AC11**: Localização exata do PRO é privada antes do match e tracking do vencedor funciona depois.
- **AC12**: Localização stale remove o PRO de novos matchings; self-booking é impossível.
- **AC13**: Autoescola usa instrutor/veículo reais e respeita o contexto do recurso.
- **AC14**: Student e PRO reutilizam primitives, tokens, mapa, geolocation, notificações, money/date/distance formatters e feedback existentes.
- **AC15**: UI funciona em 360/375/390/430 px, desktop, teclado, foco e leitores de tela; touch targets têm ao menos 44 px.
- **AC16**: Novas tabelas/RPCs têm RLS restritiva; anon não acessa tabelas diretamente; Student acessa somente a própria request e PRO somente offers direcionadas.
- **AC17**: Pagamento continua no contrato existente de DEV/mock, com zero chamadas de gateway real e zero dinheiro real.
- **AC18**: `npm run lint`, `npm test`, `npm run build:all` e `git diff --check` passam integralmente; CI e Database Baseline Verify ficam verdes antes do release.

## 11. Dependências

- Workflow `.agents/workflows/mazzi-feature.md`.
- Contratos de produto em `docs/product/MVP_RULES.md` e `docs/product/PRODUCT_DECISIONS.md`.
- Domain/services atuais de disponibilidade, busca, booking, notificações, mapa, localização e pagamentos.
- Supabase DEV `bhvpkgonhlujmxvwnxix`, apenas após migration revisada e gates locais.

## 12. Decisões pendentes / limitações declaradas

- Auditar se a configuração deve ser por `service_offering` ou estrutura equivalente; escolher a que preserve múltiplos veículos, categorias e autoescolas sem duplicar modelo.
- Auditar provider de routing existente. Se não houver, o DEV usará distância geodésica conservadora, sem declarar ETA rodoviário preciso, com adapter preparado para substituição.
- O modo público da categoria continua sujeito ao MVP vigente: a arquitetura pode aceitar A/B, mas a oferta visível deve respeitar a decisão vigente de lançamento.

## 13. Riscos de produto

Concorrência de aceites, privacidade de localização, conflito com próxima aula, reconexão e múltiplos papéis no mesmo usuário. Qualquer limitação que afete os contratos centrais deve ser documentada e bloqueia o release até decisão explícita.

## 14. Handoff para Tech Lead

Auditar o schema e os serviços existentes antes de criar entidades. Produzir plano com migration incremental, RLS/RBAC, RPCs atômicas, estratégia de realtime/localização, reuse report, testes de concorrência/privacidade/agenda e ordem de implantação exclusivamente em DEV.
