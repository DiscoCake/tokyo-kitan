let audioCtx = null, ambienceNodes = null;

function startAmbience() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buffer; src.loop = true;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = 400;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.04;
  src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
  src.start();
  ambienceNodes = { src, gain };
}

function stopAmbience() {
  if (ambienceNodes) { ambienceNodes.src.stop(); ambienceNodes = null; }
}

document.getElementById('ambience-btn').onclick = function() {
  if (ambienceNodes) { stopAmbience(); this.textContent = '🔇'; this.classList.remove('active'); }
  else { startAmbience(); this.textContent = '🔊'; this.classList.add('active'); }
};
