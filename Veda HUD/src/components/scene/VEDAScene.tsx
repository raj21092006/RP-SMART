import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { AssistantMode, Quality } from '../../types';

type SceneProps = { mode: AssistantMode; quality: Quality; reducedMotion: boolean; focused: string | null; parallax: { x: number; y: number }; sound: boolean };
const cyan = '#35d9ff';

function Dust({ count, performance, reducedMotion }: { count: number; performance: boolean; reducedMotion: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const points = useMemo(() => Array.from({ length: count }, () => new THREE.Vector3((Math.random() - .5) * 34, (Math.random() - .5) * 18, (Math.random() - .5) * 13)), [count]);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    points.forEach((point, i) => {
      dummy.position.set(point.x, point.y + Math.sin(t * .16 + i) * .12 * (reducedMotion ? .16 : 1), point.z);
      dummy.scale.setScalar(.014 + ((i * 17) % 7) * .003);
      dummy.updateMatrix(); mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, count]}><sphereGeometry args={[1, performance ? 4 : 6, performance ? 4 : 6]} /><meshBasicMaterial color="#7bdcff" transparent opacity={.54} /></instancedMesh>;
}

function Temple({ position, scale, flip = false }: { position: [number, number, number]; scale: number; flip?: boolean }) {
  return <group position={position} scale={[flip ? -scale : scale, scale, scale]}>
    <mesh position={[0, 1.35, 0]}><cylinderGeometry args={[.08, .43, 2.6, 5]} /><meshStandardMaterial color="#b17a3c" emissive="#b66b22" emissiveIntensity={.2} roughness={.8} /></mesh>
    <mesh position={[0, .05, 0]}><boxGeometry args={[1.08, .18, .9]} /><meshStandardMaterial color="#80562d" emissive="#9b5519" emissiveIntensity={.18} /></mesh>
    <mesh position={[0, .65, .36]}><boxGeometry args={[.48, 1.02, .12]} /><meshStandardMaterial color="#07111b" emissive="#2289ae" emissiveIntensity={.13} /></mesh>
    {[.52, .92, 1.3, 1.66, 2.02].map((y, i) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[.12 + (i * .055), .48 - (i * .054), .22, 5]} /><meshStandardMaterial color="#aa743a" emissive="#d28432" emissiveIntensity={.24} transparent opacity={.75} /></mesh>)}
    <mesh position={[0, -.05, 0]}><boxGeometry args={[1.5, .12, 1.12]} /><meshBasicMaterial color="#ffae35" transparent opacity={.28} /></mesh>
  </group>;
}

function Environment({ performance, reducedMotion }: { performance: boolean; reducedMotion: boolean }) {
  const skyline = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (skyline.current) skyline.current.position.y = Math.sin(clock.elapsedTime * .2) * .025 * (reducedMotion ? .15 : 1); });
  return <>
    <color attach="background" args={['#03070d']} />
    <fog attach="fog" args={['#030b15', 12, 39]} />
    <ambientLight intensity={.28} color="#76baff" />
    <pointLight position={[0, 3.5, -3]} intensity={3.8} distance={17} color="#087eff" />
    <pointLight position={[-8, 2, 0]} intensity={2.2} distance={11} color="#075c9e" />
    <pointLight position={[7, 1.2, -2]} intensity={1.4} distance={10} color="#ffae35" />
    <directionalLight position={[0, 7, 3]} intensity={.6} color="#9cecff" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.42, -1]}><planeGeometry args={[50, 36]} /><meshStandardMaterial color="#030910" metalness={.6} roughness={.34} /></mesh>
    <gridHelper args={[40, 56, '#0b3952', '#071a29']} position={[0, -3.39, -1]} />
    <group ref={skyline}>
      <Temple position={[-8.65, -3.37, -5.5]} scale={.82} />
      <Temple position={[8.85, -3.37, -6.4]} scale={.72} flip />
    </group>
    {!performance && <Sparkles count={36} scale={[22, 7, 12]} size={1.4} speed={reducedMotion ? .025 : .18} opacity={.42} color="#35d9ff" position={[0, 1.4, -4]} />}
  </>;
}

