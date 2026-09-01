/**
 * A MARCA DE PREFEITURA — casamento do município e geometria. Núcleo puro.
 *
 *   node scripts/test-nexo-marca.ts   (== npm run test:nexo:marca)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  chaveDaPrefeitura,
  coresDaPrefeitura,
  GEOMETRIA_DA_MARCA,
  prefeituraConhecida,
  prefeiturasMapeadas,
  PREFEITURA_AUSENTE,
} from "../modules/nexo/lib/marca-da-prefeitura.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("marca de prefeitura\n");

test("as TRÊS formas de escrever a mesma cidade dão a mesma marca", () => {
  /*
   * As três circulam de verdade: a pasta vem do histórico, o campo CLIENTE vem
   * do carimbo, e o município cru vem do cadastro do projeto. Se as três não
   * casassem, a mesma obra teria uma cor na barra lateral e outra na ficha.
   */
  assert.equal(chaveDaPrefeitura("084-25-CRICIUMA"), "criciuma");
  assert.equal(chaveDaPrefeitura("PREFEITURA MUNICIPAL DE CRICIÚMA"), "criciuma");
  assert.equal(chaveDaPrefeitura("Criciúma"), "criciuma");
});

test("o órgão vem inteiro do carimbo, e o município é a primeira parte", () => {
  assert.equal(
    chaveDaPrefeitura("PREFEITURA MUNICIPAL DE CRICIÚMA / SECRETARIA DE OBRAS"),
    "criciuma",
  );
  assert.equal(chaveDaPrefeitura("MUNICÍPIO DE CHAPECÓ - SC"), "chapeco");
  assert.equal(chaveDaPrefeitura("Florianópolis, SC"), "florianopolis");
});

test("nome de duas palavras sobrevive ao hífen da pasta", () => {
  /*
   * `centroDeCustoDaAuditoria` monta "084-25-SAO JOSE" (com espaço), e o mapa
   * da marca escreve a chave como "SAO-JOSE". As duas têm de cair no mesmo
   * lugar — senão São José fica cinza justamente na tela do histórico.
   */
  assert.equal(chaveDaPrefeitura("084-25-SAO JOSE"), "sao-jose");
  assert.equal(chaveDaPrefeitura("SÃO JOSÉ"), "sao-jose");
  assert.equal(chaveDaPrefeitura("PREFEITURA MUNICIPAL DE SÃO JOSÉ"), "sao-jose");
});

test("O CASAMENTO É EXATO — cidade parecida não herda a cor da vizinha", () => {
  /*
   * O defeito que este teste existe para impedir: casar por conteúdo pintaria
   * "SÃO JOSÉ DO CERRITO" com as cores de São José. Uma marca cinza diz "não
   * sei", que é verdade; uma marca errada afirma uma cidade que ninguém
   * conferiu — e a ficha do drop existe justamente para essa conferência.
   */
  assert.equal(chaveDaPrefeitura("SÃO JOSÉ DO CERRITO"), PREFEITURA_AUSENTE);
  assert.equal(chaveDaPrefeitura("CRICIÚMA DO SUL"), PREFEITURA_AUSENTE);
  assert.equal(chaveDaPrefeitura("NOVA VENEZA"), PREFEITURA_AUSENTE);
});

test("ausência é resposta, não falha — nunca vazio, nunca nulo", () => {
  assert.equal(chaveDaPrefeitura(null), PREFEITURA_AUSENTE);
  assert.equal(chaveDaPrefeitura(""), PREFEITURA_AUSENTE);
  assert.equal(chaveDaPrefeitura("   "), PREFEITURA_AUSENTE);
  assert.equal(chaveDaPrefeitura("SECRETARIA DE EDUCAÇÃO"), PREFEITURA_AUSENTE);
  assert.equal(prefeituraConhecida(null), false);
  assert.equal(prefeituraConhecida("Criciúma"), true);
});

test("a cor sai como token, nunca como hex cru", () => {
  const cores = coresDaPrefeitura("084-25-CRICIUMA");
  assert.deepEqual(cores, [
    "var(--prefeitura-criciuma-1)",
    "var(--prefeitura-criciuma-2)",
    "var(--prefeitura-criciuma-3)",
  ]);
  assert.deepEqual(coresDaPrefeitura("nada disso"), [
    "var(--prefeitura-ausente-1)",
    "var(--prefeitura-ausente-2)",
    "var(--prefeitura-ausente-3)",
  ]);
});

test("toda prefeitura mapeada tem os três tokens definidos no CSS", () => {
  /*
   * O elo que o `prova:tokens` NÃO fecha: ele checa CSS → DESIGN.md, e não o
   * mapa de TypeScript → CSS. Uma cidade nova na lista sem token no CSS
   * renderiza três `var()` que não resolvem — ou seja, três segmentos
   * transparentes, que na tela é a marca sumindo sem ninguém acusar.
   */
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const chave of [...prefeiturasMapeadas(), PREFEITURA_AUSENTE]) {
    for (const n of [1, 2, 3]) {
      assert.ok(
        css.includes(`--prefeitura-${chave}-${n}:`),
        `--prefeitura-${chave}-${n} não está em globals.css`,
      );
    }
  }
});

test("a geometria fecha nas medidas do mapa", () => {
  /*
   * O total é o que o desenho usa para reservar espaço, e é a conta que erra
   * calada: 9×3 com gap 2 dá 31px, não 27. Um total errado desalinha a marca do
   * chevron do cartão, e ninguém liga um pixel de sobra a uma soma.
   */
  assert.equal(GEOMETRIA_DA_MARCA.sinal.total, 31);
  assert.equal(GEOMETRIA_DA_MARCA.selo.total, 43);
  assert.equal(GEOMETRIA_DA_MARCA.chapa.total, 70);
  assert.equal(GEOMETRIA_DA_MARCA.bastao.total, 14);
});

test("só o BASTÃO empilha — as outras três correm na horizontal", () => {
  assert.equal(GEOMETRIA_DA_MARCA.bastao.empilhado, true);
  for (const forma of ["sinal", "selo", "chapa"] as const) {
    assert.equal(GEOMETRIA_DA_MARCA[forma].empilhado, false);
  }
});

test("a marca CRESCE de forma em forma, e nunca empata", () => {
  /*
   * A escolha é da SUPERFÍCIE: sinal para lista densa, selo para superfície
   * larga, chapa para quando a cidade é o assunto da tela. Duas formas do mesmo
   * tamanho seriam duas maneiras de dizer a mesma coisa — e a próxima tela
   * escolheria pelo gosto.
   */
  const s = GEOMETRIA_DA_MARCA;
  assert.ok(s.sinal.largura < s.selo.largura);
  assert.ok(s.selo.largura < s.chapa.largura);
  assert.ok(s.sinal.altura < s.selo.altura);
  assert.ok(s.selo.altura < s.chapa.altura);
});

console.log(`\n${passed} teste(s) passaram.`);
