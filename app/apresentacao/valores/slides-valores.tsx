"use client";

import type { Slide } from "../palco";
import {
  Contador,
  Entra,
  EscalaVertical,
  Leitura,
  Linhas,
  MONO,
  Mostrador,
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

/** Uma linha de tabela do anexo: item, base em Mono, valor à direita. */
function LinhaDeCusto({
  item,
  base,
  valor,
  atraso,
}: {
  item: string;
  base: string;
  valor: string;
  atraso: number;
}) {
  return (
    <Entra
      atraso={atraso}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "baseline",
        gap: "0 24px",
        padding: "16px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 26, color: "var(--foreground)" }}>
          {item}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontFamily: MONO,
            fontSize: 20,
            color: "#5f6b72",
          }}
        >
          {base}
        </p>
      </div>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 32,
          color: "var(--foreground)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valor}
      </span>
    </Entra>
  );
}

/** O total de uma coluna: rótulo e valor sobre linha, na base. */
function Total({
  rotuloDo,
  valor,
  cor = "var(--foreground)",
  tamanho = 44,
  atraso,
  teal = false,
}: {
  rotuloDo: string;
  valor: string;
  cor?: string;
  tamanho?: number;
  atraso: number;
  teal?: boolean;
}) {
  return (
    <Entra
      atraso={atraso}
      style={{
        marginTop: "auto",
        paddingTop: 20,
        borderTop: `1px solid ${teal ? "var(--nexodoc-accent)" : "var(--border)"}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 20,
      }}
    >
      <span className="ap-mono-rotulo">{rotuloDo}</span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: tamanho,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: cor,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valor}
      </span>
    </Entra>
  );
}

export const VALORES: readonly Slide[] = [
  {
    rotulo: "O piloto",
    numero: "A",
    bloco: "Os valores",
    titulo: "Piloto de seis meses",
    notas:
      "PRIMEIRA FOLHA DO ANEXO, e é assim de propósito: quem clicou o botão da folha 17 perguntou quanto custa, e a pior resposta possível é a cifra sozinha. Antes do número, o que está sendo comprado.\n\nO pedido é o julgamento de quem usar — sem ele, a única medida em aberto continua em aberto. Ler a coluna da direita devagar: é o que separa este piloto de um período de teste.\n\nNÃO ANTECIPAR O VALOR AQUI. Ele está três folhas adiante, e a sala chega lá em menos de um minuto.",
    corpo: (
      <>
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
              numerada={false}
              itens={[
                {
                  titulo: "O que entra",
                  texto:
                    "Conferência de memorial descritivo e montagem de LDs, capas e volumes, com os usuários definidos junto com a diretoria.",
                },
                {
                  titulo: "O que eu entrego",
                  texto:
                    "Acesso, acompanhamento próximo, correção dos problemas que aparecerem e o modelo-padrão de memorial corrigido.",
                },
                {
                  titulo: "Como saberemos se deu certo",
                  texto:
                    "Nenhum achado com evidência que não exista no documento. Precisão julgada por quem usou, disciplina por disciplina. Listas e volumes reais montados sem perda de trabalho. Custo mensal dentro do estimado.",
                },
              ]}
            />
          </div>
          <div
            style={{
              gridColumn: "8 / span 5",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={640}>
              <span
                className="ap-mono-rotulo"
                style={{ color: "var(--nexodoc-accent)" }}
              >
                O que eu peço em troca
              </span>
            </Entra>
            <p className="ap-titulo-de-fato" style={{ marginTop: 20 }}>
              <Linhas
                linhas={[
                  "Que quem usar julgue",
                  "cada achado: verdadeiro,",
                  "duvidoso ou falso.",
                ]}
                atraso={780}
              />
            </p>
            <Entra atraso={980}>
              <p className="ap-texto" style={{ marginTop: 20 }}>
                É a peça que falta no produto. A planilha de julgamento já
                existe e está pronta para receber esse veredito — e é ele que
                transforma a única medida em aberto num número.
              </p>
            </Entra>
          </div>
        </div>
        <Leitura
          atraso={1100}
          linhas={[
            { texto: "Seis meses de uso real dizem", chave: true },
            { texto: "o que nenhuma apresentação diz.", chave: true },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "Quanto custa",
    numero: "B",
    bloco: "Os valores",
    titulo: "Quanto custa operar",
    notas:
      "Deixar claro, com essas palavras, que a projeção é estimativa e varia com o uso. O número por execução é medido; o mensal depende de quantos documentos passarem. Atualizar a cotação do dólar antes de apresentar.",
    corpo: (
      <>
        <Entra atraso={100}>
          <p className="ap-texto" style={{ fontSize: 28, maxWidth: "80ch" }}>
            O custo por execução é medido no próprio sistema. O total mensal é{" "}
            <span className="ap-premissa">estimativa</span> — varia com quantos
            documentos passarem.
          </p>
        </Entra>
        <div className="ap-grade" style={{ flex: 1, marginTop: 40 }}>
          <div
            style={{
              gridColumn: "1 / span 5",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={200}>
              <span className="ap-mono-rotulo">Medido por execução</span>
            </Entra>
            <div style={{ marginTop: 12 }}>
              <LinhaDeCusto
                item="Conferência de um memorial"
                base="218 páginas, leitura profunda"
                valor="US$ 1,50"
                atraso={300}
              />
              <LinhaDeCusto
                item="Leitura de um selo de prancha"
                base="frações de centavo por folha"
                valor="US$ 0,001"
                atraso={460}
              />
            </div>
          </div>
          <div
            style={{
              gridColumn: "7 / span 6",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={620}>
              <span className="ap-mono-rotulo">
                Estimativa mensal, no volume do escritório
              </span>
            </Entra>
            <div style={{ marginTop: 12 }}>
              <LinhaDeCusto
                item="Conferência de memoriais"
                base="cerca de 16 por mês"
                valor="US$ 24"
                atraso={720}
              />
              <LinhaDeCusto
                item="Montagem de listas e volumes"
                base="uso corrente"
                valor="menos de US$ 1"
                atraso={840}
              />
              <LinhaDeCusto
                item="Servidor"
                base="infraestrutura"
                valor="US$ 25"
                atraso={960}
              />
              <LinhaDeCusto
                item="Banco de dados"
                base="infraestrutura"
                valor="US$ 5"
                atraso={1080}
              />
            </div>
            <Total
              rotuloDo="Ordem de grandeza"
              valor="≈ R$ 285 / mês"
              cor="var(--nexodoc-accent)"
              atraso={1180}
              teal
            />
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
    titulo: "O que custou construir",
    notas:
      "O gasto em dinheiro NAO e estimativa: sai do registro de uso do proprio sistema, chamada por chamada, e o painel administrativo mostra a mesma soma. A hora de desenvolvedor junior e o unico numero inventado desta folha, e a palavra estimativa fica na tela por isso. Se perguntarem por que a ferramenta de programacao entra na conta: porque sem ela este software nao existiria em seis meses, e ela continua sendo paga enquanto eu mantiver o produto.",
    corpo: (
      <>
        <Entra atraso={100}>
          <p className="ap-texto" style={{ fontSize: 28, maxWidth: "80ch" }}>
            O gasto em dinheiro está medido no próprio sistema, chamada por
            chamada. O tempo é <span className="ap-premissa">estimativa</span> —
            e nenhuma dessas horas foi paga pela PROSUL.
          </p>
        </Entra>
        <div className="ap-grade" style={{ flex: 1, marginTop: 40 }}>
          <div
            style={{
              gridColumn: "1 / span 6",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={200}>
              <span className="ap-mono-rotulo">Em dinheiro — medido</span>
            </Entra>
            <div style={{ marginTop: 12 }}>
              <LinhaDeCusto
                item="Modelos de IA"
                base="3.751 chamadas, três meses"
                valor="US$ 64"
                atraso={300}
              />
              <LinhaDeCusto
                item="Ferramenta de programação"
                base="assinatura, seis meses"
                valor="US$ 600"
                atraso={430}
              />
              <LinhaDeCusto
                item="Servidor e domínio"
                base="do período de construção"
                valor="US$ 26"
                atraso={560}
              />
            </div>
            <Total
              rotuloDo="Somado"
              valor="R$ 3.576"
              tamanho={36}
              atraso={720}
            />
          </div>
          <div
            style={{
              gridColumn: "8 / span 5",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={820}>
              <span className="ap-mono-rotulo">Em tempo — estimativa</span>
            </Entra>
            <div style={{ marginTop: 20 }}>
              <Mostrador
                rotuloDo="horas, noites e fins de semana"
                atraso={940}
                valor={<Contador ate={700} atraso={1040} />}
              />
            </div>
            <Entra atraso={1160}>
              <p
                style={{
                  margin: "24px 0 0",
                  fontFamily: MONO,
                  fontSize: 26,
                  color: "var(--muted-foreground)",
                }}
              >
                Hora de desenvolvedor júnior{" "}
                <span className="ap-premissa">(estimativa: R$ 30 a R$ 50)</span>
              </p>
            </Entra>
            <Total
              rotuloDo="Só de trabalho"
              valor="R$ 21.000 a R$ 35.000"
              tamanho={36}
              atraso={1300}
            />
          </div>
        </div>
        <Entra
          atraso={1460}
          style={{
            flex: "none",
            marginTop: 24,
            paddingTop: 24,
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
              lineHeight: 1.25,
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
              fontVariantNumeric: "tabular-nums",
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
    titulo: "A proposta",
    notas:
      "Ler a folha inteira antes de falar do número. A linha que decide não é o valor, é a de baixo: ao fim dos seis meses, se não atender, encerra. É isso que tira o risco da mesa.\n\nSE PERGUNTAREM POR QUE SEIS E NÃO TRÊS: porque três meses não dão para um projeto inteiro passar pelo sistema, e sem projeto inteiro não há julgamento — sobra impressão.\n\nO PISO ESTÁ DECIDIDO e é este. Abaixo dele não se fecha na sala: dizer que leva para pensar, e levar mesmo. Nunca aceitar por alívio de a reunião estar acabando, que é como quase todo desconto acontece.",
    corpo: (
      <>
        <EscalaVertical
          atraso={120}
          numerada={false}
          style={{ flex: "none", height: 560 }}
          itens={[
            { titulo: "Modalidade", texto: "Licença de uso durante o piloto" },
            { titulo: "Prazo", texto: "6 meses" },
            {
              titulo: "Valor",
              texto: "R$ 10.000",
              cor: "var(--nexodoc-accent)",
            },
            {
              titulo: "Inclui",
              texto:
                "Conferência de memorial descritivo e montagem de listas de documentos, capas e volumes. Acompanhamento próximo, correção dos problemas que aparecerem, e o modelo-padrão de memorial corrigido.",
            },
            {
              titulo: "Não inclui",
              texto:
                "Desenvolvimento de módulo novo sob demanda, leitura de PDF escaneado (OCR) e auditoria de prancha.",
            },
          ]}
        />
        <Leitura
          atraso={900}
          linhas={[
            {
              texto: "Ao fim dos seis meses: se não atender, encerra.",
              chave: true,
            },
            {
              texto:
                "Se atender, a renovação é negociada com o que o uso real tiver mostrado.",
            },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "De onde sai esse número",
    numero: "E",
    bloco: "Os valores",
    titulo: "De onde sai esse número",
    notas:
      "ESTA FOLHA NÃO DEFENDE O PREÇO, ELA O ANCORA. Nenhum dos três números da esquerda é novo: dois estão nas folhas B e C, aqui mesmo, e o do projeto devolvido veio da folha 12 do deck. O que esta folha faz é pô-los ao lado do pedido.\n\nNÃO TRAZER A CONTA DE RETORNO MENSAL para esta folha, nem de boca. Operar custa R$ 285 e o tempo devolvido paga até cerca de R$ 500 por mês; R$ 10.000 em seis meses dá R$ 1.667 por mês. Quem levantar essa aritmética na sala derruba o preço com o meu próprio número.\n\nSE ELE MESMO LEVANTAR, a resposta é a frase de baixo: o piloto não está comprando seis meses de acesso, está comprando o que já está construído — e mesmo que ninguém abra o sistema no sexto mês, o que foi entregue continua entregue.\n\nA ÚNICA ESTIMATIVA DESTA FOLHA é a hora de desenvolvedor júnior, e a palavra fica na tela por isso. Tudo o mais saiu do registro de uso do próprio sistema.",
    corpo: (
      <>
        <Entra atraso={100}>
          <p className="ap-texto" style={{ fontSize: 28, maxWidth: "80ch" }}>
            Nada aqui é novo: os três números já passaram — dois nas duas folhas
            anteriores, o terceiro no deck. O que muda é que agora estão ao lado
            do pedido.
          </p>
        </Entra>
        <div className="ap-grade" style={{ flex: 1, marginTop: 40 }}>
          <div
            style={{
              gridColumn: "1 / span 6",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={200}>
              <span className="ap-mono-rotulo">O que já foi gasto</span>
            </Entra>
            <div style={{ marginTop: 12 }}>
              <LinhaDeCusto
                item="Construir o que vocês viram"
                base="R$ 3.576 em dinheiro, medido, mais 700 horas"
                valor="R$ 24.600 a 38.600"
                atraso={300}
              />
              <LinhaDeCusto
                item="O projeto devolvido"
                base="só as horas paradas que deu para somar"
                valor="R$ 3.600 a 6.480"
                atraso={440}
              />
              <LinhaDeCusto
                item="Operar o sistema"
                base="por mês, no volume do escritório"
                valor="R$ 285"
                atraso={580}
              />
            </div>
            <Entra atraso={720} style={{ marginTop: "auto" }}>
              <p className="ap-fonte">
                A hora de desenvolvedor júnior é{" "}
                <span className="ap-premissa">estimativa (R$ 30 a R$ 50)</span>.
                Todo o resto saiu do registro de uso do próprio sistema.
              </p>
            </Entra>
          </div>
          <div
            style={{
              gridColumn: "8 / span 5",
              display: "flex",
              flexDirection: "column",
              paddingTop: 120,
            }}
          >
            <Mostrador
              rotuloDo="por seis meses de licença de uso"
              atraso={900}
              cor="var(--nexodoc-accent)"
              valor="R$ 10.000"
            />
          </div>
        </div>
        <Leitura
          atraso={1100}
          linhas={[
            { texto: "O piloto não compra seis meses de acesso.", chave: true },
            { texto: "Compra o que já está construído —", chave: true },
            { texto: "e pede menos de metade do que custou construir." },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "Propriedade",
    numero: "F",
    bloco: "Os valores",
    titulo: "Propriedade",
    notas:
      "UMA FRASE, SEM DEFENSIVA E SEM JUSTIFICATIVA LONGA. Explicar demais aqui parece culpa. Ler, parar, e deixar a sala reagir.\n\nSE VIER 'E O QUE DIZ O SEU CONTRATO DE TRABALHO?': o contrato foi lido, e não há cláusula de cessão sobre criação fora do expediente. Resposta de uma linha, sem alongar.\n\nA MOEDA DE TROCA, se travar aqui, é a CUSTÓDIA DO CÓDIGO — está disponível e vale PRAZO. Oferecê-la em troca de contrato mais longo, nunca de desconto.",
    corpo: (
      <>
        <p className="ap-titulo-de-fato" style={{ marginTop: 48 }}>
          <Linhas
            linhas={[
              "O NexoDoc é de autoria e propriedade de Matheus",
              "Mendes, desenvolvido fora do vínculo empregatício,",
              "em equipamento, tempo e licenças próprios.",
            ]}
            atraso={200}
          />
        </p>
        <Leitura
          atraso={900}
          linhas={[
            { texto: "O que se propõe aqui é licença de uso.", chave: true },
          ]}
        />
      </>
    ),
  },
];
