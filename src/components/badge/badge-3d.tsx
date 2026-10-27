import {
  Canvas,
  extend,
  useFrame,
  useThree,
  type ThreeElement,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  Center,
  Environment,
  Lightformer,
  PerspectiveCamera,
  RenderTexture,
  Resize,
  Text3D,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";

extend({ MeshLineGeometry, MeshLineMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    meshLineGeometry: ThreeElement<typeof MeshLineGeometry>;
    // The constructor's required `resolution` would force `args`; it's passed as a prop instead.
    meshLineMaterial: Partial<ThreeElement<typeof MeshLineMaterial>>;
  }
}

const MODEL_URL = "/models/tag.glb";
const BAND_TEXTURE_URL = "/band.jpg";
const FONT_URL = "/Geist_Regular.json";

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
    <Canvas camera={{ position: [0, 0, 13], fov: 25 }}>
      <ambientLight intensity={Math.PI} />
      <Physics debug={debug} interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
        <Band attendee={attendee} />
      </Physics>
      <Environment background blur={0.75}>
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
      </Environment>
    </Canvas>
  );
}

function BadgeTexture({ attendee }: { attendee: Attendee }) {
  return (
    <>
      <PerspectiveCamera makeDefault manual aspect={1.05} position={[0.49, 0.22, 2]} />
      <Center>
        <Resize>
          <Text3D
            bevelEnabled={false}
            bevelSize={0}
            font={FONT_URL}
            height={0}
            position={[1.05, 2.1, 0]}
            rotation={[0, Math.PI, Math.PI]}
            size={0.15}
            letterSpacing={-0.02}
          >
            {attendee.firstName}
          </Text3D>
          <Text3D
            bevelEnabled={false}
            bevelSize={0}
            font={FONT_URL}
            height={0}
            position={[1.23, 2.3, 0]}
            rotation={[0, Math.PI, Math.PI]}
            size={0.15}
            letterSpacing={-0.02}
          >
            {attendee.lastName}
          </Text3D>
          <Text3D
            bevelEnabled={false}
            bevelSize={0}
            font={FONT_URL}
            height={0}
            position={[1.3, 3.25, 0]}
            rotation={[0, Math.PI, Math.PI]}
            size={0.07}
            letterSpacing={-0.008}
          >
            omsimos.com
          </Text3D>
        </Resize>
      </Center>
    </>
  );
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
  const band = useRef<THREE.Mesh<MeshLineGeometry>>(null);
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
  });
  const { width, height } = useThree((state) => state.size);
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
    if (fixed.current && j1.current && j2.current && j3.current && card.current && band.current) {
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
        band.current.geometry.setPoints(curve.getPoints(32));
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
              >
                <RenderTexture attach="map" height={2000} width={2000}>
                  <BadgeTexture attendee={attendee} />
                </RenderTexture>
              </meshPhysicalMaterial>
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
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest={false}
          resolution={[width, height]}
          useMap={1}
          map={texture}
          repeat={[-3, 1]}
          lineWidth={1}
        />
      </mesh>
    </>
  );
}
