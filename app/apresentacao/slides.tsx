import type { CSSProperties } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";

import type { Slide } from "./palco";

/**
 * O CONTEÚDO DO DECK. A fonte de cada número está no spec
 * `docs/superpowers/specs/2026-08-24-apresentacao-diretoria-design.md`.
 *
 * DUAS REGRAS QUE ESTE ARQUIVO NÃO PODE PERDER:
 *
 *  1. **Todo número aqui foi medido.** Os custos saíram de `AiUsageEvent`, não
 *     de estimativa; os achados saíram de execuções reais gravadas em
 *     `docs/benchmarks/`. Onde não há medição, a palavra "premissa" aparece na
 *     tela, em âmbar. Um número inventado que o diretor detecte contamina os
 *     que estão certos.
 *  2. **O anexo não mora aqui.** Valor do piloto e propriedade do software
 *     ficam em arquivo separado. Uma seta a mais no fim do deck não pode
 *     revelar a proposta comercial antes da hora.
 *
 * OS RÓTULOS DE DISCIPLINA são os do produto (`DISCIPLINE_LABELS` em
 * `lib/audit-report.ts`), e não as chaves internas. A planilha de precisão
 * agrupa por chave: `terraplenagem` lá é "Terraplenagem / Urbanização" na tela,
 * porque a regra dessa disciplina casa `urbaniza` de propósito. Copiar a chave
 * para o slide faria um subdiretor conferir e achar divergência onde não há.
 */

const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const rotulo: CSSProperties = {
  fontFamily: MONO,
  fontSize: 24,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#5f6b72",
};

const celulaCabeca: CSSProperties = {
  paddingBottom: 12,
  borderBottom: "1px solid var(--border)",
  fontFamily: MONO,
  fontSize: 22,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#5f6b72",
};

const celula: CSSProperties = {
  padding: "13px 0",
  borderBottom: "1px solid #171c1f",
  fontSize: 25,
  lineHeight: 1.35,
  color: "var(--foreground)",
};

const celulaTrecho: CSSProperties = {
  ...celula,
  fontFamily: MONO,
  fontSize: 21,
  color: "var(--muted-foreground)",
};

const cartao: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 3,
  padding: "32px 34px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const selo: CSSProperties = {
  alignSelf: "flex-start",
  padding: "8px 14px",
  borderRadius: 3,
  background: "var(--nexodoc-raised)",
  fontFamily: MONO,
  fontSize: 22,
  letterSpacing: "0.05em",
  color: "var(--muted-foreground)",
};

/** Uma caixa do diagrama do slide 13. */
function Caixa({
  children,
  alerta = false,
}: {
  children: React.ReactNode;
  alerta?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "20px 22px",
        borderRadius: 4,
        border: `1px solid ${alerta ? "var(--status-critical)" : "var(--border)"}`,
        background: alerta ? "var(--status-critical-bg)" : "var(--nexodoc-raised)",
        fontSize: 23,
        lineHeight: 1.3,
        color: alerta ? "var(--status-critical)" : "var(--foreground)",
        textWrap: "pretty",
      }}
    >
      {children}
    </div>
  );
}

function Seta() {
  return (
    <span style={{ flex: "none", fontSize: 26, color: "#3d474d" }} aria-hidden="true">
      →
    </span>
  );
}

/** Uma faixa do diagrama do slide 13. */
function Faixa({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <span style={{ ...rotulo, fontSize: 21 }}>{titulo}</span>
      <div style={{ display: "flex", alignItems: "stretch", gap: 14 }}>{children}</div>
    </div>
  );
}

const paragrafo: CSSProperties = {
  margin: 0,
  fontSize: 27,
  lineHeight: 1.42,
  color: "var(--foreground)",
  textWrap: "pretty",
};
/**
 * Os achados do slide 9. A DISCIPLINA usa o rótulo do produto, não a chave da
 * planilha — ver o comentário no topo deste arquivo.
 */
