export const TABLE = {
  half: 5.4,
  wallHeight: 1.35,
  wallThickness: 0.28,
  feltY: 0,
};

export const DIE_SIZE = 0.9;

export const GRAVITY_PRESETS = [
  { id: "zero", name: "Zero-g", g: 0, detail: "Free tumble" },
  { id: "pluto", name: "Pluto", g: 0.62, detail: "0.06 g" },
  { id: "moon", name: "Moon", g: 1.62, detail: "0.17 g" },
  { id: "mars", name: "Mars", g: 3.71, detail: "0.38 g" },
  { id: "earth", name: "Earth", g: 9.81, detail: "1.00 g" },
  { id: "saturn", name: "Saturn", g: 10.44, detail: "1.06 g" },
  { id: "neptune", name: "Neptune", g: 11.15, detail: "1.14 g" },
  { id: "jupiter", name: "Jupiter", g: 24.79, detail: "2.53 g" },
];

/** BoxGeometry / RoundedBoxGeometry group order: +X, -X, +Y, -Y, +Z, -Z */
export const FACE_BY_NORMAL = [
  { axis: [1, 0, 0], value: 3 },
  { axis: [-1, 0, 0], value: 4 },
  { axis: [0, 1, 0], value: 1 },
  { axis: [0, -1, 0], value: 6 },
  { axis: [0, 0, 1], value: 2 },
  { axis: [0, 0, -1], value: 5 },
];

export const DIE_TINTS = [
  { face: "#f4ead3", pip: "#1b1612", edge: "#c9b89a" },
  { face: "#efe4cc", pip: "#1b1612", edge: "#c4b191" },
  { face: "#7a1515", pip: "#f7efe0", edge: "#4e0d0d" },
  { face: "#f3e8d0", pip: "#1b1612", edge: "#c9b89a" },
  { face: "#243044", pip: "#f4ead3", edge: "#151c28" },
];
