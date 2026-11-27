/* ===== Zamzam extra screens: stats, settings, ayah, reminder ===== */
(function () {
  'use strict';

  var AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  var SURAH_NAMES = ['الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس','هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء','الكهف','مريم','طه','الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم','لقمان','السجدة','الأحزاب','سبأ','فاطر','يس','الصافات','ص','الزمر','غافر','فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق','الذاريات','الطور','النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة','الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج','نوح','الجن','المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات','عبس','التكوير','الانفطار','المطففين','الانشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد','الشمس','الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة','العاديات','القارعة','التكاثر','العصر','الهمزة','الفيل','قريش','الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص','الفلق','الناس'];

  /* ---------- tiny API helpers (defensive) ---------- */
  function A() { return window.ZamzamAPI || {}; }
  function h(html) { var a = A(); if (a && typeof a.h === 'function') a.h(html); }
  function esc(s) {
    var a = A();
    if (a && typeof a.esc === 'function') return a.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ic(n) { var a = A(); return (a && typeof a.ic === 'function') ? (a.ic(n) || '') : ''; }
  function toast(m) { var a = A(); if (a && typeof a.toast === 'function') a.toast(m); }
  function storeGet(k, d) {
    var a = A();
    try { if (a && a.store && typeof a.store.get === 'function') return a.store.get(k, d); } catch (e) {}
    return d;
  }
  function storeSet(k, v) {
    var a = A();
    try { if (a && a.store && typeof a.store.set === 'function') a.store.set(k, v); } catch (e) {}
  }
  function q(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
  function qa(sel) { try { return Array.prototype.slice.call(document.querySelectorAll(sel)); } catch (e) { return []; } }
  function arNum(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[+d]; }); }
  function dayKey(d) { return d.toISOString().slice(0, 10); }
  function head(title) {
    return '<a class="back" href="#home">' + ic('back') + ' الرئيسية</a>' +
           '<h2 class="page-title">' + esc(title) + '</h2>';
  }

  /* ---------- localStorage scan helpers (real data) ---------- */
  function lsKeys(prefix) {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) out.push(k);
      }
    } catch (e) {}
    return out;
  }
  /* Map of 'YYYY-MM-DD' -> total dhikr count that day (morning/evening adhkar + tasbih) */
  function dailyTotals() {
    var map = {};
    lsKeys('zamzam:dhikr:').forEach(function (k) {
      var rest = k.slice('zamzam:dhikr:'.length); // sabah:YYYY-MM-DD | masaa:YYYY-MM-DD
      var d = rest.slice(rest.indexOf(':') + 1);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      var raw;
      try { raw = localStorage.getItem(k); } catch (e) { return; }
      var sum = 0;
      try {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          Object.keys(obj).forEach(function (id) { var n = Number(obj[id]) || 0; if (n > 0) sum += n; });
        } else {
          sum = Number(obj) || 0;
        }
      } catch (e) { sum = Number(raw) || 0; }
      if (sum > 0) map[d] = (map[d] || 0) + sum;
    });
    lsKeys('zamzam:tasbih:total:').forEach(function (k) {
      var d = k.slice('zamzam:tasbih:total:'.length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      var raw;
      try { raw = localStorage.getItem(k); } catch (e) { return; }
      var n = Number(raw);
      if (isNaN(n)) { try { n = Number(JSON.parse(raw)) || 0; } catch (e) { n = 0; } }
      if (n > 0) map[d] = (map[d] || 0) + n;
    });
    return map;
  }

  /* ================= 1) Stats ================= */
  function renderStats() {
    var a = A();
    var tp = (a && typeof a.todayProgress === 'function') ? (a.todayProgress() || {}) : {};
    var s = tp.s || { got: 0, all: 0 };
    var m = tp.m || { got: 0, all: 0 };
    var tasbihTotal = Number(tp.tasbihTotal) || 0;
    var got = (Number(s.got) || 0) + (Number(m.got) || 0);
    var all = (Number(s.all) || 0) + (Number(m.all) || 0);
    var pct = all > 0 ? Math.min(100, Math.round((got / all) * 100)) : 0;

    var totals = dailyTotals();

    /* streak: consecutive days with activity, today first, else from yesterday */
    var streak = 0;
    var d = new Date();
    if (!totals[dayKey(d)]) d = new Date(d.getTime() - 864e5);
    while (totals[dayKey(d)]) { streak++; d = new Date(d.getTime() - 864e5); }

    /* total dhikr across all recorded days */
    var totalDhikr = 0;
    Object.keys(totals).forEach(function (k) { totalDhikr += totals[k]; });

    var points = (a && typeof a.getPoints === 'function') ? (Number(a.getPoints()) || 0) : (Number(storeGet('points', 0)) || 0);

    /* weekly bars: last 7 days, oldest first */
    var days = [];
    var max = 0;
    for (var i = 6; i >= 0; i--) {
      var dd = new Date(Date.now() - i * 864e5);
      var v = totals[dayKey(dd)] || 0;
      days.push({ v: v, label: AR_DAYS[dd.getUTCDay()], today: i === 0 });
      if (v > max) max = v;
    }
    var barsHtml = days.map(function (b) {
      var hgt = max > 0 ? Math.max(4, Math.round((b.v / max) * 100)) : 0;
      return '<div class="zx-bar' + (b.today ? ' today' : '') + '">' +
        '<span class="zx-bar-val">' + (b.v > 0 ? arNum(b.v) : '') + '</span>' +
        '<div class="zx-bar-track"><i style="height:' + hgt + '%"></i></div>' +
        '<small>' + esc(b.label) + '</small></div>';
    }).join('');

    var C = (2 * Math.PI * 54).toFixed(1);
    var off = (2 * Math.PI * 54 * (1 - pct / 100)).toFixed(1);
    var subBits = [];
    if (all > 0) subBits.push(arNum(got) + ' من ' + arNum(all) + ' ذكراً');
    if (tasbihTotal > 0) subBits.push('تسبيح اليوم: ' + arNum(tasbihTotal));

    h(
      head('إحصاءاتي') +
      '<div class="zx-wrap">' +
        '<div class="zx-glass zx-ring-card">' +
          '<div class="zx-ring">' +
            '<svg width="150" height="150" viewBox="0 0 120 120">' +
              '<circle class="zx-ring-bg" cx="60" cy="60" r="54" fill="none" stroke-width="10"/>' +
              '<circle class="zx-ring-fg" cx="60" cy="60" r="54" fill="none" stroke-width="10" stroke-dasharray="' + C + '" stroke-dashoffset="' + off + '"/>' +
            '</svg>' +
            '<div class="zx-ring-c"><b>' + arNum(pct) + '٪</b><span>ورد اليوم</span></div>' +
          '</div>' +
          (subBits.length ? '<div class="muted zx-ring-sub">' + subBits.join(' · ') + '</div>' : '<div class="muted zx-ring-sub">ابدأ ورد اليوم لتمتلئ الحلقة</div>') +
        '</div>' +
        '<div class="zx-stats-row">' +
          '<div class="zx-glass zx-stat"><span class="zx-sic">' + ic('sparkles') + '</span><b>' + arNum(streak) + '</b><small>أيام متتالية</small></div>' +
          '<div class="zx-glass zx-stat"><span class="zx-sic">' + ic('beads') + '</span><b>' + arNum(totalDhikr) + '</b><small>إجمالي الأذكار</small></div>' +
          '<div class="zx-glass zx-stat"><span class="zx-sic">' + ic('star') + '</span><b>' + arNum(points) + '</b><small>النقاط</small></div>' +
        '</div>' +
        '<div class="zx-glass">' +
          '<div class="section-title">آخر ٧ أيام</div>' +
          '<div class="zx-bars">' + barsHtml + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ================= 2) Settings ================= */
  function row(icon, title, sub, controlHtml) {
    return '<div class="zx-row">' +
      '<span class="zx-ric">' + ic(icon) + '</span>' +
      '<div class="zx-rtxt"><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' +
      (controlHtml || '') +
    '</div>';
  }

  function renderSettings() {
    h(
      head('الإعدادات') +
      '<div class="zx-wrap">' +
        '<div class="zx-glass">' +
          '<div class="section-title">التنبيهات</div>' +
          row('bell', 'تذكير الأذكار', 'تنبيه بأذكار الصباح والمساء',
            '<label class="zx-switch"><input type="checkbox" id="zx-s-adhkar"><i></i></label>') +
          row('sparkles', 'تذكير الورد اليومي', 'تنبيه لإتمام وردك اليومي',
            '<label class="zx-switch"><input type="checkbox" id="zx-s-wird"><i></i></label>') +
        '</div>' +
        '<div class="zx-glass">' +
          '<div class="section-title">عام</div>' +
          row('book', 'اللغة', 'العربية', '<span class="muted">العربية</span>') +
          row('moon', 'المظهر', 'داكن', '<span class="muted">داكن</span>') +
          '<a class="zx-row zx-link" href="#about">' +
            '<span class="zx-ric">' + ic('info') + '</span>' +
            '<div class="zx-rtxt"><b>عن التطبيق</b><small>زمزم — أذكار وقرآن وورد يومي</small></div>' +
            '<span class="zx-chev">' + ic('back') + '</span>' +
          '</a>' +
        '</div>' +
        '<button type="button" class="btn primary zx-share-btn" id="zx-share">' + ic('share') + ' مشاركة التطبيق</button>' +
      '</div>'
    );

    var adh = q('#zx-s-adhkar');
    if (adh) {
      adh.checked = !!storeGet('set:adhkar-reminder', false);
      adh.addEventListener('change', function () {
        storeSet('set:adhkar-reminder', adh.checked);
        toast(adh.checked ? 'تم تفعيل تذكير الأذكار' : 'تم إيقاف تذكير الأذكار');
      });
    }
    var wird = q('#zx-s-wird');
    if (wird) {
      wird.checked = !!storeGet('set:wird-reminder', false);
      wird.addEventListener('change', function () {
        storeSet('set:wird-reminder', wird.checked);
        toast(wird.checked ? 'تم تفعيل تذكير الورد اليومي' : 'تم إيقاف تذكير الورد اليومي');
      });
    }
    var sh = q('#zx-share');
    if (sh) {
      sh.addEventListener('click', function () {
        var data = { title: 'زمزم', text: 'تطبيق زمزم: أذكار، قرآن صوت، وورد يومي', url: location.href.split('#')[0] };
        if (navigator.share) {
          navigator.share(data).catch(function () {});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(data.url).then(
            function () { toast('تم نسخ رابط التطبيق'); },
            function () { toast('انسخ الرابط من شريط العنوان'); }
          );
        } else {
          toast('انسخ الرابط من شريط العنوان');
        }
      });
    }
  }

  /* ================= 3) Ayah of the day ================= */
  function flattenQuran(qr) {
    if (!qr || !qr.length) return [];
    /* real shell shape: [{n, name, a:[[ayahNum, text], ...]}] */
    if (qr[0] && Array.isArray(qr[0].a)) {
      var flat = [];
      qr.forEach(function (sur, si) {
        (sur.a || []).forEach(function (pair, ai) {
          var num = Array.isArray(pair) ? pair[0] : (pair && (pair.n || pair.a)) || (ai + 1);
          var txt = Array.isArray(pair) ? pair[1] : (pair && (pair.t || pair.text)) || '';
          flat.push({ s: sur.n || (si + 1), a: num, t: txt, sn: sur.name || '' });
        });
      });
      return flat;
    }
    if (qr[0] && qr[0].ayahs) {
      var out = [];
      qr.forEach(function (sur, si) {
        (sur.ayahs || []).forEach(function (ay, ai) {
          out.push({
            s: sur.n || sur.s || (si + 1),
            a: ay.n || ay.a || (ai + 1),
            t: ay.t || ay.text || '',
            sn: sur.name || sur.sn || ''
          });
        });
      });
      return out;
    }
    return qr;
  }

  /* تركيب شاشة المصحف الكامل تحت بطاقة آية اليوم */
  function mountMushaf() {
    var root = document.getElementById('mushaf-root');
    if (root && window.ZamzamMushaf && typeof window.ZamzamMushaf.init === 'function') {
      try { window.ZamzamMushaf.init(root); } catch (err) { /* المصحف اختياري */ }
    }
  }

  function renderAyah() {
    var a = A();
    var raw = (a && typeof a.QURAN === 'function') ? a.QURAN() : null;
    if (!raw || !raw.length) {
      h(head('آية اليوم') + '<div class="zx-wrap"><div class="notice">جارٍ تحميل المصحف، ستظهر آية اليوم هنا فور اكتمال التحميل.</div><div id="mushaf-root"></div></div>');
      mountMushaf();
      return;
    }
    var arr = flattenQuran(raw);
    if (!arr.length) {
      h(head('آية اليوم') + '<div class="zx-wrap"><div class="notice">جارٍ تحميل المصحف، ستظهر آية اليوم هنا فور اكتمال التحميل.</div><div id="mushaf-root"></div></div>');
      mountMushaf();
      return;
    }
    var now = new Date();
    var doy = Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5);
    var idx = doy % 6236;
    var item = arr[idx] || arr[idx % arr.length] || {};
    var text = item.t || item.text || '';
    var sNum = Number(item.s || item.surah) || 0;
    var aNum = Number(item.a || item.ayah) || 0;
    var sName = item.sn || item.surahName || (sNum >= 1 && sNum <= 114 ? SURAH_NAMES[sNum - 1] : '');
    sName = String(sName || '').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');
    if (sName && sName.indexOf('سورة') !== 0) sName = sName ? 'سورة ' + sName : '';
    var ref = sName + (aNum ? (sName ? ' · ' : '') + 'الآية ' + arNum(aNum) : '');

    var favs = storeGet('fav-ayahs', []);
    if (!Array.isArray(favs)) favs = [];
    var isFav = favs.some(function (f) { return f && f.i === idx; });

    h(
      head('آية اليوم') +
      '<div class="zx-wrap">' +
        '<div class="zx-glass zx-ayah-card">' +
          '<div class="zx-orn">' + ic('moon') + '</div>' +
          '<div class="zx-ayah-text">' + esc(text) + '</div>' +
          (ref ? '<div class="zx-ayah-ref">' + esc(ref) + '</div>' : '') +
          '<div class="zx-tafsir" id="zx-tafsir"><div class="zx-tafsir-src">التفسير الميسر</div><div class="zx-tafsir-body">…</div></div>' +
          '<div class="zx-actions">' +
            '<button type="button" class="zx-icon-btn" id="zx-ayah-share" title="مشاركة">' + ic('share') + '</button>' +
            '<button type="button" class="zx-icon-btn' + (isFav ? ' on' : '') + '" id="zx-ayah-fav" title="حفظ في المفضلة">' + ic('heart') + '</button>' +
          '</div>' +
        '</div>' +
        '<div id="mushaf-root"></div>' +
      '</div>'
    );
    mountMushaf();

    /* التفسير الميسر: lazy-load dataset once, then show this ayah's tafsir */
    (function () {
      var el = q('#zx-tafsir .zx-tafsir-body');
      if (!el) return;
      var key = sNum + ':' + aNum;
      function show(map) {
        var t = map && map[key];
        if (t) { el.textContent = t; }
        else { var box = q('#zx-tafsir'); if (box) box.style.display = 'none'; }
      }
      var ranges = [[1, 14], [15, 39], [40, 94], [95, 114]];
      var rg = ranges.filter(function (r) { return sNum >= r[0] && sNum <= r[1]; })[0];
      if (!rg) { var bx = q('#zx-tafsir'); if (bx) bx.style.display = 'none'; return; }
      var fn = 'tafsir-' + rg[0] + '-' + rg[1] + '.json';
      window.__muyassar = window.__muyassar || {};
      if (window.__muyassar[fn]) { show(window.__muyassar[fn]); return; }
      fetch(fn).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (m) { window.__muyassar[fn] = m; show(m); })
        .catch(function () { var box = q('#zx-tafsir'); if (box) box.style.display = 'none'; });
    })();

    var shBtn = q('#zx-ayah-share');
    if (shBtn) {
      shBtn.addEventListener('click', function () {
        var body = text + (ref ? '\n' + ref : '') + '\n— من تطبيق زمزم';
        if (navigator.share) {
          navigator.share({ title: 'آية اليوم', text: body }).catch(function () {});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(body).then(
            function () { toast('تم نسخ الآية'); },
            function () { toast('تعذّر النسخ'); }
          );
        } else {
          toast('تعذّرت المشاركة على هذا الجهاز');
        }
      });
    }
    var favBtn = q('#zx-ayah-fav');
    if (favBtn) {
      favBtn.addEventListener('click', function () {
        var list = storeGet('fav-ayahs', []);
        if (!Array.isArray(list)) list = [];
        var at = -1;
        list.forEach(function (f, i) { if (f && f.i === idx) at = i; });
        if (at >= 0) {
          list.splice(at, 1);
          favBtn.classList.remove('on');
          toast('أُزيلت الآية من المفضلة');
        } else {
          list.push({ i: idx, s: sNum, a: aNum, sn: sName, t: String(text).slice(0, 120) });
          favBtn.classList.add('on');
          toast('حُفظت الآية في المفضلة');
        }
        storeSet('fav-ayahs', list);
      });
    }
  }

  /* ================= 4) Reminder ================= */
  function nextReminderParts() {
    var t = storeGet('reminder-time', '07:00') || '07:00';
    var parts = String(t).split(':');
    var hh = parseInt(parts[0], 10); if (isNaN(hh)) hh = 7;
    var mm = parseInt(parts[1], 10); if (isNaN(mm)) mm = 0;
    var now = new Date();
    var next = new Date(now.getTime());
    next.setHours(hh, mm, 0, 0);
    if (next.getTime() <= now.getTime()) next = new Date(next.getTime() + 864e5);
    var diff = Math.max(0, Math.round((next.getTime() - now.getTime()) / 60000));
    var H = Math.floor(diff / 60), M = diff % 60;
    return { H: H, M: M };
  }
  function durWord(n, one, two, few, many) {
    if (n === 1) return one;
    if (n === 2) return two;
    if (n >= 3 && n <= 10) return arNum(n) + ' ' + few;
    return arNum(n) + ' ' + many;
  }
  function nextReminderText() {
    var p = nextReminderParts();
    var bits = [];
    if (p.H > 0) bits.push(durWord(p.H, 'ساعة', 'ساعتان', 'ساعات', 'ساعة'));
    if (p.M > 0) bits.push(durWord(p.M, 'دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'));
    if (!bits.length) bits.push('أقل من دقيقة');
    return 'الموعد القادم بعد ' + bits.join(' و');
  }

  function renderReminder() {
    h(
      head('تذكير الأذكار') +
      '<div class="zx-wrap">' +
        '<div class="zx-glass">' +
          row('bell', 'تفعيل التذكير', 'إشعار يومي بأذكار الصباح والمساء',
            '<label class="zx-switch"><input type="checkbox" id="zx-rem-on"><i></i></label>') +
          row('calendar', 'وقت التذكير', 'اختر الوقت المناسب لك',
            '<input type="time" class="zx-time" id="zx-rem-time">') +
          '<div class="zx-next" id="zx-rem-next">' + ic('bell') + '<span id="zx-rem-next-txt"></span></div>' +
        '</div>' +
        '<div class="notice">يعمل التذكير ما دام التطبيق مفتوحاً أو مثبتاً على جهازك؛ لا يوجد خادم إشعارات خارجي حالياً، فلن تصلك التنبيهات إذا أُغلق التطبيق تماماً.</div>' +
      '</div>'
    );

    function updateNext() {
      var el = q('#zx-rem-next-txt');
      if (el) el.textContent = nextReminderText();
    }

    var onEl = q('#zx-rem-on');
    if (onEl) {
      onEl.checked = !!storeGet('reminder-on', false);
      onEl.addEventListener('change', function () {
        if (onEl.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
          try {
            var p = Notification.requestPermission(function (perm) {
              if (perm === 'denied') toast('الإشعارات مرفوضة من إعدادات المتصفح');
            });
            if (p && p.then) p.then(function (perm) { if (perm === 'denied') toast('الإشعارات مرفوضة من إعدادات المتصفح'); });
          } catch (e) {}
        }
        storeSet('reminder-on', onEl.checked);
        toast(onEl.checked ? 'تم تفعيل التذكير' : 'تم إيقاف التذكير');
      });
    }
    var tEl = q('#zx-rem-time');
    if (tEl) {
      tEl.value = storeGet('reminder-time', '07:00') || '07:00';
      tEl.addEventListener('change', function () {
        storeSet('reminder-time', tEl.value || '07:00');
        updateNext();
        toast('تم حفظ وقت التذكير');
      });
    }
    updateNext();
  }

  window.ZAMZAM_EXTRA = {
    stats: renderStats,
    settings: renderSettings,
    ayah: renderAyah,
    reminder: renderReminder
  };
})();

