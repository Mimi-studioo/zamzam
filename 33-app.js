/* زمزم — SPA, offline-first. المحتوى في content.js و quran-full.json (ملفات بيانات منفصلة عن الكود) */
(function(){
'use strict';
const view = document.getElementById('view');
const toastEl = document.getElementById('toast');
let QURAN = null; // full mushaf: [{n, name, en, a:[[ayahNum, text], ...]}]

/* ---------- persistence ---------- */
const store = {
  get(k, d){ try{ const v = localStorage.getItem('zamzam:'+k); return v===null? d : JSON.parse(v);}catch(e){return d;} },
  set(k, v){ try{ localStorage.setItem('zamzam:'+k, JSON.stringify(v)); }catch(e){} }
};

/* ---------- points & rewards ---------- */
const BADGES = [
  {pts:50,  name:'بداية النور'},
  {pts:150, name:'مجتهد'},
  {pts:300, name:'نجم زمزم'}
];
function getPoints(){ return store.get('points', 0); }
function addPoints(n, why){
  const p = getPoints()+n; store.set('points', p); renderPoints();
  toast(`+${n} نقطة ${why? '— '+why : ''} ✓`);
  BADGES.forEach(b=>{
    const earned = store.get('badge:'+b.pts, false);
    if(!earned && p>=b.pts){ store.set('badge:'+b.pts, true); setTimeout(()=>toast('مبروك! كسبتي وسام '+b.name), 1600); }
  });
}
function renderPoints(){ document.getElementById('points-badge').innerHTML = ic('star',13)+' '+getPoints(); }

/* ---------- toast ---------- */
let toastT=null;
function toast(msg){ toastEl.textContent=msg; toastEl.classList.remove('hidden');
  clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.add('hidden'), 2600); }

/* ---------- network badge ---------- */
function renderNet(){
  const el = document.getElementById('net-badge');
  const on = navigator.onLine;
  el.textContent = on? 'متصل' : 'أوفلاين ✓';
  el.className = 'badge net ' + (on? 'on':'off');
}
window.addEventListener('online', renderNet);
window.addEventListener('offline', renderNet);

/* ---------- helpers ---------- */
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function cleanName(nm){ return String(nm||'').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g,''); }
function h(html){ view.innerHTML = html; window.scrollTo(0,0); }
function pad3(n){ return String(n).padStart(3,'0'); }
function currentReciter(){ return store.get('reciter', CONTENT.audio.reciters[0].id); }
function reciterById(id){ return CONTENT.audio.reciters.find(r=>r.id===id) || CONTENT.audio.reciters[0]; }
function audioUrl(recId, n){ return reciterById(recId).urlPattern.replace('{n3}', pad3(n)); }
function surah(n){ return QURAN.find(s=>s.n===n); }
const BISM_DISPLAY = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

/* ---------- persistent audio player + media session ---------- */
const player = {
  el: null, bar: null, current: 0, repeat: false,
  init(){
    this.el = document.getElementById('audio-el');
    this.bar = document.getElementById('player-bar');
    this.el.addEventListener('ended', ()=>{ if(!this.repeat && this.current && this.current<114) this.play(this.current+1); });
    this.el.addEventListener('play', ()=> this.syncUI());
    this.el.addEventListener('pause', ()=> this.syncUI());
    document.getElementById('pb-toggle').onclick = ()=>{ this.el.paused? this.el.play() : this.el.pause(); };
    document.getElementById('pb-repeat').onclick = ()=>{
      this.repeat = !this.repeat; this.el.loop = this.repeat; this.syncUI();
      toast(this.repeat? 'تكرار السورة شغال' : 'التكرار اتقفل');
    };
    document.getElementById('pb-close').onclick = ()=> this.stop();
    if('mediaSession' in navigator){
      try{
        navigator.mediaSession.setActionHandler('play', ()=> this.el.play());
        navigator.mediaSession.setActionHandler('pause', ()=> this.el.pause());
        navigator.mediaSession.setActionHandler('previoustrack', ()=>{ if(this.current>1) this.play(this.current-1); });
        navigator.mediaSession.setActionHandler('nexttrack', ()=>{ if(this.current<114) this.play(this.current+1); });
      }catch(e){}
    }
  },
  async play(n){
    const s = surah(n); if(!s) return;
    const url = audioUrl(currentReciter(), n);
    let src = url, offline = false;
    try{ const hit = await (await caches.open('zamzam-audio')).match(url);
      if(hit){ src = URL.createObjectURL(await hit.blob()); offline = true; } }catch(e){}
    if(!offline && !navigator.onLine){ toast('السورة دي مش متحملة للأوفلاين — حمليها وانتي متصلة'); return; }
    this.current = n; this.offline = offline;
    this.el.src = src; this.el.loop = this.repeat;
    this.el.play().catch(()=>{});
    this.bar.classList.remove('hidden');
    if('mediaSession' in navigator){
      try{ navigator.mediaSession.metadata = new MediaMetadata({
        title: s.name, artist: reciterById(currentReciter()).name, album: 'زمزم',
        artwork: [{src:'icon-512.png', sizes:'512x512', type:'image/png'}]
      }); }catch(e){}
    }
    this.syncUI();
  },
  stop(){
    this.el.pause(); this.el.removeAttribute('src'); this.el.load();
    this.current = 0; this.bar.classList.add('hidden');
  },
  syncUI(){
    if(!this.current) return;
    const s = surah(this.current);
    document.getElementById('pb-title').innerHTML =
      esc(cleanName(s.name)) + ' <span class="muted">• '+esc(reciterById(currentReciter()).name)+(this.offline?' • أوفلاين':'')+'</span>';
    document.getElementById('pb-toggle').textContent = this.el.paused? '▶' : '⏸';
    document.getElementById('pb-repeat').classList.toggle('on', this.repeat);
  }
};

