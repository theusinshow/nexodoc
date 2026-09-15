"use client";

import type { ReactNode } from "react";

import type { Slide } from "../palco";
import {
  Confronto,
  EscalaHorizontal,
  Leitura,
  MONO,
} from "../pecas";

/** Quatro folhas de credibilidade: medida, diferenciação, continuidade e método. */

function ListaDeProva({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 20,
        borderTop: "1px solid var(--border)",
        fontFamily: MONO,
        fontSize: 22,
        lineHeight: 1.55,
        color: "var(--muted-foreground)",
      }}
    >
      {children}
    </div>
  );
}

export const POSSIVEIS_PERGUNTAS: readonly Slide[] = [
  {
    rotulo: "Duas provas",
    numero: "13",
    bloco: "A medição",
    titulo: "Duas capacidades, duas provas",
    notas:
      "ESTA FOLHA CORRIGE A PRINCIPAL AMBIGUIDADE DO DECK. A conferência tem prova de campo; a montagem tem prova operacional. Nenhuma das duas recebe uma maturidade que ainda não conquistou.\n\nNA CONFERÊNCIA, os números são de uma única corrida profunda do 117_25, gravada em 14/09/2026. O piloto não precisa provar que o sistema encontra texto: precisa medir a precisão do julgamento por disciplina.\n\nNA MONTAGEM, o fluxo e as saídas existem. O piloto precisa medir se o trabalho real fica mais rápido, se o rascunho permanece estável e se os arquivos finais são aceitos.\n\nDizer a última frase devagar: a proposta compra a produção da evidência que só o uso do escritório pode dar.",
    corpo: (
      <>
        <EscalaHorizontal
          atraso={160}
          style={{ marginTop: 36 }}
          fatos={[
            {
              titulo: ["Conferência", "prova de campo"],
              cor: "var(--nexodoc-accent)",
              texto:
                "Um memorial real, com página, transcrição, gravidade, tempo e custo registrados na mesma execução.",
              extra: (
                <ListaDeProva>
                  218 páginas · 56 candidatos · 5,4 min · US$ 1,61
                  <br />
                  11 classificados como impeditivos de emissão
                </ListaDeProva>
              ),
            },
            {
              titulo: ["Montagem", "prova operacional"],
              cor: "var(--status-warning)",
              texto:
                "Leitura de selos, freios de consistência, rascunho rastreável e arquivos finais já existem no produto.",
              extra: (
                <ListaDeProva>
                  ODT · PDF · ZIP · tomos · histórico de eventos
                  <br />
                  Falta medir tempo, estabilidade e aceitação no uso real
                </ListaDeProva>
              ),
            },
          ]}
        />
        <Leitura
          atraso={1160}
          linhas={[
            { texto: "O piloto não prova que o produto existe." },
            { texto: "Prova se ele merece ficar.", chave: true },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "Por que não o ChatGPT",
    numero: "14",
    bloco: "Possíveis perguntas",
    titulo: "Por que não só o ChatGPT",
    notas:
      "ESTA É UMA DAS DUAS OBJEÇÕES QUE MERECEM TELA. Não brigar com o ChatGPT: ele está dentro do sistema. O valor está no processo ao redor do modelo e na montagem que um chat não entrega.\n\nSE VIER 'o modelo vai melhorar e tornar isto obsoleto': melhor modelo melhora o NexoDoc por dentro. O que permanece é página, evidência, regra, validação, histórico, freios e arquivo final.\n\nSE VIER 'então me venda só as regras': regras sozinhas encontram menos e não têm a segunda passada que contesta o que não se sustenta.",
    corpo: (
      <Confronto
        pergunta="Por que não assinamos o ChatGPT e mandamos alguém jogar o PDF lá?"
        respostas={[
          [
            "O modelo é uma peça, não é o processo.",
            "O NexoDoc preserva página e transcrição, aplica regras verificáveis, valida cada achado contra o documento e registra o resultado por obra.",
          ],
          [
            "Metade do trabalho não é conversa.",
            "Lista de documentos, tomos, folha faltante, selo divergente, ODT, PDF e ZIP são montagem de arquivo — não uma resposta de chat.",
          ],
        ]}
        leitura={[
          { texto: "Quando o modelo melhora, ele melhora aqui dentro." },
          {
            texto: "O que vocês compram é o processo ao redor dele.",
            chave: true,
          },
        ]}
      />
    ),
  },

  {
    rotulo: "Continuidade",
    numero: "15",
    bloco: "Continuidade",
    titulo: "O que não depende de confiança",
    notas:
      "A SEGUNDA OBJEÇÃO QUE MERECE TELA É CONTINUIDADE. Responder com artefato e contrato, não com promessa pessoal.\n\nOS ARQUIVOS FINAIS pertencem à PROSUL. O histórico preserva dados, linhas, tomos e eventos; os PDFs originais não são armazenados e precisam ser reenviados para reprocessar — essa limitação já foi dita na segurança.\n\nA CUSTÓDIA DO CÓDIGO continua disponível apenas numa relação de prazo longo. Não oferecê-la por desconto.\n\nA propriedade aparece aqui, em uma frase, antes do fechamento comercial. Não terminar o anexo com ela.",
    corpo: (
      <Confronto
        titulo={["Continuidade se prova", "com o que fica escrito."]}
        linhaFina="Não com a expectativa de que uma pessoa estará disponível para sempre."
        respostas={[
          [
            "Os arquivos produzidos ficam com vocês.",
            "Parecer, lista de documentos, capa, volume, ODT, PDF e ZIP continuam utilizáveis fora do sistema.",
          ],
          [
            "A operação precisa de regra contratual.",
            "Prazo de resposta, vigência, suporte e encerramento são condições do contrato — não boa vontade.",
          ],
          [
            "Autoria e licença não se confundem.",
            "O NexoDoc é propriedade de Matheus Mendes. O piloto compra licença de uso e acompanhamento; custódia de código é negociação de longo prazo.",
          ],
        ]}
        leitura={[
          { texto: "Continuidade não é acreditar em uma pessoa." },
          { texto: "É saber o que fica com a empresa.", chave: true },
        ]}
      />
    ),
  },

  {
    rotulo: "Como o piloto mede",
    numero: "16",
    bloco: "O piloto",
    titulo: "Seis meses, três checkpoints",
    notas:
      "A GOVERNANÇA ENTRA ANTES DO PREÇO. Não prometer datas que ainda não foram combinadas; os três checkpoints são estrutura, e o calendário nasce na reunião de início.\n\nNO INÍCIO: escolher um projeto, um responsável executivo e os usuários. Registrar a linha de base da montagem antes do primeiro uso.\n\nNO ACOMPANHAMENTO: quem projeta julga os achados; quem monta registra tempo, retrabalho e falhas. Problema recorrente recebe correção ou procedimento.\n\nNO FECHAMENTO: a diretoria recebe as duas medidas separadas e decide com evidência. O piloto não termina por inércia.",
    corpo: (
      <>
        <EscalaHorizontal
          atraso={180}
          style={{ marginTop: 48 }}
          fatos={[
            {
              titulo: ["Início"],
              texto:
                "Definir projeto, responsável, usuários e a linha de base do trabalho manual.",
            },
            {
              titulo: ["Acompanhamento"],
              texto:
                "Julgar achados por disciplina e registrar tempo, retrabalho, falhas e correções da montagem.",
            },
            {
              titulo: ["Fechamento"],
              texto:
                "Entregar as duas medidas separadas: qualidade da conferência e resultado operacional da montagem.",
            },
          ]}
        />
        <Leitura
          atraso={1180}
          linhas={[
            { texto: "Ao fim, a decisão não depende de impressão." },
            { texto: "Depende da evidência produzida aqui.", chave: true },
          ]}
        />
      </>
    ),
  },
];
