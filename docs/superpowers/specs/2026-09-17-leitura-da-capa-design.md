# Leitura da capa do memorial — design

17/09/2026. Aprovado na conversa com o Matheus.

## Por que

O memorial de São José (027_24) chegou ao chat com a obra "• Diário de Obra em
dia" e a prefeitura colada na secretaria. O conserto do mesmo dia (`cdd08e4`)
pôs a capa como degrau **entre** o rodapé e o campo "Obra:", e só no modelo
PREFEITURA/SECRETARIA. A decisão agora é outra: **a capa é a fonte padrão dos
dados do memorial, em todos os modelos de prefeitura**. Rodapé, campo e
caracterização viram fallback.

## Decisões travadas

1. **Abordagem: reconhecer linhas**, determinística, sem IA e sem ler ODT em
   produção. Os modelos `templates/capas/*/modelo_capa.odt` entram como teste
   obrigatório, não como insumo de execução.
2. **Campos lidos da capa:** obra, prefeitura (órgão), secretaria, município,
   bairro, código e mês/ano. Fase, título e volume são lidos para ancorar o
   nome, não expostos.
3. **O código é a exceção à precedência.** O nome do arquivo continua mandando,
   porque é a chave do projeto (endereço da conversa, pasta, barra lateral). O
   código da capa só entra quando o nome não traz código. Os dois divergindo
   viram aviso visível.
4. **Criciúma muda de gabarito**, e isso é aceito: de "Unidade Básica de Saúde
   localizada na Rua …" (campo do capítulo 1) para "UBS Renascer - Porte 2" /
   "UBS Vila Manaus - Porte 1" (capa). O efeito é medido, não suposto (ver
   Provas).

## 1. O leitor — `lib/leitura-da-capa.ts`

Módulo PURO e sem `@/`, como `nome-da-obra.ts`: roda em node cru.

```ts
export interface LeituraDaCapa {
  orgao: string;      // linha do timbre como impressa, espaços normalizados
  secretaria: string;
  municipio: string;  // "…DE <CIDADE>" do timbre, em caixa de título
  obra: string;
  bairro: string;     // sem o prefixo "BAIRRO"
  mesAno: string;     // como impresso: "OUTUBRO/2025", "OUTUBRO 2025"
  codigo: string;     // normalizado com hífen: "027-24"
}
export function lerCapa(
  texto: string,
  /** Municípios já lidos do documento, para devolver grafia a timbre espaçado. */
  candidatosDeMunicipio?: readonly string[],
): LeituraDaCapa | null;
```

Campo ausente é `""`, nunca chute.

**Página 1 só.** O recorte é entre `--- PAGINA 1 ---` e `--- PAGINA 2 ---`.
Sem o marcador, devolve `null`.

**Linhas com letras espaçadas.** A capa de Criciúma chega da extração como
`E S T A D O D E S A N T A C A T A R I N A`. Uma linha em que todo pedaço
separado por espaço tem um caractere é colada antes do reconhecimento
(`ESTADODESANTACATARINA`) e comparada sem espaços nem acentos.

**Reconhecedores de linha**, na ordem em que são testados:

| papel | reconhece |
|---|---|
| estado | `ESTADO DE SANTA CATARINA` (sem espaços/acentos) |
| timbre | começa com `PREFEITURA MUNICIPAL DE` ou `GOVERNO DO MUNICÍPIO DE` |
| secretaria | começa com `SECRETARIA` |
| fase | `PROJETO EXECUTIVO`, `PROJETO BÁSICO`, `ANTEPROJETO`, `ESTUDO PRELIMINAR` |
| título | `MEMORIAL DESCRITIVO`, ou `VOLUME <n> – <título>` |
| volume | `Vol. <romano ou número>` |
| bairro | começa com `BAIRRO` |
| mês/ano | `<MÊS>/<ANO>` ou `<MÊS> <ANO>` |
| código | `\d{2,4}[-_]\d{2}` sozinho na linha |
| escritório | contém `Projetos, Supervisão e Planejamento` |

**Timbre espaçado perde a fronteira das palavras.** Colado, o de Criciúma vira
`GOVERNODOMUNICÍPIODECRICIÚMA`, e uma cidade de duas palavras viraria
`SÃOJOSÉ`. A cidade só é devolvida com grafia quando algum candidato do próprio
documento (município da caracterização ou da impressão digital), colado da
mesma forma, é igual ao final do timbre; aí vale a grafia do candidato, e o
órgão é remontado como `GOVERNO DO MUNICÍPIO DE <CIDADE>`. Sem candidato que
case, `municipio: ""` e o fallback decide.

