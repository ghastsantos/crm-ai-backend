---
name: add-swagger-docs
description: Adiciona anotações JSDoc OpenAPI em endpoints. Use ao criar novos endpoints.
---

# Documentação Swagger

## Formato JSDoc

Adicione acima de cada rota ou handler:

```javascript
/**
 * @openapi
 * /api/v1/recurso:
 *   get:
 *     summary: Descrição curta
 *     description: Descrição detalhada
 *     tags: [NomeDoTag]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sucesso
 *       400:
 *         description: Requisição inválida
 */
```

## Tags

Agrupe por domínio: `[Health]`, `[Test]`, `[Contacts]`, etc.

## Exemplos por método

**GET (listagem):**
- parameters: query (page, limit, search)
- responses: 200 com array

**GET/:id:**
- parameters: path (id)
- responses: 200, 404

**POST:**
- requestBody com schema
- responses: 201, 400

**PUT/:id, DELETE/:id:**
- parameters: path (id)
- responses: 200, 404

## Referência

Ver `src/modules/health/health.routes.ts` e `src/modules/test/test.routes.ts` para exemplos.
