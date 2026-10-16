"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentPropsWithRef, type ReactNode } from "react";

import type { CorDaPessoa } from "@/lib/cor-da-pessoa";
import { CURVA } from "@/lib/ds/movimento";
import { useTempo } from "@/lib/ds/tempo";

/*
 * As peças básicas do sistema novo. Aparência em app/ds.css (classes ds-*);
 * aqui, só comportamento e movimento.
 */

type Variante = "primary" | "ghost" | "quiet";

export function Botao({
  variante = "ghost",
  tamanho,
  icone,
  className = "",
  children,
  ...resto
}: ComponentPropsWithRef<"button"> & { variante?: Variante; tamanho?: "sm"; icone?: boolean }) {
  const cls = ["ds-btn", `ds-btn--${variante}`, tamanho === "sm" && "ds-btn--sm", icone && "ds-btn--icon", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} {...resto}>
      {children}
    </button>
  );
}

export type Tom = "neutro" | "line" | "nexo" | "block" | "risco" | "decide" | "note" | "texto" | "ok";

export function Selo({ tom = "neutro", ponto, children }: { tom?: Tom; ponto?: boolean; children: ReactNode }) {
  return (
    <span className={`ds-pill${tom === "neutro" ? "" : ` ds-pill--${tom}`}`}>
      {ponto && <i aria-hidden />}
      {children}
    </span>
  );
}

/**
 * SEGMENTO: a pílula desliza para a opção escolhida (mola snappy). É a
 * resposta a "para onde foi a seleção" — o olho acompanha em vez de procurar.
 */
