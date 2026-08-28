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

### FASE ATUAL — MERCADO PAGO DE TESTE (Ambiente DEV)
- **Zero Cobrança Real**: Nenhum dinheiro real é transacionado, debitado ou enviado para gateways bancários externos.
- **Provedor de Teste**: O ambiente DEV usa credenciais de teste do Mercado Pago; o gateway fake fica restrito ao desenvolvimento local.
- **Confirmação em Validação**: A confirmação depende da resposta autorizada do backend e das regras transacionais do PostgreSQL (`confirm_booking_payment`).
- **Bloqueio de Produção**: O gateway fake é sempre bloqueado em builds de produção, sem exceções por variável de ambiente.
- **Natureza Semântica**: Os pagamentos de teste não representam liquidação financeira real nem emissão de títulos de crédito.

### FUTURO — PAGAMENTO FINANCEIRO REAL
- O frontend **jamais** dita ou confirma o status `CONFIRMED` de pagamento real.
- O webhook criptograficamente assinado do Gateway recebido e verificado no backend (trusted backend) é a única autoridade para transicionar um booking real de `PENDING_PAYMENT` para `CONFIRMED`.
- A integração financeira com gateway real (ex: Mercado Pago) permanece postergada para fases pós-MVP.

## 4. Retenção e Repasse (Payout)
- O valor pago pelo aluno não é repassado imediatamente.
- O repasse entra no estado `PENDING`, transiciona para `AVAILABLE` somente após a aula estar `COMPLETED` e decorrido o período de segurança de 24 horas (`Safety Period`), prevenindo fraudes e contestações.

## 5. Política Comercial de Cancelamento e Reembolso (DEC-013)
- **Política Oficial do MVP (`MVP_CANCELLATION_POLICY`):**
  | Evento | Antecedência | Reembolso Aluno | Obs |
  |---|---:|---:|---|
  | Cancelamento Aluno | >= 24h | 100% | Reembolso integral ao aluno; 0% prestador |
  | Cancelamento Aluno | >= 6h e < 24h | 50% | Reembolso parcial (50%); 50% compensação/retido |
  | Cancelamento Aluno | < 6h | 0% | Cancelamento tardio (0% reembolso) |
  | Cancelamento Prestador | Qualquer | 100% | Reembolso integral ao aluno; motivo obrigatório |
  | No-Show do Aluno | — | 0% | Sem reembolso |
  | No-Show do Prestador | — | 100% | Reembolso integral ao aluno |

- *Nota Legal:* Direitos legais obrigatórios do consumidor aplicáveis (`LEGAL_OVERRIDE`) prevalecem sobre esta política comercial.


## 6. Verificação de Fornecedores (Compliance)
- Apenas fornecedores com status `ACTIVE` e veículos com status `ACTIVE` têm ofertas listadas na busca pública e podem receber reservas.
- Rejeições de documentos exigem motivo formal registrado em log de auditoria.

## 7. Mapas e Geolocalização
- **[DECISÃO]:** OpenStreetMap + Leaflet é o provider inicial de mapas do MVP para o frontend.
- **[DECISÃO]:** PostgreSQL + PostGIS continuará como único responsável pelas operações geoespaciais de domínio (cálculo de distâncias, ordenação, raios de atendimento e busca).

## 8. Autoescola e instrutor — implementação atual

- Convites usam `target_user_id` ou e-mail normalizado; CPF/documento não participa do fluxo.
- Vínculos passam por `PENDING_COMPLIANCE`, `ACTIVE`, `SUSPENDED` e `ENDED`; encerramento preserva histórico e recontratação reutiliza o vínculo encerrado.
- Contratação e início/check-in exigem vínculo, compliance global e compliance do contexto válidos.
