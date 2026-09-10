"use client";

import type { Slide } from "../palco";
import { Entra, EscalaVertical, Linhas, MONO } from "../pecas";

/**
 * BLOCO 4 — O DINHEIRO (folhas 12 e 17). Texto e notas de 09/09/2026, sem
 * alteração. A 17 é a única folha do deck com um elemento clicável.
 */

/**
 * O BOTÃO QUE ABRE OS VALORES.
 *
 * É o único elemento clicável do deck inteiro, e isso é o ponto. O preço não
 * pode ser alcançado por avançar a seta — a decisão de mostrá-lo tem que custar
 * um gesto, e tirar a mão do teclado para ir ao mouse é esse gesto.
 *
 * ABA NOVA, e não navegação. Voltar na mesma aba devolveria o deck na folha 01.
 * Com `_blank`, `Ctrl+W` traz de volta a folha certa, ainda em tela cheia.
 *
 * `data-abre-valores` NÃO É ENFEITE: é por ele que o gerador da cópia offline
 * acha este link para trocar o endereço por um salto interno. Sem o atributo, o
 * arquivo do pen drive sai com um link morto — e isso só se descobriria na sala,
 * sem rede. O gerador falha se o atributo sumir.
 */
function BotaoDosValores() {
  return (
    <a
      href="/apresentacao/valores"
      target="_blank"
      rel="noreferrer"
      data-abre-valores=""
      className="nx-cut-6"
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
      Abrir os valores
      <span style={{ fontFamily: MONO, fontSize: 30 }} aria-hidden="true">
        →
      </span>
    </a>
  );
}

export const O_DINHEIRO_12: Slide = {
  rotulo: "Como ela se paga",
  numero: "12",
  bloco: "O dinheiro",
  titulo: "Como ela se paga",
  notas:
    "DE ONDE SAI O R$ 285: a folha que abria essa conta saiu do deck em 09/09/2026 e vive na folha B do anexo. Se perguntarem como se chega nele, abrir o botão da folha 17 em vez de improvisar a conta de cabeça.\n\nESTA FOLHA NAO DISPUTA ARITMETICA, DE PROPOSITO. A versao anterior valorizava as 16 horas de montagem a hora de engenheiro e caia com uma frase: quem monta lista de documentos nao ganha hora de engenheiro. A hora de tecnico derruba a conta inteira, e o argumento nao pode depender de um numero que a sala refuta de cabeca.\n\nO TETO DE LICENCA SAIU DA TELA e vive aqui: com a operacao em R$ 285, uma licenca ate cerca de R$ 500 por mes se paga so no tempo devolvido. NAO OFERECER esse numero. O diretor vai calcula-lo sozinho, e um numero que ele deduz vale mais que um que eu concedo.\n\nOS DOIS NÚMEROS DE BAIXO SÃO A FRASE INTEIRA, sem razão escrita entre eles: o pequeno é o que custa operar, o grande é o que o episódio custou — e a sala faz a divisão sozinha. O terceiro bloco de cima e o mais forte do deck inteiro e nao tem numero nenhum. Ler devagar e parar.",
  corpo: (
    <>
      <EscalaVertical
        atraso={200}
        style={{ flex: "none", height: 540 }}
        itens={[
          {
            titulo: "Em tempo que volta para o projeto.",
            texto:
              "Quatro projetos por mês, até quatro horas de montagem manual cada. São dezesseis horas que ninguém precisa gastar abrindo prancha por prancha — e que voltam para quem deveria estar projetando.",
          },
          {
            titulo: "Em qualidade do que sai daqui.",
            texto:
              "O projeto que chega ao cliente já passou por uma leitura que hoje não acontece. Não é uma revisão a mais: é a primeira.",
          },
          {
            titulo: "E em vergonha não passada.",
            texto:
              "Este é o retorno que não entra em planilha nenhuma, e é o único que a sala inteira já viu de perto. Um projeto devolvido não custa só as horas paradas que a folha da conta somou.",
          },
        ]}
      />
      {/*
        OS DOIS NÚMEROS no lugar da leitura: o pequeno ao lado do grande, sem
        razão escrita (o spec de 24/08 proíbe disputar aritmética). Grade de
        duas linhas para os rótulos ficarem na mesma altura e os números na
        mesma linha de base, ainda que um tenha 60 px e o outro 96.
      */}
      <div
        style={{
          marginTop: "auto",
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gridTemplateRows: "auto auto",
          columnGap: 96,
          rowGap: 16,
          alignItems: "baseline",
          paddingTop: 32,
          borderTop: "1px solid var(--nexodoc-accent)",
        }}
      >
        <Entra atraso={900}>
          <span className="ap-mono-rotulo">Operar, por mês</span>
        </Entra>
        <Entra atraso={1200}>
          <span className="ap-mono-rotulo">
            O episódio que já aconteceu — só a parte que deu para somar
          </span>
        </Entra>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 60,
            letterSpacing: "-0.025em",
            lineHeight: 1,
            color: "var(--muted-foreground)",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Linhas linhas={["R$ 285"]} atraso={1000} />
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 96,
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            color: "var(--nexodoc-accent)",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Linhas linhas={["R$ 3.600 a R$ 6.480"]} atraso={1300} />
        </div>
      </div>
    </>
  ),
};

export const O_DINHEIRO_17: Slide = {
  rotulo: "Quanto custa usar",
  numero: "17",
  bloco: "O dinheiro",
  titulo: "Quanto custa usar",
  notas:
    "ESTA FOLHA NÃO TEM CIFRA, E ISSO É O DESENHO. Ela existe para que o preço esteja ao alcance da mão sem estar na tela: se ninguém perguntar, ela passa em dez segundos e o deck fecha no limite, que é onde ele sempre fechou.\n\nO BLOCO VOLTA A SER 'O DINHEIRO' de propósito, depois das possíveis perguntas. A sala percebe que a conversa mudou de assunto antes de eu dizer.\n\nO BOTÃO ABRE EM ABA NOVA: clicar não perde o deck. Fechar com Ctrl+W devolve esta folha, ainda em tela cheia.\n\nQUANDO CLICAR: quando alguém perguntar o valor, ou quando eu tiver decidido que a sala está pronta. Não clicar por reflexo de estar numa folha que tem botão — a folha funciona sem ser clicada, e passar por ela sem abrir é uma escolha legítima.\n\nO PISO CONTINUA SENDO seis meses por R$ 10.000. Abaixo disso não se fecha na sala.",
  corpo: (
    <div className="ap-grade">
      <div style={{ gridColumn: "1 / span 7" }}>
        <p className="ap-titulo-de-fato">
          <Linhas linhas={["O valor não está neste deck."]} atraso={160} />
        </p>
        <Entra atraso={320}>
          <p className="ap-texto" style={{ marginTop: 20, fontSize: 28 }}>
            Ele está numa página separada, com a conta que o sustenta. Eu abro
            agora, se você quiser ver.
          </p>
        </Entra>
        <Entra atraso={520} style={{ marginTop: 48 }}>
          <BotaoDosValores />
        </Entra>
      </div>
    </div>
  ),
};
