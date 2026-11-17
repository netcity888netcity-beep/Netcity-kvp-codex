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

## Material asset pipeline

- material-pipeline.js — creates validated material instances from catalogue presets, binds texture asset references, and produces renderer-neutral descriptors with explicit capability reporting.
- Renderer adapters own texture loading and conversion to native GPU objects. The core stores stable asset references only; it does not assume a browser, GPU API, or a particular renderer.

Example:

    import { createMaterialInstance, toRendererMaterialDescriptor } from './spatial/index.js';

    const glass = createMaterialInstance({
      id: 'window-glass-01',
      presetId: 'glass.clear',
      assets: { normal: 'asset://materials/glass/normal' },
    });
    const descriptor = toRendererMaterialDescriptor(glass, {
      renderer: 'three-webgpu',
      capabilities: ['normal', 'transmission'],
    });

## Lighting and ray tracing contracts

- lighting.js — physically-unit light sources, environment settings, and renderer-neutral ray-tracing quality controls.
- Distances are metres; directional vectors are unitless; light intensity is expressed in the declared physical-unit contract; color temperature is kelvin.
- createRayTracingProfile separates scene semantics from renderer support and allows realtime, progressive, or path-traced execution profiles. A profile describes requested quality; it does not claim that a selected device supports hardware ray tracing.

## Geometry core and canonical world scene

- geometry.js — renderer-neutral primitive descriptors for boxes, planes, spheres, cylinders, capsules, and externally referenced meshes. Dimensions are metres; tessellation is data, not tied to a graphics API.
- world.js — assembles the scene graph, geometry library, material instances, and lighting environment into one canonical world object. Objects refer to geometry and material by stable IDs stored in scene-node metadata.
- serializeWorldScene() emits a versioned JSON representation under the `netcity.world-scene` schema.
- validateWorldScene() checks object references before an adapter consumes the world.

Example:

    import {
      createGeometry, createWorldScene, addWorldObject,
      createMaterialInstance, createLight,
    } from './spatial/index.js';

    const world = createWorldScene({
      geometries: [createGeometry({ id: 'ground', type: 'plane', parameters: { width: 200, height: 200, segmentsX: 128, segmentsY: 128 } })],
      materials: [{ id: 'terrain-earth', presetId: 'soil.earth' }],
      lighting: { lights: [createLight({ id: 'sun', type: 'directional', direction: { x: -0.4, y: -1, z: -0.2 }, intensity: 100000 })] },
    });
    const populated = addWorldObject(world, {
      id: 'terrain', geometryId: 'ground', materialId: 'terrain-earth',
    });

The geometry core currently describes primitives and references external mesh assets; it does not yet generate GPU buffers, load scans, implement terrain erosion, or run rigid-body/fluid simulation. Those belong to renderer and physics adapters.
