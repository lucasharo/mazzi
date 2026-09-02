# MAZZI Official Design System V2

**Última revisão:** 2026-08-21

> Antes de criar ou alterar qualquer interface, consulte o catálogo executável em `src/apps/design-system` e os componentes globais em `src/components/ui`. Os apps Aluno, PRO e Admin devem compartilhar componentes, tokens e classes; não crie seletores CSS específicos por app para alterar tipografia ou aparência de um componente global.

## Regra obrigatória de reutilização de componentes

Antes de escrever JSX para uma interação ou superfície visual, procure primeiro um componente compartilhado em `src/components/ui` ou nos componentes de domínio compartilhados. Os apps Student, PRO e Admin devem usar a mesma implementação para botões (`Button`/`ButtonBase`), campos (`Input`, `Textarea`, `Select`), modais (`Modal` + `ModalActionFooter`), cards, badges, tabs, estados vazios, loading/skeleton e cabeçalhos.

Não duplicar markup equivalente dentro de um app, criar variantes exclusivas por app ou estilizar diretamente um elemento nativo quando já existir um componente comum. Se o padrão ainda não existir, criar o componente global primeiro, documentá-lo aqui e então reutilizá-lo em todos os consumidores aplicáveis. Exceções técnicas, como o `input[type=file]` nativo oculto usado pelo seletor de arquivos, devem permanecer encapsuladas pela interface visual compartilhada.

## 1. Tokens oficiais

- Fundo principal: `var(--mazzi-bg)` / `#f7f5ef`.
- Superfície: `var(--mazzi-surface)` / branco.
- Superfície suave: `var(--mazzi-surface-soft)`.
- Amarelo principal: `var(--mazzi-yellow)` / `#f6c945`.
- Grafite: `var(--mazzi-dark)` / `#202126`.
- Texto secundário: `var(--mazzi-muted)`.
- Borda: `var(--mazzi-border)` / `#e9e6de`.
- Danger Soft: fundo `rose-50`, borda `rose-200`, texto `rose-700`.
- Danger Solid: fundo `rose-600`, texto branco.

Os tokens e utilitários globais vivem em `src/index.css`. Cabeçalhos não devem receber peso ou espaçamento por seletores como `.mazzi-provider h1`; a tipografia é definida pelo componente e deve permanecer idêntica entre os apps.

## 2. Tipografia

- Fonte global única, herdada por todos os componentes e apps.
- Títulos de página usam `AppPageHeader`; títulos da tela inicial usam `AppHomeHeader`.
- Botões usam peso `font-bold`, tamanho visual pequeno por padrão e área interativa mínima de 44 px.
- Textos auxiliares usam peso normal ou semibold conforme hierarquia, sem aumento global de peso por app.

## 3. Botões e ícones

O componente canônico é `src/components/ui/Button.tsx`:

- `ButtonBase`: reset acessível para controles com composição própria.
- `Button`: variantes `primary`, `secondary`, `outline`, `ghost`, `dangerSoft` e `danger`.
- `PrimaryButton` e `SecondaryButton`: aliases compatíveis sobre `Button`.
- Tamanho padrão: `sm`.
- Ícones funcionais: `lucide-react`, normalmente entre 14 e 16 px.
- Ações conhecidas recebem o ícone global definido por `ButtonActionIcon` quando não informam um ícone explicitamente.
- Cancelamentos intermediários usam `dangerSoft`; a confirmação destrutiva final usa `danger`, sempre com `XCircle`.
- Botões de cabeçalho exclusivamente icônicos usam `IconButton`/`mazzi-icon-button`, com 48 × 48 px.

## 4. Cabeçalhos e navegação

- `AppHomeHeader`: somente para a tela inicial, com eyebrow, título, subtítulo e ações contextuais.
- `AppPageHeader`: telas internas; ação de atualizar ou editar posicionada no canto superior direito quando aplicável.
- `AppBottomNav`: navegação inferior compartilhada entre Aluno e PRO.
- A atualização deve recarregar apenas os dados da tela atual e apresentar loading/skeleton local.
- Abas do Aluno em “Minhas aulas”: grade de duas colunas, `Hoje` e `Histórico`.
- Abas do PRO em “Minhas aulas”: controle segmentado rolável com `Todas`, `Hoje`, `Próximas` e `Histórico`.
- Abas não exibem contadores incorporados ao texto.

## 5. Estados vazios e de erro

- `ListEmptyState`: listas sem resultados, com borda tracejada, ícone `Inbox`, título e descrição.
- `ObjectEmptyState`: ausência de um único objeto de domínio, incluindo a próxima aula.
- `EmptyState`: adaptador público para `ListEmptyState`, com ação opcional.
- `ErrorState`: falha recuperável com ação de tentar novamente.

Todos usam tipografia, cores e espaçamentos globais. Não replique o markup em cada app.

## 6. Perfis e formulários

- Perfis Aluno, PRO e Admin seguem a mesma composição: `AppPageHeader`, avatar central, identificação e card de dados.
- A edição fica no canto superior direito do header.
- Foto e galeria usam `ProfilePhotoPicker` e botões globais.
- Labels de campos usam a classe compartilhada `mazzi-field-label`, com texto claro, compacto e em caixa alta em todos os apps.
- Inputs usam `Input` e o mesmo tratamento de borda/foco em todos os apps; não há borda preta específica do PRO.

## 7. Agendamento

- O fluxo Aluno usa `SlotSelectorModal`, com horizonte configurável no Admin e carregamento progressivo em lotes de até 30 dias; 60 dias é apenas o fallback seguro do frontend.
- O seletor contém navegação mensal, dias disponíveis, horários agrupados por manhã/tarde/noite, resumo e confirmação.
- O catálogo executável demonstra o próprio `SlotSelectorModal` com `previewSlots` isolados. Essa propriedade é opcional e não altera o carregamento real do backend quando omitida.
- Dias do calendário são identificados pelo número; ícones de calendário não são repetidos em cada dia.

## 8. Inventário público executável

O catálogo apresenta somente componentes alcançados pelos entrypoints Aluno ou PRO:

1. `AppBottomNav`
2. `AppHomeHeader`
3. `AppPageHeader`
4. `Badge`
5. `BookingCard`
6. `Button`
7. `ButtonBase`
8. `PrimaryButton`
9. `SecondaryButton`
10. `EmptyState`
11. `ErrorState`
12. `IconButton`
13. `Input`
14. `ListEmptyState`
15. `LoadingScreen`
16. `Modal`
17. `ObjectEmptyState`
18. `OtpInput`
19. `Rating`
20. `Select`
21. `StatusBadge`

Componentes existentes no repositório, mas sem uso nos entrypoints Aluno/PRO, não recebem demonstrações no catálogo. O Design System também inclui uma referência executável das superfícies do Aluno e a seção “Dias & Horários” com o fluxo real de seleção.

## 9. Execução e validação

```bash
npm run dev:design-system
npm test
npm run lint
npm run build:all
npx vite build --mode=design-system
```

O catálogo roda em `http://localhost:3004/` durante o desenvolvimento.