function RadialTicks({ radius, count, color, length = .12, y = 0 }: { radius: number; count: number; color: string; length?: number; y?: number }) {
  const ticks = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2;
    const major = i % Math.max(1, Math.round(count / 12)) === 0;
    const r1 = radius - (major ? length * 1.7 : length * .65);
    const r2 = radius + (major ? length * 1.7 : length * .65);
    return [[Math.cos(angle) * r1, Math.sin(angle) * r1, y], [Math.cos(angle) * r2, Math.sin(angle) * r2, y]] as [[number, number, number], [number, number, number]];
  }), [count, length, radius, y]);
  return <group>{ticks.map((points, i) => <Line key={i} points={points} color={color} lineWidth={i % Math.max(1, Math.round(count / 12)) === 0 ? 1.35 : .7} transparent opacity={i % Math.max(1, Math.round(count / 12)) === 0 ? .78 : .3} />)}</group>;
}

function GaugeCluster({ reducedMotion }: { reducedMotion: boolean }) {
  const { viewport } = useThree();
  const refs = useRef<(THREE.Group | null)[]>([]);
  const values = [.18, .42, .12, .49];
  const tones = ['#35d9ff', '#168bff', '#35d9ff', '#ffae35'];
  useFrame(({ clock }) => refs.current.forEach((group, i) => {
    if (!group) return;
    const pulse = Math.sin(clock.elapsedTime * .8 + i) * .025 * (reducedMotion ? .12 : 1);
    group.scale.setScalar(1 + pulse);
  }));
  if (viewport.width < 14) return null;
  const x = viewport.width * .365;
  const centerY = 3.14;
  return <group>
    {values.map((value, i) => <group key={i} ref={node => { refs.current[i] = node; }} position={[x + (i - 1.5) * .87, centerY, -1.1]}>
      <mesh><torusGeometry args={[.31, .028, 8, 52]} /><meshBasicMaterial color="#254658" transparent opacity={.78} /></mesh>
      <mesh rotation={[0, 0, -Math.PI / 2]}><torusGeometry args={[.31, .031, 8, 52, value * Math.PI * 2]} /><meshStandardMaterial color={tones[i]} emissive={tones[i]} emissiveIntensity={1.9} toneMapped={false} /></mesh>
      <mesh position={[0, 0, .012]}><circleGeometry args={[.255, 40]} /><meshBasicMaterial color="#07141e" transparent opacity={.68} /></mesh>
      <pointLight position={[0, 0, .2]} color={tones[i]} intensity={.16} distance={.9} />
    </group>)}
  </group>;
}

function LotusPetal({ index, count, color, inner = false }: { index: number; count: number; color: string; inner?: boolean }) {
  const angle = index / count * Math.PI * 2;
  const petal = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.bezierCurveTo(-.12, .2, -.23, .59, 0, .9); shape.bezierCurveTo(.23, .59, .12, .2, 0, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .065, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 2, steps: 1, curveSegments: 8 });
    geometry.computeVertexNormals(); return geometry;
  }, []);
  return <mesh geometry={petal} position={[Math.sin(angle) * (inner ? .1 : .03), 0, Math.cos(angle) * (inner ? .1 : .03)]} rotation={[inner ? -.65 : -.84, angle, 0]} scale={inner ? .59 : .93}>
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.15} metalness={.55} roughness={.25} transparent opacity={.94} side={THREE.DoubleSide} />
  </mesh>;
}

function Lotus({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (group.current) { const motion = reducedMotion ? .16 : 1; group.current.position.y = .12 + Math.sin(clock.elapsedTime * .82) * .09 * motion; group.current.rotation.y = Math.sin(clock.elapsedTime * .18) * .08 * motion; } });
  return <group ref={group}>
    <mesh><sphereGeometry args={[.19, 24, 24]} /><meshStandardMaterial color="#ffcf68" emissive="#ff9d29" emissiveIntensity={3.2} metalness={.55} roughness={.19} /></mesh>
    {Array.from({ length: 8 }, (_, i) => <LotusPetal key={`outer-${i}`} index={i} count={8} color={i % 2 ? '#ffae35' : '#ffd36a'} />)}
    {Array.from({ length: 6 }, (_, i) => <LotusPetal key={`inner-${i}`} index={i + .5} count={6} color="#ffe8a0" inner />)}
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -.15, 0]}><torusGeometry args={[.68, .018, 6, 56]} /><meshBasicMaterial color="#ffae35" transparent opacity={.75} /></mesh>
  </group>;
}

