# NetCity Spatial Engine

Framework-neutral spatial runtime primitives for the NetCity dashboard. The engine is deliberately isolated from React, Three.js, KVP Core, transport, identity, and agent execution.

## Modules

- layout.js — viewport orientation, portrait layout, screen-to-world projection, and frame damping.
- scene.js — immutable scene graph creation and updates, hierarchy validation, world transforms, removal, and JSON serialization.
- compositor.js — deterministic renderer-neutral draw-list generation, ancestor visibility, opacity accumulation, focus flags, and layer ordering.
- interaction.js — input state machine for focus, gaze/hover, pointer capture, drag deltas, cancellation, and reset.
- materials.js — renderer-neutral physical/PBR material presets, family catalogue, physical-property metadata, and asset-map binding.

## Material catalogue

The initial catalogue contains reusable presets across stone, masonry, soil, metals, wood, glass, ceramics, polymers, rubber, composites, textiles, leather, liquids, and organic surfaces. Each preset has a stable ID, PBR starting parameters, optional physical-property metadata, texture-map slots, and provenance.

These are **starting presets**, not a claim that every real-world material has been measured or scanned. A production material can bind authored or scanned albedo, normal, roughness, metalness, displacement, ambient-occlusion, opacity, and transmission assets by asset reference. Renderer adapters translate the renderer-neutral definition into Three.js, a future native renderer, or a remote renderer. Physical simulation (density, thermal behavior, deformation, fluid dynamics) remains a separate subsystem and must use validated material datasets where accuracy matters.

Example:

    import { getMaterialPreset, bindMaterialAssets } from './spatial/index.js';

    const steel = getMaterialPreset('metal.steel');
    const scannedSteel = bindMaterialAssets('metal.steel', {
      albedo: 'asset://materials/steel/albedo',
      normal: 'asset://materials/steel/normal',
      roughness: 'asset://materials/steel/roughness',
    });

## Minimal use

    import { createSpatialScene, addSpatialNode, composeSpatialScene } from './spatial/index.js';

    let scene = createSpatialScene({ id: 'operator-space' });
    scene = addSpatialNode(scene, {
      id: 'identity-panel',
      type: 'panel',
      layer: 10,
      transform: { position: { x: 0, y: 0, z: 2 } },
    });
    const drawList = composeSpatialScene(scene, {
      focusedId: 'identity-panel',
      viewport: { width: 1440, height: 900, pixelRatio: 1 },
    });

## Validation

Run from dashboard/:

    npm run test:spatial

The draw list is an adapter boundary, not a renderer. A Three.js/React renderer can consume it without making the core scene model depend on either library.
