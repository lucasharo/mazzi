# 12 — Aplicação MAZZI Pro (Instrutores e Autoescolas)

## Conceito Unificado com RBAC
Uma única aplicação web/PWA atende tanto o instrutor autônomo quanto a autoescola/CFC, adaptando o layout e permissões dinamicamente de acordo com o papel do usuário logado (`INSTRUCTOR`, `SCHOOL_ADMIN`, `SCHOOL_STAFF`).

## Padrão visual Premium UI V2

- Navegação inferior global com **Início**, **Aulas**, **Ganhos**, **Gestão** e **Perfil**.
- **Horários** e **Bloqueios** ficam dentro de **Gestão**; não há uma tela independente de Agenda no menu principal.
- `AppHomeHeader` apenas em Início; telas internas usam `AppPageHeader`.
- Atualização no canto superior direito somente nas telas com recarga de dados; Perfil e Agenda não exibem esse controle.
- Em “Minhas aulas”, as abas são **Todas**, **Hoje**, **Próximas** e **Histórico**, com ícones e rolagem horizontal segura no mobile.
- A classificação temporal usa o fim da aula: aulas futuras e em andamento permanecem em Próximas/Hoje; somente após o horário final entram no Histórico.
- Botões de ações de conteúdo ficam abaixo das abas, fora do header.
- Perfil segue a composição do Aluno: avatar central, identificação, card de dados e edição no topo direito.
- Listas vazias e ausência de próxima aula usam os componentes globais de estado vazio.
- Formulários, botões, fontes, cores e bordas usam os mesmos componentes e tokens dos demais apps.

## Visões e Funcionalidades

### 1. Dashboard do Instrutor Autônomo
- Status cadastral e de compliance (`ACTIVE`, `PENDING_REVIEW`, etc.).
- Próxima aula com contagem regressiva e botão de Check-in / Iniciar Aula.
- Resumo de aulas do dia e da semana.
- Ganhos acumulados e saldo disponível para repasse.
- Alertas de documentos a vencer.

### 1.1 Ganhos e desempenho
- A área **Ganhos** usa a RPC financeira dedicada e a tabela canônica `payouts`.
- Exibe ganhos líquidos, recebido, a receber, bloqueado, próximos repasses, evolução, aulas concluídas e ticket médio líquido.
- Avaliações usam dados reais de `reviews`; insights detalhados só aparecem após 30 alunos distintos avaliados.
- A autorização é derivada da sessão: instrutor próprio com `provider.finance.read_own` ou autoescola autorizada com `school.finance.read`.

### 2. Dashboard da Autoescola (CFC)
- Resumo operacional da frota e equipe de instrutores.
- Visão unificada de aulas do dia de todos os instrutores.
- Painel de gestão da equipe (`SCHOOL_ADMIN` gerencia instrutores e secretárias `SCHOOL_STAFF`).
- Gestão de frota (veículos categoria A/B, câmbio manual/automático, manutenção).
- Painel financeiro consolidado da autoescola.

### 3. Gestão de Agenda & Disponibilidade
- Visão por Instrutor ou por Veículo.
- Bloqueio de horários (férias, almoço, manutenção do carro).
- Criação de ofertas associando Veículo + Categoria + Duração + Preço em centavos.
- No MVP, a duração disponível para ofertas é exclusivamente uma hora-aula de 50 minutos, conforme a definição do CONTRAN; durações maiores ficam reservadas para uma evolução futura.

### Ciclo Autoescola ↔ Instrutor

Administradores podem enviar convites, acompanhar vínculos, consultar compliance e solicitar ativação. Instrutores visualizam convites pendentes e podem aceitar ou recusar. O backend permanece a fonte da verdade para as transições.
