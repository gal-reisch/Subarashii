// A small free "timer done" chime synthesized with WebAudio — no audio file
// to bundle, works offline, costs nothing.
export function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const notes = [880, 1108, 1318]; // a bright little three-note bell

    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });

    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    // WebAudio unavailable — the vibration/notification/visual flash still fire.
  }
}
