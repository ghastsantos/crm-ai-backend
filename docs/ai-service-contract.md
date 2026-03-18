# Contrato da API do Serviço de IA

Este documento descreve o contrato REST esperado pelo backend principal ao consumir o serviço de IA (projeto separado).

## Visão geral

- **Stack do serviço de IA:** Python, FastAPI, OpenAI/LangChain
- **Comunicação:** REST/JSON
- **URL base:** Configurável via `AI_SERVICE_URL` no .env do backend

## Endpoints esperados

### Health check

```
GET /health
```

**Resposta esperada (200):**
```json
{
  "status": "ok"
}
```

### Análise (exemplo - ajustar conforme domínio)

```
POST /analyze
Content-Type: application/json
```

**Request (exemplo):**
```json
{
  "text": "Texto para análise",
  "context": {}
}
```

**Response (200):**
```json
{
  "result": "...",
  "metadata": {}
}
```

## Observações

- O backend principal atua como orquestrador e chama o serviço de IA quando necessário
- Em caso de falha ou indisponibilidade do serviço de IA, o backend deve tratar graciosamente (retry, fallback ou erro informativo)
- Autenticação entre backend e serviço de IA: definir quando implementar (API key, JWT, etc.)

## Evolução

Este contrato deve ser mantido em sincronia com a implementação do serviço de IA. Atualizar este documento quando novos endpoints forem adicionados ou payloads alterados.
