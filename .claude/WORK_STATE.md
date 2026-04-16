# Estado de Trabalho — CRUD API dos Cards do Pipeline CRM

> Arquivo de contexto para retomar a tarefa de qualquer máquina. Sincronizado via git.

## Contexto

O frontend do CRM precisa de endpoints REST para gerenciar cards (deals) do quadro kanban. Inclui criação, listagem, atualização de campos, movimentação entre fases e remoção.

## Branch de trabalho

`feature/crud-cards-pipeline` (criada a partir de `develop`)

## O que foi feito

- [x] Adicionados 5 campos ao model `Deal` no Prisma: `companyName`, `contactName`, `email`, `phone`, `notes`
- [x] Migração `20260412214221_add_deal_card_fields` criada e aplicada
- [x] `src/modules/cards/cards.schemas.ts` — schemas Zod (create, update, move, list)
- [x] `src/modules/cards/cards.service.ts` — createCard, listCards, getCard, updateCard, moveCard, deleteCard com `assertMember` e `toPublicCard` helpers
- [x] `src/modules/cards/cards.controller.ts` — segue padrão de `auth.controller.ts`
- [x] `src/modules/cards/cards.routes.ts` — Router Express com `authenticate`, `asyncHandler`, JSDoc `@openapi`
- [x] `src/app.ts` — rota registrada em `/api/v1/cards`
- [x] `src/config/swagger.ts` — tag `Cards` adicionada
- [x] Atualizar enum `DealStage` para nomes do pipeline (usando identificadores SCREAMING_SNAKE_CASE)

## O que falta fazer

- [ ] Abrir PR do branch `feature/crud-cards-pipeline` para `develop`

## Endpoints implementados

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/cards` | Criar card |
| GET | `/api/v1/cards?organizationId=...&stage=...` | Listar cards (filtro opcional por stage) |
| GET | `/api/v1/cards/:id` | Buscar card por ID |
| PATCH | `/api/v1/cards/:id` | Atualizar campos do card |
| PATCH | `/api/v1/cards/:id/move` | Mover card de fase |
| DELETE | `/api/v1/cards/:id` | Deletar card |

## Decisões tomadas

- **Campos diretos no card** (não usar relações `Contact`/`Organization` para nome/email/telefone)
- **Movimento de cards é livre** (qualquer fase para qualquer fase), sem regras por enquanto
- **Listagem** com filtro por `stage` opcional, paginação a verificar com o frontend
- **Enum DealStage**: identificadores em `SCREAMING_SNAKE_CASE` no backend (ex: `LEAD_CAPTADO`), labels legíveis no frontend

## Mapeamento de fases do pipeline

| Enum (backend) | Label (frontend) |
|----------------|------------------|
| `LEAD_CAPTADO` | Lead Captado |
| `QUALIFICACAO_MQL_ICP` | Qualificação (MQL/ICP) |
| `CONTATO_INICIAL` | Contato Inicial |
| `PROPOSTA` | Proposta |
| `NEGOCIACAO` | Negociação |
| `FECHAMENTO` | Fechamento |

## Arquivos críticos

- `prisma/schema.prisma` — model `Deal` e enum `DealStage`
- `src/modules/cards/*` — todo o módulo
- `src/app.ts:13` — import do `cardsRoutes`
- `src/app.ts:63` — `app.use('/api/v1/cards', cardsRoutes)`
- `src/config/swagger.ts` — tag `Cards`
