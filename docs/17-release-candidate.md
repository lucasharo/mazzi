# MAZZI — Sprint 16 Release Candidate

Status: release candidate técnico, não lançamento público.

Branch: `main`

Base esperada antes da Sprint 16: `8fd86af fix: bind booking holds to authenticated students`

## Escopo desta Sprint

A Sprint 16 prepara o MAZZI para validação de release candidate sem adicionar funcionalidades novas fora do MVP. O foco é regressão, segurança de runtime, proteção de configuração, PWA básico, build de produção e checklist manual.

## Decisões mantidas

- O produto segue como marketplace MVP para aulas práticas categoria B em São Paulo.
- `Supabase + OpenStreetMap/Leaflet` são a direção técnica atual; Mercado Pago permanece futuro e desabilitado.
- Dinheiro real continua desabilitado.
- O gateway fake existe somente para desenvolvimento/testes.
- “Minha jornada para a CNH”, pacotes, WhatsApp/SMS/e-mail transacional, IA e gamificação continuam fora do MVP.

## Gate de pagamento

O `FakePaymentGateway` é permitido apenas em desenvolvimento/testes. Em produção, qualquer tentativa de uso do gateway fake deve falhar com erro explícito `FAKE_GATEWAY_UNAVAILABLE_IN_PRODUCTION`.

O build pode existir como release candidate, mas cobrança real só pode ser habilitada depois de:

- Mercado Pago real não está habilitado; credenciais reais não fazem parte deste release;
- split/repasse/estorno validados;
- webhook real validado;
- reconciliação financeira validada;
- checklist jurídico e LGPD finalizado.

## PWA

Esta Sprint adiciona:

- `public/manifest.webmanifest`;
- `public/icons/mazzi-icon.svg`;
- `public/sw.js`;
- registro de service worker somente em produção/HTTPS/localhost.

O service worker é conservador: cacheia apenas shell/assets públicos do próprio app e ignora Auth, REST, RPC, API, Storage e requests cross-origin. Dados privados do Supabase não devem ser cacheados.

## Configuração de ambiente

O browser runtime exige:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_ANON_KEY`.

Nunca criar `VITE_SUPABASE_SERVICE_ROLE_KEY`. A service role é exclusivamente server-side.

## Checklist manual antes de produção real

- [ ] Confirmar domínio final e HTTPS.
- [ ] Rodar Supabase Security Advisor e documentar apenas warnings aceitos.
- [ ] Ativar leaked password protection no Supabase Auth.
- [ ] Confirmar que nenhuma credencial real aparece em `dist/`.
- [ ] Mercado Pago real permanece bloqueado até solicitação explícita futura do Product/User.
- [ ] Validar webhook real com assinatura.
- [ ] Validar split, repasse, chargeback e estorno.
- [ ] Validar termos de uso, política de privacidade/LGPD e consentimentos.
- [ ] Executar smoke test em mobile, tablet e desktop reais.
- [ ] Executar fluxo aluno → booking → pagamento dev/real sandbox → prestador → admin.
- [ ] Confirmar suporte operacional para cancelamentos e disputas.

## Comandos de validação técnica

```bash
npm run lint
npm run test
npm run build
npx tsx scripts/real-db-sprint15-gate.ts
npx tsx scripts/real-db-sprint16-rc-gate.ts
```

## Critério de saída

`SPRINT_16_GATE = PASS` significa apenas que o gate técnico atual foi atingido.

Não significa:

- aprovação final da Sprint pelo usuário;
- readiness de dinheiro real;
- autorização para lançar em produção;
- autorização para merge/branch adicional.
