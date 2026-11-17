import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Edges } from '@react-three/drei';

/**
 * Spatial object renderer: permanent world artifacts ("beacon", "plinth",
 * "monolith") attached to a layer anchor. Dimmed — never removed — while the
 * owning layer rests in the background.
 */
export function SpatialObjectNode({
  object,
  accent = '#7df6d1',
  active = false,
  onSelect = null,
  phase = 0,
}) {
  const emissiveRef = useRef();
  const position = [
    object.position?.x ?? 0,
    object.position?.y ?? 0,
    object.position?.z ?? 0,
  ];
  const scale = object.scale ?? 1;
  const opacity = active ? 1 : 0.72;
  const baseEmissive = active ? 1.5 : 0.7;

  useFrame((state) => {
    if (!emissiveRef.current) return;
    const t = state.clock.elapsedTime;
    emissiveRef.current.emissiveIntensity =
      baseEmissive + Math.sin(t * 1.6 + phase) * 0.35;
  });

  const select = (event) => {
    if (!onSelect) return;
    if (event && event.stopPropagation) event.stopPropagation();
    onSelect();
  };

  if (object.form === 'beacon') {
    return (
      <mesh position={position} scale={scale} onClick={onSelect ? select : undefined}>
        <octahedronGeometry args={[0.17, 0]} />
        <meshStandardMaterial
          ref={emissiveRef}
          color="#0b1118"
          emissive={accent}
          emissiveIntensity={baseEmissive}
          metalness={0.55}
          roughness={0.32}
          transparent
          opacity={opacity}
        />
        <Edges scale={1.25} threshold={15} color={accent} style={{ transparent: true, opacity: active ? 0.8 : 0.35 }} />
      </mesh>
    );
  }

  if (object.form === 'monolith') {
    return (
      <group position={position} scale={scale}>
        <mesh onClick={onSelect ? select : undefined}>
          <boxGeometry args={[0.16, 0.62, 0.12]} />
          <meshStandardMaterial
            ref={emissiveRef}
            color="#0b1118"
            emissive={accent}
            emissiveIntensity={baseEmissive * 0.5}
            metalness={0.92}
            roughness={0.28}
            transparent
            opacity={opacity}
          />
        </mesh>
        <Edges scale={1.02} threshold={15} color={accent} style={{ transparent: true, opacity: active ? 0.7 : 0.3 }} />
      </group>
    );
  }

  /* plinth — стальная подставка */
  return (
    <group position={position} scale={scale}>
      <RoundedBox
        args={[0.55, 0.1, 0.34]}
        radius={0.02}
        smoothness={3}
        onClick={onSelect ? select : undefined}
      >
        <meshStandardMaterial
          color="#0b1118"
          metalness={0.92}
          roughness={0.26}
          envMapIntensity={1.1}
          transparent
          opacity={opacity}
        />
      </RoundedBox>
      <Edges scale={1.02} threshold={15} color={accent} style={{ transparent: true, opacity: active ? 0.65 : 0.28 }} />
    </group>
  );
}
