# CRM AI Backend

Backend principal do CRM com IA. Arquitetura baseada em serviços com Node.js, Express, Prisma e TypeScript.

## Stack

- **Runtime:** Node.js 18+
- **Linguagem:** TypeScript
- **Framework:** Express
- **ORM:** Prisma
- **Banco:** PostgreSQL
- **Testes:** Vitest + Supertest
- **Documentação:** Swagger/OpenAPI

## Pré-requisitos

- Node.js 18+
- Docker e Docker Compose (para PostgreSQL)
- DBeaver ou outra ferramenta para gestão do banco (opcional)

---

## Início rápido (novo colaborador)

### 1. Clonar e instalar

```bash
git clone <url-do-repo>
cd crm-ai-backend
npm install
```

O `npm install` configura automaticamente o Husky (hooks de pre-commit).

### 2. Configurar ambiente

```bash
cp .env.example .env
# Edite .env com suas configurações (DATABASE_URL, etc.)
```

### 3. Subir o banco de dados

```bash
docker compose up -d
```

### 4. Rodar migrações

```bash
npm run db:migrate
```

### 5. Iniciar o servidor

```bash
npm run dev
```

A API estará em `http://localhost:3000`. Swagger em `http://localhost:3000/api-docs`.

---

## Fluxo de desenvolvimento

### Antes de commitar

O **Husky** roda automaticamente:

**Pre-commit** (em cada `git commit`):
1. **lint-staged** executa em arquivos staged em `src/**/*.ts`:
   - ESLint com `--fix`
   - Prettier com `--write`
2. Se falhar, o commit é bloqueado. Corrija os erros e tente novamente.

**Pre-push** (em cada `git push`):
1. **validate** — valida padrões do projeto (estrutura de módulos, sem console.log, etc.)
2. **test** — executa a suíte de testes
3. Se falhar, o push é bloqueado.

Para validar manualmente antes de commitar:

```bash
npm run lint
npm run test
```

### Ao fazer push

Quando você faz `git push`, o **GitHub Actions** (CI) roda automaticamente **no GitHub** — não na sua máquina. Ele clona o repositório, instala dependências e executa:

1. **Lint** — verifica se o código segue as regras (ESLint)
2. **Validate** — valida padrões do projeto (estrutura de módulos, sem console.log, aliases)
3. **Prisma generate** — gera o client do banco
4. **Migrations** — aplica migrações no PostgreSQL do CI
5. **Testes** — roda a suíte de testes
6. **Build** — compila o TypeScript

Se tudo passar, o PR ou o push fica com status verde. Se algo falhar, o status fica vermelho e você pode ver o log em **Actions** no GitHub. Nesse caso: corrija o problema na sua máquina, commite e faça push de novo — o CI roda novamente.

### Fluxo recomendado

```bash
# 1. Criar branch
git checkout -b feat/nome-da-feature

# 2. Desenvolver
npm run dev

# 3. Commitar (Husky valida automaticamente)
git add .
git commit -m "feat(escopo): descrição"

# 4. Push e abrir PR
git push origin feat/nome-da-feature
```

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

---

## Desenvolvimento assistido (.cursor/)

O projeto usa Cursor com Rules, Subagents e Skills para padronizar o desenvolvimento.

### Rules (regras automáticas)

Regras que o agent aplica ao editar código:

| Arquivo | Quando aplica |
|---------|---------------|
| `project-standards.mdc` | Sempre (padrões gerais) |
| `prisma-database.mdc` | Ao editar `prisma/**` ou `**/database/**` |
| `api-modules.mdc` | Ao editar `src/modules/**` |
| `tests.mdc` | Ao editar `tests/**` |
| `shared-infra.mdc` | Ao editar `src/shared/**` ou `src/infrastructure/**` |

### Subagents (especialistas)

Use para tarefas complexas. Invocação explícita: `/nome-do-subagent` ou "Use o subagent X para...".

| Subagent | Quando usar |
|----------|-------------|
| `/prisma-specialist` | Alterar schema, criar migrações, otimizar queries |
| `/api-module-builder` | Criar endpoints, CRUDs, refatorar módulos |
| `/test-specialist` | Escrever/corrigir testes, aumentar cobertura |
| `/integration-specialist` | Integrar EvolutionAPI, serviço de IA |
| `/verifier` | Validar trabalho concluído (rodar testes, build) |
| `/debugger` | Analisar erros, stack traces, bugs |

### Skills (workflows rápidos)

Workflows acionáveis via `/` ou automaticamente quando relevantes:

| Skill | Quando usar |
|-------|-------------|
| `/conventional-commit` | Gerar mensagem de commit |
| `/create-crud-module` | Criar módulo CRUD completo |
| `/add-swagger-docs` | Documentar endpoints no Swagger |
| `/run-migration` | Criar e executar migrações Prisma |

### Estrutura do .cursor/

```
.cursor/
├── rules/       # Regras por contexto
├── agents/      # Subagents especializados
├── skills/     # Workflows reutilizáveis
└── plans/      # Planos de implementação
```

---

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor em modo desenvolvimento com hot-reload |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm run start` | Inicia o servidor (após build) |
| `npm run test` | Executa testes |
| `npm run test:coverage` | Testes com relatório de cobertura |
| `npm run lint` | Verifica código com ESLint |
| `npm run lint:fix` | ESLint com correção automática |
| `npm run validate` | Valida padrões do projeto (estrutura, convenções) |
| `npm run db:migrate` | Executa migrações Prisma |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:generate` | Regenera Prisma Client |

---

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Liveness (sem dependências) |
| GET | `/api/v1/health` | Readiness (com verificação de DB) |
| GET | `/api/v1/test` | Smoke test |
| GET | `/api-docs` | Documentação Swagger |

---

## Estrutura do projeto

```
src/
├── config/          # Configurações (env, logger, swagger)
├── modules/         # Módulos por domínio (routes, controller, service)
│   ├── health/
│   └── test/
├── shared/          # Código transversal
│   ├── errors/
│   ├── middlewares/
│   ├── types/
│   └── utils/
├── infrastructure/  # Banco, integrações
├── app.ts
└── server.ts
```

---

## Serviço de IA

O serviço de IA (Python/FastAPI) é um **projeto separado**. O contrato da API esperada está em [`docs/ai-service-contract.md`](docs/ai-service-contract.md).

---

## Licença

ISC
