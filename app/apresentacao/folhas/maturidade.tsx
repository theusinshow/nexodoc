"use client";

import {
  Check,
  Cloud,
  FileText,
  KeyRound,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  ScanText,
} from "lucide-react";

import type { Slide } from "../palco";
import {
  Diagrama,
  Entra,
  Fio,
  MONO,
  No,
  Particula,
  Selo,
  type TomDoSelo,
} from "../pecas";

/**
 * CAPÍTULO 3 — MATURIDADE (folhas 10 a 12): o que ele não faz bem, o que
 * protege o documento e onde cada caminho está. Desde 13/10/2026 as três
 * folhas que repetiam "duas capacidades, duas provas" (o que existe, a prova
 * da montagem e a escala) são uma só: a escala.
 * Cada folha mostra o ESTADO de alguma coisa — e estado, no sistema, é selo,
 * tabela e escala, não parágrafo.
 */

const BLOCO = "Maturidade";

const icone = (I: typeof Check) => <I size={22} strokeWidth={1.75} />;

/* ════════════════════════════════════════════════ folha 10: os limites */

const LIMITES: ReadonlyArray<readonly [TomDoSelo, string, string, string]> = [
  [
    "decide",
    "Por desenho",
    "Peca pelo excesso.",
    "Prefere apontar demais a deixar passar, e parte do que levanta você vai descartar. Achado a mais custa um minuto de leitura; achado a menos custa o que custou naquele projeto.",
  ],
  [
    "neutro",
    "Conhecido",
    "A lista varia entre execuções.",
    "Rodando o mesmo documento duas vezes, o total fica estável, mas os achados de borda entram e saem.",
  ],
  [
    "linha",
    "Em aberto",
    "A precisão ainda não foi julgada por quem projeta.",
    "É a única medida em aberto, e depende do veredito de vocês. É exatamente isso que estou pedindo no piloto.",
  ],
  [
    "neutro",
    "Fora do alvo",
    "Não audita prancha.",
    "Hoje o alvo é o memorial descritivo e a documentação de identidade do projeto.",
  ],
];

/* ═════════════════════════════════════════ folha 12: escala de maturidade */

const ESTAGIOS = [
  "O fluxo existe e roda",
  "Rodou em obra real",
  "Medido no uso do escritório",
  "Julgado por quem usa",
];

function Trilha({
  nome,
  ate,
  selo,
  detalhe,
  mede,
  atraso,
}: {
  nome: string;
  /** Quantos estágios a capacidade já cumpriu. */
  ate: number;
  selo: { tom: TomDoSelo; texto: string };
  detalhe: string;
  /** O que o piloto mede nesta capacidade: mora dentro da caixa tracejada. */
  mede: string;
  atraso: number;
}) {
  const fim = `${(ate / ESTAGIOS.length) * 100}%`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", alignItems: "center", minHeight: 150, boxShadow: "inset 0 1px 0 var(--ds-line-subtle)" }}>
      <Entra atraso={atraso}>
        <p style={{ margin: 0, fontSize: 34, fontWeight: 500, letterSpacing: "-0.025em" }}>{nome}</p>
      </Entra>
      <div style={{ position: "relative", height: 150 }}>
        {/* o caminho todo, tracejado: aonde a capacidade ainda pode chegar */}
        <span
          aria-hidden="true"
          className="ap-surge"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 46,
            height: 0,
            borderTop: "2px dashed rgb(255 255 255 / 0.14)",
            animationDelay: `${atraso}ms`,
          }}
        />
        {/* o que já foi cumprido, cheio */}
        <span
          aria-hidden="true"
          className="ap-risca"
          style={{
            position: "absolute",
            left: 0,
            width: fim,
            top: 40,
            height: 14,
            borderRadius: 999,
            background: "#c9ccd4",
            animationDelay: `${atraso + 200}ms`,
          }}
        />
        <span
          aria-hidden="true"
          className="ap-assenta"
          style={{
            position: "absolute",
            left: `calc(${fim} - 13px)`,
            top: 34,
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--ds-text-primary)",
            boxShadow: "0 0 0 6px var(--ds-surface-page)",
            animationDelay: `${atraso + 900}ms`,
          }}
        />
        <Entra
          atraso={atraso + 1000}
          style={{ position: "absolute", left: 0, top: 78, display: "flex", alignItems: "center", gap: 16 }}
        >
          <Selo tom={selo.tom}>{selo.texto}</Selo>
          <span style={{ fontSize: 18, color: "var(--ds-text-tertiary)", whiteSpace: "nowrap" }}>{detalhe}</span>
        </Entra>
        <Entra
          atraso={atraso + 1700}
          style={{ position: "absolute", left: "calc(50% + 28px)", top: 78, fontSize: 19, color: "var(--ds-text-secondary)", whiteSpace: "nowrap" }}
        >
          {mede}
        </Entra>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ AS FOLHAS */

