# Instrucoes locais do Codex - NexoDoc

Estas instrucoes orientam o trabalho no projeto NexoDoc.

## 1. Contexto do projeto

NexoDoc e uma aplicacao web estilo chat para auditoria documental de projetos de engenharia civil.

O foco do MVP e:

- pagina unica;
- chat;
- upload multiplo de PDFs;
- auditoria documental via backend;
- resposta estruturada;
- sem login;
- sem banco de dados;
- sem historico persistente;
- sem exportacao PDF/DOCX nesta fase.

## 2. Fonte de verdade

Antes de tomar decisoes relevantes, consultar:

- `docs/NexoDoc_contexto_principal.md`;
- `docs/01-visao-geral.md`;
- `docs/02-escopo-mvp.md`;
- `docs/03-agente-auditor.md`;
- `docs/04-arquitetura-tecnica.md`;
- `docs/08-saida-estruturada.md`;
- `docs/09-design-system.md`.

## 3. Regras de produto

- Manter o nome NexoDoc.
- Nao usar EngCheck.
- Preservar o fluxo em formato de chat.
- Nao substituir a tela principal por landing page ou dashboard isolado.
- Manter o usuario no fluxo: anexar PDFs, escolher modo, enviar mensagem, acompanhar progresso e ler resultado.
- Evitar linguagem comercial exagerada.
- Priorizar interface tecnica, direta e profissional.

## 4. Regras tecnicas

Stack definida:

- Next.js;
- TypeScript;
- Tailwind CSS;
- shadcn/ui;
- OpenAI API;
- Vercel.

Regras:

- A chave `OPENAI_API_KEY` deve ficar apenas no backend.
- O frontend nunca deve chamar a OpenAI diretamente.
- A rota principal de auditoria e `POST /api/audit`.
- Usar `FormData` para mensagem, modo e arquivos.
- Manter validacao de PDFs no frontend e backend.
- Manter modo mock para testes sem custo.

## 5. Modo mock

Para testar UI sem consumir tokens:

```bash
NEXODOC_MOCK_MODE=true
```

Para usar API real:

```bash
NEXODOC_MOCK_MODE=false
```

Sempre que a tarefa for visual, UX ou layout, preferir testar primeiro com mock.

## 6. Changelog

Toda mudanca relevante deve atualizar `CHANGELOG.md`.

Registrar no changelog:

- nova funcionalidade;
- alteracao de comportamento;
- ajuste de UX relevante;
- mudanca em prompt;
- nova documentacao importante;
- correcoes que afetam usuario;
- mudancas em configuracao.

Formato recomendado:

```text
### Adicionado
- ...

### Alterado
- ...

### Corrigido
- ...
```

Se a mudanca for pequena e ja houver a secao `[Nao lancado]`, adicionar item objetivo nessa secao.

## 7. Documentacao

Quando criar ou alterar comportamento importante, atualizar tambem a documentacao relacionada em `docs/`.

Exemplos:

- mudancas de agente: `docs/03-agente-auditor.md`;
- mudancas de arquitetura: `docs/04-arquitetura-tecnica.md`;
- mudancas de interface: `docs/05-interface-ui.md`;
- mudancas de saida: `docs/08-saida-estruturada.md`;
- mudancas visuais: `docs/09-design-system.md`.

## 8. Git

Regras:

- Fazer commits pequenos e objetivos.
- Usar mensagens em portugues ou ingles consistente com o historico.
- Preferir prefixos:
  - `feat:`
  - `fix:`
  - `docs:`
  - `chore:`
  - `refactor:`
- Antes de commit, rodar quando aplicavel:

```bash
npm run lint
npm run build
```

## 9. Skills do projeto

Skills e referencias locais podem ser colocadas em:

```text
.codex/skills/
project-skills/
```

Use `.codex/skills/` para skills que o usuario queira manter junto da configuracao local do Codex.

Use `project-skills/` para referencias, prompts e materiais auxiliares do produto.

Ao usar uma skill local, ler primeiro o `SKILL.md` correspondente e aplicar apenas o que fizer sentido ao NexoDoc.

## 10. Design system

O design system deve reforcar:

- clareza;
- densidade moderada;
- leitura rapida;
- evidencias documentais;
- status bem destacado;
- chat como fluxo principal.

Nao remover:

- composer;
- upload;
- chat;
- resposta estruturada;
- historico em memoria da sessao.

