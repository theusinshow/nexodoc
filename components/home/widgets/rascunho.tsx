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
 *
 * O QUE MUDOU NA SEGUNDA RODADA: ele deixou de ser uma caixa muda.
 *
 * Era um `textarea` vazio com um "salvo" que piscava no canto. Três coisas
 * entraram, e as três respondem perguntas que a caixa vazia deixava no ar:
 *
 *  · QUANDO foi salvo ("salvo agora", "salvo há 4 min"), e não só QUE foi. Um
 *    "salvo" permanente não distingue a nota de agora da de terça;
 *  · LIMPAR, com confirmação em dois toques. Apagar 300 caracteres com
 *    ⌘A+Delete funciona e ninguém pensa nisso;
 *  · a CONTAGEM some — ela seria a informação menos útil possível sobre uma
 *    nota. O que ocupa o lugar dela é o carimbo de tempo.
 *
 * NÃO ENTROU "transformar em tarefa", e a ausência é a decisão. Não há modelo
 * de tarefa no schema: o botão teria que virar um achado (que exige auditoria,
 * projeto e responsável — nada disso existe numa nota solta) ou não fazer nada.
 * Um botão que promete um destino inexistente é pior que a falta dele.
 */

import * as React from "react";
import { Eraser } from "lucide-react";

import { assinarChave, brutoDoServidor, escreverBruto, lerBruto } from "@/lib/armazem-local";
import { Casco, quando } from "./casco";

const CHAVE = "nexodoc:home:rascunho";
/** Quando foi a última gravação, em ISO. Chave separada: o texto é o texto. */
const CHAVE_QUANDO = "nexodoc:home:rascunho-em";
const ATRASO_MS = 600;

const assinar = assinarChave(CHAVE);
const ler = () => lerBruto(CHAVE);

export function WidgetRascunho() {
  const salvo = React.useSyncExternalStore(assinar, ler, brutoDoServidor);

  /** Nulo enquanto ninguém digitou — aí o campo é do disco. */
  const [rascunho, setRascunho] = React.useState<string | null>(null);
  /** Segundo toque do limpar. Volta a `false` sozinho em 4s. */
  const [confirmando, setConfirmando] = React.useState(false);

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

    const id = window.setTimeout(() => {
      escreverBruto(CHAVE, texto);
      escreverBruto(CHAVE_QUANDO, new Date().toISOString());
    }, ATRASO_MS);
    return () => window.clearTimeout(id);
  }, [texto, gravado]);

  React.useEffect(() => {
    /*
     * A ÚLTIMA FRESTA: fechar a aba dentro dos 600ms do atraso. `beforeunload`
     * é síncrono e o `localStorage` também, então dá tempo. O `ref` existe só
     * para este ouvinte — remontá-lo a cada tecla para capturar o texto novo
     * poria e tiraria um listener da janela a cada caractere.
     */
    const aoSair = () => {
      if (ultimoRef.current === lerBruto(CHAVE)) return;
      escreverBruto(CHAVE, ultimoRef.current);
      escreverBruto(CHAVE_QUANDO, new Date().toISOString());
    };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, []);

  React.useEffect(() => {
    if (!confirmando) return;
    // A CONFIRMAÇÃO EXPIRA. Um botão que fica dizendo "Apagar?" para sempre é
    // uma armadilha na próxima vez que a pessoa passar o mouse por ali.
    const id = window.setTimeout(() => setConfirmando(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirmando]);

  function limpar() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setRascunho("");
    escreverBruto(CHAVE, "");
    escreverBruto(CHAVE_QUANDO, "");
    setConfirmando(false);
  }

  const temTexto = Boolean(texto.trim());

  return (
    <Casco
      titulo="Rascunho"
      acessorio={
        <Carimbo
          /*
            TRÊS ESTADOS num acessório de 60px, e cada um responde a mesma
            pergunta em momentos diferentes: "escrevendo…" enquanto o atraso
            corre, "salvo agora / há 4 min" depois, e nada quando não há nota.
            Sem o primeiro, o campo passa 600ms sem dizer coisa alguma — que é
            exatamente o intervalo em que alguém fecharia a aba achando que
            perdeu.
          */
          estado={!temTexto ? "vazio" : gravado ? "salvo" : "escrevendo"}
        />
      }
    >
      <textarea
        value={texto}
        onChange={(ev) => {
          setRascunho(ev.target.value);
          setConfirmando(false);
        }}
        rows={3}
        spellCheck={false}
        placeholder="O que não pode escapar hoje…"
        aria-label="Rascunho"
        className="nx-cut-5 w-full resize-none bg-[var(--nexodoc-recessed)] px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
      />

      <div className="mt-2 flex items-center gap-3">
        <p className="m-0 min-w-0 flex-1 font-mono text-[10.5px] leading-4 tracking-[0.02em] text-muted-foreground">
          Fica só neste navegador.
        </p>

        {/*
          LIMPAR só aparece quando há o que limpar. Um botão de apagar sobre uma
          caixa vazia é um controle que nunca faz nada — e um controle que nunca
          faz nada ensina a ignorar a fileira em que ele mora.
        */}
        {temTexto ? (
          <button
            type="button"
            onClick={limpar}
            className="nx-cut-4 inline-flex shrink-0 cursor-pointer items-center gap-1.5 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.06em] transition-colors duration-[var(--duration-fast)]"
            style={
              confirmando
                ? { color: "var(--status-critical)", background: "var(--status-critical-bg)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            <Eraser className="h-3 w-3" strokeWidth={1.6} aria-hidden />
            {confirmando ? "Apagar?" : "Limpar"}
          </button>
        ) : null}
      </div>
    </Casco>
  );
}

/**
 * O CARIMBO — "salvo agora", "salvo há 4 min", "escrevendo…".
 *
 * O instante da gravação sai de uma SEGUNDA chave do armazém, e não do texto.
 * Guardar `{texto, quando}` num JSON só significaria reescrever e reparsear a
 * nota inteira a cada tecla para carimbar a hora — e o texto é a coisa que mais
 * cresce neste widget.
 */
function Carimbo({ estado }: { estado: "vazio" | "salvo" | "escrevendo" }) {
  const [em, setEm] = React.useState("");

  /*
   * O CARIMBO ENVELHECE SOZINHO. Sem o intervalo, "salvo agora" continuaria
   * dizendo "agora" vinte minutos depois — e é justamente aos vinte minutos que
   * a frase passa a importar. Um minuto é a menor unidade que `quando` desenha,
   * então é de minuto em minuto que vale reamostrar.
   */
  React.useEffect(() => {
    if (estado !== "salvo") return;

    const ler = () => setEm(lerBruto(CHAVE_QUANDO));
    ler();
    const id = window.setInterval(ler, 60_000);
    return () => window.clearInterval(id);
  }, [estado]);

  if (estado === "vazio") return null;

  return (
    <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
      {estado === "escrevendo" ? "escrevendo…" : em ? `salvo ${quando(em)}` : "salvo"}
    </span>
  );
}
