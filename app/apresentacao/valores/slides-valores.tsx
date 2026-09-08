"use client";

import type { Slide } from "../palco";
import { Entra, Linha, MONO, rotulo, secundario } from "../pecas";

/**
 * OS VALORES — a proposta comercial, em três folhas.
 *
 * POR QUE ESTÁ SEPARADA DO DECK. Preço não pode ser alcançado por uma seta a
 * mais no fim da apresentação. Estas folhas se abrem por um BOTÃO, na folha 21,
 * e só quando o apresentador decidir — a mão sai do teclado e vai ao mouse, e
 * essa fricção é a decisão sendo tomada de propósito.
 *
 * POR QUE NÃO É MAIS UM ARQUIVO SOLTO. Até 08/09/2026 isto vivia em
 * `docs/anexo-proposta.html`, que o `.dockerignore` exclui: existia numa
 * máquina só e nunca chegava a produção, que é de onde a apresentação de fato
 * roda. A rota devolve o alcance sem devolver o acidente.
 *
 * NUMERADAS A · B · C, e não 01..03. Um "01" aqui dentro faria isto parecer o
 * começo de outro deck; a letra diz que é anexo.
 *
 * A ÂNCORA DO PREÇO É A CONSTRUÇÃO, NUNCA O RETORNO MENSAL — e esta é a regra
 * que decide o conteúdo da folha B. A folha 14 do deck sustenta um teto de
 * licença de cerca de R$ 500 por mês; R$ 10.000 em seis meses é R$ 1.667 por
 * mês, 3,3 vezes esse teto. Pôr as duas contas lado a lado armaria o argumento
 * contra o próprio preço, com números do próprio autor. A folha B ancora onde a
 * folha 13 já ancorou em voz alta: o piloto não compra seis meses de acesso,
 * compra o que já está construído — e pede menos de metade disso.
 */

/** A grade das linhas da folha A: rótulo à esquerda, conteúdo à direita. */
const LINHA_LARGA = {
  display: "grid",
  gridTemplateColumns: "340px 1fr",
  gap: "0 48px",
  alignItems: "baseline",
  padding: "24px 0",
  borderTop: "1px solid var(--border)",
} as const;

