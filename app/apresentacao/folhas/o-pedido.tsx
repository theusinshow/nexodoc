"use client";

import { AgentOrb } from "@/modules/nexo/components/agent-orb/AgentOrb";

import type { Slide } from "../palco";
import {
  Entra,
  EscalaHorizontal,
  EscalaVertical,
  Leitura,
  Linhas,
} from "../pecas";

/** O fechamento do deck: preparar a decisão e pedi-la sem rodeios. */
export const O_PEDIDO: readonly Slide[] = [
  {
    rotulo: "Para começar",
    numero: "18",
    bloco: "A decisão",
    titulo: "O que precisa ficar decidido",
    notas:
      "ESTA FOLHA TRANSFORMA INTERESSE EM IMPLANTAÇÃO. Não sair da reunião apenas com concordância abstrata. Os três itens podem ser decididos ali ou receber dono e prazo.\n\nPROJETO: escolher um trabalho real que atravesse conferência e montagem. Se nenhum projeto servir aos dois caminhos, escolher um para cada prova e manter as medidas separadas.\n\nRESPONSÁVEL: alguém da diretoria precisa responder pelo resultado, e não só pelo acesso.\n\nUSUÁRIOS: quem confere julga achados; quem monta registra tempo, retrabalho e aceitação dos arquivos. Sem essas pessoas, a evidência não nasce.",
    corpo: (
      <>
        <EscalaHorizontal
          atraso={180}
          style={{ marginTop: 48 }}
          fatos={[
            {
              titulo: ["Projeto", "de entrada"],
              texto:
                "Um trabalho real que permita observar conferência e montagem sem criar um caso artificial.",
            },
            {
              titulo: ["Responsável", "executivo"],
              texto:
                "Uma pessoa com autoridade para remover bloqueios e receber a evidência do piloto.",
            },
            {
              titulo: ["Quem confere", "e quem monta"],
              texto:
                "Usuários que julgam achados, registram o trabalho e dizem se os arquivos podem ser usados.",
            },
          ]}
        />
        <Leitura
          atraso={1160}
          linhas={[
            { texto: "Sem projeto e sem responsáveis, não existe piloto." },
            { texto: "Existe só acesso ao sistema.", chave: true },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "A decisão",
    numero: "19",
    bloco: "A decisão",
    titulo: "A decisão",
    notas:
      "ESTA É A ÚLTIMA TELA. O deck termina no pedido, não no limite, no roadmap ou na propriedade.\n\nDIZER: 'O que eu peço hoje é autorização para transformar estas duas provas em uso acompanhado por seis meses. Se a resposta for sim, saímos daqui com o projeto inicial, o responsável e os usuários — e a próxima conversa já é de implantação.'\n\nDEPOIS, PARAR. Não preencher o silêncio com desconto, justificativa de custo ou promessa nova.\n\nSE A RESPOSTA FOR 'PRECISO PENSAR': perguntar qual evidência ainda falta para decidir. A objeção volta para o critério, não para uma defesa genérica do software.",
    corpo: (
      <div className="ap-grade" style={{ flex: 1 }}>
        <div
          style={{
            gridColumn: "1 / span 6",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Entra atraso={100}>
            <span className="ap-mono-rotulo">O pedido</span>
          </Entra>
          <p
            className="ap-titulo-de-fato"
            style={{ marginTop: 24, fontSize: 72, lineHeight: 1.06 }}
          >
            <Linhas
              linhas={["Aprovar o piloto", "de seis meses."]}
              atraso={240}
            />
          </p>
          <Entra atraso={520} style={{ marginTop: 36 }}>
            <p className="ap-texto" style={{ fontSize: 30 }}>
              Conferência e montagem, cada uma julgada pela evidência que lhe
              pertence.
            </p>
          </Entra>
          <div
            className="ap-surge"
            style={{
              width: 198,
              height: 198,
              display: "grid",
              placeItems: "center",
              animationDelay: "780ms",
              marginTop: "auto",
            }}
          >
            <AgentOrb size="compact" state="idle" />
          </div>
        </div>
        <div
          style={{
            gridColumn: "8 / span 5",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <EscalaVertical
            atraso={420}
            style={{ flex: "none", height: 420 }}
            itens={[
              {
                titulo: "Escolher o projeto inicial.",
                texto: "Um caso real, com começo e fim dentro do período.",
              },
              {
                titulo: "Nomear o responsável.",
                texto: "Quem recebe a evidência e responde pela decisão final.",
              },
              {
                titulo: "Indicar quem vai usar.",
                texto: "Quem confere julga; quem monta mede o trabalho.",
              },
            ]}
          />
          <Leitura
            atraso={1080}
            rotuloDo="Próximo passo"
            linhas={[
              { texto: "Se a resposta for sim," },
              { texto: "a próxima reunião é de implantação.", chave: true },
            ]}
          />
        </div>
      </div>
    ),
  },
];
