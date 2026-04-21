// timer.js - ASTM E1105 sequence timer with audio cues

const AUDIO_BASE = "assets/audio";


const soundMap = {
  "Water Spray Rack Pressurization": `${AUDIO_BASE}/Simulated%20Rain.wav`,
  "Pressurization Cycle (1/4)": `${AUDIO_BASE}/Cycle1.wav`,
  "Ambient Pressure": `${AUDIO_BASE}/Ambient.wav`,
  "Pressurization Cycle (2/4)": `${AUDIO_BASE}/Cycle%202.wav`,
  "Pressurization Cycle (3/4)": `${AUDIO_BASE}/Cycle%203.wav`,
  "Pressurization Cycle (4/4)": `${AUDIO_BASE}/Cycle%20Final.wav`,
  "Test Complete": `${AUDIO_BASE}/Test%20Concluded.wav`
};

const seq = [
  ["Water Spray Rack Pressurization", 10],
  ["Pressurization Cycle (1/4)", 300],
  ["Ambient Pressure", 60],
  ["Pressurization Cycle (2/4)", 300],
  ["Ambient Pressure", 60],
  ["Pressurization Cycle (3/4)", 300],
  ["Ambient Pressure", 60],
  ["Pressurization Cycle (4/4)", 300]
];

function fmt(s){
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return h>0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
             : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
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

class E1105Timer {
  constructor({ onLog } = {}){
    this.i = 0;
    this.left = 0;
    this.total = 0;
    this.h = null;
    this.paused = false;
    this.onLog = onLog || (()=>{});
    this.audioCache = {};
    Object.entries(soundMap).forEach(([k,url]) => {
      const a = new Audio(url);
      a.preload = 'auto';
      this.audioCache[k] = a;
    });
  }

  log(msg){
    const ts = new Date().toLocaleString();
    this.onLog(`[${ts}] ${msg}`);
  }

  play(stepName){
    const a = this.audioCache[stepName];
    if (a){
      a.currentTime = 0;
      a.play().catch(()=>shortBeepFallback());
    } else {
      shortBeepFallback();
    }
  }

  snapshot(){
    return {
      current_step_index: this.i,
      current_step_name: this.i < seq.length ? seq[this.i][0] : 'Complete',
      seconds_remaining_in_step: this.left,
      total_seconds_in_step: this.total,
      steps: seq.map(([name, seconds], idx)=>({ index: idx, name, seconds }))
    };
  }

  reset(){
    if (this.h){ clearInterval(this.h); this.h=null; }
    this.paused=false; this.i=0; this.left=0; this.total=0;
    this.log('Reset.');
  }

  start({ onUI } = {}){
    if (this.h) return;
    try{ const unlock = new Audio(); unlock.muted=true; unlock.play().catch(()=>{});}catch(e){}

    this.paused=false; this.i=0;
    this._showStep(onUI);
    this.log('Sequence started.');
    this.h = setInterval(()=>this._tick(onUI), 1000);
  }

  pause(){
    if (!this.h || this.paused) return;
    this.paused=true;
    this.log('Paused.');
  }

  resume(){
    if (!this.h || !this.paused) return;
    this.paused=false;
    this.log('Resumed.');
  }

  _showStep(onUI){
    const [n,s] = seq[this.i];
    this.left=s; this.total=s;
    this.play(n);
    if (onUI) onUI({ type:'step', name:n, left:this.left, total:this.total, i:this.i, fmt });
  }

  _tick(onUI){
    if (this.paused) return;
    if (this.left <= 0){
      clearInterval(this.h); this.h=null;
      this.log(`Complete: ${seq[this.i][0]}`);
      this.i += 1;
      if (this.i >= seq.length){
        this.play('Test Complete');
        this.log('Finished.');
        if (onUI) onUI({ type:'done', fmt });
        return;
      }
      this._showStep(onUI);
      this.h = setInterval(()=>this._tick(onUI), 1000);
      return;
    }
    this.left -= 1;
    if (onUI) onUI({ type:'tick', name: seq[this.i][0], left:this.left, total:this.total, i:this.i, fmt });
  }
}