use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Global animated 3D background layer.
 * - Particle field with additive glow
 * - Floating wireframe geometric shapes (icosahedron, torus knot, octahedron)
 * - Pointer parallax (moves with mouse)
 * - Graceful CSS aurora fallback when WebGL is unavailable or reduced-motion is set
 */
export default function Scene3DBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setEnabled(false);
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setEnabled(false);
        return;
      }
    } catch {
      setEnabled(false);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b1326, 0.028);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    camera.position.z = 26;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    // --- Particle field ---
    const COUNT = 900;
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      speeds[i] = 0.15 + Math.random() * 0.5;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x4edea3,
      size: 0.14,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    // Secondary cyan dust layer
    const COUNT2 = 350;
    const pos2 = new Float32Array(COUNT2 * 3);
    for (let i = 0; i < COUNT2; i++) {
      pos2[i * 3] = (Math.random() - 0.5) * 90;
      pos2[i * 3 + 1] = (Math.random() - 0.5) * 60;
      pos2[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const pGeo2 = new THREE.BufferGeometry();
    pGeo2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
    const pMat2 = new THREE.PointsMaterial({
      color: 0x4cd7f6,
      size: 0.22,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points2 = new THREE.Points(pGeo2, pMat2);
    scene.add(points2);

    // --- Floating wireframe shapes ---
    const shapes: { mesh: THREE.Mesh; rx: number; ry: number; float: number; baseY: number }[] = [];
    const addShape = (
      geo: THREE.BufferGeometry,
      color: number,
      x: number,
      y: number,
      z: number,
      scale: number
    ) => {
      const mat = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.14,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(scale);
      scene.add(mesh);
      shapes.push({
        mesh,
        rx: (Math.random() - 0.5) * 0.4,
        ry: (Math.random() - 0.5) * 0.5,
        float: Math.random() * Math.PI * 2,
        baseY: y,
      });
    };

    addShape(new THREE.IcosahedronGeometry(4, 0), 0x4edea3, -18, 6, -8, 1);
    addShape(new THREE.TorusKnotGeometry(2.6, 0.7, 72, 10), 0x4cd7f6, 20, -6, -12, 1);
    addShape(new THREE.OctahedronGeometry(3, 0), 0x6ffbbe, 14, 10, -18, 1);
    addShape(new THREE.IcosahedronGeometry(2.2, 0), 0x4cd7f6, -10, -12, -6, 1);

    // --- Pointer parallax ---
    let mx = 0, my = 0, tmx = 0, tmy = 0;
    const onPointer = (e: PointerEvent) => {
      tmx = (e.clientX / window.innerWidth) * 2 - 1;
      tmy = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      mx += (tmx - mx) * 0.03;
      my += (tmy - my) * 0.03;

      camera.position.x = mx * 3.2;
      camera.position.y = -my * 2.2;
      camera.lookAt(0, 0, 0);

      // Drift particles upward gently
      const arr = pGeo.getAttribute('position').array as Float32Array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 1] += speeds[i] * 0.006;
        if (arr[i * 3 + 1] > 32) arr[i * 3 + 1] = -32;
      }
      pGeo.getAttribute('position').needsUpdate = true;
      points2.rotation.y = t * 0.02;

      shapes.forEach((s, i) => {
        s.mesh.rotation.x += s.rx * 0.004;
        s.mesh.rotation.y += s.ry * 0.004;
        s.mesh.position.y = s.baseY + Math.sin(t * 0.5 + s.float) * 0.9;
      });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', onResize);
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      pGeo.dispose(); pMat.dispose();
      pGeo2.dispose(); pMat2.dispose();
      shapes.forEach((s) => {
        (s.mesh.geometry as THREE.BufferGeometry).dispose();
        (s.mesh.material as THREE.Material).dispose();
      });
    };
  }, []);

  return (
    <>
      {/* CSS aurora fallback / base ambience */}
      <div className="ui-aurora" aria-hidden="true" />
      <div className="ui-grid-overlay" aria-hidden="true" />
      {enabled && (
        <div
          ref={containerRef}
          className="fixed inset-0 -z-10 pointer-events-none opacity-70"
          aria-hidden="true"
        />
      )}
    </>
  );
}
