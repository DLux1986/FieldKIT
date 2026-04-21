// procedureA.js — ASTM E1105 Procedure A (15-minute uniform pressure)

const AUDIO_BASE = "../../assets/audio";

const completeSound = new Audio(`${AUDIO_BASE}/TestConcluded.wav`);
completeSound.preload = "auto";

function fmt(s){
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function shortBeepFallback(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    o.stop(ctx.currentTime + 0.2);
  }catch(e){}
}

export class ProcedureATimer {
  constructor({ onLog } = {}){
    this.left = 900; // 15 minutes
    this.h = null;
    this.paused = false;
    this.onLog = onLog || (()=>{});
  }

  log(msg){
    const ts = new Date().toLocaleString();
    this.onLog(`[${ts}] ${msg}`);
  }

  reset(){
    if (this.h){ clearInterval(this.h); this.h = null; }
    this.left = 900;
    this.paused = false;
    this.log("Reset.");
  }

  start({ onUI } = {}){
    if (this.h) return;

    this.paused = false;
    this.log("Procedure A started.");

    if (onUI) onUI({ type: "tick", left: this.left, fmt });

    this.h = setInterval(() => {
      if (this.paused) return;

      this.left -= 1;

      if (onUI) onUI({ type: "tick", left: this.left, fmt });

      if (this.left <= 0){
        clearInterval(this.h);
        this.h = null;

        completeSound.currentTime = 0;
        completeSound.play().catch(()=>shortBeepFallback());

        this.log("Procedure A complete.");
        if (onUI) onUI({ type: "done", fmt });
      }
    }, 1000);
  }

  pause(){
    if (!this.h || this.paused) return;
    this.paused = true;
    this.log("Paused.");
  }

  resume(){
    if (!this.h || !this.paused) return;
    this.paused = false;
    this.log("Resumed.");
  }
}
