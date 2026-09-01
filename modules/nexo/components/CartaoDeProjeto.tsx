"use client";

/**
 * O CARTÃO DE PROJETO — a linha da barra lateral, do desenho aprovado.
 *
 * FECHADO são duas linhas: identidade (código · cliente · quando) e desfecho
 * (as etiquetas do que existe, e as folhas). Nada do que está DENTRO aparece —
 * se importasse, o cartão estaria aberto.
 *
 * ABERTO, ele mostra as quatro conversas mais recentes. O quinto item não é
 * rolagem: é "as outras 8 conversas · desde 04/07", que abre o projeto no
 * palco. Rolagem dentro de rolagem é o que transforma barra em acordeão, e é
 * por isso que a altura aqui é previsível.
 *
 * DENTRO, A CONVERSA NÃO REPETE O CÓDIGO: ele está três linhas acima. Ela se
 * chama pelas disciplinas e pelo que produziu — "MET · EST — volume".
 *
 * O VOCABULÁRIO É O DA CASA. O desenho veio com hexadecimais próprios; aqui
 * eles viram tokens (`--secondary` para a etiqueta quieta, `--input` para o
 * documento final), porque a DESIGN.md manda que cor nova nasça com nome e
 * consumidor declarados — e estas não são cores novas, são as que já existem
 * fazendo o trabalho que o desenho pediu.
 */

import { ChevronRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ehDocumentoFinal,
  type CartaoDeProjeto as Cartao,
} from "../lib/cartoes-de-projeto";

/** "4 min", "17:40", "ontem", "qui", "12/08" — a régua curta da barra. */
function quando(ms: number, agora = Date.now()): string {
  const min = Math.round((agora - ms) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const d = new Date(ms);
  const hoje = new Date(agora);
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const dias = Math.floor((agora - ms) / 86_400_000);
  if (dias <= 1) return "ontem";
  if (dias < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** A etiqueta de um artefato. O documento FINAL vem mais forte que os meios. */
function Etiqueta({ nome }: { nome: string }) {
  const final = ehDocumentoFinal(nome);
  return (
    <span
      className={cn(
        "nx-cut-4 px-[5px] py-px font-mono text-[11px] leading-[13px] tracking-[0.06em]",
        final
          ? "bg-[var(--input)] text-foreground"
          : "bg-[var(--secondary)] text-muted-foreground",
      )}
    >
      {nome}
    </span>
  );
}

export function CartaoDeProjeto({
  cartao,
  aberto,
  conversaAtiva,
  onAlternar,
  onAbrirConversa,
  onVerTudo,
}: {
  cartao: Cartao;
  aberto: boolean;
  conversaAtiva?: string;
  onAlternar: () => void;
  onAbrirConversa: (id: string) => void;
  onVerTudo?: (chave: string) => void;
}) {
  /*
   * "A ENDEREÇAR", e não "Sem código no carimbo".
   *
   * Memorial não tem carimbo — o rótulo antigo era mentira de vocabulário, e
   * dizia à pessoa que o documento dela estava errado quando o que faltava era
   * o sistema ter ligado a conversa a um projeto.
   */
  const semCodigo = cartao.aEnderecar;
  const nome = semCodigo
    ? "A endereçar"
    : cartao.cliente
      ? `${cartao.codigo} · ${cartao.cliente}`
      : cartao.codigo;

  return (
    <li className="list-none">
      <div
        className={cn(
          "nx-edge-6 transition-colors",
          aberto
            ? "[--nx-edge:var(--border)] [--nx-fill:var(--card)]"
            : "[--nx-edge:transparent] [--nx-fill:transparent] hover:[--nx-fill:var(--accent)]",
        )}
      >
        {/* O CABEÇALHO é o cartão fechado, e continua sendo o alvo do clique
            quando aberto: fechar é o mesmo gesto de abrir. */}
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberto}
          className="flex w-full flex-col gap-0.5 px-2.5 py-2 text-left focus-visible:outline-none"
        >
          <span className="flex w-full items-center gap-1.5">
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-[var(--duration-fast)]",
                aberto && "rotate-90",
              )}
              strokeWidth={1.5}
              aria-hidden
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-mono text-[12px] font-medium tracking-[0.06em]",
                semCodigo ? "uppercase text-muted-foreground" : "text-foreground",
              )}
            >
              {nome}
            </span>
            <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-muted-foreground">
              {quando(cartao.atualizadoEm)}
            </span>
          </span>

          {/* A SEGUNDA LINHA: o que o projeto tem. Ela é o ritmo horizontal que
              faz uma linha parecer diferente da vizinha — sem ela a lista vira
              um cinza uniforme de longe. */}
          <span className="flex w-full items-center gap-1.5 pl-[18px]">
            {cartao.rodando ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--status-warning)]">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                análise rodando
              </span>
            ) : semCodigo ? (
              /*
               * O BALDE SEM CÓDIGO NÃO É UM PROJETO, e etiquetar o agregado
               * dele mente: "CAPA AUDITORIA" ali soma artefatos de conversas
               * que nada têm a ver umas com as outras. O que ele tem para
               * dizer é quantas são.
               */
              <span className="font-mono text-[11px] text-muted-foreground">
                {cartao.conversas.length + cartao.restantes} conversa
                {cartao.conversas.length + cartao.restantes === 1 ? "" : "s"} sem projeto
              </span>
            ) : (
              cartao.artefatos.slice(0, 4).map((a) => <Etiqueta key={a} nome={a} />)
            )}
            <span className="flex-1" />
            {cartao.folhas > 0 && !semCodigo ? (
              <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-muted-foreground">
                {cartao.folhas} fl
              </span>
            ) : null}
          </span>
        </button>

        {aberto ? (
          <ul className="m-0 list-none border-t border-border/50 px-1.5 py-1">
            {cartao.conversas.map((c) => {
              const ativa = c.id === conversaAtiva;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onAbrirConversa(c.id)}
                    aria-current={ativa ? "true" : undefined}
                    className={cn(
                      "nx-edge-5 flex w-full items-baseline gap-2 px-2 py-1.5 text-left transition-colors focus-visible:outline-none",
                      ativa
                        ? "[--nx-edge:var(--primary)] [--nx-fill:var(--accent)]"
                        : "[--nx-edge:transparent] [--nx-fill:transparent] hover:[--nx-fill:var(--accent)]",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                      {c.titulo}
                      <span className="text-muted-foreground"> — {c.desfecho}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {c.rodando ? "rodando" : quando(c.updatedAt)}
                    </span>
                  </button>
                </li>
              );
            })}

            {/* O NONO ITEM NÃO É ROLAGEM. Uma linha que delega ao palco, onde há
                largura para doze conversas. */}
            {cartao.restantes > 0 ? (
              <li>
                <button
                  type="button"
                  onClick={() => onVerTudo?.(cartao.chave)}
                  className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
                >
                  <span className="flex-1 truncate">
                    {cartao.restantes === 1
                      ? "a outra conversa"
                      : `as outras ${cartao.restantes} conversas`}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    desde {quando(cartao.restantesDesde)}
                  </span>
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