export const VALORES: readonly Slide[] = [
  {
    rotulo: "O piloto",
    numero: "A",
    denso: true,
    bloco: "Os valores",
    notas:
      "Ler a folha inteira antes de falar do número. A linha que decide não é o valor, é a de baixo: ao fim dos seis meses, se não atender, encerra. É isso que tira o risco da mesa.\n\nSE PERGUNTAREM POR QUE SEIS E NÃO TRÊS: porque três meses não dão para um projeto inteiro passar pelo sistema, e sem projeto inteiro não há julgamento — sobra impressão.\n\nO PISO ESTÁ DECIDIDO e é este. Abaixo dele não se fecha na sala: dizer que leva para pensar, e levar mesmo. Nunca aceitar por alívio de a reunião estar acabando, que é como quase todo desconto acontece.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 28 }}>
            O piloto
          </h2>
        </Entra>

        <Linha chave="Modalidade" valor="Licença de uso durante o piloto" atraso={120} />
        <Linha chave="Prazo" valor="6 meses" atraso={220} />

        <Entra atraso={320} style={LINHA_LARGA}>
          <span style={{ ...rotulo, fontSize: 22 }}>Valor</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 56,
              fontWeight: 500,
              letterSpacing: "-0.025em",
              color: "var(--nexodoc-accent)",
            }}
          >
            R$ 10.000
          </span>
        </Entra>

        <Entra atraso={440} style={LINHA_LARGA}>
          <span style={{ ...rotulo, fontSize: 22 }}>Inclui</span>
          <p style={{ margin: 0, fontSize: 27, lineHeight: 1.45, textWrap: "pretty" }}>
            Conferência de memorial descritivo e montagem de listas de documentos, capas e volumes.
            Acompanhamento próximo, correção dos problemas que aparecerem, e o modelo-padrão de
            memorial corrigido.
          </p>
        </Entra>

        <Entra atraso={560} style={LINHA_LARGA}>
          <span style={{ ...rotulo, fontSize: 22 }}>Não inclui</span>
          <p style={{ ...secundario, fontSize: 26 }}>
            Desenvolvimento de módulo novo sob demanda, leitura de PDF escaneado (OCR) e auditoria
            de prancha.
          </p>
        </Entra>

        <div className="ap-cresce" />

        <Entra atraso={700}>
          <p
            style={{
              margin: 0,
              maxWidth: "56ch",
              paddingTop: 30,
              borderTop: "1px solid var(--nexodoc-accent)",
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: "-0.018em",
              lineHeight: 1.3,
              color: "var(--nexodoc-accent)",
              textWrap: "pretty",
            }}
          >
            Ao fim dos seis meses: se não atender, encerra. Se atender, a renovação é negociada com
            o que o uso real tiver mostrado.
          </p>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "De onde sai esse número",
    numero: "B",
    denso: true,
    bloco: "Os valores",
    notas:
      "ESTA FOLHA NÃO DEFENDE O PREÇO, ELA O ANCORA. Os três números da esquerda já passaram pelo deck e nenhum é novo aqui: o diretor os viu nas folhas 12, 13 e 14. O que a folha faz é pô-los ao lado do pedido.\n\nNÃO TRAZER A CONTA DE RETORNO MENSAL para esta folha, nem de boca. Operar custa R$ 285 e o tempo devolvido paga até cerca de R$ 500 por mês; R$ 10.000 em seis meses dá R$ 1.667 por mês. Quem levantar essa aritmética na sala derruba o preço com o meu próprio número.\n\nSE ELE MESMO LEVANTAR, a resposta é a frase de baixo: o piloto não está comprando seis meses de acesso, está comprando o que já está construído — e mesmo que ninguém abra o sistema no sexto mês, o que foi entregue continua entregue.\n\nA ÚNICA ESTIMATIVA DESTA FOLHA é a hora de desenvolvedor júnior, e a palavra fica na tela por isso. Tudo o mais saiu do registro de uso do próprio sistema.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 10 }}>
            De onde sai esse número
          </h2>
        </Entra>
        <Entra atraso={100}>
          <p style={{ ...secundario, margin: "0 0 30px" }}>
            Nada aqui é novo: os três números já passaram pelo deck. O que muda é que agora estão ao
            lado do pedido.
          </p>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div style={{ flex: 1.1, paddingRight: 56, display: "flex", flexDirection: "column" }}>
            <Entra atraso={200}>
              <span style={rotulo}>O que já foi gasto</span>
            </Entra>
            <div style={{ marginTop: 16, flex: 1 }}>
              {[
                [
                  "Construir o que vocês viram",
                  "R$ 3.576 em dinheiro, medido, mais 700 horas",
                  "R$ 24.600 a 38.600",
                ],
                [
                  "O projeto devolvido",
                  "só as horas paradas que deu para somar",
                  "R$ 3.600 a 6.480",
                ],
                ["Operar o sistema", "por mês, no volume do escritório", "R$ 285"],
              ].map(([item, base, valor], i) => (
                <Entra
                  key={item}
                  atraso={300 + i * 160}
                  style={{ padding: "22px 0", borderTop: "1px solid var(--border)" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 24,
                    }}
                  >
                    <span style={{ fontSize: 27, color: "var(--foreground)" }}>{item}</span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 30,
                        color: "var(--foreground)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {valor}
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontFamily: MONO, fontSize: 21, color: "#5f6b72" }}>
                    {base}
                  </p>
                </Entra>
              ))}
            </div>
            <Entra atraso={800}>
              <p className="ap-fonte">
                A hora de desenvolvedor júnior é{" "}
                <span className="ap-premissa">estimativa (R$ 30 a R$ 50)</span>. Todo o resto saiu
                do registro de uso do próprio sistema.
              </p>
            </Entra>
          </div>

          <div
            style={{
              flex: 1,
              paddingLeft: 56,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Entra atraso={900}>
              <span style={rotulo}>O que está sendo pedido</span>
            </Entra>
            <Entra atraso={1020} style={{ marginTop: 20 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 88,
                  fontWeight: 500,
                  letterSpacing: "-0.035em",
                  lineHeight: 1,
                  color: "var(--nexodoc-accent)",
                }}
              >
                R$ 10.000
              </span>
              <p style={{ ...secundario, fontSize: 26, marginTop: 12 }}>
                por seis meses de licença de uso.
              </p>
            </Entra>
          </div>
        </div>

        <Entra
          atraso={1180}
          style={{ marginTop: 22, paddingTop: 24, borderTop: "1px solid var(--nexodoc-accent)" }}
        >
          <p
            style={{
              margin: 0,
              maxWidth: "60ch",
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: "-0.018em",
              lineHeight: 1.28,
              color: "var(--nexodoc-accent)",
              textWrap: "pretty",
            }}
          >
            O piloto não compra seis meses de acesso. Compra o que já está construído — e pede menos
            de metade do que custou construir.
          </p>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "Propriedade",
    numero: "C",
    bloco: "Os valores",
    notas:
      "UMA FRASE, SEM DEFENSIVA E SEM JUSTIFICATIVA LONGA. Explicar demais aqui parece culpa. Ler, parar, e deixar a sala reagir.\n\nSE VIER 'E O QUE DIZ O SEU CONTRATO DE TRABALHO?': o contrato foi lido, e não há cláusula de cessão sobre criação fora do expediente. Resposta de uma linha, sem alongar.\n\nA MOEDA DE TROCA, se travar aqui, é a CUSTÓDIA DO CÓDIGO — está disponível e vale PRAZO. Oferecê-la em troca de contrato mais longo, nunca de desconto.",
    corpo: (
      <>
        <Entra atraso={0}>
          <h2 className="ap-titulo" style={{ marginBottom: 28 }}>
            Propriedade
          </h2>
        </Entra>

        <div className="ap-cresce" />

        <Entra atraso={160}>
          <p
            style={{
              margin: 0,
              maxWidth: "40ch",
              fontSize: 46,
              fontWeight: 500,
              letterSpacing: "-0.022em",
              lineHeight: 1.3,
              color: "var(--foreground)",
              textWrap: "pretty",
            }}
          >
            O NexoDoc é de autoria e propriedade de Matheus Mendes, desenvolvido fora do vínculo
            empregatício, em equipamento, tempo e licenças próprios.
          </p>
        </Entra>

        <div className="ap-cresce" />

        <Entra atraso={520}>
          <p
            style={{
              margin: 0,
              maxWidth: "56ch",
              paddingTop: 30,
              borderTop: "1px solid var(--nexodoc-accent)",
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: "-0.018em",
              lineHeight: 1.3,
              color: "var(--nexodoc-accent)",
              textWrap: "pretty",
            }}
          >
            O que se propõe aqui é licença de uso.
          </p>
        </Entra>
      </>
    ),
  },
];