function OrbitingMarker({ radius, speed, offset, color, size = .055, reducedMotion }: { radius: number; speed: number; offset: number; color: string; size?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { const t = clock.elapsedTime * speed * (reducedMotion ? .18 : 1) + offset; ref.current?.position.set(Math.cos(t) * radius, Math.sin(t * .66) * .1, Math.sin(t) * radius); });
  return <mesh ref={ref}><octahedronGeometry args={[size, 0]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>;
}

function IntelligenceCore({ mode, reducedMotion, performance }: { mode: AssistantMode; reducedMotion: boolean; performance: boolean }) {
  const core = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Group>(null); const ringB = useRef<THREE.Group>(null); const ringC = useRef<THREE.Group>(null); const halo = useRef<THREE.Mesh>(null);
  const active = mode === 'listening' || mode === 'thinking' || mode === 'speaking' || mode === 'success';
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const mult = mode === 'thinking' ? 2.6 : mode === 'listening' ? 1.65 : active ? 1.35 : .48;
    const freeze = reducedMotion ? .22 : 1;
    if (core.current) { core.current.position.y = Math.sin(t * .32) * .035 * freeze; core.current.scale.setScalar((mode === 'offline' ? .84 : 1) * (1 + (active ? Math.sin(t * 5) * .018 : Math.sin(t * .7) * .012) * freeze)); }
    if (ringA.current) ringA.current.rotation.y = t * .16 * mult * freeze;
    if (ringB.current) ringB.current.rotation.y = -t * .28 * mult * freeze;
    if (ringC.current) ringC.current.rotation.set(.18, t * .21 * mult * freeze, .2 + Math.sin(t * .13) * .08);
    if (halo.current) { const material = halo.current.material as THREE.MeshBasicMaterial; material.opacity = .1 + (Math.sin(t * (active ? 5 : .9)) + 1) * (active ? .09 : .035); }
  });
  return <group ref={core} position={[0, -.12, 0]}>
    <mesh ref={halo} position={[0, 0, -.24]}><circleGeometry args={[1.16, 64]} /><meshBasicMaterial color="#1382a9" transparent opacity={.055} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <mesh><torusGeometry args={[2.2, .018, 6, 144]} /><meshBasicMaterial color="#118cc4" transparent opacity={.38} /></mesh>
    <mesh><torusGeometry args={[1.8, .012, 6, 120]} /><meshBasicMaterial color="#39cfff" transparent opacity={.58} /></mesh>
    <group ref={ringA}><mesh><torusGeometry args={[1.97, .035, 8, 128, Math.PI * 1.56]} /><meshStandardMaterial color="#35d9ff" emissive="#078de3" emissiveIntensity={2.2} metalness={.45} roughness={.24} /></mesh><RadialTicks radius={2.12} count={72} color="#57dfff" /></group>
    <group ref={ringB} rotation={[0, 0, .2]}><mesh><torusGeometry args={[1.62, .025, 8, 128, Math.PI * 1.3]} /><meshStandardMaterial color="#168bff" emissive="#0876db" emissiveIntensity={2.4} /></mesh><RadialTicks radius={1.69} count={48} color="#168bff" length={.09} /></group>
    <group ref={ringC}><mesh><torusGeometry args={[1.31, .012, 6, 100, Math.PI * 1.45]} /><meshBasicMaterial color="#ffae35" toneMapped={false} transparent opacity={.76} /></mesh>{!performance && <RadialTicks radius={1.12} count={56} color="#9aeaff" length={.065} />}</group>
    <group><mesh><ringGeometry args={[.92, 1.02, 80]} /><meshBasicMaterial color="#0b3247" transparent opacity={.68} side={THREE.DoubleSide} /></mesh><mesh><ringGeometry args={[.88, .9, 80]} /><meshBasicMaterial color="#39d9ff" transparent opacity={.8} side={THREE.DoubleSide} /></mesh></group>
    {[0, 1, 2, 3, 4, 5].map(i => <OrbitingMarker key={i} radius={1.76 + (i % 2) * .3} speed={i % 2 ? -.28 : .2} offset={i * 1.05} color={i % 3 ? cyan : '#ffbf4e'} size={i % 2 ? .052 : .075} reducedMotion={reducedMotion} />)}
    {!performance && <Sparkles count={32} scale={[4.1, .42, 4.1]} size={2} speed={reducedMotion ? .06 : .45} opacity={.58} color="#57dfff" />}
    <pointLight position={[0, .4, .1]} color={mode === 'error' ? '#ff647c' : '#17aaff'} intensity={mode === 'offline' ? .72 : mode === 'thinking' ? 4.5 : 2.6} distance={6} />
    <pointLight position={[0, -.3, 0]} color="#ffae35" intensity={1.1} distance={3.2} />
    <Lotus reducedMotion={reducedMotion} />
    <Html center position={[0, -.62, .28]} distanceFactor={7} zIndexRange={[20, 0]}>
      <div className="core-wordmark" aria-hidden="true"><strong>VEDA</strong><span>AI ASSISTANT</span></div>
    </Html>
    <Html center position={[0, 1.55, 0]} distanceFactor={8} zIndexRange={[20, 0]}>
    </Html>
  </group>;
}