/* ---------- home ---------- */
/* ---------- SVG icons (no emoji in UI) ---------- */
const ICONS = {
sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/>',
moon:'<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>',
headphones:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4" height="7" rx="2"/><rect x="17" y="13.5" width="4" height="7" rx="2"/>',
book:'<path d="M12 6.5C10.5 5 8.3 4.5 4.5 4.5c-.8 0-1.5.1-1.5.1v14s.7-.1 1.5-.1c3.8 0 6 .5 7.5 2 1.5-1.5 3.7-2 7.5-2 .8 0 1.5.1 1.5.1v-14s-.7-.1-1.5-.1c-3.8 0-6 .5-7.5 2z"/><path d="M12 6.5v14"/>',
mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>',
hands:'<path d="M7 11.5V7a1.5 1.5 0 0 1 3 0v4m0-6V4.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0v4.5c0 4-2.5 7-6.5 7s-6-2.3-6.9-5.8L4.3 9.9c-.4-1.1.5-2.2 1.5-1.8.5.2.9.6 1.2 1.2l1 2.2"/>',
kaaba:'<rect x="4" y="6" width="16" height="14" rx="1.5"/><path d="M4 9.5h16M9 20v-4a1.5 1.5 0 0 1 3 0v4"/>',
scroll:'<path d="M7 4h10.5A2.5 2.5 0 0 1 20 6.5V18a2 2 0 0 1-2 2H7"/><path d="M7 4a2 2 0 0 0-2 2v12.5A1.5 1.5 0 0 0 6.5 20H17a3 3 0 0 1-3-3V4"/><path d="M10 9h5M10 13h5"/>',
star:'<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z"/>',
gamepad:'<rect x="2.5" y="7.5" width="19" height="10.5" rx="5"/><path d="M8 11v3.5M6.2 12.75h3.6"/><circle cx="15.5" cy="11.6" r=".9" fill="currentColor" stroke="none"/><circle cx="18" cy="14" r=".9" fill="currentColor" stroke="none"/>',
beads:'<path d="M12 2.5v2"/><circle cx="12" cy="13.5" r="7.5"/><circle cx="12" cy="13.5" r="3"/>',
info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/>',
heart:'<path d="M12 20s-7.5-4.6-9.3-9.2C1.6 7.7 3.6 4.5 6.8 4.5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.2 0 5.2 3.2 4.1 6.3C19.5 15.4 12 20 12 20z"/>',
check:'<path d="M4.5 12.5l5 5L19.5 7"/>',
back:'<path d="M9.5 6l6 6-6 6"/>',
home:'<path d="M4 11l8-7 8 7v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20z"/><path d="M9.5 21.5v-6h5v6"/>',
bell:'<path d="M6 9.5a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0"/>',
calendar:'<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 2.5V6M16 2.5V6"/>',
sparkles:'<path d="M12 4l1.6 4.6L18 10l-4.4 1.4L12 16l-1.6-4.6L6 10l4.4-1.4z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
share:'<circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="5.5" r="2.5"/><circle cx="17" cy="18.5" r="2.5"/><path d="M8.2 10.8l6.6-4M8.2 13.2l6.6 4"/>',
chart:'<path d="M4 20.5h16.5"/><path d="M7 16.5v-5M12 16.5V7.5M17 16.5v-8"/>',
gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1 2.4a7 7 0 0 1 2.3 1l2.5-.7 1.4 2.4-2.5-.7a7 7 0 0 1-2.3 1l-1 2.4h-2.8l-.8-2.5a7 7 0 0 1-2.3-.9l-2.5.8-1.5-2.4 1.8-1.9a7 7 0 0 1 0-2.4L2.4 8.9 3.9 6.5l2.5.7a7 7 0 0 1 2.3-1l.9-2.4z"/>'
};
function ic(name, size){ size=size||22; return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="flex:none">'+(ICONS[name]||'')+'</svg>'; }

const TILES = [
  {r:'wird',          ic:'calendar',  lbl:'وردي اليومي', sub:'مهام يومك بالصح'},
  {r:'adhkar-sabah',  ic:'sun',       lbl:'أذكار الصباح'},
  {r:'adhkar-masaa',  ic:'moon',      lbl:'أذكار المساء'},
  {r:'quran-read',    ic:'book',      lbl:'ورد القراءة', sub:'المصحف كامل أوفلاين'},
  {r:'quran-audio',   ic:'headphones',lbl:'القرآن صوت', sub:'استماع + تحميل أوفلاين'},
  {r:'tasbih',        ic:'beads',     lbl:'السبحة الإلكترونية', sub:'عدّاد بيتحفظ'},
  {r:'duas',          ic:'hands',     lbl:'أدعية'},
  {r:'lessons',       ic:'mic',       lbl:'دروس صوتية'},
  {r:'seerah',        ic:'kaaba',     lbl:'السيرة النبوية'},
  {r:'prophets',      ic:'scroll',    lbl:'قصص الأنبياء'},
  {r:'sahaba',        ic:'star',      lbl:'قصص الصحابة'},
  {r:'games',         ic:'gamepad',   lbl:'ألعاب وجوائز', sub:'أكمل الآية + أسئلة'},
  {r:'stats',         ic:'chart',     lbl:'إحصائياتك', sub:'سلسلة أيامك ونقاطك'},
  {r:'ayah',          ic:'moon',      lbl:'آية وتدبر'},
  {r:'reminder',      ic:'bell',      lbl:'التذكير اليومي'},
  {r:'settings',      ic:'gear',      lbl:'الإعدادات'},
  {r:'about',         ic:'info',      lbl:'حول التطبيق'}
];
const FRIDAY_DEFAULT = 'يوم الجمعة: اقرأي سورة الكهف وأكثري من الصلاة على النبي ﷺ';
function dailyWird(){
  const items = CONTENT.duas.concat(CONTENT.sabah.map(x=>({cat:'ذكر', text:x.text})));
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  return items[doy % items.length];
}
function todayProgress(){
  const day = new Date().toISOString().slice(0,10);
  function frac(kind){ const prog = store.get('dhikr:'+kind+':'+day, {});
    const items = CONTENT[kind];
    const got = items.reduce((s,it)=> s + Math.min(it.count, prog[it.id]||0), 0);
    const all = items.reduce((s,it)=> s+it.count, 0);
    return {got, all}; }
  const s = frac('sabah'), m = frac('masaa');
  const tasbihTotal = store.get('tasbih:total:'+day, 0);
  return {s, m, tasbihTotal};
}
function activeSeason(){
  const today = new Date().toISOString().slice(0,10);
  return (CONTENT.seasons||[]).find(s => s.on || (s.start && s.end && today>=s.start && today<=s.end)) || null;
}

/* ---------- وردي اليومي (day strip + checkable pills) ---------- */
function todayKey(d){ d=d||new Date(); return d.toISOString().slice(0,10); }
let wirdSel = null;
function renderWird(){
  const sel = wirdSel || todayKey();
  const today = todayKey();
  const now = new Date();
  const off = (now.getDay()+1)%7; /* days since Saturday */
  const arDays=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  let strip='';
  for(let i=0;i<7;i++){ const d=new Date(now); d.setDate(now.getDate()-off+i);
    const k=todayKey(d);
    strip += `<div class="day${k===sel?' sel':''}" data-day="${k}"><div class="day-name">${arDays[d.getDay()]}</div><div class="day-num">${d.getDate()}</div></div>`; }
  const done = store.get('wird-'+sel, {});
  const tp = todayProgress();
  const isToday = sel===today;
  const pills = [
    {k:'sabah', lbl:'أذكار الصباح', go:'adhkar-sabah', auto: isToday && tp.s.all>0 && tp.s.got>=tp.s.all},
    {k:'masaa', lbl:'أذكار المساء', go:'adhkar-masaa', auto: isToday && tp.m.all>0 && tp.m.got>=tp.m.all},
    {k:'quran', lbl:'قراءة جزء من القرآن', go:'quran-read', auto:false},
    {k:'salawat', lbl:'الصلاة على النبي', go:'tasbih', auto:false}
  ];
  const doneCount = pills.filter(p=> done[p.k] || p.auto).length;
  const w = dailyWird();
  h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><h2 class="page-title">${ic('calendar')} وردي اليومي</h2>
    <div class="day-strip">${strip}</div>` +
    pills.map(p=>{
      const on = done[p.k] || p.auto;
      return `<div class="pill${on?' done':''}"><span class="pill-lbl" data-go="${p.go}">${p.lbl}</span><span class="check" data-k="${p.k}">${ic('check',16)}</span></div>`;
    }).join('') +
    `<div class="card enc-card"><div class="enc-heart">${ic('heart',30)}</div>
      <div style="font-size:20px;font-weight:800;margin-bottom:4px">${doneCount===4? 'ممتاز!':(doneCount>=2? 'أحسنتِ!':'بسم الله نبدأ')}</div>
      <div class="muted">${doneCount===4? 'أنتِ على الطريق الصحيح — وردكِ كامل النهارده':(doneCount>0? 'كملتي '+doneCount+' من 4 — كل خطوة بتفرق':'اختاري أي مهمة تبدأي بيها يومكِ')}</div></div>
    <div class="card wird-card"><div class="muted">${ic('moon',15)} ورد النهارده</div><div class="dhikr-text">${esc(w.text)}</div>
      <div style="margin-top:8px;text-align:left"><button class="btn" id="ics-btn">${ic('calendar',15)} تنبيه يومي في كالندر الموبايل</button></div></div>`);
  view.querySelectorAll('.day').forEach(el=> el.onclick=()=>{ wirdSel=el.dataset.day; renderWird(); });
  view.querySelectorAll('.pill .check').forEach(el=> el.onclick=(e)=>{ e.stopPropagation();
    const cur = store.get('wird-'+sel, {}); const k=el.dataset.k; cur[k]=!cur[k]; store.set('wird-'+sel, cur); renderWird(); });
  view.querySelectorAll('.pill .pill-lbl').forEach(el=> el.onclick=()=> location.hash='#'+el.dataset.go);
  const ib=document.getElementById('ics-btn'); if(ib) ib.onclick=exportWirdICS;
}

/* ---------- .ics: تنبيه الورد اليومي (٤٥ يوم، كل يوم بدعاء مختلف) + الجمعة ---------- */
function icsEsc(s){ return (s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
function icsDate(d){ return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'); }
function exportWirdICS(){
  const items = CONTENT.duas.concat(CONTENT.sabah.map(x=>({cat:'ذكر', text:x.text})));
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  const DAYS = 45, HOUR = 7;
  const stamp = new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  let ev = '';
  for(let i=0;i<DAYS;i++){
    const d = new Date(); d.setDate(d.getDate()+i); d.setHours(HOUR,0,0,0);
    const w = items[(doy+i) % items.length];
    const dEnd = new Date(d); dEnd.setMinutes(dEnd.getMinutes()+15);
    const fmt = x => icsDate(x)+'T'+String(x.getHours()).padStart(2,'0')+String(x.getMinutes()).padStart(2,'0')+'00';
    ev += 'BEGIN:VEVENT\r\nUID:zamzam-wird-'+icsDate(d)+'@zamzam\r\nDTSTAMP:'+stamp+'\r\nDTSTART:'+fmt(d)+'\r\nDTEND:'+fmt(dEnd)+'\r\nSUMMARY:ورد النهارده\r\nDESCRIPTION:'+icsEsc(w.text)+'\r\nBEGIN:VALARM\r\nTRIGGER:PT0M\r\nACTION:DISPLAY\r\nDESCRIPTION:ورد النهارده\r\nEND:VALARM\r\nEND:VEVENT\r\n';
  }
  const fri = (CONTENT.friday && CONTENT.friday.text) || FRIDAY_DEFAULT;
  const d0 = new Date(); const add = (5 - d0.getDay() + 7) % 7 || 7; d0.setDate(d0.getDate()+add); d0.setHours(9,0,0,0);
  const fmt = x => icsDate(x)+'T'+String(x.getHours()).padStart(2,'0')+'00';
  const fEnd = new Date(d0); fEnd.setMinutes(30);
  ev += 'BEGIN:VEVENT\r\nUID:zamzam-friday-'+icsDate(d0)+'@zamzam\r\nDTSTAMP:'+stamp+'\r\nDTSTART:'+fmt(d0)+'\r\nDTEND:'+fmt(fEnd)+'\r\nRRULE:FREQ=WEEKLY;COUNT=8\r\nSUMMARY:تذكير الجمعة\r\nDESCRIPTION:'+icsEsc(fri)+'\r\nBEGIN:VALARM\r\nTRIGGER:PT0M\r\nACTION:DISPLAY\r\nDESCRIPTION:تذكير الجمعة\r\nEND:VALARM\r\nEND:VEVENT\r\n';
  const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//zamzam//wird//AR\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:زمزم - الورد اليومي\r\n'+ev+'END:VCALENDAR\r\n';
  const blob = new Blob([ics], {type:'text/calendar;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'zamzam-wird.ics';
  document.body.appendChild(a); a.click(); a.remove();
  toast('اتنزّل ملف الكالندر — افتحيه ودوسي إضافة وهيفضل يفكرك حتى أوفلاين. بعد ٤٥ يوم ارجعي دوسي هنا تاني للتجديد.');
}

function renderHome(){
  const bm = store.get('bookmark', null);
  const isFriday = new Date().getDay() === 5;
  const season = activeSeason();
  if(season && season.accent) document.documentElement.style.setProperty('--gold', season.accent);
  else document.documentElement.style.setProperty('--gold', '#f0f0f0');
  const fridayText = store.get('friday-text', FRIDAY_DEFAULT);
  const w = dailyWird();
  const tp = todayProgress();
  const hr = new Date().getHours();
  const greet = hr<12? 'صباح الخير' : (hr<18? 'مساء الخير' : 'مساء النور');
  const doneT = store.get('wird-'+todayKey(), {});
  const pillsDone = ['sabah','masaa','quran','salawat'].filter(k=> doneT[k]
    || (k==='sabah' && tp.s.all>0 && tp.s.got>=tp.s.all)
    || (k==='masaa' && tp.m.all>0 && tp.m.got>=tp.m.all)).length;
  const pct = Math.round(((tp.s.all? tp.s.got/tp.s.all:0)+(tp.m.all? tp.m.got/tp.m.all:0)+pillsDone/4)/3*100);
  const RC = 2*Math.PI*54;
  h(`<div class="greet">السلام عليكِ ورحمة الله<div class="greet-sub">${greet}، كيف حالكِ اليوم؟</div></div>` +
    `<div class="card ring-card" id="ring-go">
      <div class="ring-wrap"><svg viewBox="0 0 120 120" width="106" height="106">
        <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f4f4f4"/><stop offset="100%" stop-color="#bdbdbd"/></linearGradient></defs>
        <circle cx="60" cy="60" r="54" class="ring-bg"/>
        <circle cx="60" cy="60" r="54" class="ring-fg" stroke-dasharray="${RC.toFixed(1)}" stroke-dashoffset="${(RC*(1-pct/100)).toFixed(1)}"/>
      </svg><div class="ring-num">${pct}%</div></div>
      <div class="ring-info"><div style="font-size:18px;font-weight:800">من وردكِ اليوم</div>
        <div class="muted" style="margin:4px 0 10px;font-size:13px">أذكار + قراءة + مهام اليوم</div>
        <button class="btn primary">متابعة الورد</button></div></div>` +
    (season? `<div class="card friday-card" style="text-align:center">${esc(season.banner)}</div>` : '') +
    (season && season.duas && season.duas.length? season.duas.map(d=>`<div class="card"><h3>${esc(d.cat)}</h3><div class="dhikr-text">${esc(d.text)}</div></div>`).join('') : '') +
    `<div class="grid">` +
    TILES.map(t=>`<div class="tile" data-go="${t.r}"><span class="ico">${ic(t.ic,26)}</span><span class="lbl">${t.lbl}</span>${t.sub?`<span class="sub">${t.sub}</span>`:''}</div>`).join('') +
    `</div>` +
    `<div class="card wird-card"><div class="muted">${ic('moon',15)} ورد النهارده</div><div class="dhikr-text">${esc(w.text)}</div><div style="margin-top:8px;text-align:left"><button class="btn" id="ics-btn">${ic('calendar',15)} تنبيه يومي في كالندر الموبايل</button></div></div>` +
    `<div class="card"><div class="muted" style="margin-bottom:8px">${ic('chart',15)} تقدمك النهارده</div>
      <div class="muted">أذكار الصباح: ${tp.s.got}/${tp.s.all}</div><div class="progress" style="margin:4px 0 8px"><i style="width:${tp.s.all? Math.round(tp.s.got/tp.s.all*100):0}%"></i></div>
      <div class="muted">أذكار المساء: ${tp.m.got}/${tp.m.all}</div><div class="progress" style="margin:4px 0 8px"><i style="width:${tp.m.all? Math.round(tp.m.got/tp.m.all*100):0}%"></i></div>
      <div class="muted">تسبيح النهارده: ${tp.tasbihTotal} تسبيحة</div></div>` +
    (isFriday? `<div class="card friday-card">${esc(fridayText)}</div>` : '') +
    (bm? `<div class="card resume-card" id="resume">${ic('book',15)} كمّلي قراءتك: <b>${esc(cleanName(surah(bm.s).name))}</b> — آية ${bm.a}</div>` : '') +
    `<div class="notice">القصص والدروس نماذج مؤقتة لحد ما مصادرك توصل. المصحف والأذكار والأدعية والألعاب مراجعة وشغالين أوفلاين بالكامل.</div>`);
  view.querySelectorAll('[data-go]').forEach(el=> el.onclick = ()=> location.hash = '#'+el.dataset.go);
  const rs = document.getElementById('resume');
  if(rs) rs.onclick = ()=> location.hash = '#read/'+bm.s;
  const rg=document.getElementById('ring-go'); if(rg) rg.onclick=()=> location.hash='#wird';
  const ib=document.getElementById('ics-btn'); if(ib) ib.onclick=exportWirdICS;
}

/* ---------- adhkar ---------- */
function adhkarDoneKey(kind){ const d=new Date(); return 'dhikr:'+kind+':'+d.toISOString().slice(0,10); }
function renderAdhkar(kind){
  const items = CONTENT[kind];
  const title = (kind==='sabah'? ic('sun') : ic('moon')) + (kind==='sabah'? ' أذكار الصباح' : ' أذكار المساء');
  let prog = store.get(adhkarDoneKey(kind), {});
  const totalLeft = items.reduce((s,it)=> s + Math.max(0, it.count - (prog[it.id]||0)), 0);
  h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><h2 class="page-title">${title}</h2>
     <div class="muted">اضغطي على الزرار بعد كل مرة. التقدم بيتحفظ على جهازك وبيشتغل أوفلاين.</div>
     <div class="notice">المحتوى نموذج مؤقت للمراجعة.</div>
     <div id="dhikr-list"></div>
     <div style="text-align:center;margin-top:14px">
       ${totalLeft===0? '<div class="score-line">ما شاء الله، خلصتي وردك النهارده ✓</div>' : ''}
       <button class="btn" id="reset-dhikr">إعادة من الأول</button>
     </div>`);
  const list = document.getElementById('dhikr-list');
  list.innerHTML = items.map(it=>{
    const done = prog[it.id]||0, left = Math.max(0, it.count-done), pct = Math.min(100, done/it.count*100);
    return `<div class="card">
      <h3>${esc(it.title)}</h3>
      <div class="dhikr-text">${esc(it.text)}</div>
      ${it.fadl? `<div class="fadl">الفضل: ${esc(it.fadl)}</div>`:''}
      <div class="counter">
        <button class="count-btn" data-id="${it.id}" ${left===0?'disabled':''}>${left===0?'✓':left}</button>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <div class="count-label">${done}/${it.count}</div>
      </div></div>`;
  }).join('');
  list.querySelectorAll('.count-btn').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.id;
      prog = store.get(adhkarDoneKey(kind), {});
      prog[id] = (prog[id]||0)+1;
      store.set(adhkarDoneKey(kind), prog);
      if(items.every(it=> (prog[it.id]||0) >= it.count)){
        const bonusKey = adhkarDoneKey(kind)+':bonus';
        if(!store.get(bonusKey,false)){ store.set(bonusKey,true); addPoints(20,'إتمام '+title); }
      }
      renderAdhkar(kind);
    };
  });
  document.getElementById('reset-dhikr').onclick = ()=>{ store.set(adhkarDoneKey(kind), {}); renderAdhkar(kind); };
}

