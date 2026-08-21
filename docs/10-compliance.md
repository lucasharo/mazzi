# 10 — Módulo de Compliance e Validação de Fornecedores (Sprint 04)

## Escopo global e por autoescola

O compliance global do instrutor é separado do compliance do vínculo com uma autoescola. A ativação exige ambos os escopos válidos; documentos permanecem em storage privado. Instrutores autônomos legados sem documentos existentes têm compatibilidade transitória, enquanto novos cadastros e vínculos seguem a exigência objetiva.

**Compatibilidade legada:** a policy `Providers can insert own compliance documents` continua permitindo inserção direta apenas para o próprio usuário/provedor ativo e com status `PENDING`. Ela não permite aprovação, não altera elegibilidade e não cria privilégio; por isso foi classificada como `SAFE_LEGACY_COMPATIBILITY`.

> **REGULATORY SNAPSHOT METADATA**:  
> `REGULATORY_BASELINE_DATE = 2026-08-14`  
> *A data representa a última auditoria e validação das fontes normativas federais, resoluções do CONTRAN e regulamentos do DETRAN-SP, não constituindo garantia de validade perpétua da norma.*

---

## 1. Princípios Fundamentais de Segurança e Transparência Regulatória

1. **Compliance MAZZI ≠ Homologação Governamental Direta**:
   - A plataforma MAZZI valida internamente os requisitos cadastrais e documentais para permitir a atuação de instrutores autônomos e autoescolas em seu marketplace.
   - O selo "Verificado pela MAZZI" atesta conformidade exclusiva com as políticas internas e os critérios cadastrais da plataforma. **Não constitui homologação ou credenciamento governamental direto pelo DETRAN/SENATRAN**.
2. **Base Jurídica e Fontes Regulatórias Precisas**:
   - Cada requisito de compliance possui metadados normativos explícitos (`sourceType`, `sourceReference`, `sourceIdentifier`, `jurisdiction`, `country`, `state`, `lastValidatedAt`), diferenciando:
     - `FEDERAL_LAW`: Lei Federal (e.g. Código de Trânsito Brasileiro - Lei nº 9.503/1997, Lei Federal nº 12.302/2010, Código Civil - Lei nº 10.406/2002).
     - `CONTRAN_RESOLUTION`: Resoluções federais do Conselho Nacional de Trânsito (e.g. Resolução CONTRAN nº 1.020/2025; Resolução CONTRAN nº 789/2020 preservada como histórica/SUPERSEDED).
     - `DETRAN_STATE_REGULATION`: Portarias e normas estaduais operacionais (e.g. DETRAN-SP).
     - `MUNICIPAL_REGULATION`: Legislação municipal de posturas e uso do solo.
     - `INTERNAL_MAZZI_RULE`: Regras e políticas internas comerciais/de ética da plataforma MAZZI.
3. **Classificação e Versionamento Temporal**:
   - Status regulatório explícito: `OFFICIALLY_VALIDATED`, `REQUIRES_REGULATORY_VALIDATION`, `SUPERSEDED`, `INACTIVE`.
   - Suporte a filtros dinâmicos por jurisdição e estado (`getComplianceRequirements`), garantindo que regras específicas do Estado de São Paulo não fiquem acopladas rigidamente como se fossem mandatos nacionais.
4. **Validação de Documentos Cadastrais (CPF e CNPJ)**:
   - **CPF**: Validação completa de formato e Dígitos Verificadores (Módulo 11), rejeitando sequências repetidas. Classificada formalmente como `FORMAT_AND_CHECK_DIGIT_VALIDATION`.
   - **CNPJ**: Suporte integral a **CNPJ Numérico Legado** (14 dígitos) e **CNPJ Alfanumérico da Receita Federal do Brasil (IN RFB)** (12 posições alfanuméricas `[0-9A-Z]` + 2 dígitos verificadores numéricos `[0-9]`), com cálculo oficial de Módulo 11 (ASCII - 48). Persistência puramente textual (`VARCHAR(30)` / `string`).
