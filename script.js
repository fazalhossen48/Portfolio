/* =====================================================================
   script.js  |  Builds the page from content.json and runs all effects.
   Edit content in admin.html (or content.json directly). No frameworks.
   Parts: 1 helpers · 2 theme · 3 renderers · 4 YouTube · 5 modal & menu
          6 effects (cursor, reveal, parallax) · 7 mascot · 8 boot
   ===================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  /* ---------- 1. HELPERS ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var canHover = mq('(hover: hover)');
  var inPreview = window.parent !== window;           // true when shown inside admin.html

  var state = { content: null, sig: {}, order: '', ytDirty: false, mode: 'dark' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function memo(key, data, fn) {                       // re-render a block only when its data changed
    var s = JSON.stringify(data);
    if (state.sig[key] === s) return false;
    state.sig[key] = s; fn(); return true;
  }
  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);
  }
  function ytId(u) {
    if (!u) return '';
    u = String(u).trim();
    if (/^[\w-]{11}$/.test(u)) return u;
    var m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|embed\/|live\/|v\/|watch\?(?:[^#]*&)?v=))([\w-]{11})/);
    return m ? m[1] : '';
  }
  function ytSrc(id) {
    var s = 'https://www.youtube.com/embed/' + id + '?enablejsapi=1&rel=0&modestbranding=1&playsinline=1';
    if (/^https?:$/.test(location.protocol)) s += '&origin=' + encodeURIComponent(location.origin);
    return s;
  }
  function iframe(id, title) {
    return '<iframe class="yt" src="' + ytSrc(id) + '" title="' + esc(title) + '" loading="lazy" ' +
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
      'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
  }

  /* Inline SVG icons (24px grid). */
  var STROKE = {
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
    sparkles: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.8 0 4.5 1.9 4.5 4.5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6L20 18M8.6 16.4L20 6"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
    pen: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z"/><path d="M14 7l3 3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    call: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 005 5L15 12l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1"/>'
  };
  var FILL = {
    youtube: '<path d="M21.6 7.2a2.5 2.5 0 00-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 002.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 001.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 001.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z"/>',
    facebook: '<path d="M14 8.5V7c0-.6.4-1 1-1h2V3h-2.6C11.9 3 10 4.9 10 7.4V8.5H7.5V12H10v9h4v-9h2.7l.6-3.5z"/>',
    linkedin: '<path d="M4 9h4v11H4zM6 3.5a2.3 2.3 0 110 4.6 2.3 2.3 0 010-4.6zM10 9h3.8v1.6c.6-1 1.9-1.9 3.7-1.9 3.7 0 4.5 2.4 4.5 5.6V20h-4v-5.2c0-1.3 0-3-1.8-3s-2.2 1.4-2.2 2.9V20h-4z"/>',
    x: '<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.2 4.7H5.4z"/>',
    tiktok: '<path d="M16.5 3h-3v12.2a2.8 2.8 0 11-2.8-2.8c.3 0 .6 0 .8.1V9.3a5.9 5.9 0 105.9 5.9V9.1a7 7 0 004 1.3V7.4a4 4 0 01-4.9-4.4z"/>',
    github: '<path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.4 9.4 0 0112 6.84c.85 0 1.7.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.59.69.49A10.2 10.2 0 0022 12.25C22 6.58 17.52 2 12 2z"/>'
  };
  function icon(name, size, sw) {
    size = size || 24;
    if (FILL[name]) return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="currentColor" aria-hidden="true">' + FILL[name] + '</svg>';
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.7) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (STROKE[name] || STROKE.link) + '</svg>';
  }
  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^(https?:|mailto:|tel:|#|assets\/|\.\/)/i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(u)) return 'https://' + u;
    return '';
  }

  /* ---------- 2. THEME ---------- */
  var GOOGLE_FONTS = ['Inter', 'Inter Tight', 'Sora', 'Poppins', 'Outfit', 'Space Grotesk', 'DM Sans', 'Plus Jakarta Sans', 'Manrope', 'Montserrat'];
  function fontStack(name) {
    if (!name || /^helvetica/i.test(name)) return '"Helvetica Neue", Helvetica, Arial, sans-serif';
    return '"' + name + '", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
  }
  function loadFonts(names) {
    var fam = [];
    names.forEach(function (n) { if (GOOGLE_FONTS.indexOf(n) > -1 && fam.indexOf(n) < 0) fam.push(n); });
    if (fam.indexOf('Inter') < 0) fam.push('Inter');
    var href = 'https://fonts.googleapis.com/css2?' + fam.map(function (n) { return 'family=' + n.replace(/ /g, '+') + ':wght@400;500;600;700'; }).join('&') + '&display=swap';
    var link = $('#gf');
    if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);
  }
  function applyTheme(t) {
    t = t || {};
    var s = root.style;
    var a = hexToRgb(t.accent), a2 = hexToRgb(t.accent2);
    if (a) { s.setProperty('--accent', t.accent); s.setProperty('--accent-rgb', a); }
    if (a2) { s.setProperty('--accent-2', t.accent2); s.setProperty('--accent2-rgb', a2); }
    s.setProperty('--glow', String((t.glow == null ? 100 : t.glow) / 100));
    s.setProperty('--radius', (t.radius == null ? 24 : t.radius) + 'px');
    s.setProperty('--font-display', fontStack(t.fontDisplay));
    s.setProperty('--font-body', fontStack(t.fontBody || 'Inter'));
    loadFonts([t.fontDisplay, t.fontBody || 'Inter']);
    if (t.bg && hexToRgb(t.bg) && state.mode === 'dark') {
      s.setProperty('--black', t.bg);
      var m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', t.bg);
    } else {
      s.removeProperty('--black');
      var m2 = $('meta[name="theme-color"]'); if (m2) m2.setAttribute('content', state.mode === 'light' ? '#f4f7fc' : '#000000');
    }
  }
  function chooseMode(c) {
    var def = (c.theme && c.theme.defaultMode) || 'dark';
    var allowToggle = !c.theme || c.theme.themeToggle !== false;
    if (!allowToggle || inPreview) return def;
    try { var saved = localStorage.getItem('fhp-mode'); if (saved === 'light' || saved === 'dark') return saved; } catch (e) { /* storage may be blocked */ }
    return def;
  }
  function setMode(m, persist) {
    state.mode = m;
    root.setAttribute('data-theme', m);
    if (persist) { try { localStorage.setItem('fhp-mode', m); } catch (e) { /* ignore */ } }
    if (state.content) applyTheme(state.content.theme);
  }

  /* ---------- 3. RENDERERS ---------- */
  function setText(sel, txt) { var el = $(sel); if (el) el.textContent = txt == null ? '' : txt; }
  function secConf(c, id) { return (c.sections || []).filter(function (s) { return s.id === id; })[0] || { id: id, visible: true }; }

  function renderBrand(c) {
    var b = c.brand || {};
    setText('#logo', b.logoText || b.name);
    document.title = (b.name || '') + (b.role ? ' | ' + b.role : '');
  }

  function renderHero(c) {
    var h = c.hero || {};
    var tagWrap = $('#heroTagWrap');
    tagWrap.hidden = !(h.tagVisible !== false && h.tag);
    setText('#heroTag', h.tag);
    setText('#heroLine1', h.line1); setText('#heroLine2', h.line2);
    setText('#heroText', h.text);
    setText('#heroPrimary', h.primaryBtn || 'View My Work');
    setText('#heroGhost', h.ghostBtn || 'Book a Call');
    var img = $('#heroPortrait');
    if (h.portrait && img.getAttribute('src') !== h.portrait) img.setAttribute('src', h.portrait);
    if (h.portraitAlt) img.setAttribute('alt', h.portraitAlt);
    // stats (only real, filled-in ones)
    var stats = (h.stats || []).filter(function (s) { return s && s.number && s.label; });
    var sBox = $('#heroStats');
    sBox.hidden = !(h.statsVisible && stats.length);
    sBox.innerHTML = stats.map(function (s) {
      return '<div class="stat"><strong>' + esc(s.number) + (s.suffix ? '<em>' + esc(s.suffix) + '</em>' : '') + '</strong><span>' + esc(s.label) + '</span></div>';
    }).join('');
    // trust pill (only with real avatars + text)
    var av = (h.trustAvatars || []).filter(Boolean);
    var tBox = $('#heroTrust');
    tBox.hidden = !(h.trustVisible && h.trustText && av.length);
    tBox.innerHTML = '<span class="avatars">' + av.slice(0, 4).map(function (u) { return '<img src="' + esc(u) + '" alt="" width="34" height="34" loading="lazy">'; }).join('') + '</span><span>' + esc(h.trustText) + '</span>';
  }

  function renderMarquee(c) {
    var conf = secConf(c, 'marquee');
    var items = ((c.marquee && c.marquee.items) || []).filter(Boolean);
    var box = $('#marquee');
    box.hidden = !(conf.visible !== false && items.length);
    memo('marquee', items, function () {
      var group = '<div class="marquee-group">' + items.map(function (t) { return '<span class="marquee-item">' + esc(t) + '</span>'; }).join('') + '</div>';
      $('#marqueeTrack').innerHTML = group + group.replace('class="marquee-group"', 'class="marquee-group" aria-hidden="true"');
    });
  }

  function head(sec, conf, opts) {
    opts = opts || {};
    var eb = $('.eyebrow', sec), h2 = $('h2', sec), lead = $('.lead', sec);
    if (eb) eb.textContent = conf.eyebrow || '';
    if (h2 && !opts.skipTitle) h2.textContent = conf.title || '';
    if (lead && !opts.skipLead) lead.textContent = conf.text || '';
  }

  /* --- Showcase --- */
  function bodyShowcase(c, sec) {
    var id = ytId(c.showcase && c.showcase.url);
    var body = $('.sec-body', sec);
    if (!id) { body.innerHTML = ''; return false; }
    memo('showcase', id, function () {
      body.innerHTML = '<div class="video-frame-wrap reveal"><div class="video-frame">' + iframe(id, 'Showcase video') + '</div></div>';
      state.ytDirty = true;
    });
    return true;
  }

  /* --- Work --- */
  function bodyWork(c, sec) {
    var w = c.work || {};
    var shorts = (w.shorts || []).map(function (s) { return ytId(s.url); }).filter(Boolean);
    var vids = (w.videos || []).map(function (s) { return { id: ytId(s.url), title: s.title }; }).filter(function (v) { return v.id; });
    var body = $('.sec-body', sec);
    if (!shorts.length && !vids.length) { body.innerHTML = ''; return false; }
    memo('work', [shorts, vids, w.tabShorts, w.tabVideos], function () {
      var both = shorts.length && vids.length;
      var tabs = both
        ? '<div class="tabs-wrap reveal"><div class="tabs" role="tablist">' +
          '<button class="tab active" role="tab" aria-selected="true" data-tab="shorts" type="button">' + esc(w.tabShorts || 'Shorts') + '</button>' +
          '<button class="tab" role="tab" aria-selected="false" data-tab="videos" type="button">' + esc(w.tabVideos || 'Videos') + '</button></div></div>'
        : '';
      var shortsHtml = shorts.length
        ? '<div class="tab-panel" data-panel="shorts"><div class="shorts-wrap reveal">' +
          '<button class="arrow prev off" type="button" aria-label="Scroll shorts left"></button>' +
          '<div class="shorts" tabindex="0" aria-label="Short videos">' +
          shorts.map(function (id, i) { return '<div class="short-card">' + iframe(id, 'Short video ' + (i + 1)) + '</div>'; }).join('') +
          '</div><button class="arrow next off" type="button" aria-label="Scroll shorts right"></button></div></div>'
        : '';
      var videosHtml = vids.length
        ? '<div class="tab-panel" data-panel="videos"' + (shorts.length ? ' hidden' : '') + '><div class="video-grid reveal">' +
          vids.map(function (v, i) { return '<div class="video-card">' + iframe(v.id, v.title || 'Video ' + (i + 1)) + '</div>'; }).join('') +
          '</div></div>'
        : '';
      body.innerHTML = tabs + shortsHtml + videosHtml;
      // arrow icons (chevrons)
      var chevL = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
      var chevR = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
      var pv = $('.arrow.prev', body), nx = $('.arrow.next', body);
      if (pv) pv.innerHTML = chevL; if (nx) nx.innerHTML = chevR;
      state.ytDirty = true;
    });
    return true;
  }
  function updateArrows() {
    var row = $('.shorts'); if (!row) return;
    var pv = $('.arrow.prev'), nx = $('.arrow.next');
    var max = row.scrollWidth - row.clientWidth;
    var scrollable = max > 6;
    pv.classList.toggle('off', !scrollable || row.scrollLeft <= 4);
    nx.classList.toggle('off', !scrollable || row.scrollLeft >= max - 4);
  }

  /* --- Services & Process --- */
  function bodyServices(c, sec) {
    var items = (c.services && c.services.items) || [];
    var body = $('.sec-body', sec);
    if (!items.length) { body.innerHTML = ''; return false; }
    memo('services', items, function () {
      body.innerHTML = '<div class="grid-3">' + items.map(function (it, i) {
        return '<article class="card reveal" style="--d:' + (i % 3) * 0.08 + 's"><span class="num">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<div class="icon-box">' + icon(it.icon || 'film', 26) + '</div><h3>' + esc(it.title) + '</h3><p>' + esc(it.text) + '</p></article>';
      }).join('') + '</div>';
    });
    return true;
  }
  function bodyProcess(c, sec) {
    var items = (c.process && c.process.items) || [];
    var body = $('.sec-body', sec);
    if (!items.length) { body.innerHTML = ''; return false; }
    memo('process', items, function () {
      body.innerHTML = '<div class="grid-4">' + items.map(function (it, i) {
        return '<article class="card step reveal" style="--d:' + i * 0.08 + 's"><span class="step-no">Step ' + String(i + 1).padStart(2, '0') + '</span>' +
          '<div class="icon-box">' + icon(it.icon || 'check', 26) + '</div><h3>' + esc(it.title) + '</h3><p>' + esc(it.text) + '</p></article>';
      }).join('') + '</div>';
    });
    return true;
  }

  /* --- Testimonials (only real ones you add) --- */
  function bodyTestimonials(c, sec) {
    var items = ((c.testimonials && c.testimonials.items) || []).filter(function (t) { return t && (t.image || t.quote); });
    var body = $('.sec-body', sec);
    if (!items.length) { body.innerHTML = ''; return false; }
    memo('testimonials', items, function () {
      var group = '<div class="tm-group">' + items.map(function (t) {
        return t.image
          ? '<figure class="tm-card" style="margin:0"><img src="' + esc(t.image) + '" alt="' + esc(t.alt || 'Client feedback') + '" loading="lazy"></figure>'
          : '<figure class="tm-card text" style="margin:0"><p>&ldquo;' + esc(t.quote) + '&rdquo;</p><figcaption><strong>' + esc(t.name) + '</strong><span>' + esc(t.role) + '</span></figcaption></figure>';
      }).join('') + '</div>';
      body.innerHTML = '<div class="tm-row"><div class="tm-track">' + group + group + '</div></div>';
    });
    return true;
  }

  /* --- About --- */
  function bodyAbout(c, sec, conf) {
    var a = c.about || {};
    var body = $('.sec-body', sec);
    memo('about', [a, conf.title], function () {
      var tags = (a.tags || []).filter(Boolean).slice(0, 3);
      var socials = (a.socials || []).filter(function (s) { return safeUrl(s.url); });
      body.innerHTML = '<div class="about-grid">' +
        '<div class="about-photo reveal"><div class="about-frame"><img src="' + esc(a.photo) + '" alt="' + esc(a.photoAlt || '') + '" loading="lazy" width="1100" height="1466"></div>' +
        tags.map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="about-copy reveal" style="--d:.1s"><h2>' + esc(conf.title) + '</h2>' +
        (a.paragraphs || []).filter(Boolean).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        '<div class="pills">' + (a.skills || []).filter(Boolean).map(function (s) { return '<span class="pill">' + esc(s) + '</span>'; }).join('') + '</div>' +
        '<div class="socials">' + socials.map(function (s) {
          return '<a class="social" href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(s.label || s.icon) + '">' + icon(s.icon || 'link', 22) + '</a>';
        }).join('') + '</div></div></div>';
    });
    return true;
  }

  /* --- Contact --- */
  function bodyContact(c, sec, conf) {
    var k = c.contact || {};
    var body = $('.sec-body', sec);
    memo('contact', [k, conf], function () {
      var lines = '';
      if (k.email) lines += '<div class="contact-line"><span class="ico">' + icon('mail', 18) + '</span><a href="mailto:' + esc(k.email) + '">' + esc(k.email) + '</a></div>';
      if (k.phone) lines += '<div class="contact-line"><span class="ico">' + icon('call', 18) + '</span><a href="tel:' + esc(k.phone) + '">' + esc(k.phoneDisplay || k.phone) + '</a></div>';
      body.innerHTML = '<div class="contact-card reveal"><span class="eyebrow">' + esc(conf.eyebrow) + '</span><h2>' + esc(conf.title) + '</h2>' +
        (conf.text ? '<p class="lead">' + esc(conf.text) + '</p>' : '') +
        '<button class="btn btn-primary" type="button" data-book-call>' + esc(k.bookBtn || 'Book a Call') + '</button>' +
        (lines ? '<div class="contact-lines">' + lines + '</div>' : '') + '</div>';
    });
    return true;
  }

  var BODY = { showcase: bodyShowcase, work: bodyWork, services: bodyServices, process: bodyProcess, testimonials: bodyTestimonials, about: bodyAbout, contact: bodyContact };

  function renderSections(c) {
    var confs = (c.sections || []).filter(function (s) { return s.id !== 'marquee' && BODY[s.id]; });
    var order = confs.map(function (s) { return s.id; }).join(',');
    var main = $('#main');
    if (order !== state.order) {                       // reorder DOM only when the order changed (moving reloads iframes)
      confs.forEach(function (s) { var el = document.getElementById(s.id); if (el) main.appendChild(el); });
      state.order = order;
    }
    confs.forEach(function (conf) {
      var sec = document.getElementById(conf.id); if (!sec) return;
      var show = conf.visible !== false;
      if (show) {
        if (conf.id === 'about') head(sec, conf, { skipTitle: true, skipLead: true });
        else if (conf.id !== 'contact') head(sec, conf);
        show = BODY[conf.id](c, sec, conf) !== false;
      }
      sec.hidden = !show;
    });
  }

  function renderNav(c) {
    var links = (c.sections || []).filter(function (s) { return s.visible !== false && s.nav && BODY[s.id]; });
    memo('nav', links.map(function (s) { return [s.id, s.nav]; }), function () {
      var html = links.map(function (s) { return '<a href="#' + s.id + '">' + esc(s.nav) + '</a>'; }).join('');
      $('#navLinks').innerHTML = html; $('#mobileLinks').innerHTML = html;
    });
  }

  function renderFooter(c) {
    var f = c.footer || {}, b = c.brand || {};
    setText('#footName', b.name); setText('#footTag', f.tagline);
    setText('#footCopy', String(f.copyright || '').replace('{year}', new Date().getFullYear()));
    var socials = ((c.about && c.about.socials) || []).filter(function (s) { return safeUrl(s.url); });
    memo('footsoc', socials, function () {
      $('#footSocials').innerHTML = socials.map(function (s) {
        return '<a class="social" href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(s.label || s.icon) + '">' + icon(s.icon || 'link', 18) + '</a>';
      }).join('');
    });
  }

  function renderBooking(c) {
    var b = c.booking || {}, k = c.contact || {};
    setText('#bookTitle', b.title || 'Book a call');
    setText('#bookSub', b.subtitle);
    setText('#bookHint', b.hint);
    $('#sendWa').hidden = !k.whatsapp;
    $('#sendMs').hidden = !k.messenger;
    $('#sendIg').hidden = !k.instagramDm;
    var ta = $('#bookMsg'); if (ta && !ta.dataset.touched) ta.value = b.message || '';
  }

  function renderExtras(c) {
    var t = c.theme || {};
    $$('.js-theme-toggle').forEach(function (b) { b.hidden = t.themeToggle === false; });
    var m = $('#mascot');
    m.hidden = t.mascot === false;
    if (!m.hidden && !m.firstChild) buildMascot(m);
  }

  function render(c) {
    if (!c) return;
    var y = window.scrollY;
    state.content = c;
    state.mode = chooseMode(c);
    root.setAttribute('data-theme', state.mode);
    applyTheme(c.theme);
    renderBrand(c); renderHero(c); renderMarquee(c);
    renderSections(c); renderNav(c); renderFooter(c); renderBooking(c); renderExtras(c);
    afterRender();
    if (inPreview && y) window.scrollTo(0, y);
  }

  /* ---------- 4. YOUTUBE: only one video plays at a time ---------- */
  var yt = { players: [], loading: false };
  function pauseAll(except) {
    yt.players.forEach(function (p) { if (p !== except) { try { p.pauseVideo(); } catch (e) { /* not ready */ } } });
  }
  function initPlayers() {
    if (!(window.YT && window.YT.Player)) return;
    yt.players = [];
    $$('iframe.yt').forEach(function (f) {
      try {
        var p = new window.YT.Player(f, { events: { onStateChange: function (e) { if (e.data === window.YT.PlayerState.PLAYING) pauseAll(e.target); } } });
        yt.players.push(p);
      } catch (e) { /* ignore */ }
    });
  }
  function loadYouTubeAPI() {
    if (yt.loading || (window.YT && window.YT.Player)) return;
    yt.loading = true;
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () { if (prev) prev(); initPlayers(); };
    var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    document.head.appendChild(s);
  }

  /* ---------- 5. TABS, ARROWS, MODAL, MENU ---------- */
  function afterRender() {
    observeReveal();
    if (state.ytDirty) {
      state.ytDirty = false;
      if (window.YT && window.YT.Player) initPlayers(); else setTimeout(loadYouTubeAPI, inPreview ? 800 : 1200);
    }
    updateArrows();
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var tab = t.closest && t.closest('.tab');
    if (tab) {                                           // Shorts / Videos toggle
      var name = tab.getAttribute('data-tab');
      $$('.tab').forEach(function (b) { var on = b === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      $$('.tab-panel').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
      pauseAll(); updateArrows();
      return;
    }
    var arrow = t.closest && t.closest('.arrow');
    if (arrow) {
      var row = $('.shorts');
      row.scrollBy({ left: (arrow.classList.contains('prev') ? -1 : 1) * row.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    var book = t.closest && t.closest('[data-book-call]');
    if (book) { e.preventDefault(); openModal(); return; }
    if (t.closest && t.closest('.js-theme-toggle')) { setMode(state.mode === 'dark' ? 'light' : 'dark', true); return; }
    if (t.closest && t.closest('#mobileLinks a')) closeMenu();
  });
  document.addEventListener('scroll', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('shorts')) updateArrows();
  }, true);

  /* Mobile menu */
  var burger = $('#burger'), menu = $('#mobileMenu');
  function openMenu() { menu.classList.add('open'); menu.setAttribute('aria-hidden', 'false'); burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu'); document.body.classList.add('menu-open'); }
  function closeMenu() { menu.classList.remove('open'); menu.setAttribute('aria-hidden', 'true'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu'); document.body.classList.remove('menu-open'); }
  burger.addEventListener('click', function () { menu.classList.contains('open') ? closeMenu() : openMenu(); });

  /* Booking modal */
  var modal = $('#bookModal'), lastFocus = null;
  function openModal() {
    lastFocus = document.activeElement;
    closeMenu();
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(function () { $('#bookMsg').focus(); }, 60);
  }
  function closeModal() {
    modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('#bookClose').addEventListener('click', closeModal);
  modal.addEventListener('mousedown', function (e) { if (e.target === modal) closeModal(); });
  $('#bookMsg').addEventListener('input', function () { this.dataset.touched = '1'; });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (modal.classList.contains('open')) closeModal(); closeMenu(); }
    if (e.key === 'Tab' && modal.classList.contains('open')) {          // keep focus inside the dialog
      var f = $$('button:not([hidden]), textarea', modal).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).catch(function () { legacyCopy(txt); });
    legacyCopy(txt); return Promise.resolve();
  }
  function legacyCopy(txt) {
    var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }
  function sendVia(btn) {
    var k = (state.content && state.content.contact) || {};
    var msg = $('#bookMsg').value.trim();
    var ch = btn.getAttribute('data-ch');
    if (ch === 'whatsapp') {
      window.open('https://wa.me/' + encodeURIComponent(k.whatsapp) + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      return;
    }
    var link = ch === 'messenger' ? k.messenger : k.instagramDm;           // these cannot prefill text, so copy it
    copyText(msg);
    var label = $('span', btn), old = label.textContent;
    label.textContent = 'Message copied, paste it and send';
    setTimeout(function () { label.textContent = old; }, 3200);
    window.open(safeUrl(link), '_blank', 'noopener');
  }
  $$('.btn-channel').forEach(function (b) { b.addEventListener('click', function () { sendVia(b); }); });

  /* ---------- 6. EFFECTS ---------- */
  // Nav background + back-to-top
  var nav = $('#nav'), toTop = $('#toTop');
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 30);
    toTop.classList.toggle('show', window.scrollY > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  window.addEventListener('resize', updateArrows);

  // Scroll reveal
  var io = null;
  function observeReveal() {
    var els = $$('.reveal:not(.in)');
    if (!els.length) return;
    if (reduce || inPreview || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    if (!io) io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  // Liquid cursor
  (function () {
    if (!canHover || reduce) return;
    var el = $('.cursor'); if (!el) return;
    var tx = -100, ty = -100, x = -100, y = -100, s = 1, sv = 0, target = 1, started = false;
    var HOT = 'h1,h2,h3,h4,h5,h6,p,a,button,li,label,span,input,textarea,.btn,.chip,.pill';
    window.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!started) { started = true; x = tx; y = ty; el.classList.add('on'); }
    }, { passive: true });
    document.addEventListener('mouseover', function (e) {
      var hot = !!(e.target.closest && e.target.closest(HOT));
      target = hot ? 2.4 : 1; el.classList.toggle('big', hot);
    });
    root.addEventListener('mouseleave', function () { el.classList.remove('on'); started = false; });
    (function frame() {
      x += (tx - x) * 0.14; y += (ty - y) * 0.14;
      var dx = tx - x, dy = ty - y, speed = Math.sqrt(dx * dx + dy * dy);
      var ang = Math.atan2(dy, dx) * 180 / Math.PI;
      var st = Math.min(speed * 0.04, 0.8);
      sv += (target - s) * 0.18; sv *= 0.72; s += sv;          // spring with overshoot
      el.style.transform = 'translate3d(' + (x - 11) + 'px,' + (y - 11) + 'px,0) rotate(' + ang + 'deg) scale(' + ((1 + st) * s) + ',' + (s / (1 + st * 0.6)) + ')';
      requestAnimationFrame(frame);
    })();
  })();

  // Hero portrait parallax
  (function () {
    if (!canHover || reduce) return;
    var hero = $('#hero'), p = $('#heroParallax');
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      p.style.setProperty('--px', (nx * -22).toFixed(1) + 'px');
      p.style.setProperty('--py', (ny * -14).toFixed(1) + 'px');
    }, { passive: true });
    hero.addEventListener('mouseleave', function () { p.style.setProperty('--px', '0px'); p.style.setProperty('--py', '0px'); });
  })();

  /* ---------- 7. SLEEPY MASCOT (original character) ---------- */
  function buildMascot(m) {
    m.innerHTML =
      '<svg viewBox="0 0 200 200" aria-hidden="true">' +
      '<defs><linearGradient id="mgB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent-2)"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient></defs>' +
      '<ellipse cx="100" cy="188" rx="64" ry="7" fill="#000" opacity=".28"/>' +
      '<g class="m-body"><path d="M42 160C42 98 68 58 100 58s58 40 58 102z" fill="url(#mgB)"/>' +
      '<path d="M58 108C58 80 76 62 100 62s42 18 42 46" fill="none" stroke="#0a1020" stroke-width="7" stroke-linecap="round"/>' +
      '<rect x="48" y="98" width="15" height="28" rx="7.5" fill="#0a1020"/><rect x="137" y="98" width="15" height="28" rx="7.5" fill="#0a1020"/>' +
      '<rect x="52" y="104" width="7" height="16" rx="3.5" style="fill:var(--accent-2)"/><rect x="141" y="104" width="7" height="16" rx="3.5" style="fill:var(--accent-2)"/>' +
      '<g class="eye-closed"><path d="M76 98q8 7 16 0M108 98q8 7 16 0" fill="none" stroke="#0a1020" stroke-width="3.6" stroke-linecap="round"/></g>' +
      '<g class="eye-open"><circle cx="84" cy="97" r="6.5" fill="#0a1020"/><circle cx="116" cy="97" r="6.5" fill="#0a1020"/><circle cx="86" cy="95" r="2.2" fill="#fff"/><circle cx="118" cy="95" r="2.2" fill="#fff"/></g>' +
      '<ellipse class="mouth-asleep" cx="100" cy="114" rx="3.6" ry="2.6" fill="#0a1020" opacity=".8"/>' +
      '<path class="mouth-awake" d="M91 110q9 9 18 0" fill="none" stroke="#0a1020" stroke-width="3.4" stroke-linecap="round"/>' +
      '<circle cx="72" cy="110" r="5" fill="#fff" opacity=".22"/><circle cx="128" cy="110" r="5" fill="#fff" opacity=".22"/></g>' +
      '<path d="M36 170h128l10 14H26z" fill="#141b2d" stroke-width="1.5" style="stroke:var(--accent-2)"/>' +
      '<g class="m-lid"><rect x="50" y="118" width="100" height="52" rx="7" fill="#090e1b" stroke-width="2" style="stroke:var(--accent)"/>' +
      '<g class="m-screen"><rect x="58" y="128" width="84" height="6" rx="3" style="fill:var(--accent)" opacity=".9"/><rect x="58" y="138" width="52" height="6" rx="3" style="fill:var(--accent-2)" opacity=".9"/>' +
      '<rect x="92" y="138" width="40" height="6" rx="3" style="fill:var(--accent)" opacity=".55"/><rect x="58" y="148" width="30" height="6" rx="3" style="fill:var(--accent-2)" opacity=".7"/>' +
      '<rect x="64" y="148" width="62" height="6" rx="3" fill="#fff" opacity=".12"/><rect x="58" y="158" width="84" height="3" rx="1.5" fill="#fff" opacity=".18"/>' +
      '<rect class="m-play" x="58" y="124" width="2.5" height="40" rx="1" fill="#fff"/></g></g>' +
      '<circle class="m-hand l" cx="78" cy="168" r="8" fill="#bfeaff"/><circle class="m-hand r" cx="122" cy="168" r="8" fill="#bfeaff"/>' +
      '<g class="m-z"><text x="132" y="62" font-size="18">Z</text><text x="146" y="48" font-size="14">z</text><text x="156" y="36" font-size="11">z</text></g></svg>';
    var wake = null, dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    function awake(on) { m.classList.toggle('awake', on); }
    m.addEventListener('mouseenter', function () { clearTimeout(wake); awake(true); });
    m.addEventListener('mouseleave', function () { if (!dragging) wake = setTimeout(function () { awake(false); }, 1400); });
    m.addEventListener('pointerdown', function (e) {
      dragging = true; m.classList.add('drag'); awake(true);
      var r = m.getBoundingClientRect(); ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
      m.style.left = ox + 'px'; m.style.top = oy + 'px'; m.style.bottom = 'auto';
      try { m.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    m.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var w = m.offsetWidth, h = m.offsetHeight;
      var nx = Math.max(0, Math.min(window.innerWidth - w, ox + e.clientX - sx));
      var ny = Math.max(0, Math.min(window.innerHeight - h, oy + e.clientY - sy));
      m.style.left = nx + 'px'; m.style.top = ny + 'px';
    });
    function end() { if (!dragging) return; dragging = false; m.classList.remove('drag'); wake = setTimeout(function () { awake(false); }, 2200); }
    m.addEventListener('pointerup', end); m.addEventListener('pointercancel', end);
    window.addEventListener('resize', function () {
      if (!m.style.left) return;
      var r = m.getBoundingClientRect();
      m.style.left = Math.max(0, Math.min(window.innerWidth - r.width, r.left)) + 'px';
      m.style.top = Math.max(0, Math.min(window.innerHeight - r.height, r.top)) + 'px';
    });
  }

  /* ---------- 8. BOOT ---------- */
  function load() {
    fetch('content.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('content.json ' + r.status); return r.json(); })
      .then(render)
      .catch(function (err) {
        if (window.console) console.warn('Could not load content.json, using the built-in copy:', err.message);
        if (window.FHP_CONTENT) render(window.FHP_CONTENT);
      });
  }
  if (inPreview) {
    // admin.html sends the draft here for the live preview
    window.addEventListener('message', function (ev) {
      if (ev.source !== window.parent || ev.origin !== location.origin) return;
      var d = ev.data;
      if (d && d.type === 'fhp-preview' && d.content) render(d.content);
    });
    try { window.parent.postMessage({ type: 'fhp-ready' }, '*'); } catch (e) { /* ignore */ }
  }
  onScroll();
  load();
})();
