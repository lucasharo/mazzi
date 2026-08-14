# MAZZI — critérios de aceite do MVP

## Student App

- Aluno cria conta, consulta a oferta pública e encontra horários por área/categoria.
- A tela de detalhe mostra fornecedor, instrutor aplicável, preço final, veículo aplicável, avaliações e regra de cancelamento vigente.
- Ao reservar, o sistema não confirma um horário que já tenha sido reservado em concorrência.
- Pagamento aprovado por webhook confirmado cria reserva confirmada; falha/expiração libera o hold.
- Aluno só vê suas reservas, conversa e avaliações elegíveis.

## Provider App

- Fornecedor aprovado pode operar apenas o próprio escopo.
- Instrutor possui mais de um veículo, sem permitir uso conflitante no mesmo período.
- Alterações de agenda não mudam uma reserva confirmada diretamente.
- Fornecedor acessa apenas reservas atribuídas e conversa correspondente.

## Admin

- Admin aprova/suspende fornecedor, modera avaliação/mensagem e trata exceções com registro auditável.
- Ações administrativas críticas registram autor, data, objeto, motivo e estado anterior/posterior quando aplicável.
- Admin consegue localizar uma reserva e seu histórico de status/pagamento sem editar dados financeiros diretamente.

## Segurança e operação

- Operações de reserva e pagamento são idempotentes onde necessário.
- Webhooks não assinados, repetidos ou fora da janela esperada não alteram estado.
- Dados pessoais e documentos não são acessíveis por URLs públicas permanentes.
- Há testes automatizados de conflito de agenda, RBAC, estados de reserva e idempotência de pagamento.
