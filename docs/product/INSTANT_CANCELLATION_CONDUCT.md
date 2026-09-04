# Aula Agora — cancelamentos do profissional e disciplina

Decisão aprovada pelo responsável pelo produto em 04/09/2026. Implementação vinculada à DEC-018.

## Regras aprovadas

- Cancelamento pelo profissional mantém o direito do aluno ao reembolso integral. Não alterar o gateway nem marcar um reembolso como concluído antes da confirmação financeira existente.
- Primeiro cancelamento injustificado: advertência. O segundo permanece registrado com advertência.
- Ao atingir **3 cancelamentos injustificados em uma janela móvel de 30 dias**, suspender novas solicitações/aceites de **Aula Agora por 24 horas** a partir da decisão que atinge o limite.
- O período considera a data da ocorrência, não a data em que o administrador a revisou. Ocorrências de mais de 30 dias não provocam suspensão.
- Nova ocorrência injustificada dentro da janela pode gerar nova suspensão de 24 horas. Repetir a mesma decisão não duplica advertência nem estende suspensão.
- A suspensão não altera aulas já agendadas, aulas em andamento, cadastro geral, saldos ou repasses de outras aulas. Não existe multa financeira automática.
- A primeira versão registra cancelamento iniciado pelo próprio instrutor da Aula Agora. Uma ação de administrador, aluno ou autoescola não é atribuída automaticamente ao instrutor operacional.
- Não há aplicação retroativa a cancelamentos anteriores à ativação da migration.

## Revisão e contestação

Cancelamento não equivale automaticamente a cancelamento injustificado. O motivo é obrigatório no fluxo existente; a ocorrência entra em análise. Somente administrador ativo classifica como injustificado ou isento, sempre com justificativa e auditoria.

Emergência ou risco de segurança comprovados podem gerar isenção. Falha do MAZZI ou responsabilidade do aluno não deve gerar penalidade ao profissional. A seleção de um motivo não concede isenção automática; a revisão deve examinar os registros e evidências disponíveis, sem expor documentos sensíveis.

O profissional vê as ocorrências em Gestão → Aula Agora e pode enviar justificativa/contestação textual. O administrador revisa em Contestações → Ocorrências da Aula Agora. Uma isenção que reduz a contagem abaixo de três remove a suspensão automática corrente por cancelamentos. Suspensões preventivas independentes continuam sendo analisadas separadamente.

Não comparecimento exige um registro autoritativo `NO_SHOW_PROVIDER`; ausência de GPS, fechamento de aba ou horário previsto ultrapassado não são prova. Esse registro gera suspensão preventiva do Aula Agora até decisão administrativa. A revisão encerra a medida preventiva; não adicionamos prazo punitivo definitivo de não comparecimento que não foi aprovado.

## Garantias técnicas

- Uma ocorrência por aula; transições repetidas não duplicam penalidades.
- Fonte de verdade no banco, com autenticação, autorização e tabelas sem escrita direta pelo cliente.
- Suspensão filtra pesquisa/dispatch e bloqueia disponibilidade/aceite no servidor, inclusive oferta recebida antes da suspensão.
- Revisão e aceite compartilham trava transacional por instrutor.
- Histórico registra ocorrência, decisão, isenção e contestação.
- Prazo vencido libera automaticamente o Aula Agora, sem depender de cron.
- Não modificar as regras de cancelamento/reembolso pelo aluno ou a janela de início da DEC-013 nesta entrega. Essas regras específicas de Aula Agora ainda precisam de decisão separada.

## Ativação e verificação

Migration: `20260904154617_instant_provider_cancellation_penalties.sql`, aplicada somente no Supabase DEV em 04/09/2026. Versão local alinhada ao ledger remoto.
Teste transacional: aplicar migration e `tests/sql/instant-conduct-rollback.sql` na mesma transação, encerrando com `ROLLBACK`.
Production não deve ser alterada. Testes de revisão não devem gerar penalidades reais em contas DEV.

Validação: 881 testes automatizados, lint e builds Student/Instrutor/Admin/Landing aprovados. Testes SQL transacionais passaram antes e depois da aplicação; nenhuma ocorrência permaneceu após rollback. Acesso direto à tabela e execução anônima bloqueados. Frontends publicados não foram atualizados nesta entrega; mudanças de interface disponíveis no checkout local.

Advisors: a tabela sem políticas de leitura direta é intencional (acesso somente por RPC). As três RPCs `SECURITY DEFINER` têm autenticação, autorização e search_path fixo; os avisos de execução autenticada foram revisados. O alerta preexistente do PostGIS `spatial_ref_sys` não foi modificado.

`REQUIRES_REGULATORY_VALIDATION`: revisar termos de uso, contestação, proporcionalidade e política de reembolso antes de ativação comercial em Production.
