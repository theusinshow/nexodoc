"use client";

/**
 * A BARRA DO TOPO — o cromo do painel, reorganizado em três zonas.
 *
 * O que saiu: as abas PAINEL / VOLUMES / PROJETOS. Elas eram um menu de três
 * itens em que o primeiro era a própria tela — marcado, mas sem para onde ir — e
 * os outros dois já viviam no menu da conta, dois centímetros à direita. Um
 * destino oferecido duas vezes na mesma barra não é redundância inofensiva: é a
 * barra dizendo que não sabe qual é o caminho.
 *
 * O que entrou no lugar: o CENTRO. A barra passou a ter um eixo, e o eixo é o
 * botão do orbe — a porta entre o painel e a conversa, o único controle do cromo
 * que leva a algum lugar. Com ele no meio, as duas pontas voltam a ser o que
 * sempre foram: identidade e relógio de um lado, quem você é do outro.
 *
 * O VIDRO E A ROLAGEM andam juntos. A barra é `sticky` e o conteúdo passa por
 * baixo dela — é isso que faz o vidro significar alguma coisa. Vidro sobre nada
 * é só um tom de cinza mais caro; aqui há o que refratar, e a linha d'água (§4)
 * continua respeitada porque o que borra é o FUNDO da página em rolagem, nunca
 * um dado que alguém esteja lendo (esses ficam matte, abaixo).
 *
 * A altura subiu de 56 para 80px. Não é ar de graça: é o que o botão de 56px
 * precisa para caber sem encostar nas bordas, e é o que separa o cromo do
 * trabalho agora que não há mais faixa de herói entre os dois.
 *
 * O ORBE DESCEU PARA CIMA DA LINHA (26/08/2026), e dobrou de tamanho.
 *
 * Ele era um item de 64px dentro da barra, e por isso a barra o continha: a
 * altura de 80px existia para lhe dar folga, e o resultado era um controle que
 * pedia licença ao cromo. Agora ele fica CENTRADO NA BORDA INFERIOR — metade em
 * cima do vidro, metade sobre a página — e a leitura vira outra: o orbe não é
 * mais um botão da barra, é a costura entre o cromo e o trabalho, o mesmo lugar
 * que ele ocupa no produto.
 *
 * Isso cobra três coisas, e as três estão aqui:
 *
 *  · o botão sai do fluxo do flex (já saía) e ancora em `top-full`, que é a
 *    linha da borda. `-translate-y-1/2` põe o CENTRO dele ali;
 *  · a barra não pode recortar o que transborda. `.nexo-glass` traz
 *    `backdrop-filter`, que cria contexto de empilhamento mas não recorta —
 *    ninguém pode acrescentar `overflow-hidden` aqui sem decapitar o orbe;
 *  · quem vem abaixo precisa abrir espaço para os 64px que sobram. Isso é do
 *    `PainelDoUsuario` (o `ConviteDoOrbe` reserva o vão), e não daqui: a barra
 *    não sabe o que é a página.
 *
 * O `z-index` continua sendo o da barra (40). O botão é filho dela, então a
 * metade que pende para fora já pinta acima do conteúdo sem pedir nada.
 *
 * A PARTIDA (26/08/2026) é o que a barra faz quando alguém toca o orbe.
 *
 * Tudo que ela mostra — marca, relógio, conta — se apaga, e o VIDRO SE APAGA
 * JUNTO: fundo, borda e fio de luz vão a transparente. Sobra o orbe, crescendo
 * sozinho no escuro, que é a leitura inteira da transição. Uma barra de vidro
 * vazia pendurada no topo diria o contrário — que o painel continua ali,
 * esperando.
 *
 * O apagar do vidro é `style` e não classe porque é a `.nexo-glass` que está
 * sendo desfeita, e desfazer uma classe com outra classe é uma corrida de
 * especificidade que a próxima pessoa perde. `background-color` e não
 * `background`: o atalho não é animável, e a barra pularia para transparente
 * num quadro só.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";
import { BotaoDoOrbe } from "@/components/layout/botao-do-orbe";
import { RelogioDoTopo } from "@/components/layout/relogio-do-topo";
import { cn } from "@/lib/utils";
import { DURATION } from "@/modules/nexo/lib/motion";

/** A duração da partida. Mesmo token do `BotaoDoOrbe`, e não uma cópia do número. */
const PARTIDA_MS = DURATION.base;

