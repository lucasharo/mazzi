# MAZZI — decisões para iniciar a implementação

Este documento transforma as lacunas conhecidas em escolhas objetivas. A resposta a estas decisões libera a fundação técnica sem alterar o escopo do MVP.

## Decisões confirmadas

| ID | Decisão |
|---|---|
| D-01 | Instrutores autônomos e autoescolas podem oferecer aulas, com aprovação manual. |
| D-02 | Lançamento em toda a cidade de São Paulo. |
| D-03 | Somente categoria B (carro), com aulas de 60 minutos. |
| D-04 | Carro do instrutor; carro do aluno fora do MVP. |
| D-05 | Comissão será o modelo de receita, mas não será cobrada na validação inicial. |
| D-06 | Aluno poderá pagar por Pix e cartão. |
| D-07 | Política provisória: grátis até 24h; 50% de 24h até 2h; 100% abaixo de 2h/no-show; reembolso integral quando o fornecedor falhar. |
| D-08 | Verificação manual: identidade, contato, documentação aplicável, veículo e dados bancários; lista final sujeita a jurídico. |

## Decisões ainda bloqueadoras

| ID | Decisão | Opções a validar | Impacto se não definida |
|---|---|---|---|
| D-09 | Política de privacidade/termos | Responsável, canais e revisão jurídica | Não lançar cadastro público/produção. |
| D-10 | Financeiro operacional | Mercado Pago definido; confirmar captura, split/repasse, estorno e chargeback com a configuração comercial/jurídica. | Não integrar pagamento real antes da confirmação. |
| D-11 | Política comercial | Data de cobrança, percentual de comissão e absorção de tarifas | Receita/repasse não podem ser automatizados. |
| D-12 | Oferta comercial | Aula avulsa versus pacotes e regras específicas para autoescola | Catálogo e preço de lançamento ficam parciais. |

## Recomendação de sequência de validação

1. D-09: fecha os requisitos de lançamento e dados pessoais.
2. D-10 e D-11: fecham a integração e operação financeira.
3. D-12: fecha o catálogo comercial.

## Decisões técnicas já confirmadas

| ID | Decisão | Recomendação inicial |
|---|---|---|
| T-01 | Estrutura | Next.js + React + TypeScript, monólito modular com API/serviços server-side. |
| T-02 | Clientes | Web app responsivo/PWA, com áreas Student, Provider, Autoescola e Admin. |
| T-03 | Dados | PostgreSQL no Supabase + Prisma, transações e restrição de intervalos para reservas. |
| T-04 | Autenticação/arquivos | Supabase Auth e Supabase Storage privado, com URLs temporárias para documentos. |
| T-05 | Mapas | Google Maps para mapa/endereço; distância calculada internamente com coordenadas/PostGIS; sem rotas no MVP. |
| T-06 | Pagamentos | Mercado Pago para Pix, cartão, split, reembolso e webhooks. |

Os provedores Supabase, Google Maps e Mercado Pago são decisões confirmadas; a notificação por e-mail/push ainda terá provedor definido depois.

## Critério para iniciar o piloto

O piloto só deve receber reservas reais quando existirem: fornecedores aprovados, oferta mínima por zona, agenda protegida contra conflito, política de cancelamento publicada, pagamento conciliável, suporte com responsável e termos/privacidade revisados.
