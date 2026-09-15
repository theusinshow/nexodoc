"use client";

import type { Slide } from "../palco";
import { EscalaHorizontal, EscalaVertical, MONO } from "../pecas";

/** BLOCO 3 — O QUE EXISTE (folhas 09 a 11). */

/** As quatro linhas de cada bloco da folha 11, sobre linhas finas. */
function LinhasDoBloco({ linhas }: { linhas: readonly string[] }) {
  return (
    <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
      {linhas.map((l) => (
        <li
          key={l}
          style={{
            padding: "12px 0",
            borderTop: "1px solid var(--border)",
            fontSize: 26,
            lineHeight: 1.4,
            color: "var(--muted-foreground)",
            textWrap: "pretty",
          }}
        >
          {l}
        </li>
      ))}
    </ul>
  );
}

export const O_QUE_EXISTE: readonly Slide[] = [
  {
    rotulo: "Limites",
    numero: "09",
    bloco: "O que existe",
    titulo: "O que ele ainda não faz bem",
    notas:
      "Dito por você, antes de perguntarem. Este slide compra mais credibilidade que qualquer outro do deck. Não amaciar nenhum item — principalmente o do excesso, que é o que o usuário vai sentir no primeiro dia.\n\nO EXCESSO, NO 117_25 (a corrida da folha 05), para quem pedir exemplo: a própria validação contestou 5 regras e as deixou registradas no parecer — uma delas acusava de divergente o nome CERTO da obra (p. 215). E 2 dos 56 o parecer já descreve como não sendo erro (p. 38, 'terminologia aceitável'; p. 62, 'falso positivo de escopo'). É isso que o 'você vai descartar parte' quer dizer.\n\nSE PERGUNTAREM DA VARIAÇÃO com número: a corrida de agosto do mesmo memorial deu 28, mas no nível padrão e com outro modelo. Não é a mesma leitura repetida, e NÃO serve de prova deste item — dizer que a medida de variação vem de rodar o mesmo nível duas vezes.",
    corpo: (
      <EscalaVertical
        atraso={200}
        itens={[
          {
            titulo: "Peca pelo excesso.",
            texto:
              "Prefere apontar demais a deixar passar, e parte do que levanta você vai descartar. É assim de propósito: achado a mais custa um minuto de leitura, achado a menos custa o que custou naquele projeto.",
            cor: "var(--status-warning)",
          },
          {
            titulo: "A lista varia entre execuções.",
            texto:
              "Rodando o mesmo documento duas vezes, o total fica estável, mas os achados de borda entram e saem.",
          },
          {
            titulo: "A precisão ainda não foi julgada por quem projeta.",
            texto:
              "É a única medida em aberto, e depende do veredito de vocês. É exatamente isso que estou pedindo no piloto.",
          },
          {
            titulo: "Não audita prancha.",
            texto:
              "Hoje o alvo é o memorial descritivo e a documentação de identidade do projeto.",
          },
        ]}
      />
    ),
  },

  {
    rotulo: "Segurança",
    numero: "10",
    bloco: "O que existe",
    titulo: "O que protege o documento",
    notas:
      "O slide que responde 'e se vazar?'. O primeiro item é decisão de projeto, não limitação — dizer com essas palavras.\n\nSobre 'a IA aprende com os nossos projetos?': separar as duas coisas na fala. O modelo NÃO aprende — ele vem pronto de fora e o conteúdo enviado não alimenta treinamento pela política da API. O que aprende é o sistema, e só pelo que vocês corrigirem: falso positivo, gravidade errada e achado que faltou viram medida de qualidade e ajuste de regra dentro da nossa base, sem sair para o provedor.\n\nCUIDADO — ESTA É A FOLHA QUE CONVIDA 'mostra esse painel de custo aí'. A demonstração sai de produção, e a tela de uso de IA de lá lista modelos sem preço, onde hoje aparece uma chave antiga em texto puro. Ou limpar essas linhas antes do dia, ou abrir o custo POR OBRA e não a tela de uso por modelo.",
    corpo: (
      <div className="ap-grade" style={{ flex: 1 }}>
        <div
          style={{
            gridColumn: "1 / span 6",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <EscalaVertical
            atraso={200}
            itens={[
              {
                titulo: "O PDF anexado não é armazenado.",
                texto:
                  "Ele é lido e descartado. Para reprocessar, o arquivo é reenviado — decisão de projeto, não limitação.",
              },
              {
                titulo: "Nenhum documento de vocês treina o modelo.",
                texto:
                  "A inteligência vem pronta de fora e não muda com o que a PROSUL manda: pela política da API usada, o conteúdo enviado não alimenta treinamento. O memorial é lido, respondido e esquecido.",
              },
              {
                titulo: "Quem ensina o sistema é o feedback, não o documento.",
                texto:
                  "Quando alguém marca um achado como falso positivo ou aponta o que faltou, isso vira medida de qualidade e ajuste de regra aqui dentro — fica na PROSUL e não sai para lugar nenhum.",
              },
            ]}
          />
        </div>
        <div
          style={{
            gridColumn: "7 / span 6",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <EscalaVertical
            atraso={700}
            inicio={4}
            itens={[
              {
                titulo: "Acesso nominal, por login corporativo.",
                texto:
                  "Cada pessoa entra com a própria conta, com papel de administrador ou membro. Desativar alguém corta o acesso na hora.",
              },
              {
                titulo: "Todo acesso e todo gasto ficam registrados.",
                texto:
                  "Provedor, modelo, duração e custo de cada execução, com custo por obra no painel.",
              },
              {
                titulo: "Teto de gasto mensal.",
                texto:
                  "Ao ser atingido, o sistema recusa a chamada em vez de continuar gastando.",
              },
            ]}
          />
        </div>
      </div>
    ),
  },

  {
    rotulo: "O que existe hoje",
    numero: "11",
    bloco: "O que existe",
    titulo: "O que já existe e funciona",
    notas:
      "DOIS CAMINHOS, DUAS PROVAS. A conferência já foi medida num memorial real; a montagem já prova o fluxo operacional, mas ainda precisa de uso real para medir tempo, estabilidade e aceitação. Não nivelar as duas maturidades — dizer a diferença aumenta a credibilidade.\n\nAs cores são as dos dois ramos do motor: teal confere, âmbar monta. A folha seguinte abre a prova operacional da montagem sem repetir a demonstração da conferência.",
    corpo: (
      <EscalaHorizontal
        atraso={200}
        style={{ marginTop: 40 }}
        fatos={[
          {
            titulo: ["Conferência de", "memorial descritivo"],
            cor: "var(--nexodoc-accent)",
            texto: (
              <span
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  background: "var(--status-ok-bg)",
                  fontFamily: MONO,
                  fontSize: 20,
                  letterSpacing: "0.05em",
                  color: "var(--status-ok)",
                }}
              >
                Medido em projeto real
              </span>
            ),
            extra: (
              <LinhasDoBloco
                linhas={[
                  "Lê o memorial inteiro e aponta o que não fecha",
                  "Cada achado com a página e a transcrição do trecho",
                  "Separa o que impede emitir do que é decisão técnica",
                  "Compara documentos entre si",
                ]}
              />
            ),
          },
          {
            titulo: ["Montagem de LDs,", "capas e volumes"],
            cor: "var(--status-warning)",
            texto: (
              <span
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  background: "var(--nexodoc-raised)",
                  fontFamily: MONO,
                  fontSize: 20,
                  letterSpacing: "0.05em",
                  color: "var(--muted-foreground)",
                }}
              >
                Prova operacional
              </span>
            ),
            extra: (
              <LinhasDoBloco
                linhas={[
                  "Lê os selos das pranchas e monta a lista de documentos",
                  "Acusa folha faltante, duplicada e divergência de total",
                  "Preserva rascunho, tomos e a trilha de eventos",
                  "Gera ODT, PDF e ZIP para conferência",
                ]}
              />
            ),
          },
        ]}
      />
    ),
  },
];
