"use client";

/**
 * Cena do Nexo Core — CORE (alma) + GLASS (vidro) + SHELL (wireframe técnico).
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
  hovered,
  reduced,
}: {
  state: AgentState;
  activity: number;
  hovered: boolean;
  reduced: boolean;
}) {
  const outerRef = useRef<THREE.Group>(null); // escala (hover)
  const spinRef = useRef<THREE.Group>(null); // rotação (vidro + wireframe)
  const surfaceRef = useRef<THREE.ShaderMaterial>(null);
  const coreRef = useRef<THREE.ShaderMaterial>(null);
  const hoverRef = useRef(0);
  const cur = useRef<OrbVisualParams>(paramsForState("idle"));
  const target = useRef<OrbVisualParams>(paramsForState(state, activity));

  useEffect(() => {
    target.current = paramsForState(state, activity);
  }, [state, activity]);

  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [state, activity, hovered, reduced, invalidate]);

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
    c.line = d(c.line, t.line + h * 0.12);
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

    if (outerRef.current) {
      outerRef.current.scale.setScalar(
        d(outerRef.current.scale.x, 1 + h * 0.03, 10),
      );
    }
    if (spinRef.current && !reduced) {
      spinRef.current.rotation.y += dt * c.spin;
    }
  });

  return (
    <group ref={outerRef}>
      {/* CORE — a "alma"/vortex, num plano DE FRENTE pra câmera (não gira). */}
      <mesh renderOrder={-1}>
        <planeGeometry args={[2.15, 2.15]} />
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
  );
}
