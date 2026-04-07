# Arquitetura do Sistema — Caetano IA WhatsApp + CRM Próprio

> Documento de arquitetura atualizado, refletindo as decisões de projeto tomadas para o trabalho de faculdade.
> Sem Redis, sem rate limiting, sem workers, sem Pipefy — stack simplificada e funcional.

---

## 1. Arquitetura do Backend

O backend é uma **API única em FastAPI** (porta 8000) que serve tanto o fluxo do WhatsApp quanto o CRM Web. Ele está organizado em quatro camadas:

### Rotas (endpoints)

O FastAPI expõe dois grupos de endpoints:

- **Webhook WhatsApp** (`POST /recebimento-mensagens`): recebe mensagens da Evolution API. Normaliza o payload, verifica deduplicação em memória, identifica se é texto ou áudio, e encaminha para o agente de IA.
- **Endpoints REST do CRM** (`POST /cards`, `PATCH /cards/:id/move`, `PATCH /cards/:id/fields`, `GET /cards`): usados pelo frontend do CRM Web para criar, mover, atualizar e listar cards/leads.

### Agentes IA

- **Agente Caetano** (LangChain + GPT): agente principal que conversa com o cliente via WhatsApp. Mantém memória conversacional (buffer de 20 mensagens), decide automaticamente quando chamar tools.
- **Subagente Gerenciador CRM**: chamado como tool pelo Caetano. Normaliza campos do lead, valida dados obrigatórios e resolve IDs antes de executar operações no CRM.

### Serviços

- **Serviço CRM** (camada de negócio): única camada responsável por criar, mover e atualizar cards no banco de dados. É acessada internamente tanto pelo subagente (chamada direta Python) quanto pelos endpoints REST do CRM.
- **Serviço Evolution API**: cliente HTTP async para enviar mensagens de texto e obter áudio em Base64 da Evolution API.
- **Serviço OpenAI (Whisper)**: transcreve áudios recebidos via WhatsApp para texto usando o modelo Whisper da OpenAI.

### Dados

- **Banco de Dados CRM**: banco relacional único (PostgreSQL ou SQLite) que armazena todos os dados de leads/cards em uma tabela `cards`. A busca por telefone (phone → card_id) é feita via `SELECT` nesta mesma tabela, com um índice na coluna `phone`.
- **Dedup + ACK em memória Python**: deduplicação de mensagens é feita com um `set()` Python que guarda messageIds recentes. Controle de ACK é feito com um `dict()` Python que guarda timestamps do último ACK por telefone. Não há necessidade de Redis para o volume de um trabalho de faculdade.

### Estrutura de módulos

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

## 2. Arquitetura do Frontend (CRM Web)

O frontend é um **CRM Web próprio** (tecnologia a definir — React, Vue, Next.js ou Angular). Ele consome a API FastAPI do backend via HTTP.

### Páginas do CRM

- **Página de Leads**: lista de todos os cards/leads cadastrados no sistema.
- **Página de Detalhes do Card**: visualização e edição dos dados de um lead específico.
- **Kanban (pipeline visual)**: visualização do funil de vendas com cards organizados por fase (drag-and-drop).
- **Formulário Criar Lead**: formulário para criação manual de um novo lead no CRM.

### Camada de comunicação

Todas as páginas usam um **HTTP Client** (fetch nativo ou axios) para fazer requisições ao backend FastAPI. Não há comunicação direta com o banco de dados — tudo passa pela API.

---

## 3. Comunicação entre Frontend e Backend

A comunicação segue o padrão **request-response síncrono via REST**. O frontend faz requisições HTTP para o backend, que processa e retorna JSON.

### Fluxo de uma operação típica

