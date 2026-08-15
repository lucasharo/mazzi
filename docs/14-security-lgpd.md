# 14 — Segurança e Conformidade com a LGPD

## Princípios de Proteção de Dados (LGPD)
1. **Minimização:** Coletar exclusivamente os dados indispensáveis para a prestação do serviço (nome, telefone, CPF/CNPJ, CNH/CRLV e localização aproximada).
2. **Privacidade por Padrão (Privacy by Design):**
   - Endereço residencial do instrutor nunca é exposto publicamente.
   - Placa de veículos é mascarada em telas públicas.
   - Fotos de documentos são armazenadas em bucket privado e acessadas via URLs assinadas de curta duração (15 minutos).
3. **Direitos dos Titulares:**
   - Possibilidade de exportação de dados e anonimização/exclusão conforme prazos legais de guarda fiscal.

## Medidas Técnicas de Segurança
- **Isolamento de Tenants:** Prevenção ativa de IDOR em todos os controladores.
- **Validação de Entrada:** Schemas rigorosos de validação de dados em todas as rotas da API.
- **Auditoria Imutável:** Registro detalhado de qualquer alteração de status cadastral ou movimentação financeira.
- **Proteção contra Injeção e CSRF:** Uso de consultas parametrizadas via ORM e cabeçalhos de segurança padrão (`helmet`, CSP, HSTS).
