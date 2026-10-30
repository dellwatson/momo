import * as THREE from 'three'
import type { Mood } from '@shared/types.ts'
import { isTalking, mouthOpen, type Gesture, type MascotInput, type MascotPhase, type MascotRenderer } from '@/state/mascot'
import { buildMomo } from './build'
import type { FurColor } from './furs'

// The 3D momo renderer. Each frame it builds one pose from layers, then sets
// the joints and shape keys from it:
//   1. mood: the face (eyes, brows, mouth, blush)
//   2. phase: the body (lean in to listen, look up to think, bounce to talk)
//   3. life: breathing, blinking, looking at the pointer, the mouth on the voice
//   4. gestures: one-shot moves (hop, wiggle, wave, squish, nod, droop, perk)
// Layers 1 and 2 ease toward their targets; layers 3 and 4 add on top.

interface Pose {
  y: number
  squash: number
  lean: number
  tilt: number
  turn: number
  armL: number
  armR: number
  eyeOpen: number
  eyeSize: number
  eyeL: number
  lookX: number
  lookY: number
  browY: number
  browTilt: number
  browL: number
  smile: number
  frown: number
  open: number
  oh: number
  blush: number
}

const REST: Pose = {
  y: 0, squash: 0, lean: 0, tilt: 0, turn: 0, armL: 0, armR: 0,
  eyeOpen: 1, eyeSize: 1, eyeL: 0, lookX: 0, lookY: 0,
  browY: 0, browTilt: 0, browL: 0, smile: 0.5, frown: 0, open: 0, oh: 0, blush: 0.7,
}

const FACE: Record<Mood, Partial<Pose>> = {
  happy: { eyeOpen: 0.92, smile: 1, blush: 0.9 },
  calm: { eyeOpen: 0.55, smile: 0.55, blush: 0.6, browY: -0.01 },
  excited: { eyeOpen: 1.05, eyeSize: 1.12, smile: 1, open: 0.35, blush: 1, browY: 0.025 },
  curious: { eyeL: 0.12, tilt: 0.14, oh: 0.45, smile: 0.15, browL: 0.03 },
  concerned: { eyeOpen: 0.85, eyeSize: 0.93, smile: 0, frown: 0.65, browTilt: 0.35, blush: 0.35, lean: -0.04 },
}

const BODY: Record<MascotPhase, Partial<Pose>> = {
  idle: {},
  listening: { lean: 0.1, tilt: 0.06, armL: 0.25, armR: 0.25 },
  thinking: { lookX: 0.55, lookY: 0.6, oh: 0.25 },
  speaking: { armL: 0.1, armR: 0.1 },
}

const ON_MOOD: Partial<Record<Mood, Gesture>> = { excited: 'hop', happy: 'wiggle', concerned: 'droop' }

const DURATION: Record<Gesture, number> = { hop: 0.62, wiggle: 0.9, wave: 1.3, squish: 0.5, nod: 0.4, droop: 1.4, perk: 0.45 }

const ARM_REST = 1.25

const sin = Math.sin
const PI = Math.PI
const bump = (p: number) => sin(PI * Math.min(1, Math.max(0, p)))
const ease = (p: number) => Math.min(1, p * 4) * Math.min(1, (1 - p) * 4)

/** Adds one gesture at progress p (0 to 1) onto the pose. */
function applyGesture(g: Gesture, p: number, o: Pose) {
  switch (g) {
    case 'hop': {
      if (p < 0.18) o.squash += 0.14 * bump(p / 0.18)
      else if (p < 0.85) {
        const q = bump((p - 0.18) / 0.67)
        o.y += 0.38 * q
        o.squash -= 0.06 * q
        o.armL += 0.6 * q
        o.armR += 0.6 * q
      } else o.squash += 0.12 * bump((p - 0.85) / 0.15)
      break
    }
    case 'wiggle':
      o.tilt += sin(p * 6 * PI) * 0.13 * (1 - p)
      o.turn += sin(p * 6 * PI + 1) * 0.1 * (1 - p)
      break
    case 'wave': {
      const e = ease(p)
      // Higher than this, the paw goes behind the fur.
      o.armR += e * 0.85 + e * sin(p * 8 * PI) * 0.3
      o.tilt -= e * 0.05
      break
    }
    case 'squish':
      o.squash += 0.24 * bump(p / 0.6) - 0.06 * bump((p - 0.6) / 0.4)
      o.eyeOpen *= 1 - 0.85 * bump(p)
      o.smile += 0.5 * bump(p)
      o.blush += 0.4 * bump(p)
      break
    case 'nod':
      o.lean += 0.12 * bump(p)
      break
    case 'droop': {
      const e = ease(p)
      o.squash += 0.06 * e
      o.armL -= 0.25 * e
      o.armR -= 0.25 * e
      o.lean -= 0.05 * e
      break
    }
    case 'perk':
      o.squash -= 0.08 * bump(p)
      o.eyeOpen += 0.15 * bump(p)
      o.y += 0.05 * bump(p)
      break
  }
}

