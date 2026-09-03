/**
 * PROVA o pré-voo contra PDFs REAIS, sem navegador e sem gastar modelo.
 *
 * O teste unitário (`npm run test:papel-do-anexo`) prova o julgamento com fatos
 * de mentira. O medidor (`npm run medir:papel`) prova os limiares contra o
 * acervo, mas colhendo os fatos com um extrator PRÓPRIO. Falta o que está no
 * meio: o `preVoar` de verdade — o invólucro que abre o PDF, escolhe as folhas,
 * mede e chama o julgamento.
 *
 * ELE PRECISOU EXISTIR. Na primeira corrida, os quatro arquivos voltaram com
 * `paginas: 0`: o `workerSrc` do pdf.js resolvia para um caminho inexistente
 * fora do bundler, todo `getDocument` falhava, e como a falha cai para o nome do
 * arquivo, três dos quatro casos "passavam" — pelo nome, medindo nada. Sem esta
 * prova o defeito só apareceria no navegador, e talvez nem lá.
 *
 *   npm run prova:pre-voo-real
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { preVoar } from "@/modules/nexo/lib/pre-voo-do-anexo";

/**
 * O caso do KIT (`docs/samples/_auditoria-teste/`) é o que importa mais e é o
 * único numa pasta ignorada pelo git. Quem não a tem roda a prova sem ele, e a
 * prova diz isso em vez de fingir cobertura.
 * Para recriá-la: `node scripts/gera-memoriais-defeituosos.mjs`.
 */
const CASOS = [
  {
    caminho: "docs/samples/_auditoria-teste/02-contratual-e-escopo.pdf",
    papel: "indeciso",
    porque: "memorial cujo nome virou número de folha — o nome diz prancha",
  },
  {
    caminho: "docs/samples/040-26/1_memorial/040_26_md_geral_a.pdf",
    papel: "memorial",
    porque: "memorial pela convenção",
  },
  {
    caminho: "docs/samples/040-26/4_urb_psg_mqt/1_urb/040_26_urb_001_a.pdf",
    papel: "prancha",
    porque: "prancha A1 com carimbo",
  },
  {
    caminho:
      "docs/samples/040-26/10_his_inc_spd/arquivos separados/040_26_capa_vol10_his_inc_spd_a.pdf",
    papel: "prancha",
    porque: "capa de volume, uma folha",
  },
];

let passou = 0;
let pulados = 0;

for (const caso of CASOS) {
  if (!existsSync(caso.caminho)) {
    console.log(`  --  PULADO (arquivo ausente): ${caso.caminho}`);
    pulados += 1;
    continue;
  }

  const nome = caso.caminho.split("/").pop();
  const file = new File([readFileSync(caso.caminho)], nome, { type: "application/pdf" });
  const r = await preVoar(file);

  try {
    /*
     * A MEDIÇÃO ACONTECEU — e esta asserção vem ANTES do papel, de propósito.
     *
     * `papel` certo com `paginas: 0` é o falso verde que motivou esta prova: a
     * decisão caiu para o nome do arquivo e nada foi medido. Provar o papel sem
     * provar que houve medida é provar o `parseFilename`, que já tem teste.
     */
    assert.ok(r.fatos.paginas > 0, `nada foi medido em ${nome} (paginas=0)`);
    assert.ok(r.fatos.amostra.length > 0, `amostra vazia em ${nome}`);
    assert.equal(r.papel, caso.papel, `${nome}: papel errado`);
    passou += 1;
    console.log(
      `  ok  ${nome}  papel=${r.papel}  pg=${r.fatos.paginas}  ` +
        `chars=${r.fatos.amostra.map((a) => a.chars).join("/")}  (${caso.porque})`,
    );
  } catch (err) {
    console.error(`FALHOU  ${nome}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

/*
 * A AMOSTRA ESPALHADA, provada num arquivo de verdade.
 *
 * O spec dizia "as três primeiras folhas enviesam", e o número confirma: a
 * primeira folha do `040_26_md_geral_a` tem ~175 caracteres (é capa), e o miolo
 * passa de 1400. Medido só no começo, um memorial de 167 folhas ficaria abaixo
 * do limiar.
 */
const memorial = CASOS[1];
if (existsSync(memorial.caminho)) {
  const nome = memorial.caminho.split("/").pop();
  const r = await preVoar(new File([readFileSync(memorial.caminho)], nome));
  const [primeira, ...resto] = r.fatos.amostra.map((a) => a.chars);
  try {
    assert.ok(
      resto.some((c) => c > primeira * 2),
      `a amostra não pegou folha mais cheia que a primeira (${primeira} vs ${resto.join("/")})`,
    );
    passou += 1;
    console.log(
      `  ok  a amostra espalhada pega o miolo: primeira=${primeira}, resto=${resto.join("/")}`,
    );
  } catch (err) {
    console.error("FALHOU  a amostra espalhada pega o miolo");
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

console.log(
  `\n${passou} verificação(ões) de pré-voo com PDF real OK` +
    (pulados > 0 ? ` — ${pulados} caso(s) pulado(s) por arquivo ausente` : ""),
);
