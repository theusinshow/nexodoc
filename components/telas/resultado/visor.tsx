"use client";

/**
 * O VISOR DO MEMORIAL (desenho do lab: resultado-e/visor.tsx), com o PDF de
 * verdade. Abre por cima do resultado, na página do achado, com o trecho
 * grifado; ao lado, os achados daquela página e a fita das páginas que têm
 * achado. ← → folheiam; J K pulam entre páginas com achado; Shift+← → andam
 * entre as páginas DO achado aberto; + − ampliam; Esc fecha.
 */
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns2, MessageSquare, MessageSquareOff, Minus, Plus, SearchX, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { GrifoDeOutro } from "@/components/audit-pdf-viewer-internal";
import { Botao, Orbe, Tecla } from "@/components/ds/basicos";
import { CURVA } from "@/lib/ds/movimento";
import { candidatosDoGrifo, porQueSemGrifo, type FolhasSemCamada } from "@/lib/grifo-do-achado";
import { useTempo } from "@/lib/ds/tempo";
import { NIVEIS } from "@/lib/nivel-do-achado";
import { lerPerguntaSobreAchado, textoDaPergunta } from "@/lib/pergunta-sobre-achado";
import { paginasEmConflito } from "@/lib/trechos-da-evidencia";
import { RotuloDaPergunta } from "@/components/achado/rotulo-da-pergunta";

import type { AchadoDaTela } from "./use-parecer-vivo";
import { NOME_DO_DESFECHO } from "./textos";
import "./visor.css";

const AuditPdfViewer = dynamic(() => import("@/components/audit-pdf-viewer-internal"), {
  ssr: false,
  loading: () => <div className="vm-carregando">Abrindo o memorial…</div>,
});

const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/** A conversa do Nexo vista pelo visor: o que já foi dito e como perguntar. */
export type ChatDoVisor = {
  mensagens: readonly { id: string; role: string; content: string }[];
  enviar: (texto: string) => void;
};

/*
 * O CHAT EMBAIXO DO PDF (05/10/2026, retorno de um usuário). O visor cobre a
 * conversa da direita; a dúvida sobre o achado nascia e não tinha onde ir sem
 * fechar o documento. É a MESMA conversa do Nexo: a pergunta sai pelo composer
 * dela, com o achado e a página no começo, e a resposta é lida das mensagens.
 */
function ChatNoVisor({ chat, achado, pagina }: { chat: ChatDoVisor; achado: AchadoDaTela | undefined; pagina: number }) {
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState<number | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const novas = desde === null ? [] : chat.mensagens.slice(desde).filter((m) => m.content.trim());
  const esperando = desde !== null && (novas.length === 0 || novas[novas.length - 1].role === "user");

  const ultima = novas[novas.length - 1]?.content ?? "";
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "nearest" });
  }, [novas.length, ultima]);

  const enviar = () => {
    const pergunta = texto.trim();
    if (!pergunta || !achado) return;
    if (desde === null) setDesde(chat.mensagens.length);
    chat.enviar(textoDaPergunta(achado, pagina, pergunta));
    setTexto("");
  };

  return (
    <section className="vm-chat" aria-label="Perguntar ao Nexo sobre o achado">
      <p className="vm-chat-cabeca">
        <Orbe tamanho={12} estado={esperando ? "trabalhando" : "repouso"} />
        <b>Pergunte ao Nexo</b>
        <span>{achado ? `sobre o ${achado.id}, p. ${pagina} — a resposta também fica na conversa` : "escolha um achado"}</span>
      </p>
      {novas.length > 0 || esperando ? (
        <div className="vm-chat-mensagens">
          {novas.map((m) => {
            const sobre = m.role === "user" ? lerPerguntaSobreAchado(m.content) : null;
            return (
              <div key={m.id} className={`vm-chat-msg vm-chat-msg--${m.role === "user" ? "eu" : "nexo"}`}>
                {sobre && <RotuloDaPergunta achado={sobre} />}
                <p>{sobre ? sobre.pergunta : m.content}</p>
              </div>
            );
          })}
          {esperando && <p className="vm-chat-msg vm-chat-msg--nexo vm-chat-pensando">Nexo está lendo o memorial…</p>}
          <div ref={fim} />
        </div>
      ) : null}
      <form
        className="vm-chat-campo"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={achado ? "Ex.: o que exatamente diverge entre as páginas?" : "Escolha um achado para perguntar"}
          aria-label="Pergunta ao Nexo sobre este achado"
          disabled={!achado}
        />
        <Botao type="submit" variante="primary" tamanho="sm" icone aria-label="Enviar pergunta (Enter)" title="Enviar (Enter)" disabled={!texto.trim() || !achado}>
          <ArrowUp />
        </Botao>
      </form>
    </section>
  );
}
/*
 * O GRIFO FORA DA VISTA (08/10/2026). Com zoom, a pessoa rola para ler o
 * entorno e o trecho do achado sai da mesa. Uma seta na borda diz para que
 * lado ele ficou; clicar (ou G) traz de volta.
 */
