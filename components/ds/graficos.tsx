"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { CURVA } from "@/lib/ds/movimento";
import { partesEmBrasilia } from "@/lib/fuso-de-brasilia";
import { useTempo } from "@/lib/ds/tempo";

/*
 * GRÁFICOS do sistema novo, no idioma da Matos UI (referência do Matheus):
 * monocromáticos, barras em pílula sobre trilho com textura, marcador fino, e
 * a animação que REVELA o dado em vez de enfeitá-lo. Escritos aqui com os
 * tokens --ds-* e o motion do projeto — não copiados de lá.
 */

const ease = (c: readonly number[]) => [...c] as [number, number, number, number];

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export interface PassoDaLinha {
  id: string;
  rotulo: string;
  /** Início, em segundos desde o começo. */
  inicio: number;
  /** Duração real (feitos) ou decorrida (atual). */
  duracao: number;
  /** Duração prevista — para o atual e os que faltam. 0 = sem previsão (o futuro fica "na fila"). */
  previsto: number;
  estado: "feito" | "atual" | "futuro" | "erro";
  /** Uma linha sob a etapa (a atual diz o que está fazendo; a que parou, por quê). */
  nota?: ReactNode;
}

/**
 * LINHA DO TEMPO (waterfall). Cada passo é uma pílula no eixo do tempo,
 * começando onde começou. Os que faltam aparecem TRACEJADOS na posição
 * prevista — a tela mostra o futuro como estimativa, não como promessa. Um
 * marcador vertical diz "agora". O passo mais lento entre os feitos ganha o
 * tom claro; o atual que passou do previsto, o âmbar.
 */
export function LinhaDoTempo({ passos, agora, total }: { passos: PassoDaLinha[]; agora: number | null; total: number }) {
  const { dur, k } = useTempo();
  const [foco, setFoco] = useState<string | null>(null);
  const escala = (s: number) => `${(s / total) * 100}%`;
  const feitos = passos.filter((p) => p.estado === "feito");
  const maisLento = feitos.length > 1 ? feitos.reduce((a, b) => (b.duracao > a.duracao ? b : a)).id : null;
  // O passo do eixo acompanha a duração: de minuto em minuto até 10 min, depois de 2 e de 5.
  const passo = total > 1500 ? 300 : total > 600 ? 120 : 60;
  const marcas = Array.from({ length: Math.floor(total / passo) + 1 }, (_, i) => i * passo);

  return (
    <div className="gr-linha" onMouseLeave={() => setFoco(null)}>
      {passos.map((p, i) => {
        // Sem previsão (0) não há "passou do previsto" nem pílula no futuro: o app não inventa estimativa.
        const temPrevisto = p.previsto > 0;
        const passou = p.estado === "atual" && temPrevisto && p.duracao > p.previsto;
        const largura = p.estado === "futuro" ? p.previsto : Math.max(p.duracao, 2);
        return (
          <div
            key={p.id}
            className={`gr-passo gr-passo--${p.estado}${foco && foco !== p.id ? " gr-passo--fora" : ""}`}
            onMouseEnter={() => setFoco(p.id)}
          >
            <span className="gr-passo-rotulo">{p.rotulo}</span>
            <span className="gr-trilho">
              <motion.span
                className={`gr-pilula${p.id === maisLento ? " gr-pilula--lenta" : ""}${passou ? " gr-pilula--passou" : ""}`}
                style={{ left: escala(p.inicio) }}
                initial={{ width: 0 }}
                animate={{ width: escala(largura) }}
                transition={{ duration: p.estado === "atual" ? dur("layout") : dur("layout") * 2, ease: ease(CURVA.out), delay: p.estado === "atual" ? 0 : i * 0.05 * k }}
              >
                {p.estado !== "futuro" && largura / total > 0.07 && <span className="gr-pilula-valor">{mmss(p.duracao)}</span>}
              </motion.span>
              {/* o previsto do passo atual: um contorno onde ele deveria terminar */}
              {p.estado === "atual" && temPrevisto && !passou && <span className="gr-previsto" style={{ left: escala(p.inicio), width: escala(p.previsto) }} />}
            </span>
            <span className="gr-passo-tempo">
              {p.estado === "futuro" ? (temPrevisto ? `~${mmss(p.previsto)}` : "na fila") : p.estado === "erro" ? "parou" : mmss(p.duracao)}
            </span>
            {p.nota && <span className="gr-passo-nota">{p.nota}</span>}
          </div>
        );
      })}

      {/* eixo e marcador de agora */}
      <div className="gr-eixo">
        <span />
        <span className="gr-eixo-marcas">
          {marcas.filter((m) => agora === null || Math.abs(m - agora) > total * 0.05).map((m) => (
            <i key={m} style={{ left: escala(m) }}>
              {mmss(m)}
            </i>
          ))}
          {agora !== null && (
            <motion.b
              className="gr-agora"
              initial={false}
              animate={{ left: escala(Math.min(agora, total)) }}
              transition={{ duration: 0.9 * k, ease: "linear" }}
            >
              agora
            </motion.b>
          )}
        </span>
        <span />
      </div>
      {agora !== null && (
        <div className="gr-agora-linha-wrap" aria-hidden>
          <span />
          <span className="gr-agora-trilho">
            <motion.i initial={false} animate={{ left: escala(Math.min(agora, total)) }} transition={{ duration: 0.9 * k, ease: "linear" }} />
          </span>
          <span />
        </div>
      )}
    </div>
  );
}

