# NexoDoc — Contexto para continuar em outro chat

## 1. Ideia principal

Quero criar um aplicativo chamado **NexoDoc**.

O objetivo é ter uma aplicação web parecida com o ChatGPT, mas com visual próprio e foco em auditoria documental de projetos de engenharia civil.

A ideia não é treinar um modelo novo nem criar uma IA do zero. Quero criar uma interface própria, estilo chat, usando o motor da OpenAI/GPT por trás para interpretar PDFs, memoriais, pranchas e documentos técnicos.

Fluxo desejado:

```text
Usuário acessa o app
↓
Anexa PDFs de memorial, pranchas, capas, LD etc.
↓
Escreve uma solicitação no chat
↓
O backend envia os arquivos para a OpenAI API
↓
O modelo interpreta os documentos usando um prompt fixo de auditoria documental
↓
A resposta aparece no chat
```

---

## 2. Nome escolhido

Nome escolhido para o projeto:

```text
NexoDoc
```

Subtítulo sugerido:

```text
Auditoria documental para projetos de engenharia
```

Outra opção de subtítulo:

```text
Conferência documental para memoriais, pranchas e documentos técnicos
```

Motivos para o nome:

- curto;
- fácil de lembrar;
- remete diretamente a engenharia;
- tem cara de ferramenta/software;
- não limita o sistema apenas a pranchas;
- permite evoluir para outros tipos de conferência técnica no futuro.

---

## 3. Objetivo do MVP

Criar primeiro uma versão mínima funcional, sem tentar fazer um sistema completo.

Objetivo da versão 0.1:

```text
Abrir uma página local, anexar PDFs, enviar uma mensagem e receber a análise documental do agente.
```

Escopo do MVP:

- página única;
- interface estilo ChatGPT;
- upload múltiplo de PDFs;
- campo de mensagem;
- botão "Auditar documentos";
- resposta do agente na tela;
- botão para copiar resposta;
- integração com OpenAI API pelo backend;
- prompt fixo do agente auditor;
- sem login;
- sem banco de dados;
- sem histórico persistente;
- sem exportação DOCX/PDF no início.

---

## 4. Stack recomendada

Stack indicada para começar:

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
OpenAI API
Vercel
```

Motivos:

- Next.js permite frontend e backend no mesmo projeto;
- a chave da OpenAI fica protegida no backend;
- Tailwind e shadcn/ui aceleram a criação de uma interface bonita;
- Vercel facilita o deploy;
- é uma stack boa para vibecodar com Codex.

---

## 5. Arquitetura inicial

Estrutura recomendada:

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

---

## 6. Como deve funcionar tecnicamente

Fluxo técnico:

```text
Frontend
↓
Usuário envia mensagem e PDFs usando FormData
↓
Rota /api/audit no backend
↓
Backend valida arquivos
↓
Backend envia mensagem + PDFs + prompt fixo para OpenAI API
↓
OpenAI retorna análise
↓
Backend devolve JSON para o frontend
↓
Frontend renderiza a resposta no chat
```

Regra importante:

```text
A chave OPENAI_API_KEY nunca deve ir para o frontend.
```

Errado:

```text
React chamando OpenAI direto do navegador.
```

Certo:

```text
React → /api/audit → OpenAI API.
```

---

## 7. Agente auditor documental

O agente deve ser fixo no backend. O usuário não deve editar esse prompt pela interface.

Função do agente:

- conferir consistência documental entre memorial, capa, selo, lista de desenhos/lista de documentos e demais identificações visíveis do projeto;
- focar em identificação documental, não cálculo estrutural;
- procurar incongruências relevantes de obra, número de projeto, endereço, bairro, município, secretaria/órgão, volume, tomo, disciplina e possíveis reaproveitamentos indevidos.

Classificação obrigatória:

```text
sem incongruência relevante
com ponto de atenção
com incongruência relevante
```

Formato obrigatório da resposta:

```text
1. Projeto analisado
2. Status geral
3. Memorial
4. Pranchas
5. Incongruências relevantes encontradas
6. Conclusão objetiva
```

Estilo de resposta:

- linguagem técnica;
- direta;
- curta;
- sem elogios;
- sem comentários genéricos;
- sem inventar erros;
- não extrapolar além do visível nos documentos.

---

## 8. Instruções completas do agente auditor

Usar este conteúdo em `lib/auditor-prompt.ts` como `AUDITOR_SYSTEM_PROMPT`:

```text
Você é um auditor documental especializado em projetos de engenharia civil, com foco na conferência de memoriais descritivos e PDFs de pranchas.

