# Documentação Geral

## Objetivo

O sistema é um CRM simples para organizar negociações, acompanhar contatos e registrar conversas vindas do WhatsApp.

O foco do projeto é permitir que uma equipe veja rapidamente:

- quem é o cliente;
- em qual etapa a negociação está;
- qual foi a última conversa;
- qual deve ser o próximo passo.

## Fluxo principal

1. O usuário cria uma conta e uma organização.
2. A organização recebe colunas padrão do pipeline.
3. O admin vincula a organização à instância global do WhatsApp.
4. O cliente envia mensagem para o número conectado pelo WhatsApp Web.
5. O Baileys entrega a mensagem ao backend, a IA analisa a conversa e decide a etapa provável.
6. O card é criado ou atualizado, o histórico registra as mudanças e o bot responde no WhatsApp.

## Etapas padrão

- Lead
- Qualificação
- Em negociação
- Fechamento
- Não fechou

As colunas podem ser renomeadas, reordenadas ou criadas pela interface.

## Atendimento WhatsApp

A integração usa Baileys/WhatsApp Web para conectar um número real de WhatsApp e Gemini para gerar a resposta do atendente.

Rotas principais:

- `GET /api/v1/whatsapp/integration`
- `POST /api/v1/whatsapp/integration/setup`
- `POST /api/v1/whatsapp/integration/connect`
- `GET /api/v1/whatsapp/conversations`

Ao clicar em conectar, o backend gera um QR code. Depois que o atendente escaneia o QR com o WhatsApp, as mensagens recebidas entram direto pelo socket local do Baileys.

A API:

- normaliza o telefone;
- procura card existente pelo telefone;
- cria um card se ainda não existir;
- registra a mensagem nas observações;
- usa Gemini para gerar resumo, próximo passo e resposta;
- move a negociação para a coluna mais adequada;
- envia a resposta automática para o cliente pelo WhatsApp conectado.

Se `GEMINI_API_KEY` não estiver configurado, o sistema usa um classificador local simples como fallback.

## Cadastro de usuários da organização

Usuários com papel de administrador podem cadastrar outros usuários na organização ativa, definindo:

- nome;
- e-mail;
- senha inicial;
- papel de administrador ou membro.

## Backend

Stack:

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Vitest

Módulos principais:

- `auth`
- `organizations`
- `cards`
- `pipeline-columns`
- `pipeline-logs`
- `whatsapp`

## Frontend

Stack:

- React
- Vite
- TypeScript
- TanStack Query
- Tailwind CSS

Telas principais:

- login;
- cadastro;
- pipeline;
- atendimento WhatsApp;
- configurações;
- histórico do pipeline.
