import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { furry, type Fur } from './fur'
import { FURS, type FurColor } from './furs'

// momo, built in code: a blue cloud of fur with stubby arms and legs and a
// small face. Units: the body radius is 1, the ground is y = 0, the face looks
// down +z. The joints are plain groups, so the same names can map to the bones
// and shape keys of an artist's model later.
//
//   root (ground, moves up for a hop)
//   ├─ shadow
//   ├─ legL, legR (hip joints)
//   └─ body (pivot at the bottom, for squash and lean)
//      └─ torso (body centre)
//         ├─ fur, face (eyes, brows, mouth, cheeks)
//         └─ armL, armR (shoulder joints)

export interface Eye {
  socket: THREE.Group
  iris: THREE.Group
}

export interface Rig {
  root: THREE.Group
  shadow: THREE.Mesh
  body: THREE.Group
  torso: THREE.Group
  eyes: [Eye, Eye]
  brows: [THREE.Group, THREE.Group]
  browBase: [THREE.Vector3, THREE.Vector3]
  mouth: THREE.Mesh
  cheeks: THREE.Mesh[]
  arms: [THREE.Group, THREE.Group]
  legs: [THREE.Group, THREE.Group]
  furs: Fur[]
  dispose(): void
}

/** Mouth shape keys, in the order of mouth.morphTargetInfluences. */
export const MOUTH_KEYS = ['smile', 'frown', 'open', 'oh'] as const

const FUR_LENGTH = 0.16
const SHAPE = new THREE.Vector3(1, 0.96, 0.94)
const HIPS = 0.3
const CENTRE = 0.94

// Bumps that turn the ball into a cloud: [direction, height, sharpness].
const LUMPS = (
  [
    [0.32, 0.94, 0.05, 0.24, 10], // the top tuft
    [-0.4, 0.88, -0.15, 0.12, 9],
    [-0.88, 0.42, 0.1, 0.1, 9],
    [0.92, 0.3, -0.1, 0.09, 9],
    [-0.8, -0.25, 0.3, 0.06, 8],
    [0.8, -0.3, 0.3, 0.06, 8],
    [-0.7, -0.3, -0.6, 0.08, 7],
    [0.6, -0.4, -0.7, 0.08, 7],
    [0, 0.4, -0.9, 0.08, 7],
    [0, -0.7, 0.7, 0.06, 5], // round belly
  ] as const
).map(([x, y, z, a, k]) => ({ d: new THREE.Vector3(x, y, z).normalize(), a, k }))

function radius(d: THREE.Vector3): number {
  let r = 1
  for (const l of LUMPS) r += l.a * Math.exp(-(1 - d.dot(l.d)) * l.k)
  return r + 0.012 * Math.sin(d.x * 9 + d.y * 4) * Math.sin(d.z * 8 - d.y * 5)
}

