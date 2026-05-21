# NexoDoc - Arquitetura tecnica

## 1. Stack

A stack definida para o NexoDoc e:

- Next.js com App Router;
- TypeScript;
- Tailwind CSS;
- shadcn/ui;
- OpenAI API;
- Vercel.

## 2. Visao geral da arquitetura

O NexoDoc deve usar uma arquitetura simples, com frontend e backend no mesmo projeto Next.js.

```text
Frontend Next.js
  envia mensagem e PDFs via FormData
Backend Next.js em /api/audit
  valida arquivos
  aplica prompt fixo do agente auditor
  chama OpenAI API
  retorna JSON
Frontend Next.js
  renderiza resposta no chat
```

## 3. Regra de seguranca principal

A chave da OpenAI deve ficar somente no backend.

Correto:

```text
Frontend -> /api/audit -> OpenAI API
```

Incorreto:

```text
Frontend -> OpenAI API
```

A variavel `OPENAI_API_KEY` deve ser lida apenas no ambiente de servidor.

## 4. Estrutura recomendada

Estrutura inicial prevista:

```text
nexodoc/
├─ app/
│  ├─ api/
│  │  └─ audit/
│  │     └─ route.ts
│  ├─ page.tsx
│  ├─ layout.tsx
│  └─ globals.css
├─ components/
│  ├─ chat-window.tsx
│  ├─ composer.tsx
│  ├─ file-upload.tsx
│  ├─ message-bubble.tsx
│  ├─ attached-files.tsx
│  └─ audit-result-actions.tsx
├─ lib/
│  ├─ auditor-prompt.ts
│  └─ openai.ts
├─ docs/
│  ├─ 01-visao-geral.md
│  ├─ 02-escopo-mvp.md
│  ├─ 03-agente-auditor.md
│  ├─ 04-arquitetura-tecnica.md
│  ├─ 05-interface-ui.md
│  └─ 06-roadmap.md
├─ .env.local
├─ package.json
└─ README.md
```

Esta estrutura ainda nao deve ser implementada nesta etapa. Ela serve como referencia para a fase de codificacao.

## 5. Rota de auditoria

A rota prevista para a versao 0.1 e:

```text
POST /api/audit
```

Responsabilidades da rota:

- receber `FormData`;
- ler mensagem do usuario;
- receber multiplos PDFs;
- validar se todos os arquivos sao PDFs;
- validar limite de tamanho por arquivo;
- aplicar o prompt fixo do agente auditor;
- enviar arquivos e mensagem para a OpenAI API;
- retornar JSON com a resposta;
- retornar erros claros para o frontend.

## 6. Contrato inicial de entrada

Entrada esperada:

```text
message: string
auditMode: "fast" | "complete"
files: File[]
```

Regras:

- `message` deve ser texto;
- `auditMode` deve indicar auditoria rapida ou completa;
- `files` deve conter pelo menos um PDF;
- todos os arquivos devem ter tipo PDF;
- cada arquivo deve respeitar o limite de 25 MB;
- a quantidade maxima inicial recomendada e 5 PDFs.

## 7. Contrato inicial de saida

Resposta de sucesso:

```json
{
  "result": "texto padronizado do agente",
  "auditMode": "fast"
}
```

Resposta de erro:

```json
{
  "error": "mensagem objetiva de erro"
}
```

## 8. Estado e persistencia

Na versao 0.1, o NexoDoc nao deve usar banco de dados.

O estado deve existir apenas em memoria no frontend durante a sessao aberta:

- arquivos anexados;
- mensagem atual;
- resposta recebida;
- estado de carregamento;
- erro atual.

Ao atualizar a pagina, o historico pode ser perdido.

## 9. Deploy

O deploy previsto e na Vercel.

Requisitos para deploy:

- configurar `OPENAI_API_KEY` como variavel de ambiente;
- garantir que a chave nao seja exposta ao cliente;
- validar limites de upload conforme suporte do ambiente;
- testar a rota `/api/audit` com PDFs reais de tamanho pequeno e medio.