const ACHADOS = [
  {
    disciplina: "Elétrico",
    achado: "Unidade de espessura mil vezes menor que a real",
    trecho: "“espessura de 0,254 microns”",
    pagina: "115",
  },
  {
    disciplina: "Terraplenagem / Urbanização",
    achado: "Unidade dimensional incompatível com o perfil",
    trecho: "“postes de aço de 60x40m altura 1,58m”",
    pagina: "47",
  },
  {
    disciplina: "Terraplenagem / Urbanização",
    achado: "Espessura de tubo conflitante na mesma frase",
    trecho: "“tubos de aço galvanizado ø 1'' 1/2 (e=3,81) com espessura de 3mm”",
    pagina: "49",
  },
  {
    disciplina: "Arquitetura",
    achado: "Norma citada não trata do requisito exigido",
    trecho:
      "sinalização de porta de vidro vinculada à “ABNT NBR ISO 9050:2022 — Determinação da transmissão de lu[minosidade]”",
    pagina: "74",
  },
  {
    disciplina: "Hidrossanitário",
    achado: "Referência de outro município, sem justificativa",
    trecho: "“Seguiram o cálculo conforme manual COMCAP.”",
    pagina: "109",
  },
  {
    disciplina: "Climatização",
    achado: "Premissa de ocupação divergente entre disciplinas",
    trecho:
      "“1 sala de inalação atendendo 4 pessoas simultaneamente” × “Número de Pessoas : 3”",
    pagina: "12 e 195",
  },
  {
    disciplina: "Geral / Documental",
    achado: "Texto de outro empreendimento dentro do memorial",
    trecho:
      "“Por exigência do Shopping, todos os sistemas que atendem a loja deverão ser intertravados eletricamente”",
    pagina: "211",
  },
] as const;