function Platform({ mode, reducedMotion }: { mode: AssistantMode; reducedMotion: boolean }) {
  const outer = useRef<THREE.Mesh>(null); const inner = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const s = reducedMotion ? .2 : 1;
    if (outer.current) outer.current.rotation.z = t * .11 * s;
    if (inner.current) inner.current.rotation.z = -t * .18 * s;
  });
  const beamColor = mode === 'error' ? '#ff647c' : '#19bbff';
  return <group position={[0, -3.22, -.28]}>
    <mesh position={[0, .07, 0]} rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[2.55, 2.85, .22, 96, 1, true]} /><meshStandardMaterial color="#0b2030" emissive="#0878a8" emissiveIntensity={.9} metalness={.8} roughness={.28} side={THREE.DoubleSide} transparent opacity={.78} /></mesh>
    <mesh position={[0, .19, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[2.72, .032, 8, 120]} /><meshBasicMaterial color="#ffae35" toneMapped={false} /></mesh>
    <mesh ref={outer} position={[0, .19, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[2.34, .025, 8, 120]} /><meshStandardMaterial color={beamColor} emissive={beamColor} emissiveIntensity={3} /></mesh>
    <mesh ref={inner} position={[0, .2, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[1.84, .015, 6, 100]} /><meshBasicMaterial color="#69eaff" transparent opacity={.82} /></mesh>
    <mesh position={[0, .35, 0]}><cylinderGeometry args={[.04, .33, 5.9, 24, 1, true]} /><meshBasicMaterial color={beamColor} transparent opacity={mode === 'idle' ? .075 : .16} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    <mesh position={[0, 3.12, 0]}><sphereGeometry args={[.2, 20, 20]} /><meshBasicMaterial color="#d2f9ff" transparent opacity={.56} /></mesh>
    {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[Math.cos(i * Math.PI / 4) * 2.54, .22, Math.sin(i * Math.PI / 4) * 2.54]}><boxGeometry args={[.18, .07, .09]} /><meshBasicMaterial color={i % 2 ? '#35d9ff' : '#ffae35'} toneMapped={false} /></mesh>)}
    <pointLight position={[0, .15, 0]} color={beamColor} intensity={mode === 'thinking' ? 4 : 2} distance={6} />
  </group>;
}

