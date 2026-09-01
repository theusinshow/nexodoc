"use client";

/**
 * A PALETA (Ctrl+K) — "qual caminho eu tomo" respondido sem redesenhar a
 * navegação.
 *
 * Ela junta as duas coisas que a pessoa procura: a CONVERSA (por obra ou
 * código) e a AÇÃO (começar um trabalho, ir para uma tela). As conversas saem
 * dos MESMOS CARTÕES da barra lateral — uma segunda busca acharia coisas
 * diferentes com o mesmo texto, e ninguém saberia qual das duas está certa.
 *
 * Essa promessa esteve QUEBRADA. A barra passou a montar cartões (que trazem
 * código e cliente, vindos do `Project`) e a paleta ficou em
 * `groupConversations`, que só olhava o título e o `folderKey` — vazio nas
 * conversas que já têm `projectId`. O sintoma era exato: "criciuma" achava os
 * projetos na barra e NADA na paleta, que é a busca mais frequente do produto.
 * Agora as duas chamam `useCartoesDeProjeto` e `filtrarCartoes`.
 *
 * ELA VIVE NO NEXO, e não no aplicativo inteiro. A proposta pede "de qualquer
 * tela"; as conversas e o composer moram aqui, e uma paleta global precisaria do
 * próprio caminho de dados para metade do que ela faz. Uma tecla que abre duas
 * paletas diferentes conforme a tela é pior do que uma tecla que abre uma só.
 *
 * NADA DESTRUTIVO — a regra está em `lib/paleta.ts`, onde a lista mora, e o
 * teste a defende.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { filtrarCartoes } from "../lib/cartoes-de-projeto";
import type { ConversationSummary } from "../lib/nexo-db";
import { pastaDoProjeto } from "../lib/pasta-do-projeto";
import { useCartoesDeProjeto } from "../state/use-cartoes-de-projeto";
import {
  ACOES_DA_PALETA,
  ACOES_DE_ADMIN,
  filtrarAcoes,
  type AcaoDaPaleta,
} from "../lib/paleta";
import { useComposer } from "../state/composer-controller";
import { MarcaDaPrefeitura } from "./MarcaDaPrefeitura";

type Item =
  | { tipo: "acao"; acao: AcaoDaPaleta }
  | {
      tipo: "conversa";
      id: string;
      titulo: string;
      /** "063-26-CRICIUMA", ou `null` na conversa ainda sem projeto. */
      pasta: string | null;
      /** De onde o BASTÃO tira a cor. Vazio = cinza. */
      cliente: string;
    };

