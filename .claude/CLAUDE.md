# CLAUDE.md — Contexto do Sistema para o Claude Code

> Para detalhes técnicos completos, leia `./ARCHITECTURE_NEW.md`.

---

## Visão Geral

Sistema de **atendimento IA via WhatsApp** chamado "Caetano" + **CRM Web próprio**. Recebe mensagens de clientes (texto ou áudio), processa com agente LangChain (GPT), e gerencia leads no CRM próprio.

**Contexto:** trabalho de faculdade — stack simplificada, sem Redis, sem rate limiting, sem workers.

---

## Stack

- **FastAPI + Uvicorn** — API única (webhook WhatsApp + endpoints REST do CRM)
- **LangChain + langchain-openai** — agente Caetano + subagente Gerenciador CRM
- **OpenAI Whisper** — transcrição de áudio
- **Evolution API** — gateway WhatsApp (recebe e envia mensagens)
- **Banco de dados relacional** (PostgreSQL ou SQLite) — armazena cards/leads
- **Pydantic** — validação de dados e configuração via `.env`
- **httpx** — cliente HTTP async
- **Frontend CRM Web** — tecnologia a definir

---

## Estrutura de módulos

```
whatsapp_agent/
├── main.py                     # FastAPI entry point
├── api/
│   ├── webhook.py              # POST /recebimento-mensagens
│   └── cards.py                # Endpoints REST do CRM
├── core/
│   ├── config.py               # pydantic-settings (.env)
│   ├── agent.py                # LangChain Agent (Caetano)
│   └── message_processor.py    # Orquestra o fluxo completo
├── services/
│   ├── evolution.py            # Cliente Evolution API
│   ├── openai_service.py       # Whisper (transcrição)
│   ├── crm_service.py          # Camada de negócio do CRM
│   └── dedup.py                # Deduplicação em memória
├── tools/
│   └── crm_tool.py             # LangChain Tool: CRM
├── models/
│   ├── incoming_message.py     # Pydantic: payload webhook
│   ├── normalized_message.py   # Pydantic: mensagem normalizada
│   └── card.py                 # Pydantic: modelo do card
└── tests/
```

---

## Fluxo WhatsApp (mensagem recebida)

1. Cliente envia mensagem (texto ou áudio) no WhatsApp.
2. Evolution API (:8080) faz `POST /recebimento-mensagens` no backend.
3. Backend normaliza payload (extrai phone, messageId).
4. Verifica deduplicação: `set()` Python em memória com messageIds já processados.
5. Se áudio → Evolution API (obter Base64) → OpenAI Whisper (transcrever).
6. Verifica primeiro contato: `SELECT` na tabela `cards` por phone. Se não existe, envia saudação.
7. Envia mensagem normalizada ao Agente Caetano.
8. Caetano processa e pode chamar a Tool Vendas CRM → Subagente Gerenciador CRM.
9. Resposta é sanitizada (remove JSON, links internos, placeholders).
10. Backend envia resposta via `POST /message/sendText/{instance}` na Evolution API.

---

## Agentes IA

**Agente Caetano** (principal):
- Modelo: GPT (gpt-4o-mini), temperatura 0.3
- System prompt: "Você é Caetano, atendente de vendas. Seja objetivo e cordial."
- Memória: ConversationBufferWindowMemory (buffer de 20 mensagens)
- Tool: Vendas CRM (aciona o subagente)

**Subagente Gerenciador CRM** (chamado como tool):
1. Normaliza campos (telefone só dígitos, origem padrão "Whatsapp", produto mapeado para catálogo fixo, email normalizado, observações max 240 chars)
2. Valida dados obrigatórios → se faltam, retorna `VALIDATION_REQUIRED`
3. Resolve IDs (pipe_id, phase_id, field_id)
4. Executa operação no Serviço CRM (create_card, move_card, update_card)

---

## Endpoints REST do CRM (usados pelo frontend)

- `POST /cards` — criar lead
- `GET /cards` — listar leads
- `PATCH /cards/:id/move` — mover card de fase
- `PATCH /cards/:id/fields` — atualizar campos do card

Todos passam pelo **Serviço CRM** (camada de negócio única), que é a mesma camada usada pelo subagente.

---

## Banco de Dados

Banco relacional único. Tabela principal `cards`:
- Colunas: `id`, `phone`, `nome`, `produto`, `fase`, `email`, `origem`, `observacoes`, `created_at`, `updated_at`
- Índice na coluna `phone` para busca rápida
- Busca phone → card_id é um `SELECT` nesta tabela (não há Phone Store separado)

Saudação de primeiro contato: se `SELECT` por phone retorna vazio, é novo → envia boas-vindas.

---

## Controles em memória (sem Redis)

- **Deduplicação**: `set()` Python com messageIds processados
- **ACK Control**: `dict()` Python com timestamps do último ACK por telefone (cooldown 60s)

---

## Evolution API

- URL interna: `http://evolution_api:8080`
- Autenticação: header `apikey: {EVOLUTION_API_KEY}`
- `POST /message/sendText/{instance}` — enviar texto
- `POST /chat/getBase64FromMediaMessage/{instance}` — extrair áudio Base64

---

## Variáveis de ambiente (.env)

```dotenv
HOST=0.0.0.0
PORT=8000
EVOLUTION_API_URL=http://evolution_api:8080
EVOLUTION_API_KEY=
OPENAI_API_KEY=
DATABASE_URL=sqlite:///./crm.db
ACK_COOLDOWN_SECONDS=60
GREETING_ENABLED=true
```

---

## Regras obrigatórias de código

1. **Uma responsabilidade por módulo** — cada diretório faz UMA coisa
2. **Injeção de dependências** — passe serviços como parâmetros
3. **Nomes descritivos** — `is_duplicate()`, não `chk()`
4. **Funções pequenas** — ~20 linhas máximo
5. **Type hints em tudo** — todo parâmetro e retorno tipado
6. **Sem magic numbers** — use `settings.ack_cooldown_seconds`, não `60`
7. **Async consistente** — todo I/O é `async/await`
8. **Exceções específicas** — capture `httpx.HTTPStatusError`, não `Exception`
9. **Nunca commitar `.env`** — `.gitignore` DEVE incluir `.env`
10. **Nunca hardcodar credenciais** — nem em comentários, nem em testes
11. **Usar `.env.example`** — modelo sem valores reais
12. **Validar no boot** — `pydantic-settings` falha se variável obrigatória ausente
13. **Nunca logar segredos** — nunca logue `api_key`, `token` etc.

---

## Dependências Python

```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
pydantic>=2.7.0
pydantic-settings>=2.2.0
python-dotenv>=1.0.0
langchain>=0.2.0
langchain-openai>=0.1.0
langchain-community>=0.2.0
httpx>=0.27.0
openai>=1.30.0
sqlalchemy>=2.0.0
```