/* ===== سماء زمزم: نجوم متلألئة + انجراف + طبقتا parallax + نجم ساقط أحياناً — خفيف على الأجهزة ===== */
(function(){
  var cv = document.getElementById('sky'); if(!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W=0,H=0,DPR=1, stars=[], shooting=null, last=0, raf=null, shootTimer=0;
  function resize(){
    DPR = Math.min(window.devicePixelRatio||1, 2);
    W = cv.width = Math.floor(innerWidth*DPR);
    H = cv.height = Math.floor(innerHeight*DPR);
    cv.style.width = innerWidth+'px'; cv.style.height = innerHeight+'px';
    var n = Math.min(170, Math.max(60, Math.floor(innerWidth*innerHeight/3200)));
    stars = [];
    for(var i=0;i<n;i++){
      var near = Math.random()<0.45;
      stars.push({
        x: Math.random()*W, y: Math.random()*H,
        r: (near?1.15:0.7)*DPR*(0.5+Math.random()*0.9),
        a: 0.25+Math.random()*0.55,
        ph: Math.random()*6.2832,
        sp: 0.4+Math.random()*1.4,
        vx: (near?3.2:1.2)*DPR/60
      });
    }
  }
  function drawStatic(){
    ctx.clearRect(0,0,W,H);
    for(var i=0;i<stars.length;i++){ var s=stars[i];
      ctx.globalAlpha=s.a; ctx.fillStyle='#f5f5f5';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.2832); ctx.fill(); }
    ctx.globalAlpha=1;
  }
  function frame(t){
    raf = requestAnimationFrame(frame);
    var dt = Math.min(50, t-last||16); last=t;
    ctx.clearRect(0,0,W,H);
    for(var i=0;i<stars.length;i++){ var s=stars[i];
      s.ph += s.sp*dt/1000;
      s.x += s.vx*dt/16; if(s.x>W+4) s.x=-4;
      var tw = s.a*(0.55+0.45*Math.sin(s.ph));
      ctx.globalAlpha = tw; ctx.fillStyle='#f5f5f5';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.2832); ctx.fill();
      if(s.r>1.4*DPR && tw>0.55){
        ctx.globalAlpha = tw*0.3;
        ctx.fillRect(s.x-s.r*3, s.y-0.5*DPR, s.r*6, DPR);
        ctx.fillRect(s.x-0.5*DPR, s.y-s.r*3, DPR, s.r*6);
      }
    }
    shootTimer += dt;
    if(!shooting && shootTimer > 11000+Math.random()*9000){ shootTimer=0;
      shooting={x:Math.random()*W*0.75, y:Math.random()*H*0.22, len:0, life:0, maxLife:55}; }
    if(shooting){ shooting.life++; shooting.len=Math.min(90*DPR, shooting.len+dt*0.9*DPR);
      var p=shooting.life/shooting.maxLife;
      var sx=shooting.x+shooting.len*0.8, sy=shooting.y+shooting.len*0.35;
      ctx.globalAlpha=Math.max(0,0.5*(1-p));
      ctx.strokeStyle='#fff'; ctx.lineWidth=1.2*DPR; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.lineTo(sx-shooting.len*0.8, sy-shooting.len*0.35); ctx.stroke();
      if(p>=1) shooting=null;
    }
    ctx.globalAlpha=1;
  }
  function start(){ if(!raf && !reduced){ last=performance.now(); raf=requestAnimationFrame(frame);} }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf=null; } }
  resize();
  if(reduced) drawStatic(); else start();
  addEventListener('resize', function(){ resize(); if(reduced) drawStatic(); });
  document.addEventListener('visibilitychange', function(){ if(document.hidden) stop(); else start(); });
})();
