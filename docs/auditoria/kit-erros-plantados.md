# Kit de memoriais com erros plantados

Gabarito dos PDFs de teste da auditoria de memoriais.

- **Gerar:** `node scripts/gera-memoriais-defeituosos.mjs`
- **Conferir sem gastar token:** `node scripts/confere-memoriais-defeituosos.ts`
- **Saída:** `docs/samples/_auditoria-teste/` (pasta ignorada pelo git)

## Como o kit foi montado

Base: `docs/samples/116-25/1_memorial/116_25_md_geral_b.pdf` — UBS Renascer - Porte 2, Bairro São João, Criciúma/SC. O texto real é extraído com pdfjs e regravado em PDF novo com texto pesquisável (a auditoria exige ≥ 300 caracteres extraíveis; nada aqui é escaneado).

**O memorial real já tinha defeitos.** Se eles ficassem, não daria para separar acerto de ruído, então o gerador **saneia** o base antes de plantar os erros. O que foi removido — e que vale registrar, porque são achados legítimos do arquivo real em produção:

| No memorial real | Regra que disparava |
|---|---|
| p.21 "As especificações técnicas … prevalecerão sobre todos os projetos" × p.17 "sempre prevalecerão os projetos" | COER hierarquia documental |
| p.12 terraplenagem = Prefeitura × p.25 "A CONTRATADA deverá executar todo movimento de terra" | COER responsabilidade de terraplenagem |
| p.53 "Será construído a UBS…" × p.58 "alvenaria existente" | COER construção nova × reforma |
| p.158 "Proprietário: **Prefeitura Municipal de Chapecó**" num projeto de Criciúma | identidade / cross-document |

Dois **falsos positivos** do motor também precisaram ser neutralizados (valem uma olhada no código, não são erro do documento):

1. `UBS Renascer` e `Unidade Básica de Saúde Renascer` viram identidades canônicas diferentes ("ubs renascer" × "unidade basica de saude renascer"), e nenhuma contém a outra → a regra acusa "nome de obra divergente" na mesma obra.
2. "escola" e "hospital" soltos em texto genérico (`escadas da escola`, tabela de risco da NBR 5419 com `hospital`) disparam "tipo de ocupação divergente".

## Os arquivos

Cada linha marcada **[regra]** foi confirmada rodando os motores determinísticos reais sobre o PDF gerado. As marcadas **[IA]** dependem do passe de modelo — são justamente as que valem observar.

### 01-identidade-capa-x-corpo.pdf — 67 págs.
Capa diz uma obra, corpo diz outra, e o corpo tem quatro obras intrusas.

| Onde | Erro plantado | Esperado |
|---|---|---|
| capa | `CENTRO COMUNITARIO PRIMEIRA LINHA` (corpo é UBS Renascer) | **[regra]** GUARDA-CAPA-CORPO + IDENT-001 · Alta |
| p.8 | "climatização do **Centro Dia do Idoso**" | **[regra]** IDENT-002 · Alta |
| p.21 | "esquadrias da **Cidade do Autista**" | **[regra]** IDENT-003 · Alta |
| p.33 | "layout aprovado para a **Creche Vovó Marieta**" | **[regra]** IDENT-004 · Alta |
| p.45 | "acesso principal da **escola**" (sem nome próprio) | **[regra]** IDENT-005 · tipo de ocupação |
| p.59 | rodapé "… **CENTRO COMUNITARIO BOA VISTA** - PROJETO EXECUTIVO" | **[regra]** IDENT-006 · Alta |

Total esperado: 6 achados de identidade + a guarda de capa. Atenção ao comportamento de compactação: repetições da *mesma* obra intrusa são fundidas num achado só.

### 02-contratual-e-escopo.pdf — 67 págs.

| Onde | Erro plantado | Esperado |
|---|---|---|
| p.11 | "As especificações técnicas … prevalecerão sobre todos os projetos" (p.9 diz o contrário) | **[regra]** COER-001 hierarquia · Media/Alta |
| p.18 | "A CONTRATADA deverá executar todo movimento de terra" (p.4 dá terraplenagem à Prefeitura) | **[regra]** COER-002 · Media/Alta |
| p.25 | "eixo da rodovia… superelevação das pistas… Km 12 + 300… até 80 km/h" | **[regra]** COER-003 linguagem rodoviária · Media |
| p.31 | "revitalização… alvenaria existente… pavimento a ser substituído" | **[regra]** COER-004 escopo ambíguo · Media |
| p.37 | "instalações elétricas … conforme a **NBR 7190 - Projeto de estruturas de madeira**" | **[IA]** norma incompatível com o escopo |

