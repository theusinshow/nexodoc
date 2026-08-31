"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";
import { AgentOrb } from "@/modules/nexo/components/agent-orb/AgentOrb";

import type { Slide } from "./palco";

/**
 * O CONTEÚDO DO DECK.
 *
 * TRÊS REGRAS QUE ESTE ARQUIVO NÃO PODE PERDER:
 *
 *  1. **Todo número aqui foi medido, e o que é conta aparece como estimativa.**
 *     Os custos saíram de `AiUsageEvent`; os achados, de execuções reais. Onde
 *     há premissa, a palavra fica na tela, em âmbar. Um número inventado que o
 *     diretor detecte contamina os que estão certos.
 *  2. **O anexo não mora aqui.** Valor do piloto e propriedade do software
 *     ficam em arquivo separado. Uma seta a mais no fim do deck não pode
 *     revelar a proposta comercial antes da hora.
 *  3. **Nada se mexe sem dizer algo.** A entrada escalonada é ordem de leitura;
 *     a linha que se desenha é direção de fluxo; o número que corre é o
 *     argumento chegando. Ver a seção de movimento em `palco.css`.
 *
 * SEM DATA DE EXECUÇÃO EM LUGAR NENHUM. O deck fala do que o sistema faz, não
 * de quando uma corrida específica rodou — data em slide envelhece o argumento
 * e convida a pergunta errada.
 */

const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const rotulo: CSSProperties = {
  fontFamily: MONO,
  fontSize: 23,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#5f6b72",
};

const paragrafo: CSSProperties = {
  margin: 0,
  fontSize: 27,
  lineHeight: 1.45,
  color: "var(--foreground)",
  textWrap: "pretty",
};

const secundario: CSSProperties = {
  ...paragrafo,
  fontSize: 25,
  color: "var(--muted-foreground)",
};

/* ───────────────────────────────────────────────────────── peças de movimento */

/**
 * Entrada escalonada. O atraso é a ORDEM DE LEITURA tornada visível: o olho
 * chega em cada peça no instante em que a anterior terminou de ser lida.
 */
function Entra({
  atraso = 0,
  children,
  style,
}: {
  atraso?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="ap-entra" style={{ animationDelay: `${atraso}ms`, ...style }}>
      {children}
    </div>
  );
}

/**
 * O número corre até o valor. Não é enfeite: o valor É o argumento, e vê-lo
 * chegar prende o olho nele por um segundo a mais do que vê-lo já parado.
 *
 * Respeita movimento reduzido — quem pediu para nada se mexer recebe o número
 * final, e não uma contagem congelada no zero.
 */
