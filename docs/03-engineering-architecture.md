# MAZZI — arquitetura de referência

## Arquitetura definida

Web app responsivo/PWA com Next.js, React e TypeScript. O mesmo projeto entrega as áreas de Aluno, Instrutor, Autoescola e Admin, com serviços server-side/API do Next.js, PostgreSQL gerenciado pelo Supabase e Prisma. A aplicação é um monólito modular, para reduzir operação e preservar transações fortes em reservas/pagamentos.

O fluxo de camadas é: frontend → API/Server Actions → controllers → services/regras → repositories → PostgreSQL. Supabase Auth/Storage são serviços gerenciados, Google Maps fica atrás de `MapService` e Mercado Pago atrás de `PaymentService`. Regras críticas nunca ficam em componentes React.

Consulte `docs/07-technology-decisions.md` para a stack completa e as integrações externas ainda sem provedor escolhido.

## Domínios e entidades

| Domínio | Entidades |
|---|---|
| Identidade | User, Role, UserRole, Session, Student, Consent, AuditEvent |
| Marketplace | Provider, ProviderMembership, InstructorProfile, DrivingSchoolProfile, ServiceOffering, ServiceArea, Category, ProviderCategory |
| Frota/compliance | Vehicle, Document, VehicleAssignment, VerificationCase |
| Agenda | AvailabilityRule, AvailabilityException, Booking, BookingEvent, LessonSession |
| Financeiro | Payment, PaymentAttempt, Commission, Refund, PayoutLedger (após decisão) |
| Comunicação/reputação | Conversation, Message, Notification, Report, Review, ReviewModeration, Dispute |
| Operação | SupportCase, AdminAction, Configuration |

## Banco

- UUID/ULID, timestamps e eventos críticos append-only.
- `booking` conserva snapshot de preço, serviço, fornecedor, instrutor e veículo.
- Armazenar UTC; aplicar regras locais em `America/Sao_Paulo`.
- Índices para oferta, agenda, pagamento e autorização; constraint/lock de intervalo contra sobreposição.
- PostGIS calcula internamente a distância por coordenadas. O MVP exibe distância aproximada e não chama uma API de rotas.

## API inicial

`auth/me`, marketplace público, `student` (reservas/checkout/chat/avaliações), `provider` (perfil/equipe/veículos/agenda/reservas), `admin` (verificação/moderação/suporte/auditoria) e webhooks assinados.

Requisitos: autenticação em rotas privadas, RBAC por recurso/tenant, validação, paginação, rate limit e chaves de idempotência. Cliente nunca é autoridade para preço, papel, fornecedor, pagamento ou estado.

## Testes prioritários

1. Máquina de estados e concorrência/double booking.
2. RBAC e isolamento entre fornecedores.
3. Idempotência de pagamento/webhooks e valores.
4. Cancelamento/reembolso após regra aprovada.
5. Fluxos críticos de aluno, fornecedor e admin.
