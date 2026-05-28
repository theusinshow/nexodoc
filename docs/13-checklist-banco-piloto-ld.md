# Checklist - Banco piloto para LDs

Use este checklist para configurar e validar o banco piloto da Montagem de LDs.

Regra principal: PDFs anexados nao devem ser salvos. O banco deve guardar apenas dados da LD, linhas revisadas, tomos, eventos, arquivos finais gerados e a contagem de PDFs processados.

## 1. Preparar banco

- [ ] Criar um banco Postgres separado para o piloto.
- [ ] Confirmar que ele nao e o banco local antigo nem um banco de producao.
- [ ] Copiar a connection string com cuidado, sem compartilhar em chat, print ou commit.
- [ ] Configurar `DATABASE_URL` somente no backend.
- [ ] Conferir que `.env.local` continua fora do Git.

## 2. Aplicar schema

No projeto:

```bash
npm run db:push
```

Depois:

```bash
npm run db:generate
```

Validar:

- [ ] Comando terminou sem erro.
- [ ] Tabela `LdDraft` existe.
- [ ] Campo `uploadedFileCount` existe.
- [ ] Campo legado `uploadedFileNames` existe, mas novos salvamentos devem ficar com `[]`.
- [ ] Tabela `LdDraftEvent` existe.

## 3. Rodar app local

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000/ld
```

Validar:

- [ ] Login funciona.
- [ ] `/ld` abre para usuario autenticado.
- [ ] Autosave nao mostra erro de `DATABASE_URL`.
- [ ] `/ld/historico` abre.

## 4. Testar autosave da LD

No modulo `/ld`:

- [ ] Importar 1 PDF ou um conjunto pequeno de PDFs.
- [ ] Conferir a primeira prancha.
- [ ] Preencher/corrigir dados obrigatorios.
- [ ] Analisar todas as pranchas somente se estiver autorizado a consumir IA.
- [ ] Revisar pendencias.
- [ ] Ajustar tomos.
- [ ] Aguardar indicador de autosave salvo.
- [ ] Abrir `/ld/historico`.
- [ ] Confirmar que a LD aparece no historico.

## 5. Validar privacidade no banco

No registro salvo em `LdDraft`:

- [ ] `ldData` contem os dados revisados da LD.
- [ ] `rows` contem as linhas revisadas.
- [ ] `tomos` contem a divisao de tomos.
- [ ] `uploadedFileCount` contem a quantidade correta de PDFs processados.
- [ ] `uploadedFileNames` esta vazio (`[]`) em novo salvamento.
- [ ] Nenhum PDF, imagem de selo, ODT, PDF final ou ZIP foi salvo no banco.
- [ ] Eventos foram criados em `LdDraftEvent`.

## 6. Testar reabertura

Em `/ld/historico`:

- [ ] Clicar em continuar/reabrir a LD.
- [ ] Confirmar que dados da LD voltam.
- [ ] Confirmar que linhas revisadas voltam.
- [ ] Confirmar que tomos voltam.
- [ ] Confirmar que os PDFs originais nao voltam.
- [ ] Confirmar que a interface informa que PDFs precisam ser reenviados para reprocessamento.

## 7. Testar duplicacao e arquivamento

- [ ] Duplicar uma LD.
- [ ] Confirmar que a copia nao salva nomes dos PDFs.
- [ ] Confirmar que a copia preserva `uploadedFileCount`.
- [ ] Arquivar uma LD.
- [ ] Confirmar que ela sai da lista principal, mas aparece no historico completo quando arquivadas estiverem incluidas.

## 8. Checklist antes do piloto real

- [ ] `npm run lint` passa.
- [ ] `npm run build` passa.
- [ ] Banco piloto tem backup habilitado.
- [ ] Usuario piloto esta definido.
- [ ] Administrador consegue abrir `/admin/lds`.
- [ ] Usuario piloto sabe que PDFs nao sao armazenados.
- [ ] Usuario piloto sabe como reportar erro: data, horario, projeto, etapa e print sem chaves/tokens.

## Resultado esperado

Ao fim da validacao, o NexoDoc deve:

- salvar e reabrir rascunhos de LD;
- preservar linhas, tomos e dados revisados;
- registrar eventos de historico;
- mostrar a contagem de PDFs processados;
- nao salvar nomes nem conteudo dos PDFs anexados.
