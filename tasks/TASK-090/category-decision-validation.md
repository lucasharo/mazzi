# Validação da decisão de categoria — 2026-09-04

Escopo desta atualização: B automática e ausência de seletor de categoria.
Não constitui conclusão da TASK-090 nem homologação do wizard completo.

## Implementação

InstantLessonModal usa categoria B fixa, sem estado mutável ou opções A/B.
Consulta de preços e criação da busca compartilham esse valor. Select de câmbio
permanece canônico e ocupa a largura disponível, sem coluna vazia.
DEC-008 e requisitos atualizados com três etapas futuras: endereço, câmbio e valor.
Nenhuma dependência adicionada; SQL, contratos de pagamento e enums preservados.

## Evidências de validação local

- Dois novos testes em tests/instant-lesson-category.test.tsx: ausência de seleção,
  categoria B automática na consulta, permanência de B ao alterar câmbio e ao iniciar busca.
- npm run lint: aprovado.
- npm test: 136 arquivos, 883 testes aprovados.
- build:all: Student, Instructor, Admin e Landing aprovados, saída 0.
- git diff --check: saída 0; avisos de conversão LF/CRLF em arquivos preexistentes.
- Avisos: chunks maiores que 500 kB nos três apps; AbortError do happy-dom durante
  teardown da suíte, sem falha de teste. Não foram suprimidos.

## Revisão de escopo

A retirada do controle mantém label, foco e dimensões do Select existente,
seguindo a revisão de UI da skill ui-ux-pro-max, sem criar padrão visual novo.
Backend não foi alterado; não há alegação de teste remoto de RLS nesta atualização.
Não houve teste visual em navegador nem nova publicação DEV.

## Próximo estado da tarefa

A decisão de produto está resolvida. O formulário atual continua sem wizard;
a implementação e QA integral dos critérios da TASK-090 permanecem pendentes.
Não há commit, push, release ou alteração em Production nesta atualização.
Execução de lint/test/build terminou; nenhum helper persistente novo permanece.
Servidores DEV e túneis existentes foram preservados.
