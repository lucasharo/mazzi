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
- chips rápidos usam transmissão, `radiusMeters`, `maxPriceInCents` e datas existentes;
- datas são calculadas em formato local `YYYY-MM-DD`, sem conversão UTC via `toISOString()`;
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
