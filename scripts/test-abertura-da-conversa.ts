/**
 * A DECISÃO DE ABERTURA DA CONVERSA, em tabela-verdade — revisão final da
 * segunda rodada, 15/09/2026 (I5).
 *
 * A decisão vivia dentro de `selectConversation` (conversation-store.tsx), sem
 * teste puro: trava na memória desta aba, marca de recusa no localStorage
 * ("descer"/"manter"), lista do servidor carregada, disco contra servidor, o
 * resultado da leitura no servidor → ir ao servidor, base verificada, abrir
 * travada. Três revisões da c3 mexeram nela. Agora mora em
 * `modules/nexo/lib/abertura-da-conversa.ts`, e esta tabela percorre TODAS as
 * combinações contra a transcrição literal do código de antes da extração
 * (commit ae29186) — a extração não muda comportamento nenhum.
 *
 *   node scripts/test-abertura-da-conversa.ts
 */
import assert from "node:assert/strict";

import {
  abreTravada,
  decidirAbertura,
  depoisDoServidor,
  type CopiaDoServidor,
  type MarcaDeRecusa,
} from "../modules/nexo/lib/abertura-da-conversa.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const BOOL = [false, true] as const;
const MARCAS: (MarcaDeRecusa | null)[] = [null, "descer", "manter"];

/* A transcrição do provider em ae29186, sem nenhuma mudança de lógica. */
function antesDecidir(a: {
  travadaNaMemoria: boolean;
  marca: MarcaDeRecusa | null;
  listaCarregada: boolean;
  temDisco: boolean;
  servidorMaisNovo: boolean;
}) {
  const travadaNaMemoria = a.travadaNaMemoria;
  const marca = a.marca;
  const manterDisco = marca === "manter" && !travadaNaMemoria;
  const lerDoServidorPrimeiro = travadaNaMemoria || marca === "descer";
  let verificada = a.listaCarregada;
  const irAoServidor = manterDisco ? !a.temDisco : lerDoServidorPrimeiro || a.servidorMaisNovo;
  if (manterDisco) verificada = false;
  return { manterDisco, lerDoServidorPrimeiro, irAoServidor, verificada };
}

function antesDepoisDoServidor(a: {
  verificada: boolean;
  consulta: "achada" | "ausente" | "falhou";
  desceu: boolean;
}) {
  let verificada = a.verificada;
  let copiaDoServidor: CopiaDoServidor = null;
  let esquecerMarca = false;
  if (a.consulta === "achada") {
    verificada = true;
    copiaDoServidor = a.desceu ? "desceu" : "falhou";
    if (a.desceu) esquecerMarca = true;
  } else if (a.consulta === "ausente") {
    copiaDoServidor = "ausente";
    esquecerMarca = true;
  } else {
    copiaDoServidor = "falhou";
    verificada = false;
  }
  return { verificada, copiaDoServidor, esquecerMarca };
}

function antesAbreTravada(a: {
  lerDoServidorPrimeiro: boolean;
  manterDisco: boolean;
  copiaDoServidor: CopiaDoServidor;
}) {
  return (
    (a.lerDoServidorPrimeiro && a.copiaDoServidor !== "desceu" && a.copiaDoServidor !== "ausente") ||
    (a.manterDisco && a.copiaDoServidor === null)
  );
}

test("decidirAbertura: as 48 combinações batem com o código de antes", () => {
  let linhas = 0;
  for (const travadaNaMemoria of BOOL)
    for (const marca of MARCAS)
      for (const listaCarregada of BOOL)
        for (const temDisco of BOOL)
          for (const servidorMaisNovo of BOOL) {
            const entrada = { travadaNaMemoria, marca, listaCarregada, temDisco, servidorMaisNovo };
            assert.deepEqual(decidirAbertura(entrada), antesDecidir(entrada), JSON.stringify(entrada));
            linhas++;
          }
  assert.equal(linhas, 48);
});

test("depoisDoServidor: as 12 combinações batem com o código de antes", () => {
  let linhas = 0;
  for (const verificada of BOOL)
    for (const consulta of ["achada", "ausente", "falhou"] as const)
      for (const desceu of BOOL) {
        const entrada = { verificada, consulta, desceu };
        assert.deepEqual(depoisDoServidor(entrada), antesDepoisDoServidor(entrada), JSON.stringify(entrada));
        linhas++;
      }
  assert.equal(linhas, 12);
});

