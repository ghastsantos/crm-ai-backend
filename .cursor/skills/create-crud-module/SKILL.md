---
name: create-crud-module
description: Template para criar módulo CRUD completo (routes, controller, service, Prisma). Use para novos recursos com CRUD.
---

# Criar Módulo CRUD

## Passos

1. **Schema Prisma**: adicionar model em `prisma/schema.prisma`
2. **Migração**: `npm run db:migrate` com nome descritivo
3. **Módulo**: criar pasta `src/modules/<nome>/` com:
   - `<nome>.routes.ts` — rotas GET, POST, GET/:id, PUT/:id, DELETE/:id
   - `<nome>.controller.ts` — handlers que chamam service
   - `<nome>.service.ts` — lógica com Prisma
4. **Registrar**: adicionar rotas em `src/app.ts` com `app.use('/api/v1/<nome>', <nome>Routes)`
5. **Validação**: Zod para body em POST/PUT
6. **Swagger**: anotações JSDoc `@openapi` em cada rota

## Estrutura do módulo

- Routes: `Router()` com verbos HTTP
- Controller: recebe req/res, valida com Zod, chama service, retorna `{ success, data }`
- Service: usa `prisma` de `@/infrastructure/database/prisma`

## Referência

Use `src/modules/health/` e `src/modules/test/` como base. Para CRUD completo, estender o padrão com list, getById, create, update, delete.
