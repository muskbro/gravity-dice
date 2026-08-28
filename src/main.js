import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { DIE_TINTS, GRAVITY_PRESETS, TABLE } from "./config.js";
import { Die, materialsForCount, spawnOffsets } from "./dice.js";
import { createDust, createPhysicsWorld, createTable, stepDust } from "./world.js";
import { playImpact, unlockAudio } from "./audio.js";

const canvas = document.querySelector("#scene");
const gSlider = document.querySelector("#g-slider");
const gReadout = document.querySelector("#g-readout");
const presetsEl = document.querySelector("#presets");
const diceCountEl = document.querySelector("#dice-count");
const telemetryEl = document.querySelector("#telemetry");
const resultEl = document.querySelector("#result");
const facesEl = document.querySelector("#faces");
const sumEl = document.querySelector("#sum");
const flavorEl = document.querySelector("#flavor");

const state = {
  gravity: 9.81,
  diceCount: 2,
  slowMo: false,
  dustOn: true,
  rolling: false,
  hasResult: false,
  dice: [],
  materialCache: [],
  lastImpactAt: 0,
  flightStart: 0,
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0c0a);
scene.fog = new THREE.Fog(0x0b0c0a, 12, 22);

const camera = new THREE.PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  0.1,
  80,
);
camera.position.set(6.4, 8.2, 7.6);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.4, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 6;
controls.maxDistance = 16;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const hemi = new THREE.HemisphereLight(0xf0e6d2, 0x1a2a22, 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xfff3dc, 2.1);
key.position.set(5.5, 10, 4.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 24;
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
key.shadow.bias = -0.0004;
scene.add(key);

const fill = new THREE.DirectionalLight(0x8eb7d2, 0.35);
fill.position.set(-6, 3, -4);
scene.add(fill);

const lamp = new THREE.PointLight(0xffd9a0, 12, 18, 2);
lamp.position.set(0, 5.4, 0);
scene.add(lamp);

createTable(scene);
const dust = createDust(scene);
const { world, diceMat } = createPhysicsWorld();

world.addEventListener("postStep", () => {
  if (!state.rolling) return;
  const now = performance.now();
  if (now - state.lastImpactAt < 80) return;
  for (const die of state.dice) {
    const speed = die.speed();
    if (die.body.position.y < 0.55 && speed > 1.2) {
      playImpact(Math.min(speed / 6, 1.4));
      state.lastImpactAt = now;
      break;
    }
  }
});

function setGravity(g, fromPresetId) {
  state.gravity = g;
  world.gravity.set(0, -g, 0);
  gSlider.value = String(g);
  gReadout.textContent = `${g.toFixed(2)} m/s²`;
  for (const btn of presetsEl.querySelectorAll("button")) {
    const preset = GRAVITY_PRESETS.find((p) => p.id === btn.dataset.id);
    btn.classList.toggle("active", fromPresetId ? btn.dataset.id === fromPresetId : preset && nearly(preset.g, g));
  }
}

function nearly(a, b) {
  return Math.abs(a - b) < 0.03;
}

function rebuildDice(count) {
  for (const die of state.dice) die.dispose(scene, world);
  state.dice = [];
  const materials = materialsForCount(state.materialCache, count);
  for (let i = 0; i < count; i++) {
    state.dice.push(
      new Die({
        scene,
        world,
        materials: materials[i],
        physicsMaterial: diceMat,
        tintIndex: i % DIE_TINTS.length,
      }),
    );
  }
  state.diceCount = count;
  diceCountEl.textContent = String(count);
  restDice();
  resultEl.className = "result idle";
  resultEl.querySelector(".result-label").textContent = "Awaiting roll";
  facesEl.innerHTML = "";
  sumEl.textContent = "";
  flavorEl.textContent = "";
}

function restDice() {
  const offsets = spawnOffsets(state.dice.length);
  state.dice.forEach((die, i) => {
    die.body.velocity.setZero();
    die.body.angularVelocity.setZero();
    die.body.position.set(offsets[i].x, 0.46, offsets[i].z);
    die.body.quaternion.set(0, 0, 0, 1);
    die.body.sleep();
    die.sync();
  });
  state.rolling = false;
  state.hasResult = false;
}

function roll() {
  unlockAudio();
  const offsets = spawnOffsets(state.dice.length);
  const inner = TABLE.half - 1.2;
  state.dice.forEach((die, i) => {
    const origin = {
      x: THREE.MathUtils.clamp(offsets[i].x + (Math.random() - 0.5) * 0.4, -inner, inner),
      z: THREE.MathUtils.clamp(offsets[i].z + (Math.random() - 0.5) * 0.4, -inner, inner),
    };
    die.toss(origin, state.gravity);
  });
  state.rolling = true;
  state.hasResult = false;
  state.flightStart = performance.now();
  resultEl.className = "result rolling";
  resultEl.querySelector(".result-label").textContent = "In flight";
  facesEl.innerHTML = "";
  sumEl.textContent = "";
  flavorEl.textContent = "Waiting for the tray to steal their momentum.";
}

function flavorText(faces) {
  const sorted = [...faces].sort((a, b) => a - b).join("-");
  if (faces.length === 2 && faces[0] === 1 && faces[1] === 1) return "Snake eyes.";
  if (faces.length === 2 && faces[0] === 6 && faces[1] === 6) return "Boxcars.";
  if (faces.every((n) => n === faces[0])) return "Every die agrees.";
  if (sorted === "1-2-3") return "A slow climb.";
  if (faces.reduce((a, b) => a + b, 0) === faces.length) return "Minimum possible.";
  if (faces.reduce((a, b) => a + b, 0) === faces.length * 6) return "Maximum possible.";
  if (state.gravity === 0) return "Zero-g finally let them rest against the felt.";
  if (state.gravity > 20) return "Jupiter does not waste time.";
  if (state.gravity < 2) return "Low gravity makes for a long, lazy tumble.";
  return "Opposite faces sum to 7. The tray only cares which one points up.";
}

function showResult(faces) {
  resultEl.className = "result";
  resultEl.querySelector(".result-label").textContent = "Settled face-up";
  facesEl.innerHTML = "";
  faces.forEach((value, i) => {
    const el = document.createElement("div");
    el.className = "face";
    if (i % DIE_TINTS.length === 2) el.classList.add("red");
    if (i % DIE_TINTS.length === 4) el.classList.add("navy");
    el.textContent = String(value);
    facesEl.appendChild(el);
  });
  const total = faces.reduce((a, b) => a + b, 0);
  sumEl.innerHTML =
    faces.length > 1 ? `Sum <b>${total}</b>` : `Face <b>${faces[0]}</b>`;
  flavorEl.textContent = flavorText(faces);
}

function updateTelemetry() {
  const g = state.gravity;
  const lines = [
    `g     ${g.toFixed(2)} m/s²  (${(g / 9.81).toFixed(2)} Earth-g)`,
    `dice  ${state.dice.length} × 12 g cubes`,
  ];
  state.dice.forEach((die, i) => {
    lines.push(
      `d${i + 1}   v=${die.speed().toFixed(2)} m/s  ω=${die.spin().toFixed(1)}  y=${die.body.position.y.toFixed(2)}`,
    );
  });
  if (state.rolling) {
    const t = (performance.now() - state.flightStart) / 1000;
    lines.push(`t     ${t.toFixed(2)} s airborne`);
  }
  telemetryEl.textContent = lines.join("\n");
}

for (const preset of GRAVITY_PRESETS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.id = preset.id;
  btn.textContent = preset.name;
  btn.title = `${preset.g} m/s² · ${preset.detail}`;
  btn.addEventListener("click", () => setGravity(preset.g, preset.id));
  presetsEl.appendChild(btn);
}

gSlider.addEventListener("input", () => setGravity(Number(gSlider.value)));
document.querySelector("#dice-minus").addEventListener("click", () => {
  rebuildDice(Math.max(1, state.diceCount - 1));
});
document.querySelector("#dice-plus").addEventListener("click", () => {
  rebuildDice(Math.min(5, state.diceCount + 1));
});
document.querySelector("#slow-mo").addEventListener("change", (e) => {
  state.slowMo = e.target.checked;
});
document.querySelector("#dust").addEventListener("change", (e) => {
  state.dustOn = e.target.checked;
});
document.querySelector("#roll").addEventListener("click", roll);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    roll();
  }
});