OBJETIVO
Sua função é verificar a consistência documental entre memorial, capa, selo, lista de desenhos/lista de documentos (LD) e demais identificações visíveis do projeto.

ESCOPO PRINCIPAL
Você deve analisar apenas incongruências documentais relevantes, especialmente:
nome da obra
número/código do projeto
endereço
bairro
município
secretaria, órgão ou cliente
volume, tomo, disciplina e identificação geral
sinais de reaproveitamento indevido de texto, selo, capa, carimbo ou identificação de outro projeto

DOCUMENTOS A COMPARAR
Sempre que possível, compare:
memorial
capa
selo/carimbo das pranchas
lista de desenhos ou lista de documentos
identificação repetida em rodapés, cabeçalhos e títulos

REGRAS DE PRIORIDADE
Considere como incongruência relevante:
nome de obra diferente dentro do mesmo conjunto
número de projeto diferente dentro do mesmo conjunto
bairro diferente dentro do mesmo conjunto
endereço ou logradouro conflitante
município diferente
secretaria ou órgão incompatível com o restante do projeto
indícios claros de reaproveitamento de outro projeto
memorial e pranchas apontando para identidades diferentes

Considere como ponto de atenção:
pequenas variações de nomenclatura que não mudem claramente a identidade do projeto
trechos que merecem conferência manual, mas sem conflito forte
divergências menores de grafia, quando houver dúvida razoável

Ignore totalmente:
erros de acentuação
pequenas falhas de ortografia sem impacto na identificação
diferenças de maiúsculas e minúsculas
quebras de formatação
caminhos internos de arquivo
nomes técnicos internos de arquivo
códigos de pasta e diretório
variações irrelevantes de layout
rodapés truncados ou falhas visuais sem impacto documental
detalhes que não alterem a identificação real do projeto

MODO DE ANÁLISE
Sempre siga esta ordem:
1. Identifique qual é o projeto principal do arquivo ou conjunto.
2. Extraia os campos principais visíveis:
   - nome da obra
   - número do projeto
   - endereço
   - bairro
   - município
   - secretaria/órgão
   - volume/tomo/disciplina, quando houver
3. Compare essas informações entre memorial, capa, selo e LD.
4. Aponte apenas o que for relevante.
5. Classifique o resultado final.
6. Conclua de forma objetiva.

CLASSIFICAÇÃO OBRIGATÓRIA
Use apenas uma destas classificações:
sem incongruência relevante
com ponto de atenção
com incongruência relevante

CRITÉRIO DE CONFIANÇA
Não invente erros.
Não assuma informação ausente.
Não extrapole além do que está visível no material.
Quando não houver evidência suficiente, diga que não foi encontrada incongruência relevante dentro do critério adotado.
Quando houver dúvida real, trate como ponto de atenção, não como erro confirmado.

FORMATO OBRIGATÓRIO DA RESPOSTA
Sempre responda nesta estrutura:

1. Projeto analisado
2. Status geral
3. Memorial
4. Pranchas
5. Incongruências relevantes encontradas
6. Conclusão objetiva

REGRAS DE ESCRITA
Use linguagem técnica, direta e curta.
Não escreva textos longos desnecessários.
Não elogie o documento.
Não faça comentários genéricos.
Não misture análise documental com revisão estrutural de cálculo, salvo se o usuário pedir explicitamente.
Foque em identidade documental e coerência entre arquivos.

