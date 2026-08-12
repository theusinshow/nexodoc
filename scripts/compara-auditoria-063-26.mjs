/**
 * Compara o resultado de uma auditoria do 063_26_md_geral_a.pdf contra o
 * gabarito da comparação externa de 12/08/2026.
 *
 * Uso:
 *   node scripts/compara-auditoria-063-26.mjs <relatorio.json>
 *
 * O gabarito é a união dos achados das duas auditorias anteriores:
 *  - "ambos"      = achado que a auditoria externa E o NexoDoc já pegavam;
 *  - "so_externo" = achado que só a auditoria externa pegava (o que queremos ganhar);
 *  - "nenhum"     = defeito conhecido que nenhuma das duas pegou (bônus).
 *
 * O casamento é por palavra-chave no texto inteiro do achado. É indicativo, não
 * prova: serve para dizer ONDE olhar, e a conferência final é a leitura humana.
 */
import { readFileSync } from "node:fs";

const ALVOS = [
  // --- os dois críticos que o NexoDoc perdia -------------------------------
  { id: "sumario", origem: "so_externo", nome: "Sumário incompatível com o corpo", termos: [/sum[áa]rio/i], exige: [/cap[íi]tulo|corpo|p[áa]gina/i] },
  { id: "bloco-abc", origem: "so_externo", nome: '"Bloco ABC" (resíduo de outro projeto)', termos: [/bloco\s+abc/i] },

  // --- aritmética: o caso emblemático da proibição de calcular --------------
  { id: "carga-incendio-conta", origem: "so_externo", nome: "Erro aritmético na carga de incêndio", termos: [/3\.?309|3\.?084|3\.?127|2\.?862|2\.?680/] },
  { id: "carga-incendio", origem: "ambos", nome: "Tabela de carga de incêndio", termos: [/carga de inc[êe]ndio|potencial calor[íi]fico/i] },

  // --- já pegos pelas duas -------------------------------------------------
  { id: "xxxx", origem: "ambos", nome: "Campos XXXX não preenchidos", termos: [/xxxx/i] },
  { id: "primeira-linha", origem: "ambos", nome: '"Centro Comunitário Primeira Linha"', termos: [/primeira linha/i] },
  { id: "hierarquia", origem: "ambos", nome: "Hierarquia documental contraditória", termos: [/prevalec/i] },
  { id: "torre", origem: "ambos", nome: "Torre do reservatório", termos: [/torre do reservat/i] },
  { id: "kgf", origem: "ambos", nome: "25 kgf x 245.166,25 N", termos: [/25\.?000\s*kgf|25\s*kgf|245\.?166/i] },
  { id: "nr10", origem: "ambos", nome: "NR-10 itens 17.5/17.6", termos: [/17\.5|17\.6/] },
  { id: "pead", origem: "ambos", nome: "PEAD (PVC) contraditório", termos: [/pead/i] },
  { id: "pilar", origem: "ambos", nome: "Pilar 8+6 barras Ø12,5", termos: [/06 barras|8 barras|12[.,]5\s*mm/i] },
  { id: "desforma", origem: "ambos", nome: "Desforma 14/21 dias", termos: [/desforma|pontalete/i] },
  { id: "sanitario", origem: "ambos", nome: "Sanitário masculino inacessível na vistoria", termos: [/inacess[íi]vel|visita t[ée]cnica/i] },
  { id: "piso", origem: "ambos", nome: "Cimento queimado x tinta acrílica", termos: [/cimento queimado/i] },
  { id: "cei-pcmat", origem: "ambos", nome: "CEI / PCMAT / NR-18", termos: [/pcmat|\bcei\b/i] },
  { id: "761", origem: "ambos", nome: "761 pessoas x população flutuante", termos: [/761/] },

  // --- só a auditoria externa pegava ---------------------------------------
  { id: "atpf", origem: "so_externo", nome: "ATPF substituída pelo DOF", termos: [/atpf|\bdof\b/i] },
  { id: "lux", origem: "so_externo", nome: "Iluminação de emergência 3 lux / 5 lux", termos: [/lux/i] },
  { id: "portas-alu", origem: "so_externo", nome: "Pintura eletrostática x anodizado", termos: [/eletrost[áa]tica|anodizado/i] },
  { id: "ferragens", origem: "so_externo", nome: "Ferragens: mesmo material x inox", termos: [/ferragen/i] },
  { id: "azulejo-dup", origem: "so_externo", nome: "Duplicação editorial dos azulejos", termos: [/tijolinho|azulejo/i] },
  { id: "spda-metodos", origem: "so_externo", nome: 'SPDA: "dois métodos" com um só descrito', termos: [/dois m[ée]todos/i] },
  { id: "spda-explosao", origem: "so_externo", nome: "SPDA: sem risco de incêndio, fator 0,00", termos: [/sem risco de (explos|inc)/i] },
  { id: "isolamento-risco", origem: "so_externo", nome: "Isolamento de Risco órfão (item XII)", termos: [/isolamento de risco/i] },
  { id: "areas", origem: "so_externo", nome: "Áreas não consolidadas (846,90 x quadro)", termos: [/846[.,]90/] },
  { id: "crea", origem: "so_externo", nome: "CREA: Engenharia e Arquitetura", termos: [/engenharia e arquitetura/i] },
  { id: "macaneta", origem: "so_externo", nome: "Maçanetas 1,00 m com exceção incompleta", termos: [/ma[çc]aneta/i] },
  { id: "sabonete", origem: "so_externo", nome: '"conforme na cor: Preto"', termos: [/porta sabonete|conforme na cor/i] },
  { id: "vento", origem: "so_externo", nome: "Vento: S1 x S2 topografia/rugosidade", termos: [/\bs1\b|\bs2\b|rugosidade/i] },
  { id: "caixa-20cm", origem: "so_externo", nome: "Caixas enterradas 20 cm", termos: [/enterrad/i] },
  { id: "redacao", origem: "so_externo", nome: "Erros de redação (apredes, O o projeto...)", termos: [/apredes|o o projeto|metologia|foi adota/i] },
];

