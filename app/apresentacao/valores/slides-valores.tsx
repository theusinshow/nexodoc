"use client";

import type { Slide } from "../palco";
import {
  Contador,
  Entra,
  Linha,
  MONO,
  paragrafo,
  rotulo,
  secundario,
  Titulo,
} from "../pecas";

/**
 * OS VALORES — o piloto, o que ele custa e o preço, em seis folhas.
 *
 * POR QUE ESTÁ SEPARADA DO DECK. Preço não pode ser alcançado por uma seta a
 * mais no fim da apresentação. Estas folhas se abrem por um BOTÃO, na folha 17,
 * e só quando o apresentador decidir — a mão sai do teclado e vai ao mouse, e
 * essa fricção é a decisão sendo tomada de propósito.
 *
 * POR QUE NÃO É MAIS UM ARQUIVO SOLTO. Até 08/09/2026 isto vivia em
 * `docs/anexo-proposta.html`, que o `.dockerignore` exclui: existia numa
 * máquina só e nunca chegava a produção, que é de onde a apresentação de fato
 * roda. A rota devolve o alcance sem devolver o acidente.
 *
 * NUMERADAS A · B · C · D · E · F, e não 01..06. Um "01" aqui dentro faria isto
 * parecer o começo de outro deck; a letra diz que é anexo.
 *
 * A ORDEM É ESCOPO → CUSTOS → PREÇO, e ela não é arbitrária: quem chega aqui
 * clicou perguntando quanto custa, e a pior resposta possível é a cifra sozinha.
 * A vem antes porque diz o que está sendo comprado; B e C põem os dois custos
 * na mesa — operar e construir — antes de D pedir um número. As folhas B e C
 * vieram do deck em 09/09/2026: dinheiro é assunto do anexo, e o deck ficou com
 * o produto e as possíveis perguntas.
 *
 * A ÂNCORA DO PREÇO É A CONSTRUÇÃO, NUNCA O RETORNO MENSAL — e esta é a regra
 * que decide o conteúdo da folha E. A folha 12 do deck sustenta um teto de
 * licença de cerca de R$ 500 por mês; R$ 10.000 em seis meses é R$ 1.667 por
 * mês, 3,3 vezes esse teto. Pôr as duas contas lado a lado armaria o argumento
 * contra o próprio preço, com números do próprio autor. A folha E ancora onde a
 * folha C ancora em voz alta: o piloto não compra seis meses de acesso, compra
 * o que já está construído — e pede menos de metade disso.
 */