/* ---------- duas ---------- */
function normAr(t){ return (t||'').replace(/[\u064B-\u0652\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي'); }
function renderDuas(){
  h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><h2 class="page-title">${ic('hands')} أدعية</h2>
     <input class="search-box" id="dua-q" placeholder="ابحثي في الأدعية…" />
     <div id="dua-list"></div>`);
  const list = document.getElementById('dua-list');
  function draw(q){
    const nq = normAr(q);
    const items = CONTENT.duas.filter(d=> !nq || normAr(d.text).includes(nq) || normAr(d.cat).includes(nq));
    list.innerHTML = items.length? items.map(d=>{ const i=CONTENT.duas.indexOf(d);
      return `<div class="card dua-card" data-i="${i}">
        <div class="dua-head"><span class="dua-cat">${esc(d.cat)}</span><span class="dua-toggle">${ic('back',14)}</span></div>
        <div class="dua-preview">${esc(d.text.slice(0,64))}…</div>
        <div class="dua-body"><div class="dhikr-text">${esc(d.text)}</div>
          <div class="dua-actions"><button class="btn" data-copy="${i}">${ic('check',14)} نسخ الدعاء</button>${navigator.share? ` <button class="btn" data-share="${i}">${ic('share',14)} مشاركة</button>`:''}</div></div></div>`;
    }).join('') : `<div class="notice">لا توجد نتائج مطابقة لبحثك.</div>`;
    list.querySelectorAll('.dua-card').forEach(el=> el.onclick=(e)=>{
      if(e.target.closest('[data-copy],[data-share]')) return;
      el.classList.toggle('open'); });
    list.querySelectorAll('[data-copy]').forEach(b=> b.onclick=async ()=>{
      const d=CONTENT.duas[+b.dataset.copy];
      try{ await navigator.clipboard.writeText(d.text); toast('اتنسخ الدعاء ✓'); }
      catch(e){ toast('النسخ مش متاح من هنا'); } });
    list.querySelectorAll('[data-share]').forEach(b=> b.onclick=async ()=>{
      const d=CONTENT.duas[+b.dataset.share];
      try{ await navigator.share({text: d.text}); }catch(e){} });
  }
  draw('');
  document.getElementById('dua-q').oninput=(e)=> draw(e.target.value);
}

/* ---------- stories ---------- */
function renderStories(kind, title, ico){
  h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><h2 class="page-title">${ic(ico)} ${title}</h2>
     <div class="notice">هنا هتتعرض فيديوهات قصيرة بأسلوب الوايت بورد (حلقات صغيرة بصور توضيحية) — قيد التجهيز. تحت دي نماذج نصية مؤقتة.</div>` +
    CONTENT.stories[kind].map(s=>`<div class="card"><h3>${esc(s.title)}</h3><div class="dhikr-text" style="white-space:pre-line">${esc(s.body)}</div></div>`).join(''));
}

/* ---------- lessons (كروت لينكات: عنوان + صورة معاينة متخزنة، اللينك نفسه أونلاين) ---------- */
function renderLessons(){
  const ls = CONTENT.lessons || [];
  h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><h2 class="page-title">${ic('mic')} دروس صوتية</h2>
     <div class="notice">خلي بالك، دي لينكات هتوديك لفيديو الدرس.</div>
     <div class="notice notice-sub">الكارت وصورته بيشتغلوا أوفلاين، أما اللينك نفسه بيحتاج نت عشان يفتح.</div>` +
     (ls.length? `<div id="lesson-list">` + ls.map(l=>{
        const thumb = l.img? `<img class="lesson-thumb" src="${esc(l.img)}" alt="" loading="lazy">`
                           : `<div class="lesson-thumb lesson-thumb-ph">${ic("mic",26)}</div>`;
        return `<div class="card lesson-card" data-url="${esc(l.url||'')}">${thumb}
          <div class="lesson-body"><div class="lesson-title">${esc(l.title)}</div>
          </div></div>`;
      }).join('') + `</div>`
     : `<div class="card">لسه مفيش دروس — أول درس هيتحط يوم الجمعة إن شاء الله.</div>`));
  // خزّني صور المعاينة للأوفلاين (السيرفس وركر بيكاش كل الصور من نفس المصدر تلقائيا)
  view.querySelectorAll('.lesson-card').forEach(c=>{
    c.onclick=()=>{
      const u=c.dataset.url;
      if(!u) return;
      if(!navigator.onLine){ toast('اللينك بيحتاج نت عشان يفتح'); return; }
      window.open(u,'_blank','noopener');
    };
  });
}

/* ---------- quran reading (full mushaf, offline, bookmark) ---------- */
function renderQuranRead(){
  const bm = store.get('bookmark', null);
  h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><h2 class="page-title">${ic('book')} ورد القراءة</h2>
     <div class="muted">المصحف كامل متاح أوفلاين. دوسي على أي آية عشان تعلمي مكان وقوفك.</div>` +
     (bm? `<div class="card resume-card" id="resume">آخر وقوف: <b>${esc(cleanName(surah(bm.s).name))}</b> — آية ${bm.a} (دوسي للمتابعة)</div>` : '') +
     `<input id="surah-search" class="search-box" placeholder="ابحثي عن سورة…">` +
     `<div id="surah-list">` +
     QURAN.map(s=>`<div class="list-item" data-s="${s.n}" data-name="${esc(cleanName(s.name))} ${esc(s.en)}">
       <div><div class="nm">${bm&&bm.s===s.n?'• ':''}${esc(cleanName(s.name))}</div><div class="meta">${s.a.length} آيات</div></div>
       <span class="off-badge">أوفلاين ✓</span></div>`).join('') + `</div>`);
  view.querySelectorAll('[data-s]').forEach(el=> el.onclick=()=> location.hash='#read/'+el.dataset.s);
  const rs = document.getElementById('resume');
  if(rs) rs.onclick = ()=> location.hash = '#read/'+bm.s;
  document.getElementById('surah-search').oninput = e=>{
    const q = e.target.value.trim();
    view.querySelectorAll('#surah-list .list-item').forEach(el=>{
      el.style.display = (!q || el.dataset.name.includes(q))? '' : 'none';
    });
  };
}
function renderSurah(n){
  const s = surah(n); if(!s){ location.hash='#quran-read'; return; }
  const bm = store.get('bookmark', null);
  const fontSize = store.get('reader-font', 21);
  const night = store.get('reader-night', false);
  h(`<a class="back" href="#quran-read">${ic('back',16)} السور</a><h2 class="page-title">${esc(cleanName(s.name))}</h2>
     <div class="audio-row">
       <button class="btn" id="font-minus">ع−</button>
       <button class="btn" id="font-plus">ع+</button>
       <button class="btn ${night?'teal':''}" id="night-toggle">وضع ليلي</button>
     </div>
     <div class="muted">${s.a.length} آيات — دوسي على آية لتحديد مكان الوقوف</div>
     <div class="card ${night?'night':''}"><div class="quran-text" style="font-size:${fontSize}px">` +
     (n!==1 && n!==9? `<div class="bism">${BISM_DISPLAY}</div>` : '') +
     s.a.map(a=>`<span class="ay ${bm&&bm.s===n&&bm.a===a[0]?'marked':''}" data-ay="${a[0]}">${esc(a[1])} <span class="ayah-num">﴿${a[0]}﴾</span></span>`).join(' ') +
     `</div></div>`);
  document.getElementById('font-minus').onclick = ()=>{ store.set('reader-font', Math.max(16, fontSize-2)); renderSurah(n); };
  document.getElementById('font-plus').onclick = ()=>{ store.set('reader-font', Math.min(36, fontSize+2)); renderSurah(n); };
  document.getElementById('night-toggle').onclick = ()=>{ store.set('reader-night', !night); renderSurah(n); };
  view.querySelectorAll('.ay').forEach(el=> el.onclick=()=>{
    const a = +el.dataset.ay;
    store.set('bookmark', {s:n, a});
    toast(`اتحفظ مكان وقوفك: ${cleanName(s.name)} آية ${a} ✓`);
    view.querySelectorAll('.ay.marked').forEach(x=>x.classList.remove('marked'));
    el.classList.add('marked');
  });
  if(bm && bm.s===n){
    const t = view.querySelector(`.ay[data-ay="${bm.a}"]`);
    if(t) setTimeout(()=> t.scrollIntoView({block:'center'}), 100);
  }
}

/* ---------- quran audio ---------- */
async function cachedSet(){
  try{ const c = await caches.open('zamzam-audio');
    const keys = await c.keys(); return new Set(keys.map(k=>k.url)); }catch(e){ return new Set(); }
}
async function renderQuranAudio(){
  const rid = currentReciter();
  h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><h2 class="page-title">${ic('headphones')} القرآن صوت</h2>
     <div class="sheikh-row" id="reciter-row">` +
     CONTENT.audio.reciters.map(r=>{
       const ph = r.photo ? `<img class="sheikh-photo" src="${esc(r.photo)}" alt="${esc(r.name)}" loading="lazy">`
                          : `<span class="sheikh-photo sheikh-ph">${esc((r.name||'؟').trim().charAt(0))}</span>`;
       return `<button class="sheikh ${r.id===rid?'on':''}" data-rec="${r.id}">${ph}<span class="sheikh-name">${esc(r.name)}</span></button>`;
     }).join('') +
     `</div>
     <div class="notice">${esc(CONTENT.audio.note)}<br>اضغطي ⬇ تحميل عشان السورة تشتغل أوفلاين. التشغيل بيكمل في الخلفية حتى لو قفلتي التطبيق، وبيقف لما توقفيه انتي بس.</div>
     <div id="surah-list" class="muted">بنجهز القايمة…</div>`);
  view.querySelectorAll('[data-rec]').forEach(b=> b.onclick=()=>{ store.set('reciter', b.dataset.rec); renderQuranAudio(); });
  const cached = await cachedSet();
  document.getElementById('surah-list').className='';
  document.getElementById('surah-list').innerHTML = QURAN.map(s=>{
    const url = audioUrl(rid, s.n); const off = cached.has(url);
    return `<div class="list-item" style="cursor:default">
      <div style="flex:1"><div class="nm">${esc(cleanName(s.name))}</div><div class="meta">${s.a.length} آيات</div></div>
      ${off? '<span class="off-badge">أوفلاين ✓</span>' : `<button class="btn" data-dl="${s.n}">⬇ تحميل</button>`}
      <button class="btn primary" data-play="${s.n}">▶</button>
    </div>`;
  }).join('');
  view.querySelectorAll('[data-play]').forEach(b=> b.onclick=()=> player.play(+b.dataset.play));
  view.querySelectorAll('[data-dl]').forEach(b=> b.onclick=async ()=>{
    const n=+b.dataset.dl; b.disabled=true; b.textContent='…';
    try{
      const res = await fetch(audioUrl(rid, n));
      if(!res.ok) throw new Error('http '+res.status);
      const c = await caches.open('zamzam-audio'); await c.put(audioUrl(rid, n), res);
      toast('اتحملت للأوفلاين ✓'); renderQuranAudio();
    }catch(e){ b.disabled=false; b.textContent='⬇ تحميل';
      toast(navigator.onLine? 'التحميل فشل، جربي تاني' : 'مفيش نت — التحميل محتاج اتصال'); }
  });
}

/* ---------- games ---------- */
function renderGames(){
  const p = getPoints();
  const next = BADGES.find(b=>p<b.pts);
  const prev = next? (BADGES[BADGES.indexOf(next)-1]||{pts:0}).pts : 0;
  const pct = next? Math.round((p-prev)/(next.pts-prev)*100) : 100;
  h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><h2 class="page-title">${ic('gamepad')} ألعاب وجوائز</h2>
     <div class="card" style="text-align:center">
       <div>${ic('star',34)}</div>
       <div class="score-line" style="font-size:22px">${p} نقطة</div>
       ${next? `<div class="muted">فاضل ${next.pts-p} نقطة على وسام ${next.name}</div>
       <div class="progress" style="margin:8px auto;max-width:280px"><i style="width:${pct}%"></i></div>`
       : '<div class="score-line">كسبتي كل الأوسمة! ✓</div>'}
     </div>
     <div class="badge-row">` +
     BADGES.map(b=>`<div class="ach ${p>=b.pts?'earned':''}">${b.name} — ${b.pts} ${p>=b.pts?'✓':''}</div>`).join('') +
     `</div>
     <div class="grid">
       <div class="tile game-tile" data-go="game-ayah"><span class="ico">✍️</span><span class="lbl">أكمل الآية</span><span class="sub">10 نقاط لكل إجابة</span></div>
       <div class="tile game-tile" data-go="game-quiz"><span class="ico">❓</span><span class="lbl">أسئلة دينية</span><span class="sub">10 نقاط لكل إجابة</span></div>
     </div>
     <div class="notice">الأسئلة موثقة بالمصدر ومراجعة شرعيا ✓ وهتتوسع من مصادرك.</div>`);
  view.querySelectorAll('[data-go]').forEach(el=> el.onclick=()=> location.hash='#'+el.dataset.go);
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function renderGameAyahCurated(){
  const q = CONTENT.verseComplete[Math.floor(Math.random()*CONTENT.verseComplete.length)];
  const opts = shuffle(q.opts.map((t,i)=>({t,i})));
  h(`<a class="back" href="#games">${ic('back',16)} الألعاب</a><h2 class="page-title">${ic('book')} أكمل الآية</h2>
     <div class="ayah-banner">${esc(q.surah)}</div>
     <div class="muted" style="text-align:center">إيه التكملة الصح للآية دي؟</div>
     <div class="card prompt-card"><div class="quran-text" style="text-align:center">${esc(q.prompt)}</div></div>
     <div id="opts"></div>
     <div id="fx" class="fx"></div>
     <div style="margin-top:10px;text-align:center"><button class="btn teal" id="next-q" style="display:none">سؤال تاني ◀</button></div>`);
  const box = document.getElementById('opts');
  box.innerHTML = opts.map((o,bi)=>`<button class="opt" data-b="${bi}">${esc(o.t)}</button>`).join('');
  box.querySelectorAll('.opt').forEach(btn=>{
    btn.onclick=()=>{
      const o = opts[+btn.dataset.b];
      box.querySelectorAll('.opt').forEach(b=>{ b.disabled=true;
        if(opts[+b.dataset.b].i===q.a) b.classList.add('correct'); });
      if(o.i===q.a){ addPoints(10,'إجابة صح'); document.getElementById('fx').textContent='أحسنتِ ✓'; }
      else { btn.classList.add('wrong'); toast('إجابة غلط — الصح مظللة بالأخضر'); }
      document.getElementById('next-q').style.display='inline-block';
    };
  });
  document.getElementById('next-q').onclick = renderGameAyahCurated;
}

function renderGameAyah(){
  // لو فيه أسئلة مُنُسَّقة في CONTENT.verseComplete استخدميها، غير كده ولّدي سؤال من جزء عمّ (نص Tanzil متحقق)
  if(CONTENT.verseComplete && CONTENT.verseComplete.length){ return renderGameAyahCurated(); }
  const pool = QURAN.filter(s=>s.n>=78 && s.a.length>=3);
  const s = pool[Math.floor(Math.random()*pool.length)];
  const i = Math.floor(Math.random()*(s.a.length-1));
  const prompt = s.a[i], correct = s.a[i+1];
  // wrong options always from OTHER surahs so they can't be plausible continuations
  const others = shuffle(QURAN.filter(x=>x.n>=78 && x.n!==s.n).flatMap(x=>x.a)).slice(0,2);
  const opts = shuffle([correct, ...others]);
  h(`<a class="back" href="#games">${ic('back',16)} الألعاب</a><h2 class="page-title">${ic('book')} أكمل الآية</h2>
     <div class="ayah-banner">${esc(cleanName(s.name))}</div>
     <div class="muted" style="text-align:center">إيه الآية اللي بتيجي بعد دي؟</div>
     <div class="card prompt-card"><div class="quran-text" style="text-align:center">${esc(prompt[1])} <span class="ayah-num">﴿${prompt[0]}﴾</span></div></div>
     <div id="opts"></div>
     <div id="fx" class="fx"></div>
     <div style="margin-top:10px;text-align:center"><button class="btn teal" id="next-q" style="display:none">سؤال تاني ◀</button></div>`);
  const box = document.getElementById('opts');
  box.innerHTML = opts.map((o,idx)=>`<button class="opt" data-idx="${idx}">${esc(o[1])}</button>`).join('');
  box.querySelectorAll('.opt').forEach(btn=>{
    btn.onclick=()=>{
      const chosen = opts[+btn.dataset.idx];
      box.querySelectorAll('.opt').forEach(b=>{
        b.disabled=true;
        const o = opts[+b.dataset.idx];
        if(o[1]===correct[1] && o[0]===correct[0]) b.classList.add('correct');
      });
      if(chosen[1]===correct[1] && chosen[0]===correct[0]){ addPoints(10,'إجابة صح'); document.getElementById('fx').textContent='أحسنتِ ✓'; }
      else { btn.classList.add('wrong'); toast('إجابة غلط — الصح مظللة بالأخضر'); }
      document.getElementById('next-q').style.display='inline-block';
    };
  });
  document.getElementById('next-q').onclick = renderGameAyah;
}

function renderGameQuiz(){
  const qs = shuffle(CONTENT.quiz.slice()).slice(0,10);
  let idx=0, score=0;
  function ask(){
    if(idx>=qs.length){
      h(`<a class="back" href="#games">${ic('back',16)} الألعاب</a><h2 class="page-title">${ic('scroll')} أسئلة دينية</h2>
         <div class="card" style="text-align:center"><div style="font-size:44px">${ic(score>=qs.length/2?'star':'beads',44)}</div>
         <h3>خلصت الجولة!</h3>
         <div class="score-line">نتيجتك: ${score} من ${qs.length}</div>
         <button class="btn teal" id="again">العبي تاني</button>
         <a class="btn" href="#games">رجوع للألعاب</a></div>`);
      document.getElementById('again').onclick = renderGameQuiz;
      return;
    }
    const q = qs[idx];
    h(`<a class="back" href="#games">${ic('back',16)} الألعاب</a><h2 class="page-title">${ic('scroll')} أسئلة دينية</h2>
       <div class="muted">سؤال ${idx+1} من ${qs.length}</div>
       <div class="card prompt-card" style="text-align:center"><div>${ic('gamepad',30)}</div><h3>${esc(q.q)}</h3><div id="opts"></div></div>`);
    const box = document.getElementById('opts');
    const order = shuffle(q.opts.map((t,i)=>({t,i})));
    box.innerHTML = order.map((o,bi)=>`<button class="opt" data-b="${bi}" style="text-align:center">${esc(o.t)}</button>`).join('');
    box.querySelectorAll('.opt').forEach(btn=>{
      btn.onclick=()=>{
        const o = order[+btn.dataset.b];
        box.querySelectorAll('.opt').forEach(b=>{ b.disabled=true;
          if(order[+b.dataset.b].i===q.a) b.classList.add('correct'); });
        if(o.i===q.a){ score++; addPoints(10,'إجابة صح'); }
        else btn.classList.add('wrong');
        setTimeout(()=>{ idx++; ask(); }, 1200);
      };
    });
  }
  ask();
}

/* ---------- settings ---------- */
function notifStatus(){
  if(!('Notification' in window)) return 'المتصفح ده مش بيدعم إشعارات';
  return Notification.permission === 'granted'? 'الإشعارات مفعّلة ✓' :
         Notification.permission === 'denied'? 'الإشعارات مرفوضة من إعدادات المتصفح' : 'الإشعارات لسه مش مفعّلة';
}
function renderSettingsCard(){
  return `<div class="card"><h3>التذكيرات والإشعارات</h3>
    <div class="muted" style="line-height:1.9">ورد النهارده وتذكير الجمعة بيظهروا لكي على الصفحة الرئيسية كل ما تفتحي التطبيق (شغالين أوفلاين ١٠٠٪).<br>
    الإشعارات على الموبايل: محتاجة التطبيق متثبت على الشاشة الرئيسية (Add to Home Screen) وiOS 16.4 أو أحدث للآيفون. حالة الإشعارات عندك: <b>${notifStatus()}</b></div>
    <div class="audio-row">
      <button class="btn teal" id="notif-enable">تفعيل الإشعارات</button>
      <button class="btn" id="notif-test">جرّبي إشعار</button>
    </div>
    <div class="muted" style="margin-top:10px">نص تذكير الجمعة (قابل للتعديل):</div>
    <textarea id="friday-text" class="search-box" rows="3">${esc(store.get('friday-text', FRIDAY_DEFAULT))}</textarea>
    <button class="btn" id="friday-save">حفظ النص</button>
    <div class="notice" style="margin-top:10px">إشعارات مجدولة بالساعة (توصلك حتى والتطبيق مقفول) محتاجة سيرفر Push — هتتضاف في النسخة الجاية. حاليا لو فتحتي التطبيق يوميا هتلاقي الورد والتذكير مستنيينك.</div>
  </div>`;
}

/* ---------- tasbih ---------- */
const TASBIH_LIST = ['سبحان الله','الحمد لله','الله أكبر','لا إله إلا الله','أستغفر الله','سبحان الله وبحمده'];
function renderTasbih(){
  const day = new Date().toISOString().slice(0,10);
  const cur = store.get('tasbih:current', {dhikr: TASBIH_LIST[0], count: 0, target: 33});
  const total = store.get('tasbih:total:'+day, 0);
  h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><h2 class="page-title">${ic('beads')} السبحة الإلكترونية</h2>
     <div class="muted">العدّاد بيتحفظ على جهازك حتى لو قفلتي التطبيق. مجموع النهارده: ${total}</div>
     <div class="badge-row" id="dhikr-row">` +
     TASBIH_LIST.map(t=>`<button class="btn ${t===cur.dhikr?'teal':''}" data-dhikr="${esc(t)}">${esc(t)}</button>`).join('') +
     `</div>
     <div class="card" style="text-align:center">
       <div class="dhikr-text" style="font-size:22px">${esc(cur.dhikr)}</div>
       <div class="muted">الهدف: <button class="btn" data-t="33">33</button><button class="btn" data-t="100">100</button><button class="btn" data-t="1000">1000</button> — الهدف الحالي: ${cur.target}</div>
       <button id="tasbih-btn" class="tasbih-btn">${cur.count}</button>
       <div class="progress" style="margin:10px auto;max-width:280px"><i style="width:${Math.min(100,cur.count/cur.target*100)}%"></i></div>
       <div class="audio-row" style="justify-content:center">
         <button class="btn" id="tasbih-reset">تصفير</button>
       </div>
     </div>`);
  view.querySelectorAll('[data-dhikr]').forEach(b=> b.onclick=()=>{ cur.dhikr=b.dataset.dhikr; cur.count=0; store.set('tasbih:current',cur); renderTasbih(); });
  view.querySelectorAll('[data-t]').forEach(b=> b.onclick=()=>{ cur.target=+b.dataset.t; store.set('tasbih:current',cur); renderTasbih(); });
  document.getElementById('tasbih-btn').onclick = ()=>{
    cur.count++; store.set('tasbih:current', cur);
    store.set('tasbih:total:'+day, store.get('tasbih:total:'+day,0)+1);
    if(cur.count===cur.target){ addPoints(5,'إتمام '+cur.target+' '+cur.dhikr); if(navigator.vibrate) navigator.vibrate(80); }
    else if(navigator.vibrate) navigator.vibrate(15);
    renderTasbih();
  };
  document.getElementById('tasbih-reset').onclick = ()=>{ cur.count=0; store.set('tasbih:current',cur); renderTasbih(); };
}

/* ---------- about ---------- */
function renderAbout(){
  h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><h2 class="page-title">${ic('info')} حول زمزم</h2>
     <div class="card"><h3>التطبيق</h3><div class="muted" style="line-height:1.9">
     زمزم تطبيق مجاني بالكامل: أذكار، مصحف كامل قراءة، قرآن صوت بأكتر من قارئ، أدعية، قصص، وألعاب بجوائز.
     بيتثبت على الموبايل زي أي تطبيق (من قائمة المتصفح: Add to Home Screen) وبيشتغل أوفلاين.</div></div>
     <div class="card"><h3>المصادر والحالة</h3>` +
     CONTENT.sources.map(s=>`<div style="margin:8px 0"><b>${esc(cleanName(s.name))}</b><br>
       <span class="muted">${esc(s.ref)}</span><br><span class="fadl">${esc(s.status)}</span></div>`).join('') +
     `</div>
     <div class="card"><h3>تحميل التطبيق</h3><div class="muted" style="line-height:1.9">
     من كروم على أندرويد: قائمة ⋮ ثم "تثبيت التطبيق" أو "Add to Home screen".<br>
     من سفاري على آيفون: زرار المشاركة ثم "Add to Home Screen".</div></div>` +
     renderSettingsCard() +
     `<div class="credit">تطبيق زمزم من تصميم وتنفيذ مريم عبدالرحمن، نسأل الله أن ينفع به</div>`);
  const nb = document.getElementById('notif-enable');
  if(nb) nb.onclick = async ()=>{
    if(!('Notification' in window)){ toast('المتصفح مش بيدعم إشعارات'); return; }
    const p = await Notification.requestPermission();
    toast(p==='granted'? 'الإشعارات اتفعلت ✓' : 'الإذن ماتاخدش — فعّليها من إعدادات المتصفح');
    renderAbout();
  };
  const nt = document.getElementById('notif-test');
  if(nt) nt.onclick = ()=>{
    if(!('Notification' in window) || Notification.permission!=='granted'){ toast('فعّلي الإشعارات الأول'); return; }
    try{ new Notification('زمزم', {body: dailyWird().text, icon:'icon-192.png'}); }catch(e){ toast('حصل خطأ في الإشعار'); }
  };
  const fs = document.getElementById('friday-save');
  if(fs) fs.onclick = ()=>{ store.set('friday-text', document.getElementById('friday-text').value.trim() || FRIDAY_DEFAULT); toast('اتحفظ نص تذكير الجمعة ✓'); };
}

