# MAZZI Student App — New Template Fase 1

## Escopo

Esta fase estabelece o shell mobile-first e a experiência de busca do aluno. O Student App usa a busca pública `dbService.searchPublicProviderResults`, que delega a consulta à RPC `search_providers_public`. Agenda, checkout, chat, notificações persistidas, perfil e câmera permanecem nas implementações existentes.

## Direção visual

As referências Taxi App UI Kit (Wannathis) e Free Taxi Kit (Egor Mi) foram usadas somente para hierarquia, composição, espaçamento, navegação e uso de mapa. A interface mantém a identidade MAZZI com slate, amber, branco e cinzas claros; não foram copiados logos, textos ou assets proprietários.

## Shell e navegação

- layout ocupa `100%` da viewport e usa `min-height: 100dvh`;
- desktop usa largura confortável (`max-w-6xl` no conteúdo), sem moldura estreita de telefone;
- tabs principais: Buscar, Aulas, Chat e Perfil;
- notificações ficam no sino do header e abrem o `NotificationsPanel` existente em modal;
- Chat lista somente bookings reais e abre o `BookingChatPanel` existente.

## Busca

- localização manual e `navigator.geolocation` continuam ativos;
- o marcador do endereço pesquisado continua sendo responsabilidade do mapa;
- o MVP do aluno expõe somente Categoria B;
- chips rápidos usam transmissão, `radiusMeters` e `maxPriceInCents`;
- filtros de data não são destacados nesta fase porque a RPC pública atual não filtra por data;
- resultados, cards, loading, erro e empty state são derivados da RPC pública;
- providers, veículos e ofertas não são carregados por SELECT privado no initial load do aluno;
- booking context público continua sendo usado para abrir agenda e checkout.

## Cards e mapa

Cards usam `PublicSearchProviderResult`, avatar real quando disponível e iniciais como fallback. Rating zero exibe “Novo na MAZZI”; preços vêm de `startingPriceInCents`; duração só aparece quando existe no offering público; informações do veículo vêm de `publicOfferings`. O mapa permanece Leaflet com os tiles atuais e localização pública aproximada.

## Dívidas mantidas

```text
PAYMENT_PRODUCTION_READY = NO
GEOCODING_PRODUCTION_READY = NO
AVATAR_STORAGE_PRODUCTION_READY = NO
```

O pagamento continua `FakePaymentGateway` de desenvolvimento, o geocoder é o adapter de desenvolvimento e avatares continuam em Data URL/base64 nesta fase. Nenhuma migration ou dependência nova foi adicionada.

## FASE 2 — Perfil e agendamento

- o perfil público usa somente `PublicSearchProviderResult` e `publicOfferings`;
- avatar real é exibido quando existe, com iniciais como fallback;
- instrutor e Autoescola/CFC recebem labels distintos; ofertas da superfície do aluno ficam em Categoria B;
- calendário mantém janelas progressivas de 30, 60 e 90 dias;
- `get_available_slots_public` continua sendo a única autoridade de disponibilidade;
- datas indisponíveis permanecem visíveis e desabilitadas; horários são agrupados em manhã, tarde e noite;
- quote/checkout só é inicializado com `selectedSlot.slot_start_at` real;
- conflitos de concorrência retornam o usuário à agenda para escolher outro horário;
- nenhuma migration foi criada.

## FASE 3 — Minhas aulas

- a aba Minhas aulas mantém `dbService.getBookings()` como única fonte de bookings do aluno;
- Próximas inclui `CONFIRMED`, `PENDING_PAYMENT` e `IN_PROGRESS`, ordenadas pela data/hora real;
- Histórico inclui os status encerrados e é ordenado da aula mais recente para a mais antiga;
- cards de aluno exibem data, hora, instrutor, prestador quando diferente, veículo, câmbio, ponto de encontro, preço e status em linguagem humana;
- detalhes usam o snapshot histórico da reserva para profissional, veículo e valores, sem exibir o UUID técnico;
- duração só é mostrada quando existe no snapshot; não há fallback fixo de 50 minutos;
- loading usa skeletons, erros têm retry por `bookingsRefreshKey`, e estados vazios oferecem Buscar aulas quando aplicável;
- Chat e Avaliar aula continuam usando os fluxos existentes; check-in permanece oculto no Student até existir backend autorizado;
- nenhuma migration, dependência, alteração de pagamento ou alteração de realtime foi criada.

## Backlog de busca

`SEARCH_DATE_FILTER_BACKLOG = P1`: o frontend ainda não envia o parâmetro de data da RPC pública; o ajuste fica reservado para uma fase posterior de polish da busca.
