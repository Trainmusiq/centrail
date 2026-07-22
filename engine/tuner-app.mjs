// Modo "En vivo" (v1.3): afinador en tiempo real + generador de drones.
// Cargado con import dinámico SOLO al entrar a #/tuner (index.html) — el drop
// zone del modo Grabación sigue siendo el héroe (brief de diseño §9).
import { drawDial } from "./dial.mjs";
import { NOTE_NAMES, hzToNote } from "./note-names.mjs";
import { TEMPERAMENTS, temperamentOffsetCents } from "./temperament.mjs";
import { getReference, setReference, onReferenceChange } from "./reference-store.mjs";
import { encodeWav } from "./wav.mjs";

const REF_PRESETS = [415, 432, 440, 442, 444];
const OCTAVE_MIN = 1, OCTAVE_MAX = 6;
const NO_SIGNAL_STREAK_REQUIRED = 3; // evita parpadeo en silencios cortos entre notas
const DRONE_DURATION_SEC = 8;
const DRONE_FADE_SEC = 0.015; // evita clicks en los bordes
const DRONE_GAIN = 0.25;

function noteToHz(semitoneIndex, octave, referenceHz, temperamentName, tonicIndex) {
  const rounded = (octave + 1) * 12 + semitoneIndex;
  let hz = referenceHz * Math.pow(2, (rounded - 69) / 12);
  const degree = ((semitoneIndex - tonicIndex) % 12 + 12) % 12;
  const offsetCents = temperamentOffsetCents(temperamentName, degree);
  return hz * Math.pow(2, offsetCents / 1200);
}

const TEMPLATE = `
  <div class="card full">
    <h2 data-k="tuner.refTitle"></h2>
    <div class="presets" id="liveRefPresets"></div>
    <div class="free-freq">
      <label for="liveFreeHz" data-k="correct.freeLabel"></label>
      <input type="number" id="liveFreeHz" step="0.1" min="200" max="880" placeholder="435">
      <span>Hz</span>
    </div>
    <div class="transpose-row" style="margin-top:12px">
      <select id="temperamentSelect" aria-label="Temperamento"></select>
      <select id="tonicSelect" aria-label="Tónica" style="display:none"></select>
    </div>
  </div>

  <div class="card full" id="tunerCard">
    <h2 data-k="tuner.title"></h2>
    <div id="micGate">
      <button class="preset active" id="micActivateBtn" type="button" style="padding:11px 22px"></button>
      <p class="drift-note" id="micPrivacyNote" style="margin-top:10px"></p>
      <select id="micDeviceSelect" aria-label="Dispositivo de entrada" style="display:none;margin-top:10px"></select>
    </div>
    <div class="err" id="micErrBox" style="margin-top:14px">
      <div class="err-msg" id="micErrMsg"></div>
    </div>
    <div id="liveDialWrap" style="display:none;text-align:center">
      <div class="dial-wrap">
        <svg id="dialLive" viewBox="0 0 340 120"></svg>
        <div class="dial-cap"><span>−50 ¢</span><span>0 ¢</span><span>+50 ¢</span></div>
      </div>
      <div class="hz"><span id="liveNoteName">—</span></div>
      <div class="verdict" id="liveCents">—</div>
      <div class="drift-note" id="liveStatus"></div>
      <div class="drift-note" id="liveTemperamentNote"></div>
      <div class="again" style="margin-top:14px">
        <button id="micDeactivateBtn"></button>
      </div>
    </div>
  </div>

  <div class="card full correct-card">
    <h2 data-k="drone.title"></h2>
    <div class="transpose-row">
      <select id="droneNote" aria-label="Nota"></select>
      <select id="droneOctave" aria-label="Octava"></select>
    </div>
    <div class="preview-controls" style="margin-top:12px">
      <button class="preview-btn" id="dronePlayBtn" type="button"></button>
      <button class="preview-btn" id="droneStopBtn" type="button" disabled></button>
      <button class="preview-btn" id="droneDownloadBtn" type="button"></button>
    </div>
  </div>
`;

