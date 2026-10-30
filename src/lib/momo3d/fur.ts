import * as THREE from 'three'

// Shell fur: the same mesh is drawn N times, each copy pushed a little further
// out along its normals. Each copy keeps only the strands that are long enough
// to reach it, so the copies stack up into soft fur. One draw call per part
// (an instanced mesh, where gl_InstanceID is the shell number).

export interface FurOptions {
  shells: number
  length: number
  /** Strands per unit of the mesh. */
  density: number
  /** Size of the tufts. Higher gives smaller tufts. */
  clump: number
  root: THREE.ColorRepresentation
  tip: THREE.ColorRepresentation
  /** The colour toward the bottom of the part, between belly[0] and belly[1] in mesh y. */
  belly?: { color: THREE.ColorRepresentation; from: number; to: number }
}

export interface Fur {
  mesh: THREE.InstancedMesh
  /** Gravity plus lag, in the part's own space. The fur bends this way at the tips. */
  pull: THREE.Vector3
  /** Up to 4 bare spots (unit direction from the mesh centre, cosine of the angular radius). */
  clear: THREE.Vector4[]
}

const vertex = /* glsl */ `
uniform float uShells;
uniform float uLength;
uniform vec3 uPull;
varying vec3 vBase;
varying vec3 vNormal;
varying vec3 vView;
varying float vH;
void main() {
  float h = uShells > 1.0 ? float(gl_InstanceID) / (uShells - 1.0) : 0.0;
  vec3 p = position + normal * uLength * h + uPull * uLength * h * h;
  vH = h;
  vBase = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`

const fragment = /* glsl */ `
uniform float uDensity;
uniform float uClump;
uniform vec3 uRoot;
uniform vec3 uTip;
uniform vec3 uBelly;
uniform vec2 uBellyRange;
uniform vec3 uLight;
uniform vec4 uClear[4];
varying vec3 vBase;
varying vec3 vNormal;
varying vec3 vView;
varying float vH;

float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

void main() {
  float h = vH;
  float a = 1.0;
  if (h > 0.0) {
    // A turned grid with a random centre per strand, so no rings show.
    vec3 q = mat3(0.80, 0.36, -0.48, -0.53, 0.78, -0.33, 0.26, 0.51, 0.82) * vBase * uDensity;
    float len = mix(0.55, 1.0, hash(floor(q)));
    len *= mix(0.55, 1.0, vnoise(vBase * uClump));
    vec3 dir = normalize(vBase);
    for (int i = 0; i < 4; i++) {
      float d = dot(dir, uClear[i].xyz);
      len *= 1.0 - 0.85 * smoothstep(uClear[i].w - 0.006, uClear[i].w + 0.004, d);
    }
    // Each strand is thinner toward its tip.
    vec3 c = floor(q);
    vec3 centre = 0.3 + 0.4 * vec3(hash(c + 1.7), hash(c + 5.3), hash(c + 9.1));
    float d = length(fract(q) - centre);
    a = clamp((len - h) * 4.0, 0.0, 1.0) * smoothstep(0.08, 0.0, d - 0.72 * (1.0 - h / len));
    if (a < 0.02) discard;
  }
  vec3 base = mix(uBelly, uRoot, smoothstep(uBellyRange.x, uBellyRange.y, vBase.y));
  vec3 col = mix(base * 0.78, mix(base, uTip, 0.35), h);
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vView);
  float diff = clamp((dot(n, uLight) + 0.45) / 1.45, 0.0, 1.0);
  float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.5);
  col *= 0.64 + 0.5 * diff;
  col += uTip * rim * 0.22 * (0.3 + h);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`

/** The light, in view space: from the upper left, in front. */
const LIGHT = new THREE.Vector3(-0.45, 0.65, 0.62).normalize()

export function furry(geometry: THREE.BufferGeometry, o: FurOptions): Fur {
  const pull = new THREE.Vector3(0, -0.3, 0)
  const off = () => new THREE.Vector4(0, 0, 1, 2) // cosine 2: never matches
  const clear = [off(), off(), off(), off()]
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    alphaToCoverage: true,
    uniforms: {
      uShells: { value: o.shells },
      uLength: { value: o.length },
      uPull: { value: pull },
      uDensity: { value: o.density },
      uClump: { value: o.clump },
      uRoot: { value: new THREE.Color(o.root) },
      uTip: { value: new THREE.Color(o.tip) },
      uBelly: { value: new THREE.Color(o.belly?.color ?? o.root) },
      // No belly: a range below the mesh, so every point gets the root colour.
      uBellyRange: { value: new THREE.Vector2(o.belly?.from ?? -9, o.belly?.to ?? -8) },
      uLight: { value: LIGHT },
      uClear: { value: clear },
    },
  })
  const mesh = new THREE.InstancedMesh(geometry, material, o.shells)
  // The shells grow past the mesh bounds, and all copies share one transform.
  mesh.frustumCulled = false
  return { mesh, pull, clear }
}
