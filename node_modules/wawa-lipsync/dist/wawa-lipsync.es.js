var C = Object.defineProperty;
var D = (n, t, s) => t in n ? C(n, t, { enumerable: !0, configurable: !0, writable: !0, value: s }) : n[t] = s;
var r = (n, t, s) => D(n, typeof t != "symbol" ? t + "" : t, s);
function x(n) {
  return n.length ? n.reduce((t, s) => t + s, 0) / n.length : 0;
}
var e = /* @__PURE__ */ ((n) => (n.sil = "viseme_sil", n.PP = "viseme_PP", n.FF = "viseme_FF", n.TH = "viseme_TH", n.DD = "viseme_DD", n.kk = "viseme_kk", n.CH = "viseme_CH", n.SS = "viseme_SS", n.nn = "viseme_nn", n.RR = "viseme_RR", n.aa = "viseme_aa", n.E = "viseme_E", n.I = "viseme_I", n.O = "viseme_O", n.U = "viseme_U", n))(e || {});
const _ = {
  [e.sil]: "silence",
  [e.PP]: "plosive",
  [e.FF]: "fricative",
  [e.TH]: "fricative",
  [e.DD]: "plosive",
  [e.kk]: "plosive",
  [e.CH]: "fricative",
  [e.SS]: "fricative",
  [e.nn]: "plosive",
  [e.RR]: "fricative",
  [e.aa]: "vowel",
  [e.E]: "vowel",
  [e.I]: "vowel",
  [e.O]: "vowel",
  [e.U]: "vowel"
  /* vowel */
};
class P {
  // Max duration in ms before penalty kicks in
  constructor(t = {
    fftSize: 2048,
    historySize: 10
  }) {
    r(this, "features", null);
    r(this, "viseme", e.sil);
    r(this, "audioContext");
    r(this, "analyser");
    r(this, "dataArray");
    r(this, "history");
    r(this, "historySize");
    r(this, "sampleRate");
    r(this, "binWidth");
    r(this, "bands");
    r(this, "audioSource");
    r(this, "state", "silence");
    r(this, "visemeStartTime", 0);
    // Timestamp when current viseme started (ms)
    r(this, "maxVisemeDuration", 100);
    const { fftSize: s = 2048, historySize: c = 10 } = t;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)(), this.analyser = this.audioContext.createAnalyser(), this.analyser.fftSize = s, this.dataArray = new Uint8Array(this.analyser.frequencyBinCount), this.history = [], this.historySize = c, this.sampleRate = this.audioContext.sampleRate, this.binWidth = this.sampleRate / s, this.bands = [
      { start: 50, end: 200 },
      // Band 1: Low energy
      { start: 200, end: 400 },
      // Band 2: F1 lower
      { start: 400, end: 800 },
      // Band 3: F1 mid
      { start: 800, end: 1500 },
      // Band 4: F2 front
      { start: 1500, end: 2500 },
      // Band 5: F2/F3
      { start: 2500, end: 4e3 },
      // Band 6: Fricatives
      { start: 4e3, end: 8e3 }
      // Band 7: High fricatives
    ];
  }
  connectAudio(t) {
    if (this.audioContext.resume(), this.history = [], this.features = null, this.state = "silence", this.visemeStartTime = performance.now(), this.audioSource === t)
      return;
    if (this.audioSource = t, !t.src) {
      console.warn("An audio source must be set before connecting");
      return;
    }
    this.audioContext.createMediaElementSource(t).connect(this.analyser), this.analyser.connect(this.audioContext.destination);
  }
  // Connect live microphone
  async connectMicrophone() {
    try {
      const t = await navigator.mediaDevices.getUserMedia({ audio: !0 }), s = this.audioContext.createMediaStreamSource(t);
      return s.connect(this.analyser), this.analyser.connect(this.audioContext.destination), s;
    } catch (t) {
      throw console.error("Error accessing microphone:", t), t;
    }
  }
  extractFeatures() {
    this.analyser.getByteFrequencyData(this.dataArray);
    const t = this.bands.map(({ start: a, end: h }) => {
      const d = Math.round(a / this.binWidth), b = Math.min(
        Math.round(h / this.binWidth),
        this.dataArray.length - 1
      );
      return x(Array.from(this.dataArray.slice(d, b))) / 255;
    });
    let s = 0, c = 0;
    for (let a = 0; a < this.dataArray.length; a++) {
      const h = a * this.binWidth, d = this.dataArray[a] / 255;
      s += d, c += h * d;
    }
    const o = s > 0 ? c / s : 0, i = x(t), u = t.map((a, h) => {
      if (this.history.length < 2) return 0;
      const d = this.history[this.history.length - 2].bands[h];
      return a - d;
    }), m = {
      bands: t,
      deltaBands: u,
      volume: i,
      centroid: o
    };
    return s > 0 && (this.history.push(m), this.history.length > this.historySize && this.history.shift()), m;
  }
  getAveragedFeatures() {
    const t = this.history.length, s = {
      volume: 0,
      centroid: 0,
      bands: Array(this.bands.length).fill(0)
    };
    for (const o of this.history)
      s.volume += o.volume, s.centroid += o.centroid, o.bands.forEach((i, u) => s.bands[u] += i);
    const c = s.bands.map((o) => o / t);
    return {
      volume: s.volume / t,
      centroid: s.centroid / t,
      bands: c,
      deltaBands: c
    };
  }
  detectState() {
    const t = this.history[this.history.length - 1];
    if (!t) {
      this.state = "silence", this.viseme = e.sil;
      return;
    }
    const s = this.getAveragedFeatures(), c = t.volume - s.volume, o = t.centroid - s.centroid, i = this.computeVisemeScores(
      t,
      s,
      c,
      o
    ), u = this.adjustScoresForConsistency(i);
    let m = -1 / 0, a = e.sil;
    for (const d in u)
      u[d] > m && (m = u[d], a = d);
    let h = _[a];
    a !== this.viseme && (this.visemeStartTime = performance.now()), this.state = h, this.viseme = a;
  }
  // Compute scores for each viseme
  computeVisemeScores(t, s, c, o) {
    const i = {
      [e.sil]: 0,
      [e.PP]: 0,
      [e.FF]: 0,
      [e.TH]: 0,
      [e.DD]: 0,
      [e.kk]: 0,
      [e.CH]: 0,
      [e.SS]: 0,
      [e.nn]: 0,
      [e.RR]: 0,
      [e.aa]: 0,
      [e.E]: 0,
      [e.I]: 0,
      [e.O]: 0,
      [e.U]: 0
    }, [u, m, a, h, d, b, g] = t.bands;
    if (s.volume < 0.2 && t.volume < 0.2 && (i[e.sil] = 1), Object.entries(_).forEach(([y, f]) => {
      f === "plosive" && (c < 0.01 && (i[y] -= 0.5), s.volume < 0.2 && (i[y] += 0.2), o > 1e3 && (i[y] += 0.2));
    }), t.centroid > 1e3 && t.centroid < 8e3 && (t.centroid > 7e3 ? i[e.DD] += 0.6 : t.centroid > 5e3 ? i[e.kk] += 0.6 : t.centroid > 4e3 ? (i[e.PP] += 1, g > 0.25 && t.centroid < 6e3 && (i[e.DD] += 1.4)) : i[e.nn] += 0.6), o > 1e3 && t.centroid > 6e3 && s.centroid > 5e3 && t.bands[6] > 0.4 && s.bands[6] > 0.3 && (i[e.FF] = 0.7), s.volume > 0.1 && s.centroid < 6e3 && t.centroid < 6e3) {
      const [y, f, l, v, p] = s.bands, w = Math.abs(y - f), A = Math.max(
        Math.abs(f - l),
        Math.abs(f - v),
        Math.abs(l - v)
      );
      (l > 0.1 || v > 0.1) && (v > l && (i[e.aa] = 0.8, l > f && (i[e.aa] += 0.2)), l > f && l > v && (i[e.I] = 0.7), w < 0.25 && (i[e.U] = 0.7), A < 0.25 && (i[e.O] = 0.9), f > l && l > v && (i[e.E] = 1), l < 0.2 && v > 0.3 && (i[e.I] = 0.7), l > 0.25 && p > 0.25 && (i[e.O] = 0.7), l < 0.15 && p < 0.15 && (i[e.U] = 0.7));
    }
    return i;
  }
  // Adjust scores based on current state and viseme for consistency
  adjustScoresForConsistency(t) {
    const s = { ...t };
    if (this.viseme && this.state) {
      const o = performance.now() - this.visemeStartTime;
      for (const i in s)
        if (i === this.viseme) {
          let m;
          if (o <= 100)
            m = 1.3;
          else if (o <= this.maxVisemeDuration) {
            const h = this.maxVisemeDuration - 100;
            m = 1.3 - 0.3 * ((o - 100) / h);
          } else {
            const h = o - this.maxVisemeDuration;
            m = Math.max(0.5, 1 - h / 1e3);
          }
          s[i] *= m;
        }
    }
    return s;
  }
  processAudio() {
    this.features = this.extractFeatures(), this.detectState();
  }
}
export {
  P as Lipsync,
  e as VISEMES
};
