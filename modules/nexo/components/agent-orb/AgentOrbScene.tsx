"use client";

/**
 * Cena do Nexo Core — compõe SURFACE + SHELL e é o ÚNICO ponto com `useFrame`.
 * Toda animação é mutação direta de uniforms/transform via REFS dentro do frame
 * (zero re-render React; satisfaz as regras do React Compiler). Os parâmetros
 * fazem damping do atual → alvo (o alvo vem do estado do agente). Sem luzes: o
 * shader é auto-iluminado (perf).
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
} from "./agent-orb.shaders";
import {
  paramsForState,
  type AgentState,
  type OrbVisualParams,
} from "./agent-orb.types";

// Tokens do NexoDoc (estáveis): corpo escuro + teal luminoso (--ring). Sem cor nova.
const BODY_COLOR = "#0c1518";
const RIM_COLOR = "#5bdac6";

// Material declarativo (drei) — uniforms viram propriedades; mutamos via ref.
const OrbSurfaceMaterial = shaderMaterial(
  {
    uTime: 0,
    uDistort: 0.06,
    uJitter: 0,
    uColor: new THREE.Color(BODY_COLOR),
    uRimColor: new THREE.Color(RIM_COLOR),
    uRim: 0.52,
    uPulse: 0.16,
    uScan: 0,
  },
  surfaceVertexShader,
  surfaceFragmentShader,
);
extend({ OrbSurfaceMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    orbSurfaceMaterial: ThreeElement<typeof OrbSurfaceMaterial>;
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
  const groupRef = useRef<THREE.Group>(null);
  const surfaceRef = useRef<THREE.ShaderMaterial>(null);
  const shellRef = useRef<THREE.MeshBasicMaterial>(null);
  const hoverRef = useRef(0);
  const cur = useRef<OrbVisualParams>(paramsForState("idle"));
  const target = useRef<OrbVisualParams>(paramsForState(state, activity));

  // Alvo muda só quando o estado/atividade mudam (não por frame).
  useEffect(() => {
    target.current = paramsForState(state, activity);
  }, [state, activity]);

  // Em reduced-motion / demand: força um render quando algo muda.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [state, activity, hovered, reduced, invalidate]);

  useFrame((s, delta) => {
    const mat = surfaceRef.current;
    const shell = shellRef.current;
    const g = groupRef.current;
    if (!mat) return;

    const t = target.current;
    const c = cur.current;
    const dt = Math.min(delta, 0.05);
    const d = (a: number, b: number, l = 6) =>
      reduced ? b : THREE.MathUtils.damp(a, b, l, dt);

    hoverRef.current = d(hoverRef.current, hovered ? 1 : 0, 8);
    const h = hoverRef.current;

    c.distortion = d(c.distortion, t.distortion + h * 0.02);
    c.pulse = d(c.pulse, t.pulse);
    c.rim = d(c.rim, t.rim + h * 0.15);
    c.line = d(c.line, t.line + h * 0.12);
    c.scan = d(c.scan, t.scan);
    c.spin = d(c.spin, t.spin);
    c.jitter = d(c.jitter, t.jitter);

    const u = mat.uniforms;
    if (!reduced) u.uTime.value += dt;
    u.uDistort.value = c.distortion;
    const breath = reduced ? 1 : 0.85 + 0.15 * Math.sin(s.clock.elapsedTime * 1.5);
    u.uPulse.value = c.pulse * breath;
    u.uRim.value = c.rim;
    u.uScan.value = c.scan;
    u.uJitter.value = c.jitter;
    if (shell) shell.opacity = c.line;

    if (g) {
      if (!reduced) g.rotation.y += dt * c.spin;
      g.scale.setScalar(d(g.scale.x, 1 + h * 0.03, 10));
    }
  });

  return (
    <group ref={groupRef}>
      {/* SURFACE — icosaedro geodésico + shader procedural (detail 4 ≈ 5k tris). */}
      <mesh>
        <icosahedronGeometry args={[1, 4]} />
        <orbSurfaceMaterial ref={surfaceRef} key={OrbSurfaceMaterial.key} />
      </mesh>
      {/* TECHNICAL SHELL — wireframe fino, discreto (detail 2 = triângulos grandes). */}
      <mesh>
        <icosahedronGeometry args={[1.16, 2]} />
        <meshBasicMaterial
          ref={shellRef}
          color={RIM_COLOR}
          wireframe
          transparent
          opacity={0.26}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
