# 11 — Aplicação do Aluno (MAZZI Aluno)

## Princípios de Experiência
- **Interface Mobile-First & PWA:** Otimizada para uso em smartphones com transições fluidas e feedback tátil.
- **Navegação Principal (Tab Bar Inferior):**
  1. **Início (Home):** Banner institucional, busca rápida (Localização, Categoria, Data, Turno), atalho para próxima aula agendada.
  2. **Buscar:** Filtros avançados (raio, tipo de fornecedor, transmissão manual/automática, faixa de preço, ordenação por rating). Exibição em Lista e Mapa.
  3. **Aulas:** Histórico dividido em *Próximas* e *Concluídas*, com status em tempo real, botão de Check-in e chat da aula.
  4. **Mensagens:** Conversas diretas vinculadas às reservas.
  5. **Perfil:** Dados pessoais, formas de pagamento salvas e suporte.

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
