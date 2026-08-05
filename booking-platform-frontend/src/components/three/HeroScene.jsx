import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Float, Lightformer, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'

/*
  ============================================================================
  Hero 3D scene — "the slot"
  ----------------------------------------------------------------------------
  A real WebGL scene, not a CSS trick. The composition is a stack of ceramic
  and glass rings around a single filled wedge: the visual idea of a booked
  slot in a day, rendered as a physical object.

  Restraint is the point. One slow rotation, a soft pointer parallax, studio
  lighting from Lightformers, and a palette taken straight from the design
  tokens — terracotta, gold, sage on warm paper. Nothing spins fast, nothing
  bounces, nothing demands attention away from the headline.
  ============================================================================
*/

const TERRACOTTA = '#C2410C'
const CLAY = '#9A3412'
const GOLD = '#B45309'
const SAGE = '#4D7C6F'
const CREAM = '#FAF3EA'

/** The filled quadrant — the "booked" portion of the dial. */
function Wedge({ color = TERRACOTTA }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.absarc(0, 0, 1, Math.PI * 0.5, Math.PI * 0.02, true)
    shape.lineTo(0, 0)

    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 8,
      curveSegments: 64,
    })
  }, [])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      {/* Glazed ceramic: saturated, softly reflective, not mirror-like. */}
      <meshPhysicalMaterial
        color={color}
        roughness={0.28}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.18}
        reflectivity={0.5}
      />
    </mesh>
  )
}

/** Outer glass ring the wedge sits inside. */
function GlassRing() {
  return (
    <mesh castShadow>
      <torusGeometry args={[1.42, 0.075, 48, 160]} />
      <MeshTransmissionMaterial
        thickness={0.5}
        roughness={0.06}
        transmission={1}
        ior={1.42}
        chromaticAberration={0.05}
        backside
        color={CREAM}
        // Kept low: transmission is the single most expensive thing here.
        samples={4}
        resolution={256}
      />
    </mesh>
  )
}

/** Thin metallic accent rings, tilted off-axis for depth. */
function AccentRings() {
  return (
    <>
      <mesh rotation={[Math.PI / 2.6, 0.4, 0]}>
        <torusGeometry args={[1.78, 0.012, 16, 160]} />
        <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.85} />
      </mesh>
      <mesh rotation={[Math.PI / 1.9, -0.5, 0.3]}>
        <torusGeometry args={[2.05, 0.009, 16, 160]} />
        <meshStandardMaterial color={SAGE} roughness={0.35} metalness={0.7} />
      </mesh>
    </>
  )
}

/** Small ceramic markers around the dial — the other slots in the day. */
function SlotMarkers() {
  const count = 12

  return (
    <group>
      {Array.from({ length: count }).map((_, index) => {
        const angle = (index / count) * Math.PI * 2
        // The three markers adjacent to the wedge are "taken" and read gold.
        const taken = index < 3

        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 1.42, Math.sin(angle) * 1.42, 0.16]}
            castShadow
          >
            <cylinderGeometry args={[0.045, 0.045, 0.12, 24]} />
            <meshPhysicalMaterial
              color={taken ? GOLD : CREAM}
              roughness={0.3}
              clearcoat={0.8}
              clearcoatRoughness={0.2}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * One slow rotation plus a gentle lean toward the pointer. Damped, so it
 * settles rather than tracking the cursor exactly.
 */
function Dial({ reducedMotion }) {
  const group = useRef()
  const { pointer } = useThree()

  useFrame((state, delta) => {
    if (!group.current) return

    const targetY = reducedMotion ? 0.35 : pointer.x * 0.35 + state.clock.elapsedTime * 0.08
    const targetX = reducedMotion ? -0.25 : -pointer.y * 0.22 - 0.18

    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetY, 3, delta)
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetX, 3, delta)
  })

  return (
    <group ref={group} scale={1.05}>
      <Wedge />
      <GlassRing />
      <AccentRings />
      <SlotMarkers />

      {/* Recessed back plate, so the dial reads as a solid object. */}
      <mesh position={[0, 0, -0.14]} receiveShadow>
        <circleGeometry args={[1.36, 96]} />
        <meshPhysicalMaterial color={CLAY} roughness={0.55} metalness={0.1} />
      </mesh>
    </group>
  )
}

export default function HeroScene({ className = '' }) {
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        // Clamped DPR keeps this cheap on high-density laptop and phone
        // screens, where the extra pixels buy nothing at this size.
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 6.2], fov: 34 }}
        // Only redraw when something actually changes.
        frameloop={reducedMotion ? 'demand' : 'always'}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 5, 6]} intensity={2.1} castShadow />
        <directionalLight position={[-5, -2, -4]} intensity={0.5} color={GOLD} />

        <Float
          speed={reducedMotion ? 0 : 1.1}
          rotationIntensity={reducedMotion ? 0 : 0.14}
          floatIntensity={reducedMotion ? 0 : 0.5}
        >
          <Dial reducedMotion={reducedMotion} />
        </Float>

        {/* Studio softboxes — this is what makes the ceramic read as premium
            rather than as flat plastic. */}
        <Environment resolution={256}>
          <Lightformer intensity={2.4} position={[0, 4, 3]} scale={[10, 3, 1]} color={CREAM} />
          <Lightformer intensity={1.3} position={[-4, 1, 2]} scale={[3, 6, 1]} color={TERRACOTTA} />
          <Lightformer intensity={1.1} position={[4, -1, 2]} scale={[3, 6, 1]} color={GOLD} />
          <Lightformer intensity={0.7} position={[0, -4, 1]} scale={[10, 2, 1]} color={SAGE} />
        </Environment>
      </Canvas>
    </div>
  )
}