export function PaletaDeComandos({
  conversas,
  onAbrirConversa,
  isAdmin,
}: {
  conversas: ConversationSummary[];
  onAbrirConversa: (id: string) => void;
  isAdmin?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const campo = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const composer = useComposer();

  const fechar = useCallback(() => {
    setAberta(false);
    setQuery("");
    setCursor(0);
  }, []);

  /*
   * `Ctrl+K` (e `Cmd+K` no Mac) no DOCUMENTO, e com `preventDefault`: o
   * navegador usa a mesma combinação para a barra de endereço, e sem barrá-la a
   * paleta abriria atrás do foco do Chrome.
   *
   * Sem guarda de digitação, de propósito: `Ctrl+K` dentro de um campo continua
   * querendo dizer "abre a paleta" — o que ela precisa NÃO roubar é a seta e a
   * letra solta, e nenhuma das duas está aqui.
   */
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((a) => !a);
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  useEffect(() => {
    if (aberta) requestAnimationFrame(() => campo.current?.focus());
  }, [aberta]);

  const cartoes = useCartoesDeProjeto(conversas);

  const itens = useMemo<Item[]>(() => {
    const acoes = filtrarAcoes(query, [
      ...ACOES_DA_PALETA,
      ...(isAdmin ? ACOES_DE_ADMIN : []),
    ]).map((acao) => ({ tipo: "acao" as const, acao }));

    /*
     * As conversas só entram COM TEXTO. Com a paleta recém-aberta, listar
     * cinquenta conversas empurraria as ações para fora da tela — e as ações
     * são o que alguém que apertou Ctrl+K sem saber o que procurar precisa ver.
     */
    const achadas =
      query.trim() === ""
        ? []
        : filtrarCartoes(cartoes, query)
            .flatMap((cartao) =>
              cartao.conversas.map((c) => ({
                tipo: "conversa" as const,
                id: c.id,
                titulo: c.titulo,
                /*
                 * O NOME DA PASTA, remontado pela mesma regra que a barra usa —
                 * e não o `chave` do cartão, que hoje é o `projectId` e é um
                 * cuid: mostrá-lo poria um identificador de banco na tela.
                 */
                pasta: pastaDoProjeto(cartao.codigo, cartao.cliente) || null,
                cliente: cartao.cliente,
              })),
            )
            .slice(0, 8);

    return [...acoes, ...achadas];
  }, [cartoes, isAdmin, query]);

  const escolher = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      fechar();
      if (item.tipo === "conversa") {
        onAbrirConversa(item.id);
        return;
      }
      if (item.acao.href) router.push(item.acao.href);
      else if (item.acao.frase) composer.fill(item.acao.frase);
    },
    [composer, fechar, onAbrirConversa, router],
  );

  if (!aberta) return null;

  return (
    <div
      /*
       * O fundo fecha ao clique, e o painel não: é o gesto que todo diálogo
       * desta casa já tem, e inventar outro aqui obrigaria a aprender duas
       * saídas para a mesma coisa.
       */
      onClick={fechar}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        data-paleta
        onClick={(e) => e.stopPropagation()}
        className="nx-elev nexodoc-section-reveal w-full max-w-[520px]"
      >
        <div className="nx-cut-8 flex flex-col overflow-hidden bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={campo}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, itens.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  escolher(itens[cursor]);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  fechar();
                }
              }}
              placeholder="Buscar obra, código ou ação…"
              className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              esc
            </kbd>
          </div>

          <ol className="max-h-[46vh] overflow-y-auto py-1">
            {itens.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nada com esse nome — nem conversa, nem ação.
              </li>
            )}
            {itens.map((item, i) => {
              const rotulo =
                item.tipo === "acao" ? item.acao.rotulo : item.titulo;
              const secao =
                item.tipo === "acao"
                  ? item.acao.grupo
                  : (item.pasta ?? "Conversa");
              return (
                <li key={item.tipo === "acao" ? item.acao.id : `c:${item.id}`}>
                  <button
                    type="button"
                    data-item-da-paleta
                    aria-current={i === cursor || undefined}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => escolher(item)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left outline-none",
                      i === cursor
                        ? "bg-[var(--accent)]"
                        : "hover:bg-[var(--accent)]/60",
                    )}
                  >
                    {/*
                      O BASTÃO SUBSTITUI UM RÓTULO QUE NÃO EXISTE.

                      Hoje a única diferença entre um item de conversa e um de
                      ação é o texto da direita — a pasta, ou o grupo da ação.
                      Quem tem bastão é conversa; quem não tem é ação. A
                      distinção passa a ser vista antes de lida.

                      E resolve o caso frequente da busca por cidade: digitando
                      "criciuma", a lista devolve conversas de três obras
                      diferentes da mesma prefeitura. Sem a marca, três linhas
                      de texto quase igual; com ela, três bastões idênticos
                      confirmando que a busca acertou a cidade, e o código à
                      direita separando as obras.

                      A AÇÃO FICA COM O VÃO, e não sem nada: 3px reservados
                      mantêm os rótulos das duas espécies na mesma vertical.
                      Alinhamento quebrado por meia dúzia de pixels é o que faz
                      uma lista parecer duas.
                    */}
                    {item.tipo === "conversa" ? (
                      <MarcaDaPrefeitura prefeitura={item.cliente} forma="bastao" />
                    ) : (
                      <span className="w-[3px] shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {rotulo}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                      {secao}
                    </span>
                    {i === cursor && (
                      <CornerDownLeft
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