5. **Armazenamento Privado Seguro e Isolamento Multi-Tenant**:
   - Documentos de compliance residem em bucket privado `provider-compliance-docs` do Supabase Storage / S3.
   - Padrão de caminho restrito: `providers/{providerId}/compliance/{documentId}/{sanitizedFilename}`.
   - Políticas RLS no Storage (`storage.objects`) e no banco (`compliance_documents`) garantem que:
     - Usuários anônimos têm acesso estritamente negado.
     - Prestador A não pode ler ou fazer upload para pastas do Prestador B (Prevenção de IDOR).
     - Caminhos maliciosos com tentativas de path traversal (`..`, `\`) são barrados.
     - Somente operadores com permissão de auditoria (`PLATFORM_ADMIN`, `SUPPORT`) podem revisar documentos de terceiros.
6. **MIME-Type e Limites de Confiança**:
   - A validação prévia de extensão e MIME no cliente/upload é uma checagem preliminar. A arquitetura prevê a interface `FileSecurityScanner` para inspeção futura por magic bytes e verificação antivírus no backend.
7. **Classificação do Backoffice Administrativo**:
   - O painel de moderação da Sprint 04 é formalmente classificado como `PRELIMINARY_COMPLIANCE_ADMIN_UI`, servindo para o fluxo de auditoria cadastral. O módulo administrativo completo e consolidado está previsto para a Sprint 12.

---

## 2. Catálogo Oficial de Requisitos de Compliance

### A. Instrutor Autônomo (`INSTRUCTOR`)
| ID | Requisito | Tipo | Jurisdição | Fonte Normativa Principal | Status Regulatório | Validade |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `req_cnh_ear` | CNH com EAR | `CNH_EAR` | FEDERAL (BR) | Lei Federal nº 9.503/1997 (CTB), Art. 147, § 5º | `OFFICIALLY_VALIDATED` | 5 anos |
| `req_instrutor_formacao_fed` | Certificado de Formação | `CREDENTIAL_DETRAN` | FEDERAL (BR) | Lei Federal nº 12.302/2010, Art. 4º & CONTRAN 1.020/2025, Art. 110 | `OFFICIALLY_VALIDATED` | 2 anos |
| `req_antecedentes_instrutor_fed` | Antecedentes Criminais (Regulamentar) | `CRIMINAL_BACKGROUND` | FEDERAL (BR) | Resolução CONTRAN nº 1.020/2025, Art. 110 & Lei 12.302/2010, Art. 4º, VI | `OFFICIALLY_VALIDATED` | 90 dias |
| `req_credencial_detran_sp` | Credenciamento Operacional DETRAN-SP | `CREDENTIAL_DETRAN_SP` | STATE (SP) | Portaria DETRAN-SP de Credenciamento e Cadastro Operacional | `REQUIRES_REGULATORY_VALIDATION` | 2 anos |
| `req_contran_789_historico` | Regulamentação Histórica Instrutor | `CREDENTIAL_HISTORICAL` | FEDERAL (BR) | Resolução CONTRAN nº 789/2020 (Superada pela CONTRAN 1.020/2025) | `SUPERSEDED` | Histórico |
| `req_termo_conduta_mazzi` | Código de Ética e Segurança | `MAZZI_TERMS_ACCEPTANCE` | INTERNAL_PLATFORM | Política de Confiança e Segurança MAZZI v1.0 (Regra Interna de Marketplace) | `REQUIRES_REGULATORY_VALIDATION` | Permanente |

### B. Autoescola / CFC (`DRIVING_SCHOOL`)
| ID | Requisito | Tipo | Jurisdição | Fonte Normativa Principal | Status Regulatório | Validade |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `req_cnpj_contrato_fed` | Cartão CNPJ e Atos Constitutivos | `COMPANY_REGISTRATION` | FEDERAL (BR) | Lei Federal nº 10.406/2002 (Código Civil) & IN RFB 2.119/2022 | `OFFICIALLY_VALIDATED` | Permanente |
| `req_credenciamento_cfc_fed` | Diretrizes Federais CFC | `CFC_AUTHORIZATION` | FEDERAL (BR) | Resolução CONTRAN nº 1.020/2025, Arts. 118, 119 e 120 | `OFFICIALLY_VALIDATED` | Permanente |
| `req_portaria_cfc_sp` | Portaria Credenciamento CFC DETRAN-SP | `CFC_AUTHORIZATION_STATE` | STATE (SP) | Portaria DETRAN-SP & Art. 120 da Resolução CONTRAN nº 1.020/2025 | `REQUIRES_REGULATORY_VALIDATION` | 1 ano |
| `req_alvara_funcionamento_mun` | Alvará de Funcionamento | `CFC_ALVARA` | MUNICIPAL (SP) | Código de Posturas Municipal / Uso e Ocupação do Solo | `REQUIRES_REGULATORY_VALIDATION` | 1 ano |

---

## 3. Fluxos Operacionais e Tratamento de Documentos Rejeitados

### A. Fluxo de Rejeição e Correção Documental (`Action Required`)
- Quando um documento é rejeitado por um operador com justificativa:
  1. O documento passa para o status `REJECTED`, registrando `rejectionReason`, `reviewedBy` e `reviewedAt`.
  2. O prestador permanece no status `PENDING_REVIEW` (ou `DRAFT`), com o motor de elegibilidade retornando `isEligible = false`.
  3. A interface do prestador exibe o alerta de **"Ação Necessária: Reenviar Documento Rejeitado"**, detalhando a justificativa apontada pela moderação.
  4. O prestador pode enviar uma nova versão do documento, que substituirá o anterior e retornará para a fila de análise (`UNDER_REVIEW`).

---

## 4. Auditoria de Segurança e Testes Automatizados

A camada de compliance conta com suíte automatizada cobrindo:
- Validação Módulo 11 de CPF (casos válidos, dígitos repetidos, erros de DV).
- Validação Módulo 11 de CNPJ Numérico e Alphanumérico RFB (ASCII - 48).
- Matriz de segurança de Storage Access (Tentativa de acesso anônimo, IDOR entre prestadores, Path Traversal, acesso de moderador).
- Filtragem contextual de requisitos por estado (SP vs. nacional).
- Garantia de descarte de regras `SUPERSEDED` no motor de elegibilidade ativa.
- Separação estrita de obrigações regulatórias (`FEDERAL_LAW`, `CONTRAN_RESOLUTION`) e regras de conduta interna (`INTERNAL_MAZZI_RULE`).
- Máquina de estados e promoção de papéis (`STUDENT` -> `INSTRUCTOR` / `SCHOOL_ADMIN`).


---

## 3. Fluxos Operacionais e Tratamento de Documentos Rejeitados

### A. Fluxo de Rejeição e Correção Documental (`Action Required`)
- Quando um documento é rejeitado por um operador com justificativa:
  1. O documento passa para o status `REJECTED`, registrando `rejectionReason`, `reviewedBy` e `reviewedAt`.
  2. O prestador permanece no status `PENDING_REVIEW` (ou `DRAFT`), com o motor de elegibilidade retornando `isEligible = false`.
  3. A interface do prestador exibe o alerta de **"Ação Necessária: Reenviar Documento Rejeitado"**, detalhando a justificativa apontada pela moderação.
  4. O prestador pode enviar uma nova versão do documento, que substituirá o anterior e retornará para a fila de análise (`UNDER_REVIEW`).

---

## 4. Auditoria de Segurança e Testes Automatizados

A camada de compliance conta com suíte automatizada cobrindo:
- Validação Módulo 11 de CPF (casos válidos, dígitos repetidos, erros de DV).
- Validação Módulo 11 de CNPJ Numérico e Alphanumérico RFB (ASCII - 48).
- Matriz de segurança de Storage Access (Tentativa de acesso anônimo, IDOR entre prestadores, Path Traversal, acesso de moderador).
- Filtragem contextual de requisitos por estado (SP vs. nacional).
- Máquina de estados e promoção de papéis (`STUDENT` -> `INSTRUCTOR` / `SCHOOL_ADMIN`).
