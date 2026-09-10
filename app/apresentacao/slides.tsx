"use client";

import type { CSSProperties, ReactNode } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";
import { AgentOrb } from "@/modules/nexo/components/agent-orb/AgentOrb";

import {
  corDaDisciplina,
  siglaDaDisciplina,
} from "@/modules/nexo/lib/disciplina-cor";

import { O_PROBLEMA } from "./folhas/o-problema";
import { O_QUE_E } from "./folhas/o-que-e";
import { O_QUE_EXISTE } from "./folhas/o-que-existe";
import type { Slide } from "./palco";
import {
  Contador,
  Entra,
  Fecho,
  Linha,
  Linhas,
  Marcador,
  MONO,
  paragrafo,
  rotulo,
  secundario,
  Titulo,
} from "./pecas";

/**
 * O CONTEÚDO DO DECK.
 *
 * TRÊS REGRAS QUE ESTE ARQUIVO NÃO PODE PERDER:
 *
 *  1. **Todo número aqui foi medido, e o que é conta aparece como estimativa.**
 *     Os custos saíram de `AiUsageEvent`; os achados, de execuções reais. Onde
 *     há premissa, a palavra fica na tela, em âmbar. Um número inventado que o
 *     diretor detecte contamina os que estão certos.
 *  2. **Nenhuma cifra de preço nas folhas 01 a 19.** Valor do piloto e
 *     propriedade do software vivem em `/apresentacao/valores`, e a folha 17
 *     só traz o BOTÃO que abre aquela rota. Uma seta a mais no fim do deck não
 *     pode revelar a proposta comercial antes da hora — mas o preço também não
 *     pode ficar fora do alcance de quem apresenta, que era o custo de mantê-lo
 *     num arquivo solto em `docs/`.
 *  3. **Nada se mexe sem dizer algo.** A entrada escalonada é ordem de leitura;
 *     a linha que se desenha é direção de fluxo; o número que corre é o
 *     argumento chegando. Ver a seção de movimento em `palco.css`.
 *
 * SEM DATA DE EXECUÇÃO EM LUGAR NENHUM. O deck fala do que o sistema faz, não
 * de quando uma corrida específica rodou — data em slide envelhece o argumento
 * e convida a pergunta errada.
 */

/* ─────────────────────────────────────────────────────── o botão dos valores */

/**
 * O BOTÃO QUE ABRE OS VALORES.
 *
 * É o único elemento clicável do deck inteiro, e isso é o ponto. O preço não
 * pode ser alcançado por avançar a seta — a decisão de mostrá-lo tem que custar
 * um gesto, e tirar a mão do teclado para ir ao mouse é esse gesto.
 *
 * ABA NOVA, e não navegação. Voltar na mesma aba devolveria o deck na folha 01,
 * e esta folha é a 21 de 23. Com `_blank`, `Ctrl+W` traz de volta a folha certa,
 * ainda em tela cheia, com o índice intacto.
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 18,
        padding: "24px 40px",
        borderRadius: 4,
        border: "1px solid var(--nexodoc-accent)",
        background: "rgb(0 166 147 / 0.10)",
        fontSize: 34,
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

/* ────────────────────────────────────────────────── a folha do contraditório */

/**
 * UMA FOLHA DE OBJEÇÃO.
 *
 * A pergunta aparece na tela COM AS PALAVRAS DO COMPRADOR, na versão mais dura
 * que ele conseguiria formular — não numa versão amaciada. Quem escreveu a
 * acusação já tirou dela metade da força: a sala vê que ela foi PREVISTA, e não
 * improvisada na hora.
 *
 * A citação é MONO porque essa distinção já vale no resto do deck — mono é o
 * que os OUTROS dizem (o memorial, o diretor), sans é o que eu digo. Aqui ela
 * separa a acusação da resposta sem precisar de rótulo nenhum.
 *
 * NENHUMA CIFRA nas perguntas. Uma objeção que cita um número do deck envelhece
 * junto com ele, e um número desencontrado entre duas folhas é exatamente o que
 * a regra do topo deste arquivo proíbe.
 */
