"use client";

import type { Slide } from "../palco";
import { Entra, EscalaHorizontal, Leitura, Linhas, MONO } from "../pecas";

/**
 * A PROVA DA MONTAGEM E A PONTE PARA A PROPOSTA (folhas 12 e 17).
 * A conferência já tem prova de campo na folha 05. A montagem recebe aqui uma
 * prova operacional própria, sem transformar o que o piloto ainda precisa
 * medir em promessa.
 */

/**
 * O único elemento clicável do deck abre a proposta em outra aba. O atributo
 * `data-abre-valores` é consumido pelo gerador da cópia offline.
 */
function BotaoDosValores() {
  return (
    <a
      href="/apresentacao/valores"
      target="_blank"
      rel="noreferrer"
      data-abre-valores=""
      className="ap-botao-valores nx-cut-6"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 18,
        padding: "24px 40px",
        border: "1px solid var(--nexodoc-accent)",
        background: "rgb(0 166 147 / 0.10)",
        fontSize: 32,
        fontWeight: 500,
        letterSpacing: "-0.018em",
        color: "var(--nexodoc-accent)",
        textDecoration: "none",
      }}
    >
      Ver proposta e valor
      <span style={{ fontFamily: MONO, fontSize: 30 }} aria-hidden="true">
        →
      </span>
    </a>
  );
}

export const O_DINHEIRO_12: Slide = {
  rotulo: "Prova da montagem",
  numero: "12",
  bloco: "A prova",
  titulo: "Montagem: a prova operacional",
  notas:
    "ESTA É A PROVA DA SEGUNDA CAPACIDADE, SEPARADA DA CONFERÊNCIA. Não chamar de prova de campo: o que existe hoje é prova operacional do fluxo, sustentada pelo produto, pelos testes e pela trilha de rascunho e eventos.\n\nO QUE JÁ ESTÁ PROVADO: ler selos, organizar linhas e tomos, acusar faltas e divergências, preservar o rascunho e gerar os arquivos finais. O checklist do banco piloto registrou um rascunho e dezessete eventos; isso prova rastreabilidade, não adoção.\n\nO QUE AINDA NÃO ESTÁ PROVADO aparece na leitura final: tempo real devolvido, estabilidade no uso contínuo e aceitação dos arquivos por quem monta. Não preencher essa lacuna com a conta das dezesseis horas; ela era hipótese de processo, não medição de uso.",
  corpo: (
    <>
      <EscalaHorizontal
        atraso={200}
        style={{ marginTop: 48 }}
        fatos={[
          {
            titulo: ["Do selo", "à lista"],
            texto:
              "Lê os campos das pranchas, organiza linhas e tomos e mostra a origem do que veio da IA, do sistema ou de correção manual.",
          },
          {
            titulo: ["Freios antes", "da entrega"],
            texto:
              "Aponta folha faltante, duplicidade e divergência de total antes que a lista seja fechada.",
          },
          {
            titulo: ["Saída e", "rastreabilidade"],
            texto:
              "Preserva rascunho e eventos e gera ODT, PDF e ZIP para conferência e entrega.",
          },
        ]}
      />
      <Leitura
        atraso={1100}
        rotuloDo="O piloto precisa medir"
        linhas={[
          { texto: "tempo real, estabilidade e aceitação dos arquivos —" },
          { texto: "sem chamar hipótese de resultado.", chave: true },
        ]}
      />
    </>
  ),
};

export const O_DINHEIRO_17: Slide = {
  rotulo: "A proposta",
  numero: "17",
  bloco: "O dinheiro",
  titulo: "A proposta está separada",
  notas:
    "ESTA FOLHA NÃO ESCONDE O PREÇO: separa o argumento técnico da decisão comercial. Quando chegar aqui, abrir a proposta — não esperar que alguém peça. A reunião precisa terminar com uma decisão, e o valor faz parte dela.\n\nO BOTÃO ABRE EM ABA NOVA: clicar não perde o deck. Fechar com Ctrl+W devolve esta folha, ainda em tela cheia.\n\nA PROPOSTA responde quatro perguntas: o que entra, o que os R$ 10 mil compram, que prova fica ao final e o que precisa ser decidido para começar.",
  corpo: (
    <div className="ap-grade">
      <div style={{ gridColumn: "1 / span 8" }}>
        <p className="ap-titulo-de-fato">
          <Linhas
            linhas={[
              "Produto provado de um lado.",
              "Decisão comercial do outro.",
            ]}
            atraso={160}
          />
        </p>
        <Entra atraso={360}>
          <p className="ap-texto" style={{ marginTop: 24, fontSize: 28 }}>
            A proposta abre o escopo, o acompanhamento e a evidência que o
            piloto precisa deixar — antes de mostrar o preço.
          </p>
        </Entra>
        <Entra atraso={560} style={{ marginTop: 48 }}>
          <BotaoDosValores />
        </Entra>
      </div>
    </div>
  ),
};
