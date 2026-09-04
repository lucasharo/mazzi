# TASK-090 — Implementação local do wizard

STATUS: PARCIAL — homologação integral pendente
OWNER: MAZZI Dev
LAST_UPDATED: 2026-09-04

## Implementado

InstantLessonWizard compartilha três etapas, navegação, progresso e ações.
B fixa; endereço confirmado; câmbio em radios nativos; teto explícito em
centavos/null com contagens backend, sem aumento automático. Consulta atrasada
até preço e deduplicada no formulário; erros e ausência de candidatos tratados.
Duplo envio bloqueado; somente o endereço confirmado e suas coordenadas são
mantidos na sessão por usuário. Reabertura reinicia na etapa 1 com câmbio padrão
e sem teto escolhido; migração de rascunhos antigos ignora filtros e etapa.
InstantLessonModal reaproveita os estados e o checkout/tracking existentes,
com mapa do aluno na busca. Tema final branco; experimento preto removido.

## Reuso e dependências

REUSE: Modal, Button, ConfirmableAddressAutocomplete, UniversalMap,
InstantLessonPriceSelector, BookingDetailsModal e tracking. EXTEND: Modal com
className opcional para isolar aparência; InstantLessonModal integra wizard.
NEW: InstantLessonWizard e stylesheet isolada. Nenhuma dependência nova.
Revisões ui-ux-pro-max/React: botões type=button, labels acessíveis, foco da
pergunta, seleção explícita e compartilhamento de lookup. Sem novas subscriptions.

## Testes e evidências

Sete testes de wizard cobrem sequência, B, voltar, confirmação do endereço,
preço ilimitado, double submit, rascunho por usuário, recuperação e GPS.
Testes antigos de contrato atualizados para a extração do componente, mantendo
proteção contra submit externo e erro de ausência de profissional.
888 testes, lint e build:all aprovados antes da retirada dos rótulos do progresso.
Teste específico após retirada dos rótulos: sete aprovados; gates completos
executados novamente para a versão final.
Navegador local 390x844: login DEV, seleção real de endereço no autocomplete,
avanço para câmbio e screenshot D:/Temp/mazzi-wizard-white.png. Não criamos
nova aula/pagamento nesse teste. Sessão auxiliar do navegador encerrada.

## Ressalvas e handoff

### Correção do mapa de busca e reabertura

A tela SEARCHING lia latitude/longitude diretamente da solicitação, mas o
contrato possui meetingPoint.latitude/longitude. Corrigido o mapeamento.
LeafletMap agora descarta coordenadas ausentes, não finitas e fora dos limites,
e assume a posse da instância antes de inicializar view/layers. Uma falha de
inicialização remove a instância em vez de deixar o container ocupado.
Testes adicionados para coordenadas inválidas, centro correto, unmount e falha
de layer; contrato verifica a origem correta das coordenadas de busca.
Reabertura testada com reset de filtros/teto/etapa e somente endereço salvo;
rascunhos legados não retomam a etapa antiga nem vazam filtros.
Suíte completa após correções: 896 testes aprovados; lint aprovado.

Não há alteração SQL, deploy, commit ou push. QA integral dos critérios de
matching/checkout/tracking e revisão final da tarefa maior ainda pendentes.
Warnings preexistentes: chunks grandes e AbortError no teardown happy-dom.
Não declarar tarefa inteira concluída por esses gates locais.
