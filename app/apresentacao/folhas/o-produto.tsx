"use client";

import {
  Check,
  FileSearch,
  FileText,
  Layers,
  ScanText,
  Wrench,
  X,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Orbe } from "@/components/ds/basicos";

import type { Slide } from "../palco";
import {
  Contador,
  Diagrama,
  Entra,
  Fio,
  Grifo,
  LinhaDePapel,
  MONO,
  Mostrador,
  No,
  Papel,
  Particula,
  Selo,
} from "../pecas";

/**
 * CAPÍTULO 1 — O PRODUTO (folhas 02 a 05). Notas de 09/09/2026, ajustadas ao
 * que cada folha mostra desde a segunda versão (02/10/2026): manchete com a
 * conclusão e uma peça que a prova.
 */

const BLOCO = "O produto";

/* ═════════════════════════════════════════════ folha 02: as duas capacidades */

const COR_DO_NIVEL = {
  critico: "var(--ds-sev-block)",
  tecnico: "var(--ds-sev-decide)",
  editorial: "var(--ds-sev-note)",
} as const;

type Nivel = keyof typeof COR_DO_NIVEL;

/**
 * O que "confere" quer dizer, desenhado: uma página com três trechos grifados
 * na cor do nível e, ao lado, os três achados como a Fila os lista. Os títulos
 * e páginas são do 117-25 (a corrida da folha 05) — nada de amostra.
 */
