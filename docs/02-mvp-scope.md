# 02 — Escopo do MVP (O que entra e o que não entra)

## Escopo Incluído no MVP (In-Scope)
1. **Aulas Práticas de Direção:** Categorias A (Moto) e B (Carro).
2. **Fornecedores Suportados:**
   - Instrutores Autônomos (`INSTRUCTOR`).
   - Autoescolas / Centros de Formação de Condutores (`DRIVING_SCHOOL`).
3. **Veículos Fornecidos pelo Profissional/CFC:**
   - Câmbio Manual e Automático.
   - Todo veículo é submetido à verificação e auditoria de status (`VehicleStatus`).
4. **Geolocalização & Busca:**
   - Busca por CEP/bairro/raio em São Paulo/SP.
   - Proteção de privacidade: nunca exibir o endereço residencial exato do instrutor. Ponto de encontro ou bairro de referência.
5. **Motor de Disponibilidade & Agenda:**
   - Configuração de horários recorrentes e exceções (férias, manutenção, bloqueio manual).
6. **Prevenção Estrita de Double Booking:**
   - Bloqueio atômico de conflito temporal para o mesmo instrutor OU mesmo veículo.
7. **Quotes, Reservas & Pagamentos:**
   - Geração de cotação com validade (10 min).
   - Snapshot imutável de valores e dados no momento da contratação.
   - Suporte a PIX e Cartão de Crédito via Gateway com Webhook idempotente.
8. **Fluxo Completo da Aula:**
   - Check-in de presença (aluno + instrutor).
   - Início, execução e finalização da aula com registro de horários e observações.
9. **Avaliações e Reputação:**
   - Avaliação de 1 a 5 estrelas e comentários após conclusão do `Booking`.
10. **Chat Direto Integrado à Reserva:**
    - Mensageria contextual entre aluno e fornecedor.
11. **Módulo de Compliance & Gestão Documental:**
    - Upload seguro, auditoria e aprovação/rejeição com justificativa por administradores.
12. **Painéis das 3 Aplicações:**
    - MAZZI Aluno (Mobile-first).
    - MAZZI Pro (Instrutor e Autoescola via RBAC).
    - MAZZI Admin (Operação, Marketplace, Auditoria e Configurações).

## Escopo Excluído do MVP (Out-of-Scope — Não Implementar)
- Aulas teóricas de legislação/mecânica.
- Categorias adicionais (ACC, C, D, E).
- Veículo fornecido pelo aluno.
- Pacotes de aulas e assinaturas recorrentes.
- Programa de indicação e cupons promocionais complexos.
- Gamificação, inteligência artificial pedagógica ou bots de feedback de direção.
- Minha Jornada para a CNH / controle de fases do Detran.
- Integrações diretas simuladas ou falsas com sistemas governamentais (SENATRAN/DETRAN).