type LadoDoGrifo = "acima" | "abaixo" | "esquerda" | "direita";
function ondeEstaOGrifo(mesa: HTMLElement): LadoDoGrifo | null {
  const faixa = mesa.querySelector(".grifo-faixa--ativo");
  if (!faixa) return null;
  const f = faixa.getBoundingClientRect();
  const m = mesa.getBoundingClientRect();
  if (f.bottom < m.top + 8) return "acima";
  if (f.top > m.bottom - 8) return "abaixo";
  if (f.right < m.left + 8) return "esquerda";
  if (f.left > m.right - 8) return "direita";
  return null;
}
function voltarAoGrifo(mesa: HTMLElement | null) {
  mesa?.querySelector(".grifo-faixa--ativo")?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
}
const SETA_DO_LADO = { acima: ArrowUp, abaixo: ArrowDown, esquerda: ArrowLeft, direita: ArrowRight } as const;

function GrifoForaDaVista({ mesa, rotulo }: { mesa: React.RefObject<HTMLDivElement | null>; rotulo: string }) {
  const [lado, setLado] = useState<LadoDoGrifo | null>(null);
  useEffect(() => {
    const m = mesa.current;
    if (!m) return;
    let quadro = 0;
    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => setLado(ondeEstaOGrifo(m)));
    };
    medir();
    m.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    // A faixa nasce e muda depois que a camada de texto pinta (página, zoom, achado).
    const obs = new MutationObserver(medir);
    obs.observe(m, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(quadro);
      m.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      obs.disconnect();
    };
  }, [mesa]);
  if (!lado) return null;
  const Seta = SETA_DO_LADO[lado];
  return (
    <button type="button" className={`vm-grifo-fora vm-grifo-fora--${lado}`} onClick={() => voltarAoGrifo(mesa.current)} title="Voltar ao grifo (G)">
      <Seta size={14} strokeWidth={2} aria-hidden />
      Grifo do {rotulo} {lado === "acima" || lado === "abaixo" ? lado : `à ${lado}`}
      <Tecla>G</Tecla>
    </button>
  );
}

/*
 * O BALÃO DO ACHADO (08/10/2026): o achado ao lado da prova, preso ao trecho.
 * Recolhido, é uma pílula com o que está errado em uma linha — cobre pouco do
 * texto em volta. Aberto (clique ou B), traz o que fazer e o texto corrigido.
 * Aberto ou recolhido vale para os próximos achados até a pessoa trocar.
 *
 * 15/10/2026: a alça (`data-alca`: a pílula e o topo do aberto) arrasta o
 * balão para longe do texto — o visor do PDF cuida disso — e o botão do topo
 * do visor (Shift B) o esconde de vez.
 */
function BalaoDoAchado({ achado, aberto, onAlternar, onAbrirNaFila }: { achado: AchadoDaTela; aberto: boolean; onAlternar: () => void; onAbrirNaFila: () => void }) {
  const errado = achado.estruturado.descricao || achado.titulo;
  const fazer = achado.estruturado.acao;
  // Só a troca pronta: "sem troca" já está dito no "o que fazer".
  const troca = achado.bruto.texto_corrigido?.tipo === "troca" ? achado.bruto.texto_corrigido : null;
  if (!aberto) {
    return (
      <button type="button" data-alca className={`vm-balao-pilula vm--${achado.nivel}`} onClick={onAlternar} title="Abrir o achado aqui (B) · arraste para mover" aria-expanded={false}>
        <i aria-hidden />
        <b>{achado.id}</b>
        <span>{errado}</span>
        <ChevronDown size={13} aria-hidden />
      </button>
    );
  }
  return (
    <section className={`vm-balao vm--${achado.nivel}`} aria-label={`${achado.id} no trecho`}>
      <header data-alca title="Arraste para mover · duplo clique devolve ao trecho">
        <i aria-hidden />
        <b>{achado.id}</b>
        <small>{NIVEIS.find((n) => n.id === achado.nivel)?.nome}</small>
        <button type="button" onClick={onAlternar} title="Recolher (B)" aria-label="Recolher o balão (B)" aria-expanded>
          <ChevronUp size={14} />
        </button>
      </header>
      <dl>
        <div>
          <dt>O que está errado</dt>
          <dd>{errado}</dd>
        </div>
        {fazer && (
          <div>
            <dt>O que fazer</dt>
            <dd>{fazer}</dd>
          </div>
        )}
        {troca && (
          <div>
            <dt>Texto corrigido</dt>
            <dd className="vm-balao-corrigido">
              <s>{troca.procure_por}</s>
              <span>{troca.substitua_por}</span>
            </dd>
          </div>
        )}
      </dl>
      <button type="button" className="vm-balao-fila" onClick={onAbrirNaFila}>
        Abrir na fila <ArrowRight size={13} />
      </button>
    </section>
  );
}