function bodyGeometry(detail: number) {
  const ico = new THREE.IcosahedronGeometry(1, detail)
  ico.deleteAttribute('normal')
  ico.deleteAttribute('uv')
  const g = mergeVertices(ico)
  ico.dispose()
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize()
    v.multiplyScalar(radius(v)).multiply(SHAPE)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

const Z = new THREE.Vector3(0, 0, 1)
/** Puts a face part on the fur surface, facing out. */
function place(o: THREE.Object3D, x: number, y: number, z: number, lift: number) {
  const d = new THREE.Vector3(x, y, z).normalize()
  o.position.copy(d).multiplyScalar(radius(d) + lift).multiply(SHAPE)
  o.quaternion.setFromUnitVectors(Z, d)
  return d
}

function radialTexture(inner: string, outer: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// The mouth is a thin strip between an upper and a lower lip line.
function mouthLine(w: number, curve: number, thick: number, open: number, flat: number, up = 0) {
  const N = 20
  const out: number[] = []
  for (let i = 0; i <= N; i++) {
    const s = -1 + (2 * i) / N
    const c = curve * (s * s - 0.5)
    const taper = Math.pow(1 - s * s, 0.6)
    const bulge = Math.pow(1 - s * s, 0.75)
    out.push(s * w, c * (1 - flat) + thick * 0.5 * taper + up * bulge, 0)
    out.push(s * w, c - thick * 0.5 * taper - open * bulge, 0)
  }
  return out
}

function mouthGeometry() {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(mouthLine(0.075, 0.03, 0.013, 0, 0), 3))
  const idx: number[] = []
  for (let i = 0; i < 20; i++) {
    const a = 2 * i
    idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
  }
  g.setIndex(idx)
  g.morphAttributes.position = [
    mouthLine(0.09, 0.05, 0.017, 0, 0), // smile
    mouthLine(0.06, -0.028, 0.012, 0, 0), // frown
    mouthLine(0.075, 0.02, 0.012, 0.075, 0.6), // open
    mouthLine(0.034, 0, 0.012, 0.04, 1, 0.02), // oh
  ].map((a) => new THREE.Float32BufferAttribute(a, 3))
  return g
}

export function buildMomo(shells: number, FUR: FurColor = FURS[0]): Rig {
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.Texture[] = []
  const geo = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g)
  const mat = <T extends THREE.Material>(m: T) => (materials.push(m), m)

  const root = new THREE.Group()
  const body = new THREE.Group()
  body.position.y = HIPS
  const torso = new THREE.Group()
  torso.position.y = CENTRE
  body.add(torso)
  root.add(body)

  const furs: Fur[] = []
  const bodyFur = furry(geo(bodyGeometry(shells > 20 ? 26 : 20)), {
    shells,
    length: FUR_LENGTH,
    density: 48,
    clump: 6,
    root: FUR.root,
    tip: FUR.tip,
    belly: { color: FUR.belly, from: -0.95, to: 0.15 },
  })
  torso.add(bodyFur.mesh)
  furs.push(bodyFur)

  // Arms: flat paddles that hang from the shoulder joint.
  const armGeo = geo(new THREE.CapsuleGeometry(0.15, 0.2, 6, 14).translate(0, -0.24, 0).scale(1, 1, 0.62))
  const arms = [-1, 1].map((side) => {
    const joint = new THREE.Group()
    joint.position.set(side * 0.86, -0.12, 0.12)
    const fur = furry(armGeo, { shells: Math.ceil(shells * 0.7), length: 0.07, density: 80, clump: 9, root: FUR.root, tip: FUR.tip })
    joint.add(fur.mesh)
    furs.push(fur)
    torso.add(joint)
    return joint
  }) as [THREE.Group, THREE.Group]

  // Legs: short stubs under the body, with short fur.
  const legGeo = geo(new THREE.CapsuleGeometry(0.17, 0.2, 6, 14).translate(0, -0.2, 0).scale(1, 1, 0.9))
  const legs = [-1, 1].map((side) => {
    const joint = new THREE.Group()
    joint.position.set(side * 0.34, 0.5, 0.05)
    const fur = furry(legGeo, { shells: Math.ceil(shells * 0.5), length: 0.035, density: 90, clump: 9, root: FUR.legRoot, tip: FUR.legTip })
    joint.add(fur.mesh)
    furs.push(fur)
    root.add(joint)
    return joint
  }) as [THREE.Group, THREE.Group]

  // Eyes: a white, a dark iris that moves to look, and two fixed highlights.
  const white = mat(new THREE.MeshStandardMaterial({ color: '#fbf8f4', roughness: 0.35 }))
  const irisMat = mat(new THREE.MeshPhysicalMaterial({ color: '#3a2117', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }))
  const pupilMat = mat(new THREE.MeshPhysicalMaterial({ color: '#0d0706', roughness: 0.15, clearcoat: 1 }))
  const shine = mat(new THREE.MeshBasicMaterial({ color: '#ffffff' }))
  const sphere = geo(new THREE.SphereGeometry(1, 32, 16))
  const ball = (m: THREE.Material, r: number, z: number, sz = 0.5) => {
    const b = new THREE.Mesh(sphere, m)
    b.scale.set(r, r * 1.05, r * sz)
    b.position.z = z
    return b
  }
  const eyes = [-1, 1].map((side) => {
    const socket = new THREE.Group()
    const d = place(socket, side * 0.34, 0.08, 0.94, FUR_LENGTH * 0.3)
    bodyFur.clear[side < 0 ? 0 : 1].set(d.x, d.y, d.z, Math.cos(0.16))
    const iris = new THREE.Group()
    iris.add(ball(irisMat, 0.112, 0.018), ball(pupilMat, 0.07, 0.045))
    const big = ball(shine, 0.028, 0.085, 1)
    big.position.set(-0.038, 0.045, 0.085)
    const small = ball(shine, 0.013, 0.083, 1)
    small.position.set(0.036, -0.036, 0.083)
    socket.add(ball(white, 0.135, 0), iris, big, small)
    torso.add(socket)
    return { socket, iris }
  }) as [Eye, Eye]

  // Brows: thin arcs above the eyes.
  const ink = mat(new THREE.MeshBasicMaterial({ color: '#3a2228' }))
  const browGeo = geo(new THREE.TorusGeometry(0.06, 0.009, 6, 20, 1.6).rotateZ((Math.PI - 1.6) / 2))
  const browBase: THREE.Vector3[] = []
  const brows = [-1, 1].map((side) => {
    const g = new THREE.Group()
    place(g, side * 0.33, 0.31, 0.9, FUR_LENGTH * 0.45)
    browBase.push(g.position.clone())
    g.add(new THREE.Mesh(browGeo, ink).translateY(-0.05))
    torso.add(g)
    return g
  }) as [THREE.Group, THREE.Group]

  const mouthMat = mat(new THREE.MeshBasicMaterial({ color: '#3a1f24', side: THREE.DoubleSide }))
  const mouth = new THREE.Mesh(geo(mouthGeometry()), mouthMat)
  place(mouth, 0, -0.03, 1, FUR_LENGTH * 0.8)
  torso.add(mouth)

  const blushTex = radialTexture('rgba(255,140,155,0.9)', 'rgba(255,140,155,0)')
  textures.push(blushTex)
  const blushGeo = geo(new THREE.PlaneGeometry(0.24, 0.15))
  const cheeks = [-1, 1].map((side) => {
    const m = new THREE.Mesh(blushGeo, mat(new THREE.MeshBasicMaterial({ map: blushTex, transparent: true, depthWrite: false })))
    place(m, side * 0.5, -0.06, 0.86, FUR_LENGTH * 0.75)
    torso.add(m)
    return m
  })

  const shadowTex = radialTexture('rgba(60,30,40,0.5)', 'rgba(60,30,40,0)')
  textures.push(shadowTex)
  const shadow = new THREE.Mesh(geo(new THREE.PlaneGeometry(2.1, 1.1)), mat(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.002

  for (const f of furs) materials.push(f.mesh.material as THREE.Material)

  return {
    root,
    shadow,
    body,
    torso,
    eyes,
    brows,
    browBase: browBase as [THREE.Vector3, THREE.Vector3],
    mouth,
    cheeks,
    arms,
    legs,
    furs,
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      textures.forEach((t) => t.dispose())
      furs.forEach((f) => f.mesh.dispose())
    },
  }
}