COMO PREENCHER CADA SEÇÃO

1. Projeto analisado
Informe o nome da obra e o número do projeto, se identificados.

2. Status geral
Use exatamente uma das três classificações:
sem incongruência relevante
com ponto de atenção
com incongruência relevante

3. Memorial
Diga se o memorial está coerente ou se há conflito relevante de identificação.

4. Pranchas
Diga se capa, selo e LD estão coerentes ou se há conflito relevante de identificação.

5. Incongruências relevantes encontradas
Se houver erro, liste de forma objetiva:
  - onde apareceu
  - qual informação conflita
  - por que isso é relevante
Se não houver erro, escreva:
  - nenhuma incongruência relevante encontrada

6. Conclusão objetiva
Feche com uma frase curta, por exemplo:
conjunto coerente dentro do critério adotado
conjunto com ponto de atenção para conferência manual
conjunto com incongruência relevante e necessidade de revisão

MODO DE TRABALHO EM SEQUÊNCIA
Se o usuário enviar vários projetos em sequência:
trate cada projeto separadamente
mantenha consistência no formato das respostas
escreva de forma que o conteúdo possa ser consolidado depois em um relatório único

CONSOLIDAÇÃO
Se o usuário pedir um consolidado, organize os projetos neste formato:
projeto
status
tipo de achado
observação objetiva

RESTRIÇÃO IMPORTANTE
Seu foco principal é auditoria documental de identificação do projeto.
```

---

## 9. Custos estimados

Não existe custo fixo por request. A cobrança da API é por tokens processados:

```text
custo = tokens de entrada + tokens de saída
```

Estimativas práticas para auditoria documental:

```text
request simples sem PDF: centavos
1 PDF pequeno: ~R$ 0,40 a R$ 1,00
3 a 5 PDFs médios: ~R$ 1,50 a R$ 5,00
projeto grande com vários tomos: ~R$ 5,00 a R$ 15,00+
```

Orçamento inicial sugerido para testes:

```text
R$ 100 a R$ 300/mês de API
```

Para validar o MVP:

```text
R$ 50 a R$ 300 pode ser suficiente
```

Se contratar alguém para desenvolver:

```text
MVP simples: R$ 2.000 a R$ 6.000
Versão boa para escritório pequeno: R$ 6.000 a R$ 15.000
Produto interno profissional: R$ 15.000 a R$ 50.000+
```

Se fizer sozinho com Codex/Claude Code:

```text
Desenvolvimento: R$ 0
Domínio: R$ 40 a R$ 80/ano
OpenAI API para testes: R$ 50 a R$ 300
Hospedagem inicial: R$ 0
```

---

## 10. Limites

Não existe app “sem limite” usando OpenAI API.

Sempre haverá:

- limite financeiro;
- limite técnico de contexto/tamanho;
- limite de taxa por minuto;
- limite prático de upload/processamento.

O que dá para fazer:

- limitar por usuário;
- dividir documentos grandes;
- usar modelos mais baratos para triagem;
- salvar histórico;
- usar cache;
- controlar gasto mensal;
- deixar a experiência parecer quase ilimitada para o usuário.

Para o MVP, usar limites simples:

```text
máximo de 5 PDFs por análise
máximo de 25 MB por arquivo
sem histórico persistente
sem usuários
```

Depois evoluir para:

```text
limite mensal por usuário
controle de custo
logs de uso
cache de arquivos já analisados
```

---

## 11. Dificuldade para vibecodar

Dá para vibecodar.

Nível de dificuldade:

```text
Tela de chat: fácil/médio
Upload de PDF: médio
Chamada da OpenAI API: médio
Histórico/login: médio/difícil
Controle de custo/limite: médio
Leitura boa de PDFs grandes: difícil
```

Recomendação:

Começar com o MVP sem login, sem banco e sem histórico.

Evitar começar por:

- dashboard;
- login;
- banco;
- exportação;
- painel admin;
- sistema de planos.

Começar apenas com:

```text
chat + upload PDF + OpenAI API + resposta do agente
```

---

## 12. Roadmap recomendado

### Versão 0.1 — MVP local

```text
- página única
- chat
- upload múltiplo de PDFs
- resposta do agente
- botão copiar
- integração com OpenAI API
```

### Versão 0.2 — Melhorias de uso

```text
- mensagens de erro melhores
- loading melhor
- limite de tamanho de arquivos
- instrução de uso na tela inicial
- visual mais refinado
```

### Versão 0.3 — Deploy

```text
- publicar na Vercel
- usar variáveis de ambiente
- testar com 2 ou 3 colegas
```

### Versão 1.0 — Uso interno

```text
- login
- histórico simples
- projetos salvos
- usuários do escritório
```

### Versão 2.0 — Produto interno avançado

```text
- exportação DOCX/PDF
- controle de custo por usuário
- painel administrativo
- cache de documentos
- file search por projeto
- comparação entre versões
```

---

## 13. Prompt para abrir o novo projeto no ChatGPT/Codex

Usar este prompt no novo chat/projeto:

```text
Estou criando um aplicativo chamado NexoDoc.

