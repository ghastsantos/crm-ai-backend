# CLAUDE.md — CRM-AI Backend

> Contexto: trabalho de faculdade — stack simplificada, sem Redis, sem rate limiting, sem workers.

## Stack

TypeScript, Express, Prisma, PostgreSQL, Vitest, Pino (logger), Zod (validação), Swagger/JSDoc OpenAPI.

## Comandos

```bash
npm run dev          # Desenvolvimento
npm run build        # Build TypeScript
npm run test         # Testes (Vitest)
npm run test:coverage
npm run lint         # ESLint
npm run db:migrate   # Criar e aplicar migração Prisma (dev)
npm run db:deploy    # Aplicar migrações pendentes (CI/produção)
npm run db:generate  # Regenerar Prisma Client
npm run db:studio    # Prisma Studio (inspecionar dados)
```

## Estrutura

```
src/
├── modules/<nome>/        # Feature-based: routes, controller, service
├── shared/
│   ├── errors/            # AppError, ValidationError
│   ├── middlewares/        # errorHandler (sempre por último), auth, etc.
│   ├── types/             # Tipos transversais
│   └── utils/             # Utilitários reutilizáveis
├── infrastructure/
│   └── database/prisma.ts # PrismaClient singleton
└── config/
    ├── env.ts             # Variáveis de ambiente (nunca hardcodar)
    └── logger.ts          # Pino logger (nunca usar console.log)
```

Referência canônica: `src/modules/health/` e `src/modules/auth/`.

## Padrões de código

### Idioma e estilo
- Respostas e comentários em português brasileiro
- Código (variáveis, funções, tipos) sempre em inglês
- Sem emojis no código ou comentários
- Comentários apenas explicativos e curtos — nunca expor lógica

### Nomenclatura
- Arquivos: kebab-case (`health.controller.ts`)
- Variáveis/funções: camelCase
- Types/interfaces: PascalCase
- Path aliases: `@/config`, `@/shared`, `@/modules`, etc.

### Módulos de API
- Cada módulo em `src/modules/<nome>/`: `*.routes.ts`, `*.controller.ts`, `*.service.ts`
- Rotas montadas em `src/app.ts` com prefixo `/api/v1/<nome>`
- `/health` e `/api-docs` fora do versionamento
- Controllers finos: recebem req/res, chamam service, retornam `{ success, data }` ou lançam `AppError`
- Lógica de negócio em services
- Formato de resposta API: `{ success, data?, error? }`
- Erros via `AppError` e `ValidationError` de `@/shared/errors/`
- Documentar endpoints com JSDoc `@openapi` para Swagger

### Validação
- Validar body, query e params com Zod em todas as rotas que recebem input
- Rejeitar na borda (controller ou middleware) antes de chamar o service

### TypeScript
- Evitar `any`; preferir tipos explícitos ou `unknown`
- Tipar retornos de funções async
- Zod: usar `z.infer<typeof schema>` para body/query/params

### Async/await
- Preferir `async/await` em vez de `.then()`
- Em handlers async: `try/catch` e repassar com `next(err)` ou lançar `AppError`

### Logging
- Usar `logger` de `@/config/logger`, nunca `console.log`
- Em erros: `logger.error({ err }, 'mensagem')`

## Prisma e banco de dados

- Schema em `prisma/schema.prisma`
- Usar singleton em `src/infrastructure/database/prisma.ts` — nunca instanciar PrismaClient diretamente
- Models: PascalCase; campos: camelCase
- Migrações: `npm run db:migrate` com nome descritivo em snake_case (ex: `add_contacts_table`)
- Não editar SQL manualmente em `prisma/migrations/` — correções = nova migração
- Gerar client após alterar schema: `npm run db:generate`
- Commitar `prisma/migrations/**/migration_lock.toml`
- Para reset em dev: `npx prisma migrate reset` (apaga dados)
- Transações: `prisma.$transaction` para operações atômicas
- SQL cru: usar tagged template do Prisma (`prisma.$queryRaw\`...\``) — nunca interpolar strings com dados do usuário
- Evitar `Float` para valores monetários — usar `Decimal`
- Paginação: `skip`/`take`; considerar cursor para tabelas grandes
- Evitar N+1: usar `include`/`select` equilibrado

## Testes

- Vitest + Supertest para integração
- Testes em `tests/integration/` para endpoints; `tests/unit/` para funções isoladas
- Importar `app` de `src/app.ts` para testes de integração (não iniciar servidor)
- Nomenclatura: `*.test.ts`
- Usar `describe` e `it`; assertions com `expect`

## Segurança e ambiente

- Nunca hardcodar secrets, URLs ou chaves — usar `@/config/env`
- Não commitar `.env` (está no `.gitignore`); usar `.env.example` como modelo
- `TRUST_PROXY_HOPS`: definir saltos confiáveis atrás de reverse proxy
- `API_DOCS_ENABLED`: desativar Swagger em produção se desnecessário
- Auth: `AUTH_HTTPONLY_COOKIE_ENABLED`, `AUTH_TOKEN_IN_BODY`, `AUTH_COOKIE_SAME_SITE`, `AUTH_ENFORCE_ORIGIN_ON_MUTATIONS`
- Nunca logar segredos (api_key, token, etc.)

## Swagger/OpenAPI

Adicionar `@openapi` JSDoc acima de cada rota. Tags agrupadas por domínio (`[Health]`, `[Auth]`, `[Contacts]`). Exemplos em `src/modules/health/health.routes.ts`.

## Princípios de engenharia

### Decisões de arquitetura
- Antes de criar código novo, verificar se já existe algo similar — reutilizar e estender
- Controllers finos: validação + chamada ao service + resposta. Nunca lógica de negócio no controller
- Services como camada única de regras de negócio
- Novos módulos seguem `src/modules/health/` e `src/modules/auth/` como template
- Separar queries complexas em funções nomeadas — não inline de 50 linhas

### Performance
- Paginação obrigatória em listagens — nunca retornar todos os registros
- `select` explícito no Prisma — trazer apenas colunas necessárias
- Evitar N+1: usar `include`/`select` equilibrado, nunca query em loop
- Transações curtas — manter `prisma.$transaction` com escopo mínimo
- Índices alinhados às queries reais, não genéricos

### Escalabilidade
- Novos módulos: routes → controller → service → Prisma (sempre nessa ordem)
- Erros centralizados em `AppError`/`ValidationError` — não criar try/catch custom em cada controller
- Configurações centralizadas em `@/config/env` — não espalhar `process.env` pelo código

### Para o desenvolvedor
- Ao criar nova feature: copiar estrutura de um módulo existente
- Ao alterar schema Prisma: `npm run db:migrate` com nome descritivo, depois `npm run db:generate`
- Ao adicionar endpoint: documentar com `@openapi` JSDoc, validar entrada com Zod
- Ao debugar: usar `logger` de `@/config/logger`, nunca `console.log`
- Rodar `npm run test` e `npm run lint` antes de considerar tarefa concluída

## Commits

Conventional Commits em português, imperativo:

```
tipo(escopo): descrição curta (até 72 chars)
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Escopo: nome do módulo (`contacts`, `auth`, `prisma`, etc.).
