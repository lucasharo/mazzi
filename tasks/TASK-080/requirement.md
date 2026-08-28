# TASK-080 — Recebimento Pix e repasse manual

TASK: TASK-080
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-27

## 1. Objetivo

Disponibilizar recebimento de Pix pelo Mercado Pago em ambiente de testes, mantendo o gateway fake selecionável, e preparar o Admin para controlar repasses manuais via Pix aos prestadores.

## 2. Problema

O checkout atualmente oferece Pix somente simulado e não há fluxo operacional para registrar o destino Pix do prestador, acompanhar a confirmação real ou controlar o repasse manual pelo Admin.

## 3. Usuário Afetado

`STUDENT`, `INSTRUCTOR`, `DRIVING_SCHOOL`, `SCHOOL_ADMIN`, `PLATFORM_ADMIN`.

## 4. Escopo

- Pix real do Mercado Pago no ambiente de testes, com QR Code e código copia e cola.
- Estado intermediário `Aguardando pagamento` até confirmação confiável do gateway.
- Confirmação por webhook autenticado e consulta server-side de fallback.
- Preservação do gateway fake por `VITE_PAYMENT_GATEWAY_PROVIDER`.
- Cadastro/edição do destino Pix do prestador no app PRO.
- Configuração de taxas no Admin, sem exibir a taxa do Mercado Pago ao PRO ou ao aluno.
- Preparação automática de um registro de repasse para reservas pagas e concluídas.
- Ação de marcar repasse manual como realizado no Admin, com referência e idempotência.
- Auditoria das mudanças de pagamento, destino Pix e repasse.
- Validações server-side em centavos inteiros, RBAC e RLS.

## 5. Fora de Escopo

- OAuth ou split automático entre contas Mercado Pago.
- Transferência Pix automática nesta entrega.
- Cobrança em produção.
- Alteração do preço público exibido ao aluno além do fluxo já existente.
- Repasse para reserva não paga, não concluída, cancelada, reembolsada ou em disputa.

## 6. Regras de Negócio

1. O gateway padrão continua sendo o fake; Mercado Pago somente é habilitado explicitamente por variável de ambiente e exige ambiente de teste.
2. Criar um Pix não confirma a reserva. A reserva permanece `PENDING_PAYMENT` até o backend validar o status aprovado do pagamento.
3. A confirmação deve ser idempotente e nunca pode ser feita pelo frontend apenas com base no retorno visual do checkout.
4. Webhook deve validar assinatura HMAC e consultar o Mercado Pago antes de alterar o estado local.
5. O pagamento deve corresponder ao valor em centavos da reserva e à reserva do aluno autenticado.
6. Uma reserva pode ter no máximo um repasse operacional ativo.
7. Repasse só fica disponível após a aula estar `COMPLETED` e respeitar o período de segurança configurado.
8. O destino Pix do prestador deve estar completo e ativo antes de marcar um repasse manual como realizado.
9. A taxa estimada do Mercado Pago fica restrita ao Admin. O valor combinado de taxa MAZZI e taxa de gateway não pode ultrapassar 10% do valor bruto da aula; a taxa MAZZI efetiva deve ser limitada pelo backend.
10. Todo valor financeiro será persistido como inteiro em centavos.

## 7. Fluxo Principal (Happy Path)

1. O aluno escolhe Mercado Pago e Pix no checkout.
2. O backend cria o pagamento de teste de forma idempotente e retorna QR Code/copia e cola, com validade limitada ao hold da reserva.
3. O aluno visualiza `Aguardando pagamento` e pode copiar o código ou atualizar o status.
4. Após o Pix ser pago, o webhook chega ao Supabase, é validado e o backend consulta o pagamento no Mercado Pago.
5. Se aprovado, o backend marca o pagamento como `PAID` e a reserva como `CONFIRMED` atomically.
6. Após a aula ser concluída e o período de segurança vencer, o Admin visualiza o repasse disponível.
7. O Admin confere o destino Pix e registra o repasse manual com valor, data e referência.
8. O sistema grava auditoria e torna a operação idempotente.

## 8. Casos de Borda e Exceções

