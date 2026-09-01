// A que projeto a auditoria pertence.
//
//   node scripts/test-resolucao-de-projeto.ts   (== npm run test:resolucao)
//
// O caso que mais importa aqui é o do meio: código desconhecido PARA. Escolher
// "o mais parecido" mandaria a auditoria para a fila de outro projeto, e o erro
// só apareceria quando alguém recebesse uma pendência que não é dele.
import assert from "node:assert/strict";

import {
  decidirTroca,
  normalizarCentroDeCusto,
  resolverProjeto,
} from "../lib/resolucao-de-projeto.ts";

const projetos = [
  { id: "p1", code: "099-25", client: "CRICIÚMA" },
  { id: "p2", code: "063-26", client: "IÇARA" },
];

// O separador varia entre carimbo, capa e memorial. O par número-ano, não.
assert.equal(normalizarCentroDeCusto(" 099-25 "), "099-25");
assert.equal(normalizarCentroDeCusto("099/25"), "099-25");
assert.equal(normalizarCentroDeCusto("099.25"), "099-25");
assert.equal(normalizarCentroDeCusto("cc 099-25"), "099-25");
assert.equal(normalizarCentroDeCusto("CC: 099-25"), "099-25");
assert.equal(normalizarCentroDeCusto("099 - 25"), "099-25");

// "CC" só cai quando é palavra inteira: um código que comece com essas letras
// não pode ser mutilado.
assert.equal(normalizarCentroDeCusto("CCB-12"), "CCB-12");

const achado = resolverProjeto({ codigoExtraido: "099/25", projetos });
assert.equal(achado.tipo, "achado");
assert.equal(achado.tipo === "achado" && achado.projeto.id, "p1");

const desconhecido = resolverProjeto({ codigoExtraido: "500-99", projetos });
assert.equal(desconhecido.tipo, "desconhecido");
assert.equal(desconhecido.tipo === "desconhecido" && desconhecido.codigo, "500-99");

// Parecido NÃO é igual: "099-26" não pode virar "099-25" por proximidade.
const parecido = resolverProjeto({ codigoExtraido: "099-26", projetos });
assert.equal(parecido.tipo, "desconhecido");

assert.equal(resolverProjeto({ projetos }).tipo, "sem-codigo");
assert.equal(resolverProjeto({ codigoExtraido: "   ", projetos }).tipo, "sem-codigo");

// Escritório sem projeto nenhum não é "sem código": o código veio, e não há
// onde encaixá-lo. A tela precisa dizer coisas diferentes nos dois casos.
assert.equal(resolverProjeto({ codigoExtraido: "099-25", projetos: [] }).tipo, "desconhecido");

// O projeto cadastrado também é normalizado: alguém que cadastrou "099/25" na
// tela não deixa de casar com o "099-25" lido do documento.
const cadastroTorto = resolverProjeto({
  codigoExtraido: "099-25",
  projetos: [{ id: "p3", code: "099/25", client: "CRICIÚMA" }],
});
assert.equal(cadastroTorto.tipo, "achado");
assert.equal(cadastroTorto.tipo === "achado" && cadastroTorto.projeto.id, "p3");

// TROCAR O PROJETO DA CONVERSA — o anexo pode ser refeito (F5, reclassificação,
// segundo memorial), e cada um desses casos tem um desfecho diferente.

// Sem código vinculado, o lido vincula.
assert.deepEqual(decidirTroca({ codigoAtual: null, codigoLido: "099-25" }), { acao: "vincular" });
assert.deepEqual(decidirTroca({ codigoAtual: "", codigoLido: "099-25" }), { acao: "vincular" });

// O MESMO código, escrito diferente, mantém o vínculo: reanexar o mesmo
// memorial depois de um F5 não pode remexer no endereço.
assert.deepEqual(decidirTroca({ codigoAtual: "099-25", codigoLido: "099/25" }), { acao: "manter" });
assert.deepEqual(decidirTroca({ codigoAtual: "099-25", codigoLido: "CC 099.25" }), { acao: "manter" });

// Código DIFERENTE é conflito, nunca troca em silêncio. Dois memoriais de
// projetos diferentes na mesma conversa é erro de quem anexou, não decisão a
// executar: trocar calado levaria os achados do primeiro para a fila do
// segundo, e o erro só apareceria dias depois.
assert.deepEqual(decidirTroca({ codigoAtual: "099-25", codigoLido: "063-26" }), { acao: "conflito" });

// Não ler código não desfaz o vínculo que existe: um segundo anexo ilegível não
// pode apagar o endereço já conquistado.
assert.deepEqual(decidirTroca({ codigoAtual: "099-25", codigoLido: null }), { acao: "manter" });
assert.deepEqual(decidirTroca({ codigoAtual: "099-25", codigoLido: "  " }), { acao: "manter" });

// Sem nada dos dois lados, não há o que fazer.
assert.deepEqual(decidirTroca({ codigoAtual: null, codigoLido: null }), { acao: "manter" });

console.log("OK  resolucao de projeto");