function SilhouetteFigure({ reducedMotion }: { reducedMotion: boolean }) {
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (body.current) { const motion = reducedMotion ? .16 : 1; body.current.position.y = -.26 + Math.sin(clock.elapsedTime * .72) * .045 * motion; body.current.rotation.y = Math.sin(clock.elapsedTime * .25) * .035 * motion; } });
  return <group ref={body} position={[-7.25, -.24, -1.9]} scale={1.16}>
    <mesh position={[0, 1.55, 0]}><sphereGeometry args={[.48, 18, 20]} /><meshStandardMaterial color="#0e344a" emissive="#087bab" emissiveIntensity={1.1} wireframe transparent opacity={.74} /></mesh>
    <mesh position={[0, 1.55, .25]} scale={[.42, .48, .16]}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#35d9ff" wireframe transparent opacity={.62} /></mesh>
    <mesh position={[0, .56, 0]} rotation={[0, 0, Math.PI]}><cylinderGeometry args={[.22, 1.02, 1.8, 8, 3, true]} /><meshStandardMaterial color="#0e3c56" emissive="#087fb0" emissiveIntensity={.86} wireframe transparent opacity={.78} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 2.09, 0]}><cylinderGeometry args={[.08, .38, .58, 8]} /><meshStandardMaterial color="#965c24" emissive="#e89a35" emissiveIntensity={.55} wireframe transparent opacity={.9} /></mesh>
    {[-1, 1].map(side => <group key={side} position={[side * .48, 1.92, 0]} rotation={[0, 0, side * -.42]}>{[0, 1, 2].map(i => <mesh key={i} position={[side * i * .13, .16 + i * .12, 0]} rotation={[0, 0, side * -.24]}><torusGeometry args={[.22 - i * .025, .023, 5, 20, Math.PI]} /><meshBasicMaterial color={i === 1 ? '#ffae35' : '#35d9ff'} transparent opacity={.7} /></mesh>)}</group>)}
    <mesh position={[0, .05, 0]}><torusGeometry args={[1.06, .012, 4, 48, Math.PI]} /><meshBasicMaterial color="#35d9ff" transparent opacity={.55} /></mesh>
    <pointLight position={[0, 1, .3]} color="#079dff" intensity={1.35} distance={4} />
  </group>;
}

function FloatingFrame({ position, size, tone = cyan, phase = 0, reducedMotion }: { position: [number, number, number]; size: [number, number]; tone?: string; phase?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * .68 + phase) * .035 * (reducedMotion ? .12 : 1); });
  return <group ref={ref} position={position}>
    <mesh><boxGeometry args={[size[0], size[1], .22]} /><meshPhysicalMaterial color="#04121d" emissive="#06334b" emissiveIntensity={.64} metalness={.58} roughness={.3} transparent opacity={.38} transmission={.16} /></mesh>
    <mesh position={[0, 0, .13]}><boxGeometry args={[size[0], size[1], .02]} /><meshBasicMaterial color={tone} transparent opacity={.035} /></mesh>
    <mesh position={[0, 0, .15]}><boxGeometry args={[size[0] + .04, size[1] + .04, .028]} /><meshBasicMaterial color={tone} wireframe transparent opacity={.2} /></mesh>
    {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, y], i) => <mesh key={i} position={[x * (size[0] / 2 - .11), y * (size[1] / 2 - .11), .18]}><boxGeometry args={[.2, .025, .035]} /><meshBasicMaterial color={i === 3 ? '#ffae35' : tone} toneMapped={false} /></mesh>)}
    <pointLight position={[0, 0, .55]} color={tone} intensity={.18} distance={2.5} />
  </group>;
}

function PanelFrames({ focused, reducedMotion }: { focused: string | null; reducedMotion: boolean }) {
  const { viewport } = useThree();
  if (viewport.width < 14) return null;
  const x = viewport.width * .365;
  const spread = focused ? .15 : 0;
  return <group position={[focused?.startsWith('left') ? spread : focused?.startsWith('right') ? -spread : 0, 0, focused ? -.55 : -1.05]}>
    <FloatingFrame position={[-x, 3.12, 0]} size={[4.95, 1.82]} phase={.4} reducedMotion={reducedMotion} />
    <FloatingFrame position={[-x, .91, -.05]} size={[4.95, 2.32]} phase={1.1} tone="#168bff" reducedMotion={reducedMotion} />
    <FloatingFrame position={[-x, -1.68, -.05]} size={[4.95, 1.96]} phase={1.4} reducedMotion={reducedMotion} />
    <FloatingFrame position={[x, 3.12, -.1]} size={[4.95, 2.18]} phase={1.8} tone="#168bff" reducedMotion={reducedMotion} />
    <FloatingFrame position={[x, .91, -.06]} size={[4.95, 2.04]} phase={.9} reducedMotion={reducedMotion} />
    <FloatingFrame position={[x, -1.68, -.12]} size={[4.95, 2.32]} phase={2.2} tone="#168bff" reducedMotion={reducedMotion} />
  </group>;
}

