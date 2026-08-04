# Conferência do Volume Montado — Design

Data: 2026-08-04
Status: aprovado no brainstorm, pronto para o plano de implementação

---

## 1. Problema e objetivo

Hoje **nada confere o volume depois de montado**. As duas conferências que
existem rodam ANTES da montagem e sobre os SELOS LIDOS, não sobre o PDF que sai:

- `checkSeloFacts` (`server/nexo/light-check-core.ts`) — código, obra, revisão e
  sequência de folhas, bloco a bloco, sem IA;
- `checkSeloIdentity` (`server/nexo/selo-identity-core.ts`) — órgão, endereço,
  brasão e numeração, numa amostra de até 4 folhas, com visão.

Da montagem para a frente só existe o que é estrutural mínimo: a rota valida que
cada PARTE carrega como PDF e devolve o `pageCount` do resultado
(`server/nexo/tools/assemble-volume.ts`). E o card guarda a `assinaturaDoTomo`
para o canvas marcar o volume como ENVELHECIDO quando as folhas mudam depois —
que é um marcador de desatualização, não uma conferência.

Ninguém abre o PDF montado e confirma que saiu o que se quis.

Um reforço concreto de que o buraco é real: o recorte de páginas por arquivo usa
`Math.min(...range)` a `Math.max(...range)`
(`modules/nexo/lib/assemble-volume.ts`) — um intervalo CONTÍGUO, e não a lista de
páginas. Uma página que não é prancha caindo dentro da faixa de uma disciplina
entra no volume calada. Nos volumes de `040-26` as separatrizes internas caem
entre os blocos e não mordem, mas a garantia vem do dado, não do código.

**Objetivo:** um portão final que abre o PDF montado e o confere contra o plano
que o gerou.

## 2. Decisões travadas (do brainstorm)

1. **Cobre as quatro dimensões**: estrutura (páginas, ordem, presença), conteúdo
   página a página, LD impressa × volume, e identidade (obra/órgão).
2. **Roda AUTOMÁTICA ao terminar de montar, e NÃO bloqueia o download.** Achado
   crítico deixa o card vermelho e diz o que está errado; o PDF continua lá.
   Quem decide é o engenheiro.
3. **A IA lê o carimbo de TODA página do volume** (abordagem B, escolhida sobre a
   alternativa determinística). Custo aceito e explícito: **uma chamada por
   página**, o mesmo custo da leitura de selos na entrada — conferir o volume
   dobra o gasto de IA por folha, e remontar paga de novo.
4. **A IA lê, a regra julga.** O modelo devolve só o que enxerga; nunca um
   veredito. Comparar é código determinístico e testável.
5. **Recorte explícito do "IA lê tudo": LD e separatriz são lidas por extração de
   texto, sem IA.** São PDFs que nós mesmos geramos, com texto limpo; mandá-las a
   um modelo de visão é pagar para ler o que nós escrevemos.
6. **Modelo configurável**, padrão `gpt-5.4-mini`, com `gpt-5.4-nano` a um clique
   no painel do admin.
7. **Conferência parcial não aprova**: página que não deu para ler vira achado e
   impede o veredito "ok".

### O que a escolha da abordagem B ganha

Como o modelo lê o carimbo de todas as páginas, órgão e obra saem de todas elas
sem nenhuma chamada a mais. A cobertura da identidade passa de 4 folhas
amostradas para o volume inteiro, e passa a ser sobre o documento que de fato vai
ser enviado — não sobre os arquivos de entrada.

## 3. Fatos levantados que o desenho precisa respeitar

### 3.1 O texto do carimbo SOBREVIVE à fusão

Verificado fundindo páginas reais com `pdf-lib` (o mesmo motor de `buildRowPdf`)
e rodando os módulos de leitura sobre o resultado: no PDF fundido cada prancha
mantém 8–9 âncoras do carimbo, o reparo de fonte quebrada continua funcionando,
e o código ARQUIVO e a numeração saem inteiros.

Consequência para o desenho: a leitura por extração de texto continua disponível
no PDF final. É ela que sustenta o recorte da decisão 5 (LD e separatriz de
graça) e a medida da caixa do carimbo para o recorte que vai ao modelo.

### 3.2 O campo ARQUIVO NÃO identifica a folha em todas as famílias

Medido nos arquivos reais:

| família | campo ARQUIVO impresso        | traz o nº da folha? |
| ------- | ----------------------------- | ------------------- |
| `est`   | `040_26_est_bl.a_bl.b_001_a`  | sim                 |
| `arq`   | `040_26_arq_a`                | **não**             |

