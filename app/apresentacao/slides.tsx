"use client";

import type { CSSProperties, ReactNode } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";
import { AgentOrb } from "@/modules/nexo/components/agent-orb/AgentOrb";

import {
  corDaDisciplina,
  siglaDaDisciplina,
} from "@/modules/nexo/lib/disciplina-cor";

import type { Slide } from "./palco";
import {
  Contador,
  Entra,
  Fecho,
  Linha,
  Linhas,
  Marcador,
  MONO,
  paragrafo,
  rotulo,
  secundario,
  Titulo,
} from "./pecas";

/**
 * O CONTEÚDO DO DECK.
 *
 * TRÊS REGRAS QUE ESTE ARQUIVO NÃO PODE PERDER:
 *
 *  1. **Todo número aqui foi medido, e o que é conta aparece como estimativa.**
 *     Os custos saíram de `AiUsageEvent`; os achados, de execuções reais. Onde
 *     há premissa, a palavra fica na tela, em âmbar. Um número inventado que o
 *     diretor detecte contamina os que estão certos.
 *  2. **Nenhuma cifra de preço nas folhas 01 a 19.** Valor do piloto e
 *     propriedade do software vivem em `/apresentacao/valores`, e a folha 17
 *     só traz o BOTÃO que abre aquela rota. Uma seta a mais no fim do deck não
 *     pode revelar a proposta comercial antes da hora — mas o preço também não
 *     pode ficar fora do alcance de quem apresenta, que era o custo de mantê-lo
 *     num arquivo solto em `docs/`.
 *  3. **Nada se mexe sem dizer algo.** A entrada escalonada é ordem de leitura;
 *     a linha que se desenha é direção de fluxo; o número que corre é o
 *     argumento chegando. Ver a seção de movimento em `palco.css`.
 *
 * SEM DATA DE EXECUÇÃO EM LUGAR NENHUM. O deck fala do que o sistema faz, não
 * de quando uma corrida específica rodou — data em slide envelhece o argumento
 * e convida a pergunta errada.
 */

/* ────────────────────────────────────────────────── peças do diagrama do motor */

/** Uma etapa do fluxo. */
function Passo({
  children,
  atraso,
  destaque = false,
}: {
  children: ReactNode;
  atraso: number;
  destaque?: boolean;
}) {
  return (
    <div
      className="ap-entra"
      style={{
        animationDelay: `${atraso}ms`,
        flex: 1,
        minWidth: 0,
        padding: "16px 18px",
        borderRadius: 4,
        border: `1px solid ${destaque ? "var(--primary)" : "var(--border)"}`,
        background: destaque
          ? "rgb(0 166 147 / 0.10)"
          : "var(--nexodoc-raised)",
        fontSize: 21,
        lineHeight: 1.3,
        color: "var(--foreground)",
        textWrap: "pretty",
      }}
    >
      {children}
    </div>
  );
}

/** A linha entre duas etapas. Ela se DESENHA — o fluxo tem direção. */
function Liga({ atraso }: { atraso: number }) {
  return (
    <div
      className="ap-risca"
      aria-hidden="true"
      style={{
        animationDelay: `${atraso}ms`,
        flex: "none",
        width: 26,
        height: 1,
        // `var(--border)` some no projetor — a linha existia e ninguém via.
        background: "rgb(91 218 198 / 0.4)",
        alignSelf: "center",
      }}
    />
  );
}

/**
 * METADE DO COLCHETE que sai do motor: a aresta horizontal até o ramo, mais o
 * pedaço de espinha que alcança a outra metade.
 *
 * POR QUE ESTRUTURAL, e não posicionado por porcentagem. A primeira versão
 * punha as arestas em `top: 26%` / `bottom: 26%`, e elas caíam ENTRE os ramos —
 * porque os dois ramos têm alturas diferentes (um deles quebra em três linhas) e
 * o centro de cada um não está onde a porcentagem supõe. Aqui cada metade
 * acompanha o próprio ramo, e a aresta nasce no centro dele por construção.
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

/** Um ramo do motor: rótulo e a cadeia de etapas até a saída. */
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
        justifyContent: "center",
        gap: 14,
      }}
    >
      <Entra atraso={atrasoBase}>
        <span style={{ ...rotulo, fontSize: 21, color: cor }}>{titulo}</span>
      </Entra>
      <div
        style={{ position: "relative", display: "flex", alignItems: "stretch" }}
      >
        {/*
          O DOCUMENTO ATRAVESSA O RAMO. Um ponto da cor do ramo percorre a cadeia
          uma vez, depois que as caixas chegaram — é o que a folha diz em palavras
          ("o documento entra, o sistema lê") acontecendo na frente da sala. O
          percurso é a largura fixa do ramo: 1720 de folha − 168 do motor − 56 do
          colchete.
        */}
        <span
          aria-hidden="true"
          className="ap-pulso"
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            width: 10,
            height: 10,
            marginTop: -5,
            borderRadius: "50%",
            background: cor,
            ["--ap-percurso" as string]: "1486px",
            animationDelay: `${atrasoBase + passos.length * 160 + 720}ms`,
          }}
        />
        {passos.map((passo, i) => (
          <div key={passo} style={{ display: "contents" }}>
            {i > 0 ? <Liga atraso={atrasoBase + i * 160} /> : null}
            <Passo atraso={atrasoBase + i * 160 + 80}>{passo}</Passo>
          </div>
        ))}
        <Liga atraso={atrasoBase + passos.length * 160} />
        <Passo atraso={atrasoBase + passos.length * 160 + 80} destaque>
          {saida}
        </Passo>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── o botão dos valores */

/**
 * O BOTÃO QUE ABRE OS VALORES.
 *
 * É o único elemento clicável do deck inteiro, e isso é o ponto. O preço não
 * pode ser alcançado por avançar a seta — a decisão de mostrá-lo tem que custar
 * um gesto, e tirar a mão do teclado para ir ao mouse é esse gesto.
 *
 * ABA NOVA, e não navegação. Voltar na mesma aba devolveria o deck na folha 01,
 * e esta folha é a 21 de 23. Com `_blank`, `Ctrl+W` traz de volta a folha certa,
 * ainda em tela cheia, com o índice intacto.
 *
 * `data-abre-valores` NÃO É ENFEITE: é por ele que o gerador da cópia offline
 * acha este link para trocar o endereço por um salto interno. Sem o atributo, o
 * arquivo do pen drive sai com um link morto — e isso só se descobriria na sala,
 * sem rede. O gerador falha se o atributo sumir.
 */
function BotaoDosValores() {
  return (
    <a
      href="/apresentacao/valores"
      target="_blank"
      rel="noreferrer"
      data-abre-valores=""
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 18,
        padding: "24px 40px",
        borderRadius: 4,
        border: "1px solid var(--nexodoc-accent)",
        background: "rgb(0 166 147 / 0.10)",
        fontSize: 34,
        fontWeight: 500,
        letterSpacing: "-0.018em",
        color: "var(--nexodoc-accent)",
        textDecoration: "none",
      }}
    >
      Abrir os valores
      <span style={{ fontFamily: MONO, fontSize: 30 }} aria-hidden="true">
        →
      </span>
    </a>
  );
}

/* ────────────────────────────────────────────────── a folha do contraditório */

