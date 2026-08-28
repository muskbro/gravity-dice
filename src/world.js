import * as THREE from "three";
import * as CANNON from "cannon-es";
import { TABLE } from "./config.js";
import { createFeltTexture, createWoodTexture } from "./textures.js";

export function createPhysicsWorld() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.81, 0),
    allowSleep: true,
  });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 16;
  world.defaultContactMaterial.friction = 0.4;
  world.defaultContactMaterial.restitution = 0.2;

  const feltMat = new CANNON.Material("felt");
  const woodMat = new CANNON.Material("wood");
  const diceMat = new CANNON.Material("dice");

  world.addContactMaterial(
    new CANNON.ContactMaterial(diceMat, feltMat, {
      friction: 0.72,
      restitution: 0.16,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3,
    }),
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(diceMat, woodMat, {
      friction: 0.32,
      restitution: 0.42,
      contactEquationStiffness: 1e7,
    }),
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(diceMat, diceMat, {
      friction: 0.22,
      restitution: 0.18,
    }),
  );

  const { half, wallHeight, wallThickness } = TABLE;
  const table = new CANNON.Body({ mass: 0, material: feltMat });
  table.addShape(new CANNON.Box(new CANNON.Vec3(half, 0.22, half)));
  table.position.set(0, -0.22, 0);
  world.addBody(table);

  const wallY = wallHeight / 2;
  const specs = [
    { pos: [0, wallY, -(half + wallThickness / 2)], size: [half + wallThickness, wallHeight / 2, wallThickness / 2] },
    { pos: [0, wallY, half + wallThickness / 2], size: [half + wallThickness, wallHeight / 2, wallThickness / 2] },
    { pos: [-(half + wallThickness / 2), wallY, 0], size: [wallThickness / 2, wallHeight / 2, half] },
    { pos: [half + wallThickness / 2, wallY, 0], size: [wallThickness / 2, wallHeight / 2, half] },
  ];
  for (const spec of specs) {
    const body = new CANNON.Body({ mass: 0, material: woodMat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(...spec.size)));
    body.position.set(...spec.pos);
    world.addBody(body);
  }

  const ceiling = new CANNON.Body({ mass: 0, material: woodMat });
  ceiling.addShape(new CANNON.Box(new CANNON.Vec3(half + 1, 0.1, half + 1)));
  ceiling.position.set(0, 6.2, 0);
  world.addBody(ceiling);

  return { world, diceMat };
}

export function createTable(scene) {
  const feltMap = createFeltTexture();
  const woodMap = createWoodTexture();
  const { half, wallHeight, wallThickness } = TABLE;

  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2, 0.08, half * 2),
    new THREE.MeshPhysicalMaterial({
      map: feltMap,
      roughness: 0.92,
      metalness: 0,
      color: 0x2f7a52,
    }),
  );
  felt.position.y = -0.04;
  felt.receiveShadow = true;
  scene.add(felt);

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2 + 0.7, 0.32, half * 2 + 0.7),
    new THREE.MeshPhysicalMaterial({
      map: woodMap,
      roughness: 0.55,
      metalness: 0.05,
    }),
  );
  slab.position.y = -0.24;
  slab.receiveShadow = true;
  slab.castShadow = true;
  scene.add(slab);

  const woodMat = new THREE.MeshPhysicalMaterial({
    map: woodMap,
    roughness: 0.48,
    metalness: 0.06,
    clearcoat: 0.15,
  });

  const wallGeomLong = new THREE.BoxGeometry(
    half * 2 + wallThickness * 2,
    wallHeight,
    wallThickness,
  );
  const wallGeomShort = new THREE.BoxGeometry(wallThickness, wallHeight, half * 2);

  const walls = [
    { geom: wallGeomLong, pos: [0, wallHeight / 2, -(half + wallThickness / 2)] },
    { geom: wallGeomLong, pos: [0, wallHeight / 2, half + wallThickness / 2] },
    { geom: wallGeomShort, pos: [-(half + wallThickness / 2), wallHeight / 2, 0] },
    { geom: wallGeomShort, pos: [half + wallThickness / 2, wallHeight / 2, 0] },
  ];
  for (const wall of walls) {
    const mesh = new THREE.Mesh(wall.geom, woodMat);
    mesh.position.set(...wall.pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const room = new THREE.Mesh(
    new THREE.CylinderGeometry(18, 18, 12, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x0b0c0a,
      side: THREE.BackSide,
    }),
  );
  room.position.y = 3;
  scene.add(room);
}

export function createDust(scene) {
  const count = 420;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = Math.random() * 5.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    velocities.push(0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xd7c7a2,
    size: 0.035,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return { points, velocities };
}

export function stepDust(dust, gravity, dt, visible) {
  dust.points.visible = visible;
  if (!visible) return;
  const pos = dust.points.geometry.attributes.position;
  const g = gravity;
  for (let i = 0; i < dust.velocities.length; i++) {
    if (g < 0.05) {
      dust.velocities[i] += (Math.random() - 0.5) * 0.4 * dt;
      dust.velocities[i] *= 0.99;
    } else {
      dust.velocities[i] += g * dt;
    }
    let y = pos.getY(i) - dust.velocities[i] * dt * 0.22;
    if (y < 0.08) {
      y = 5.2 + Math.random();
      dust.velocities[i] = g < 0.05 ? (Math.random() - 0.5) * 0.2 : 0;
      pos.setX(i, (Math.random() - 0.5) * 10);
      pos.setZ(i, (Math.random() - 0.5) * 10);
    }
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
}
