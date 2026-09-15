export function imprimirRelatorio({ puros, jornadas, pastaDeArtefatos }) {
  const conta = (lista, estado) => lista.filter((x) => x.estado === estado).length;

  console.log("\n══════════ BATERIA ══════════");
  if (puros) {
    console.log(
      `\nTestes puros: ${conta(puros, "verde")} verdes · ${conta(puros, "vermelho")} vermelhos · ${conta(puros, "apodrecido")} apodrecidos`,
    );
    for (const p of puros.filter((x) => x.estado !== "verde")) {
      console.log(`  ${p.estado.toUpperCase().padEnd(10)} ${p.arquivo} — ${p.motivo}`);
    }
  }
  if (jornadas) {
    const areas = [...new Set(jornadas.map((j) => j.area))];
    console.log(`\nJornadas: ${conta(jornadas, "verde")} verdes · ${conta(jornadas, "vermelho")} vermelhas`);
    for (const area of areas) {
      console.log(`  [${area}]`);
      for (const j of jornadas.filter((x) => x.area === area)) {
        console.log(`    ${j.estado === "verde" ? "ok     " : "FALHOU "} ${j.id} ${j.titulo} (${Math.round(j.ms / 1000)}s)`);
        for (const f of j.falhas) console.log(`           - ${f}`);
      }
    }
  }
  console.log(`\nArtefatos: ${pastaDeArtefatos}`);

  const vermelhos =
    (puros ? conta(puros, "vermelho") + conta(puros, "apodrecido") : 0) + (jornadas ? conta(jornadas, "vermelho") : 0);
  return vermelhos;
}
