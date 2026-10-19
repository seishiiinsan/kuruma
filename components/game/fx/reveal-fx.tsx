"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Group, Mesh, NormalBlending, Points, ShaderMaterial } from "three";
import type { CardTier } from "@/lib/cards";
import { TIER_RGB } from "./webgl";

export type RevealStage = "back" | "charging" | "turning" | "front";

/** How loud each rarity is allowed to be. Commons stay polite; legendaries get everything. */
const TIER_FX: Record<
  CardTier,
  { particles: number; spread: number; rays: number; hold: number; ring: number; rainbow: number }
> = {
  common: { particles: 40, spread: 1.5, rays: 0, hold: 0, ring: 0.35, rainbow: 0 },
  rare: { particles: 110, spread: 2.2, rays: 0.45, hold: 0, ring: 0.8, rainbow: 0 },
  epic: { particles: 200, spread: 2.8, rays: 0.85, hold: 0.28, ring: 1, rainbow: 0 },
  legendary: { particles: 340, spread: 3.3, rays: 1, hold: 0.4, ring: 1.2, rainbow: 1 },
};

/* ---------- Shared vertex for full-quad effects ---------- */

const UV_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SPECTRUM = /* glsl */ `
  vec3 spectrum(float t) {
    // The card holo's pastel film: pink, butter, mint, sky, lilac.
    return 0.62 + 0.38 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
  }
`;

/* ---------- God rays behind the card ---------- */

const RAYS_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uRainbow;
  uniform vec3 uColor;
  varying vec2 vUv;
  ${SPECTRUM}
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c);
    float a = atan(c.y, c.x);
    float beams = pow(abs(sin(a * 7.0 + uTime * 0.35)), 10.0) + 0.6 * pow(abs(sin(a * 11.0 - uTime * 0.22 + 1.7)), 18.0);
    float fall = smoothstep(0.5, 0.08, r);
    float core = smoothstep(0.32, 0.0, r);
    vec3 col = mix(uColor, spectrum(a / 6.28318 + uTime * 0.05), uRainbow * 0.85);
    float alpha = (beams * fall * 0.75 + core * 0.45) * uIntensity;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
  }
`;

/* ---------- Shockwave ring ---------- */

const RING_FRAGMENT = /* glsl */ `
  uniform float uT;
  uniform float uPower;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float radius = 1.0 - exp(-uT * 3.2);
    float width = 0.03 + 0.06 * uT;
    float ring = exp(-pow((r - radius) / width, 2.0));
    float fade = (1.0 - smoothstep(0.15, 0.9, uT)) * step(0.0, uT);
    gl_FragColor = vec4(uColor, ring * fade * uPower * 0.8);
  }
`;

/* ---------- Particles: every motion lives in the vertex shader ---------- */

const BURST_VERTEX = /* glsl */ `
  uniform float uT;
  uniform float uCharge;
  uniform float uSpread;
  uniform float uRainbow;
  uniform vec3 uColor;
  attribute vec2 aDir;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aSeed;
  attribute float aLife;
  varying float vAlpha;
  varying vec3 vColor;
  ${SPECTRUM}
  void main() {
    vec3 p = vec3(0.0);
    float alpha = 0.0;
    if (uT >= 0.0) {
      float travel = 1.0 - exp(-3.6 * uT * aSpeed);
      p.xy = aDir * uSpread * travel * (0.55 + 0.45 * aSpeed);
      p.y -= 0.35 * uT * uT;
      p.z = (aSeed - 0.5) * 1.2 * travel;
      alpha = 1.0 - smoothstep(aLife * 0.35, aLife, uT);
    } else if (uCharge > 0.0) {
      // Before a big reveal, sparks are drawn in towards the card.
      float k = fract(uCharge * (0.6 + aSeed * 0.8) + aSeed);
      p.xy = aDir * uSpread * 0.9 * (1.0 - k * k);
      alpha = smoothstep(0.0, 0.25, k) * (1.0 - smoothstep(0.85, 1.0, k)) * min(1.0, uCharge * 2.0);
    }
    vAlpha = alpha;
    vColor = mix(mix(uColor, vec3(1.0, 0.86, 0.4), step(0.72, aSeed)), spectrum(aSeed * 3.0), uRainbow * step(0.35, aSeed));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float twinkle = 0.65 + 0.35 * sin(uT * 18.0 + aSeed * 40.0);
    gl_PointSize = aSize * twinkle * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const BURST_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float core = smoothstep(0.5, 0.0, r);
    float star = max(0.0, 1.0 - abs(c.x * c.y) * 80.0) * smoothstep(0.5, 0.0, r);
    float a = (core * core * 0.9 + star * 0.8) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), core * core * core * 0.5), a);
  }
