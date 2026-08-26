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
 * E QUANDO NÃO HÁ TRABALHO NENHUM, a tela para de descrever o vazio e passa a
 * descrever o produto (`PrimeirosPassos`). Quem entra pela primeira vez não
 * precisa de dois títulos confirmando que não tem nada; precisa saber o que
 * trazer. Ver `primeiraVez`, que exige as duas colunas vazias, não só uma.
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
import { FileSearch, FolderPlus, Layers, Ruler, Stamp, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Ima } from "@/components/ambiente/ima";
import { BarraDoTopo } from "@/components/layout/barra-do-topo";
import type { ItemDoPainel, Painel, ProjetoDoPainel } from "@/lib/painel";

/**
 * A partir de quantos dias um achado parado ganha destaque.
 *
 * Cinco, e não três: com três, uma pendência de sexta já chega alaranjada na
 * segunda — e tarja que acende sozinha no fim de semana ensina a ignorá-la.
 */
const LIMIAR_TARJA = 5;

type Props = {
  nome: string;
  iniciais: string;
  escritorio: string;
  ehAdmin: boolean;
};

export function PainelDoUsuario({ nome, iniciais, escritorio, ehAdmin }: Props) {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let vivo = true;

    fetch("/api/painel")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((dados: Painel) => {
        if (!vivo) return;
        setPainel(dados);
        /*
         * O PRIMEIRO PROJETO NASCE ABERTO, e só ele. A lista vem com os mais
         * parados primeiro, então o que abre é o que mais espera — e abrir
         * todos devolveria a parede de texto que o acordeão existe para evitar.
         */
        const primeiro = dados.projetos.find((p) => p.itens.length > 0);
        if (primeiro) setAbertos({ [primeiro.projectId]: true });
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });

    return () => {
      vivo = false;
    };
  }, []);

  const carregando = !painel && !falhou;
  const vazio = Boolean(painel && painel.projetos.length === 0);

  /*
   * A TELA DE QUEM AINDA NÃO TEM NADA.
   *
   * Não basta "sem projeto": as duas colunas desta home respondem perguntas
   * diferentes, e uma delas pode estar cheia com a outra vazia — quem auditou
   * ontem e fechou tudo tem `projetos` vazio e `recentes` com trabalho dentro.
   * Só quando as DUAS estão vazias é que a tela não tem o que contar, e é aí
   * que ela deve falar do produto em vez de mostrar dois títulos sobre o nada.
   *
   * `falhou` fica de fora de propósito. Falha de rede não é ausência de
   * trabalho, e trocar o aviso de erro por uma apresentação do software diria à
   * pessoa que os projetos dela sumiram.
   */
  const primeiraVez = Boolean(
    painel && painel.projetos.length === 0 && painel.recentes.length === 0,
  );

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
      <BarraDoTopo nome={nome} iniciais={iniciais} escritorio={escritorio} ehAdmin={ehAdmin} />

      <main className="mx-auto w-full max-w-[1520px] flex-1 px-4 pb-16 sm:px-8">
        <ConviteDoOrbe />

        {primeiraVez ? <PrimeirosPassos /> : null}

        {primeiraVez ? null : (
          <div className="mt-9 grid grid-cols-1 items-start gap-9 lg:grid-cols-[minmax(0,1fr)_336px]">
            <section className="flex w-full min-w-0 flex-col gap-2.5">
              <div className="mb-1 flex items-baseline gap-3">
                <h2 className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Seus projetos abertos
                </h2>
                <div className="flex-1" />
                {painel && !vazio ? (
                  <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                    mais parados primeiro
                  </span>
                ) : null}
              </div>

              {carregando ? <Esqueleto /> : null}

              {falhou ? (
                <p className="max-w-[46ch] py-6 text-sm leading-normal text-muted-foreground">
                  Não deu para carregar seus projetos agora. O Nexo continua funcionando —
                  recarregue a página quando quiser tentar de novo.
                </p>
              ) : null}

              {vazio ? (
                <div className="px-0.5 py-6">
                  <p className="mb-2 text-base font-medium text-foreground">
                    Nenhum projeto seu por aqui ainda.
                  </p>
                  <p className="m-0 max-w-[44ch] text-sm leading-normal text-muted-foreground">
                    Abra o Nexo e envie o primeiro documento: o centro de custo é lido do PDF e a
                    pasta nasce a partir dele.
                  </p>
                </div>
              ) : null}

              {painel?.projetos.map((projeto) => (
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
                <Link
                  href="/projetos"
                  className="mt-2 self-start font-mono text-xs tracking-[0.05em] text-primary transition-colors duration-[var(--duration-fast)] hover:text-[var(--nexodoc-accent)]"
                >
                  Ver todos os projetos do escritório →
                </Link>
              ) : null}
            </section>

            <aside className="flex w-full min-w-0 flex-col gap-3">
              <h3 className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Onde você parou
              </h3>

              {painel && painel.recentes.length === 0 ? (
                <p className="m-0 text-sm leading-normal text-muted-foreground">
                  Sua primeira auditoria aparece aqui.
                </p>
              ) : null}

              {painel && painel.recentes.length > 0 ? (
                <div
                  className="nx-edge-8"
                  style={{ "--nx-fill": "var(--card)" } as React.CSSProperties}
                >
                  <div className="flex flex-col px-3.5">
                    {painel.recentes.map((recente) => (
                      <Link
                        key={recente.auditId}
                        href={`/nexo?auditoria=${encodeURIComponent(recente.auditId)}`}
                        className="flex items-baseline gap-3 border-b border-[#171c1f] py-3 transition-colors duration-[var(--duration-fast)] last:border-0 hover:text-[var(--nexodoc-accent)]"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          {recente.nome}
                        </span>
                        <span className="font-mono text-[11px] tracking-[0.03em] text-muted-foreground">
                          {recente.quando}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * O CONVITE DO ORBE — a instrução que o botão do topo não podia dar sozinho.
 *
 * Aqui havia a FAIXA DE ENTRADA: um bloco de 120px de altura em largura total,
 * com ícone de upload, o rótulo "NOVA AUDITORIA" e um link para o `/nexo`. Ela
 * saiu em 26/08/2026, e a razão é a mesma que tirou a faixa de herói antes
 * dela: era a segunda porta para o MESMO destino, na mesma dobra, a dois
 * centímetros do orbe. Duas portas para uma sala não dobram o convite — elas
 * dividem a atenção e fazem a tela parecer indecisa sobre por onde se começa.
 *
 * O que ficou é a PORTA e a LEGENDA dela. O orbe, agora centrado na borda da
 * barra, é o controle; este bloco é a frase que diz o que acontece ao tocá-lo.
 * Ele não clica: um alvo escondido embaixo do alvo verdadeiro seria a terceira
 * porta.
 *
 * O VÃO DE 84px NÃO É ESPAÇAMENTO, É ESTRUTURA. O orbe tem 128px e está
 * ancorado no CENTRO da borda inferior da barra, então 64px dele pendem sobre
 * esta região — 75 quando o `:active` o infla em 17%. Os 84 são esses 75 mais
 * folga. Quem mexer neste número sem mexer no `tamanho` da `BarraDoTopo` põe o
 * texto embaixo da esfera, ou o fio por baixo dela no instante do clique.
 *
 * O FIO é o que amarra os dois. Um gradiente de 20px que nasce na cor da borda
 * e morre no nada, saindo de baixo do orbe em direção à frase: sem ele, o texto
 * lê como um subtítulo da página; com ele, lê como a legenda daquele objeto.
 */
function ConviteDoOrbe() {
  return (
    <div className="flex flex-col items-center pt-[84px] text-center">
      <span
        aria-hidden
        className="h-5 w-px shrink-0"
        style={{
          background: "linear-gradient(to bottom, var(--border), transparent)",
        }}
      />

      <p className="mt-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-foreground">
        Clique no orbe para falar com o Nexo
      </p>

      <p className="mt-2.5 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
        Peça a auditoria de um memorial, a montagem de um volume ou a lista de documentos — e solte
        o PDF na conversa. O centro de custo é lido do carimbo e a pasta nasce a partir dele.
      </p>
    </div>
  );
}

/**
 * OS PRIMEIROS PASSOS — o que a home mostra quando ainda não há trabalho.
 *
 * Ela mostrava dois títulos ("Seus projetos abertos", "Onde você parou") e duas
 * frases de consolo embaixo deles. Era honesto e inútil: a pessoa que abre o
 * produto pela primeira vez não precisa que a tela confirme que ela não tem
 * nada — precisa saber o que a ferramenta FAZ, para decidir o que trazer.
 *
 * Seis fichas, e cada uma é uma CAPACIDADE que existe hoje, com o nome que o
 * produto usa por dentro. Nenhuma delas é um link: mandar alguém para
 * `/volumes` antes de existir um projeto é mandá-lo para outra tela vazia. A
 * única porta continua sendo o orbe, logo acima.
 *
 * MATTE, sem exceção (§4). São cartões, e cartão é dado — o vidro desta tela
 * mora só na barra do topo e no orbe que pende dela.
 */
function PrimeirosPassos() {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          O que o Nexo faz
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CAPACIDADES.map((c) => (
          <article
            key={c.titulo}
            className="nx-edge-8 h-full"
            style={{ "--nx-fill": "var(--card)" } as React.CSSProperties}
          >
            <div className="flex h-full flex-col gap-3 px-5 py-5">
              <span
                aria-hidden
                className="nx-cut-6 grid h-9 w-9 shrink-0 place-items-center bg-[var(--nexodoc-raised)] text-muted-foreground"
              >
                <c.Icone className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </span>

              <h3 className="m-0 text-[15px] font-medium leading-snug tracking-[-0.01em] text-foreground">
                {c.titulo}
              </h3>

              <p className="m-0 text-sm leading-relaxed text-muted-foreground">{c.texto}</p>
            </div>
          </article>
        ))}
      </div>

      {/*
        O RODAPÉ DA APRESENTAÇÃO. Ele responde a pergunta que sobra depois das
        seis fichas — "e por onde eu começo?" — apontando de volta para o orbe,
        que é a resposta. Uma sétima ficha diria mais uma capacidade; esta linha
        fecha o assunto.
      */}
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        Nada disso pede cadastro antes. Abra a conversa no orbe, mande o primeiro documento, e esta
        tela passa a mostrar seus projetos e por onde você andou.
      </p>
    </section>
  );
}

/**
 * As seis capacidades, na ordem em que uma pessoa as encontra trabalhando: o
 * documento chega, é lido, vira achado, o achado vira trabalho de alguém, o
 * projeto vira volume, e o volume passa pelo portão de conferência.
 *
 * O texto de cada uma diz o que a ferramenta FAZ, com o número quando há
 * número. "Lê o documento inteiro" é propaganda; "compara o selo de cada folha
 * com a prefeitura de destino" é uma promessa que dá para cobrar.
 */
const CAPACIDADES = [
  {
    Icone: FileSearch,
    titulo: "Auditoria de memorial",
    texto:
      "O documento é lido inteiro — numeração, sumário, tabelas, referências normativas e as cláusulas que o template do escritório deixou para trás. Cada achado vem com o trecho e a página em que ele está.",
  },
  {
    Icone: Ruler,
    titulo: "Regra primeiro, IA depois",
    texto:
      "O que é fato objetivo — item que não fecha, folha faltando, norma revogada — sai de regra determinística. A IA entra onde é preciso contexto, e o veredito avisa quando a leitura foi parcial.",
  },
  {
    Icone: FolderPlus,
    titulo: "O projeto nasce do documento",
    texto:
      "O centro de custo e a obra são lidos do carimbo do próprio PDF. Não há formulário para preencher antes: a pasta do projeto se cria a partir do primeiro arquivo que você manda.",
  },
  {
    Icone: Users,
    titulo: "Achado vira trabalho de alguém",
    texto:
      "Um achado pode ser atribuído a outra pessoa do escritório. O painel mostra o que está com você, o que está com os outros e há quantos dias cada coisa está parada.",
  },
  {
    Icone: Layers,
    titulo: "Capas, separatrizes e LDs",
    texto:
      "Capa, folha de separação e lista de documentos saem do próprio projeto, uma por disciplina, e se juntam num volume montado na ordem certa.",
  },
  {
    Icone: Stamp,
    titulo: "Conferência antes de entregar",
    texto:
      "O portão final do volume confere nome, endereço, data e logo de cada selo contra a prefeitura de destino — e diz qual folha discorda, em vez de dizer que algo está errado.",
  },
] as const;

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
      className="nx-edge-8 overflow-hidden"
      style={
        {
          "--nx-edge": alerta ? "#4a3a1c" : "var(--border)",
          "--nx-fill": "var(--card)",
        } as React.CSSProperties
      }
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
          className="flex w-full cursor-pointer items-center gap-3.5 border-0 py-3.5 pl-5 pr-4 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--nexodoc-raised)]"
          style={{
            background: alerta ? "var(--status-warning-bg)" : "transparent",
          }}
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

          <span
            className="nx-cut-4 shrink-0 bg-[var(--nexodoc-raised)] px-2 py-1 font-mono text-[12px] font-semibold tracking-[0.04em]"
            style={{
              color: alerta ? "var(--status-warning)" : "var(--foreground)",
            }}
          >
            {projeto.codigo}
          </span>

          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{projeto.nome}</span>

          <Selo projeto={projeto} alerta={alerta} recebidos={recebidos} />
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
 * O SELO do cabeçalho conta SÓ o que espera por você.
 *
 * Somar o que você enviou faria "3 achados" numa linha em que dois estão com
 * outra pessoa — e a pessoa abriria o projeto procurando trabalho que não é
 * dela. O que foi enviado aparece dentro, com a seta, que é onde a distinção
 * cabe.
 *
 * "Sem pendência" fica SEM fundo, de propósito: um selo pintado para dizer que
 * não há nada a fazer daria destaque à ausência de trabalho, e numa lista de dez
 * projetos em dia a tela inteira acenderia para não dizer nada.
 */
function Selo({
  projeto,
  alerta,
  recebidos,
}: {
  projeto: ProjetoDoPainel;
  alerta: boolean;
  recebidos: number;
}) {
  const enviados = projeto.itens.length - recebidos;

  if (recebidos === 0) {
    return (
      <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
        {enviados > 0 ? `${enviados} com outros` : "sem pendência"}
      </span>
    );
  }

  const contagem = `${recebidos} ${recebidos === 1 ? "achado" : "achados"}`;

  return (
    <span
      className="nx-cut-4 shrink-0 whitespace-nowrap px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.04em]"
      style={{
        background: alerta ? "var(--status-warning-bg)" : "#0f2d2a",
        color: alerta ? "var(--status-warning)" : "var(--nexodoc-accent)",
      }}
    >
      {alerta ? `${contagem} · parado há ${projeto.diasParado} dias` : contagem}
    </span>
  );
}

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
