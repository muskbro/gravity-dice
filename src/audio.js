let ctx;

export function unlockAudio() {
  const audio = getContext();
  if (audio.state === "suspended") audio.resume();
}

function getContext() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function playImpact(intensity) {
  const audio = getContext();
  if (audio.state !== "running") return;
  const t = audio.currentTime;
  const amp = Math.min(0.18, 0.03 + intensity * 0.06);

  const osc = audio.createOscillator();
  const noise = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();

  const buffer = audio.createBuffer(1, audio.sampleRate * 0.12, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buffer;

  osc.type = "sine";
  osc.frequency.setValueAtTime(70 + intensity * 50, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.1);
  filter.type = "lowpass";
  filter.frequency.value = 420 + intensity * 200;

  gain.gain.setValueAtTime(amp, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

  osc.connect(gain);
  noise.connect(filter).connect(gain);
  gain.connect(audio.destination);
  osc.start(t);
  noise.start(t);
  osc.stop(t + 0.14);
  noise.stop(t + 0.14);
}
