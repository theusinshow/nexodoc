/**
 * TODA DATA QUE A PESSOA LÊ SAI NO HORÁRIO DE BRASÍLIA.
 *
 * 17/09/2026: o banco guarda UTC (certo), mas cada tela formatava no fuso de
 * quem rodava o código — o servidor da Render roda em UTC, então tudo que era
 * formatado lá saía 3 horas adiantado; "é hoje?" e "início do mês" viravam à
 * meia-noite UTC, que são 21h em Brasília.
 *
 * Os instantes abaixo são escolhidos na FRONTEIRA: 01:30 UTC ainda é o dia
 * anterior em Brasília.
 *
 *   node scripts/test-fuso-de-brasilia.ts   (== npm run test:fuso)
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  diaEmBrasilia,
  formatarDataHora,
  formatarDiaDeCalendario,
  formatarEmBrasilia,
  inicioDoMesEmBrasilia,
  mesmoDiaEmBrasilia,
  partesEmBrasilia,
} from "../lib/fuso-de-brasilia.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

/** 18/09/2026 01:30 UTC = 17/09/2026 22:30 em Brasília. */
const FRONTEIRA = "2026-09-18T01:30:00Z";

test("a hora sai em Brasília, não em UTC nem no fuso da máquina", () => {
  assert.equal(formatarEmBrasilia(FRONTEIRA, { hour: "2-digit", minute: "2-digit" }), "22:30");
});

test("data e hora curtas: o dia ainda é 17", () => {
  assert.equal(formatarDataHora(FRONTEIRA), "17/09/2026, 22:30");
});

test("partes: ano, mês, dia, hora e dia da semana de Brasília", () => {
  assert.deepEqual(partesEmBrasilia(FRONTEIRA), {
    ano: 2026,
    mes: 9,
    dia: 17,
    hora: 22,
    minuto: 30,
    diaDaSemana: 4, // quinta
  });
});

test("dia do calendário em Brasília, como chave YYYY-MM-DD", () => {
  assert.equal(diaEmBrasilia(FRONTEIRA), "2026-09-17");
  assert.equal(diaEmBrasilia("2026-09-18T03:00:00Z"), "2026-09-18");
});

test("mesmo dia: 22:30 e 23:59 de Brasília são o mesmo dia, mesmo com datas UTC diferentes", () => {
  assert.equal(mesmoDiaEmBrasilia("2026-09-17T16:00:00Z", FRONTEIRA), true);
  assert.equal(mesmoDiaEmBrasilia(FRONTEIRA, "2026-09-18T03:00:00Z"), false);
});

test("início do mês de Brasília é 03:00 UTC do dia 1", () => {
  assert.equal(inicioDoMesEmBrasilia(new Date("2026-09-17T12:00:00Z")).toISOString(), "2026-09-01T03:00:00.000Z");
  // 01/10 às 01:00 UTC ainda é setembro em Brasília.
  assert.equal(inicioDoMesEmBrasilia(new Date("2026-10-01T01:00:00Z")).toISOString(), "2026-09-01T03:00:00.000Z");
});

test("dia de calendário (chave sem hora) não desloca um dia", () => {
  assert.equal(formatarDiaDeCalendario("2026-09-14", { day: "2-digit", month: "2-digit" }), "14/09");
});

test("aceita Date, número e string", () => {
  const ms = Date.parse(FRONTEIRA);
  assert.equal(formatarDataHora(ms), formatarDataHora(new Date(ms)));
});

/*
 * GUARDA: ninguém formata data fora do módulo.
 *
 * Formatação de NÚMERO com toLocaleString continua livre; o que a guarda pega é
 * o que só existe para data.
 */
test("nenhuma formatação de data fora de lib/fuso-de-brasilia.ts", () => {
  const PROIBIDO: [RegExp, string][] = [
    [/\btoLocaleDateString\(/, "toLocaleDateString"],
    [/\btoLocaleTimeString\(/, "toLocaleTimeString"],
    [/\bIntl\.DateTimeFormat\(/, "Intl.DateTimeFormat"],
    [/\.get(Hours|Minutes|Date|Month|FullYear|Day)\(\)/, "getter de data local"],
    [/\.getUTC(Hours|Date|Month|FullYear|Day)\(\)/, "getter de data UTC"],
    [/\btoDateString\(\)/, "toDateString"],
    [/\.set(Hours|Date|Month|FullYear)\(/, "setter de data local"],
    [/toISOString\(\)\.(slice|substring)\(0, ?10\)/, "dia UTC por toISOString"],
    [/from "date-fns"/, "date-fns"],
    [/new Date\([^)]*\)\.toLocaleString\(/, "toLocaleString de Date"],
    [/toLocaleString\("pt-BR", \{[^}]*\b(day|month|hour|weekday|dateStyle|timeStyle)\b/, "toLocaleString com opções de data"],
  ];
  const fora: string[] = [];
  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) {
        if (nome !== "node_modules" && !nome.startsWith(".")) varrer(caminho);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(nome) || caminho.replace(/\\/g, "/") === "lib/fuso-de-brasilia.ts") continue;
      readFileSync(caminho, "utf8")
        .split("\n")
        .forEach((linha, i) => {
          for (const [re, rotulo] of PROIBIDO) {
            if (re.test(linha)) fora.push(`${caminho.replace(/\\/g, "/")}:${i + 1} (${rotulo})`);
          }
        });
    }
  };
  for (const raiz of ["app", "components", "modules", "lib", "server"]) varrer(raiz);
  assert.deepEqual(fora, [], `formatação de data fora do módulo:\n${fora.join("\n")}`);
});

console.log(`\n${passed} teste(s) de fuso de Brasília OK`);
