"use client";

/**
 * NO DOCUMENTO (desenho do lab: resultado-e/documento.tsx): o parecer visto
 * pelas páginas do memorial. "Com achados" põe uma coluna por página — a
 * página de verdade em miniatura, as etiquetas na cor do nível e as notas —;
 * "Todas" mostra o documento inteiro como uma grade de páginas, para ver onde
 * os problemas se juntam. Clicar abre o visor na página, com o trecho grifado.
 *
 * Teclas (em "Com achados"): J K percorrem, C corrige, Enter abre no memorial.
 */
import { AnimatePresence, motion } from "motion/react";
import { Check, FileSearch, ScanText } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Segmento, Tecla } from "@/components/ds/basicos";
import type { AuditReport } from "@/lib/audit-report";
import { useTempo } from "@/lib/ds/tempo";
import { resolverFonte, type FonteDoCatalogo } from "@/lib/fonte-da-evidencia";
import { DISCIPLINAS, NIVEIS, type Nivel } from "@/lib/nivel-do-achado";
import { paginasMudasPendentes } from "@/lib/resumo-do-esforco";

import { NOME_DO_DESFECHO } from "./textos";
import type { AchadoDaTela, ParecerVivo } from "./use-parecer-vivo";

const Miniaturas = dynamic(() => import("./miniaturas-internal"), {
  ssr: false,
  loading: () => <p className="nd-vazio">Abrindo o memorial…</p>,
});

const LARGURA_DA_MINIATURA = 150;

/** A etiqueta: cheia é pendente; vazada, tratada — dá para ver de longe o que falta. */
function Etiqueta({ a, aceso, curta }: { a: AchadoDaTela; aceso: boolean; curta?: boolean }) {
  return (
    <span className={`nd-etq${curta ? " nd-etq--margem" : ""} nd--${a.nivel}${a.desfecho ? " nd-etq--tratada" : ""}${aceso ? " nd-etq--acesa" : ""}`}>
      {curta ? a.id.replace(/^ACH-0*/, "") : a.id}
    </span>
  );
}

