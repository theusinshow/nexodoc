"use client";

import type { Slide } from "../palco";
import { Confronto } from "../pecas";

/**
 * BLOCO 5 — POSSÍVEIS PERGUNTAS (folhas 13 a 16). O rótulo diz POSSÍVEIS, e não
 * "difíceis": a sala não precisa ouvir que a conversa vai ficar difícil antes
 * de ela ficar. Texto e notas de 09/09/2026, sem alteração.
 */
export const POSSIVEIS_PERGUNTAS: readonly Slide[] = [
  {
    rotulo: "Por que não o ChatGPT",
    numero: "13",
    bloco: "Possíveis perguntas",
    titulo: "Por que não o ChatGPT",
    notas:
      "NÃO BRIGAR COM O CHATGPT: ele está dentro do sistema, e dizer isso desarma a pergunta em vez de disputá-la. Para 'contrato um desenvolvedor por dois meses': dois meses fazem a primeira versão; o que está na tela é o que sobrou depois de meses corrigindo contra memorial real, e a folha dos limites mostra o que ainda falta.\n\nRÉPLICA PROVÁVEL 1 — 'então me venda só as regras e a montagem, e eu uso o ChatGPT para o resto': as regras sozinhas acham menos da metade, e é a segunda passada que derruba o falso positivo — está na folha da autorrevisão. Vender as partes separadas entrega um motor sem freio.\n\nRÉPLICA PROVÁVEL 2 — 'em seis meses isso é um botão dentro do Word': pode ser, e nesse dia eu troco o modelo por dentro e vocês não fazem nada. O que não vem de graça em botão nenhum é saber o que perguntar ao modelo, e é isso que os oito meses compraram.",
    corpo: (
      <Confronto
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
        leitura={[
          {
            texto:
              "E quando o modelo melhorar — e vai — ele melhora aqui dentro.",
          },
          {
            texto:
              "Trocar de modelo é uma linha de configuração; o que sobra é o resto.",
            chave: true,
          },
        ]}
      />
    ),
  },

  {
    rotulo: "Você não provou que vale",
    numero: "14",
    bloco: "Possíveis perguntas",
    titulo: "Você não provou que vale",
    notas:
      "O terceiro bloco é o que mais compra a sala: é ganho que independe de assinar contrato.\n\nRÉPLICA PROVÁVEL 1 — 'aconteceu uma vez, em quantos anos?': uma vez que os senhores SOUBERAM. O erro do modelo-padrão esteve em cinco projetos e ninguém tinha achado — e não seria achado.\n\nRÉPLICA PROVÁVEL 2 — 'então traga a medição pronta e voltamos a conversar': a medição depende do veredito de quem projeta, e é literalmente o que estou pedindo. Sem uso real ela não existe, e não há como eu produzi-la sozinho — seria eu julgando o meu próprio trabalho, que é exatamente o problema que este sistema existe para resolver.\n\nRÉPLICA PROVÁVEL 3 — 'projetista ignora checklist há vinte anos': não é checklist, é uma lista com a página e a frase do documento dele. E se ignorarem, o piloto é justamente o que mede isso.",
    corpo: (
      <Confronto
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
        leitura={[
          { texto: "Quantos dos outros são erro de verdade, eu não sei." },
          {
            texto: "É exatamente por isso que estou pedindo seis meses,",
            chave: true,
          },
          { texto: "e não a sua assinatura.", chave: true },
        ]}
      />
    ),
  },

  {
    rotulo: "E se você sair",
    numero: "15",
    bloco: "Possíveis perguntas",
    titulo: "E se você sair",
    notas:
      "NÃO ENTRAR NO MÉRITO DO VÍNCULO. A relação hoje é PJ, e a folha responde CONTINUIDADE, não crachá: quem contrata licença de software não pergunta o regime de quem a escreveu. Se alguém puxar o assunto, devolver para o contrato — prazo, prazo de resposta e o que fica com vocês.\n\nCUSTÓDIA DE CÓDIGO E INSTALAÇÃO NA INFRAESTRUTURA DELES NÃO ESTÃO OFERECIDAS NA TELA. Promessa projetada não se retira depois. O fecho é o que mais tranquiliza engenheiro na sala: a assinatura, e o risco que vem com ela, não mudam de dono.\n\nRÉPLICA PROVÁVEL 1 — 'então põe o código em custódia': DECIDIDO, ela está disponível — mas nunca de graça. A contrapartida é PRAZO: a custódia entra se o piloto virar contrato longo. Dizer as duas coisas na mesma frase, porque cedida sozinha ela vira o novo ponto de partida da negociação.\n\nRÉPLICA PROVÁVEL 2 — 'prazo de resposta sem multa é papel': DECIDIDO, NÃO há multa. O prazo já é o compromisso, e contrato descumprido tem consequência sem precisar de cláusula de multa. Não ceder aqui no calor da reunião: esta linha foi escrita justamente para isso.\n\nRÉPLICA PROVÁVEL 3 — 'e se der problema num sábado?': o prazo escrito vale para problema que impeça o uso, não para toda dúvida. Dizer isso com essas palavras, sem prometer plantão.",
    corpo: (
      <Confronto
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
        leitura={[
          {
            texto:
              "A responsabilidade técnica não muda de mãos, e nunca esteve na mesa.",
          },
          {
            texto:
              "Quem assina o projeto continua sendo quem responde por ele —",
            chave: true,
          },
          { texto: "hoje, sem conferência nenhuma, e depois.", chave: true },
        ]}
      />
    ),
  },

  {
    rotulo: "Motivo da venda",
    numero: "16",
    bloco: "Possíveis perguntas",
    titulo: "Motivo da venda",
    notas:
      "A FOLHA DEIXOU DE SER UMA OBJEÇÃO em 09/09/2026. Antes ela punha na tela a acusação ('você é nosso funcionário, por que estamos pagando?') e respondia. Emprestar essa frase à sala é dar munição que talvez ninguém fosse buscar — e, com a relação em PJ, ela nem se sustenta. Agora a folha AFIRMA: três fatos, ditos por mim, antes de alguém precisar perguntar.\n\nFALAR DEVAGAR E NÃO JUSTIFICAR MAIS DO QUE ESTÁ ESCRITO. Quem explica demais parece estar se defendendo de algo.\n\nSE VIER 'e o que diz o seu contrato?': CONFERIDO — foi lido, e NÃO há cláusula de cessão sobre o que eu crio fora dele. Responder isso e parar; a resposta curta é a mais forte.\n\nSE VIER 'você testou com os nossos projetos, isso é informação da empresa': os documentos foram lidos, não copiados nem guardados, e o produto não contém nenhum trecho deles. O que aprendi lendo é conhecimento profissional — o mesmo que qualquer projetista leva de um projeto para o seguinte.\n\nSE VIER 'te pago as suas horas e o software passa a ser nosso': a folha que respondia isso saiu do deck em 09/09/2026, e a resposta agora é de boca. Comprar as minhas horas compraria o passado; quem mantém o sistema na semana que vem é a licença. Compra é outra negociação, com outro número e outro contrato — e eu ouço, só não é a que eu vim propor hoje. A MOEDA DE TROCA, se travar, é a CUSTÓDIA DO CÓDIGO: vale PRAZO, nunca desconto.\n\nO TERCEIRO FATO NÃO É AMEAÇA, e não se diz com esse tom. Ele explica por que existe preço em vez de doação — e, dito antes de perguntarem, tira o assunto da mesa.",
    corpo: (
      <Confronto
        titulo={["Três fatos,", "ditos antes de alguém", "precisar perguntar."]}
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
        leitura={[
          { texto: "O problema é da casa. A solução não nasceu dela —" },
          {
            texto:
              "e serve a qualquer escritório que entregue projeto para prefeitura.",
            chave: true,
          },
        ]}
      />
    ),
  },
];