const raw = JSON.parse(readFileSync(process.argv[2], "utf8"));
const report = raw.report ?? raw;
const findings = report.incongruencias ?? [];

const textoDe = (f) =>
  [f.tipo, f.capitulo, f.local, f.descricao, f.evidencia, f.termo_busca, f.conflito, f.sugestao_correcao, f.categoria, f.referencia_comparada]
    .filter(Boolean)
    .join(" · ");

const textos = findings.map((f) => ({ f, texto: textoDe(f) }));

function casa(alvo) {
  return textos.find(({ texto }) => {
    if (!alvo.termos.some((re) => re.test(texto))) return false;
    if (alvo.exige && !alvo.exige.every((re) => re.test(texto))) return false;
    return true;
  });
}

const porFaixa = { critico_documental: 0, tecnico_contratual: 0, revisao_editorial: 0 };
for (const f of findings) porFaixa[f.impacto ?? "revisao_editorial"] = (porFaixa[f.impacto ?? "revisao_editorial"] ?? 0) + 1;

console.log(`\n=== ${report.arquivo ?? "relatório"} ===`);
console.log(`status: ${report.status_analise} / ${report.status_geral}`);
console.log(`passadas incompletas: ${JSON.stringify(report.runtime?.passadas_incompletas ?? [])}`);
console.log(`achados: ${findings.length}  (bloqueia ${porFaixa.critico_documental} | técnico ${porFaixa.tecnico_contratual} | editorial ${porFaixa.revisao_editorial})\n`);

const grupos = { so_externo: [], ambos: [] };
for (const alvo of ALVOS) {
  const hit = casa(alvo);
  grupos[alvo.origem]?.push({ alvo, hit });
}

for (const [chave, titulo] of [
  ["so_externo", "GANHOS POSSÍVEIS — só a auditoria externa pegava"],
  ["ambos", "REGRESSÃO? — as duas já pegavam"],
]) {
  const lista = grupos[chave];
  const achou = lista.filter((x) => x.hit).length;
  console.log(`--- ${titulo}: ${achou}/${lista.length} ---`);
  for (const { alvo, hit } of lista) {
    const marca = hit ? "  OK " : "  -- ";
    const extra = hit ? `pág. ${hit.f.pagina} [${hit.f.impacto ?? "?"}]` : "";
    console.log(`${marca}${alvo.nome} ${extra}`);
  }
  console.log("");
}

const naoCasados = textos.filter(({ texto }) => !ALVOS.some((a) => a.termos.some((re) => re.test(texto))));
console.log(`--- ACHADOS FORA DO GABARITO: ${naoCasados.length} (novos ou ruído — ler à mão) ---`);
for (const { f } of naoCasados) {
  console.log(`  · [${f.impacto ?? "?"}] pág. ${f.pagina} — ${f.tipo}`);
}
