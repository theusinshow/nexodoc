// OS DOCUMENTOS DE TESTE da segunda rodada — sintéticos, gerados aqui.
//
// O repositório é público: memorial ou prancha de verdade é dado de cliente. A
// receita fica em código, onde um diff mostra o que mudou; os PDFs nascem em
// memória e vão para `scratchpad/bateria/fixtures/`, que o git ignora. Cada
// propriedade de que uma jornada depende está provada em
// `scripts/test-fixtures-da-bateria.ts`, contra o leitor do próprio produto.
import fs from "node:fs";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const PASTA_DAS_FIXTURES = path.join("scratchpad", "bateria", "fixtures");

export const NOMES = {
  memorialCurto: "990_26_md_bateria_a.pdf",
  memorialComFolhaMuda: "991_26_md_bateria_muda_a.pdf",
  // SEM "memorial_" NO NOME: medido em 15/09/2026, `memorial_bateria_sem_codigo.pdf`
  // não tem `md` isolado por separador nem `\bmemorial\b` — `parseFilename`
  // (server/nexo/parse-filename.ts) classifica como `outro`, e a bateria ia 6/7.
  // Com `md_` no começo o nome cai no mesmo `md` isolado que decide memorial, e
  // ainda assim não carrega código nenhum (sem `\d{2,4}[_-]\d{2}` no início).
  memorialSemCodigo: "md_bateria_sem_codigo.pdf",
  pranchas: ["990_26_est_001_a.pdf", "990_26_est_002_a.pdf", "990_26_est_003_a.pdf"],
  pranchaSemSelo: "990_26_est_004_a.pdf",
};

// Datas fixas e `updateMetadata: false`: sem isso o pdf-lib carimba a hora da
// geração, e duas corridas produziriam arquivos diferentes do mesmo documento.
const DATA_FIXA = new Date("2026-09-15T12:00:00Z");

async function novoDocumento(titulo) {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle(titulo);
  doc.setProducer("bateria nexodoc");
  doc.setCreator("bateria nexodoc");
  doc.setCreationDate(DATA_FIXA);
  doc.setModificationDate(DATA_FIXA);
  return doc;
}

/** Quebra um parágrafo na largura útil, como `gera-memoriais-defeituosos.mjs`. */
function quebrarLinhas(texto, fonte, tamanho, largura) {
  const linhas = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(teste, tamanho) <= largura) {
      atual = teste;
      continue;
    }
    if (atual) linhas.push(atual);
    atual = palavra;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/*
 * O TEXTO DO MEMORIAL. Nenhum par número-separador-dois-dígitos fora do código
 * do cabeçalho: `\b\d{2,4}[_-]\d{2}\b` (lib/audit-classify.ts) não distingue
 * código de data, e um "10-25" aqui daria código ao memorial que precisa não ter.
 */
function paginasDoMemorial(codigo) {
  const cabecalho = [
    "MEMORIAL DESCRITIVO",
    "Obra: Centro Comunitário da Bateria",
    "Prefeitura Municipal de Cidade Fictícia",
    ...(codigo ? [`Centro de custo: ${codigo}`] : []),
  ];
  return [
    [
      ...cabecalho,
      "1. APRESENTAÇÃO",
      "Este memorial descreve a reforma do centro comunitário usado somente pelos testes automatizados do NexoDoc.",
      "O documento é sintético e não corresponde a nenhuma obra real, cliente ou prefeitura existente no estado.",
      "A edificação tem um pavimento térreo com salão principal, cozinha, dois sanitários e depósito de materiais.",
    ],
    [
      "2. ESTRUTURA E VEDAÇÕES",
      "As fundações serão em sapatas isoladas de concreto armado, dimensionadas conforme o laudo de sondagem do terreno.",
      "As paredes externas serão em blocos cerâmicos de oito furos, com revestimento em argamassa e pintura acrílica.",
      "A cobertura será em telha metálica termoacústica com inclinação mínima de cinco por cento sobre estrutura de aço.",
    ],
    [
      "3. INSTALAÇÕES",
      "O reservatório superior terá capacidade de dez metros cúbicos conforme o projeto hidrossanitário da edificação.",
      "As instalações elétricas seguem a NBR 5410 e o padrão de entrada da concessionária de energia do município.",
      "Os sanitários terão barras de apoio e portas com largura livre adequada à acessibilidade prevista na norma técnica.",
    ],
  ];
}

