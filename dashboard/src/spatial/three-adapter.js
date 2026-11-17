/**
 * NetCity Spatial Engine — Three.js renderer adapter.
 * Converts canonical world state into disposable renderer objects.
 * The canonical scene remains renderer-independent and is never mutated.
 */
import * as THREE from 'three';
import { getWorldTransform } from './scene.js';
import { getGeometryBounds } from './geometry.js';

function makeGeometry(descriptor) {
  const p = descriptor.parameters;
  switch (descriptor.type) {
    case 'box': return new THREE.BoxGeometry(p.width, p.height, p.depth);
    case 'plane': return new THREE.PlaneGeometry(p.width, p.height, p.segmentsX, p.segmentsY);
    case 'sphere': return new THREE.SphereGeometry(p.radius, p.widthSegments, p.heightSegments);
    case 'cylinder': return new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, p.radialSegments);
    case 'capsule': return new THREE.CapsuleGeometry(p.radius, p.length, p.capSegments);
    case 'mesh': throw new Error('mesh asset loading requires an asset resolver: ' + descriptor.assetRef);
    default: throw new Error('unsupported geometry type: ' + descriptor.type);
  }
}

function makeMaterial(instance) {
  const p = instance.properties;
  return new THREE.MeshPhysicalMaterial({
    color: p.baseColor,
    metalness: p.metalness,
    roughness: p.roughness,
    opacity: p.opacity,
    transparent: p.opacity < 1 || p.transmission > 0,
    transmission: p.transmission,
    ior: p.ior,
    thickness: p.thicknessM,
    clearcoat: p.clearcoat,
    side: THREE.FrontSide,
  });
}

function applyTransform(object, transform) {
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.quaternion.set(
    transform.quaternion.x, transform.quaternion.y,
    transform.quaternion.z, transform.quaternion.w,
  );
  object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
}

function makeLight(descriptor) {
  let light;
  if (descriptor.type === 'directional') {
    light = new THREE.DirectionalLight(descriptor.color, descriptor.intensity);
    light.position.set(-descriptor.direction.x, -descriptor.direction.y, -descriptor.direction.z);
  } else if (descriptor.type === 'point') {
    light = new THREE.PointLight(descriptor.color, descriptor.intensity, descriptor.range);
    light.position.set(descriptor.position.x, descriptor.position.y, descriptor.position.z);
  } else if (descriptor.type === 'spot') {
    light = new THREE.SpotLight(descriptor.color, descriptor.intensity, descriptor.range,
      descriptor.outerConeRadians, 0.2);
    light.position.set(descriptor.position.x, descriptor.position.y, descriptor.position.z);
    light.target.position.set(
      descriptor.position.x + descriptor.direction.x,
      descriptor.position.y + descriptor.direction.y,
      descriptor.position.z + descriptor.direction.z,
    );
  } else if (descriptor.type === 'ambient') {
    light = new THREE.AmbientLight(descriptor.color, descriptor.intensity);
  } else if (descriptor.type === 'area') {
    throw new Error('area lights require the Three.js RectAreaLight addon adapter');
  }
  light.name = descriptor.id;
  light.castShadow = descriptor.castShadow && 'castShadow' in light;
  return light;
}

export function buildThreeScene(world, { background = '#202630', enableShadows = true } = {}) {
  if (!world?.scene?.nodes || !world?.geometries || !world?.materials) {
    throw new TypeError('a canonical NetCity world scene is required');
  }
  const scene = new THREE.Scene();
  scene.name = world.id;
  scene.background = new THREE.Color(background);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x59616d, 0.35));

  const geometryCache = new Map();
  const materialCache = new Map();
  const resources = { geometries: [], materials: [], lights: [] };
  const objects = new Map();

  for (const node of Object.values(world.scene.nodes)) {
    const geometryId = node.metadata?.geometryId;
    if (!geometryId) {
      const group = new THREE.Group();
      group.name = node.name;
      objects.set(node.id, group);
      continue;
    }
    const geometryDescriptor = world.geometries[geometryId];
    if (!geometryDescriptor) throw new Error('geometry not found: ' + geometryId);
    let geometry = geometryCache.get(geometryId);
    if (!geometry) {
      geometry = makeGeometry(geometryDescriptor);
      geometryCache.set(geometryId, geometry);
      resources.geometries.push(geometry);
    }
    const materialId = node.metadata?.materialId;
    let material = materialId ? materialCache.get(materialId) : null;
    if (materialId && !material) {
      const instance = world.materials[materialId];
      if (!instance) throw new Error('material not found: ' + materialId);
      material = makeMaterial(instance);
      materialCache.set(materialId, material);
      resources.materials.push(material);
    }
    const mesh = new THREE.Mesh(geometry, material ?? new THREE.MeshStandardMaterial());
    if (!material) resources.materials.push(mesh.material);
    mesh.name = node.name;
    mesh.castShadow = enableShadows;
    mesh.receiveShadow = enableShadows;
    mesh.userData.netcityNodeId = node.id;
    mesh.userData.netcityGeometryId = geometryId;
    mesh.userData.netcityMaterialId = materialId ?? null;
    objects.set(node.id, mesh);
  }

  for ( (const node of Object.values(world.scene.nodes)) ) {
    const object = objects.get(node.id);
    const parent = node.parentId ? objects.get(node.parentId) : scene;
    parent.add(object);
    if (node.parentId) {
      // Parent-local transforms are preserved by the canonical graph.
      object.position.set(node.transform.position.x, node.transform.position.y, node.transform.position.z);
      object.rotation.set(node.transform.rotation.x, node.transform.rotation.y, node.transform.rotation.z);
      object.scale.set(node.transform.scale.x, node.transform.scale.y, node.transform.scale.z);
    } else {
      applyTransform(object, getWorldTransform(world.scene, node.id));
    }
    object.visible = node.visible && node.enabled;
    object.userData.netcityNodeId = node.id;
    object.userData.netcityBounds = node.bounds ?? (node.metadata?.geometryId
      ? getGeometryBounds(world.geometries[node.metadata.geometryId]) : null);
  }

  for (const descriptor of world.lighting?.lights ?? []) {
    const light = makeLight(descriptor);
    scene.add(light);
    resources.lights.push(light);
    if (light.target) scene.add(light.target);
    if (light.castShadow && 'shadow' in light) {
      light.shadow.mapSize.set(2048, 2048);
      light.shadow.bias = -0.0001;
    }
  }
  return Object.freeze({
    scene,
    objects,
    resources,
    dispose() {
      for (const resource of resources.geometries) resource.dispose();
      for (const resource of resources.materials) resource.dispose();
      for (const light of resources.lights) light.dispose?.();
      objects.clear();
    },
  });
}

export function configureThreeRenderer(renderer, { pixelRatio = 1, shadows = true } = {}) {
  if (!renderer?.setPixelRatio || !renderer?.shadowMap) {
    throw new TypeError('a Three.js WebGLRenderer-compatible instance is required');
  }
  renderer.setPixelRatio(Math.min(Math.max(pixelRatio, 1), 2));
  renderer.shadowMap.enabled = Boolean(shadows);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  return renderer;
}

export { THREE };