/**
 * MAPA DAS PÁGINAS (heatmap). Um quadrado por página do documento; o tom é
 * quantos pontos o Nexo marcou nela — mostra ONDE os problemas se juntam
 * enquanto a leitura anda. As páginas do bloco atual pulsam; as não lidas
 * ficam só no contorno.
 */
export function MapaDasPaginas({
  paginas,
  lidas,
  atuais,
  lidasEm,
  destaque,
  legenda,
  colunas = 14,
}: {
  /** Quantas páginas por linha. */
  colunas?: number;
  /** O rodapé em repouso; null deixa só a leitura do mouse. */
  legenda?: ReactNode;
  paginas: number[];
  /** Quantas páginas já foram lidas (as primeiras N). */
  lidas: number;
  /** Páginas do bloco em leitura (1-based). */
  atuais: number[];
  /** Lista explícita das lidas, quando a leitura não anda em ordem (blocos em paralelo). */
  lidasEm?: number[];
  /** Páginas em evidência (o bloco sob o mouse, lá fora): as outras recuam. */
  destaque?: number[] | null;
}) {
  const { dur, k } = useTempo();
  const [sobre, setSobre] = useState<number | null>(null);
  const maximo = Math.max(1, ...paginas);

  return (
    <div className="gr-mapa">
      <div className="gr-mapa-grade" style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)` }} onMouseLeave={() => setSobre(null)}>
        {paginas.map((pontos, i) => {
          const n = i + 1;
          const lida = lidasEm ? lidasEm.includes(n) : i < lidas;
          const atual = atuais.includes(n);
          const recua = !!destaque && !destaque.includes(n);
          const tom = lida && pontos > 0 ? 0.18 + (pontos / maximo) * 0.72 : 0;
          const linha = Math.floor(i / colunas);
          const coluna = i % colunas;
          return (
            <motion.span
              key={n}
              className={`gr-pagina${lida ? " gr-pagina--lida" : ""}${atual ? " gr-pagina--atual" : ""}${recua ? " gr-pagina--recua" : ""}`}
              style={{ ["--tom" as string]: tom }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              // revelação na diagonal, como a grade chega
              transition={{ duration: dur("enter"), delay: (linha + coluna) * 0.025 * k, ease: ease(CURVA.out) }}
              onMouseEnter={() => setSobre(n)}
              aria-label={`Página ${n}: ${lida ? `${pontos} pontos` : "ainda não lida"}`}
            />
          );
        })}
      </div>
      <div className="gr-mapa-rodape">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={sobre ?? "legenda"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur("feedback") }}>
            {sobre === null ? (
              legenda !== undefined ? (
                legenda
              ) : (
                <>
                  Tom da página = pontos marcados nela. <span className="gr-mapa-escala" aria-hidden><i /><i /><i /><i /></span>
                </>
              )
            ) : (lidasEm ? lidasEm.includes(sobre) : sobre <= lidas) ? (
              <>
                <b>p. {sobre}</b>: {paginas[sobre - 1] === 0 ? "nenhum ponto" : `${paginas[sobre - 1]} ${paginas[sobre - 1] === 1 ? "ponto" : "pontos"}`}
              </>
            ) : (
              <>
                <b>p. {sobre}</b>: ainda não lida
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * FAIXA DE VEREDITO (threshold band). As três faixas do parecer lado a lado e
 * um losango que DESLIZA até onde o documento caiu. Serve ao Resultado: o
 * veredito lido como posição, não só como palavra.
 */
export function FaixaDeVeredito({
  posicao,
  faixas,
  valor,
}: {
  posicao: number;
  faixas: { rotulo: string; tom: "ok" | "decide" | "block"; ate: number }[];
  /** O que o marcador está medindo, escrito sob ele (como o "2.80s" do LCP). */
  valor?: ReactNode;
}) {
  const { mola } = useTempo();
  return (
    <div className="gr-faixa">
      <div className="gr-faixa-trilho">
        {faixas.map((f, i) => {
          // cada faixa começa onde a anterior terminou
          const de = i === 0 ? 0 : faixas[i - 1].ate;
          const ativa = posicao >= de && posicao <= f.ate;
          return (
            <span key={f.rotulo} className={`gr-faixa-seg gr-faixa-seg--${f.tom}${ativa ? " gr-faixa-seg--ativa" : ""}`} style={{ left: `${de}%`, width: `${f.ate - de}%` }}>
              <em>{f.rotulo}</em>
            </span>
          );
        })}
        <motion.i className="gr-losango" initial={{ left: "0%" }} animate={{ left: `${posicao}%` }} transition={mola("gentle")} />
        {valor !== undefined && (
          <motion.span className="gr-faixa-marcador" initial={{ left: "0%" }} animate={{ left: `${posicao}%` }} transition={mola("gentle")}>
            <i />
            <b>{valor}</b>
          </motion.span>
        )}
      </div>
    </div>
  );
}

export interface Coluna {
  /** Texto do rodapé quando o mouse está sobre a coluna. */
  rotulo: ReactNode;
  /** Rótulo do eixo; só as colunas marcadas mostram. */
  eixo?: string;
  valor: number;
  /** Parte do valor em tom claro (ex.: resolvidos dentro dos encontrados). */
  parte?: number;
}

/**
 * COLUNAS EM PÍLULA. Uma pílula por dia ou semana sobre o trilho com
 * textura; a parte (resolvidos) sobe por dentro do total em tom claro. A
 * última coluna é "agora" e ganha o violeta. Sem eixo Y: o número que importa
 * está escrito acima do gráfico, e o mouse lê cada coluna.
 */
export function ColunasEmPilula({
  colunas,
  altura = 112,
  compacto = false,
  padrao,
}: {
  colunas: Coluna[];
  altura?: number;
  compacto?: boolean;
  /** Rodapé quando o mouse não está sobre nenhuma coluna. */
  padrao?: ReactNode;
}) {
  const { dur, k } = useTempo();
  const [sobre, setSobre] = useState<number | null>(null);
  const maximo = Math.max(1, ...colunas.map((c) => c.valor));
  const pct = (v: number) => `${(v / maximo) * 100}%`;
  const crescer = (atraso: number) => ({ duration: dur("layout") * 1.6, delay: atraso, ease: ease(CURVA.out) });

  return (
    <div className={`gr-colunas${compacto ? " gr-colunas--compacto" : ""}`}>
      <div className={`gr-colunas-area${sobre !== null ? " gr-colunas--foco" : ""}`} style={{ height: altura }} onMouseLeave={() => setSobre(null)}>
        {colunas.map((c, i) => (
          <span
            key={i}
            className={`gr-coluna${i === colunas.length - 1 ? " gr-coluna--hoje" : ""}${sobre === i ? " gr-coluna--sobre" : ""}`}
            onMouseEnter={compacto ? undefined : () => setSobre(i)}
          >
            {c.valor > 0 && (
              <motion.i className="gr-coluna-total" style={{ height: pct(c.valor) }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={crescer(i * 0.012 * k)} />
            )}
            {!!c.parte && (
              <motion.i className="gr-coluna-parte" style={{ height: pct(c.parte) }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={crescer(0.12 * k + i * 0.012 * k)} />
            )}
          </span>
        ))}
      </div>
      {!compacto && (
        <>
          <div className="gr-colunas-eixo" aria-hidden>
            {colunas.map((c, i) => (
              <span key={i}>{c.eixo}</span>
            ))}
          </div>
          <div className="gr-mapa-rodape">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={sobre ?? "padrao"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur("feedback") }}>
                {sobre === null ? padrao : colunas[sobre]?.rotulo}
              </motion.span>
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

export interface DiaDeUso {
  data: Date;
  valor: number;
  /** Fora do período escolhido: fica apagado, mas o desenho não muda. */
  fora?: boolean;
}

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * MAPA DE ATIVIDADE (heatmap por dia). Semanas em colunas, segunda a
 * domingo nas linhas; o tom é quanto o Nexo trabalhou no dia. Trocar o
 * período não redesenha: apaga o que ficou de fora, para o olho não perder
 * o lugar.
 */
export function MapaDeAtividade({ dias, unidade }: { dias: DiaDeUso[]; unidade: [string, string] }) {
  const { dur, k } = useTempo();
  const [sobre, setSobre] = useState<number | null>(null);
  const maximo = Math.max(1, ...dias.map((d) => d.valor));
  // segunda = 0
  // as datas são lidas no relógio de Brasília (lib/fuso-de-brasilia), não no da máquina
  const partes = dias.map((d) => partesEmBrasilia(d.data));
  const deslocamento = dias.length ? (partes[0].diaDaSemana + 6) % 7 : 0;
  const semanas = Math.ceil((dias.length + deslocamento) / 7);
  const meses: { coluna: number; nome: string }[] = [];
  dias.forEach((_, i) => {
    if (partes[i].dia === 1 || i === 0) meses.push({ coluna: Math.floor((i + deslocamento) / 7), nome: MESES[partes[i].mes - 1] });
  });
  const ativos = dias.filter((d) => !d.fora && d.valor > 0).length;
  const d = sobre !== null ? dias[sobre] : null;
  const pd = sobre !== null ? partes[sobre] : null;
  const grade = { gridTemplateColumns: `repeat(${semanas}, minmax(0, 1fr))` };

  return (
    <div className="gr-atividade">
      <div className="gr-atividade-meses" style={grade} aria-hidden>
        {meses.map((m) => (
          <span key={m.nome} style={{ gridColumn: `${m.coluna + 1} / span 3` }}>
            {m.nome}
          </span>
        ))}
      </div>
      <div className="gr-atividade-grade" style={grade} onMouseLeave={() => setSobre(null)}>
        {dias.map((dia, i) => {
          const pos = i + deslocamento;
          const coluna = Math.floor(pos / 7);
          const linha = pos % 7;
          return (
            <motion.span
              key={i}
              className={`gr-dia${dia.valor > 0 ? " gr-dia--uso" : ""}${dia.fora ? " gr-dia--fora" : ""}${i === dias.length - 1 ? " gr-dia--hoje" : ""}`}
              style={{ gridColumn: coluna + 1, gridRow: linha + 1, ["--tom" as string]: dia.valor > 0 ? 0.2 + (dia.valor / maximo) * 0.7 : 0 }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: dia.fora ? 0.22 : 1, scale: 1 }}
              transition={{ duration: dur("enter"), delay: (coluna + linha) * 0.018 * k, ease: ease(CURVA.out) }}
              onMouseEnter={() => setSobre(i)}
            />
          );
        })}
      </div>
      <div className="gr-mapa-rodape">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={sobre ?? "padrao"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur("feedback") }}>
            {d ? (
              <>
                <b>
                  {pd && `${SEMANA[pd.diaDaSemana]}, ${pd.dia} ${MESES[pd.mes - 1]}`}
                </b>
                : {d.valor === 0 ? "sem uso" : `${d.valor} ${d.valor === 1 ? unidade[0] : unidade[1]}`}
              </>
            ) : (
              <>
                <span className="ds-num">{ativos}</span> dias com o Nexo em uso{" "}
                <span className="gr-mapa-escala" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * FICHAS. Uma pílula por unidade — para coisa que se conta nos dedos
 * (volumes exportados). Acima do teto, a última ficha diz quantas faltam.
 */
export function Fichas({ total, teto = 24 }: { total: number; teto?: number }) {
  const { dur, k } = useTempo();
  const mostradas = Math.min(total, teto);
  const resto = total - mostradas;
  return (
    <span className="gr-fichas" aria-hidden>
      {Array.from({ length: mostradas }, (_, i) => (
        <motion.i
          key={i}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: dur("enter"), delay: i * 0.025 * k, ease: ease(CURVA.out) }}
        />
      ))}
      {resto > 0 && <em>+{resto}</em>}
    </span>
  );
}

/**
 * LINHA ACUMULADA. O total correndo no tempo, desenhado como traço que se
 * escreve da esquerda para a direita; o ponto no fim é hoje. Para volume
 * que cresce sempre (folhas lidas): a inclinação mostra o ritmo.
 */
export function LinhaAcumulada({ valores, altura = 28 }: { valores: number[]; altura?: number }) {
  const { dur } = useTempo();
  const gradiente = useId();
  const L = 100;
  const acumulado: number[] = [];
  valores.reduce((a, v) => (acumulado.push(a + v), a + v), 0);
  const maximo = Math.max(1, acumulado[acumulado.length - 1] ?? 1);
  const pontos = acumulado.map((v, i) => [(i / Math.max(1, acumulado.length - 1)) * L, altura - 2 - (v / maximo) * (altura - 4)] as const);
  const linha = pontos.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${linha} L${L},${altura} L0,${altura} Z`;
  const fim = pontos[pontos.length - 1] ?? [L, 2];
  return (
    <span className="gr-acumulada" aria-hidden>
      <svg viewBox={`0 0 ${L} ${altura}`} preserveAspectRatio="none" style={{ height: altura }}>
        <defs>
          <linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={area} fill={`url(#${gradiente})`} className="gr-acumulada-area" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: dur("layout") * 2, delay: dur("layout") }} />
        <motion.path
          d={linha}
          className="gr-acumulada-linha"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: dur("layout") * 3, ease: ease(CURVA.out) }}
        />
      </svg>
      <motion.i
        className="gr-acumulada-ponto"
        style={{ top: `${(fim[1] / altura) * 100}%` }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: dur("enter"), delay: dur("layout") * 2.4 }}
      />
    </span>
  );
}

