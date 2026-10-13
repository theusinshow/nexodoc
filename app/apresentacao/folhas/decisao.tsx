"use client";

import { ArrowUpRight, Check } from "lucide-react";

import { AgentOrb } from "@/modules/nexo/components/agent-orb/AgentOrb";

import type { Slide } from "../palco";
import { Entra, MONO } from "../pecas";

/**
 * CAPÍTULO 5 — O PILOTO E A DECISÃO (folhas 16 a 18). O piloto como
 * cronograma, a ponte para a proposta (sem preço nesta folha — a regra do
 * deck) e o pedido, que já diz as três decisões para começar. O checklist
 * que as repetia saiu em 13/10/2026.
 */

const BLOCO = "O piloto";

/* ═══════════════════════════════════════════════ o cronograma (17 e anexo C) */

export type LinhaDoCronograma = {
  rotulo: string;
  texto: string;
  /** Em meses, de 0 a `meses`. */
  de: number;
  ate: number;
  /** Marco: um losango em vez de barra. */
  marco?: boolean;
  forte?: boolean;
};

/**
 * O CRONOGRAMA em meses relativos — Mês 1 a Mês N, nunca datas: o calendário
 * nasce na reunião de início. Cada linha é uma frente; a barra cresce da
 * esquerda, na ordem em que as frentes começam.
 */
