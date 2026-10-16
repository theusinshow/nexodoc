"use client";

/**
 * O RESUMO (desenho do lab: resultado-e/resumo-c.tsx): o resumo É a lista do
 * que falta. O Nexo é aberto para resolver, então a maior área é o trabalho —
 * os pendentes em ordem de impacto, cada um numa linha, com corrigir e ver no
 * memorial ali mesmo. O que explica (disciplinas, onde estão, o que foi lido)
 * fica numa coluna estreita ao lado.
 */
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronDown, FileSearch } from "lucide-react";
import { useState } from "react";

import { Botao } from "@/components/ds/basicos";
import { AvatarDaPessoa } from "@/components/ds/avatar-da-pessoa";
import { MapaDasPaginas } from "@/components/ds/graficos";
import type { AuditReport } from "@/lib/audit-report";
import { rotuloDaContagem } from "@/lib/auditoria-incompleta";
import { CURVA } from "@/lib/ds/movimento";
import { formatarEmBrasilia } from "@/lib/fuso-de-brasilia";
import { useTempo } from "@/lib/ds/tempo";
import { DISCIPLINAS, NIVEIS, type Nivel } from "@/lib/nivel-do-achado";
import type { FindingDiscipline } from "@/lib/audit-report";

import { SelosDasDisciplinas } from "../comum/disciplina";
import { NOME_DO_DESFECHO, conta } from "./textos";
import type { AchadoDaTela, ParecerVivo } from "./use-parecer-vivo";
import "./resultado-c.css";

const ease = (c: readonly number[]) => [...c] as [number, number, number, number];

/**
 * QUANTOS POR NÍVEL o resumo lista. Com 53 achados ele virava a fila inteira,
 * e o panorama (disciplinas, páginas) ia parar 53 linhas abaixo (02/10/2026).
 * O resumo mostra o topo de cada nível; a lista completa é a fila.
 */
const POR_NIVEL = 5;

/**
 * O que mudou desde a auditoria anterior deste memorial (lib/diff-de-pareceres.ts):
 * a do servidor, de qualquer conversa do projeto, ou a desta conversa.
 */
export interface ComparadoComAnterior {
  /** Quando a anterior foi gerada (ISO); nula nos pareceres antigos. */
  desde: string | null;
  corrigidos: number;
  novos: number;
  continuam: number;
  /**
   * Dos novos, quantos estavam num trecho que já existia (a leitura anterior
   * não viu) e quantos num trecho alterado. Ausentes quando o servidor não tinha
   * o texto da versão anterior — aí a tela não divide.
   */
  novosQueJaExistiam?: number;
  novosEmTextoAlterado?: number;
  /**
   * Dos `corrigidos`, os que saíram com o trecho igual no texto — não foram
   * corrigidos, só não reapontados. Ausente sem o texto atual no servidor.
   */
  naoReapontados?: number;
}

const DIA = (ms: number) => formatarEmBrasilia(ms, { day: "2-digit", month: "2-digit", year: "numeric" });

/** "hoje às 21:13", "ontem às 9:02", "18/09 às 14:40". */
function quandoFoi(iso: string) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const agora = Date.now();
  const hora = formatarEmBrasilia(ms, { hour: "2-digit", minute: "2-digit" });
  const dia = DIA(ms) === DIA(agora) ? "hoje" : DIA(ms) === DIA(agora - 86_400_000) ? "ontem" : formatarEmBrasilia(ms, { day: "2-digit", month: "2-digit" });
  return `${dia} às ${hora}`;
}