/**
 * BARRAS POR MÊS. Poucas categorias com nome embaixo — o mês que está em
 * foco em violeta, os outros em cinza, para comparar este mês com os
 * anteriores sem ler números.
 */
export function BarrasPorMes({ meses, atual, altura = 26 }: { meses: { rotulo: string; valor: number }[]; atual: number | null; altura?: number }) {
  const { dur, k } = useTempo();
  const maximo = Math.max(1, ...meses.map((m) => m.valor));
  return (
    <span className="gr-meses" aria-hidden>
      {meses.map((m, i) => (
        <span key={m.rotulo} className={`gr-mes${i === atual ? " gr-mes--atual" : ""}`}>
          <span className="gr-mes-trilho" style={{ height: altura }}>
            <motion.i
              style={{ height: `${Math.max(8, (m.valor / maximo) * 100)}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: dur("layout") * 1.6, delay: i * 0.05 * k, ease: ease(CURVA.out) }}
            />
          </span>
          <small>{m.rotulo}</small>
        </span>
      ))}
    </span>
  );
}

export interface LinhaDoFluxo {
  id: string;
  rotulo: string;
  valor: number;
  /** block: há bloqueio entre eles; texto: redação e gramática; neutro: o resto. */
  tom: "neutro" | "block" | "texto";
  /** Ainda recebendo achados: partículas correm pela linha. */
  vivo?: boolean;
}

/**
 * FLUXO POR TIPO (Signal Flow, da Matos UI). Uma linha por tipo de erro,
 * saindo do mesmo eixo; o traço anda até a contagem e um ponto marca onde
 * parou. Enquanto a etapa ainda pode achar mais, partículas correm pela
 * linha — o "está chegando" sem inventar número.
 */
export function FluxoPorTipo({ linhas, maximo }: { linhas: LinhaDoFluxo[]; maximo?: number }) {
  const { dur, k } = useTempo();
  const reduzido = useReducedMotion();
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [sobre, setSobre] = useState<string | null>(null);
  const teto = maximo ?? Math.max(1, ...linhas.map((l) => l.valor));

  useLayoutEffect(() => {
    const medir = () => setLargura(caixa.current?.clientWidth ?? 0);
    medir();
    const ro = new ResizeObserver(medir);
    if (caixa.current) ro.observe(caixa.current);
    return () => ro.disconnect();
  }, []);

  const A = 22; // altura de cada linha
  const onda = (x: number, fase: number) => A / 2 + 1.6 * Math.sin((x / Math.max(1, largura)) * Math.PI * 2 + fase);
  const caminho = (ate: number, fase: number) => {
    const pts: string[] = [];
    for (let x = 0; x <= ate; x += 6) pts.push(`${x.toFixed(1)},${onda(x, fase).toFixed(2)}`);
    pts.push(`${ate.toFixed(1)},${onda(ate, fase).toFixed(2)}`);
    return `M${pts.join(" L")}`;
  };

  return (
    <div className="gr-fluxo" onMouseLeave={() => setSobre(null)}>
      <div className="gr-fluxo-rotulos">
        {linhas.map((l) => (
          <span key={l.id} className={sobre && sobre !== l.id ? "gr-fluxo--fora" : undefined} onMouseEnter={() => setSobre(l.id)}>
            {l.rotulo}
          </span>
        ))}
      </div>
      <div ref={caixa} className="gr-fluxo-trilhos">
        {largura > 0 &&
          linhas.map((l, i) => {
            const fase = i * 1.3;
            const fim = Math.max(8, (l.valor / teto) * (largura - 34));
            const d = caminho(fim, fase);
            return (
              <svg
                key={l.id}
                className={`gr-fluxo-linha gr-fluxo-linha--${l.tom}${l.valor === 0 ? " gr-fluxo-linha--zero" : ""}${sobre && sobre !== l.id ? " gr-fluxo--fora" : ""}`}
                width={largura}
                height={A}
                onMouseEnter={() => setSobre(l.id)}
              >
                <path d={caminho(largura - 4, fase)} className="gr-fluxo-trilho" />
                {l.valor > 0 && (
                  <motion.path
                    d={d}
                    className="gr-fluxo-traco"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: dur("layout") * 2.4, delay: i * 0.06 * k, ease: ease(CURVA.out) }}
                  />
                )}
                {l.vivo && l.valor > 0 && !reduzido &&
                  [0, 0.5].map((atraso) => (
                    <circle key={atraso} r={1.6} className="gr-fluxo-particula">
                      <animateMotion dur={`${1.8 * k}s`} begin={`${atraso * 1.8 * k}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  ))}
                <circle cx={4} cy={onda(0, fase)} r={4} className="gr-fluxo-origem" />
                {l.valor > 0 && (
                  <motion.circle
                    cx={fim}
                    cy={onda(fim, fase)}
                    r={3}
                    className="gr-fluxo-ponta"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: dur("enter"), delay: dur("layout") * 2 + i * 0.06 * k }}
                  />
                )}
                <text x={Math.min(fim + 10, largura - 14)} y={A / 2 + 4} className="gr-fluxo-valor">
                  {l.valor}
                </text>
              </svg>
            );
          })}
      </div>
    </div>
  );
}

