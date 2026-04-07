---
name: postgres-expert
description: PostgreSQL avançado para este projeto (schema, índices, tipos, transações, performance, segurança). Use ao escrever $queryRaw/$executeRaw, revisar SQL gerado, modelar dados além do Prisma, tuning de queries, ou quando precisar de conselho de DBA PostgreSQL.
---

# Especialista PostgreSQL (CRM-AI Backend)

Referência para PostgreSQL no contexto de **Node.js + Prisma**: schemas claros, queries seguras, índices e transações corretas.

## Relação com Prisma

- **Schema e migrações**: preferir alterações em `prisma/schema.prisma` e `prisma migrate` (ver skill `run-migration` e agent `prisma-specialist`).
- **SQL ad-hoc**: ao usar `prisma.$queryRaw` / `$executeRaw`, usar **template tagged** do Prisma (`prisma.$queryRaw\`...\``) para bind seguro de parâmetros — nunca interpolar strings com dados do usuário.
- **Regras do repositório**: harmonizar com [`.cursor/rules/prisma-database.mdc`](../../rules/prisma-database.mdc) e singleton em `src/infrastructure/database/prisma.ts`.

## Princípios gerais

- **Parâmetros sempre separados**: nunca concatenar entrada do usuário em SQL. No Prisma, tagged template; em driver `pg`, placeholders `$1`, `$2`.
- **Transações**: operações que precisam ser atômicas em `prisma.$transaction` (callback ou array de operações). Em deadlock, avaliar retry com backoff no nível da aplicação.
- **Soft delete**: quando o projeto adotar, usar coluna nullable (ex.: `deletedAt`) e filtrar nas queries ativas; alinhar com models Prisma.

## Schema e tipos (PostgreSQL)

- **IDs**: `cuid()` / `uuid()` via Prisma; no PG, tipicamente `TEXT` ou `UUID`. Escolher um padrão e manter consistente.
- **Texto**: `String` no Prisma → `TEXT` no PG (sem limite arbitrário pequeno a menos que haja regra de negócio).
- **Dinheiro / precisão**: `Decimal` no Prisma; evitar `Float` para valores exatos.
- **JSON**: `Json` no Prisma → `JSONB` no PG; índice GIN quando houver filtros em campos JSON.
- **Datas**: `DateTime` com timezone consciente (armazenar UTC é comum). Usar `timestamptz` quando fizer sentido nas migrações geradas.
- **Integridade**: `NOT NULL`, `UNIQUE`, FKs com `onDelete` explícito no Prisma; constraints e checks adicionais via migração quando necessário.

## Índices

- **Onde**: colunas em `WHERE`, `ORDER BY`, `GROUP BY`, chaves de JOIN. FKs usadas em joins frequentes costumam merecer índice.
- **Compostos**: ordem importa — igualdades antes de ranges; coluna mais seletiva primeiro quando aplicável.
- **Parcial**: `WHERE deletedAt IS NULL` em índices parciais pode reduzir tamanho e melhorar consultas ativas.
- **Custo**: cada índice pesa em escrita; não criar índices não usados.

## Queries e performance

- **EXPLAIN (ANALYZE, BUFFERS)**: usar em queries críticas para ver plano real e custos (em dev/staging com dados representativos).
- **SELECT**: evitar trazer colunas desnecessárias em listagens grandes; no Prisma, `select` explícito.
- **Paginação**: `skip`/`take` (offset) pode degradar em tabelas muito grandes; considerar cursor (`id > ? ORDER BY id LIMIT n`) para listagens quentes.
- **N+1**: usar `include`/`select` equilibrado ou queries agregadas para evitar dezenas de round-trips.
- **Locks**: operações longas em transação aumentam contenção; manter transações curtas.

## Segurança e operações

- **Least privilege**: usuário da aplicação sem superuser; apenas privilégios nas tabelas necessárias.
- **Backup / restore**: política da equipe; testar restore periodicamente.
- **Migrações**: não reescrever migrações já aplicadas em ambientes compartilhados; criar nova migração para correções.

## Concorrência e limites

- **Deadlock**: possível sob alta concorrência em updates ordenados diferentes; aplicar ordenação consistente de locks ou retries.
- **Connection pool**: Prisma gerencia pool; evitar instâncias múltiplas de `PrismaClient` no mesmo processo.
- **Vacuum / analyze**: em autovacuum padrão costuma bastar; investigar bloat apenas se houver evidência.

## Checklist rápido

- [ ] Sem concatenação de SQL com dados externos; Prisma tagged raw ou placeholders `$n`
- [ ] Transações com escopo mínimo necessário
- [ ] Índices alinhados às queries reais (não genéricos demais)
- [ ] Tipos adequados (decimal para dinheiro, JSONB + GIN se filtrar JSON)
- [ ] Paginação e evitar N+1 em listagens que crescem

## Quando o projeto tem regras próprias

Priorizar [`.cursor/rules/project-standards.mdc`](../../rules/project-standards.mdc), [`.cursor/rules/prisma-database.mdc`](../../rules/prisma-database.mdc) e convenções em `src/`; esta skill complementa com foco em PostgreSQL.
