# NexoDoc - Piloto controlado da Montagem de LDs

Este documento prepara a Montagem de LDs para um piloto com 1 usuario real. O objetivo e validar estabilidade operacional antes de liberar o modulo para mais pessoas.

## 1. Ambientes

### Local

Uso: desenvolvimento, ajustes visuais, testes sem custo e validacao com PDFs pequenos.

Configuracao esperada:

- `.env.local` criado a partir de `.env.example`;
- `DATABASE_URL` apontando para um banco de desenvolvimento, quando autosave/historico forem testados;
- chaves de IA somente no backend;
- `NEXODOC_MOCK_MODE=true` quando a intencao for testar sem chamadas pagas de auditoria;
- servidor iniciado com `npm run dev`.

Observacao: a extracao real de selos da LD usa `/api/ld/extract-stamp` e pode chamar OpenAI/MiMo quando as chaves estiverem configuradas. Avise antes de testar com IA real.

### Piloto

Uso: 1 usuario real autenticado, com acompanhamento manual proximo.

Configuracao esperada:

- login Google habilitado;
- `NEXODOC_ADMIN_EMAILS` contendo somente administradores;
- `DATABASE_URL` configurada no backend para persistir rascunhos, historico e eventos;
- `OPENAI_API_KEY`, `NEXODOC_LD_OPENAI_MODEL`, `MIMO_API_KEY` e `MIMO_MODEL` configurados apenas no backend se a leitura real de selos estiver liberada;
- acesso compartilhado somente com o usuario piloto;
- backups/exportacoes do banco avaliados antes de uso continuado.

### Producao

Uso: somente depois do piloto provar estabilidade.

Antes de producao:

- substituir `prisma db push` por migrations versionadas;
- definir se ODTs, PDFs finais, Markdown e ZIPs gerados terao armazenamento protegido;
- manter PDFs anexados fora de qualquer armazenamento permanente;
- revisar limites de upload e timeout do ambiente;
- registrar processo de suporte e incidente;
- validar restauracao de banco e rotacao de chaves.

## 2. DATABASE_URL

`DATABASE_URL` e uma variavel backend-only. Ela nunca deve aparecer no frontend, em prints, logs compartilhados, tickets ou commits.

Formato esperado, sem valores reais:

```bash
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?sslmode=require
```

Recomendacao atual:

- local: banco de desenvolvimento separado;
- piloto: banco dedicado ao piloto;
- producao: banco dedicado a producao, com backup e migracoes controladas.

## 3. Prisma e banco atual

O projeto usa Prisma 7 com PostgreSQL. O schema fica em `prisma/schema.prisma` e o client e gerado por:

```bash
npm run db:generate
```

Comandos atuais:

```bash
npm run db:push
npm run db:migrate
```

Para aplicar a configuracao atual do salvamento de LDs no banco do piloto, rode `npm run db:push` uma vez no ambiente apontando para o banco correto. Essa versao adiciona `uploadedFileCount` e mantem `uploadedFileNames` vazio em novos salvamentos.

Estado recomendado:

- durante MVP/piloto interno: `db:push` ainda e aceitavel para iteracao controlada;
- antes de producao: criar migrations com `prisma migrate dev` em ambiente local controlado e usar `npm run db:migrate` no deploy.

## 4. Tabelas atuais

### Autenticacao

- `User`: usuario autenticado, papel `ADMIN` ou `USER`, status ativo e relacionamento com sessoes/auditorias.
- `Session`: sessao persistida com token hash, usuario e expiracao.

### Auditoria documental

- `Audit`: execucao da Conferencia Documental, com status, modo, nivel, resultado, relatorio estruturado, erro, tempo e totais.
- `AuditFile`: metadados dos arquivos auditados, como nome, tipo, paginas, caracteres e tamanho.
- `AuditFeedback`: avaliacao manual de achados para qualidade, falsos positivos, severidade incorreta e achados ausentes.

### Montagem de LDs

- `LdDraft`: rascunho/historico de LD por e-mail autenticado, com dados da LD, linhas revisadas, tomos, total de referencia, contagem de PDFs processados, nomes de arquivos gerados e status. O campo legado `uploadedFileNames` permanece vazio em novos salvamentos para nao armazenar nomes dos PDFs anexados.
- `LdDraftEvent`: eventos de rastreabilidade da LD, como criacao, atualizacao, geracao, reabertura e arquivamento.

## 5. Limite importante de arquivos

