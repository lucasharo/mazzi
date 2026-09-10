# TASK-094 — Relatórios administrativos com filtro de período e exportação em PDF

TASK: TASK-094  
STATUS: PRODUCT_READY  
OWNER: MAZZI Product  
LAST_UPDATED: 2026-09-09

## 1. Objetivo

Entregar no painel Admin uma central de relatórios operacionais, financeiros, de marketplace, compliance e comunicação, permitindo escolher o período inicial/final, selecionar quais relatórios ficam visíveis e imprimir/exportar a visão filtrada em PDF.

## 2. Problema

O Admin possui indicadores espalhados em telas diferentes e não consegue consultar o desempenho da plataforma com um intervalo arbitrário nem levar uma visão consolidada para análise ou prestação de contas.

## 3. Usuário Afetado

Administrador da plataforma (`PLATFORM_ADMIN`). Usuários `SUPPORT` continuam sem acesso ao painel Admin conforme a regra vigente.

## 4. Escopo

- Nova área “Relatórios” dentro do painel Admin.
- Filtros obrigatórios de data inicial e data final, com presets úteis e validação de intervalo.
- Controle de visibilidade por seleção dos relatórios exibidos na tela e no PDF.
- Leitura agregada pelo backend, protegida por RPC `SECURITY DEFINER` e permissão administrativa.
- Exportação da visão selecionada por fluxo de impressão otimizado para “Salvar como PDF”, sem expor dados fora do escopo do Admin.
- Dez relatórios:
  1. **Resumo executivo** — reservas, aulas concluídas, GMV, comissão e conversões.
  2. **Operação de reservas** — distribuição por status, origem Aula Agora/agenda, categoria e transmissão.
  3. **Receita e pagamentos** — valores cobrados, taxas, gateway, status e reembolsos.
  4. **Repasses** — valores previstos, liberados, bloqueados, falhos e prazo de liberação.
  5. **Oferta de profissionais** — prestadores, veículos, ofertas e disponibilidade ativa.
  6. **Demanda e liquidez** — buscas, cotações, checkouts, conversão e buscas sem resultado quando houver evento registrado.
  7. **Usuários e ativação** — novos usuários por papel, usuários ativos e evolução de base.
  8. **Compliance** — documentos por status, vencimentos próximos e tempo de revisão.
  9. **Cancelamentos e contestações** — cancelamentos, reembolsos e disputas por status/resolução.
  10. **Notificações e e-mails** — volume por canal/evento, sucesso, falha e pendências de entrega.

## 5. Fora de Escopo

- Relatórios para Aluno, Instrutor, Autoescola ou usuários `SUPPORT`.
- Exportação de CPF, data de nascimento, tokens, caminhos de Storage, conteúdo de chat, documentos ou segredos.
- Agendamento automático de relatórios, envio por e-mail ou integração com BI externo.
- Alteração de dados de negócio a partir da tela de relatórios.
- Novas métricas regulatórias ou financeiras sem fonte de dados existente; lacunas devem aparecer como “não disponível”.

## 6. Regras de Negócio

- Toda consulta deve validar autenticação, usuário ativo e permissão `admin.analytics.read` ou permissão administrativa equivalente já canônica no projeto.
- As datas representam um intervalo inclusivo no início e exclusivo no fim do dia seguinte, usando `America/Sao_Paulo` para entradas de calendário.
- O intervalo máximo permitido na interface e no backend é de 366 dias; data inicial posterior à final é inválida.
- Valores monetários são retornados em centavos inteiros e formatados somente na apresentação.
- O backend é a fonte da verdade para totais, contagens e agregações.
- A seleção de relatórios controla apresentação, não reduz as proteções de autorização nem permite escolher colunas sensíveis.
- Relatórios sem registros devem renderizar estado vazio explícito, mantendo o restante da visão utilizável.
- A exportação em PDF deve refletir exatamente o período, os relatórios selecionados e o momento da geração.

## 7. Fluxo Principal (Happy Path)