export interface MomoOptions {
  /** CSS size of the square canvas. */
  size: number
  fur?: FurColor
}

/** Puts a 3D momo canvas into `host`. Throws when the browser has no WebGL 2. */
export function createMomo(host: HTMLElement, { size, fur }: MomoOptions): MascotRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(size, size)
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.style.display = 'block'
  canvas.style.touchAction = 'manipulation'
  host.appendChild(canvas)

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#ffffff', '#e2c4c4', 1.7))
  const sun = new THREE.DirectionalLight('#ffffff', 1.6)
  sun.position.set(-2, 3, 4)
  scene.add(sun)

  const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 50)
  camera.position.set(0, 1.5, 6.2)
  camera.lookAt(0, 1.3, 0)

  const rig = buildMomo(size >= 120 ? 28 : 18, fur)
  scene.add(rig.root, rig.shadow)

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  let input: MascotInput = { mood: 'happy', phase: 'idle' }
  const pose: Pose = { ...REST }
  const gestures: { g: Gesture; t0: number }[] = []
  let last = performance.now()
  let t = 0
  let wasTalking = false
  let mouth = 0
  let prevY = 0
  let blinkAt = 1.5
  let blinkTwice = false
  let wanderAt = 0
  const wander = new THREE.Vector2()
  const pointer = { x: 0, y: 0, at: -99 }

  const play = (g: Gesture) => {
    if (reduced && (g === 'hop' || g === 'wiggle')) return
    for (let i = gestures.length - 1; i >= 0; i--) if (gestures[i].g === g) gestures.splice(i, 1)
    gestures.push({ g, t0: t })
  }

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    pointer.x = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / 320, -1, 1)
    pointer.y = THREE.MathUtils.clamp(-(e.clientY - (r.top + r.height * 0.45)) / 320, -1, 1)
    pointer.at = t
  }
  const onPoke = () => play(Math.random() < 0.6 ? 'squish' : Math.random() < 0.5 ? 'hop' : 'wiggle')
  window.addEventListener('pointermove', onMove, { passive: true })
  canvas.addEventListener('pointerdown', onPoke)

  function frame() {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    t += dt
    const talking = isTalking()
    if (talking && !wasTalking) play('perk')
    wasTalking = talking
    const phase: MascotPhase = input.phase === 'idle' && talking ? 'speaking' : input.phase

    // Layers 1 and 2: ease toward mood and phase targets.
    const target: Pose = { ...REST, ...FACE[input.mood] }
    for (const [k, v] of Object.entries(BODY[phase]) as [keyof Pose, number][]) target[k] += v
    if (phase === 'thinking') target.tilt += sin(t * 0.9) * 0.06
    for (const k of Object.keys(pose) as (keyof Pose)[]) pose[k] = THREE.MathUtils.damp(pose[k], target[k], 6, dt)

    // Layer 3: life.
    const o: Pose = { ...pose }
    const calm = reduced ? 0.4 : 1
    o.squash += sin(t * 2 * PI * 0.28) * 0.012 * calm
    o.armL += sin(t * 1.3) * 0.05 * calm
    o.armR += sin(t * 1.3 + 0.8) * 0.05 * calm

    if (t > blinkAt) {
      const p = (t - blinkAt) / 0.14
      if (p >= 1) {
        if (blinkTwice) {
          blinkTwice = false
          blinkAt = t + 0.08
        } else {
          blinkAt = t + 2 + Math.random() * 3.5
          blinkTwice = Math.random() < 0.2
        }
      } else o.eyeOpen *= 1 - 0.92 * bump(p)
    }

    if (phase !== 'thinking') {
      if (t - pointer.at < 2.5) {
        o.lookX += pointer.x
        o.lookY += pointer.y
      } else {
        if (t > wanderAt) {
          wander.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.35)
          if (Math.random() < 0.4) wander.set(0, 0) // look back at the person
          wanderAt = t + 1 + Math.random() * 2.5
        }
        o.lookX += wander.x
        o.lookY += wander.y
      }
    }

    mouth = THREE.MathUtils.damp(mouth, mouthOpen(), 25, dt)
    o.open += mouth * 0.85
    o.oh += mouth * 0.15
    o.smile *= 1 - mouth * 0.4
    o.y += mouth * 0.015
    o.squash += mouth * 0.02
    if (phase === 'speaking') {
      o.armL += sin(t * 2.1) * 0.1
      o.armR += sin(t * 2.1 + 2) * 0.1
    }

    // Layer 4: gestures.
    for (let i = gestures.length - 1; i >= 0; i--) {
      const p = (t - gestures[i].t0) / DURATION[gestures[i].g]
      if (p >= 1) gestures.splice(i, 1)
      else applyGesture(gestures[i].g, p, o)
    }

    // Pose to joints and shape keys.
    o.lookX = THREE.MathUtils.clamp(o.lookX, -1, 1)
    o.lookY = THREE.MathUtils.clamp(o.lookY, -1, 1)
    rig.root.position.y = o.y
    rig.body.scale.set(1 + o.squash * 0.6, 1 - o.squash, 1 + o.squash * 0.6)
    rig.body.rotation.set(o.lean - o.lookY * 0.12, o.turn + o.lookX * 0.28, -o.tilt)
    rig.arms[0].rotation.z = -(ARM_REST + o.armL)
    rig.arms[1].rotation.z = ARM_REST + o.armR
    rig.legs[0].rotation.x = o.y * 0.6
    rig.legs[1].rotation.x = o.y * 0.6
    rig.legs[0].position.y = rig.legs[1].position.y = 0.5 - o.squash * 0.12

    rig.eyes.forEach((e, i) => {
      const s = o.eyeSize * (i === 0 ? 1 + o.eyeL : 1)
      e.socket.scale.set(s, s * Math.max(0.06, o.eyeOpen), s)
      e.iris.position.set(o.lookX * 0.028, o.lookY * 0.024, 0)
    })
    rig.brows.forEach((b, i) => {
      const side = i === 0 ? 1 : -1
      b.position.copy(rig.browBase[i])
      b.translateY(o.browY + (i === 0 ? o.browL : 0) + (o.eyeOpen - 1) * 0.02)
      b.children[0].rotation.z = side * o.browTilt
    })
    const inf = rig.mouth.morphTargetInfluences!
    inf[0] = THREE.MathUtils.clamp(o.smile, 0, 1.3)
    inf[1] = THREE.MathUtils.clamp(o.frown, 0, 1)
    inf[2] = THREE.MathUtils.clamp(o.open, 0, 1.2)
    inf[3] = THREE.MathUtils.clamp(o.oh, 0, 1)
    rig.cheeks.forEach((c) => ((c.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(o.blush, 0, 1)))

    const s = 1 + o.y * 0.8
    rig.shadow.scale.set(1 / s, 1 / s, 1)
    ;(rig.shadow.material as THREE.MeshBasicMaterial).opacity = 1 / s

    // Fur lags behind the motion and hangs a little.
    const vy = (o.y - prevY) / Math.max(dt, 1e-3)
    prevY = o.y
    for (const f of rig.furs) f.pull.set(-o.tilt * 0.6, THREE.MathUtils.clamp(-0.3 - vy * 0.2, -1, 0.5), 0)

    renderer.render(scene, camera)
  }

  let paused = false
  const loop = () => renderer.setAnimationLoop(paused ? null : frame)
  loop()

  return {
    set(next) {
      if (next.mood !== input.mood && ON_MOOD[next.mood]) play(ON_MOOD[next.mood]!)
      input = next
    },
    play,
    pause(on) {
      if (on === paused) return
      paused = on
      last = performance.now() // skip the paused time
      loop()
    },
    dispose() {
      renderer.setAnimationLoop(null)
      window.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onPoke)
      rig.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