Objetivo:
Criar uma aplicação web estilo ChatGPT para auditoria documental de projetos de engenharia civil.

A ideia é criar uma interface própria, com upload de PDFs e chat, usando a OpenAI API por trás para interpretar memoriais, pranchas, capas, listas de documentos e demais arquivos técnicos.

O sistema deve permitir:
- upload de múltiplos PDFs;
- envio de mensagem pelo usuário;
- análise dos documentos por IA;
- resposta padronizada conforme agente auditor;
- interface limpa, técnica e profissional.

Escopo inicial:
Criar primeiro um MVP simples, sem login, sem banco de dados e sem histórico persistente.

Stack desejada:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- OpenAI API
- Vercel

Primeira tarefa:
Me ajude a estruturar a documentação inicial do projeto antes de começar a codar.
Crie os arquivos:
1. visão geral do produto;
2. escopo do MVP;
3. regras do agente auditor;
4. arquitetura técnica;
5. direção visual da interface;
6. roadmap de evolução.

Não implemente código ainda. Primeiro quero deixar o projeto bem definido.
```

---

## 14. Prompt para Codex criar o MVP

Depois da documentação, usar este prompt:

```text
Crie um projeto web chamado "nexodoc" usando Next.js com App Router, TypeScript, Tailwind CSS e shadcn/ui.

Objetivo:
Criar uma aplicação web estilo ChatGPT para auditoria documental de projetos de engenharia civil. O usuário deve conseguir anexar múltiplos PDFs, escrever uma mensagem e receber uma resposta do agente auditor.

Escopo da versão 0.1:
- Página única
- Interface com aparência semelhante a um chat moderno
- Sidebar simples à esquerda com o título "NexoDoc" e botão "Nova auditoria"
- Área central de chat
- Campo inferior para mensagem
- Upload múltiplo de PDFs
- Lista dos arquivos anexados com nome e tamanho
- Botão para remover arquivo antes do envio
- Botão "Auditar documentos"
- Estado de carregamento
- Renderização da resposta do agente
- Botão "Copiar resposta"
- Não implementar login
- Não implementar banco de dados
- Não implementar histórico persistente
- Não implementar exportação PDF/DOCX nesta versão

Stack:
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- OpenAI SDK oficial
- API route em /api/audit

Requisitos técnicos:
- A chave OPENAI_API_KEY deve ficar apenas no backend usando .env.local
- O frontend nunca deve chamar a OpenAI diretamente
- O frontend deve enviar mensagem e arquivos para /api/audit usando FormData
- A rota /api/audit deve validar arquivos PDF
- A rota /api/audit deve retornar JSON com a resposta do agente
- Criar tratamento de erro simples
- Criar README com instruções de instalação, execução e configuração da variável OPENAI_API_KEY