A identidade de uma página dentro do volume **não pode depender só do código**. A
numeração `NN/TT` do carimbo existe nas duas famílias e é a chave primária; o
código entra como confirmação quando existir.

### 3.3 O plano da montagem já é preciso

`buildVolumeParts` (`server/nexo/volume-parts.ts`) devolve `VolumePart[]` com
papel (`capa`/`separatriz`/`ld`/`prancha`), nome e faixa de páginas. Falta só a
contagem de páginas de cada parte para virar expectativa POR PÁGINA do resultado
— e a montagem já carrega cada parte com `pdf-lib`, onde essa contagem é grátis.

## 4. Mecânica

Três peças, cada uma com um trabalho só.

### 4.1 O plano — `server/nexo/volume-plano.ts` (PURO)

Converte `VolumePart[]` + a contagem de páginas de cada parte + as folhas
esperadas de cada bloco em uma **expectativa por página do PDF final**:

```ts
interface PaginaEsperada {
  pagina: number;                  // 1-based no volume final
  papel: VolumePartRole;
  bloco?: string;                  // código da disciplina, p/ partes de bloco
  folha?: number | null;           // nº da prancha esperado naquela página
  total?: number | null;           // o /TT esperado do bloco
  codigo?: string | null;          // campo ARQUIVO, quando a família imprime
  titulo?: string | null;          // CONTEÚDO esperado
}
```

`folha`, `codigo` e `titulo` vêm das **linhas da LD daquele bloco** — o
`CreateLDInput.rows` que a montagem já tem em mãos, e que é a mesma fonte que
imprimiu a LD encadernada. Usar a LD como gabarito é deliberado: é o documento
que promete o conteúdo do volume, e conferir o volume contra a promessa é
exatamente o que se quer.

PURO e sem imports, no mesmo padrão de `volume-parts.ts`, para rodar em node cru.

### 4.2 A leitura — `modules/nexo/lib/volume-leitura.ts` (CLIENT)

Abre o PDF montado, e para cada página:

- mede a caixa do carimbo com `acharCaixaDoSelo` (já existe) e recorta com
  `renderSeloCrop` (já existe, já recebe a caixa);
- página de papel `ld` ou `separatriz`: **lê por extração de texto**, sem IA;
- página de prancha: manda o recorte ao modelo, que devolve `LeituraDaPagina`.

```ts
interface LeituraDaPagina {
  pagina: number;
  numeracaoTexto: string;   // como está escrito ("01/16", "1 de 16")
  folha: number | null;
  total: number | null;
  codigo: string | null;    // campo ARQUIVO
  titulo: string | null;    // CONTEÚDO
  disciplina: string | null;
  orgao: string;
  obra: string;
  erro?: string;            // não pôde ser lida
}
```

Reusa a disciplina de robustez que já foi aplicada à leitura de selo: retry em
falha transitória, e a página que falha **não some** — vira `erro`.

### 4.3 O juízo — `server/nexo/volume-check-core.ts` (PURO)

`checkVolumeMontado(esperado: PaginaEsperada[], lido: LeituraDaPagina[], alvo)`
→ `LightCheckFinding[]` + veredito, no formato que os cards já exibem.

## 5. As regras e as severidades

### 5.1 Estrutura — CRÍTICO (não depende do modelo)

É aritmética sobre o plano, então é a única dimensão que emite crítico com
confiança total.

- `pageCount` do PDF final ≠ soma das páginas esperadas → **crítico**.
- **Papel trocado**: o plano diz o que cada página deveria ser, e a leitura diz o
  que ela parece. A prova é a presença do carimbo, via `classificarPagina` /
  contagem de âncoras — não uma leitura de papel pelo modelo, que não existe.
  Página que o plano diz `prancha` e que chega **sem carimbo nenhum** →
  **crítico** (a faixa recortada trouxe capa ou índice para dentro do bloco).
  Página que o plano diz `capa`, `separatriz` ou `ld` e que chega **com carimbo
  de prancha** → **crítico** (a parte errada entrou naquela posição).
- A ordem canônica em si não precisa ser reconferida: ela é produzida por
  `buildVolumeParts`, que é puro e já travado por `test:nexo:parts`. O que pode
  dar errado da montagem para o PDF é a FAIXA de páginas de cada parte, e é isso
  que as duas regras acima pegam.

### 5.2 Conteúdo, página a página

Aqui quem fala é a leitura, e leitura erra — a severidade acompanha.

- numeração divergente numa página isolada → **aviso**;
- **metade ou mais das páginas de um bloco divergindo com o MESMO
  deslocamento** → **crítico**. Isso não é ruído: é a faixa recortada errada, o
  modo de falha do `min/max` da seção 1;
