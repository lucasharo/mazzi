# TASK-079 — Checkout alternável Fake/Mercado Pago em ambiente de teste

TASK: TASK-079
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-27

## Objetivo

Permitir validar o checkout do Aluno com o gateway fake atual ou com o Mercado Pago em ambiente de teste, selecionados por configuração, sem realizar cobranças reais.

## Problema

O checkout atual é exclusivamente simulado. A equipe precisa iniciar a integração do Mercado Pago sem perder o fluxo fake e sem risco de ativar credenciais ou cobranças de produção.

## Usuários afetados

Alunos que concluem uma reserva e equipe de desenvolvimento/QA responsável pela homologação financeira.

## Escopo

- Criar uma configuração pública `VITE_PAYMENT_GATEWAY_PROVIDER` com os valores `fake` e `mercadopago` para selecionar a experiência de checkout.
- Manter `fake` como padrão seguro.
- Integrar o Card Payment Brick oficial do Mercado Pago no modo `mercadopago`.
- Processar a cobrança de cartão em uma única solicitação online do frontend para backend e do backend para o Mercado Pago.
- Usar exclusivamente credenciais e cartões de teste no ambiente DEV.
- Garantir idempotência, valores internos em centavos e confirmação server-side.

## Fora de escopo

- Credenciais, cobranças ou deploy em produção.
- PIX, boleto, débito em conta ou qualquer meio que dependa de pagamento posterior/assíncrono no modo Mercado Pago.
- Assinaturas, recorrência, parcelamento acima de uma parcela, split/payout real e OAuth de vendedores nesta entrega.
- Substituir o gateway fake como padrão.

## Regras de negócio

1. `fake` abre a experiência simulada atual; `mercadopago` abre o formulário oficial de cartão.
2. A configuração inválida ou ausente falha de forma segura para `fake`.
3. O modo Mercado Pago aceita somente ambiente `test` e cartão tokenizado; PAN e CVV nunca passam pelo código MAZZI.
4. A cobrança é criada online e capturada imediatamente. Respostas diferentes de `approved` não confirmam a reserva.
5. A reserva só é confirmada pelo backend após validar usuário, booking, payment, valor em centavos, idempotência e resposta autoritativa do gateway.
6. Repetir a mesma tentativa não pode gerar cobrança duplicada.
7. Segredos do Mercado Pago ficam somente na Edge Function; o browser recebe apenas a chave pública de teste.
8. Toda mensagem visível é em português e não expõe códigos internos, tokens ou respostas brutas.

## Fluxo principal

1. O aluno cria a reserva e chega ao pagamento.
2. Em `fake`, usa os cenários simulados existentes.
3. Em `mercadopago`, preenche o Card Payment Brick com cartão de teste.
4. O Brick tokeniza os dados e envia somente o token e metadados permitidos à Edge Function autenticada.
5. A Edge Function valida a sessão e os dados persistidos, cria o pagamento com idempotência e aguarda a resposta.
6. Se aprovado, o backend confirma pagamento/reserva e a tela exibe sucesso; caso contrário, mantém a reserva não confirmada e informa como tentar novamente.

## Casos de borda e exceções

- Chave pública ou segredo de teste ausente: checkout informa indisponibilidade sem cair no fake silenciosamente quando a configuração pediu Mercado Pago.
- Sessão expirada, booking de outro aluno, hold expirado, valor divergente e pagamento já concluído são bloqueados no backend.
- Timeout ou indisponibilidade mantém o pagamento pendente/não confirmado e permite nova tentativa idempotente.
- Status `pending` ou `in_process` não confirma a reserva e é apresentado como pagamento ainda não aprovado.

## Critérios de aceite

- **AC01**: `VITE_PAYMENT_GATEWAY_PROVIDER=fake` preserva o checkout simulado atual.
- **AC02**: `VITE_PAYMENT_GATEWAY_PROVIDER=mercadopago` exibe o Card Payment Brick responsivo, em português e somente para cartão.
- **AC03**: a Edge Function autenticada exige `MERCADOPAGO_ENVIRONMENT=test` e segredo server-side.
- **AC04**: a criação usa `X-Idempotency-Key`; valores permanecem inteiros em centavos internamente.
- **AC05**: somente resposta `approved` confirma booking e payment no backend.
- **AC06**: nenhuma credencial privada, PAN, CVV ou resposta sensível é persistida/exposta no frontend.
- **AC07**: botões e formulário têm estados loading, disabled, erro e touch targets adequados em mobile.
- **AC08**: testes de ambos os modos, lint e builds dos três apps passam.

## Dependências

Aplicação/credenciais de teste Mercado Pago, Supabase DEV e Edge Functions.

## Decisões pendentes

As credenciais de teste devem ser fornecidas fora do Git e configuradas nos ambientes Cloudflare DEV (chave pública) e Supabase DEV (Access Token). A integração permanece funcional em fake até isso ocorrer.

## Riscos de produto

Uma resposta `pending` não atende ao fluxo síncrono e, portanto, não confirma a reserva. Métodos assíncronos ficam explicitamente indisponíveis.

## Handoff para Tech Lead

Preservar o fluxo financeiro existente e introduzir uma fronteira server-side mínima, autenticada e fail-closed. Não reutilizar o adaptador Node no bundle do browser para a chamada real.