/**
 * UMA FOLHA DE OBJEÇÃO.
 *
 * A pergunta aparece na tela COM AS PALAVRAS DO COMPRADOR, na versão mais dura
 * que ele conseguiria formular — não numa versão amaciada. Quem escreveu a
 * acusação já tirou dela metade da força: a sala vê que ela foi PREVISTA, e não
 * improvisada na hora.
 *
 * A citação é MONO porque essa distinção já vale no resto do deck — mono é o
 * que os OUTROS dizem (o memorial, o diretor), sans é o que eu digo. Aqui ela
 * separa a acusação da resposta sem precisar de rótulo nenhum.
 *
 * NENHUMA CIFRA nas perguntas. Uma objeção que cita um número do deck envelhece
 * junto com ele, e um número desencontrado entre duas folhas é exatamente o que
 * a regra do topo deste arquivo proíbe.
 */
function Objecao({
  pergunta,
  titulo,
  linhaFina,
  respostas,
  fecho,
}: {
  /** A objeção, dita com as palavras de quem a faria. Vai entre aspas. */
  pergunta?: string;
  /** Alternativa à pergunta: a folha se anuncia como afirmação, não objeção. */
  titulo?: string;
  /** A linha de apoio do título. Só faz sentido junto de `titulo`. */
  linhaFina?: string;
  respostas: readonly (readonly [string, string])[];
  /** O fecho, uma linha por item — a quebra é editorial, não de largura. */
  fecho: readonly string[];
}) {
  return (
    <>
      {titulo ? (
        <>
          <Titulo style={{ margin: 0 }}>{titulo}</Titulo>
          {linhaFina ? (
            <Entra atraso={100}>
              <p
                style={{ ...secundario, maxWidth: "58ch", margin: "16px 0 0" }}
              >
                {linhaFina}
              </p>
            </Entra>
          ) : null}
        </>
      ) : (
        <>
          <Entra atraso={0}>
            <span style={rotulo}>A pergunta</span>
          </Entra>
          <Entra atraso={100}>
            <p
              style={{
                margin: "18px 0 0",
                maxWidth: "46ch",
                fontFamily: MONO,
                fontSize: 40,
                lineHeight: 1.34,
                letterSpacing: "-0.012em",
                color: "var(--foreground)",
                textWrap: "pretty",
              }}
            >
              {`“${pergunta}”`}
            </p>
          </Entra>
        </>
      )}

      <div
        style={{
          display: "flex",
          gap: 0,
          marginTop: 44,
          paddingTop: 40,
          borderTop: "1px solid var(--border)",
        }}
      >
        {respostas.map(([titulo, texto], i) => (
          <div
            key={titulo}
            className="ap-entra"
            style={{
              animationDelay: `${320 + i * 180}ms`,
              flex: 1,
              padding: i === 0 ? "0 40px 0 0" : "0 40px",
              borderLeft: i === 0 ? "none" : "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 24,
                color: "var(--nexodoc-accent)",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 31,
                fontWeight: 500,
                letterSpacing: "-0.016em",
                lineHeight: 1.26,
                color: "var(--foreground)",
                textWrap: "pretty",
              }}
            >
              {titulo}
            </p>
            <p style={{ ...secundario, fontSize: 24 }}>{texto}</p>
          </div>
        ))}
      </div>

      <div className="ap-cresce" />

      <Entra
        atraso={320 + respostas.length * 180 + 160}
        style={{ paddingTop: 30, borderTop: "1px solid var(--border)" }}
      >
        <Fecho
          linhas={fecho}
          tamanho={38}
          atraso={320 + respostas.length * 180 + 260}
        />
      </Entra>
    </>
  );
}

/* ─────────────────────────────────────────── o memorial lido, página a página */

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

