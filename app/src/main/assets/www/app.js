(function () {
  'use strict';

  // ---------- Outils ----------
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function load(k, def) { try { var v = localStorage.getItem('radio.' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem('radio.' + k, JSON.stringify(v)); } catch (e) {} }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var NATIVE = typeof window.Android !== 'undefined';

  // ---------- Thème : clair le jour, sombre la nuit (lever / coucher du soleil à Alger, en UTC) ----------
  var LAT = 36.75, LON = 3.06;
  function sunTimes(d) {
    var N = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
    var g = 2 * Math.PI / 365 * (N - 1);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var lat = LAT * Math.PI / 180;
    var c = Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(dec)) - Math.tan(lat) * Math.tan(dec);
    if (c > 1) return [12, 12];
    if (c < -1) return [0, 24];
    var ha = Math.acos(c) * 180 / Math.PI;
    return [(720 - 4 * (LON + ha) - eq) / 60, (720 - 4 * (LON - ha) - eq) / 60];
  }
  var themeMode = load('theme', 'auto');   // auto | light | dark
  function isNight() {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    var d = new Date(), h = d.getUTCHours() + d.getUTCMinutes() / 60, s = sunTimes(d);
    return h < s[0] || h >= s[1];
  }
  var nightNow = null;
  function checkTheme() {
    var n = isNight();
    if (n === nightNow) return;
    nightNow = n;
    document.body.className = n ? 'night' : '';
    document.documentElement.className = n ? 'night' : '';
    try { localStorage.setItem('radio.night', n ? 'true' : 'false'); } catch (e) {}
    if (NATIVE) { try { window.Android.setTheme(n); } catch (e) {} }
  }
  // Icônes SVG modernes (style Tabler – traits fins, élégants)
  function svgIcon(name, size) {
    size = size || 22;
    var paths = {
      'theme-auto': '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v18"/><path d="M12 12h9"/>',
      'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707-.707M6.343 6.343l-.707-.707m12.728 0-.707.707M6.343 17.657l-.707.707"/>',
      'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
      'play': '<path d="M7 4v16l13-8z"/>',
      'pause': '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
      'prev': '<path d="M19 5v14L8 12z"/><path d="M5 5v14"/>',
      'next': '<path d="M5 5v14l11-7z"/><path d="M19 5v14"/>',
      'heart': '<path d="M19.5 12.572l-7.5 7.428-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572"/>',
      'heart-fill': '<path d="M19.5 12.572l-7.5 7.428-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572"/>',
      'timer': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      'stop': '<rect x="6" y="6" width="12" height="12" rx="1"/>',
      'chevron-down': '<path d="M6 9l6 6 6-6"/>'
    };
    var p = paths[name] || '';
    var filled = name === 'heart-fill';
    return '<svg class="ico" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }
  var THEME_ICON = {auto: 'theme-auto', light: 'sun', dark: 'moon'};

  // ---------- Annuaire Radio Browser ----------
  var MIRRORS = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
  var mirror = 0;
  function api(path, done) {
    var tries = 0;
    (function next() {
      if (tries >= MIRRORS.length) { done(null); return; }
      var base = MIRRORS[(mirror + tries) % MIRRORS.length], x = new XMLHttpRequest(), over = false;
      function fail() { if (over) return; over = true; tries++; next(); }
      x.open('GET', base + path, true);
      x.timeout = 9000;
      x.onload = function () {
        if (over) return;
        if (x.status === 200) {
          try { var data = JSON.parse(x.responseText); over = true; mirror = (mirror + tries) % MIRRORS.length; done(data); return; } catch (e) {}
        }
        fail();
      };
      x.onerror = x.ontimeout = fail;
      x.send();
    })();
  }
  function norm(s) {
    var url = s.url_resolved || s.url || '';
    return {id: s.stationuuid || ('u' + url), name: String(s.name || '').replace(/^\s+|\s+$/g, ''), url: url, icon: s.favicon || '',
            tags: String(s.tags || '').split(',').slice(0, 2).join(' · '), br: s.bitrate || 0, codec: s.codec || '', cc: s.countrycode || '', hls: !!s.hls};
  }
  function normList(list) {
    var out = [], seen = {};
    for (var i = 0; i < list.length; i++) {
      var s = norm(list[i]);
      if (!s.url || !s.name || (s.hls && !NATIVE) || seen[s.url]) continue;   // l'appli Android lit aussi le HLS
      seen[s.url] = 1; out.push(s);
    }
    return out;
  }
  function stationsQuery(q, done) {
    api('/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=300&' + q, function (list) { done(list ? normList(list) : null); });
  }

  // ---------- État ----------
  var favs = load('favs', []);
  var tab = 'dz', country = null;
  var cur = load('last', null), queue = cur ? [cur] : [], qi = 0;
  var playing = false, loading = false, errored = false, track = '', wantPlay = false;
  var searchText = '', searchResults = null, searchNote = '', addName = '', addUrl = '';
  var sleepMin = 0, sleepAt = 0, sleepTimer = 0;
  var playerOpen = false;

  function isFav(s) { for (var i = 0; i < favs.length; i++) if (favs[i].id === s.id) return i; return -1; }
  function toggleFav(s) { var i = isFav(s); if (i >= 0) favs.splice(i, 1); else favs.push(s); save('favs', favs); }

  // ---------- Lecteur (natif sur Android, balise audio sinon) ----------
  var audio = NATIVE ? null : new Audio();
  function pPlay(s) {
    errored = false;
    if (NATIVE) window.Android.play(s.url, s.name);
    else { audio.src = s.url; var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
  }
  function pPause() { if (NATIVE) window.Android.pause(); else audio.pause(); }
  function pResume() { if (NATIVE) window.Android.resume(); else { audio.src = cur.url; var p = audio.play(); if (p && p.catch) p.catch(function () {}); } }
  function pStop() { if (NATIVE) window.Android.stop(); else { audio.pause(); audio.removeAttribute('src'); audio.load(); } }
  if (audio) {
    audio.addEventListener('playing', function () { playing = true; loading = false; errored = false; refreshPlayer(); });
    audio.addEventListener('pause', function () { playing = false; refreshPlayer(); });
    audio.addEventListener('waiting', function () { loading = true; refreshPlayer(); });
    audio.addEventListener('error', function () { playing = false; loading = false; errored = true; refreshPlayer(); });
  }
  /** Ce que dit le service de lecture Android : { playing, loading, idle, url, title, station, error }. */
  var asked = 0;   // l'heure de la dernière demande de lecture : le service met un instant à répondre
  window.onNative = function (o) {
    if (o.url && (!cur || cur.url !== o.url)) {
      var l = load('last', null);
      if (l && l.url === o.url) { cur = l; if (!queue.length) queue = [l]; }   // l'appli a été rouverte pendant l'écoute
    }
    if (!cur) { refreshPlayer(); return; }
    if (o.url && o.url !== cur.url) return;   // l'ancienne station, pendant que la nouvelle se charge
    if (!o.url) {                             // le service n'a plus rien en cours (notification, minuterie)
      if (new Date().getTime() - asked < 5000) return;
      playing = false; loading = false; wantPlay = false; track = '';
      if (sleepMin) sleepMin = 0;
      refreshPlayer(); return;
    }
    playing = !!o.playing;
    loading = !!o.loading;
    wantPlay = playing || loading;
    // Titre du flux en cours (métadonnées ICY / now playing)
    var t = (o.title || '').replace(/^\s+|\s+$/g, '');
    var st = (o.station || '').replace(/^\s+|\s+$/g, '');
    if (t && t !== st && t !== cur.name) track = t;
    else if (t && t !== cur.name && t.length > (cur.name || '').length) track = t;
    else if (!t) track = track; // garder le dernier titre connu tant que le flux tourne
    else track = '';
    errored = !!o.error;
    refreshPlayer();
  };
  function play(s, list, idx) {
    cur = s; queue = list && list.length ? list : [s]; qi = idx || 0; track = ''; wantPlay = true; playing = false; loading = true; asked = new Date().getTime();
    save('last', s);
    pPlay(s);
    openPlayer(true);
    api('/json/url/' + encodeURIComponent(s.id), function () {});   // un clic pour l'annuaire
  }
  function step(d) { if (!queue.length) return; qi = (qi + d + queue.length) % queue.length; play(queue[qi], queue, qi); }
  function togglePlay() {
    if (!cur) return;
    if (playing || loading) { wantPlay = false; pPause(); playing = false; loading = false; }
    else { wantPlay = true; loading = true; errored = false; asked = new Date().getTime(); pResume(); }
    refreshPlayer();
  }
  function stopAll() {
    wantPlay = false; pStop(); playing = false; loading = false; track = '';
    setSleep(0);
    cur = null; openPlayer(false); refreshPlayer(); renderContent(true);
  }
  function setSleep(m) {
    sleepMin = m; clearTimeout(sleepTimer);
    if (NATIVE) { try { window.Android.sleep(m); } catch (e) {} }
    if (m) {
      sleepAt = new Date().getTime() + m * 60000;
      if (!NATIVE) sleepTimer = setTimeout(function () { sleepMin = 0; stopAll(); }, m * 60000);
    }
  }
  function cycleSleep() { var order = [0, 15, 30, 60, 90], i = order.indexOf(sleepMin); setSleep(order[(i + 1) % order.length]); refreshPlayer(); }
  function sleepLabel() {
    if (!sleepMin) return svgIcon('timer', 18) + ' Minuterie';
    var left = Math.max(0, Math.ceil((sleepAt - new Date().getTime()) / 60000));
    if (left <= 0) { sleepMin = 0; return svgIcon('timer', 18) + ' Minuterie'; }
    return svgIcon('timer', 18) + ' ' + left + ' min';
  }

  // ---------- Logos (fond centré, marge intérieure, jamais collés aux bords) ----------
  function cssUrl(u) {
    return 'url("' + String(u).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
  }
  // Recadre le dessin utile (pixels opaques) au centre. Retourne null si l'image est déjà pleine ou illisible (CORS).
  function trimIcon(img) {
    try {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return null;
      var max = 96, sc = Math.min(1, max / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
      var c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      var data = ctx.getImageData(0, 0, cw, ch).data;
      var minX = cw, minY = ch, maxX = -1, maxY = -1;
      for (var y = 0; y < ch; y++) {
        for (var x = 0; x < cw; x++) {
          if (data[(y * cw + x) * 4 + 3] > 16) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return null;
      if (minX <= 1 && minY <= 1 && maxX >= cw - 2 && maxY >= ch - 2) return null;
      var tw = maxX - minX + 1, th = maxY - minY + 1;
      var side = Math.max(tw, th);
      var pad = Math.max(2, Math.round(side * 0.1));
      var outSide = side + pad * 2;
      var out = document.createElement('canvas');
      out.width = out.height = outSide;
      var o = out.getContext('2d');
      o.fillStyle = '#ffffff';
      o.fillRect(0, 0, outSide, outSide);
      o.drawImage(c, minX, minY, tw, th, pad + Math.floor((side - tw) / 2), pad + Math.floor((side - th) / 2), tw, th);
      return out.toDataURL('image/png');
    } catch (e) { return null; }
  }
  function logoFor(parent, s) {
    var token = (parent._logoToken = (parent._logoToken || 0) + 1);
    parent.innerHTML = '';
    parent.classList.remove('has-img');
    parent.classList.remove('trimmed');
    parent.style.backgroundImage = '';
    var initials = (s.name || '?').replace(/[^\w\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF ]/g, '').split(' ');
    var t = (initials[0] || '?').charAt(0) + (initials[1] ? initials[1].charAt(0) : '');
    var hue = 0, n = s.name || '';
    for (var i = 0; i < n.length; i++) hue = (hue * 31 + n.charCodeAt(i)) % 360;
    parent.style.backgroundColor = 'hsl(' + hue + ',45%,42%)';
    parent.textContent = t.toUpperCase();
    if (!(s.icon && /^https?:/.test(s.icon))) return;
    function apply(src, trimmed) {
      if (parent._logoToken !== token) return;
      parent.textContent = '';
      parent.classList.add('has-img');
      if (trimmed) parent.classList.add('trimmed'); else parent.classList.remove('trimmed');
      parent.style.backgroundColor = '#fff';
      parent.style.backgroundImage = cssUrl(src);
    }
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      var trimmed = trimIcon(img);
      apply(trimmed || s.icon, !!trimmed);
    };
    img.onerror = function () {
      var img2 = new Image();
      img2.onload = function () { apply(s.icon, false); };
      img2.src = s.icon;
    };
    img.src = s.icon;
  }

  // ---------- Onglets et listes ----------
  var TABS = [['dz', 'Algérie'], ['fav', 'Favoris'], ['world', 'Monde'], ['search', 'Recherche'], ['add', 'Ajouter']];
  function renderTabs() {
    var t = $('tabs'); t.innerHTML = '';
    TABS.forEach(function (x) {
      var b = el('button', 'tab' + (x[0] === tab ? ' on' : ''), t, x[1]);
      b.onclick = function () { tab = x[0]; country = null; renderTabs(); renderContent(false); };
    });
  }
  function stationRow(parent, s, list, idx) {
    var r = el('div', 'row' + (cur && cur.id === s.id ? ' playing' : ''), parent);
    logoFor(el('div', 'logo', r), s);
    var info = el('div', 'info', r);
    var nm = el('div', 'name', info, s.name); nm.setAttribute('dir', 'auto');
    el('div', 'meta', info, [s.tags, s.br ? s.br + ' kb/s' : '', s.codec].filter(function (x) { return x; }).join(' · '));
    var h = el('button', 'heart', r);
    h.innerHTML = isFav(s) >= 0 ? svgIcon('heart-fill', 22) : svgIcon('heart', 22);
    h.onclick = function (e) { e.stopPropagation(); toggleFav(s); h.innerHTML = isFav(s) >= 0 ? svgIcon('heart-fill', 22) : svgIcon('heart', 22); if (tab === 'fav') renderContent(true); };
    r.onclick = function () { play(s, list, idx); };
  }
  function stationList(parent, list) { for (var i = 0; i < list.length; i++) stationRow(parent, list[i], list, i); }
  function msg(parent, t) { el('div', 'msg', parent, t); }

  var renderToken = 0;
  function renderContent(keepScroll) {
    var c = $('content'), y = c.scrollTop, token = ++renderToken;
    c.innerHTML = '';
    function done() { if (keepScroll) c.scrollTop = y; else c.scrollTop = 0; }
    if (tab === 'dz') {
      var cached = load('cache_dz', null);
      if (cached && cached.length) { stationList(c, cached); done(); }
      else msg(c, 'Chargement des radios…');
      stationsQuery('countrycode=DZ', function (list) {
        if (token !== renderToken) return;
        if (list && list.length) {
          save('cache_dz', list);
          if (!cached || !cached.length) { c.innerHTML = ''; stationList(c, list); done(); }
        } else if (!cached || !cached.length) { c.innerHTML = ''; msg(c, 'Impossible de joindre l\'annuaire. Vérifiez la connexion.'); }
      });
    } else if (tab === 'fav') {
      if (!favs.length) msg(c, 'Aucun favori. Touchez le cœur d\'une station pour l\'ajouter.');
      else stationList(c, favs);
      done();
    } else if (tab === 'world') {
      if (!country) {
        msg(c, 'Chargement des pays…');
        api('/json/countries?hidebroken=true', function (list) {
          if (token !== renderToken) return;
          c.innerHTML = '';
          if (!list) { msg(c, 'Impossible de joindre l\'annuaire.'); return; }
          list = list.filter(function (x) { return x.stationcount > 0 && x.iso_3166_1; }).sort(function (a, b) { return b.stationcount - a.stationcount; });
          list.forEach(function (x) {
            var r = el('div', 'row', c);
            var lg = el('div', 'logo', r, x.iso_3166_1); lg.style.backgroundColor = '#1FA85A';
            var info = el('div', 'info', r); el('div', 'name', info, x.name); el('div', 'meta', info, x.stationcount + ' stations');
            el('div', 'chev', r, '›');
            r.onclick = function () { country = x; renderContent(false); };
          });
          done();
        });
      } else {
        var back = el('button', 'cta small', c, '‹ Pays'); back.onclick = function () { country = null; renderContent(false); };
        el('div', 'label', c, country.name);
        msg(c, 'Chargement…');
        stationsQuery('countrycode=' + encodeURIComponent(country.iso_3166_1), function (list) {
          if (token !== renderToken) return;
          var m = c.querySelector('.msg'); if (m) m.parentNode.removeChild(m);
          if (!list) { msg(c, 'Impossible de joindre l\'annuaire.'); return; }
          if (!list.length) msg(c, 'Aucune station trouvée.'); else stationList(c, list);
        });
      }
    } else if (tab === 'search') {
      var bar = el('div', 'searchbar', c), inp = el('input', 'field', bar), go = el('button', 'cta', bar, 'OK');
      inp.type = 'search'; inp.placeholder = 'Nom de la radio'; inp.value = searchText;
      function run() {
        searchText = inp.value; var q = searchText.replace(/^\s+|\s+$/g, '');
        if (!q) return;
        searchNote = 'Recherche…'; searchResults = null; renderContent(false);
        var tk = renderToken;
        stationsQuery('name=' + encodeURIComponent(q), function (list) {
          if (tk !== renderToken) return;
          searchResults = list || []; searchNote = list ? (list.length ? '' : 'Aucune station trouvée.') : 'Impossible de joindre l\'annuaire.';
          renderContent(false);
        });
      }
      go.onclick = run;
      inp.onkeydown = function (e) { if (e.keyCode === 13) { inp.blur(); run(); } };
      if (searchNote) msg(c, searchNote);
      if (searchResults && searchResults.length) stationList(c, searchResults);
    } else if (tab === 'add') {
      var i1 = el('input', 'field', c), i2 = el('input', 'field', c), bt = el('button', 'cta', c, 'Enregistrer'), note = el('div', 'label', c, 'Une station ajoutée ici apparaît dans « Favoris ».');
      i1.type = 'text'; i1.placeholder = 'Nom de la station'; i1.value = addName;
      i2.type = 'url'; i2.placeholder = 'Adresse du flux (http://…)'; i2.value = addUrl;
      bt.onclick = function () {
        addName = i1.value; addUrl = i2.value;
        var u = addUrl.replace(/^\s+|\s+$/g, ''), n = addName.replace(/^\s+|\s+$/g, '');
        if (!/^https?:\/\//i.test(u)) { note.textContent = 'L\'adresse doit commencer par http:// ou https://'; return; }
        favs.push({id: 'c' + new Date().getTime(), name: n || u, url: u, icon: '', tags: 'Ajoutée', br: 0, codec: '', cc: '', hls: false});
        save('favs', favs); addName = addUrl = ''; i1.value = i2.value = '';
        note.textContent = 'Station ajoutée aux favoris.';
      };
    }
  }

  // ---------- Flip clock (canvas : encre centrée, marge sur les 4 bords) ----------
  var flipCards = [];
  function digitColor() { return nightNow ? '#E8E8EC' : '#1A1A1E'; }
  function makeFlipCard(parent) {
    var card = el('div', 'fcard', parent), parts = {};
    var names = ['top', 'bot', 'front', 'back'];
    for (var i = 0; i < names.length; i++) {
      var half = el('div', (i < 2 ? 'fh ' : 'flap ') + names[i], card);
      parts[names[i]] = el('canvas', 'fd', el('span', '', half));
    }
    card.fparts = parts; card.fcur = null; card.ftimer = 0;
    card.flastW = 0; card.flastH = 0; card.flastNight = null;
    return card;
  }
  function paintDigit(canvas, text, color) {
    var card = canvas.closest ? canvas.closest('.fcard') : null;
    var w = card ? card.clientWidth : 0;
    var h = card ? card.clientHeight : 0;
    if (w < 8 || h < 8) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var padX = w * 0.10;
    var padY = h * 0.12;
    var maxW = w - padX * 2;
    var maxH = h - padY * 2;
    var ref = 240;
    var probe = paintDigit._probe || (paintDigit._probe = document.createElement('canvas'));
    probe.width = 720; probe.height = 480;
    var pctx = probe.getContext('2d');
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, probe.width, probe.height);
    pctx.font = '600 ' + ref + 'px Inter, sans-serif';
    try { pctx.letterSpacing = '-0.02em'; } catch (e) {}
    pctx.fillStyle = '#000';
    pctx.textBaseline = 'alphabetic';
    pctx.textAlign = 'left';
    var bx = 80, by = 300;
    pctx.fillText(text, bx, by);
    var img = pctx.getImageData(0, 0, probe.width, probe.height).data;
    var minX = probe.width, minY = probe.height, maxX = 0, maxY = 0, any = false;
    for (var i = 3; i < img.length; i += 4) {
      if (img[i] > 24) {
        var idx = (i - 3) / 4, x = idx % probe.width, y = (idx / probe.width) | 0;
        any = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (!any) return;
    var inkW = maxX - minX + 1, inkH = maxY - minY + 1;
    var scale = Math.min(maxW / inkW, maxH / inkH);
    var dw = inkW * scale, dh = inkH * scale;
    var dx = (w - dw) / 2, dy = (h - dh) / 2;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '600 ' + (ref * scale) + 'px Inter, sans-serif';
    try { ctx.letterSpacing = '-0.02em'; } catch (e2) {}
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(text, dx + (bx - minX) * scale, dy + (by - minY) * scale);
  }
  function setFlipCard(card, text) {
    var w = card.clientWidth, h = card.clientHeight;
    if (w < 8 || h < 8) return;
    var p = card.fparts, night = !!nightNow;
    if (card.fcur === text && card.flastW === w && card.flastH === h && card.flastNight === night) return;
    clearTimeout(card.ftimer);
    var old = card.fcur;
    var layoutSame = card.flastW === w && card.flastH === h && card.flastNight === night;
    card.flastW = w; card.flastH = h; card.flastNight = night;
    var col = digitColor();
    function all(t) {
      paintDigit(p.top, t, col); paintDigit(p.bot, t, col);
      paintDigit(p.front, t, col); paintDigit(p.back, t, col);
    }
    if (old === null || old === text || !layoutSame) {
      all(text);
      card.className = 'fcard';
      card.fcur = text;
      return;
    }
    paintDigit(p.top, text, col);
    paintDigit(p.bot, old, col);
    paintDigit(p.front, old, col);
    paintDigit(p.back, text, col);
    card.className = 'fcard';
    void card.offsetWidth;
    card.className = 'fcard go';
    card.fcur = text;
    card.ftimer = setTimeout(function () {
      paintDigit(p.bot, text, digitColor());
      paintDigit(p.front, text, digitColor());
      card.className = 'fcard';
    }, 650);
  }
  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function tick() {
    var d = new Date();
    checkTheme();
    if (flipCards.length) { setFlipCard(flipCards[0], pad(d.getHours())); setFlipCard(flipCards[1], pad(d.getMinutes())); }
    $('pDate').textContent = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    checkTheme();
    if (sleepMin && playerOpen) { var b = $('pControls').querySelector('.sleep'); if (b) b.innerHTML = sleepLabel(); }
  }

  // ---------- Mini-lecteur et lecteur plein écran ----------
  function statusText() {
    if (errored) return ['Flux indisponible — essayez une autre station', true];
    if (playing) return ['En lecture', false];
    if (loading) return ['Mise en mémoire…', false];
    return ['En pause', false];
  }
  function refreshPlayer() {
    var m = $('mini');
    if (!cur) { m.className = ''; m.innerHTML = ''; if (playerOpen) openPlayer(false); return; }
    m.className = 'on'; m.innerHTML = '';
    logoFor(el('div', 'logo', m), cur);
    var info = el('div', 'info', m);
    var nm = el('div', 'name', info, cur.name); nm.setAttribute('dir', 'auto');
    // En bas : titre du flux (now playing) s'il existe, sinon statut
    var metaLine = el('div', 'meta' + (track ? ' nowplaying' : ''), info);
    metaLine.textContent = track ? ('♪ ' + track) : statusText()[0];
    metaLine.setAttribute('dir', 'auto');
    if (track) metaLine.title = track;
    var pb = el('button', 'play', m);
    pb.innerHTML = playing || loading ? svgIcon('pause', 22) : svgIcon('play', 22);
    pb.onclick = function (e) { e.stopPropagation(); togglePlay(); };
    m.onclick = function () { openPlayer(true); };
    // lecteur plein écran
    logoFor($('pLogo'), cur);
    var n = $('pName'); n.textContent = cur.name; n.setAttribute('dir', 'auto');
    $('pSub').textContent = [cur.cc, cur.tags, cur.br ? cur.br + ' kb/s' : '', cur.codec].filter(function (x) { return x; }).join(' · ');
    var t = $('pTrack');
    if (track) {
      t.textContent = '♪ ' + track;
      t.style.display = 'block';
      t.setAttribute('dir', 'auto');
      t.title = track;
    } else {
      t.textContent = '';
      t.style.display = 'none';
    }
    var st = statusText(), s = $('pStatus'); s.textContent = st[0]; s.className = st[1] ? 'err' : '';
    var c = $('pControls'); c.innerHTML = '';
    var r1 = el('div', 'rowc', c), r2 = el('div', 'rowc', c);
    function btn(parent, html, cls, act) {
      var b = el('button', 'btn' + (cls ? ' ' + cls : ''), parent);
      b.innerHTML = html;
      b.onclick = act;
      return b;
    }
    btn(r1, svgIcon('prev', 22), 'sec', function () { step(-1); });
    btn(r1, playing || loading ? svgIcon('pause', 28) : svgIcon('play', 28), 'main', togglePlay);
    btn(r1, svgIcon('next', 22), 'sec', function () { step(1); });
    btn(r2, isFav(cur) >= 0 ? svgIcon('heart-fill', 22) : svgIcon('heart', 22), 'sec' + (isFav(cur) >= 0 ? ' fav-on' : ''), function () { toggleFav(cur); refreshPlayer(); if (tab === 'fav') renderContent(true); });
    btn(r2, sleepLabel(), 'sleep', cycleSleep);
    btn(r2, svgIcon('stop', 20), 'sec', stopAll);
  }
  function openPlayer(on) {
    playerOpen = !!on && !!cur;
    $('player').className = playerOpen ? 'on' : '';
    if (NATIVE) { try { window.Android.keepAwake(playerOpen); } catch (e) {} }
    if (playerOpen) { refreshPlayer(); tick(); }
  }
  window.onBack = function () {
    if (playerOpen) { openPlayer(false); return true; }
    if (tab === 'world' && country) { country = null; renderContent(false); return true; }
    if (tab !== 'dz') { tab = 'dz'; country = null; renderTabs(); renderContent(false); return true; }
    return false;
  };

  // ---------- Démarrage ----------
  function setThemeIcon() {
    $('themeBtn').innerHTML = svgIcon(THEME_ICON[themeMode], 22);
  }
  $('themeBtn').onclick = function () {
    themeMode = themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto';
    save('theme', themeMode); nightNow = null; checkTheme(); setThemeIcon();
    if (playerOpen) tick();
  };
  $('pClose').onclick = function () { openPlayer(false); };
  $('pClose').innerHTML = svgIcon('chevron-down', 24);
  setThemeIcon();
  var f = $('pFlip'); flipCards = [makeFlipCard(f)]; el('div', 'fcolon', f); flipCards.push(makeFlipCard(f));
  checkTheme();
  setInterval(tick, 1000);
  window.addEventListener('resize', function () {
    for (var i = 0; i < flipCards.length; i++) flipCards[i].flastW = 0;
    if (playerOpen) tick();
  });
  if (document.fonts && document.fonts.load) {
    document.fonts.load('600 64px Inter').then(function () {
      for (var i = 0; i < flipCards.length; i++) flipCards[i].flastW = 0;
      if (playerOpen) tick();
    }, function () {});
  }
  renderTabs();
  renderContent(false);
  refreshPlayer();
  window.RadioApp = {state: function () { return {tab: tab, cur: cur, playing: playing, loading: loading, track: track, night: nightNow, wantPlay: wantPlay, native: NATIVE}; }};
})();