test("abreTravada: as 16 combinações batem com o código de antes", () => {
  let linhas = 0;
  for (const lerDoServidorPrimeiro of BOOL)
    for (const manterDisco of BOOL)
      for (const copiaDoServidor of [null, "desceu", "ausente", "falhou"] as CopiaDoServidor[]) {
        const entrada = { lerDoServidorPrimeiro, manterDisco, copiaDoServidor };
        assert.equal(abreTravada(entrada), antesAbreTravada(entrada), JSON.stringify(entrada));
        linhas++;
      }
  assert.equal(linhas, 16);
});

/* As linhas que contam uma história, escritas por extenso. */
const base = {
  travadaNaMemoria: false,
  marca: null,
  listaCarregada: true,
  temDisco: true,
  servidorMaisNovo: false,
};

test("caso comum: disco em dia, lista carregada — abre do disco, verificada, destravada", () => {
  const d = decidirAbertura(base);
  assert.deepEqual(d, { manterDisco: false, lerDoServidorPrimeiro: false, irAoServidor: false, verificada: true });
  assert.equal(abreTravada({ ...d, copiaDoServidor: null }), false);
});

test("F5 antes da lista chegar: abre do disco, NÃO verificada (um 409 não desce nada)", () => {
  assert.equal(decidirAbertura({ ...base, listaCarregada: false }).verificada, false);
});

test("servidor mais novo que o disco: vai ao servidor", () => {
  assert.equal(decidirAbertura({ ...base, servidorMaisNovo: true }).irAoServidor, true);
});

test("marca 'descer' (409 de outra máquina): lê do servidor primeiro; rede fora abre travada", () => {
  const d = decidirAbertura({ ...base, marca: "descer" });
  assert.equal(d.irAoServidor, true);
  const falhou = depoisDoServidor({ verificada: d.verificada, consulta: "falhou", desceu: false });
  assert.deepEqual(falhou, { verificada: false, copiaDoServidor: "falhou", esquecerMarca: false });
  assert.equal(abreTravada({ ...d, copiaDoServidor: falhou.copiaDoServidor }), true);
});

test("marca 'descer' e a cópia desceu: esquece a marca e abre destravada, verificada", () => {
  const d = decidirAbertura({ ...base, marca: "descer" });
  const achada = depoisDoServidor({ verificada: d.verificada, consulta: "achada", desceu: true });
  assert.deepEqual(achada, { verificada: true, copiaDoServidor: "desceu", esquecerMarca: true });
  assert.equal(abreTravada({ ...d, copiaDoServidor: achada.copiaDoServidor }), false);
});

test("apagada no servidor ('ausente'): a marca não trava para sempre", () => {
  const d = decidirAbertura({ ...base, marca: "descer" });
  const ausente = depoisDoServidor({ verificada: d.verificada, consulta: "ausente", desceu: false });
  assert.equal(ausente.esquecerMarca, true);
  assert.equal(abreTravada({ ...d, copiaDoServidor: ausente.copiaDoServidor }), false);
});

test("marca 'manter' (409 com base não conferida): abre do DISCO, travada e não verificada", () => {
  const d = decidirAbertura({ ...base, marca: "manter" });
  assert.deepEqual(d, { manterDisco: true, lerDoServidorPrimeiro: false, irAoServidor: false, verificada: false });
  assert.equal(abreTravada({ ...d, copiaDoServidor: null }), true);
});

test("marca 'manter' sem nada no disco: vai ao servidor mesmo assim", () => {
  assert.equal(decidirAbertura({ ...base, marca: "manter", temDisco: false }).irAoServidor, true);
});

test("'Recarregar a conversa' com a trava na memória: a marca 'manter' cede, lê do servidor", () => {
  const d = decidirAbertura({ ...base, travadaNaMemoria: true, marca: "manter" });
  assert.equal(d.manterDisco, false);
  assert.equal(d.lerDoServidorPrimeiro, true);
  assert.equal(d.irAoServidor, true);
});

console.log(`\n${passed} teste(s) passaram`);
