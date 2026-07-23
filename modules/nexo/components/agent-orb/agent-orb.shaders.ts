/**
 * GLSL do Nexo Core — inline (strings) porque o Turbopack não tem loader `.glsl`.
 * Linguagem: técnica/CAD, nada de neon/cyberpunk. Corpo escuro + aro Fresnel teal
 * discreto + facetas (derivadas de tela) + núcleo pulsante sutil + plano-scanner.
 */

// Simplex noise 3D (Ashima Arts / Stefan Gustavson) — displacement procedural.
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
`;

export const surfaceVertexShader = /* glsl */ `
uniform float uTime;
uniform float uDistort;
uniform float uJitter;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vNoise;

${SNOISE}

void main() {
  // Deformação orgânica muito lenta + jitter breve no erro (quebra de malha).
  float n = snoise(position * 1.7 + vec3(0.0, uTime * 0.14, uTime * 0.05));
  float j = uJitter * 0.5 * snoise(position * 6.0 + uTime * 4.0);
  vNoise = n;
  vec3 displaced = position + normal * (n * uDistort + j);
  vec4 wp = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const surfaceFragmentShader = /* glsl */ `
uniform vec3 uColor;    // corpo escuro
uniform vec3 uRimColor; // teal/luminoso
uniform float uRim;
uniform float uPulse;
uniform float uScan;
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vNoise;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);

  // Faceta técnica: normal por face via derivadas de tela (aspecto CAD/geodésico).
  vec3 faceN = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  float facet = clamp(dot(faceN, viewDir), 0.0, 1.0);

  // Corpo escuro com leve modelagem + tint teal mínimo pela deformação.
  vec3 body = uColor * (0.22 + 0.4 * facet);
  body += uRimColor * 0.05 * (vNoise * 0.5 + 0.5);

  // Núcleo: luminosidade central pulsante (mais forte no miolo, 1 - fresnel).
  float center = pow(max(dot(viewDir, vNormalW), 0.0), 2.0);
  body += uRimColor * uPulse * center * 0.14;

  // Fresnel (aro fino), nada excessivamente luminoso.
  float fres = pow(1.0 - max(dot(viewDir, vNormalW), 0.0), 3.0);
  vec3 rim = uRimColor * fres * uRim;

  // Scanner técnico: banda horizontal atravessando a esfera (leitura).
  float scanY = sin(uTime * 0.8) * 1.05;
  float band = smoothstep(0.07, 0.0, abs(vWorldPos.y - scanY));
  vec3 scan = uRimColor * band * uScan * 0.55;

  gl_FragColor = vec4(body + rim + scan, 1.0);
}
`;
