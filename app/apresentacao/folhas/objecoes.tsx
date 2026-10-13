"use client";

import { Check, FileArchive, FileText, ScrollText } from "lucide-react";

import type { Slide } from "../palco";
import { Contador, Entra, Grifo, MONO, Papel, Selo } from "../pecas";

/**
 * CAPÍTULO 4 — AS OBJEÇÕES QUE MERECEM TELA (folhas 13 a 15): a prova contra
 * outra IA (o 129-24), por que não só o ChatGPT, e o que não depende de
 * confiança. A pergunta do comprador aparece
 * na bolha de quem escreve no chat do Nexo; a resposta é uma peça, não um
 * parágrafo.
 */

const BLOCO = "Objeções";

/* ═════════════════════════════════════ folha 13: duas leituras do 129-24 */

/**
 * O 129-24 (skatepark da Armação, 54 páginas), lido em 21/09/2026 pelo Nexo e
 * por outra IA com o mesmo PDF. Os números são do commit c054c0e e do parecer
 * gravado (auditoria cfe160ff): 37 contra 12, os 37 conferidos palavra por
 * palavra contra o PDF. Os trechos abaixo são a `evidencia` desse parecer,
 * literal — o deck não escreve o que não conferiu.
 */
type Leitura = { pagina: string; partes: ReadonlyArray<string | { grifo: string; tom: "block" | "decide" }> };

const QUATRO: readonly Leitura[] = [
  { pagina: "48 e 54", partes: ["…camada de cobre deverá ter espessura de 0,254 ", { grifo: "microns", tom: "block" }] },
  { pagina: "47 e 48", partes: ["…eletroduto do tipo corrugado ", { grifo: "Pead", tom: "decide" }, " · O eletroduto do ramal de entrada deverá ser de ", { grifo: "PVC rígido", tom: "decide" }] },
  { pagina: "33 e 40", partes: ["…prazo mínimo de ", { grifo: "48 horas", tom: "decide" }, " para retirada de painéis e escoramentos · ", { grifo: "21 dias", tom: "decide" }, " para face inferior com pontalete"] },
  { pagina: "31", partes: ["5.1.6.2 ", { grifo: "Cantoneiras", tom: "decide" }, " em aço galvanizado a fogo · perfis de aço ", { grifo: "UDC enrijecidos", tom: "decide" }] },
];

function Placar({ quem, n, de, atraso, forte }: { quem: string; n: number; de: number; atraso: number; forte?: boolean }) {
  return (
    <div style={{ padding: "22px 0", boxShadow: "inset 0 1px 0 var(--ds-line-subtle)" }}>
      <Entra atraso={atraso} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 24, fontWeight: 500, color: forte ? "var(--ds-text-primary)" : "var(--ds-text-secondary)" }}>{quem}</span>
        <span className="ds-num" style={{ fontSize: 64, fontWeight: 500, letterSpacing: "-0.03em", color: forte ? "var(--ds-text-primary)" : "var(--ds-text-secondary)" }}>
          <Contador ate={n} atraso={atraso + 200} duracao={forte ? 1400 : 700} />
        </span>
      </Entra>
      <span
        aria-hidden="true"
        className="ap-risca"
        style={{
          display: "block",
          marginTop: 12,
          width: `${(n / de) * 100}%`,
          height: 12,
          borderRadius: 999,
          background: forte ? "#c9ccd4" : "#5b5f6b",
          animationDelay: `${atraso + 200}ms`,
        }}
      />
    </div>
  );
}

function QuatroNoPapel({ atraso }: { atraso: number }) {
  return (
    <div className="ap-papel ap-entra" style={{ animationDelay: `${atraso}ms` }}>
      <div className="ap-papel__cabeca">
        <span>129_24_md_geral_a.pdf</span>
        <span>4 dos 37</span>
      </div>
      {QUATRO.map((t, i) => (
        <p
          key={t.pagina}
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr",
            alignItems: "baseline",
            margin: 0,
            padding: "14px 0",
            boxShadow: i ? "inset 0 1px 0 rgb(10 11 13 / 0.08)" : undefined,
            fontSize: 21,
            lineHeight: 1.45,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 15, color: "var(--ds-text-on-paper-muted)" }}>p. {t.pagina}</span>
          <span>
            {t.partes.map((p, j) =>
              typeof p === "string" ? (
                <span key={j}>{p}</span>
              ) : (
                <Grifo key={j} tom={p.tom} atraso={atraso + 500 + i * 260}>
                  {p.grifo}
                </Grifo>
              ),
            )}
          </span>
        </p>
      ))}
    </div>
  );
}


/* ══════════════════════════════════════════ folha 14: a comparação */

type Celula = true | false | string;