function VoicePlatform({ mode, reducedMotion }: { mode: AssistantMode; reducedMotion: boolean }) {
  const ring = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (ring.current) { const speed = mode === 'thinking' ? 1.4 : .5; ring.current.rotation.z = clock.elapsedTime * speed * (reducedMotion ? .18 : 1); } });
  return <group position={[0, -3.56, 2.1]}>
    <mesh><cylinderGeometry args={[1.1, 1.16, .18, 64]} /><meshStandardMaterial color="#061725" emissive="#086898" emissiveIntensity={.65} metalness={.72} roughness={.2} transparent opacity={.88} /></mesh>
    <group ref={ring}>{[1.28, 1.4, 1.56].map((radius, i) => <mesh key={radius}><torusGeometry args={[radius, i === 1 ? .023 : .012, 7, 72]} /><meshBasicMaterial color={i === 2 ? '#ffae35' : '#35d9ff'} transparent opacity={i === 2 ? .7 : .85} /></mesh>)}</group>
    <pointLight position={[0, .2, 0]} color={mode === 'error' ? '#ff647c' : '#16bdff'} intensity={mode === 'listening' ? 2.3 : .8} distance={3.5} />
    {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[(i - 4) * .19, .27 + Math.sin(i * 1.8) * .11, .32]}><boxGeometry args={[.045, .13 + Math.sin(i * 1.2) ** 2 * .25, .045]} /><meshBasicMaterial color={mode === 'error' ? '#ff647c' : '#70eaff'} toneMapped={false} /></mesh>)}
  </group>;
}

function CameraController({ focused, parallax, mode }: { focused: string | null; parallax: { x: number; y: number }; mode: AssistantMode }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3());
  useFrame(() => {
    const side = focused?.startsWith('left') ? -1 : focused?.startsWith('right') ? 1 : 0;
    const targetX = parallax.x * .38 + side * .22;
    const targetY = -parallax.y * .22 + (mode === 'thinking' ? .04 : 0);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 1.7, .016);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 1.7, .016);
    look.current.set(targetX * .08, targetY * .08, 0); camera.lookAt(look.current);
  });
  return null;
}

function SceneContent({ mode, quality, reducedMotion, focused, parallax }: SceneProps) {
  const performance = quality === 'performance';
  return <>
    <Environment performance={performance} reducedMotion={reducedMotion} />
    <Dust count={quality === 'high' ? 210 : quality === 'balanced' ? 120 : 54} performance={performance} reducedMotion={reducedMotion} />
    <SilhouetteFigure reducedMotion={reducedMotion} />
    <PanelFrames focused={focused} reducedMotion={reducedMotion} />
    <GaugeCluster reducedMotion={reducedMotion} />
    <IntelligenceCore mode={mode} reducedMotion={reducedMotion} performance={performance} />
    <Platform mode={mode} reducedMotion={reducedMotion} />
    <VoicePlatform mode={mode} reducedMotion={reducedMotion} />
    <CameraController focused={focused} parallax={parallax} mode={mode} />
  </>;
}

export default function VEDAScene(props: SceneProps) {
  const dpr: [number, number] = props.quality === 'high' ? [1, 1.65] : props.quality === 'balanced' ? [1, 1.35] : [1, 1.05];
  return <Canvas className="veda-canvas" dpr={dpr} camera={{ position: [0, 0, 16], fov: 43, near: .1, far: 100 }} gl={{ antialias: props.quality !== 'performance', alpha: false, powerPreference: 'high-performance' }}>
    <SceneContent {...props} />
  </Canvas>;
}
