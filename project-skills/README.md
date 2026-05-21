# Project Skills

Esta pasta serve para armazenar skills, prompts, referencias e fluxos auxiliares que podem orientar o desenvolvimento do NexoDoc.

Importante: colocar uma skill aqui nao instala automaticamente a skill no Codex.

Use esta pasta para:

- guardar skills baixadas de outros repositorios;
- manter prompts especializados;
- comparar instrucoes antes de incorporar ao projeto;
- documentar referencias de UI/UX, auditoria documental, PDF, engenharia e produto.

## Estrutura sugerida

```text
project-skills/
├─ README.md
├─ ui-ux/
├─ pdf/
├─ audit-agent/
└─ product/
```

## Como usar

1. Crie uma subpasta para cada skill ou conjunto de instrucoes.
2. Inclua um `SKILL.md` quando a pasta vier no formato de skill do Codex.
3. Inclua um `README.md` quando for apenas uma referencia.
4. Avise o nome da pasta que deseja usar no projeto.

Exemplo:

```text
project-skills/ui-ux-pro-max/SKILL.md
```

Depois de adicionar uma pasta, peça:

```text
Leia project-skills/ui-ux-pro-max/SKILL.md e use como referencia para melhorar a UI do NexoDoc.
```

