"use client";

import type { CSSProperties } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";
import { AgentOrb } from "@/modules/nexo/components/agent-orb/AgentOrb";
import {
  corDaDisciplina,
  siglaDaDisciplina,
} from "@/modules/nexo/lib/disciplina-cor";

import type { Slide } from "../palco";
import {
  Contador,
  Entra,
  EscalaHorizontal,
  EscalaVertical,
  Linhas,
  MONO,
  Mostrador,
} from "../pecas";

/**
 * BLOCO 1 — O QUE É (folhas 01 a 05). Texto e notas são os de 09/09/2026,
 * copiados sem alteração; o que este arquivo decide é a composição, pelo spec
 * `2026-09-10-deck-instrumento-design.md`.
 */

/** A largura do conteúdo: 1920 − 224 (trilho + margem) − 80. */
export const LARGURA_UTIL = 1616;

/* ─────────────────────────────────────────────── o motor: colchete e ramos */

/**
 * METADE DO COLCHETE que sai do motor: a aresta horizontal até o ramo, mais o
 * pedaço de espinha que alcança a outra metade.
 *
 * POR QUE ESTRUTURAL, e não posicionado por porcentagem. A primeira versão
 * punha as arestas em `top: 26%` / `bottom: 26%`, e elas caíam ENTRE os ramos —
 * porque os dois ramos têm alturas diferentes e o centro de cada um não está
 * onde a porcentagem supõe. Aqui cada metade acompanha o próprio ramo, e a
 * aresta nasce no centro dele por construção.
 *
 * A espinha invade a lacuna de 40px entre as metades (`-20px`) para as duas se
 * encontrarem no meio — sem isso a linha ficaria partida no vão.
 */
function MetadeDoColchete({
  paraBaixo,
  atraso,
}: {
  paraBaixo: boolean;
  atraso: number;
}) {
  const cor = "rgb(91 218 198 / 0.4)";
  return (
    <div aria-hidden="true" style={{ flex: 1, position: "relative" }}>
      <div
        className="ap-risca"
        style={{
          animationDelay: `${atraso}ms`,
          position: "absolute",
          left: 0,
          top: "50%",
          width: "100%",
          height: 1,
          background: cor,
        }}
      />
      <div
        className="ap-desce"
        style={{
          animationDelay: `${atraso - 80}ms`,
          position: "absolute",
          left: 0,
          top: paraBaixo ? "50%" : -20,
          bottom: paraBaixo ? -20 : "50%",
          width: 1,
          background: cor,
        }}
      />
    </div>
  );
}

/**
 * Um ramo do motor: rótulo e a cadeia de etapas como ESCALA HORIZONTAL compacta.
 * As caixas de antes eram cartões iguais em fila; aqui as etapas são fatos
 * sobre a linha, e a saída é o último fato, em teal. O documento (o pulso)
 * percorre a linha da escala — a mesma que os ticks marcam.
 */
function Ramo({
  titulo,
  cor,
  passos,
  saida,
  atrasoBase,
}: {
  titulo: string;
  cor: string;
  passos: readonly string[];
  saida: string;
  atrasoBase: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        gap: 12,
        position: "relative",
      }}
    >
      <Entra atraso={atrasoBase}>
        <span className="ap-mono-rotulo" style={{ color: cor }}>
          {titulo}
        </span>
      </Entra>
      <div style={{ position: "relative" }}>
        {/*
          O DOCUMENTO ATRAVESSA O RAMO. Um ponto da cor do ramo percorre a linha
          da escala uma vez, depois que as etapas chegaram — é o que a folha diz
          em palavras ("o documento entra, o sistema lê") acontecendo na frente
          da sala. O percurso é a largura do ramo: 1616 − 168 do motor − 56 do
          colchete.
        */}
        <span
          aria-hidden="true"
          className="ap-pulso"
          style={{
            position: "absolute",
            left: 0,
            bottom: -5,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: cor,
            zIndex: 1,
            ["--ap-percurso" as string]: "1390px",
            animationDelay: `${atrasoBase + 320 + passos.length * 160 + 720}ms`,
          }}
        />
        <EscalaHorizontal
          compacta
          atraso={atrasoBase}
          fatos={[
            ...passos.map((p) => ({ titulo: [p] })),
            { titulo: [saida], cor: "var(--nexodoc-accent)" },
          ]}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────── o memorial lido, página a página (folha 05) */

