# TASK-078 — QA report

## Checks executados

| Check | Resultado |
| --- | --- |
| `npm run lint` | PASS |
| Testes direcionados Admin | PASS — 28 testes |
| Teste remoto de cancelamento | PASS — 5 testes |
| `npm test` | PASS — 796 testes em 111 arquivos |
| `npm run build:student` | PASS |
| `npm run build:instructor` | PASS |
| `npm run build:admin` | PASS |
| `git diff --check` | PASS |

## Smoke visual

- O servidor local Admin iniciou em `http://localhost:3003`.
- O smoke automatizado ficou indisponível porque o binário `agent-browser` não está instalado neste ambiente. Isso não afetou os testes, lint ou builds.

## Validação DEV de segurança

- A migration de governança foi registrada no ledger DEV.
- As duas RPCs são `SECURITY DEFINER` e definem `search_path=public, pg_temp`.
- `authenticated` executa somente `admin_add_administrative_role`.
- `anon` não possui execução em nenhuma RPC de governança.
- A função auxiliar de servidor não fica disponível para o navegador.
- A Edge Function está ativa e exige JWT.

## Riscos conhecidos

- O Vite emite apenas o aviso não bloqueante de bundle acima de 500 kB; não há falha de build.
- O fluxo de convite requer que o e-mail de autenticação seja entregue pelo provedor de Auth configurado no ambiente DEV.
