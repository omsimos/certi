import {
  Canvas,
  createPortal,
  useFrame,
  useThree,
  type GLProps,
  type ThreeEvent,
} from "@react-three/fiber";
import { Lightformer, useGLTF, useTexture } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { CubeRenderTarget, WebGPURenderer } from "three/webgpu";
import type { GLTF } from "three-stdlib";

import { createBadgeTexture } from "./badge-texture";

const MODEL_URL = "/models/tag.glb";
const BAND_TEXTURE_URL = "/band.jpg";
// curve.getPoints(32) gave meshline 33 points.
const BAND_POINTS = 33;
// The width meshline gave the band (lineWidth 1, size-attenuated) under this camera's fov of 25.
const BAND_HALF_WIDTH = Math.tan(THREE.MathUtils.degToRad(25 / 2)) / 2;

type BadgeGLTF = GLTF & {
  nodes: Record<"card" | "clip" | "clamp", THREE.Mesh>;
  materials: Record<"base" | "metal", THREE.MeshStandardMaterial>;
};

type Attendee = { firstName: string; lastName: string };

useGLTF.preload(MODEL_URL);
useTexture.preload(BAND_TEXTURE_URL);

export default function Badge3D({ attendee }: { attendee: Attendee }) {
  // The physics collider overlay is a dev aid only: `?debug` in the URL turns it on.
  const [debug] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has("debug"),
  );

  return (
    <Canvas camera={{ position: [0, 0, 13], fov: 25 }} gl={createRenderer}>
      <ambientLight intensity={Math.PI} />
      <Physics debug={debug} interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
        <Band attendee={attendee} />
      </Physics>
      <LightformerEnvironment blur={0.75}>
        <Lightformer
          intensity={2}
          color="white"
          position={[0, -1, 5]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={3}
          color="white"
          position={[-1, -1, 1]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={3}
          color="white"
          position={[1, 1, 1]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={10}
          color="white"
          position={[-10, 0, 14]}
          rotation={[0, Math.PI / 2, Math.PI / 3]}
          scale={[100, 10, 1]}
        />
      </LightformerEnvironment>
    </Canvas>
  );
}

type RendererFactory = Extract<GLProps, (props: never) => unknown>;

/** WebGPU where the browser has it; three falls back to WebGL2 on its own when init() fails. */
async function createRenderer({ canvas }: Parameters<RendererFactory>[0]) {
  const renderer = new WebGPURenderer({
    // r3f's web <Canvas> always hands over a DOM canvas. Its OffscreenCanvas type comes from the
    // Workers lib and clashes with the DOM one three expects.
    canvas: canvas as HTMLCanvasElement,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    // `?webgl` in dev forces the fallback, to check it in a browser that has WebGPU.
    forceWebGL: import.meta.env.DEV && new URLSearchParams(window.location.search).has("webgl"),
  });
  await renderer.init();
  // Exposes the backend to DevTools: document.querySelector("canvas").dataset.backend. The WebGL2
  // backend leaves isWebGPUBackend undefined rather than false.
  const isWebGPU = "isWebGPUBackend" in renderer.backend && renderer.backend.isWebGPUBackend;
  renderer.domElement.dataset.backend = isWebGPU ? "webgpu" : "webgl2";
  return renderer;
}

/**
 * drei's <Environment> with children, rebuilt on three's CubeRenderTarget. drei renders into a
 * WebGLCubeRenderTarget, which the WebGL2 fallback backend doesn't recognise as a cube target.
 * Renders the lightformers once, then lights and backs the scene with the result.
 */
function LightformerEnvironment({ blur, children }: { blur: number; children: ReactNode }) {
  const get = useThree((state) => state.get);
  const [virtualScene] = useState(() => new THREE.Scene());
  const [target] = useState(() => new CubeRenderTarget(256, { type: THREE.HalfFloatType }));
  const [cubeCamera] = useState(() => new THREE.CubeCamera(0.1, 1000, target));

  useLayoutEffect(() => {
    // r3f types its renderer as WebGLRenderer whatever the factory returned.
    const gl = get().gl as unknown as WebGPURenderer;
    const scene = get().scene;
    const autoClear = gl.autoClear;
    gl.autoClear = true;
    cubeCamera.update(gl, virtualScene);
    gl.autoClear = autoClear;

    const previous = {
      environment: scene.environment,
      background: scene.background,
      backgroundBlurriness: scene.backgroundBlurriness,
    };
    scene.environment = target.texture;
    scene.background = target.texture;
    scene.backgroundBlurriness = blur;
    return () => {
      Object.assign(scene, previous);
    };
  }, [get, virtualScene, target, cubeCamera, blur]);

  useEffect(() => () => target.dispose(), [target]);

  return createPortal(children, virtualScene);
}

const segmentProps = {
  type: "dynamic",
  canSleep: true,
  colliders: false,
  angularDamping: 2,
  linearDamping: 2,
} as const;

function Band({
  maxSpeed = 50,
  minSpeed = 10,
  attendee,
}: {
  maxSpeed?: number;
  minSpeed?: number;
  attendee: Attendee;
}) {
  // The joint hooks type their refs as non-null even though they only read them after mount.
  const fixed = useRef<RapierRigidBody>(null!);
  const j1 = useRef<RapierRigidBody>(null!);
  const j2 = useRef<RapierRigidBody>(null!);
  const j3 = useRef<RapierRigidBody>(null!);
  const card = useRef<RapierRigidBody>(null!);

  // Smoothed positions of the two middle joints, which hide jitter when over-pulling the card.
  const lerped = useRef<{ j1?: THREE.Vector3; j2?: THREE.Vector3 }>({});

  const [vec] = useState(() => new THREE.Vector3());
  const [ang] = useState(() => new THREE.Vector3());
  const [rot] = useState(() => new THREE.Vector3());
  const [dir] = useState(() => new THREE.Vector3());

  const { nodes, materials } = useGLTF(MODEL_URL) as unknown as BadgeGLTF;
  const texture = useTexture(BAND_TEXTURE_URL, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(-3, 1);
  });
  const [bandGeometry] = useState(createBandGeometry);
  useEffect(() => () => bandGeometry.dispose(), [bandGeometry]);
  const [bandPoints] = useState(() =>
    Array.from({ length: BAND_POINTS }, () => new THREE.Vector3()),
  );
  const { firstName, lastName } = attendee;
  const cardTexture = useMemo(
    () => createBadgeTexture({ firstName, lastName }),
    [firstName, lastName],
  );
  useEffect(() => () => cardTexture.dispose(), [cardTexture]);
  const [curve] = useState(() => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    c.curveType = "chordal";
    return c;
  });
  const [dragged, setDragged] = useState<THREE.Vector3 | false>(false);
  const [hovered, setHovered] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.45, 0],
  ]);

  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = dragged ? "grabbing" : "grab";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    const bodies = [card, j1, j2, j3, fixed];
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      bodies.forEach((ref) => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }
    if (fixed.current && j1.current && j2.current && j3.current && card.current) {
      const smoothed = lerped.current;
      const joints = [
        ["j1", j1.current],
        ["j2", j2.current],
      ] as const;
      for (const [key, body] of joints) {
        const target = body.translation();
        const current = (smoothed[key] ??= new THREE.Vector3().copy(target));
        const clampedDistance = Math.max(0.1, Math.min(1, current.distanceTo(target)));
        current.lerp(target, delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)));
      }
      if (smoothed.j1 && smoothed.j2) {
        curve.points[0].copy(j3.current.translation());
        curve.points[1].copy(smoothed.j2);
        curve.points[2].copy(smoothed.j1);
        curve.points[3].copy(fixed.current.translation());
        bandPoints.forEach((point, i) => curve.getPoint(i / (BAND_POINTS - 1), point));
        updateBandGeometry(bandGeometry, bandPoints, state.camera.position);
      }
      // Tilt it back towards the screen
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z }, false);
    }
  });

  function onPointerDown(e: ThreeEvent<PointerEvent>) {
    const target = e.target as Element;
    target.setPointerCapture(e.pointerId);
    if (!card.current) return;
    setDragged(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
  }

  function onPointerUp(e: ThreeEvent<PointerEvent>) {
    (e.target as Element).releasePointerCapture(e.pointerId);
    setDragged(false);
  }

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerUp={onPointerUp}
            onPointerDown={onPointerDown}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                clearcoat={1}
                clearcoatRoughness={0.15}
                iridescence={1}
                iridescenceIOR={1}
                iridescenceThicknessRange={[0, 2400]}
                metalness={0.5}
                roughness={0.3}
                map={cardTexture}
              />
            </mesh>
            <mesh
              geometry={nodes.clip.geometry}
              material={materials.metal}
              material-roughness={0.3}
            />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      {/* Its vertices move every frame, so its bounding sphere is never current. */}
      <mesh geometry={bandGeometry} frustumCulled={false}>
        <meshBasicMaterial color="white" depthTest={false} map={texture} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/**
 * A flat strip in place of meshline (its ShaderMaterial can't run on WebGPURenderer): two vertices
 * per curve point, uv u along the band and v across it, as meshline laid them out.
 */
function createBandGeometry() {
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(BAND_POINTS * 2 * 3), 3);
  position.setUsage(THREE.DynamicDrawUsage);
  const uv = new Float32Array(BAND_POINTS * 2 * 2);
  const index: number[] = [];
  for (let i = 0; i < BAND_POINTS; i++) {
    uv.set([i / (BAND_POINTS - 1), 0, i / (BAND_POINTS - 1), 1], i * 4);
    if (i < BAND_POINTS - 1) {
      const n = i * 2;
      index.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
    }
  }
  geometry.setAttribute("position", position);
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

const tangent = new THREE.Vector3();
const toCamera = new THREE.Vector3();
const offset = new THREE.Vector3();

/** Widens the curve into a strip that faces the camera, like meshline's screen-space line. */
function updateBandGeometry(
  geometry: THREE.BufferGeometry,
  points: THREE.Vector3[],
  cameraPosition: THREE.Vector3,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const last = points.length - 1;
  points.forEach((point, i) => {
    tangent.subVectors(points[Math.min(i + 1, last)], points[Math.max(i - 1, 0)]);
    toCamera.subVectors(cameraPosition, point);
    offset.crossVectors(toCamera, tangent).normalize().multiplyScalar(BAND_HALF_WIDTH);
    position.setXYZ(i * 2, point.x + offset.x, point.y + offset.y, point.z + offset.z);
    position.setXYZ(i * 2 + 1, point.x - offset.x, point.y - offset.y, point.z - offset.z);
  });
  position.needsUpdate = true;
}
