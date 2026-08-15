# 03 — Regras de Negócio Inegociáveis

## 1. Tratamento Financeiro
- **Valores Monetários em Centavos:** É expressamente proibido o uso de números de ponto flutuante (`float`) para preços, taxas, comissões ou repasses. Todo cálculo e armazenamento é feito em inteiros (`integer`/`bigint`). Exemplo: R$ 100,00 = `10000`.
- **Snapshot Imutável:** Qualquer alteração posterior de preço na oferta ou dados cadastrais do fornecedor não afeta reservas prévias já criadas.
- **[DECISÃO PENDENTE]:** O percentual definitivo de comissão/take rate da plataforma MAZZI será definido pela diretoria comercial. O valor inicial de 10% (`DEFAULT_DEVELOPMENT_PLATFORM_FEE_PERCENTAGE`) atua exclusivamente como parâmetro de desenvolvimento/testes.

## 2. Inviolabilidade da Agenda (Double Booking Zero)
- Um instrutor não pode ter 2 aulas no mesmo intervalo de tempo.
- Um veículo não pode estar alocado em 2 aulas simultâneas.
- O bloqueio de conflito é garantido no nível do banco de dados (restrições transacionais e índices `EXCLUDE` no PostgreSQL).
- *Nota de Conformidade:* Validações em TypeScript ou testes em memória são meramente preparatórias; a validação definitiva ocorrerá na Sprint de Booking/Disponibilidade com transações e travas atômicas no PostgreSQL.

## 3. Confirmação de Pagamento
- O frontend jamais dita o status `CONFIRMED`.
- O webhook assinado do Gateway recebido no backend é a única autoridade para transicionar o booking de `PENDING_PAYMENT` para `CONFIRMED`.

## 4. Retenção e Repasse (Payout)
- O valor pago pelo aluno não é repassado imediatamente.
- O repasse entra no estado `PENDING`, transiciona para `AVAILABLE` somente após a aula estar `COMPLETED` e decorrido o período de segurança de 24 horas (`Safety Period`), prevenindo fraudes e contestações.

## 5. Política de Cancelamento e Reembolso
- **[DECISÃO PENDENTE]:** A política comercial definitiva de cancelamento será configurada administrativamente na plataforma via `CancellationPolicyConfig`.
- **Configuração Inicial de Desenvolvimento (`DEFAULT_DEVELOPMENT_POLICY`):**
  - Cancelamento pelo Fornecedor: Reembolso integral (100%) imediato ao aluno.
  - Cancelamento pelo Aluno:
    - ≥ 24 horas de antecedência: Reembolso integral (100%).
    - Entre 6 e 24 horas: Reembolso de 50%.
    - < 6 horas ou No-Show: Sem reembolso (fornecedor recebe o valor deduzida a taxa).

## 6. Verificação de Fornecedores (Compliance)
- Apenas fornecedores com status `ACTIVE` e veículos com status `ACTIVE` têm ofertas listadas na busca pública e podem receber reservas.
- Rejeições de documentos exigem motivo formal registrado em log de auditoria.

## 7. Mapas e Geolocalização
- **[DECISÃO]:** OpenStreetMap + Leaflet é o provider inicial de mapas do MVP para o frontend.
- **[DECISÃO]:** PostgreSQL + PostGIS continuará como único responsável pelas operações geoespaciais de domínio (cálculo de distâncias, ordenação, raios de atendimento e busca).
