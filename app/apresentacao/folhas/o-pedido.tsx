"use client";

import { AgentOrb } from "@/modules/nexo/components/agent-orb/AgentOrb";

import type { Slide } from "../palco";
import { EscalaHorizontal, EscalaVertical, Leitura } from "../pecas";

/** BLOCO 6 — O PEDIDO (folhas 18 e 19). Texto e notas de 09/09/2026, sem alteração. */
export const O_PEDIDO: readonly Slide[] = [
  {
    rotulo: "O que pode vir",
    numero: "18",
    bloco: "O pedido",
    titulo: "O que pode vir depois",
    subtitulo:
      "Caminho, não promessa. Nada disto está pronto, e a ordem depende do que o uso real mostrar.",
    notas:
      "Deixar claro que é caminho, não promessa — nada aqui está pronto. O item que costuma acender o olho de quem projeta é o terceiro: a correção aplicada direto no arquivo editável.",
    corpo: (
      /* TRACEJADO = NÃO CONSTRUÍDO: a mesma escala das folhas 04 e 06, com a linha tracejada. */
      <EscalaHorizontal
        atraso={200}
        tracejada
        style={{ marginTop: 48 }}
        fatos={[
          {
            titulo: ["Conferência", "de quantidades"],
            texto:
              "Cruzar o que o memorial especifica com o que a planilha orça, e acusar o que não bate.",
          },
          {
            titulo: ["Leitura especializada", "por disciplina"],
            texto:
              "Um leitor treinado no vocabulário de cada disciplina, em vez de um leitor geral para todas.",
          },
          {
            titulo: ["Correção no", "arquivo editável"],
            texto:
              "A alteração aplicada direto no documento de origem, com você aprovando cada uma antes.",
          },
        ]}
      />
    ),
  },

  {
    rotulo: "O que ela não é",
    numero: "19",
    bloco: "O pedido",
    titulo: "O que esta ferramenta não é",
    notas:
      "Fechar por aqui é escolha: a última coisa que a sala ouve é o limite, dito por mim, e não uma promessa. Ler devagar e parar.\n\nO ORBE VOLTA — o mesmo da capa, do mesmo tamanho da folha do motor. É o deck fechando onde abriu, e não um enfeite: a sala viu o produto se apresentar sozinho na primeira folha, e o vê de novo quando eu digo o que ele não é.\n\nSe vier pergunta sobre valor depois disto, voltar à folha 17 e abrir o botão — o deck não termina no preço.",
    corpo: (
      <>
        <EscalaVertical
          atraso={200}
          style={{ flex: "none", height: 460 }}
          itens={[
            {
              titulo: "Ela não assume responsabilidade técnica.",
              texto:
                "Quem assina o projeto continua sendo quem responde por ele. O sistema aponta; a decisão é de quem põe o nome na capa.",
            },
            {
              titulo: "A IA erra, e vai errar.",
              texto:
                "Ela levanta o que parece não fechar. Parte disso não é erro nenhum, e é você quem separa uma coisa da outra.",
            },
            {
              titulo: "Ela não faz o trabalho no seu lugar.",
              texto:
                "O que ela devolve não é o projeto pronto: é o tempo que se gastaria procurando — e a chance de achar o que ninguém teve tempo de procurar.",
            },
          ]}
        />
        {/*
          O FECHO DO DECK É O ORBE E A LEITURA. O orbe é `compact` (198 px,
          medida fixa) — a mesma escala em que a folha do motor o mostrou, e o
          mesmo organismo vivo da capa. Ver a nota sobre `transform` na capa: o
          canvas mede a si mesmo, e não pode ser escalado por fora.
        */}
        <div
          style={{
            marginTop: "auto",
            display: "grid",
            gridTemplateColumns: "198px 1fr",
            columnGap: 64,
            alignItems: "end",
          }}
        >
          <div
            className="ap-surge"
            style={{
              width: 198,
              height: 198,
              display: "grid",
              placeItems: "center",
              animationDelay: "760ms",
              marginBottom: -8,
            }}
          >
            <AgentOrb size="compact" state="idle" />
          </div>
          <Leitura
            atraso={900}
            linhas={[
              { texto: "Uma segunda leitura que nunca se cansa," },
              { texto: "e que nunca assina no seu lugar.", chave: true },
            ]}
          />
        </div>
      </>
    ),
  },
];
