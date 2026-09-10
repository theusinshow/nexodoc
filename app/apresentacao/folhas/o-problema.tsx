"use client";

import type { Slide } from "../palco";
import {
  Contador,
  Entra,
  EscalaHorizontal,
  EscalaVertical,
  Leitura,
  Linhas,
  MONO,
} from "../pecas";

/** BLOCO 2 — O PROBLEMA (folhas 06 a 08). Texto e notas de 09/09/2026, sem alteração. */
export const O_PROBLEMA: readonly Slide[] = [
  {
    rotulo: "Conferência hoje",
    numero: "06",
    bloco: "O problema",
    titulo: "Como a conferência acontece hoje",
    notas:
      "A frase de fechamento é o eixo da apresentação: ela impede que a conversa vire 'quantas horas você economiza', discussão que não interessa travar. O que se propõe é um controle que hoje não existe, não um processo mais barato.\n\nOs três fatos chegam um de cada vez, com um respiro entre eles. Dizer cada um quando ele aparece — e não os três de uma vez.",
    corpo: (
      <>
        <EscalaHorizontal
          atraso={200}
          style={{ marginTop: 48 }}
          fatos={[
            { titulo: ["Cada projetista"], texto: "confere o próprio projeto" },
            {
              titulo: ["Sem tempo dedicado"],
              texto: "a conferência disputa espaço com a entrega",
            },
            {
              titulo: ["Uma a duas horas"],
              texto: "quando de fato acontece",
            },
          ]}
        />
        <Leitura
          atraso={1200}
          linhas={[
            { texto: "Isto não é um processo caro para substituir." },
            { texto: "É um controle que hoje não existe.", chave: true },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "Por que escapa",
    numero: "07",
    bloco: "O problema",
    titulo: "Por que escapa",
    notas:
      "A primeira causa desarma qualquer leitura de incompetência — e é importante dizê-la assim, porque quem está na sala assina esses projetos. A segunda mostra que o problema é do processo, não das pessoas.\n\nAs duas frases coloridas chegam por último, uma de cada lado: a vermelha é a consequência, a âmbar é a saída. Não ler as duas emendadas.",
    corpo: (
      <EscalaHorizontal
        atraso={200}
        style={{ marginTop: 48 }}
        fatos={[
          {
            titulo: [
              "Quem escreveu relê o que quis dizer,",
              "não o que ficou escrito.",
            ],
            texto:
              "Não é falta de competência: é como a leitura funciona. E a consequência é sempre a mesma — na prática, a primeira revisão de verdade só acontece quando o projeto já está na mão do cliente.",
            extra: (
              <p
                style={{
                  margin: 0,
                  paddingTop: 20,
                  borderTop: "1px solid var(--border)",
                  fontSize: 26,
                  lineHeight: 1.4,
                  color: "var(--status-critical)",
                }}
              >
                Quando isso acontece, quem revisa é quem contratou.
              </p>
            ),
          },
          {
            titulo: [
              "O modelo-padrão leva o mesmo defeito",
              "para todos os projetos.",
            ],
            texto:
              "O texto-base é reaproveitado de um projeto para o outro. Um erro nele não erra um projeto: erra todos, até que alguém finalmente o encontre.",
            extra: (
              <p
                style={{
                  margin: 0,
                  paddingTop: 20,
                  borderTop: "1px solid var(--border)",
                  fontSize: 26,
                  lineHeight: 1.4,
                  color: "var(--status-warning)",
                }}
              >
                Achado uma vez, corrigido uma vez, resolvido em todos.
              </p>
            ),
          },
        ]}
      />
    ),
  },

  {
    rotulo: "A conta",
    numero: "08",
    bloco: "O problema",
    titulo: "O que um erro desses custa",
    notas:
      "É AQUI que o episódio é narrado, agora que ele não tem folha própria: projeto devolvido, procuradoria acionada, três responsáveis parados três dias. Contar ANTES de avançar — a conta entra fator a fator, e cada fator é uma frase da história: três pessoas, três dias, oito horas. Só depois o total.\n\nA palavra estimativa fica visível na tela; se preferir, troque a faixa pelo valor real antes de apresentar. A coluna da direita chega por último e é o que fecha o slide: ler devagar e não insistir.",
    corpo: (
      <div className="ap-grade" style={{ flex: 1 }}>
        <div
          style={{
            gridColumn: "1 / span 7",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Entra atraso={120}>
            <span className="ap-mono-rotulo">A aritmética</span>
          </Entra>
          {/*
            A EQUAÇÃO ASSENTA FATOR A FATOR. Cada linha é um fato do episódio, e
            cada fato chega quando a fala chega nele. O total é o único número
            que CORRE: é a soma acontecendo na frente da sala.
          */}
          <div
            style={{
              marginTop: 20,
              fontFamily: MONO,
              fontSize: 60,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              color: "var(--foreground)",
            }}
          >
            <Linhas
              linhas={["3 responsáveis", "× 3 dias", "× 8 horas"]}
              atraso={300}
              passo={260}
            />
          </div>
          <Entra
            atraso={1100}
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
              fontFamily: MONO,
              fontSize: 60,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              color: "var(--foreground)",
            }}
          >
            ={" "}
            <Contador
              ate={72}
              atraso={1180}
              duracao={720}
              style={{ fontWeight: 500 }}
            />{" "}
            horas
          </Entra>
          <Entra atraso={1500}>
            <p
              style={{
                margin: "20px 0 0",
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
            atraso={1750}
            style={{
              paddingTop: 24,
              borderTop: "1px solid var(--nexodoc-accent)",
            }}
          >
            <span
              className="ap-mono-rotulo"
              style={{ display: "block", marginBottom: 16 }}
            >
              Só de horas paradas
            </span>
          </Entra>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 80,
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1,
              color: "var(--foreground)",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Linhas linhas={["R$ 3.600 a R$ 6.480"]} atraso={1900} />
          </div>
        </div>
        <div
          style={{
            gridColumn: "9 / span 4",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Entra atraso={2500}>
            <span
              className="ap-mono-rotulo"
              style={{ color: "var(--status-critical)" }}
            >
              O que não entra nessa conta
            </span>
          </Entra>
          <EscalaVertical
            atraso={2600}
            style={{ marginTop: 16 }}
            itens={[
              {
                titulo: "O desgaste com o cliente",
                texto:
                  "A entrega seguinte chega a uma mesa que já desconfia da anterior.",
              },
              {
                titulo: "A posição de quem apresentou",
                texto:
                  "Quem levou o projeto à reunião respondeu por um erro que não era só dele.",
              },
              {
                titulo: "A reputação que fica",
                texto:
                  "Dentro e fora da empresa, e por muito mais tempo do que os três dias.",
              },
            ]}
          />
        </div>
      </div>
    ),
  },
];
