"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  TextureLoader,
} from "three";
import { motion } from "motion/react";
import { ChevronsRight } from "lucide-react";
import type { PackDef } from "@/lib/packs";
import { hexToRgb } from "./webgl";

/* ---------- Geometry and camera ---------- */

const FOV = 32;
const TAN_HALF_FOV = Math.tan(((FOV / 2) * Math.PI) / 180);
const PACK_W = 2.4;
const PACK_H = PACK_W * (938 / 528);
const PACK_RATIO = 528 / 938;
const TEAR_FROM_TOP = 0.11; // under the top heat seal of the pack art
const SPLIT_UV = 1 - TEAR_FROM_TOP;

/** Where the pack sits on screen: its height in px and its centre's y in px. */
export type PackLayout = { packPx: number; centerY: number; height: number };

/** Moves the camera so the pack is exactly packPx tall, centred at centerY. */
function FitCamera({ layout }: { layout: PackLayout }) {
  useFrame(({ camera }) => {
    if (!layout.height || !layout.packPx) return;
    const visibleH = (PACK_H * layout.height) / layout.packPx;
    camera.position.z = visibleH / (2 * TAN_HALF_FOV);
    camera.position.y = (layout.centerY / layout.height - 0.5) * visibleH;
  });
  return null;
}

/** Size of an element, kept current. */
function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** What the DOM gesture tells the scene, read every frame. */
type Control = {
  progress: number;
  dragging: boolean;
  torn: boolean;
  pointer: { x: number; y: number; inside: boolean };
};

/* ---------- Foil shader ---------- */

const PACK_VERTEX = /* glsl */ `
  uniform float uBulge;
  varying vec2 vUv;
  varying vec3 vViewPos;

  void main() {
    vUv = uv;
    vec3 p = position;
    vec2 c = uv * 2.0 - 1.0;
    // Pillowed bag, flat crimped seals at both ends, a little film crinkle.
    float seal = smoothstep(0.04, 0.10, uv.y) * smoothstep(0.96, 0.90, uv.y);
    float pillow = (1.0 - pow(abs(c.x), 3.0)) * (1.0 - pow(abs(c.y), 8.0));
    p.z += uBulge * pillow * seal;
    p.z += 0.012 * sin(uv.x * 37.0 + uv.y * 11.0) * sin(uv.y * 53.0 - uv.x * 7.0) * seal;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const PACK_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform vec2 uTilt;
  uniform float uCut;
  uniform float uSide;
  uniform float uOpacity;
  uniform vec3 uAccent;
  varying vec2 vUv;
  varying vec3 vViewPos;

  // Same pastel film as the legendary card holo: pink, butter, mint, sky, lilac.
  vec3 spectrum(float t) {
    return 0.66 + 0.34 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
  }

  float tearEdge(float x) {
    return ${SPLIT_UV.toFixed(4)} + 0.007 * sin(x * 91.0) + 0.004 * sin(x * 237.0 + 1.3);
  }

  void main() {
    float edge = tearEdge(vUv.x);
    if (uSide > 0.0 && vUv.y > edge) discard;
    if (uSide < 0.0 && vUv.y <= edge) discard;

    vec4 tex = texture2D(uMap, vUv);
    // The art carries its own alpha: the zigzag cut edges of the bag.
    float lo = min(tex.r, min(tex.g, tex.b));
    float alpha = tex.a;
    if (alpha < 0.02) discard;

    vec3 N = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(-vViewPos);
    float ndv = clamp(dot(N, V), 0.0, 1.0);

    float hi = max(tex.r, max(tex.g, tex.b));
    float metal = smoothstep(0.16, 0.04, hi - lo); // greys = foil seals and frame

    // Thin-film iridescence: hue shifts with the viewing angle and the tilt.
    vec3 film = spectrum(ndv * 1.7 + vUv.y * 0.9 + uTilt.x * 0.8 - uTilt.y * 0.5 + uTime * 0.02);
    film = mix(vec3(1.0), film, 0.75);

    vec3 col = gl_FrontFacing ? tex.rgb : mix(vec3(0.78, 0.8, 0.86), tex.rgb, 0.25);
    col = mix(col, col * film * 1.25, 0.06 + 0.6 * metal);

    vec3 L = normalize(vec3(-0.45, 0.65, 1.0));
    float diffuse = 0.78 + 0.22 * max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 70.0) * (0.35 + 0.9 * metal);

    // A specular band that slides across the foil as the pack turns.
    float s = vUv.x * 0.75 + vUv.y * 0.55 - 0.65 - uTilt.x * 1.1 + uTilt.y * 0.4 - sin(uTime * 0.5) * 0.12;
    float sweep = exp(-pow(s * 11.0, 2.0)) * (0.12 + 0.38 * metal);

    col = col * diffuse + vec3(spec) + sweep * mix(vec3(1.0), film, 0.5);

    // The cut: a hot line that follows the finger along the tear path.
    if (uCut > 0.0 && uSide > 0.0) {
      float d = abs(vUv.y - edge);
      float reach = 1.0 - smoothstep(uCut - 0.02, uCut + 0.01, vUv.x);
      float glow = exp(-d * 260.0) * reach;
      float halo = exp(-d * 60.0) * reach * 0.35;
      col = mix(col, vec3(1.0), glow) + uAccent * halo;
    }

    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`;