function Contador({
  ate,
  duracao = 900,
  atraso = 0,
  style,
}: {
  ate: number;
  duracao?: number;
  atraso?: number;
  style?: CSSProperties;
}) {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    let quadro = 0;
    let inicio = 0;

    /*
     * A decisão sobre movimento reduzido mora DENTRO do temporizador, e não no
     * corpo do efeito. Não é preciosismo: `setState` síncrono num efeito dispara
     * renderização em cascata, e o lint do projeto recusa — com razão. Aqui a
     * chamada já nasce assíncrona, que é o contrato que a regra pede.
     */
    const relogio = setTimeout(() => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setValor(ate);
        return;
      }

      const passo = (agora: number) => {
        if (!inicio) inicio = agora;
        const t = Math.min(1, (agora - inicio) / duracao);
        // Desaceleração cúbica: chega devagar, como um ponteiro assentando.
        setValor(Math.round(ate * (1 - Math.pow(1 - t, 3))));
        if (t < 1) quadro = requestAnimationFrame(passo);
      };
      quadro = requestAnimationFrame(passo);
    }, atraso);

    return () => {
      clearTimeout(relogio);
      cancelAnimationFrame(quadro);
    };
  }, [ate, atraso, duracao]);

  return <span style={style}>{valor}</span>;
}

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
        background: destaque ? "rgb(0 166 147 / 0.10)" : "var(--nexodoc-raised)",
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
function MetadeDoColchete({ paraBaixo, atraso }: { paraBaixo: boolean; atraso: number }) {
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
      <div style={{ display: "flex", alignItems: "stretch" }}>
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

/* ─────────────────────────────────────────────────────────── peças de conteúdo */

function Linha({ chave, valor, atraso }: { chave: string; valor: ReactNode; atraso: number }) {
  return (
    <Entra
      atraso={atraso}
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        gap: "0 48px",
        alignItems: "baseline",
        padding: "24px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <span style={{ ...rotulo, fontSize: 22 }}>{chave}</span>
      <span style={{ fontFamily: MONO, fontSize: 38, color: "var(--foreground)" }}>{valor}</span>
    </Entra>
  );
}

function Marcador({
  titulo,
  texto,
  atraso,
  cor = "var(--muted-foreground)",
}: {
  titulo: string;
  texto?: string;
  atraso: number;
  cor?: string;
}) {
  return (
    <Entra atraso={atraso} style={{ padding: "22px 0", borderTop: "1px solid var(--border)" }}>
      <p
        style={{
          margin: texto ? "0 0 8px" : 0,
          fontSize: 30,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.3,
          color: "var(--foreground)",
          textWrap: "pretty",
        }}
      >
        {titulo}
      </p>
      {texto ? (
        <p style={{ margin: 0, fontSize: 24, lineHeight: 1.45, color: cor, textWrap: "pretty" }}>
          {texto}
        </p>
      ) : null}
    </Entra>
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
  respostas,
  fecho,
}: {
  pergunta: string;
  respostas: readonly (readonly [string, string])[];
  fecho: string;
}) {
  return (
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
            <span style={{ fontFamily: MONO, fontSize: 24, color: "var(--nexodoc-accent)" }}>
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

      <Entra atraso={320 + respostas.length * 180 + 160}>
        <p
          style={{
            margin: 0,
            maxWidth: "52ch",
            paddingTop: 30,
            borderTop: "1px solid var(--border)",
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "-0.018em",
            lineHeight: 1.3,
            color: "var(--nexodoc-accent)",
            textWrap: "pretty",
          }}
        >
          {fecho}
        </p>
      </Entra>
    </>
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
            <Entra atraso={220}>
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
                NexoDoc
              </h1>
            </Entra>
            <Entra atraso={380}>
              <p
                style={{
                  margin: 0,
                  maxWidth: "26ch",
                  fontSize: 38,
                  letterSpacing: "-0.012em",
                  lineHeight: 1.28,
                  color: "var(--muted-foreground)",
                  textWrap: "pretty",
                }}
              >
                Conferência e montagem documental para projetos de engenharia
              </p>
            </Entra>
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
          <Entra atraso={60}>
            <p
              style={{
                margin: 0,
                fontSize: 52,
                fontWeight: 500,
                letterSpacing: "-0.022em",
                lineHeight: 1.24,
                color: "var(--foreground)",
                textWrap: "pretty",
              }}
            >
              Um sistema para organizar e documentar projetos de engenharia.
            </p>
          </Entra>
          <Entra atraso={240}>
            <p style={{ ...secundario, marginTop: 30, fontSize: 30, lineHeight: 1.42 }}>
              Ele monta os documentos que acompanham o projeto — listas de documentos, capas e
              volumes — e confere o que já está escrito nos memoriais, apontando o que não
              fecha.
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
              ["Lê o documento inteiro.", "Não é amostragem nem busca por palavra-chave."],
              ["Não altera o documento.", "Aponta onde está e o que fazer. Quem edita é você."],
              [
                "Não substitui revisão técnica.",
                "Faz a conferência que hoje ninguém tem tempo de fazer.",
              ],
            ].map(([titulo, texto], i) => (
              <Marcador key={titulo} titulo={titulo} texto={texto} atraso={520 + i * 140} />
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
        <Entra atraso={0}>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 52,
              fontWeight: 500,
              letterSpacing: "-0.025em",
              color: "var(--foreground)",
            }}
          >
            Um motor, dois caminhos
          </h2>
        </Entra>
        <Entra atraso={120}>
          <p style={{ ...secundario, margin: "0 0 16px", maxWidth: "76ch" }}>
            O documento entra, o sistema lê, e o caminho se decide pelo que ele é.
          </p>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 0, alignItems: "stretch" }}>
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
            <span style={{ ...rotulo, fontSize: 19, textAlign: "center" }}>O motor</span>
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

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 40 }}>
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
            Regra determinística é conta e comparação: não inventa, e a IA não pode apagá-la. A
            IA lê o que regra nenhuma alcança. A validação é a etapa que remove o achado sem
            sustentação.
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
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 16 }}>
            Ele revisa a si mesmo
          </h2>
        </Entra>
        <Entra atraso={120}>
          <p style={{ ...secundario, margin: "0 0 40px", maxWidth: "80ch" }}>
            A primeira leitura levanta. A segunda existe para derrubar o que a primeira afirmou
            sem sustentação.
          </p>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
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
                animationDelay: `${280 + i * 180}ms`,
                flex: 1,
                padding: i === 0 ? "0 44px 0 0" : "0 44px",
                borderLeft: i === 0 ? "none" : "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 25, color: "var(--nexodoc-accent)" }}>
                {c.n}
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: 32,
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.28,
                  color: "var(--foreground)",
                  textWrap: "pretty",
                }}
              >
                {c.titulo}
              </p>
              <p style={{ ...secundario, fontSize: 24 }}>{c.texto}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },

  {
    rotulo: "O resultado",
    numero: "05",
    bloco: "O que é",
    notas:
      "Ler os números sem adjetivo — eles não precisam de ajuda. Se a execução ao vivo devolver um total diferente, dizer na hora: é a variação que o slide dos limites declara, e reconhecê-la aqui reforça aquele slide em vez de enfraquecer este.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo">Um memorial inteiro, conferido</h2>
        </Entra>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Linha chave="Documento" valor="Memorial geral de uma UBS" atraso={140} />
          <Linha chave="Páginas" valor={<Contador ate={218} atraso={300} />} atraso={240} />
          <Linha
            chave="Achados"
            valor={
              <Contador
                ate={57}
                atraso={460}
                style={{ color: "var(--status-critical)", fontWeight: 500 }}
              />
            }
            atraso={340}
          />
          <Linha chave="Tempo de leitura" valor="cerca de 6 minutos" atraso={440} />
          <Linha
            chave="Custo da execução"
            valor={<span style={{ color: "var(--nexodoc-accent)" }}>US$ 1,49</span>}
            atraso={540}
          />
        </div>

        <Entra atraso={720}>
          <p className="ap-fonte">
            Custo lido do registro de uso do próprio sistema, não estimado. O tempo varia com o
            tamanho do documento.
          </p>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "Conferência hoje",
    numero: "06",
    bloco: "O problema",
    notas:
      "A frase de fechamento é o eixo da apresentação: ela impede que a conversa vire 'quantas horas você economiza', discussão que não interessa travar. O que se propõe é um controle que hoje não existe, não um processo mais barato.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo">Como a conferência acontece hoje</h2>
        </Entra>

        <div style={{ display: "flex", gap: 0 }}>
          {[
            ["Cada projetista", "confere o próprio projeto"],
            ["Sem tempo dedicado", "a conferência disputa espaço com a entrega"],
            ["Uma a duas horas", "quando de fato acontece"],
          ].map(([titulo, texto], i) => (
            <div
              key={titulo}
              className="ap-entra"
              style={{
                animationDelay: `${140 + i * 160}ms`,
                flex: 1,
                padding: i === 0 ? "0 44px 0 0" : "0 44px",
                borderLeft: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 40,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  color: "var(--foreground)",
                  textWrap: "pretty",
                }}
              >
                {titulo}
              </p>
              <p style={{ ...secundario, fontSize: 25 }}>{texto}</p>
            </div>
          ))}
        </div>

        <div className="ap-cresce" />

        <Entra atraso={680}>
          <p
            style={{
              margin: 0,
              maxWidth: "36ch",
              fontSize: 50,
              fontWeight: 500,
              letterSpacing: "-0.022em",
              lineHeight: 1.24,
              color: "var(--nexodoc-accent)",
              textWrap: "pretty",
            }}
          >
            Isto não é um processo caro para substituir. É um controle que hoje não existe.
          </p>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "Por que escapa",
    numero: "07",
    bloco: "O problema",
    notas:
      "A primeira causa desarma qualquer leitura de incompetência — e é importante dizê-la assim, porque quem está na sala assina esses projetos. A segunda mostra que o problema é do processo, não das pessoas.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo">Por que escapa</h2>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div
            style={{ flex: 1, paddingRight: 56, display: "flex", flexDirection: "column", gap: 26 }}
          >
            <Entra atraso={140}>
              <p
                style={{
                  margin: 0,
                  fontSize: 38,
                  fontWeight: 500,
                  letterSpacing: "-0.018em",
                  lineHeight: 1.26,
                  color: "var(--foreground)",
                  textWrap: "pretty",
                }}
              >
                Quem escreveu relê o que quis dizer, não o que ficou escrito.
              </p>
            </Entra>
            <Entra atraso={300}>
              <p style={secundario}>
                Não é falta de competência: é como a leitura funciona. E a consequência é sempre
                a mesma — na prática, a primeira revisão de verdade só acontece quando o projeto
                já está na mão do cliente.
              </p>
            </Entra>
            <Entra atraso={460}>
              <p
                style={{
                  ...paragrafo,
                  paddingTop: 22,
                  borderTop: "1px solid var(--border)",
                  color: "var(--status-critical)",
                }}
              >
                Quando isso acontece, quem revisa é quem contratou.
              </p>
            </Entra>
          </div>

          <div
            style={{
              flex: 1,
              paddingLeft: 56,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 26,
            }}
          >
            <Entra atraso={620}>
              <p
                style={{
                  margin: 0,
                  fontSize: 38,
                  fontWeight: 500,
                  letterSpacing: "-0.018em",
                  lineHeight: 1.26,
                  color: "var(--foreground)",
                  textWrap: "pretty",
                }}
              >
                O modelo-padrão leva o mesmo defeito para todos os projetos.
              </p>
            </Entra>
            <Entra atraso={780}>
              <p style={secundario}>
                O texto-base é reaproveitado de um projeto para o outro. Um erro nele não erra um
                projeto: erra todos, até que alguém finalmente o encontre.
              </p>
            </Entra>
            <Entra atraso={940}>
              <p
                style={{
                  ...paragrafo,
                  paddingTop: 22,
                  borderTop: "1px solid var(--border)",
                  color: "var(--status-warning)",
                }}
              >
                Achado uma vez, corrigido uma vez, resolvido em todos.
              </p>
            </Entra>
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
      "É AQUI que o episódio é narrado, agora que ele não tem folha própria: projeto devolvido, procuradoria acionada, três responsáveis parados três dias. Contar antes de mostrar a conta — sem detalhar quem, sem nomear disciplina. A palavra estimativa fica visível na tela; se preferir, troque a faixa pelo valor real antes de apresentar. A coluna da direita é o que fecha o slide: ler devagar e não insistir.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo">O que um erro desses custa</h2>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div
            style={{ flex: 1, paddingRight: 56, display: "flex", flexDirection: "column", gap: 24 }}
          >
            <Entra atraso={120}>
              <span style={rotulo}>A aritmética</span>
            </Entra>
            <Entra atraso={240}>
              <p style={{ margin: 0, fontFamily: MONO, fontSize: 34, color: "var(--foreground)" }}>
                3 responsáveis × 3 dias × 8 h ={" "}
                <Contador ate={72} atraso={420} style={{ fontWeight: 500 }} /> horas
              </p>
            </Entra>
            <Entra atraso={400}>
              <p
                style={{
                  margin: 0,
                  fontFamily: MONO,
                  fontSize: 34,
                  color: "var(--muted-foreground)",
                }}
              >
                Hora de engenheiro ou arquiteto{" "}
                <span className="ap-premissa">(estimativa: R$ 50 a R$ 90)</span>
              </p>
            </Entra>
            <Entra
              atraso={580}
              style={{ marginTop: 12, paddingTop: 26, borderTop: "1px solid var(--border)" }}
            >
              <span style={{ ...rotulo, display: "block", marginBottom: 12 }}>
                Só de horas paradas
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 58,
                  fontWeight: 500,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  color: "var(--foreground)",
                  whiteSpace: "nowrap",
                }}
              >
                R$ 3.600 a R$ 6.480
              </span>
            </Entra>
          </div>

          <div
            style={{
              flex: 1,
              paddingLeft: 56,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={720}>
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
                <Marcador key={titulo} titulo={titulo} texto={texto} atraso={840 + i * 160} />
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
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 24 }}>
            O que ele ainda não faz bem
          </h2>
        </Entra>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
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
            ["Não lê PDF escaneado.", "Documento digitalizado como imagem não é auditado."],
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
              cor={i === 0 ? "var(--status-warning)" : "var(--muted-foreground)"}
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
      "O slide que responde 'e se vazar?'. O primeiro item é decisão de projeto, não limitação — dizer com essas palavras. Se perguntarem se a IA aprende com os documentos: pela política da API usada, o conteúdo enviado não alimenta treinamento.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 24 }}>
            O que protege o documento
          </h2>
        </Entra>

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
                "O conteúdo não vira treino de modelo.",
                "Pela política da API usada, o que é enviado não alimenta treinamento.",
              ],
              ["A chave de IA vive só no servidor.", "Nunca chega ao navegador de ninguém."],
            ].map(([titulo, texto], i) => (
              <Marcador key={titulo} titulo={titulo} texto={texto} atraso={140 + i * 150} />
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
              <Marcador key={titulo} titulo={titulo} texto={texto} atraso={600 + i * 150} />
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
      "Dois blocos, não seis módulos. O que importa é a distinção entre conferir o que já existe e montar o que falta — é assim que o trabalho acontece no escritório.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 30 }}>
            O que já existe e funciona
          </h2>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 32 }}>
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
              className="ap-entra"
              style={{
                animationDelay: `${160 + i * 220}ms`,
                flex: 1,
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderTop: `2px solid ${bloco.cor}`,
                borderRadius: 4,
                padding: "34px 36px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 36,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  color: "var(--foreground)",
                  textWrap: "pretty",
                }}
              >
                {bloco.titulo}
              </h3>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", flex: 1 }}>
                {bloco.linhas.map((linha) => (
                  <li
                    key={linha}
                    style={{
                      padding: "14px 0",
                      borderTop: "1px solid var(--border)",
                      fontSize: 24,
                      lineHeight: 1.4,
                      color: "var(--muted-foreground)",
                      textWrap: "pretty",
                    }}
                  >
                    {linha}
                  </li>
                ))}
              </ul>
              <span
                style={{
                  alignSelf: "flex-start",
                  padding: "8px 14px",
                  borderRadius: 3,
                  background: bloco.seloOk ? "var(--status-ok-bg)" : "var(--nexodoc-raised)",
                  fontFamily: MONO,
                  fontSize: 21,
                  letterSpacing: "0.05em",
                  color: bloco.seloOk ? "var(--status-ok)" : "var(--muted-foreground)",
                }}
              >
                {bloco.selo}
              </span>
            </div>
          ))}
        </div>
      </>
    ),
  },

  {
    rotulo: "Quanto custa",
    numero: "12",
    denso: true,
    bloco: "O dinheiro",
    notas:
      "Deixar claro, com essas palavras, que a projeção é estimativa e varia com o uso. O número por execução é medido; o mensal depende de quantos documentos passarem. Atualizar a cotação do dólar antes de apresentar.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 10 }}>
            Quanto custa operar
          </h2>
        </Entra>
        <Entra atraso={100}>
          <p style={{ ...secundario, margin: "0 0 30px" }}>
            O custo por execução é medido no próprio sistema. O total mensal é{" "}
            <span className="ap-premissa">estimativa</span> — varia com quantos documentos
            passarem.
          </p>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div style={{ width: 560, flex: "none", paddingRight: 56 }}>
            <Entra atraso={200}>
              <span style={rotulo}>Medido por execução</span>
            </Entra>
            <div style={{ marginTop: 16 }}>
              {[
                ["Conferência de um memorial", "US$ 1,50", "218 páginas, leitura profunda"],
                ["Leitura de um selo de prancha", "US$ 0,001", "frações de centavo por folha"],
              ].map(([o, quanto, nota], i) => (
                <Entra
                  key={o}
                  atraso={300 + i * 160}
                  style={{ padding: "20px 0", borderTop: "1px solid var(--border)" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 20,
                    }}
                  >
                    <span style={{ fontSize: 26, color: "var(--foreground)" }}>{o}</span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 32,
                        color: "var(--nexodoc-accent)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {quanto}
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontFamily: MONO, fontSize: 21, color: "#5f6b72" }}>
                    {nota}
                  </p>
                </Entra>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              paddingLeft: 56,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={620}>
              <span style={rotulo}>Estimativa mensal, no volume do escritório</span>
            </Entra>
            <div style={{ marginTop: 16, flex: 1 }}>
              {[
                ["Conferência de memoriais", "cerca de 16 por mês", "US$ 24"],
                ["Montagem de listas e volumes", "uso corrente", "menos de US$ 1"],
                ["Servidor e banco", "infraestrutura fixa", "US$ 7"],
              ].map(([item, base, valor], i) => (
                <Entra
                  key={item}
                  atraso={720 + i * 140}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "baseline",
                    gap: "0 24px",
                    padding: "18px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 26, color: "var(--foreground)" }}>{item}</p>
                    <p
                      style={{ margin: "4px 0 0", fontFamily: MONO, fontSize: 21, color: "#5f6b72" }}
                    >
                      {base}
                    </p>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 28, color: "var(--foreground)" }}>
                    {valor}
                  </span>
                </Entra>
              ))}
            </div>

            <Entra
              atraso={1180}
              style={{
                paddingTop: 22,
                borderTop: "1px solid var(--nexodoc-accent)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 20,
              }}
            >
              <span style={{ ...rotulo, fontSize: 24 }}>Ordem de grandeza</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 44,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "var(--nexodoc-accent)",
                }}
              >
                ≈ R$ 170 / mês
              </span>
            </Entra>
            <Entra atraso={1300}>
              <p className="ap-fonte">
                Convertido a <span className="ap-premissa">R$ 5,30 por dólar</span> — atualizar a
                cotação antes de apresentar.
              </p>
            </Entra>
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "O piloto",
    numero: "13",
    denso: true,
    bloco: "O pedido",
    notas:
      "O pedido é o julgamento de quem usar — sem ele, a única medida em aberto continua em aberto. Não abrir o anexo aqui: ele é arquivo separado, e só sai se perguntarem valor.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 28 }}>
            Piloto de três meses
          </h2>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div
            style={{ flex: 1, paddingRight: 52, display: "flex", flexDirection: "column", gap: 26 }}
          >
            <Entra atraso={140}>
              <span style={rotulo}>O que entra</span>
              <p style={{ ...paragrafo, marginTop: 12 }}>
                Conferência de memorial descritivo e montagem de LDs, capas e volumes, com os
                usuários definidos junto com a diretoria.
              </p>
            </Entra>
            <Entra atraso={300}>
              <span style={rotulo}>O que eu entrego</span>
              <p style={{ ...paragrafo, marginTop: 12 }}>
                Acesso, acompanhamento próximo, correção dos problemas que aparecerem e o
                modelo-padrão de memorial corrigido.
              </p>
            </Entra>
            <Entra atraso={460}>
              <span style={rotulo}>Como saberemos se deu certo</span>
              <div style={{ marginTop: 10 }}>
                {[
                  "Nenhum achado com evidência que não exista no documento.",
                  "Precisão julgada por quem usou, disciplina por disciplina.",
                  "Listas e volumes reais montados sem perda de trabalho.",
                  "Custo mensal dentro do estimado.",
                ].map((t) => (
                  <p key={t} style={{ ...secundario, fontSize: 24, marginTop: 8 }}>
                    {t}
                  </p>
                ))}
              </div>
            </Entra>
          </div>

          <div
            style={{
              flex: 1,
              paddingLeft: 52,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 22,
            }}
          >
            <Entra atraso={640}>
              <span style={{ ...rotulo, color: "var(--primary)" }}>O que eu peço em troca</span>
            </Entra>
            <Entra atraso={780}>
              <p
                style={{
                  margin: 0,
                  fontSize: 40,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.26,
                  color: "var(--foreground)",
                  textWrap: "pretty",
                }}
              >
                Que quem usar julgue cada achado: verdadeiro, duvidoso ou falso.
              </p>
            </Entra>
            <Entra atraso={920}>
              <p style={secundario}>
                É a peça que falta no produto. A planilha de julgamento já existe e está pronta
                para receber esse veredito — e é ele que transforma a única medida em aberto num
                número.
              </p>
            </Entra>
            <div className="ap-cresce" />
            <Entra atraso={1060} style={{ paddingTop: 26, borderTop: "1px solid var(--border)" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 34,
                  fontWeight: 500,
                  letterSpacing: "-0.018em",
                  lineHeight: 1.3,
                  color: "var(--nexodoc-accent)",
                  textWrap: "pretty",
                }}
              >
                Três meses de uso real dizem o que nenhuma apresentação diz.
              </p>
            </Entra>
          </div>
        </div>
      </>
    ),
  },

  /*
   * ─── AS PERGUNTAS DIFÍCEIS ────────────────────────────────────────────────
   *
   * O bloco vem DEPOIS do pedido, e não antes, porque objeção só existe quando
   * há pedido na mesa: ninguém contesta um preço antes de saber que existe um.
   *
   * A ordem escala do técnico ao comercial. Cada folha responde por dinheiro um
   * pouco mais do que a anterior, e a última abre a porta do anexo — que é o
   * único lugar onde o valor aparece.
   */

  {
    rotulo: "Por que não o ChatGPT",
    numero: "14",
    bloco: "As perguntas difíceis",
    notas:
      "NÃO BRIGAR COM O CHATGPT: ele está dentro do sistema, e dizer isso desarma a pergunta em vez de disputá-la. Esta folha responde junto a 'e se em seis meses isso virar de graça?' e 'contrato um desenvolvedor por dois meses e tenho o mesmo'. Para o desenvolvedor: dois meses fazem a primeira versão; o que está na tela é o que sobrou depois de meses corrigindo contra memorial real, e a folha dos limites mostra o que ainda falta.",
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
        fecho="E quando o modelo melhorar — e vai — ele melhora aqui dentro. Trocar de modelo é uma linha de configuração; o que sobra é o resto."
      />
    ),
  },

  {
    rotulo: "Você não provou que vale",
    numero: "15",
    bloco: "As perguntas difíceis",
    notas:
      "Se vier 'isso aconteceu uma vez, em quantos anos?': uma vez que os senhores SOUBERAM — o erro do modelo-padrão esteve em cinco projetos e ninguém tinha achado. Se vier 'projetista ignora checklist há vinte anos': não é checklist, é uma lista com a página e a frase do documento dele; e se ignorarem, o piloto é exatamente o que mede isso. O terceiro bloco é o que mais compra a sala: é ganho que independe de assinar contrato.",
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
        fecho="Quantos dos outros são erro de verdade, eu não sei. É exatamente por isso que estou pedindo três meses, e não a sua assinatura."
      />
    ),
  },

  {
    rotulo: "E se você sumir",
    numero: "16",
    bloco: "As perguntas difíceis",
    notas:
      "CUSTÓDIA DE CÓDIGO E INSTALAÇÃO NA INFRAESTRUTURA DELES NÃO ESTÃO OFERECIDAS AQUI. Se um diretor pedir, é concessão a negociar na hora — nunca promessa feita da tela, porque promessa projetada não se retira depois. O fecho é o ponto que mais tranquiliza engenheiro na sala: a assinatura, e o risco que vem com ela, não mudam de dono.",
    corpo: (
      <Objecao
        pergunta="Você não é uma empresa. Sem CNPJ, sem suporte, sem prazo. E se você sair daqui, ou simplesmente parar? Ficamos reféns de um software de uma pessoa só."
        respostas={[
          [
            "A licença não depende do meu crachá.",
            "Se eu sair da PROSUL, ela continua valendo pelo prazo contratado. Sair da empresa não é sair do compromisso.",
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
        fecho="A responsabilidade técnica não muda de mãos, e nunca esteve na mesa. Quem assina o projeto continua sendo quem responde por ele — hoje, sem conferência nenhuma, e depois."
      />
    ),
  },

  {
    rotulo: "Isso não é nosso?",
    numero: "17",
    bloco: "As perguntas difíceis",
    notas:
      "ATENÇÃO — ESTA FOLHA CONVIDA A PERGUNTA 'E O QUE DIZ O SEU CONTRATO DE TRABALHO?'. Ler o contrato ANTES de apresentar. Se houver cláusula de cessão sobre criação fora do expediente, esta folha sai do deck e o assunto vira conversa reservada com o diretor, nunca plenário. Nada aqui é dito na defensiva: são três fatos e uma concessão. Falar devagar, sem justificar mais do que está escrito — quem explica demais parece estar se defendendo de algo.",
    corpo: (
      <Objecao
        pergunta="O problema é nosso. Os memoriais são nossos, os clientes são nossos, e você é nosso funcionário. Por que estamos pagando por isso?"
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
            "A exclusividade está na mesa.",
            "Durante o piloto eu não licencio para escritório concorrente. Se isso importa, escreve-se no contrato.",
          ],
        ]}
        fecho="O problema é da casa. A solução não nasceu dela."
      />
    ),
  },

  {
    rotulo: "O preço não se sustenta",
    numero: "18",
    bloco: "As perguntas difíceis",
    notas:
      "NENHUM NÚMERO NESTA FOLHA, de propósito: o anexo não existe para a sala até alguém perguntar o valor, e é AQUI que ele sai — em arquivo separado, aberto por decisão sua. A citação também não nomeia cifra, para não envelhecer quando a folha do custo mudar. O segundo bloco é o que salva a negociação: piloto de graça não é generosidade, é o que faz o julgamento dos subdiretores nunca acontecer.",
    corpo: (
      <Objecao
        pergunta="Você mesmo mostrou o custo de manter isso ligado, e ele é baixo. Piloto é grátis. E você não tem outro cliente — quem precisa de quem, aqui?"
        respostas={[
          [
            "O custo de operar é a conta de luz.",
            "É o que custa manter ligado. Não é o que custou construir, nem o que custa manter de pé enquanto vocês usam.",
          ],
          [
            "Piloto de graça não mede nada.",
            "O que eu peço no piloto é o julgamento de vocês, achado por achado — e isso é hora de subdiretor. O que se dá de graça vira brinde, e brinde não recebe julgamento: recebe silêncio.",
          ],
          [
            "É verdade que não tenho outro cliente.",
            "Por isso a proposta é curta: três meses, e ao fim ou encerra ou se renegocia. Não estou pedindo compromisso. Estou pedindo uma janela.",
          ],
        ]}
        fecho="Se for ruim, não usamos. Se for bom, conversamos sobre valores."
      />
    ),
  },

  {
    rotulo: "O que pode vir",
    numero: "19",
    bloco: "O pedido",
    notas:
      "Deixar claro que é caminho, não promessa — nada aqui está pronto. O item que costuma acender o olho de quem projeta é o terceiro: a correção aplicada direto no arquivo editável.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 10 }}>
            O que pode vir depois
          </h2>
        </Entra>
        <Entra atraso={100}>
          <p style={{ ...secundario, margin: "0 0 36px" }}>
            Caminho, não promessa. Nada disto está pronto, e a ordem depende do que o uso real
            mostrar.
          </p>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 28, alignItems: "center" }}>
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
                animationDelay: `${240 + i * 200}ms`,
                flex: 1,
                padding: "32px 32px 28px",
                borderRadius: 4,
                border: "1px dashed var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 22, color: "#5f6b72" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3
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
              </h3>
              <p style={{ ...secundario, fontSize: 24 }}>{c.texto}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },

  {
    rotulo: "O que ela não é",
    numero: "20",
    bloco: "O pedido",
    notas:
      "Fechar por aqui é escolha: a última coisa que a sala ouve é o limite, dito por mim, e não uma promessa. Ler devagar e parar. Se vier pergunta sobre valor, é aí que o anexo sai.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 28 }}>
            O que esta ferramenta não é
          </h2>
        </Entra>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
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
            <Marcador key={titulo} titulo={titulo} texto={texto} atraso={160 + i * 200} />
          ))}
        </div>

        <Entra atraso={860}>
          <p
            style={{
              margin: 0,
              maxWidth: "44ch",
              fontSize: 44,
              fontWeight: 500,
              letterSpacing: "-0.022em",
              lineHeight: 1.26,
              color: "var(--nexodoc-accent)",
              textWrap: "pretty",
            }}
          >
            Uma segunda leitura que nunca se cansa, e que nunca assina no seu lugar.
          </p>
        </Entra>
      </>
    ),
  },

];
