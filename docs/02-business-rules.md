# MAZZI — regras de negócio

## RBAC

| Ação | Aluno | Instrutor | Equipe da escola | Admin |
|---|---:|---:|---:|---:|
| Reservar/pagar | Própria conta | Não | Não | Suporte auditado |
| Perfil/agenda | Não | Próprio vínculo | Escopo da escola | Sim |
| Veículos | Não | Autorizados | Escopo da escola | Sim |
| Reservas/chat | Próprias | Atribuídas | Escopo da escola | Suporte auditado |
| Avaliar | Aula elegível | Não | Não | Moderar |
| Aprovar/moderar | Não | Não | Não | Sim |

Um usuário pode ter mais de um papel somente por vínculo explícito. Autorização é conferida por recurso no servidor, nunca pela tela ou por IDs recebidos do cliente.

## Booking e double booking

1. Reserva aponta para fornecedor, instrutor, serviço/categoria, veículo aplicável, início e fim em `America/Sao_Paulo`.
2. Servidor é a fonte de verdade; horário exibido não é garantia até confirmação.
3. Não pode haver sobreposição para o mesmo instrutor nem o mesmo veículo atribuído. Escola também respeita recursos selecionados.
4. Criar/reservar em transação atômica, usando constraint de intervalo no banco ou lock equivalente; validação de front-end não é suficiente.
5. Pagamento pendente cria `hold` expirábel. Falha/expiração libera o recurso automaticamente.
6. Revalidar antes da confirmação por webhook. Conflito após pagamento exige reversão/reembolso seguro e incidente auditável.
7. Agenda não altera reserva confirmada; usar fluxo de cancelamento/reagendamento.

## Máquina de estados

`draft` → `hold` → `payment_pending` → `confirmed` → `completed`

Saídas controladas: `hold_expired`, `payment_failed`, `cancelled_by_student`, `cancelled_by_provider`, `cancelled_by_admin`, `no_show_student`, `no_show_provider`, `refund_pending`, `refunded`, `disputed`.

Estados finais não mudam em endpoint comum; todas as transições são auditadas.

## Pagamento, chat, avaliações e cancelamento

- Confirmar pagamento apenas por provedor aprovado e webhook autenticado/idempotente; não guardar cartão completo.
- Persistir snapshot imutável de preço, moeda, taxas e destinatário por reserva.
- Split/repasse, estorno, chargeback e conciliação são pendentes; não automatizar repasse antes da decisão.
- Chat só é habilitado aos participantes de uma reserva confirmada/ativa; requer denúncia/bloqueio e trilha de moderação.
- Aluno avalia uma vez após aula concluída elegível; admin pode moderar.
- Política provisória do MVP (a validar juridicamente antes de reservas reais): cancelamento grátis até 24 horas antes; de 24 horas até 2 horas antes, retenção de 50%; com menos de 2 horas ou no-show do aluno, retenção de 100%; cancelamento/no-show do fornecedor gera reembolso integral ao aluno. Exceções e disputas são tratadas pelo admin com registro de motivo.
- O produto deve mostrar a regra e o valor aplicável antes da confirmação do pagamento. Mudanças futuras devem ser versionadas, sem alterar retroativamente a regra anexada à reserva.

## Segurança e LGPD

- Minimizar dados e registrar finalidade/base legal conforme jurídico.
- Para ativação manual de fornecedor, coletar e revisar: identidade, dados de contato, documentação/credencial profissional aplicável, documentação do veículo aplicável e dados bancários para futuro repasse. A lista final e a retenção dependem de validação jurídica.
- Separar dados públicos de documentos; aplicar acesso mínimo e criptografia disponível.
- Auditar aprovação, mudanças de agenda, reserva, pagamento, reembolso e ações admin.
- Implementar direitos LGPD conforme política aprovada, preservando obrigações legais/financeiras.
- Não expor telefone, documentos ou endereço preciso antes de necessidade operacional aprovada.
