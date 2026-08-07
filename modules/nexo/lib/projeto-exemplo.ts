"use client";

/**
 * O PROJETO DE EXEMPLO do tour guiado.
 *
 * O tutorial precisa apontar para coisas que existem: selo lido, documento
 * gerado, parecer com achados. Na primeira tela do Nexo não existe nenhuma
 * delas — um tour aqui apontaria balões para espaço vazio. Então o exemplo é
 * SEMEADO, pelo mesmo caminho que uma conversa restaurada percorre (IndexedDB →
 * `selectConversation`), e some no fim.
 *
 * O PDF é FABRICADO na hora com pdf-lib, e não versionado no repo: são ~20 KB
 * gerados, e — o que importa mais — o texto é nosso. Como as evidências do
 * parecer são recortadas desse texto, o pin do tutorial cai no trecho certo
 * sempre, em vez de depender da camada de texto de um documento qualquer.
 *
 * NADA aqui chama modelo: o parecer é escrito à mão, com os mesmos tipos de erro
 * que a auditoria de verdade encontra (identidade reaproveitada, ocupação
 * divergente, norma vencida).
 */

import type { AuditReport } from "@/lib/audit-report";
import { deleteConversation, putBlob, putConversation } from "./nexo-db";
import type { StoredConversation } from "./nexo-db";
import type { SeloResult } from "./selo-render";

export const ID_CONVERSA_EXEMPLO = "nexo-exemplo-guiado";
export const TITULO_EXEMPLO = "Exemplo guiado — Escola Municipal Vila Nova";
const ARQUIVO_MEMORIAL = "exemplo_md_geral.pdf";

/**
 * As páginas do memorial de exemplo. Os trechos marcados são os que o parecer
 * cita como evidência — mudar o texto aqui exige mudar lá, ou o pin perde a
 * âncora (é o que `locateTermOnPage` procura na camada de texto).
 */
const PAGINAS_DO_MEMORIAL: { titulo: string; linhas: string[] }[] = [
  {
    titulo: "MEMORIAL DESCRITIVO",
    linhas: [
      "ESCOLA MUNICIPAL VILA NOVA",
      "Prefeitura Municipal de Criciuma - SC",
      "Codigo 042-26 - Revisao A",
      "",
      "Este documento e um EXEMPLO gerado pelo Nexo para o tour guiado.",
      "Nenhum dado aqui pertence a um projeto real.",
    ],
  },
  {
    titulo: "1. OBJETO",
    linhas: [
      "A presente edificacao destina-se a Escola Municipal vila nova, com",
      "capacidade para 240 alunos em dois turnos, conforme programa de",
      "necessidades da Secretaria Municipal de Educacao.",
      "",
      "A area construida total e de 1.284,50 m2, distribuida em dois",
      "pavimentos ligados por rampa e escada enclausurada.",
    ],
  },
  {
    titulo: "2. IMPLANTACAO",
    linhas: [
      "O terreno apresenta declividade suave no sentido norte-sul.",
      "",
      "A implantacao segue a orientacao definida para o Centro Dia do Idoso,",
      "com acesso principal pela via secundaria e patio descoberto ao fundo.",
      "",
      "O passeio publico sera reconstituido em toda a testada do lote.",
    ],
  },
  {
    titulo: "3. ACESSIBILIDADE",
    linhas: [
      "Todos os ambientes de uso publico atendem aos parametros de",
      "acessibilidade previstos na NBR 9050:2004, incluindo rotas acessiveis,",
      "sanitarios adaptados e sinalizacao tatil.",
      "",
      "As portas dos sanitarios acessiveis terao vao livre de 0,80 m.",
    ],
  },
  {
    titulo: "4. INSTALACOES",
    linhas: [
      "O reservatorio superior foi dimensionado para consumo diario de",
      "reserva tecnica de incendio somada ao consumo predial.",
      "",
      "Considerou-se que a unidade basica de saude funcionara em turno",
      "unico, com populacao fixa de 38 pessoas.",
    ],
  },
  {
    titulo: "5. AREAS EXTERNAS",
    linhas: [
      "O estacionamento contempla 18 vagas, sendo 2 acessiveis e 2 para",
      "idosos, conforme legislacao municipal vigente.",
      "",
      "As areas externas do Centro Dia do Idoso recebem piso intertravado",
      "e paisagismo de baixa manutencao.",
    ],
  },
];