`;

function burstGeometry(count: number) {
  const dir = new Float32Array(count * 2);
  const speed = new Float32Array(count);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);
  const life = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.35 + Math.random() * 0.65;
    dir[i * 2] = Math.cos(a) * r;
    dir[i * 2 + 1] = Math.sin(a) * r;
    speed[i] = 0.5 + Math.random();
    size[i] = 0.1 + Math.random() * 0.22;
    seed[i] = Math.random();
    life[i] = 0.8 + Math.random() * 1.1;
  }
  const g = new BufferGeometry();
  // Positions come from the shader; three still wants an attribute to size the draw.
  g.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("aDir", new BufferAttribute(dir, 2));
  g.setAttribute("aSpeed", new BufferAttribute(speed, 1));
  g.setAttribute("aSize", new BufferAttribute(size, 1));
  g.setAttribute("aSeed", new BufferAttribute(seed, 1));
  g.setAttribute("aLife", new BufferAttribute(life, 1));
  return g;
}

// Must match CHARGE_MS in pack-opening.tsx.
const CHARGE_SECONDS = { rare: 0.42, epic: 0.9, legendary: 1.5 } as Record<CardTier, number>;

const CAMERA_Z = 6;
const CAMERA_FOV = 40;
const VISIBLE_H = 2 * CAMERA_Z * Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);

function Effects({
  tier,
  stage,
  id,
  anchor,
}: {
  tier: CardTier;
  stage: RevealStage;
  id: number;
  anchor: React.RefObject<HTMLElement | null>;
}) {
  const group = useRef<Group>(null);
  const fx = TIER_FX[tier];
  const color = TIER_RGB[tier] as unknown as [number, number, number];
  const clock = useRef({ burstAt: -1, chargeAt: -1, now: 0 });
  const raysMesh = useRef<Mesh>(null);
  const ringMesh = useRef<Mesh>(null);
  const points = useRef<Points>(null);

  // A new card, or a new stage of this card, restarts its timeline.
  useEffect(() => {
    const c = clock.current;
    if (stage === "front") c.burstAt = c.now;
    else c.burstAt = -1;
    c.chargeAt = stage === "charging" ? c.now : -1;
  }, [stage, id]);

  const geometry = useMemo(() => burstGeometry(fx.particles), [fx.particles]);
  const burst = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: BURST_VERTEX,
        fragmentShader: BURST_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
        uniforms: {
          uT: { value: -1 },
          uCharge: { value: 0 },
          uSpread: { value: fx.spread },
          uRainbow: { value: fx.rainbow },
          uColor: { value: color },
        },
      }),
    [fx, color],
  );
  const rays = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: UV_VERTEX,
        fragmentShader: RAYS_FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uRainbow: { value: fx.rainbow },
          uColor: { value: color },
        },
      }),
    [fx, color],
  );
  const ring = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: UV_VERTEX,
        fragmentShader: RING_FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: { uT: { value: -1 }, uPower: { value: fx.ring }, uColor: { value: color } },
      }),
    [fx, color],
  );

  useFrame((state) => {
    if (!raysMesh.current || !ringMesh.current || !points.current || !group.current) return;

    // Keep the light centred on the card wherever the layout puts it.
    const card = anchor.current?.getBoundingClientRect();
    const view = state.gl.domElement.getBoundingClientRect();
    if (card && view.height > 0) {
      const visibleW = VISIBLE_H * (view.width / view.height);
      group.current.position.x = ((card.left + card.width / 2 - view.left) / view.width - 0.5) * visibleW;
      group.current.position.y = -((card.top + card.height / 2 - view.top) / view.height - 0.5) * VISIBLE_H;
    }

    const raysU = (raysMesh.current.material as ShaderMaterial).uniforms;
    const ringU = (ringMesh.current.material as ShaderMaterial).uniforms;
    const burstU = (points.current.material as ShaderMaterial).uniforms;
    const c = clock.current;
    c.now = state.clock.elapsedTime;
    const sinceBurst = c.burstAt < 0 ? -1 : c.now - c.burstAt;
    const sinceCharge = c.chargeAt < 0 ? 0 : c.now - c.chargeAt;
    const chargeLen = CHARGE_SECONDS[tier] ?? 1;

    burstU.uT.value = sinceBurst;
    burstU.uCharge.value = c.chargeAt < 0 ? 0 : sinceCharge / chargeLen;
    ringU.uT.value = sinceBurst;

    // Rays build during the charge, flash on the reveal, then settle to a hold glow.
    let intensity = 0;
    if (c.chargeAt >= 0) {
      // Breathing build-up: brighter and faster as the reveal nears.
      const k = Math.min(1, sinceCharge / chargeLen);
      intensity = fx.rays * (0.25 + 0.55 * k) * (0.8 + 0.2 * Math.sin(sinceCharge * (8 + 14 * k)));
    }
    if (sinceBurst >= 0) {
      const flash = Math.exp(-sinceBurst * 2.2);
      const rise = Math.min(1, sinceBurst / 0.12);
      intensity = fx.rays * (fx.hold + (1 - fx.hold) * flash) * rise;
    }
    raysU.uIntensity.value = intensity;
    raysU.uTime.value = c.now;
  });

  return (
    <group ref={group}>
      <mesh ref={raysMesh} material={rays} renderOrder={0}>
        <planeGeometry args={[12, 12]} />
      </mesh>
      <mesh ref={ringMesh} material={ring} renderOrder={1}>
        <planeGeometry args={[7, 7]} />
      </mesh>
      <points ref={points} geometry={geometry} material={burst} frustumCulled={false} renderOrder={2} />
    </group>
  );
}

/** Light and particles across the whole screen, centred on the card being revealed. */
export default function RevealFx({
  tier,
  stage,
  id,
  anchor,
}: {
  tier: CardTier;
  stage: RevealStage;
  id: number;
  anchor: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Canvas
      flat
      linear
      dpr={[1, 2]}
      camera={{ fov: CAMERA_FOV, position: [0, 0, CAMERA_Z] }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden
    >
      <Effects tier={tier} stage={stage} id={id} anchor={anchor} />
    </Canvas>
  );
}
