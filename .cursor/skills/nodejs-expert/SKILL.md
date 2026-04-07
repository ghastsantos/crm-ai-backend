---
name: nodejs-expert
description: Node.js e TypeScript de alto nível — async/await, erros, segurança, APIs Express, tipagem, testes. Use ao escrever ou revisar código backend, rotas, services, middlewares ou integrações.
---

# Node.js + TypeScript (CRM-AI Backend)

Referência para código backend alinhado ao ecossistema **Express, Zod, Vitest, Pino**.

## Harmonia com o repositório

- Seguir [`.cursor/rules/project-standards.mdc`](../../rules/project-standards.mdc): respostas `{ success, data?, error? }`, `AppError` / `ValidationError`, controllers finos, services com regra de negócio.
- Estrutura em `src/modules/` (routes, controller, service) e infra em `src/infrastructure/` e `src/shared/`.
- Se existir conflito entre esta skill e uma regra do projeto, **vence a regra do projeto**.

## Princípios gerais

- **Async**: preferir `async/await`; não bloquear o event loop com I/O síncrono pesado.
- **Erros**: try/catch em handlers async; propagar com `next(err)` ou lançar `AppError`; registrar com `logger` de `@/config/logger`, não `console.log` em fluxo de produção.
- **Segurança**: secrets só em env (`@/config/env`); validar entrada com Zod na borda; CORS, helmet e rate limit conforme já adotado no app.
- **Dependências**: mínimo necessário; lockfile versionado; checar `npm audit` quando alterar deps.

## TypeScript

- **Strict**: evitar `any`; preferir `unknown` + narrowing para dados externos.
- **Zod**: tipar com `z.infer<typeof schema>` para body/query/params.
- **Express**: estender tipos de `Request` em `src/shared/types` ou equivalente quando houver `user` ou contexto por request.
- **Build**: código em `.ts`; saída em `dist/` quando aplicável ao pipeline do projeto.

## APIs REST

- Status adequados: 200, 201, 400, 401, 403, 404, 500.
- Validação antes de chamar service; mensagens claras sem vazar detalhes internos.
- Documentação OpenAPI/JSDoc conforme módulos existentes (`@openapi`).

## Banco (visão app)

- Acesso via **Prisma** pelo singleton; transações com `prisma.$transaction`.
- Para SQL cru ou tuning profundo no PostgreSQL, usar a skill **postgres-expert**.

## Testes

- **Vitest** (`npm run test`); nomes descritivos em português ou inglês, consistente com o módulo.
- Testes de API com supertest quando o projeto já usar esse padrão.
- Garantir que a suíte relevante passa antes de concluir a tarefa.

## Checklist rápido

- [ ] Entradas validadas (Zod); erros mapeados para HTTP
- [ ] Sem segredos em código ou logs
- [ ] Async com tratamento de erro e logging estruturado
- [ ] Tipos e build sem erros desnecessários
- [ ] Alinhado a `project-standards` e à estrutura `src/modules/`