/**
 * A COMPARAÇÃO, honesta. A primeira linha dá o ponto ao chat de propósito: ele
 * lê o PDF e responde, e negar isso custaria a credibilidade das outras
 * linhas. O que separa os dois é o resto — e o resto são os dois argumentos da
 * folha, como grupos da tabela.
 */
const GRUPOS: ReadonlyArray<{
  grupo: string;
  linhas: ReadonlyArray<readonly [string, Celula, Celula]>;
}> = [
  {
    grupo: "O modelo é uma peça, não é o processo.",
    linhas: [
      ["Lê o documento e responde", true, true],
      ["Cada achado com a página e a transcrição", "se alguém pedir", true],
      ["Regras verificáveis, que a IA não apaga", false, true],
      ["Segunda passada que derruba o que não se sustenta", false, true],
      ["Resultado registrado por obra", false, true],
    ],
  },
  {
    grupo: "Metade do trabalho não é conversa.",
    linhas: [["Lista de documentos, tomos, ODT, PDF e ZIP", false, true]],
  },
];

function Marca({ valor }: { valor: Celula }) {
  if (valor === true)
    return <Check aria-label="sim" size={26} strokeWidth={2.25} style={{ color: "var(--ds-text-primary)" }} />;
  if (valor === false)
    return <span aria-label="não" style={{ color: "var(--ds-text-tertiary)", opacity: 0.6 }}>—</span>;
  return <span style={{ fontSize: 19, color: "var(--ds-text-tertiary)" }}>{valor}</span>;
}

/** As colunas da comparação: o critério, o chat, o NexoDoc. */
const COLUNAS = "minmax(0, 1fr) 240px 200px";
/** A coluna do NexoDoc é um trilho só, de cima a baixo: o fundo não se parte entre os grupos. */
const TRILHO = "rgb(255 255 255 / 0.04)";

/**
 * A COMPARAÇÃO como grade, e não como <table>: a célula centra o visto de
 * verdade (o ícone é bloco, e `text-align` não o movia), e a coluna do NexoDoc
 * vira uma faixa contínua com os cantos arredondados no topo e no pé.
 */
