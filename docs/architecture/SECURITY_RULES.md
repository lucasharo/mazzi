# SECURITY_RULES.md — Regras Mandatórias de Segurança do MAZZI

> **DIRETRIZES DE SEGURANÇA E CONFORMIDADE (INEGOCIÁVEIS)**  
> Todo desenvolvedor ou agente de IA que atua no repositório MAZZI deve cumprir rigorosamente as regras abaixo. Qualquer violação resultará na rejeição imediata da entrega pelo Tech Lead.

---

## 1. Regras Fundamentais de Segurança

1. **Row Level Security (RLS) Sempre Ativo**:
   - Nenhuma tabela do banco de dados pode ter RLS desabilitado em ambiente algum.
   - Políticas RLS devem ser estritas, não-recursivas e baseadas em `auth.uid()`.
2. **Service Role NUNCA no Frontend**:
   - A chave `SUPABASE_SERVICE_ROLE_KEY` é de uso exclusivo de rotas de backend autenticadas, scripts administrativos ou webhooks seguros.
   - O browser/frontend deve utilizar exclusivamente a chave pública anon (`VITE_SUPABASE_ANON_KEY`).
3. **Frontend Não é Fronteira de Segurança**:
   - Toda validação de formulário (CPF, idade, preço, slots) deve existir no frontend para UX, mas **deve ser obrigatoriamente validada e garantida no Backend/PostgreSQL** (via triggers, constraints e RLS).
4. **Metadados de Usuário (`user_metadata`) Não Concedem Privilégios**:
   - O cliente HTTP pode enviar dados em `options.data` durante o cadastro, mas o backend **nunca** confia nesses dados para autorização.
   - Novos cadastros públicos criam exclusivamente a role `STUDENT`.
   - Roles administrativas (`PLATFORM_ADMIN`, `SUPPORT`, `SCHOOL_ADMIN`) só podem ser concedidas por administradores autenticados via banco/painel administrativo.
5. **Proteção e Privacidade de Dados Pessoais (LGPD)**:
   - CPF e Data de Nascimento são dados sensíveis.
   - Nunca expor CPF em URLs, query parameters, logs públicos, mensagens de chat ou analytics.
   - Apresentação visual de CPF em telas de perfil deve ser mascarada (`***.***.***-09`).
6. **Documentos e Anexos em Storage Privado**:
   - Documentos como CNH, CRLV, certificados de credenciamento e laudos residem em buckets privados do Supabase Storage.
   - O acesso deve ocorrer exclusivamente por URLs assinadas com tempo de expiração curto (ex: 5 minutos).
7. **Princípio do Menor Privilégio**:
   - Aluno A não tem permissão para visualizar dados ou reservas do Aluno B.
   - Autoescola A não tem visibilidade sobre instrutores ou finanças da Autoescola B.
   - Instrutor só acessa os dados dos alunos que possuem aula agendada consigo.
8. **Segredos e Credenciais Fora do Versionamento**:
   - Arquivos `.env.local`, chaves privadas, senhas de banco ou certificados jamais devem ser comitados no GitHub.