/** A grade das linhas da folha D: rótulo à esquerda, conteúdo à direita. */
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
    bloco: "Os valores",
    notas:
      "PRIMEIRA FOLHA DO ANEXO, e é assim de propósito: quem clicou o botão da folha 17 perguntou quanto custa, e a pior resposta possível é a cifra sozinha. Antes do número, o que está sendo comprado.\n\nO pedido é o julgamento de quem usar — sem ele, a única medida em aberto continua em aberto. Ler a coluna da direita devagar: é o que separa este piloto de um período de teste.\n\nNÃO ANTECIPAR O VALOR AQUI. Ele está três folhas adiante, e a sala chega lá em menos de um minuto.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 28 }}>Piloto de seis meses</Titulo>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div
            style={{
              flex: 1,
              paddingRight: 52,
              display: "flex",
              flexDirection: "column",
              gap: 26,
            }}
          >
            <Entra atraso={140}>
              <span style={rotulo}>O que entra</span>
              <p style={{ ...paragrafo, marginTop: 12 }}>
                Conferência de memorial descritivo e montagem de LDs, capas e
                volumes, com os usuários definidos junto com a diretoria.
              </p>
            </Entra>
            <Entra atraso={300}>
              <span style={rotulo}>O que eu entrego</span>
              <p style={{ ...paragrafo, marginTop: 12 }}>
                Acesso, acompanhamento próximo, correção dos problemas que
                aparecerem e o modelo-padrão de memorial corrigido.
              </p>
            </Entra>
            <Entra atraso={460}>
              <span style={rotulo}>Como saberemos se deu certo</span>
              <div style={{ marginTop: 10 }}>
                {[
                  "Nenhum achado com evidência que não exista no documento.",
                  "Precisão julgada por quem usou, disciplina por disciplina.",
                  "Listas e volumes reais montados sem perda de trabalho.",
                  "Custo mensal dentro do estimado.",
                ].map((t) => (
                  <p
                    key={t}
                    style={{ ...secundario, fontSize: 24, marginTop: 8 }}
                  >
                    {t}
                  </p>
                ))}
              </div>
            </Entra>
          </div>

          <div
            style={{
              flex: 1,
              paddingLeft: 52,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 22,
            }}
          >
            <Entra atraso={640}>
              <span style={{ ...rotulo, color: "var(--primary)" }}>
                O que eu peço em troca
              </span>
            </Entra>
            <Entra atraso={780}>
              <p
                style={{
                  margin: 0,
                  fontSize: 40,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.26,
                  color: "var(--foreground)",
                  textWrap: "pretty",
                }}
              >
                Que quem usar julgue cada achado: verdadeiro, duvidoso ou falso.
              </p>
            </Entra>
            <Entra atraso={920}>
              <p style={secundario}>
                É a peça que falta no produto. A planilha de julgamento já
                existe e está pronta para receber esse veredito — e é ele que
                transforma a única medida em aberto num número.
              </p>
            </Entra>
            <div className="ap-cresce" />
            <Entra
              atraso={1060}
              style={{ paddingTop: 26, borderTop: "1px solid var(--border)" }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 34,
                  fontWeight: 500,
                  letterSpacing: "-0.018em",
                  lineHeight: 1.3,
                  color: "var(--nexodoc-accent)",
                  textWrap: "pretty",
                }}
              >
                Seis meses de uso real dizem o que nenhuma apresentação diz.
              </p>
            </Entra>
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "Quanto custa",
    numero: "B",
    bloco: "Os valores",
    notas:
      "Deixar claro, com essas palavras, que a projeção é estimativa e varia com o uso. O número por execução é medido; o mensal depende de quantos documentos passarem. Atualizar a cotação do dólar antes de apresentar.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 10 }}>Quanto custa operar</Titulo>
        <Entra atraso={100}>
          <p style={{ ...secundario, margin: "0 0 30px" }}>
            O custo por execução é medido no próprio sistema. O total mensal é{" "}
            <span className="ap-premissa">estimativa</span> — varia com quantos
            documentos passarem.
          </p>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div style={{ width: 560, flex: "none", paddingRight: 56 }}>
            <Entra atraso={200}>
              <span style={rotulo}>Medido por execução</span>
            </Entra>
            <div style={{ marginTop: 16 }}>
              {[
                [
                  "Conferência de um memorial",
                  "US$ 1,50",
                  "218 páginas, leitura profunda",
                ],
                [
                  "Leitura de um selo de prancha",
                  "US$ 0,001",
                  "frações de centavo por folha",
                ],
              ].map(([o, quanto, nota], i) => (
                <Entra
                  key={o}
                  atraso={300 + i * 160}
                  style={{
                    padding: "20px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 20,
                    }}
                  >
                    <span style={{ fontSize: 26, color: "var(--foreground)" }}>
                      {o}
                    </span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 32,
                        color: "var(--nexodoc-accent)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {quanto}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontFamily: MONO,
                      fontSize: 21,
                      color: "#5f6b72",
                    }}
                  >
                    {nota}
                  </p>
                </Entra>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              paddingLeft: 56,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={620}>
              <span style={rotulo}>
                Estimativa mensal, no volume do escritório
              </span>
            </Entra>
            <div style={{ marginTop: 16, flex: 1 }}>
              {[
                ["Conferência de memoriais", "cerca de 16 por mês", "US$ 24"],
                [
                  "Montagem de listas e volumes",
                  "uso corrente",
                  "menos de US$ 1",
                ],
                ["Servidor", "infraestrutura", "US$ 25"],
                ["Banco de dados", "infraestrutura", "US$ 5"],
              ].map(([item, base, valor], i) => (
                <Entra
                  key={item}
                  atraso={720 + i * 120}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "baseline",
                    gap: "0 24px",
                    padding: "18px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 26,
                        color: "var(--foreground)",
                      }}
                    >
                      {item}
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontFamily: MONO,
                        fontSize: 21,
                        color: "#5f6b72",
                      }}
                    >
                      {base}
                    </p>
                  </div>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 28,
                      color: "var(--foreground)",
                    }}
                  >
                    {valor}
                  </span>
                </Entra>
              ))}
            </div>

            <Entra
              atraso={1180}
              style={{
                paddingTop: 22,
                borderTop: "1px solid var(--nexodoc-accent)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 20,
              }}
            >
              <span style={{ ...rotulo, fontSize: 24 }}>Ordem de grandeza</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 44,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "var(--nexodoc-accent)",
                }}
              >
                ≈ R$ 285 / mês
              </span>
            </Entra>
            <Entra atraso={1300}>
              <p className="ap-fonte">
                Convertido a{" "}
                <span className="ap-premissa">R$ 5,18 por dólar</span> —
                atualizar a cotação antes de apresentar.
              </p>
            </Entra>
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "O que custou construir",
    numero: "C",
    bloco: "Os valores",
    notas:
      "O gasto em dinheiro NAO e estimativa: sai do registro de uso do proprio sistema, chamada por chamada, e o painel administrativo mostra a mesma soma. A hora de desenvolvedor junior e o unico numero inventado desta folha, e a palavra estimativa fica na tela por isso. Se perguntarem por que a ferramenta de programacao entra na conta: porque sem ela este software nao existiria em seis meses, e ela continua sendo paga enquanto eu mantiver o produto.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 10 }}>O que custou construir</Titulo>
        <Entra atraso={100}>
          <p style={{ ...secundario, margin: "0 0 26px" }}>
            O gasto em dinheiro está medido no próprio sistema, chamada por
            chamada. O tempo é <span className="ap-premissa">estimativa</span> —
            e nenhuma dessas horas foi paga pela PROSUL.
          </p>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div
            style={{
              flex: 1.15,
              paddingRight: 52,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={200}>
              <span style={rotulo}>Em dinheiro — medido</span>
            </Entra>
            <div style={{ marginTop: 14, flex: 1 }}>
              {[
                ["Modelos de IA", "3.751 chamadas, três meses", "US$ 64"],
                [
                  "Ferramenta de programação",
                  "assinatura, seis meses",
                  "US$ 600",
                ],
                ["Servidor e domínio", "do período de construção", "US$ 26"],
              ].map(([item, base, valor], i) => (
                <Entra
                  key={item}
                  atraso={300 + i * 130}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "baseline",
                    gap: "0 24px",
                    padding: "17px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 26,
                        color: "var(--foreground)",
                      }}
                    >
                      {item}
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontFamily: MONO,
                        fontSize: 21,
                        color: "#5f6b72",
                      }}
                    >
                      {base}
                    </p>
                  </div>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 28,
                      color: "var(--foreground)",
                    }}
                  >
                    {valor}
                  </span>
                </Entra>
              ))}
            </div>
            <Entra
              atraso={720}
              style={{
                paddingTop: 18,
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 20,
              }}
            >
              <span style={{ ...rotulo, fontSize: 22 }}>Somado</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 34,
                  color: "var(--foreground)",
                }}
              >
                R$ 3.576
              </span>
            </Entra>
          </div>

          <div
            style={{
              flex: 1,
              paddingLeft: 52,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={820}>
              <span style={rotulo}>Em tempo — estimativa</span>
            </Entra>
            <Entra atraso={940} style={{ marginTop: 20 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 62,
                  fontWeight: 500,
                  letterSpacing: "-0.03em",
                  color: "var(--foreground)",
                }}
              >
                <Contador ate={700} atraso={1040} /> horas
              </span>
              <p style={{ ...secundario, fontSize: 24, marginTop: 8 }}>
                Noites e fins de semana, ao longo de seis meses.
              </p>
            </Entra>
            <Entra atraso={1160} style={{ marginTop: 22 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: MONO,
                  fontSize: 26,
                  color: "var(--muted-foreground)",
                }}
              >
                Hora de desenvolvedor júnior{" "}
                <span className="ap-premissa">(estimativa: R$ 30 a R$ 50)</span>
              </p>
            </Entra>
            <div className="ap-cresce" />
            <Entra
              atraso={1300}
              style={{ paddingTop: 18, borderTop: "1px solid var(--border)" }}
            >
              <span
                style={{
                  ...rotulo,
                  fontSize: 22,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Só de trabalho
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 40,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "var(--foreground)",
                  whiteSpace: "nowrap",
                }}
              >
                R$ 21.000 a R$ 35.000
              </span>
            </Entra>
          </div>
        </div>

        <Entra
          atraso={1460}
          style={{
            marginTop: 22,
            paddingTop: 22,
            borderTop: "1px solid var(--nexodoc-accent)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 40,
          }}
        >
          <p
            style={{
              margin: 0,
              maxWidth: "44ch",
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: "-0.018em",
              lineHeight: 1.28,
              color: "var(--nexodoc-accent)",
              textWrap: "pretty",
            }}
          >
            O piloto não compra seis meses de acesso. Compra o que já está
            construído.
          </p>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 44,
              fontWeight: 500,
              letterSpacing: "-0.025em",
              color: "var(--foreground)",
              whiteSpace: "nowrap",
            }}
          >
            R$ 24.600 a R$ 38.600
          </span>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "A proposta",
    numero: "D",
    bloco: "Os valores",
    notas:
      "Ler a folha inteira antes de falar do número. A linha que decide não é o valor, é a de baixo: ao fim dos seis meses, se não atender, encerra. É isso que tira o risco da mesa.\n\nSE PERGUNTAREM POR QUE SEIS E NÃO TRÊS: porque três meses não dão para um projeto inteiro passar pelo sistema, e sem projeto inteiro não há julgamento — sobra impressão.\n\nO PISO ESTÁ DECIDIDO e é este. Abaixo dele não se fecha na sala: dizer que leva para pensar, e levar mesmo. Nunca aceitar por alívio de a reunião estar acabando, que é como quase todo desconto acontece.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 28 }}>A proposta</Titulo>

        <Linha
          chave="Modalidade"
          valor="Licença de uso durante o piloto"
          atraso={120}
        />
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
          <p
            style={{
              margin: 0,
              fontSize: 27,
              lineHeight: 1.45,
              textWrap: "pretty",
            }}
          >
            Conferência de memorial descritivo e montagem de listas de
            documentos, capas e volumes. Acompanhamento próximo, correção dos
            problemas que aparecerem, e o modelo-padrão de memorial corrigido.
          </p>
        </Entra>

        <Entra atraso={560} style={LINHA_LARGA}>
          <span style={{ ...rotulo, fontSize: 22 }}>Não inclui</span>
          <p style={{ ...secundario, fontSize: 26 }}>
            Desenvolvimento de módulo novo sob demanda, leitura de PDF escaneado
            (OCR) e auditoria de prancha.
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
            Ao fim dos seis meses: se não atender, encerra. Se atender, a
            renovação é negociada com o que o uso real tiver mostrado.
          </p>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "De onde sai esse número",
    numero: "E",
    bloco: "Os valores",
    notas:
      "ESTA FOLHA NÃO DEFENDE O PREÇO, ELA O ANCORA. Nenhum dos três números da esquerda é novo: dois estão nas folhas B e C, aqui mesmo, e o do projeto devolvido veio da folha 12 do deck. O que esta folha faz é pô-los ao lado do pedido.\n\nNÃO TRAZER A CONTA DE RETORNO MENSAL para esta folha, nem de boca. Operar custa R$ 285 e o tempo devolvido paga até cerca de R$ 500 por mês; R$ 10.000 em seis meses dá R$ 1.667 por mês. Quem levantar essa aritmética na sala derruba o preço com o meu próprio número.\n\nSE ELE MESMO LEVANTAR, a resposta é a frase de baixo: o piloto não está comprando seis meses de acesso, está comprando o que já está construído — e mesmo que ninguém abra o sistema no sexto mês, o que foi entregue continua entregue.\n\nA ÚNICA ESTIMATIVA DESTA FOLHA é a hora de desenvolvedor júnior, e a palavra fica na tela por isso. Tudo o mais saiu do registro de uso do próprio sistema.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 10 }}>De onde sai esse número</Titulo>
        <Entra atraso={100}>
          <p style={{ ...secundario, margin: "0 0 30px" }}>
            Nada aqui é novo: os três números já passaram — dois nas duas folhas
            anteriores, o terceiro no deck. O que muda é que agora estão ao lado
            do pedido.
          </p>
        </Entra>

        <div style={{ flex: 1, display: "flex", gap: 0 }}>
          <div
            style={{
              flex: 1.1,
              paddingRight: 56,
              display: "flex",
              flexDirection: "column",
            }}
          >
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
                [
                  "Operar o sistema",
                  "por mês, no volume do escritório",
                  "R$ 285",
                ],
              ].map(([item, base, valor], i) => (
                <Entra
                  key={item}
                  atraso={300 + i * 160}
                  style={{
                    padding: "22px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 24,
                    }}
                  >
                    <span style={{ fontSize: 27, color: "var(--foreground)" }}>
                      {item}
                    </span>
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
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontFamily: MONO,
                      fontSize: 21,
                      color: "#5f6b72",
                    }}
                  >
                    {base}
                  </p>
                </Entra>
              ))}
            </div>
            <Entra atraso={800}>
              <p className="ap-fonte">
                A hora de desenvolvedor júnior é{" "}
                <span className="ap-premissa">estimativa (R$ 30 a R$ 50)</span>.
                Todo o resto saiu do registro de uso do próprio sistema.
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
          style={{
            marginTop: 22,
            paddingTop: 24,
            borderTop: "1px solid var(--nexodoc-accent)",
          }}
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
            O piloto não compra seis meses de acesso. Compra o que já está
            construído — e pede menos de metade do que custou construir.
          </p>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "Propriedade",
    numero: "F",
    bloco: "Os valores",
    notas:
      "UMA FRASE, SEM DEFENSIVA E SEM JUSTIFICATIVA LONGA. Explicar demais aqui parece culpa. Ler, parar, e deixar a sala reagir.\n\nSE VIER 'E O QUE DIZ O SEU CONTRATO DE TRABALHO?': o contrato foi lido, e não há cláusula de cessão sobre criação fora do expediente. Resposta de uma linha, sem alongar.\n\nA MOEDA DE TROCA, se travar aqui, é a CUSTÓDIA DO CÓDIGO — está disponível e vale PRAZO. Oferecê-la em troca de contrato mais longo, nunca de desconto.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 28 }}>Propriedade</Titulo>

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
            O NexoDoc é de autoria e propriedade de Matheus Mendes, desenvolvido
            fora do vínculo empregatício, em equipamento, tempo e licenças
            próprios.
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
