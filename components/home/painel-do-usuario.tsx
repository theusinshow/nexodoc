"use client";

/**
 * O PAINEL — a primeira tela depois do login.
 *
 * Traduz `Nexo - Painel v2.dc.html` (projeto "Design de interface Nexo") para o
 * sistema desta casa. Três coisas foram adaptadas, e nenhuma é liberdade:
 *
 *  · o desenho reescreve o SVG do orbe duas vezes, à mão. Aqui é [[../brand/logo-nexo]],
 *    que É esse desenho — mesmos gradientes, mesmo traço. A lei do §6 manda um
 *    só objeto para a marca;
 *  · o desenho monta contorno com dois `div` aninhados (um pinta a borda, o de
 *    dentro o miolo). Isso é `.nx-edge-*` em `globals.css`, com `--nx-edge` e
 *    `--nx-fill`;
 *  · o desenho escreve `clip-path: polygon(...)` inline. O critério 02 do
 *    chanfro diz que os polígonos vivem só em `globals.css`; aqui usa-se
 *    `nx-cut-*` / `nx-edge-*`.
 *
 * A COLUNA DA ESQUERDA É O PROJETO, e não a fila. É a diferença entre esta tela
 * e o que `GET /api/trabalho/meu` responde: lá a pergunta é "o que exige ação
 * SUA", aqui é "onde você está trabalhando". Por isso um projeto sem pendência
 * nenhuma aparece, e por isso o que você ENVIOU aparece junto do que recebeu —
 * o cartão é do projeto, não seu.
 *
 * O componente `fila-do-usuario` era a resposta anterior a essa pergunta e saiu
 * junto com a home antiga. A rota ficou: ela continua sendo o contrato de "o que
 * é seu", com prova própria, e é dela que a fila do Nexo se serve.
 */
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";
import { AgentOrb } from "@/modules/nexo/components/agent-orb";
import { Ima } from "@/components/ambiente/ima";
import type { ItemDoPainel, Painel, ProjetoDoPainel } from "@/lib/painel";

/**
 * A partir de quantos dias um achado parado ganha destaque.
 *
 * Cinco, e não três: com três, uma pendência de sexta já chega alaranjada na
 * segunda — e tarja que acende sozinha no fim de semana ensina a ignorá-la.
 */
const LIMIAR_TARJA = 5;

type Props = {
  nome: string;
  iniciais: string;
  escritorio: string;
  ehAdmin: boolean;
};