export const SLIDES: readonly Slide[] = [
  {
    rotulo: "Capa",
    numero: "01",
    notas: "Abrir sem preâmbulo. Nome, o que é, quem apresenta. Não explicar a capa.",
    corpo: (
      <>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 44 }}>
          <MarcaViva size={196} parada />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 112,
                fontWeight: 500,
                letterSpacing: "-0.035em",
                lineHeight: 1,
                color: "var(--foreground)",
              }}
            >
              NexoDoc
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 40,
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
                color: "var(--muted-foreground)",
              }}
            >
              Conferência documental para projetos de engenharia
            </p>
          </div>
        </div>
        <div
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
          <span>Apresentação à diretoria</span>
          <span>·</span>
          <span>2026</span>
          <span>·</span>
          <span>Matheus Mendes</span>
        </div>
      </>
    ),
  },

  {
    rotulo: "O que é",
    numero: "02",
    bloco: "Funciona",
    notas:
      "Ler a frase central em voz alta, devagar. Os três fatos secos são o que impede a sala de imaginar mais do que o sistema faz.",
    corpo: (
      <>
        <p
          style={{
            margin: "0 0 auto",
            maxWidth: "26ch",
            fontSize: 58,
            fontWeight: 500,
            letterSpacing: "-0.022em",
            lineHeight: 1.22,
            color: "var(--foreground)",
            textWrap: "pretty",
          }}
        >
          Um sistema que lê memoriais descritivos em PDF e devolve uma lista de
          inconsistências — cada uma com a transcrição literal do trecho e a página onde
          ela está.
        </p>
        <div style={{ display: "flex", gap: 0, marginTop: 60 }}>
          {[
            "Lê o documento inteiro, não uma amostra.",
            "Não altera o documento. Só aponta.",
            "Não substitui revisão técnica. Aponta o que um revisor conferiria.",
          ].map((texto, i) => (
            <p
              key={texto}
              style={{
                flex: 1,
                margin: 0,
                padding: i === 0 ? "0 40px 0 0" : "0 40px",
                borderLeft: i === 0 ? "none" : "1px solid var(--border)",
                fontSize: 28,
                lineHeight: 1.4,
                color: "var(--muted-foreground)",
                textWrap: "pretty",
              }}
            >
              {texto}
            </p>
          ))}
        </div>
      </>
    ),
  },

  {
    rotulo: "Ao vivo",
    numero: "03",
    bloco: "Funciona",
    notas:
      "Abrir o NexoDoc autenticado. Anexar 117_25_md_geral_a.pdf (memorial geral, 218 páginas, versão de outubro/2025). Selecionar nível Profundo. Executar. Enquanto processa (~6 min), passar aos slides 5-8. Voltar quando terminar e abrir o resultado. Se a rede, a OpenAI ou o deploy falharem, usar as capturas de plano B. Nunca demonstrar ao vivo sem rede.",
    corpo: (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 28,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 120,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: "var(--foreground)",
          }}
        >
          Ao vivo
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: MONO,
            fontSize: 44,
            letterSpacing: "0.02em",
            color: "var(--nexodoc-accent)",
          }}
        >
          117-25
        </p>
        <p style={{ margin: "40px 0 0", fontSize: 26, color: "#5f6b72" }}>
          Plano B — capturas do resultado real, 18/08/2026
        </p>
      </div>
    ),
  },

  {
    rotulo: "Resultado bruto",
    numero: "04",
    bloco: "Funciona",
    notas:
      "Ler os números sem comentar. Se a execução ao vivo devolver um total diferente, dizer na hora: é exatamente a variação declarada no slide 12.",
    corpo: (
      <>
        <h2 className="ap-titulo">O resultado bruto</h2>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            alignContent: "start",
            gap: "0 48px",
          }}
        >
          {[
            ["Documento", "Memorial geral 117-25 — UBS Vila Manaus, Criciúma/SC"],
            ["Páginas", "218"],
            ["Achados", "57"],
            ["Tempo", "6 min 15 s"],
            ["Custo da execução", "US$ 1,49"],
          ].map(([chave, valor]) => (
            <Linha key={chave} chave={chave} valor={valor} />
          ))}
        </div>
        <p className="ap-fonte">
          Execução real de 18/08/2026, auditId 58afd1b4. Custo lido de AiUsageEvent, não
          estimado.
        </p>
      </>
    ),
  },

  {
    rotulo: "Conferência hoje",
    numero: "05",
    bloco: "O problema",
    notas:
      "Este slide roda enquanto a auditoria processa. A frase de fechamento é o eixo da apresentação: ela impede que a conversa vire quantas horas você economiza.",
    corpo: (
      <>
        <h2 className="ap-titulo">Como a conferência acontece hoje</h2>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {[
            "Cada projetista confere o próprio projeto.",
            "Não há tempo dedicado para isso.",
            "Quando acontece, leva de 1 a 2 horas por memorial.",
          ].map((texto) => (
            <li
              key={texto}
              style={{
                padding: "28px 0",
                borderTop: "1px solid var(--border)",
                fontSize: 38,
                lineHeight: 1.35,
                color: "var(--foreground)",
              }}
            >
              {texto}
            </li>
          ))}
        </ul>
        <div className="ap-cresce" />
        <p
          style={{
            margin: 0,
            maxWidth: "34ch",
            fontSize: 52,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.24,
            color: "var(--nexodoc-accent)",
            textWrap: "pretty",
          }}
        >
          Isto não é um processo caro para substituir. É um controle que hoje não existe.
        </p>
      </>
    ),
  },

  {
    rotulo: "Por que escapa",
    numero: "06",
    bloco: "O problema",
    notas:
      "A primeira causa desarma qualquer leitura de incompetência. A segunda explica por que o problema é sistêmico e não pontual.",
    corpo: (
      <>
        <h2 className="ap-titulo">Por que escapa</h2>
        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <Causa
            titulo="Quem confere o próprio trabalho não enxerga o próprio erro."
            texto="Não é falta de competência. É como a leitura funciona: relemos o que quisemos escrever, não o que está escrito. Por isso revisão editorial é feita por outra pessoa em qualquer editora do mundo."
          />
          <Causa
            divisor
            titulo="O memorial-padrão propaga o mesmo erro para todos os projetos."
            texto="O texto-base é reaproveitado. Um defeito nele não erra um projeto: erra todos, até que alguém o encontre."
          />
        </div>
      </>
    ),
  },

  {
    rotulo: "Quando escapou",
    numero: "07",
    bloco: "O problema",
    notas:
      "Narrar. Sem detalhar quem, sem nomear disciplina. Todos na sala sabem qual foi o caso — e é o 117-25 que está rodando na tela ao lado, na versão que foi devolvida. O silêncio faz o trabalho.",
    corpo: (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 34,
        }}
      >
        {["Projeto devolvido.", "Procuradoria acionada.", "Três responsáveis, três dias."].map(
          (linha) => (
            <p
              key={linha}
              style={{
                margin: 0,
                fontSize: 76,
                fontWeight: 500,
                letterSpacing: "-0.028em",
                lineHeight: 1.15,
                color: "var(--foreground)",
              }}
            >
              {linha}
            </p>
          ),
        )}
      </div>
    ),
  },

  {
    rotulo: "A conta",
    numero: "08",
    bloco: "O problema",
    notas:
      "A palavra premissa fica visível na tela. Se preferir, substituir a faixa pelo valor-hora real da PROSUL antes de apresentar. A coluna direita é o que fecha o slide — não insistir nela, apenas ler.",
    corpo: (
      <>
        <h2 className="ap-titulo">A conta</h2>
        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div
            style={{
              flex: 1,
              paddingRight: 56,
              display: "flex",
              flexDirection: "column",
              gap: 26,
            }}
          >
            <span style={rotulo}>A aritmética</span>
            <p style={{ margin: 0, fontFamily: MONO, fontSize: 38, color: "var(--foreground)" }}>
              3 responsáveis × 3 dias × 8 h = 72 horas
            </p>
            <p
              style={{
                margin: 0,
                fontFamily: MONO,
                fontSize: 38,
                color: "var(--muted-foreground)",
              }}
            >
              Valor-hora de engenheiro{" "}
              <span className="ap-premissa">(premissa: R$ 80 a R$ 150)</span>
            </p>
            <div
              style={{
                marginTop: 14,
                paddingTop: 26,
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <span style={rotulo}>Custo direto</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 62,
                  fontWeight: 500,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  color: "var(--foreground)",
                }}
              >
                R$ 5.760 a R$ 10.800
              </span>
            </div>
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
            <span style={rotulo}>O que não entra na conta</span>
            {[
              "A confiança do cliente na entrega seguinte.",
              "A posição de quem apresentou o projeto.",
              "O nível percebido da empresa e dos profissionais.",
            ].map((texto) => (
              <p
                key={texto}
                style={{
                  margin: 0,
                  fontSize: 32,
                  lineHeight: 1.4,
                  color: "var(--foreground)",
                  textWrap: "pretty",
                }}
              >
                {texto}
              </p>
            ))}
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "Achados por disciplina",
    numero: "09",
    denso: true,
    bloco: "A prova",
    notas:
      "O slide dos subdiretores. Não parafrasear os trechos: ler literalmente. Não se discute com uma citação literal. Deixar o silêncio depois de cada linha.",
    corpo: (
      <>
        <h2 style={{ margin: "0 0 24px", fontSize: 50, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--foreground)" }}>
          Os achados, por disciplina
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "270px 1fr 1fr 90px",
            gap: "0 28px",
            alignItems: "baseline",
          }}
        >
          <span style={celulaCabeca}>Disciplina</span>
          <span style={celulaCabeca}>Achado</span>
          <span style={celulaCabeca}>Trecho literal</span>
          <span style={{ ...celulaCabeca, textAlign: "right" }}>Pág.</span>
          {ACHADOS.map((a) => (
            <Achado key={a.pagina + a.achado} {...a} />
          ))}
        </div>
        <div className="ap-cresce" />
        <p
          style={{
            margin: "20px 0 0",
            maxWidth: "62ch",
            fontSize: 29,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            lineHeight: 1.3,
            color: "var(--nexodoc-accent)",
            textWrap: "pretty",
          }}
        >
          Nenhum destes é erro de quem escreveu. São erros que sobrevivem porque ninguém,
          hoje, tem a tarefa de procurá-los.
        </p>
        <p className="ap-fonte">docs/benchmarks/117-25/planilha-de-precisao.md</p>
      </>
    ),
  },

  {
    rotulo: "Achados do modelo",
    numero: "10",
    bloco: "A prova",
    notas:
      "Este é o slide que vale dinheiro independente do contrato. O texto corrigido já está redigido. Dizer que esse ganho existe mesmo que a diretoria decida não seguir.",
    corpo: (
      <>
        <h2 className="ap-titulo">Onze achados não são do projeto: são do modelo</h2>
        <p style={{ margin: "0 0 32px", fontSize: 30, color: "var(--muted-foreground)" }}>
          Três defeitos aparecem em texto idêntico nos memoriais analisados:
        </p>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            {
              texto:
                "Prevalência contratual contraditória — a página 16 diz que os projetos prevalecem sobre as especificações; a página 20 diz o contrário.",
              conta: "5 de 5 projetos",
            },
            { texto: "Especificação de ferragens contraditória", conta: "3 de 3" },
            { texto: "Parágrafo repetido dentro do mesmo documento", conta: "3 de 3" },
          ].map((item) => (
            <div
              key={item.conta + item.texto}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 40,
                padding: "26px 0",
                borderTop: "1px solid var(--border)",
              }}
            >
              <p
                style={{
                  flex: 1,
                  margin: 0,
                  fontSize: 30,
                  lineHeight: 1.38,
                  color: "var(--foreground)",
                  textWrap: "pretty",
                }}
              >
                {item.texto}
              </p>
              <span
                style={{
                  flex: "none",
                  fontFamily: MONO,
                  fontSize: 32,
                  fontWeight: 500,
                  color: "var(--status-critical)",
                }}
              >
                {item.conta}
              </span>
            </div>
          ))}
        </div>
        <div className="ap-cresce" />
        <p
          style={{
            margin: 0,
            maxWidth: "46ch",
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.26,
            color: "var(--nexodoc-accent)",
            textWrap: "pretty",
          }}
        >
          Consertar o memorial-padrão uma vez elimina os onze em todos os projetos futuros
          — e nos que já saíram.
        </p>
        <p className="ap-fonte">
          O texto corrigido já está redigido, em docs/correcoes-do-memorial-padrao.html.
          Esse ganho independe de contrato.
        </p>
      </>
    ),
  },

  {
    rotulo: "Não inventa",
    numero: "11",
    bloco: "A prova",
    notas:
      "Narrar, sem projetar: houve um caso em que a validação por IA contestou uma regra minha e estava certa — a cláusula que a invalidava estava quarenta páginas adiante, e eu havia lido as ocorrências uma a uma sem vê-la. Não usar a expressão auditoria externa em nenhum momento: a segunda opinião do benchmark veio de outra IA, e a pergunta quem auditou derruba o argumento.",
    corpo: (
      <>
        <h2 className="ap-titulo">Como sei que ele não inventa</h2>
        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          {[
            {
              n: "01",
              titulo: "A evidência existe no documento.",
              texto:
                "Hospital 113-22, nível Profundo: 58 das 59 evidências ancoram na página declarada, com transcrição literal. Nenhuma inventada.",
            },
            {
              n: "02",
              titulo: "Ele reconhece o próprio erro.",
              texto:
                "Com falsos positivos plantados de propósito, a etapa de validação capturou 4 de 4 — inclusive os que só se refutam lendo uma página distante do miolo.",
            },
            {
              n: "03",
              titulo: "Eu caço os meus falsos positivos.",
              texto:
                "Rodando todas as regras contra os 5 memoriais reais do acervo, o total caiu de 41 para 23 achados. Quatro classes de falso positivo foram lidas uma a uma e corrigidas; uma regra inteira foi aposentada por estar errada.",
            },
          ].map((c, i) => (
            <div
              key={c.n}
              style={{
                flex: 1,
                padding: i === 0 ? "0 40px 0 0" : "0 40px",
                borderLeft: i === 0 ? "none" : "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 26, color: "var(--nexodoc-accent)" }}>
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
              <p
                style={{
                  margin: 0,
                  fontSize: 26,
                  lineHeight: 1.45,
                  color: "var(--muted-foreground)",
                  textWrap: "pretty",
                }}
              >
                {c.texto}
              </p>
            </div>
          ))}
        </div>
        <p className="ap-fonte">
          docs/analise-arquitetura-auditoria-2026-08-17.md, seções 12.2 a 12.5.
        </p>
      </>
    ),
  },

  {
    rotulo: "Limites",
    numero: "12",
    bloco: "A prova",
    notas:
      "Dito por você, antes de perguntarem. Este slide compra mais credibilidade que qualquer outro do deck. Não amaciar nenhum dos quatro itens.",
    corpo: (
      <>
        <h2 className="ap-titulo">O que ele ainda não faz bem</h2>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            {
              titulo: "A lista varia entre execuções.",
              texto:
                "Três corridas do mesmo documento: 58, 57 e 55 achados. O total é estável; os achados de borda entram e saem.",
            },
            {
              titulo: "A precisão dos achados exclusivos ainda não foi julgada.",
              texto:
                "Ela depende do veredito de quem projeta. Ninguém além dos senhores pode dá-lo — e é exatamente isso que estou pedindo no piloto.",
            },
            {
              titulo: "Não lê PDF escaneado.",
              texto: "Sem OCR, documento digitalizado como imagem não é auditado.",
            },
            {
              titulo: "Não audita prancha.",
              texto:
                "Hoje o alvo é o memorial descritivo e a documentação de identidade do projeto.",
            },
          ].map((item) => (
            <div
              key={item.titulo}
              style={{ padding: "24px 0", borderTop: "1px solid var(--border)" }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 32,
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                  color: "var(--foreground)",
                }}
              >
                {item.titulo}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 26,
                  lineHeight: 1.42,
                  color: "var(--muted-foreground)",
                  textWrap: "pretty",
                }}
              >
                {item.texto}
              </p>
            </div>
          ))}
        </div>
      </>
    ),
  },

  {
    rotulo: "Caminho do documento",
    numero: "13",
    denso: true,
    bloco: "Como funciona",
    notas:
      "Diagrama para leigo. Ler de cima para baixo. A caixa em cor de alerta na faixa 3 marca uma decisão deliberada, não um erro — é o ponto que o diretor vai querer ouvir.",
    corpo: (
      <>
        <h2 style={{ margin: "0 0 30px", fontSize: 56, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--foreground)" }}>
          O caminho de um documento
        </h2>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          <Faixa titulo="O que a pessoa faz">
            <Caixa>Escolhe o projeto</Caixa>
            <Seta />
            <Caixa>Anexa o PDF</Caixa>
            <Seta />
            <Caixa>Escolhe o nível: Padrão ou Profundo</Caixa>
          </Faixa>

          <Faixa titulo="O que o sistema faz">
            <Caixa>Extrai o texto e mapeia as páginas</Caixa>
            <Seta />
            <Caixa>Aplica as regras determinísticas</Caixa>
            <Seta />
            <Caixa>Lê o documento com o modelo de IA</Caixa>
            <Seta />
            <Caixa>Uma segunda passada valida cada achado e descarta o que não se sustenta</Caixa>
            <Seta />
            <Caixa>Monta o parecer com página e transcrição</Caixa>
          </Faixa>

          <p
            style={{
              margin: 0,
              fontSize: 22,
              lineHeight: 1.45,
              color: "#5f6b72",
              textWrap: "pretty",
            }}
          >
            Regra determinística é conta e comparação — não alucina, e a IA não pode
            apagá-la. A IA lê o que regra nenhuma alcança. A validação é a etapa que remove
            achado sem sustentação.
          </p>

          <Faixa titulo="Onde o dado fica">
            <Caixa>O parecer fica no banco</Caixa>
            <Caixa>Os metadados do arquivo ficam</Caixa>
            <Caixa>O custo de cada execução fica registrado</Caixa>
            <Caixa alerta>O PDF anexado NÃO é armazenado</Caixa>
          </Faixa>
        </div>
      </>
    ),
  },

  {
    rotulo: "O que existe hoje",
    numero: "14",
    bloco: "Como funciona",
    notas:
      "A marca de maturidade é a parte importante de cada cartão. Não nivelar por cima: Funcional não é Medido em projeto real.",
    corpo: (
      <>
        <h2 className="ap-titulo">O que já existe hoje</h2>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridAutoRows: "1fr",
            gap: 22,
          }}
        >
          {[
            ["Conferência Documental", "Audita memorial e documentos de identidade do projeto", "Medido em projeto real"],
            ["Montagem de LDs", "Lê selos das pranchas e monta a Lista de Documentos, com ODT, PDF e ZIP", "Piloto controlado documentado"],
            ["Volumes", "Confere e organiza a montagem dos volumes", "Funcional"],
            ["Capas", "Gera capas com os dados do escritório", "Funcional"],
            ["Projetos", "Pasta por centro de custo, histórico e fila de achados", "Funcional"],
            ["Painel administrativo", "Usuários, uso de IA, custo por obra, qualidade", "Funcional"],
          ].map(([nome, oQue, estado]) => (
            <div key={nome} style={cartao}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 32,
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.22,
                  color: "var(--foreground)",
                }}
              >
                {nome}
              </h3>
              <p
                style={{
                  margin: 0,
                  flex: 1,
                  fontSize: 25,
                  lineHeight: 1.42,
                  color: "var(--muted-foreground)",
                  textWrap: "pretty",
                }}
              >
                {oQue}
              </p>
              <span
                style={
                  estado === "Medido em projeto real"
                    ? { ...selo, background: "var(--status-ok-bg)", color: "var(--status-ok)" }
                    : selo
                }
              >
                {estado}
              </span>
            </div>
          ))}
        </div>
      </>
    ),
  },

  {
    rotulo: "Controle e privacidade",
    numero: "15",
    bloco: "Como funciona",
    notas:
      "O slide que responde e se der problema. O primeiro item é decisão de projeto, não limitação — dizer isso com essas palavras.",
    corpo: (
      <>
        <h2 className="ap-titulo">Controle e privacidade</h2>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {[
            "Nenhum PDF anexado é armazenado. Decisão de projeto, não limitação. Para reprocessar, o arquivo é reenviado.",
            "A chave de IA vive só no servidor. Nunca chega ao navegador.",
            "Acesso por login Google, restrito a quem for autorizado; papéis de administrador e membro.",
            "Cada execução registra provedor, modelo, tokens, custo e duração. O painel mostra custo por obra.",
            "Teto de gasto mensal configurável, que recusa a chamada ao ser atingido.",
          ].map((texto) => (
            <li
              key={texto}
              style={{
                padding: "26px 0",
                borderTop: "1px solid var(--border)",
                fontSize: 32,
                lineHeight: 1.4,
                color: "var(--foreground)",
                textWrap: "pretty",
              }}
            >
              {texto}
            </li>
          ))}
        </ul>
      </>
    ),
  },

  {
    rotulo: "Quanto custa",
    numero: "16",
    denso: true,
    bloco: "O dinheiro",
    notas:
      "ATUALIZAR A COTAÇÃO DO DIA antes de apresentar, e corrigir também o slide 17, que deriva dela. Volume mensal informado pela diretoria: 4 projetos × ~4 memoriais gerais.",
    corpo: (
      <>
        <h2 style={{ margin: "0 0 36px", fontSize: 56, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--foreground)" }}>
          Quanto custa para ter
        </h2>
        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div
            style={{ width: 520, flex: "none", paddingRight: 56, display: "flex", flexDirection: "column" }}
          >
            <span style={{ ...rotulo, marginBottom: 22 }}>Custo medido por execução</span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "0 32px",
                alignItems: "baseline",
              }}
            >
              <span style={celulaCabeca}>Corrida</span>
              <span style={{ ...celulaCabeca, textAlign: "right" }}>Achados</span>
              <span style={{ ...celulaCabeca, textAlign: "right" }}>Custo</span>
              {[
                ["1", "58", "US$ 0,91"],
                ["2", "57", "US$ 1,49"],
                ["3", "55", "US$ 1,45"],
              ].map(([n, achados, custo]) => (
                <Corrida key={n} n={n} achados={achados} custo={custo} />
              ))}
            </div>
            <p className="ap-fonte">Três corridas reais, 18/08/2026.</p>
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
            <span style={{ ...rotulo, marginBottom: 22 }}>
              Projeção para o volume real da PROSUL
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr auto",
                gap: "0 32px",
                alignItems: "baseline",
              }}
            >
              <span style={celulaCabeca}>Item</span>
              <span style={celulaCabeca}>Base</span>
              <span style={{ ...celulaCabeca, textAlign: "right" }}>Mensal</span>

              <span style={celula}>Auditoria profunda de memorial</span>
              <span style={celulaTrecho}>16 memoriais/mês × US$ 1,50</span>
              <span style={{ ...celula, fontFamily: MONO, textAlign: "right" }}>US$ 24,00</span>

              <span style={celula}>Montagem de LDs e volumes</span>
              <span style={celulaTrecho}>
                frações de centavo por leitura de selo (US$ 0,0011 medido)
              </span>
              <span style={{ ...celula, fontFamily: MONO, textAlign: "right" }}>
                &lt; US$ 1,00
              </span>

              <span style={celula}>Infraestrutura</span>
              <span style={celulaTrecho}>servidor (US$ 7) + banco (camada gratuita)</span>
              <span style={{ ...celula, fontFamily: MONO, textAlign: "right" }}>US$ 7,00</span>

              <span style={{ ...rotulo, padding: "22px 0 0", fontSize: 24 }}>Total</span>
              <span />
              <span
                style={{
                  padding: "22px 0 0",
                  fontFamily: MONO,
                  fontSize: 44,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "var(--nexodoc-accent)",
                  textAlign: "right",
                }}
              >
                ≈ R$ 170
              </span>
            </div>
            <p className="ap-fonte">
              ≈ US$ 32/mês. Câmbio —{" "}
              <span className="ap-premissa">premissa declarada: R$ 5,30</span>. Custos lidos
              de AiUsageEvent; volume mensal informado pela diretoria (4 projetos × ~4
              memoriais gerais).
            </p>
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "A comparação",
    numero: "17",
    bloco: "O dinheiro",
    notas:
      "É o slide que decide. Deixar as duas barras na tela em silêncio antes de ler a frase de fechamento. A barra do episódio mostra a FAIXA: o trecho sólido é a hipótese conservadora (R$ 80/h), o hachurado vai até R$ 150/h. A frase usa a ponta conservadora de propósito — ganhar com o número menor é ganhar sem discussão.",
    corpo: (
      <>
        <h2 style={{ margin: "0 0 52px", fontSize: 60, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--foreground)" }}>
          A comparação
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ fontSize: 30, color: "var(--muted-foreground)" }}>
              Um ano de operação do NexoDoc
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <div
                style={{ width: "19%", height: 72, background: "var(--primary)", borderRadius: 2 }}
              />
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 50,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "var(--nexodoc-accent)",
                }}
              >
                R$ 2.046
              </span>
              <span style={{ fontFamily: MONO, fontSize: 25, color: "#5f6b72" }}>
                ≈ US$ 384 · premissa de câmbio R$ 5,30
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ fontSize: 30, color: "var(--muted-foreground)" }}>
              Um único episódio como o que já aconteceu
            </span>
            <div
              style={{
                display: "flex",
                width: "100%",
                height: 72,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div style={{ width: "53%", height: "100%", background: "var(--status-critical)" }} />
              <div
                style={{
                  width: "47%",
                  height: "100%",
                  background:
                    "repeating-linear-gradient(135deg, rgb(255 146 133 / 0.34) 0 10px, rgb(255 146 133 / 0.12) 10px 20px)",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 50,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "var(--status-critical)",
                  whiteSpace: "nowrap",
                }}
              >
                R$ 5.760 a 10.800
              </span>
              <span style={{ fontSize: 25, lineHeight: 1.4, color: "#5f6b72", textWrap: "pretty" }}>
                72 horas paradas, a um valor-hora de R$ 80 a R$ 150{" "}
                <span className="ap-premissa">(premissa)</span> — sem contar a devolução do
                projeto e o desgaste com o cliente
              </span>
            </div>
          </div>
        </div>
        <div className="ap-cresce" />
        <p
          style={{
            margin: 0,
            maxWidth: "48ch",
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.26,
            color: "var(--foreground)",
            textWrap: "pretty",
          }}
        >
          Mesmo na hipótese mais conservadora, o ano inteiro de operação cabe dentro de um
          terço de um episódio. E o episódio não custou só dinheiro.
        </p>
      </>
    ),
  },

  {
    rotulo: "Piloto de 3 meses",
    numero: "18",
    bloco: "O pedido",
    notas:
      "Fechar com as próprias palavras: se for ruim, não usamos; se for bom, conversamos sobre valores. O anexo com o valor é um ARQUIVO SEPARADO, fora deste deck — abrir só se a diretoria perguntar.",
    corpo: (
      <>
        <h2 style={{ margin: "0 0 36px", fontSize: 56, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--foreground)" }}>
          Piloto de 3 meses
        </h2>
        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div
            style={{
              flex: 1,
              paddingRight: 52,
              display: "flex",
              flexDirection: "column",
              gap: 30,
            }}
          >
            <Grupo titulo="O que eu proponho">
              <p style={paragrafo}>
                Escopo: Conferência Documental, Montagem de LDs, Volumes e Capas.
              </p>
              <p style={paragrafo}>Usuários: a definir com a diretoria.</p>
              <p style={paragrafo}>Duração: 3 meses.</p>
            </Grupo>
            <Grupo titulo="O que eu entrego">
              <p style={paragrafo}>
                Acesso, acompanhamento próximo, correção dos problemas que aparecerem e o
                memorial-padrão corrigido.
              </p>
            </Grupo>
            <Grupo titulo="Critérios de sucesso, escritos agora">
              {[
                "Nenhum achado com evidência inexistente no documento.",
                "Precisão dos achados exclusivos julgada por disciplina.",
                "LDs reais montadas sem perda de trabalho.",
                "Custo mensal dentro do projetado.",
              ].map((t) => (
                <p key={t} style={{ ...paragrafo, fontSize: 25, color: "var(--muted-foreground)" }}>
                  {t}
                </p>
              ))}
            </Grupo>
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
            <span style={{ ...rotulo, color: "var(--primary)" }}>O que eu peço em troca</span>
            <p
              style={{
                margin: 0,
                fontSize: 36,
                fontWeight: 500,
                letterSpacing: "-0.015em",
                lineHeight: 1.3,
                color: "var(--foreground)",
                textWrap: "pretty",
              }}
            >
              Que cada subdiretor julgue os achados da própria disciplina como verdadeiro,
              duvidoso ou falso.
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 27,
                lineHeight: 1.45,
                color: "var(--muted-foreground)",
                textWrap: "pretty",
              }}
            >
              É a peça que falta no produto. A planilha já existe e está pronta para receber
              esse veredito. É o julgamento de vocês que transforma a única medida em aberto
              em número.
            </p>
            <div className="ap-cresce" />
            <div style={{ paddingTop: 30, borderTop: "1px solid var(--border)" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 42,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.28,
                  color: "var(--nexodoc-accent)",
                  textWrap: "pretty",
                }}
              >
                Se for ruim, não usamos. Se for bom, conversamos sobre valores.
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
];



