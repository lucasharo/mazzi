# CACHE POLICY — MAZZI

## Princípio

Cache melhora UX e performance. Cache não é autoridade de negócio.

O backend continua sendo a fonte da verdade para Aula Agora, offers, matching,
booking lifecycle, pagamentos, reembolsos, check-in, GPS, disponibilidade,
concorrência e idempotência. Uma ação crítica sempre chega a uma RPC ou serviço
backend; um valor salvo no cache nunca autoriza ou confirma uma operação.

## Políticas por domínio

| Classe | Exemplos | Política atual |
| --- | --- | --- |
| Long cache | configuração pública, offerings e catálogos seguros | stale por 10 min; coleta após 24 h; persistência apenas quando a query for marcada como segura |
| Short cache | bookings, workspace, dashboards derivados, próxima aula, busca e notificações | stale entre 20 e 60 s; invalidação após mutation ou evento Realtime |
| Server authority | Aula Agora, offers, matching, GPS, pagamento, refund, check-in e lifecycle | stale time zero ou atualização imediata; não persistir como estado operacional |

## Arquitetura

Student e PRO usam um QueryClient central por bundle, chaves canônicas em
`src/lib/query-keys.ts` e carregadores compartilhados em
`src/lib/server-state.ts`. O `fetchQuery` deduplica chamadas simultâneas com a
mesma chave e mantém a identidade do aluno, provider e instrutor no escopo.

Realtime e eventos de notificação invalidam queries específicas; a aplicação
refaz a leitura canônica no Supabase em vez de manter uma segunda store paralela.
Mutations de booking/payment invalidam detalhe, listas, dashboards derivados,
próxima aula e dependências de pagamento relacionadas.

## Persistência web e React Native

Somente queries com `meta.persist === true` são desidratadas. A persistência web
usa IndexedDB por meio do `Persister` do TanStack Query; não usa `localStorage`
para o cache. Offers ativas, matching, countdown, GPS, pagamentos pendentes,
refunds, tokens, documentos de compliance e dados bancários nunca são
persistidos.

O provider depende da interface assíncrona de storage do TanStack Query. Essa é a
fronteira para substituir o adaptador IndexedDB por MMKV quando Student e PRO
forem portados para React Native, sem colocar MMKV no bundle web atual.

## Offline

O PWA pode renderizar um snapshot seguro persistido, sempre como dado recente ou
last known. Ao reconectar, queries refazem leitura. Mutations críticas não são
otimistas: sem backend não há cancelamento, pagamento, aceite, check-in ou
conclusão localmente confirmados.

## Service Worker e custo

O Service Worker mantém estratégia de assets estáticos e não intercepta chamadas
críticas do Supabase. Esta etapa não adiciona Redis, cache server-side, CDN de
API ou serviço pago novo.