export function BarraDoTopo({
  nome,
  iniciais,
  escritorio,
  ehAdmin,
  partindo = false,
  aoPartir,
}: {
  nome: string;
  iniciais: string;
  escritorio: string;
  ehAdmin: boolean;
  /** A saída começou: a barra se apaga e deixa só o orbe. */
  partindo?: boolean;
  /** Repassado ao botão do orbe — ver `BotaoDoOrbe`. */
  aoPartir?: () => void;
}) {
  const [contaAberta, setContaAberta] = useState(false);
  const conta = useRef<HTMLDivElement | null>(null);

  /*
   * Clicar fora e apertar Esc fecham o menu. O menu antigo não fazia nem um nem
   * outro: uma vez aberto, só o mesmo botão o fechava — e quem clicava em
   * qualquer outro lugar da tela ficava com ele pendurado no canto.
   */
  useEffect(() => {
    if (!contaAberta) return;

    function noDocumento(ev: MouseEvent) {
      if (!conta.current?.contains(ev.target as Node)) setContaAberta(false);
    }
    function noTeclado(ev: KeyboardEvent) {
      if (ev.key === "Escape") setContaAberta(false);
    }

    document.addEventListener("mousedown", noDocumento);
    document.addEventListener("keydown", noTeclado);

    return () => {
      document.removeEventListener("mousedown", noDocumento);
      document.removeEventListener("keydown", noTeclado);
    };
  }, [contaAberta]);

  return (
    <header
      className="nexo-glass sticky top-0 z-40 shrink-0 rounded-none border-x-0 border-t-0"
      style={
        partindo
          ? {
              backgroundColor: "transparent",
              borderBottomColor: "transparent",
              boxShadow: "none",
              /*
               * O BORRÃO MORRE NO ATO, sem transição — e é a linha que mais
               * pesa deste arquivo. `backdrop-filter` recalcula o desfoque de
               * tudo que passa por baixo A CADA QUADRO, e durante a partida o
               * que passa por baixo é a página inteira se apagando: o pior
               * momento possível para manter o efeito mais caro da tela ligado.
               * Desligado, a saída passa a ser só opacidade, que o compositor
               * resolve sem a thread principal.
               */
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
              transition: `background-color ${PARTIDA_MS}ms var(--ease-feedback), border-color ${PARTIDA_MS}ms var(--ease-feedback), box-shadow ${PARTIDA_MS}ms var(--ease-feedback)`,
            }
          : undefined
      }
    >
      <div className="relative mx-auto flex h-20 max-w-[1520px] items-center gap-5 px-4 sm:px-8">
        {/* ESQUERDA — identidade e relógio. */}
        <Link
          href="/"
          aria-label="NexoDoc — painel"
          className={cn(
            "flex shrink-0 items-center gap-2.5 text-foreground",
            "transition-opacity duration-[var(--duration-fast)] hover:opacity-80",
            partindo && "pointer-events-none opacity-0 duration-[120ms]",
          )}
        >
          {/*
            `parada`: o orbe que vive no hover é o do botão do centro. Dois
            orbes reagindo na mesma barra dividiriam a atenção que o do meio
            precisa concentrar — e este aqui é só a assinatura da casa.

            32 e não 22. Aos 22px o símbolo era mais baixo que a caixa da
            palavra ao lado e lia como um marcador antes do texto, não como a
            marca; e `arquivoPara()` ainda servia o PNG de 32 reduzido, que é
            justamente onde a §6 diz que o vidro vira mancha. Aos 32 ele pede o
            arquivo da própria faixa e volta a ter corpo.

            `leading-none` na palavra é o que ALINHA de verdade. `items-center`
            centra as duas CAIXAS, e a caixa de uma linha de texto tem meia
            entrelinha sobrando em cima e embaixo — com `leading` normal a
            palavra assenta um fio abaixo do eixo do símbolo. Sem entrelinha
            extra, o centro da caixa é o centro das letras.
          */}
          <MarcaViva size={32} parada />
          {/*
            A PALAVRA SAI ABAIXO DE 440px, e o símbolo fica. O orbe do centro
            tem 128px e é ancorado no meio da janela, então ele ocupa de
            `L/2-64` a `L/2+64`; a marca com a palavra mede ~120px a partir da
            margem. As duas se encostam quando `L` desce de ~368px — e a marca,
            que é a única coisa da esquerda, passaria por baixo da esfera num
            telefone. 440 é esse limite com folga. O símbolo sozinho continua
            sendo a marca (§6: "o símbolo sozinho serve de favicon e avatar").
          */}
          <span className="font-mono text-[15px] font-semibold leading-none tracking-[-0.015em] max-[440px]:hidden">
            NexoDoc
          </span>
        </Link>

        {/*
          O RELÓGIO GANHOU CASA (26/08/2026). Ele era texto solto encostado num
          fio de 1px, e texto solto no cromo não tem hierarquia nenhuma: lia como
          uma sobra de outro bloco. Agora é um MOSTRADOR — superfície embutida
          (Nível 3, §4: campo, abaixo do fundo), chanfro de 5 e o mesmo mono
          tabular de antes.

          O que NÃO mudou, e é decisão do próprio `RelogioDoTopo`: hora e data
          continuam em um peso, uma família e uma cor. A casa dá presença ao
          bloco inteiro; ela não reabre a hierarquia entre a hora e o dia, que
          aquele componente rejeita com razão.
        */}
        <RelogioDoTopo
          className={cn(
            "nx-cut-5 ml-1 hidden items-center bg-[var(--nexodoc-recessed)] px-3 py-[7px] md:inline-flex",
            "transition-opacity duration-[120ms]",
            partindo && "opacity-0",
          )}
        />

        <div className="flex-1" />

        {/*
          CENTRO — absoluto, e não um item do flex. Centralizado pelo flex, o
          botão andaria toda vez que o nome da pessoa mudasse de largura: quem
          entra como "Matheus" e quem entra como um e-mail longo veriam o eixo da
          barra em lugares diferentes. Eixo que se move não é eixo.
        */}
        <div className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2">
          <BotaoDoOrbe tamanho={128} className="pointer-events-auto" aoPartir={aoPartir} />
        </div>

        {/*
          DIREITA — quem você é, e a saída.

          O CLUSTER INTEIRO VIROU O CONTROLE (26/08/2026). Ele era um texto morto
          ("Matheus / PROSUL · ADMIN") ao lado de um quadrado de 36px que era o
          único clicável: a área que o olho lê como "minha conta" tinha três
          vezes o tamanho da área que respondia ao clique, e nada dizia que ali
          havia um menu — nem forma de botão, nem seta, nem hover.

          Agora o nome, a identificação e o avatar são UM botão chanfrado, com
          fundo no hover e no aberto, e a seta que gira. O alvo passou de 36×36
          para a largura do bloco, e a promessa passou a existir.

          O rótulo "Admin" saiu do texto corrido e virou SELO. Solto, ele tinha o
          mesmo peso do nome do escritório ao lado e lia como parte do endereço;
          com fundo próprio ele lê como o que é — uma alçada. Sem teal: o acento
          é do interativo, e um selo de estado que se pinta de teal começa a
          competir com os controles de verdade.
        */}
        <div
          ref={conta}
          className={cn(
            "relative shrink-0 transition-opacity duration-[120ms]",
            partindo && "pointer-events-none opacity-0",
          )}
        >
          <button
            type="button"
            onClick={() => setContaAberta((v) => !v)}
            aria-label="Conta"
            aria-expanded={contaAberta}
            aria-haspopup="menu"
            className={cn(
              "nx-cut-8 group flex cursor-pointer items-center gap-3 border-0 py-1.5 pl-2 pr-2.5 sm:pl-3.5",
              "transition-colors duration-[var(--duration-fast)]",
              contaAberta ? "bg-[#141a1e]" : "bg-transparent hover:bg-[#141a1e]",
            )}
          >
            <span className="hidden flex-col items-end gap-1.5 sm:flex">
              <span className="text-sm font-medium leading-none text-foreground">{nome}</span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase leading-none tracking-[0.1em] text-muted-foreground">
                {escritorio}
                {ehAdmin ? (
                  <span className="nx-cut-4 bg-[var(--nexodoc-raised)] px-1.5 py-[3px] tracking-[0.12em] text-[#9aa6ac]">
                    Admin
                  </span>
                ) : null}
              </span>
            </span>

            <span
              aria-hidden
              className="nx-cut-6 grid h-9 w-9 shrink-0 place-items-center bg-[var(--nexodoc-raised)] font-mono text-xs font-semibold text-muted-foreground transition-colors duration-[var(--duration-fast)] group-hover:bg-[#20262a] group-hover:text-foreground"
            >
              {iniciais}
            </span>

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
              className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-[var(--duration-fast)]"
              style={{ transform: contaAberta ? "rotate(180deg)" : "none" }}
            >
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {contaAberta ? (
            <div
              role="menu"
              className="nx-edge-7 absolute right-0 top-[calc(100%+12px)] w-[236px] origin-top-right"
              style={
                {
                  "--nx-fill": "#0d1215",
                  animation: "modal-scale-in 140ms cubic-bezier(0.22, 1, 0.36, 1)",
                } as React.CSSProperties
              }
            >
              <div className="p-2">
                <ItemDaConta href="/volumes">Volumes</ItemDaConta>
                <ItemDaConta href="/projetos">Todos os projetos do escritório</ItemDaConta>
                {ehAdmin ? <ItemDaConta href="/admin">Painel Admin</ItemDaConta> : null}
                <div className="my-1.5 h-px bg-[var(--nexodoc-raised)]" />
                <ItemDaConta href="/api/auth/signout" tenue>
                  Sair
                </ItemDaConta>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ItemDaConta({
  href,
  children,
  tenue,
}: {
  href: string;
  children: React.ReactNode;
  tenue?: boolean;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={`block px-3 py-2 text-sm transition-colors duration-[var(--duration-fast)] hover:bg-[#141a1e] ${
        tenue ? "text-muted-foreground" : "text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
