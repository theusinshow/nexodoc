"use client";

/**
 * O PAINEL — a primeira tela depois do login.
 *
 * A REORGANIZAÇÃO DE 25/08/2026 trocou o que ocupa a primeira dobra.
 *
 * Havia aqui uma faixa de herói de 250px: o orbe vivo à esquerda e, ao lado,
 * "Fale com o Nexo · ou solte um PDF em qualquer lugar da tela". Ela era o
 * convite mais bonito do produto e o pior uso possível do espaço mais caro dele
 * — porque o que ela oferecia já estava em outro lugar da mesma tela. A porta
 * para a conversa virou o botão do orbe, no centro da barra do topo, presente em
 * toda rota; e soltar um PDF sempre funcionou na tela inteira, o que fazia da
 * frase um aviso, e não um controle.
 *
 * No lugar entrou a AÇÃO, em largura total — e a troca desenterrou um defeito
 * que estava aqui desde sempre.
 *
 * ESTA TELA NUNCA SOUBE RECEBER UM ARQUIVO. O `onDrop` do container chamava
 * `preventDefault()` e zerava o realce, e era só isso: o `File` ia para o lixo.
 * Mesmo assim a tela prometia o contrário em três lugares — o subtítulo do
 * herói ("ou solte um PDF em qualquer lugar da tela"), o cartão da coluna da
 * direita ("Solte um PDF aqui") e a tarja flutuante que aparecia durante o
 * arrasto ("Solte o PDF para iniciar a auditoria"). Quem arrastava via a
 * interface inteira confirmar o gesto e não acontecia nada.
 *
 * O único lugar do produto que lê arquivo solto é o `/nexo`
 * (`NexoWorkspace`, ouvindo `drop` na janela e entregando a `readSelos`).
 * Levar o `File` daqui para lá é possível — mesma runtime numa navegação de
 * cliente, então um módulo de entrega sobreviveria ao `router.push` —, mas a
 * ponta que recebe mora no workspace, e isso é obra de outra frente.
 *
 * Então as promessas saíram, e no lugar delas ficou um controle que FUNCIONA: a
 * faixa é um link para o Nexo, onde soltar documento realmente começa uma
 * auditoria. O `preventDefault` do container fica — sem ele, arrastar um PDF
 * para cá faz o NAVEGADOR abrir o arquivo e a sessão vai embora com a página.
 *
 * A CORREÇÃO DE 26/08/2026 levou esse raciocínio até o fim: a faixa também
 * saiu. Ela era a SEGUNDA porta para o `/nexo` na mesma dobra, a poucos
 * centímetros da primeira — e a primeira agora é um orbe de 128px sentado na
 * borda da barra, que ninguém confunde com outra coisa. No lugar da faixa ficou
 * o `ConviteDoOrbe`: a legenda daquele objeto, sem alvo de clique próprio.
 *
 * E QUANDO NÃO HÁ TRABALHO NENHUM, a tela mostra a MESMA lista, vazia, com a
 * linha que diz o que fazer para preenchê-la. Havia aqui um `PrimeirosPassos`:
 * seis fichas descrevendo as capacidades do produto para quem entrava pela
 * primeira vez. Ele saiu em 09/09/2026 — esta tela é o lugar de trabalho de
 * quem já entrou, não a vitrine de quem está decidindo entrar, e apresentar o
 * software a quem acabou de fazer login é responder uma pergunta que ninguém
 * fez. Quem chega sem projeto tem uma frase e um orbe, que é tudo de que
 * precisa.
 *
 * A ESCADA DO ORBE (§6) sai desta tela sem perder nada. O orbe vivo era o único
 * consumidor de WebGL do painel; sem ele, a home não monta three.js. O degrau
 * capturado — `MarcaViva`, que volta a viver no hover — assumiu dentro do botão
 * do topo, e a regra "um orbe vivo por tela" volta a ser trivialmente verdadeira
 * aqui: são zero.
 *
 * A COLUNA DA ESQUERDA CONTINUA SENDO O PROJETO, e não a fila. É a diferença
 * entre esta tela e o que `GET /api/trabalho/meu` responde: lá a pergunta é "o
 * que exige ação SUA", aqui é "onde você está trabalhando". Por isso um projeto
 * sem pendência nenhuma aparece, e por isso o que você ENVIOU aparece junto do
 * que recebeu — o cartão é do projeto, não seu.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Ima } from "@/components/ambiente/ima";
import { BarraDoTopo } from "@/components/layout/barra-do-topo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  abreSozinho,
  contadoresDaAtencao,
  ehOrdem,
  iniciaisDe,
  LIMIAR_TARJA,
  ordenarLista,
  resumoDoProjeto,
  type ContadorDaAtencao,
  type FocoDaAtencao,
  type OrdemDaLista,
} from "@/lib/atencao-do-painel";
import type { ItemDoPainel, Painel, ProjetoDoPainel } from "@/lib/painel";
import type { EscopoDaLista } from "@/lib/preferencias-da-home";
import { MarcaDaPrefeitura } from "@/modules/nexo/components/MarcaDaPrefeitura";
import { cn } from "@/lib/utils";
import { ControlesDaLista } from "./controles-da-lista";
import { usePreferenciasDaHome } from "./use-preferencias-da-home";
import { OndeVoceParou } from "./onde-voce-parou";
import { PersonalizarHome } from "./personalizar-home";
import { PrecisaDaSuaAtencao } from "./precisa-da-sua-atencao";
import { SeuEspaco } from "./seu-espaco";
import { DURATION } from "@/modules/nexo/lib/motion";

/** Quanto o véu leva para fechar. Mesmo token do `BotaoDoOrbe`, não uma cópia. */
const PARTIDA_MS = DURATION.base;

type Props = {
  nome: string;
  iniciais: string;
  escritorio: string;
  ehAdmin: boolean;
};

/** O painel que chegou, com a marca de QUAL aba ele responde. */
type Carga = Painel & { escopo: EscopoDaLista };