async function memorialBytes({ titulo, codigo, comFolhaMuda }) {
  const doc = await novoDocumento(titulo);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  for (const linhasDaPagina of paginasDoMemorial(codigo)) {
    const pagina = doc.addPage([595, 842]);
    let y = 780;
    for (const paragrafo of linhasDaPagina) {
      for (const linha of quebrarLinhas(paragrafo, fonte, 10, 495)) {
        pagina.drawText(linha, { x: 50, y, size: 10, font: fonte, color: rgb(0.08, 0.08, 0.08) });
        y -= 16;
      }
      y -= 8;
    }
  }
  if (comFolhaMuda) {
    // A FOLHA MUDA: só desenho. Retângulo e linha viram `constructPath`, que é o
    // que `medirTinta` conta — e zero caractere de texto.
    const pagina = doc.addPage([595, 842]);
    pagina.drawRectangle({ x: 80, y: 420, width: 435, height: 320, borderColor: rgb(0, 0, 0), borderWidth: 1.5 });
    for (let i = 0; i < 8; i++) {
      pagina.drawLine({ start: { x: 100, y: 440 + i * 36 }, end: { x: 495, y: 440 + i * 36 }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
    }
  }
  return doc.save();
}

/*
 * A PRANCHA. A1 em paisagem (1684×1191 pt), acima do limite de papel pequeno.
 * O carimbo fica no canto inferior direito, com o valor de cada campo UMA LINHA
 * ABAIXO do rótulo — o desenho da família `est`, que `conteudoDoSelo` lê pela
 * célula. Rótulo e valor são `drawText` separados: as âncoras só contam quando o
 * item é o rótulo sozinho.
 */
async function pranchaBytes({ arquivo, conteudo, folha, total, legivel }) {
  const doc = await novoDocumento(arquivo);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const pagina = doc.addPage([1684, 1191]);
  pagina.drawRectangle({ x: 20, y: 20, width: 1644, height: 1151, borderColor: rgb(0, 0, 0), borderWidth: 2 });
  for (let i = 0; i < 6; i++) {
    pagina.drawLine({ start: { x: 120, y: 360 + i * 120 }, end: { x: 1100, y: 360 + i * 120 }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
  }
  pagina.drawRectangle({ x: 1300, y: 30, width: 364, height: 260, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  if (legivel) {
    const campos = [
      ["CLIENTE:", "PREFEITURA MUNICIPAL DE CIDADE FICTICIA"],
      ["OBRA:", "CENTRO COMUNITARIO DA BATERIA"],
      ["CONTEÚDO:", conteudo],
      ["ESCALA:", "INDICADA"],
      ["PRANCHA:", `${String(folha).padStart(2, "0")}/${String(total).padStart(2, "0")}`],
      ["ARQUIVO:", arquivo],
    ];
    let y = 260;
    for (const [rotulo, valor] of campos) {
      pagina.drawText(rotulo, { x: 1320, y, size: 9, font: fonte });
      pagina.drawText(valor, { x: 1320, y: y - 13, size: 9, font: fonte });
      y -= 38;
    }
  }
  return doc.save();
}

export async function bytesDasFixtures() {
  const saida = {};
  saida[NOMES.memorialCurto] = await memorialBytes({ titulo: "memorial curto", codigo: "990-26", comFolhaMuda: false });
  saida[NOMES.memorialComFolhaMuda] = await memorialBytes({ titulo: "memorial com folha muda", codigo: "991-26", comFolhaMuda: true });
  saida[NOMES.memorialSemCodigo] = await memorialBytes({ titulo: "memorial sem codigo", codigo: null, comFolhaMuda: false });
  for (const [i, nome] of NOMES.pranchas.entries()) {
    saida[nome] = await pranchaBytes({
      arquivo: nome.replace(/\.pdf$/, ""),
      conteudo: `PLANTA DE FORMAS DO BLOCO ${"ABC"[i]}`,
      folha: i + 1,
      total: NOMES.pranchas.length,
      legivel: true,
    });
  }
  saida[NOMES.pranchaSemSelo] = await pranchaBytes({ arquivo: "", conteudo: "", folha: 4, total: 4, legivel: false });
  return saida;
}

/** Grava (ou regrava, se a receita mudou) e devolve os caminhos para `ctx.anexar`. */
export async function garantirFixtures() {
  fs.mkdirSync(PASTA_DAS_FIXTURES, { recursive: true });
  const bytes = await bytesDasFixtures();
  for (const [nome, dados] of Object.entries(bytes)) {
    const destino = path.join(PASTA_DAS_FIXTURES, nome);
    const atual = fs.existsSync(destino) ? fs.readFileSync(destino) : null;
    if (!atual || !atual.equals(Buffer.from(dados))) fs.writeFileSync(destino, dados);
  }
  const caminho = (nome) => path.join(PASTA_DAS_FIXTURES, nome);
  return {
    memorialCurto: caminho(NOMES.memorialCurto),
    memorialComFolhaMuda: caminho(NOMES.memorialComFolhaMuda),
    memorialSemCodigo: caminho(NOMES.memorialSemCodigo),
    pranchas: NOMES.pranchas.map(caminho),
    pranchaSemSelo: caminho(NOMES.pranchaSemSelo),
  };
}