export interface GrupoDoMapa {
  id: string;
  rotulo: string;
  tom: "block" | "risco" | "decide" | "note" | "texto";
  itens: { id: string; rotulo: string; valor: number; tom?: "texto" }[];
  /** Os achados do nível, um a um: viram pílulas clicáveis (cheia = tratado). */
  achados?: { id: string; titulo: string; feito: boolean }[];
}

/**
 * MAPA EM BLOCOS (treemap, da Matos UI). A área de cada bloco é a parte dele
 * no total: primeiro o nível (bloqueia, decisão técnica, revisão de texto) em
 * colunas, depois os tipos de erro dentro de cada nível. O preenchimento é
 * radial, cinza com um fio da cor do nível; o mouse lê a porcentagem.
 */
export function MapaEmBlocos({ grupos, altura = 200 }: { grupos: GrupoDoMapa[]; altura?: number }) {
  const { dur, k } = useTempo();
  const [sobre, setSobre] = useState<string | null>(null);
  const cheios = grupos.map((g) => ({ ...g, itens: g.itens.filter((i) => i.valor > 0) })).filter((g) => g.itens.length);
  const total = cheios.reduce((s, g) => s + g.itens.reduce((a, i) => a + i.valor, 0), 0);
  const itemSobre = cheios.flatMap((g) => g.itens.map((i) => ({ ...i, grupo: g }))).find((i) => i.id === sobre);
  let ordem = 0;

  return (
    <div className="gr-blocos">
      <div className="gr-blocos-area" style={{ height: altura }} onMouseLeave={() => setSobre(null)}>
        {cheios.map((g) => {
          const soma = g.itens.reduce((a, i) => a + i.valor, 0);
          return (
            <div key={g.id} className={`gr-blocos-grupo gr-blocos-grupo--${g.tom}`} style={{ flexGrow: soma }}>
              {[...g.itens]
                .sort((a, b) => b.valor - a.valor)
                .map((i) => {
                  const n = ordem++;
                  return (
                    <motion.button
                      key={i.id}
                      type="button"
                      className={`gr-bloco${i.tom === "texto" ? " gr-bloco--texto" : ""}${sobre && sobre !== i.id ? " gr-bloco--fora" : ""}`}
                      style={{ flexGrow: i.valor }}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: dur("enter") * 1.4, delay: n * 0.05 * k, ease: ease(CURVA.out) }}
                      onMouseEnter={() => setSobre(i.id)}
                      onFocus={() => setSobre(i.id)}
                      aria-label={`${i.rotulo}: ${i.valor} de ${total}, ${g.rotulo}`}
                    >
                      <span className="gr-bloco-rotulo">{i.rotulo}</span>
                      <b className="gr-bloco-valor">{i.valor}</b>
                    </motion.button>
                  );
                })}
            </div>
          );
        })}
      </div>
      <div className="gr-blocos-legenda">
        {cheios.map((g) => (
          <span key={g.id} className={`gr-blocos-leg gr-blocos-leg--${g.tom}`}>
            <i /> {g.rotulo}
          </span>
        ))}
      </div>
      <div className="gr-mapa-rodape">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={sobre ?? "padrao"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur("feedback") }}>
            {itemSobre ? (
              <>
                <b>{itemSobre.rotulo}</b>: {itemSobre.valor} de {total}, <span className="ds-num">{Math.round((itemSobre.valor / total) * 100)}%</span> dos achados.{" "}
                {itemSobre.grupo.rotulo}.
              </>
            ) : (
              "A área de cada bloco é a parte dele nos achados. Passe o mouse para ler."
            )}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * COLUNAS POR NÍVEL (Allocation, da Matos UI). Uma coluna embutida por nível
 * de achado, com trilho de textura; o preenchimento sobe até a contagem, na
 * cor do nível. Coluna vazia continua lá, só o trilho: "nenhum" também é
 * informação.
 */
