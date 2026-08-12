/**
 * Gera um kit de memoriais PDF com erros PLANTADOS de propósito, para testar a
 * auditoria de memoriais (regras determinísticas + passes de IA).
 *
 * Base: docs/samples/116-25/1_memorial/116_25_md_geral_b.pdf (UBS Renascer,
 * Criciúma). O texto real é extraído com pdfjs, SANEADO (o memorial real já
 * dispara COER-001/002/004 e achados de identidade — ver GABARITO) e só então
 * recebe os defeitos controlados. Sem o saneamento o gabarito não fecharia.
 *
 * Uso:  node scripts/gera-memoriais-defeituosos.mjs
 * Saída: docs/samples/_auditoria-teste/*.pdf  (pasta ignorada pelo git)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_PDF = path.join(raiz, "docs/samples/116-25/1_memorial/116_25_md_geral_b.pdf");
const SAIDA = path.join(raiz, "docs/samples/_auditoria-teste");

/* ------------------------------------------------------------------ extração */

async function extrairPaginas(arquivo) {
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await mod.getDocument({
    data: new Uint8Array(fs.readFileSync(arquivo)),
    useSystemFonts: true,
  }).promise;

  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const conteudo = await page.getTextContent();
    paginas.push(
      conteudo.items
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return paginas;
}

/* --------------------------------------------------------------- saneamento */

/** Defeitos que JÁ existem no memorial real e precisam sair para o gabarito fechar. */
const SANEAMENTO = [
  // COER-001 (hierarquia documental contraditória) — sobra só o lado "prevalecerão os projetos"
  [
    /As especifica[cç][õo]es t[ée]cnicas e normas de execu[cç][ãa]o citadas neste memorial prevalecer[ãa]o sobre todos os projetos\./gi,
    "Em caso de divergencia, os projetos executivos prevalecerao sobre as especificacoes deste memorial.",
  ],
  // COER-002 (responsabilidade de terraplenagem divergente)
  [
    /A CONTRATADA dever[áa] executar todo movimento de terra/gi,
    "A CONTRATADA devera executar os servicos de nivelamento fino",
  ],
  // COER-004 (escopo construção nova x reforma)
  [/alvenaria existente/gi, "alvenaria a ser executada"],
  /*
   * COER "material das ferragens contraditório" — 5º defeito pré-existente do
   * memorial real, descoberto em 12/08/2026 quando a regra nova sujou o
   * 08-controle-limpo. Não é falso positivo: a p.63 diz que as ferragens
   * acompanham o material das esquadrias E que as portas de alumínio levam
   * tudo em inox. A mesma contradição está no 063-26 (Cancha de Bocha), outro
   * projeto do escritório — é boilerplate recorrente, não acidente do arquivo.
   * Sai daqui só para o controle voltar a zero.
   */
  [
    /do mesmo material das esquadrias/gi,
    "conforme especificacao de cada esquadria",
  ],
  // Município intruso real (p.158) — vira ruído de identidade/cross-document
  [/Prefeitura Municipal de Chapec[óo]/gi, "Prefeitura Municipal de Criciuma"],
  // Falsos positivos de ocupação: "Escola"/"Hospital" soltos em textos genéricos e tabelas de norma
  [/\bescolas\b/gi, "edificacoes escolares"],
  [/\bescola\b/gi, "edificacao escolar"],
  [/\bhospitais\b/gi, "edificacoes hospitalares"],
  [/\bhospital\b/gi, "edificacao hospitalar"],
  // UBS x "Unidade Básica de Saúde" são canônicos diferentes para a regra de identidade
  [/Unidade B[áa]sica de Sa[úu]de Renascer/gi, "UBS Renascer"],
  [/Unidade B[áa]sica de Sa[úu]de/gi, "UBS"],
];

function sanear(paginas) {
  return paginas.map((texto) =>
    SANEAMENTO.reduce((acc, [de, para]) => acc.replace(de, para), texto),
  );
}

/** Gatilhos determinísticos que NÃO podem sobrar no base limpo. */
const GUARDAS_BASE = [
  ["COER-001 hierarquia", /especifica[cç][õo]es\s+t[ée]cnicas[\s\S]{0,140}?prevalecer[ãa]o\s+sobre\s+(?:todos\s+)?os\s+projetos/i],
  ["COER-002 terraplenagem", /contratada\/?(?:construtora)?\s+dever[áa]\s+executar\s+(?:todo\s+)?(?:o\s+)?movimento\s+de\s+terra/i],
  ["COER-004 escopo", /alvenaria\s+existente/i],
  ["identidade escola/hospital", /\b(escola|hospital)\b/i],
  ["identidade UBS x UBS por extenso", /Unidade B[áa]sica de Sa[úu]de/i],
  ["município intruso", /Chapec[óo]/i],
];

/* ------------------------------------------------------------------ render */

const ACENTOS = new Map(Object.entries({
  "—": "-", "–": "-", "‐": "-", "‑": "-", "“": '"', "”": '"', "„": '"',
  "‘": "'", "’": "'", "•": "-", "…": "...", "≥": ">=", "≤": "<=", "→": "->",
  "×": "x", "Ø": "O", "ø": "o", " ": " ", "\t": " ",
}));

/** Helvetica só escreve WinAnsi; troca o que não couber sem perder os acentos pt-BR. */
function paraWinAnsi(texto) {
  let saida = "";
  for (const ch of texto) {
    if (ACENTOS.has(ch)) {
      saida += ACENTOS.get(ch);
      continue;
    }
    const cod = ch.codePointAt(0);
    if (cod === 10 || (cod >= 32 && cod <= 126) || (cod >= 160 && cod <= 255)) {
      saida += ch;
      continue;
    }
    saida += " ";
  }
  return saida;
}

function quebrarLinhas(texto, fonte, tamanho, largura) {
  const linhas = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(teste, tamanho) <= largura) {
        atual = teste;
        continue;
      }
      if (atual) linhas.push(atual);
      atual = palavra;
    }
    linhas.push(atual);
  }
  return linhas;
}