1. O **CRM Web** faz uma requisição HTTP (ex: `POST /cards` com dados do lead).
2. O **FastAPI Backend** recebe a requisição e valida os dados com Pydantic.
3. O endpoint chama o **Serviço CRM** (camada de negócio) internamente.
4. O Serviço CRM executa a operação no **Banco de Dados** (INSERT, UPDATE ou SELECT).
5. O banco retorna os dados ao Serviço CRM.
6. O Serviço CRM retorna o resultado ao endpoint.
7. O FastAPI retorna uma **JSON Response** ao frontend (ex: card criado com seu ID).

### Endpoints REST disponíveis

- `POST /cards` — criar um novo lead/card.
- `PATCH /cards/:id/move` — mover um card para outra fase do pipeline.
- `PATCH /cards/:id/fields` — atualizar campos de um card existente.
- `GET /cards` — listar todos os leads/cards.

---

## 4. Estrutura dos Agentes de IA

O sistema possui dois agentes LangChain que trabalham em conjunto.

### Agente Principal — Caetano

- **Modelo**: OpenAI GPT (gpt-4o-mini).
- **System Prompt**: "Você é Caetano, atendente de vendas. Seja objetivo e cordial."
- **Memória**: ConversationBufferWindowMemory com buffer de 20 mensagens. Mantém o contexto da conversa com cada cliente.
- **Decisão autônoma**: o agente decide sozinho quando chamar cada tool, com base no conteúdo da mensagem do cliente.
- **Saída**: o texto gerado pelo agente é sanitizado (remoção de blocos JSON, links internos, placeholders) antes de ser enviado ao cliente.

### Tool disponível

- **Tool Vendas CRM**: aciona o subagente Gerenciador CRM para executar operações no CRM (criar lead, mover card, atualizar campos).

### Subagente — Gerenciador CRM

Chamado como tool pelo Caetano. Seu fluxo interno é:

1. **Normalizar campos**: limpa e padroniza os dados (telefone só dígitos, sem +55; origem padrão "Whatsapp"; produto mapeado para catálogo fixo; email normalizado; observações limitadas a 240 caracteres).
2. **Validar dados obrigatórios**: verifica se todos os campos necessários estão presentes. Se faltam campos, retorna `VALIDATION_REQUIRED` com a lista de campos faltantes para que o Caetano peça ao cliente.
3. **Resolver IDs**: resolve nomes para IDs internos (nome do pipe → pipe_id, nome da fase → phase_id, label do campo → field_id).
4. **Executar operação**: chama o Serviço CRM para criar, mover ou atualizar o card no banco de dados.

---

## 5. Integração com WhatsApp

A comunicação com o WhatsApp é feita via **Evolution API**, um gateway que conecta o sistema ao WhatsApp.

### Fluxo completo de uma mensagem

1. **Cliente WhatsApp** envia uma mensagem (texto ou áudio).
2. **Evolution API** (porta 8080) recebe a mensagem e faz um `POST` no webhook do backend (`/recebimento-mensagens`).
3. O **FastAPI Backend** normaliza o payload (extrai phone, messageId) e verifica se é mensagem duplicada (via `set()` em memória).
4. **Se for áudio**: o backend faz uma requisição à Evolution API para obter o áudio em Base64, depois envia para o **OpenAI Whisper** que transcreve para texto.
5. **Se for texto**: segue direto.
6. O backend verifica se é primeiro contato (consulta a tabela `cards` no banco — se o telefone não existe, é novo). Se for, envia mensagem de boas-vindas.
7. A mensagem normalizada é enviada ao **Agente Caetano**, que processa e gera uma resposta.
8. O backend faz um `POST /message/sendText/{instance}` na **Evolution API** para enviar a resposta.
9. A **Evolution API** entrega a mensagem ao **cliente no WhatsApp**.

### Endpoints da Evolution API utilizados

- **Webhook de entrada** (Evolution → FastAPI): recebe mensagens do WhatsApp.
- `POST /message/sendText/{instance}`: envia texto para o cliente.
- `POST /chat/getBase64FromMediaMessage/{instance}`: extrai áudio em Base64 para transcrição.

### Autenticação

- Header `apikey: {EVOLUTION_API_KEY}` em todas as requisições para a Evolution API.

