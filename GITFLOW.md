# Gitflow do Projeto — Caetano IA WhatsApp + CRM

> Regras simples para o time de 3-4 pessoas. Sem burocracia, mas com organização.

---

## Branches

O projeto tem **3 tipos de branch**:

- `main` — código estável, sempre funcionando. Só recebe merges de PRs aprovados.
- `develop` — branch de integração. Todo mundo mergea aqui antes de ir pra main.
- `feature/*`, `fix/*`, `docs/*` — branches de trabalho, criadas a partir da `develop`.

### Nomeação de branches

O padrão é `tipo/descricao-curta`. Sempre em minúsculas, palavras separadas por hífen.

Exemplos:

- `feature/webhook-whatsapp`
- `feature/endpoint-criar-card`
- `feature/agente-caetano`
- `fix/dedup-mensagem-duplicada`
- `docs/atualizar-readme`

---

## Padrão de commits

Usamos **Conventional Commits** simplificado. O formato é:

```
tipo: descrição curta do que foi feito
```

### Tipos permitidos

- `feat:` — funcionalidade nova (ex: `feat: criar endpoint POST /cards`)
- `fix:` — correção de bug (ex: `fix: corrigir normalização de telefone`)
- `refactor:` — refatoração sem mudar comportamento (ex: `refactor: extrair lógica de dedup para módulo separado`)
- `docs:` — documentação (ex: `docs: adicionar README do projeto`)
- `test:` — testes (ex: `test: adicionar testes do crm_service`)
- `chore:` — tarefas de manutenção (ex: `chore: atualizar dependências`)

### Regras

- Escrever em português, no infinitivo (ex: "criar", "corrigir", "adicionar").
- Descrição curta e direta, sem ponto final.
- Máximo ~72 caracteres na primeira linha.

### Exemplos bons e ruins

```
✅ feat: criar endpoint de listagem de cards
✅ fix: corrigir envio de saudação duplicada
✅ refactor: separar lógica do agente em módulo próprio

❌ update (vago demais)
❌ feat: Criando o endpoint de listagem de cards. (gerúndio + ponto)
❌ arrumei o bug do telefone (sem tipo, informal)
```

---

## Fluxo de trabalho

### 1. Pegar uma tarefa

Cada pessoa pega uma tarefa e cria uma branch a partir da `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nome-da-tarefa
```

### 2. Desenvolver e commitar

Trabalha na branch, fazendo commits pequenos e frequentes:

```bash
git add .
git commit -m "feat: criar modelo pydantic do card"
git commit -m "feat: implementar crm_service.create_card"
git commit -m "test: adicionar teste de criação de card"
```

### 3. Subir e abrir PR

Quando terminar, sobe a branch e abre um Pull Request para `develop`:

```bash
git push origin feature/nome-da-tarefa
```

Depois abre o PR no GitHub apontando para `develop`.

### 4. Code review

Pelo menos **1 pessoa** do time precisa revisar e aprovar o PR. O revisor verifica:

- O código funciona?
- Segue as regras de código do CLAUDE.md?
- Tem type hints?
- Nomes estão descritivos?

### 5. Merge na develop

Após aprovação, o autor do PR faz o merge (botão "Merge pull request" no GitHub). Depois deleta a branch.

### 6. Merge na main

Quando a `develop` estiver estável e com funcionalidades completas, um membro do time abre um PR de `develop → main` e o time aprova juntos.

---

## Regras de merge

- **Nunca commitar direto na `main`** — só via PR aprovado.
- **Nunca commitar direto na `develop`** — só via PR de feature/fix/docs.
- **Mínimo 1 aprovação** em todo PR antes de mergear.
- **Resolver conflitos na branch de feature**, não na develop.
- **Deletar a branch** após o merge do PR.
- **Não mergear código quebrado** — se não funciona, não mergea.

---

## Resumo visual do fluxo

```
main ─────────────────────────────────────── ← (PR aprovado)
  │                                            │
  └── develop ────────────────────────────── merge ←
        │         │         │
        │         │         └── feature/endpoint-cards ── commits ── PR → develop
        │         └── feature/agente-caetano ── commits ── PR → develop
        └── feature/webhook-whatsapp ── commits ── PR → develop
```

---

## Checklist rápido

Antes de abrir um PR, verifique:

- [ ] Branch criada a partir da `develop` atualizada?
- [ ] Commits seguem o padrão `tipo: descrição`?
- [ ] Código tem type hints?
- [ ] Nenhuma credencial hardcoded ou `.env` no commit?
- [ ] Código roda sem erros?
- [ ] PR aponta para `develop` (não para `main`)?