export function initTunerMode(root, t) {
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector(`#${id}`);

  const els = {
    refPresets: $("liveRefPresets"), freeHz: $("liveFreeHz"),
    temperamentSelect: $("temperamentSelect"), tonicSelect: $("tonicSelect"),
    micGate: $("micGate"), micActivateBtn: $("micActivateBtn"), micPrivacyNote: $("micPrivacyNote"),
    micDeviceSelect: $("micDeviceSelect"), micErrBox: $("micErrBox"), micErrMsg: $("micErrMsg"),
    liveDialWrap: $("liveDialWrap"), dialLive: $("dialLive"), liveNoteName: $("liveNoteName"),
    liveCents: $("liveCents"), liveStatus: $("liveStatus"), liveTemperamentNote: $("liveTemperamentNote"),
    micDeactivateBtn: $("micDeactivateBtn"),
    droneNote: $("droneNote"), droneOctave: $("droneOctave"),
    dronePlayBtn: $("dronePlayBtn"), droneStopBtn: $("droneStopBtn"), droneDownloadBtn: $("droneDownloadBtn"),
  };

  let tr = t; // reasignado por updateLocale()
  let locale = "es";

  // ── estado de audio en vivo ──
  let audioCtx = null, workletNode = null, micSource = null, micStream = null;
  let noSignalStreak = 0;

  // ── estado del drone ──
  let droneAudioCtx = null, droneOsc = null, droneGain = null;

  function currentLocaleNoteNames() {
    return NOTE_NAMES[locale] || NOTE_NAMES.es;
  }

  function populateSelect(selectEl, options, selectedValue) {
    selectEl.innerHTML = "";
    for (const { value, label } of options) {
      const opt = document.createElement("option");
      opt.value = String(value);
      opt.textContent = label;
      if (String(value) === String(selectedValue)) opt.selected = true;
      selectEl.appendChild(opt);
    }
  }

  function renderStaticText() {
    root.querySelectorAll("[data-k]").forEach((el) => {
      el.textContent = tr(el.dataset.k);
    });
    els.micActivateBtn.textContent = tr("mic.activate");
    els.micPrivacyNote.textContent = tr("mic.privacyNote");
    els.micDeactivateBtn.textContent = tr("mic.deactivate");
    els.dronePlayBtn.textContent = tr("drone.play");
    els.droneStopBtn.textContent = tr("drone.stop");
    els.droneDownloadBtn.textContent = tr("drone.download");

    populateSelect(els.temperamentSelect, Object.keys(TEMPERAMENTS).map((k) => ({ value: k, label: tr(`temperament.${k}`) })), getReference().temperament);
    const names = currentLocaleNoteNames();
    populateSelect(els.tonicSelect, names.map((n, i) => ({ value: i, label: n })), getReference().tonic);
    populateSelect(els.droneNote, names.map((n, i) => ({ value: i, label: n })), Number(els.droneNote.value) || 9);
    populateSelect(els.droneOctave, Array.from({ length: OCTAVE_MAX - OCTAVE_MIN + 1 }, (_, i) => {
      const oct = OCTAVE_MIN + i;
      return { value: oct, label: String(oct) };
    }), Number(els.droneOctave.value) || 4);

    renderRefPresets();
    updateTemperamentUiVisibility();
    if (liveNoteState) renderLiveReading(liveNoteState);
  }

  // ── riel compartido ──
  function renderRefPresets() {
    const ref = getReference();
    els.refPresets.innerHTML = "";
    for (const hz of REF_PRESETS) {
      const btn = document.createElement("button");
      btn.className = "preset" + (ref.hz === hz ? " active" : "");
      btn.textContent = `${hz} Hz`;
      btn.addEventListener("click", () => {
        setReference({ hz });
        els.freeHz.value = "";
      });
      els.refPresets.appendChild(btn);
    }
  }
  els.freeHz.addEventListener("input", () => {
    const v = Number(els.freeHz.value);
    if (v > 0) setReference({ hz: v });
  });
  els.temperamentSelect.addEventListener("change", () => {
    setReference({ temperament: els.temperamentSelect.value });
  });
  els.tonicSelect.addEventListener("change", () => {
    setReference({ tonic: Number(els.tonicSelect.value) });
  });
  function updateTemperamentUiVisibility() {
    els.tonicSelect.style.display = getReference().temperament === "equal" ? "none" : "";
  }
  onReferenceChange(() => {
    renderRefPresets();
    updateTemperamentUiVisibility();
    if (liveNoteState) renderLiveReading(liveNoteState);
  });

  // ── afinador en vivo ──
  let liveNoteState = null; // último {hz, confidence} recibido

  function renderLiveReading(raw) {
    const ref = getReference();
    const { semitoneIndex, octave, centsFromEqual } = hzToNote(raw.hz, ref.hz);
    const degree = ((semitoneIndex - ref.tonic) % 12 + 12) % 12;
    const offset = temperamentOffsetCents(ref.temperament, degree);
    const deviationCents = centsFromEqual - offset;
    const names = currentLocaleNoteNames();
    els.liveNoteName.textContent = `${names[semitoneIndex]}${octave}`;
    els.liveCents.textContent = (deviationCents >= 0 ? "+" : "") + deviationCents.toFixed(1) + " ¢";
    els.liveStatus.textContent = tr("tuner.listening");
    els.liveTemperamentNote.textContent = ref.temperament === "equal" ? "" : tr("tuner.temperamentNote", { temperament: tr(`temperament.${ref.temperament}`), tonic: names[ref.tonic] });
    drawDial(els.dialLive, deviationCents);
  }

  function handleWorkletMessage(msg) {
    if (msg.type === "pitch") {
      noSignalStreak = 0;
      liveNoteState = msg;
      renderLiveReading(msg);
    } else if (msg.type === "no-signal") {
      noSignalStreak++;
      if (noSignalStreak >= NO_SIGNAL_STREAK_REQUIRED) {
        liveNoteState = null;
        els.liveNoteName.textContent = "—";
        els.liveCents.textContent = "—";
        els.liveStatus.textContent = tr("tuner.noSignal");
        els.liveTemperamentNote.textContent = "";
        drawDial(els.dialLive, 0);
      }
    }
  }

  async function populateDeviceList() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === "audioinput");
    if (inputs.length <= 1) { els.micDeviceSelect.style.display = "none"; return; }
    els.micDeviceSelect.innerHTML = "";
    for (const d of inputs) {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || tr("mic.deviceLabel");
      els.micDeviceSelect.appendChild(opt);
    }
    els.micDeviceSelect.style.display = "";
  }

  async function connectMic(deviceId) {
    const constraints = {
      audio: {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    };
    if (micStream) micStream.getTracks().forEach((tr2) => tr2.stop());
    micStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (micSource) micSource.disconnect();
    micSource = audioCtx.createMediaStreamSource(micStream);
    micSource.connect(workletNode);
  }

  async function activateMic() {
    els.micErrBox.classList.remove("on");
    els.micActivateBtn.disabled = true;
    els.micActivateBtn.textContent = tr("mic.requesting");
    try {
      // AudioContext creado/resumido SÍNCRONAMENTE en el gesto (requisito iOS)
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") await audioCtx.resume();

      const [, ] = await Promise.all([
        audioCtx.audioWorklet.addModule(new URL("../workers/tuner-processor.mjs?v=1.3.0", import.meta.url)),
        (async () => {
          const constraints = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
          micStream = await navigator.mediaDevices.getUserMedia(constraints);
        })(),
      ]);

      workletNode = new AudioWorkletNode(audioCtx, "tuner-pitch-processor");
      workletNode.port.onmessage = (e) => handleWorkletMessage(e.data);
      const gainZero = audioCtx.createGain();
      gainZero.gain.value = 0;
      micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(workletNode);
      workletNode.connect(gainZero);
      gainZero.connect(audioCtx.destination);

      await populateDeviceList();
      els.micDeviceSelect.onchange = () => connectMic(els.micDeviceSelect.value).catch((err) => showMicError(err));

      els.micGate.style.display = "none";
      els.liveDialWrap.style.display = "";
    } catch (err) {
      showMicError(err);
    } finally {
      els.micActivateBtn.disabled = false;
      els.micActivateBtn.textContent = tr("mic.activate");
    }
  }

  function showMicError(err) {
    els.micErrBox.classList.add("on");
    const main = tr("mic.denied", { message: err && err.message ? err.message : String(err) });
    const fallback = tr("mic.deniedFallback");
    els.micErrMsg.innerHTML = "";
    const p1 = document.createElement("div");
    p1.textContent = main;
    const p2 = document.createElement("div");
    p2.style.marginTop = "6px";
    p2.textContent = fallback;
    els.micErrMsg.append(p1, p2);
  }

  function deactivateMic() {
    if (micStream) micStream.getTracks().forEach((tr2) => tr2.stop());
    if (workletNode) workletNode.disconnect();
    if (micSource) micSource.disconnect();
    if (audioCtx) audioCtx.suspend();
    micStream = null; micSource = null; workletNode = null;
    noSignalStreak = 0; liveNoteState = null;
    els.micGate.style.display = "";
    els.liveDialWrap.style.display = "none";
    els.micDeviceSelect.style.display = "none";
  }

  els.micActivateBtn.addEventListener("click", activateMic);
  els.micDeactivateBtn.addEventListener("click", deactivateMic);

  // ── generador de drones ──
  function buildOscGain(ctx, hz) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = hz;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    return { osc, gain };
  }

  function currentDroneHz() {
    const ref = getReference();
    return noteToHz(Number(els.droneNote.value), Number(els.droneOctave.value), ref.hz, ref.temperament, ref.tonic);
  }

  function playDrone() {
    if (!droneAudioCtx) droneAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (droneAudioCtx.state === "suspended") droneAudioCtx.resume();
    stopDrone();
    const { osc, gain } = buildOscGain(droneAudioCtx, currentDroneHz());
    const now = droneAudioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(DRONE_GAIN, now + DRONE_FADE_SEC);
    gain.connect(droneAudioCtx.destination);
    osc.start();
    droneOsc = osc; droneGain = gain;
    els.dronePlayBtn.disabled = true;
    els.droneStopBtn.disabled = false;
  }

  function stopDrone() {
    if (droneOsc && droneGain && droneAudioCtx) {
      const now = droneAudioCtx.currentTime;
      droneGain.gain.cancelScheduledValues(now);
      droneGain.gain.setValueAtTime(droneGain.gain.value, now);
      droneGain.gain.linearRampToValueAtTime(0, now + DRONE_FADE_SEC);
      const osc = droneOsc;
      setTimeout(() => { try { osc.stop(); } catch { /* ya detenido */ } }, DRONE_FADE_SEC * 1000 + 20);
    }
    droneOsc = null; droneGain = null;
    els.dronePlayBtn.disabled = false;
    els.droneStopBtn.disabled = true;
  }

  async function downloadDrone() {
    const hz = currentDroneHz();
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(1, DRONE_DURATION_SEC * sampleRate, sampleRate);
    const { osc, gain } = buildOscGain(offlineCtx, hz);
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(DRONE_GAIN, DRONE_FADE_SEC);
    gain.gain.setValueAtTime(DRONE_GAIN, DRONE_DURATION_SEC - DRONE_FADE_SEC);
    gain.gain.linearRampToValueAtTime(0, DRONE_DURATION_SEC);
    gain.connect(offlineCtx.destination);
    osc.start(0);
    osc.stop(DRONE_DURATION_SEC);
    const rendered = await offlineCtx.startRendering();
    const channelData = [rendered.getChannelData(0).slice()];
    const bytes = encodeWav({ channelData, sampleRate, bitDepth: 16 });
    const blob = new Blob([bytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drone_${Math.round(hz)}Hz.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  els.dronePlayBtn.addEventListener("click", playDrone);
  els.droneStopBtn.addEventListener("click", stopDrone);
  els.droneDownloadBtn.addEventListener("click", downloadDrone);

  renderStaticText();

  return {
    updateLocale(newT, newLocale) {
      tr = newT;
      locale = newLocale;
      renderStaticText();
    },
    teardown() {
      deactivateMic();
      stopDrone();
    },
  };
}