Componentes obrigatórios:
- ChatWindow
- MessageBubble
- Composer
- FileUpload
- AttachedFiles
- AuditResultActions

Visual:
- Interface sóbria, técnica e profissional
- Fundo neutro
- Tipografia limpa
- Pouco ruído visual
- Layout responsivo
- Sem emojis
- Botões claros
- Cards discretos para arquivos anexados

Agente:
Criar um arquivo lib/auditor-prompt.ts com o prompt fixo do agente. O usuário não deve conseguir editar esse prompt pela interface.

Formato obrigatório da resposta do agente:
1. Projeto analisado
2. Status geral
3. Memorial
4. Pranchas
5. Incongruências relevantes encontradas
6. Conclusão objetiva

Crie todos os arquivos necessários e entregue o projeto funcionando.
```

---

## 15. Prompt para revisar integração com PDFs

```text
Revise a rota /api/audit e garanta que ela recebe múltiplos PDFs via FormData, valida o tipo dos arquivos, converte os arquivos para o formato aceito pela OpenAI API e envia junto com a mensagem do usuário.

Requisitos:
- Não expor OPENAI_API_KEY no frontend
- Retornar erro claro se nenhum PDF for enviado
- Retornar erro claro se algum arquivo não for PDF
- Limitar cada arquivo a 25 MB nesta versão
- Retornar a resposta do modelo como JSON
- Manter o prompt fixo do auditor em todas as chamadas
```

---

## 16. Prompt para melhorar a interface

```text
Melhore a interface sem alterar a lógica.

Objetivo:
Deixar a aplicação mais parecida com uma ferramenta profissional de engenharia, com visual técnico, limpo e premium.

Ajustes:
- Melhorar espaçamentos
- Melhorar hierarquia visual
- Melhorar estados de carregamento
- Criar área vazia inicial com instrução de uso
- Melhorar cards dos arquivos anexados
- Melhorar responsividade
- Manter visual sóbrio e sem excesso
- Não adicionar login, banco ou histórico ainda
```

---

## 17. Prompt para revisão final do MVP

```text
Faça uma revisão completa do MVP.

Verifique:
- se a chave da OpenAI não aparece no frontend
- se o upload aceita apenas PDF
- se arquivos podem ser removidos antes do envio
- se a rota /api/audit trata erros
- se o prompt fixo do auditor está sendo usado
- se a resposta segue o formato obrigatório
- se a interface funciona em desktop e notebook
- se o README explica como rodar o projeto

Corrija os problemas encontrados.
```

---

## 18. Comandos prováveis

Criar projeto:

```bash
npx create-next-app@latest nexodoc
cd nexodoc
```

Instalar dependências conforme necessário:

```bash
npm install
npm run dev
```

Criar `.env.local`:

```bash
OPENAI_API_KEY=sua_chave_aqui
```

Abrir:

```text
http://localhost:3000
```

---

## 19. Primeiros testes

Teste 1:

```text
1 memorial pequeno
1 PDF de pranchas pequeno
```

Mensagem:

```text
Confira a consistência documental entre memorial e pranchas.
```

Teste 2:

```text
memorial + tomo 1 + tomo 2 + LD
```

Mensagem:

```text
Confira se nome da obra, número do projeto, bairro, município, volume e identificação das pranchas estão coerentes.
```

Teste 3:

```text
um conjunto que você já sabe que tem erro
```

Objetivo:

```text
ver se o agente detecta a incongruência sem inventar erro.
```

---

## 20. Decisão principal

Criar um projeto separado no ChatGPT/Codex é recomendado.

Motivo:

- mantém contexto limpo;
- separa decisões técnicas;
- facilita continuar o desenvolvimento;
- evita misturar com outros assuntos;
- permite documentar a evolução do app.

Nome do projeto:

```text
NexoDoc
```

Descrição curta:

```text
Aplicação web estilo ChatGPT para auditoria documental de projetos de engenharia, com upload de PDFs, análise por IA e resposta padronizada.
```
