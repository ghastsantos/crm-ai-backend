---
name: run-migration
description: Workflow para criar e executar migrações Prisma. Use ao alterar o schema.
---

# Migração Prisma

## Workflow

1. **Editar schema**: alterar `prisma/schema.prisma` (adicionar/remover models, campos, relações)
2. **Criar migração**: `npm run db:migrate` — Prisma pede nome; use descritivo (ex: `add_contacts_table`)
3. **Gerar client**: `npm run db:generate` (geralmente automático no migrate)
4. **Aplicar**: se usando Docker, garantir que PostgreSQL está rodando (`docker compose up -d`)

## Comandos

- `npm run db:migrate` — cria e aplica migração
- `npm run db:generate` — regenera Prisma Client
- `npm run db:studio` — abre Prisma Studio para inspecionar dados

## Convenções

- Nomes de migração em snake_case
- Não editar SQL manualmente em `prisma/migrations/`
- Para reset em dev: `npx prisma migrate reset` (apaga dados)

## Ambiente

- `DATABASE_URL` no .env deve apontar para PostgreSQL
- Em CI: usar `prisma migrate deploy` para aplicar migrações pendentes