export function PainelDoUsuario({ nome, iniciais, escritorio, ehAdmin }: Props) {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [contaAberta, setContaAberta] = useState(false);
  const [soltando, setSoltando] = useState(false);

  useEffect(() => {
    let vivo = true;

    fetch("/api/painel")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((dados: Painel) => {
        if (!vivo) return;
        setPainel(dados);
        /*
         * O PRIMEIRO PROJETO NASCE ABERTO, e só ele. A lista vem com os mais
         * parados primeiro, então o que abre é o que mais espera — e abrir
         * todos devolveria a parede de texto que o acordeão existe para evitar.
         */
        const primeiro = dados.projetos.find((p) => p.itens.length > 0);
        if (primeiro) setAbertos({ [primeiro.projectId]: true });
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });

    return () => {
      vivo = false;
    };
  }, []);

  const carregando = !painel && !falhou;
  const vazio = Boolean(painel && painel.projetos.length === 0);

  return (
    <div
      onDragOver={(ev) => {
        ev.preventDefault();
        if (!soltando) setSoltando(true);
      }}
      onDragLeave={(ev) => {
        if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setSoltando(false);
      }}
      onDrop={(ev) => {
        ev.preventDefault();
        setSoltando(false);
      }}
      className="relative flex min-h-screen flex-col bg-background"
      style={{
        outline: soltando ? "1px dashed var(--primary)" : "none",
        outlineOffset: "-6px",
      }}
    >
      <header className="relative shrink-0 border-b border-border bg-[rgb(18_21_24/0.95)]">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-8">
          <Link href="/nexo" className="flex items-center gap-2 text-foreground">
            <MarcaViva size={26} />
            <span className="font-mono text-sm font-semibold">NexoDoc</span>
          </Link>

          <div className="h-6 w-px bg-border" />

          {/*
            AS ABAS, e não mais só a marca à esquerda. `/` já É o painel, então
            "Painel" fica marcado sem precisar de rota própria. Escondidas
            abaixo de `lg`: a tela estreita já empilha bastante coisa, e o menu
            da conta cobre os mesmos três destinos.
          */}
          <nav className="hidden items-center gap-1 lg:flex">
            <span className="nx-cut-4 bg-[var(--nexodoc-raised)] px-3.5 py-2 font-mono text-xs font-medium uppercase tracking-[0.07em] text-foreground">
              Painel
            </span>
            <Link
              href="/volumes"
              className="px-3.5 py-2 font-mono text-xs font-medium uppercase tracking-[0.07em] text-muted-foreground hover:text-foreground"
            >
              Volumes
            </Link>
            <Link
              href="/projetos"
              className="px-3.5 py-2 font-mono text-xs font-medium uppercase tracking-[0.07em] text-muted-foreground hover:text-foreground"
            >
              Projetos
            </Link>
          </nav>

          <div className="flex-1" />

          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <Relogio />
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-sm font-medium leading-tight text-foreground">{nome}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {escritorio}
                {ehAdmin ? " · Admin" : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setContaAberta((v) => !v)}
              aria-label="Conta"
              aria-expanded={contaAberta}
              className="nx-cut-6 flex h-8 w-8 cursor-pointer items-center justify-center border-0 bg-[var(--nexodoc-raised)] font-mono text-xs font-semibold text-muted-foreground"
            >
              {iniciais}
            </button>
          </div>
        </div>

        {contaAberta ? (
          <div className="mx-auto flex max-w-[1520px] justify-end px-8 pb-3">
            <div
              className="nx-edge-7 w-[236px]"
              style={{ "--nx-fill": "#0d1215" } as React.CSSProperties}
            >
              <div className="p-2">
                <ItemDaConta href="/volumes">Volumes</ItemDaConta>
                <ItemDaConta href="/projetos">Todos os projetos do escritório</ItemDaConta>
                {ehAdmin ? <ItemDaConta href="/admin">Painel Admin</ItemDaConta> : null}
                <div className="my-1.5 h-px bg-[var(--nexodoc-raised)]" />
                <ItemDaConta href="/api/auth/signout" tenue>
                  Sair
                </ItemDaConta>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/*
        A FAIXA DO ORBE, largura total, acima da grade de projetos — não mais
        uma coluna à direita. O convite para falar com o Nexo é a primeira
        coisa depois do cabeçalho, não algo que a pessoa só alcança depois de
        rolar a coluna da esquerda inteira.
      */}
      <div className="border-b border-[#171c1f]">
        <div className="mx-auto flex w-full max-w-[1520px] flex-wrap items-center gap-8 px-4 py-8 sm:px-8">
          <Link
            href="/nexo"
            className="relative block shrink-0 self-center"
            style={{ width: 250, height: 250 }}
          >
            <div
              aria-hidden
              className="absolute rounded-full"
              style={{
                inset: soltando ? "-56px" : "-30px",
                background:
                  "radial-gradient(circle, rgb(0 166 147 / 0.3), transparent 68%)",
                filter: "blur(14px)",
                animation: "nx-respira 4.2s ease-in-out infinite",
                transition: "inset .2s ease",
              }}
            />
            {/*
              O ORBE VIVO, e não mais o SVG.

              Aqui estava `<LogoNexo size={250}>` — o TERCEIRO nível da escada de
              reduções do §6, cujo trabalho declarado é "logo, favicon, impressão,
              fundo claro". A 250px, ocupando a coluna inteira e sendo o convite
              para falar com o agente, ele não é logo: é o agente. E não lia como
              o mesmo objeto do orbe do palco, que é justamente o que a escada
              exige dos três níveis.

              A tela não tinha nenhum orbe vivo, então a regra "um por tela"
              continua valendo com este aqui.

              `interactive` porque ele reage ao ponteiro; o clique quem trata é o
              `<Link>` em volta, e por isso não há `onActivate`.
            */}
            <AgentOrb size="hero" state="idle" interactive className="relative" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="m-0 text-2xl font-medium tracking-[-0.01em] text-foreground">
              {/*
                A ASSINATURA. O nome do agente é a única palavra do produto com
                gradiente (DESIGN.md §11) — é onde ele se apresenta, e assinatura
                tem o mesmo papel do logotipo, escrita em vez de desenhada.
              */}
              {vazio ? (
                "Solte o primeiro documento"
              ) : (
                <>
                  Fale com o <span className="nx-assinatura">Nexo</span>
                </>
              )}
            </p>
            <p className="m-0 mt-2 max-w-[46ch] text-sm leading-normal text-muted-foreground">
              {vazio
                ? "o centro de custo é lido do PDF"
                : "ou solte um PDF em qualquer lugar da tela"}
            </p>
          </div>
        </div>
      </div>

      <main className="relative mx-auto grid w-full max-w-[1520px] flex-1 grid-cols-1 items-start gap-9 px-4 pb-12 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_336px]">
        <section className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <div className="mb-1 flex items-baseline gap-3">
            <h2 className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Seus projetos abertos
            </h2>
            <div className="flex-1" />
            {/* Era `text-[#4c565c]`, um hex cravado fora do DESIGN.md: medido em
                2,58:1 contra o fundo, quando o mínimo para 11px é 4,5:1 — a
                única falha de contraste do produto inteiro. O token do sistema
                diz a mesma coisa e passa. */}
            {painel && !vazio ? (
              <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                mais parados primeiro
              </span>
            ) : null}
          </div>

          {carregando ? <Esqueleto /> : null}

          {falhou ? (
            <p className="max-w-[46ch] py-6 text-sm leading-normal text-muted-foreground">
              Não deu para carregar seus projetos agora. O Nexo continua funcionando — recarregue a
              página quando quiser tentar de novo.
            </p>
          ) : null}

          {vazio ? (
            <div className="px-0.5 py-8">
              <p className="mb-2 text-base font-medium text-foreground">
                Nenhum projeto seu por aqui ainda.
              </p>
              <p className="m-0 max-w-[42ch] text-sm leading-normal text-muted-foreground">
                Solte um documento em qualquer lugar da tela: o centro de custo é lido do PDF e a
                pasta nasce a partir dele.
              </p>
            </div>
          ) : null}

          {painel?.projetos.map((projeto) => (
            <CartaoDeProjeto
              key={projeto.projectId}
              projeto={projeto}
              aberto={Boolean(abertos[projeto.projectId])}
              alternar={() =>
                setAbertos((atual) => ({
                  ...atual,
                  [projeto.projectId]: !atual[projeto.projectId],
                }))
              }
            />
          ))}

          <Link
            href="/projetos"
            className="mt-2 self-start font-mono text-xs tracking-[0.05em] text-primary hover:text-[var(--nexodoc-accent)]"
          >
            Ver todos os projetos do escritório →
          </Link>
        </section>

        <aside className="flex w-full min-w-0 flex-col gap-3">
          <h3 className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Onde você parou
          </h3>

          {painel && painel.recentes.length === 0 ? (
            <p className="m-0 text-sm leading-normal text-muted-foreground">
              Sua primeira auditoria aparece aqui.
            </p>
          ) : null}

          <div className="nx-edge-8" style={{ "--nx-fill": "var(--card)" } as React.CSSProperties}>
            <div className="flex flex-col px-3.5">
              {painel?.recentes.map((recente) => (
                <Link
                  key={recente.auditId}
                  href={`/nexo?auditoria=${encodeURIComponent(recente.auditId)}`}
                  className="flex items-baseline gap-3 border-b border-[#171c1f] py-3 last:border-0 hover:text-[var(--nexodoc-accent)]"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {recente.nome}
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.03em] text-muted-foreground">
                    {recente.quando}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <h3 className="m-0 mt-4 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Nova auditoria
          </h3>

          {/*
            O CARTÃO É PROVA, NÃO UM SEGUNDO CONTROLE. A página inteira já
            escuta `onDragOver`/`onDrop` (o toque tracejado do container); este
            painel não tem `onDrop` próprio — duplicar o alvo criaria dois
            comportamentos para soltar um PDF. Ele só reflete `soltando`, que é
            o estado real, e existe para quem chega na tela sem projeto aberto
            e precisa que ALGUM elemento diga "é aqui que se solta".
          */}
          <div
            aria-hidden
            className="nx-cut-8 flex flex-col items-center gap-2.5 px-5 py-8 text-center transition-colors duration-150"
            style={{
              background: soltando ? "#0f2d2a" : "#0d1215",
              outline: `1px dashed ${soltando ? "var(--nexodoc-accent)" : "var(--border)"}`,
              outlineOffset: "-1px",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              className="h-[26px] w-[26px]"
              style={{ color: soltando ? "var(--nexodoc-accent)" : "var(--border)" }}
            >
              <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium text-foreground">Solte um PDF aqui</span>
            <span className="max-w-[30ch] text-xs leading-normal text-muted-foreground">
              O centro de custo é lido do documento e a pasta nasce a partir dele.
            </span>
          </div>
        </aside>
      </main>

      {soltando ? (
        <div className="nx-cut-8 fixed bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-3 bg-primary px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground">
          Solte o PDF para iniciar a auditoria
        </div>
      ) : null}
    </div>
  );
}

function ItemDaConta({
  href,
  children,
  tenue,
}: {
  href: string;
  children: React.ReactNode;
  tenue?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 text-sm hover:bg-[#141a1e] ${
        tenue ? "text-muted-foreground" : "text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

/** 20s: o relógio mostra hora e minuto, e errar o minuto por 20s ninguém vê. */
const PASSO_DO_RELOGIO = 20_000;

function assinarRelogio(avisar: () => void) {
  const i = setInterval(avisar, PASSO_DO_RELOGIO);
  return () => clearInterval(i);
}

/*
 * A leitura devolve a FATIA de 20s, e não o instante.
 *
 * `useSyncExternalStore` compara o que a leitura devolve entre renderizações e
 * volta a renderizar enquanto o valor mudar — `Date.now()` mudaria a cada
 * chamada e o componente giraria para sempre. A fatia só muda quando o
 * intervalo dispara, que é exatamente quando a tela tem o que atualizar.
 */
const lerFatia = () => Math.floor(Date.now() / PASSO_DO_RELOGIO);

/** No servidor não há relógio: `null` deixa o espaço reservado e sem texto. */
const semRelogioNoServidor = () => null;

/**
 * O relógio do desenho, como FONTE EXTERNA e não como estado.
 *
 * A primeira versão era `useState` + `setState` dentro do efeito, e o linter
 * recusou com razão: o tempo não é estado deste componente, é algo que muda por
 * fora e que ele apenas observa. `useSyncExternalStore` também resolve a
 * hidratação de graça — o servidor renderiza sem hora, e o cliente preenche.
 */
function Relogio() {
  const fatia = useSyncExternalStore(assinarRelogio, lerFatia, semRelogioNoServidor);

  if (fatia === null) {
    return <span className="text-base font-medium tracking-[0.02em] text-transparent">--:--</span>;
  }

  const agora = new Date(fatia * PASSO_DO_RELOGIO);

  return (
    <>
      <span className="text-base font-medium tracking-[0.02em] text-foreground">
        {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </span>
      <span className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
        {agora
          .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
          .replace(/\.$/, "")}
      </span>
    </>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-2">
      <div className="nx-cut-8 h-[132px] animate-pulse bg-card" />
      <div className="nx-cut-8 h-[46px] animate-pulse bg-card" />
      <div className="nx-cut-8 h-[46px] animate-pulse bg-card" />
    </div>
  );
}

function CartaoDeProjeto({
  projeto,
  aberto,
  alternar,
}: {
  projeto: ProjetoDoPainel;
  aberto: boolean;
  alternar: () => void;
}) {
  const alerta = projeto.diasParado >= LIMIAR_TARJA;

  return (
    <div
      className="nx-edge-8"
      style={
        {
          "--nx-edge": alerta ? "#4a3a1c" : "var(--border)",
          "--nx-fill": "var(--card)",
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        className="flex w-full cursor-pointer items-center gap-4 border-0 px-4 py-3 text-left"
        style={{ background: alerta ? "var(--status-warning-bg)" : "transparent" }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
          className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150"
          style={{ transform: aberto ? "rotate(90deg)" : "none" }}
        >
          <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          className="font-mono text-[13px] font-semibold tracking-[0.04em]"
          style={{ color: alerta ? "var(--status-warning)" : "var(--muted-foreground)" }}
        >
          {projeto.codigo}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{projeto.nome}</span>
        <span
          className="font-mono text-xs tracking-[0.03em]"
          style={{ color: alerta ? "var(--status-warning)" : "var(--muted-foreground)" }}
        >
          {resumo(projeto)}
        </span>
      </button>

      {aberto ? (
        <div className="flex flex-col gap-0.5 pb-4 pl-11 pr-4 pt-0.5">
          {projeto.itens.map((item, indice) => (
            <Link
              key={`${item.auditId}-${item.titulo}-${indice}`}
              href={`/nexo?auditoria=${encodeURIComponent(item.auditId)}`}
              className="flex items-center gap-3 border-t border-[var(--nexodoc-raised)] py-2 text-inherit"
            >
              <span
                aria-hidden
                className="nx-cut-4 h-[7px] w-[7px] shrink-0"
                style={{ background: corDoItem(item) }}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.titulo}</span>
              {/*
                O NOME NÃO PODE EMPURRAR O TÍTULO. Com um e-mail no lugar do
                nome, esta coluna cresceu até o título sumir por inteiro na tela
                estreita — sobrava "de fulano@empresa.com" e nada do achado.
                Encurtado por `nomeCurto`, travado contra quebra, e escondido de
                todo no celular: quem é lê-se abrindo o achado.
              */}
              <span className="hidden shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:inline">
                {item.direcao === "recebido"
                  ? `de ${nomeCurto(item.pessoa)}`
                  : `→ ${nomeCurto(item.pessoa)}`}
              </span>
              <span
                className="shrink-0 whitespace-nowrap text-right font-mono text-[11px] tracking-[0.03em] sm:min-w-[96px]"
                style={{
                  color:
                    item.direcao === "recebido" && item.dias >= LIMIAR_TARJA
                      ? "var(--status-warning)"
                      : "var(--muted-foreground)",
                }}
              >
                {rotuloDeTempo(item)}
              </span>
            </Link>
          ))}

          <div className="flex flex-wrap items-center gap-2 pt-3">
            {projeto.artefatos.map((artefato) => (
              <Link
                key={artefato.artifactId}
                href={`/projetos/${projeto.projectId}`}
                className="nx-cut-5 inline-flex items-center gap-2 bg-[var(--nexodoc-raised)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
              >
                <span>{artefato.rotulo}</span>
                <span className="normal-case tracking-[0.02em] text-muted-foreground">
                  {artefato.quando}
                </span>
              </Link>
            ))}
            <div className="flex-1" />
            {/*
              O ÍMÃ, num dos dois controles do produto que o recebem. É a ação
              principal deste cartão — e a restrição a dois é o que faz o efeito
              querer dizer "isto aqui é a ação", em vez de "esta tela é inquieta".
            */}
            <Ima>
            <Link
              href={`/nexo?projeto=${encodeURIComponent(projeto.projectId)}`}
              className="nx-cut-5 inline-flex items-center gap-2 bg-[#0f2d2a] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--nexodoc-accent)] hover:bg-[#164039]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden
                className="h-3 w-3"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <span>Nova auditoria</span>
            </Link>
            </Ima>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * O resumo do cabeçalho conta SÓ o que espera por você.
 *
 * Somar o que você enviou faria "3 achados" numa linha em que dois estão com
 * outra pessoa — e a pessoa abriria o projeto procurando trabalho que não é
 * dela. O que foi enviado aparece dentro, com a seta, que é onde a distinção
 * cabe.
 */
function resumo(projeto: ProjetoDoPainel) {
  const recebidos = projeto.itens.filter((i) => i.direcao === "recebido").length;
  const enviados = projeto.itens.length - recebidos;

  if (recebidos === 0) {
    return enviados > 0 ? `${enviados} com outros` : "sem pendência";
  }

  const contagem = `${recebidos} ${recebidos === 1 ? "achado" : "achados"}`;

  return projeto.diasParado >= LIMIAR_TARJA
    ? `${contagem} · parado há ${projeto.diasParado} dias`
    : contagem;
}

function rotuloDeTempo(item: ItemDoPainel) {
  if (item.direcao === "recebido" && item.dias >= LIMIAR_TARJA) {
    return `parado há ${item.dias} dias`;
  }

  if (item.dias === 0) return "hoje";
  if (item.dias === 1) return "ontem";

  return `${item.dias} dias`;
}

/**
 * O NOME DE UMA PESSOA, curto o bastante para caber numa linha de lista.
 *
 * Quem foi convidado e nunca entrou não tem nome — o vínculo guarda só o
 * e-mail, e é assim de propósito (dá para atribuir trabalho antes do primeiro
 * login). Mostrar `victor.almeida@prosul.com.br` inteiro come a linha do achado.
 *
 * Nome completo vira o primeiro nome; e-mail vira o que vem antes do `@`, sem
 * inventar maiúscula em cima de um endereço que talvez não seja um nome.
 */
function nomeCurto(valor: string) {
  const local = valor.includes("@") ? valor.split("@")[0] : valor;
  const primeiro = local.trim().split(/\s+/)[0] ?? local;

  return primeiro.length > 18 ? `${primeiro.slice(0, 17)}…` : primeiro;
}

function corDoItem(item: ItemDoPainel) {
  if (item.direcao === "enviado") return "#3d474d";
  return item.dias >= LIMIAR_TARJA ? "var(--status-warning)" : "var(--primary)";
}
