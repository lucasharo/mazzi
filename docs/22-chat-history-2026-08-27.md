# MAZZI — Histórico Consolidado de Evolução do Produto

**Período registrado:** 2026-08-17 a 2026-08-27  
**Origem:** decisões e solicitações realizadas neste chat  
**Objetivo:** manter em um único lugar o contexto funcional que orientou as alterações nos apps Aluno, PRO e Admin.

> Este documento é um resumo operacional do histórico do chat, não uma transcrição literal. Regras de negócio que exigem validação jurídica, regulatória ou comercial continuam marcadas como pendentes nos documentos normativos.

## 1. Experiências e consistência visual

- Os apps Aluno, PRO e Admin devem compartilhar o mesmo padrão visual, componentes reutilizáveis e tokens do Design System.
- Labels de filtros e formulários usam o padrão visual claro adotado para `TIPO`; a regra vale para todas as labels, não apenas para selects.
- Textos comuns usam `var(--mazzi-text)`; o preto escuro fica reservado aos títulos de tela e títulos de seções quando especificado pelo Design System.
- Status são exibidos como chips sem bolinha, com texto centralizado e fundo/contraste coerentes. O padrão deve ser reaproveitado em todos os apps, inclusive dentro de modais.
- Motivos que o usuário precisa escolher devem usar chips com opções predefinidas e uma opção de motivo personalizado quando necessário.
- Textos de domínio, códigos internos, `DRAFT` e descrições em inglês não devem aparecer na interface; a apresentação deve usar descrições em pt-BR.
- Listas vazias usam o componente compartilhado centralizado. Cards de veículos aparecem um por linha quando a tela estiver em fluxo mobile.
- Painéis e itens selecionados devem se alinhar ao primeiro input do filtro, e não ao título ou à label do filtro.
- O Admin é responsivo para celular, com navegação lateral reduzida e ações globais no topo. O ícone de notificações foi removido; a identificação disponível no menu permanece como referência.
- O título visível do Admin representa a tela selecionada. A rota é independente do texto exibido; modais não precisam ficar expostos na URL e o botão voltar do celular deve fechar o modal antes de sair da tela.

## 2. Máscaras, datas e identificações

- Máscaras progressivas foram padronizadas nos apps para telefone, CPF, CNPJ e datas, preservando a posição do cursor ao editar.
- A edição de datas deve permitir corrigir apenas uma parte, como o mês, sem mover o cursor para o fim do texto.
- Datas de validade de compliance são preenchidas no Admin; o PRO não coleta esse campo. A interface usa a mesma máscara dos demais campos de data.
- Placas distinguem o modelo antigo do modelo Mercosul. Placas novas como `MZZ***` não recebem hífen; o modelo antigo mantém a formatação correspondente.
- O seletor de ano de veículo mostra apenas o ano, sem combustível ou outras informações. O cadastro de veículo no PRO aceita no máximo 12 anos de fabricação.

## 3. Compliance, veículos e ofertas

- O Admin pode revisar documentos, abrir arquivos privados por URL assinada e registrar a data de validade informada na revisão.
- O PRO pode visualizar o arquivo enviado, mas não informa a validade.
- Os selects de compliance e veículos devem exibir os status canônicos definidos pelo domínio. `Rascunho` não é uma opção operacional e foi retirado; `Em revisão` não aparece no select de veículos e só é aplicável quando a alteração do veículo realmente exige nova análise.
- `Reanálise` ocorre somente após edição dos dados do veículo. Desativar um veículo sem alterar seus dados não deve enviá-lo para reanálise.
- O PRO mostra o motivo real do bloqueio do veículo, com ação apenas para visualizar/ocultar o motivo. Veículo bloqueado não pode ser editado, ativado ou desativado.
- Veículos pendentes ou em reanálise não podem ser ativados/desativados pelo PRO; os botões ficam desabilitados. Veículo inativo pode seguir o fluxo de ativação previsto pelo backend quando elegível.
- A lista de veículos prioriza ativos e pendentes antes dos demais status.
- Apenas veículos ativos aparecem no seletor de veículo associado a uma oferta.
- A categoria pública atual fica fixa em Categoria B (Carro) enquanto a Categoria A permanece preparada para evolução futura.
- Oferta inativa não pode ser ativada quando suas condições de negócio não forem atendidas; mensagens de erro mostram descrições em pt-BR, sem códigos como `DRAFT`.
- Nome do proprietário/prestador deve aparecer nos cards e nos detalhes sempre que o dado estiver disponível.