/*
 * LADO A LADO (08/10/2026): o conflito entre páginas é uma comparação, e ir e
 * voltar com Shift+→ obrigava a guardar uma folha de cabeça para ler a outra.
 * Aqui as duas ficam juntas, cada uma rolando sozinha até o seu trecho.
 */
function FolhaDoLado({
  url,
  pagina,
  grifo,
  tom,
  zoom,
  rotulo,
  onNumPages,
}: {
  url: string;
  pagina: number;
  grifo: string[] | undefined;
  tom: string;
  zoom: number;
  rotulo: string;
  onNumPages: (n: number) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    // A folha em 100% ocupa a coluna inteira, menos o respiro dos lados.
    const medir = () => setLargura(Math.max(240, Math.floor(el.clientWidth - 32)));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <section className="vm-lado-folha" aria-label={`Página ${pagina}`}>
      <p className="vm-lado-folha-cabeca">
        <b className="ds-num">p. {pagina}</b> {rotulo}
      </p>
      <div ref={caixa} className="vm-lado-folha-mesa" data-previa>
        {largura > 0 && <AuditPdfViewer url={url} page={pagina} highlight={grifo} tom={tom} zoom={zoom} largura={largura} rolagem="contida" onNumPages={onNumPages} />}
      </div>
    </section>
  );
}

/** O número curto do achado no pino da folha: "ACH-007" vira "7". */
const rotuloDoPino = (id: string) => id.replace(/^\D*0*/, "") || id;

/** "Página [12] de 40": digitar o número e Enter leva até ela. */
function IrParaPagina({ pagina, total, onIr }: { pagina: number; total: number; onIr: (p: number) => void }) {
  const [texto, setTexto] = useState<string | null>(null);
  const confirmar = () => {
    const n = Number(texto);
    if (texto !== null && Number.isInteger(n) && n >= 1) onIr(n);
    setTexto(null);
  };
  return (
    <label className="ds-num vm-irpara">
      Página
      <input
        inputMode="numeric"
        value={texto ?? String(pagina)}
        onChange={(e) => setTexto(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
        onFocus={(e) => e.target.select()}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") setTexto(null);
        }}
        aria-label="Ir para a página"
        size={Math.max(2, String(total || pagina).length)}
      />
      {total ? ` de ${total}` : ""}
    </label>
  );
}
const ease = (c: readonly number[]) => [...c] as [number, number, number, number];