---

## 6. Comunicação com Banco de Dados

O sistema utiliza um **único banco de dados relacional** (PostgreSQL ou SQLite) para o CRM, e **memória Python** para controles temporários.

### Serviço CRM → Banco de Dados CRM

O Serviço CRM é a única camada que acessa o banco. Ele executa quatro operações:

- **create_card** (`INSERT`): cria um novo lead na tabela `cards` com os dados coletados pelo agente ou pelo formulário do CRM Web.
- **move_card** (`UPDATE fase`): atualiza a coluna de fase do card quando ele avança no pipeline de vendas.
- **update_card** (`UPDATE campos`): atualiza campos específicos de um card existente (nome, produto, observações, etc.).
- **Buscar card por phone** (`SELECT`): consulta se um telefone já possui um card cadastrado. Usa o índice na coluna `phone` para busca rápida.

### Estrutura do banco

A tabela principal é `cards`, com colunas como: `id`, `phone`, `nome`, `produto`, `fase`, `email`, `origem`, `observacoes`, `created_at`, `updated_at`. A coluna `phone` possui um índice para otimizar buscas — o antigo "Phone Store" é simplesmente um `SELECT` nesta tabela.

### Controles em memória Python (sem Redis)

Para o volume do trabalho de faculdade, não é necessário Redis. Os controles temporários ficam em memória:

- **Deduplicação**: um `set()` Python que armazena os messageIds já processados. Quando chega uma mensagem, verifica se o messageId está no set. Se estiver, ignora (é duplicata). Se não, processa e adiciona ao set.
- **ACK Control**: um `dict()` Python que mapeia telefone → timestamp do último ACK enviado. Antes de enviar um ACK, verifica se já passou tempo suficiente desde o último (60 segundos).

### Saudação via banco de dados

A verificação de primeiro contato é feita consultando a tabela `cards`:

1. Ao receber uma mensagem, o sistema faz `SELECT id FROM cards WHERE phone = '{telefone}'`.
2. Se retornar resultado, o telefone já é conhecido — não envia saudação.
3. Se não retornar resultado, é primeiro contato — envia mensagem de boas-vindas.

---

## 7. Stack tecnológica resumida

- **Backend**: FastAPI + Uvicorn
- **Agente IA**: LangChain + langchain-openai (GPT-4o-mini)
- **Transcrição**: OpenAI Whisper
- **WhatsApp Gateway**: Evolution API
- **Banco de Dados**: PostgreSQL ou SQLite
- **Frontend**: CRM Web próprio (tecnologia a definir)
- **Validação**: Pydantic + pydantic-settings
- **HTTP Client**: httpx (async)

### O que NÃO está na stack (e por quê)

- **Redis**: desnecessário para o volume do projeto. Dedup e ACK ficam em memória Python. Saudação é verificada via banco.
- **Rate Limiting**: não implementado — sem necessidade de controle de flood para um trabalho acadêmico.
- **Workers/Celery**: desnecessário — FastAPI com async/await lida bem com o volume esperado.
- **Pipefy**: substituído pelo CRM próprio com banco de dados relacional.

---

## 8. Pendências e decisões em aberto

- **Tecnologia do frontend**: a definir (React, Vue, Next.js ou Angular).
- **Banco de dados**: a definir entre PostgreSQL e SQLite.
- **Duração real do áudio**: atualmente fixo em 30s — implementar cálculo de duração real se necessário.

---

## 9. Variáveis de ambiente (.env)

```dotenv
# Servidor
HOST=0.0.0.0
PORT=8000

# Evolution API
EVOLUTION_API_URL=http://evolution_api:8080
EVOLUTION_API_KEY=

# OpenAI
OPENAI_API_KEY=

# Banco de Dados
DATABASE_URL=sqlite:///./crm.db

# Controles em memória
ACK_COOLDOWN_SECONDS=60
GREETING_ENABLED=true
```

---

## 10. Dependências Python

```toml
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