/* ---------- router ---------- */
const NAVMAP = {'adhkar-sabah':'adhkar','adhkar-masaa':'adhkar','quran-read':'quran','read':'quran','quran-audio':'quran','games':'games','about':'about','home':'home'};
function route(){
  const hash = (location.hash||'#home').slice(1);
  const [r, arg] = hash.split('/');
  switch(r){
    case 'home': renderHome(); break;
    case 'adhkar-sabah': renderAdhkar('sabah'); break;
    case 'adhkar-masaa': renderAdhkar('masaa'); break;
    case 'duas': renderDuas(); break;
    case 'lessons': renderLessons(); break;
    case 'seerah': renderStories('seerah','السيرة النبوية','kaaba'); break;
    case 'prophets': renderStories('prophets','قصص الأنبياء','scroll'); break;
    case 'sahaba': renderStories('sahaba','قصص الصحابة','star'); break;
    case 'quran-read': renderQuranRead(); break;
    case 'read': renderSurah(+arg); break;
    case 'quran-audio': renderQuranAudio(); break;
    case 'games': renderGames(); break;
    case 'game-ayah': renderGameAyah(); break;
    case 'game-quiz': renderGameQuiz(); break;
    case 'wird': renderWird(); break;
    case 'about': renderAbout(); break;
    case 'stats': case 'settings': case 'ayah': case 'reminder':
      if(window.ZAMZAM_EXTRA && window.ZAMZAM_EXTRA[r]) window.ZAMZAM_EXTRA[r]();
      else h(`<a class="back" href="#home">${ic('back',16)} الرئيسية</a><div class="notice" style="margin-top:14px">الصفحة دي جاية في التحديث الجاي إن شاء الله.</div>`);
      break;
    case 'tasbih': renderTasbih(); break;
    default: renderHome();
  }
}

