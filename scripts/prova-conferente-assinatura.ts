/**
 * A SEGUNDA ASSINATURA CONTRA REGRA QUE ERROU — Encaixe 1.
 *
 *   npm run prova:conferente-assinatura
 *
 * O PORTÃO TEM DOIS LADOS, e o segundo é o que importa mais.
 *
 * Contestar os falsos positivos documentados é metade do trabalho. A outra
 * metade é NÃO contestar as regras que estão certas — porque contestação
 * errada é ruído no parecer do engenheiro, e ruído ensina o time a ignorar a
 * contestação, inclusive no dia em que ela acerta.
 *
 * O gabarito são os três defeitos NOSSOS já escritos nos comentários do código
 * (`lib/contestacao-de-regra.ts` e `audit-coherence.ts`), mais achados de regra
 * que eu conferi no PDF em 21/09/2026 e que estão certos.
 *
 * Custa ~8 chamadas de ~400 tokens de entrada; saída de graça.
 */
import assert from "node:assert/strict";

import type { AuditFinding } from "../lib/audit-report.ts";
import { assinarAchadoDeRegra } from "../lib/conferente/encaixe-1-assinatura.ts";
import { conferenteEstaConfigurado } from "../lib/conferente/jev.ts";

type Caso = { rotulo: string; deveContestar: boolean; finding: AuditFinding };

function regra(partial: Partial<AuditFinding>): AuditFinding {
  return {
    id: partial.id ?? "COER-001",
    arquivo: "memorial.pdf",
    origem: "regra",
    confianca: "alta",
    prioridade: "Media",
    pagina: partial.pagina ?? "1",
    capitulo: partial.capitulo ?? "",
    local: partial.local ?? "",
    tipo: partial.tipo ?? "",
    descricao: partial.descricao ?? "",
    evidencia: partial.evidencia ?? "",
    conflito: partial.conflito ?? "",
    sugestao_correcao: partial.sugestao_correcao ?? "",
    ...partial,
  } as AuditFinding;
}

const CASOS: Caso[] = [
  // ---- A REGRA ERROU: os três defeitos nossos já documentados -------------
  {
    rotulo: "117-25 · UBS VILA MANAUS x Unidade Básica de Saúde Vila Manaus",
    deveContestar: true,
    finding: regra({
      id: "F-001",
      tipo: "Nome da obra divergente entre documentos",
      evidencia: '"UBS VILA MANAUS"',
      conflito:
        'O nome da obra no documento ("UBS VILA MANAUS") diverge do gabarito da capa ("Unidade Básica de Saúde Vila Manaus").',
      referencia_comparada: '"Unidade Básica de Saúde Vila Manaus"',
    }),
  },
  {
    rotulo: "084-25 · 'ginásio' solto x gabarito com parêntese",
    deveContestar: true,
    finding: regra({
      id: "F-002",
      pagina: "181",
      tipo: "Nome da obra divergente entre documentos",
      evidencia: '"a cobertura do ginásio deverá receber calhas em chapa galvanizada"',
      conflito:
        'A palavra "ginásio" aparece isolada, sem o nome completo declarado na capa ("Ginásio de Esportes (Cobertura de Quadra) — Escola Geral").',
      referencia_comparada: '"Ginásio de Esportes (Cobertura de Quadra) — Escola Geral"',
    }),
  },
  {
    rotulo: "marca · 'Suvinil similar' recusado por não dizer 'ou similar'",
    deveContestar: true,
    finding: regra({
      id: "F-003",
      tipo: "Marca especificada sem a ressalva 'ou similar'",
      evidencia: '"tinta acrílica semibrilho Suvinil similar, aplicada em duas demãos"',
      conflito:
        'O próprio memorial adota o padrão "<marca> ou similar" na maioria das especificações; nesta a ressalva está ausente, fechando a marca.',
    }),
  },

  // ---- A REGRA ACERTOU: conferidos por mim no PDF -------------------------
  {
    rotulo: "129-24 · hierarquia documental contraditória (regra certa)",
    deveContestar: false,
    finding: regra({
      id: "C-001",
      pagina: "10 e 14",
      tipo: "Hierarquia documental contraditória",
      evidencia:
        'Pág. 10: "Em caso de divergência entre as especificações e os projetos, sempre prevalecerão os projetos." | Pág. 14: "As especificações técnicas e normas de execução citadas neste memorial prevalecerão sobre todos os projetos."',
      conflito:
        "Projetos prevalecem (pág. 10) × especificações prevalecem sobre os projetos (pág. 14). As duas cláusulas se anulam.",
    }),
  },
  {
    rotulo: "129-24 · peça citada que o documento não lista (regra certa)",
    deveContestar: false,
    finding: regra({
      id: "C-002",
      pagina: "22",
      tipo: "Peça citada que o documento não lista",
      evidencia:
        'p. 22: "A procedência e a destinação desses materiais são apresentadas no Volume 2 – Quadro de Origem e Destino."',
      conflito:
        "A capa declara este documento como Vol. I e o item 1.3 lista oito peças, nenhuma delas um Volume 2. A peça citada nunca é declarada.",
    }),
  },
  {
    rotulo: "025-24 · linguagem rodoviária em urbanização de praças (regra certa)",
    deveContestar: false,
    finding: regra({
      id: "C-003",
      pagina: "15, 17, 18, 23, 122",
      tipo: "Linguagem de projeto rodoviário não adaptada",
      evidencia:
        'Pág. 18: "As distâncias foram determinadas entre os centros de gravidade de origem e destino das massas transportadas, projetados sobre o eixo da rodovia."',
      conflito:
        "6 termos de projeto rodoviário (eixo da rodovia, corpo estradal, superelevação das pistas, hierarquização das vias) numa obra de urbanização de três praças.",
    }),
  },
  {
    rotulo: "129-24 · Secretaria de Educação em obra da Infraestrutura (regra certa)",
    deveContestar: false,
    finding: regra({
      id: "C-004",
      pagina: "17",
      tipo: "Órgão divergente do declarado na capa",
      evidencia: '"placa padrão da Secretaria Municipal de Educação"',
      conflito:
        'O rodapé de todas as páginas declara "SMI/PMF" e a capa declara "SECRETARIA MUNICIPAL DE INFRAESTRUTURA".',
      referencia_comparada: '"SECRETARIA MUNICIPAL DE INFRAESTRUTURA"',
    }),
  },
];

