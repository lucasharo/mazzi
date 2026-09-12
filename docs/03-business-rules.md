# 03 — Regras de Negócio Inegociáveis

## Aula Agora — disponibilidade do instrutor

- O botão **Aceitar Aula Agora** representa somente a disponibilidade física do instrutor, com estado canônico por `provider_id + instructor_id`.
- Ao ativar, o backend grava `online_since` e `online_expires_at` em uma janela máxima de 1 hora. `NOW() < online_expires_at` é obrigatório para novas ofertas.
- Refresh, atualização de GPS, aceite/recusa de oferta e salvamento de veículo não renovam a janela. Nova janela exige ativação explícita.
- No Android PRO, o GPS em segundo plano usa um foreground service com notificação persistente somente durante essa janela canônica. Pausa, expiração, logout ou perda da sessão encerram o serviço; o aplicativo não solicita `ACCESS_BACKGROUND_LOCATION` nem mantém rastreamento deliberado após o processo ser encerrado.
- Ao recusar uma oferta, o instrutor fica pelo período configurado no Admin sem receber valores nem outra oferta do mesmo aluno; o padrão é 5 minutos e a regra é aplicada no matching do backend.
- Expiração ou perda de elegibilidade remove o instrutor do matching sem desligar a configuração independente `provider_instant_settings.instant_enabled` de cada veículo.
- `provider_instant_settings.instant_online` é mantido somente para compatibilidade legada e não é fonte de verdade.

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

- **Apresentação de motivos:** `reason_code`, enums e outros códigos internos nunca são exibidos ao Aluno ou ao PRO. Isso vale também para mensagens compostas, como `Conflito de agenda: SCHEDULE_CONFLICT`; a camada de apresentação deve remover o código e exibir apenas a descrição amigável em pt-BR.

## 6. Disputas e Repasse Automático (DEC-014)

- O repasse ao prestador é agendado na conclusão da aula e executado automaticamente após o prazo configurado no Admin.
- O padrão de produção é **72 horas** após a conclusão. Ambientes de teste podem usar **0 hora**.
- Aluno ou prestador podem abrir uma disputa somente enquanto a janela de retenção estiver ativa para aulas `COMPLETED`. Reservas antigas `CONFIRMED` cujo horário final já passou permanecem elegíveis enquanto estiverem sem resolução, para que aulas pendentes não expirem sem tratamento. Se não houver `lesson_started_at`, o participante autorizado também pode cancelar a reserva antiga; se houver início real registrado, o cancelamento comercial não é permitido e a resolução deve ocorrer por conclusão, no-show ou disputa.
- Uma disputa ativa muda a reserva para `DISPUTED` e bloqueia atomicamente qualquer repasse ainda não pago.
- Sem disputa ativa, o processador idempotente cria uma transferência Stripe Connect após o vencimento, sem ação do Admin.
- A outra parte pode responder à disputa; o prazo operacional inicial de resposta é 48 horas.
- Aluno e prestador podem anexar até 10 imagens ou PDFs de até 10 MB cada como evidência. Os arquivos ficam em storage privado e são acessados somente por URL assinada temporária pelos participantes e pelo Admin autorizado.
- A decisão administrativa pode liberar o repasse, realizar reembolso integral/parcial, determinar reagendamento ou encerrar sem efeito financeiro.
- Chargeback Stripe é uma contestação financeira externa e permanece separado da disputa operacional da aula.

- *Nota Legal:* Direitos legais obrigatórios do consumidor aplicáveis (`LEGAL_OVERRIDE`) prevalecem sobre esta política comercial.


## 6. Verificação de Fornecedores (Compliance)
- Apenas fornecedores com status `ACTIVE` e veículos com status `ACTIVE` têm ofertas listadas na busca pública e podem receber reservas.
- Ofertas `AULA_AGORA` são operacionais e independentes das ofertas `AGENDA`; não aparecem na agenda/busca pública, mas continuam sujeitas a compliance, disponibilidade e à trava transacional de conflito.
- Na Aula Agora, somente veículos com status `ACTIVE` na Gestão podem ser elegíveis. A habilitação é independente por veículo: desativar um carro não desativa os demais.
- A disponibilidade do instrutor é controlada por um único estado canônico por `provider_id + instructor_id`; quando desligada, nenhum veículo habilitado recebe novas ofertas. O campo legado por veículo permanece apenas para compatibilidade e não participa do matching.
- Ofertas pendentes de um veículo desativado expiram somente para aquele veículo; reservas `PENDING_PAYMENT`, `CONFIRMED` e `IN_PROGRESS` não são alteradas.
- Rejeições de documentos exigem motivo formal registrado em log de auditoria.

## 7. Mapas e Geolocalização
- **[DECISÃO]:** OpenStreetMap + Leaflet é o provider inicial de mapas do MVP para o frontend.
- **[DECISÃO]:** PostgreSQL + PostGIS continuará como único responsável pelas operações geoespaciais de domínio (cálculo de distâncias, ordenação, raios de atendimento e busca).

## 8. Autoescola e instrutor — implementação atual

- Convites usam `target_user_id` ou e-mail normalizado; CPF/documento não participa do fluxo.
- Vínculos passam por `PENDING_COMPLIANCE`, `ACTIVE`, `SUSPENDED` e `ENDED`; encerramento preserva histórico e recontratação reutiliza o vínculo encerrado.
- Contratação e início/check-in exigem vínculo, compliance global e compliance do contexto válidos.
- A busca pública só lista ofertas ativas que tenham pelo menos uma regra semanal recorrente ativa compatível com o instrutor e o veículo e um cadastro de recebimentos Stripe Connect concluído (`status = ACTIVE`, `charges_enabled = true` e `payouts_enabled = true`). Exceções de disponibilidade não substituem o cadastro base da agenda para fins de descoberta pública.