/* ---------- Sparks: a CPU-driven particle pool drawn as GPU point sprites ---------- */

const SPARK_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const SPARK_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float core = smoothstep(0.5, 0.0, r);
    float star = max(0.0, 1.0 - abs(c.x * c.y) * 70.0) * smoothstep(0.5, 0.05, r);
    float a = (core * core + star * 0.7) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), core * core * 0.6), a);
  }
`;

const POOL = 520;

function Sparks({ ctl, accent }: { ctl: React.RefObject<Control>; accent: [number, number, number] }) {
  const sim = useMemo(
    () => ({
      pos: new Float32Array(POOL * 3),
      vel: new Float32Array(POOL * 3),
      life: new Float32Array(POOL),
      max: new Float32Array(POOL),
      next: 0,
      burst: false,
      carry: 0,
    }),
    [],
  );
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(sim.pos, 3));
    g.setAttribute("aAlpha", new BufferAttribute(new Float32Array(POOL), 1));
    g.setAttribute("aSize", new BufferAttribute(new Float32Array(POOL), 1));
    g.setAttribute("aColor", new BufferAttribute(new Float32Array(POOL * 3), 3));
    return g;
  }, [sim]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SPARK_VERTEX,
        fragmentShader: SPARK_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      }),
    [],
  );

  const palette = useMemo(
    // Saturated on purpose: white sparks vanish on the light table.
    () => [accent, [0.95, 0.66, 0.05], [0.96, 0.42, 0.18], accent] as [number, number, number][],
    [accent],
  );

  function spawn(x: number, y: number, power: number) {
    const i = sim.next;
    sim.next = (sim.next + 1) % POOL;
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.6 + Math.random() * 1.8) * power;
    sim.pos.set([x, y, 0.08], i * 3);
    sim.vel.set([Math.cos(angle) * speed, Math.abs(Math.sin(angle)) * speed * 1.2 + 0.4, (Math.random() - 0.3) * speed], i * 3);
    const life = 0.45 + Math.random() * 0.7 * power;
    sim.life[i] = life;
    sim.max[i] = life;
    const color = palette[Math.floor(Math.random() * palette.length)];
    (geometry.attributes.aColor.array as Float32Array).set(color, i * 3);
    (geometry.attributes.aSize.array as Float32Array)[i] = 0.09 + Math.random() * 0.14 * power;
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const c = ctl.current;
    const tearY = PACK_H / 2 - TEAR_FROM_TOP * PACK_H;
    if (c.dragging && !c.torn && c.progress > 0) {
      sim.carry += dt * 140;
      const x = -PACK_W / 2 + c.progress * PACK_W;
      for (; sim.carry >= 1; sim.carry--) spawn(x, tearY, 0.8);
    }
    if (c.torn && !sim.burst) {
      sim.burst = true;
      for (let n = 0; n < 320; n++) spawn(-PACK_W / 2 + Math.random() * PACK_W, tearY, 1.6);
    }

    const alpha = geometry.attributes.aAlpha.array as Float32Array;
    for (let i = 0; i < POOL; i++) {
      if (sim.life[i] <= 0) {
        alpha[i] = 0;
        continue;
      }
      sim.life[i] -= dt;
      sim.vel[i * 3 + 1] -= 4.2 * dt;
      sim.vel[i * 3] *= 1 - 1.2 * dt;
      sim.pos[i * 3] += sim.vel[i * 3] * dt;
      sim.pos[i * 3 + 1] += sim.vel[i * 3 + 1] * dt;
      sim.pos[i * 3 + 2] += sim.vel[i * 3 + 2] * dt;
      alpha[i] = Math.max(0, sim.life[i] / sim.max[i]);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
    geometry.attributes.aColor.needsUpdate = true;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}

/* ---------- Burst of light from the open pack ---------- */

const GLOW_FRAGMENT = /* glsl */ `
  uniform float uT;
  uniform vec3 uAccent;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c);
    float a = atan(c.y, c.x);
    float rays = pow(abs(sin(a * 9.0 + uT * 1.5)), 14.0) * smoothstep(0.5, 0.05, r);
    float disc = smoothstep(0.5, 0.0, r);
    float k = smoothstep(0.0, 0.15, uT) * (1.0 - smoothstep(0.35, 0.9, uT));
    vec3 col = mix(uAccent, vec3(1.0, 0.86, 0.45), rays);
    gl_FragColor = vec4(col, (disc * disc * 0.55 + rays * 0.5) * k);
  }
