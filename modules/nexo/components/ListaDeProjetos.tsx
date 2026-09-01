"use client";

/**
 * A LISTA DE PROJETOS da barra lateral — o miolo do desenho aprovado.
 *
 * Substitui as três abas (Tudo / Volumes / Auditorias) e a lista de conversas.
 * As abas saíram porque a terceira não cabia em 300px (aparecia cortada como
 * "\UDITORIAS 17") e porque filtrar por TIPO responde uma pergunta que ninguém
 * faz: quem procura, procura a obra. A lista de conversas saiu porque quatro
 * linhas "MET" na mesma pasta não distinguiam nada.
 *
 * O ESTADO DO CARTÃO É DO PROJETO, NÃO DA SESSÃO: abre o do projeto em que se
 * está, e abrir outro fecha esse. Voltar para a conversa reabre o cartão dela.
 *
 * O RESUMO É BEST-EFFORT. Enquanto ele não chega — ou se a rota falhar — a
 * lista se desenha com o que as sete colunas já têm: os cartões existem, sem as
 * etiquetas e sem a contagem de folhas. Uma barra que só aparece depois de uma
 * segunda chamada seria pior que uma barra incompleta.
 */

import { useEffect, useMemo, useState } from "react";
import { CopyPlus, Eraser, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  cartoesDeProjeto,
  type CartaoDeProjeto as Cartao,
  type ConversaResumida,
} from "../lib/cartoes-de-projeto";
import type { ConversationSummary } from "../lib/nexo-db";
import { CartaoDeProjeto } from "./CartaoDeProjeto";
import { LimpezaDaPasta } from "./LimpezaDaPasta";

