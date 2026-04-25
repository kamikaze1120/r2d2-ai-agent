import { useEffect, useRef } from "react";
import * as THREE from "three";
import { subscribeAmplitude } from "@/hooks/useTTS";

/**
 * JARVIS-style volumetric orb.
 *
 * Three.js scene with:
 *   - A glowing wireframe icosphere that breathes idle and distorts on TTS
 *   - An inner glow sphere (additive) for the arc-reactor core
 *   - Two counter-rotating equatorial rings (fresnel-style)
 *   - Background particle field
 *
 * The orb subscribes to the global TTS amplitude (0..1) so it pulses
 * regardless of which component triggered the speech.
 */
export function JarvisGlobe({
  size = 320,
  speaking = false,
}: {
  size?: number;
  speaking?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const ampRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ---------- scene ----------
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 5.5;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ---------- core orb ----------
    const baseGeom = new THREE.IcosahedronGeometry(1.45, 4);
    // Snapshot original positions so we can displace them smoothly each frame
    const original = baseGeom.attributes.position.clone();

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x4cc6ff,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const orb = new THREE.Mesh(baseGeom, wireMat);
    scene.add(orb);

    // Inner glowing nucleus
    const innerGeom = new THREE.SphereGeometry(0.95, 48, 48);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x1f9fff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const inner = new THREE.Mesh(innerGeom, innerMat);
    scene.add(inner);

    // Bright pinpoint core
    const coreGeom = new THREE.SphereGeometry(0.22, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xaee4ff,
      transparent: true,
      opacity: 0.95,
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    scene.add(core);

    // ---------- equatorial rings ----------
    const ringGroup = new THREE.Group();
    scene.add(ringGroup);
    const makeRing = (radius: number, color: number, opacity: number) => {
      const g = new THREE.TorusGeometry(radius, 0.012, 12, 160);
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
      });
      return new THREE.Mesh(g, m);
    };
    const ringA = makeRing(2.05, 0x4cc6ff, 0.75);
    const ringB = makeRing(2.4, 0xffb347, 0.55);
    ringB.rotation.x = Math.PI / 2.2;
    ringA.rotation.x = Math.PI / 3;
    ringGroup.add(ringA, ringB);

    // ---------- particle starfield ----------
    const PARTICLES = 220;
    const pPos = new Float32Array(PARTICLES * 3);
    for (let i = 0; i < PARTICLES; i++) {
      const r = 3 + Math.random() * 3;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pPos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      pPos[i * 3 + 2] = r * Math.cos(p);
    }
    const pGeom = new THREE.BufferGeometry();
    pGeom.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x6fc5ff,
      size: 0.025,
      transparent: true,
      opacity: 0.7,
    });
    const points = new THREE.Points(pGeom, pMat);
    scene.add(points);

    // ---------- amplitude subscription ----------
    const unsub = subscribeAmplitude((amp) => {
      ampRef.current = amp;
    });

    // ---------- animate ----------
    let raf = 0;
    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3();

    const animate = () => {
      const t = clock.getElapsedTime();
      // Smooth amplitude (avoid jitter)
      const liveAmp = ampRef.current;
      const idle = 0.06 + Math.sin(t * 1.6) * 0.04;
      const amp = Math.max(idle, liveAmp * 1.4);

      // Distort vertices radially
      const pos = baseGeom.attributes.position as THREE.BufferAttribute;
      const orig = original as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        tmp.set(orig.getX(i), orig.getY(i), orig.getZ(i));
        const noise =
          Math.sin(tmp.x * 3 + t * 1.5) +
          Math.sin(tmp.y * 4 + t * 1.2) +
          Math.sin(tmp.z * 3.5 + t * 1.8);
        const scale = 1 + amp * 0.18 + noise * 0.012 * (0.6 + amp * 1.5);
        pos.setXYZ(i, tmp.x * scale, tmp.y * scale, tmp.z * scale);
      }
      pos.needsUpdate = true;

      // Inner glow & core react to amplitude
      const pulse = 1 + amp * 0.6;
      inner.scale.setScalar(pulse);
      innerMat.opacity = 0.18 + amp * 0.45;
      core.scale.setScalar(0.85 + amp * 1.2);
      coreMat.opacity = 0.85 + amp * 0.15;
      wireMat.opacity = 0.7 + amp * 0.3;

      // Rings rotate, faster when speaking
      const spin = 0.0025 + amp * 0.04;
      ringA.rotation.z += spin;
      ringB.rotation.z -= spin * 0.7;
      ringGroup.rotation.y += 0.0015;

      // Slow autonomous tumble
      orb.rotation.y += 0.0025;
      orb.rotation.x += 0.0009;
      points.rotation.y += 0.0006;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    // ---------- resize handling ----------
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || size;
      renderer.setSize(w, w);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsub();
      renderer.dispose();
      baseGeom.dispose();
      innerGeom.dispose();
      coreGeom.dispose();
      pGeom.dispose();
      wireMat.dispose();
      innerMat.dispose();
      coreMat.dispose();
      pMat.dispose();
      ringA.geometry.dispose();
      (ringA.material as THREE.Material).dispose();
      ringB.geometry.dispose();
      (ringB.material as THREE.Material).dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className="relative mx-auto"
      style={{
        width: size,
        height: size,
        filter: speaking
          ? "drop-shadow(0 0 32px rgba(76,198,255,0.55))"
          : "drop-shadow(0 0 18px rgba(76,198,255,0.35))",
        transition: "filter 250ms ease-out",
      }}
    />
  );
}