function duracao(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
const iniciais = (nome: string) =>
  nome
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

export function ResumoDoParecer({
  report,
  parecer,
  temArquivo,
  onAbrir,
  onVerNoMemorial,
  onAbrirDisciplina,
  onNoDocumento,
  comparado,
  onAbrirNivel,
}: {
  /** Abre a fila só com um nível (o "Mais N em …" do fim de cada grupo). */
  onAbrirNivel?: (nivel: Nivel) => void;
  comparado: ComparadoComAnterior | null;
  report: AuditReport;
  parecer: ParecerVivo;
  temArquivo: (a: AchadoDaTela) => boolean;
  onAbrir: (chave?: string) => void;
  onVerNoMemorial: (chave: string) => void;
  onAbrirDisciplina: (d: FindingDiscipline) => void;
  onNoDocumento?: () => void;
}) {
  const { dur, mola } = useTempo();
  const [verTratados, setVerTratados] = useState(false);
  // "Corrigido" é só o que saiu com o trecho mexido; o resto ganha linha própria.
  const corrigidosDeFato = comparado ? comparado.corrigidos - (comparado.naoReapontados ?? 0) : 0;
  const achados = parecer.achados.filter((a) => a.confirmado);
  const pendentes = achados.filter((a) => !a.desfecho);
  const tratados = achados.filter((a) => a.desfecho);
  const porDisciplina = DISCIPLINAS.map((d) => {
    const dela = achados.filter((a) => a.discs.includes(d.id));
    return { ...d, total: dela.length, pendentes: dela.filter((a) => !a.desfecho).length };
  })
    .filter((d) => d.total)
    .sort((a, b) => b.pendentes - a.pendentes || b.total - a.total);

  const quando = report.runtime?.gerado_em ? quandoFoi(report.runtime.gerado_em) : null;
  const meta = [
    quando && `Auditada ${quando}${report.runtime?.auditado_por ? ` por ${report.runtime.auditado_por}` : ""}`,
    report.runtime?.duracao_ms ? `levou ${duracao(report.runtime.duracao_ms)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Onde estão: um ponto por achado em cada página citada.
  const totalDePaginas = Math.max(0, ...report.arquivos_analisados.map((a) => a.paginas ?? 0), ...achados.flatMap((a) => a.paginas));
  const pontos = Array.from({ length: totalDePaginas }, (_, i) => achados.filter((a) => a.paginas.includes(i + 1)).length);
  /*
   * NO MÁXIMO ~6 LINHAS (04/10/2026). Com 9 colunas fixas, num memorial de 120
   * páginas e no palco largo, cada página virava um quadrado de 65px e o mapa
   * descia a tela inteira — a lista dos achados ia para depois da rolagem.
   * Agora as colunas crescem com as páginas e o quadrado encolhe.
   */
  const colunasDoMapa = Math.min(40, Math.max(9, Math.ceil(totalDePaginas / 6)));

  return (
    <div className="rc">
      {/* ================= o trabalho ================= */}
      <section className="rc-trabalho" aria-label="O que falta tratar" data-tour="falta-tratar">
        <header className="rc-trabalho-cabeca">
          <h2>
            {pendentes.length ? (
              <>
                Falta tratar <b className="ds-num">{pendentes.length}</b>
              </>
            ) : achados.length ? (
              "Tudo tratado"
            ) : (
              "Nenhum achado"
            )}
          </h2>
          <span className="rs-nota">{rotuloDaContagem(report)}, na ordem de impacto</span>
          {achados.length > 0 && (
            <Botao variante="quiet" tamanho="sm" data-tour="abrir-a-fila" onClick={() => onAbrir()}>
              Abrir a fila
            </Botao>
          )}
        </header>

        <div className="rc-lista">
          {NIVEIS.map((n) => {
            const doNivel = pendentes.filter((a) => a.nivel === n.id);
            if (!doNivel.length) return null;
            return (
              <div key={n.id} className={`rc-grupo rc--${n.id}`}>
                <h3>
                  <i />
                  {n.nome}
                  <span>{n.dica}</span>
                </h3>
                <AnimatePresence initial={false}>
                  {doNivel.slice(0, POR_NIVEL).map((a) => (
                    <motion.div
                      key={a.chave}
                      layout
                      className="rc-linha"
                      data-tour="linha-do-resumo"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0, transition: { duration: dur("state") } }}
                      transition={mola("smooth")}
                    >
                      <button type="button" className="rc-linha-corpo" onClick={() => onAbrir(a.chave)}>
                        <span className="rc-titulo">{a.titulo}</span>
                        <SelosDasDisciplinas discs={a.discs} maximo={1} />
                        {a.responsavel ? <AvatarDaPessoa email={a.responsavel.email} iniciais={iniciais(a.responsavel.nome)} pequeno /> : <span className="rc-sem">sem responsável</span>}
                      </button>
                      <span className="rc-acoes">
                        <button
                          type="button"
                          className="rc-corrigir"
                          aria-label={`Marcar ${a.id} como corrigido`}
                          title="Marcar corrigido"
                          disabled={parecer.salvando === a.chave}
                          onClick={() => void parecer.encerrar(a, "FIXED_IN_DOC")}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          className="rc-memorial"
                          aria-label={`Ver ${a.id} no memorial${a.paginas[0] ? `, página ${a.paginas[0]}` : ""}`}
                          title="Ver no memorial"
                          disabled={!temArquivo(a)}
                          onClick={() => onVerNoMemorial(a.chave)}
                        >
                          <FileSearch size={14} />
                        </button>
                        <button type="button" className="rc-abrir" aria-label={`Abrir ${a.id}`} onClick={() => onAbrir(a.chave)}>
                          <ArrowRight size={14} />
                        </button>
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {/* O resto do nível mora na fila: o resumo não vira a lista inteira (02/10/2026). */}
                {doNivel.length > POR_NIVEL && (
                  <button type="button" className="rc-mais" onClick={() => (onAbrirNivel ? onAbrirNivel(n.id) : onAbrir())}>
                    Mais {doNivel.length - POR_NIVEL} em {n.nome.toLowerCase()}, na fila <ArrowRight size={13} aria-hidden />
                  </button>
                )}
              </div>
            );
          })}
          {!pendentes.length && (
            <p className="rc-vazio">{achados.length ? "Nada pendente nesta revisão. O próximo passo é auditar a revisão corrigida." : "O escopo analisado não mostrou problema."}</p>
          )}
        </div>

        {tratados.length > 0 && (
          <div className="rc-tratados">
            <button type="button" className="rc-tratados-barra" aria-expanded={verTratados} onClick={() => setVerTratados((v) => !v)}>
              <Check size={14} />
              {conta(tratados.length, "tratado", "tratados")}
              <motion.span animate={{ rotate: verTratados ? 180 : 0 }} transition={{ duration: dur("state") }} style={{ display: "inline-flex", marginLeft: "auto" }}>
                <ChevronDown size={14} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {verTratados && (
                <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: dur("layout"), ease: ease(CURVA.out) }}>
                  {tratados.map((a) => (
                    <li key={a.chave}>
                      <span className="rc-id">{a.id}</span>
                      <span className="rc-titulo">{a.titulo}</span>
                      <span className="rc-desfecho">
                        {NOME_DO_DESFECHO[a.desfecho!.tipo]}, {a.desfecho!.por ?? "você"}
                      </span>
                      <button type="button" className="rs-link" onClick={() => void parecer.reabrir(a)}>
                        Reabrir
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ================= como os achados se distribuem, e o que foi lido ================= */}
      <aside className="rc-lado">
        {/* Quando, por quem e quanto levou (o cabeçalho do lab, que no palco da conversa fica escondido). */}
        {meta && <p className="rc-meta">{meta}</p>}
        {comparado && (
          <section className="rc-cartao rc-comparado" data-diff-do-parecer title="Comparado com a auditoria anterior deste memorial">
            <h3>{comparado.desde ? `Desde ${formatarEmBrasilia(comparado.desde, { day: "2-digit", month: "2-digit" })}` : "Desde a auditoria anterior"}</h3>
            <p>
              <b className="rs-delta--ok">{corrigidosDeFato}</b> {corrigidosDeFato === 1 ? "corrigido" : "corrigidos"},{" "}
              <b className="rs-delta--novo">{comparado.novos}</b> {comparado.novos === 1 ? "novo" : "novos"}, <b>{comparado.continuam}</b>{" "}
              {comparado.continuam === 1 ? "continua" : "continuam"}
            </p>
            {/*
             * O QUE SAIU SEM SER CORRIGIDO. Na volta 5 do laço do 040_26, 6 dos 8
             * que "saíram" seguiam com o trecho igual no texto: a leitura só não
             * os apontou de novo. Contá-los como corrigidos é dizer a quem revisa
             * que o trabalho está feito quando não está.
             */}
            {(comparado.naoReapontados ?? 0) > 0 && (
              <p className="rc-comparado-origem" data-nao-reapontados>
                {comparado.naoReapontados} {comparado.naoReapontados === 1 ? "não foi apontado" : "não foram apontados"} de novo, mas o
                trecho continua igual
              </p>
            )}
            {/*
             * DE ONDE VEIO O NOVO. Quem corrigiu tudo e viu o número não cair
             * precisa saber se a correção gerou o achado ou se ele já estava lá —
             * no laço do 040_26 (16/10/2026), 10 dos 13 novos já estavam.
             */}
            {comparado.novos > 0 && comparado.novosQueJaExistiam !== undefined && (
              <p className="rc-comparado-origem" data-origem-dos-novos>
                {comparado.novosQueJaExistiam > 0 && (
                  <>
                    {comparado.novosQueJaExistiam} {comparado.novosQueJaExistiam === 1 ? "já estava" : "já estavam"} no texto e não{" "}
                    {comparado.novosQueJaExistiam === 1 ? "tinha sido apontado" : "tinham sido apontados"}
                  </>
                )}
                {comparado.novosQueJaExistiam > 0 && (comparado.novosEmTextoAlterado ?? 0) > 0 && " · "}
                {(comparado.novosEmTextoAlterado ?? 0) > 0 && (
                  <>
                    {comparado.novosEmTextoAlterado} em {comparado.novosEmTextoAlterado === 1 ? "trecho alterado" : "trechos alterados"}
                  </>
                )}
              </p>
            )}
          </section>
        )}
        <div className="re-distribuicao">
          {porDisciplina.length > 0 && (
            <section className="rc-cartao rc-disc" data-tour="por-disciplina">
              <h3>Por disciplina</h3>
              <div className="rc-disc-faixa" aria-hidden>
                {porDisciplina.map((d) => (
                  <motion.i key={d.id} className={`dc--${d.id}`} style={{ flexGrow: d.total }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: dur("layout") * 1.4, ease: ease(CURVA.out) }} />
                ))}
              </div>
              <ul>
                {porDisciplina.map((d) => (
                  <li key={d.id}>
                    <button type="button" className={`dc--${d.id}`} onClick={() => onAbrirDisciplina(d.id)}>
                      <i className="dc-ponto" />
                      <span className="rc-disc-nome" title={d.nome}>
                        {d.nome}
                      </span>
                      <span className="rc-disc-conta ds-num">
                        {d.pendentes ? (
                          <>
                            <b>{d.pendentes}</b> de {d.total}
                            <span className="rc-disc-palavra"> {d.pendentes === 1 ? "pendente" : "pendentes"}</span>
                          </>
                        ) : (
                          <span className="rc-disc-ok">{d.total === 1 ? "1 tratado" : `${d.total} tratados`}</span>
                        )}
                      </span>
                      <ArrowRight size={13} className="rc-disc-seta" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {totalDePaginas > 0 && (
            <section className="rc-cartao rc-onde" data-tour="onde-estao">
              <h3>
                Onde estão
                {onNoDocumento && (
                  <button type="button" className="rs-link" onClick={onNoDocumento}>
                    <FileSearch size={13} /> No documento
                  </button>
                )}
              </h3>
              <MapaDasPaginas colunas={colunasDoMapa} paginas={pontos} lidas={totalDePaginas} atuais={[]} />
            </section>
          )}
          <section className="rc-cartao rc-leitura" data-tour="o-que-foi-lido">
            <h3>O que foi lido</h3>
            <ul>
              {report.arquivos_analisados.map((arq) => (
                <li key={arq.arquivo}>
                  <b>{arq.arquivo}</b>
                  <span className="ds-num">
                    {arq.paginas ? `${arq.paginas} páginas` : ""}
                    {arq.caracteres_extraidos ? `${arq.paginas ? ", " : ""}${arq.caracteres_extraidos.toLocaleString("pt-BR")} caracteres` : ""}
                  </span>
                  {arq.resumo && <p title={arq.resumo}>{arq.resumo}</p>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
