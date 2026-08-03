"use client";

/**
 * Cena do Nexo Core — CORE (alma/vortex) + GLASS (vidro) + satélites/anel de drop.
 * ÚNICO ponto com `useFrame`; animação por mutação direta de uniforms/transform
 * via REFS (zero re-render; ok pro React Compiler). Params fazem damping do atual
 * → alvo (o alvo vem do estado do agente). Sem luzes: shaders auto-iluminados.
 */

import { useEffect, useRef } from "react";
import {
  extend,
  useFrame,
  useThree,
  type ThreeElement,
} from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";

import {
  surfaceVertexShader,
  surfaceFragmentShader,
  coreVertexShader,
  coreFragmentShader,
} from "./agent-orb.shaders";
import {
  paramsForState,
  type AgentState,
  type OrbVisualParams,
} from "./agent-orb.types";

// Identidade NexoDoc: TUDO teal (forma estilo Siri, mas monocromático teal →
// luminoso, sem arco-íris). O miolo é branco-teal; as lâminas variam de teal
// profundo (--primary) a teal claro (--ring), dando profundidade sem sair da marca.
const BODY_COLOR = "#0c1518";
const RIM_COLOR = "#5bdac6";
const SOUL_TEAL = "#00a693"; // --primary (teal profundo)
const SOUL_LUMINOUS = "#eafffb"; // miolo branco-teal
const SOUL_TEAL_BRIGHT = "#5bdac6"; // --ring (teal claro)
const SOUL_TEAL_LIGHT = "#bff3ea"; // teal quase branco (2ª camada)

// Satélites: máximo visual razoável (documentos no contexto viram pontos abstratos).
const MAX_SATS = 6;

// Vidro externo (Fresnel + deslocamento leve).
const OrbSurfaceMaterial = shaderMaterial(
  {
    uTime: 0,
    uDistort: 0.05,
    uJitter: 0,
    uColor: new THREE.Color(BODY_COLOR),
    uRimColor: new THREE.Color(RIM_COLOR),
    uRim: 0.6,
    uScan: 0,
  },
  surfaceVertexShader,
  surfaceFragmentShader,
);
extend({ OrbSurfaceMaterial });

// Alma interna (FBM fluido, aditivo).
const OrbCoreMaterial = shaderMaterial(
  {
    uTime: 0,
    uActivity: 0,
    uPulse: 0.5,
    uColorA: new THREE.Color(SOUL_TEAL),
    uColorB: new THREE.Color(SOUL_LUMINOUS),
    uColorC: new THREE.Color(SOUL_TEAL_BRIGHT),
    uColorD: new THREE.Color(SOUL_TEAL_LIGHT),
  },
  coreVertexShader,
  coreFragmentShader,
);
extend({ OrbCoreMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    orbSurfaceMaterial: ThreeElement<typeof OrbSurfaceMaterial>;
    orbCoreMaterial: ThreeElement<typeof OrbCoreMaterial>;
  }
}