async function gerarPdf(paginas, destino, titulo) {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(titulo);
  pdf.setSubject("Memorial descritivo com erros plantados para teste de auditoria");

  const LARGURA = 595;
  const ALTURA = 842;
  const MARGEM = 50;
  const TAM = 9;
  const ALTURA_LINHA = 12;
  const UTIL = LARGURA - MARGEM * 2;
  const MAX_LINHAS = Math.floor((ALTURA - MARGEM * 2) / ALTURA_LINHA);

  paginas.forEach((texto, indice) => {
    const ehCapa = indice === 0;
    const linhas = quebrarLinhas(paraWinAnsi(texto), ehCapa ? negrito : fonte, ehCapa ? 14 : TAM, UTIL);

    for (let inicio = 0; inicio < Math.max(linhas.length, 1); inicio += MAX_LINHAS) {
      const page = pdf.addPage([LARGURA, ALTURA]);
      const bloco = linhas.slice(inicio, inicio + MAX_LINHAS);
      bloco.forEach((linha, i) => {
        page.drawText(linha, {
          x: MARGEM,
          y: ALTURA - MARGEM - (ehCapa ? 120 : 0) - (i + 1) * (ehCapa ? 24 : ALTURA_LINHA),
          size: ehCapa ? 14 : TAM,
          font: ehCapa ? negrito : fonte,
          color: rgb(0.08, 0.08, 0.08),
        });
      });
      if (ehCapa) break; // capa nunca transborda
    }
  });

  fs.writeFileSync(destino, await pdf.save());
  return pdf.getPageCount();
}

/* ---------------------------------------------------------------- montagem */

const clone = (paginas) => paginas.slice();

/** Acrescenta um parágrafo ao fim da página (índice 0-based do array montado). */
function anexar(paginas, indice, frase) {
  if (!paginas[indice]) throw new Error(`pagina ${indice} inexistente no recorte`);
  paginas[indice] = `${paginas[indice]} ${frase}`;
  return paginas;
}

function substituirTudo(paginas, de, para) {
  return paginas.map((t) => t.replace(de, para));
}

const RODAPE_OK =
  "PREFEITURA MUNICIPAL DE CRICIUMA - 116-25 - UBS RENASCER - PORTE 2 - PROJETO EXECUTIVO";

