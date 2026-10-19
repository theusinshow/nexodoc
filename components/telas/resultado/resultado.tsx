"use client";

/**
 * O RESULTADO NO PALCO (desenho do lab: Resultado E), com o parecer de verdade.
 * Três leituras do mesmo parecer — Resumo, Achados, Relatório — trocadas pelo
 * trilho da direita (ou 1, 2, 3; o 4 é No documento), e o visor do memorial por
 * cima quando alguém pede "Ver no memorial".
 *
 * O aviso de auditoria incompleta abre o conteúdo, em qualquer leitura: um
 * parecer parcial não pode ser lido como inteiro em nenhuma delas.
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { AvisoDeAuditoriaIncompleta } from "@/components/aviso-de-auditoria-incompleta";
import type { AuditView } from "@/components/audit-result";
import type { AuditReport, FindingDiscipline } from "@/lib/audit-report";
import { CURVA } from "@/lib/ds/movimento";
import { useTempo } from "@/lib/ds/tempo";
import { resolverFonte, type FonteDoCatalogo } from "@/lib/fonte-da-evidencia";
import type { TextoCorrigido } from "@/lib/texto-corrigido";
import type { Nivel } from "@/lib/nivel-do-achado";

import { FaixaDoVeredito } from "./faixa-do-veredito";
import { FilaDeAchadosA } from "./fila-a/fila-a";
import { NoDocumento } from "./no-documento";
import { RelatorioDoParecer } from "./relatorio";
import { ResumoDoParecer, type ComparadoComAnterior } from "./resumo";
import { VisaoGeralDoParecer } from "./geral";
import type { AchadoDaTela, ParecerVivo } from "./use-parecer-vivo";
import { VisorDoMemorial, type ChatDoVisor } from "./visor";
import { AvisoDeResponsabilidade } from "@/components/aviso-de-responsabilidade";
import "./resultado.css";
import "./documento.css";
import "./embutido.css";

const ease = (c: readonly number[]) => [...c] as [number, number, number, number];
export type LeituraDoParecer = AuditView | "documento" | "geral";
const ORDEM: LeituraDoParecer[] = ["geral", "summary", "findings", "report", "documento"];

export function ResultadoDoParecer({
  report,
  parecer,
  auditId,
  catalogo,
  vista,
  onVista,
  podeVerNoDocumento = false,
  achadoEmFoco,
  filaInicial,
  chatDoVisor,
  aoGerarTexto,
  comparado,
  total,
  tratados,
}: {
  report: AuditReport;
  parecer: ParecerVivo;
  auditId?: string | null;
  catalogo: FonteDoCatalogo[];
  vista: LeituraDoParecer;
  onVista: (v: LeituraDoParecer) => void;
  podeVerNoDocumento?: boolean;
  achadoEmFoco?: string | null;
  /** A fila abre filtrada ("meus": o link do e-mail). */
  filaInicial?: "meus" | null;
  /** A conversa do Nexo, para perguntar sem fechar o visor. */
  chatDoVisor?: ChatDoVisor;
  aoGerarTexto?: (findingId: string, texto: TextoCorrigido) => void;
  /** O que mudou desde a auditoria anterior desta conversa (o cartão "Desde 18/09" do lab). */
  comparado?: ComparadoComAnterior | null;
  /** Os mesmos números do anel do trilho: a faixa e o anel não podem discordar. */
  total: number;
  tratados: number;
}) {
  const { dur } = useTempo();
  const [aberto, setAberto] = useState<string | null>(achadoEmFoco ?? null);
  const [filaKey, setFilaKey] = useState(0);
  const [visor, setVisor] = useState<string | null>(null);
  const [paginaDoVisor, setPaginaDoVisor] = useState<number | null>(null);
  /** Abre o visor no achado; com `pagina`, nela (o trecho 2 de um achado entre páginas). */
  const verNoMemorial = (chave: string, pagina?: number) => {
    setPaginaDoVisor(pagina ?? null);
    setVisor(chave);
  };
  const [anterior, setAnterior] = useState(vista);
  const [dir, setDir] = useState(1);

  // A direção do deslize segue a ordem das leituras (derivada na renderização).
  if (anterior !== vista) {
    setDir(ORDEM.indexOf(vista) >= ORDEM.indexOf(anterior) ? 1 : -1);
    setAnterior(vista);
  }

  const temArquivo = (a: AchadoDaTela) => resolverFonte({ arquivo: a.estruturado.documento }, catalogo).tipo === "arquivo";
  const [nivelDaFila, setNivelDaFila] = useState<Nivel | null>(null);
  const abrirNaFila = (chave?: string) => {
    if (chave) setAberto(chave);
    setNivelDaFila(null);
    setFilaKey((k) => k + 1);
    onVista("findings");
  };
  /** A fila só com um nível, aberta no primeiro pendente dele (o clique no nível do resumo completo). */
  const abrirNivelNaFila = (nivel: Nivel) => {
    const primeiro = parecer.achados.find((a) => a.confirmado && a.nivel === nivel && !a.desfecho) ?? parecer.achados.find((a) => a.confirmado && a.nivel === nivel);
    if (primeiro) setAberto(primeiro.chave);
    setNivelDaFila(nivel);
    setFilaKey((k) => k + 1);
    onVista("findings");
  };

  // 1 2 3 trocam a leitura; 4 abre No documento — o atalho do trilho do lab.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || visor) return;
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      if (e.key === "1") onVista("summary");
      else if (e.key === "2") onVista("findings");
      else if (e.key === "3") onVista("report");
      else if (e.key === "4" && podeVerNoDocumento) onVista("documento");
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  });

  // O visor mostra os achados do MESMO arquivo do achado pedido.
  const doVisor = parecer.achados.find((a) => a.chave === visor);
  const fonteDoVisor = doVisor ? resolverFonte({ arquivo: doVisor.estruturado.documento }, catalogo) : null;
  const urlDoVisor = fonteDoVisor?.tipo === "arquivo" ? fonteDoVisor.fonte.url : null;
  const achadosDoVisor = urlDoVisor
    ? parecer.achados.filter((a) => {
        const f = resolverFonte({ arquivo: a.estruturado.documento }, catalogo);
        return a.confirmado && f.tipo === "arquivo" && f.fonte.url === urlDoVisor;
      })
    : [];
  // A cobertura do mesmo arquivo: diz onde o texto não está na camada do PDF.
  const nomeDoVisor = fonteDoVisor?.tipo === "arquivo" ? fonteDoVisor.fonte.nome : doVisor?.estruturado.documento;
  const analisados = report.arquivos_analisados ?? [];
  const folhasDoVisor = (analisados.find((a) => a.arquivo === nomeDoVisor) ?? (analisados.length === 1 ? analisados[0] : undefined))?.cobertura ?? null;

  return (
    <div className="re-conteudo rs rd re re--embutido">
      {vista !== "geral" && <FaixaDoVeredito report={report} parecer={parecer} total={total} tratados={tratados} />}
      <AvisoDeAuditoriaIncompleta report={report} className="re-aviso" />
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={vista}
          className="re-leitura"
          custom={dir}
          variants={{
            entra: (d: number) => ({ opacity: 0, x: 28 * d }),
            fica: { opacity: 1, x: 0 },
            sai: (d: number) => ({ opacity: 0, x: -20 * d, transition: { duration: dur("feedback"), ease: ease(CURVA.exit) } }),
          }}
          initial="entra"
          animate="fica"
          exit="sai"
          transition={{ duration: dur("enter"), ease: ease(CURVA.out) }}
        >
          {vista === "geral" && <VisaoGeralDoParecer report={report} parecer={parecer} onAbrir={abrirNaFila} onAbrirNivel={abrirNivelNaFila} />}
          {vista === "summary" && (
            <ResumoDoParecer
              comparado={comparado ?? null}
              onAbrirNivel={abrirNivelNaFila}
              report={report}
              parecer={parecer}
              temArquivo={temArquivo}
              onAbrir={abrirNaFila}
              onVerNoMemorial={verNoMemorial}
              onAbrirDisciplina={(d: FindingDiscipline) => abrirNaFila(parecer.achados.find((a) => a.confirmado && a.discs.includes(d) && !a.desfecho)?.chave)}
              onNoDocumento={podeVerNoDocumento ? () => onVista("documento") : undefined}
            />
          )}
          {vista === "findings" && (
            <FilaDeAchadosA key={filaKey} filtroInicial={filaInicial ?? null} nivelInicial={nivelDaFila} parecer={parecer} auditId={auditId} catalogo={catalogo} inicial={aberto} onVerNoMemorial={verNoMemorial} aoGerarTexto={aoGerarTexto} teclado={!visor} />
          )}
          {vista === "report" && <RelatorioDoParecer report={report} parecer={parecer} />}
          {vista === "documento" && <NoDocumento report={report} parecer={parecer} catalogo={catalogo} onVerNoMemorial={verNoMemorial} onAbrir={(chave) => abrirNaFila(chave)} />}
        </motion.div>
      </AnimatePresence>

      <AvisoDeResponsabilidade className="px-1" />

      <VisorDoMemorial
        key={visor ? `${visor}:${paginaDoVisor ?? ""}` : "fechado"}
        achados={achadosDoVisor}
        url={urlDoVisor}
        arquivo={fonteDoVisor?.tipo === "arquivo" ? fonteDoVisor.fonte.nome : (doVisor?.estruturado.documento ?? "Memorial")}
        inicial={visor}
        paginaInicial={paginaDoVisor}
        chat={chatDoVisor}
        folhas={folhasDoVisor}
        aberto={Boolean(visor)}
        onFechar={() => setVisor(null)}
        onIrParaAchado={(chave) => {
          setVisor(null);
          abrirNaFila(chave);
        }}
      />
    </div>
  );
}
