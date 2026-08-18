# QA_STRATEGY.md — Estratégia de Qualidade e Testes do MAZZI

> **DIRETRIZES DE QUALIDADE, TESTES E AUDITORIA (MAZZI Premium V2)**  
> Este documento orienta o agente MAZZI QA na execução de testes, validação de critérios de aceite e caça proativa a bugs e regressões.

---

## 1. Pirâmide de Testes do MAZZI

```
        / \
       /   \      E2E / Testes Reais de Fluxo (Supabase Auth / Lifecycle)
      /     \     -------------------------------------------------------
     /  RLS  \    Segurança de Banco & Políticas RLS (PostgreSQL)
    /---------\   -------------------------------------------------------
   / Integrat. \  Contratos de Schema, Multi-app e Gateways Mock
  /-------------\ -------------------------------------------------------
 /    Domain     \ Regras de Negócio Puras (Search, Availability, Quotes)
/-----------------\------------------------------------------------------
/    Unit & UI    \ Utilitários, CPF, Idade, Formatters & Acessibilidade
```

---

## 2. Checklists Padrão de Auditoria por Módulo

### 2.1. Autenticação & Identidade
- [ ] Cadastro de aluno exige nome, e-mail, celular, CPF válido e data de nascimento (>= 18 anos);
- [ ] Bloqueio matemático para CPFs com dígitos inválidos ou sequências repetidas;
- [ ] Bloqueio determinístico para menores de 18 anos (incluindo cálculo civil e 29 de fevereiro);
- [ ] Envio e validação de código OTP de 6 dígitos para confirmação de e-mail;
- [ ] Cooldown de 45 segundos ativo e funcional no botão de reenvio de OTP;
- [ ] Recuperação de senha baseada em OTP de 6 dígitos sem enumeração de e-mail;
- [ ] Limpeza de tokens na URL após troca de senha;
- [ ] Sessão hidratada corretamente sem criação duplicada de perfil em `public.users`.

### 2.2. Busca e Filtros Estritos (Search Engine)
- [ ] Nenhum prestador exibido se não atender a 100% dos filtros ativos (categoria, transmissão, data, horário, tipo de prestador);
- [ ] Raio geoespacial respeitado a partir do endereço/coordenadas informadas;
- [ ] Card de prestador exibe dados reais de avaliação, distância e preço inicial.

### 2.3. Agendamento & Calendário
- [ ] Janela máxima de agendamento respeita estritamente o horizonte canônico de 60 dias;
- [ ] Carregamento progressivo de 30 + 30 dias;
- [ ] Bloqueio absoluto de sobreposição temporal (double-booking) para o mesmo instrutor ou veículo.

### 2.4. Mobile & Responsividade
- [ ] Visualização testada em viewports mobile-first: **375px**, **390px** e **430px**;
- [ ] Touch targets com dimensão mínima de 44px x 44px;
- [ ] Inputs de código (`OtpInput`) abrem teclado numérico (`inputMode="numeric"`) e suportam colar código;
- [ ] Sem overflow horizontal ou quebra indesejada de layout.

### 2.5. Acessibilidade (a11y)
- [ ] Todos os botões e links possuem labels acessíveis (`aria-label` quando ícones);
- [ ] Inputs vinculados a `label` via `htmlFor` e `id`;
- [ ] Mensagens de erro com `role="alert"` e `aria-invalid="true"`;
- [ ] Estados de foco nítidos (`focus-visible`).

---

## 3. Matriz de Severidade de Bugs

| Severidade | Descrição | Ação Obrigatória |
|---|---|---|
| **BLOCKER** | Impede a conclusão do fluxo principal do usuário (ex: botão de agendar não responde). | **Reprovação Imediata da Task** |
| **CRITICAL** | Falha de segurança, violação de RLS, vazamento de dados pessoais ou privilégio indevido. | **Reprovação Imediata da Task** |
| **HIGH** | Regra de negócio central incorreta ou regressão funcional relevante. | **Reprovação da Task** (salvo exceção documentada pelo Tech Lead) |
| **MEDIUM** | Problema funcional que possui workaround simples conhecido. | Ressalva técnica registrada |
| **LOW** | Ajuste cosmético ou visual sem impacto funcional relevante. | Registrado para backlog de polimento |
