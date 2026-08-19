/**
 * QUAL `motivo` de `casarPrefeituraDoCarimbo` dispara nos projetos reais.
 *
 *   node scripts/mede-prefeitura.ts     (== npm run mede:prefeitura)
 *
 * ## Por que esta bancada existe
 *
 * A decisão do produto é que a prefeitura TEM de ser cravada — volume emitido
 * para o município errado é o pior defeito que este software pode cometer.
 * Mas "põe IA" não é resposta até se saber POR QUE ela não crava hoje, e
 * `casarPrefeituraDoCarimbo` já responde isso desde sempre, num campo que
 * ninguém nunca olhou:
 *
 *   sem-evidencia        → o campo não foi lido. Leitura melhor resolve.
 *   so-texto / so-logo   → uma evidência só bastou. Já crava.
 *   texto-e-logo         → as duas concordaram. Crava com folga.
 *   divergem / ambiguo   → a evidência se CONTRADIZ, ou aponta duas
 *                          prefeituras. IA nenhuma resolve isso: decidir por
 *                          cima de contradição é exatamente o chute que
 *                          produziu o incidente Florianópolis.
 *
 * A diferença entre esses dois grupos decide trabalho diferente. Tratá-los
 * igual é como se fabrica um incidente de prefeitura trocada.
 *
 * ## O gabarito é de graça
 *
 * O rodapé de toda LD entregue traz o caminho de rede do escritório —
 * `P:\cad\prefchap\040_26\...` —, ou seja, **o id do template está IMPRESSO no
 * documento**. Quatro projetos reais viram quatro casos com resposta conhecida,
 * sem gastar um token.
 *
 * ## O limite, dito na cara
 *
 * `logoOrgao` sai do BRASÃO e só existe com modelo de visão: aqui ele é `null`.
 * O `cliente` é o texto determinístico da página. O que se mede é **se o texto
 * sozinho crava a prefeitura** — é o PISO, não o teto.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { extractPdfText } from "../lib/pdf-text.ts";
import { ESCRITORIO } from "../lib/escritorio.ts";
import {
  casarPrefeituraDoCarimbo,
  type AgentPrefeitura,
} from "../server/nexo/agent/normalize.ts";

const RAIZ = "docs/samples";
const CAPAS = "templates/capas";

/** As prefeituras reais, lidas dos modelos — a MESMA lista que a produção usa. */
function prefeiturasReais(): AgentPrefeitura[] {
  return readdirSync(CAPAS)
    .filter((d) => existsSync(join(CAPAS, d, "config.json")))
    .map((d) => {
      const cfg = JSON.parse(readFileSync(join(CAPAS, d, "config.json"), "utf8"));
      return { id: String(cfg.id), nome: String(cfg.nome) };
    });
}

function todasAsLds(dir: string, achados: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) todasAsLds(p, achados);
    else if (/_ld_.*\.pdf$/i.test(e.name)) achados.push(p);
  }
  return achados;
}

/** O id do template impresso no rodapé: `P:\cad\prefchap\...`. */
function gabaritoDoRodape(texto: string, prefeituras: AgentPrefeitura[]): string | null {
  for (const p of prefeituras) {
    if (new RegExp(`[\\\\/]${p.id}[\\\\/]`, "i").test(texto)) return p.id;
  }
  return null;
}

const prefeituras = prefeiturasReais();
console.log(`prefeituras configuradas: ${prefeituras.map((p) => p.id).join(", ")}`);
console.log(`escritório declarado: ${ESCRITORIO.nome} (${ESCRITORIO.municipio})\n`);

const porMotivo = new Map<string, number>();
let acertos = 0;
let comGabarito = 0;
let semGabarito = 0;
const erros: string[] = [];
const contaminados: string[] = [];

for (const caminho of todasAsLds(RAIZ)) {
  const extraido = await extractPdfText(readFileSync(caminho));
  const esperado = gabaritoDoRodape(extraido.text, prefeituras);
  if (!esperado) {
    semGabarito += 1;
    continue;
  }

  /*
   * O CAMINHO DE REDE SAI ANTES DE CASAR. Ele é o gabarito; deixá-lo entrar
   * faria a bancada medir a si mesma e devolver 100% sem significar nada.
   *
   * O que sobra é o rodapé impresso ("SECRETARIA ... – 040_26 – ..."), que é o
   * mesmo tipo de texto que o campo `cliente` do carimbo carrega.
   */
  const semCaminho = extraido.text.replace(/[A-Z]:\\[^\s]+/gi, " ");
  /*
   * A BANCADA CONFERE A SI MESMA.
   *
   * Se o id do gabarito sobreviver à limpeza, o casamento pode acertar por ler
   * a PRÓPRIA RESPOSTA, e o número viraria uma garantia que ninguém deu. Um
   * caso contaminado sai da conta — e aparece no relatório, porque descartar em
   * silêncio é o mesmo defeito com outra roupa.
   */
  if (new RegExp(esperado, "i").test(semCaminho)) {
    contaminados.push(caminho);
    continue;
  }
  comGabarito += 1;
  const r = casarPrefeituraDoCarimbo(
    [{ cliente: semCaminho, logoOrgao: null }],
    prefeituras,
    ESCRITORIO,
  );
  const motivo = r?.motivo ?? "(indefinido)";
  porMotivo.set(motivo, (porMotivo.get(motivo) ?? 0) + 1);

  if (r?.resolvedId === esperado) acertos += 1;
  else {
    erros.push(
      `${caminho}\n      esperado=${esperado}  lido=${r?.resolvedId ?? "null"}  motivo=${motivo}`,
    );
  }
}

const pct = comGabarito ? Math.round((acertos / comGabarito) * 100) : 0;
console.log(`LDs com gabarito no rodapé: ${comGabarito}   (sem gabarito: ${semGabarito})`);
console.log(`cravou certo: ${acertos}/${comGabarito} (${pct}%)\n`);
console.log("motivo:");
for (const [m, n] of [...porMotivo.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${m}`);
}
if (contaminados.length) {
  console.log(`\nFORA DA CONTA — o gabarito sobreviveu à limpeza em ${contaminados.length}:`);
  for (const c of contaminados) console.log(`  ${c}`);
}
if (erros.length) {
  console.log("\nnão cravou:");
  for (const e of erros) console.log(`  ${e}`);
}
console.log(
  "\nLIMITE: `logoOrgao` (o brasão) é null aqui — ele só existe com modelo de visão.",
);
console.log("Este número é o PISO: o que o TEXTO sozinho consegue cravar.");
