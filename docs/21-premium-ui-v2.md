# MAZZI Premium UI V2 — análise da referência

Referência visual: `reference/premium-driver-ui.png` (analisada visualmente em 17/08/2026).

- **BACKGROUND:** marfim muito claro, aproximadamente `#F7F5EF`, com iluminação quente discreta.
- **SURFACE:** branco quente `#FFFFFF`; módulos internos usam `#F2F1ED`.
- **ACCENT:** amarelo dourado `#F6C945`, com luz `#FFE797` e gradiente curto.
- **DARK_SURFACE:** grafite `#202126`, nunca preto puro.
- **TEXT_PRIMARY:** `#1F2024`.
- **TEXT_SECONDARY:** cinza quente `#77766F`.
- **BORDER:** `#E9E6DE`, usado com parcimônia; separação acontece principalmente por espaço e superfície.
- **SHADOW:** difusa, curta e suave (`0 12px 32px rgba(32,33,38,.08)`).
- **RADIUS:** inputs 16px; cards 22px; cards principais 26–28px.
- **SPACING:** base de 4px; conteúdo mobile com 20px; seções 28–32px; módulos internos 12–16px.
- **TYPOGRAPHY:** sans clean; títulos e métricas 700–800; labels 500–600; escala curta e consistente.
- **CARD_STYLE:** cards brancos amplos, sem contorno pesado; módulos assimétricos e cartões internos suaves.
- **NAVIGATION_STYLE:** barra inferior branca, flutuante, ícones pequenos; ativo dourado; ação central pode receber círculo dourado.
- **METRIC_STYLE:** número grande, label curto e contexto mínimo. Hero bipartido amarelo/grafite é a assinatura visual.
- **LIST_STYLE:** avatar + conteúdo em duas linhas + valor/ação à direita; divisores mínimos.
- **PROFILE_STYLE:** avatar central grande, nome/rating, hero de métricas bipartido e lista de opções com ícone e chevron.

## Princípios de aplicação

1. Preservar dados, handlers, Supabase, RBAC e motores de domínio; reconstruir hierarquia e JSX de apresentação.
2. Mostrar somente informação que ajuda a decisão atual.
3. Student e Instructor usam viewport mobile integral, sem moldura de telefone e sem cabeçalho de site.
4. Admin mantém layout web, mas usa sidebar grafite, fundo marfim e cards da mesma família.
5. A categoria pública do Student permanece exclusivamente B.
