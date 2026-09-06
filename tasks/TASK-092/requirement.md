# TASK-092 — Preferências de notificações no Perfil

TASK: TASK-092
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-09-05

## 1. Objetivo

Permitir que cada usuário habilite ou desabilite, no próprio Perfil, os tipos de notificação disponíveis para o aplicativo que está usando.

## 2. Problema

O usuário recebe notificações sem um controle claro para escolher quais eventos deseja acompanhar.

## 3. Usuário Afetado

Aluno e Instrutor/PRO. As preferências são individuais e não alteram as configurações de outros usuários.

## 4. Escopo

- Adicionar a seção “Preferências de notificações” ao Perfil do Aluno e ao Perfil do PRO.
- Exibir um switch acessível para cada tipo de notificação suportado pelo contexto do app.
- Carregar as preferências salvas ao abrir o Perfil.
- Salvar cada alteração imediatamente, com feedback de carregamento e erro recuperável.
- Considerar habilitados os tipos que ainda não possuem registro de preferência.
- Impedir a criação de novas notificações para tipos explicitamente desabilitados pelo usuário.

## 5. Fora de Escopo

- Preferências por canal (e-mail, SMS ou push) separadas do in-app.
- Configuração de notificações do Admin, que não possui Perfil no fluxo atual.
- Exclusão ou alteração de notificações já recebidas.
- Mudança nos títulos, destinos ou regras de geração das notificações existentes.

## 6. Regras de Negócio

- A preferência pertence exclusivamente ao usuário autenticado.
- A ausência de registro significa `enabled = true` para manter o comportamento atual.
- Somente tipos presentes no contrato atual de notificações podem ser alterados.
- Desabilitar um tipo bloqueia novas notificações daquele tipo; registros históricos permanecem disponíveis.
- O frontend não pode gravar diretamente a preferência de outro usuário nem decidir sozinho a autorização.

## 7. Fluxo Principal (Happy Path)

1. O usuário abre Perfil.
2. O app carrega as preferências do usuário autenticado.
3. Os tipos sem registro aparecem ligados; os tipos desligados aparecem desligados.
4. O usuário altera um switch.
5. O app persiste a alteração e confirma visualmente o estado salvo.

## 8. Casos de Borda e Exceções

- Enquanto a leitura inicial estiver pendente, os switches ficam desabilitados.
- Se uma alteração falhar, o estado anterior é restaurado e uma mensagem orienta tentar novamente.
- Uma entrada de tipo inválida deve ser rejeitada pelo backend.
- Usuários não autenticados não podem ler nem alterar preferências.

## 9. Estados de Erro e Mensagens

- Carregamento: “Carregando preferências…”
- Falha de leitura: “Não foi possível carregar suas preferências. Tente novamente.”
- Falha de gravação: “Não foi possível salvar essa preferência. Tente novamente.”

## 10. Critérios de Aceite

- **AC01**: Aluno e PRO visualizam a seção de preferências no Perfil.
- **AC02**: Cada app lista somente os tipos de notificação compatíveis com seu contexto, com nome e descrição em português.
- **AC03**: O switch possui rótulo acessível, estado ligado/desligado claro e alvo de toque adequado.
- **AC04**: Tipos sem registro são carregados como habilitados.
- **AC05**: Cada alteração é persistida para o usuário autenticado e reaparece após recarregar o app.
- **AC06**: O backend rejeita usuário não autenticado, tipo inválido e acesso cruzado.
- **AC07**: Novas notificações de tipo desabilitado não são criadas; notificações históricas não são apagadas.
- **AC08**: Falhas de leitura e gravação apresentam mensagem amigável e não deixam o switch em estado falso.
- **AC09**: Lint, testes e builds dos quatro artefatos passam sem regressão.

## 11. Dependências

- Contrato `NotificationType` e contextos existentes.
- Tabela `public.notifications` e seus triggers de contexto/push.
- Perfil existente dos apps Student e Provider.

## 12. Decisões Pendentes

Nenhuma. Preferências são por tipo de evento e independentes do canal de entrega nesta entrega.

## 13. Riscos de Produto

Desligar eventos operacionais importantes pode reduzir a percepção do usuário sobre mudanças de aulas. A interface deve explicar o que cada switch controla, sem esconder a existência dos eventos.

## 14. Handoff para Tech Lead

Projetar uma tabela/RPC protegida por usuário, preservar o comportamento habilitado por padrão e centralizar a configuração visual para manter Aluno e PRO consistentes.