- folha esperada ausente do volume → **crítico**;
- folha repetida → **crítico**;
- disciplina lida ≠ disciplina do bloco em que a página caiu → **crítico**.

### 5.3 LD impressa × volume — CRÍTICO

As linhas da LD encadernada são comparadas com as pranchas que vêm depois dela no
mesmo bloco: mesmos códigos, mesma quantidade, mesma ordem. Discordância →
**crítico** — é a LD velha, montada antes de mexer nas folhas.

### 5.4 Identidade — CRÍTICO

- órgão lido ≠ prefeitura-alvo da capa → **crítico** (reusa `mesmoOrgao`);
- obra divergente entre páginas do volume → **crítico**.

O alvo é a intenção DECLARADA — a prefeitura escolhida para a capa —, nunca o que
o selo diz. Inferir o alvo do próprio documento conferiria o selo contra ele
mesmo, e um volume coerentemente errado passaria.

### 5.5 Leitura parcial

Página que não pôde ser lida vira achado ("N páginas não puderam ser
conferidas") e o veredito **não pode ser "ok"**. Mesma regra do auditor: análise
parcial não aprova.

## 6. UI

O card do volume já existe (`ConfirmationCard.tsx`). Ao terminar de montar, a
conferência roda sozinha e o resultado entra no card ao lado do PDF, reusando o
componente `CheckResult` que já exibe `LightCheckFinding[]`.

Crítico deixa o card vermelho e lista o que está errado. **O botão de baixar
continua ativo** — decisão 2.

## 7. Configuração e custo

- Flow novo `volume-conferencia` em `AI_MODEL_FLOW_DEFINITIONS`
  (`lib/ai-model-config.ts`), configurável pelo painel do admin como os outros.
- Padrão `gpt-5.4-mini`; `gpt-5.4-nano` disponível sem mexer em código.
- A rota nova entra no `verificarTetoMensal`, como a de leitura de selo — sem
  isso, um volume grande fura a proteção da fatura.
- O consumo é registrado por `recordAiUsage` com o número da página, para dar
  para ver depois quanto uma conferência custou.

## 8. Testes

- **Núcleos puros** (`volume-plano.ts`, `volume-check-core.ts`) com teste em node
  cru — `npm run test:nexo:volume-check`. Casos: volume perfeito dá "ok"; faixa
  deslocada num bloco dá crítico; LD velha dá crítico; página ilegível rebaixa o
  veredito; volume misto de três disciplinas não inventa achado.
- **Fiação no navegador, sem gastar token**: monta um volume real a partir de
  `docs/samples/040-26` e **encena a resposta do modelo**, no molde de
  `scripts/shot-nexo-folhas.mjs`. Prova o caminho inteiro sem pagar.

## 9. Reuso vs novo

| Peça                       | Decisão                                                  |
| -------------------------- | -------------------------------------------------------- |
| `acharCaixaDoSelo`         | reusa — a caixa medida do carimbo                        |
| `renderSeloCrop`           | reusa — já recebe a caixa                                |
| `repararTextoCad`          | reusa — a família EST também está no volume              |
| `LightCheckFinding` / `CheckResult` | reusa — formato e UI de achados               |
| `mesmoOrgao`               | reusa — comparação de órgão do `selo-identity-core`      |
| `volume-plano.ts`          | novo — não existe expectativa por página hoje            |
| `volume-check-core.ts`     | novo — nada compara PDF final × plano                    |
| `volume-leitura.ts`        | novo — leitura por página do PDF montado                 |
| rota `/api/nexo/volume-check` | nova — a de selo é por folha de entrada, não por volume |

## 10. Riscos

1. **Custo.** Uma chamada por página, a cada montagem. Mitigado pelo modelo
   simples e pelo teto mensal, mas é o preço da abordagem escolhida e está
   registrado aqui de propósito.
2. **Aviso falso ensina a ignorar o semáforo.** É por isso que divergência
   isolada de numeração é aviso e não crítico, e que só o deslocamento
   SISTEMÁTICO de um bloco sobe para crítico.
3. **Volume grande e lento.** 200 páginas × uma chamada é demorado mesmo em
   paralelo. A conferência é automática e não bloqueia o download, então o
   engenheiro não fica parado esperando — mas o progresso precisa aparecer.
4. **Prancha escaneada.** Sem texto, a caixa do carimbo cai no quadrante de
   reserva e a leitura fica pior. Não é regressão (é o que já acontecia), e o
   achado de leitura parcial cobre o caso.
