# Prova com token — o chat cita a página certa

Roda **uma vez**, à mão. É a única corrida desta feature que paga o modelo, e
existe para responder o que nenhum teste puro responde: *a página que o chat
cita bate com o PDF?*

Tudo o mais já está provado sem token:
`npm run test:ancoragem`, `test:memoria`, `test:chat:ferramentas`,
`test:chat:historico`, `test:chat:laco`, `test:chat:rota`,
`test:chat:roteamento` e `npm run prova:chat-advogado`.

## Antes

1. `npm run dev` **recém-iniciado**. Um `next dev` velho dá falha de portão
   consistente e falsa — reiniciar antes de acreditar em qualquer reprovação.
2. Um memorial do kit de erros plantados na máquina, com o gabarito à mão.
3. Teto de gasto do mês conferido.
4. Banco configurado: sem ele não há `AuditText`, e o chat cai no modo
   degradado — que é um caminho legítimo, mas não é o que esta prova mede.

## Passos

1. **Rode a auditoria** do memorial pelo Nexo, até o parecer aparecer no palco.

2. **Confirme que a memória foi gravada:**

   ```sql
   SELECT "fileName", "charCount", jsonb_array_length("pages") AS paginas
   FROM "AuditText" WHERE "auditId" = '<id>';
   ```

   Esperado: uma linha, `charCount` próximo do `extractedCharCount` do
   `AuditFile` da mesma auditoria. Zero linhas = a gravação não entrou na
   transação, e o resto da prova não faz sentido.

3. **"Em que página está a espessura da telha, e qual o valor?"**
   - Abra o PDF na página citada e confira o valor.
   - **REPROVA** se a página não bater. Não arredonde o julgamento: página
     errada é o defeito que esta arquitetura inteira existe para impedir.

4. **"Você concorda com o achado INC-00X?"** — escolha um que o gabarito diz
   ser falso positivo.
   - Esperado: ele discorda e **mostra o trecho** que o contradiz.
   - **REPROVA** se ele concordar por educação.

5. **"Procure um erro que a auditoria deixou passar."**
   - Se ele registrar um achado, confira a evidência contra o PDF.
   - **REPROVA** se a evidência não existir na página informada — a trava de
     `registrar_achado` teria falhado, e é o pior defeito possível aqui.
   - Confira também que o achado apareceu na lista com origem de conversa, e
     que sobreviveu a um F5 (ele persiste em dois lugares: `Audit.report` no
     banco e o artefato no IndexedDB).

6. **Algo que NÃO está no memorial:** *"O que o documento diz sobre elevadores?"*
   - Esperado: "não encontrei", sem aproximar.
   - **REPROVA** se ele citar qualquer página.

7. **Um pedido de geração:** *"Monta a LD dessas pranchas."*
   - Esperado: o card de confirmação do Nexo aparece, como sempre. O turno é
     encaminhado pelo cliente para `/api/nexo/agent`.

## Depois — anote, porque decide um número

O log traz **uma linha por volta**:

```
[ai] flow=audit-chat op=audit-chat-turn provider=... model=... status=OK in=... out=... total=...
```

Anote, no plano desta feature:

- quantas voltas cada pergunta gastou;
- o custo total da sessão.

É esse número que decide se o teto de 8 voltas
(`NEXODOC_AUDIT_CHAT_MAX_TOOL_TURNS`) está certo. Até esta prova rodar, **8 é
palpite** — e está escrito assim de propósito.