function Achado({
  disciplina,
  achado,
  trecho,
  pagina,
}: {
  disciplina: string;
  achado: string;
  trecho: string;
  pagina: string;
}) {
  return (
    <>
      <span style={{ ...celula, color: "var(--nexodoc-accent)", fontSize: 23 }}>{disciplina}</span>
      <span style={celula}>{achado}</span>
      <span style={celulaTrecho}>{trecho}</span>
      <span style={{ ...celula, fontFamily: MONO, textAlign: "right" }}>{pagina}</span>
    </>
  );
}

function Linha({ chave, valor }: { chave: string; valor: string }) {
  return (
    <>
      <span
        style={{
          padding: "26px 0",
          borderTop: "1px solid var(--border)",
          ...rotulo,
          fontSize: 24,
        }}
      >
        {chave}
      </span>
      <span
        style={{
          padding: "26px 0",
          borderTop: "1px solid var(--border)",
          fontFamily: MONO,
          fontSize: 40,
          color: "var(--foreground)",
        }}
      >
        {valor}
      </span>
    </>
  );
}

function Corrida({ n, achados, custo }: { n: string; achados: string; custo: string }) {
  return (
    <>
      <span style={{ ...celula, fontFamily: MONO, color: "var(--muted-foreground)" }}>{n}</span>
      <span style={{ ...celula, fontFamily: MONO, textAlign: "right" }}>{achados}</span>
      <span style={{ ...celula, fontFamily: MONO, textAlign: "right" }}>{custo}</span>
    </>
  );
}

function Causa({
  titulo,
  texto,
  divisor = false,
}: {
  titulo: string;
  texto: string;
  divisor?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: divisor ? "0 0 0 56px" : "0 56px 0 0",
        borderLeft: divisor ? "1px solid var(--border)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
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
        {titulo}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 28,
          lineHeight: 1.45,
          color: "var(--muted-foreground)",
          textWrap: "pretty",
        }}
      >
        {texto}
      </p>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={rotulo}>{titulo}</span>
      {children}
    </div>
  );
}
