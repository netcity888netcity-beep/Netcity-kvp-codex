# NetCity Spatial Engine

Framework-neutral spatial runtime primitives for the NetCity dashboard. The engine is deliberately isolated from React, Three.js, KVP Core, transport, identity, and agent execution.

## Modules

- layout.js — viewport orientation, portrait layout, screen-to-world projection, and frame damping.
- scene.js — immutable scene graph creation and updates, hierarchy validation, world transforms, removal, and JSON serialization.
- compositor.js — deterministic renderer-neutral draw-list generation, ancestor visibility, opacity accumulation, focus flags, and layer ordering.
- interaction.js — input state machine for focus, gaze/hover, pointer capture, drag deltas, cancellation, and reset.
- world.js — persistent spatial world: permanent per-layer environments (theme, visit state, spatial objects), layer entry, object placement/movement/removal, storage round-trip, and scene-graph derivation.

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

## Spatial world (layer environments)

    import { createSpatialWorld, enterLayer, worldToScene } from './spatial/index.js';

    let world = createSpatialWorld({ layers: [{ id: 'core' }, { id: 'tech' }] });
    world = enterLayer(world, 'tech');            // activation recorded, sibling state preserved
    const scene = worldToScene(world);             // permanent layer roots + object nodes

## Validation

Run from dashboard/:

    npm run test:spatial

The draw list is an adapter boundary, not a renderer. A Three.js/React renderer can consume it without making the core scene model depend on either library.