/** Sem acento e em minúsculas — a busca não pode exigir o "ú" de CRICIÚMA. */
function chave(v: string): string {
  return v
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function ListaDeProjetos({
  conversations,
  query,
  activeId,
  onSelect,
  onDeleteFolder,
  onDuplicate,
}: {
  conversations: readonly ConversationSummary[];
  query: string;
  activeId?: string;
  onSelect?: (id: string) => void;
  onDeleteFolder?: (ids: string[]) => void;
  onDuplicate?: (id: string) => void;
}) {
  const [resumo, setResumo] = useState<ConversaResumida[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [limpando, setLimpando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/nexo/conversas/resumo")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((p: { conversas?: ConversaResumida[] }) => {
        if (vivo) setResumo(p.conversas ?? []);
      })
      .catch(() => {
        // Best-effort: a lista continua com o que as sete colunas dão.
        if (vivo) setResumo([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  /*
   * O RESUMO É ENXERTADO NA LISTA, e a lista é que manda em quais conversas
   * existem. Ela vem do store (disco + servidor fundidos) e reflete o que foi
   * apagado agora; o resumo é uma foto do servidor de segundos atrás. Deixar o
   * resumo mandar faria uma conversa apagada reaparecer até o próximo F5.
   */
  const cartoes = useMemo(() => {
    const porId = new Map((resumo ?? []).map((r) => [r.id, r]));
    const cruas: ConversaResumida[] = conversations.map((c) => {
      const r = porId.get(c.id);
      return {
        id: c.id,
        title: c.title,
        folderKey: c.folderKey ?? null,
        /*
         * O VÍNCULO vem da lista local primeiro: ela reflete o que acabou de ser
         * endereçado nesta máquina, e o resumo é uma foto do servidor de
         * segundos atrás. O código e o cliente só o resumo tem — são do
         * `Project`, e a lista local nunca os viu.
         */
        projectId: c.projectId ?? r?.projectId ?? null,
        projectCode: r?.projectCode ?? "",
        projectClient: r?.projectClient ?? "",
        tipo: c.tipo ?? null,
        updatedAt: c.updatedAt,
        auditoriaPendente: c.temAuditoriaPendente,
        folhas: r?.folhas ?? 0,
        kinds: r?.kinds ?? [],
      };
    });
    return cartoesDeProjeto(cruas);
  }, [conversations, resumo]);

  const filtrados = useMemo(() => {
    const q = chave(query.trim());
    if (!q) return cartoes;
    return cartoes
      .map((c) => {
        const noNome = chave(`${c.chave} ${c.codigo} ${c.cliente}`).includes(q);
        if (noNome) return c;
        // Busca também DENTRO do projeto: quem digita "memorial" quer a conversa.
        const dentro = c.conversas.filter((x) => chave(x.titulo).includes(q));
        return dentro.length > 0 ? { ...c, conversas: dentro } : null;
      })
      .filter((c): c is Cartao => c !== null);
  }, [cartoes, query]);

  /*
   * O CARTÃO DA CONVERSA ABERTA nasce aberto. É a regra "fechar não perde o
   * lugar": voltar para o trabalho reabre o projeto dele, sem clique.
   */
  const doAtivo = useMemo(
    () => cartoes.find((c) => c.conversas.some((x) => x.id === activeId))?.chave ?? null,
    [cartoes, activeId],
  );

  /*
   * SEM CONVERSA ATIVA, ABRE O CARTÃO DO TRABALHO MAIS RECENTE — e isto conserta
   * uma regressão que este arquivo criou.
   *
   * A auditoria de um memorial cuja prefeitura não foi lida fica SEM PASTA
   * (`pastaDoProjeto` exige código E prefeitura). Na lista de projetos ela cai
   * no cartão "SEM CÓDIGO NO CARIMBO" — fechado, no fim da lista. Depois de um
   * F5, quem tinha acabado de auditar não achava o parecer e refazia a
   * auditoria inteira, pagando de novo pelo trabalho que estava gravado.
   *
   * A regra "o cartão do projeto em que se está nasce aberto" já cobria o caso
   * COM conversa ativa. Este degrau cobre o sem: o mais recente é o que se
   * estava fazendo, com pasta ou sem.
   */
  const doMaisRecente = useMemo(() => {
    let melhor: { chave: string; quando: number } | null = null;
    for (const c of cartoes) {
      const topo = c.conversas[0]?.updatedAt ?? 0;
      if (!melhor || topo > melhor.quando) melhor = { chave: c.chave, quando: topo };
    }
    return melhor?.chave ?? null;
  }, [cartoes]);

  const abertoAgora = aberto ?? doAtivo ?? doMaisRecente;

  if (filtrados.length === 0) {
    return (
      <p className="px-1 py-6 text-[11.5px] leading-5 text-muted-foreground">
        {query.trim()
          ? `Nenhum projeto com “${query.trim()}”.`
          : "Nenhum projeto ainda. Solte as pranchas na conversa e o projeto nasce do carimbo."}
      </p>
    );
  }

  // "TRABALHANDO NO" só quando há conversa ATIVA de verdade: dizer isso do
  // cartão que abriu por ser o mais recente afirmaria uma coisa que não
  // aconteceu — ninguém abriu nada ainda.
  const trabalhandoEm = cartoes.find((c) => c.chave === doAtivo);

  return (
    <>
      {/*
        EM QUE PROJETO SE ESTÁ, dito antes da lista.

        Sem isto a barra mostra dez cartões iguais e nenhum deles diz "é aqui".
        O cartão aberto responde por posição; esta linha responde por nome, que
        é o que sobrevive a rolar a lista.
      */}
      {trabalhandoEm && trabalhandoEm.chave !== "" && !query.trim() ? (
        <p className="m-0 px-1 pb-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          Trabalhando no{" "}
          <span className="text-[var(--primary)]">
            {trabalhandoEm.codigo || trabalhandoEm.chave}
          </span>
        </p>
      ) : null}

      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {filtrados.map((c) => {
        const ids = c.conversas.map((x) => x.id);
        return (
          <div key={c.chave || "sem-codigo"} className="group/p relative">
            <CartaoDeProjeto
              cartao={c}
              aberto={abertoAgora === c.chave}
              {...(activeId ? { conversaAtiva: activeId } : {})}
              onAlternar={() => {
                setAberto((atual) => (atual === c.chave ? "" : c.chave));
                setLimpando(null);
                setConfirmando(null);
              }}
              onAbrirConversa={(id) => onSelect?.(id)}
            />

            {/*
              AS AÇÕES DA PASTA, no hover do cabeçalho. A contagem some enquanto
              elas entram — não há largura para as duas coisas em 300px, e
              reservar espaço fixo para o que quase nunca aparece encolheria o
              nome da obra o tempo todo.
            */}
            {(onDuplicate || onDeleteFolder) && c.chave !== "" ? (
              <span className="absolute right-2 top-1.5 flex items-center gap-0.5 opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover/p:opacity-100 group-focus-within/p:opacity-100">
                {onDuplicate ? (
                  <button
                    type="button"
                    onClick={() => onDuplicate(c.conversas[0].id)}
                    aria-label={`Nova conversa a partir da mais recente de ${c.codigo || c.chave}`}
                    className="nx-edge-4 bg-[var(--card)] p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:var(--card)]"
                  >
                    <CopyPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                ) : null}
                {onDeleteFolder ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setLimpando((a) => (a === c.chave ? null : c.chave));
                        setConfirmando(null);
                      }}
                      aria-label={`Procurar o que dá para apagar em ${c.codigo || c.chave}`}
                      title="Limpar o projeto"
                      className="nx-edge-4 bg-[var(--card)] p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:var(--card)]"
                    >
                      <Eraser className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmando((a) => (a === c.chave ? null : c.chave));
                        setLimpando(null);
                      }}
                      aria-label={`Apagar o projeto ${c.codigo || c.chave} inteiro`}
                      className="nx-edge-4 bg-[var(--card)] p-1 text-muted-foreground transition-colors hover:text-[var(--status-critical)] focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:var(--card)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </>
                ) : null}
              </span>
            ) : null}

            {confirmando === c.chave && onDeleteFolder ? (
              <div className="nx-cut-6 mt-1 bg-[var(--status-critical-tint)] px-2.5 py-2">
                <p className="m-0 text-[11.5px] leading-5 text-foreground">
                  Apagar {c.conversas.length + c.restantes} conversa
                  {c.conversas.length + c.restantes === 1 ? "" : "s"} de{" "}
                  {c.codigo || "sem código"}? Não há desfazer.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteFolder(ids);
                      setConfirmando(null);
                    }}
                    className={cn(
                      "nx-edge-5 border-0 px-2 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em]",
                      "text-[var(--status-critical)] [--nx-edge:var(--status-critical)]",
                      "[--nx-fill:color-mix(in_oklab,var(--status-critical)_16%,var(--card))]",
                    )}
                  >
                    Apagar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(null)}
                    className="nx-edge-5 px-1.5 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground [--nx-edge:transparent] [--nx-fill:transparent]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            {limpando === c.chave && onDeleteFolder ? (
              <LimpezaDaPasta
                key={c.chave}
                pasta={c.chave || null}
                {...(activeId ? { idAberta: activeId } : {})}
                onFechar={() => setLimpando(null)}
                onApagar={(apagar) => {
                  onDeleteFolder(apagar);
                  setLimpando(null);
                }}
              />
            ) : null}
          </div>
        );
        })}
      </ul>
    </>
  );
}
