/* =====================================================================
   admin.js  |  Edit the website without touching code.
   How it works: this page edits a copy of content.json in your browser,
   shows a live preview, and exports a new content.json for you to upload
   to GitHub. (A static site cannot save files by itself.)
   ===================================================================== */
(function () {
  'use strict';

  /* ---- Password gate (light lock; the real protection is that only you can publish) ----
     To change the password: use "Change password" in the Export tab, then paste the new hash below. */
  var PASS_SALT = 'fhp-admin-v1';
  var PASS_HASH = '2860d58d5a9df99edfab6de2cf814497b00c816db5168618c9208f61017677f7';

  var DRAFT_KEY = 'fhp-admin-draft-v1';
  var AUTH_KEY = 'fhp-admin-auth';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- SHA-256 (Web Crypto, with a plain-JS fallback for non-secure pages) ---------- */
  function sha256Fallback(str) {
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(str));
    var primes = [];
    for (var n = 2; primes.length < 64; n++) { if (primes.every(function (p) { return n % p; })) primes.push(n); }
    var frac = function (x) { return Math.floor((x - Math.floor(x)) * 4294967296); };
    var K = primes.map(function (p) { return frac(Math.cbrt(p)); });
    var H = primes.slice(0, 8).map(function (p) { return frac(Math.sqrt(p)); });
    var bits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(0, 0, 0, 0);
    for (var i = 3; i >= 0; i--) bytes.push((bits >>> (i * 8)) & 255);
    var rr = function (x, k) { return (x >>> k) | (x << (32 - k)); };
    for (var o = 0; o < bytes.length; o += 64) {
      var w = new Array(64), j;
      for (j = 0; j < 16; j++) w[j] = (bytes[o + 4 * j] << 24) | (bytes[o + 4 * j + 1] << 16) | (bytes[o + 4 * j + 2] << 8) | bytes[o + 4 * j + 3];
      for (j = 16; j < 64; j++) {
        var s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      var v = [a, b, c, d, e, f, g, h];
      for (j = 0; j < 8; j++) H[j] = (H[j] + v[j]) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }
  function sha256Hex(str) {
    if (window.crypto && crypto.subtle) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      }).catch(function () { return sha256Fallback(str); });
    }
    return Promise.resolve(sha256Fallback(str));
  }
  function hashPw(pw) { return sha256Hex(PASS_SALT + ':' + pw); }

  /* ---------- Gate ---------- */
  var fails = 0, lockUntil = 0;
  function unlock() { $('#gate').hidden = true; $('#app').hidden = false; try { sessionStorage.setItem(AUTH_KEY, PASS_HASH); } catch (e) { /* ignore */ } boot(); }
  $('#gateForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var err = $('#gateErr');
    if (Date.now() < lockUntil) { err.textContent = 'Too many tries. Wait ' + Math.ceil((lockUntil - Date.now()) / 1000) + ' seconds.'; return; }
    hashPw($('#gatePw').value).then(function (h) {
      if (h === PASS_HASH) { err.textContent = ''; unlock(); return; }
      fails++; err.textContent = 'Wrong password.';
      var card = $('#gateForm'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      if (fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; }
      $('#gatePw').select();
    });
  });
  $('#btnLock').addEventListener('click', function () { try { sessionStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ } location.reload(); });
  try { if (sessionStorage.getItem(AUTH_KEY) === PASS_HASH) unlock(); } catch (e) { /* ignore */ }

  /* ---------- Data helpers ---------- */
  var data = null, published = '', publishedObj = null, saveTimer = null, pvTimer = null, pvReady = false;
  var openKeys = {};

  function get(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function set(o, p, v) {
    var ks = p.split('.'), c = o;
    for (var i = 0; i < ks.length - 1; i++) {
      if (c[ks[i]] == null) c[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      c = c[ks[i]];
    }
    c[ks[ks.length - 1]] = v;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------- Field builders ---------- */
  var T = function (path, label, o) { return Object.assign({ t: 'text', path: path, label: label }, o); };
  var A = function (path, label, o) { return Object.assign({ t: 'area', path: path, label: label }, o); };
  var TG = function (path, label, o) { return Object.assign({ t: 'toggle', path: path, label: label }, o); };
  var IMG = function (path, label, o) { return Object.assign({ t: 'image', path: path, label: label }, o); };
  var SEL = function (path, label, options, o) { return Object.assign({ t: 'select', path: path, label: label, options: options }, o); };
  var STR = function (path, label, o) { return Object.assign({ t: 'strings', path: path, label: label }, o); };
  var LIST = function (path, label, o) { return Object.assign({ t: 'list', path: path, label: label }, o); };
  var COL = function (path, label, o) { return Object.assign({ t: 'color', path: path, label: label }, o); };
  var RNG = function (path, label, o) { return Object.assign({ t: 'range', path: path, label: label }, o); };

  var ICONS = ['film', 'phone', 'cap', 'target', 'sparkles', 'users', 'chat', 'layout', 'scissors', 'play', 'check', 'bulb', 'pen'];
  var SOCIAL = ['youtube', 'instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'github', 'link'];
  var FONTS = ['Helvetica', 'Inter', 'Inter Tight', 'Sora', 'Poppins', 'Outfit', 'Space Grotesk', 'DM Sans', 'Plus Jakarta Sans', 'Manrope', 'Montserrat'];
  var SEC_NAMES = { marquee: 'Highlights strip', showcase: 'Showcase', work: 'Work', services: 'Services', process: 'Process', testimonials: 'Testimonials', about: 'About', contact: 'Contact' };
  var PRESETS = [
    { name: 'Cyan + Blue', a: '#2f6bff', b: '#22d3ee' },
    { name: 'Red', a: '#e8141c', b: '#ff6a70' },
    { name: 'Violet', a: '#8b5cf6', b: '#c4b5fd' },
    { name: 'Emerald', a: '#10b981', b: '#6ee7b7' },
    { name: 'Amber', a: '#f59e0b', b: '#fcd34d' },
    { name: 'Rose', a: '#ec4899', b: '#f9a8d4' }
  ];

  var PANELS = [
    { id: 'identity', label: 'Identity', sub: 'Your name, profession and footer text.', fields: [
      T('brand.name', 'Full name / brand'),
      T('brand.role', 'Profession (one line)', { hint: 'Used in the browser tab title.' }),
      T('brand.logoText', 'Nav logo text'),
      T('footer.tagline', 'Footer tagline'),
      T('footer.copyright', 'Copyright line', { hint: 'Write {year} where the current year should appear.' })
    ] },
    { id: 'theme', label: 'Theme & colors', sub: 'Colors, fonts, glow and light/dark behaviour.', custom: themePanel },
    { id: 'sections', label: 'Section structure', sub: 'Reorder, hide and rename sections.', custom: sectionsPanel },
    { id: 'hero', label: 'Hero', sub: 'The first screen visitors see.', fields: [
      TG('hero.tagVisible', 'Show the small pill above the headline'),
      T('hero.tag', 'Pill text'),
      T('hero.line1', 'Headline, line 1'),
      T('hero.line2', 'Headline, line 2 (highlighted)'),
      A('hero.text', 'Paragraph'),
      T('hero.primaryBtn', 'Main button text'),
      T('hero.ghostBtn', 'Second button text (opens booking)'),
      IMG('hero.portrait', 'Portrait photo', { hint: 'A transparent PNG/WebP cut-out looks best.' }),
      T('hero.portraitAlt', 'Portrait alt text'),
      { t: 'group', title: 'Stats row', text: 'Only rows with both a number and a label are shown. Use real numbers only.' },
      TG('hero.statsVisible', 'Show the stats row'),
      LIST('hero.stats', 'Stats', { fixed: true, titleKey: 'label', fields: [T('number', 'Number (e.g. 50)'), T('suffix', 'Suffix (e.g. + or %)'), T('label', 'Label')] }),
      { t: 'group', title: 'Trust pill', text: 'Needs a real number/text and up to 4 avatar photos of people who agreed to appear.' },
      TG('hero.trustVisible', 'Show the trust pill'),
      T('hero.trustText', 'Text (e.g. Trusted by N creators)'),
      STR('hero.trustAvatars', 'Avatar image paths', { max: 4, add: 'Add avatar' })
    ] },
    { id: 'marquee', label: 'Highlights strip', sub: 'The slowly scrolling phrases under the hero.', fields: [
      STR('marquee.items', 'Phrases', { add: 'Add phrase' })
    ] },
    { id: 'showcase', label: 'Showcase video', sub: 'One large featured video.', fields: [
      T('showcase.url', 'YouTube link', { hint: 'Any normal YouTube link works. Leave empty to hide the section.' })
    ] },
    { id: 'work', label: 'Work (videos)', sub: 'Shorts in a swipeable row, long videos in a grid.', fields: [
      T('work.tabShorts', 'Shorts tab label'),
      T('work.tabVideos', 'Videos tab label'),
      { t: 'group', title: 'Shorts', text: 'Newest first.' },
      LIST('work.shorts', 'Shorts', { titleKey: 'url', add: 'Add short', fields: [T('url', 'YouTube Shorts link')], blank: { url: '' } }),
      { t: 'group', title: 'Long videos', text: 'If you add none, the Videos tab stays hidden.' },
      LIST('work.videos', 'Videos', { titleKey: 'title', add: 'Add video', fields: [T('url', 'YouTube link'), T('title', 'Title (for screen readers)')], blank: { url: '', title: '' } })
    ] },
    { id: 'services', label: 'Services', sub: 'Cards in the "What I do best" section.', fields: [
      LIST('services.items', 'Services', { titleKey: 'title', add: 'Add service', blank: { icon: 'film', title: 'New service', text: '' },
        fields: [SEL('icon', 'Icon', ICONS), T('title', 'Title'), A('text', 'One sentence', { rows: 3 })] })
    ] },
    { id: 'process', label: 'Process', sub: 'The step-by-step cards.', fields: [
      LIST('process.items', 'Steps', { titleKey: 'title', add: 'Add step', blank: { icon: 'check', title: 'New step', text: '' },
        fields: [SEL('icon', 'Icon', ICONS), T('title', 'Title'), A('text', 'One sentence', { rows: 3 })] })
    ] },
    { id: 'testimonials', label: 'Testimonials', sub: 'Only add real feedback you have permission to show. Then turn the section on in Section structure.', fields: [
      LIST('testimonials.items', 'Testimonials', { titleKey: 'name', add: 'Add testimonial', blank: { image: '', alt: '', quote: '', name: '', role: '' },
        fields: [IMG('image', 'Screenshot / image (optional)'), T('alt', 'Image description'), A('quote', 'Or quote text', { rows: 3 }), T('name', 'Name'), T('role', 'Role')] })
    ] },
    { id: 'about', label: 'About', sub: 'Your story, skills and social links.', fields: [
      IMG('about.photo', 'About photo'),
      T('about.photoAlt', 'Photo alt text'),
      STR('about.paragraphs', 'Paragraphs', { area: true, add: 'Add paragraph' }),
      STR('about.skills', 'Skill pills', { add: 'Add skill' }),
      STR('about.tags', 'Floating photo tags (max 3)', { max: 3, add: 'Add tag' }),
      LIST('about.socials', 'Social links', { titleKey: 'label', add: 'Add social link', blank: { label: '', icon: 'link', url: '' },
        fields: [T('label', 'Name'), SEL('icon', 'Icon', SOCIAL), T('url', 'Link (https://...)')] })
    ] },
    { id: 'contact', label: 'Contact & booking', sub: 'How people reach you and what the booking box says.', fields: [
      T('contact.bookBtn', 'Contact button text'),
      T('contact.email', 'Email'),
      T('contact.phone', 'Phone (for tap-to-call)', { hint: 'Include the country code, e.g. +8801612441826' }),
      T('contact.phoneDisplay', 'Phone as shown on the page'),
      T('contact.whatsapp', 'WhatsApp number', { hint: 'Country code, no + and no leading 0, e.g. 8801612441826' }),
      T('contact.messenger', 'Messenger link (optional)', { hint: 'Format m.me/yourname. Leave empty to hide the button.' }),
      T('contact.instagramDm', 'Instagram DM link (optional)', { hint: 'Format ig.me/m/yourusername. Leave empty to hide the button.' }),
      { t: 'group', title: 'Booking box' },
      T('booking.title', 'Title'),
      A('booking.subtitle', 'Subtitle', { rows: 2 }),
      A('booking.message', 'Default message', { rows: 4 }),
      T('booking.hint', 'Small hint under the buttons')
    ] },
    { id: 'export', label: 'Publish', sub: 'Export your changes and put them live.', custom: exportPanel }
  ];

  /* ---------- Rendering the form ---------- */
  var current = 'identity';
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return el;
  }
  function full(base, p) { return base ? base + '.' + p : p; }

  function renderFields(box, fields, base) {
    fields.forEach(function (f) { box.appendChild(renderField(f, base)); });
  }
  function renderField(f, base) {
    var path = f.path ? full(base, f.path) : '';
    var val = path ? get(data, path) : null;
    var wrap, input;
    switch (f.t) {
      case 'group':
        return h('div', { class: 'group' }, h('h3', { text: f.title }), f.text ? h('p', { text: f.text }) : null);
      case 'text':
        input = h('input', { type: 'text', value: val == null ? '' : val, oninput: function () { change(path, input.value); } });
        input.value = val == null ? '' : val;
        return h('label', { class: 'f' }, h('span', { text: f.label }), input, f.hint ? h('small', { class: 'hint', text: f.hint }) : null);
      case 'area':
        input = h('textarea', { rows: f.rows || 4, oninput: function () { change(path, input.value); } });
        input.value = val == null ? '' : val;
        return h('label', { class: 'f' }, h('span', { text: f.label }), input, f.hint ? h('small', { class: 'hint', text: f.hint }) : null);
      case 'select':
        input = h('select', { onchange: function () { change(path, input.value); } });
        f.options.forEach(function (o) { var op = h('option', { value: o, text: o }); if (o === val) op.selected = true; input.appendChild(op); });
        return h('label', { class: 'f' }, h('span', { text: f.label }), input);
      case 'toggle':
        input = h('input', { type: 'checkbox', onchange: function () { change(path, input.checked); } });
        input.checked = !!val;
        return h('label', { class: 'toggle' }, h('span', {}, h('b', { text: f.label }), f.hint ? h('small', { text: f.hint }) : null), input, h('span', { class: 'sw' }));
      case 'color':
        return colorField(f, path, val);
      case 'range':
        return rangeField(f, path, val);
      case 'image':
        return imageField(f, path, val);
      case 'strings':
        return stringsField(f, path);
      case 'list':
        return listField(f, path);
    }
    return h('div');
  }

  function colorField(f, path, val) {
    var pick = h('input', { type: 'color' }), txt = h('input', { type: 'text', maxlength: 7 });
    pick.value = /^#[0-9a-f]{6}$/i.test(val) ? val : '#000000'; txt.value = val || '';
    pick.addEventListener('input', function () { txt.value = pick.value; change(path, pick.value); });
    txt.addEventListener('input', function () { if (/^#[0-9a-f]{6}$/i.test(txt.value)) { pick.value = txt.value; change(path, txt.value); } });
    return h('div', { class: 'f color-row' }, h('span', { text: f.label }), h('div', { class: 'row' }, pick, txt), f.hint ? h('small', { class: 'hint', text: f.hint }) : null);
  }
  function rangeField(f, path, val) {
    var r = h('input', { type: 'range', min: f.min, max: f.max, step: f.step || 1 }), out = h('output');
    r.value = val == null ? f.min : val;
    var show = function () { out.textContent = r.value + (f.unit || ''); }; show();
    r.addEventListener('input', function () { show(); change(path, Number(r.value)); });
    return h('div', { class: 'f range-row' }, h('span', { text: f.label }), h('div', { class: 'row' }, r, out), f.hint ? h('small', { class: 'hint', text: f.hint }) : null);
  }

  /* Image field: type a path (best) or embed a compressed copy right here */
  function imageField(f, path, val) {
    var thumb = h('div', { class: 'thumb' });
    var txt = h('input', { type: 'text', placeholder: 'assets/photo.webp' });
    var file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    var note = h('small', { class: 'hint' });
    function paint() {
      var v = get(data, path) || '';
      var embedded = /^data:/.test(v);
      txt.value = embedded ? '' : v; txt.placeholder = embedded ? 'Embedded image (' + Math.round(v.length * 0.75 / 1024) + ' KB)' : 'assets/photo.webp';
      thumb.style.backgroundImage = v ? 'url("' + v.replace(/"/g, '%22') + '")' : 'none';
      note.textContent = f.hint || 'Best: upload the file into the assets/ folder on GitHub and type its path here. Or press Upload to embed a compressed copy.';
    }
    txt.addEventListener('input', function () { change(path, txt.value.trim(), true); thumb.style.backgroundImage = txt.value ? 'url("' + txt.value + '")' : 'none'; });
    file.addEventListener('change', function () {
      var fl = file.files[0]; if (!fl) return;
      var img = new Image(), url = URL.createObjectURL(fl);
      img.onload = function () {
        var max = 1400, sc = Math.min(1, max / Math.max(img.width, img.height));
        var cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        var out = cv.toDataURL('image/webp', 0.86);
        if (!/^data:image\/webp/.test(out)) out = cv.toDataURL('image/jpeg', 0.86);
        URL.revokeObjectURL(url);
        change(path, out, true); paint();
        toast('Image embedded (' + Math.round(out.length * 0.75 / 1024) + ' KB). Smaller files load faster.');
      };
      img.onerror = function () { toast('Could not read that image.'); };
      img.src = url;
    });
    var clear = h('button', { class: 'a-btn ghost small', type: 'button', text: 'Clear', onclick: function () { change(path, '', true); paint(); } });
    var up = h('button', { class: 'a-btn ghost small', type: 'button', text: 'Upload', onclick: function () { file.click(); } });
    paint();
    return h('div', { class: 'f img-field' }, h('span', { text: f.label }),
      h('div', { class: 'row' }, thumb, h('div', { class: 'col' }, txt, h('div', { class: 'row' }, up, clear, file))), note);
  }

  function stringsField(f, path) {
    var box = h('div', { class: 'f' }, h('span', { text: f.label }));
    var list = h('div', { class: 'strings' }); box.appendChild(list);
    var arr = get(data, path); if (!Array.isArray(arr)) { arr = []; set(data, path, arr); }
    function paint() {
      list.innerHTML = '';
      arr.forEach(function (v, i) {
        var inp = f.area ? h('textarea', { rows: 4 }) : h('input', { type: 'text' });
        inp.value = v; inp.addEventListener('input', function () { arr[i] = inp.value; change(path, arr, true); });
        var up = h('button', { class: 'ib', type: 'button', text: '↑', title: 'Move up', 'aria-label': 'Move up', onclick: function () { move(arr, i, -1); change(path, arr, true); paint(); } });
        var dn = h('button', { class: 'ib', type: 'button', text: '↓', title: 'Move down', 'aria-label': 'Move down', onclick: function () { move(arr, i, 1); change(path, arr, true); paint(); } });
        var del = h('button', { class: 'ib del', type: 'button', text: '✕', title: 'Remove', 'aria-label': 'Remove', onclick: function () { arr.splice(i, 1); change(path, arr, true); paint(); } });
        up.disabled = i === 0; dn.disabled = i === arr.length - 1;
        list.appendChild(h('div', { class: 'srow' }, inp, up, dn, del));
      });
      addBtn.hidden = !!(f.max && arr.length >= f.max);
    }
    var addBtn = h('button', { class: 'add', type: 'button', text: '+ ' + (f.add || 'Add'), onclick: function () { arr.push(''); change(path, arr, true); paint(); var l = list.lastChild; if (l) l.querySelector('input,textarea').focus(); } });
    box.appendChild(addBtn); paint();
    return box;
  }

  function move(arr, i, d) { var j = i + d; if (j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }

  function listField(f, path) {
    var box = h('div', { class: 'f' }, h('span', { text: f.label }));
    var list = h('div', { class: 'list' }); box.appendChild(list);
    var arr = get(data, path); if (!Array.isArray(arr)) { arr = []; set(data, path, arr); }
    function paint() {
      list.innerHTML = '';
      arr.forEach(function (item, i) {
        var key = path + '.' + i;
        var title = (f.titleKey && item && item[f.titleKey]) || ('Item ' + (i + 1));
        var det = h('details', { class: 'item', 'data-key': key });
        if (openKeys[key]) det.open = true;
        det.addEventListener('toggle', function () { openKeys[key] = det.open; });
        var act = h('span', { class: 'acts' });
        if (!f.fixed) {
          var up = h('button', { class: 'ib', type: 'button', text: '↑', 'aria-label': 'Move up', onclick: function (e) { e.preventDefault(); move(arr, i, -1); change(path, arr, true); paint(); } });
          var dn = h('button', { class: 'ib', type: 'button', text: '↓', 'aria-label': 'Move down', onclick: function (e) { e.preventDefault(); move(arr, i, 1); change(path, arr, true); paint(); } });
          var del = h('button', { class: 'ib del', type: 'button', text: '✕', 'aria-label': 'Remove', onclick: function (e) { e.preventDefault(); if (confirm('Remove this item?')) { arr.splice(i, 1); change(path, arr, true); paint(); } } });
          up.disabled = i === 0; dn.disabled = i === arr.length - 1;
          act.appendChild(up); act.appendChild(dn); act.appendChild(del);
        }
        det.appendChild(h('summary', {}, h('span', { class: 'n', text: String(i + 1) }), h('span', { class: 't', text: String(title).slice(0, 80) }), act));
        var body = h('div', { class: 'body' }); renderFields(body, f.fields, key); det.appendChild(body);
        list.appendChild(det);
      });
    }
    box.appendChild(list); paint();
    if (!f.fixed) box.appendChild(h('button', { class: 'add', type: 'button', text: '+ ' + (f.add || 'Add item'), onclick: function () {
      arr.push(clone(f.blank || {})); openKeys[path + '.' + (arr.length - 1)] = true; change(path, arr, true); paint();
    } }));
    return box;
  }

  /* ---------- Custom panels ---------- */
  function themePanel(box) {
    box.appendChild(h('div', { class: 'group', style: 'margin-top:0;border:0;padding:0' }, h('h3', { text: 'Quick color sets' }), h('p', { text: 'Pick one to start, then fine-tune the colors below.' })));
    var pr = h('div', { class: 'presets' });
    PRESETS.forEach(function (p) {
      pr.appendChild(h('button', { class: 'preset', type: 'button', onclick: function () { data.theme.accent = p.a; data.theme.accent2 = p.b; change('theme.accent', p.a); renderPanel(); } },
        h('i', { style: 'background:linear-gradient(135deg,' + p.a + ',' + p.b + ')' }), p.name));
    });
    box.appendChild(pr);
    renderFields(box, [
      COL('theme.accent', 'Main accent color', { hint: 'Buttons, glow, highlights.' }),
      COL('theme.accent2', 'Light accent color', { hint: 'Hover text, gradients, eyebrow labels.' }),
      COL('theme.bg', 'Page background (dark mode)', { hint: 'Pure black #000000 is the cinematic default.' }),
      RNG('theme.glow', 'Glow strength', { min: 0, max: 150, unit: '%' }),
      RNG('theme.radius', 'Corner roundness of cards', { min: 8, max: 40, unit: 'px' }),
      SEL('theme.fontDisplay', 'Heading font', FONTS, { hint: 'Helvetica uses the visitor\'s system font (Arial on Windows/Android). Others load from Google Fonts.' }),
      SEL('theme.fontBody', 'Body font', FONTS.filter(function (x) { return x !== 'Helvetica'; })),
      SEL('theme.defaultMode', 'Default mode', ['dark', 'light']),
      TG('theme.themeToggle', 'Show the light/dark switch', { hint: 'Visitors can switch; their choice is remembered in their browser.' }),
      TG('theme.mascot', 'Show the sleepy mascot', { hint: 'Hidden on phones automatically.' })
    ], '');
  }

  function sectionsPanel(box) {
    box.appendChild(h('p', { class: 'hint', text: 'The hero stays first. Turn a section off to hide it everywhere, including the menu. Leave "Menu label" empty to keep a section out of the menu.' }));
    data.sections.forEach(function (s, i) {
      var key = 'sec.' + s.id;
      var det = h('details', { class: 'item', 'data-key': key });
      if (openKeys[key]) det.open = true;
      det.addEventListener('toggle', function () { openKeys[key] = det.open; });
      var movable = s.id !== 'marquee';
      var first = i <= 1, last = i === data.sections.length - 1;
      var vis = h('input', { type: 'checkbox' }); vis.checked = s.visible !== false;
      vis.addEventListener('click', function (e) { e.stopPropagation(); });
      vis.addEventListener('change', function () { change('sections.' + i + '.visible', vis.checked); });
      var up = h('button', { class: 'ib', type: 'button', text: '↑', 'aria-label': 'Move up', onclick: function (e) { e.preventDefault(); move(data.sections, i, -1); change('sections', data.sections, true); renderPanel(); } });
      var dn = h('button', { class: 'ib', type: 'button', text: '↓', 'aria-label': 'Move down', onclick: function (e) { e.preventDefault(); move(data.sections, i, 1); change('sections', data.sections, true); renderPanel(); } });
      up.disabled = !movable || first; dn.disabled = !movable || last;
      var visLabel = h('label', { class: 'toggle', style: 'margin:0;padding:4px 8px;border:0;background:none', onclick: function (e) { e.stopPropagation(); } }, vis, h('span', { class: 'sw' }));
      det.appendChild(h('summary', {}, h('span', { class: 'n', text: String(i + 1) }), h('span', { class: 't', text: SEC_NAMES[s.id] || s.id }), h('span', { class: 'acts' }, visLabel, up, dn)));
      var body = h('div', { class: 'body' });
      var fields = [];
      if (s.id !== 'marquee') fields.push(T('nav', 'Menu label', { hint: 'Empty = not shown in the menu.' }));
      if (s.id !== 'marquee' && s.id !== 'about') fields.push(T('eyebrow', 'Small label above the heading'));
      if (s.id !== 'marquee') fields.push(T('title', 'Heading'));
      if (['showcase', 'work', 'services', 'process', 'contact'].indexOf(s.id) > -1) fields.push(A('text', 'Short paragraph', { rows: 2 }));
      if (s.id === 'about') fields.push(T('eyebrow', 'Small label above the section'));
      if (s.id === 'marquee') body.appendChild(h('p', { class: 'hint', text: 'Edit the phrases in the "Highlights strip" tab.' }));
      renderFields(body, fields, 'sections.' + i);
      det.appendChild(body); box.appendChild(det);
    });
  }

  function exportPanel(box) {
    var json = function () { return JSON.stringify(data, null, 2); };
    box.appendChild(h('ol', { class: 'steps' },
      h('li', { html: '<b>Download</b> your updated file with the button below.' }),
      h('li', { html: 'Open your GitHub repository <b>fazalhossen48/fazalhossen48.github.io</b> and press <b>Add file → Upload files</b>.' }),
      h('li', { html: 'Drop <b>content.json</b> (it replaces the old one). If you added photos, drop them into the <b>assets</b> folder too.' }),
      h('li', { html: 'Press <b>Commit changes</b>. Wait 1 to 2 minutes, then hard-refresh your site.' })));
    box.appendChild(h('div', { class: 'btnrow' },
      h('button', { class: 'a-btn primary', type: 'button', text: 'Download content.json', onclick: exportFile }),
      h('button', { class: 'a-btn ghost', type: 'button', text: 'Copy JSON', onclick: function () { copy(json()).then(function () { toast('JSON copied'); }); } }),
      h('button', { class: 'a-btn ghost', type: 'button', text: 'Import a content.json', onclick: function () { importInput.click(); } })));
    var importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    importInput.addEventListener('change', function () {
      var fl = importInput.files[0]; if (!fl) return;
      var rd = new FileReader();
      rd.onload = function () {
        try { var o = JSON.parse(rd.result); if (!o.sections || !o.brand) throw new Error('bad'); data = o; change('', null, true, true); renderPanel(); toast('Imported'); }
        catch (e) { toast('That file is not a valid content.json'); }
      };
      rd.readAsText(fl);
    });
    box.appendChild(importInput);
    box.appendChild(h('div', { class: 'btnrow' },
      h('button', { class: 'a-btn danger', type: 'button', text: 'Discard my draft (back to published)', onclick: function () {
        if (!confirm('Throw away all unpublished edits in this browser?')) return;
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
        data = clone(publishedObj); change('', null, true, true); renderPanel(); toast('Draft discarded');
      } })));
    box.appendChild(h('div', { class: 'note', html: '<b>Your edits live in this browser until you upload the file.</b> The live site only changes after you commit content.json to GitHub. The page title and share-preview image come from index.html and are not changed here.' }));

    // password tool
    box.appendChild(h('div', { class: 'group' }, h('h3', { text: 'Change the admin password' }),
      h('p', { text: 'The password is a lock for this page only. Anyone can read the hash in admin.js, so choose a long password you use nowhere else.' })));
    var pw = h('input', { type: 'text', placeholder: 'New password', autocomplete: 'off' });
    var out = h('code', { class: 'code', hidden: true });
    box.appendChild(h('div', { class: 'f' }, pw));
    box.appendChild(h('div', { class: 'btnrow' }, h('button', { class: 'a-btn ghost', type: 'button', text: 'Create hash', onclick: function () {
      if (pw.value.length < 8) { toast('Use at least 8 characters'); return; }
      hashPw(pw.value).then(function (hx) { out.hidden = false; out.textContent = "var PASS_HASH = '" + hx + "';"; });
    } })));
    box.appendChild(out);
    box.appendChild(h('p', { class: 'hint', text: 'Then open admin.js on GitHub, replace the line that starts with "var PASS_HASH" with the line above, and commit.' }));
  }

  function copy(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).catch(function () { legacy(txt); });
    legacy(txt); return Promise.resolve();
  }
  function legacy(txt) { var ta = h('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); }
  function exportFile() {
    var blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    var a = h('a', { href: URL.createObjectURL(blob), download: 'content.json' });
    document.body.appendChild(a); a.click(); a.remove();
    toast('content.json downloaded. Upload it to GitHub to publish.');
  }
  $('#btnExport').addEventListener('click', exportFile);

  /* ---------- Panel + tabs ---------- */
  function renderTabs() {
    var tabs = $('#tabs'); tabs.innerHTML = '';
    PANELS.forEach(function (p) {
      tabs.appendChild(h('button', { class: 'a-tab' + (p.id === current ? ' on' : ''), type: 'button', text: p.label, onclick: function () { current = p.id; renderTabs(); renderPanel(); $('#panel').scrollTop = 0; } }));
    });
  }
  function renderPanel() {
    var p = PANELS.filter(function (x) { return x.id === current; })[0];
    var box = $('#panel'), st = box.scrollTop; box.innerHTML = '';
    box.appendChild(h('h2', { text: p.label })); box.appendChild(h('p', { class: 'sub', text: p.sub || '' }));
    if (p.custom) p.custom(box); else renderFields(box, p.fields, '');
    box.scrollTop = st;
  }

  /* ---------- Change tracking, autosave, live preview ---------- */
  function change(path, value, structural, replaceAll) {
    if (path && !replaceAll && !structural) set(data, path, value);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) { /* storage may be blocked */ } }, 250);
    clearTimeout(pvTimer); pvTimer = setTimeout(sendPreview, 140);
    updateStatus();
  }
  function updateStatus() {
    var s = $('#status'), dirty = JSON.stringify(data) !== published;
    s.textContent = dirty ? 'Unpublished changes (draft saved in this browser)' : 'Matches the published file';
    s.className = 'status ' + (dirty ? 'dirty' : 'clean');
  }
  function sendPreview() {
    var f = $('#pvFrame');
    if (f && f.contentWindow) { try { f.contentWindow.postMessage({ type: 'fhp-preview', content: data }, location.origin === 'null' ? '*' : location.origin); } catch (e) { /* ignore */ } }
  }
  window.addEventListener('message', function (ev) { if (ev.data && ev.data.type === 'fhp-ready') { pvReady = true; sendPreview(); } });
  $('#pvFrame').addEventListener('load', function () { setTimeout(sendPreview, 300); });
  $('#pvReload').addEventListener('click', function () { $('#pvFrame').contentWindow.location.reload(); });
  $('#btnPreview').addEventListener('click', function () { $('#preview').classList.add('show'); sendPreview(); });
  $('#pvClose').addEventListener('click', function () { $('#preview').classList.remove('show'); });
  $$('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
      $('#pvStage').classList.toggle('phone', b.getAttribute('data-dev') === 'phone');
    });
  });

  /* ---------- Boot ---------- */
  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    function start(pub, offline) {
      publishedObj = pub; published = JSON.stringify(pub);
      var draft = null;
      try { var d = localStorage.getItem(DRAFT_KEY); if (d) draft = JSON.parse(d); } catch (e) { /* ignore */ }
      data = draft && draft.sections ? draft : clone(pub);
      ensureDefaults();
      renderTabs(); renderPanel(); updateStatus();
      if (offline) toast('Opened without a web server: showing the built-in copy of your content.');
      else if (draft && JSON.stringify(draft) !== published) toast('Restored your unpublished draft');
    }
    fetch('content.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (pub) { start(pub, false); })
      .catch(function (err) {
        if (window.FHP_CONTENT) { start(clone(window.FHP_CONTENT), true); return; }
        $('#panel').innerHTML = '';
        $('#panel').appendChild(h('div', { class: 'note err', html: '<b>Could not load content.json</b> (' + (err && err.message) + '). Open this page from your live website address.' }));
        $('#status').textContent = 'Not loaded';
      });
  }
  function ensureDefaults() {
    ['brand', 'theme', 'hero', 'marquee', 'showcase', 'work', 'services', 'process', 'testimonials', 'about', 'contact', 'booking', 'footer'].forEach(function (k) { if (!data[k]) data[k] = {}; });
    if (!Array.isArray(data.sections)) data.sections = [];
  }
})();
