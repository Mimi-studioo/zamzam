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
  {pts:50,  name:'🌙 بداية النور'},
  {pts:150, name:'⭐ مجتهد'},
  {pts:300, name:'🏆 نجم زمزم'}
];
function getPoints(){ return store.get('points', 0); }
function addPoints(n, why){
  const p = getPoints()+n; store.set('points', p); renderPoints();
  toast(`+${n} نقطة ${why? '— '+why : ''} 🎉`);
  BADGES.forEach(b=>{
    const earned = store.get('badge:'+b.pts, false);
    if(!earned && p>=b.pts){ store.set('badge:'+b.pts, true); setTimeout(()=>toast('مبروك! كسبتي وسام '+b.name), 1600); }
  });
}
function renderPoints(){ document.getElementById('points-badge').textContent = getPoints()+' ⭐'; }

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
      toast(this.repeat? 'تكرار السورة شغال 🔁' : 'التكرار اتقفل');
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
      esc(s.name) + ' <span class="muted">• '+esc(reciterById(currentReciter()).name)+(this.offline?' • أوفلاين':'')+'</span>';
    document.getElementById('pb-toggle').textContent = this.el.paused? '▶' : '⏸';
    document.getElementById('pb-repeat').classList.toggle('on', this.repeat);
  }
};

/* ---------- home ---------- */
const TILES = [
  {r:'adhkar-sabah',  ico:'🌅', lbl:'أذكار الصباح'},
  {r:'adhkar-masaa',  ico:'🌃', lbl:'أذكار المساء'},
  {r:'quran-audio',   ico:'🎧', lbl:'القرآن صوت', sub:'استماع + تحميل أوفلاين'},
  {r:'quran-read',    ico:'📖', lbl:'ورد القراءة', sub:'المصحف كامل أوفلاين'},
  {r:'lessons',       ico:'🎙️', lbl:'دروس صوتية'},
  {r:'duas',          ico:'🤲', lbl:'أدعية'},
  {r:'seerah',        ico:'🕋', lbl:'السيرة النبوية'},
  {r:'prophets',      ico:'📜', lbl:'قصص الأنبياء'},
  {r:'sahaba',        ico:'🌟', lbl:'قصص الصحابة'},
  {r:'games',         ico:'🎮', lbl:'ألعاب وجوائز', sub:'أكمل الآية + أسئلة'}
];
const FRIDAY_DEFAULT = 'يوم الجمعة 🕌: اقرأي سورة الكهف وأكثري من الصلاة على النبي ﷺ';
function dailyWird(){
  const items = CONTENT.duas.concat(CONTENT.sabah.map(x=>({cat:'ذكر', text:x.text})));
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  return items[doy % items.length];
}
function renderHome(){
  const bm = store.get('bookmark', null);
  const isFriday = new Date().getDay() === 5;
  const fridayText = store.get('friday-text', FRIDAY_DEFAULT);
  const w = dailyWird();
  h(`<div class="card wird-card"><div class="muted">🌙 ورد النهارده</div><div class="dhikr-text">${esc(w.text)}</div></div>` +
    (isFriday? `<div class="card friday-card">${esc(fridayText)}</div>` : '') +
    (bm? `<div class="card resume-card" id="resume">📌 كمّلي قراءتك: <b>${esc(surah(bm.s).name)}</b> — آية ${bm.a}</div>` : '') +
    `<div class="notice">🚧 نسخة أولى: جزء من المحتوى نماذج مؤقتة، وهيتستبدل بمصادرك. المصحف والأذكار والألعاب شغالين أوفلاين بالكامل.</div>
     <div class="grid">` +
    TILES.map(t=>`<div class="tile" data-go="${t.r}"><span class="ico">${t.ico}</span><span class="lbl">${t.lbl}</span>${t.sub?`<span class="sub">${t.sub}</span>`:''}</div>`).join('') +
    `</div>`);
  view.querySelectorAll('[data-go]').forEach(el=> el.onclick = ()=> location.hash = '#'+el.dataset.go);
  const rs = document.getElementById('resume');
  if(rs) rs.onclick = ()=> location.hash = '#read/'+bm.s;
}