1. O Admin abre “Relatórios”.
2. O sistema carrega o período padrão dos últimos 30 dias e os dez relatórios selecionados.
3. O Admin ajusta data inicial/final e clica em “Atualizar relatórios”.
4. O sistema valida as datas, consulta o backend e atualiza os cards/tabelas.
5. O Admin oculta ou reexibe relatórios pelo seletor de visibilidade.
6. O Admin clica em “Baixar PDF”; a página de impressão contém somente os relatórios selecionados e o período atual.

## 8. Casos de Borda e Exceções

- Data inválida, ausente ou intervalo acima de 366 dias: bloquear consulta e informar o ajuste necessário.
- Nenhum relatório selecionado: bloquear exportação e informar que pelo menos um relatório deve permanecer visível.
- Falha do backend: manter a última visão válida quando existir e exibir erro acionável.
- Relatório individual sem dados: mostrar estado vazio, sem transformar ausência em falha global.
- Datas com horário de verão ou conversão de timezone: normalizar no backend para o timezone operacional do MAZZI.
- Valores nulos ou registros antigos sem campos opcionais: usar “—” ou “Não informado”, nunca `undefined` ou erro técnico.

## 9. Estados de Erro e Mensagens

- `Informe um período válido.`
- `A data inicial não pode ser posterior à data final.`
- `Escolha um período de até 366 dias.`
- `Selecione pelo menos um relatório para visualizar.`
- `Não foi possível carregar os relatórios agora. Tente novamente.`
- `Não há dados para este relatório no período selecionado.`

## 10. Critérios de Aceite

- **AC01**: O Admin autorizado acessa a central de Relatórios e visualiza dez relatórios nomeados, sem dados sensíveis proibidos.
- **AC02**: O Admin consegue informar data inicial e final, usar presets e atualizar todos os relatórios pelo intervalo escolhido.
- **AC03**: O backend rejeita usuário não autenticado, usuário sem permissão e intervalos inválidos ou acima de 366 dias.
- **AC04**: A tela apresenta estados de carregamento, erro e vazio por relatório sem travar os demais.
- **AC05**: O Admin consegue ocultar e reexibir cada relatório; a seleção controla também o conteúdo exportado.
- **AC06**: Totais financeiros usam centavos inteiros no contrato e são formatados em BRL somente na UI.
- **AC07**: “Baixar PDF” abre a impressão somente com os relatórios visíveis, período, identificação de geração e sem controles de navegação.
- **AC08**: Em viewport 375px, 390px e 430px não existe overflow horizontal e os controles têm alvo mínimo de 44px.
- **AC09**: O fluxo possui labels/ARIA, foco visível, mensagens `role="alert"` e suporte a teclado.
- **AC10**: A implementação preserva o painel Admin existente e não altera permissões ou dados de outros módulos.

## 11. Dependências

- Painel Admin e componentes do Design System MAZZI.
- Permissões/RBAC administrativas existentes.
- Tabelas e eventos já presentes no Supabase DEV: reservas, pagamentos, repasses, usuários, prestadores, veículos, ofertas, compliance, contestações, notificações, e-mails e analytics.
- Nova migration forward-only aplicada no Supabase DEV antes da conclusão.

## 12. Decisões Pendentes

Nenhuma para o MVP desta tarefa. A exportação usa o mecanismo nativo de impressão do navegador com layout próprio para salvar como PDF; geração de arquivo PDF server-side fica fora de escopo.

## 13. Riscos de Produto

- Eventos antigos podem não conter informação suficiente para algumas métricas de demanda; o relatório deve declarar a limitação sem inferir dados.
- Relatórios agregados podem ficar pesados em intervalos longos; o limite de 366 dias e a agregação server-side reduzem esse risco.
- Alterações futuras de status/enums exigem atualização do contrato do relatório e dos testes.

## 14. Handoff para Tech Lead

Projetar uma única RPC administrativa agregadora, com contrato JSON versionável, validação de período e permissão. Reutilizar as fontes canônicas existentes e evitar SELECT direto do frontend em tabelas protegidas. Definir os índices mínimos necessários, criar testes de segurança/RBAC e garantir aplicação/validação da migration no Supabase DEV.