export function ColunasPorNivel({
  colunas,
  teto,
  altura = 132,
}: {
  colunas: { id: string; rotulo: string; valor: number; tom: "block" | "risco" | "decide" | "note" | "texto"; dica?: string }[];
  teto?: number;
  altura?: number;
}) {
  const { dur, k } = useTempo();
  const [sobre, setSobre] = useState<string | null>(null);
  const maximo = teto ?? Math.max(1, ...colunas.map((c) => c.valor));
  const total = colunas.reduce((s, c) => s + c.valor, 0);
  const c = colunas.find((x) => x.id === sobre);

  return (
    <div className="gr-nivel">
      <div className="gr-nivel-caixa" onMouseLeave={() => setSobre(null)}>
        {colunas.map((col, i) => (
          <button
            key={col.id}
            type="button"
            className={`gr-nivel-col gr-nivel-col--${col.tom}${sobre && sobre !== col.id ? " gr-nivel--fora" : ""}`}
            onMouseEnter={() => setSobre(col.id)}
            onFocus={() => setSobre(col.id)}
            aria-label={`${col.rotulo}: ${col.valor}`}
          >
            <span className="gr-nivel-trilho" style={{ height: altura }}>
              {col.valor > 0 && (
                <motion.i
                  style={{ height: `${Math.max(12, (col.valor / maximo) * 100)}%` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: dur("layout") * 1.8, delay: i * 0.07 * k, ease: ease(CURVA.out) }}
                >
                  <b>{col.valor}</b>
                </motion.i>
              )}
              {col.valor === 0 && <em>0</em>}
            </span>
            <small>{col.rotulo}</small>
          </button>
        ))}
      </div>
      <div className="gr-mapa-rodape">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={sobre ?? "padrao"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur("feedback") }}>
            {c ? (
              <>
                <b>{c.rotulo}</b>: {c.valor === 0 ? "nenhum até agora" : `${c.valor} de ${total}`}. {c.dica}
              </>
            ) : (
              "Uma coluna por nível. Passe o mouse para ler."
            )}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * NÍVEIS EM FAIXA. Uma faixa só, dividida pelo peso de cada nível — a
 * proporção num olhar —, e embaixo uma linha por nível: os tipos que o
 * compõem, a contagem e uma pílula por achado. O mouse numa linha acende o
 * trecho dela na faixa, e vice-versa.
 */
export function NiveisEmFaixa({
  niveis,
  semFaixa,
  onAbrir,
  onAbrirNivel,
}: {
  niveis: GrupoDoMapa[];
  semFaixa?: boolean;
  onAbrir?: (id: string) => void;
  /** O nome do nível vira botão: abre a lista só daquele nível (ex.: a fila da gramática). */
  onAbrirNivel?: (id: string) => void;
}) {
  const { dur, k } = useTempo();
  const [sobre, setSobre] = useState<string | null>(null);
  const soma = (g: GrupoDoMapa) => g.itens.reduce((a, i) => a + i.valor, 0);
  const total = niveis.reduce((s, g) => s + soma(g), 0);

  return (
    <div className="gr-niveis" onMouseLeave={() => setSobre(null)}>
      {!semFaixa && (
      <div className="gr-niveis-faixa" aria-hidden>
        {niveis
          .filter((g) => soma(g) > 0)
          .map((g, i) => (
            <motion.span
              key={g.id}
              className={`gr-niveis-seg gr-niveis--${g.tom}${sobre && sobre !== g.id ? " gr-niveis--fora" : ""}`}
              style={{ flexGrow: soma(g) }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: dur("layout") * 1.6, delay: i * 0.08 * k, ease: ease(CURVA.out) }}
              onMouseEnter={() => setSobre(g.id)}
            />
          ))}
      </div>
      )}
      <ul className="gr-niveis-linhas">
        {niveis.map((g, gi) => {
          const n = soma(g);
          const tipos = g.itens.filter((i) => i.valor > 0);
          return (
            <li
              key={g.id}
              className={`gr-niveis-linha gr-niveis--${g.tom}${sobre && sobre !== g.id ? " gr-niveis--fora" : ""}${n === 0 ? " gr-niveis--vazio" : ""}`}
              onMouseEnter={() => setSobre(g.id)}
            >
              <i className="gr-niveis-cor" />
              {onAbrirNivel && n > 0 ? (
                <button type="button" className="gr-niveis-texto gr-niveis-texto--botao" onClick={() => onAbrirNivel(g.id)} title={`Abrir só os de ${g.rotulo.toLowerCase()}`}>
                  <b>{g.rotulo}</b>
                  <small>{tipos.map((t) => `${t.rotulo} ${t.valor}`).join(", ")}</small>
                </button>
              ) : (
                <span className="gr-niveis-texto">
                  <b>{g.rotulo}</b>
                  <small>{tipos.length ? tipos.map((t) => `${t.rotulo} ${t.valor}`).join(", ") : "nenhum até agora"}</small>
                </span>
              )}
              <span className="gr-niveis-fichas" aria-hidden={!g.achados}>
                {g.achados?.map((a, i) => (
                  <motion.button
                    key={a.id}
                    type="button"
                    className={`gr-niveis-ficha${a.feito ? " gr-niveis-ficha--feita" : ""}`}
                    title={`${a.id}: ${a.titulo}${a.feito ? " (tratado)" : ""}`}
                    aria-label={`${a.id}: ${a.titulo}${a.feito ? ", tratado" : ", pendente"}`}
                    onClick={() => onAbrir?.(a.id)}
                    initial={{ opacity: 0, scaleY: 0.3 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: dur("enter"), delay: 0.2 + gi * 0.08 * k + i * 0.04 * k, ease: ease(CURVA.out) }}
                  />
                ))}
                {!g.achados && Array.from({ length: n }, (_, i) => (
                  <motion.i
                    key={i}
                    initial={{ opacity: 0, scaleY: 0.3 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: dur("enter"), delay: 0.2 + gi * 0.08 * k + i * 0.04 * k, ease: ease(CURVA.out) }}
                  />
                ))}
              </span>
              <span className="gr-niveis-conta">
                <b className="ds-num">{n}</b>
                {total > 0 && n > 0 && <small className="ds-num">{Math.round((n / total) * 100)}%</small>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
