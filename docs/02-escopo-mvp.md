# NexoDoc - Escopo do MVP

## 1. Objetivo da versao 0.1

A versao 0.1 do NexoDoc deve validar o fluxo essencial:

```text
Abrir uma pagina unica, anexar PDFs, enviar uma mensagem e receber uma analise documental padronizada na tela.
```

O MVP deve ser pequeno, funcional e direto. O objetivo nao e criar um sistema completo, mas provar que a experiencia central funciona.

## 2. Funcionalidades incluidas

O MVP deve incluir:

- pagina unica;
- interface estilo chat;
- upload multiplo de PDFs;
- visualizacao dos arquivos anexados antes do envio;
- remocao de arquivos anexados antes do envio;
- campo de mensagem do usuario;
- botao para auditar documentos;
- envio da mensagem e dos PDFs para o backend;
- chamada da OpenAI API pelo backend;
- uso de prompt fixo do agente auditor;
- resposta padronizada exibida na tela;
- botao para copiar a resposta;
- tratamento simples de carregamento e erro.

## 3. Funcionalidades fora do escopo

O MVP nao deve incluir:

- login;
- cadastro de usuarios;
- banco de dados;
- historico persistente;
- painel administrativo;
- exportacao PDF;
- exportacao DOCX;
- dashboard;
- sistema de planos;
- controle financeiro por usuario;
- cache de documentos;
- comparacao entre versoes;
- gestao de projetos salvos;
- edicao do prompt pela interface.

## 4. Limites iniciais

Para manter a versao 0.1 simples, os limites iniciais recomendados sao:

- aceitar apenas arquivos PDF;
- permitir no maximo 5 PDFs por analise;
- limitar cada arquivo a 25 MB;
- nao salvar arquivos apos a analise;
- nao salvar conversa apos atualizar ou fechar a pagina;
- retornar uma unica analise por envio.

## 5. Entrada do usuario

O usuario deve fornecer:

- um ou mais PDFs;
- uma mensagem curta orientando a analise.

Exemplos de mensagens:

```text
Confira a consistencia documental entre memorial e pranchas.
```

```text
Verifique se nome da obra, numero do projeto, bairro, municipio, volume e identificacao das pranchas estao coerentes.
```

## 6. Saida esperada

A resposta do agente deve seguir sempre a estrutura:

```text
1. Projeto analisado
2. Status geral
3. Memorial
4. Pranchas
5. Incongruências relevantes encontradas
6. Conclusão objetiva
```

As classificacoes permitidas sao apenas:

- sem incongruência relevante;
- com ponto de atenção;
- com incongruência relevante.

## 7. Criterios de aceite do MVP

O MVP sera considerado pronto quando:

- a pagina unica permitir anexar multiplos PDFs;
- o usuario conseguir remover arquivos antes do envio;
- a mensagem e os arquivos forem enviados ao backend por FormData;
- a OpenAI API for chamada apenas pelo backend;
- a chave `OPENAI_API_KEY` nao aparecer no frontend;
- a resposta do agente for exibida no chat;
- a resposta seguir a estrutura obrigatoria;
- a aplicacao funcionar localmente;
- o projeto estiver preparado para deploy na Vercel.
