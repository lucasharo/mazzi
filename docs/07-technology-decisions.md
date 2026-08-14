# MAZZI — decisões de tecnologia já definidas

Este documento recupera as escolhas feitas na conversa de produto. Não substitua estas decisões por outra stack sem aprovação.

## Aplicação e estrutura

| Área | Decisão |
|---|---|
| Formato inicial | Web app responsivo, mobile-first, instalável como PWA. |
| Aplicações | Áreas de Aluno, Instrutor, Autoescola e Admin no mesmo projeto inicialmente, com backend e banco compartilhados. |
| Frontend | Next.js + React + TypeScript. |
| Backend | Next.js no servidor (API e serviços server-side) + TypeScript, em arquitetura modular. |
| Banco | PostgreSQL. |
| ORM | Prisma. |
| Regras críticas | Serviços de backend; nunca componentes React. |
| Arquitetura | Frontend → API/Server Actions → controllers → services/regras → repositories → PostgreSQL. |

## Serviços externos

| Capacidade | Decisão | Provedor |
|---|---|---|
| Banco, autenticação e arquivos | Supabase: PostgreSQL, Auth com e-mail/senha/OTP e Storage privado para documentos/fotos. | **Supabase definido.** Prisma continua como ORM no servidor. |
| Mapas | Google Maps para visualização e busca de endereços. | **Google Maps definido.** Manter `MapService` como abstração. |
| Distância | Cálculo interno no PostgreSQL/PostGIS a partir de latitude/longitude. | **Definido.** Exibir distância aproximada em linha reta; não usar rotas no MVP. |
| Pagamentos | Pix, cartão, marketplace/split, repasse, refund e webhook. | **Mercado Pago definido**, sujeito à configuração de conta e validação financeira/jurídica. |
| Notificações | E-mail e push web no MVP. WhatsApp/SMS/push mobile ficam futuros. | Provedor pendente. |

## Módulos de domínio obrigatórios

- `EligibilityService`: elegibilidade de aluno, fornecedor, veículo, categoria e reserva.
- `PricingService`: preço em centavos, sem preço dinâmico no MVP.
- `CancellationService`: política parametrizável e versionada.
- `PaymentService`: pagamento, webhook assinado/idempotente e futuro repasse.
- `ComplianceService`: requisitos configuráveis, documentos, revisão, expiração e suspensão.
- `MatchingService`: filtra elegibilidade e disponibilidade, calcula distância/ranking.
- `DocumentStorageService`, `MapService` e `NotificationService`: encapsulam serviços externos; os dois primeiros usam Supabase Storage e Google Maps nesta versão.

## Convenções obrigatórias

- Usar TypeScript em todo código de aplicação.
- Usar valores monetários inteiros em centavos; nunca `float`.
- Datas persistidas em UTC; regras e apresentação em `America/Sao_Paulo`.
- Backend confirma preço, disponibilidade, veículo, categoria, elegibilidade e estados antes de criar uma reserva.
- Serviços externos ficam atrás de interfaces para troca de provedor.
- PWA é o canal inicial; apps nativos não entram no MVP.
- Não usar Google Routes no MVP. Distância e ranking são calculados internamente; o mapa é carregado somente quando necessário para visualização ou endereço.
