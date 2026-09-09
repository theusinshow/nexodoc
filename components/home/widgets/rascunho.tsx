"use client";

/**
 * RASCUNHO — o papel ao lado do teclado.
 *
 * A nota que se toma revisando um memorial ("checar a espessura da laje com o
 * Victor", "o 077 não tem quadro de cargas") hoje vai para um post-it ou para
 * um chat, e some. Ela não merece virar achado — achado tem dono, prazo e
 * conversa —, mas merece sobreviver ao F5.
 *
 * VIVE NESTE NAVEGADOR, e a tela DIZ isso.
 *
 * O texto fica em `localStorage`: some ao limpar dados do site, não acompanha
 * quem troca de máquina, e o Nexo nunca o lê. Esconder isso seria pior que não
 * ter o widget — alguém anotaria uma decisão de obra aqui achando que está no
 * sistema. A legenda do rodapé é parte do widget, não enfeite.
 *
 * DUAS FONTES PARA UM CAMPO, e a assimetria é o desenho todo:
 *
 *  · o que está NO DISCO chega por `useSyncExternalStore`, que é a API que o
 *    React tem para fonte externa — e a única que hidrata sem divergir, porque
 *    servidor e primeira pintura usam o mesmo "" e o valor real entra no quadro
 *    seguinte;
 *  · o que está SENDO DIGITADO é estado local, e `null` enquanto ninguém tocou.
 *
 * `texto = rascunho ?? salvo` faz o campo ser do disco até a primeira tecla e
 * de quem digita a partir dela. E `gravado` vira uma COMPARAÇÃO em vez de um
 * terceiro estado — não há como o rodapé dizer "salvo" sobre um texto que não
 * está no disco, porque a frase é a igualdade dos dois.
 *
 * GRAVA SOZINHO, com atraso. Sem botão de salvar: um botão criaria o estado
 * "escrito mas não salvo", que é exatamente o estado em que se perde nota.
 * 600ms depois da última tecla o texto está no disco. O `beforeunload` fecha a
 * última fresta — quem fecha a aba 200ms depois de digitar não perde a linha.
 */

import * as React from "react";

import { assinarChave, brutoDoServidor, escreverBruto, lerBruto } from "@/lib/armazem-local";
import { Casco } from "./casco";

const CHAVE = "nexodoc:home:rascunho";
const ATRASO_MS = 600;

const assinar = assinarChave(CHAVE);
const ler = () => lerBruto(CHAVE);

export function WidgetRascunho() {
  const salvo = React.useSyncExternalStore(assinar, ler, brutoDoServidor);

  /** Nulo enquanto ninguém digitou — aí o campo é do disco. */
  const [rascunho, setRascunho] = React.useState<string | null>(null);

  const texto = rascunho ?? salvo;
  const gravado = texto === salvo;

  const ultimoRef = React.useRef(texto);

  React.useEffect(() => {
    // A ATRIBUIÇÃO MORA NO EFEITO, e não no corpo: escrever em `ref.current`
    // durante o render é mutação em fase de render, e o React 19 acusa.
    ultimoRef.current = texto;
  }, [texto]);

  React.useEffect(() => {
    if (gravado) return;

    const id = window.setTimeout(() => escreverBruto(CHAVE, texto), ATRASO_MS);
    return () => window.clearTimeout(id);
  }, [texto, gravado]);

  React.useEffect(() => {
    /*
     * A ÚLTIMA FRESTA: fechar a aba dentro dos 600ms do atraso. `beforeunload`
     * é síncrono e o `localStorage` também, então dá tempo. O `ref` existe só
     * para este ouvinte — remontá-lo a cada tecla para capturar o texto novo
     * poria e tiraria um listener da janela a cada caractere.
     */
    const aoSair = () => escreverBruto(CHAVE, ultimoRef.current);
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, []);

  return (
    <Casco
      titulo="Rascunho"
      acessorio={
        <span
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-opacity duration-[var(--duration-base)]"
          style={{
            // A confirmação só aparece quando há o que confirmar. Um "salvo"
            // permanente sobre uma caixa vazia é ruído que ensina a ignorar o
            // canto onde a confirmação de verdade vai aparecer.
            opacity: gravado && texto.trim() ? 1 : 0,
          }}
        >
          salvo
        </span>
      }
    >
      <textarea
        value={texto}
        onChange={(ev) => setRascunho(ev.target.value)}
        rows={3}
        spellCheck={false}
        placeholder="O que não pode escapar hoje…"
        aria-label="Rascunho"
        className="nx-cut-5 w-full resize-none bg-[var(--nexodoc-recessed)] px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
      />

      <p className="m-0 mt-2 font-mono text-[10px] leading-4 tracking-[0.02em] text-muted-foreground">
        Fica só neste navegador — não vai para o escritório.
      </p>
    </Casco>
  );
}