O banco guarda metadados e estado revisado, mas nao guarda PDFs anexados nem binarios permanentes.

Hoje nao ha armazenamento permanente para:

- PDFs originais importados;
- ODT final;
- PDF final;
- Markdown de inconsistencias;
- ZIP final.

Consequencia no piloto: ao reabrir uma LD pelo historico, o usuario consegue recuperar dados, linhas, tomos e a contagem de PDFs processados, mas precisa reenviar os PDFs se quiser reprocessar selos. Isso e uma decisao de privacidade da empresa, nao uma lacuna temporaria.

## 6. Roadmap de privacidade e storage

1. Manter PDFs anexados somente em memoria/sessao do navegador durante o processamento.
2. Persistir no banco apenas `uploadedFileCount`, nunca nomes nem binarios dos PDFs anexados.
3. Exibir no historico que os PDFs nao foram armazenados e precisam ser reenviados para reprocessamento.
4. Se a empresa quiser salvar arquivos finais, escolher provedor privado para ODT/PDF/MD/ZIP gerados, nunca para PDFs anexados.
5. Criar modelo futuro `GeneratedLdFile`, se necessario, com `ownerEmail`, `draftId`, `kind`, `fileName`, `contentType`, `sizeBytes`, `storageKey`, `checksum`, `createdAt`.
6. Servir downloads por rota autenticada, nunca por URL publica fixa.
7. Aplicar expiracao ou arquivamento conforme politica operacional.
8. Registrar logs de download/acesso apenas dos arquivos finais, se esse storage for adotado.

## 7. Checklist do fluxo completo da LD

Para validar antes do piloto:

- importar um PDF unico com varias pranchas;
- importar varios PDFs separados;
- extrair dados da primeira prancha;
- conferir origem dos campos da LD: IA, padrao do sistema, manual ou historico;
- analisar todas as pranchas;
- revisar erros bloqueantes e alertas;
- definir total de referencia quando houver divergencia;
- ajustar quantidade e intervalo dos tomos;
- revisar resumo final;
- gerar arquivos finais;
- baixar ODT, PDF, Markdown quando existir, e ZIP;
- abrir `/ld/historico`;
- reabrir a LD;
- confirmar que dados, linhas, tomos e eventos voltam do historico;
- confirmar que o historico mostra somente a contagem de PDFs processados, sem nomes dos anexos;
- confirmar que PDFs originais precisam ser reenviados para reprocessamento.

## 8. Checklist para o usuario piloto

O usuario piloto pode testar:

- montar uma LD real com PDFs de pranchas;
- corrigir campos lidos automaticamente;
- marcar alertas como revisados;
- ajustar tomos;
- gerar e baixar arquivos finais;
- fechar a tela e continuar depois pelo historico.

O usuario deve conferir manualmente:

- orgao/cliente, nome da obra, fase e codigo do projeto;
- numero da folha em todas as linhas;
- nome do arquivo em todas as linhas;
- descricao copiada do campo conteudo;
- folhas faltantes e duplicadas;
- divisao de tomos;
- abertura do ODT no LibreOffice;
- PDF final e ZIP final.

Como reportar erro:

- informar data e horario aproximados;
- informar e-mail usado no login;
- enviar nome da LD/projeto;
- descrever etapa onde ocorreu;
- anexar print da tela sem chaves, tokens ou `DATABASE_URL`;
- informar se houve chamada real de IA ou somente teste visual/manual.

Limitacoes atuais:

- nao ha armazenamento permanente dos PDFs anexados nem dos arquivos finais;
- reprocessamento exige reenviar PDFs;
- leitura de selos pode consumir IA quando chaves estiverem ativas;
- OCR de PDF escaneado ainda nao e uma garantia operacional;
- liberacao ampla ainda nao esta autorizada.

## 9. Criterios para liberar mais usuarios

Liberar para mais usuarios somente quando:

- o piloto gerar LDs reais sem perda de rascunho por pelo menos uma semana de uso;
- admins conseguirem adicionar, promover e desativar usuarios por `/admin/users`;
- os arquivos finais forem conferidos manualmente e considerados utilizaveis;
- erros recorrentes tiverem correcao ou procedimento documentado;
- migrations estiverem preparadas para producao;
- storage protegido estiver implementado ou a limitacao estiver formalmente aceita;
- houver criterio de suporte, rollback e rotacao de chaves;
- administradores conseguirem acompanhar `/admin/lds` sem expor dados sensiveis.