/**
 * AS PÁGINAS COM ACHADO DE UMA EXECUÇÃO REAL — o parecer do `117_25_md_geral_a`
 * (memorial geral da UBS Vila Manaus, 218 páginas) gravado no banco em
 * 28/08/2026. Página e gravidade, lidas de lá; nada inventado. É só o que a
 * folha precisa saber: ONDE o mapa acende, e com que cor.
 *
 * A gravidade segue o vocabulário do produto — crítico, técnico, editorial — e
 * as cores são as mesmas do pin sobre a página no canvas da auditoria.
 */
type Gravidade = "critico" | "tecnico" | "editorial";

const PAGINAS_COM_ACHADO: ReadonlyArray<readonly [number, Gravidade]> = [
  [14, "critico"],
  [92, "critico"],
  [99, "critico"],
  [17, "tecnico"],
  [21, "tecnico"],
  [30, "tecnico"],
  [72, "tecnico"],
  [74, "tecnico"],
  [101, "tecnico"],
  [103, "tecnico"],
  [115, "tecnico"],
  [151, "tecnico"],
  [204, "tecnico"],
  [208, "tecnico"],
  [209, "tecnico"],
  [211, "tecnico"],
  [217, "tecnico"],
  [85, "editorial"],
  [86, "editorial"],
  [89, "editorial"],
  [212, "editorial"],
  [215, "editorial"],
  [218, "editorial"],
];

const COR_DA_GRAVIDADE: Record<Gravidade, string> = {
  critico: "var(--status-critical)",
  tecnico: "var(--status-warning)",
  editorial: "var(--muted-foreground)",
};

/**
 * O MAPA DO MEMORIAL: uma marca por página, na ordem. A leitura passa da
 * esquerda para a direita e acende cada página; onde há achado, a marca sobe e
 * ganha a cor da gravidade — o pin do canvas, visto de longe.
 *
 * É a grafia do próprio produto (uma página, um pin), e não um scanner de
 * cinema: nada varre a tela, as páginas simplesmente vão ficando lidas.
 */
