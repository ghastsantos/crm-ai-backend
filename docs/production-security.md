# Segurança em produção

Este documento complementa a configuração da aplicação Node (Helmet, CORS, cookies, validação de origem). Em produção, o ideal é reforçar políticas no **reverse proxy** (Nginx, Traefik, Cloudflare, etc.).

## Por que reforçar no proxy

- O backend expõe Swagger (`/api-docs`) com CSP desativada no Helmet para o UI funcionar; o proxy pode aplicar CSP mais estrita em rotas públicas estáticas.
- Cabeçalhos como `Strict-Transport-Security` e `Permissions-Policy` são bem colocados na borda.

## Exemplo Nginx (referência)

Ajuste `server_name`, caminhos e `upstream` ao teu ambiente.

```nginx
upstream crm_api {
    server 127.0.0.1:3000;
}

server {
    listen 443 ssl http2;
    server_name api.exemplo.com;

    # ssl_certificate / ssl_certificate_key ...

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    location /api-docs {
        # Opcional: desativar documentação em produção (API_DOCS_ENABLED=false / remoção de rota)
        # ou aplicar CSP mais permissiva só aqui se necessário
        proxy_pass http://crm_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://crm_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Com proxy na frente, define `TRUST_PROXY_HOPS=1` (ou o número de proxies) no `.env` da API para o rate limit e logs usarem o IP real.

## Cookies e CSRF

- Com `AUTH_HTTPONLY_COOKIE_ENABLED`, o JWT é enviado em cookie `httpOnly`. Para não expor o token no JSON, usa `AUTH_TOKEN_IN_BODY=false`.
- Com SPA e API no **mesmo site** (ou proxy que sirva a API sob o mesmo host), `AUTH_COOKIE_SAME_SITE=lax` costuma ser suficiente para pedidos `fetch` com `credentials: 'include'`.
- API e SPA em **subdomínios diferentes** em HTTPS podem precisar de `AUTH_COOKIE_SAME_SITE=none` (o cookie será `Secure`). Nesse cenário, ativa `AUTH_ENFORCE_ORIGIN_ON_MUTATIONS=true` e garante que o browser envia o header `Origin` alinhado a `CORS_ORIGINS`.
- Pedidos JSON com `Content-Type: application/json` já reduzem CSRF clássico por formulário HTML; a verificação de `Origin` é camada extra quando usas cookies.

## Checklist rápido

- [ ] `JWT_SECRET` forte (32+ caracteres) e rotação planead
- [ ] `API_DOCS_ENABLED=false` se não precisares de Swagger público
- [ ] `CORS_ORIGINS` apenas origens reais (sem `*`)
- [ ] `TRUST_PROXY_HOPS` correto atrás do proxy
- [ ] HTTPS em produção; cookies `Secure` quando aplicável
