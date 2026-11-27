/* ============================================================
   زمزم — شاشة المصحف كاملًا داخل قسم «آية وتدبر»
   Self-contained module; لا يحتاج أي تعديل في app.js / index.html.

   Integration (3 lines):
     init function : ZamzamMushaf.init(containerElement)
     container id  : mushaf-root   →  <div id="mushaf-root"></div>
     deep open     : ZamzamMushaf.open(surahNumber, ayahNumber?)

   Data shapes (verified against repo files):
     quran-full.json    [{n, name, en, a:[[numberInSurah, text], ...]}]   (114 surahs, 6236 ayahs)
     tafsir-1-14.json / tafsir-15-39.json / tafsir-40-94.json / tafsir-95-114.json
                        flat map { "surah:ayah": "التفسير الميسر ..." } — lazy-loaded per chunk
   ============================================================ */
(function () {
  'use strict';

  var BISM = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
  var TAFSIR_CHUNKS = [[1, 14], [15, 39], [40, 94], [95, 114]];
  var SEARCH_DEBOUNCE = 160;
  var MAX_AYAH_RESULTS = 25;

  var quranP = null;      // Promise<[{n,name,en,a}]>
  var tafsirData = {};    // chunkIdx -> {"s:a": "text"}
  var tafsirP = {};       // chunkIdx -> Promise
  var flatCache = null;   // [[surahNum, ayahNum, text], ...] (6236 rows)
  var normCache = null;   // same rows with normalized text, built on first search

  var DATA = null;        // loaded mushaf
  var root = null;
  var lastQuery = '';

  /* ---------- helpers (mirror app.js conventions) ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  // app.js cleanName(): Quranic marks show as tofu in Zain font, so names are
  // stripped of marks and rendered with the 'Amiri Quran' font instead.
  function cleanName(nm) { return String(nm || '').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, ''); }
  // search normalization: strips marks + unifies alef/hamza/ya/taa-marbuta forms
  function norm(s) {
    return cleanName(s)
      .replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .toLowerCase();
  }

  var ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.6-4.6"/>',
    back: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    book: '<path d="M12 6.5C10 5 7.4 4.5 4 4.5v15c3.4 0 6 .5 8 2 2-1.5 4.6-2 8-2v-15c-3.4 0-6 .5-8 2z"/><path d="M12 6.5v15"/>',
    moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    chevron: '<path d="M14.5 6l-6 6 6 6"/>'
  };
  function ic(name, size) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="flex:none" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  /* ---------- data loading ---------- */
  function loadQuran() {
    if (quranP) return quranP;
    // Reuse the copy app.js already fetched when available (offline-friendly, zero refetch)
    try {
      var api = window.ZamzamAPI;
      if (api && typeof api.QURAN === 'function') {
        var q = api.QURAN();
        if (q && q.length === 114) return quranP = Promise.resolve(q);
      }
    } catch (e) {}
    try {
      /* global QURAN */
      if (typeof QURAN !== 'undefined' && QURAN && QURAN.length === 114) return quranP = Promise.resolve(QURAN);
    } catch (e) {}
    quranP = fetch('quran-full.json').then(function (r) {
      if (!r.ok) throw new Error('quran-full');
      return r.json();
    });
    return quranP;
  }

  function chunkIndexFor(n) {
    for (var i = 0; i < TAFSIR_CHUNKS.length; i++) {
      if (n >= TAFSIR_CHUNKS[i][0] && n <= TAFSIR_CHUNKS[i][1]) return i;
    }
    return -1;
  }

  // Lazy-loads only the chunk file covering this surah, then caches it in memory.
  function loadTafsir(surahNum) {
    var ci = chunkIndexFor(surahNum);
    if (ci < 0) return Promise.resolve({});
    if (tafsirData[ci]) return Promise.resolve(tafsirData[ci]);
    if (!tafsirP[ci]) {
      var c = TAFSIR_CHUNKS[ci];
      tafsirP[ci] = fetch('tafsir-' + c[0] + '-' + c[1] + '.json')
        .then(function (r) { if (!r.ok) throw new Error('tafsir'); return r.json(); })
        .then(function (d) { tafsirData[ci] = d; return d; })
        .catch(function (e) { tafsirP[ci] = null; throw e; });
    }
    return tafsirP[ci];
  }

  function flatAyahs() {
    if (!flatCache) {
      flatCache = [];
      DATA.forEach(function (s) {
        s.a.forEach(function (a) { flatCache.push([s.n, a[0], a[1]]); });
      });
    }
    return flatCache;
  }

  function findSurah(n) {
    for (var i = 0; i < DATA.length; i++) if (DATA[i].n === n) return DATA[i];
    return null;
  }

  /* ---------- آية اليوم (deterministic by date) ---------- */
  function ayahOfDay() {
    var flat = flatAyahs();
    var now = new Date();
    // local days since epoch (flips at the user's local midnight) → fixed ayah per date
    var dayIndex = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
    return flat[dayIndex % flat.length];
  }

  function aodCardHtml() {
    var item = ayahOfDay();
    var s = findSurah(item[0]);
    var dateStr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
    return '' +
      '<div class="zmf-aod">' +
        '<div class="zmf-aod-head">' + ic('moon', 18) + ' آية اليوم' +
          '<span class="zmf-aod-date">' + esc(dateStr) + '</span>' +
        '</div>' +
        '<div class="zmf-aod-text">' + esc(item[2]) + ' <span class="zmf-num">﴿' + item[1] + '﴾</span></div>' +
        '<div class="zmf-aod-ref">' + esc(cleanName(s.name)) + ' — الآية ' + item[1] + '</div>' +
        '<div class="zmf-aod-tafsir-wrap">' + tafsirBlockHtml(item[0], item[1], true) + '</div>' +
        '<div class="zmf-aod-btn"><button type="button" class="btn primary" data-ms="' + item[0] + '" data-ma="' + item[1] + '">' +
          ic('book', 16) + ' افتحي السورة</button></div>' +
      '</div>';
  }

  function tafsirBlockHtml(surahNum, ayahNum, pending) {
    return '<div class="zmf-tafsir' + (pending ? ' pending' : '') + '" data-k="' + surahNum + ':' + ayahNum + '">' +
      '<span class="zmf-tafsir-label">' + ic('book', 13) + ' التفسير الميسر' +
        '<span class="zmf-more">دوسي للمزيد</span></span>' +
      '<p>يُحمَّل التفسير…</p></div>';
  }

  // Fills pending tafsir blocks in `scopeEl` from the (lazy-loaded) chunk covering surahNum.
  function fillTafsir(scopeEl, surahNum) {
    loadTafsir(surahNum).then(function (map) {
      scopeEl.querySelectorAll('.zmf-tafsir').forEach(function (el) {
        var txt = map[el.getAttribute('data-k')];
        el.classList.remove('pending');
        el.querySelector('p').textContent = txt || 'التفسير غير متوفر لهذه الآية.';
        if (!txt) el.classList.add('pending');
      });
    }).catch(function () {
      scopeEl.querySelectorAll('.zmf-tafsir').forEach(function (el) {
        el.classList.add('pending');
        el.querySelector('p').textContent = 'التفسير غير متاح الآن (يحتاج اتصال أول مرة).';
      });
    });
  }

  /* ---------- الشاشة الرئيسية: بطاقة اليوم + بحث + قائمة السور ---------- */
  function renderHome() {
    var html = '<div class="zmf">' +
      aodCardHtml() +
      '<div class="zmf-search">' + ic('search', 19) +
        '<input type="search" class="zmf-input" placeholder="دوّري في آيات المصحف أو اسم سورة…" aria-label="بحث في المصحف" value="' + esc(lastQuery) + '">' +
        '<button type="button" class="zmf-clear' + (lastQuery ? ' on' : '') + '" aria-label="مسح البحث">' + ic('close', 16) + '</button>' +
      '</div>' +
      '<div class="zmf-results" hidden></div>' +
      '<div class="zmf-list">' +
        DATA.map(function (s) {
          return '<div class="zmf-row" data-ms="' + s.n + '" role="button" tabindex="0">' +
            '<span class="zmf-row-num">' + s.n + '</span>' +
            '<span class="zmf-row-main">' +
              '<div class="zmf-row-name">' + esc(cleanName(s.name)) + '</div>' +
              '<div class="zmf-row-meta">' + esc(s.en) + ' • ' + s.a.length + ' آيات</div>' +
            '</span>' + ic('chevron', 18) + '</div>';
        }).join('') +
      '</div></div>';

    root.innerHTML = html;
    window.scrollTo(0, 0);
    fillTafsir(root, ayahOfDay()[0]);

    var input = root.querySelector('.zmf-input');
    var onInput = function () {
      lastQuery = input.value;
      root.querySelector('.zmf-clear').classList.toggle('on', !!input.value);
      runSearch(input.value);
    };
    input.addEventListener('input', debounce(onInput, SEARCH_DEBOUNCE));
    if (lastQuery) runSearch(lastQuery);
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ---------- بحث المصحف (نص الآيات + أسماء السور) ---------- */
  function buildNormCache() {
    if (normCache) return;
    normCache = flatAyahs().map(function (row) { return [row[0], row[1], norm(row[2]), row[2]]; });
  }

  function runSearch(query) {
    var resEl = root.querySelector('.zmf-results');
    var listEl = root.querySelector('.zmf-list');
    var q = norm(query).replace(/\s+/g, ' ').trim();
    if (!resEl || !listEl) return;
    if (q.length < 2) {
      resEl.hidden = true; resEl.innerHTML = '';
      listEl.hidden = false;
      return;
    }
    buildNormCache();

    var surahHits = DATA.filter(function (s) {
      return norm(cleanName(s.name)).indexOf(q) !== -1 || s.en.toLowerCase().indexOf(q) !== -1;
    });
    var ayahHits = [];
    for (var i = 0; i < normCache.length && ayahHits.length < MAX_AYAH_RESULTS; i++) {
      if (normCache[i][2].indexOf(q) !== -1) ayahHits.push(normCache[i]);
    }

    var html = '';
    if (surahHits.length) {
      html += '<div class="section-title">سور</div>' + surahHits.map(function (s) {
        return '<div class="zmf-res" data-ms="' + s.n + '" role="button" tabindex="0">' +
          '<div class="zmf-res-ayah">' + esc(cleanName(s.name)) + '</div>' +
          '<div class="zmf-res-ref">' + esc(s.en) + ' • ' + s.a.length + ' آيات</div></div>';
      }).join('');
    }
    if (ayahHits.length) {
      html += '<div class="section-title">آيات</div>' + ayahHits.map(function (row) {
        var s = findSurah(row[0]);
        return '<div class="zmf-res" data-ms="' + row[0] + '" data-ma="' + row[1] + '" role="button" tabindex="0">' +
          '<div class="zmf-res-ayah">' + esc(row[3]) + '</div>' +
          '<div class="zmf-res-ref">' + esc(cleanName(s.name)) + ' — الآية ' + row[1] + '</div></div>';
      }).join('');
    }
    if (!surahHits.length && !ayahHits.length) {
      html = '<div class="zmf-empty">مفيش نتائج مطابقة لـ «' + esc(query) + '»</div>';
    } else {
      html = '<div class="zmf-count">' + (surahHits.length + ayahHits.length) + ' نتيجة' + (ayahHits.length === MAX_AYAH_RESULTS ? ' (أول ' + MAX_AYAH_RESULTS + ' آية)' : '') + '</div>' + html;
    }
    resEl.innerHTML = html;
    resEl.hidden = false;
    listEl.hidden = true;
  }

  /* ---------- عرض السورة مع التفسير ---------- */
  function renderSurah(n, targetAyah) {
    var s = findSurah(n);
    if (!s) { renderHome(); return; }

    var ayahsHtml = s.a.map(function (a) {
      var hl = (targetAyah === a[0]) ? ' zmf-hl' : '';
      return '<div class="zmf-ay' + hl + '" id="zmf-ay-' + n + '-' + a[0] + '">' +
        '<div class="zmf-ay-text">' + esc(a[1]) + ' <span class="zmf-num">﴿' + a[0] + '﴾</span></div>' +
        tafsirBlockHtml(n, a[0], true) +
      '</div>';
    }).join('');

    root.innerHTML = '<div class="zmf">' +
      '<a class="back" role="button" tabindex="0" data-zmf-back>' + ic('back', 16) + ' كل السور</a>' +
      '<div class="zmf-surah-head">' +
        '<div class="zmf-surah-name">' + esc(cleanName(s.name)) + '</div>' +
        '<div class="zmf-surah-meta">' + esc(s.en) + ' • ' + s.a.length + ' آيات</div>' +
      '</div>' +
      (n !== 1 && n !== 9 ? '<div class="zmf-bism">' + esc(BISM) + '</div>' : '') +
      '<div class="zmf-ayahs">' + ayahsHtml + '</div>' +
    '</div>';

    if (targetAyah) {
      setTimeout(function () {
        var el = document.getElementById('zmf-ay-' + n + '-' + targetAyah);
        if (el) el.scrollIntoView({ block: 'center' });
      }, 120);
    } else {
      window.scrollTo(0, 0);
    }
    fillTafsir(root, n);
  }

  /* ---------- التنقل الداخلي ---------- */
  function openSurah(n, ayah) {
    n = +n; ayah = +ayah || 0;
    if (!DATA) {
      loadQuran().then(function (q) { DATA = q; openSurah(n, ayah); });
      return;
    }
    renderSurah(n, ayah);
  }

  function bindEvents() {
    if (root.__zmfBound) return;
    root.__zmfBound = true;
    root.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var opener = t.closest('[data-ms]');
      if (opener && root.contains(opener)) {
        openSurah(opener.getAttribute('data-ms'), opener.getAttribute('data-ma'));
        return;
      }
      var back = t.closest('[data-zmf-back]');
      if (back) { renderHome(); return; }
      var clear = t.closest('.zmf-clear');
      if (clear) {
        var input = root.querySelector('.zmf-input');
        if (input) { input.value = ''; lastQuery = ''; input.focus(); }
        runSearch('');
        return;
      }
      var tf = t.closest('.zmf-tafsir');
      if (tf && root.contains(tf) && !tf.classList.contains('pending')) tf.classList.toggle('open');
    });
    // keyboard: Enter/Space on role=button rows
    root.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var t = ev.target;
      if (t && t.matches && t.matches('[data-ms],[data-zmf-back]')) {
        ev.preventDefault();
        t.click();
      }
    });
  }

  /* ---------- public API ---------- */
  window.ZamzamMushaf = {
    // Entry point: ZamzamMushaf.init(document.getElementById('mushaf-root'))
    init: function (container) {
      if (!container) return;
      root = container;
      root.innerHTML = '<div class="zmf"><div class="notice zmf-note">جاري تحميل المصحف…</div></div>';
      bindEvents();
      loadQuran().then(function (q) {
        DATA = q;
        renderHome();
      }).catch(function () {
        root.innerHTML = '<div class="zmf"><div class="notice zmf-note">حصلت مشكلة في تحميل المصحف. افتحي الصفحة تاني لما يكون فيه اتصال.</div></div>';
      });
    },
    // Optional deep link: ZamzamMushaf.open(2, 255)
    open: function (n, ayah) { openSurah(n, ayah); }
  };
})();
