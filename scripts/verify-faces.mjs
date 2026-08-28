import * as THREE from "three";
import { FACE_BY_NORMAL } from "../src/config.js";

function upFace(quaternion) {
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  let best = 1;
  let bestDot = -Infinity;
  for (const face of FACE_BY_NORMAL) {
    normal.set(face.axis[0], face.axis[1], face.axis[2]).applyQuaternion(quaternion);
    const dot = normal.dot(up);
    if (dot > bestDot) {
      bestDot = dot;
      best = face.value;
    }
  }
  return best;
}

function qAxis(axis, angle) {
  return new THREE.Quaternion().setFromAxisAngle(axis, angle);
}

const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

const cases = [
  ["identity keeps 1 on +Y", new THREE.Quaternion(), 1],
  ["180° about X puts 6 up", qAxis(X, Math.PI), 6],
  ["+90° about Z puts 3 up", qAxis(Z, Math.PI / 2), 3],
  ["-90° about Z puts 4 up", qAxis(Z, -Math.PI / 2), 4],
  ["+90° about X puts 5 up", qAxis(X, Math.PI / 2), 5],
  ["-90° about X puts 2 up", qAxis(X, -Math.PI / 2), 2],
];

let failed = 0;
for (const [name, q, expected] of cases) {
  const got = upFace(q);
  const ok = got === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}: got ${got}, expected ${expected}`);
}

if (failed) process.exit(1);
console.log("all face mappings passed");
