/**
 * GLSL do Nexo Core — inline (strings) porque o Turbopack não tem loader `.glsl`.
 *
 * Camadas (ref. esfera de vidro com "alma" fluida, à la Siri, mas na identidade
 * NexoDoc — teal/luminoso, nada de arco-íris):
 *  - CORE  : alma/vortex (lâminas curvas + FBM) luminosa, aditiva.
 *  - GLASS : esfera de vidro escura translúcida + Fresnel teal (a alma brilha através).
 */

// Simplex noise 3D (Ashima Arts / Stefan Gustavson).
const SNOISE = /* glsl */ `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * snoise(p); p *= 2.0; a *= 0.5; }
  return v;
}
`;

/* ---------------------------------------------------------------- GLASS ---- */

export const surfaceVertexShader = /* glsl */ `
uniform float uTime;
uniform float uDistort;
uniform float uJitter;
varying vec3 vNormalW;
varying vec3 vWorldPos;

${SNOISE}

void main() {
  // Ondulação de vidro muito leve + jitter breve no erro.
  float n = snoise(position * 1.7 + vec3(0.0, uTime * 0.12, uTime * 0.04));
  float j = uJitter * 0.4 * snoise(position * 6.0 + uTime * 4.0);
  vec3 displaced = position + normal * (n * uDistort + j);
  vec4 wp = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const surfaceFragmentShader = /* glsl */ `
uniform vec3 uColor;    // tinta de vidro (escura)
uniform vec3 uRimColor; // teal/luminoso
uniform float uRim;
uniform float uScan;
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float ndv = max(dot(viewDir, vNormalW), 0.0);

  // Fresnel amplo (corpo do vidro).
  float fres = pow(1.0 - ndv, 2.2);
  vec3 rim = uRimColor * fres * uRim;

  // Aro DEFINIDO na silhueta — o contorno "inteiro" da bola de vidro.
  // Expoente menor = anel mais ESPESSO.
  float edgeRing = pow(1.0 - ndv, 4.5);
  vec3 edge = mix(uRimColor, vec3(1.0), 0.35) * edgeRing;

  // Sheen — reflexo suave de vidro pegando luz do alto-esquerda (glass feel).
  vec3 lightDir = normalize(vec3(-0.55, 0.8, 0.5));
  float sheen = pow(max(dot(vNormalW, lightDir), 0.0), 5.0);
  vec3 glint = mix(uRimColor, vec3(1.0), 0.55) * sheen * 0.4;

  // Corpo de vidro escuro translúcido (leve, pra a esfera ler INTEIRA).
  vec3 body = uColor * 0.18;

  /*
   * Scanner técnico (leitura): banda horizontal atravessando o vidro.
   *
   * É o único sinal de que o Nexo está LENDO as pranchas, e ele quase não
   * aparecia: uma banda de 0.06 a meia intensidade some no brilho do próprio
   * vidro. Mais larga, mais forte e um pouco mais lenta — a passagem tem de ser
   * vista de relance, sem que se precise procurar por ela. O núcleo mais
   * quente dentro da banda larga é o que dá a leitura de "linha", em vez de
   * virar um borrão que pulsa.
   */
  float scanY = sin(uTime * 0.55) * 1.05;
  float dist = abs(vWorldPos.y - scanY);
  float band = smoothstep(0.16, 0.0, dist);
  float nucleo = smoothstep(0.045, 0.0, dist);
  vec3 scan = uRimColor * (band * 0.75 + nucleo * 0.85) * uScan;

  float alpha = 0.14 + fres * 0.55 + edgeRing * 0.85 + sheen * 0.28
    + (band * 0.45 + nucleo * 0.5) * uScan;
  gl_FragColor = vec4(body + rim + edge + glint + scan, alpha);
}
`;

/* ----------------------------------------------------------------- CORE ---- */

export const coreVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * "Alma" forma Siri, COR mono-teal (identidade NexoDoc): lâminas/ribbons CURVAS
 * (pinwheel ~5 pontas) saindo de um miolo branco brilhante, gradiente teal →
 * teal-claro → branco. Duas camadas contra-rotativas defasadas dão o overlap
 * sedoso. Braços DEFINIDOS (gaps escuros) p/ não virar massa luminosa. Warp de
 * noise sutil = fluxo orgânico.
 */
export const coreFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uActivity;
uniform float uPulse;
uniform vec3 uColorA; // teal profundo
uniform vec3 uColorB; // branco luminoso (miolo)
uniform vec3 uColorC; // teal claro
uniform vec3 uColorD; // teal quase branco (2a camada)
varying vec2 vUv;

${SNOISE}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0; // -1..1
  float t = uTime * (0.5 + uActivity * 0.4);

  // Warp orgânico sutil (fluxo sedoso, sem grão de fumaça).
  vec2 warp = vec2(
    snoise(vec3(uv * 0.9, t * 0.25)),
    snoise(vec3(uv * 0.9 + 5.0, t * 0.25))
  ) * 0.16;
  vec2 q = uv + warp;
  float r = length(q);
  float ang = atan(q.y, q.x);

  // Camada 1 — braços curvos (o twist +k*r encurva em pinwheel).
  float a1 = ang + 2.1 * r + t * 0.55;
  float blade1 = pow(max(cos(a1 * 2.5), 0.0), 2.2); // ~5 lâminas

  // Camada 2 — contramão, defasada (overlap sedoso).
  float a2 = ang - 2.6 * r - t * 0.45 + 1.3;
  float blade2 = pow(max(cos(a2 * 2.0), 0.0), 2.6); // ~4 lâminas

  // Envelope radial: some ANTES da borda (0.92) → o glow fica CONTIDO no vidro.
  float env = smoothstep(0.92, 0.3, r);
  blade1 *= env;
  blade2 *= env;

  // Miolo branco brilhante (pequeno e definido).
  float core = smoothstep(0.34, 0.0, r);
  float coreGlow = pow(core, 1.5) * (0.8 + 0.2 * uPulse);

  // Cor mono-teal: lâmina 1 teal→teal-claro pra fora; lâmina 2 teal-branco; miolo branco.
  vec3 c1 = mix(uColorA, uColorC, smoothstep(0.15, 0.9, r));
  vec3 col = c1 * blade1 + uColorD * blade2 * 0.85 + uColorB * coreGlow;

  float mask = smoothstep(0.95, 0.78, r);
  float alpha = clamp(blade1 + blade2 * 0.85 + coreGlow, 0.0, 1.0) * mask;
  gl_FragColor = vec4(col, alpha * (0.92 + uActivity * 0.08));
}
`;