/* ---------- first-run setup (downloads everything for offline) ---------- */
async function firstRun(){
  const steps = ['تجهيز واجهة التطبيق','تحميل المصحف كامل','تحميل الأذكار والأدعية','تجهيز الألعاب'];
  h(`<div style="text-align:center;padding:40px 10px">
      <div class="splash-arch"><svg viewBox="0 0 160 190" width="150" height="178" fill="none">
      <path d="M80 6C38 40 18 74 18 116v66h124v-66c0-42-20-76-62-110z" stroke="rgba(212,212,212,.55)" stroke-width="2"/>
      <path d="M80 20c-34 30-50 58-50 94v54h100v-54c0-36-16-64-50-94z" stroke="rgba(212,212,212,.22)" stroke-width="1.4"/>
      <path d="M92 62a26 26 0 1 0 17 45 30 30 0 0 1-17-45z" fill="#f2f2f2"/>
      <circle cx="52" cy="60" r="1.8" fill="#f2f2f2" opacity=".8"/><circle cx="118" cy="44" r="1.4" fill="#f2f2f2" opacity=".6"/>
      <circle cx="108" cy="88" r="1.2" fill="#f2f2f2" opacity=".5"/><circle cx="44" cy="98" r="1.3" fill="#f2f2f2" opacity=".55"/>
    </svg></div>
      <h2 class="splash-title">زمزم</h2><div class="muted" style="margin-bottom:8px">أذكار .. قرآن .. وورد يومي</div>
      <div class="muted">أول مرة بنحمل فيها كل المحتوى عشان التطبيق يشتغل أوفلاين بالكامل بعدها.</div>
      <div class="progress" style="margin:18px auto;max-width:300px"><i id="setup-bar" style="width:0%"></i></div>
      <div id="setup-step" class="muted"></div>
      <button class="btn teal" id="start-app" style="display:none;margin-top:16px">ابدأي رحلتك</button>
      <div class="notice" style="text-align:right;margin-top:18px">ملحوظة: صوت القرآن حجمه كبير، فكل سورة بتحمليها لوحدها بزرار ⬇ لما تحبي.</div>
    </div>`);
  const bar = document.getElementById('setup-bar'), step = document.getElementById('setup-step');
  for(let i=0;i<steps.length;i++){
    step.textContent = steps[i]+'…';
    if(i===1){ try{ const c = await caches.open('zamzam-shell-v1');
      const r = await fetch('quran-full.json'); await c.put('quran-full.json', r.clone()); }catch(e){} }
    if(i===0 && 'serviceWorker' in navigator){ try{ await navigator.serviceWorker.ready; }catch(e){}
      if(navigator.storage && navigator.storage.persist){ navigator.storage.persist().catch(()=>{}); } }
    bar.style.width = Math.round((i+1)/steps.length*100)+'%';
    await new Promise(r=>setTimeout(r,250));
  }
  step.textContent = 'تمام! كل حاجة جاهزة أوفلاين ✓';
  const btn = document.getElementById('start-app');
  btn.style.display='inline-block';
  btn.onclick = ()=>{ store.set('setup-v1', true); route(); };
}