### 03-numerico-areas-e-unidades.pdf — 67 págs.

| Onde | Erro plantado | Esperado |
|---|---|---|
| p.6 / 13 / 28 | área total construída: **813,98 m²** × **1.480,00 m²** × **902,45 m²** | **[regra]** COER-001 área divergente · Alta |
| p.16 | "concessionária **COOPERA**" numa obra de **Criciúma** (COOPERA atende Forquilhinha) | **[regra]** COER-002 · Media, confiança baixa |
| p.20 / 35 | "**cinco** blocos interligados" × "os **seis** blocos possuem cobertura metálica" | **[IA]** quantidade de blocos incoerente |
| p.40 | "piso tátil … espessura **e = 2,5 m**" (deveria ser cm) | **[IA]** unidade impossível |
| p.48 | "guarda-corpos … altura de **1,10 mm**" | **[IA]** unidade impossível |
| p.54 | "12 luminárias de 40 W cada, totalizando **640 W**" (= 480 W) | **[IA]** cálculo simples incoerente |
| p.61 | "taxa de ocupação de **45%** sobre terreno de 1.200 m², resultando em **813,98 m²**" (= 540 m²) | **[IA]** quantitativo incoerente |

### 04-par-capa.pdf + 05-par-memorial.pdf — enviar **os dois juntos**
Precisa dos dois no mesmo envio, com `fileTypes` = **capa** e **memorial** (a capa é o documento de maior precedência, vira baseline).

| Campo | Capa | Memorial | Esperado |
|---|---|---|---|
| município/proprietário | Criciúma | **Içara** | **[regra]** CROSS-001 · Alta |
| órgão | Secretaria Municipal de Saúde | **Sec. Mun. de Obras e Serviços Urbanos** | **[regra]** CROSS-002 · Media/Alta |
| endereço | Rua Pedro Antônio, 355 | **Rua João Pessoa, 1200** | **[regra]** CROSS-003 · Alta |
| bairro | São João | **Santa Bárbara** | **[regra]** CROSS-004 · Alta |
| código | 116-25 | **116-26** | **[regra]** CROSS-005 · Alta |
| revisão | B | **A** | plantado, **não disparou** na conferência local — vale ver se a auditoria completa pega |

### 06-capa-ilegivel.pdf — 52 págs.
Página 1 com 6 caracteres (simula capa que é só imagem). Esperado: **[regra]** GUARDA-CAPA-LEITURA. Nenhum outro erro plantado.

### 07-sutil-tres-erros.pdf — 132 págs.
Teste de recall: documento longo, três erros discretos e enterrados. É o arquivo para comparar **Padrão × Profundo** — no Padrão a leitura é amostrada, no Profundo lê o documento inteiro.

| Onde | Erro plantado | Esperado |
|---|---|---|
| p.66 | "referenciado ao **Centro de Saúde Rio Maina**" | **[regra]** IDENT-001 · Alta |
| p.24 / 92 | 813,98 m² × **831,98 m²** (dígitos trocados) | **[regra]** COER-001 área divergente · Alta |
| p.108 | "PVC DN 100 mm assentada a **1,20 mm** de profundidade" | **[IA]** unidade impossível |

### 08-controle-limpo.pdf — 67 págs.
**Controle negativo: o esperado é zero achado.** Tem as armadilhas que já derrubaram o motor antes:

- "depósito … **área total superior a 1.000 m²**" — número solto que não pode virar "área divergente";
- **CELESC** como concessionária (correta para Criciúma) — não pode virar achado de concessionária;
- a mesma área 813,98 m² repetida — repetição idêntica não é divergência.

Qualquer achado aqui é falso positivo.

## Como testar

1. `/audit` (ou a auditoria dentro do Nexo), um arquivo por vez — menos o par 04+05, que vai junto.
2. Gabarito na tela de entrada: obra `UBS Renascer - Porte 2`, prefeitura/município `Criciúma`. **Exceto** no 01 (a graça é a capa divergir) e no par 04/05.
   Com `gabaritoObra` preenchido, a regra de identidade troca o baseline "obra dominante" pela obra declarada e passa a checar *todos* os grupos, inclusive o dominante — o 01 tende a render mais achados com gabarito do que sem.
3. Nível **Padrão** primeiro; repita o 07 no **Profundo** para comparar recall.
4. Compare com este gabarito: achado que falta é recall perdido; achado no 08 é precisão perdida.

Os achados **[regra]** aparecem com "✔ Verificado" e não podem ser removidos pelo passe de validação. Os **[IA]** aparecem como "◻ Sugerido" e podem ser rebaixados para sugestão — se sumirem, vale olhar o passe de validação antes de culpar o modelo.
