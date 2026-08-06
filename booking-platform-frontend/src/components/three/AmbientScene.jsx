import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/*
  ============================================================================
  AmbientScene — a 3D *background*, not an object
  ----------------------------------------------------------------------------
  An earlier version put discrete forms (spheres, a glass slab, rings) in the
  scene. It read as a floating logo, competed with the headline, and the
  transmission material rendered as a black rectangle on some GPUs.

  This replaces all of it with a single full-bleed plane running a fragment
  shader: layered value noise, slowly advected, mapped onto the bone/clay
  palette. It behaves like atmosphere — no silhouette, no edges, nothing that
  reads as a shape sitting on the page. Type stays legible over any part of it.

  It is also dramatically cheaper: one plane, one draw call, no lighting rig,
  no environment map, no transmission passes.
  ============================================================================
*/

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/*
  Value noise + fbm. Cheap, dependency-free, and smooth enough that the result
  reads as soft light rather than as visible noise.
*/
const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uAspect;
  uniform vec3  uCanvas;
  uniform vec3  uAccent;
  uniform vec3  uSecondary;
  uniform float uIntensity;
  uniform float uContained;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    // Smoothstep the interpolation so there are no grid artefacts.
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }

    return value;
  }

  void main() {
    vec2 uv = vUv * uAspect;
    float t = uTime * 0.02;

    // Domain warping — the field is sampled through another noise field, which
    // is what turns flat clouds into something that looks like slow liquid.
    vec2 q = vec2(fbm(uv + t), fbm(uv + vec2(3.2, 1.7) - t));
    vec2 r = vec2(fbm(uv + 3.0 * q + vec2(1.7, 9.2) + t * 0.6),
                  fbm(uv + 3.0 * q + vec2(8.3, 2.8) - t * 0.4));

    float f = fbm(uv + 2.4 * r);

    /*
      Anisotropic sampling — the same noise stretched hard along one axis reads
      as soft light streaking across a surface, the way a long exposure or a
      raking studio light does. This is what stops it looking like generic
      "cloud" noise and starts it looking photographed.
    */
    float streak = fbm(vec2(uv.x * 0.55 + r.x * 0.8, uv.y * 5.5 - t * 0.5));

    // A soft key light in the upper right, falling away across the frame.
    vec2 sunPos = vec2(0.78, 0.24);
    float sun = 1.0 - smoothstep(0.0, 0.95, distance(vUv, sunPos));

    /*
      uContained switches between two jobs:

        0 - full-bleed atmosphere behind live text. Must stay near-invisible,
            because anything stronger fights the headline for attention.
        1 - a framed artwork inside its own panel. Nothing sits on top of it,
            so it can carry real contrast and colour and actually be looked at.
    */
    vec3 deep = mix(uSecondary, uAccent, 0.72);

    vec3 color = mix(uCanvas, uSecondary, smoothstep(0.22, 0.80, f));

    // Ridged folds. Taking the absolute distance from the midpoint turns soft
    // blobs into creases, which is what makes it read as a formed surface —
    // draped fabric or polished stone — rather than as a gradient.
    float ridge = 1.0 - abs(f - 0.5) * 2.0;
    color = mix(color, deep, pow(ridge, 3.0) * 0.55 * uContained);

    // Light streaks: a sheen when ambient, a defined highlight when framed.
    color = mix(color, uSecondary, streak * mix(0.22, 0.42, uContained));

    color += sun * mix(0.05, 0.14, uContained) * uIntensity;

    // Accent surfaces where the field is densest AND the light falls, so
    // colour always sits where the lighting justifies it.
    float accentMask = smoothstep(mix(0.58, 0.44, uContained), 1.02, f) * (0.35 + sun * 0.65);
    color = mix(color, uAccent, accentMask * mix(0.5, 0.95, uContained) * uIntensity);

    // Deepen the shadow side so the frame has real tonal range end to end.
    color = mix(color, deep * 0.82, smoothstep(0.55, 0.0, f) * 0.4 * uContained);

    // Vignette. Full-bleed fades to the page colour so it has no edge; framed
    // keeps a gentle darkening that reads as photographic falloff.
    float d = distance(vUv, vec2(0.5));
    color = mix(color, uCanvas, smoothstep(0.34, 0.78, d) * (1.0 - uContained));
    color *= 1.0 - smoothstep(0.42, 0.85, d) * 0.18 * uContained;

    // Fine grain. Large flat gradients band badly on 8-bit displays; a little
    // noise dithers that away and adds a photographic quality.
    float grain = (hash(vUv * 900.0 + fract(uTime)) - 0.5) * 0.016;
    color += grain;

    gl_FragColor = vec4(color, 1.0);
  }
`

function Field({ palette, intensity, contained, reduced }) {
  const material = useRef()

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      // A framed panel is portrait, so the noise is sampled squarer to keep
      // the folds from stretching into stripes.
      uAspect: { value: new THREE.Vector2(contained ? 1.05 : 1.6, 1) },
      uCanvas: { value: new THREE.Color(palette.canvas) },
      uAccent: { value: new THREE.Color(palette.accent) },
      uSecondary: { value: new THREE.Color(palette.secondary) },
      uIntensity: { value: intensity },
      uContained: { value: contained ? 1 : 0 },
    }),
    [palette, intensity, contained],
  )

  useFrame((state, delta) => {
    if (!material.current || reduced) return
    // Slow enough that it never pulls the eye, only rewards a second look.
    material.current.uniforms.uTime.value += delta
  })

  return (
    <mesh scale={[12, 12, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}

/*
  Palettes are read from the CSS custom properties, so the background follows
  the theme toggle instead of hard-coding two sets of colours here.
*/
function readPalette() {
  const styles = getComputedStyle(document.documentElement)
  const value = (name, fallback) => styles.getPropertyValue(name).trim() || fallback

  return {
    canvas: value('--color-canvas', '#faf9f6'),
    accent: value('--color-accent', '#a63d2a'),
    secondary: value('--color-surface-sunk', '#f2f0ea'),
  }
}

export default function AmbientScene({ className = '', intensity = 1, contained = false }) {
  const reduced = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const palette = useMemo(readPalette, [])

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        // A framed artwork is looked at directly, so it earns the sharper
        // pixels; a background wash does not.
        dpr={contained ? [1, 2] : [1, 1.25]}
        gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
        camera={{ position: [0, 0, 5], fov: 45 }}
        frameloop={reduced ? 'demand' : 'always'}
      >
        <Field palette={palette} intensity={intensity} contained={contained} reduced={reduced} />
      </Canvas>
    </div>
  )
}
