# 05 — Modelo de Dados (Supabase / PostgreSQL 16 + PostGIS)

## 1. Justificativa Técnica: PostgreSQL vs Firestore
O sistema MAZZI gerencia reservas com restrições rigorosas de concorrência temporal (*zero double booking*), transações atômicas de pagamento, idempotência e consultas geoespaciais com raio de cobertura. O PostgreSQL 16 provisionado via Supabase com extensões `btree_gist` e `postgis` é a **única fonte da verdade** (*source of truth*) transacional do marketplace.

### Principais Recursos Habilitados:
1. **Restrições de Exclusão Temporal:** `EXCLUDE USING gist (instructor_id WITH =, slot_range WITH &&)` e `(vehicle_id WITH =, slot_range WITH &&)` ativas para os status `('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')`.
2. **Índices Geoespaciais PostGIS (`GEOGRAPHY`):** `ST_DWithin` com índice `GIST` no campo `location GEOGRAPHY(Point, 4326)` para busca geográfica esferoidal em metros.
3. **Integridade Monetária Anti-Float:** Todos os atributos financeiros são `INTEGER NOT NULL` representando centavos (R$ 100,00 = `10000`).
4. **Idempotência Garantida:** Constraints `UNIQUE` em chaves de idempotência para pagamentos, reembolsos e repasses.
5. **UUIDs Nativos:** Geração nativa via `gen_random_uuid()` sem dependência desnecessária de `uuid-ossp`.

---

## 2. Diagrama Entidade-Relacionamento (ERD Textual)

```
+--------------------+       1:1       +--------------------+
|       users        |<--------------->|     providers      |
+--------------------+                 +--------------------+
          |                                      |
          | 1:N                                  | 1:N
          v                                      v
+--------------------+                 +--------------------+
|      bookings      |<----------------|      vehicles      |
+--------------------+                 +--------------------+
    |              |                             |
    | 1:1          | 1:1                         | 1:N
    v              v                             v
+------------+ +-------------+         +--------------------+
|  payments  | |   reviews   |         | service_offerings  |
+------------+ +-------------+         +--------------------+
    |              |                             |
    v              v                             v
+------------+ +-----------------+     +--------------------+
|  refunds   | |  conversations  |     |   availabilities   |
+------------+ +-----------------+     +--------------------+
```

---

## 3. Contagem e Relação Completa das 21 Tabelas

A migration `20260814000001_initial_schema.sql` cria **exatamente 21 tabelas distintas**:

1. **`users`**: Usuários cadastrados (Aluno, Instrutor, Escola, Admin, Suporte).
2. **`providers`**: Entidades prestadoras de serviço (Instrutor Autônomo e CFC / Autoescola).
3. **`driving_school_staff`**: Vínculo entre autoescola e colaboradores/instrutores contratados.
4. **`vehicles`**: Frota de veículos (Categorias A e B, Manual/Automático, placa mascarada para público).
5. **`service_offerings`**: Ofertas e pacotes de aula por tipo de veículo/câmbio com preço em centavos.
6. **`availabilities`**: Grade de disponibilidade semanal recorrente.
7. **`availability_exceptions`**: Exceções e bloqueios manuais (férias, manutenção).
8. **`quotes`**: Cotações com preço fixado e expiração (10 min).
9. **`bookings`**: Reservas com range temporal `tstzrange`, snapshots imutáveis e ciclo de vida.
10. **`payments`**: Transações com `idempotency_key` única e método (PIX/Cartão).
11. **`refunds`**: Estornos com registro de motivo e idempotência.
12. **`payouts`**: Repasses a fornecedores com período de segurança de 24h pós-aula concluída.
13. **`conversations`**: Canais de chat atrelados a cada reserva (`UNIQUE(booking_id)`).
14. **`messages`**: Mensagens de texto trocadas no chat contextual.
15. **`reviews`**: Avaliações de alunos com constraint `UNIQUE(booking_id)`.
16. **`compliance_documents`**: Documentos de validação (CNH, CRLV, etc.) com referência segura ao storage.
17. **`audit_logs`**: Registro imutável de ações administrativas e operacionais.
18. **`platform_configurations`**: Configurações dinâmicas de comissão, prazos e regras do sistema.
19. **`cancellation_policies`**: Matriz principal de políticas de cancelamento.
20. **`cancellation_policy_rules`**: Faixas de antecedência e percentuais de reembolso/multa.
21. **`analytics_events`**: Rastreamento de métricas operacionais e de conversão.

---

## 4. Comparativo Técnico PostGIS: `GEOGRAPHY` vs `GEOMETRY`

### Escolha para o MVP MAZZI: `GEOGRAPHY(Point, 4326)`

| Critério | `GEOGRAPHY(Point, 4326)` (Escolhido) | `GEOMETRY(Point, 4326)` |
| :--- | :--- | :--- |
| **Modelo Espacial** | Esferoidal / Geodésico real (Terra redonda WGS 84). | Plano cartesiano bidimensional. |
| **Unidade de `ST_DWithin`** | **Metros** (`ST_DWithin(location, point, 5000)` = 5 km). | **Graus** (exige conversão angular imprecisa `5000 / 111320.0`). |
| **Complexidade da Query** | Direta, sem conversões nem casts de projeção. | Exige `::geography` no filtro ou reprojeção para UTM (ex: EPSG:31983 para SP). |
| **Índice GiST** | Suporte nativo e otimizado em PostGIS. | Suporte nativo. |
| **Desempenho no MVP** | O overhead computacional de cálculo trigonométrico é irrelevante para a volumetria do MVP (< 100k fornecedores). | Ligeiramente mais rápido em cálculos puros, mas propenso a erros de distorção angular. |

---

## 5. Estratégia de RLS (Row Level Security) e Defesa em Profundidade

1. **RLS Habilitado em 100% das 21 Tabelas:** Nenhuma tabela criada no schema `public` aceita leituras anônimas indiscriminadas.
2. **Catálogo Público Seguro:** Políticas restritas para visualização apenas de entidades ativas (`providers` status `ACTIVE`, `vehicles` status `ACTIVE`, `service_offerings` ativas e `reviews`).
3. **Isolamento de Segredos:** Dados sensíveis (`renavam`, `license_plate` sem máscara, documentos de compliance e pagamentos) não possuem políticas públicas de leitura.
4. **Chave de Acesso Admin:** `SUPABASE_SERVICE_ROLE_KEY` é estritamente de uso server-side (Node/Express API), jamais exportada com prefixo `VITE_`.

## Estruturas Autoescola ↔ Instrutor

- `driving_school_membership_events` registra transições e recontratações sem apagar vínculos.
- `booking_selection_mode` em quotes/bookings preserva `SPECIFIC_INSTRUCTOR` ou `ANY_AVAILABLE_INSTRUCTOR`.
- `compliance_documents` suporta escopos `USER_GLOBAL` e `SCHOOL_MEMBERSHIP`.
- As migrations `20260821211805` até `20260821212857` foram aplicadas no LIVE de forma forward-only.
