# Execucao do checklist - Banco piloto para LDs

Data da execucao: 2026-05-28

Este relatorio registra o que foi validado automaticamente e o que ainda precisa de conferencia manual. Nenhum valor de `DATABASE_URL`, chave ou token foi registrado aqui.

## Itens executados

- [x] `.env.local` existe.
- [x] `DATABASE_URL` esta configurada.
- [x] `AUTH_SECRET`, `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` estao configurados.
- [x] `npm run db:push` executado com sucesso no banco configurado.
- [x] `npm run db:generate` executado com sucesso.
- [x] `LdDraft` possui `uploadedFileCount`.
- [x] `LdDraft` possui o campo legado `uploadedFileNames`.
- [x] Banco respondeu consulta de schema.
- [x] Banco possui tabela `LdDraftEvent`.
- [x] `npm run lint` passou.
- [x] `npm run build` passou.
- [x] `/ld` redireciona para `/login` sem sessao.
- [x] `/ld/historico` redireciona para `/login` sem sessao.
- [x] `/api/ld/drafts` retorna 401 sem sessao autenticada.

## Estado observado no banco

- Colunas confirmadas em `LdDraft`: `uploadedFileCount`, `uploadedFileNames`.
- Quantidade atual de rascunhos LD: 1.
- Quantidade atual de eventos LD: 17.

Essas contagens servem apenas para confirmar conectividade e estrutura. O conteudo dos registros nao foi impresso.

## Pendencias manuais

- [ ] Configurar `NEXODOC_ADMIN_TOKEN` no ambiente local/piloto, se o painel `/admin/lds` for usado.
- [ ] Entrar no app com Google.
- [ ] Abrir `/ld`.
- [ ] Importar um conjunto pequeno de PDFs.
- [ ] Aguardar autosave.
- [ ] Abrir `/ld/historico`.
- [ ] Reabrir a LD.
- [ ] Confirmar visualmente que dados, linhas e tomos voltam.
- [ ] Confirmar visualmente que PDFs originais nao voltam e precisam ser reenviados para reprocessamento.
- [ ] Conferir no banco, no registro novo, que `uploadedFileCount` tem a contagem correta.
- [ ] Conferir no banco, no registro novo, que `uploadedFileNames` esta `[]`.
- [ ] Testar duplicacao de LD e confirmar que nomes de PDFs nao aparecem.
- [ ] Testar arquivamento de LD.

## Comandos usados

```bash
npm run db:push
npm run db:generate
npm run lint
npm run build
```

## Observacoes

O build passou com dois warnings ja conhecidos:

- `pdfjs-dist` worker ESM sinalizado pelo Turbopack;
- tracing amplo a partir de `lib/audit-learnings.ts`.

Nenhum desses warnings bloqueou o build.