function Objecao({
  pergunta,
  titulo,
  linhaFina,
  respostas,
  fecho,
}: {
  /** A objeção, dita com as palavras de quem a faria. Vai entre aspas. */
  pergunta?: string;
  /** Alternativa à pergunta: a folha se anuncia como afirmação, não objeção. */
  titulo?: string;
  /** A linha de apoio do título. Só faz sentido junto de `titulo`. */
  linhaFina?: string;
  respostas: readonly (readonly [string, string])[];
  /** O fecho, uma linha por item — a quebra é editorial, não de largura. */
  fecho: readonly string[];
}) {
  return (
    <>
      {titulo ? (
        <>
          <Titulo style={{ margin: 0 }}>{titulo}</Titulo>
          {linhaFina ? (
            <Entra atraso={100}>
              <p
                style={{ ...secundario, maxWidth: "58ch", margin: "16px 0 0" }}
              >
                {linhaFina}
              </p>
            </Entra>
          ) : null}
        </>
      ) : (
        <>
          <Entra atraso={0}>
            <span style={rotulo}>A pergunta</span>
          </Entra>
          <Entra atraso={100}>
            <p
              style={{
                margin: "18px 0 0",
                maxWidth: "46ch",
                fontFamily: MONO,
                fontSize: 40,
                lineHeight: 1.34,
                letterSpacing: "-0.012em",
                color: "var(--foreground)",
                textWrap: "pretty",
              }}
            >
              {`“${pergunta}”`}
            </p>
          </Entra>
        </>
      )}

      <div
        style={{
          display: "flex",
          gap: 0,
          marginTop: 44,
          paddingTop: 40,
          borderTop: "1px solid var(--border)",
        }}
      >
        {respostas.map(([titulo, texto], i) => (
          <div
            key={titulo}
            className="ap-entra"
            style={{
              animationDelay: `${320 + i * 180}ms`,
              flex: 1,
              padding: i === 0 ? "0 40px 0 0" : "0 40px",
              borderLeft: i === 0 ? "none" : "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 24,
                color: "var(--nexodoc-accent)",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 31,
                fontWeight: 500,
                letterSpacing: "-0.016em",
                lineHeight: 1.26,
                color: "var(--foreground)",
                textWrap: "pretty",
              }}
            >
              {titulo}
            </p>
            <p style={{ ...secundario, fontSize: 24 }}>{texto}</p>
          </div>
        ))}
      </div>

      <div className="ap-cresce" />

      <Entra
        atraso={320 + respostas.length * 180 + 160}
        style={{ paddingTop: 30, borderTop: "1px solid var(--border)" }}
      >
        <Fecho
          linhas={fecho}
          tamanho={38}
          atraso={320 + respostas.length * 180 + 260}
        />
      </Entra>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════ AS FOLHAS */

export const SLIDES: readonly Slide[] = [
  ...O_QUE_E,

  ...O_PROBLEMA,

  ...O_QUE_EXISTE,

  {
    rotulo: "Como ela se paga",
    numero: "12",
    bloco: "O dinheiro",
    notas:
      "DE ONDE SAI O R$ 285: a folha que abria essa conta saiu do deck em 09/09/2026 e vive na folha B do anexo. Se perguntarem como se chega nele, abrir o botão da folha 17 em vez de improvisar a conta de cabeça.\n\nESTA FOLHA NAO DISPUTA ARITMETICA, DE PROPOSITO. A versao anterior valorizava as 16 horas de montagem a hora de engenheiro e caia com uma frase: quem monta lista de documentos nao ganha hora de engenheiro. A hora de tecnico derruba a conta inteira, e o argumento nao pode depender de um numero que a sala refuta de cabeca.\n\nO TETO DE LICENCA SAIU DA TELA e vive aqui: com a operacao em R$ 285, uma licenca ate cerca de R$ 500 por mes se paga so no tempo devolvido. NAO OFERECER esse numero. O diretor vai calcula-lo sozinho, e um numero que ele deduz vale mais que um que eu concedo.\n\nOS DOIS NÚMEROS DE BAIXO SÃO A FRASE INTEIRA, sem razão escrita entre eles: o pequeno é o que custa operar, o grande é o que o episódio custou — e a sala faz a divisão sozinha. O terceiro bloco de cima e o mais forte do deck inteiro e nao tem numero nenhum. Ler devagar e parar.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 20 }}>Como ela se paga</Titulo>

        {/*
          LARGURA LIMITADA de propósito. Sem o teto, a linha corre os 1720px da
          folha e vira uma faixa de texto que ninguém lê da terceira fileira da
          sala.
        */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {[
            [
              "Em tempo que volta para o projeto.",
              "Quatro projetos por mês, até quatro horas de montagem manual cada. São dezesseis horas que ninguém precisa gastar abrindo prancha por prancha — e que voltam para quem deveria estar projetando.",
            ],
            [
              "Em qualidade do que sai daqui.",
              "O projeto que chega ao cliente já passou por uma leitura que hoje não acontece. Não é uma revisão a mais: é a primeira.",
            ],
            [
              "E em vergonha não passada.",
              "Este é o retorno que não entra em planilha nenhuma, e é o único que a sala inteira já viu de perto. Um projeto devolvido não custa só as horas paradas que a folha da conta somou.",
            ],
          ].map(([titulo, texto], i) => (
            <Marcador
              key={titulo}
              titulo={titulo}
              texto={texto}
              atraso={160 + i * 190}
            />
          ))}
        </div>

        {/*
          O ANTES E O DEPOIS EM DOIS NÚMEROS, e a distância entre eles é o
          argumento. Nada de razão escrita: a folha 14 do spec proíbe disputar
          aritmética, e "22 vezes" seria uma conta que a sala pode refutar.
          Um número pequeno ao lado de um grande não se refuta — se vê.
        */}
        {/*
          DUAS LINHAS DE GRADE, e não duas colunas: os rótulos ficam na mesma
          altura e os números na mesma linha de base, ainda que um tenha 56px e
          o outro 96. Em duas colunas alinhadas por baixo, o rótulo do pequeno
          descia 40px em relação ao do grande — visto na captura.
        */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gridTemplateRows: "auto auto",
            columnGap: 96,
            rowGap: 18,
            alignItems: "baseline",
            paddingTop: 30,
            borderTop: "1px solid var(--nexodoc-accent)",
          }}
        >
          <Entra atraso={820}>
            <span style={rotulo}>Operar, por mês</span>
          </Entra>
          <Entra atraso={1150}>
            <span style={rotulo}>
              O episódio que já aconteceu — só a parte que deu para somar
            </span>
          </Entra>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 56,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              color: "var(--muted-foreground)",
              whiteSpace: "nowrap",
            }}
          >
            <Linhas linhas={["R$ 285"]} atraso={900} />
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
            }}
          >
            <Linhas linhas={["R$ 3.600 a R$ 6.480"]} atraso={1250} />
          </div>
        </div>
      </>
    ),
  },

  /*
   * ─── AS POSSÍVEIS PERGUNTAS ───────────────────────────────────────────────
   *
   * O rótulo diz POSSÍVEIS, e não "difíceis". Quem projeta o slide sabe que são
   * objeções; a sala não precisa ouvir que a conversa vai ficar difícil antes
   * de ela ficar. O conteúdo é o mesmo — o enquadramento, não.
   *
   * A ordem escala do técnico ao comercial. Cada folha responde por dinheiro um
   * pouco mais do que a anterior, e a última abre a porta do anexo — que é o
   * único lugar onde o valor aparece.
   */

  {
    rotulo: "Por que não o ChatGPT",
    numero: "13",
    bloco: "Possíveis perguntas",
    notas:
      "NÃO BRIGAR COM O CHATGPT: ele está dentro do sistema, e dizer isso desarma a pergunta em vez de disputá-la. Para 'contrato um desenvolvedor por dois meses': dois meses fazem a primeira versão; o que está na tela é o que sobrou depois de meses corrigindo contra memorial real, e a folha dos limites mostra o que ainda falta.\n\nRÉPLICA PROVÁVEL 1 — 'então me venda só as regras e a montagem, e eu uso o ChatGPT para o resto': as regras sozinhas acham menos da metade, e é a segunda passada que derruba o falso positivo — está na folha da autorrevisão. Vender as partes separadas entrega um motor sem freio.\n\nRÉPLICA PROVÁVEL 2 — 'em seis meses isso é um botão dentro do Word': pode ser, e nesse dia eu troco o modelo por dentro e vocês não fazem nada. O que não vem de graça em botão nenhum é saber o que perguntar ao modelo, e é isso que os oito meses compraram.",
    corpo: (
      <Objecao
        pergunta="Isso é uma casca em cima do ChatGPT. Por que não assinamos o ChatGPT e mandamos alguém jogar o PDF lá?"
        respostas={[
          [
            "O modelo é uma peça, não é o sistema.",
            "O ChatGPT é uma das caixas do diagrama que vocês viram. As outras não são dele: extrair o texto sabendo em que página cada linha está, aplicar as regras que não alucinam, validar cada achado contra o próprio documento e descartar o que não se sustenta. Sem elas, o que volta é um resumo — e resumo não se leva para o cliente.",
          ],
          [
            "A conversa não guarda nada.",
            "Colar um PDF num chat não deixa histórico por obra, nem custo por projeto, nem teto de gasto, nem registro de quem leu o quê. E o que ele entendeu de um memorial não serve para o próximo.",
          ],
          [
            "Metade do sistema não é leitura.",
            "Lista de documentos, capa, volume, folha faltante, selo divergente. Isso é montagem de arquivo. Nenhum chat entrega ODT, PDF e ZIP prontos para a entrega.",
          ],
        ]}
        fecho={[
          "E quando o modelo melhorar — e vai — ele melhora aqui dentro.",
          "Trocar de modelo é uma linha de configuração; o que sobra é o resto.",
        ]}
      />
    ),
  },

  {
    rotulo: "Você não provou que vale",
    numero: "14",
    bloco: "Possíveis perguntas",
    notas:
      "O terceiro bloco é o que mais compra a sala: é ganho que independe de assinar contrato.\n\nRÉPLICA PROVÁVEL 1 — 'aconteceu uma vez, em quantos anos?': uma vez que os senhores SOUBERAM. O erro do modelo-padrão esteve em cinco projetos e ninguém tinha achado — e não seria achado.\n\nRÉPLICA PROVÁVEL 2 — 'então traga a medição pronta e voltamos a conversar': a medição depende do veredito de quem projeta, e é literalmente o que estou pedindo. Sem uso real ela não existe, e não há como eu produzi-la sozinho — seria eu julgando o meu próprio trabalho, que é exatamente o problema que este sistema existe para resolver.\n\nRÉPLICA PROVÁVEL 3 — 'projetista ignora checklist há vinte anos': não é checklist, é uma lista com a página e a frase do documento dele. E se ignorarem, o piloto é justamente o que mede isso.",
    corpo: (
      <Objecao
        pergunta="57 achados, e você mesmo disse que não sabe quantos são erro de verdade. Meu subdiretor lê um memorial em uma hora. Agora ele lê o memorial e mais 57 achados. Você piorou o trabalho dele."
        respostas={[
          [
            "A comparação não é uma hora contra seis minutos.",
            "É uma leitura que acontece contra uma que não acontece. A folha da conferência de hoje já disse: não há tempo dedicado para isso, e quando há, ela disputa espaço com a entrega.",
          ],
          [
            "Descartar um achado errado custa duas linhas.",
            "Cada um vem com a página e o trecho transcrito do próprio memorial. Não se investiga um achado: lê-se e decide-se.",
          ],
          [
            "Onze deles não são de projeto nenhum.",
            "São do modelo-padrão — o mesmo texto errado em cinco projetos. Corrigidos uma vez, somem de todos. Esse ganho existe mesmo que vocês não comprem nada.",
          ],
        ]}
        fecho={[
          "Quantos dos outros são erro de verdade, eu não sei.",
          "É exatamente por isso que estou pedindo seis meses, e não a sua assinatura.",
        ]}
      />
    ),
  },

  {
    rotulo: "E se você sair",
    numero: "15",
    bloco: "Possíveis perguntas",
    notas:
      "NÃO ENTRAR NO MÉRITO DO VÍNCULO. A relação hoje é PJ, e a folha responde CONTINUIDADE, não crachá: quem contrata licença de software não pergunta o regime de quem a escreveu. Se alguém puxar o assunto, devolver para o contrato — prazo, prazo de resposta e o que fica com vocês.\n\nCUSTÓDIA DE CÓDIGO E INSTALAÇÃO NA INFRAESTRUTURA DELES NÃO ESTÃO OFERECIDAS NA TELA. Promessa projetada não se retira depois. O fecho é o que mais tranquiliza engenheiro na sala: a assinatura, e o risco que vem com ela, não mudam de dono.\n\nRÉPLICA PROVÁVEL 1 — 'então põe o código em custódia': DECIDIDO, ela está disponível — mas nunca de graça. A contrapartida é PRAZO: a custódia entra se o piloto virar contrato longo. Dizer as duas coisas na mesma frase, porque cedida sozinha ela vira o novo ponto de partida da negociação.\n\nRÉPLICA PROVÁVEL 2 — 'prazo de resposta sem multa é papel': DECIDIDO, NÃO há multa. O prazo já é o compromisso, e contrato descumprido tem consequência sem precisar de cláusula de multa. Não ceder aqui no calor da reunião: esta linha foi escrita justamente para isso.\n\nRÉPLICA PROVÁVEL 3 — 'e se der problema num sábado?': o prazo escrito vale para problema que impeça o uso, não para toda dúvida. Dizer isso com essas palavras, sem prometer plantão.",
    corpo: (
      <Objecao
        pergunta="E se você sair, como fica? O sistema é de uma pessoa só: se você parar, a gente para junto."
        respostas={[
          [
            "O que nos liga é um contrato, não um crachá.",
            "A licença tem prazo próprio e vale por ele inteiro. Se eu deixar de tocar qualquer outro trabalho aqui, esse prazo continua de pé — são duas relações diferentes, e sempre foram.",
          ],
          [
            "Prazo de resposta escrito, não boa vontade.",
            "Problema que impeça o uso tem tempo de correção definido em contrato, e não depende de eu estar de bom humor naquela semana.",
          ],
          [
            "O que ele produz são arquivos, e eles são de vocês.",
            "Parecer, lista de documentos, capa e volume saem em arquivo. Se o sistema parar amanhã, o que já foi montado continua exatamente onde está.",
          ],
        ]}
        fecho={[
          "A responsabilidade técnica não muda de mãos, e nunca esteve na mesa.",
          "Quem assina o projeto continua sendo quem responde por ele —",
          "hoje, sem conferência nenhuma, e depois.",
        ]}
      />
    ),
  },

  {
    rotulo: "Motivo da venda",
    numero: "16",
    bloco: "Possíveis perguntas",
    notas:
      "A FOLHA DEIXOU DE SER UMA OBJEÇÃO em 09/09/2026. Antes ela punha na tela a acusação ('você é nosso funcionário, por que estamos pagando?') e respondia. Emprestar essa frase à sala é dar munição que talvez ninguém fosse buscar — e, com a relação em PJ, ela nem se sustenta. Agora a folha AFIRMA: três fatos, ditos por mim, antes de alguém precisar perguntar.\n\nFALAR DEVAGAR E NÃO JUSTIFICAR MAIS DO QUE ESTÁ ESCRITO. Quem explica demais parece estar se defendendo de algo.\n\nSE VIER 'e o que diz o seu contrato?': CONFERIDO — foi lido, e NÃO há cláusula de cessão sobre o que eu crio fora dele. Responder isso e parar; a resposta curta é a mais forte.\n\nSE VIER 'você testou com os nossos projetos, isso é informação da empresa': os documentos foram lidos, não copiados nem guardados, e o produto não contém nenhum trecho deles. O que aprendi lendo é conhecimento profissional — o mesmo que qualquer projetista leva de um projeto para o seguinte.\n\nSE VIER 'te pago as suas horas e o software passa a ser nosso': a folha que respondia isso saiu do deck em 09/09/2026, e a resposta agora é de boca. Comprar as minhas horas compraria o passado; quem mantém o sistema na semana que vem é a licença. Compra é outra negociação, com outro número e outro contrato — e eu ouço, só não é a que eu vim propor hoje. A MOEDA DE TROCA, se travar, é a CUSTÓDIA DO CÓDIGO: vale PRAZO, nunca desconto.\n\nO TERCEIRO FATO NÃO É AMEAÇA, e não se diz com esse tom. Ele explica por que existe preço em vez de doação — e, dito antes de perguntarem, tira o assunto da mesa.",
    corpo: (
      <Objecao
        titulo="Motivo da venda"
        linhaFina="Três fatos, ditos antes de alguém precisar perguntar."
        respostas={[
          [
            "Foi feito fora.",
            "Fora do horário, em equipamento meu, com licenças minhas. Nenhuma hora paga pela PROSUL entrou aqui.",
          ],
          [
            "Os documentos não ficaram comigo.",
            "Nenhum memorial de cliente está na minha máquina. E o sistema não guarda PDF nenhum — é a mesma decisão que a folha da segurança mostrou.",
          ],
          [
            "Foi pensado num problema daqui, mas não é só daqui.",
            "Memorial, lista de documentos, volume, prefeitura: o mesmo trabalho existe em qualquer escritório que entregue projeto público. O que está montado vira produto para outras empresas com pouca mudança.",
          ],
        ]}
        fecho={[
          "O problema é da casa. A solução não nasceu dela —",
          "e serve a qualquer escritório que entregue projeto para prefeitura.",
        ]}
      />
    ),
  },

  {
    rotulo: "Quanto custa usar",
    numero: "17",
    bloco: "O dinheiro",
    notas:
      "ESTA FOLHA NÃO TEM CIFRA, E ISSO É O DESENHO. Ela existe para que o preço esteja ao alcance da mão sem estar na tela: se ninguém perguntar, ela passa em dez segundos e o deck fecha no limite, que é onde ele sempre fechou.\n\nO BLOCO VOLTA A SER 'O DINHEIRO' de propósito, depois das possíveis perguntas. A sala percebe que a conversa mudou de assunto antes de eu dizer.\n\nO BOTÃO ABRE EM ABA NOVA: clicar não perde o deck. Fechar com Ctrl+W devolve esta folha, ainda em tela cheia.\n\nQUANDO CLICAR: quando alguém perguntar o valor, ou quando eu tiver decidido que a sala está pronta. Não clicar por reflexo de estar numa folha que tem botão — a folha funciona sem ser clicada, e passar por ela sem abrir é uma escolha legítima.\n\nO PISO CONTINUA SENDO seis meses por R$ 10.000. Abaixo disso não se fecha na sala.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 24 }}>Quanto custa usar</Titulo>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Entra atraso={160}>
            <p
              style={{
                ...paragrafo,
                maxWidth: "44ch",
                fontSize: 40,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1.28,
              }}
            >
              O valor não está neste deck.
            </p>
          </Entra>
          <Entra atraso={320}>
            <p
              style={{
                ...secundario,
                maxWidth: "50ch",
                marginTop: 18,
                fontSize: 28,
              }}
            >
              Ele está numa página separada, com a conta que o sustenta. Eu abro
              agora, se você quiser ver.
            </p>
          </Entra>
          <Entra atraso={520} style={{ marginTop: 52 }}>
            <BotaoDosValores />
          </Entra>
        </div>
      </>
    ),
  },

  {
    rotulo: "O que pode vir",
    numero: "18",
    bloco: "O pedido",
    notas:
      "Deixar claro que é caminho, não promessa — nada aqui está pronto. O item que costuma acender o olho de quem projeta é o terceiro: a correção aplicada direto no arquivo editável.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 12 }}>O que pode vir depois</Titulo>
        <Entra atraso={140}>
          <p style={{ ...secundario, margin: 0 }}>
            Caminho, não promessa. Nada disto está pronto, e a ordem depende do
            que o uso real mostrar.
          </p>
        </Entra>

        {/*
          TRACEJADO = NÃO CONSTRUÍDO. É a mesma grade de colunas das folhas 04 e
          06, com a régua de cima tracejada em vez de cheia — o olho lê "igual
          ao que existe, mas ainda não". Sem caixa: os três cartões de antes
          tinham alturas diferentes e flutuavam no meio da folha.
        */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
            {[
              {
                titulo: "Conferência de quantidades",
                texto:
                  "Cruzar o que o memorial especifica com o que a planilha orça, e acusar o que não bate.",
              },
              {
                titulo: "Leitura especializada por disciplina",
                texto:
                  "Um leitor treinado no vocabulário de cada disciplina, em vez de um leitor geral para todas.",
              },
              {
                titulo: "Correção no arquivo editável",
                texto:
                  "A alteração aplicada direto no documento de origem, com você aprovando cada uma antes.",
              },
            ].map((c, i) => (
              <div
                key={c.titulo}
                className="ap-entra"
                style={{
                  animationDelay: `${300 + i * 200}ms`,
                  flex: 1,
                  margin: i === 0 ? "0 28px 0 0" : "0 0 0 28px",
                  paddingTop: 26,
                  borderTop: "1px dashed #3d474d",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <span
                  style={{ fontFamily: MONO, fontSize: 22, color: "#5f6b72" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 36,
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.22,
                    color: "var(--foreground)",
                    textWrap: "pretty",
                  }}
                >
                  {c.titulo}
                </h3>
                <p style={{ ...secundario, fontSize: 25, maxWidth: "40ch" }}>
                  {c.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "O que ela não é",
    numero: "19",
    bloco: "O pedido",
    notas:
      "Fechar por aqui é escolha: a última coisa que a sala ouve é o limite, dito por mim, e não uma promessa. Ler devagar e parar.\n\nO ORBE VOLTA — o mesmo da capa, do mesmo tamanho da folha do motor. É o deck fechando onde abriu, e não um enfeite: a sala viu o produto se apresentar sozinho na primeira folha, e o vê de novo quando eu digo o que ele não é.\n\nSe vier pergunta sobre valor depois disto, voltar à folha 17 e abrir o botão — o deck não termina no preço.",
    corpo: (
      <>
        <Titulo style={{ marginBottom: 20 }}>
          O que esta ferramenta não é
        </Titulo>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {[
            [
              "Ela não assume responsabilidade técnica.",
              "Quem assina o projeto continua sendo quem responde por ele. O sistema aponta; a decisão é de quem põe o nome na capa.",
            ],
            [
              "A IA erra, e vai errar.",
              "Ela levanta o que parece não fechar. Parte disso não é erro nenhum, e é você quem separa uma coisa da outra.",
            ],
            [
              "Ela não faz o trabalho no seu lugar.",
              "O que ela devolve não é o projeto pronto: é o tempo que se gastaria procurando — e a chance de achar o que ninguém teve tempo de procurar.",
            ],
          ].map(([titulo, texto], i) => (
            <Marcador
              key={titulo}
              titulo={titulo}
              texto={texto}
              atraso={160 + i * 190}
            />
          ))}
        </div>

        {/*
          O FECHO DO DECK É O ORBE E UMA FRASE. O orbe é `compact` (198px, medida
          fixa) — a mesma escala em que a folha do motor o mostrou, e o mesmo
          organismo vivo da capa. Ver a nota sobre `transform` na capa: o canvas
          mede a si mesmo, e não pode ser escalado por fora.
        */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 64,
            paddingTop: 26,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            className="ap-surge"
            style={{
              flex: "none",
              width: 198,
              height: 198,
              display: "grid",
              placeItems: "center",
              animationDelay: "760ms",
            }}
          >
            <AgentOrb size="compact" state="idle" />
          </div>
          <Fecho
            linhas={[
              "Uma segunda leitura que nunca se cansa,",
              "e que nunca assina no seu lugar.",
            ]}
            tamanho={48}
            atraso={900}
          />
        </div>
      </>
    ),
  },
];