const main = async () => {
  console.log("Extraindo base:", path.basename(BASE_PDF));
  const brutas = await extrairPaginas(BASE_PDF);
  const limpas = sanear(brutas);

  const textoLimpo = limpas.join("\n");
  const sobrou = GUARDAS_BASE.filter(([, re]) => re.test(textoLimpo));
  if (sobrou.length) {
    console.error("Base nao ficou limpa:", sobrou.map(([n]) => n).join(", "));
    process.exit(1);
  }
  console.log(`Base saneada: ${limpas.length} paginas, ${textoLimpo.length} chars`);

  fs.mkdirSync(SAIDA, { recursive: true });

  // Recortes: capa + 2 paginas de sumario + corpo. Manter o corpo contiguo para
  // o texto continuar fazendo sentido de cabo a rabo.
  const recorte = (fim) => [limpas[0], limpas[2], limpas[3], ...limpas.slice(11, fim)];
  const CORPO = 3; // indice da 1a pagina de corpo no recorte

  const arquivos = [];

  /* 01 — identidade: capa x corpo + obras intrusas ------------------------- */
  {
    const p = recorte(75);
    p[0] =
      "ESTADO DE SANTA CATARINA GOVERNO DO MUNICIPIO DE CRICIUMA. " +
      "CENTRO COMUNITARIO PRIMEIRA LINHA. VOLUME 1 - MEMORIAL DESCRITIVO. 116-25 OUTUBRO/2025";
    anexar(p, CORPO + 4,
      "O sistema de climatizacao do Centro Dia do Idoso devera atender aos ambientes de permanencia prolongada, conforme projeto complementar.");
    anexar(p, CORPO + 17,
      "As esquadrias da Cidade do Autista seguem o padrao de aluminio anodizado especificado no projeto arquitetonico.");
    anexar(p, CORPO + 29,
      "O layout dos ambientes infantis foi aprovado para a Creche Vovo Marieta e devera ser reproduzido sem alteracoes.");
    anexar(p, CORPO + 41,
      "O acesso principal da escola sera mantido em operacao durante toda a execucao dos servicos.");
    anexar(p, CORPO + 55,
      "PREFEITURA MUNICIPAL DE CRICIUMA - 116-25 - CENTRO COMUNITARIO BOA VISTA - PROJETO EXECUTIVO");
    arquivos.push(["01-identidade-capa-x-corpo.pdf", p, "Memorial com identidade divergente"]);
  }

  /* 02 — contratual: hierarquia, terraplenagem, rodovia, escopo, norma ----- */
  {
    const p = recorte(75);
    anexar(p, CORPO + 7,
      "As especificacoes tecnicas e normas de execucao citadas neste memorial prevalecerao sobre todos os projetos.");
    anexar(p, CORPO + 14,
      "A CONTRATADA devera executar todo movimento de terra necessario ao nivelamento do terreno nas cotas de projeto.");
    anexar(p, CORPO + 21,
      "O greide foi lancado a partir do eixo da rodovia, considerando a superelevacao das pistas entre o Km 12 + 300 e o Km 12 + 780, para velocidades de ate 80 km/h.");
    anexar(p, CORPO + 27,
      "A revitalizacao contempla a recuperacao da alvenaria existente e do pavimento a ser substituido nas areas remanescentes.");
    anexar(p, CORPO + 33,
      "As instalacoes eletricas de baixa tensao foram dimensionadas conforme a NBR 7190 - Projeto de estruturas de madeira.");
    arquivos.push(["02-contratual-e-escopo.pdf", p, "Memorial com contradicoes contratuais"]);
  }

  /* 03 — numérico: área, concessionária, blocos, unidades, cálculo --------- */
  {
    const p = recorte(75);
    anexar(p, CORPO + 2,
      "A area total construida da edificacao e de 813,98 m2, distribuidos em um unico pavimento.");
    anexar(p, CORPO + 9,
      "A area total construida da edificacao totaliza 1.480,00 m2, distribuidos em um unico pavimento.");
    anexar(p, CORPO + 24,
      "Conforme quadro de areas do projeto legal, a area total edificada e de 902,45 m2.");
    anexar(p, CORPO + 12,
      "O fornecimento de energia sera solicitado a concessionaria COOPERA, observadas suas normas de entrada de servico.");
    anexar(p, CORPO + 16,
      "A edificacao e composta por cinco blocos interligados por passarela coberta.");
    anexar(p, CORPO + 31,
      "Os seis blocos possuem cobertura metalica com telha termoacustica e calhas em aco galvanizado.");
    anexar(p, CORPO + 36,
      "O piso tatil de alerta sera assentado com espessura e = 2,5 m sobre o contrapiso regularizado.");
    anexar(p, CORPO + 44,
      "Os guarda-corpos das rampas terao altura de 1,10 mm, conforme detalhe do projeto arquitetonico.");
    anexar(p, CORPO + 50,
      "Foram previstas 12 luminarias de 40 W cada, totalizando 640 W de carga instalada no ambiente.");
    anexar(p, CORPO + 57,
      "A taxa de ocupacao e de 45% sobre o terreno de 1.200,00 m2, resultando em 813,98 m2 de area construida.");
    arquivos.push(["03-numerico-areas-e-unidades.pdf", p, "Memorial com divergencias numericas"]);
  }

  /* 04/05 — par capa x memorial (enviar os DOIS juntos) -------------------- */
  {
    const capa = [
      "ESTADO DE SANTA CATARINA PREFEITURA MUNICIPAL DE CRICIUMA SECRETARIA MUNICIPAL DE SAUDE " +
        "UBS RENASCER - PORTE 2 VOLUME 1 - MEMORIAL DESCRITIVO 116-25 OUTUBRO/2025",
      "IDENTIFICACAO DO PROJETO. " +
        "Obra: UBS Renascer - Porte 2; " +
        "Proprietario: Prefeitura Municipal de Criciuma. " +
        "Municipio: Criciuma; " +
        "Orgao: Secretaria Municipal de Saude; " +
        "Endereco: Rua Pedro Antonio, 355; " +
        "Bairro: Sao Joao; " +
        "Codigo do projeto: 116-25; " +
        "Revisao: B; " +
        "Volume 1 - Memorial Descritivo - Projeto Executivo. " +
        "Prefeitura Municipal de Criciuma. Municipio: Criciuma; Bairro: Sao Joao; " +
        "Endereco: Rua Pedro Antonio, 355; Revisao: B; Codigo do projeto: 116-25; " +
        "Esta capa acompanha o memorial descritivo do volume 1 e integra o conjunto de documentos " +
        "tecnicos entregues a fiscalizacao. Os dados de identificacao acima devem ser conferidos " +
        "contra os demais documentos do volume antes da emissao.",
    ];
    arquivos.push(["04-par-capa.pdf", capa, "Capa do par cross-document"]);

    let p = recorte(60);
    p = substituirTudo(p, /Crici[úu]ma/gi, "Icara");
    p = substituirTudo(p, /CRICI[ÚU]MA/g, "ICARA");
    p = substituirTudo(p, /S[ãa]o Jo[ãa]o/gi, "Santa Barbara");
    p = substituirTudo(p, /Rua Pedro Ant[oô]nio/gi, "Rua Joao Pessoa");
    p[1] =
      "IDENTIFICACAO DO PROJETO. Obra: UBS Renascer - Porte 2; " +
      "Proprietario: Prefeitura Municipal de Icara. Municipio: Icara; " +
      "Orgao: Secretaria Municipal de Obras e Servicos Urbanos; " +
      "Endereco: Rua Joao Pessoa, 1200; Bairro: Santa Barbara; " +
      "Codigo do projeto: 116-26; Revisao: A; " +
      "Prefeitura Municipal de Icara. Municipio: Icara; Bairro: Santa Barbara; " +
      "Endereco: Rua Joao Pessoa, 1200; Revisao: A; Codigo do projeto: 116-26; " +
      p[1];
    arquivos.push(["05-par-memorial.pdf", p, "Memorial do par cross-document"]);
  }

  /* 06 — capa sem texto legível ------------------------------------------- */
  {
    const p = recorte(60);
    p[0] = "116-25";
    arquivos.push(["06-capa-ilegivel.pdf", p, "Memorial com capa sem texto"]);
  }

  /* 07 — sutil: documento longo com 3 erros discretos ---------------------- */
  {
    const p = recorte(140);
    anexar(p, CORPO + 62,
      "O atendimento de urgencia sera referenciado ao Centro de Saude Rio Maina, situado na mesma regiao administrativa.");
    anexar(p, CORPO + 20,
      "A area total construida da edificacao e de 813,98 m2, conforme quadro de areas do projeto arquitetonico.");
    anexar(p, CORPO + 88,
      "Considerando os ajustes de projeto, a area total construida da edificacao e de 831,98 m2.");
    anexar(p, CORPO + 104,
      "A tubulacao de PVC DN 100 mm sera assentada a 1,20 mm de profundidade em relacao ao nivel do passeio.");
    arquivos.push(["07-sutil-tres-erros.pdf", p, "Memorial com poucos erros discretos"]);
  }

  /* 08 — controle limpo (esperado: zero achados) --------------------------- */
  {
    const p = recorte(75);
    anexar(p, CORPO + 11,
      "O fornecimento de energia sera solicitado a concessionaria CELESC Distribuicao S.A., observadas suas normas de entrada de servico.");
    anexar(p, CORPO + 26,
      "O deposito de residuos recicláveis atende lote com area total superior a 1.000 m2, conforme diretriz municipal.");
    anexar(p, CORPO + 40, `A area total construida da edificacao e de 813,98 m2. ${RODAPE_OK}`);
    arquivos.push(["08-controle-limpo.pdf", p, "Memorial de controle sem erros plantados"]);
  }

  for (const [nome, paginas, titulo] of arquivos) {
    const destino = path.join(SAIDA, nome);
    const total = await gerarPdf(clone(paginas), destino, titulo);
    const bytes = fs.statSync(destino).size;
    console.log(`  ${nome} -> ${total} paginas, ${(bytes / 1024).toFixed(0)} KB`);
  }

  console.log(`\nPronto: ${arquivos.length} arquivos em ${SAIDA}`);
};

await main();
