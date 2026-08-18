# TASK-005 — Auditoria de Produto: Política Comercial de Cancelamento do MVP

**Versão**: 1.0  
**Data**: 2026-08-18  
**Autor**: MAZZI Product Team  
**Status**: **`DECISÃO DE PRODUTO NECESSÁRIA`**

---

## 1. Relatório da Auditoria Inicial de Produto

Conforme instrução obrigatória da especificação do MAZZI e regras da plataforma (`AGENTS.md` e `MVP_RULES.md`), foi realizada a auditoria preventiva de regras comerciais nos seguintes documentos e códigos do repositório:

1. **[`docs/product/PRODUCT_DECISIONS.md`](../../docs/product/PRODUCT_DECISIONS.md)**:
   - Auditadas as decisões `DEC-001` a `DEC-012`.
   - **Achado**: NÃO existe nenhuma decisão de produto formalizada ou aprovada para a política comercial oficial de cancelamento, prazos, percentuais de reembolso ou penalidades.
2. **[`docs/03-business-rules.md`](../../docs/03-business-rules.md)** (Seção 5):
   - **Achado**: Classifica explicitamente a Política de Cancelamento e Reembolso como `[DECISÃO PENDENTE]: A política comercial definitiva de cancelamento será configurada administrativamente na plataforma via CancellationPolicyConfig.`
   - Declara que a estrutura `DEFAULT_DEVELOPMENT_POLICY` atua **exclusivamente como parâmetro inicial de desenvolvimento e testes**.
3. **[`src/domain/cancellation.ts`](../../src/domain/cancellation.ts)** (Linhas 33-38):
   - **Achado**: Confirma documentalmente que a constante `DEFAULT_DEVELOPMENT_POLICY` é uma *"Configuration used ONLY for tests and development demo. [DECISÃO PENDENTE]: The official commercial policy is to be configured administratively by MAZZI management in future production sprints."*

---

## 2. Bloqueio de Segurança e Gate de Decisão

Conforme a **Regra Principal da TASK**:
> *"NÃO usar DEFAULT_DEVELOPMENT_POLICY como regra oficial sem decisão. Se NÃO houver política comercial oficialmente aprovada (...), Product deve PARAR e retornar: DECISÃO DE PRODUTO NECESSÁRIA. Nesse caso: NÃO implementar código."*

O processo de engenharia foi interrompido no **Gate de Produto** antes da escrita de código de negócio ou alterações de banco de dados, para evitar a invenção não autorizada de regras comerciais.

---

## 3. Perguntas Objetivas para Alinhamento de Produto (Product Manager / PO)

Para que a funcionalidade de cancelamento possa ser implementada na próxima iteração, o Product Manager / PO deve responder e formalizar uma decisão `DEC-013`:

1. **Reembolso para Cancelamento pelo Aluno (Com Antecedência >= 24h)**:
   - Qual é o percentual de reembolso devido ao aluno quando o cancelamento ocorre com 24 horas ou mais de antecedência? (Ex: 100% de reembolso integral, retenção da taxa administrativa de plataforma, etc.)
2. **Reembolso para Cancelamento pelo Aluno em Janela Intermediária (Ex: entre 6h e 24h)**:
   - Quais são as janelas intermediárias permitidas e os respectivos percentuais de reembolso ao aluno e repasse de compensação ao prestador?
3. **Cancelamento Tardio pelo Aluno (< 6h da aula)**:
   - Qual é o percentual de reembolso ao aluno quando o cancelamento ocorre a menos de 6h da aula? (Ex: 0% de reembolso e repasse integral ao prestador deduzida a taxa?)
4. **Cancelamento Iniciado pelo Prestador (Instrutor / Autoescola)**:
   - O aluno sempre recebe 100% de reembolso imediato quando a aula é cancelada pelo prestador? Há alguma penalidade ou crédito extra concedido ao aluno?
5. **Regras de Não Comparecimento (No-Show)**:
   - Como deve ser tratado o No-Show do Aluno vs No-Show do Prestador?
6. **Campos e Motivo do Cancelamento**:
   - A justificativa/motivo do cancelamento deve ser obrigatória ou opcional para o Aluno e para o Prestador? Existem opções pré-definidas (ex: motivo de saúde, imprevisto com o veículo)?