rebuildDice(2);
setGravity(9.81, "earth");

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const scale = state.slowMo ? 0.32 : 1;
  const substeps = state.gravity > 16 ? 10 : 6;
  world.step(1 / 120, dt * scale, substeps);

  let settled = state.dice.length > 0;
  for (const die of state.dice) {
    die.sync();
    if (!die.isSettled(state.gravity)) settled = false;
  }

  const minFlight = state.gravity < 0.4 ? 1800 : 500;
  const airborneLongEnough = performance.now() - state.flightStart > minFlight;
  if (state.rolling && settled && airborneLongEnough) {
    state.rolling = false;
    state.hasResult = true;
    showResult(state.dice.map((die) => die.upFace()));
  }

  for (const die of state.dice) {
    die.setLabel(die.upFace(), state.hasResult);
  }

  stepDust(dust, state.gravity, dt * scale, state.dustOn);
  updateTelemetry();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__gravityDice = {
  roll,
  setGravity,
  faces: () => state.dice.map((die) => die.upFace()),
  settled: () =>
    state.dice.length > 0 && state.dice.every((die) => die.isSettled(state.gravity)),
  rolling: () => state.rolling,
  gravity: () => state.gravity,
  debug: () =>
    state.dice.map((die) => ({
      face: die.upFace(),
      pos: [die.body.position.x, die.body.position.y, die.body.position.z],
      centers: die.faceCenters.map((c) => [c.x, c.y, c.z]),
    })),
};

requestAnimationFrame(frame);
