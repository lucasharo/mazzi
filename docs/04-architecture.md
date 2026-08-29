# 04 — Arquitetura de Software

## Padrão Arquitetural: Monolito Modular
Para o MVP, adota-se um **Monolito Modular** bem desacoplado, com domínios bem delimitados, garantindo simplicidade operacional, transações ACID nativas no banco de dados e publicação dos frontends no Cloudflare Pages por GitHub Actions.

```
+-------------------------------------------------------------------+
|                        MAZZI APPLICATIONS                         |
|  +--------------------+  +--------------------+  +--------------+ |
|  |    MAZZI ALUNO     |  |     MAZZI PRO      |  | MAZZI ADMIN  | |
|  |  (Student Mobile)  |  | (Instructor/CFC)   |  | (Backoffice) | |
|  +--------------------+  +--------------------+  +--------------+ |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                     SHARED CORE & DESIGN SYSTEM                   |
|   UI Components | MapProvider (Leaflet) | Types | Domain Rules    |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                     BACKEND DOMAIN MODULES                        |
|  [Auth/RBAC] [Users] [Providers] [Vehicles] [Offerings]           |
|  [Availability Engine] [Search & PostGIS] [Quote & Booking]       |
|  [Payments & Payouts] [Lessons & Check-in] [Reviews] [Compliance]  |
|  [Audit & Logs] [Notifications & Chat]                            |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                      DATA & STORAGE LAYER                         |
|     PostgreSQL 16 + PostGIS (ACID & Temporal Exclusions)          |
|     Supabase Storage (Private Signed URLs for Compliance)         |
+-------------------------------------------------------------------+
```

## Princípios de Design e Decisões Arquiteturais

1. **Single Source of Truth:** O banco relacional PostgreSQL gerencia todo o estado consistente.
2. **Isolamento de Domínio:** Cada módulo encapsula suas entidades e serviços.
3. **Portas e Adaptadores (Clean Architecture):** Integrações externas (Gateway de pagamento, Mapas, Storage) utilizam interfaces abstratas substituíveis.
4. **[DECISÃO ARQUITETURAL]: Mapas & Geolocalização:**
   - **Frontend (Apresentação):** `OpenStreetMap + Leaflet` através da interface abstrata `MapProviderComponent`. Permite visualização sem custos ou chaves externas proprietárias.
   - **Backend (Domínio & Fonte da Verdade):** `PostgreSQL 16 + PostGIS`. Todas as operações geoespaciais críticas (cálculo de distâncias em metros com `ST_DWithin`, polígonos de raio e ordenação por proximidade) pertencem e são calculadas pelo backend.
5. **[DECISÃO ARQUITETURAL]: Concorrência & Double Booking:**
   - A garantia de inviolabilidade da agenda é implementada no nível de persistência transacional (`EXCLUDE USING gist`) e bloqueio pessimista (`FOR UPDATE`), não em checagens voláteis de memória.

## Runtime de elegibilidade

O predicado canônico `is_provider_instructor_eligible` é usado pelas RPCs e triggers do PostgreSQL. O React exibe o estado e chama RPCs autenticadas; não decide ativação, disponibilidade ou início de aula.

## Publicação e ambientes

- Os apps Aluno, PRO e Admin são compilados separadamente com Vite.
- A landing page pública é um quarto artefato Vite independente, executado localmente na porta `3005`.
- O GitHub Actions executa lint, testes e `npm run build:all`.
- Pushes para `feature/premium-ui-v2` publicam os quatro artefatos no Cloudflare Pages nos projetos DEV configurados no workflow (`mazzi-aluno-dev`, `mazzi-profissional-dev`, `mazzi-admin-dev` e `mazzi-landing-dev`).
- O Supabase permanece como backend compartilhado e fonte de verdade para dados, autenticação, RLS, RPCs e Storage privado.
- Cloudflare Pages é o único destino de deploy do ambiente atual.
