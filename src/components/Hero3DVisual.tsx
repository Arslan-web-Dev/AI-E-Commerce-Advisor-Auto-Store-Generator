'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function Hero3DVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    // Check for reduced motion preference
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reducedMotion) return;

    // Check WebGL availability safely
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglAvailable(false);
        return;
      }
    } catch {
      setWebglAvailable(false);
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Geometry & Hologram Group
    const group = new THREE.Group();
    scene.add(group);

    // Coordinate Grid Disc (Hyperlocal Radius)
    const gridGeometry = new THREE.RingGeometry(0.2, 5.5, 48, 8);
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const gridMesh = new THREE.Mesh(gridGeometry, gridMaterial);
    gridMesh.rotation.x = Math.PI / 2;
    group.add(gridMesh);

    // Radar Scanning Rings
    const ringGeo1 = new THREE.RingGeometry(2.2, 2.25, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x4edea3,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 2;
    group.add(ring1);

    const ringGeo2 = new THREE.RingGeometry(4.0, 4.06, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x4cd7f6,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = Math.PI / 2;
    group.add(ring2);

    // Central Pillar / Target Store Signal (Gulberg III Commercial Hub)
    const centerGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 16);
    const centerMat = new THREE.MeshBasicMaterial({ color: 0x4edea3 });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    centerMesh.position.y = 0.9;
    group.add(centerMesh);

    // Center Core Glow Sphere
    const sphereGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x6ffbbe });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.y = 1.8;
    group.add(sphereMesh);

    // Competitor Pins (Red / Amber beacons)
    const competitorLocations = [
      { x: 1.8, z: -1.2, color: 0xffb4ab, height: 1.1 },
      { x: -2.3, z: 1.5, color: 0xffb4ab, height: 0.9 },
      { x: 2.7, z: 2.1, color: 0xffb4ab, height: 1.3 },
      { x: -1.5, z: -2.4, color: 0xfbbc05, height: 1.0 },
    ];

    const beaconPointers: THREE.Mesh[] = [];
    competitorLocations.forEach((loc) => {
      const pinGeo = new THREE.ConeGeometry(0.16, loc.height, 8);
      const pinMat = new THREE.MeshBasicMaterial({ color: loc.color, transparent: true, opacity: 0.85 });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(loc.x, loc.height / 2, loc.z);
      group.add(pinMesh);

      // Top beacon dot
      const dotGeo = new THREE.SphereGeometry(0.1, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: loc.color });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.set(loc.x, loc.height, loc.z);
      group.add(dotMesh);
      beaconPointers.push(dotMesh);
    });

    // Floating Data Particle Cloud (Market Signals)
    const particleCount = 140;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      const r = 1.0 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      positions[i] = Math.cos(theta) * r;
      positions[i + 1] = Math.random() * 2.8;
      positions[i + 2] = Math.sin(theta) * r;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x4cd7f6,
      size: 0.08,
      transparent: true,
      opacity: 0.65,
    });
    const particleCloud = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particleCloud);

    // 3. Pointer interaction & Damped rotation
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const rect = container.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

      targetX = x * 0.45;
      targetY = y * 0.25;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    // 4. Animation loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Damped pointer follow
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      group.rotation.y = elapsedTime * 0.15 + mouseX;
      group.rotation.x = 0.35 + mouseY * 0.2;

      // Pulse effects
      const scale1 = 1 + Math.sin(elapsedTime * 2.0) * 0.04;
      ring1.scale.set(scale1, scale1, scale1);

      const scale2 = 1 + Math.cos(elapsedTime * 1.5) * 0.03;
      ring2.scale.set(scale2, scale2, scale2);

      sphereMesh.position.y = 1.8 + Math.sin(elapsedTime * 3) * 0.1;

      // Rotate particle cloud gently in opposite direction
      particleCloud.rotation.y = -elapsedTime * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    // 5. Responsive Resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
      gridGeometry.dispose();
      gridMaterial.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      centerGeo.dispose();
      centerMat.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, [reducedMotion]);

  // Graceful Static / CSS Fallback if WebGL unavailable or reduced motion enabled
  if (!webglAvailable || reducedMotion) {
    return (
      <div className="relative w-full h-[340px] md:h-[400px] rounded-2xl bg-[#060e20]/80 border border-[#2d3449] flex items-center justify-center overflow-hidden p-6 shadow-inner">
        <div className="absolute inset-0 bg-[radial-gradient(#2d3449_1px,transparent_1px)] [background-size:20px_20px] opacity-40"></div>
        <div className="relative flex flex-col items-center text-center max-w-sm z-10">
          <div className="w-20 h-20 rounded-full border-2 border-[#4edea3]/40 bg-[#10b981]/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#4edea3] text-[36px]">radar</span>
          </div>
          <span className="text-[12px] uppercase tracking-widest text-[#4edea3] font-semibold mb-1">
            Spatial Radar Active
          </span>
          <p className="text-[14px] text-[#bbcabf]">
            10–15 KM POI buffer scanning OpenStreetMap competitors & commercial rent indexes across Lahore, Karachi & Islamabad.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[340px] md:h-[420px] rounded-2xl bg-gradient-to-b from-[#131b2e]/60 to-[#060e20]/90 border border-[#2d3449]/70 overflow-hidden shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing"
      aria-label="Interactive 3D Holographic Spatial Feasibility Map"
    >
      {/* Top telemetry badge */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-[#171f33]/80 backdrop-blur-md border border-[#3c4a42]/50 text-[11px] text-[#bbcabf] font-mono">
        <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
        <span>Holographic Spatial Telemetry</span>
      </div>

      <div className="absolute top-3 right-4 z-10 hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#222a3d]/80 text-[#4cd7f6] text-[10px] font-mono">
        <span>PK-LHR-G3 12.5km</span>
      </div>

      {/* Subtle bottom legend */}
      <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between text-[11px] text-[#bbcabf] pointer-events-none">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#4edea3]"></span> Proposed Retail Anchor
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#ffb4ab]"></span> Detected Competitors
        </span>
      </div>
    </div>
  );
}
