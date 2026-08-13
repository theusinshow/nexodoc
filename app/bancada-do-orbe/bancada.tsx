"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";

import {
  AgentOrbScene,
  CORES_DO_ORBE,
  VIDRO_DO_ORBE,
  type CoresDoOrbe,
  type VidroDoOrbe,
} from "@/modules/nexo/components/agent-orb/AgentOrbScene";
import { cn } from "@/lib/utils";
import {
  AGENT_STATES,
  paramsForState,
  type AgentState,
  type OrbVisualParams,
} from "@/modules/nexo/components/agent-orb/agent-orb.types";

/*
 * A LISTA VEM DO TIPO, e não daqui.
 *
 * Era uma cópia escrita à mão, e ela já tinha divergido: oferecia `hover` e
 * `uploading` no seletor, dois estados que a máquina do agente nunca produz. A
 * bancada existe para afinar o que o produto mostra — mostrar o que ele não
 * mostra é pior do que não mostrar nada, porque se afina no vazio.
 */
const ESTADOS: readonly AgentState[] = AGENT_STATES;

const ROTULO_DA_COR: Record<keyof CoresDoOrbe, string> = {
  corpo: "Vidro (tinta escura)",
  aro: "Aro do vidro",
  almaProfunda: "Alma — teal profundo",
  miolo: "Miolo luminoso",
  almaClara: "Alma — teal claro",
  laminaClara: "Lâmina clara (2ª camada)",
};

/** Faixa de cada parâmetro. O passo é fino: o orbe muda de caráter em 0,05. */
const FAIXA: Record<keyof OrbVisualParams, [number, number]> = {
  distortion: [0, 0.4],
  pulse: [0, 1.2],
  rim: [0, 1.6],
  scan: [0, 1],
  spin: [0, 1],
  jitter: [0, 0.6],
};

const ROTULO_DO_PARAMETRO: Record<keyof OrbVisualParams, string> = {
  distortion: "Deformação da borda",
  pulse: "Pulso do miolo",
  rim: "Força do aro",
  scan: "Plano de leitura",
  spin: "Rotação",
  jitter: "Instabilidade",
};

/* Fundos de prova. Um logo só está pronto quando sobrevive aos três — e o
   branco é onde um orbe luminoso costuma desaparecer. */
const FUNDOS = [
  { nome: "app", cor: "#0a0e11" },
  { nome: "preto", cor: "#000000" },
  { nome: "branco", cor: "#ffffff" },
  { nome: "papel", cor: "#e8e4dc" },
];

