"use client";

/**
 * O CÉREBRO DA FILA, sem a pele — para os modelos de layout do laboratório.
 *
 * É a mesma lógica de `components/telas/resultado/fila.tsx` (filtros, ordem,
 * agrupamento, seleção, encerrar/desfazer, atalhos), separada da tela para que
 * cada modelo só ARRANJE as peças de outro jeito. Se um modelo for aprovado, a
 * fila de produção passa a usar este hook e o modelo escolhido.
 */
import { useEffect, useMemo, useState } from "react";

import { getErrorTypeLabel, type FindingDiscipline, type FindingErrorType } from "@/lib/audit-report";
import type { Desfecho } from "@/lib/desfecho-do-achado";
import { resolverFonte, type FonteDoCatalogo } from "@/lib/fonte-da-evidencia";
import { formatarEmBrasilia } from "@/lib/fuso-de-brasilia";
import { linkDoAchado } from "@/lib/link-do-achado";
import { marcarDica } from "@/modules/nexo/lib/dicas-da-auditoria";
import { DISCIPLINAS, NIVEIS, type Nivel } from "@/lib/nivel-do-achado";

import type { AchadoDaTela, ParecerVivo } from "@/components/telas/resultado/use-parecer-vivo";
import type { TextoCorrigido } from "@/lib/texto-corrigido";

export type Filtro = "todos" | "meus" | "sem" | "pendentes" | "corrigidos" | "encerrados";
export type Ordem = "impacto" | "pagina" | "disciplina" | "referencia";
export type Agrupar = "impacto" | "disciplina";
export type Aba = "evidencia" | "conversa" | "historico";

export const NOMES_DO_FILTRO: Record<Filtro, string> = {
  todos: "Todos",
  meus: "Meus",
  sem: "Sem dono",
  pendentes: "Pendentes",
  corrigidos: "Corrigidos",
  encerrados: "Encerrados",
};

export const iniciais = (nome: string) =>
  nome
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

