# TASK-082 — Substituição dos alertas nativos

TASK: TASK-082
STATUS: IMPLEMENTED
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-28

---

## 1. Objetivo
Substituir todos os alertas e confirmações nativos do navegador por componentes integrados ao visual do MAZZI.

## 2. Problema
As caixas `window.confirm` e `alert` aparecem como diálogos do navegador, quebram a experiência visual, não seguem o design system e podem apresentar textos desatualizados sobre ambiente de teste.

## 3. Usuário Afetado
Administrador.

## 4. Escopo
- Criar componentes reutilizáveis para confirmação, erro e aviso.
- Substituir o `window.confirm` do estorno no Admin.
- Substituir os `alert` de ações não autorizadas e falhas de bloqueio no PRO.
- Apresentar reserva, valor, meio de pagamento e ambiente da operação.
- Exibir claramente que a ação é irreversível e pode gerar uma devolução real.
- Disponibilizar ações **Cancelar** e **Confirmar estorno**.

## 5. Fora de Escopo
- Alterar a API de estorno ou as regras do Mercado Pago.
- Executar o estorno sem uma confirmação explícita.
- Substituir mensagens de sucesso, erro ou processamento após a solicitação.

## 6. Regras de Negócio
- **RN01**: O estorno só pode ser solicitado após confirmação explícita no modal.
- **RN02**: O modal deve refletir o ambiente real da operação, sem chamar produção de sandbox ou teste.
- **RN03**: Cancelar, fechar ou pressionar `Esc` não pode executar o estorno.
- **RN04**: O botão de confirmação deve ficar desabilitado enquanto a solicitação estiver em andamento.

## 7. Fluxo Principal (Happy Path)
1. O administrador seleciona uma transação elegível.
2. Clica em **Solicitar estorno**.
3. O MAZZI abre o modal com os dados da reserva e do pagamento.
4. O administrador confirma a operação.
5. O MAZZI solicita o estorno e exibe o resultado atual da operação.

## 8. Casos de Borda e Exceções
- O administrador fecha o modal: nenhuma solicitação é feita.
- A transação deixa de ser elegível antes da confirmação: bloquear a ação e informar o motivo.
- O estorno está em produção: destacar que a devolução é real.
- A requisição falha: fechar ou manter o modal conforme o padrão de erro definido, sem duplicar a solicitação.

## 9. Estados de Erro e Mensagens
- Produção: "Este estorno será solicitado ao Mercado Pago e devolverá o valor ao pagador."
- Teste: "Este estorno será processado no ambiente de teste."
- Solicitação em andamento: "Solicitando estorno…"

## 10. Critérios de Aceite
- **AC01**: O fluxo não utiliza mais `window.confirm` para confirmar estornos.
- **AC02**: O modal informa valor, reserva, método de pagamento e ambiente.
- **AC03**: Cancelar ou fechar o modal não chama a função de estorno.
- **AC04**: A confirmação exige uma ação explícita e fica protegida contra duplo clique.
- **AC05**: O modal é responsivo e segue o design system do MAZZI.
- **AC06**: O frontend não utiliza mais `window.alert`, `window.confirm` ou `window.prompt`.
- **AC07**: Erros e avisos do PRO são exibidos por feedback visual do MAZZI, sem alerta nativo.

## 11. Dependências
`AdminApp`, `FinancialTab`, `ProviderApp`, componentes de feedback do design system e função `process-mercadopago-refund`.

## 12. Decisões Pendentes
Definir se o modal será um componente compartilhado entre outras ações destrutivas do Admin.

## 13. Riscos de Produto
Texto incorreto sobre o ambiente pode levar o administrador a confirmar uma operação real sem compreender o impacto.

## 14. Handoff para Tech Lead
Reutilizar o componente de modal existente, preservar acessibilidade e garantir que o callback de confirmação seja chamado apenas uma vez.