function Comparacao({ atraso }: { atraso: number }) {
  const linhas = GRUPOS.flatMap((g) => [
    { tipo: "grupo" as const, texto: g.grupo },
    ...g.linhas.map(([rotulo, chat, nexo]) => ({ tipo: "linha" as const, rotulo, chat, nexo })),
  ]);
  let n = 0;
  const centro = { display: "flex", alignItems: "center", justifyContent: "center" } as const;
  return (
    <div role="table" aria-label="Um chat com o PDF e o NexoDoc" className="ap-surge" style={{ display: "grid", gridTemplateColumns: COLUNAS, animationDelay: `${atraso}ms` }}>
      <span role="columnheader" />
      <span role="columnheader" style={{ ...centro, padding: "18px 0 14px", fontSize: 17, fontWeight: 500, color: "var(--ds-text-tertiary)" }}>
        Um chat com o PDF
      </span>
      <span role="columnheader" style={{ ...centro, padding: "18px 0 14px", fontSize: 17, fontWeight: 600, background: TRILHO, borderRadius: "16px 16px 0 0" }}>
        NexoDoc
      </span>
      {linhas.map((l, i) => {
        const ultima = i === linhas.length - 1;
        if (l.tipo === "grupo") {
          return (
            <div key={l.texto} role="row" style={{ display: "contents" }}>
              <span style={{ gridColumn: "1 / span 2", padding: "22px 0 10px", fontSize: 22, fontWeight: 500 }}>{l.texto}</span>
              <span style={{ background: TRILHO }} />
            </div>
          );
        }
        const a = atraso + 200 + n++ * 150;
        const celula = { boxShadow: "inset 0 1px 0 var(--ds-line-subtle)", padding: "14px 0", animationDelay: `${a}ms` };
        return (
          <div key={l.rotulo} role="row" style={{ display: "contents" }}>
            <span role="cell" className="ap-entra" style={{ ...celula, fontSize: 21, color: "var(--ds-text-secondary)" }}>{l.rotulo}</span>
            <span role="cell" className="ap-entra" style={{ ...celula, ...centro }}><Marca valor={l.chat} /></span>
            <span role="cell" className="ap-entra" style={{ ...celula, ...centro, background: TRILHO, borderRadius: ultima ? "0 0 16px 16px" : undefined }}>
              <Marca valor={l.nexo} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════ folha 15: o que fica */

const ARQUIVOS = ["Parecer", "Lista de documentos", "Capa", "Volume", "ODT", "PDF", "ZIP"];
const CLAUSULAS = ["Prazo de resposta", "Vigência", "Suporte", "Encerramento"];

/* ══════════════════════════════════════════════════════════════ AS FOLHAS */

export const OBJECOES: readonly Slide[] = [
  {
    rotulo: "Duas leituras",
    numero: "13",
    bloco: BLOCO,
    titulo: "O mesmo memorial, duas leituras",
    manchete: [
      { texto: "No mesmo memorial, outra IA apontou 12.", fraca: true },
      "O Nexo apontou 37 — nenhum inventado.",
    ],
    notas:
      "É A RESPOSTA À OBJEÇÃO SEGUINTE ANTES DE ELA SER FEITA. Mesmo PDF, o memorial do skatepark da Armação (129-24, 54 páginas), lido pelo Nexo e por outra IA. Deixar os dois números chegarem antes de falar.\n\nOS 37 FORAM CONFERIDOS palavra por palavra contra o PDF: nenhum inventado. Dos 12 da outra IA, o Nexo pegou 9; os 3 que faltaram eram da mesma família — remissão que aponta para fora do documento, como um 'Volume 2' que o memorial nunca lista — e viraram regra nova no mesmo dia.\n\nNO PAPEL, quatro que só uma leitura do documento inteiro pega: 0,254 MICRONS no cobre das hastes (o certo é 254 µm, um erro de mil vezes); o mesmo ramal de entrada em Pead numa página e em PVC rígido na outra; 48 horas para tirar o escoramento numa página e 21 dias na outra; cantoneira no título e perfil UDC no texto. Ler UM, não os quatro.\n\nNÃO DIZER QUAL IA FOI a outra leitura: a comparação é de método, não de marca. Se perguntarem a data: 21/09/2026.",
    corpo: (
      <div className="ap-grade" style={{ alignItems: "start" }}>
        <div style={{ gridColumn: "1 / span 5" }}>
          <Entra atraso={300}>
            <span className="ap-rotulo">129-24 · skatepark, 54 páginas</span>
          </Entra>
          <div style={{ marginTop: 18 }}>
            <Placar quem="Outra IA, o mesmo PDF" n={12} de={37} atraso={500} />
            <Placar quem="NexoDoc" n={37} de={37} atraso={1200} forte />
          </div>
          <Entra atraso={2800} style={{ marginTop: 26, display: "grid", gap: 14 }}>
            <span>
              <Selo tom="ok">37 de 37 conferidos contra o PDF</Selo>
            </span>
            <p className="ap-texto" style={{ fontSize: 21 }}>
              Os 3 que só a outra IA viu eram de uma família só, e viraram regra nova.
            </p>
          </Entra>
        </div>
        <div style={{ gridColumn: "7 / span 6" }}>
          <Entra atraso={1900}>
            <span className="ap-rotulo">O que só uma leitura do documento inteiro pega</span>
          </Entra>
          <div style={{ marginTop: 18 }}>
            <QuatroNoPapel atraso={2000} />
          </div>
        </div>
      </div>
    ),
  },

  {
    rotulo: "Por que não o ChatGPT",
    numero: "14",
    bloco: BLOCO,
    titulo: "Por que não só o ChatGPT",
    manchete: [
      { texto: "Quando o modelo melhora, ele melhora aqui dentro.", fraca: true },
      "O que vocês compram é o processo ao redor dele.",
    ],
    notas:
      "A FOLHA ANTERIOR JÁ DEU A PROVA; esta dá o porquê. Não brigar com o ChatGPT: ele está dentro do sistema. Começar pela primeira linha da tabela, que dá o ponto ao chat — ele lê e responde. O resto da tabela é a diferença.\n\nOS DOIS GRUPOS SÃO OS DOIS ARGUMENTOS: o modelo é uma peça, não o processo (página e trecho, regras verificáveis, validação, registro por obra); e metade do trabalho não é conversa (lista, tomos, ODT, PDF e ZIP são montagem de arquivo).\n\nSE VIER 'o modelo vai melhorar e tornar isto obsoleto': melhor modelo melhora o NexoDoc por dentro. O que permanece é página, evidência, regra, validação, histórico, freios e arquivo final.\n\nSE VIER 'então me venda só as regras': regras sozinhas encontram menos e não têm a segunda passada que contesta o que não se sustenta.",
    corpo: (
      <div className="ap-grade" style={{ alignItems: "center" }}>
        <div style={{ gridColumn: "1 / span 4" }}>
          <Entra atraso={300}>
            <span className="ap-rotulo">A pergunta</span>
          </Entra>
          <Entra atraso={420} style={{ marginTop: 18 }}>
            <p
              style={{
                margin: 0,
                padding: "26px 30px 28px",
                borderRadius: "30px 30px 10px 30px",
                background: "var(--ds-surface-raised)",
                fontSize: 30,
                lineHeight: 1.4,
                letterSpacing: "-0.01em",
                textWrap: "pretty",
              }}
            >
              Por que não assinamos o ChatGPT e mandamos alguém jogar o PDF lá?
            </p>
          </Entra>
        </div>
        <div style={{ gridColumn: "6 / span 7" }}>
          <Comparacao atraso={700} />
        </div>
      </div>
    ),
  },

  {
    rotulo: "Continuidade",
    numero: "15",
    bloco: BLOCO,
    titulo: "O que não depende de confiança",
    manchete: [
      { texto: "Continuidade não é acreditar em uma pessoa.", fraca: true },
      "É saber o que fica com a empresa.",
    ],
    notas:
      "A ÚLTIMA OBJEÇÃO QUE MERECE TELA É CONTINUIDADE. Responder com artefato e contrato, não com promessa pessoal.\n\nÀ ESQUERDA, OS ARQUIVOS: pertencem à PROSUL e continuam utilizáveis fora do sistema. O histórico preserva dados, linhas, tomos e eventos, e os arquivos ficam guardados cifrados no cofre (folha 11).\n\nSE PERGUNTAREM 'e se o sistema cair?': a operação já é vigiada. Um monitor confere o sistema no ar a cada 10 minutos e abre um alerta quando ele cai; o banco tem backup diário, e a restauração foi ensaiada numa cópia; e quem usa abre chamado de suporte de dentro do produto, com a tela anexada.\n\nÀ DIREITA, O CONTRATO: prazo de resposta, vigência, suporte e encerramento são condições escritas — não boa vontade. Os termos de cada uma se combinam na proposta.\n\nEMBAIXO, A AUTORIA: a propriedade aparece aqui, em uma frase, antes do fechamento comercial. A custódia do código continua disponível apenas numa relação de prazo longo. Não oferecê-la por desconto.",
    corpo: (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "start" }}>
          <div>
            <Entra atraso={300}>
              <p style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em" }}>
                Os arquivos ficam com vocês
              </p>
              <p className="ap-texto" style={{ marginTop: 6, fontSize: 21 }}>
                Utilizáveis fora do sistema, sem depender dele.
              </p>
            </Entra>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginTop: 26 }}>
              {ARQUIVOS.map((a, i) => (
                <span
                  key={a}
                  className="ap-assenta"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12,
                    gridColumn: i < 4 ? "span 3" : "span 2",
                    height: 92,
                    padding: "0 24px",
                    borderRadius: 14,
                    background: "var(--ds-p-paper)",
                    color: "var(--ds-text-on-paper)",
                    fontSize: 21,
                    fontWeight: 500,
                    boxShadow: "0 24px 40px -24px rgb(0 0 0 / 0.9)",
                    animationDelay: `${520 + i * 110}ms`,
                  }}
                >
                  {i < 4 ? <FileText size={21} strokeWidth={1.75} /> : <FileArchive size={21} strokeWidth={1.75} />}
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div>
            <Entra atraso={900}>
              <p style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em" }}>
                A operação fica no contrato
              </p>
              <p className="ap-texto" style={{ marginTop: 6, fontSize: 21 }}>
                Condições escritas, não boa vontade.
              </p>
            </Entra>
            <Papel arquivo="Contrato do piloto" atraso={1100} style={{ marginTop: 26 }}>
              {CLAUSULAS.map((c, i) => (
                <p
                  key={c}
                  className="ap-entra"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr",
                    margin: 0,
                    padding: "12px 0",
                    boxShadow: i ? "inset 0 1px 0 rgb(10 11 13 / 0.08)" : undefined,
                    animationDelay: `${1300 + i * 160}ms`,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 15, color: "var(--ds-text-on-paper-muted)", paddingTop: 4 }}>
                    {i + 1}.
                  </span>
                  <b style={{ fontSize: 22, fontWeight: 600 }}>{c}</b>
                </p>
              ))}
            </Papel>
          </div>
        </div>
        <Entra
          atraso={2100}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            marginTop: 32,
            paddingTop: 24,
            boxShadow: "inset 0 1px 0 var(--ds-line-subtle)",
          }}
        >
          <ScrollText aria-hidden="true" size={28} strokeWidth={1.5} style={{ flex: "none", color: "var(--ds-text-tertiary)" }} />
          <p className="ap-texto" style={{ fontSize: 22 }}>
            <b style={{ fontWeight: 500, color: "var(--ds-text-primary)" }}>
              Autoria e licença não se confundem.
            </b>{" "}
            O NexoDoc é propriedade de Matheus Mendes. O piloto compra licença de
            uso e acompanhamento; custódia de código é negociação de longo prazo.
          </p>
        </Entra>
      </>
    ),
  },
];