`;

const UV_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* ---------- The pack ---------- */

function PackRig({ pack, ctl }: { pack: PackDef; ctl: React.RefObject<Control> }) {
  const entered = useRef(false);
  const map = useLoader(TextureLoader, pack.image);
  const accent = useMemo(() => hexToRgb(pack.accent), [pack.accent]);
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const strip = useRef<Mesh>(null);
  const glow = useRef<Mesh>(null);
  const tornAt = useRef<number | null>(null);

  const geometry = useMemo(() => new PlaneGeometry(PACK_W, PACK_H, 48, 84), []);
  const [bodyMat, stripMat] = useMemo(
    () =>
      [1, -1].map(
        (side) =>
          new ShaderMaterial({
            vertexShader: PACK_VERTEX,
            fragmentShader: PACK_FRAGMENT,
            transparent: true,
            side: DoubleSide,
            uniforms: {
              uMap: { value: map },
              uTime: { value: 0 },
              uTilt: { value: [0, 0] },
              uCut: { value: 0 },
              uSide: { value: side },
              uOpacity: { value: 1 },
              uAccent: { value: accent },
              uBulge: { value: 0.16 },
            },
          }),
      ),
    [map, accent],
  );
  const glowMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: UV_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
        uniforms: { uT: { value: 0 }, uAccent: { value: accent } },
      }),
    [accent],
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const t = state.clock.elapsedTime;
    const c = ctl.current;
    const g = group.current;
    if (!g || !body.current || !strip.current || !glow.current) return;
    // Uniforms are reached through the meshes: the scene graph owns them, not React.
    const bodyU = (body.current.material as ShaderMaterial).uniforms;
    const stripU = (strip.current.material as ShaderMaterial).uniforms;
    const glowU = (glow.current.material as ShaderMaterial).uniforms;

    if (!entered.current) {
      // Arrive with a half turn, then settle onto the pointer.
      entered.current = true;
      g.rotation.y = -1.6;
      g.scale.setScalar(0.82);
    }

    if (c.torn && tornAt.current === null) tornAt.current = t;
    const e = tornAt.current === null ? -1 : t - tornAt.current;

    // Follow the pointer, sway gently when left alone.
    const idle = c.pointer.inside ? 0 : 1;
    const ry = c.pointer.x * 0.42 + Math.sin(t * 0.7) * 0.14 * idle;
    const rx = -c.pointer.y * 0.3 + Math.sin(t * 0.9 + 1) * 0.05 * idle;
    const k = 1 - Math.exp(-dt * 7);
    g.rotation.y += (ry - g.rotation.y) * k;
    g.rotation.x += (rx - g.rotation.x) * k;

    const bob = Math.sin(t * 1.4) * 0.06;
    for (const u of [bodyU, stripU]) {
      u.uTime.value = t;
      u.uTilt.value = [g.rotation.y, g.rotation.x];
      u.uCut.value = c.progress;
    }

    if (e < 0) {
      g.position.y = bob;
      // Anticipation: the pack tenses as the cut gets longer.
      const tense = c.progress * c.progress;
      const target = 1 + tense * 0.04;
      g.scale.setScalar(g.scale.x + (target - g.scale.x) * (1 - Math.exp(-dt * 6)));
      g.position.x = Math.sin(t * 60) * 0.008 * tense;
      return;
    }

    // Torn: the strip rips off and spins away, the pack sinks, light pours out.
    strip.current.position.set(e * 2.2, e * 2.8 - 2.5 * e * e, e * 0.9);
    strip.current.rotation.set(e * 0.8, e * 1.2, -e * 2.4);
    stripU.uOpacity.value = Math.max(0, 1 - e / 0.7);

    const sink = Math.max(0, e - 0.2);
    body.current.position.y = -sink * sink * 6;
    body.current.rotation.x = sink * 0.35;
    bodyU.uOpacity.value = Math.max(0, 1 - sink / 0.55);
    g.position.y = bob * Math.max(0, 1 - e * 3);

    glow.current.visible = true;
    glowU.uT.value = e;
    glow.current.scale.setScalar(1 + e * 3.2);
  });

  return (
    <group ref={group}>
      <mesh ref={body} geometry={geometry} material={bodyMat} />
      <mesh ref={strip} geometry={geometry} material={stripMat} renderOrder={2} />
      <mesh
        ref={glow}
        visible={false}
        material={glowMat}
        position={[0, PACK_H / 2 - TEAR_FROM_TOP * PACK_H, 0.3]}
        renderOrder={4}
      >
        <planeGeometry args={[2.6, 2.6]} />
      </mesh>
      <Sparks ctl={ctl} accent={accent} />
    </group>
  );
}

/* ---------- Shared canvas ---------- */

function PackCanvas({
  pack,
  ctl,
  layout,
}: {
  pack: PackDef;
  ctl: React.RefObject<Control>;
  layout: PackLayout;
}) {
  return (
    <Canvas
      flat
      linear
      dpr={[1, 2]}
      camera={{ fov: FOV, position: [0, 0, 10] }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <FitCamera layout={layout} />
      <Suspense fallback={null}>
        <PackRig key={pack.id} pack={pack} ctl={ctl} />
      </Suspense>
    </Canvas>
  );
}

const idleControl = (): Control => ({
  progress: 0,
  dragging: false,
  torn: false,
  pointer: { x: 0, y: 0, inside: false },
});

function trackPointer(ctl: React.RefObject<Control>, event: React.PointerEvent<HTMLElement>) {
  const r = event.currentTarget.getBoundingClientRect();
  ctl.current.pointer = {
    x: ((event.clientX - r.left) / r.width) * 2 - 1,
    y: ((event.clientY - r.top) / r.height) * 2 - 1,
    inside: true,
  };
}

function releasePointer(ctl: React.RefObject<Control>) {
  ctl.current.pointer = { x: 0, y: 0, inside: false };
}

/* ---------- Showcase: the selected pack, turning on the shelf ---------- */

export function PackShowcase({ pack }: { pack: PackDef }) {
  const ctl = useRef<Control>(idleControl());
  const box = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(box);
  const packPx = Math.min(height * 0.86, (width * 0.8) / PACK_RATIO);
  const layout = useMemo(() => ({ packPx, centerY: height / 2, height }), [packPx, height]);
  return (
    <div ref={box} className="relative h-full w-full" onPointerMove={(event) => trackPointer(ctl, event)}
      onPointerLeave={() => releasePointer(ctl)}
    >
      <div
        aria-hidden
        className="absolute left-1/2 h-8 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(6_3_30/0.55),transparent)]"
        style={{ top: height / 2 + packPx / 2 + 6, width: packPx * PACK_RATIO * 0.8 }}
      />
      {height > 0 && <PackCanvas pack={pack} ctl={ctl} layout={layout} />}
    </div>
  );
}

/* ---------- Opening: full-screen pack, gesture band, keyboard path ---------- */

export default function Pack3D({
  pack,
  onCommit,
  onTorn,
}: {
  pack: PackDef;
  onCommit: () => void;
  onTorn: () => void;
}) {
  const ctl = useRef<Control>(idleControl());
  const [torn, setTorn] = useState(false);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const lastX = useRef<number | null>(null);
  const travelled = useRef(0);

  const { width, height } = useSize(box);
  const packPx = Math.max(240, Math.min(height * 0.62, 500, (width * 0.72) / PACK_RATIO));
  const packW = packPx * PACK_RATIO;
  const centerY = height * 0.5;
  const top = centerY - packPx / 2;
  const tearY = top + TEAR_FROM_TOP * packPx;
  const layout = useMemo(() => ({ packPx, centerY, height }), [packPx, centerY, height]);

  function complete() {
    if (ctl.current.torn) return;
    ctl.current.torn = true;
    ctl.current.progress = 1;
    setTorn(true);
    onCommit();
    setTimeout(onTorn, 900);
  }

  function onBandDown(event: React.PointerEvent<HTMLDivElement>) {
    if (ctl.current.torn) return;
    band.current?.setPointerCapture(event.pointerId);
    lastX.current = event.clientX;
    ctl.current.dragging = true;
    setDragging(true);
  }

  function onBandMove(event: React.PointerEvent<HTMLDivElement>) {
    if (lastX.current === null || ctl.current.torn || !band.current) return;
    travelled.current += Math.abs(event.clientX - lastX.current) / packW;
    lastX.current = event.clientX;
    const value = Math.min(1, travelled.current / 0.8);
    ctl.current.progress = value;
    // Past halfway the swipe is a commitment: start the server draw now.
    if (value > 0.5) onCommit();
    if (value >= 1) complete();
  }

  function onBandUp() {
    lastX.current = null;
    ctl.current.dragging = false;
    setDragging(false);
    if (!ctl.current.torn) {
      travelled.current = 0;
      const from = ctl.current.progress;
      const start = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - start) / 260);
        if (!ctl.current.torn && !ctl.current.dragging) {
          ctl.current.progress = from * (1 - p) * (1 - p);
          if (p < 1) requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    }
  }

  function openWithoutSwipe() {
    if (ctl.current.torn) return;
    onCommit();
    const start = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / 650);
      ctl.current.progress = p;
      ctl.current.dragging = true;
      if (p < 1) requestAnimationFrame(step);
      else {
        ctl.current.dragging = false;
        complete();
      }
    };
    requestAnimationFrame(step);
  }

  return (
    <div ref={box} className="absolute inset-0 select-none" onPointerMove={(event) => trackPointer(ctl, event)}
      onPointerLeave={() => releasePointer(ctl)}
    >
      {height > 0 && (
        <>
          <div
            aria-hidden
            className="absolute left-1/2 h-10 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(6_3_30/0.55),transparent)] transition-opacity duration-500"
            style={{ top: top + packPx + 8, width: packW * 0.85, opacity: torn ? 0 : 1 }}
          />
          <PackCanvas pack={pack} ctl={ctl} layout={layout} />

          <p
            className="title-drop absolute inset-x-0 px-5 text-center font-display text-lg"
            style={{ top: Math.max(16, top - 64) }}
            aria-live="polite"
          >
            {torn ? "Ouverture…" : "Glisse le long du haut du pack pour le déchirer"}
          </p>

          {!dragging && !torn && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute flex size-9 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg"
              style={{ top: tearY - 18 }}
              animate={{
                left: [`calc(50% - ${packW / 2 + 18}px)`, `calc(50% + ${packW / 2 - 18}px)`],
                opacity: [0, 1, 1, 0],
              }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.4, ease: "easeInOut" }}
            >
              <ChevronsRight className="size-5" />
            </motion.div>
          )}

          <div
            ref={band}
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 cursor-grab touch-none active:cursor-grabbing"
            style={{ top: top - 40, height: tearY - top + 100, width: packW + 80 }}
            onPointerDown={onBandDown}
            onPointerMove={onBandMove}
            onPointerUp={onBandUp}
            onPointerCancel={onBandUp}
          />

          <button
            type="button"
            onClick={openWithoutSwipe}
            disabled={torn}
            className="btn btn-sm absolute left-1/2 -translate-x-1/2 disabled:invisible"
            style={{ top: top + packPx + 44 }}
          >
            Ouvrir sans glisser
          </button>
        </>
      )}
    </div>
  );
}
