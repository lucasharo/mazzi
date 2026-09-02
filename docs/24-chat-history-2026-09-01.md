# MAZZI — Histórico consolidado da conversa de 2026-09-01

Este documento resume as decisões e entregas solicitadas nesta frente. Ele não é uma transcrição literal do chat; regras financeiras, jurídicas ou regulatórias continuam dependendo de validação própria.

## 1. Contestação e comunicação

- A contestação passou a ser uma tela própria, com mensagens exibidas em sequência cronológica.
- Cada envio é uma mensagem independente, com autor e data; respostas complementares não são agrupadas.
- Solicitações do Admin aparecem na mesma lista de mensagens, identificadas como Admin.
- Arquivos enviados ficam em uma seção separada, abrem em nova guia e usam Storage privado com URLs assinadas.
- Aluno e PRO visualizam somente os próprios arquivos, conforme o escopo de acesso da contestação.
- Durante a contestação, ambos podem ler as mensagens, mas não podem enviar mensagens no chat regular.
- O envio de novos arquivos respeita a vez de resposta pendente do participante.
- O status foi separado para indicar quando a resposta é aguardada do Aluno ou do PRO.
- O prazo de resposta é configurável no Admin e a data limite é recalculada após cada ação que cria uma nova pendência.
- No app do Aluno, a comunicação usa “contestação” e informa que o pagamento permanece seguro; o termo “repasse” não é usado para o Aluno.

## 2. Admin e operação

- Foi criada uma área específica de contestação no Admin, fora do Financeiro.
- A decisão administrativa pode solicitar mais informações ao Aluno ou ao PRO.
- Status são apresentados como chips no canto superior direito dos cards.
- O Admin exibe dados amigáveis da reserva — aluno, instrutor, autoescola, veículo, data, horário, local e descrição — sem domínios ou códigos técnicos na interface.
- Analytics passou a atualizar seus painéis e a usar os rótulos “Analítico” e “Cotações”. O indicador de checkout foi esclarecido como “Checkouts cancelados”.

## 3. Agenda e disponibilidade

- O calendário do Aluno deixou de depender de um limite fixo no frontend.
- O `SlotSelectorModal` consulta o horizonte público configurado no Admin e carrega a agenda progressivamente em lotes de até 30 dias.
- A configuração atual do ambiente DEV é de 90 dias; o limite é aplicado também à navegação para o próximo mês.
- O calendário, os horários e o resumo da seleção receberam compactação visual para reduzir o scroll em telas móveis.
- O resumo não exibe mais o título “Resumo da seleção”; veículo e câmbio ficam na mesma linha quando disponíveis.

## 4. Pagamentos e checkout

- O fluxo de checkout permanece dependente da confirmação server-side pelo webhook do gateway.
- A reserva usa o prazo configurado da cotação para PIX e cartão, com janela de tolerância para pagamentos que chegam próximo da expiração.
- A taxa real do serviço de pagamento deve ser persistida a partir do evento/retorno do gateway; não deve ser simulada como percentual fixo na tela.
- O detalhamento financeiro separa valor líquido do prestador, taxa MAZZI, taxa do checkout e total pago pelo aluno.
- O ambiente continua sendo DEV/homologação, sem dados de produção ou ativação de cobrança real.

## 5. Publicação e validação

- A branch de publicação é `feature/premium-ui-v2`.
- Pushes nessa branch executam o workflow do GitHub Actions para lint, testes, build e publicação dos quatro apps DEV no Cloudflare Pages.
- Migrações e funções do Supabase permanecem versionadas junto do código e devem ser aplicadas no projeto DEV.
- Validações recentes: `npm run lint`, `npm run build` e os testes específicos do seletor de horários passaram.
- A suíte completa ainda possui falhas preexistentes em contratos antigos de Admin, disponibilidade, reservas, acessibilidade e quote booking; elas devem ser tratadas separadamente antes de considerar a suíte global totalmente verde.