export function Segmento<T extends string>({
  opcoes,
  valor,
  onTroca,
  rotulo,
  tour,
}: {
  opcoes: { valor: T; rotulo: ReactNode }[];
  valor: T;
  onTroca: (v: T) => void;
  rotulo: string;
  /** Âncora do tutorial (`data-tour`). */
  tour?: string;
}) {
  const id = useId();
  const { mola } = useTempo();
  return (
    <div className="ds-seg" role="group" aria-label={rotulo} data-tour={tour}>
      {opcoes.map((o) => {
        const ligado = o.valor === valor;
        return (
          <button key={o.valor} type="button" aria-pressed={ligado} onClick={() => onTroca(o.valor)}>
            {ligado && <motion.span layoutId={`${id}-pilula`} className="ds-seg-pilula" transition={mola("snappy")} />}
            <span>{o.rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * SELETOR: botão que abre um menu de opções. O menu CRESCE A PARTIR DO BOTÃO
 * (origem no topo) — ele sai de onde a mão estava, e volta para lá ao fechar.
 * Esc e clique fora fecham; setas percorrem.
 */
export function Seletor<T extends string>({
  opcoes,
  valor,
  onTroca,
  icone,
  prefixo,
}: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onTroca: (v: T) => void;
  icone?: ReactNode;
  prefixo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { dur } = useTempo();
  const atual = opcoes.find((o) => o.valor === valor);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Botao variante="ghost" tamanho="sm" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        {icone}
        {prefixo && <span style={{ color: "var(--ds-text-tertiary)", fontWeight: 400 }}>{prefixo}</span>}
        {atual?.rotulo}
        <motion.span animate={{ rotate: aberto ? 180 : 0 }} transition={{ duration: dur("state"), ease: [...CURVA.out] }} style={{ display: "inline-flex" }}>
          <ChevronDown />
        </motion.span>
      </Botao>
      <AnimatePresence>
        {aberto && (
          <motion.div
            role="menu"
            className="ds-menu"
            style={{ top: "calc(100% + 6px)", right: 0, transformOrigin: "top right" }}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: dur("feedback"), ease: [...CURVA.exit] } }}
            transition={{ duration: dur("enter"), ease: [...CURVA.out] }}
          >
            {opcoes.map((o) => (
              <button
                key={o.valor}
                type="button"
                role="menuitemradio"
                aria-checked={o.valor === valor}
                onClick={() => {
                  onTroca(o.valor);
                  setAberto(false);
                }}
              >
                <span style={{ width: 16, display: "inline-flex" }}>{o.valor === valor && <Check size={15} />}</span>
                {o.rotulo}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * O ORBE PEQUENO: o quadro capturado do orbe vivo (public/marca, violeta → coral),
 * e não um desenho à parte. `tamanho` é o diâmetro da esfera; o PNG tem 8% de
 * margem em volta, que a caixa absorve sem mexer no layout.
 *
 * Em repouso é a marca parada. Trabalhando, a tira de 18 quadros roda: o orbe é
 * a única coisa que vive sozinha na tela, e só enquanto há trabalho.
 * O arquivo sai pelo tamanho na tela em 2× (um PNG grande reduzido fica mole).
 */
export function Orbe({ tamanho, estado = "repouso" }: { tamanho: number; estado?: "repouso" | "trabalhando" }) {
  const px = (tamanho / 0.84) * 2;
  const parado = px <= 64 ? "/marca/orbe-64.png" : px <= 180 ? "/marca/orbe-180.png" : "/marca/orbe-512.png";
  const tira = px <= 96 ? "/marca/orbe-tira.png" : "/marca/orbe-tira-192.png";
  return (
    <span
      className="ds-orbe"
      data-estado={estado}
      style={{
        ["--s" as string]: `${tamanho}px`,
        ["--ds-orbe-parado" as string]: `url("${parado}")`,
        ...(estado === "trabalhando" ? { ["--ds-orbe-tira" as string]: `url("${tira}")` } : {}),
      }}
      aria-hidden
    />
  );
}

export function Tecla({ children }: { children: ReactNode }) {
  return <kbd className="ds-kbd">{children}</kbd>;
}

/** `cor` sai de `corDaPessoa` (lib/cor-da-pessoa.ts): o tom do grupo técnico e o anel de admin. */
export function Avatar({
  iniciais,
  pequeno,
  grande,
  cor,
}: {
  iniciais: string;
  pequeno?: boolean;
  /** 40px: o do menu da conta. */
  grande?: boolean;
  cor?: CorDaPessoa;
}) {
  const cls = ["ds-avatar", pequeno && "ds-avatar--xs", grande && "ds-avatar--lg", cor?.tom && `ds-avatar--${cor.tom}`, cor?.admin && "ds-avatar--admin"]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} title={cor?.rotulo ?? undefined} aria-hidden>
      {iniciais}
    </span>
  );
}

/** Ação curta esperando o servidor: o anel fino, na cor do texto em volta. */
export function Girando({ tamanho = 14, rotulo }: { tamanho?: number; rotulo?: string }) {
  return <span className="ds-gira" style={{ ["--t" as string]: `${tamanho}px` }} role={rotulo ? "status" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true} />;
}

export function Esqueleto({ largura, altura = 12, raio }: { largura: number | string; altura?: number; raio?: number }) {
  return <span className="ds-skel" style={{ display: "block", width: largura, height: altura, borderRadius: raio }} aria-hidden />;
}

/**
 * NÚMERO QUE CHEGA: conta de 0 até o valor na primeira pintura, e da cifra
 * antiga até a nova quando muda. Responde a "o que mudou" num contador — o
 * olho vê que o número é novo. Tabular, para não sacudir a linha.
 */
export function NumeroQueChega({ valor }: { valor: number }) {
  const [mostrado, setMostrado] = useState(0);
  // Conta a partir do que ESTÁ NA TELA, não do último valor pedido: assim um
  // efeito interrompido (StrictMode roda duas vezes; troca rápida de valor)
  // retoma de onde parou em vez de desistir achando que já contou.
  const naTela = useRef(0);
  const { dur } = useTempo();
  // A duração vai por ref: `dur` é uma função nova a cada render, e como
  // dependência do efeito ela cancelava a contagem no primeiro quadro.
  // Escrita num efeito (e não no corpo do render), antes do efeito que conta.
  const total = useRef(0);
  const totalMs = dur("layout") * 2000;
  useEffect(() => {
    total.current = totalMs;
  });
  useEffect(() => {
    const de = naTela.current;
    const ate = valor;
    if (de === ate) return;
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / total.current);
      const e = 1 - Math.pow(1 - p, 3);
      naTela.current = Math.round(de + (ate - de) * e);
      setMostrado(naTela.current);
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  // Separador de milhar em português: 1.284, não 1284.
  return <span className="ds-num">{mostrado.toLocaleString("pt-BR")}</span>;
}

/**
 * MENU DE AÇÕES. Como o Seletor, cresce do botão; mas cada item FAZ algo em
 * vez de escolher um valor (Exportar, Mais ações). Esc consumido chama
 * preventDefault, para o Esc global da tela não agir junto.
 */
export function Menu({
  rotulo,
  itens,
  variante = "ghost",
  tamanho = "sm",
  alinhar = "right",
}: {
  rotulo: ReactNode;
  itens: { rotulo: string; dica?: string; icone?: ReactNode; onClick?: () => void }[];
  variante?: Variante;
  tamanho?: "sm";
  alinhar?: "left" | "right";
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { dur } = useTempo();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc, true);
    };
  }, [aberto]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Botao variante={variante} tamanho={tamanho} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        {rotulo}
        <motion.span animate={{ rotate: aberto ? 180 : 0 }} transition={{ duration: dur("state"), ease: [...CURVA.out] }} style={{ display: "inline-flex" }}>
          <ChevronDown />
        </motion.span>
      </Botao>
      <AnimatePresence>
        {aberto && (
          <motion.div
            role="menu"
            className="ds-menu ds-menu--acoes"
            style={{ top: "calc(100% + 6px)", [alinhar]: 0, transformOrigin: `top ${alinhar}` }}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: dur("feedback"), ease: [...CURVA.exit] } }}
            transition={{ duration: dur("enter"), ease: [...CURVA.out] }}
          >
            {itens.map((i) => (
              <button
                key={i.rotulo}
                type="button"
                role="menuitem"
                onClick={() => {
                  i.onClick?.();
                  setAberto(false);
                }}
              >
                <span style={{ width: 16, display: "inline-flex" }}>{i.icone}</span>
                <span className="ds-menu-texto">
                  {i.rotulo}
                  {i.dica && <small>{i.dica}</small>}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
