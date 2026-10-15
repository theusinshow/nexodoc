"use client";

/**
 * O PARECER VIVO: os achados do parecer gravado mais o que o escritório já fez
 * com cada um — desfecho, com quem está, conversa, validade —, e as ações que
 * gravam isso. É a camada de dados do Resultado no desenho do lab (02/10/2026),
 * separada da tela antiga (`components/audit-result.tsx`), que guardava tudo
 * dentro de um componente de seis mil linhas.
 *
 * Fonte de verdade: a rota de feedback da auditoria (`/api/audits/<id>/feedback`),
 * a mesma linha do banco para veredito, desfecho e atribuição. As ações atualizam
 * a tela na hora e relêem o servidor para confirmar.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getFeedbackEndpoint,
  reportFindingToStructured,
  type FeedbackVerdict,
  type SavedFeedback,
  type StructuredFinding,
} from "@/components/audit-result";
import { classifyFindingTier, type AuditFinding, type AuditReport, type FindingDiscipline } from "@/lib/audit-report";
import type { Desfecho } from "@/lib/desfecho-do-achado";
import { disciplinasDoAchado, nivelDoAchado, type Nivel } from "@/lib/nivel-do-achado";
import { paginasDoAchado } from "@/lib/paginas-do-achado";
import { rotuloDoAchado } from "@/lib/rotulo-do-achado";

export type Membro = { email: string; name?: string | null; status?: string };

export interface DesfechoDaTela {
  tipo: Desfecho;
  /** Quem encerrou; nulo = você, na sessão (o servidor ainda não respondeu). */
  por: string | null;
  quando: string | null;
  nota: string | null;
}

export interface AchadoDaTela {
  /** O id GRAVADO (INC-014): chave de feedback, link e fila. */
  chave: string;
  /** O que se lê (ACH-014) — ver lib/rotulo-do-achado.ts. */
  id: string;
  titulo: string;
  nivel: Nivel;
  /** A principal — onde o achado é agrupado. */
  disc: FindingDiscipline;
  /**
   * Todas, a principal primeiro: um conflito entre arquitetura e
   * hidrossanitário aparece no filtro das duas.
   */
  discs: FindingDiscipline[];
  paginas: number[];
  /** O campo de página como veio ("8, 60"). */
  pagina: string | null;
  origem: AuditFinding["origem"];
  /** Confirmado ou sugestão da IA (lib/camada-do-achado.ts). */
  confirmado: boolean;
  bruto: AuditFinding;
  estruturado: StructuredFinding;
  responsavel: { email: string; nome: string; souEu: boolean } | null;
  /**
   * O achado é MEU mesmo depois de encerrado: estava comigo, ou fui eu que
   * encerrei. `responsavel` some quando o achado fecha (a tarja "com X" deixa
   * de valer); este não, e é o que mantém o corrigido no "Meus" (05/10/2026).
   */
  meu: boolean;
  desfecho: DesfechoDaTela | null;
  validade: FeedbackVerdict | null;
  /** Com "gravidade errada": "MAIS_GRAVE" ou "MENOS_GRAVE" (05/10/2026). */
  severidade: "MAIS_GRAVE" | "MENOS_GRAVE" | null;
  comentarios: number;
  linha: SavedFeedback | null;
}

export type AvisoDoParecer = { tom: "ok" | "falha"; texto: string } | null;

/** Quem recebeu achado nesta auditoria e ainda não foi avisado por e-mail (GET /avisar). */
export type PessoaAAvisar = { email: string; nome: string; quantidade: number; convidado: boolean };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Quem falhou e por quê, agrupado por motivo — o mesmo texto da tela antiga. */
function porQue(falharam: readonly { email: string; erro?: string }[]) {
  const porMotivo = new Map<string, string[]>();
  for (const f of falharam) {
    const motivo = f.erro?.trim() || "motivo não informado";
    porMotivo.set(motivo, [...(porMotivo.get(motivo) ?? []), f.email]);
  }
  return [...porMotivo.entries()].map(([motivo, emails]) => `${emails.join(", ")} (${motivo})`).join("; ");
}

