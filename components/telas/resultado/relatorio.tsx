"use client";

/**
 * O RELATÓRIO (desenho do lab: resultado-e/relatorio.tsx): o parecer em texto
 * corrido — o que se lê na tela e se cola num e-mail —, na ordem de decisão:
 * projeto, veredito, e os achados do que impede emitir ao que é só texto. Só
 * os confirmados (lib/camada-do-achado.ts). O papel continua no Parecer em PDF.
 */
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Botao } from "@/components/ds/basicos";
import { avaliarEmissao, type AuditReport } from "@/lib/audit-report";
import { incompletudeDoParecer, rotuloDaContagem } from "@/lib/auditoria-incompleta";
import { useTempo } from "@/lib/ds/tempo";
import { DISCIPLINAS, NIVEIS } from "@/lib/nivel-do-achado";

import { NOME_DO_DESFECHO } from "./textos";
import type { ParecerVivo } from "./use-parecer-vivo";
import "./relatorio.css";

const VEREDITO: Record<ReturnType<typeof avaliarEmissao>["estado"], string> = {
  incompleto: "Análise parcial: não use para emitir",
  nao_emitir: "Não emitir",
  revisar: "Revisar antes de emitir",
  liberado_com_ressalvas: "Liberado com ressalvas de texto",
  liberado: "Liberado",
};

export function RelatorioDoParecer({ report, parecer }: { report: AuditReport; parecer: ParecerVivo }) {
  const { dur } = useTempo();
  const [copiado, setCopiado] = useState(false);
  const { estado, veredito } = avaliarEmissao(report);
  const incompleta = incompletudeDoParecer(report);
  const achados = parecer.achados.filter((a) => a.confirmado);
  // A numeração corre na ordem das seções (do que impede emitir ao que é só texto).
  const numero = new Map(NIVEIS.flatMap((nivel) => achados.filter((a) => a.nivel === nivel.id)).map((a, i) => [a.chave, i + 1]));

  const copiar = () => {
    const texto = document.querySelector(".rl-texto")?.textContent ?? "";
    navigator.clipboard?.writeText(texto).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };

  const paginas = report.arquivos_analisados.reduce((s, a) => s + (a.paginas ?? 0), 0);

  return (
    <div className="rl">
      <article className="rl-folha">
        <header className="rl-barra" data-tour="relatorio-barra">
          <h2>Relatório da auditoria</h2>
          <Botao variante="quiet" tamanho="sm" onClick={copiar}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={copiado ? "ok" : "copiar"} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: dur("feedback") }} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {copiado ? <Check /> : <Copy />}
                {copiado ? "Copiado" : "Copiar o texto"}
              </motion.span>
            </AnimatePresence>
          </Botao>
        </header>

        <div className="rl-texto">
          <section>
            <h3>Projeto</h3>
            <dl>
              <dt>Arquivo</dt>
              <dd>{report.arquivo ?? report.arquivos_analisados[0]?.arquivo ?? "não informado"}</dd>
              <dt>Obra</dt>
              <dd>{report.obra || "não identificada"}</dd>
              <dt>Projeto</dt>
              <dd>{report.codigo || "não identificado"}</dd>
              <dt>Documento</dt>
              <dd>
                {report.tipo_documento || "não identificado"}
                {report.volume ? `, ${report.volume}` : ""}
              </dd>
              <dt>Data</dt>
              <dd>{report.data_documento || "não identificada"}</dd>
              <dt>Órgão</dt>
              <dd>{report.orgao || "não identificado"}</dd>
            </dl>
          </section>

          <section>
            <h3>Status</h3>
            <p className={`rl-veredito rl-veredito--${estado}`}>{incompleta.incompleta ? incompleta.titulo : VEREDITO[estado]}</p>
            <p>{veredito.detail}</p>
            <p>
              Escopo: {report.arquivos_analisados.length === 1 ? "1 arquivo" : `${report.arquivos_analisados.length} arquivos`}
              {paginas ? `, ${paginas} páginas` : ""}; {rotuloDaContagem(report)}; desenhos não avaliados, por ser análise do texto.
            </p>
          </section>

          {NIVEIS.map((nivel) => {
            const doNivel = achados.filter((a) => a.nivel === nivel.id);
            if (!doNivel.length) return null;
            return (
              <section key={nivel.id} className={`rl-secao rl--${nivel.id}`}>
                <h3>
                  {nivel.nome}
                  <span>{nivel.dica}</span>
                </h3>
                {doNivel.map((a) => {
                  return (
                    <div key={a.chave} className="rl-achado">
                      <p className="rl-achado-titulo">
                        {numero.get(a.chave)}. {a.titulo}
                      </p>
                      <dl>
                        <dt>Página</dt>
                        <dd>{a.pagina || "não identificada"}</dd>
                        <dt>Referência</dt>
                        <dd>{a.id}</dd>
                        {a.bruto.descricao && (
                          <>
                            <dt>O que está errado</dt>
                            <dd>{a.estruturado.descricao}</dd>
                          </>
                        )}
                        {a.bruto.evidencia && (
                          <>
                            <dt>Evidência</dt>
                            <dd className="rl-evidencia">{a.bruto.evidencia}</dd>
                          </>
                        )}
                        {a.estruturado.conflito && (
                          <>
                            <dt>Conflito</dt>
                            <dd className="rl-evidencia">{a.estruturado.conflito}</dd>
                          </>
                        )}
                        <dt>Ação recomendada</dt>
                        <dd>{a.estruturado.acao || "revisar o trecho indicado"}</dd>
                        <dt>Disciplina</dt>
                        <dd>{a.discs.map((id) => DISCIPLINAS.find((d) => d.id === id)?.nome ?? "Geral").join(", ")}</dd>
                        {a.desfecho && (
                          <>
                            <dt>Situação</dt>
                            <dd className="rl-situacao">
                              {NOME_DO_DESFECHO[a.desfecho.tipo]}
                              {a.desfecho.nota ? `. ${a.desfecho.nota}` : ""}
                            </dd>
                          </>
                        )}
                      </dl>
                    </div>
                  );
                })}
              </section>
            );
          })}

          {report.conclusao && (
            <section>
              <h3>Conclusão</h3>
              <p>{report.conclusao}</p>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
