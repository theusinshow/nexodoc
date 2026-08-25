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
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";
import { BotaoDoOrbe } from "@/components/layout/botao-do-orbe";
import { RelogioDoTopo } from "@/components/layout/relogio-do-topo";

export function BarraDoTopo({
  nome,
  iniciais,
  escritorio,
  ehAdmin,
}: {
  nome: string;
  iniciais: string;
  escritorio: string;
  ehAdmin: boolean;
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
    <header className="nexo-glass sticky top-0 z-40 shrink-0 rounded-none border-x-0 border-t-0">
      <div className="relative mx-auto flex h-20 max-w-[1520px] items-center gap-5 px-4 sm:px-8">
        {/* ESQUERDA — identidade e relógio. */}
        <Link
          href="/"
          aria-label="NexoDoc — painel"
          className="flex shrink-0 items-center gap-2 text-foreground transition-opacity duration-[var(--duration-fast)] hover:opacity-80"
        >
          {/* `parada`: o orbe que vive no hover é o do botão do centro. Dois
              orbes reagindo na mesma barra dividiriam a atenção que o do meio
              precisa concentrar — e este aqui é só a assinatura da casa. */}
          <MarcaViva size={22} parada />
          <span className="font-mono text-sm font-semibold tracking-[-0.01em]">NexoDoc</span>
        </Link>

        <div className="hidden h-6 w-px shrink-0 bg-border md:block" />
        <RelogioDoTopo className="hidden md:block" />

        <div className="flex-1" />

        {/*
          CENTRO — absoluto, e não um item do flex. Centralizado pelo flex, o
          botão andaria toda vez que o nome da pessoa mudasse de largura: quem
          entra como "Matheus" e quem entra como um e-mail longo veriam o eixo da
          barra em lugares diferentes. Eixo que se move não é eixo.
        */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <BotaoDoOrbe tamanho={64} className="pointer-events-auto" />
        </div>

        {/* DIREITA — quem você é, e a saída. */}
        <div ref={conta} className="relative flex shrink-0 items-center gap-3">
          <div className="hidden flex-col items-end gap-0.5 sm:flex">
            <span className="text-sm font-medium leading-tight text-foreground">{nome}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {escritorio}
              {ehAdmin ? " · Admin" : ""}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setContaAberta((v) => !v)}
            aria-label="Conta"
            aria-expanded={contaAberta}
            aria-haspopup="menu"
            className="nx-cut-6 flex h-9 w-9 cursor-pointer items-center justify-center border-0 bg-[var(--nexodoc-raised)] font-mono text-xs font-semibold text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground"
          >
            {iniciais}
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
