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
  reduced,
}: {
  state: AgentState;
  activity: number;
  fileCount: number;
  hovered: boolean;
  reduced: boolean;
}) {
  const outerRef = useRef<THREE.Group>(null); // escala (hover + drag)
  const spinRef = useRef<THREE.Group>(null); // rotação (vidro)
  const surfaceRef = useRef<THREE.ShaderMaterial>(null);
  const coreRef = useRef<THREE.ShaderMaterial>(null);
  const satRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const dragRef = useRef(0);
  const hoverRef = useRef(0);
  const cur = useRef<OrbVisualParams>(paramsForState("idle"));
  const target = useRef<OrbVisualParams>(paramsForState(state, activity));

  useEffect(() => {
    target.current = paramsForState(state, activity);
  }, [state, activity]);

  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [state, activity, fileCount, hovered, reduced, invalidate]);

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

    if (outerRef.current) {
      outerRef.current.scale.setScalar(
        d(outerRef.current.scale.x, 1 + h * 0.03 + dragRef.current * 0.05, 10),
      );
    }
    if (spinRef.current && !reduced) {
      spinRef.current.rotation.y += dt * c.spin;
    }

    // Satélites: pontos abstratos orbitando (nº = documentos no contexto).
    const count = Math.max(0, Math.min(MAX_SATS, Math.round(fileCount)));
    const tt = reduced ? 4.2 : time;
    for (let i = 0; i < MAX_SATS; i++) {
      const m = satRefs.current[i];
      if (!m) continue;
      m.visible = i < count;
      if (!m.visible) continue;
      const rad = 1.34 + 0.1 * Math.sin(i * 2.1);
      const speed = 0.16 + (i % 3) * 0.05;
      const ang = i * ((Math.PI * 2) / MAX_SATS) + tt * speed;
      const z = Math.sin(ang * 1.3) * rad * 0.22;
      m.position.set(
        Math.cos(ang) * rad,
        Math.sin(ang) * rad * 0.62 + Math.sin(tt * 0.6 + i) * 0.05,
        z,
      );
      // Oclusão por profundidade: esmaece quando passa ATRÁS do vidro (z < 0).
      (m.material as THREE.MeshBasicMaterial).opacity = z < 0 ? 0.28 : 0.9;
    }
  });

  return (
    <group ref={outerRef}>
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
          <meshBasicMaterial
            color={SOUL_TEAL_BRIGHT}
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