export const MATURIDADE: readonly Slide[] = [
  {
    rotulo: "Limites",
    numero: "10",
    bloco: BLOCO,
    titulo: "Limites",
    manchete: [
      { texto: "Dito antes de perguntarem:", fraca: true },
      "o que ele ainda não faz bem.",
    ],
    notas:
      "Dito por você, antes de perguntarem. Este slide compra mais credibilidade que qualquer outro do deck. Não amaciar nenhum item — principalmente o do excesso, que é o que o usuário vai sentir no primeiro dia.\n\nOS SELOS DIZEM O ESTADO de cada limite: o excesso é por desenho, a variação é conhecida, a precisão está em aberto — e é a que o piloto mede —, a prancha está fora do alvo.\n\nO EXCESSO, NO 117_25 (a corrida da folha 05), para quem pedir exemplo: a própria validação contestou 5 regras e as deixou registradas no parecer — uma delas acusava de divergente o nome CERTO da obra (p. 215). E 2 dos 56 o parecer já descreve como não sendo erro (p. 38, 'terminologia aceitável'; p. 62, 'falso positivo de escopo'). É isso que o 'você vai descartar parte' quer dizer.\n\nSE PERGUNTAREM DA VARIAÇÃO com número: a corrida de agosto do mesmo memorial deu 28, mas no nível padrão e com outro modelo. Não é a mesma leitura repetida, e NÃO serve de prova deste item — dizer que a medida de variação vem de rodar o mesmo nível duas vezes.",
    corpo: (
      <table className="ap-tabela ap-surge" style={{ animationDelay: "300ms" }}>
        <thead>
          <tr>
            <th style={{ width: 230 }}>Estado</th>
            <th style={{ width: 560 }}>Limite</th>
            <th>O que isso quer dizer</th>
          </tr>
        </thead>
        <tbody>
          {LIMITES.map(([tom, estado, limite, texto], i) => (
            <tr key={limite} className="ap-entra" style={{ animationDelay: `${480 + i * 180}ms` }}>
              <td>
                <Selo tom={tom}>{estado}</Selo>
              </td>
              <td>
                <b style={{ fontSize: 26, letterSpacing: "-0.012em" }}>{limite}</b>
              </td>
              <td style={{ fontSize: 21 }}>{texto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },

  {
    rotulo: "Segurança",
    numero: "11",
    bloco: BLOCO,
    titulo: "O que protege o documento",
    manchete: [
      "O documento fica guardado e cifrado,",
      { texto: "e só abre para a PROSUL.", fraca: true },
    ],
    notas:
      "O slide que responde 'e se vazar?'. Acompanhar o desenho: o arquivo entra e segue dois caminhos. Para cima, o texto vai ao provedor do modelo só para ser lido e volta como resposta; pela política da API usada, não alimenta treinamento. Para baixo, o arquivo fica no cofre do NexoDoc.\n\nO COFRE, SE PERGUNTAREM: memorial, pranchas e arquivos gerados ficam guardados cifrados (desde 09/10/2026; o que entrou antes disso foi guardado sem a cifra). O armazenamento é privado: não existe link que abra o arquivo fora do sistema, e o sistema só o entrega a quem é do escritório dono. É isso que deixa abrir o achado na página a partir de um e-mail, e o volume sem reenviar as pranchas.\n\nSobre 'a IA aprende com os nossos projetos?': separar as duas coisas na fala. O modelo NÃO aprende — ele vem pronto de fora. O que aprende é o sistema, e só pelo que vocês corrigirem: falso positivo, gravidade errada e achado que faltou viram ajuste de regra dentro da nossa base, sem sair para o provedor.\n\nFORA DA TELA, SE PERGUNTAREM DE CUSTO: há teto de gasto mensal; atingido, o sistema recusa a chamada em vez de gastar. Se pedirem o painel, abrir o custo POR OBRA.",
    corpo: (
      <Diagrama
        largura={1680}
        altura={600}
        fios={
          <>
            <Fio d="M 250 300 L 325 300 L 325 145 L 400 145" atraso={700} seta={{ x: 400, y: 145, dir: "direita" }} />
            <Fio d="M 325 300 L 325 415 L 400 415" atraso={1000} tom="ok" seta={{ x: 400, y: 415, dir: "direita" }} />
            <Fio d="M 740 120 L 1300 120" atraso={1500} seta={{ x: 1300, y: 120, dir: "direita" }} />
            <Fio d="M 1300 172 L 740 172" atraso={2000} seta={{ x: 740, y: 172, dir: "esquerda" }} />
          </>
        }
      >
        {/* a fronteira: tudo aqui dentro é do NexoDoc, e só a PROSUL abre */}
        <div
          className="ap-surge"
          style={{
            position: "absolute",
            left: 360,
            top: 0,
            width: 800,
            height: 600,
            borderRadius: 26,
            background: "rgb(255 255 255 / 0.018)",
            outline: "1.5px dashed var(--ds-line-strong)",
            outlineOffset: -1.5,
            animationDelay: "200ms",
          }}
        >
          <span style={{ position: "absolute", left: 28, top: 20, fontSize: 18, fontWeight: 500, color: "var(--ds-text-tertiary)" }}>
            Dentro do NexoDoc, só para a PROSUL
          </span>
        </div>
        <Particula d="M 250 300 L 325 300 L 325 145 L 400 145 L 740 120 L 1300 120" atraso={3000} duracao={1900} />
        <Particula d="M 1300 172 L 740 172" atraso={4600} duracao={1100} />

        <No x={0} y={250} largura={250} altura={100} atraso={400} icone={icone(FileText)} titulo="Memorial e pranchas" />
        <No x={400} y={70} largura={340} altura={145} atraso={800} variante="nexo" icone={icone(ScanText)}
          titulo="Leitura" texto="o texto vai ao modelo só para ser lido" />
        <No x={400} y={330} largura={340} altura={170} atraso={1100} icone={<LockKeyhole size={22} strokeWidth={1.75} style={{ color: "var(--ds-state-ok)" }} />}
          titulo="Cofre cifrado" texto="o arquivo fica guardado; abre só pelo sistema, para o escritório dono" />
        <No x={1300} y={60} largura={380} altura={180} atraso={1300} icone={icone(Cloud)}
          titulo="Provedor do modelo" texto="a inteligência vem pronta de fora; pela política da API, o conteúdo não alimenta treinamento" />

        <Entra atraso={1500} style={{ position: "absolute", left: 740, width: 560, top: 84, textAlign: "center", fontSize: 17, color: "var(--ds-text-tertiary)" }}>
          texto para leitura
        </Entra>
        <Entra atraso={2000} style={{ position: "absolute", left: 740, width: 560, top: 184, textAlign: "center", fontSize: 17, color: "var(--ds-text-tertiary)" }}>
          resposta
        </Entra>

        <div style={{ position: "absolute", left: 790, top: 260, width: 340 }}>
          {(
            [
              [KeyRound, "Acesso nominal", "login corporativo; desativar alguém corta o acesso na hora"],
              [MessageSquareText, "Aprende só com vocês", "falso positivo e o que faltou viram ajuste de regra aqui dentro"],
              [ListChecks, "Tudo registrado", "provedor, modelo, duração e custo de cada execução, por obra"],
            ] as const
          ).map(([I, t, x], i) => (
            <div
              key={t}
              className="ap-entra"
              style={{ padding: "16px 0", boxShadow: i ? "inset 0 1px 0 var(--ds-line-subtle)" : undefined, animationDelay: `${2600 + i * 180}ms` }}
            >
              <p className="ap-no__titulo" style={{ fontSize: 21 }}>
                <I size={20} strokeWidth={1.75} />
                {t}
              </p>
              <p className="ap-no__texto" style={{ marginTop: 4, fontSize: 17 }}>{x}</p>
            </div>
          ))}
        </div>
      </Diagrama>
    ),
  },

  {
    rotulo: "Onde cada um está",
    numero: "12",
    bloco: BLOCO,
    titulo: "Onde cada caminho está",
    manchete: [
      { texto: "Os dois caminhos já rodaram em obra real.", fraca: true },
      "O piloto mede o que só o uso do escritório mostra.",
    ],
    notas:
      "UMA FOLHA SÓ PARA A MATURIDADE, e ela é uma escala. As duas trilhas chegaram ao mesmo degrau — rodar em obra real — por provas diferentes; não nivelar o que cada uma provou.\n\nNA CONFERÊNCIA, a prova é a corrida da folha 05: o 117-25 inteiro, 218 páginas, 56 achados, 5,4 minutos, US$ 1,61. Na folha seguinte vem a segunda prova, o 129-24 contra outra IA.\n\nNA MONTAGEM, a prova é o 084-25 (a EMEB de Criciúma): o estrutural montado em 6 tomos, com capa e LD de cada um, a partir das pranchas reais. Isso prova que o fluxo atravessa uma obra inteira — não prova tempo devolvido nem aceitação dos arquivos.\n\nAPONTAR A CAIXA TRACEJADA: os dois últimos degraus são o que o piloto mede, e o que se mede está escrito dentro dela, uma linha por caminho. Dizer a manchete devagar: a proposta compra a evidência que só o uso do escritório pode dar.",
    corpo: (
      <div style={{ position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr" }}>
          <span />
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${ESTAGIOS.length}, 1fr)` }}>
            {ESTAGIOS.map((e, i) => (
              <Entra key={e} atraso={300 + i * 120} style={{ padding: "22px 28px 20px", boxShadow: "inset 1px 0 0 var(--ds-line-subtle)" }}>
                <span style={{ fontFamily: MONO, fontSize: 15, color: "var(--ds-text-tertiary)" }}>{i + 1}</span>
                <p style={{ margin: "6px 0 0", fontSize: 21, fontWeight: 500, color: "var(--ds-text-secondary)" }}>{e}</p>
              </Entra>
            ))}
          </div>
        </div>
        <Trilha
          nome="Conferência"
          ate={2}
          selo={{ tom: "ok", texto: "Medida em obra real" }}
          detalhe="117-25: 218 páginas, 56 achados, 5,4 min"
          mede="a precisão, julgada por disciplina"
          atraso={900}
        />
        <Trilha
          nome="Montagem"
          ate={2}
          selo={{ tom: "ok", texto: "Rodou em obra real" }}
          detalhe="084-25: estrutural em 6 tomos, com capa e LD"
          mede="o tempo devolvido e a aceitação dos arquivos"
          atraso={1500}
        />
        {/* o que o piloto mede: os dois últimos degraus, nas duas trilhas */}
        <div
          className="ap-surge"
          style={{
            position: "absolute",
            left: `calc(260px + (100% - 260px) / 2 + 10px)`,
            right: -10,
            top: 0,
            bottom: -18,
            borderRadius: 22,
            outline: "1.5px dashed rgb(255 255 255 / 0.32)",
            outlineOffset: -1.5,
            animationDelay: "2600ms",
          }}
        >
          <span style={{ position: "absolute", right: 22, bottom: 16, fontSize: 19, fontWeight: 500, color: "var(--ds-text-primary)" }}>
            o que o piloto mede
          </span>
        </div>
      </div>
    ),
  },
];
