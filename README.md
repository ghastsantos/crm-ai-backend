# CRM Backend

API do CRM em Node.js, Express, Prisma e PostgreSQL.

## O que tem

- Autenticação com JWT
- Organizações e usuários por organização
- Pipeline de negociações com colunas configuráveis
- Cards de negociação com valor, contato, telefone, observações e datas
- Histórico de alterações do pipeline
- Integração real com WhatsApp via Baileys/WhatsApp Web
- Chatbot com Gemini para responder clientes e atualizar o pipeline

## Integração WhatsApp

O projeto usa uma instância global do WhatsApp Web com Baileys. O fluxo é:

1. O admin vincula uma organização à instância global.
2. O backend gera um QR code pelo Baileys.
3. O atendente escaneia o QR code com o WhatsApp.
4. O Gemini analisa a conversa, o CRM cria/atualiza/move o card e o backend responde o cliente no WhatsApp.

As etapas usadas pelo bot são:

- Lead
- Qualificação
- Em negociação
- Fechamento
- Não fechou

Sem `GEMINI_API_KEY`, a API usa um fallback local simples para não travar o fluxo.

## Requisitos

- Node.js 20+
- Docker e Docker Compose para PostgreSQL

## Rodar localmente

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run dev
```

A API fica em `http://localhost:3000`.

Se a porta estiver ocupada, o `npm run dev` pergunta outra porta no terminal. Para deixar uma porta fixa, altere `PORT` no `.env`.

Para conectar WhatsApp, configure no `.env`:

```env
WHATSAPP_PROVIDER=baileys
WHATSAPP_INSTANCE_NAME=crm-global
WHATSAPP_AUTH_DIR=.data/baileys-auth
WHATSAPP_AUTO_START=true
GEMINI_API_KEY=sua-chave-gemini
```

A pasta `WHATSAPP_AUTH_DIR` guarda a sessão do WhatsApp. Não apague essa pasta se quiser evitar escanear o QR code de novo.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia a API em desenvolvimento |
| `npm run build` | Compila TypeScript |
| `npm run test` | Roda testes |
| `npm run lint` | Roda ESLint |
| `npm run validate` | Valida padrões básicos do projeto |
| `npm run db:migrate` | Roda migrações Prisma |
| `npm run db:generate` | Gera o Prisma Client |

## Principais rotas

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Cria usuário e organização |
| `POST` | `/api/v1/auth/login` | Login |
| `GET` | `/api/v1/auth/me` | Usuário atual |
| `GET` | `/api/v1/cards` | Lista cards |
| `POST` | `/api/v1/cards` | Cria card |
| `PATCH` | `/api/v1/cards/:id/move` | Move card |
| `GET` | `/api/v1/pipeline-columns` | Lista colunas |
| `POST` | `/api/v1/organizations/:id/users` | Cria usuário na organização |
| `GET` | `/api/v1/whatsapp/integration` | Status da integração WhatsApp |
| `POST` | `/api/v1/whatsapp/integration/setup` | Vincula a organização à instância global |
| `POST` | `/api/v1/whatsapp/integration/connect` | Gera QR/pairing para conectar o número |
| `GET` | `/api/v1/whatsapp/conversations` | Lista conversas recebidas |