export function VisorDoMemorial({
  achados,
  url,
  arquivo,
  inicial,
  paginaInicial,
  folhas,
  chat,
  aberto,
  onFechar,
  onIrParaAchado,
}: {
  /** Os achados deste arquivo. */
  achados: AchadoDaTela[];
  url: string | null;
  arquivo: string;
  inicial: string | null;
  /** A página pedida ("Abrir p. 22" num achado entre páginas); sem ela, a primeira do achado. */
  paginaInicial?: number | null;
  /** Onde o texto não está na camada do PDF (cobertura do parecer) — para dizer por que não há grifo. */
  folhas?: FolhasSemCamada | null;
  /** A conversa do Nexo: sem ela (fora do palco), o visor não mostra o chat. */
  chat?: ChatDoVisor;
  aberto: boolean;
  onFechar: () => void;
  onIrParaAchado: (chave: string) => void;
}) {
  const { dur, mola } = useTempo();
  const paginasComAchado = useMemo(() => [...new Set(achados.flatMap((a) => a.paginas))].sort((x, y) => x - y), [achados]);
  const primeiro = achados.find((a) => a.chave === inicial) ?? achados.find((a) => !a.desfecho) ?? achados[0];
  const [pagina, setPagina] = useState(paginaInicial ?? primeiro?.paginas[0] ?? 1);
  const [ativo, setAtivo] = useState(primeiro?.chave ?? "");
  const [zoom, setZoom] = useState(1);
  const [total, setTotal] = useState(0);
  // O achado sob o mouse, na lista ou no pino: o grifo dele acende na folha.
  const [sobre, setSobre] = useState<string | null>(null);
  const [balaoAberto, setBalaoAberto] = useState(false);
  // "Volta ao grifo" (G) também traz de volta o balão que foi arrastado.
  const [voltaDoBalao, setVoltaDoBalao] = useState(0);
  // Esconder o balão vale para as próximas vezes que o visor abrir.
  const [balaoVisivel, setBalaoVisivel] = useState(() => {
    try {
      return localStorage.getItem("nexo:visor:balao") !== "oculto";
    } catch {
      return true;
    }
  });
  const alternarBalaoVisivel = () =>
    setBalaoVisivel((v) => {
      try {
        localStorage.setItem("nexo:visor:balao", v ? "oculto" : "visivel");
      } catch {
        /* sem armazenamento: vale só nesta sessão */
      }
      return !v;
    });
  // O conflito entre páginas já abre lado a lado; o resto, na folha única.
  const [ladoALado, setLadoALado] = useState(() => paginasEmConflito(primeiro?.bruto.evidencia).length >= 2);
  const mesaRef = useRef<HTMLDivElement>(null);
  const visorRef = useRef<HTMLElement>(null);

  /*
   * O FOCO MORA NO VISOR (08/10/2026). Ele abria por cima da tela e o foco
   * ficava lá atrás: Tab andava pela fila escondida. Agora o foco entra ao
   * abrir, o Tab dá a volta dentro dele e, ao fechar, volta para quem o abriu.
   */
  useEffect(() => {
    if (!aberto) return;
    const antes = document.activeElement as HTMLElement | null;
    const quadro = requestAnimationFrame(() => visorRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(quadro);
      if (antes?.isConnected) antes.focus({ preventScroll: true });
    };
  }, [aberto]);

  /*
   * 100% É A LARGURA DA MESA (08/10/2026). A folha tinha 520 px fixos numa
   * mesa de 780 — 67% do espaço, letra pequena sem necessidade. Agora 100% é a
   * folha na largura da mesa (menos o respiro), e o zoom multiplica isso.
   */
  const [larguraDaMesa, setLarguraDaMesa] = useState(0);
  useEffect(() => {
    const m = mesaRef.current;
    if (!aberto || !m) return;
    const medir = () => setLarguraDaMesa(m.clientWidth);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(m);
    return () => obs.disconnect();
  });
  const larguraDaFolha = larguraDaMesa ? Math.max(320, larguraDaMesa - 56) : 0;

  /*
   * A RODA PASSA DE FOLHA (08/10/2026). O visor mostra uma folha por vez; no
   * pé dela, continuar rolando para baixo leva à seguinte (pelo topo), e no
   * topo, rolar para cima leva à anterior (pelo pé). Um tanto de giro
   * acumulado, para um toque à toa não virar a página.
   */
  const giro = useRef({ soma: 0, ate: 0 });
  // Por onde a folha virada pela roda chega. A roda não se cancela (o evento é
  // passivo): os giros que ainda vêm rolariam a folha nova; ela fica presa no
  // topo (ou no pé) durante a pausa.
  const chegada = useRef<"topo" | "pe" | null>(null);
  useEffect(() => {
    const lado = chegada.current;
    chegada.current = null;
    const m = mesaRef.current;
    if (!lado || !m) return;
    const fim = performance.now() + 700;
    let quadro = 0;
    const prender = () => {
      m.scrollTop = lado === "pe" ? m.scrollHeight : 0;
      if (performance.now() < fim) quadro = requestAnimationFrame(prender);
    };
    quadro = requestAnimationFrame(prender);
    return () => cancelAnimationFrame(quadro);
  }, [pagina]);

  /*
   * O GRIFO PODE ESTAR EM OUTRA PÁGINA DO ACHADO: ele cita "1, 2" e o trecho
   * está na 2. Abrindo na primeira, o visor mostrava a página sem marca. Se o
   * trecho não está aqui, vai à próxima página do achado — uma volta só.
   */
  const [procurando, setProcurando] = useState(true);
  // O último veredito do grifo, por página: é ele que acende o aviso "sem grifo".
  const [casou, setCasou] = useState<{ pagina: number; achou: boolean } | null>(null);
  const aoGrifo = useCallback(
    (achou: boolean, p: number) => {
      setCasou({ pagina: p, achou });
      if (!procurando) return;
      const doAtivoAgora = achados.find((a) => a.chave === ativo);
      const proxima = doAtivoAgora?.paginas.find((x) => x > p);
      if (achou || !proxima) setProcurando(false);
      else setPagina(proxima);
    },
    [procurando, achados, ativo],
  );

  const daPagina = achados.filter((a) => a.paginas.includes(pagina));
  const doAtivo = achados.find((a) => a.chave === ativo && a.paginas.includes(pagina)) ?? daPagina[0];
  // Os candidatos DESTA página: no achado entre páginas, a p. 22 procura o
  // trecho da p. 22, e não o da p. 10 (ver lib/grifo-do-achado.ts).
  // Sem memo: o visor do PDF já reduz a lista a uma chave estável (`needle`).
  const grifo = doAtivo ? candidatosDoGrifo(doAtivo.bruto, pagina) : undefined;
  // Os OUTROS achados desta página, grifados mais fracos, cada um no seu tom.
  const outros: GrifoDeOutro[] = daPagina
    .filter((a) => a.chave !== doAtivo?.chave)
    .map((a) => ({ chave: a.chave, tom: a.nivel, rotulo: rotuloDoPino(a.id), titulo: `${a.id} · ${a.titulo}`, candidatos: candidatosDoGrifo(a.bruto, pagina) }));

  /*
   * FOLHEAR NÃO TROCA DE ACHADO (07/10/2026). `ir` escolhia o primeiro achado
   * da página nova: no achado que se repete em várias páginas, avançar para a
   * próxima grifava OUTRO achado que estivesse lá. O ativo só muda quando a
   * página nova não tem nada dele.
   */
  const ir = (p: number) => {
    setProcurando(false);
    const alvo = Math.max(1, total ? Math.min(total, p) : p);
    setPagina(alvo);
    const atual = achados.find((x) => x.chave === ativo);
    if (atual?.paginas.includes(alvo)) return;
    const a = achados.find((x) => x.paginas.includes(alvo));
    if (a) setAtivo(a.chave);
  };
  // As páginas DO achado aberto, para andar entre elas sem passar pelas outras.
  const paginasDoAtivo = doAtivo ? [...new Set(doAtivo.paginas)].sort((x, y) => x - y) : [];
  const posicaoNoAtivo = paginasDoAtivo.indexOf(pagina);
  const anteriorDoAtivo = [...paginasDoAtivo].reverse().find((p) => p < pagina);
  const proximaDoAtivo = paginasDoAtivo.find((p) => p > pagina);
  // O par lado a lado: a página atual e a seguinte do achado (a anterior, se esta é a última).
  const emLadoALado = Boolean(url) && ladoALado && paginasDoAtivo.length >= 2;
  const esquerda = paginasDoAtivo.includes(pagina) ? pagina : (paginasDoAtivo[0] ?? pagina);
  const direita = paginasDoAtivo.find((p) => p > esquerda) ?? [...paginasDoAtivo].reverse().find((p) => p < esquerda) ?? esquerda;
  const [primeiraDoPar, segundaDoPar] = esquerda < direita ? [esquerda, direita] : [direita, esquerda];
  const conflito = doAtivo ? paginasEmConflito(doAtivo.bruto.evidencia) : [];
  const zoomPasso = (passo: number) => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(z) + passo))]);
  const vizinha = (passo: number) => {
    const lista = paginasComAchado;
    if (!lista.length) return;
    const i = lista.indexOf(pagina);
    if (i < 0) return ir(passo > 0 ? (lista.find((p) => p > pagina) ?? lista[0]) : ([...lista].reverse().find((p) => p < pagina) ?? lista[lista.length - 1]));
    ir(lista[(i + passo + lista.length) % lista.length]);
  };

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Tab" && visorRef.current) {
        // O Tab dá a volta dentro do visor.
        const focaveis = [...visorRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')].filter((el) => el.offsetParent !== null);
        if (!focaveis.length) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        const aqui = document.activeElement;
        if (!visorRef.current.contains(aqui) || aqui === visorRef.current) {
          e.preventDefault();
          (e.shiftKey ? ultimo : primeiro).focus();
        } else if (e.shiftKey && aqui === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && aqui === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
        return;
      }
      if ((e.target as HTMLElement).closest("input, textarea")) {
        // No campo do chat, Esc só sai do campo; o visor fecha no segundo Esc.
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onFechar();
      } else if (e.key === "ArrowRight" && e.shiftKey) {
        if (proximaDoAtivo) ir(proximaDoAtivo);
      } else if (e.key === "ArrowLeft" && e.shiftKey) {
        if (anteriorDoAtivo) ir(anteriorDoAtivo);
      } else if (e.key === "ArrowRight") ir(pagina + 1);
      else if (e.key === "ArrowLeft") ir(pagina - 1);
      else if ((e.key === "+" || e.key === "=") && !e.ctrlKey && !e.metaKey) zoomPasso(1);
      else if (e.key === "-" && !e.ctrlKey && !e.metaKey) zoomPasso(-1);
      else if (e.key.toLowerCase() === "j" && !e.ctrlKey && !e.metaKey) vizinha(1);
      else if (e.key.toLowerCase() === "k" && !e.ctrlKey && !e.metaKey) vizinha(-1);
      else if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
        voltarAoGrifo(mesaRef.current);
        setVoltaDoBalao((n) => n + 1);
      }
      else if (e.key === "0" && !e.ctrlKey && !e.metaKey) setZoom(1);
      else if (e.key.toLowerCase() === "b" && e.shiftKey && !e.ctrlKey && !e.metaKey) alternarBalaoVisivel();
      else if (e.key.toLowerCase() === "b" && !e.ctrlKey && !e.metaKey) {
        // Com o balão escondido, B o traz de volta em vez de abrir às cegas.
        if (!balaoVisivel) alternarBalaoVisivel();
        else setBalaoAberto((v) => !v);
      }
      else if (e.key.toLowerCase() === "l" && !e.ctrlKey && !e.metaKey && paginasDoAtivo.length >= 2) {
        if (!ladoALado && !paginasDoAtivo.includes(pagina)) ir(paginasDoAtivo[0]);
        setLadoALado((v) => !v);
      }
    };
    document.addEventListener("keydown", tecla, true);
    return () => document.removeEventListener("keydown", tecla, true);
  });

  const nivelDe = (a: AchadoDaTela) => a.nivel;

  /*
   * NUM PORTAL, na raiz `.ds` (02/10/2026): dentro do palco, o empilhamento dele
   * deixava o topo e a coluna do chat por cima do visor. Na raiz, o CSS do ds
   * continua valendo e o visor cobre a tela inteira, como no lab.
   */
  if (typeof document === "undefined") return null;
  const raiz = document.querySelector(".ds") ?? document.body;

  return createPortal(
    <AnimatePresence>
      {aberto && (
        <motion.div className="vm-fundo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur("state") }} onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
          <motion.section
            ref={visorRef}
            tabIndex={-1}
            className="vm"
            role="dialog"
            aria-modal="true"
            aria-label="Memorial com os achados"
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0, transition: { duration: dur("state"), ease: ease(CURVA.exit) } }}
            transition={mola("smooth")}
          >
            <header className="vm-topo">
              <div className="vm-titulo">
                <b>{arquivo}</b>
                <span>Memorial descritivo</span>
              </div>
              <div className="vm-navegar">
                <Botao variante="quiet" tamanho="sm" icone aria-label="Página anterior (←)" onClick={() => ir(pagina - 1)} disabled={pagina <= 1}>
                  <ChevronLeft />
                </Botao>
                <IrParaPagina pagina={pagina} total={total} onIr={ir} />
                <Botao variante="quiet" tamanho="sm" icone aria-label="Próxima página (→)" onClick={() => ir(pagina + 1)} disabled={Boolean(total) && pagina >= total}>
                  <ChevronRight />
                </Botao>
              </div>
              <div className="vm-zoom">
                <Botao variante="quiet" tamanho="sm" icone aria-label="Diminuir zoom (−)" title="Diminuir zoom (−)" onClick={() => zoomPasso(-1)} disabled={zoom === ZOOMS[0]}>
                  <Minus />
                </Botao>
                <button type="button" className="ds-num vm-zoom-valor" onClick={() => setZoom(1)} title="Ajustar à largura (0)" aria-label={`Zoom de ${Math.round(zoom * 100)}%. Ajustar à largura (0)`}>
                  {Math.round(zoom * 100)}%
                </button>
                <Botao variante="quiet" tamanho="sm" icone aria-label="Aumentar zoom (+)" title="Aumentar zoom (+)" onClick={() => zoomPasso(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]}>
                  <Plus />
                </Botao>
              </div>
              <Botao
                variante={balaoVisivel ? "quiet" : "ghost"}
                tamanho="sm"
                icone
                aria-pressed={!balaoVisivel}
                aria-label={balaoVisivel ? "Esconder o balão do achado (Shift B)" : "Mostrar o balão do achado (Shift B)"}
                title={balaoVisivel ? "Esconder o balão (Shift B)" : "Mostrar o balão (Shift B)"}
                onClick={alternarBalaoVisivel}
              >
                {balaoVisivel ? <MessageSquare /> : <MessageSquareOff />}
              </Botao>
              <Botao variante="quiet" tamanho="sm" icone aria-label="Fechar (Esc)" title="Fechar (Esc)" onClick={onFechar}>
                <X />
              </Botao>
            </header>

            <div className={`vm-corpo${emLadoALado ? " vm-corpo--lado-a-lado" : ""}`}>
              <div className="vm-esquerda">
              {doAtivo && paginasDoAtivo.length > 1 && (
                <nav className={`vm-doachado vm--${doAtivo.nivel}`} aria-label={`Páginas do ${doAtivo.id}`}>
                  <span className="vm-doachado-rotulo">
                    <i aria-hidden /> <b>{doAtivo.id}</b> em {paginasDoAtivo.length} páginas
                    {posicaoNoAtivo >= 0 && <span className="ds-num"> · {posicaoNoAtivo + 1} de {paginasDoAtivo.length}</span>}
                  </span>
                  <Botao variante="quiet" tamanho="sm" icone aria-label="Página anterior deste achado (Shift ←)" title="Página anterior deste achado (Shift ←)" onClick={() => anteriorDoAtivo && ir(anteriorDoAtivo)} disabled={!anteriorDoAtivo}>
                    <ChevronLeft />
                  </Botao>
                  <span className="vm-doachado-paginas">
                    {paginasDoAtivo.map((p) => (
                      <button key={p} type="button" className={p === pagina ? "vm-doachado-aqui" : undefined} aria-current={p === pagina ? "page" : undefined} onClick={() => ir(p)}>
                        p. {p}
                      </button>
                    ))}
                  </span>
                  <Botao variante="quiet" tamanho="sm" icone aria-label="Próxima página deste achado (Shift →)" title="Próxima página deste achado (Shift →)" onClick={() => proximaDoAtivo && ir(proximaDoAtivo)} disabled={!proximaDoAtivo}>
                    <ChevronRight />
                  </Botao>
                  <Botao
                    variante={emLadoALado ? "ghost" : "quiet"}
                    tamanho="sm"
                    className="vm-doachado-lado"
                    aria-pressed={emLadoALado}
                    title="Comparar as páginas lado a lado (L)"
                    onClick={() => {
                      if (!ladoALado && !paginasDoAtivo.includes(pagina)) ir(paginasDoAtivo[0]);
                      setLadoALado((v) => !v);
                    }}
                  >
                    <Columns2 /> {emLadoALado ? "Uma página" : "Lado a lado"}
                  </Botao>
                </nav>
              )}
              <div className="vm-mesa-moldura">
              {emLadoALado && url && doAtivo ? (
                <div className="vm-mesa vm-lado-a-lado">
                  {[primeiraDoPar, segundaDoPar].map((p) => {
                    const i = conflito.indexOf(p);
                    return (
                      <FolhaDoLado
                        key={p}
                        url={url}
                        pagina={p}
                        grifo={candidatosDoGrifo(doAtivo.bruto, p)}
                        tom={doAtivo.nivel}
                        zoom={zoom}
                        rotulo={i >= 0 ? `trecho ${i + 1} de ${conflito.length}` : `do ${doAtivo.id}`}
                        onNumPages={setTotal}
                      />
                    );
                  })}
                </div>
              ) : (
              <div
                ref={mesaRef}
                className="vm-mesa vm-mesa--pdf"
                onWheel={(e) => {
                  const m = e.currentTarget;
                  const agora = performance.now();
                  if (agora < giro.current.ate) return;
                  const noPe = m.scrollTop + m.clientHeight >= m.scrollHeight - 2;
                  const noTopo = m.scrollTop <= 0;
                  if ((e.deltaY > 0 && noPe) || (e.deltaY < 0 && noTopo)) giro.current.soma += e.deltaY;
                  else giro.current.soma = 0;
                  if (Math.abs(giro.current.soma) < 240) return;
                  const passo = giro.current.soma > 0 ? 1 : -1;
                  giro.current = { soma: 0, ate: agora + 700 };
                  const alvo = pagina + passo;
                  if (alvo < 1 || (total && alvo > total)) return;
                  chegada.current = passo < 0 ? "pe" : "topo";
                  ir(alvo);
                }}
              >
                {url ? (
                  <div className="vm-pdf">
                    {!procurando && casou?.pagina === pagina && !casou.achou && grifo?.length ? (
                      <p className="vm-sem-grifo" role="status">
                        <SearchX size={15} strokeWidth={1.75} aria-hidden />
                        <span>{porQueSemGrifo(pagina, folhas)}</span>
                      </p>
                    ) : null}
                    <AuditPdfViewer
                      url={url}
                      page={pagina}
                      highlight={grifo}
                      tom={doAtivo?.nivel}
                      outros={outros}
                      pinoDoAtivo={doAtivo ? { chave: doAtivo.chave, rotulo: rotuloDoPino(doAtivo.id), titulo: `${doAtivo.id} · ${doAtivo.titulo}` } : undefined}
                      onEscolher={setAtivo}
                      realce={sobre}
                      onRealce={setSobre}
                      balao={doAtivo && balaoVisivel ? <BalaoDoAchado achado={doAtivo} aberto={balaoAberto} onAlternar={() => setBalaoAberto((v) => !v)} onAbrirNaFila={() => onIrParaAchado(doAtivo.chave)} /> : undefined}
                      voltaDoBalao={voltaDoBalao}
                      zoom={zoom}
                      largura={larguraDaFolha || undefined}
                      onNumPages={setTotal}
                      onGrifo={aoGrifo}
                    />
                    {/* No pé da folha, onde a leitura acaba: o achado continua adiante. */}
                    {proximaDoAtivo && doAtivo && (
                      <Botao variante="ghost" tamanho="sm" className={`vm-continua vm--${doAtivo.nivel}`} onClick={() => ir(proximaDoAtivo)}>
                        {doAtivo.id} continua na p. {proximaDoAtivo} <ArrowRight />
                      </Botao>
                    )}
                  </div>
                ) : (
                  <p className="vm-sem">O arquivo deste memorial não está nesta máquina. Anexe-o de novo na conversa para ver o trecho na página.</p>
                )}
              </div>
              )}
              {url && doAtivo && !emLadoALado && <GrifoForaDaVista mesa={mesaRef} rotulo={doAtivo.id} />}
              </div>
              {chat && <ChatNoVisor chat={chat} achado={doAtivo} pagina={pagina} />}
              </div>

              <aside className="vm-lado">
                <h3>{daPagina.length ? `Nesta página, ${daPagina.length === 1 ? "1 achado" : `${daPagina.length} achados`}` : "Nesta página"}</h3>
                {daPagina.map((a) => (
                  <button
                    key={a.chave}
                    type="button"
                    className={`vm-achado vm--${nivelDe(a)}${a.chave === doAtivo?.chave ? " vm-achado--ativo" : ""}${a.chave === sobre ? " vm-achado--sobre" : ""}`}
                    onClick={() => setAtivo(a.chave)}
                    onMouseEnter={() => setSobre(a.chave)}
                    onMouseLeave={() => setSobre(null)}
                  >
                    <span className="vm-achado-id">
                      <i /> {a.id} <small>{NIVEIS.find((x) => x.id === a.nivel)?.nome}</small>
                    </span>
                    <b>{a.titulo}</b>
                    {a.desfecho && <span className="vm-achado-feito">{NOME_DO_DESFECHO[a.desfecho.tipo]}</span>}
                    {a.chave === doAtivo?.chave && (
                      <span
                        className="vm-achado-abrir"
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onIrParaAchado(a.chave);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onIrParaAchado(a.chave);
                        }}
                      >
                        Abrir na fila <ArrowRight size={13} />
                      </span>
                    )}
                  </button>
                ))}
                {!daPagina.length && <p className="rs-nota">Use J e K para ir às páginas que têm achado.</p>}

                <div className="vm-paginas">
                  <h3>Páginas com achados</h3>
                  <div>
                    {paginasComAchado.map((p) => {
                      const doP = achados.filter((a) => a.paginas.includes(p));
                      const pior = NIVEIS.find((n) => doP.some((a) => a.nivel === n.id))?.id;
                      return (
                        <button key={p} type="button" className={`vm-pag vm--${pior}${p === pagina ? " vm-pag--aqui" : ""}`} onClick={() => ir(p)}>
                          {p}
                          {doP.length > 1 && <small>{doP.length}</small>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="rs-nota">
                    <Tecla>J</Tecla> <Tecla>K</Tecla> entre elas, <Tecla>←</Tecla> <Tecla>→</Tecla> folheia, <Tecla>Shift</Tecla> <Tecla>→</Tecla> segue o achado, <Tecla>+</Tecla> <Tecla>−</Tecla> zoom, <Tecla>G</Tecla> volta ao grifo, <Tecla>B</Tecla> abre o balão (arraste para mover, <Tecla>Shift</Tecla> <Tecla>B</Tecla> esconde), <Tecla>L</Tecla> lado a lado
                  </p>
                </div>
              </aside>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    raiz,
  );
}

