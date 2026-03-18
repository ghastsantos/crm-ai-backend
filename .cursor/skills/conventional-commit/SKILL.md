---
name: conventional-commit
description: Gera mensagens de commit no padrão Conventional Commits. Use ao criar commits, revisar PRs ou quando o usuário pedir mensagem de commit.
---

# Conventional Commit

## Formato

```
tipo(escopo): descrição curta

[corpo opcional]

[rodapé opcional]
```

## Tipos

- `feat`: nova funcionalidade
- `fix`: correção de bug
- `docs`: documentação
- `style`: formatação (sem mudança de código)
- `refactor`: refatoração
- `test`: testes
- `chore`: manutenção (deps, config)

## Escopo

Use o nome do módulo ou área afetada: `contacts`, `auth`, `health`, `prisma`, etc.

## Exemplos

```
feat(contacts): adiciona endpoint de listagem com paginação
fix(health): corrige verificação de conectividade do banco
docs(readme): atualiza instruções de setup
refactor(modules): extrai validação Zod para shared
test(integration): adiciona testes para CRUD de clientes
```

## Regras

- Descrição em imperativo: "adiciona" não "adicionado"
- Primeira linha com até 72 caracteres
- Corpo e rodapé separados por linha em branco
