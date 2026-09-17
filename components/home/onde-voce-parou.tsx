"use client";

/**
 * A PRIMEIRA PERGUNTA DE QUEM ENTRA: onde eu estava.
 *
 * A home respondia isso olhando só AUDITORIAS e projetos com achado pendente.
 * Quem passou o dia montando VOLUME não via nada — volume não é auditoria nem
 * gera achado, e metade do produto ficava invisível na tela mais cara.
 *
 * DUAS ALTURAS, e a diferença entre elas é o desenho:
 *
 *   · a RETOMADA — uma linha, o trabalho mais recente, um botão. É a resposta
 *     literal à pergunta, e por isso não divide espaço com nada;
 *   · os PROJETOS — a lista do que se tocou, agrupada por pasta, que é como o
 *     escritório chama um projeto (`088-25 · CRICIUMA`).
 *
 * A SEPARAÇÃO DE 31/08/2026 tirou as duas do mesmo bloco.
 *
 * Elas nasceram juntas, uma embaixo da outra, e o resultado na tela era o
 * defeito que se via de longe: a home listava PROJETO três vezes na mesma
 * dobra — aqui, no cartão de "Seus projetos abertos" logo abaixo, e outra vez
 * na coluna da direita, que ainda por cima se chamava "Onde você parou" como
 * esta seção. Dois títulos iguais em telas diferentes é confusão; dois títulos
 * iguais na MESMA tela é a interface admitindo que não sabe o que está
 * dizendo.
 *
 * Então cada altura virou um componente, e cada um foi para o lugar em que
 * responde alguma coisa: a RETOMADA em largura total, no topo, porque é a
 * única ação primária desta tela; o TRABALHO RECENTE na coluna da direita, que
 * é onde o produto já guarda "o que passou". Ver `PainelDoUsuario`.
 *
 * SEM CARTÕES na lista. A DESIGN.md pede densidade e régua de 1px, e uma grade
 * de cartões iguais é o desenho que este produto recusa por escrito ("evitar
 * cards coloridos, ruído visual e ornamentação sem função"). Teal aparece uma
 * vez, no botão de retomar, que é o único interativo primário.
 */

import { formatarDiaMes } from "@/lib/fuso-de-brasilia";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

import type { ConversaCrua, ProjetoRecente } from "@/lib/trabalho-recente";