function montarAchado(f: AuditFinding, linha: SavedFeedback | undefined, euSou: string): AchadoDaTela {
  const resolvido = Boolean(linha?.resolvedAt);
  const discs = disciplinasDoAchado(f);
  return {
    chave: f.id,
    id: rotuloDoAchado(f.id),
    titulo: reportFindingToStructured(f).title,
    nivel: nivelDoAchado(f),
    disc: discs[0],
    discs,
    // A prosa também: a IA escreve "(pág. 10) × (pág. 22)" no conflito e grava só "10" em `pagina`.
    paginas: paginasDoAchado({ pagina: f.pagina, referencia: f.referencia_comparada, textos: [f.conflito, f.descricao, f.evidencia] }),
    pagina: f.pagina || null,
    origem: f.origem,
    confirmado: classifyFindingTier(f) === "principal",
    bruto: f,
    estruturado: reportFindingToStructured(f),
    responsavel:
      linha?.assigneeEmail && !resolvido
        ? { email: linha.assigneeEmail, nome: linha.assigneeName ?? linha.assigneeEmail, souEu: Boolean(euSou) && linha.assigneeEmail.toLowerCase() === euSou }
        : null,
    meu:
      Boolean(euSou) &&
      (linha?.assigneeEmail?.toLowerCase() === euSou || (resolvido && linha?.resolvedByEmail?.toLowerCase() === euSou)),
    // Reaberto = resolvedAt nulo, mesmo com o tipo gravado: o desfecho só vale encerrado.
    desfecho: resolvido
      ? { tipo: (linha!.resolutionKind ?? "FIXED_IN_DOC") as Desfecho, por: linha!.resolvedByName, quando: linha!.resolvedAt, nota: linha!.note || null }
      : null,
    validade: linha?.verdict ?? null,
    severidade: linha?.severidadeSugerida ?? null,
    comentarios: linha?.comentarios ?? 0,
    linha: linha ?? null,
  };
}