export function PainelDoUsuario({ nome, iniciais, escritorio, ehAdmin }: Props) {
  const [painel, setPainel] = useState<Carga | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  /*
   * AS PREFERÊNCIAS VÊM DE FORA DO REACT, e é por isso que não são `useState`.
   *
   * Elas moram no `localStorage`, que o servidor não tem: ler no inicializador
   * do `useState` faz o HTML do servidor divergir do primeiro render do cliente
   * (hydration mismatch, e o React apaga a árvore para redesenhar), e ler num
   * `useEffect` com `setState` é um render em cascata a cada visita — que é o
   * que `react-hooks/set-state-in-effect` recusa.
   *
   * `usePreferenciasDaHome` é `useSyncExternalStore` por baixo, que é a API que o
   * React tem exatamente para isto: servidor e primeira pintura usam o PADRÃO,
   * o valor do disco entra no quadro seguinte, e nada diverge. Ver
   * [[components/home/use-preferencias-da-home.ts]].
   */
  const [prefs, mudarPrefs] = usePreferenciasDaHome();
  const [personalizando, setPersonalizando] = useState(false);

  /** O contador clicado na faixa. Nulo = a lista inteira. */
  const [foco, setFoco] = useState<FocoDaAtencao | null>(null);

  /*
   * A PARTIDA PELO ORBE.
   *
   * Quem começa é o `BotaoDoOrbe` (é dele o gesto, e é ele quem navega); o que
   * este estado faz é APAGAR O TRABALHO enquanto isso. Sem ele, o orbe crescia
   * sozinho no meio de uma tela cheia de projetos, e a leitura era de um botão
   * com defeito em vez de uma página saindo de cena.
   *
   * Não há caminho de volta para `false`, e é assim de propósito: a única saída
   * deste estado é a página desmontar, porque a navegação aconteceu. Um estado
   * que se desfaz sozinho abriria a porta para o painel reaparecer meio segundo
   * depois de alguém já ter pedido o Nexo.
   */
  const [partindo, setPartindo] = useState(false);

  /*
   * A BUSCA REFAZ QUANDO O ESCOPO MUDA, e só quando ele muda.
   *
   * `escopo` é a única preferência que o SERVIDOR precisa saber — as outras
   * (ordem, quantos, quais widgets) são aritmética no navegador sobre a mesma
   * carga. Pôr `prefs` inteiro na lista de dependências faria arrastar um
   * widget disparar uma consulta ao banco.
   */
  useEffect(() => {
    let vivo = true;
    const escopo = prefs.escopo;

    fetch(`/api/painel?escopo=${escopo}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((dados: Painel) => {
        if (!vivo) return;

        /*
         * A CARGA CARREGA O ESCOPO DELA, e o `carregando` vira uma COMPARAÇÃO.
         *
         * Havia um `setPainel(null)` no corpo deste efeito para limpar a tela
         * ao trocar de aba — um `setState` síncrono em efeito, que a regra do
         * React recusa, e que de quebra piscava o esqueleto por cima de uma
         * lista perfeitamente boa. Guardando de QUAL escopo é o que está na
         * tela, "estou carregando" passa a ser "o que tenho não é o que pedi",
         * sem estado extra — e a lista velha fica visível até a nova chegar,
         * que é o comportamento melhor dos dois.
         */
        setPainel({ ...dados, escopo });

        /*
         * ABRE SOZINHO SÓ O QUE É PARA VOCÊ.
         *
         * Antes o primeiro cartão abria SEMPRE, e na medição de 01/09/2026 isso
         * expandiu cinco achados que estavam com outra pessoa — a dobra inteira
         * gasta com o que ninguém pode fazer agora. A regra mora em
         * [[lib/atencao-do-painel.ts]], com teste sem navegador.
         *
         * ELA CORRE SOBRE `ordemDaAtencao`, sempre — e não sobre a ordenação
         * escolhida. "O primeiro" só quer dizer "o mais parado" na ordem de
         * atenção; em A–Z, o primeiro cartão é o que começa com A, e abri-lo
         * seria expandir um projeto ao acaso.
         */
        const paraAbrir = abreSozinho(enriquecer(dados.projetos));
        setAbertos(paraAbrir ? { [paraAbrir]: true } : {});
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });

    return () => {
      vivo = false;
      // A falha é da carga que morreu junto com o efeito. Deixá-la de pé faria
      // a aba nova nascer com o aviso de erro da aba velha.
      setFalhou(false);
    };
  }, [prefs.escopo]);

  const carregando = painel?.escopo !== prefs.escopo && !falhou;

  /*
   * A LISTA, EM TRÊS PASSADAS: enriquece, filtra pelo foco, ordena.
   *
   * Ela era ordenada UMA vez, na chegada, e guardada pronta — porque só havia
   * uma ordem. Com quatro ordens e um filtro que se liga e desliga, guardar o
   * resultado significaria refazer a consulta a cada clique num contador. O
   * `useMemo` faz o mesmo trabalho de graça, e a decisão de abertura acima
   * continua vindo da ordem de atenção, que é a única em que "o primeiro"
   * significa alguma coisa.
   */
  const enriquecidos = useMemo(() => enriquecer(painel?.projetos ?? []), [painel]);

  const contadores = useMemo(() => contadoresDaAtencao(enriquecidos), [enriquecidos]);

  const ordem: OrdemDaLista = ehOrdem(prefs.ordem) ? prefs.ordem : "parados";

  const lista = useMemo(() => {
    const filtrados = enriquecidos.filter((p) => {
      if (foco === "com-voce") return p.recebidos > 0;
      if (foco === "parados") return p.recebidos > 0 && p.diasParado >= LIMIAR_TARJA;
      if (foco === "com-outros") return p.enviados > 0;
      return true;
    });

    return ordenarLista(filtrados, ordem);
  }, [enriquecidos, foco, ordem]);

  const visiveis = lista.slice(0, prefs.projetosVisiveis);
  const vazio = Boolean(painel && lista.length === 0);
  /*
   * SEM PROJETO NENHUM ≠ FILTRO QUE NÃO ACHOU NADA. As duas telas são vazias e
   * dizem coisas opostas: uma manda enviar o primeiro documento, a outra manda
   * tirar o filtro. Mandar a segunda pessoa criar um projeto é a interface
   * respondendo a pergunta errada.
   */
  const filtrouTudo = vazio && enriquecidos.length > 0;

  return (
    <div
      /*
       * PROTEÇÃO, e não recurso. Sem estes dois `preventDefault`, soltar um PDF
       * na janela faz o navegador ABRIR o arquivo — a página do painel é
       * substituída pelo visualizador de PDF nativo e o trabalho na tela some.
       * Eles não aceitam o documento; eles impedem que o gesto destrua a sessão.
       * Quem aceita documento é o `/nexo`, para onde a faixa aponta.
       */
      onDragOver={(ev) => ev.preventDefault()}
      onDrop={(ev) => ev.preventDefault()}
      className="relative flex min-h-screen flex-col bg-background"
    >
      <BarraDoTopo
        nome={nome}
        iniciais={iniciais}
        escritorio={escritorio}
        ehAdmin={ehAdmin}
        partindo={partindo}
        aoPartir={() => setPartindo(true)}
      />

      {/*
        O VÉU — o trabalho saindo de cena por CIMA, e não por dentro.

        Aqui o `<main>` inteiro é que se apagava (`opacity-0` + 6px de
        deslocamento), e essa era a segunda causa do travamento. Apagar uma
        subárvore desse tamanho obriga o navegador a rasterizar a página toda
        numa camada — dezenas de cartões, cada um com `clip-path` e
        pseudo-elemento — no exato quadro em que o Nexo começa a montar do outro
        lado. As duas coisas disputam a mesma thread, e quem perde é a animação.

        O véu faz o mesmo efeito com uma camada só: um retângulo da cor do fundo
        que aparece por cima. Retângulo de cor sólida em opacidade é o caso mais
        barato que existe — o compositor resolve sozinho, e continua a 60fps
        mesmo com a thread principal ocupada montando three.js. E ele nem precisa
        de `will-change`: opacidade em animação já promove a camada.

        `z-30` e não mais: a barra é `z-40`, então o véu cobre o trabalho e passa
        POR BAIXO do orbe. É isso que deixa a esfera acesa sozinha no escuro em
        vez de ser engolida junto.

        A §5 continua valendo — o trabalho sai em BLOCO, nunca em cascata pelos
        filhos. Só mudou quem pinta o bloco.
      */}
      {partindo ? (
        <div
          aria-hidden
          className="fixed inset-0 z-30 bg-background"
          style={{ animation: `nx-veu-da-partida ${PARTIDA_MS}ms var(--ease-feedback) both` }}
        />
      ) : null}

      <main
        className={cn(
          "mx-auto w-full max-w-[1520px] flex-1 px-4 pb-16 sm:px-8",
          partindo && "pointer-events-none",
        )}
      >
        {/*
          O CONVITE VOLTOU PARA O TOPO (31/08/2026), e não é preferência de
          ordem: é GEOMETRIA. O orbe tem 128px e pende do centro da borda
          inferior da barra, então 64px dele caem sobre esta região — e o
          `ConviteDoOrbe` é quem reserva esse vão (os `pt-[84px]`, ver lá).

          Com o `OndeVoceParou` na frente dele, quem passava por baixo do orbe
          era a retomada, e a legenda ia parar no meio da página, a 300px do
          objeto que ela legenda — um fio de 20px saindo do nada em direção a um
          texto sem dono. O orbe ficava sem frase e a frase ficava sem orbe.

          A ordem certa continua respeitando o que `app/page.tsx` diz desde
          14/08 ("a primeira pergunta é onde eu estava"): o convite é UMA LINHA
          de legenda mais um parágrafo, não uma faixa de herói — a retomada
          entra logo abaixo, ainda na primeira dobra, e agora com peso de cartão
          em vez de texto solto.
        */}
        <ConviteDoOrbe
          nome={nome}
          contadores={contadores}
          emCurso={painel?.trabalho.retomada?.emCurso ? painel.trabalho.retomada.codigo : null}
          carregando={carregando}
        />

        {painel?.trabalho.ondeParou ? (
          <div className="mt-6">
            <OndeVoceParou
              ondeParou={painel.trabalho.ondeParou}
              retomada={painel.trabalho.retomada}
            />
          </div>
        ) : null}

        {prefs.mostrarAtencao ? (
          <PrecisaDaSuaAtencao contadores={contadores} foco={foco} aoFocar={setFoco} />
        ) : null}

        {/*
            UMA COLUNA SÓ, desde 03/09/2026.
            A da direita mostrava as pastas recentes e parecia repetir a
            esquerda — quatro dos cinco projetos apareciam nas duas. Só que as
            fontes eram DIFERENTES: a esquerda vinha de achados e auditorias, a
            direita de conversas, e uma obra em que só se montou volume existia
            apenas lá. Fundir sem cuidado a teria apagado da home.
            A fusão está em [[lib/painel.ts]]; aqui sobrou uma lista.
        */}
        <div className="mt-6 flex flex-col items-start gap-8">
          <section className="flex w-full min-w-0 flex-col gap-2.5">
            {/*
              OS CONTROLES NA LINHA DO TÍTULO, e não numa barra própria: o canto
              direito desta linha já estava vazio (era o texto morto "mais
              parados primeiro"), e uma toolbar acrescentaria 40px de cromo
              antes do primeiro projeto numa tela que tem uma dobra só.

              `items-center` e não mais `items-baseline`: com um controle
              segmentado de 26px de altura ao lado, alinhar pela linha de base
              do texto pendura o segmentado acima do título.
            */}
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Seus projetos abertos
              </h2>
              <div className="flex-1" />
              {painel ? (
                <ControlesDaLista
                  escopo={prefs.escopo}
                  aoTrocarEscopo={(e: EscopoDaLista) => mudarPrefs({ ...prefs, escopo: e })}
                  ordem={ordem}
                  aoTrocarOrdem={(o) => mudarPrefs({ ...prefs, ordem: o })}
                />
              ) : null}
            </div>

            {carregando ? <Esqueleto /> : null}

            {falhou ? (
              <p className="max-w-[46ch] py-6 text-sm leading-normal text-muted-foreground">
                Não deu para carregar seus projetos agora. O Nexo continua funcionando —
                recarregue a página quando quiser tentar de novo.
              </p>
            ) : null}

            {/*
              DOIS VAZIOS, e não um. Quem filtrou e não achou nada precisa saber
              que o FILTRO é o motivo — mandá-lo enviar o primeiro documento
              seria a tela respondendo a pergunta errada com convicção.
            */}
            {filtrouTudo ? (
              <div className="px-0.5 py-6">
                <p className="mb-2 text-base font-medium text-foreground">
                  Nenhum projeto neste filtro.
                </p>
                <button
                  type="button"
                  onClick={() => setFoco(null)}
                  className="cursor-pointer font-mono text-xs tracking-[0.05em] text-primary transition-colors duration-[var(--duration-fast)] hover:text-[var(--nexodoc-accent)]"
                >
                  Ver todos os {enriquecidos.length} projetos →
                </button>
              </div>
            ) : null}

            {vazio && !filtrouTudo ? (
              <div className="px-0.5 py-6">
                <p className="mb-2 text-base font-medium text-foreground">
                  {prefs.escopo === "todos"
                    ? "Nada em aberto no escritório."
                    : "Nenhum projeto seu por aqui ainda."}
                </p>
                <p className="m-0 max-w-[44ch] text-sm leading-normal text-muted-foreground">
                  Abra o Nexo e envie o primeiro documento: o centro de custo é lido do PDF e a
                  pasta nasce a partir dele.
                </p>
              </div>
            ) : null}

            {visiveis.map((projeto) => (
              <CartaoDeProjeto
                key={projeto.projectId}
                projeto={projeto}
                aberto={Boolean(abertos[projeto.projectId])}
                alternar={() =>
                  setAbertos((atual) => ({
                    ...atual,
                    [projeto.projectId]: !atual[projeto.projectId],
                  }))
                }
              />
            ))}

            {painel && !vazio ? (
              <div className="mt-2 flex w-full flex-wrap items-baseline gap-x-4 gap-y-1">
                <Link
                  href="/projetos"
                  className="self-start font-mono text-xs tracking-[0.05em] text-primary transition-colors duration-[var(--duration-fast)] hover:text-[var(--nexodoc-accent)]"
                >
                  Ver todos os projetos do escritório →
                </Link>
                {/*
                  O QUE FICOU DE FORA, dito em número. Sem esta linha, uma lista
                  cortada em 8 é indistinguível de uma lista que tem 8 — e a
                  pessoa não tem por que suspeitar que existe mais nada. Quantos
                  aparecem é escolha dela, em Personalizar.
                */}
                {lista.length > visiveis.length ? (
                  <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                    mostrando {visiveis.length} de {lista.length}
                  </span>
                ) : null}
              </div>
            ) : null}
          </section>

          <SeuEspaco widgets={prefs.widgets} aoPersonalizar={() => setPersonalizando(true)} />
        </div>
      </main>

      {personalizando ? (
        <PersonalizarHome
          prefs={prefs}
          aoMudar={mudarPrefs}
          aoFechar={() => setPersonalizando(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * O QUE A ORDENAÇÃO E OS CONTADORES PRECISAM SABER, e o painel não manda.
 *
 * `ProjetoDoPainel` carrega `itens` com direção; as três derivadas (`recebidos`,
 * `enviados`, `atualizadoEmMs`) saem daí por contagem. Estava embutido no
 * `.then` da busca, e virou função porque agora tem DOIS chamadores em momentos
 * diferentes: a decisão de qual cartão abre (na chegada) e o `useMemo` da lista
 * (a cada filtro ou ordem). Duas cópias da mesma contagem é como uma delas
 * envelhece sozinha.
 */
function enriquecer(projetos: readonly ProjetoDoPainel[]) {
  return projetos.map((p) => ({
    ...p,
    recebidos: p.itens.filter((i) => i.direcao === "recebido").length,
    enviados: p.itens.filter((i) => i.direcao === "enviado").length,
    atualizadoEmMs: Date.parse(p.atualizadoEm) || 0,
  }));
}

/**
 * O CONVITE DO ORBE — a legenda que virou MOSTRADOR.
 *
 * Aqui havia a FAIXA DE ENTRADA: um bloco de 120px em largura total, com ícone
 * de upload e um link para o `/nexo`. Ela saiu em 26/08/2026 porque era a
 * segunda porta para o MESMO destino, a dois centímetros da primeira — e a
 * primeira agora é um orbe de 128px sentado na borda da barra, que ninguém
 * confunde com outra coisa. O que ficou é a PORTA e a LEGENDA dela.
 *
 * O QUE MUDOU EM 09/09/2026: a legenda parou de ser fixa.
 *
 * Ela dizia "CLIQUE NO ORBE PARA FALAR COM O NEXO" e, embaixo, "Auditoria de
 * memorial, montagem de volume ou lista de documentos". Duas linhas de
 * instrução, idênticas todo dia, no ponto mais caro da tela — e quem abre esta
 * tela pela décima vez já sabe as duas. A instrução não sumiu: ela DESCEU para
 * a segunda linha, junto com a saudação, e o lugar de honra passou a ser
 * ocupado pelo ESTADO.
 *
 * TRÊS ESTADOS, em ordem de precedência, e a ordem é a decisão:
 *
 *  1. ANALISANDO — há auditoria rodando agora. Vence tudo porque é a única
 *     coisa da tela que muda sozinha enquanto a pessoa olha;
 *  2. N ESPERAM POR VOCÊ — a soma do que a faixa detalha logo abaixo;
 *  3. TUDO EM DIA — e ele só aparece quando a resposta é REALMENTE essa. Ver o
 *     `carregando`.
 *
 * "TUDO EM DIA" ENQUANTO CARREGA SERIA MENTIRA, e das piores: a frase é boa
 * notícia, ela apareceria por 300ms em toda visita, e quem lesse rápido sairia
 * da tela achando que não tinha nada. Enquanto o painel não chega, a legenda é
 * a instrução de sempre — que é verdadeira em qualquer estado.
 *
 * O VÃO DE 78px NÃO É ESPAÇAMENTO, É ESTRUTURA. O orbe tem 128px e está
 * ancorado no CENTRO da borda inferior da barra, então 64px dele pendem sobre
 * esta região — 75 quando o `:active` o infla em 17%. Eram 84; os 78 são os 75
 * mais a folga mínima. Quem mexer neste número sem mexer no `tamanho` da
 * `BarraDoTopo` põe o texto embaixo da esfera.
 *
 * O FIO amarra os dois: um gradiente que nasce na cor da borda e morre no nada,
 * saindo de baixo do orbe em direção à frase. Sem ele o texto lê como subtítulo
 * da página; com ele, como a legenda daquele objeto.
 */
function ConviteDoOrbe({
  nome,
  contadores,
  emCurso,
  carregando,
}: {
  nome: string;
  contadores: ContadorDaAtencao[];
  /** O código da obra sendo analisada agora, ou nulo. */
  emCurso: string | null;
  carregando: boolean;
}) {
  const comVoce = contadores.find((c) => c.foco === "com-voce")?.quantos ?? 0;

  const legenda = carregando
    ? "Clique no orbe para falar com o Nexo"
    : emCurso
      ? `Analisando o memorial do ${emCurso}`
      : comVoce > 0
        ? `${comVoce} ${comVoce === 1 ? "achado espera" : "achados esperam"} por você`
        : "Tudo em dia";

  return (
    <div className="flex flex-col items-center pt-[78px] text-center">
      <span
        aria-hidden
        className="h-4 w-px shrink-0"
        style={{ background: "linear-gradient(to bottom, var(--border), transparent)" }}
      />

      {/*
        `aria-live="polite"` porque esta linha MUDA sozinha: ela nasce como a
        instrução e vira o estado quando o painel chega. Sem isso, quem usa
        leitor de tela ouve a instrução e nunca fica sabendo que há três achados
        esperando — a única notícia da tela passaria calada.
      */}
      <p
        aria-live="polite"
        className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em]"
        style={{
          /*
            ÂMBAR SÓ QUANDO É STATUS. "Analisando" é processo em curso e usa o
            mesmo âmbar de `análise rodando` no cartão de retomada logo abaixo —
            a mesma coisa dita duas vezes tem que ter a mesma cor. Contagem de
            achado e "tudo em dia" são FATOS, não severidades: pintá-los faria a
            primeira dobra acender todo dia, e a §2 reserva os três sinais para
            status. Teal está fora de questão — não se clica nesta linha.
          */
          color: emCurso && !carregando ? "var(--status-warning)" : "var(--foreground)",
        }}
      >
        {legenda}
      </p>

      {/*
        A SAUDAÇÃO E A INSTRUÇÃO na mesma linha, e é o que mantém o bloco em
        DUAS linhas — a altura de antes. Uma terceira linha para dizer "Bom dia"
        custaria 22px na dobra mais cara do produto para uma informação que o
        canto superior direito já dá (o nome está na barra).

        `suppressHydrationWarning` porque a saudação depende da HORA da máquina,
        e o servidor renderiza em UTC: às 22h de Brasília o HTML do servidor diz
        "Bom dia" e o cliente diz "Boa noite". Sem isto, o React apaga a árvore
        para redesenhar por causa de duas palavras.
      */}
      <p
        suppressHydrationWarning
        className="mt-2 max-w-[58ch] text-sm leading-relaxed text-muted-foreground"
      >
        {saudacao()}, {nome}. Clique no orbe para falar com o Nexo.
      </p>
    </div>
  );
}

/** Bom dia até 12h, boa tarde até 18h, boa noite depois. */
function saudacao(hora = new Date().getHours()) {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="nx-cut-8 h-[132px] animate-pulse bg-card" />
      <div className="nx-cut-8 h-[54px] animate-pulse bg-card" />
      <div className="nx-cut-8 h-[54px] animate-pulse bg-card" />
    </div>
  );
}

/**
 * O CARTÃO DE PROJETO — reestruturado em 25/08/2026.
 *
 * Ele era uma linha de 46px em que quatro coisas de pesos diferentes disputavam
 * a mesma altura: seta, código, nome e um resumo em texto solto no canto. Numa
 * lista de dez projetos isso produzia dez linhas idênticas — para saber qual
 * delas pedia alguma coisa, era preciso LER o canto direito de cada uma.
 *
 * Três mudanças, e as três servem à mesma pergunta ("qual destes me quer?"):
 *
 *  · o TRILHO à esquerda responde antes da leitura. Cor por estado, 3px: quem só
 *    passa os olhos pela lista já separa o que espera do que não espera;
 *  · o resumo virou SELO, com fundo. Texto solto no canto tem o mesmo peso
 *    visual do nome do projeto ao lado; um selo tem peso de rótulo, que é o que
 *    ele é;
 *  · o código virou FICHA em superfície elevada. Ele é o identificador que a
 *    pessoa procura quando chega sabendo o que quer, e merecia parar de ser mais
 *    um trecho de texto no meio da linha.
 *
 * O cartão continua MATTE, sem exceção. A linha d'água (§4) põe cartão do lado
 * do dado, e nada aqui recebe `backdrop-filter` — o vidro desta tela mora só na
 * barra do topo.
 */
function CartaoDeProjeto({
  projeto,
  aberto,
  alternar,
}: {
  projeto: ProjetoDoPainel;
  aberto: boolean;
  alternar: () => void;
}) {
  const alerta = projeto.diasParado >= LIMIAR_TARJA;
  const recebidos = projeto.itens.filter((i) => i.direcao === "recebido").length;
  // O trilho tem três leituras, e não duas: parado, esperando você, e em dia.
  const trilho = alerta
    ? "var(--status-warning)"
    : recebidos > 0
      ? "var(--primary)"
      : "var(--nexodoc-raised)";

  return (
    <div
      data-cartao-de-projeto={projeto.projectId}
      className="nx-edge-8 overflow-hidden"
      /*
        A BORDA VOLTOU A SER BORDA (09/09/2026).
        Ela virava `#4a3a1c` — um âmbar escurecido, escrito à mão, fora dos
        tokens — quando o projeto passava do limiar, e a linha do cabeçalho
        ganhava `--status-warning-bg` de fundo. Numa lista com três projetos
        parados, isso pintava TRÊS FAIXAS de 800px de largura, e a tela inteira
        lia como alarme: quando metade da lista está acesa, a cor para de
        significar "olhe para este" e passa a significar "esta tela é assim".
        O sinal continua inteiro e mais forte, em três lugares pequenos: o
        trilho de 3px, o chip do tempo e a cor do texto do código.
      */
      style={{ "--nx-fill": "var(--card)" } as React.CSSProperties}
    >
      <div className="relative">
        {/*
          O TRILHO. `aria-hidden` porque ele não acrescenta informação nova — o
          selo ao lado diz a mesma coisa em palavras, e quem lê por leitor de
          tela recebe a frase, não a cor. Cor sozinha nunca carrega significado.
        */}
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-[3px] transition-colors duration-[var(--duration-fast)]"
          style={{ background: trilho }}
        />

        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          className="flex w-full cursor-pointer items-center gap-3.5 border-0 bg-transparent py-3.5 pl-5 pr-4 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--nexodoc-raised)]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
            className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-[var(--duration-fast)]"
            style={{ transform: aberto ? "rotate(90deg)" : "none" }}
          >
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/*
            A MARCA, na forma SELO — a que o módulo destina a cartão de projeto.

            O cabeçalho dela promete que "a cidade está escrita a poucos pixels
            daqui", e é o que a torna decifrável: cor mais nome. NESTA TELA A
            PROMESSA ESTAVA QUEBRADA — a cidade aparecia na coluna da direita e
            não aqui, e a marca virava três traços coloridos sem legenda. Quem
            não decorou a paleta não tinha como saber a cidade na tela
            principal. O nome entra ao lado do projeto, logo abaixo.
          */}
          <MarcaDaPrefeitura prefeitura={projeto.cliente} forma="selo" />

          {/*
            A FICHA DO CÓDIGO fica NEUTRA, sempre. Ela era pintada de âmbar
            junto com o resto — e o código é o IDENTIFICADOR, o que a pessoa
            procura quando chega sabendo o que quer. Um identificador que muda
            de cor conforme o estado do projeto é mais difícil de varrer, não
            mais fácil: o olho passa a filtrar por cor numa coluna em que ele
            deveria estar lendo texto.
          */}
          <span className="nx-cut-4 shrink-0 bg-[var(--nexodoc-raised)] px-2 py-1 font-mono text-[12px] font-semibold tracking-[0.04em] text-foreground">
            {projeto.codigo}
          </span>

          {/*
            O NOME TRUNCA, A CIDADE NÃO — e os dois ficam JUNTOS, à esquerda.

            A cidade era um `<span>` aninhado dentro do elemento que trunca, e
            por isso era a PRIMEIRA coisa a sumir: a 820px, "Reforma e ampliação
            do Pronto Atendimento…" comia a linha e TUBARÃO ficava fora da
            caixa, enquanto a marca de prefeitura continuava ali — três traços
            coloridos sem legenda. É a promessa do módulo da marca ("o nome da
            cidade está a poucos pixels daqui") quebrada na largura estreita.

            A primeira tentativa de conserto foi pior: separá-los em irmãos do
            flex mandou a cidade para a BORDA DIREITA, colada nos chips de
            estado, a 900px da marca que ela legenda. Consertou o truncamento e
            quebrou a promessa de vez, nas duas larguras.

            O certo é um grupo só: `min-w-0` para o flex poder encolher o
            conjunto, `truncate` só no nome, e a cidade `shrink-0` logo ao lado.
            O que encurta é o nome — o código, três elementos à esquerda, já
            identifica a obra sozinho.
          */}
          <span className="flex min-w-0 flex-1 items-baseline gap-1 text-sm">
            <span className="min-w-0 truncate text-foreground">{projeto.nome}</span>
            {/*
              "SEM CIDADE" POR EXTENSO, e não um separador pendurado. Com
              `cliente` vazio a linha terminava em "Reforma do Centro ·" — um
              ponto que parece erro de renderização, e não o fato de que ninguém
              cadastrou o município.
            */}
            <span className="shrink-0 text-muted-foreground">
              · {projeto.cliente.trim() || "sem cidade"}
            </span>
          </span>

          <Selo projeto={projeto} recebidos={recebidos} />
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-[var(--duration-base)] ease-[var(--ease-entrance)]"
        style={{
          gridTemplateRows: aberto ? "1fr" : "0fr",
          opacity: aberto ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 pb-4 pl-5 pr-4 pt-0.5">
            {projeto.itens.map((item, indice) => (
              <Link
                key={`${item.auditId}-${item.titulo}-${indice}`}
                href={`/nexo?auditoria=${encodeURIComponent(item.auditId)}`}
                className="flex items-center gap-3 border-t border-[var(--nexodoc-raised)] py-2.5 text-inherit transition-colors duration-[var(--duration-fast)] hover:text-[var(--nexodoc-accent)]"
              >
                <span
                  aria-hidden
                  className="nx-cut-4 h-[7px] w-[7px] shrink-0"
                  style={{ background: corDoItem(item) }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {item.titulo}
                </span>
                {/*
                  O NOME NÃO PODE EMPURRAR O TÍTULO. Com um e-mail no lugar do
                  nome, esta coluna cresceu até o título sumir por inteiro na
                  tela estreita — sobrava "de fulano@empresa.com" e nada do
                  achado. Encurtado por `nomeCurto`, travado contra quebra, e
                  escondido de todo no celular: quem é lê-se abrindo o achado.
                */}
                <span className="hidden shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:inline">
                  {item.direcao === "recebido"
                    ? `de ${nomeCurto(item.pessoa)}`
                    : `→ ${nomeCurto(item.pessoa)}`}
                </span>
                <span
                  className="shrink-0 whitespace-nowrap text-right font-mono text-[11px] tracking-[0.03em] sm:min-w-[96px]"
                  style={{
                    color:
                      item.direcao === "recebido" && item.dias >= LIMIAR_TARJA
                        ? "var(--status-warning)"
                        : "var(--muted-foreground)",
                  }}
                >
                  {rotuloDeTempo(item)}
                </span>
              </Link>
            ))}

            <div className="flex flex-wrap items-center gap-2 pt-3">
              {projeto.artefatos.map((artefato) => (
                <Link
                  key={artefato.artifactId}
                  href={`/projetos/${projeto.projectId}`}
                  className="nx-cut-5 inline-flex items-center gap-2 bg-[var(--nexodoc-raised)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground"
                >
                  <span>{artefato.rotulo}</span>
                  <span className="normal-case tracking-[0.02em] text-muted-foreground">
                    {artefato.quando}
                  </span>
                </Link>
              ))}
              <div className="flex-1" />
              {/*
                O ÍMÃ, num dos dois controles do produto que o recebem. É a ação
                principal deste cartão — e a restrição a dois é o que faz o
                efeito querer dizer "isto aqui é a ação", em vez de "esta tela é
                inquieta".
              */}
              <Ima>
                <Link
                  href={`/nexo?projeto=${encodeURIComponent(projeto.projectId)}`}
                  className="nx-cut-5 inline-flex items-center gap-2 bg-[#0f2d2a] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--nexodoc-accent)] transition-colors duration-[var(--duration-fast)] hover:bg-[#164039]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden
                    className="h-3 w-3"
                  >
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  <span>Nova auditoria</span>
                </Link>
              </Ima>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * O SELO — DOIS CHIPS agora, e não uma frase.
 *
 * Ele dizia `7 achados · parado há 12 dias` numa caixa só. São duas
 * informações de eixos diferentes coladas por um ponto médio — QUANTO trabalho
 * e HÁ QUANTO TEMPO —, e numa lista de oito linhas o olho tem que ler a frase
 * inteira de cada uma para comparar qualquer um dos dois eixos. Separados, os
 * dois se comparam de relance: as contagens alinhadas de um lado, os tempos do
 * outro.
 *
 * E A COR PASSA A CAIR NO LUGAR CERTO. Com a frase única, "7 achados" ficava
 * âmbar por causa dos 12 dias — a quantidade herdava a severidade do tempo. Só
 * o tempo é status; a contagem é fato.
 *
 * O SELO CONTA SÓ O QUE ESPERA POR VOCÊ. Somar o que você enviou faria "3
 * achados" numa linha em que dois estão com outra pessoa, e a pessoa abriria o
 * projeto procurando trabalho que não é dela. O que foi enviado aparece no
 * chip de pessoas, ao lado.
 */
function Selo({
  projeto,
  recebidos,
}: {
  projeto: ProjetoDoPainel;
  recebidos: number;
}) {
  const enviados = projeto.itens.length - recebidos;
  const pessoas = [
    ...new Set(
      projeto.itens
        .filter((i) => i.direcao === "enviado")
        .map((i) => i.pessoa.trim())
        .filter(Boolean),
    ),
  ];

  const resumo = resumoDoProjeto({
    recebidos,
    enviados,
    diasParado: projeto.diasParado,
    pessoas: pessoas.map(nomeCurto),
    // O quinto estado: o projeto que está aqui por causa de conversa recente,
    // sem achado nenhum. Quem decide se ele fala é o módulo, não esta tela.
    trabalho: projeto.trabalho,
  });

  /*
   * O `outro` VIRA PILHA DE PESSOAS e não usa o texto do módulo.
   *
   * `resumoDoProjeto` monta "2 com Carla" / "3 com 3 pessoas", e a segunda
   * forma era a que gastava a linha sem dizer nada — "3 pessoas" não é de quem
   * cobrar. A pilha de iniciais dá os três de uma vez no espaço de uma palavra,
   * e o tooltip devolve os nomes. Com UMA pessoa o nome fica: ele cabe, e
   * trocá-lo por `[CA]` seria esconder o que já estava visível.
   */
  if (resumo.realce === "outro") {
    return <ChipDePessoas quantos={enviados} pessoas={pessoas} />;
  }

  const alerta = resumo.realce === "alerta";

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {/*
        A CONTAGEM é sempre o primeiro chip, e nunca é status: ela diz o tamanho
        da pilha, não a gravidade dela. Fica teal quando é SUA (é acionável, e
        teal significa "isto responde a você") e neutra quando é estado do
        projeto.
      */}
      <span
        className="nx-cut-4 whitespace-nowrap border px-2 py-1 font-mono text-[11px] font-medium tracking-[0.04em]"
        style={TOM_DO_RESUMO[alerta ? "seu" : resumo.realce]}
      >
        {alerta ? `${recebidos} ${recebidos === 1 ? "achado" : "achados"}` : resumo.texto}
      </span>

      {/*
        O TEMPO é o segundo, e é o único que carrega o âmbar — é ele o status. A
        unidade encurta ("12 d", e não "parado há 12 dias") porque a coluna
        inteira tem a mesma unidade, e repeti-la oito vezes é a palavra que não
        ganha o lugar. A frase inteira vai para o `title`, onde a régua cabe sem
        custar largura.
      */}
      {alerta ? (
        <span
          title={`Parado há ${projeto.diasParado} dias`}
          className="nx-cut-4 whitespace-nowrap border px-2 py-1 font-mono text-[11px] font-medium tabular-nums tracking-[0.04em]"
          style={TOM_DO_RESUMO.alerta}
        >
          {projeto.diasParado} d
        </span>
      ) : null}
    </span>
  );
}

/**
 * A PILHA DE INICIAIS — quem está com o trabalho, em duas letras.
 *
 * Uma pessoa mantém o NOME: "2 com Carla" cabe na linha, é de quem cobrar, e
 * trocá-lo por `[CM]` esconderia atrás de um hover o que já estava legível. Só
 * a partir de DUAS a pilha compensa — é onde o texto começava a dizer "3
 * pessoas", que é uma contagem disfarçada de resposta.
 *
 * A PILHA FICA FORA DO CHIP, e isto foi medido antes de ser decidido: dentro,
 * o `clip-path` do chanfro (§ geometria) CORTA o canto inferior direito, e o
 * último avatar da fila saía pela metade. Chanfro e disco não se empilham — o
 * corte é da tarja, e o disco tem que viver fora dela.
 *
 * Fora, o arranjo fica igual ao do caso `alerta` logo acima: um chip de
 * contagem e, ao lado, o segundo dado. Os dois estados da mesma coluna passam a
 * ter a mesma forma, que era o ponto de todo este trabalho.
 *
 * ATÉ TRÊS FICHAS, e o resto vira `+N`. Quatro iniciais numa linha de lista
 * viram um borrão, e a quarta não acrescenta — quem precisa dos nomes tem o
 * tooltip, que lista todos.
 *
 * NEUTRO, sem cor. Trabalho que está com outra pessoa não é status seu, e
 * pintá-lo faria as linhas de cobrança competirem com as de achado parado — a
 * única coisa desta tela que pede ação agora.
 */
function ChipDePessoas({ quantos, pessoas }: { quantos: number; pessoas: string[] }) {
  const contagem = (
    <span
      className="nx-cut-4 whitespace-nowrap border px-2 py-1 font-mono text-[11px] font-medium tracking-[0.04em]"
      style={TOM_DO_RESUMO.outro}
    >
      <span className="tabular-nums">{quantos}</span>
      {pessoas.length === 1 ? (
        <span className="text-muted-foreground"> com {nomeCurto(pessoas[0])}</span>
      ) : null}
    </span>
  );

  if (pessoas.length <= 1) {
    return <span className="flex shrink-0 items-center">{contagem}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className="flex shrink-0 items-center gap-2">
            {contagem}

            <span aria-hidden className="flex items-center gap-1">
              {pessoas.slice(0, 3).map((pessoa) => (
                <span
                  key={pessoa}
                  /*
                    REDONDO, e é uma das TRÊS exceções que a DESIGN.md abre ao
                    chanfro: "formas redondas (orbe, avatar, indicador de
                    estado)". A primeira versão usava `nx-cut-3` — classe que
                    nem existe na escala, que vai de 4 a 8 —, então as fichas
                    saíam sem forma nenhuma e as letras liam como texto solto.

                    A segunda ficou redonda e INVISÍVEL: `--nexodoc-raised`
                    (#1a1e21) sobre `--card` (#121518) é um degrau de oito
                    pontos, e a 19px de diâmetro isso não é um disco, é uma
                    sombra. Quem dá forma à ficha é o CONTORNO em `--border`.

                    E A TERCEIRA ERRAVA NO GESTO CONHECIDO: os discos se
                    sobrepunham 6px, como toda pilha de avatar faz. Medido a 3×
                    de escala, o `RB` saía como `:B` — a ficha da frente cobria
                    a primeira letra da de trás. A conta explica: 19px de disco
                    com texto de 9px deixam ~4px de aro livre de cada lado, e a
                    sobreposição comia 6 mais 2 do anel.

                    A sobreposição existe para dizer "isto é um grupo". Aqui ela
                    custava a LETRA, e a letra é a resposta — o comentário do
                    chip diz que este dado é "de quem cobrar". Grupo é o que
                    fichas idênticas e adjacentes já leem; a sobreposição era o
                    ornamento que apagava o conteúdo.
                  */
                  className="grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border border-border bg-[var(--nexodoc-raised)] text-[9px] font-semibold leading-none tracking-normal text-foreground"
                >
                  {iniciaisDe(pessoa)}
                </span>
              ))}
              {pessoas.length > 3 ? (
                <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                  +{pessoas.length - 3}
                </span>
              ) : null}
            </span>

            {/* O que o leitor de tela recebe. A pilha é `aria-hidden` — "CM GL"
                lido em voz alta não é o nome de ninguém. */}
            <span className="sr-only">com {pessoas.map(nomeCurto).join(", ")}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">{pessoas.map(nomeCurto).join(" · ")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * UMA FORMA, CINCO CORES — e é o ponto deste trabalho.
 *
 * Antes eram três tratamentos na mesma coluna: caixa âmbar, caixa teal e texto
 * solto. O texto solto cobria "está com outra pessoa" e "sem pendência", e a
 * razão estava escrita — "só o que espera VOCÊ ganha a caixa".
 *
 * A razão era boa e o efeito, medido na tela cheia, foi outro: as linhas sem
 * caixa leem como DESABILITADAS ao lado das que têm. O olho aprende que caixa =
 * importante e para de ler metade da coluna — inclusive "2 com Victor", que é
 * de quem cobrar.
 *
 * Agora a forma é constante e a hierarquia é a COR, que não some. `--nexodoc-*`
 * e os tokens de status, nunca hexadecimal solto: havia um `#0f2d2a` aqui.
 */
const TOM_DO_RESUMO: Record<string, React.CSSProperties> = {
  alerta: {
    borderColor: "var(--status-warning)",
    background: "var(--status-warning-bg)",
    color: "var(--status-warning)",
  },
  seu: {
    borderColor: "var(--primary)",
    background: "var(--secondary)",
    color: "var(--nexodoc-accent)",
  },
  outro: {
    borderColor: "var(--border)",
    background: "transparent",
    color: "var(--foreground)",
  },
  trabalho: {
    borderColor: "var(--border)",
    background: "transparent",
    color: "var(--muted-foreground)",
  },
  limpo: {
    borderColor: "var(--nexodoc-raised)",
    background: "transparent",
    color: "var(--muted-foreground)",
  },
};

function rotuloDeTempo(item: ItemDoPainel) {
  if (item.direcao === "recebido" && item.dias >= LIMIAR_TARJA) {
    return `parado há ${item.dias} dias`;
  }

  if (item.dias === 0) return "hoje";
  if (item.dias === 1) return "ontem";

  return `${item.dias} dias`;
}

/**
 * O NOME DE UMA PESSOA, curto o bastante para caber numa linha de lista.
 *
 * Quem foi convidado e nunca entrou não tem nome — o vínculo guarda só o
 * e-mail, e é assim de propósito (dá para atribuir trabalho antes do primeiro
 * login). Mostrar `victor.almeida@prosul.com.br` inteiro come a linha do achado.
 *
 * Nome completo vira o primeiro nome; e-mail vira o que vem antes do `@`, sem
 * inventar maiúscula em cima de um endereço que talvez não seja um nome.
 */
function nomeCurto(valor: string) {
  const local = valor.includes("@") ? valor.split("@")[0] : valor;
  const primeiro = local.trim().split(/\s+/)[0] ?? local;

  return primeiro.length > 18 ? `${primeiro.slice(0, 17)}…` : primeiro;
}

function corDoItem(item: ItemDoPainel) {
  if (item.direcao === "enviado") return "#3d474d";
  return item.dias >= LIMIAR_TARJA ? "var(--status-warning)" : "var(--primary)";
}