export function BancadaDoOrbe() {
  const [cores, setCores] = useState<CoresDoOrbe>({ ...CORES_DO_ORBE });
  const [vidro, setVidro] = useState<VidroDoOrbe>({ ...VIDRO_DO_ORBE });
  const [estado, setEstado] = useState<AgentState>("analyzing");
  const [atividade, setAtividade] = useState(0.7);
  const [manual, setManual] = useState(false);
  const [ajuste, setAjuste] = useState<OrbVisualParams>(
    paramsForState("analyzing", 0.7),
  );
  const [fundo, setFundo] = useState(FUNDOS[0].cor);
  const [lado, setLado] = useState(420);
  const [copiado, setCopiado] = useState(false);
  const palco = useRef<HTMLDivElement>(null);

  const doEstado = useMemo(
    () => paramsForState(estado, atividade),
    [estado, atividade],
  );
  const emUso = manual ? ajuste : doEstado;

  /*
   * `cores` e `ajuste` viram props da cena, e lá dentro são dependência de
   * efeito. Objeto novo a cada render faria o efeito rodar sem parar — então os
   * dois são memoizados pelo CONTEÚDO, com a serialização como chave. Listar
   * campo por campo daria o mesmo, mas envelhece mal: campo novo esquecido vira
   * controle que não mexe em nada.
   */
  const chaveDasCores = JSON.stringify(cores);
  const coresProp = useMemo(
    () => JSON.parse(chaveDasCores) as CoresDoOrbe,
    [chaveDasCores],
  );

  const chaveDoVidro = JSON.stringify(vidro);
  const vidroProp = useMemo(
    () => JSON.parse(chaveDoVidro) as VidroDoOrbe,
    [chaveDoVidro],
  );

  const chaveDoAjuste = manual ? JSON.stringify(ajuste) : "";
  const ajusteProp = useMemo(
    () => (chaveDoAjuste ? (JSON.parse(chaveDoAjuste) as OrbVisualParams) : undefined),
    [chaveDoAjuste],
  );

  const copiar = useCallback(() => {
    const linhas = (Object.keys(ROTULO_DA_COR) as (keyof CoresDoOrbe)[])
      .map((k) => `  ${k}: "${cores[k]}",`)
      .join("\n");

    const texto =
      `// modules/nexo/components/agent-orb/AgentOrbScene.tsx\n` +
      `export const CORES_DO_ORBE: CoresDoOrbe = {\n${linhas}\n};\n\n` +
      `export const VIDRO_DO_ORBE: VidroDoOrbe = {\n` +
      `  esfera: ${vidro.esfera},\n` +
      `  brilho: ${vidro.brilho},\n` +
      `  espessura: ${vidro.espessura},\n` +
      `  ondaDaAlma: ${vidro.ondaDaAlma},\n` +
      `  translucidez: ${vidro.translucidez},\n};\n\n` +
      (manual
        ? `// Parâmetros afinados na bancada (estado "${estado}"):\n` +
          `// ${JSON.stringify(emUso)}\n` +
          `// Para virar padrão, ajuste o caso "${estado}" em paramsForState().\n`
        : "");

    void navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }, [cores, vidro, manual, estado, emUso]);

  const salvarPng = useCallback(() => {
    const canvas = palco.current?.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const a = document.createElement("a");
    a.download = `orbe-${estado}-${lado}px.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }, [estado, lado]);

  return (
    <main className="min-h-dvh bg-background p-8 text-foreground">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">Bancada do orbe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Só em desenvolvimento. Mexa, olhe, e quando gostar copie os valores.
        </p>
      </header>

      <div className="flex flex-wrap items-start gap-8">
        {/* ------------------------------------------------------ o orbe */}
        <div className="shrink-0">
          <div
            ref={palco}
            style={{ width: lado, height: lado, background: fundo }}
            className="rounded-md border"
          >
            <Canvas
              dpr={[1, 2]}
              gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
              camera={{ position: [0, 0, 4.25], fov: 42 }}
              style={{ width: "100%", height: "100%" }}
            >
              <AgentOrbScene
                state={estado}
                activity={atividade}
                fileCount={0}
                hovered={false}
                pressed={false}
                reduced={false}
                cores={coresProp}
                vidro={vidroProp}
                ajuste={ajusteProp}
              />
            </Canvas>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {FUNDOS.map((f) => (
              <button
                key={f.nome}
                type="button"
                onClick={() => setFundo(f.cor)}
                className={`rounded border px-2.5 py-1 font-mono text-xs ${
                  fundo === f.cor ? "border-primary text-primary" : "text-muted-foreground"
                }`}
              >
                {f.nome}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
              tamanho
              <input
                type="range"
                min={96}
                max={720}
                step={4}
                value={lado}
                onChange={(e) => setLado(Number(e.target.value))}
              />
              <span className="tabular-nums">{lado}px</span>
            </label>
          </div>

          {/* Três tamanhos de verdade, sempre visíveis. É onde o orbe vira
              lama — e onde a decisão de marca realmente se prova. */}
          <div className="mt-4 flex items-end gap-4 rounded-md border p-3">
            {[64, 32, 16].map((px) => (
              <div key={px} className="text-center">
                <div style={{ width: px, height: px, background: fundo }}>
                  <Canvas
                    dpr={[1, 2]}
                    gl={{ alpha: true, antialias: true }}
                    camera={{ position: [0, 0, 4.25], fov: 42 }}
                    style={{ width: "100%", height: "100%" }}
                  >
                    <AgentOrbScene
                      state={estado}
                      activity={atividade}
                      fileCount={0}
                      hovered={false}
                      pressed={false}
                      reduced={false}
                      cores={coresProp}
                      vidro={vidroProp}
                      ajuste={ajusteProp}
                    />
                  </Canvas>
                </div>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                  {px}
                </span>
              </div>
            ))}
            <p className="max-w-[220px] text-xs leading-5 text-muted-foreground">
              O tamanho pequeno é o juiz: é aqui que gradiente fino vira borrão.
            </p>
          </div>
        </div>

        {/* --------------------------------------------------- controles */}
        <div className="w-[380px] space-y-6">
          <section>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Cores
            </h2>
            <div className="space-y-2">
              {(Object.keys(ROTULO_DA_COR) as (keyof CoresDoOrbe)[]).map((k) => (
                <label key={k} className="flex items-center gap-3 text-sm">
                  <input
                    type="color"
                    value={cores[k]}
                    onChange={(e) =>
                      setCores((c) => ({ ...c, [k]: e.target.value }))
                    }
                    className="h-7 w-10 cursor-pointer rounded border bg-transparent"
                  />
                  <span className="w-[190px]">{ROTULO_DA_COR[k]}</span>
                  <code className="font-mono text-xs text-muted-foreground">
                    {cores[k]}
                  </code>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              O vidro
            </h2>
            <p className="mb-3 text-xs leading-5 text-muted-foreground">
              A casca deixou de compartilhar a ondulação da alma. Em 1, ela é uma
              esfera limpa e o movimento fica todo dentro — que é o que separa
              &ldquo;bolha viva&rdquo; de &ldquo;batata&rdquo; em tamanho de marca.
              Puxe para 0 para ver como era.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <span className="w-[150px] text-muted-foreground">Esfera perfeita</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={vidro.esfera}
                onChange={(e) =>
                  setVidro((v) => ({ ...v, esfera: Number(e.target.value) }))
                }
                className="flex-1"
              />
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {vidro.esfera.toFixed(2)}
              </span>
            </label>
            {(
              [
                ["brilho", "Reflexo", 2],
                ["espessura", "Espessura da parede", 1],
                ["ondaDaAlma", "Borda irregular da alma", 0.2],
                ["translucidez", "Translucidez", 1],
              ] as const
            ).map(([chave, rotulo, max]) => (
              <label key={chave} className="mt-2 flex items-center gap-2 text-sm">
                <span className="w-[150px] text-muted-foreground">{rotulo}</span>
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={0.01}
                  value={vidro[chave]}
                  onChange={(e) =>
                    setVidro((v) => ({ ...v, [chave]: Number(e.target.value) }))
                  }
                  className="flex-1"
                />
                <span className="w-10 text-right font-mono text-xs tabular-nums">
                  {vidro[chave].toFixed(2)}
                </span>
              </label>
            ))}
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              A <strong>espessura</strong> nasce de duas bordas com um vão escuro
              entre elas — é o vão que o olho lê como material. Engrossar o aro
              sozinho dá aro grosso, não parede. A <strong>borda irregular</strong>{" "}
              é a ondulação que a casca tinha antes, devolvida à alma.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Estado
            </h2>
            <select
              value={estado}
              onChange={(e) => {
                const novo = e.target.value as AgentState;
                setEstado(novo);
                setAjuste(paramsForState(novo, atividade));
              }}
              className="w-full rounded border bg-card px-2 py-1.5 text-sm"
            >
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <span className="w-[110px] text-muted-foreground">atividade</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={atividade}
                onChange={(e) => setAtividade(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {atividade.toFixed(2)}
              </span>
            </label>
          </section>

          <section>
            <label className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <input
                type="checkbox"
                checked={manual}
                onChange={(e) => setManual(e.target.checked)}
              />
              Parâmetros à mão
            </label>
            <p className="mb-3 text-xs leading-5 text-muted-foreground">
              Desmarcado, os valores vêm do estado acima e os controles são só
              leitura — mexer neles seria ilusão, porque a cena reescreve tudo a
              cada quadro.
            </p>
            <div className="space-y-2">
              {(Object.keys(FAIXA) as (keyof OrbVisualParams)[]).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <span className="w-[150px] text-muted-foreground">
                    {ROTULO_DO_PARAMETRO[k]}
                  </span>
                  <input
                    type="range"
                    min={FAIXA[k][0]}
                    max={FAIXA[k][1]}
                    step={0.01}
                    value={emUso[k]}
                    disabled={!manual}
                    onChange={(e) =>
                      setAjuste((p) => ({ ...p, [k]: Number(e.target.value) }))
                    }
                    className="flex-1 disabled:opacity-40"
                  />
                  <span className="w-10 text-right font-mono text-xs tabular-nums">
                    {emUso[k].toFixed(2)}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <button
              type="button"
              onClick={copiar}
              className="rounded border border-primary px-3 py-1.5 text-sm text-primary"
            >
              {copiado ? "copiado" : "Copiar valores"}
            </button>
            <button
              type="button"
              onClick={salvarPng}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Salvar PNG
            </button>
            <button
              type="button"
              onClick={() => {
                setCores({ ...CORES_DO_ORBE });
                setVidro({ ...VIDRO_DO_ORBE });
                setManual(false);
                setAjuste(paramsForState(estado, atividade));
              }}
              className="rounded border px-3 py-1.5 text-sm text-muted-foreground"
            >
              Voltar ao original
            </button>
          </div>
        </div>
      </div>

    </main>
  );
}