## 4. Auditoria e identidade das ações

- Operações críticas e mutações `INSERT`, `UPDATE` e `DELETE` dos domínios devem ser auditadas em todos os apps.
- O registro deve guardar ator, papel, ação, entidade, valores anterior/novo, data/hora e demais metadados disponíveis.
- O nome da pessoa e a role devem ser obtidos corretamente do usuário autenticado; não usar `Suporte` como fallback quando a ação foi feita por instrutor, aluno, autoescola ou administrador.
- A interface apresenta a ação em pt-BR e nunca usa o texto genérico `Ação registrada` quando houver uma ação identificável.
- Filtros do Admin contemplam os perfis relevantes e a área correta da ação.
- Alterações de status de veículo, aprovação de documentos, ofertas, reservas, perfis e demais mutações devem aparecer na trilha de auditoria.

## 5. Estados de carregamento, validação e feedback

- Botões de confirmar, salvar, enviar, ativar e ações equivalentes ficam desabilitados quando o formulário não atende às regras.
- Ao iniciar uma ação, o ícone do botão é substituído por um indicador de carregamento e o botão permanece protegido contra duplo clique.
- O padrão de rodapé de modal deve ser consistente entre os apps, sem alterar desnecessariamente a hierarquia ou ocupar espaço excessivo.
- Ações administrativas que dependem de RPC devem exibir estado de carregamento e erro amigável quando o backend rejeitar a operação.

## 6. Pagamentos — direção para a próxima etapa

- O ambiente atual continua em `MOCK_VALIDATION`; nenhum pagamento real foi ativado.
- O domínio financeiro permanece desacoplado por `PaymentGateway`, com valores em centavos inteiros, idempotência e confirmação por webhook como requisitos obrigatórios.
- Foi feita uma comparação inicial entre Mercado Pago, Stripe Connect, Asaas e Pagar.me.
- A recomendação inicial para a MAZZI é avaliar primeiro o Mercado Pago por aderência ao mercado brasileiro, Pix, cartão, parcelamento e split nativo para marketplace.
- Isso é uma recomendação técnica/comercial inicial, não uma autorização de ativação. A tarifa efetiva ainda depende de volume, parcelamento, prazo de recebimento, antecipação, repasses, estornos e negociação comercial.
- Antes de dinheiro real, devem ser fechados: comissão da MAZZI, momento do repasse ao prestador, cancelamentos, reembolsos, chargebacks, onboarding/KYC, reconciliação e validação jurídica/LGPD.

## 7. Ambiente e publicação

- O destino de publicação adotado é Cloudflare Pages.
- O GitHub Actions executa lint, testes e build dos três apps; a branch `feature/premium-ui-v2` publica os projetos DEV no Cloudflare Pages.
- O processo atual usa exclusivamente Cloudflare/GitHub como fonte do deploy.
- O backend e as migrações permanecem no Supabase; credenciais privadas não devem ser expostas no frontend ou no artefato de build.

## 8. Pendências que permanecem abertas

- Escolha comercial definitiva do gateway e contratação das condições de marketplace.
- Implementação do adaptador real, endpoints server-side, webhooks assinados, split, repasses, estornos e reconciliação.
- Validação jurídica e operacional do fluxo financeiro antes de produção.
- Definição final da comissão comercial da MAZZI; os 10% atuais são apenas referência de desenvolvimento/testes.
