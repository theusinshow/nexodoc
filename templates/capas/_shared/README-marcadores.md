# Templates de capa — marcadores e variacoes

## Marcadores padrao

Todo template de capa usa estes marcadores dentro do ODT:

```text
{{ORGAO}}
{{SECRETARIA}}
{{NOME_OBRA}}
{{FASE}}
{{DISCIPLINA}}
{{TITULO_CAPA}}
{{TOMO}}
{{VOLUME}}
{{MES_ANO}}
{{CODIGO_EXIBIDO}}
```

- `{{DISCIPLINA}}` e opcional — use apenas se o template tiver campo dedicado
  para disciplina. Suporta multiplas linhas (quebra com Enter no formulario).
- `{{ORGAO}}` / `{{SECRETARIA}}` sao opcionais: varias prefeituras ja tem o
  cabecalho fixo no design do ODT e nao usam esses marcadores.
- O corpo inteiro do `office:text` do ODT e repetido por capa gerada. Se o
  modelo tiver capa + contracapa (duas paginas fisicas), cada capa vira duas
  paginas — foi assim que o modelo de Florianopolis foi montado.

## Ao editar um modelo no LibreOffice

O marcador tem de ser **texto normal**, digitado no parágrafo. Não use
`Inserir > Campo` nem cole um marcador por cima de um campo já existente: o
LibreOffice grava isso como campo do ODF e o marcador passa a aparecer duas
vezes no XML, no atributo e no conteúdo.

```xml
<text:user-defined text:name="{{NOME_OBRA}}">{{NOME_OBRA}}</text:user-defined>
```

O gerador desembrulha esses campos antes de substituir
(`desembrulharCamposDeUsuario`), então um modelo assim continua funcionando —
mas o modelo fica mais difícil de conferir, porque o `unzip | grep` abaixo passa
a contar cada marcador duas vezes. Prefira texto puro.

Cuidado também com o inverso: ao salvar, o LibreOffice pode **resolver** o campo
e trocá-lo pelo valor. Foi o que aconteceu com o `{{FASE}}` de Florianópolis,
que virou o texto fixo `PROJETO EXECUTIVO`. Depois de salvar um modelo, confira
os marcadores com o comando da seção `campos` e ajuste o `config.json` se algum
tiver sumido.

## Estrutura de pastas

```text
templates/capas/
  <id-da-variacao>/
    config.json
    modelo_capa.odt
```

Cada pasta com um `config.json` valido vira UMA variacao no seletor. Pastas que
comecam com `_` (como `_shared`) sao ignoradas pelo registry.

## config.json

```jsonc
{
  "id": "prefflor-executivo",              // unico entre TODAS as pastas
  "nome": "Prefeitura Municipal de Florianopolis", // rotulo completo (compat)
  "grupo": "Prefeitura Municipal de Florianopolis", // agrupa variacoes na UI
  "variante": "Projeto Executivo",         // rotulo do chip dentro do grupo
  "arquivoTemplate": "modelo_capa.odt",    // nome do ODT nesta pasta
  "volumeFormat": "roman",                 // "roman" (Vol. I) | "numeric" (Volume 1)
  "tomoFormat": "plain",                   // ver abaixo
  "coverTitleMode": "items",               // "items" | "volume-title-items"
  "defaults": {                            // pre-preenchem o formulario, editaveis
    "orgao": "PREFEITURA MUNICIPAL DE FLORIANOPOLIS",
    "secretaria": "",
    "fase": "PROJETO EXECUTIVO"
  },
  "campos": [                              // marcadores que ESTE ODT realmente usa
    "NOME_OBRA", "FASE", "TITULO_CAPA",
    "TOMO", "VOLUME", "MES_ANO", "CODIGO_EXIBIDO"
  ]
}
```

### Como agrupar variacoes da mesma prefeitura

- Todas as variacoes de uma prefeitura devem ter o **mesmo `grupo`**.
- O `id` precisa ser **unico** (ex.: `prefflor-executivo`, `prefflor-basico`).
- O `variante` e o texto do chip (ex.: "Projeto Executivo", "Sem contracapa").
- Se `grupo` estiver ausente, a variacao vira um grupo proprio usando `nome`.
- Se `variante` estiver ausente, o chip usa `nome`.

### Formatos de tomo (`tomoFormat`)

| valor                   | resultado    |
| ----------------------- | ------------ |
| `parenthesized-padded`  | `(TOMO 01)`  |
| `parenthesized`         | `(TOMO 1)`   |
| `plain-padded`          | `TOMO 01`    |
| `plain`                 | `TOMO 1`     |

O tomo so aparece quando o grupo tem mais de um tomo. Volumes de tomo unico
saem sem rotulo de tomo.

### `campos` deve refletir o ODT

A lista `campos` controla quais campos o formulario mostra e valida. Ela precisa
bater com os marcadores realmente presentes no ODT. Para conferir:

```bash
unzip -p <pasta>/modelo_capa.odt content.xml | grep -oE '\{\{[A-Z_]+\}\}' | sort -u
```

## Passo a passo: adicionar uma variacao

1. Copie a pasta de uma variacao parecida (ou crie uma nova).
2. Substitua o `.odt` pelo modelo oficial da variacao.
3. No `config.json`: defina um `id` unico, mantenha o mesmo `grupo` da
   prefeitura, escolha um `variante` descritivo e ajuste `campos`/`defaults`
   conforme os marcadores do ODT.
4. Reinicie o servidor (o registry cacheia os templates em memoria).
