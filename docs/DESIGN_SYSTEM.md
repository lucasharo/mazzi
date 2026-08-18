# MAZZI OFFICIAL DESIGN SYSTEM (V2)

> **REGRA CRÍTICA PARA DESENVOLVEDORES E AGENTES DE IA:**
> **Antes de criar ou alterar qualquer componente visual ou tela no projeto MAZZI, consulte obrigatoriamente o MAZZI Design System (`src/apps/design-system`) e este documento.**
> Nenhuma IA ou desenvolvedor deve inventar novos padrões, botões ou cores arbitrárias quando já houver componente equivalente no Design System.

---

## 1. Tokens de Design Oficiais

- **Fundo Principal (Background)**: `#f7f5ef` (`bg-[#f7f5ef]`)
- **Amarelo MAZZI Primary**: `#f6c945` / Amber 400 (`bg-[#f6c945]`, `text-[#202126]`)
- **Dark Charcoal**: `#202126` (`bg-[#202126]`, `text-white`)
- **Borda Padrão**: `#e9e6de` (`border-[#e9e6de]`)
- **Danger Soft**: `bg-rose-50 border-rose-200 text-rose-700` (Gatilhos e confirmações de perigo)
- **Danger Solid**: `bg-rose-600 hover:bg-rose-700 text-white` (Ações destrutivas fatais)
- **Success**: `emerald-500` / `emerald-600`
- **Warning**: `amber-50` / `amber-200` / `amber-800`

---

## 2. Regra de Tipografia e Font-Weight

- **Botões e Ações Funcionais**: Todo botão deve possuir obrigatoriamente tipografia em **`font-bold`** ou **`font-extrabold`**.
- Nunca utilizar `font-normal` ou `font-medium` em botões de ação ou gatilhos funcionais.

---

## 3. Política de Ícones (Icon Usage Policy)

- **Biblioteca Oficial**: `lucide-react`.
- **Tamanhos Padrão**:
  - Small (`sm`): `14-16px` (`w-4 h-4` ou `w-3.5 h-3.5`)
  - Medium (`md`): `16px` (`w-4 h-4`)
  - Large (`lg`): `18px` (`w-4.5 h-4.5` ou `w-5 h-5`)
- **Regras de Aplicação**:
  - Usar ícones quando o símbolo universal aumentar a velocidade de leitura e identificação da ação.
  - `Abrir Chat` / `Ver Chat` → `<MessageSquare className="w-4 h-4" />`
  - `Cancelar aula` / `Cancelar agendamento` → `<XCircle className="w-4 h-4" />` ou `<Ban className="w-4 h-4" />`
  - `Limpar` → `<RotateCcw className="w-4 h-4" />`
  - `Aplicar Filtros` / `Confirmar` → `<Check className="w-4 h-4" />`
  - `Voltar` → `<ArrowLeft className="w-4 h-4" />`
- **Proibições**:
  - Proibido o uso de Emojis em botões funcionais do produto.
  - Proibido usar ícones decorativos sem propósito claro.

---

## 4. Composição dos Detalhes da Aula (Chat + Cancelamento)

- **Layout LADO A LADO**: Nos modais de Detalhes da Aula (Student e Provider), os botões `Abrir Chat` e `Cancelar aula` devem ficar dispostos **LADO A LADO (50% / 50%)**.
- **Visual**:
  - `[ 💬 Abrir Chat ]`: Variant Outline/Secondary com ícone `MessageSquare`, `font-bold`.
  - `[ ✕ Cancelar aula ]`: Variant Soft Danger (`bg-rose-50 border-rose-200 text-rose-700 font-bold`) com ícone `XCircle`.

---

## 5. Padrão Oficial de Modal Action Footer (Rodapé Branco Fixo)

- **Fundo**: Branco sólido (`bg-white`).
- **Comportamento**: Preso ao fundo do modal/container (`sticky bottom-0 z-[60]`).
- **Sobreposição**: O conteúdo do modal rola por trás do rodapé (`overflow-y-auto pb-8`).
- **Visual dos Botões**: Os botões de ação ficam **elevados/flutuantes dentro da barra branca** (`rounded-2xl shadow-md`).
- **Safe Area**: Respeita rigorosamente a safe-area em PWAs e dispositivos móveis (`pb-[max(1rem,env(safe-area-inset-bottom))]`).
- **Componentes Reutilizáveis**: `<ModalActionFooter>` / `<FloatingActionFooter>`.

---

## 6. Inventário de Componentes Reutilizáveis

- **Botões**: `src/components/ui/Button.tsx`, `PrimaryButton.tsx`, `SecondaryButton.tsx`, `IconButton.tsx`
- **Campos & Seletores**: `Input.tsx`, `Select.tsx`, `Checkbox.tsx`, `OtpInput.tsx`
- **Badges & Status**: `Badge.tsx`, `StatusBadge.tsx`
- **Cards de Domínio**: `ProviderCard.tsx`, `VehicleCard.tsx`, `BookingCard.tsx`, `Card.tsx`
- **Feedback & Estados**: `EmptyState.tsx`, `Skeleton.tsx`, `Toast.tsx`, `LoadingScreen.tsx`
- **Modais & Action Bars**: `Modal.tsx`, `ModalActionFooter.tsx`, `FloatingActionFooter.tsx`, `BottomSheet.tsx`
- **Navegação & Tabs**: `Tabs.tsx`
- **Avaliações & Preços**: `Rating.tsx`, `Price.tsx`, `Avatar.tsx`
- **Agendamento**: `Calendar.tsx`, `TimePicker.tsx`
- **Mapas**: `src/components/maps/UniversalMap.tsx`