/* ---------- public API for extra modules (Drop C screens live in extra.js) ---------- */
window.ZamzamAPI = {h, esc, store, toast, ic, ICONS, todayProgress, dailyWird, getPoints, addPoints, CONTENT,
  QURAN: ()=>QURAN, FRIDAY_DEFAULT};

/* ---------- boot ---------- */
fetch('quran-full.json').then(r=>r.json()).then(q=>{
  QURAN = q;
  renderPoints(); renderNet(); player.init();
  if(!store.get('setup-v1', false) && (!location.hash || location.hash==='#home')) firstRun();
  else route();
}).catch(()=>{ view.innerHTML='<div class="notice">حصلت مشكلة في تحميل البيانات. افتحي التطبيق تاني.</div>'; });
window.addEventListener('hashchange', route);

/* ---------- auto-update: users get new content/features without reinstalling ----------
   Publish flow: any change to content.js/quran-full.json reaches users on their next
   online visit (network-first). Any code change ships by bumping files + the VERSION
   constant in sw.js; the app detects the new service worker and reloads itself. */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(reg=>{
    reg.update().catch(()=>{});
    setInterval(()=> reg.update().catch(()=>{}), 30*60*1000);
  }).catch(()=>{});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(reloaded) return; reloaded = true;
    location.reload();
  });
}
})();