/** "há 4 min", "há 3 h", "ontem", "12/08" — a régua que a home já usa. */
function quando(ms: number, agora = Date.now()): string {
  const min = Math.max(0, Math.round((agora - ms) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `há ${horas} h`;
  if (horas < 48) return "ontem";
  return formatarDiaMes(ms);
}

/** O nome que a pessoa reconhece: o contrato e a cidade, ou a chave crua. */
function nomeDoProjeto(p: ProjetoRecente): string {
  if (p.chave === "") return "Sem projeto";
  if (!p.codigo) return p.chave;
  return `${p.codigo} · ${p.cliente}`;
}

/*
 * `oQueTem` MORREU AQUI (09/09/2026), e a lápide vale a linha.
 *
 * Ela montava "3 volumes · 1 auditoria" para a segunda linha do Retomar. A
 * contagem é da PASTA, e responde uma pergunta que ninguém faz num bloco
 * chamado "Retomar" — quem clica em Continuar quer voltar para UMA conversa,
 * não saber quantas existem na pasta. Ela era o quarto de cinco termos numa
 * linha que a prioridade pedia com três.
 *
 * O vocabulário sobrevive onde ele serve: a barra lateral conta a pasta, e é
 * a tela da pasta. Quem precisar dele aqui de novo, copie de lá — e escreva
 * por que a pergunta mudou.
 */

const CAMINHO = (id: string) => `/nexo?conversa=${encodeURIComponent(id)}`;

/**
 * A RETOMADA — uma linha e um botão, e nada mais.
 *
 * Ela não tem título próprio desde 31/08/2026, e a falta é de propósito. Um
 * "ONDE VOCÊ PAROU" em versalete acima de UMA linha é rótulo para um dado só:
 * ocupa a mesma altura do conteúdo que anuncia e empurra o botão para longe do
 * topo. O que a seção precisava dizer ("isto é a continuação do seu trabalho")
 * quem diz agora é o próprio botão, que carrega a palavra Continuar.
 *
 * SUPERFÍCIE DE CARTÃO, e não texto solto no fundo. Esta é a única ação
 * primária da primeira dobra; sobre o fundo da página ela lia como mais um
 * parágrafo com um botão no canto. Matte (§4) — o vidro desta tela mora só na
 * barra do topo.
 */
export function OndeVoceParou({
  ondeParou,
  retomada,
}: {
  ondeParou: ConversaCrua | null;
  /**
   * A PASTA desta retomada, já resolvida pelo servidor.
   *
   * Era a lista inteira de pastas recentes, e este componente achava a certa
   * dentro dela — porque a lista existia de qualquer jeito para a coluna da
   * direita. A coluna morreu (ver [[painel-do-usuario.tsx]]); procurar numa
   * lista de seis para usar uma é trabalho que ninguém pediu.
   */
  retomada: ProjetoRecente | null;
}) {
  if (!ondeParou) return null;

  const daRetomada = retomada;

  return (
    <section
      aria-labelledby="onde-parou"
      className="nx-edge-8"
      style={{ "--nx-fill": "var(--card)" } as React.CSSProperties}
    >
      <h2 id="onde-parou" className="sr-only">
        Onde você parou
      </h2>

      {/* py-3 e não py-4: o card perdeu 8px de altura na dobra mais cara da
          tela, e não perdeu nada de conteúdo — as duas linhas continuam
          inteiras, só pararam de flutuar no meio de uma folga que não
          separava nada. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3">
        {/*
          O RÓTULO É A ETIQUETA DA LINHA, e não um cabeçalho de seção: ele fica
          NO bloco, à esquerda do dado que qualifica, na mesma altura. É a
          diferença entre gastar uma linha inteira para dizer "onde você parou"
          e gastar a margem esquerda de uma linha que já existia.
        */}
        <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Retomar
        </span>

        {/*
          A AÇÃO SUBIU, O CÓDIGO DESCEU (09/09/2026).

          A linha forte era `SIM104-26 · CHAPECÓ` e a fraca era `Auditoria do
          memorial — ARQ`. A ordem estava invertida em relação à pergunta que o
          bloco responde: quem clica "Continuar" está voltando para uma TAREFA,
          não para uma pasta. O código continua ali — é o que identifica a obra
          — mas como metadado da tarefa, que é o que ele é neste bloco.

          E a troca conserta uma repetição que nem se via de tão constante: o
          código aparecia aqui em 15px e outra vez, quatro linhas abaixo, na
          ficha do primeiro cartão de projeto. Duas vezes o mesmo dado na mesma
          dobra, e a segunda com mais razão de estar lá.
        */}
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[15px] font-medium leading-snug text-foreground">
            {ondeParou.title}
          </p>
          {/*
            QUATRO TERMOS VIRARAM TRÊS, e o que saiu foi o `oQueTem`.

            A linha era `SIM104-26 · CHAPECÓ · 1 auditoria · há 4 min · análise
            rodando`. "1 auditoria" é a contagem da PASTA, e ela responde uma
            pergunta que ninguém faz num bloco chamado "Retomar" — quem clica em
            Continuar quer voltar para UMA conversa, não saber quantas existem
            na pasta. Ela sobrevive inteira na barra lateral, que é a tela da
            pasta.

            O que sobrou é a prioridade pedida: projeto, município, tempo. E o
            status vira o quarto termo só quando existe.

            `·` COMO SEPARADOR, e não `gap` mudo: com quatro termos de larguras
            diferentes, o espaço sozinho lia como quebra de coluna.
          */}
          <p className="m-0 mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[12px] leading-5 text-muted-foreground">
            <span className="tracking-[0.03em] text-foreground">
              {daRetomada ? nomeDoProjeto(daRetomada) : "sem projeto"}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{quando(ondeParou.updatedAt)}</span>
            {daRetomada?.emCurso ? (
              <>
                <span aria-hidden>·</span>
                {/*
                  AZUL, e não mais âmbar. Âmbar nesta tela significa "está parado
                  esperando você" (o chip do projeto), e "análise rodando" é o
                  oposto exato disso. `--signal-info` é o token que a DESIGN.md
                  destina a "aviso que NÃO é status", com `AuditoriaEmCurso`
                  nomeado como consumidor — e é o mesmo azul da legenda do orbe,
                  logo acima, que diz a mesma coisa.
                */}
                <span className="inline-flex items-center gap-1 text-[var(--signal-info)]">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  análise rodando
                </span>
              </>
            ) : null}
          </p>
        </div>

        <Link
          href={CAMINHO(ondeParou.id)}
          className="nx-edge-7 inline-flex shrink-0 items-center gap-2 px-4 py-2 text-[12.5px] font-medium text-[var(--primary-foreground)] transition-colors [--nx-edge:var(--primary)] [--nx-fill:var(--primary)] hover:[--nx-edge:var(--primary-hover)] hover:[--nx-fill:var(--primary-hover)] focus-visible:outline-none"
        >
          Continuar
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/**
 * O TRABALHO RECENTE — as OUTRAS pastas em que se mexeu.
 *
 * Ele mora na coluna da direita, e o vizinho de cima (a retomada) já levou a
 * pasta mais recente; por isso o `filter`. Sem ele, o primeiro item desta lista
 * seria a repetição literal do bloco anterior.
 *
 * ESTA LISTA SUBSTITUIU as "auditorias recentes" que ficavam aqui
 * (`painel.recentes`). As duas respondiam a mesma pergunta com dados
 * diferentes: aquela listava o TÍTULO da auditoria, esta lista a PASTA e o que
 * tem dentro — e a pasta é como o escritório chama as coisas. As duas juntas na
 * mesma coluna listavam `088-25` duas vezes com rótulos diferentes.
 *
 * Régua de 1px entre linhas, sem cartão e sem divisor vertical — o padrão de
 * tabela da DESIGN.md, que favorece ver muitas linhas de uma vez.
 */
