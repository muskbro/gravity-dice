import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as CANNON from "cannon-es";
import { DIE_SIZE, DIE_TINTS, FACE_BY_NORMAL } from "./config.js";
import { createDieFaceTexture } from "./textures.js";

const _up = new THREE.Vector3(0, 1, 0);
const _normal = new THREE.Vector3();

export function createDieMaterials(tint) {
  return FACE_BY_NORMAL.map((face) => {
    const map = createDieFaceTexture(face.value, tint);
    return new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.38,
      metalness: 0.04,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.7,
    });
  });
}

export class Die {
  constructor({ scene, world, materials, physicsMaterial, tintIndex }) {
    const size = DIE_SIZE;
    const half = size / 2;
    const geometry = new RoundedBoxGeometry(size, size, size, 5, 0.1);
    const verts = geometry.attributes.position.count;
    const perFace = verts / 6;
    geometry.clearGroups();
    for (let i = 0; i < 6; i++) {
      geometry.addGroup(i * perFace, perFace, i);
    }
    this.mesh = new THREE.Mesh(geometry, materials);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    const pos = geometry.attributes.position;
    this.faceCenters = [];
    for (let g = 0; g < 6; g++) {
      const center = new THREE.Vector3();
      for (let i = 0; i < perFace; i++) {
        center.x += pos.getX(g * perFace + i);
        center.y += pos.getY(g * perFace + i);
        center.z += pos.getZ(g * perFace + i);
      }
      center.multiplyScalar(1 / perFace);
      this.faceCenters.push(center);
    }

    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 128;
    labelCanvas.height = 128;
    this.labelCanvas = labelCanvas;
    this.labelCtx = labelCanvas.getContext("2d");
    this.labelMap = new THREE.CanvasTexture(labelCanvas);
    this.labelMap.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.labelMap,
        transparent: true,
        depthTest: false,
      }),
    );
    this.label.scale.set(0.42, 0.42, 1);
    scene.add(this.label);

    this.body = new CANNON.Body({
      mass: 1,
      material: physicsMaterial,
      allowSleep: true,
      sleepSpeedLimit: 0.12,
      sleepTimeLimit: 0.45,
      linearDamping: 0.04,
      angularDamping: 0.04,
      angularFactor: new CANNON.Vec3(1, 1, 1),
    });
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(half, half, half)));
    world.addBody(this.body);

    this.tintIndex = tintIndex;
    this.stillFrames = 0;
  }

  toss(origin, gravity) {
    const g = Math.max(gravity, 0);
    const hover = g < 0.4 ? 1.8 + Math.random() * 0.8 : 2.15 + Math.random() * 1.1;
    this.body.wakeUp();
    this.body.sleepState = 0;
    this.body.position.set(origin.x, hover, origin.z);
    this.body.velocity.set(
      (Math.random() - 0.5) * 3.4,
      g < 0.4 ? (Math.random() - 0.5) * 1.4 : -0.4 - Math.random() * 0.8,
      (Math.random() - 0.5) * 3.4,
    );
    this.body.angularVelocity.set(
      (Math.random() - 0.5) * 22,
      (Math.random() - 0.5) * 22,
      (Math.random() - 0.5) * 22,
    );
    this.body.quaternion.set(
      Math.random(),
      Math.random(),
      Math.random(),
      Math.random(),
    );
    this.body.quaternion.normalize();
    this.stillFrames = 0;
    this.sync();
  }

  sync() {
    const { position, quaternion } = this.body;
    this.mesh.position.set(position.x, position.y, position.z);
    this.mesh.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    this.label.position.set(position.x, position.y + 0.78, position.z);
  }

  setLabel(value, visible) {
    const ctx = this.labelCtx;
    ctx.clearRect(0, 0, 128, 128);
    if (visible && value) {
      ctx.fillStyle = "rgba(12, 13, 11, 0.72)";
      ctx.beginPath();
      ctx.arc(64, 64, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f3ead6";
      ctx.font = "700 72px Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), 64, 70);
    }
    this.labelMap.needsUpdate = true;
    this.label.visible = Boolean(visible && value);
  }

  speed() {
    return this.body.velocity.length();
  }

  spin() {
    return this.body.angularVelocity.length();
  }

  isSettled(gravity) {
    const slow = this.speed() < 0.22 && this.spin() < 0.55;
    const onTable = this.body.position.y < DIE_SIZE * 0.7 + 0.14;
    const mayRestInAir = gravity < 0.35;
    const faceUp = this.upFaceInfo().dot > 0.82;
    if (slow && faceUp && (onTable || mayRestInAir)) this.stillFrames += 1;
    else this.stillFrames = 0;
    return this.stillFrames > 28;
  }

  upFace() {
    return this.upFaceInfo().value;
  }

  upFaceInfo() {
    const q = this.body.quaternion;
    this.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    let best = 1;
    let bestDot = -Infinity;
    for (const face of FACE_BY_NORMAL) {
      _normal.set(face.axis[0], face.axis[1], face.axis[2]);
      _normal.applyQuaternion(this.mesh.quaternion);
      const dot = _normal.dot(_up);
      if (dot > bestDot) {
        bestDot = dot;
        best = face.value;
      }
    }
    return { value: best, dot: bestDot };
  }

  dispose(scene, world) {
    scene.remove(this.mesh);
    scene.remove(this.label);
    world.removeBody(this.body);
    this.mesh.geometry.dispose();
    this.labelMap.dispose();
    this.label.material.dispose();
  }
}

export function spawnOffsets(count) {
  if (count === 1) return [{ x: 0, z: 0 }];
  const radius = 0.55 + count * 0.18;
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.2;
    return { x: Math.cos(a) * radius, z: Math.sin(a) * radius };
  });
}

export function materialsForCount(cache, count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    if (!cache[i]) cache[i] = createDieMaterials(DIE_TINTS[i % DIE_TINTS.length]);
    list.push(cache[i]);
  }
  return list;
}