**É capa** quando há timbre **e** pelo menos uma âncora de fim (fase, título ou
volume) depois dele. Senão, `null`.

**Nome da obra:** as linhas não reconhecidas entre o último timbre/secretaria e
a primeira âncora de fim, unidas por espaço. Linha de bairro nesse trecho vai
para `bairro`, não para o nome. De 1 a 4 linhas e de 4 a 160 caracteres; fora
disso, `obra: ""` (o resto da leitura continua valendo).

## 2. Precedência — `lib/audit-classify.ts`

| campo | ordem |
|---|---|
| obra | capa → rodapé → campo "Obra:" → impressão digital |
| órgão | capa → `orgaoDoTimbre` (qualquer página) |
| secretaria | capa |
| município | capa → caracterização → impressão digital/regex |
| bairro | capa → caracterização |
| mês/ano | capa |
| código | nome do arquivo → capa → texto (divergência arquivo × capa vira sinal) |

`nomeDaObra` perde o degrau `daCapa` do conserto de 17/09: a capa passa a ser
lida uma vez só, por `lerCapa`, e o degrau vira redundante.

A `confianca` continua pedindo obra + município; a capa lida conta como
evidência forte.

## 3. Por onde os dados passam

- `DocumentClassification`, `NexoFileClassification` e `NexoDossieDraft` ganham
  `secretaria`, `bairro` e `mesAno` (string, `""` ausente). Aparecem no
  `aggregate` de `classify-documents.ts` pelo mesmo `pickByConfidence`.
- **Sinais**, para a origem ficar visível: `"dados lidos da capa (página 1)"` ou
  `"capa não reconhecida na página 1: dados do rodapé/corpo"`; e
  `"código da capa (X) diverge do nome do arquivo (Y)"` quando for o caso.
- **Chat** (`appendMemorialIntake`): obra · prefeitura · secretaria · bairro ·
  município · código · mês/ano, só os presentes. A identidade da conversa
  (`corrigirIdentidade`) recebe os mesmos campos.
- **Gabarito da auditoria:** a obra, que agora é a da capa. Nada muda no
  contrato da rota.

## Casos de borda

- **Memorial sem capa** (capa em PDF separado, página 1 já é sumário): `null`,
  cadeia de fallback de hoje, sinal dizendo isso.
- **Capa desenhada** (texto em curva, ver `nexodoc-pagina-muda`): a extração
  não tem texto na página 1, `null`, fallback. A transcrição por visão acontece
  depois da classificação e não entra aqui.
- **Kit de erros plantados:** as capas do kit são texto achatado em poucas
  linhas. Onde o leitor não reconhecer, cai no fallback; onde reconhecer, o
  gabarito do kit (`GABARITO.md`) é conferido de novo.

## Provas

1. `scripts/test-leitura-da-capa.ts`: página 1 **real** de 027_24, 040_26,
   113_22, 116_25, 117_25, 156_25 e 05-par-memorial, com o valor esperado de
   cada campo; mais "sumário na página 1 → null" e "sem âncora de fim → null".
2. **Modelos como fixture:** para cada `templates/capas/*/modelo_capa.odt`, o
   teste extrai as linhas do `content.xml`, troca cada `{{CAMPO}}` por um valor
   de exemplo, passa por `lerCapa` e exige os mesmos valores de volta. Modelo
   novo que o leitor não entenda derruba o teste.
3. **Acervo antes × depois** (os 15 memoriais de 17/09), listando cada campo que
   mudou. Mudança esperada: obra de Criciúma. Qualquer outra é investigada antes
   de seguir.
4. **Sem token:** kit de erros plantados (`confere-memoriais-defeituosos`) e o
   recall do 117_25 remedido pelo roteiro de `nexodoc-recall-117-25`.
5. **Navegador:** anexar o 027_24 no `/nexo` local e ler a mensagem do chat. A
   classificação é determinística, sem IA.

## Fora do escopo

- Reescrever a identidade gravada das conversas já existentes.
- Ler capa de prancha, LD ou volume montado.
- Mudar a regra de identidade (`runWithinDocumentIdentityRules`) além de
  receber o gabarito novo.
