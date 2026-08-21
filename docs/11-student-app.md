# 11 — Aplicação do Aluno (MAZZI Aluno)

## Princípios de Experiência
- **Interface Mobile-First & PWA:** Otimizada para uso em smartphones com transições fluidas e feedback tátil.
- **Navegação Principal:** `AppBottomNav` com três áreas: **Buscar**, **Aulas** e **Perfil**.
- **Cabeçalhos:** `AppHomeHeader` na primeira tela e `AppPageHeader` nas telas internas.
- **Aulas:** abas `Hoje` e `Histórico`, sem contadores no texto; atualização local com loading/skeleton.
- **Perfil:** avatar central, identificação, card de dados e edição pelo ícone no topo direito.
- **Estados vazios:** componentes globais `ListEmptyState` e `ObjectEmptyState`.

## Fluxo Principal de Contratação (Golden Path)
```
[Home] 
  -> [Busca com Filtros] 
  -> [Card de Fornecedor / Oferta] 
  -> [Perfil Completo & Veículos] 
  -> [Seleção de Data e Slot de Horário] 
  -> [Geração de Quote com 10 min de validade] 
  -> [Checkout Transparente com discriminação de taxas] 
  -> [Pagamento PIX/Cartão] 
  -> [Confirmação & Dados do Ponto de Encontro] 
  -> [Dia da Aula: Check-in] 
  -> [Pós-Aula: Avaliação com Notas e Feedback]
```

## Seleção de dias e horários

O `SlotSelectorModal` é a fonte de verdade visual e funcional para o calendário do Aluno. Ele oferece horizonte de 60 dias, carregamento progressivo, dias habilitados conforme disponibilidade e horários agrupados por período. O Design System executa o mesmo componente com dados demonstrativos isolados.