function MapaDoMemorial({
  paginas,
  atraso,
  duracao,
}: {
  paginas: number;
  /** Quando a leitura começa. */
  atraso: number;
  /** Quanto tempo a leitura leva para atravessar o documento inteiro. */
  duracao: number;
}) {
  const porPagina = new Map<number, Gravidade>(PAGINAS_COM_ACHADO);
  const passo = duracao / paginas;

  return (
    <div
      aria-hidden="true"
      style={{ display: "flex", gap: 3, height: 96, alignItems: "flex-end" }}
    >
      {Array.from({ length: paginas }, (_, i) => {
        const gravidade = porPagina.get(i + 1);
        return (
          <span
            key={i}
            className="ap-acende"
            style={{
              flex: 1,
              height: gravidade ? 96 : 60,
              background: gravidade ? COR_DA_GRAVIDADE[gravidade] : "#3d474d",
              animationDelay: `${atraso + i * passo}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * UM ACHADO, como o produto o mostra. É o `FindingCardNode` do canvas da
 * auditoria em escala de palco: o ponto da gravidade, o tipo, o trecho
 * transcrito entre aspas, a página e a sigla da disciplina. Mesma ordem,
 * mesma hierarquia, mesmo chanfro — a folha não inventa uma interface mais
 * bonita do que a que a sala vai usar.
 */
function CartaoDeAchado({
  tipo,
  evidencia,
  pagina,
  disciplina,
  gravidade,
  atraso,
  style,
}: {
  tipo: string;
  evidencia: string;
  pagina: number;
  disciplina: string;
  gravidade: Gravidade;
  atraso: number;
  style?: CSSProperties;
}) {
  const sigla = siglaDaDisciplina(disciplina);
  const corDaSigla = corDaDisciplina(disciplina);

  return (
    <div
      className="nx-edge-6 ap-entra"
      style={{ animationDelay: `${atraso}ms`, width: 640, ...style }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "22px 26px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            aria-hidden="true"
            style={{
              width: 14,
              height: 14,
              flex: "none",
              borderRadius: "50%",
              background: COR_DA_GRAVIDADE[gravidade],
            }}
          />
          <p
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: "-0.012em",
              color: "var(--foreground)",
            }}
          >
            {tipo}
          </p>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 23,
            lineHeight: 1.4,
            color: "var(--muted-foreground)",
            textWrap: "pretty",
          }}
        >
          “{evidencia}”
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 16,
            marginTop: 4,
            fontFamily: MONO,
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              fontSize: 20,
              letterSpacing: "0.05em",
              color: "var(--muted-foreground)",
            }}
          >
            p. {pagina}
          </span>
          {sigla ? (
            <span
              style={{
                fontSize: 19,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: corDaSigla ?? "var(--muted-foreground)",
              }}
            >
              {sigla}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ AS FOLHAS */

export const O_QUE_E: readonly Slide[] = [
  {
    rotulo: "Capa",
    numero: "01",
    notas:
      "Abrir sem preâmbulo. Deixar o orbe respirar dois segundos antes de falar — ele é o produto se apresentando sozinho. Nome, o que é, quem fez. Não explicar a capa.",
    corpo: (
      <>
        {/*
          A CAPA nasce na grade, e não no centro. O orbe ocupa as colunas 1 a 4;
          o nome e a linha, da 5 em diante, alinhados pelo topo. O rodapé fica
          sobre a linha fina — a única linha da capa.

          O ORBE VIVO, e não a redução estática dele. É o único elemento que o
          §6 do DESIGN.md autoriza a se mover sozinho. SEM `transform: scale()`:
          o canvas mede a si mesmo para dimensionar o buffer do WebGL e a medição
          enxerga a caixa JÁ TRANSFORMADA — aparecia cortado. `hero` é o tamanho
          para o qual o componente foi ajustado.
        */}
        <div
          className="ap-grade"
          style={{ flex: 1, alignItems: "start", paddingTop: 96 }}
        >
          <div
            className="ap-surge"
            style={{
              gridColumn: "1 / span 4",
              position: "relative",
              display: "grid",
              placeItems: "center",
              height: 340,
            }}
          >
            {/* Atmosfera parada: profundidade sem competir com o orbe. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: -40,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgb(0 166 147 / 0.16), transparent 66%)",
                filter: "blur(28px)",
              }}
            />
            <div style={{ position: "relative" }}>
              <AgentOrb size="hero" state="idle" />
            </div>
          </div>
          <div style={{ gridColumn: "5 / span 8", paddingTop: 48 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 128,
                fontWeight: 500,
                letterSpacing: "-0.038em",
                lineHeight: 1,
                color: "var(--foreground)",
              }}
            >
              <Linhas linhas={["NexoDoc"]} atraso={260} />
            </h1>
            <p
              style={{
                margin: "28px 0 0",
                fontSize: 44,
                letterSpacing: "-0.012em",
                lineHeight: 1.22,
                color: "var(--muted-foreground)",
              }}
            >
              <Linhas
                linhas={[
                  "Conferência e montagem documental",
                  "para projetos de engenharia",
                ]}
                atraso={520}
                passo={90}
              />
            </p>
          </div>
        </div>
        <Entra
          atraso={620}
          style={{
            flex: "none",
            paddingTop: 32,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 20,
            fontFamily: MONO,
            fontSize: 20,
            color: "#5f6b72",
          }}
        >
          <span>Apresentação de software</span>
          <span>·</span>
          <span>2026</span>
          <span>·</span>
          <span>Matheus Mendes</span>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "O que é",
    numero: "02",
    bloco: "O que é",
    titulo: "O que é",
    notas:
      "Ler a frase central devagar. Os três limites da direita são o que impede a sala de imaginar mais do que o sistema faz — e é por dizê-los que o resto do deck fica acreditável.",
    corpo: (
      <div className="ap-grade" style={{ flex: 1, alignItems: "start" }}>
        <div style={{ gridColumn: "1 / span 6" }}>
          <p
            style={{
              margin: 0,
              fontSize: 60,
              fontWeight: 500,
              letterSpacing: "-0.022em",
              lineHeight: 1.15,
              color: "var(--foreground)",
            }}
          >
            <Linhas
              linhas={[
                "Um sistema para organizar",
                "e documentar projetos",
                "de engenharia.",
              ]}
              atraso={80}
            />
          </p>
          <Entra atraso={360}>
            <p
              className="ap-texto"
              style={{ marginTop: 32, fontSize: 32, lineHeight: 1.4 }}
            >
              Ele monta os documentos que acompanham o projeto — listas de
              documentos, capas e volumes — e confere o que já está escrito nos
              memoriais, apontando o que não fecha.
            </p>
          </Entra>
        </div>
        <div
          style={{
            gridColumn: "8 / span 5",
            display: "flex",
            flexDirection: "column",
            height: 760,
          }}
        >
          <Entra atraso={420}>
            <span className="ap-mono-rotulo">E o que ele não faz</span>
          </Entra>
          <EscalaVertical
            atraso={520}
            numerada={false}
            style={{ marginTop: 16 }}
            itens={[
              {
                titulo: "Lê o documento inteiro.",
                texto: "Não é amostragem nem busca por palavra-chave.",
              },
              {
                titulo: "Não altera o documento.",
                texto: "Aponta onde está e o que fazer. Quem edita é você.",
              },
              {
                titulo: "Não substitui revisão técnica.",
                texto: "Faz a conferência que hoje ninguém tem tempo de fazer.",
              },
            ]}
          />
        </div>
      </div>
    ),
  },

  {
    rotulo: "O motor",
    numero: "03",
    bloco: "O que é",
    titulo: "Um motor, dois caminhos",
    subtitulo:
      "O documento entra, o sistema lê, e o caminho se decide pelo que ele é.",
    notas:
      "Acompanhar as caixas conforme aparecem, um ramo de cada vez. O ponto que vale repetir: os dois caminhos saem do MESMO motor — é o mesmo sistema lendo o mesmo tipo de documento, e por isso o que ele aprende de um lado serve do outro.",
    corpo: (
      <>
        <div
          style={{
            flex: 1,
            display: "flex",
            gap: 0,
            alignItems: "stretch",
            paddingTop: 24,
          }}
        >
          <div
            className="ap-surge"
            style={{
              flex: "none",
              width: 168,
              justifyContent: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              animationDelay: "160ms",
            }}
          >
            <MarcaViva size={112} parada />
            <span className="ap-mono-rotulo" style={{ textAlign: "center" }}>
              O motor
            </span>
          </div>
          <div
            style={{
              flex: "none",
              width: 56,
              display: "flex",
              flexDirection: "column",
              gap: 40,
              alignSelf: "stretch",
            }}
          >
            <MetadeDoColchete paraBaixo atraso={300} />
            <MetadeDoColchete paraBaixo={false} atraso={1100} />
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 40,
            }}
          >
            <Ramo
              titulo="Memorial descritivo → conferência"
              cor="var(--nexodoc-accent)"
              atrasoBase={300}
              passos={[
                "Extrai o texto e mapeia cada página",
                "Aplica as regras determinísticas",
                "Lê o documento com o modelo de IA",
                "Valida cada achado e descarta o que não se sustenta",
              ]}
              saida="Parecer com página e transcrição"
            />
            <Ramo
              titulo="Pranchas e projeto → montagem"
              cor="var(--status-warning)"
              atrasoBase={1100}
              passos={[
                "Lê os selos das pranchas",
                "Reconhece a identidade do projeto",
                "Acusa folha faltante e duplicada",
                "Monta a lista, a capa e os volumes",
              ]}
              saida="ODT, PDF e ZIP prontos"
            />
          </div>
        </div>
        <Entra
          atraso={2000}
          style={{
            flex: "none",
            paddingTop: 24,
            borderTop: "1px solid var(--border)",
          }}
        >
          <p className="ap-fonte" style={{ margin: 0, maxWidth: "96ch" }}>
            Regra determinística é conta e comparação: não inventa, e a IA não
            pode apagá-la. A IA lê o que regra nenhuma alcança. A validação é a
            etapa que remove o achado sem sustentação.
          </p>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "Ele revisa a si mesmo",
    numero: "04",
    bloco: "O que é",
    titulo: "Ele revisa a si mesmo",
    notas:
      "Este slide responde antes da pergunta 'e se ele inventar?'. O caso real, para narrar: uma regra minha acusava marca fechada; a validação leu o documento inteiro e achou, quarenta páginas adiante, a cláusula que derrubava a acusação. Eu tinha lido aquelas ocorrências uma a uma e não vi.",
    corpo: (
      <>
        <Entra atraso={100}>
          <p
            className="ap-texto"
            style={{ fontSize: 32, lineHeight: 1.4, maxWidth: "80ch" }}
          >
            A primeira leitura levanta. A segunda existe para derrubar o que a
            primeira afirmou sem sustentação.
          </p>
        </Entra>
        <EscalaHorizontal
          atraso={400}
          style={{ marginTop: 64 }}
          fatos={[
            {
              titulo: ["Cada achado volta", "ao documento"],
              texto:
                "Uma segunda passada relê o texto procurando o que contradiz o que foi apontado. O que não se sustenta é descartado antes de chegar à sua tela.",
            },
            {
              titulo: ["Ele contesta", "as minhas regras"],
              texto:
                "Quando a validação discorda de uma regra do sistema, a discordância fica registrada. A mesma regra contestada várias vezes pelo mesmo motivo é defeito meu — e vira correção.",
            },
            {
              titulo: ["E aprende com", "o próprio erro"],
              texto:
                "Falso positivo e gravidade errada viram caso de teste. Foi assim que uma regra inteira foi aposentada por estar errada, e o total de achados do acervo caiu quase pela metade.",
            },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "O resultado",
    numero: "05",
    bloco: "O que é",
    titulo: "Um memorial inteiro, conferido",
    subtitulo: "117_25_md_geral_a.pdf — memorial geral de uma UBS",
    notas:
      "É A DEMONSTRAÇÃO. O mapa é o memorial página a página; a leitura passa, e onde há achado a página sobe com a cor da gravidade — a mesma grafia do canvas da auditoria. Deixar o mapa terminar antes de falar: são dois segundos e meio, e a sala acompanha sozinha.\n\nOS ACHADOS DO MAPA E O CARTÃO SÃO REAIS: saíram do parecer do 117_25 gravado no banco em 28/08/2026 (28 achados naquela corrida). O 57 é o da corrida citada no deck — é a variação entre execuções que a folha dos limites declara. Se alguém perguntar, dizer isso, e não amaciar.\n\nO CARTÃO É O QUE A SALA VAI VER NO PRODUTO. Ler o trecho em voz alta: um memorial da UBS Vila Manaus chamando a obra de 'UBS Paraíso', na página 92. Ninguém tinha visto — e este é o tipo de erro que a folha 07 explica.\n\nLer os números sem adjetivo — eles não precisam de ajuda.",
    corpo: (
      <>
        {/*
          A ORDEM DO TEMPO É A ORDEM DO ARGUMENTO. As páginas contam junto com o
          mapa (a leitura está acontecendo), o 57 assenta quando a leitura
          termina, e só então o custo e o tempo entram — baixos, depois do
          tamanho do trabalho. O cartão é o último a chegar: primeiro o todo,
          depois um exemplar.

          Quatro mostradores nas colunas 1, 4, 7 e 10 da grade.
        */}
        <div className="ap-grade">
          <div style={{ gridColumn: "1 / span 3" }}>
            <Mostrador
              rotuloDo="páginas"
              atraso={520}
              valor={<Contador ate={218} atraso={520} duracao={2300} />}
            />
          </div>
          <div style={{ gridColumn: "4 / span 3" }}>
            <Mostrador
              rotuloDo="achados"
              atraso={2700}
              cor="var(--status-critical)"
              valor={<Contador ate={57} atraso={2700} duracao={720} />}
            />
          </div>
          <div style={{ gridColumn: "7 / span 3" }}>
            <Mostrador
              rotuloDo="tempo de leitura"
              atraso={3200}
              valor="≈ 6 min"
            />
          </div>
          <div style={{ gridColumn: "10 / span 3" }}>
            <Mostrador
              rotuloDo="custo da execução"
              atraso={3340}
              cor="var(--nexodoc-accent)"
              valor="US$ 1,49"
            />
          </div>
        </div>

        {/* O mapa, com a escala de página embaixo. */}
        <div style={{ marginTop: 56 }}>
          <MapaDoMemorial paginas={218} atraso={520} duracao={2300} />
          <div style={{ height: 1, background: "#3d474d", marginTop: 8 }} />
          {/*
            A ESCALA DE PÁGINA é posicional, não "space-between": o rótulo 100
            fica exatamente sob a página 100, senão a linha da p. 92 cai à
            direita do "100" e a escala mente. Visto na primeira captura.
          */}
          <div
            className="ap-surge"
            style={{
              position: "relative",
              height: 24,
              marginTop: 8,
              fontFamily: MONO,
              fontSize: 16,
              color: "#5f6b72",
              animationDelay: "520ms",
            }}
          >
            {[1, 50, 100, 150, 200, 218].map((n) => (
              <span
                key={n}
                style={{
                  position: "absolute",
                  left: `${((n - 1) / 217) * 100}%`,
                  transform:
                    n === 1
                      ? "none"
                      : n === 218
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                }}
              >
                {n === 1 ? "p. 1" : n}
              </span>
            ))}
          </div>
        </div>

        {/*
          O cartão nasce LIGADO à página, como no canvas: a linha desce da marca
          da p. 92 até o cartão. A posição é a da página no mapa — (92 − ½) da
          largura útil dividida por 218 —, e não um número escolhido a olho.
        */}
        <div style={{ position: "relative", flex: 1, minHeight: 300 }}>
          <span
            aria-hidden="true"
            className="ap-desce"
            style={{
              position: "absolute",
              left: Math.round(((92 - 0.5) / 218) * LARGURA_UTIL),
              top: -24,
              width: 1,
              height: 72,
              background: "var(--status-critical)",
              animationDelay: "3700ms",
            }}
          />
          <CartaoDeAchado
            tipo="Divergência de identificação da obra"
            evidencia="Este memorial descritivo destina-se ao projeto estrutural da UBS Paraíso – Porte 1, localizada na Rua São Francisco de Assis, S/N, Vila Manaus, Criciúma/SC."
            pagina={92}
            disciplina="estrutural"
            gravidade="critico"
            atraso={3950}
            style={{
              position: "absolute",
              top: 48,
              left: Math.round(((92 - 0.5) / 218) * LARGURA_UTIL) - 26,
            }}
          />
          <Entra
            atraso={4300}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              maxWidth: "46ch",
            }}
          >
            <p className="ap-fonte" style={{ margin: 0, textAlign: "right" }}>
              Custo lido do registro de uso do próprio sistema, não estimado. O
              tempo varia com o tamanho do documento.
            </p>
          </Entra>
        </div>
      </>
    ),
  },
];