export function useParecerVivo({
  auditId,
  report,
  aoMudarResolvido,
}: {
  auditId?: string | null;
  report: AuditReport | null;
  /** Avisa a conversa (anel do trilho, cartão do chat) quando um achado fecha ou reabre. */
  aoMudarResolvido?: (chave: string, resolvido: boolean) => void;
}) {
  const [linhas, setLinhas] = useState<SavedFeedback[]>([]);
  const [euSou, setEuSou] = useState("");
  const [membros, setMembros] = useState<Membro[]>([]);
  const [releituras, setReleituras] = useState(0);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoDoParecer>(null);
  const [aAvisar, setAAvisar] = useState<PessoaAAvisar[]>([]);
  const [avisando, setAvisando] = useState(false);

  useEffect(() => {
    if (!auditId) return;
    let vivo = true;
    fetch(getFeedbackEndpoint(auditId), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { feedback?: SavedFeedback[]; euSou?: string } | null) => {
        if (!vivo || !p) return;
        setLinhas((p.feedback ?? []).filter((x) => x.findingId));
        if (p.euSou) setEuSou(p.euSou.toLowerCase());
      })
      .catch(() => {
        /* o parecer continua legível sem o que o escritório fez com ele */
      });
    return () => {
      vivo = false;
    };
  }, [auditId, releituras]);

  /*
   * QUEM ESPERA AVISO POR E-MAIL. Consulta própria (ela depende do status do
   * membro, que a rota de feedback não devolve), relida junto com o feedback:
   * atribuir acabou de criar pendência, e o botão tem de aparecer sem recarregar.
   * A fila nova (02/10) nasceu SEM este botão — ele só existia na tela antiga, e
   * ninguém achava como mandar o achado por e-mail (05/10/2026).
   */
  useEffect(() => {
    if (!auditId) return;
    let vivo = true;
    fetch(`/api/audits/${encodeURIComponent(auditId)}/avisar`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { pendentes?: PessoaAAvisar[] } | null) => {
        if (vivo && p) setAAvisar(p.pendentes ?? []);
      })
      .catch(() => {
        /* sem a lista o botão não aparece; o parecer segue utilizável */
      });
    return () => {
      vivo = false;
    };
  }, [auditId, releituras]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/organizacao/membros")
      .then((r) => (r.ok ? r.json() : { membros: [] }))
      .then((d: { membros?: Membro[] }) => {
        // Quem foi desligado não recebe trabalho (o servidor também recusa).
        if (vivo) setMembros((d.membros ?? []).filter((m) => m.status !== "DISABLED"));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const porChave = useMemo(() => new Map(linhas.map((l) => [l.findingId as string, l])), [linhas]);
  const achados = useMemo(
    () => (report?.incongruencias ?? []).map((f) => montarAchado(f, porChave.get(f.id), euSou)),
    [report, porChave, euSou],
  );

  const reler = useCallback(() => setReleituras((n) => n + 1), []);

  /** A linha local, mexida antes da resposta: a tela não espera a rede para mudar. */
  const mexerNaLinha = useCallback((chave: string, patch: Partial<SavedFeedback>) => {
    setLinhas((atuais) => {
      const i = atuais.findIndex((l) => l.findingId === chave);
      if (i < 0)
        return [
          ...atuais,
          { id: `local-${chave}`, findingId: chave, verdict: null, resolvedAt: null, note: "", assigneeEmail: null, assigneeName: null, resolutionKind: null, resolvedByName: null, ...patch },
        ];
      return atuais.map((l, j) => (j === i ? { ...l, ...patch } : l));
    });
  }, []);

  const postar = useCallback(
    async (corpo: Record<string, unknown>, falha: string) => {
      if (!auditId) throw new Error("Este parecer não está gravado no servidor.");
      const r = await fetch(getFeedbackEndpoint(auditId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? falha);
      }
    },
    [auditId],
  );

  const encerrar = useCallback(
    async (a: AchadoDaTela, tipo: Desfecho, nota?: string) => {
      setSalvando(a.chave);
      setAviso(null);
      const antes = a.linha;
      mexerNaLinha(a.chave, { resolvedAt: new Date().toISOString(), resolutionKind: tipo, resolvedByName: null, note: nota ?? antes?.note ?? "", ...(tipo === "FALSE_POSITIVE" ? { verdict: "FALSE_POSITIVE" as FeedbackVerdict } : {}) });
      try {
        await postar({ findingId: a.chave, findingLabel: a.titulo, page: a.pagina ?? undefined, resolutionKind: tipo, note: nota }, "Não foi possível registrar o desfecho.");
        aoMudarResolvido?.(a.chave, true);
        reler();
        return true;
      } catch (e) {
        if (antes) mexerNaLinha(a.chave, antes);
        else setLinhas((atuais) => atuais.filter((l) => l.findingId !== a.chave));
        setAviso({ tom: "falha", texto: e instanceof Error ? e.message : "Não foi possível registrar o desfecho." });
        return false;
      } finally {
        setSalvando(null);
      }
    },
    [mexerNaLinha, postar, reler, aoMudarResolvido],
  );

  const reabrir = useCallback(
    async (a: AchadoDaTela) => {
      setSalvando(a.chave);
      setAviso(null);
      const antes = a.linha;
      mexerNaLinha(a.chave, { resolvedAt: null });
      try {
        await postar({ findingId: a.chave, findingLabel: a.titulo, page: a.pagina ?? undefined, resolved: false }, "Não foi possível reabrir o achado.");
        aoMudarResolvido?.(a.chave, false);
        reler();
      } catch (e) {
        if (antes) mexerNaLinha(a.chave, antes);
        setAviso({ tom: "falha", texto: e instanceof Error ? e.message : "Não foi possível reabrir o achado." });
      } finally {
        setSalvando(null);
      }
    },
    [mexerNaLinha, postar, reler, aoMudarResolvido],
  );

  /** Validade para o benchmark (procede, gravidade errada) — não encerra o achado. */
  /*
   * O VOTO NA IA. `null` desfaz; com "gravidade errada", `severidade` diz para
   * onde ela devia ir — é o que ensina o motor a calibrar, e não só que errou.
   */
  const julgar = useCallback(
    async (a: AchadoDaTela, validade: FeedbackVerdict | null, severidade: "MAIS_GRAVE" | "MENOS_GRAVE" | null = null) => {
      setSalvando(a.chave);
      setAviso(null);
      try {
        await postar(
          { findingId: a.chave, findingLabel: a.titulo, page: a.pagina ?? undefined, verdict: validade, ...(validade === "WRONG_SEVERITY" ? { severidadeSugerida: severidade } : {}) },
          "Não foi possível salvar a avaliação.",
        );
        mexerNaLinha(a.chave, { verdict: validade, severidadeSugerida: validade === "WRONG_SEVERITY" ? severidade : null });
        setAviso({
          tom: "ok",
          texto:
            validade === null
              ? "Voto desfeito."
              : validade === "WRONG_SEVERITY"
                ? severidade === "MAIS_GRAVE"
                  ? "Avisei o motor: o achado é mais grave do que ele disse."
                  : severidade === "MENOS_GRAVE"
                    ? "Avisei o motor: o achado é menos grave do que ele disse."
                    : "Avisei o motor: a gravidade está errada."
                : "Anotado: o achado procede.",
        });
      } catch (e) {
        setAviso({ tom: "falha", texto: e instanceof Error ? e.message : "Não foi possível salvar a avaliação." });
      } finally {
        setSalvando(null);
      }
    },
    [mexerNaLinha, postar],
  );

  const atribuir = useCallback(
    async (chaves: string[], email: string, recado = "") => {
      if (!auditId || chaves.length === 0) return false;
      const nome = membros.find((m) => m.email === email)?.name ?? "";
      setAviso(null);
      for (const c of chaves) mexerNaLinha(c, { assigneeEmail: email, assigneeName: nome || email });
      try {
        const r = await fetch(`/api/audits/${encodeURIComponent(auditId)}/atribuir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ findingIds: chaves, assigneeEmail: email, assigneeNome: nome, recado }),
        });
        const p = (await r.json().catch(() => null)) as { error?: string } | null;
        if (!r.ok) throw new Error(p?.error ?? "Não foi possível atribuir.");
        setAviso({ tom: "ok", texto: `${chaves.length === 1 ? "Achado" : `${chaves.length} achados`} com ${nome || email}. Quando terminar de distribuir, use "Notificar por e-mail" no topo da lista.` });
        return true;
      } catch (e) {
        setAviso({ tom: "falha", texto: e instanceof Error ? e.message : "Não foi possível atribuir." });
        return false;
      } finally {
        reler();
      }
    },
    [auditId, membros, mexerNaLinha, reler],
  );

  /** O que a auditoria NÃO apontou e devia — vai para o benchmark. */
  const faltou = useCallback(
    async (nota: string) => {
      try {
        await postar({ verdict: "MISSING_FINDING", note: nota }, "Não foi possível registrar.");
        setAviso({ tom: "ok", texto: "Anotado: o motor vai aprender com o que faltou." });
        return true;
      } catch (e) {
        setAviso({ tom: "falha", texto: e instanceof Error ? e.message : "Não foi possível registrar." });
        return false;
      }
    },
    [postar],
  );

  /**
   * AVISAR POR E-MAIL — manda para pessoa de verdade e não tem desfazer: a tela
   * só chama isto depois da confirmação que lista quem vai receber. Cada estado
   * do servidor tem a frase dele (ver a rota `/avisar`), e nenhuma é "pronto!".
   */
  const avisarPorEmail = useCallback(async () => {
    if (!auditId || aAvisar.length === 0) return false;
    setAvisando(true);
    setAviso(null);
    try {
      const r = await fetch(`/api/audits/${encodeURIComponent(auditId)}/avisar`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const p = (await r.json().catch(() => null)) as { estado?: string; avisados?: PessoaAAvisar[]; falharam?: { email: string; erro: string }[]; error?: string } | null;
      if (!r.ok) throw new Error(p?.error ?? "Não foi possível avisar.");
      const avisados = p?.avisados ?? [];
      const falharam = p?.falharam ?? [];
      if (p?.estado === "nada-a-avisar") setAviso({ tom: "ok", texto: "Todo mundo já foi avisado." });
      else if (p?.estado === "nao-configurado") setAviso({ tom: "falha", texto: "O envio de e-mail não está configurado neste ambiente. Ninguém foi avisado." });
      else if (p?.estado === "gravado") setAviso({ tom: "ok", texto: `Modo de desenvolvimento: ${plural(avisados.length, "aviso gravado", "avisos gravados")} em scratchpad/qa/correio.jsonl. Nenhum e-mail saiu.` });
      else if (avisados.length === 0) setAviso({ tom: "falha", texto: `Não foi possível avisar ninguém. ${porQue(falharam)}` });
      else {
        const base = `${plural(avisados.length, "pessoa avisada", "pessoas avisadas")} por e-mail.`;
        setAviso(falharam.length ? { tom: "falha", texto: `${base} ${plural(falharam.length, "não chegou", "não chegaram")}: ${porQue(falharam)}.` } : { tom: "ok", texto: base });
      }
      return true;
    } catch (e) {
      setAviso({ tom: "falha", texto: e instanceof Error ? e.message : "Não foi possível avisar." });
      return false;
    } finally {
      setAvisando(false);
      reler();
    }
  }, [auditId, aAvisar.length, reler]);

  return { achados, membros, euSou, salvando, aviso, setAviso, encerrar, reabrir, julgar, atribuir, faltou, reler, aAvisar, avisando, avisarPorEmail };
}

export type ParecerVivo = ReturnType<typeof useParecerVivo>;