function IlustraConfere({ atraso }: { atraso: number }) {
  const achados: [Nivel, string, string][] = [
    ["critico", "Endereços de frente de serviço divergentes", "p. 25"],
    ["tecnico", "“USB” no lugar de UBS", "p. 29"],
    ["editorial", "“ambulânciua”", "p. 38"],
  ];
  const linhas = ["92%", "80%", "g0", "88%", "70%", "g1", "94%", "62%", "g2", "84%"];
  return (
    <div style={{ display: "flex", gap: 32, alignItems: "center", height: 280 }}>
      <div
        className="ap-papel ap-entra"
        style={{
          width: 250,
          height: 280,
          boxSizing: "border-box",
          padding: "18px 20px",
          animationDelay: `${atraso}ms`,
        }}
      >
        {linhas.map((l, i) => {
          if (!l.startsWith("g")) return <LinhaDePapel key={i} largura={l} />;
          const g = Number(l.slice(1));
          const nivel = achados[g][0];
          return (
            <span
              key={i}
              aria-hidden="true"
              style={{ display: "flex", gap: 6, margin: "10px 0" }}
            >
              <span
                className="ap-papel__linha"
                style={{ width: "30%", margin: 0 }}
              />
              <span
                className="ap-acende"
                style={{
                  width: "48%",
                  height: 13,
                  marginTop: -2,
                  borderRadius: 4,
                  background: COR_DO_NIVEL[nivel],
                  opacity: 0.85,
                  animationDelay: `${atraso + 500 + g * 220}ms`,
                }}
              />
            </span>
          );
        })}
      </div>
      <ul style={{ flex: 1, margin: 0, padding: 0, listStyle: "none" }}>
        {achados.map(([nivel, titulo, pagina], i) => (
          <li
            key={pagina}
            className="ap-entra"
            style={{
              display: "grid",
              gridTemplateColumns: "20px 1fr auto",
              alignItems: "center",
              gap: 12,
              padding: "16px 0",
              boxShadow: i ? "inset 0 1px 0 var(--ds-line-subtle)" : undefined,
              animationDelay: `${atraso + 560 + i * 220}ms`,
            }}
          >
            <i
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: COR_DO_NIVEL[nivel],
              }}
            />
            <span style={{ fontSize: 20, color: "var(--ds-text-primary)" }}>
              {titulo}
            </span>
            <span className="ap-codigo" style={{ fontSize: 15 }}>
              {pagina}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Uma folha em miniatura: capa, lista ou prancha (paisagem, com carimbo). */
function Miniatura({
  tipo,
  atraso,
  style,
}: {
  tipo: "capa" | "ld" | "prancha";
  atraso: number;
  style?: CSSProperties;
}) {
  const paisagem = tipo === "prancha";
  return (
    <span
      aria-hidden="true"
      className="ap-assenta"
      style={{
        position: "absolute",
        width: paisagem ? 128 : 92,
        height: paisagem ? 92 : 128,
        boxSizing: "border-box",
        padding: 10,
        borderRadius: 6,
        background: "var(--ds-p-paper)",
        boxShadow: "0 18px 30px -18px rgb(0 0 0 / 0.9)",
        animationDelay: `${atraso}ms`,
        ...style,
      }}
    >
      {tipo === "capa" ? (
        <>
          <span className="ap-papel__linha" style={{ width: "50%", margin: "6px 0" }} />
          <span
            style={{
              display: "block",
              height: 12,
              margin: "26px 0 6px",
              borderRadius: 3,
              background: "rgb(10 11 13 / 0.6)",
            }}
          />
          <span className="ap-papel__linha" style={{ width: "70%", margin: "6px 0" }} />
        </>
      ) : null}
      {tipo === "ld"
        ? ["80%", "90%", "70%", "86%", "76%", "90%", "60%"].map((l, i) => (
            <span
              key={i}
              className="ap-papel__linha"
              style={{ width: l, height: 6, margin: "6px 0" }}
            />
          ))
        : null}
      {tipo === "prancha" ? (
        <>
          <span
            style={{
              position: "absolute",
              inset: "10px 44px 10px 10px",
              border: "1.5px solid rgb(10 11 13 / 0.35)",
            }}
          />
          <span
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              width: 28,
              height: 22,
              border: "1.5px solid rgb(10 11 13 / 0.55)",
            }}
          />
        </>
      ) : null}
    </span>
  );
}

/**
 * O que "monta" quer dizer, desenhado: a capa, a lista de documentos e as
 * pranchas viram um volume — o mesmo encadeamento do Mapa do volume.
 */
function IlustraMonta({ atraso }: { atraso: number }) {
  const rotulo = (texto: string, x: number, w: number, a: number) => (
    <span
      className="ap-entra"
      style={{
        position: "absolute",
        left: x,
        top: 222,
        width: w,
        textAlign: "center",
        fontSize: 17,
        color: "var(--ds-text-tertiary)",
        animationDelay: `${a}ms`,
      }}
    >
      {texto}
    </span>
  );
  return (
    <Diagrama
      largura={656}
      altura={280}
      style={{ alignSelf: "center" }}
      fios={
        <>
          <Fio d="M 102 140 L 128 140" atraso={atraso + 260} />
          <Fio d="M 230 140 L 256 140" atraso={atraso + 520} />
          <Fio
            d="M 420 140 L 500 140"
            atraso={atraso + 900}
            seta={{ x: 500, y: 140, dir: "direita" }}
          />
        </>
      }
    >
      <Miniatura tipo="capa" atraso={atraso} style={{ left: 0, top: 76 }} />
      {rotulo("Capa", -14, 120, atraso + 100)}
      <Miniatura tipo="ld" atraso={atraso + 260} style={{ left: 132, top: 76 }} />
      {rotulo("Lista", 118, 120, atraso + 360)}
      <Miniatura tipo="prancha" atraso={atraso + 520} style={{ left: 262, top: 70 }} />
      <Miniatura tipo="prancha" atraso={atraso + 600} style={{ left: 276, top: 86 }} />
      <Miniatura tipo="prancha" atraso={atraso + 680} style={{ left: 290, top: 102 }} />
      {rotulo("Pranchas", 262, 156, atraso + 700)}
      <Miniatura tipo="capa" atraso={atraso + 1180} style={{ left: 548, top: 60 }} />
      <Miniatura tipo="ld" atraso={atraso + 1120} style={{ left: 532, top: 70 }} />
      <Miniatura tipo="capa" atraso={atraso + 1060} style={{ left: 516, top: 80 }} />
      {rotulo("Volume", 510, 140, atraso + 1240)}
    </Diagrama>
  );
}

function Capacidade({
  verbo,
  texto,
  atraso,
  children,
}: {
  verbo: string;
  texto: string;
  atraso: number;
  children: ReactNode;
}) {
  return (
    <div
      className="ap-painel ap-entra"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
        padding: "36px 40px 40px",
        animationDelay: `${atraso}ms`,
      }}
    >
      {children}
      <div style={{ boxShadow: "inset 0 1px 0 var(--ds-line-subtle)", paddingTop: 28 }}>
        <p
          style={{
            margin: 0,
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: "var(--ds-text-primary)",
          }}
        >
          {verbo}
        </p>
        <p className="ap-texto" style={{ marginTop: 10 }}>
          {texto}
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════ folha 03: o motor */

const L1 = 120;
const L2 = 390;
const PASSOS_X = [690, 870, 1050, 1230];
const ENTRADA_1 = `M 270 ${L1} C 350 ${L1} 360 255 410 255`;
const ENTRADA_2 = `M 270 ${L2} C 350 ${L2} 360 255 410 255`;
const SAIDA_1 = `M 530 255 C 590 255 590 ${L1} 650 ${L1} L 1400 ${L1}`;
const SAIDA_2 = `M 530 255 C 590 255 590 ${L2} 650 ${L2} L 1400 ${L2}`;

function Raia({
  y,
  rotulo,
  passos,
  saida,
  atraso,
}: {
  y: number;
  rotulo: string;
  passos: readonly string[];
  saida: string;
  atraso: number;
}) {
  return (
    <>
      <span
        className="ap-entra"
        style={{
          position: "absolute",
          left: PASSOS_X[0] - 18,
          top: y - 62,
          fontSize: 20,
          fontWeight: 500,
          color: "var(--ds-text-primary)",
          animationDelay: `${atraso}ms`,
        }}
      >
        {rotulo}
      </span>
      {passos.map((p, i) => (
        <span key={p}>
          <span
            className="ap-assenta"
            style={{
              position: "absolute",
              left: PASSOS_X[i] - 18,
              top: y - 18,
              width: 36,
              height: 36,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              background: "var(--ds-surface-page)",
              boxShadow: "inset 0 0 0 1.5px var(--ds-line-strong)",
              fontFamily: MONO,
              fontSize: 15,
              color: "var(--ds-text-secondary)",
              animationDelay: `${atraso + 200 + i * 140}ms`,
            }}
          >
            {i + 1}
          </span>
          <span
            className="ap-entra"
            style={{
              position: "absolute",
              left: PASSOS_X[i] - 18,
              top: y + 32,
              width: 166,
              fontSize: 19,
              lineHeight: 1.35,
              color: "var(--ds-text-secondary)",
              animationDelay: `${atraso + 280 + i * 140}ms`,
            }}
          >
            {p}
          </span>
        </span>
      ))}
      <No
        x={1420}
        y={y - 56}
        largura={260}
        altura={112}
        variante="claro"
        atraso={atraso + 200 + passos.length * 140}
        icone={<FileText size={22} strokeWidth={1.75} />}
        titulo={saida}
      />
    </>
  );
}

/* ═════════════════════════════════════════════ folha 05: o memorial lido */

/**
 * AS PÁGINAS COM ACHADO DE UMA EXECUÇÃO REAL — o parecer `34e41ba2` do
 * `117_25_md_geral_a` (memorial geral da UBS Vila Manaus, 218 páginas), leitura
 * profunda, gravado no banco em 14/09/2026 com 56 achados. É a MÉTRICA do deck
 * inteiro: esta folha, os trechos da 07, a pergunta da 14 e o custo do anexo
 * saem da mesma corrida.
 *
 * Página e gravidade, lidas de lá; nada inventado. Achado citado em faixa de
 * páginas ("159-200") acende o início e o fim, não o miolo. Onde duas
 * gravidades caem na mesma página, vale a maior. O mapa é o parecer como ele
 * saiu, contestações incluídas (p. 1 e p. 215): tirá-las faria o mapa
 * discordar do "56".
 */
const PAGINAS_POR_NIVEL: Record<Nivel, readonly number[]> = {
  critico: [1, 14, 25, 92, 99, 113, 115, 159, 200, 211, 215, 217],
  tecnico: [
    12, 15, 17, 21, 26, 29, 30, 31, 35, 39, 47, 57, 60, 66, 72, 74, 81, 83, 85,
    95, 100, 101, 103, 105, 107, 109, 110, 120, 121, 150, 160, 195, 201, 202,
    203,
  ],
  editorial: [13, 38, 42, 43, 46, 62, 63, 64, 128, 206],
};

const NIVEL_DA_PAGINA = new Map<number, Nivel>(
  (Object.entries(PAGINAS_POR_NIVEL) as [Nivel, readonly number[]][]).flatMap(
    ([nivel, paginas]) => paginas.map((p) => [p, nivel] as const),
  ),
);

/** Os 56 do parecer, pela gravidade que o próprio parecer atribuiu. */
const ACHADOS_POR_NIVEL: ReadonlyArray<readonly [Nivel, number, string, string]> = [
  ["critico", 11, "Impedem emitir", "corrigir antes de entregar"],
  ["tecnico", 32, "Técnicos ou contratuais", "pedem decisão de quem projeta"],
  ["editorial", 13, "Editoriais", "redação, grafia, referência"],
];

const COLUNAS_DO_MAPA = 37;
const PAGINA_DO_EXEMPLAR = 25;

/**
 * O MAPA DAS PÁGINAS, como o Resultado o desenha: um quadrado por página, na
 * ordem de leitura; lida e limpa num cinza quieto, com achado na cor do nível.
 * A página do exemplar ganha um anel quando o achado aberto chega.
 */
function MapaDasPaginas({
  paginas,
  atraso,
  duracao,
  anelEm,
}: {
  paginas: number;
  atraso: number;
  duracao: number;
  anelEm: number;
}) {
  const passo = duracao / paginas;
  return (
    <div
      aria-hidden="true"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${COLUNAS_DO_MAPA}, 1fr)`,
        gap: 5,
      }}
    >
      {Array.from({ length: paginas }, (_, i) => {
        const n = i + 1;
        const nivel = NIVEL_DA_PAGINA.get(n);
        return (
          <span
            key={n}
            style={{
              position: "relative",
              aspectRatio: "1",
              borderRadius: 4,
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.06)",
            }}
          >
            <span
              className="ap-acende"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 4,
                background: nivel ? COR_DO_NIVEL[nivel] : "rgb(255 255 255 / 0.09)",
                animationDelay: `${atraso + i * passo}ms`,
              }}
            />
            {n === PAGINA_DO_EXEMPLAR ? (
              <span
                className="ap-surge"
                style={{
                  position: "absolute",
                  inset: -5,
                  borderRadius: 7,
                  boxShadow: "inset 0 0 0 2px var(--ds-text-primary)",
                  animationDelay: `${anelEm}ms`,
                }}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

/** Os níveis em faixa, do Resumo do Resultado: proporção num olhar, e uma pílula por achado. */
function NiveisEmFaixa({ atraso }: { atraso: number }) {
  const total = ACHADOS_POR_NIVEL.reduce((s, [, n]) => s + n, 0);
  return (
    <div>
      <div style={{ display: "flex", gap: 5, height: 12 }}>
        {ACHADOS_POR_NIVEL.map(([g, n], i) => (
          <span
            key={g}
            className="ap-risca"
            style={{
              flexGrow: n,
              flexBasis: 0,
              borderRadius: 999,
              background: COR_DO_NIVEL[g],
              animationDelay: `${atraso + i * 120}ms`,
            }}
          />
        ))}
      </div>
      <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none" }}>
        {ACHADOS_POR_NIVEL.map(([g, n, rotulo, dica], gi) => (
          <li
            key={g}
            className="ap-surge"
            style={{
              display: "grid",
              gridTemplateColumns: "5px minmax(0, 1fr) auto 84px",
              alignItems: "center",
              gap: 20,
              padding: "11px 0",
              boxShadow: "inset 0 1px 0 var(--ds-line-subtle)",
              animationDelay: `${atraso + 200 + gi * 140}ms`,
            }}
          >
            <i
              style={{
                alignSelf: "stretch",
                borderRadius: 999,
                background: COR_DO_NIVEL[g],
              }}
            />
            <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
              <b style={{ fontSize: 21, fontWeight: 500, color: "var(--ds-text-primary)" }}>
                {rotulo}
              </b>
              <small style={{ fontSize: 16, color: "var(--ds-text-tertiary)" }}>
                {dica}
              </small>
            </span>
            <span
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                maxWidth: 330,
                justifyContent: "flex-end",
              }}
            >
              {Array.from({ length: n }, (_, i) => (
                <i
                  key={i}
                  className="ap-acende"
                  style={{
                    width: 6,
                    height: 20,
                    borderRadius: 999,
                    background: COR_DO_NIVEL[g],
                    animationDelay: `${atraso + 320 + gi * 140 + i * 18}ms`,
                  }}
                />
              ))}
            </span>
            <span style={{ display: "grid", justifyItems: "end", lineHeight: 1.05 }}>
              <b
                style={{
                  fontSize: 30,
                  fontWeight: 400,
                  letterSpacing: "-0.03em",
                  color: "var(--ds-text-primary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {n}
              </b>
              <small style={{ fontSize: 15, color: "var(--ds-text-tertiary)" }}>
                {Math.round((n / total) * 100)}%
              </small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ AS FOLHAS */

export const O_PRODUTO: readonly Slide[] = [
  {
    rotulo: "O que é",
    numero: "02",
    bloco: BLOCO,
    titulo: "O que é",
    manchete: ["Um sistema que confere o memorial", "e monta o volume do projeto."],
    notas:
      "Ler a manchete devagar. Os dois painéis são os dois caminhos da próxima folha, na mesma ordem: primeiro confere, depois monta.\n\nNO PAINEL DA ESQUERDA, os três achados são de verdade, do 117-25 — a mesma corrida da folha 05: o endereço divergente da p. 25, o 'USB' da p. 29, o 'ambulânciua' da p. 38. Não precisa lê-los agora; voltam nas folhas 05 e 07.",
    corpo: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <Capacidade
          verbo="Confere"
          texto="Lê o que já está escrito nos memoriais e aponta o que não fecha."
          atraso={420}
        >
          <IlustraConfere atraso={560} />
        </Capacidade>
        <Capacidade
          verbo="Monta"
          texto="Os documentos que acompanham o projeto: listas de documentos, capas e volumes."
          atraso={640}
        >
          <IlustraMonta atraso={900} />
        </Capacidade>
      </div>
    ),
  },

  {
    rotulo: "O motor",
    numero: "03",
    bloco: BLOCO,
    titulo: "Como funciona",
    manchete: ["Um motor, dois caminhos."],
    lead: "O documento entra, o sistema lê, e o caminho se decide pelo que ele é.",
    notas:
      "Acompanhar o desenho conforme ele monta: os documentos entram, passam pelo motor, e cada um segue o seu caminho. O ponto violeta é o documento atravessando — esperar ele chegar ao parecer antes de falar da montagem.\n\nO ponto que vale repetir: os dois caminhos saem do MESMO motor — é o mesmo sistema lendo o mesmo tipo de documento, e por isso o que ele aprende de um lado serve do outro.\n\nSE PERGUNTAREM o que é regra e o que é IA: regra determinística é conta e comparação, não inventa, e a IA não pode apagá-la. A IA lê o que regra nenhuma alcança. A validação é a etapa que remove o achado sem sustentação.",
    corpo: (
      <>
        <Diagrama
          largura={1680}
          altura={520}
          fios={
            <>
              <Fio d={ENTRADA_1} atraso={420} />
              <Fio d={ENTRADA_2} atraso={520} />
              <Fio d={SAIDA_1} atraso={900} />
              <Fio d={SAIDA_2} atraso={1500} />
              <Fio d={`M 1400 ${L1} L 1420 ${L1}`} atraso={1400} />
              <Fio d={`M 1400 ${L2} L 1420 ${L2}`} atraso={2000} />
            </>
          }
        >
          <No
            x={0}
            y={L1 - 42}
            largura={270}
            altura={84}
            atraso={240}
            icone={<FileText size={22} strokeWidth={1.75} />}
            titulo="Memorial descritivo"
          />
          <No
            x={0}
            y={L2 - 42}
            largura={270}
            altura={84}
            atraso={340}
            icone={<Layers size={22} strokeWidth={1.75} />}
            titulo="Pranchas e projeto"
          />
          <div
            className="ap-assenta"
            style={{
              position: "absolute",
              left: 414,
              top: 199,
              display: "grid",
              justifyItems: "center",
              gap: 14,
              animationDelay: "640ms",
            }}
          >
            <Orbe tamanho={112} />
            <span style={{ fontSize: 19, fontWeight: 500, color: "var(--ds-text-secondary)" }}>
              O motor
            </span>
          </div>
          <Raia
            y={L1}
            rotulo="Conferência"
            atraso={900}
            passos={[
              "Extrai o texto e mapeia cada página",
              "Aplica as regras determinísticas",
              "Lê o documento com o modelo de IA",
              "Valida cada achado e descarta o que não se sustenta",
            ]}
            saida="Parecer com página e transcrição"
          />
          <Raia
            y={L2}
            rotulo="Montagem"
            atraso={1500}
            passos={[
              "Lê os selos das pranchas",
              "Reconhece a identidade do projeto",
              "Acusa folha faltante e duplicada",
              "Monta a lista, a capa e os volumes",
            ]}
            saida="ODT, PDF e ZIP prontos"
          />
          <Particula d={`${ENTRADA_1} ${SAIDA_1.replace("M 530 255", "L 530 255")}`} atraso={2300} duracao={2200} />
          <Particula d={`${ENTRADA_2} ${SAIDA_2.replace("M 530 255", "L 530 255")}`} atraso={2900} duracao={2200} />
        </Diagrama>
      </>
    ),
  },

  {
    rotulo: "Ele revisa a si mesmo",
    numero: "04",
    bloco: BLOCO,
    titulo: "Ele revisa a si mesmo",
    manchete: [
      { texto: "A primeira leitura levanta.", fraca: true },
      "A segunda existe para derrubar o que não se sustenta.",
    ],
    notas:
      "Este slide responde antes da pergunta 'e se ele inventar?'. Acompanhar os pontos: todos passam pela segunda leitura; os que se sustentam chegam à tela, o que não se sustenta é descartado — e, quando contradiz uma regra minha, vira correção e volta para o começo.\n\nO caso real, para narrar: uma regra minha acusava marca fechada; a validação leu o documento inteiro e achou, quarenta páginas adiante, a cláusula que derrubava a acusação. Eu tinha lido aquelas ocorrências uma a uma e não vi.\n\nOS PONTOS NÃO SÃO CONTAGEM. É o desenho do caminho, não uma proporção de achados descartados.",
    corpo: (
      <Diagrama
        largura={1680}
        altura={610}
        fios={
          <>
            <Fio d="M 300 280 L 440 280" atraso={600} seta={{ x: 440, y: 280, dir: "direita" }} />
            <Fio d="M 800 280 C 890 280 890 105 980 105" atraso={1100} tom="ok" seta={{ x: 980, y: 105, dir: "direita" }} />
            <Fio d="M 800 280 C 890 280 890 465 980 465" atraso={1200} tom="block" seta={{ x: 980, y: 465, dir: "direita" }} />
            <Fio d="M 1300 465 L 1380 465" atraso={1700} seta={{ x: 1380, y: 465, dir: "direita" }} />
            <Fio d="M 1530 530 L 1530 560 L 150 560 L 150 350" atraso={2100} seta={{ x: 150, y: 350, dir: "cima" }} />
          </>
        }
      >
        <Particula d="M 300 280 L 800 280 C 890 280 890 105 980 105" atraso={2600} tom="ok" />
        <Particula d="M 300 280 L 800 280 C 890 280 890 105 980 105" atraso={2900} tom="ok" />
        <Particula d="M 300 280 L 800 280 C 890 280 890 465 980 465" atraso={3200} tom="block" />
        <No
          x={0}
          y={210}
          largura={300}
          altura={140}
          atraso={300}
          icone={<ScanText size={22} strokeWidth={1.75} />}
          titulo="Primeira leitura"
          texto="Regras e modelo levantam os achados."
        />
        <No
          x={440}
          y={196}
          largura={360}
          altura={168}
          variante="nexo"
          atraso={760}
          icone={<FileSearch size={22} strokeWidth={1.75} />}
          titulo="Segunda passada"
          texto="Cada achado volta ao documento, procurando o que o contradiz."
        />
        <No
          x={980}
          y={40}
          largura={320}
          altura={130}
          atraso={1400}
          icone={<Check size={22} strokeWidth={2} style={{ color: "var(--ds-state-ok)" }} />}
          titulo="Chega à sua tela"
          texto="Só o que se sustenta no documento."
        />
        <No
          x={980}
          y={386}
          largura={320}
          altura={158}
          atraso={1500}
          icone={<X size={22} strokeWidth={2} style={{ color: "var(--ds-sev-block)" }} />}
          titulo="Descartado"
          texto="Quando contradiz uma regra minha, a discordância fica registrada."
        />
        <No
          x={1380}
          y={386}
          largura={300}
          altura={158}
          atraso={1900}
          icone={<Wrench size={22} strokeWidth={1.75} />}
          titulo="Vira correção"
          texto="A mesma regra contestada pelo mesmo motivo é defeito meu."
        />
        <Entra
          atraso={2400}
          style={{ position: "absolute", left: 180, top: 572, width: 1300 }}
        >
          <p className="ap-fonte" style={{ fontSize: 19 }}>
            E aprende com o próprio erro: falso positivo e gravidade errada viram
            caso de teste. Uma regra inteira já foi aposentada assim, e o total de
            achados do acervo caiu quase pela metade.
          </p>
        </Entra>
      </Diagrama>
    ),
  },

  {
    rotulo: "O resultado",
    numero: "05",
    bloco: BLOCO,
    titulo: "O resultado",
    manchete: ["Um memorial inteiro, conferido."],
    notas:
      "É A DEMONSTRAÇÃO. O mapa é o memorial página a página, como o Resultado da auditoria o desenha; a leitura passa, e onde há achado a página fica na cor do nível. Deixar o mapa terminar antes de falar: são dois segundos e meio, e a sala acompanha sozinha.\n\nTUDO NESTA FOLHA É UMA CORRIDA SÓ: o 117_25 em leitura profunda, gravado no banco em 14/09/2026. 218 páginas, 56 achados, 5,4 minutos, US$ 1,61 somados do registro de uso (leitura, validação e as 14 páginas sem texto que precisaram ser transcritas). Se perguntarem por que a corrida de agosto deu 28: aquela foi no nível padrão, com outro modelo — não é a mesma leitura, e não serve de comparação.\n\nOS NÍVEIS SÃO O PARECER, SEM ARREDONDAR: 11 impedem emitir, 32 são técnicos ou contratuais, 13 editoriais. Ler só o 11.\n\nO ACHADO ABERTO É O QUE A SALA VAI VER NO PRODUTO: o trecho grifado na própria página. Ler o trecho em voz alta: um memorial da UBS Vila Manaus, na Rua São Francisco de Assis, mandando fazer a limpeza e a microdrenagem de outras ruas — Rua Bento Goiá e Av. Engenheiro Max de Souza —, na página 25. As linhas cinzas em volta são a página, não texto: o deck só transcreve o que conferiu. Não dizer de onde são essas ruas: o documento não diz. Na mesma corrida ele achou outra prefeitura como proprietária (Chapecó, p. 99) e a exigência de um shopping numa UBS (p. 211) — guardar esses dois para a folha 07, que os mostra.\n\nO ACHADO EM DESTAQUE NÃO É DE ESTRUTURA, de propósito: quem apresenta é da equipe de estrutura.\n\nLer os números sem adjetivo — eles não precisam de ajuda.",
    corpo: (
      <>
        <div className="ap-regua-num ap-surge" style={{ animationDelay: "200ms" }}>
          <Mostrador
            rotulo="páginas lidas"
            atraso={520}
            valor={<Contador ate={218} atraso={520} duracao={2300} />}
          />
          <Mostrador
            rotulo="achados, cada um com página e trecho"
            atraso={2700}
            valor={<Contador ate={56} atraso={2700} duracao={720} />}
          />
          <Mostrador rotulo="tempo de leitura" atraso={3200} valor="5,4 min" />
          <Mostrador
            rotulo="custo, lido do registro de uso"
            atraso={3340}
            valor="US$ 1,61"
          />
        </div>

        <div
          className="ap-grade"
          style={{ flex: 1, minHeight: 0, marginTop: 20, alignItems: "stretch" }}
        >
          <div
            className="ap-painel ap-surge"
            style={{
              gridColumn: "1 / span 7",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              padding: "24px 32px 22px",
              animationDelay: "320ms",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="ap-rotulo" style={{ color: "var(--ds-text-primary)" }}>
                Páginas do memorial
              </span>
              <span className="ap-codigo" style={{ fontSize: 15 }}>
                117_25_md_geral_a.pdf
              </span>
            </div>
            <MapaDasPaginas paginas={218} atraso={520} duracao={2300} anelEm={3950} />
            <div style={{ marginTop: "auto" }}>
              <NiveisEmFaixa atraso={2900} />
            </div>
          </div>

          <div
            className="ap-painel ap-entra"
            style={{
              gridColumn: "8 / span 5",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              padding: "24px 30px 28px",
              animationDelay: "3950ms",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Selo tom="block">Impede emitir</Selo>
              <span className="ap-codigo" style={{ fontSize: 17 }}>
                p. {PAGINA_DO_EXEMPLAR}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 500,
                lineHeight: 1.18,
                letterSpacing: "-0.02em",
                color: "var(--ds-text-primary)",
              }}
            >
              Endereços de frente de serviço divergentes
            </p>
            <Papel
              arquivo="117_25_md_geral_a.pdf"
              pagina={`p. ${PAGINA_DO_EXEMPLAR}`}
              atraso={4150}
              style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
            >
              <LinhaDePapel largura="92%" />
              <LinhaDePapel largura="78%" />
              <p style={{ margin: "12px 0", fontSize: 22, lineHeight: 1.55 }}>
                …realizar a limpeza e microdrenagem da{" "}
                <Grifo atraso={4600}>
                  Rua Bento Goiá e Av. Engenheiro Max de Souza
                </Grifo>
                .
              </p>
              {["86%", "94%", "71%", "90%", "58%"].map((l) => (
                <LinhaDePapel key={l} largura={l} />
              ))}
            </Papel>
          </div>
        </div>
      </>
    ),
  },
];