export function NoDocumento({
  report,
  parecer,
  catalogo,
  onVerNoMemorial,
  onAbrir,
}: {
  report: AuditReport;
  parecer: ParecerVivo;
  catalogo: FonteDoCatalogo[];
  onVerNoMemorial: (chave: string) => void;
  onAbrir: (chave: string) => void;
}) {
  const { dur } = useTempo();
  const [vista, setVista] = useState<"com" | "todas">("com");
  const [aceso, setAceso] = useState<string | null>(null);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [ocultos, setOcultos] = useState<Nivel[]>([]);
  const raiz = useRef<HTMLDivElement>(null);

  const achados = parecer.achados.filter((a) => a.confirmado);
  // O documento principal: o do primeiro achado com arquivo (o memorial auditado).
  const fonte = achados.map((a) => resolverFonte({ arquivo: a.estruturado.documento }, catalogo)).find((f) => f.tipo === "arquivo");
  const url = fonte?.tipo === "arquivo" ? fonte.fonte.url : null;
  const totalDePaginas = Math.max(0, ...report.arquivos_analisados.map((a) => a.paginas ?? 0), ...achados.flatMap((a) => a.paginas));
  const mudas = report.arquivos_analisados.reduce((s, a) => s + (a.cobertura ? paginasMudasPendentes(a.cobertura) : 0), 0);

  const ordem = (a: AchadoDaTela) => NIVEIS.findIndex((n) => n.id === a.nivel);
  const visiveis = achados.filter((a) => !ocultos.includes(a.nivel));
  const paginas = [...new Set(visiveis.flatMap((a) => a.paginas.slice(0, 1)))].sort((x, y) => x - y);
  const daPagina = (p: number) => visiveis.filter((a) => a.paginas[0] === p).sort((x, y) => ordem(x) - ordem(y));
  const leitura = paginas.flatMap(daPagina);
  const lit = aceso ?? ativo;
  const pior = (p: number) => NIVEIS.find((n) => visiveis.some((a) => a.paginas.includes(p) && a.nivel === n.id))?.id;

  const mover = (passo: number) => {
    if (!leitura.length) return;
    const i = leitura.findIndex((a) => a.chave === ativo);
    const prox = leitura[i < 0 ? (passo > 0 ? 0 : leitura.length - 1) : (i + passo + leitura.length) % leitura.length]!;
    setAtivo(prox.chave);
    raiz.current?.querySelector(`[data-achado="${prox.chave}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  useEffect(() => {
    if (vista !== "com") return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, [role='dialog']") || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.key.toLowerCase();
      const atual = achados.find((a) => a.chave === ativo);
      if (t === "j") mover(1);
      else if (t === "k") mover(-1);
      else if (atual && e.key === "Enter") {
        e.preventDefault();
        onVerNoMemorial(atual.chave);
      } else if (atual && t === "c") void (atual.desfecho ? parecer.reabrir(atual) : parecer.encerrar(atual, "FIXED_IN_DOC"));
    };
    document.addEventListener("keydown", tecla, true);
    return () => document.removeEventListener("keydown", tecla, true);
  });

  const coluna = (p: number, miniatura: ReactNode) => {
    const dela = daPagina(p);
    const pendentes = dela.filter((a) => !a.desfecho).length;
    return (
      <section key={p} className="nd-coluna">
        <header className="nd-pagina">
          <span className="ds-num">p. {p}</span>
          {pendentes ? (
            <span className="nd-pagina-falta">{pendentes === 1 ? "1 pendente" : `${pendentes} pendentes`}</span>
          ) : (
            <span className="nd-pagina-ok">
              tratada <Check size={12} />
            </span>
          )}
        </header>
        <button type="button" className="nd-folha-botao nd-folha-botao--real" onClick={() => onVerNoMemorial(dela[0]!.chave)} title="Ver no memorial">
          <span className="nd-real">{miniatura}</span>
          <span className="nd-margem" aria-hidden>
            {dela.map((a) => (
              <Etiqueta key={a.chave} a={a} aceso={lit === a.chave} curta />
            ))}
          </span>
        </button>
        <ol className="nd-notas">
          {dela.map((a) => (
            <li
              key={a.chave}
              data-achado={a.chave}
              className={`nd-nota${lit === a.chave ? " nd-nota--acesa" : ""}${ativo === a.chave ? " nd-nota--ativa" : ""}${a.desfecho ? " nd-nota--tratada" : ""}`}
              onMouseEnter={() => setAceso(a.chave)}
              onMouseLeave={() => setAceso(null)}
            >
              <Etiqueta a={a} aceso={lit === a.chave} />
              <button type="button" className="nd-nota-memorial" aria-label={`Ver ${a.id} no memorial`} title="Ver no memorial (Enter)" onClick={() => onVerNoMemorial(a.chave)}>
                <FileSearch size={13} />
              </button>
              <button
                type="button"
                className="nd-nota-texto"
                onClick={() => {
                  setAtivo(a.chave);
                  onAbrir(a.chave);
                }}
              >
                <b>{a.titulo}</b>
                <small>
                  {a.discs.map((id) => DISCIPLINAS.find((d) => d.id === id)?.sigla ?? "GER").join(" · ")}
                  {a.desfecho ? `, ${NOME_DO_DESFECHO[a.desfecho.tipo].toLowerCase()}` : ""}
                </small>
              </button>
            </li>
          ))}
        </ol>
      </section>
    );
  };

  return (
    <div className="nd" ref={raiz}>
      <div className="nd-barra" data-tour="no-documento-barra">
        <Segmento
          rotulo="Páginas"
          valor={vista}
          onTroca={setVista}
          opcoes={[
            { valor: "com", rotulo: <>Com achados <em>{new Set(achados.flatMap((a) => a.paginas.slice(0, 1))).size}</em></> },
            { valor: "todas", rotulo: <>Todas <em>{totalDePaginas}</em></> },
          ]}
        />
        {/* a legenda é o filtro: clicar esconde ou mostra o nível */}
        <span className="nd-filtro" role="group" aria-label="Níveis à mostra">
          {NIVEIS.map((n) => {
            const quantos = achados.filter((a) => a.nivel === n.id).length;
            if (!quantos) return null;
            const ligado = !ocultos.includes(n.id);
            return (
              <button key={n.id} type="button" aria-pressed={ligado} className={`nd-filtro-item nd--${n.id}`} onClick={() => setOcultos((o) => (ligado ? [...o, n.id] : o.filter((x) => x !== n.id)))}>
                <i />
                {n.nome}
                <em>{quantos}</em>
              </button>
            );
          })}
        </span>
        {vista === "com" && (
          <span className="nd-atalhos">
            <Tecla>J</Tecla>
            <Tecla>K</Tecla> percorrem, <Tecla>C</Tecla> corrige, <Tecla>↵</Tecla> abre
          </span>
        )}
      </div>

      {!url && (
        <div className="nd-aviso">
          <FileSearch size={16} />
          <span>
            <b>O PDF não está nesta máquina.</b> Os achados estão aqui; para ver as páginas, anexe o memorial de novo na conversa.
          </span>
        </div>
      )}
      {vista === "todas" && mudas > 0 && (
        <div className="nd-aviso nd-aviso--neutro">
          <ScanText size={16} />
          <span>
            <b>{mudas === 1 ? "1 página só com desenho não foi lida" : `${mudas} páginas só com desenho não foram lidas`}.</b> A análise é do texto; “Transcrever e auditar”, no cartão da auditoria, lê o que está escrito nos desenhos.
          </span>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {vista === "com" ? (
          <motion.div key="com" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur("feedback") }}>
            {paginas.length === 0 ? (
              <p className="nd-vazio">{achados.length ? "Nenhum achado nos níveis escolhidos. Ligue um nível na legenda." : "Nenhum achado nesta auditoria."}</p>
            ) : url ? (
              <Miniaturas url={url} paginas={paginas} largura={LARGURA_DA_MINIATURA} coluna={coluna} className="nd-colunas" />
            ) : (
              <div className="nd-colunas">{paginas.map((p) => coluna(p, <span className="nd-folha nd-folha--remota" />))}</div>
            )}
          </motion.div>
        ) : (
          <motion.div key="todas" className="nd-todas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur("feedback") }}>
            {Array.from({ length: totalDePaginas }, (_, i) => {
              const p = i + 1;
              const dela = visiveis.filter((a) => a.paginas.includes(p));
              return (
                <button
                  key={p}
                  type="button"
                  className={`nd-mini nd-mini--numero${dela.length ? " nd-mini--com" : ""}`}
                  disabled={!dela.length || !url}
                  onClick={() => onVerNoMemorial(dela[0]!.chave)}
                  title={dela.length ? `Página ${p}: ${dela.length} ${dela.length === 1 ? "achado" : "achados"}` : `Página ${p}: nenhum achado`}
                >
                  <span className="nd-mini-rodape">
                    <span className="ds-num">{p}</span>
                    {dela.length > 0 && <em className={`nd--${pior(p)}`}>{dela.length}</em>}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