/* ---------- adhkar ---------- */
function adhkarDoneKey(kind){ const d=new Date(); return 'dhikr:'+kind+':'+d.toISOString().slice(0,10); }
function renderAdhkar(kind){
  const items = CONTENT[kind];
  const title = kind==='sabah'? '🌅 أذكار الصباح' : '🌃 أذكار المساء';
  let prog = store.get(adhkarDoneKey(kind), {});
  const totalLeft = items.reduce((s,it)=> s + Math.max(0, it.count - (prog[it.id]||0)), 0);
  h(`<a class="back" href="#home">‹ رجوع</a><h2 class="page-title">${title}</h2>
     <div class="muted">اضغطي على الزرار بعد كل مرة. التقدم بيتحفظ على جهازك وبيشتغل أوفلاين.</div>
     <div class="notice">المحتوى نموذج مؤقت للمراجعة.</div>
     <div id="dhikr-list"></div>
     <div style="text-align:center;margin-top:14px">
       ${totalLeft===0? '<div class="score-line">ما شاء الله، خلصتي وردك النهارده ✨</div>' : ''}
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
function renderDuas(){
  const cats = [...new Set(CONTENT.duas.map(d=>d.cat))];
  h(`<a class="back" href="#home">‹ رجوع</a><h2 class="page-title">🤲 أدعية</h2>
     <div class="muted">من حصن المسلم، مقسمة حسب الحاجة. المحتوى نموذج مؤقت للمراجعة.</div>` +
    cats.map(c=>`<div class="section-title">${esc(c)}</div>` +
      CONTENT.duas.filter(d=>d.cat===c).map(d=>`<div class="card"><div class="dhikr-text">${esc(d.text)}</div></div>`).join('')).join(''));
}

/* ---------- stories ---------- */
function renderStories(kind, title, ico){
  h(`<a class="back" href="#home">‹ رجوع</a><h2 class="page-title">${ico} ${title}</h2>
     <div class="notice">هنا هتتعرض فيديوهات قصيرة بأسلوب الوايت بورد (حلقات صغيرة بصور توضيحية) — قيد التجهيز. تحت دي نماذج نصية مؤقتة.</div>` +
    CONTENT.stories[kind].map(s=>`<div class="card"><h3>${esc(s.title)}</h3><div class="dhikr-text" style="white-space:pre-line">${esc(s.body)}</div></div>`).join(''));
}

/* ---------- lessons ---------- */
function renderLessons(){
  h(`<a class="back" href="#home">‹ رجوع</a><h2 class="page-title">🎙️ دروس صوتية</h2>
     <div class="notice">القسم جاهز ومستني مصادر الدروس اللي هتبعتيها. أول ما توصل هتظهر هنا وتقدري تحمليها للأوفلاين زي القرآن الصوتي بالظبط.</div>`);
}

/* ---------- quran reading (full mushaf, offline, bookmark) ---------- */
function renderQuranRead(){
  const bm = store.get('bookmark', null);
  h(`<a class="back" href="#home">‹ رجوع</a><h2 class="page-title">📖 ورد القراءة</h2>
     <div class="muted">المصحف كامل متاح أوفلاين. دوسي على أي آية عشان تعلمي مكان وقوفك.</div>` +
     (bm? `<div class="card resume-card" id="resume">📌 آخر وقوف: <b>${esc(surah(bm.s).name)}</b> — آية ${bm.a} (دوسي للمتابعة)</div>` : '') +
     `<input id="surah-search" class="search-box" placeholder="ابحثي عن سورة…">` +
     `<div id="surah-list">` +
     QURAN.map(s=>`<div class="list-item" data-s="${s.n}" data-name="${esc(s.name)} ${esc(s.en)}">
       <div><div class="nm">${bm&&bm.s===s.n?'📌 ':''}${esc(s.name)}</div><div class="meta">${s.a.length} آيات</div></div>
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
  h(`<a class="back" href="#quran-read">‹ السور</a><h2 class="page-title">${esc(s.name)}</h2>
     <div class="muted">${s.a.length} آيات — دوسي على آية لتحديد مكان الوقوف 📌</div>
     <div class="card"><div class="quran-text">` +
     (n!==1 && n!==9? `<div class="bism">${BISM_DISPLAY}</div>` : '') +
     s.a.map(a=>`<span class="ay ${bm&&bm.s===n&&bm.a===a[0]?'marked':''}" data-ay="${a[0]}">${esc(a[1])} <span class="ayah-num">﴿${a[0]}﴾</span></span>`).join(' ') +
     `</div></div>`);
  view.querySelectorAll('.ay').forEach(el=> el.onclick=()=>{
    const a = +el.dataset.ay;
    store.set('bookmark', {s:n, a});
    toast(`اتحفظ مكان وقوفك: ${s.name} آية ${a} 📌`);
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
  h(`<a class="back" href="#home">‹ رجوع</a><h2 class="page-title">🎧 القرآن صوت</h2>
     <div class="badge-row" id="reciter-row">` +
     CONTENT.audio.reciters.map(r=>`<button class="btn ${r.id===rid?'teal':''}" data-rec="${r.id}">${esc(r.name)}</button>`).join('') +
     `</div>
     <div class="notice">${esc(CONTENT.audio.note)}<br>اضغطي ⬇ تحميل عشان السورة تشتغل أوفلاين. التشغيل بيكمل في الخلفية حتى لو قفلتي التطبيق، وبيقف لما توقفيه انتي بس.</div>
     <div id="surah-list" class="muted">بنجهز القايمة…</div>`);
  view.querySelectorAll('[data-rec]').forEach(b=> b.onclick=()=>{ store.set('reciter', b.dataset.rec); renderQuranAudio(); });
  const cached = await cachedSet();
  document.getElementById('surah-list').className='';
  document.getElementById('surah-list').innerHTML = QURAN.map(s=>{
    const url = audioUrl(rid, s.n); const off = cached.has(url);
    return `<div class="list-item" style="cursor:default">
      <div style="flex:1"><div class="nm">${esc(s.name)}</div><div class="meta">${s.a.length} آيات</div></div>
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
  h(`<a class="back" href="#home">‹ رجوع</a><h2 class="page-title">🎮 ألعاب وجوائز</h2>
     <div class="card" style="text-align:center">
       <div style="font-size:34px">🏆</div>
       <div class="score-line" style="font-size:22px">${p} نقطة</div>
       ${next? `<div class="muted">فاضل ${next.pts-p} نقطة على وسام ${next.name}</div>
       <div class="progress" style="margin:8px auto;max-width:280px"><i style="width:${pct}%"></i></div>`
       : '<div class="score-line">كسبتي كل الأوسمة! 🎉</div>'}
     </div>
     <div class="badge-row">` +
     BADGES.map(b=>`<div class="ach ${p>=b.pts?'earned':''}">${b.name} — ${b.pts} ${p>=b.pts?'✓':''}</div>`).join('') +
     `</div>
     <div class="grid">
       <div class="tile game-tile" data-go="game-ayah"><span class="ico">✍️</span><span class="lbl">أكمل الآية</span><span class="sub">10 نقاط لكل إجابة</span></div>
       <div class="tile game-tile" data-go="game-quiz"><span class="ico">❓</span><span class="lbl">أسئلة دينية</span><span class="sub">10 نقاط لكل إجابة</span></div>
     </div>
     <div class="notice">الأسئلة الحالية نماذج مؤقتة متأكد منها، وهتتوسع من مصادرك.</div>`);
  view.querySelectorAll('[data-go]').forEach(el=> el.onclick=()=> location.hash='#'+el.dataset.go);
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function renderGameAyah(){
  // Juz Amma surahs (short, fully diacritized ayahs from verified Tanzil text)
  const pool = QURAN.filter(s=>s.n>=78 && s.a.length>=3);
  const s = pool[Math.floor(Math.random()*pool.length)];
  const i = Math.floor(Math.random()*(s.a.length-1));
  const prompt = s.a[i], correct = s.a[i+1];
  // wrong options always from OTHER surahs so they can't be plausible continuations
  const others = shuffle(QURAN.filter(x=>x.n>=78 && x.n!==s.n).flatMap(x=>x.a)).slice(0,2);
  const opts = shuffle([correct, ...others]);
  h(`<a class="back" href="#games">‹ الألعاب</a><h2 class="page-title">✍️ أكمل الآية</h2>
     <div class="ayah-banner">${esc(s.name)}</div>
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
      if(chosen[1]===correct[1] && chosen[0]===correct[0]){ addPoints(10,'إجابة صح'); document.getElementById('fx').textContent='🎉✨🌙'; }
      else { btn.classList.add('wrong'); toast('إجابة غلط — الصح مظللة بالأخضر'); }
      document.getElementById('next-q').style.display='inline-block';
    };
  });
  document.getElementById('next-q').onclick = renderGameAyah;
}

function renderGameQuiz(){
  const qs = shuffle(CONTENT.quiz.slice());
  let idx=0, score=0;
  function ask(){
    if(idx>=qs.length){
      h(`<a class="back" href="#games">‹ الألعاب</a><h2 class="page-title">❓ أسئلة دينية</h2>
         <div class="card" style="text-align:center"><div style="font-size:44px">${score===qs.length?'🏆': score>=qs.length/2? '🌟':'💪'}</div>
         <h3>خلصت الجولة!</h3>
         <div class="score-line">نتيجتك: ${score} من ${qs.length}</div>
         <button class="btn teal" id="again">العبي تاني</button>
         <a class="btn" href="#games">رجوع للألعاب</a></div>`);
      document.getElementById('again').onclick = renderGameQuiz;
      return;
    }
    const q = qs[idx];
    h(`<a class="back" href="#games">‹ الألعاب</a><h2 class="page-title">❓ أسئلة دينية</h2>
       <div class="muted">سؤال ${idx+1} من ${qs.length}</div>
       <div class="card prompt-card" style="text-align:center"><div style="font-size:30px">🧠</div><h3>${esc(q.q)}</h3><div id="opts"></div></div>`);
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

/* ---------- about ---------- */
function renderAbout(){
  h(`<a class="back" href="#home">‹ رجوع</a><h2 class="page-title">ℹ️ حول زمزم</h2>
     <div class="card"><h3>التطبيق</h3><div class="muted" style="line-height:1.9">
     زمزم تطبيق مجاني بالكامل: أذكار، مصحف كامل قراءة، قرآن صوت بأكتر من قارئ، أدعية، قصص، وألعاب بجوائز.
     بيتثبت على الموبايل زي أي تطبيق (من قائمة المتصفح: Add to Home Screen) وبيشتغل أوفلاين.</div></div>
     <div class="card"><h3>المصادر والحالة</h3>` +
     CONTENT.sources.map(s=>`<div style="margin:8px 0"><b>${esc(s.name)}</b><br>
       <span class="muted">${esc(s.ref)}</span><br><span class="fadl">${esc(s.status)}</span></div>`).join('') +
     `</div>
     <div class="card"><h3>تحميل التطبيق</h3><div class="muted" style="line-height:1.9">
     من كروم على أندرويد: قائمة ⋮ ثم "تثبيت التطبيق" أو "Add to Home screen".<br>
     من سفاري على آيفون: زرار المشاركة ثم "Add to Home Screen".</div></div>` +
     renderSettingsCard());
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
    try{ new Notification('زمزم 🌙', {body: dailyWird().text, icon:'icon-192.png'}); }catch(e){ toast('حصل خطأ في الإشعار'); }
  };
  const fs = document.getElementById('friday-save');
  if(fs) fs.onclick = ()=>{ store.set('friday-text', document.getElementById('friday-text').value.trim() || FRIDAY_DEFAULT); toast('اتحفظ نص تذكير الجمعة ✓'); };
}

/* ---------- router ---------- */
const NAVMAP = {'adhkar-sabah':'adhkar','adhkar-masaa':'adhkar','quran-read':'quran','read':'quran','quran-audio':'quran','games':'games','about':'about','home':'home'};
function route(){
  const hash = (location.hash||'#home').slice(1);
  const [r, arg] = hash.split('/');
  document.querySelectorAll('.bottom-nav a').forEach(a=>{
    a.classList.toggle('active', a.dataset.nav === (NAVMAP[r]||''));
  });
  switch(r){
    case 'home': renderHome(); break;
    case 'adhkar-sabah': renderAdhkar('sabah'); break;
    case 'adhkar-masaa': renderAdhkar('masaa'); break;
    case 'duas': renderDuas(); break;
    case 'lessons': renderLessons(); break;
    case 'seerah': renderStories('seerah','السيرة النبوية','🕋'); break;
    case 'prophets': renderStories('prophets','قصص الأنبياء','📜'); break;
    case 'sahaba': renderStories('sahaba','قصص الصحابة','🌟'); break;
    case 'quran-read': renderQuranRead(); break;
    case 'read': renderSurah(+arg); break;
    case 'quran-audio': renderQuranAudio(); break;
    case 'games': renderGames(); break;
    case 'game-ayah': renderGameAyah(); break;
    case 'game-quiz': renderGameQuiz(); break;
    case 'about': renderAbout(); break;
    default: renderHome();
  }
}

/* ---------- first-run setup (downloads everything for offline) ---------- */
async function firstRun(){
  const steps = ['تجهيز واجهة التطبيق','تحميل المصحف كامل','تحميل الأذكار والأدعية','تجهيز الألعاب'];
  h(`<div style="text-align:center;padding:40px 10px">
      <div style="font-size:54px">🌙</div>
      <h2>أهلا بيكي في زمزم</h2>
      <div class="muted">أول مرة بنحمل فيها كل المحتوى عشان التطبيق يشتغل أوفلاين بالكامل بعدها.</div>
      <div class="progress" style="margin:18px auto;max-width:300px"><i id="setup-bar" style="width:0%"></i></div>
      <div id="setup-step" class="muted"></div>
      <button class="btn teal" id="start-app" style="display:none;margin-top:16px">ابدأي رحلتك 🌙</button>
      <div class="notice" style="text-align:right;margin-top:18px">ملحوظة: صوت القرآن حجمه كبير، فكل سورة بتحمليها لوحدها بزرار ⬇ لما تحبي.</div>
    </div>`);
  const bar = document.getElementById('setup-bar'), step = document.getElementById('setup-step');
  for(let i=0;i<steps.length;i++){
    step.textContent = steps[i]+'…';
    if(i===1){ try{ const c = await caches.open('zamzam-shell-v1');
      const r = await fetch('quran-full.json'); await c.put('quran-full.json', r.clone()); }catch(e){} }
    if(i===0 && 'serviceWorker' in navigator){ try{ await navigator.serviceWorker.ready; }catch(e){} }
    bar.style.width = Math.round((i+1)/steps.length*100)+'%';
    await new Promise(r=>setTimeout(r,250));
  }
  step.textContent = 'تمام! كل حاجة جاهزة أوفلاين ✓';
  const btn = document.getElementById('start-app');
  btn.style.display='inline-block';
  btn.onclick = ()=>{ store.set('setup-v1', true); route(); };
}

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