export function Cronograma({
  linhas,
  atraso,
  meses = 3,
}: {
  linhas: readonly LinhaDoCronograma[];
  atraso: number;
  meses?: number;
}) {
  const ROTULO = 300;
  const pct = (m: number) => (m / meses) * 100;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: `${ROTULO}px repeat(${meses}, 1fr)` }}>
        <span />
        {Array.from({ length: meses }, (_, m) => (
          <Entra
            key={m}
            atraso={atraso + m * 60}
            style={{ padding: "0 0 14px 12px", boxShadow: "inset 1px 0 0 var(--ds-line-subtle)", fontFamily: MONO, fontSize: 16, color: "var(--ds-text-tertiary)" }}
          >
            Mês {m + 1}
          </Entra>
        ))}
      </div>
      {linhas.map((l, i) => {
        const a = atraso + 400 + i * 260;
        return (
          <div
            key={l.rotulo}
            style={{ display: "grid", gridTemplateColumns: `${ROTULO}px 1fr`, alignItems: "center", minHeight: 96, boxShadow: "inset 0 1px 0 var(--ds-line-subtle)" }}
          >
            <Entra atraso={a}>
              <span style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.012em" }}>{l.rotulo}</span>
            </Entra>
            <div
              style={{
                position: "relative",
                height: 96,
                backgroundImage: "linear-gradient(90deg, var(--ds-line-subtle) 1px, transparent 1px)",
                backgroundSize: `calc(100% / ${meses}) 100%`,
              }}
            >
              {l.marco ? (
                <span
                  className="ap-assenta"
                  style={{
                    position: "absolute",
                    left: l.de >= meses ? "calc(100% - 22px)" : `calc(${pct(l.de)}% - 11px)`,
                    top: 37,
                    width: 22,
                    height: 22,
                    transform: "rotate(45deg)",
                    borderRadius: 3,
                    background: "var(--ds-p-paper)",
                    animationDelay: `${a + 100}ms`,
                  }}
                />
              ) : (
                <span
                  className="ap-risca"
                  style={{
                    position: "absolute",
                    left: `calc(${pct(l.de)}% + 6px)`,
                    width: `calc(${pct(l.ate - l.de)}% - 12px)`,
                    top: 26,
                    height: 16,
                    borderRadius: 999,
                    background: l.forte ? "#c9ccd4" : "#5b5f6b",
                    animationDelay: `${a + 100}ms`,
                  }}
                />
              )}
              {/*
                O TEXTO DA LINHA. Marco: ao lado do losango, no eixo. Barra:
                embaixo dela — e, quando a barra começa no último mês, o texto
                encosta pela direita no fim dela, senão vaza do palco.
              */}
              <Entra
                atraso={a + 300}
                style={{
                  position: "absolute",
                  ...(l.marco
                    ? l.de >= meses
                      ? { right: 36, top: 34, textAlign: "right" as const }
                      : { left: `calc(${pct(l.de)}% + 24px)`, top: 34 }
                    : l.de >= meses - 1 && l.de > 0
                      ? { right: `calc(${pct(meses - l.ate)}% + 6px)`, top: 52, textAlign: "right" as const }
                      : { left: `calc(${pct(l.de)}% + 6px)`, top: 52 }),
                  fontSize: 19,
                  lineHeight: "28px",
                  color: "var(--ds-text-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                {l.texto}
              </Entra>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════ folha 17: o botão da proposta */

/**
 * O único elemento clicável do deck abre a proposta em outra aba. É a ação
 * principal do app — a pílula de papel —, com a seta de "abre fora". O atributo
 * `data-abre-valores` é consumido pelo gerador da cópia offline.
 */
function BotaoDosValores() {
  return (
    <a
      href="/apresentacao/valores"
      target="_blank"
      rel="noreferrer"
      data-abre-valores=""
      className="ap-botao-valores"
    >
      Ver proposta e valor
      <ArrowUpRight aria-hidden="true" size={30} strokeWidth={2} />
    </a>
  );
}

const VISTO = ["O produto", "O problema", "Maturidade", "Objeções", "O piloto"];
const RESPONDE = [
  "O que entra no piloto",
  "O que o valor compra",
  "Que prova fica ao final",
  "O que decidir para começar",
];

/* ══════════════════════════════════════════════════════════════ AS FOLHAS */

export const DECISAO: readonly Slide[] = [
  {
    rotulo: "Como o piloto mede",
    numero: "16",
    bloco: BLOCO,
    titulo: "Três meses, três checkpoints",
    manchete: [
      { texto: "Ao fim, a decisão não depende de impressão.", fraca: true },
      "Depende da evidência produzida aqui.",
    ],
    notas:
      "A GOVERNANÇA ENTRA ANTES DO PREÇO. O cronograma está em meses relativos de propósito: não prometer datas que ainda não foram combinadas; os três checkpoints são estrutura, e o calendário nasce na reunião de início.\n\nNO INÍCIO: escolher um projeto, um responsável executivo e os usuários. Registrar a linha de base da montagem antes do primeiro uso.\n\nNO ACOMPANHAMENTO, as duas barras longas: quem projeta julga os achados; quem monta registra tempo, retrabalho e falhas. Problema recorrente recebe correção ou procedimento.\n\nNO FECHAMENTO: a diretoria recebe as duas medidas separadas e decide com evidência. O piloto não termina por inércia.",
    corpo: (
      <Cronograma
        atraso={300}
        linhas={[
          { rotulo: "Início", texto: "projeto, responsável, usuários e linha de base", de: 0, ate: 0, marco: true },
          { rotulo: "Conferência", texto: "quem projeta julga os achados, por disciplina", de: 0, ate: 3, forte: true },
          { rotulo: "Montagem", texto: "quem monta registra tempo, retrabalho, falhas e correções", de: 0, ate: 3, forte: true },
          { rotulo: "Fechamento", texto: "as duas medidas, separadas, para a diretoria", de: 3, ate: 3, marco: true },
        ]}
      />
    ),
  },

  {
    rotulo: "A proposta",
    numero: "17",
    bloco: BLOCO,
    titulo: "A proposta está separada",
    manchete: [
      { texto: "Produto provado de um lado.", fraca: true },
      "Decisão comercial do outro.",
    ],
    notas:
      "ESTA FOLHA NÃO ESCONDE O PREÇO: separa o argumento técnico da decisão comercial. Quando chegar aqui, abrir a proposta — não esperar que alguém peça. A reunião precisa terminar com uma decisão, e o valor faz parte dela.\n\nÀ ESQUERDA, o que a sala já viu; à direita, as quatro perguntas que a proposta responde: o que entra, o que os R$ 8 mil compram, que prova fica ao final e o que precisa ser decidido para começar.\n\nO BOTÃO ABRE EM ABA NOVA: clicar não perde o deck. Fechar com Ctrl+W devolve esta folha, ainda em tela cheia.",
    corpo: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "stretch" }}>
        <div style={{ paddingRight: 64 }}>
          <Entra atraso={300}>
            <span className="ap-rotulo">O que vocês viram</span>
          </Entra>
          <ul style={{ margin: "18px 0 0", padding: 0, listStyle: "none" }}>
            {VISTO.map((v, i) => (
              <li
                key={v}
                className="ap-entra"
                style={{ display: "grid", gridTemplateColumns: "40px 1fr", alignItems: "center", padding: "14px 0", boxShadow: "inset 0 1px 0 var(--ds-line-subtle)", fontSize: 26, animationDelay: `${420 + i * 110}ms` }}
              >
                <Check aria-hidden="true" size={22} strokeWidth={2} style={{ color: "var(--ds-state-ok)" }} />
                {v}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ paddingLeft: 64, boxShadow: "inset 1px 0 0 var(--ds-line-default)", display: "flex", flexDirection: "column" }}>
          <Entra atraso={1000}>
            <span className="ap-rotulo">O que a proposta responde</span>
          </Entra>
          <ul style={{ margin: "18px 0 0", padding: 0, listStyle: "none" }}>
            {RESPONDE.map((v, i) => (
              <li
                key={v}
                className="ap-entra"
                style={{ display: "grid", gridTemplateColumns: "40px 1fr", alignItems: "center", padding: "14px 0", boxShadow: "inset 0 1px 0 var(--ds-line-subtle)", fontSize: 26, color: "var(--ds-text-secondary)", animationDelay: `${1100 + i * 110}ms` }}
              >
                <span style={{ fontFamily: MONO, fontSize: 16, color: "var(--ds-text-tertiary)" }}>{i + 1}</span>
                {v}
              </li>
            ))}
          </ul>
          <Entra atraso={1700} style={{ marginTop: 40 }}>
            <BotaoDosValores />
          </Entra>
        </div>
      </div>
    ),
  },

  {
    rotulo: "A decisão",
    numero: "18",
    bloco: BLOCO,
    titulo: "A decisão",
    manchete: ["Aprovar o piloto de três meses."],
    lead: "Conferência e montagem, cada uma julgada pela evidência que lhe pertence.",
    notas:
      "ESTA É A ÚLTIMA TELA. O deck termina no pedido, não no limite, no roadmap ou na propriedade.\n\nDIZER: 'O que eu peço hoje é autorização para transformar estas duas provas em uso acompanhado por três meses. Se a resposta for sim, saímos daqui com o projeto inicial, o responsável e os usuários — e a próxima conversa já é de implantação.'\n\nDEPOIS, PARAR. Não preencher o silêncio com desconto, justificativa de custo ou promessa nova.\n\nSE A RESPOSTA FOR 'PRECISO PENSAR': perguntar qual evidência ainda falta para decidir. A objeção volta para o critério, não para uma defesa genérica do software.",
    corpo: (
      <div className="ap-grade" style={{ alignItems: "center" }}>
        <ol style={{ gridColumn: "1 / span 7", margin: 0, padding: 0, listStyle: "none", position: "relative" }}>
          {(
            [
              ["Escolher o projeto inicial.", "Um caso real, com começo e fim dentro do período."],
              ["Nomear o responsável.", "Quem recebe a evidência e responde pela decisão final."],
              ["Indicar quem vai usar.", "Quem confere julga; quem monta mede o trabalho."],
            ] as const
          ).map(([t, x], i) => (
            <li key={t} className="ap-entra" style={{ position: "relative", display: "grid", gridTemplateColumns: "72px 1fr", padding: "22px 0", animationDelay: `${500 + i * 200}ms` }}>
              {/* o fio liga este anel ao próximo, e para no último */}
              {i < 2 ? (
                <span aria-hidden="true" style={{ position: "absolute", left: 19.25, top: 66, bottom: -18, width: 1.5, background: "var(--ds-line-strong)" }} />
              ) : null}
              <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", background: "var(--ds-surface-page)", boxShadow: "inset 0 0 0 1.5px var(--ds-line-strong)", fontFamily: MONO, fontSize: 16, color: "var(--ds-text-secondary)" }}>
                {i + 1}
              </span>
              <span>
                <b style={{ display: "block", fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em" }}>{t}</b>
                <span className="ap-texto" style={{ display: "block", marginTop: 6 }}>{x}</span>
              </span>
            </li>
          ))}
        </ol>
        <div style={{ gridColumn: "9 / span 4", position: "relative", display: "grid", justifyItems: "center", gap: 36 }}>
          <div
            aria-hidden="true"
            className="ap-surge"
            style={{ position: "absolute", top: -120, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, color-mix(in srgb, var(--ds-nexo) 18%, transparent), transparent 64%)", filter: "blur(16px)", animationDelay: "900ms" }}
          />
          <div className="ap-surge" style={{ position: "relative", width: 198, height: 198, display: "grid", placeItems: "center", animationDelay: "1000ms" }}>
            <AgentOrb size="compact" state="idle" />
          </div>
          <Entra atraso={1300} style={{ position: "relative", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
              Se a resposta for sim, a próxima reunião é de implantação.
            </p>
          </Entra>
        </div>
      </div>
    ),
  },
];