/** Gera o PDF do memorial de exemplo. Devolve os bytes. */
async function fabricarMemorial(): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const fonteTitulo = await doc.embedFont(StandardFonts.HelveticaBold);

  PAGINAS_DO_MEMORIAL.forEach((conteudo, i) => {
    const pagina = doc.addPage([595, 842]); // A4 em pontos
    pagina.drawText(conteudo.titulo, {
      x: 64,
      y: 760,
      size: 16,
      font: fonteTitulo,
      color: rgb(0.1, 0.1, 0.1),
    });
    conteudo.linhas.forEach((linha, k) => {
      if (!linha) return;
      pagina.drawText(linha, {
        x: 64,
        y: 710 - k * 22,
        size: 11,
        font: fonte,
        color: rgb(0.15, 0.15, 0.15),
      });
    });
    pagina.drawText(`${i + 1}`, { x: 520, y: 48, size: 9, font: fonte });
  });

  return doc.save();
}

/** Gera a capa de exemplo — é o que dá miniatura de verdade ao mapa do volume. */
async function fabricarCapa(): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const fonteTitulo = await doc.embedFont(StandardFonts.HelveticaBold);
  const pagina = doc.addPage([595, 842]);

  pagina.drawRectangle({ x: 48, y: 48, width: 499, height: 746, borderWidth: 1, borderColor: rgb(0.2, 0.2, 0.2) });
  pagina.drawText("PREFEITURA MUNICIPAL DE CRICIUMA", { x: 80, y: 700, size: 12, font: fonte });
  pagina.drawText("ESCOLA MUNICIPAL", { x: 80, y: 620, size: 26, font: fonteTitulo });
  pagina.drawText("VILA NOVA", { x: 80, y: 586, size: 26, font: fonteTitulo });
  pagina.drawText("PROJETO EXECUTIVO - ARQUITETURA", { x: 80, y: 520, size: 12, font: fonte });
  pagina.drawText("VOLUME 1 DE 1", { x: 80, y: 496, size: 12, font: fonte });
  pagina.drawText("042-26 - REVISAO A", { x: 80, y: 120, size: 11, font: fonte });

  return doc.save();
}

/** Os selos "lidos" das pranchas — o que vira folha no canvas. */
function selosDoExemplo(): SeloResult[] {
  const base = {
    total: 2,
    arquivo: null,
    cliente: "Prefeitura Municipal de Criciuma",
    secretaria: "Secretaria Municipal de Educacao",
    obra: "Escola Municipal Vila Nova",
    fase: "Projeto Executivo",
    tituloSecao: null,
    // Data fixa: o exemplo não pode depender do relógio, senão a capa que ele
    // gera muda de mês sozinha e o passo a passo deixa de bater com a tela.
    data: "MARCO/2026",
    // O brasão concorda com o `cliente` — é o caso normal, e é o que faz o
    // exemplo resolver a prefeitura sozinho, sem perguntar.
    logoOrgao: "Prefeitura Municipal de Criciuma",
    confianca: "alta" as const,
  };
  const folhas: { disciplina: string; folha: number; conteudo: string }[] = [
    { disciplina: "Arquitetura", folha: 1, conteudo: "Planta baixa - pavimento terreo" },
    { disciplina: "Arquitetura", folha: 2, conteudo: "Cortes e fachadas" },
    { disciplina: "Estrutural", folha: 1, conteudo: "Formas - fundacao" },
    { disciplina: "Estrutural", folha: 2, conteudo: "Armacao - pilares" },
  ];

  return folhas.map((f, i) => ({
    fileName: `exemplo_${f.disciplina.slice(0, 3).toLowerCase()}_${f.folha}.pdf`,
    pageNumber: 1,
    pageCount: 1,
    extraction: {
      ...base,
      disciplina: f.disciplina,
      folha: f.folha,
      numeroFolha: `0${f.folha}/02`,
      conteudo: f.conteudo,
    },
    usage: 0,
  }));
}

/**
 * O parecer do exemplo. Escrito à mão, com os erros que a auditoria de verdade
 * encontra: identidade reaproveitada (duas vezes — vira pilha de recorrente),
 * ocupação divergente, norma vencida e uma sugestão rebaixada pela validação.
 */