/** A largura útil da folha: 1920 menos as duas margens de 100. */
const LARGURA_UTIL = 1720;

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
      style={{ display: "flex", gap: 3, height: 64, alignItems: "flex-end" }}
    >
      {Array.from({ length: paginas }, (_, i) => {
        const gravidade = porPagina.get(i + 1);
        return (
          <span
            key={i}
            className="ap-acende"
            style={{
              flex: 1,
              height: gravidade ? 64 : 40,
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

/** Um número-protagonista com o rótulo embaixo: a grade das folhas de dados. */
function Dado({
  rotuloDo,
  children,
  atraso,
  cor = "var(--foreground)",
}: {
  rotuloDo: string;
  children: ReactNode;
  atraso: number;
  cor?: string;
}) {
  return (
    <div>
      <span
        className="ap-mascara"
        style={{
          fontFamily: MONO,
          fontSize: 80,
          fontWeight: 500,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          color: cor,
          whiteSpace: "nowrap",
        }}
      >
        <span className="ap-linha" style={{ animationDelay: `${atraso}ms` }}>
          {children}
        </span>
      </span>
      <Entra atraso={atraso + 120}>
        <span style={{ ...rotulo, display: "block", marginTop: 14 }}>
          {rotuloDo}
        </span>
      </Entra>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ AS FOLHAS */

export const SLIDES: readonly Slide[] = [
  {
    rotulo: "Capa",
    numero: "01",
    notas:
      "Abrir sem preâmbulo. Deixar o orbe respirar dois segundos antes de falar — ele é o produto se apresentando sozinho. Nome, o que é, quem fez. Não explicar a capa.",
    corpo: (
      <>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 76,
          }}
        >
          {/*
            O ORBE VIVO, e não a redução estática dele. É o único elemento que o
            §6 do DESIGN.md autoriza a se mover sozinho — e é por isso que o
            campo neural do ambiente NÃO entra nesta folha: quando duas coisas
            se mexem, o olho não sabe qual está dizendo algo.

            `compact` porque é medida FIXA (198px). O `hero` é `vh`, e `vh` não
            escala junto com o palco: o orbe cresceria e encolheria conforme a
            janela enquanto o resto da folha ficasse parado.
          */}
          <div
            className="ap-surge"
            style={{
              position: "relative",
              flex: "none",
              width: 340,
              height: 340,
              display: "grid",
              placeItems: "center",
            }}
          >
            {/*
              ATMOSFERA PARADA. Dá profundidade ao orbe sem competir com ele: o
              §6 proíbe um segundo elemento VIVO na tela, não um halo imóvel.
            */}
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
            {/*
              SEM `transform: scale()` AQUI. O canvas do orbe mede a si mesmo
              para dimensionar o buffer do WebGL, e a medição enxerga a caixa JÁ
              TRANSFORMADA: ele redimensionava o buffer para além do próprio
              elemento e aparecia cortado em reta, à direita e embaixo. Visto na
              captura, não deduzido. `hero` é o tamanho para o qual o componente
              foi ajustado — inclusive a folga do halo e dos satélites.
            */}
            <div style={{ position: "relative" }}>
              <AgentOrb size="hero" state="idle" />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
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
                margin: 0,
                fontSize: 38,
                letterSpacing: "-0.012em",
                lineHeight: 1.28,
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
            paddingTop: 34,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 20,
            fontFamily: MONO,
            fontSize: 24,
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
    notas:
      "Ler a frase central devagar. Os três limites da direita são o que impede a sala de imaginar mais do que o sistema faz — e é por dizê-los que o resto do deck fica acreditável.",
    corpo: (
      <div style={{ flex: 1, display: "flex", gap: 0, alignItems: "center" }}>
        <div style={{ flex: 1.15, paddingRight: 64 }}>
          <p
            style={{
              margin: 0,
              fontSize: 52,
              fontWeight: 500,
              letterSpacing: "-0.022em",
              lineHeight: 1.22,
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
          <Entra atraso={240}>
            <p
              style={{
                ...secundario,
                marginTop: 30,
                fontSize: 30,
                lineHeight: 1.42,
              }}
            >
              Ele monta os documentos que acompanham o projeto — listas de
              documentos, capas e volumes — e confere o que já está escrito nos
              memoriais, apontando o que não fecha.
            </p>
          </Entra>
        </div>

        <div
          style={{
            flex: 1,
            paddingLeft: 64,
            borderLeft: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Entra atraso={420}>
            <span style={rotulo}>E o que ele não faz</span>
          </Entra>
          <div style={{ marginTop: 12 }}>
            {[
              [
                "Lê o documento inteiro.",
                "Não é amostragem nem busca por palavra-chave.",
              ],
              [
                "Não altera o documento.",
                "Aponta onde está e o que fazer. Quem edita é você.",
              ],
              [
                "Não substitui revisão técnica.",
                "Faz a conferência que hoje ninguém tem tempo de fazer.",
              ],
            ].map(([titulo, texto], i) => (
              <Marcador
                key={titulo}
                titulo={titulo}
                texto={texto}
                atraso={520 + i * 140}
              />
            ))}
          </div>
        </div>
      </div>
    ),
  },

  {
    rotulo: "O motor",
    numero: "03",
    denso: true,
    bloco: "O que é",
    notas:
      "Acompanhar as caixas conforme aparecem, um ramo de cada vez. O ponto que vale repetir: os dois caminhos saem do MESMO motor — é o mesmo sistema lendo o mesmo tipo de documento, e por isso o que ele aprende de um lado serve do outro.",
    corpo: (
      <>
        <Titulo style={{ margin: "0 0 8px", fontSize: 52 }}>
          Um motor, dois caminhos
        </Titulo>
        <Entra atraso={120}>
          <p style={{ ...secundario, margin: "0 0 16px", maxWidth: "76ch" }}>
            O documento entra, o sistema lê, e o caminho se decide pelo que ele
            é.
          </p>
        </Entra>

        <div
          style={{ flex: 1, display: "flex", gap: 0, alignItems: "stretch" }}
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
            <span style={{ ...rotulo, fontSize: 19, textAlign: "center" }}>
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

        <Entra atraso={2000}>
          <p className="ap-fonte" style={{ marginTop: 22 }}>
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
    notas:
      "Este slide responde antes da pergunta 'e se ele inventar?'. O caso real, para narrar: uma regra minha acusava marca fechada; a validação leu o documento inteiro e achou, quarenta páginas adiante, a cláusula que derrubava a acusação. Eu tinha lido aquelas ocorrências uma a uma e não vi.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 12 }}>Ele revisa a si mesmo</Titulo>
        <Entra atraso={140}>
          <p style={{ ...secundario, margin: 0, maxWidth: "80ch" }}>
            A primeira leitura levanta. A segunda existe para derrubar o que a
            primeira afirmou sem sustentação.
          </p>
        </Entra>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", gap: 0 }}>
            {[
              {
                n: "01",
                titulo: "Cada achado volta ao documento",
                texto:
                  "Uma segunda passada relê o texto procurando o que contradiz o que foi apontado. O que não se sustenta é descartado antes de chegar à sua tela.",
              },
              {
                n: "02",
                titulo: "Ele contesta as minhas regras",
                texto:
                  "Quando a validação discorda de uma regra do sistema, a discordância fica registrada. A mesma regra contestada várias vezes pelo mesmo motivo é defeito meu — e vira correção.",
              },
              {
                n: "03",
                titulo: "E aprende com o próprio erro",
                texto:
                  "Falso positivo e gravidade errada viram caso de teste. Foi assim que uma regra inteira foi aposentada por estar errada, e o total de achados do acervo caiu quase pela metade.",
              },
            ].map((c, i) => (
              <div
                key={c.n}
                className="ap-entra"
                style={{
                  animationDelay: `${300 + i * 200}ms`,
                  flex: 1,
                  padding: i === 0 ? "0 44px 0 0" : "0 44px",
                  borderLeft: i === 0 ? "none" : "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 25,
                    color: "var(--nexodoc-accent)",
                  }}
                >
                  {c.n}
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: 34,
                    fontWeight: 500,
                    letterSpacing: "-0.018em",
                    lineHeight: 1.24,
                    color: "var(--foreground)",
                    textWrap: "pretty",
                  }}
                >
                  {c.titulo}
                </p>
                <p style={{ ...secundario, fontSize: 25 }}>{c.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "O resultado",
    numero: "05",
    denso: true,
    bloco: "O que é",
    notas:
      "É A DEMONSTRAÇÃO. O mapa é o memorial página a página; a leitura passa, e onde há achado a página sobe com a cor da gravidade — a mesma grafia do canvas da auditoria. Deixar o mapa terminar antes de falar: são dois segundos e meio, e a sala acompanha sozinha.\n\nOS ACHADOS DO MAPA E O CARTÃO SÃO REAIS: saíram do parecer do 117_25 gravado no banco em 28/08/2026 (28 achados naquela corrida). O 57 é o da corrida citada no deck — é a variação entre execuções que a folha dos limites declara. Se alguém perguntar, dizer isso, e não amaciar.\n\nO CARTÃO É O QUE A SALA VAI VER NO PRODUTO. Ler o trecho em voz alta: um memorial da UBS Vila Manaus chamando a obra de 'UBS Paraíso', na página 92. Ninguém tinha visto — e este é o tipo de erro que a folha 07 explica.\n\nLer os números sem adjetivo — eles não precisam de ajuda.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 12 }}>
          Um memorial inteiro, conferido
        </Titulo>
        <Entra atraso={140}>
          <p
            style={{ ...secundario, margin: 0, fontFamily: MONO, fontSize: 23 }}
          >
            117_25_md_geral_a.pdf — memorial geral de uma UBS
          </p>
        </Entra>

        {/*
          A ORDEM DO TEMPO É A ORDEM DO ARGUMENTO. As páginas contam junto com o
          mapa (a leitura está acontecendo), o 57 assenta quando a leitura
          termina, e só então o custo e o tempo entram — baixos, depois do
          tamanho do trabalho. O cartão é o último a chegar: primeiro o todo,
          depois um exemplar.
        */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 40,
            marginTop: 44,
          }}
        >
          <Dado rotuloDo="páginas" atraso={520}>
            <Contador ate={218} atraso={520} duracao={2300} />
          </Dado>
          <Dado rotuloDo="achados" atraso={2700} cor="var(--status-critical)">
            <Contador ate={57} atraso={2700} duracao={720} />
          </Dado>
          <Dado rotuloDo="tempo de leitura" atraso={3200}>
            ≈ 6 min
          </Dado>
          <Dado
            rotuloDo="custo da execução"
            atraso={3340}
            cor="var(--nexodoc-accent)"
          >
            US$ 1,49
          </Dado>
        </div>

        <div style={{ marginTop: 52 }}>
          <MapaDoMemorial paginas={218} atraso={520} duracao={2300} />
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
              top: 0,
              width: 1,
              height: 48,
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

  {
    rotulo: "Conferência hoje",
    numero: "06",
    bloco: "O problema",
    notas:
      "A frase de fechamento é o eixo da apresentação: ela impede que a conversa vire 'quantas horas você economiza', discussão que não interessa travar. O que se propõe é um controle que hoje não existe, não um processo mais barato.\n\nOs três fatos chegam um de cada vez, com um respiro entre eles. Dizer cada um quando ele aparece — e não os três de uma vez.",
    corpo: (
      <>
        <Titulo>Como a conferência acontece hoje</Titulo>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", gap: 0 }}>
            {[
              ["Cada projetista", "confere o próprio projeto"],
              [
                "Sem tempo dedicado",
                "a conferência disputa espaço com a entrega",
              ],
              ["Uma a duas horas", "quando de fato acontece"],
            ].map(([titulo, texto], i) => (
              <div
                key={titulo}
                style={{
                  flex: 1,
                  padding: i === 0 ? "0 44px 0 0" : "0 44px",
                  borderLeft: i === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: 46,
                    fontWeight: 500,
                    letterSpacing: "-0.022em",
                    lineHeight: 1.16,
                    color: "var(--foreground)",
                  }}
                >
                  <Linhas linhas={[titulo]} atraso={200 + i * 260} />
                </p>
                <Entra atraso={330 + i * 260}>
                  <p style={{ ...secundario, fontSize: 26 }}>{texto}</p>
                </Entra>
              </div>
            ))}
          </div>
        </div>

        <Fecho
          linhas={[
            "Isto não é um processo caro para substituir.",
            "É um controle que hoje não existe.",
          ]}
          tamanho={54}
          atraso={1200}
        />
      </>
    ),
  },

  {
    rotulo: "Por que escapa",
    numero: "07",
    bloco: "O problema",
    notas:
      "A primeira causa desarma qualquer leitura de incompetência — e é importante dizê-la assim, porque quem está na sala assina esses projetos. A segunda mostra que o problema é do processo, não das pessoas.\n\nAs duas frases coloridas chegam por último, uma de cada lado: a vermelha é a consequência, a âmbar é a saída. Não ler as duas emendadas.",
    corpo: (
      <>
        <Titulo>Por que escapa</Titulo>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", gap: 0 }}>
            <div
              style={{
                flex: 1,
                paddingRight: 64,
                display: "flex",
                flexDirection: "column",
                gap: 26,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 40,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.22,
                  color: "var(--foreground)",
                }}
              >
                <Linhas
                  linhas={[
                    "Quem escreveu relê o que quis dizer,",
                    "não o que ficou escrito.",
                  ]}
                  atraso={140}
                />
              </p>
              <Entra atraso={420}>
                <p style={{ ...secundario, maxWidth: "52ch" }}>
                  Não é falta de competência: é como a leitura funciona. E a
                  consequência é sempre a mesma — na prática, a primeira revisão
                  de verdade só acontece quando o projeto já está na mão do
                  cliente.
                </p>
              </Entra>
              <p
                style={{
                  ...paragrafo,
                  paddingTop: 22,
                  borderTop: "1px solid var(--border)",
                  color: "var(--status-critical)",
                }}
              >
                <Linhas
                  linhas={[
                    "Quando isso acontece, quem revisa é quem contratou.",
                  ]}
                  atraso={700}
                />
              </p>
            </div>

            <div
              style={{
                flex: 1,
                paddingLeft: 64,
                borderLeft: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 26,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 40,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.22,
                  color: "var(--foreground)",
                }}
              >
                <Linhas
                  linhas={[
                    "O modelo-padrão leva o mesmo defeito",
                    "para todos os projetos.",
                  ]}
                  atraso={900}
                />
              </p>
              <Entra atraso={1180}>
                <p style={{ ...secundario, maxWidth: "52ch" }}>
                  O texto-base é reaproveitado de um projeto para o outro. Um
                  erro nele não erra um projeto: erra todos, até que alguém
                  finalmente o encontre.
                </p>
              </Entra>
              <p
                style={{
                  ...paragrafo,
                  paddingTop: 22,
                  borderTop: "1px solid var(--border)",
                  color: "var(--status-warning)",
                }}
              >
                <Linhas
                  linhas={[
                    "Achado uma vez, corrigido uma vez, resolvido em todos.",
                  ]}
                  atraso={1460}
                />
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "A conta",
    numero: "08",
    bloco: "O problema",
    notas:
      "É AQUI que o episódio é narrado, agora que ele não tem folha própria: projeto devolvido, procuradoria acionada, três responsáveis parados três dias. Contar ANTES de avançar — a conta entra fator a fator, e cada fator é uma frase da história: três pessoas, três dias, oito horas. Só depois o total.\n\nA palavra estimativa fica visível na tela; se preferir, troque a faixa pelo valor real antes de apresentar. A coluna da direita chega por último e é o que fecha o slide: ler devagar e não insistir.",
    corpo: (
      <>
        <Titulo>O que um erro desses custa</Titulo>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div
            style={{
              flex: 1.05,
              paddingRight: 64,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={120}>
              <span style={rotulo}>A aritmética</span>
            </Entra>

            {/*
              A EQUAÇÃO ASSENTA FATOR A FATOR. Cada linha é um fato do episódio, e
              cada fato chega quando a fala chega nele. O total é o único número
              que CORRE: é a soma acontecendo na frente da sala.
            */}
            <div
              style={{
                marginTop: 22,
                fontFamily: MONO,
                fontSize: 54,
                lineHeight: 1.22,
                letterSpacing: "-0.02em",
                color: "var(--foreground)",
              }}
            >
              <Linhas
                linhas={["3 responsáveis", "× 3 dias", "× 8 horas"]}
                atraso={300}
                passo={320}
              />
            </div>

            <Entra
              atraso={1250}
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop: "1px solid var(--border)",
                fontFamily: MONO,
                fontSize: 54,
                lineHeight: 1.22,
                letterSpacing: "-0.02em",
                color: "var(--foreground)",
              }}
            >
              ={" "}
              <Contador
                ate={72}
                atraso={1350}
                duracao={720}
                style={{ fontWeight: 500 }}
              />{" "}
              horas
            </Entra>

            <Entra atraso={1700}>
              <p
                style={{
                  margin: "22px 0 0",
                  fontFamily: MONO,
                  fontSize: 26,
                  lineHeight: 1.4,
                  color: "var(--muted-foreground)",
                }}
              >
                Hora de engenheiro ou arquiteto{" "}
                <span className="ap-premissa">(estimativa: R$ 50 a R$ 90)</span>
              </p>
            </Entra>

            <div className="ap-cresce" />

            <Entra
              atraso={2000}
              style={{
                paddingTop: 26,
                borderTop: "1px solid var(--nexodoc-accent)",
              }}
            >
              <span style={{ ...rotulo, display: "block", marginBottom: 14 }}>
                Só de horas paradas
              </span>
            </Entra>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 92,
                fontWeight: 500,
                letterSpacing: "-0.035em",
                lineHeight: 1,
                color: "var(--foreground)",
                whiteSpace: "nowrap",
              }}
            >
              <Linhas linhas={["R$ 3.600 a R$ 6.480"]} atraso={2150} />
            </div>
          </div>

          <div
            style={{
              flex: 1,
              paddingLeft: 64,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Entra atraso={2900}>
              <span style={{ ...rotulo, color: "var(--status-critical)" }}>
                O que não entra nessa conta
              </span>
            </Entra>
            <div style={{ marginTop: 14 }}>
              {[
                [
                  "O desgaste com o cliente",
                  "A entrega seguinte chega a uma mesa que já desconfia da anterior.",
                ],
                [
                  "A posição de quem apresentou",
                  "Quem levou o projeto à reunião respondeu por um erro que não era só dele.",
                ],
                [
                  "A reputação que fica",
                  "Dentro e fora da empresa, e por muito mais tempo do que os três dias.",
                ],
              ].map(([titulo, texto], i) => (
                <Marcador
                  key={titulo}
                  titulo={titulo}
                  texto={texto}
                  atraso={3050 + i * 160}
                />
              ))}
            </div>
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "Limites",
    numero: "09",
    denso: true,
    bloco: "O que existe",
    notas:
      "Dito por você, antes de perguntarem. Este slide compra mais credibilidade que qualquer outro do deck. Não amaciar nenhum item — principalmente o do excesso, que é o que o usuário vai sentir no primeiro dia.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 24 }}>
          O que ele ainda não faz bem
        </Titulo>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {[
            [
              "Peca pelo excesso.",
              "Prefere apontar demais a deixar passar, e parte do que levanta você vai descartar. É assim de propósito: achado a mais custa um minuto de leitura, achado a menos custa o que custou naquele projeto.",
            ],
            [
              "A lista varia entre execuções.",
              "Rodando o mesmo documento duas vezes, o total fica estável, mas os achados de borda entram e saem.",
            ],
            [
              "A precisão ainda não foi julgada por quem projeta.",
              "É a única medida em aberto, e depende do veredito de vocês. É exatamente isso que estou pedindo no piloto.",
            ],
            [
              "Não audita prancha.",
              "Hoje o alvo é o memorial descritivo e a documentação de identidade do projeto.",
            ],
          ].map(([titulo, texto], i) => (
            <Marcador
              key={titulo}
              titulo={titulo}
              texto={texto}
              atraso={120 + i * 130}
              cor={
                i === 0 ? "var(--status-warning)" : "var(--muted-foreground)"
              }
            />
          ))}
        </div>
      </>
    ),
  },

  {
    rotulo: "Segurança",
    numero: "10",
    denso: true,
    bloco: "O que existe",
    notas:
      "O slide que responde 'e se vazar?'. O primeiro item é decisão de projeto, não limitação — dizer com essas palavras.\n\nSobre 'a IA aprende com os nossos projetos?': separar as duas coisas na fala. O modelo NÃO aprende — ele vem pronto de fora e o conteúdo enviado não alimenta treinamento pela política da API. O que aprende é o sistema, e só pelo que vocês corrigirem: falso positivo, gravidade errada e achado que faltou viram medida de qualidade e ajuste de regra dentro da nossa base, sem sair para o provedor.\n\nCUIDADO — ESTA É A FOLHA QUE CONVIDA 'mostra esse painel de custo aí'. A demonstração sai de produção, e a tela de uso de IA de lá lista modelos sem preço, onde hoje aparece uma chave antiga em texto puro. Ou limpar essas linhas antes do dia, ou abrir o custo POR OBRA e não a tela de uso por modelo.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 24 }}>O que protege o documento</Titulo>

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 56px",
            alignContent: "center",
          }}
        >
          <div>
            {[
              [
                "O PDF anexado não é armazenado.",
                "Ele é lido e descartado. Para reprocessar, o arquivo é reenviado — decisão de projeto, não limitação.",
              ],
              [
                "Nenhum documento de vocês treina o modelo.",
                "A inteligência vem pronta de fora e não muda com o que a PROSUL manda: pela política da API usada, o conteúdo enviado não alimenta treinamento. O memorial é lido, respondido e esquecido.",
              ],
              [
                "Quem ensina o sistema é o feedback, não o documento.",
                "Quando alguém marca um achado como falso positivo ou aponta o que faltou, isso vira medida de qualidade e ajuste de regra aqui dentro — fica na PROSUL e não sai para lugar nenhum.",
              ],
            ].map(([titulo, texto], i) => (
              <Marcador
                key={titulo}
                titulo={titulo}
                texto={texto}
                atraso={140 + i * 150}
              />
            ))}
          </div>
          <div>
            {[
              [
                "Acesso nominal, por login corporativo.",
                "Cada pessoa entra com a própria conta, com papel de administrador ou membro. Desativar alguém corta o acesso na hora.",
              ],
              [
                "Todo acesso e todo gasto ficam registrados.",
                "Provedor, modelo, duração e custo de cada execução, com custo por obra no painel.",
              ],
              [
                "Teto de gasto mensal.",
                "Ao ser atingido, o sistema recusa a chamada em vez de continuar gastando.",
              ],
            ].map(([titulo, texto], i) => (
              <Marcador
                key={titulo}
                titulo={titulo}
                texto={texto}
                atraso={600 + i * 150}
              />
            ))}
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "O que existe hoje",
    numero: "11",
    bloco: "O que existe",
    notas:
      "Dois blocos, não seis módulos. O que importa é a distinção entre conferir o que já existe e montar o que falta — é assim que o trabalho acontece no escritório. As cores são as dos dois ramos do motor: teal confere, âmbar monta.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 24 }}>O que já existe e funciona</Titulo>

        {/*
          SEM CAIXA. A versão anterior punha cada bloco num cartão de 600px de
          altura com quatro linhas dentro — dois terços do cartão eram fundo. A
          régua colorida no topo é a única moldura: ela já diz de qual ramo do
          motor o bloco vem.
        */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", gap: 0 }}>
            {[
              {
                titulo: "Conferência de memorial descritivo",
                cor: "var(--nexodoc-accent)",
                linhas: [
                  "Lê o memorial inteiro e aponta o que não fecha",
                  "Cada achado com a página e a transcrição do trecho",
                  "Separa o que impede emitir do que é decisão técnica",
                  "Compara documentos entre si",
                ],
                selo: "Medido em projeto real",
                seloOk: true,
              },
              {
                titulo: "Montagem de LDs, capas e volumes",
                cor: "var(--status-warning)",
                linhas: [
                  "Lê os selos das pranchas e monta a lista de documentos",
                  "Acusa folha faltante, duplicada e divergência de total",
                  "Gera capa com os dados do escritório",
                  "Entrega ODT, PDF e ZIP prontos",
                ],
                selo: "Em uso acompanhado",
                seloOk: false,
              },
            ].map((bloco, i) => (
              <div
                key={bloco.titulo}
                style={{
                  flex: 1,
                  padding: i === 0 ? "0 56px 0 0" : "0 0 0 56px",
                  borderLeft: i === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="ap-risca"
                  style={{
                    display: "block",
                    height: 2,
                    background: bloco.cor,
                    animationDelay: `${160 + i * 260}ms`,
                  }}
                />
                <h3
                  style={{
                    margin: "26px 0 0",
                    fontSize: 40,
                    fontWeight: 500,
                    letterSpacing: "-0.022em",
                    lineHeight: 1.16,
                    color: "var(--foreground)",
                  }}
                >
                  <Linhas linhas={[bloco.titulo]} atraso={260 + i * 260} />
                </h3>
                <Entra atraso={420 + i * 260}>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 18,
                      padding: "8px 14px",
                      background: bloco.seloOk
                        ? "var(--status-ok-bg)"
                        : "var(--nexodoc-raised)",
                      fontFamily: MONO,
                      fontSize: 20,
                      letterSpacing: "0.05em",
                      color: bloco.seloOk
                        ? "var(--status-ok)"
                        : "var(--muted-foreground)",
                    }}
                  >
                    {bloco.selo}
                  </span>
                </Entra>
                <ul
                  style={{ margin: "26px 0 0", padding: 0, listStyle: "none" }}
                >
                  {bloco.linhas.map((linha, j) => (
                    <li
                      key={linha}
                      className="ap-entra"
                      style={{
                        animationDelay: `${560 + i * 260 + j * 90}ms`,
                        padding: "16px 0",
                        borderTop: "1px solid var(--border)",
                        fontSize: 26,
                        lineHeight: 1.4,
                        color: "var(--muted-foreground)",
                        textWrap: "pretty",
                      }}
                    >
                      {linha}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "Como ela se paga",
    numero: "12",
    denso: true,
    bloco: "O dinheiro",
    notas:
      "DE ONDE SAI O R$ 285: a folha que abria essa conta saiu do deck em 09/09/2026 e vive na folha B do anexo. Se perguntarem como se chega nele, abrir o botão da folha 17 em vez de improvisar a conta de cabeça.\n\nESTA FOLHA NAO DISPUTA ARITMETICA, DE PROPOSITO. A versao anterior valorizava as 16 horas de montagem a hora de engenheiro e caia com uma frase: quem monta lista de documentos nao ganha hora de engenheiro. A hora de tecnico derruba a conta inteira, e o argumento nao pode depender de um numero que a sala refuta de cabeca.\n\nO TETO DE LICENCA SAIU DA TELA e vive aqui: com a operacao em R$ 285, uma licenca ate cerca de R$ 500 por mes se paga so no tempo devolvido. NAO OFERECER esse numero. O diretor vai calcula-lo sozinho, e um numero que ele deduz vale mais que um que eu concedo.\n\nOS DOIS NÚMEROS DE BAIXO SÃO A FRASE INTEIRA, sem razão escrita entre eles: o pequeno é o que custa operar, o grande é o que o episódio custou — e a sala faz a divisão sozinha. O terceiro bloco de cima e o mais forte do deck inteiro e nao tem numero nenhum. Ler devagar e parar.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 20 }}>Como ela se paga</Titulo>

        {/*
          LARGURA LIMITADA de propósito. Sem o teto, a linha corre os 1720px da
          folha e vira uma faixa de texto que ninguém lê da terceira fileira da
          sala.
        */}
        <div
          style={{
            flex: 1,
            maxWidth: 1380,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {[
            [
              "Em tempo que volta para o projeto.",
              "Quatro projetos por mês, até quatro horas de montagem manual cada. São dezesseis horas que ninguém precisa gastar abrindo prancha por prancha — e que voltam para quem deveria estar projetando.",
            ],
            [
              "Em qualidade do que sai daqui.",
              "O projeto que chega ao cliente já passou por uma leitura que hoje não acontece. Não é uma revisão a mais: é a primeira.",
            ],
            [
              "E em vergonha não passada.",
              "Este é o retorno que não entra em planilha nenhuma, e é o único que a sala inteira já viu de perto. Um projeto devolvido não custa só as horas paradas que a folha da conta somou.",
            ],
          ].map(([titulo, texto], i) => (
            <Marcador
              key={titulo}
              titulo={titulo}
              texto={texto}
              atraso={160 + i * 190}
            />
          ))}
        </div>

        {/*
          O ANTES E O DEPOIS EM DOIS NÚMEROS, e a distância entre eles é o
          argumento. Nada de razão escrita: a folha 14 do spec proíbe disputar
          aritmética, e "22 vezes" seria uma conta que a sala pode refutar.
          Um número pequeno ao lado de um grande não se refuta — se vê.
        */}
        {/*
          DUAS LINHAS DE GRADE, e não duas colunas: os rótulos ficam na mesma
          altura e os números na mesma linha de base, ainda que um tenha 56px e
          o outro 96. Em duas colunas alinhadas por baixo, o rótulo do pequeno
          descia 40px em relação ao do grande — visto na captura.
        */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gridTemplateRows: "auto auto",
            columnGap: 96,
            rowGap: 18,
            alignItems: "baseline",
            paddingTop: 30,
            borderTop: "1px solid var(--nexodoc-accent)",
          }}
        >
          <Entra atraso={820}>
            <span style={rotulo}>Operar, por mês</span>
          </Entra>
          <Entra atraso={1150}>
            <span style={rotulo}>
              O episódio que já aconteceu — só a parte que deu para somar
            </span>
          </Entra>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 56,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              color: "var(--muted-foreground)",
              whiteSpace: "nowrap",
            }}
          >
            <Linhas linhas={["R$ 285"]} atraso={900} />
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 96,
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1,
              color: "var(--nexodoc-accent)",
              whiteSpace: "nowrap",
            }}
          >
            <Linhas linhas={["R$ 3.600 a R$ 6.480"]} atraso={1250} />
          </div>
        </div>
      </>
    ),
  },

  /*
   * ─── AS POSSÍVEIS PERGUNTAS ───────────────────────────────────────────────
   *
   * O rótulo diz POSSÍVEIS, e não "difíceis". Quem projeta o slide sabe que são
   * objeções; a sala não precisa ouvir que a conversa vai ficar difícil antes
   * de ela ficar. O conteúdo é o mesmo — o enquadramento, não.
   *
   * A ordem escala do técnico ao comercial. Cada folha responde por dinheiro um
   * pouco mais do que a anterior, e a última abre a porta do anexo — que é o
   * único lugar onde o valor aparece.
   */

  {
    rotulo: "Por que não o ChatGPT",
    numero: "13",
    bloco: "Possíveis perguntas",
    notas:
      "NÃO BRIGAR COM O CHATGPT: ele está dentro do sistema, e dizer isso desarma a pergunta em vez de disputá-la. Para 'contrato um desenvolvedor por dois meses': dois meses fazem a primeira versão; o que está na tela é o que sobrou depois de meses corrigindo contra memorial real, e a folha dos limites mostra o que ainda falta.\n\nRÉPLICA PROVÁVEL 1 — 'então me venda só as regras e a montagem, e eu uso o ChatGPT para o resto': as regras sozinhas acham menos da metade, e é a segunda passada que derruba o falso positivo — está na folha da autorrevisão. Vender as partes separadas entrega um motor sem freio.\n\nRÉPLICA PROVÁVEL 2 — 'em seis meses isso é um botão dentro do Word': pode ser, e nesse dia eu troco o modelo por dentro e vocês não fazem nada. O que não vem de graça em botão nenhum é saber o que perguntar ao modelo, e é isso que os oito meses compraram.",
    corpo: (
      <Objecao
        pergunta="Isso é uma casca em cima do ChatGPT. Por que não assinamos o ChatGPT e mandamos alguém jogar o PDF lá?"
        respostas={[
          [
            "O modelo é uma peça, não é o sistema.",
            "O ChatGPT é uma das caixas do diagrama que vocês viram. As outras não são dele: extrair o texto sabendo em que página cada linha está, aplicar as regras que não alucinam, validar cada achado contra o próprio documento e descartar o que não se sustenta. Sem elas, o que volta é um resumo — e resumo não se leva para o cliente.",
          ],
          [
            "A conversa não guarda nada.",
            "Colar um PDF num chat não deixa histórico por obra, nem custo por projeto, nem teto de gasto, nem registro de quem leu o quê. E o que ele entendeu de um memorial não serve para o próximo.",
          ],
          [
            "Metade do sistema não é leitura.",
            "Lista de documentos, capa, volume, folha faltante, selo divergente. Isso é montagem de arquivo. Nenhum chat entrega ODT, PDF e ZIP prontos para a entrega.",
          ],
        ]}
        fecho={[
          "E quando o modelo melhorar — e vai — ele melhora aqui dentro.",
          "Trocar de modelo é uma linha de configuração; o que sobra é o resto.",
        ]}
      />
    ),
  },

  {
    rotulo: "Você não provou que vale",
    numero: "14",
    bloco: "Possíveis perguntas",
    notas:
      "O terceiro bloco é o que mais compra a sala: é ganho que independe de assinar contrato.\n\nRÉPLICA PROVÁVEL 1 — 'aconteceu uma vez, em quantos anos?': uma vez que os senhores SOUBERAM. O erro do modelo-padrão esteve em cinco projetos e ninguém tinha achado — e não seria achado.\n\nRÉPLICA PROVÁVEL 2 — 'então traga a medição pronta e voltamos a conversar': a medição depende do veredito de quem projeta, e é literalmente o que estou pedindo. Sem uso real ela não existe, e não há como eu produzi-la sozinho — seria eu julgando o meu próprio trabalho, que é exatamente o problema que este sistema existe para resolver.\n\nRÉPLICA PROVÁVEL 3 — 'projetista ignora checklist há vinte anos': não é checklist, é uma lista com a página e a frase do documento dele. E se ignorarem, o piloto é justamente o que mede isso.",
    corpo: (
      <Objecao
        pergunta="57 achados, e você mesmo disse que não sabe quantos são erro de verdade. Meu subdiretor lê um memorial em uma hora. Agora ele lê o memorial e mais 57 achados. Você piorou o trabalho dele."
        respostas={[
          [
            "A comparação não é uma hora contra seis minutos.",
            "É uma leitura que acontece contra uma que não acontece. A folha da conferência de hoje já disse: não há tempo dedicado para isso, e quando há, ela disputa espaço com a entrega.",
          ],
          [
            "Descartar um achado errado custa duas linhas.",
            "Cada um vem com a página e o trecho transcrito do próprio memorial. Não se investiga um achado: lê-se e decide-se.",
          ],
          [
            "Onze deles não são de projeto nenhum.",
            "São do modelo-padrão — o mesmo texto errado em cinco projetos. Corrigidos uma vez, somem de todos. Esse ganho existe mesmo que vocês não comprem nada.",
          ],
        ]}
        fecho={[
          "Quantos dos outros são erro de verdade, eu não sei.",
          "É exatamente por isso que estou pedindo seis meses, e não a sua assinatura.",
        ]}
      />
    ),
  },

  {
    rotulo: "E se você sair",
    numero: "15",
    bloco: "Possíveis perguntas",
    notas:
      "NÃO ENTRAR NO MÉRITO DO VÍNCULO. A relação hoje é PJ, e a folha responde CONTINUIDADE, não crachá: quem contrata licença de software não pergunta o regime de quem a escreveu. Se alguém puxar o assunto, devolver para o contrato — prazo, prazo de resposta e o que fica com vocês.\n\nCUSTÓDIA DE CÓDIGO E INSTALAÇÃO NA INFRAESTRUTURA DELES NÃO ESTÃO OFERECIDAS NA TELA. Promessa projetada não se retira depois. O fecho é o que mais tranquiliza engenheiro na sala: a assinatura, e o risco que vem com ela, não mudam de dono.\n\nRÉPLICA PROVÁVEL 1 — 'então põe o código em custódia': DECIDIDO, ela está disponível — mas nunca de graça. A contrapartida é PRAZO: a custódia entra se o piloto virar contrato longo. Dizer as duas coisas na mesma frase, porque cedida sozinha ela vira o novo ponto de partida da negociação.\n\nRÉPLICA PROVÁVEL 2 — 'prazo de resposta sem multa é papel': DECIDIDO, NÃO há multa. O prazo já é o compromisso, e contrato descumprido tem consequência sem precisar de cláusula de multa. Não ceder aqui no calor da reunião: esta linha foi escrita justamente para isso.\n\nRÉPLICA PROVÁVEL 3 — 'e se der problema num sábado?': o prazo escrito vale para problema que impeça o uso, não para toda dúvida. Dizer isso com essas palavras, sem prometer plantão.",
    corpo: (
      <Objecao
        pergunta="E se você sair, como fica? O sistema é de uma pessoa só: se você parar, a gente para junto."
        respostas={[
          [
            "O que nos liga é um contrato, não um crachá.",
            "A licença tem prazo próprio e vale por ele inteiro. Se eu deixar de tocar qualquer outro trabalho aqui, esse prazo continua de pé — são duas relações diferentes, e sempre foram.",
          ],
          [
            "Prazo de resposta escrito, não boa vontade.",
            "Problema que impeça o uso tem tempo de correção definido em contrato, e não depende de eu estar de bom humor naquela semana.",
          ],
          [
            "O que ele produz são arquivos, e eles são de vocês.",
            "Parecer, lista de documentos, capa e volume saem em arquivo. Se o sistema parar amanhã, o que já foi montado continua exatamente onde está.",
          ],
        ]}
        fecho={[
          "A responsabilidade técnica não muda de mãos, e nunca esteve na mesa.",
          "Quem assina o projeto continua sendo quem responde por ele —",
          "hoje, sem conferência nenhuma, e depois.",
        ]}
      />
    ),
  },

  {
    rotulo: "Motivo da venda",
    numero: "16",
    bloco: "Possíveis perguntas",
    notas:
      "A FOLHA DEIXOU DE SER UMA OBJEÇÃO em 09/09/2026. Antes ela punha na tela a acusação ('você é nosso funcionário, por que estamos pagando?') e respondia. Emprestar essa frase à sala é dar munição que talvez ninguém fosse buscar — e, com a relação em PJ, ela nem se sustenta. Agora a folha AFIRMA: três fatos, ditos por mim, antes de alguém precisar perguntar.\n\nFALAR DEVAGAR E NÃO JUSTIFICAR MAIS DO QUE ESTÁ ESCRITO. Quem explica demais parece estar se defendendo de algo.\n\nSE VIER 'e o que diz o seu contrato?': CONFERIDO — foi lido, e NÃO há cláusula de cessão sobre o que eu crio fora dele. Responder isso e parar; a resposta curta é a mais forte.\n\nSE VIER 'você testou com os nossos projetos, isso é informação da empresa': os documentos foram lidos, não copiados nem guardados, e o produto não contém nenhum trecho deles. O que aprendi lendo é conhecimento profissional — o mesmo que qualquer projetista leva de um projeto para o seguinte.\n\nSE VIER 'te pago as suas horas e o software passa a ser nosso': a folha que respondia isso saiu do deck em 09/09/2026, e a resposta agora é de boca. Comprar as minhas horas compraria o passado; quem mantém o sistema na semana que vem é a licença. Compra é outra negociação, com outro número e outro contrato — e eu ouço, só não é a que eu vim propor hoje. A MOEDA DE TROCA, se travar, é a CUSTÓDIA DO CÓDIGO: vale PRAZO, nunca desconto.\n\nO TERCEIRO FATO NÃO É AMEAÇA, e não se diz com esse tom. Ele explica por que existe preço em vez de doação — e, dito antes de perguntarem, tira o assunto da mesa.",
    corpo: (
      <Objecao
        titulo="Motivo da venda"
        linhaFina="Três fatos, ditos antes de alguém precisar perguntar."
        respostas={[
          [
            "Foi feito fora.",
            "Fora do horário, em equipamento meu, com licenças minhas. Nenhuma hora paga pela PROSUL entrou aqui.",
          ],
          [
            "Os documentos não ficaram comigo.",
            "Nenhum memorial de cliente está na minha máquina. E o sistema não guarda PDF nenhum — é a mesma decisão que a folha da segurança mostrou.",
          ],
          [
            "Foi pensado num problema daqui, mas não é só daqui.",
            "Memorial, lista de documentos, volume, prefeitura: o mesmo trabalho existe em qualquer escritório que entregue projeto público. O que está montado vira produto para outras empresas com pouca mudança.",
          ],
        ]}
        fecho={[
          "O problema é da casa. A solução não nasceu dela —",
          "e serve a qualquer escritório que entregue projeto para prefeitura.",
        ]}
      />
    ),
  },

  {
    rotulo: "Quanto custa usar",
    numero: "17",
    bloco: "O dinheiro",
    notas:
      "ESTA FOLHA NÃO TEM CIFRA, E ISSO É O DESENHO. Ela existe para que o preço esteja ao alcance da mão sem estar na tela: se ninguém perguntar, ela passa em dez segundos e o deck fecha no limite, que é onde ele sempre fechou.\n\nO BLOCO VOLTA A SER 'O DINHEIRO' de propósito, depois das possíveis perguntas. A sala percebe que a conversa mudou de assunto antes de eu dizer.\n\nO BOTÃO ABRE EM ABA NOVA: clicar não perde o deck. Fechar com Ctrl+W devolve esta folha, ainda em tela cheia.\n\nQUANDO CLICAR: quando alguém perguntar o valor, ou quando eu tiver decidido que a sala está pronta. Não clicar por reflexo de estar numa folha que tem botão — a folha funciona sem ser clicada, e passar por ela sem abrir é uma escolha legítima.\n\nO PISO CONTINUA SENDO seis meses por R$ 10.000. Abaixo disso não se fecha na sala.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 24 }}>Quanto custa usar</Titulo>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Entra atraso={160}>
            <p
              style={{
                ...paragrafo,
                maxWidth: "44ch",
                fontSize: 40,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1.28,
              }}
            >
              O valor não está neste deck.
            </p>
          </Entra>
          <Entra atraso={320}>
            <p
              style={{
                ...secundario,
                maxWidth: "50ch",
                marginTop: 18,
                fontSize: 28,
              }}
            >
              Ele está numa página separada, com a conta que o sustenta. Eu abro
              agora, se você quiser ver.
            </p>
          </Entra>
          <Entra atraso={520} style={{ marginTop: 52 }}>
            <BotaoDosValores />
          </Entra>
        </div>
      </>
    ),
  },

  {
    rotulo: "O que pode vir",
    numero: "18",
    bloco: "O pedido",
    notas:
      "Deixar claro que é caminho, não promessa — nada aqui está pronto. O item que costuma acender o olho de quem projeta é o terceiro: a correção aplicada direto no arquivo editável.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 12 }}>O que pode vir depois</Titulo>
        <Entra atraso={140}>
          <p style={{ ...secundario, margin: 0 }}>
            Caminho, não promessa. Nada disto está pronto, e a ordem depende do
            que o uso real mostrar.
          </p>
        </Entra>

        {/*
          TRACEJADO = NÃO CONSTRUÍDO. É a mesma grade de colunas das folhas 04 e
          06, com a régua de cima tracejada em vez de cheia — o olho lê "igual
          ao que existe, mas ainda não". Sem caixa: os três cartões de antes
          tinham alturas diferentes e flutuavam no meio da folha.
        */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
            {[
              {
                titulo: "Conferência de quantidades",
                texto:
                  "Cruzar o que o memorial especifica com o que a planilha orça, e acusar o que não bate.",
              },
              {
                titulo: "Leitura especializada por disciplina",
                texto:
                  "Um leitor treinado no vocabulário de cada disciplina, em vez de um leitor geral para todas.",
              },
              {
                titulo: "Correção no arquivo editável",
                texto:
                  "A alteração aplicada direto no documento de origem, com você aprovando cada uma antes.",
              },
            ].map((c, i) => (
              <div
                key={c.titulo}
                className="ap-entra"
                style={{
                  animationDelay: `${300 + i * 200}ms`,
                  flex: 1,
                  margin: i === 0 ? "0 28px 0 0" : "0 0 0 28px",
                  paddingTop: 26,
                  borderTop: "1px dashed #3d474d",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <span
                  style={{ fontFamily: MONO, fontSize: 22, color: "#5f6b72" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 36,
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.22,
                    color: "var(--foreground)",
                    textWrap: "pretty",
                  }}
                >
                  {c.titulo}
                </h3>
                <p style={{ ...secundario, fontSize: 25, maxWidth: "40ch" }}>
                  {c.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "O que ela não é",
    numero: "19",
    bloco: "O pedido",
    notas:
      "Fechar por aqui é escolha: a última coisa que a sala ouve é o limite, dito por mim, e não uma promessa. Ler devagar e parar.\n\nO ORBE VOLTA — o mesmo da capa, do mesmo tamanho da folha do motor. É o deck fechando onde abriu, e não um enfeite: a sala viu o produto se apresentar sozinho na primeira folha, e o vê de novo quando eu digo o que ele não é.\n\nSe vier pergunta sobre valor depois disto, voltar à folha 17 e abrir o botão — o deck não termina no preço.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 20 }}>
          O que esta ferramenta não é
        </Titulo>

        <div
          style={{
            flex: 1,
            maxWidth: 1380,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {[
            [
              "Ela não assume responsabilidade técnica.",
              "Quem assina o projeto continua sendo quem responde por ele. O sistema aponta; a decisão é de quem põe o nome na capa.",
            ],
            [
              "A IA erra, e vai errar.",
              "Ela levanta o que parece não fechar. Parte disso não é erro nenhum, e é você quem separa uma coisa da outra.",
            ],
            [
              "Ela não faz o trabalho no seu lugar.",
              "O que ela devolve não é o projeto pronto: é o tempo que se gastaria procurando — e a chance de achar o que ninguém teve tempo de procurar.",
            ],
          ].map(([titulo, texto], i) => (
            <Marcador
              key={titulo}
              titulo={titulo}
              texto={texto}
              atraso={160 + i * 190}
            />
          ))}
        </div>

        {/*
          O FECHO DO DECK É O ORBE E UMA FRASE. O orbe é `compact` (198px, medida
          fixa) — a mesma escala em que a folha do motor o mostrou, e o mesmo
          organismo vivo da capa. Ver a nota sobre `transform` na capa: o canvas
          mede a si mesmo, e não pode ser escalado por fora.
        */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 64,
            paddingTop: 26,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            className="ap-surge"
            style={{
              flex: "none",
              width: 198,
              height: 198,
              display: "grid",
              placeItems: "center",
              animationDelay: "760ms",
            }}
          >
            <AgentOrb size="compact" state="idle" />
          </div>
          <Fecho
            linhas={[
              "Uma segunda leitura que nunca se cansa,",
              "e que nunca assina no seu lugar.",
            ]}
            tamanho={48}
            atraso={900}
          />
        </div>
      </>
    ),
  },
];