async function main() {
  if (!conferenteEstaConfigurado()) {
    console.log("JEV_API_KEY não configurada — prova pulada (e o parecer sai sem contestação).");
    return;
  }

  const erros: string[] = [];
  const largura = Math.max(...CASOS.map((caso) => caso.rotulo.length));

  for (const caso of CASOS) {
    const assinatura = await assinarAchadoDeRegra(caso.finding);

    if (!assinatura) {
      console.error(`FALHOU  conferente não respondeu para ${caso.rotulo}`);
      process.exitCode = 1;
      return;
    }

    const contestou = Boolean(assinatura.contestacao);
    const certo = contestou === caso.deveContestar;

    console.log(
      `  ${certo ? "ok  " : "ERRO"}  ${caso.rotulo.padEnd(largura)}  sustenta=${assinatura.sustenta.toFixed(2)}  inocente=${assinatura.inocente.toFixed(2)}  ${contestou ? "CONTESTOU" : "assinou"}`,
    );

    if (assinatura.contestacao) {
      console.log(`         └─ ${assinatura.contestacao.motivo}`);
    }

    if (!certo) {
      erros.push(
        caso.deveContestar
          ? `${caso.rotulo}: era falso positivo conhecido e passou batido`
          : `${caso.rotulo}: a regra está certa e o conferente contestou`,
      );
    }
  }

  /*
   * O SEGUNDO LADO DO PORTÃO É O MAIS APERTADO.
   *
   * Contestar regra certa é pior que deixar passar falso positivo: o falso
   * positivo já vai para o parecer hoje e alguém confere; a contestação errada
   * ensina o time a ignorar a coluna inteira. Por isso este `assert` não
   * tolera nenhuma, enquanto o de cima é reportado junto.
   */
  const contestouRegraCerta = erros.filter((erro) => erro.includes("a regra está certa"));
  assert.equal(
    contestouRegraCerta.length,
    0,
    `o conferente contestou regra que está certa:\n  ${contestouRegraCerta.join("\n  ")}`,
  );

  assert.equal(erros.length, 0, `assinatura errou em:\n  ${erros.join("\n  ")}`);

  console.log("\nok  contestou os 3 falsos positivos documentados e assinou as 4 regras certas");
}

await main();