export const quando = (iso?: string | null) => (iso ? formatarEmBrasilia(iso, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

export function useFila({
  parecer,
  auditId,
  catalogo,
  onVerNoMemorial,
  teclado = true,
  inicial = null,
  nivelInicial = null,
  filtroInicial = null,
  aoGerarTexto,
}: {
  parecer: ParecerVivo;
  auditId: string | null;
  catalogo: FonteDoCatalogo[];
  onVerNoMemorial: (chave: string, pagina?: number) => void;
  /** Liga os atalhos J/K/M/C/D/F/Z, / e Esc. */
  teclado?: boolean;
  /** O achado que abre primeiro (link do e-mail, clique no resumo). */
  inicial?: string | null;
  /** Abre já filtrada num nível (o clique no nível do resumo). */
  nivelInicial?: Nivel | null;
  /** Abre em "Meus" (o link do e-mail e os atalhos "com você"). */
  filtroInicial?: "meus" | null;
  /** O texto corrigido gerado no "O que fazer" volta para o parecer. */
  aoGerarTexto?: (findingId: string, texto: TextoCorrigido) => void;
}) {
  const confirmados = useMemo(() => parecer.achados.filter((a) => a.confirmado), [parecer.achados]);
  const sugestoes = useMemo(() => parecer.achados.filter((a) => !a.confirmado), [parecer.achados]);
  const todos = parecer.achados;

  // Com um achado pedido, "Todos": o pedido pode ser um já encerrado, e "Pendentes" o esconderia.
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial ?? (inicial ? "todos" : "pendentes"));
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(inicial);
  /*
   * ABERTA EM "MEUS" pelo link, o detalhe acompanha a lista até a pessoa
   * escolher um achado: o foco do pedido pode não ser dela, e os responsáveis
   * chegam do servidor depois que a fila monta (regra de exibição, não estado).
   */
  const [escolheu, setEscolheu] = useState(false);
  const [direcao, setDirecao] = useState(1);
  const [decisao, setDecisao] = useState(false);
  /** A lista de atalhos (tecla ?), aberta por cima da fila. */
  const [verAtalhos, setVerAtalhos] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [aba, setAba] = useState<Aba>("evidencia");
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [niveis, setNiveis] = useState<Nivel[]>(nivelInicial ? [nivelInicial] : []);
  const [discs, setDiscs] = useState<FindingDiscipline[]>([]);
  const [tipos, setTipos] = useState<FindingErrorType[]>([]);
  const [responsavel, setResponsavel] = useState("qualquer");
  const [ordem, setOrdem] = useState<Ordem>("impacto");
  const [agrupar, setAgrupar] = useState<Agrupar>("impacto");
  const [verSugestoes, setVerSugestoes] = useState(false);
  const [faltou, setFaltou] = useState<string | null>(null);
  const [confirmandoAviso, setConfirmandoAviso] = useState(false);
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  // O campo de busca se registra aqui (a "/" o foca). Estado, e não ref: o objeto da fila é lido na renderização.
  const [campoDeBusca, registrarBusca] = useState<HTMLInputElement | null>(null);

  const nFiltros = niveis.length + discs.length + tipos.length + (responsavel !== "qualquer" ? 1 : 0);
  const limparFiltros = () => {
    setNiveis([]);
    setDiscs([]);
    setTipos([]);
    setResponsavel("qualquer");
  };
  const alternarEm = <T,>(lista: T[], set: (v: T[]) => void, v: T) => set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  const discsPresentes = DISCIPLINAS.map((d) => ({ ...d, n: confirmados.filter((a) => a.discs.includes(d.id)).length }))
    .filter((d) => d.n)
    .sort((a, b) => b.n - a.n);
  const tiposPresentes = [...new Set(confirmados.map((a) => a.estruturado.tipoErro).filter((t): t is FindingErrorType => Boolean(t)))].map((t) => ({
    id: t,
    nome: getErrorTypeLabel(t),
    n: confirmados.filter((a) => a.estruturado.tipoErro === t).length,
  }));
  const pessoas = [...new Map(confirmados.filter((a) => a.responsavel).map((a) => [a.responsavel!.email, a.responsavel!])).values()];

  const contagem: Record<Filtro, number> = {
    todos: confirmados.length,
    meus: confirmados.filter((a) => a.responsavel?.souEu && !a.desfecho).length,
    sem: confirmados.filter((a) => !a.responsavel && !a.desfecho).length,
    pendentes: confirmados.filter((a) => !a.desfecho).length,
    corrigidos: confirmados.filter((a) => a.desfecho?.tipo === "FIXED_IN_DOC").length,
    encerrados: confirmados.filter((a) => a.desfecho).length,
  };

  /** O filtro de situação, como regra — os modelos de quadro usam sem passar pelo estado. */
  const passaNaSituacao = (a: AchadoDaTela, f: Filtro) => {
    if (f === "meus") return Boolean(a.responsavel?.souEu && !a.desfecho);
    if (f === "sem") return !a.responsavel && !a.desfecho;
    if (f === "pendentes") return !a.desfecho;
    if (f === "corrigidos") return a.desfecho?.tipo === "FIXED_IN_DOC";
    if (f === "encerrados") return Boolean(a.desfecho);
    return true;
  };

  /** Busca + filtros finos + ordem, SEM a situação. */
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const pos = (a: AchadoDaTela) => NIVEIS.findIndex((n) => n.id === a.nivel);
    const chave: Record<Ordem, (a: AchadoDaTela) => number | string> = {
      impacto: (a) => pos(a) * 100000 + (a.paginas[0] ?? 9999),
      pagina: (a) => a.paginas[0] ?? 99999,
      disciplina: (a) => DISCIPLINAS.findIndex((d) => d.id === a.disc) * 1000 + pos(a),
      referencia: (a) => a.id,
    };
    const cmp = (x: AchadoDaTela, y: AchadoDaTela) => {
      const a = chave[ordem](x);
      const b = chave[ordem](y);
      return a < b ? -1 : a > b ? 1 : 0;
    };
    return [...confirmados].sort(cmp).filter((a) => {
      if (niveis.length && !niveis.includes(a.nivel)) return false;
      if (discs.length && !a.discs.some((d) => discs.includes(d))) return false;
      if (tipos.length && !(a.estruturado.tipoErro && tipos.includes(a.estruturado.tipoErro))) return false;
      if (responsavel !== "qualquer" && a.responsavel?.email !== responsavel) return false;
      if (!q) return true;
      const disc = a.discs.map((id) => DISCIPLINAS.find((d) => d.id === id)?.nome ?? "").join(" ");
      return [a.id, a.chave, a.titulo, disc, a.pagina ? `p. ${a.pagina}` : "", a.bruto.evidencia ?? "", a.bruto.descricao ?? ""].some((t) => t.toLowerCase().includes(q));
    });
  }, [confirmados, busca, niveis, discs, tipos, responsavel, ordem]);

  const visiveis = useMemo(() => filtrados.filter((a) => passaNaSituacao(a, filtro)), [filtrados, filtro]);

  // Agrupado por disciplina, o achado de várias mora num grupo só: o da
  // principal — ou, com filtro de disciplina, o da primeira que o filtro pediu.
  const grupoDaDisciplina = (a: AchadoDaTela) => (discs.length ? (a.discs.find((d) => discs.includes(d)) ?? a.disc) : a.disc);
  const grupos =
    agrupar === "impacto"
      ? NIVEIS.map((n) => ({ id: n.id as string, nome: n.nome, ponto: `rs-ponto rs-ponto--${n.id}`, itens: visiveis.filter((a) => a.nivel === n.id) }))
      : DISCIPLINAS.map((d) => ({ id: d.id as string, nome: d.nome, ponto: `dc-ponto dc--${d.id}`, itens: visiveis.filter((a) => grupoDaDisciplina(a) === d.id) }));

  const meusCorrigidos = useMemo(() => {
    if (filtro !== "meus") return [];
    return filtrados
      .filter((a) => a.meu && a.desfecho?.tipo === "FIXED_IN_DOC")
      .sort((x, y) => String(y.desfecho?.quando ?? "").localeCompare(String(x.desfecho?.quando ?? "")));
  }, [filtro, filtrados]);

  const doFoco = todos.find((a) => a.chave === selecionado);
  const focoVisivel = Boolean(doFoco && [...visiveis, ...meusCorrigidos].some((a) => a.chave === doFoco.chave));
  const primeiroDaLista = visiveis[0] ?? meusCorrigidos[0];
  const atual = (filtroInicial && !escolheu && !focoVisivel ? primeiroDaLista : doFoco) ?? primeiroDaLista ?? confirmados[0] ?? todos[0] ?? null;
  const posicao = atual ? visiveis.findIndex((a) => a.chave === atual.chave) : -1;
  const temArquivo = (a: AchadoDaTela) => resolverFonte({ arquivo: a.estruturado.documento }, catalogo).tipo === "arquivo";
  const fonteDe = (a: AchadoDaTela) => resolverFonte({ arquivo: a.estruturado.documento }, catalogo);

  const abrir = (chave: string, passo = 1) => {
    setDirecao(passo);
    setSelecionado(chave);
    setEscolheu(true);
    setDecisao(false);
    setMotivo("");
    setAba("evidencia");
  };
  const ir = (passo: number) => {
    if (!visiveis.length) return;
    const i = posicao < 0 ? 0 : (posicao + passo + visiveis.length) % visiveis.length;
    abrir(visiveis[i]!.chave, passo);
  };
  /** Encerra o achado dado (ou o atual). Devolve se gravou. */
  const encerrar = async (tipo: Desfecho, nota?: string, alvo?: AchadoDaTela) => {
    const a = alvo ?? atual;
    if (!a || a.desfecho) return false;
    const ok = await parecer.encerrar(a, tipo, nota);
    if (ok) {
      // O primeiro encerramento é a dica da primeira revisão cumprida (M4).
      marcarDica("primeira-revisao");
      setUltimo(a.chave);
      setDecisao(false);
      setMotivo("");
    }
    return ok;
  };
  const desfazer = () => {
    const a = todos.find((x) => x.chave === ultimo);
    if (a) void parecer.reabrir(a);
    setUltimo(null);
  };

  useEffect(() => {
    if (!ultimo) return;
    const t = setTimeout(() => setUltimo(null), 6000);
    return () => clearTimeout(t);
  }, [ultimo]);

  useEffect(() => {
    if (!teclado) return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("[role='dialog']")) return;
      const digitando = alvo.closest("input, textarea, select, [contenteditable='true']");
      if (e.key === "Escape") {
        if (verAtalhos) (e.preventDefault(), setVerAtalhos(false));
        else if (decisao) (e.preventDefault(), setDecisao(false));
        else if (marcados.length) (e.preventDefault(), setMarcados([]));
        else if (digitando && busca) (e.preventDefault(), setBusca(""));
        return;
      }
      if (digitando || e.ctrlKey || e.metaKey || e.altKey || !atual) return;
      const k = e.key.toLowerCase();
      // Quem usa uma tecla de encerrar já sabe dos atalhos: a dica deles não precisa vir (M5).
      if (!atual.desfecho && (k === "c" || k === "f" || k === "d")) marcarDica("atalhos");
      if (k === "?") (e.preventDefault(), setVerAtalhos((v) => !v));
      else if (k === "j") ir(1);
      else if (k === "k") ir(-1);
      else if (k === "m" && temArquivo(atual)) onVerNoMemorial(atual.chave);
      else if (k === "/") (e.preventDefault(), campoDeBusca?.focus());
      else if (!atual.desfecho && k === "c") void encerrar("FIXED_IN_DOC");
      else if (!atual.desfecho && k === "f") void encerrar("FALSE_POSITIVE");
      else if (!atual.desfecho && k === "d") (e.preventDefault(), setDecisao(true));
      else if (k === "z" && ultimo) desfazer();
    };
    document.addEventListener("keydown", tecla, true);
    return () => document.removeEventListener("keydown", tecla, true);
  });

  const alternar = (chave: string) => setMarcados((m) => (m.includes(chave) ? m.filter((x) => x !== chave) : [...m, chave]));
  const opcoesDePessoas = parecer.membros.map((m) => ({ rotulo: m.name ? `${m.name}${m.status === "INVITED" ? " (convidado)" : ""}` : m.email, valor: m.email }));

  async function copiarLink(a: AchadoDaTela) {
    if (!auditId) return;
    const link = linkDoAchado({ base: window.location.origin, auditId, findingId: a.chave });
    try {
      await navigator.clipboard.writeText(link);
      parecer.setAviso({ tom: "ok", texto: "Link do achado copiado." });
    } catch {
      parecer.setAviso({ tom: "falha", texto: `Não deu para copiar. O link é: ${link}` });
    }
  }

  return {
    verAtalhos,
    setVerAtalhos,
    parecer,
    auditId,
    aoGerarTexto,
    catalogo,
    onVerNoMemorial,
    confirmados,
    sugestoes,
    todos,
    filtro,
    setFiltro,
    busca,
    setBusca,
    registrarBusca,
    direcao,
    decisao,
    setDecisao,
    motivo,
    setMotivo,
    marcados,
    setMarcados,
    alternar,
    aba,
    setAba,
    ultimo,
    niveis,
    setNiveis,
    discs,
    setDiscs,
    tipos,
    setTipos,
    responsavel,
    setResponsavel,
    ordem,
    setOrdem,
    agrupar,
    setAgrupar,
    verSugestoes,
    setVerSugestoes,
    faltou,
    setFaltou,
    confirmandoAviso,
    setConfirmandoAviso,
    rascunhos,
    setRascunhos,
    nFiltros,
    limparFiltros,
    alternarEm,
    discsPresentes,
    tiposPresentes,
    pessoas,
    contagem,
    passaNaSituacao,
    filtrados,
    visiveis,
    grupos,
    meusCorrigidos,
    atual,
    posicao,
    temArquivo,
    fonteDe,
    abrir,
    ir,
    encerrar,
    desfazer,
    opcoesDePessoas,
    copiarLink,
  };
}

export type Fila = ReturnType<typeof useFila>;