- QR Code expirado: pagamento não pode confirmar a reserva; o aluno deve iniciar nova tentativa.
- Webhook duplicado: não pode duplicar pagamento, auditoria ou repasse.
- Webhook inválido: rejeitar sem alterar dados e registrar tentativa técnica.
- Pagamento aprovado após o hold expirar: não reabrir a reserva; registrar ocorrência para tratamento financeiro.
- Valor divergente: rejeitar confirmação e manter a reserva não confirmada.
- Destino Pix ausente/inválido: impedir o repasse manual e orientar o Admin.
- Repasse já marcado como realizado: retornar operação idempotente sem novo lançamento.
- Dois administradores tentando repassar simultaneamente: apenas uma transação pode vencer.
- Falha temporária da API: manter o pagamento pendente e permitir nova consulta segura.

## 9. Estados de Erro e Mensagens

- `MERCADOPAGO_NOT_CONFIGURED`: “O pagamento via Pix ainda não foi configurado neste ambiente.”
- `PAYMENT_PENDING`: “Aguardando a confirmação do Pix. Atualizaremos o status assim que o pagamento for identificado.”
- `PAYMENT_EXPIRED`: “O código Pix expirou. Gere uma nova tentativa de pagamento.”
- `PAYMENT_AMOUNT_MISMATCH`: “Não foi possível confirmar o pagamento por divergência de valor.”
- `PAYMENT_CONFIRMATION_UNAVAILABLE`: “Ainda não conseguimos confirmar este pagamento. Tente atualizar novamente.”
- `PIX_DESTINATION_REQUIRED`: “Cadastre um destino Pix válido para este prestador antes de realizar o repasse.”
- `PAYOUT_NOT_AVAILABLE`: “Este repasse ainda não está disponível para processamento.”

## 10. Critérios de Aceite

- **AC01**: Com o gateway fake selecionado, o fluxo atual de Pix continua funcionando sem chamadas ao Mercado Pago.
- **AC02**: Com Mercado Pago habilitado em DEV, o checkout Pix cria uma cobrança de teste e exibe QR Code/copia e cola sem confirmar a reserva imediatamente.
- **AC03**: Apenas uma confirmação server-side aprovada altera pagamento para `PAID` e reserva para `CONFIRMED`.
- **AC04**: Webhook sem assinatura válida, com valor divergente ou de outro pagamento não altera a reserva.
- **AC05**: Reenvio do mesmo webhook e repetição da confirmação são idempotentes.
- **AC06**: O PRO consegue cadastrar e atualizar uma chave Pix própria, sem acessar a chave de outro prestador.
- **AC07**: O Admin consegue visualizar repasses elegíveis, taxa de gateway restrita ao Admin e destino Pix mascarado.
- **AC08**: O Admin consegue registrar um repasse manual uma única vez, com referência obrigatória e auditoria.
- **AC09**: O backend bloqueia taxa combinada acima de 10% e mantém dinheiro em centavos inteiros.
- **AC10**: Falhas aparecem em português e todos os botões de pagamento/repasse possuem estado de carregamento e ficam protegidos contra duplo envio.
- **AC11**: `npm run lint`, `npm test` e `npm run build:all` passam sem regressões.

## 11. Dependências

- Supabase Database, Storage/Edge Functions e Auth.
- Credencial de teste `MERCADOPAGO_ACCESS_TOKEN` no segredo do Supabase.
- Chave pública de teste `VITE_MERCADOPAGO_PUBLIC_KEY` no frontend.
- URL HTTPS da Edge Function cadastrada nos Webhooks do Mercado Pago.

## 12. Decisões Pendentes

- Nenhuma para esta entrega. A confirmação posterior do Pix foi aprovada como exceção necessária à regra anterior de confirmação síncrona.

## 13. Riscos de Produto

- O Pix pode permanecer pendente e a tela precisa comunicar isso claramente.
- Repasse manual depende de conferência humana; o sistema não deve sugerir que o dinheiro foi transferido sem referência informada.
- Taxas reais do Mercado Pago variam por conta e condição comercial; o valor configurado no Admin é uma estimativa/limite operacional até existir leitura definitiva do gateway.

## 14. Handoff para Tech Lead

Projetar a extensão do modelo atual de pagamentos e `payouts` sem quebrar as RPCs existentes. Priorizar transações PostgreSQL, RLS/RBAC, assinatura HMAC do webhook, idempotência e proteção de dados do destino Pix. Manter Mercado Pago limitado a teste e não introduzir OAuth ou transferência automática.