function parecerDoExemplo(): AuditReport {
  const achado = (
    id: string,
    pagina: string,
    tipo: string,
    evidencia: string,
    conflito: string,
    extra: Partial<AuditReport["incongruencias"][number]> = {},
  ) => ({
    id,
    prioridade: "Alta" as const,
    pagina,
    capitulo: "",
    local: "",
    tipo,
    descricao: "",
    evidencia,
    conflito,
    sugestao_correcao: "Corrigir para a obra deste projeto.",
    confianca: "alta" as const,
    origem: "regra" as const,
    ...extra,
  });

  return {
    tipo_auditoria: "memorial",
    tipo_documento: "memorial descritivo",
    obra: "Escola Municipal Vila Nova",
    codigo: "042-26",
    municipio: "Criciuma",
    data_documento: "",
    status_analise: "concluida",
    status_geral: "com inconsistências críticas",
    total_incongruencias: 5,
    arquivos_analisados: [],
    comparacoes: [],
    conclusao:
      "Documento com texto reaproveitado de outro projeto. Corrigir a identidade da obra antes de emitir.",
    incongruencias: [
      achado(
        "E1",
        "3",
        "Nome da obra divergente",
        "Centro Dia do Idoso",
        "A obra declarada é Escola Municipal Vila Nova.",
      ),
      achado(
        "E2",
        "6",
        "Nome da obra divergente",
        "Centro Dia do Idoso",
        "A obra declarada é Escola Municipal Vila Nova.",
      ),
      achado(
        "E3",
        "5",
        "Ocupação divergente",
        "unidade basica de saude",
        "O documento descreve outra ocupação em capítulo técnico.",
      ),
      achado("E4", "4", "Norma desatualizada", "NBR 9050:2004", "A versão vigente é a NBR 9050:2020.", {
        prioridade: "Media",
      }),
      achado("E5", "2", "Grafia do nome da obra", "vila nova", "Nome próprio em caixa baixa.", {
        prioridade: "Baixa",
        origem: "ia",
        tier: "sugestao",
        confianca: "media",
      }),
    ],
  };
}

/**
 * Semeia o projeto de exemplo e devolve o id da conversa. Idempotente: rodar de
 * novo reescreve o mesmo registro, então rever o tour não enche a sidebar.
 */
export async function criarProjetoExemplo(): Promise<string> {
  const [memorial, capa] = await Promise.all([fabricarMemorial(), fabricarCapa()]);
  const convId = ID_CONVERSA_EXEMPLO;

  // `new Uint8Array(bytes)` copia para um ArrayBuffer comum: o que o pdf-lib
  // devolve pode estar sobre um buffer compartilhado, que não serve de BlobPart.
  await putBlob(
    `${convId}:memorial`,
    new Blob([new Uint8Array(memorial)], { type: "application/pdf" }),
  );
  await putBlob(
    `${convId}:exemplo-capa:PDF`,
    new Blob([new Uint8Array(capa)], { type: "application/pdf" }),
  );

  const agora = Date.now();
  const registro: StoredConversation = {
    id: convId,
    title: TITULO_EXEMPLO,
    createdAt: agora,
    updatedAt: agora,
    messages: [
      {
        id: "ex-1",
        role: "user",
        content: "Anexei 4 pranchas — Escola Municipal Vila Nova",
      },
      {
        id: "ex-2",
        role: "assistant",
        content:
          "Li os selos das 4 folhas: Arquitetura (2) e Estrutural (2), da Escola Municipal Vila Nova, Prefeitura Municipal de Criciuma. Preparei a capa do volume.",
      },
      { id: "ex-3", role: "user", content: "audita o memorial" },
      {
        id: "ex-4",
        role: "assistant",
        content:
          "Auditoria concluída: 5 achados, sendo 3 críticos de identidade. O parecer está no palco.",
      },
    ],
    seloResults: selosDoExemplo(),
    results: [
      {
        artifactId: "exemplo-capa",
        kind: "capa",
        summary: "Capa do volume 1",
        canvas: {
          label: "CAPA",
          detail: "042-26 · rev. A",
          titulo: "Escola Municipal Vila Nova",
          pageNumber: 1,
        },
        files: [
          {
            label: "PDF",
            name: "exemplo_capa.pdf",
            mime: "application/pdf",
            blobKey: `${convId}:exemplo-capa:PDF`,
            primary: true,
          },
        ],
        generatedAt: agora,
      },
      {
        artifactId: "exemplo-auditoria",
        kind: "auditoria",
        summary: "Auditoria do memorial",
        files: [],
        payload: {
          auditId: null,
          texto: "RESULTADO DA AUDITORIA (exemplo)",
          report: parecerDoExemplo(),
        },
        generatedAt: agora,
      },
    ],
    memorial: {
      name: ARQUIVO_MEMORIAL,
      blobKey: `${convId}:memorial`,
      dossie: {
        obra: "Escola Municipal Vila Nova",
        orgao: "Prefeitura Municipal de Criciuma",
        municipio: "Criciuma",
        codigo: "042-26",
        disciplinas: ["Arquitetura", "Estrutural"],
        volumes: [],
        semVolume: [],
        arquivos: [],
      },
    },
  };

  await putConversation(registro);
  return convId;
}

/** Apaga o exemplo e seus blobs. O tour termina sem deixar rastro na sidebar. */
export async function removerProjetoExemplo(): Promise<void> {
  await deleteConversation(ID_CONVERSA_EXEMPLO);
}