export function AgentOrbScene({
  state,
  activity,
  fileCount,
  hovered,
  pressed,
  reduced,
}: {
  state: AgentState;
  activity: number;
  fileCount: number;
  hovered: boolean;
  /** Botão do mouse pressionado sobre o orbe — reconhecimento do toque. */
  pressed: boolean;
  reduced: boolean;
}) {
  const outerRef = useRef<THREE.Group>(null); // escala (hover + drag + press)
  const tiltRef = useRef<THREE.Group>(null); // inclinação que segue o ponteiro
  const spinRef = useRef<THREE.Group>(null); // rotação (vidro)
  const surfaceRef = useRef<THREE.ShaderMaterial>(null);
  const coreRef = useRef<THREE.ShaderMaterial>(null);
  const satRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const pulsoRef = useRef<THREE.Mesh>(null);
  const pulsoMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const dragRef = useRef(0);
  const hoverRef = useRef(0);
  const pressRef = useRef(0);
  /** Escala de cada satélite (0..1): eles NASCEM, não aparecem prontos. */
  const satScale = useRef<number[]>(Array.from({ length: MAX_SATS }, () => 0));
  /** Progresso do anel de conclusão (0 = parado; sobe até 1 e some). */
  const pulsoRef01 = useRef(0);
  /** Ponteiro relativo ao centro do orbe, em -1..1. Escrito no listener. */
  const aim = useRef({ x: 0, y: 0, perto: 0 });
  const cur = useRef<OrbVisualParams>(paramsForState("idle"));
  const target = useRef<OrbVisualParams>(paramsForState(state, activity));

  useEffect(() => {
    target.current = paramsForState(state, activity);
  }, [state, activity]);

  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    invalidate();
  }, [state, activity, fileCount, hovered, pressed, reduced, invalidate]);

  /*
   * O ORBE ACOMPANHA QUEM CHEGA PERTO.
   *
   * Sem isto ele é um vídeo: bonito e alheio. Uma inclinação de poucos graus na
   * direção do ponteiro é o que faz um objeto parecer ciente da sala — e o custo
   * é um listener passivo e dois números.
   *
   * O ponteiro é lido do WINDOW, não do canvas: o canvas é `pointerEvents:none`
   * de propósito (a hit-area é o container DOM), então o R3F nunca receberia
   * pointermove. `perto` cai com a distância, então o orbe ignora o mouse que
   * está do outro lado da tela — reagir a tudo seria decoração.
   */
  useEffect(() => {
    if (reduced) return;
    const el = gl.domElement;
    function onMove(e: PointerEvent) {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      const dist = Math.hypot(dx, dy);
      // 1 no centro, 0 a três raios de distância.
      aim.current.perto = Math.max(0, 1 - dist / 3);
      aim.current.x = Math.max(-1, Math.min(1, dx));
      aim.current.y = Math.max(-1, Math.min(1, dy));
      invalidate();
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [gl, reduced, invalidate]);

  /*
   * O PULSO DE CONCLUSÃO: um anel que nasce na silhueta e se abre para fora.
   *
   * `complete` já existia como estado, mas só subia o brilho por 1,2s — e brilho
   * a mais numa coisa que já brilha não marca momento nenhum. Um anel que sai do
   * corpo marca: é radial, é curto, e não se confunde com o respiro.
   */
  useEffect(() => {
    if (state !== "complete" || reduced) return;
    pulsoRef01.current = 0.0001;
    invalidate();
  }, [state, reduced, invalidate]);

  useFrame((s, delta) => {
    const surf = surfaceRef.current;
    const core = coreRef.current;
    if (!surf || !core) return;

    const t = target.current;
    const c = cur.current;
    const dt = Math.min(delta, 0.05);
    const d = (a: number, b: number, l = 6) =>
      reduced ? b : THREE.MathUtils.damp(a, b, l, dt);

    hoverRef.current = d(hoverRef.current, hovered ? 1 : 0, 8);
    const h = hoverRef.current;

    c.distortion = d(c.distortion, t.distortion + h * 0.015);
    c.pulse = d(c.pulse, t.pulse);
    c.rim = d(c.rim, t.rim + h * 0.18);
    c.scan = d(c.scan, t.scan);
    c.spin = d(c.spin, t.spin);
    c.jitter = d(c.jitter, t.jitter);

    const time = s.clock.elapsedTime;
    const breath = reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 1.5);

    // Vidro externo.
    const su = surf.uniforms;
    if (!reduced) su.uTime.value += dt;
    // Casca de vidro ondula bem menos que o valor de estado → borda limpa/inteira.
    su.uDistort.value = c.distortion * 0.35;
    su.uRim.value = c.rim;
    su.uScan.value = c.scan;
    su.uJitter.value = c.jitter;

    // Alma.
    const cu = core.uniforms;
    if (!reduced) cu.uTime.value += dt;
    cu.uActivity.value = Math.max(0, Math.min(1, activity));
    cu.uPulse.value = c.pulse * breath;

    // Drag: campo visual expande e o anel de drop-target aparece.
    dragRef.current = d(dragRef.current, state === "dragging" ? 1 : 0, 8);
    if (ringMatRef.current) ringMatRef.current.opacity = dragRef.current * 0.55;

    /*
     * PRESS: o orbe afunda ao ser tocado e volta ao soltar. É o reconhecimento
     * que faltava — antes o clique abria o cartão e a esfera não dava sinal
     * nenhum de ter sido tocada, o que faz qualquer interface parecer um vídeo.
     * Amortecimento mais alto na volta (18) que na ida (26): entra rápido, sai
     * com calma, que é a regra de sempre invertida de propósito para o toque.
     */
    pressRef.current = d(pressRef.current, pressed ? 1 : 0, pressed ? 26 : 18);

    if (outerRef.current) {
      outerRef.current.scale.setScalar(
        d(
          outerRef.current.scale.x,
          1 + h * 0.03 + dragRef.current * 0.05 - pressRef.current * 0.045,
          10,
        ),
      );
    }
    if (spinRef.current && !reduced) {
      spinRef.current.rotation.y += dt * c.spin;
    }

    /*
     * A inclinação em direção ao ponteiro. Amplitude pequena (±0,1 rad ≈ 6°) e
     * amortecida: é presença, não paralaxe de landing page. O `perto` faz o
     * efeito sumir quando o mouse está longe.
     */
    if (tiltRef.current) {
      const g = tiltRef.current.rotation;
      const forca = reduced ? 0 : aim.current.perto * (0.7 + h * 0.3);
      g.y = d(g.y, aim.current.x * 0.1 * forca, 5);
      g.x = d(g.x, aim.current.y * 0.08 * forca, 5);
    }

    /*
     * O anel de conclusão: 0 → 1 em ~900ms, raio cresce e opacidade cai. Some
     * sozinho (o progresso zera), então não deixa estado pendurado.
     */
    if (pulsoRef01.current > 0 && pulsoRef.current && pulsoMatRef.current) {
      pulsoRef01.current = Math.min(1, pulsoRef01.current + dt / 0.9);
      const p = pulsoRef01.current;
      // Desacelera saindo (ease-out): o anel dispara e assenta.
      const eased = 1 - Math.pow(1 - p, 3);
      pulsoRef.current.visible = true;
      // Teto 1,30 → raio 1,38, dentro do quadro (±1,42). Um anel que termina
      // fora da moldura vira quatro arcos nos cantos, que foi o que aconteceu.
      pulsoRef.current.scale.setScalar(0.92 + eased * 0.38);
      pulsoMatRef.current.opacity = (1 - eased) * 0.5;
      if (p >= 1) {
        pulsoRef01.current = 0;
        pulsoRef.current.visible = false;
      }
    } else if (pulsoRef.current) {
      pulsoRef.current.visible = false;
    }

    /*
     * SATÉLITES — cada ponto é um documento no contexto.
     *
     * Eles NASCEM e MORREM, em vez de aparecer prontos: antes o `visible` ligava
     * de um quadro para o outro, e a folha recém-lida entrava na órbita como se
     * sempre tivesse estado lá. A chegada é o feedback: o engenheiro vê a
     * leitura acontecendo sem ler número nenhum.
     *
     * A órbita também APERTA no hover (o agente se recolhe quando alguém chega
     * perto) e acelera com a atividade real.
     */
    const count = Math.max(0, Math.min(MAX_SATS, Math.round(fileCount)));
    const tt = reduced ? 4.2 : time;
    const ativ = Math.max(0, Math.min(1, activity));
    for (let i = 0; i < MAX_SATS; i++) {
      const m = satRefs.current[i];
      if (!m) continue;
      const alvo = i < count ? 1 : 0;
      // Nascer é mais lento que sumir: a chegada precisa ser vista, a saída não.
      satScale.current[i] = d(satScale.current[i], alvo, alvo === 1 ? 7 : 12);
      const s = satScale.current[i];
      m.visible = s > 0.02;
      if (!m.visible) continue;
      m.scale.setScalar(s);
      // 1,28 + 0,08 → no máximo 1,36, com folga para o quadro de ±1,42.
      const rad = (1.28 + 0.08 * Math.sin(i * 2.1)) * (1 - h * 0.05);
      const speed = (0.16 + (i % 3) * 0.05) * (1 + ativ * 0.5);
      const ang = i * ((Math.PI * 2) / MAX_SATS) + tt * speed;
      const z = Math.sin(ang * 1.3) * rad * 0.22;
      m.position.set(
        Math.cos(ang) * rad,
        Math.sin(ang) * rad * 0.62 + Math.sin(tt * 0.6 + i) * 0.05,
        z,
      );
      /*
       * Oclusão por profundidade (esmaece atrás do vidro) MULTIPLICADA pela
       * escala de nascimento — senão o ponto surgiria com a opacidade cheia
       * enquanto ainda é um grão, e a chegada viraria um piscar.
       */
      (m.material as THREE.MeshBasicMaterial).opacity = (z < 0 ? 0.34 : 1) * s;
    }
  });

  return (
    <group ref={outerRef}>
      {/* A inclinação em direção ao ponteiro envolve o corpo (alma + vidro), mas
          NÃO os anéis: eles são sinais de estado e devem ficar de frente. */}
      <group ref={tiltRef}>
        {/* CORE — a "alma"/vortex, num plano DE FRENTE pra câmera (não gira). */}
        <mesh renderOrder={-1}>
          <planeGeometry args={[2.0, 2.0]} />
          <orbCoreMaterial
            ref={coreRef}
            key={OrbCoreMaterial.key}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* GLASS — esfera de vidro lisa, escura translúcida + Fresnel teal + sheen.
            Gira devagar (profundidade) ao redor da alma. */}
        <group ref={spinRef}>
          <mesh renderOrder={0}>
            <sphereGeometry args={[1, 64, 48]} />
            <orbSurfaceMaterial
              ref={surfaceRef}
              key={OrbSurfaceMaterial.key}
              transparent
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      {/* DROP-TARGET — anel que aparece ao arrastar um documento sobre a esfera. */}
      <mesh renderOrder={2}>
        <ringGeometry args={[1.3, 1.42, 72]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={RIM_COLOR}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* PULSO DE CONCLUSÃO — anel que sai do corpo quando o turno termina.
          Fino e curto: marca o instante e desaparece, sem virar enfeite. */}
      <mesh ref={pulsoRef} renderOrder={2} visible={false}>
        <ringGeometry args={[1.02, 1.06, 72]} />
        <meshBasicMaterial
          ref={pulsoMatRef}
          color={RIM_COLOR}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* SATÉLITES — documentos no contexto como pontos orbitais abstratos. */}
      {Array.from({ length: MAX_SATS }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            satRefs.current[i] = el;
          }}
          visible={false}
          renderOrder={3}
        >
          <sphereGeometry args={[0.055, 16, 16]} />
          {/* Teal quase branco: com o `--ring` puro e mistura aditiva sobre o
              fundo preto os pontos liam como cinza — um documento no contexto
              não pode parecer poeira. */}
          <meshBasicMaterial
            color={SOUL_TEAL_LIGHT}
            transparent
            opacity={0.9}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
