/* =====================================================================
   Sajt Servis — premium kit (JS)  ·  bez build koraka, bez zavisnosti
   Učitavanje (na kraju <body>, tim redom):
     <script defer src=".../vendor/lenis.min.js"></script>
     <script defer src=".../vendor/gsap.min.js"></script>
     <script defer src=".../vendor/ScrollTrigger.min.js"></script>
     <script defer src=".../premium.js"></script>
   Opciono u <head> (za animaciju sadržaja koji je odmah na ekranu):
     <script>document.documentElement.classList.add('pm-pending');
       setTimeout(function(){document.documentElement.classList.remove('pm-pending')},2500)</script>

   Oznake:
     data-reveal            fade + pomeranje nagore (""|"left"|"right"|"scale"|"clip"|"words")
     data-reveal-delay="0.2"
     data-parallax="0.15"   blagi paralaks (slike)
     data-marquee           beskonačna traka (prvi potomak = sadržaj)
     data-count="150"       broj koji odbrojava do vrednosti kad se pojavi
     .pm-scrub[data-scrub-src="img/f-{i}.webp"][data-scrub-count="48"]  rotirajući objekat
       (+ data-scrub-blend="off" kad sekvenca ima sitan tekst koji se pomera)
     .pm-progress           traka napretka skrola
     <body data-premium="auto">  automatski animira sadržaj ISPOD prvog ekrana
                                 (za postojeće sajtove koje ne želimo ručno da označavamo)
     <html data-pm-anchor-offset="-88">  pomeraj za #linkove (lepljiva navigacija) — NE koristiti ako stranica
                                          već ima scroll-margin-top (Lenis ga poštuje; zbir bi bio dupli)
     <html data-no-lenis>   bez smooth-scroll-a (samo animacije)

   Sigurnosna pravila (naučena na greškama):
     - Sadržaj se NIKAD ne sakriva CSS-om trajno; bez JS-a sve je vidljivo.
     - Ako biblioteke ne stignu ili bace grešku: stranica ostaje statična, ne prazna.
     - "Spas": element do kog je posetilac stigao, a ostao nevidljiv, forsira se vidljiv
       — ali SAMO ako je stvarno na ekranu (ranije verzija je gasila sve animacije).
   ===================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  var done = function () { root.classList.remove('pm-pending'); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Marquee radi i bez GSAP-a (čist CSS), pa ga pripremamo prvog.
  function setupMarquees() {
    document.querySelectorAll('[data-marquee]').forEach(function (m) {
      if (m.dataset.pmReady) return;
      m.dataset.pmReady = '1';
      m.classList.add('pm-marquee');
      var track = m.firstElementChild;
      if (!track) return;
      track.classList.add('pm-marquee-track');
      if (m.dataset.marqueeSpeed) m.style.setProperty('--pm-speed', m.dataset.marqueeSpeed + 's');
      var clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('a,button').forEach(function (el) { el.setAttribute('tabindex', '-1'); });
      m.appendChild(clone);
    });
  }

  function start() {
    setupMarquees();
    if (reduce || !window.gsap || !window.ScrollTrigger) { done(); setupScrubStatic(); return; }
    try { init(); } catch (err) {
      console.error('[premium] animacije isključene zbog greške:', err);
      document.querySelectorAll('[data-reveal],[data-pm-auto]').forEach(function (el) {
        el.style.opacity = ''; el.style.transform = ''; el.style.visibility = '';
      });
      done();
    }
  }

  function init() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);

    /* ---------- smooth scroll ---------- */
    var lenis = null;
    if (window.Lenis && !root.hasAttribute('data-no-lenis')) {
      var off = parseFloat(root.getAttribute('data-pm-anchor-offset') || '0');
      // allowNestedScroll: točkić iznad skrolabilnog elementa (modal, lista, kalendar)
      // skroluje TAJ element, a ne celu stranicu — bez ručnog data-lenis-prevent.
      lenis = new window.Lenis({ duration: 1.1, smoothWheel: true, anchors: { offset: off }, allowNestedScroll: true });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      // Kad stranica zaključa skrol (modal: body overflow hidden) — pauziraj Lenis.
      // Proverava izračunat stil, pa hvata i zaključavanje preko klase (npr. .lock{overflow:hidden}).
      var sync = function () {
        var locked = getComputedStyle(document.body).overflowY === 'hidden' ||
          (root.style.overflow === 'hidden');
        if (locked && !lenis.isStopped) lenis.stop();
        else if (!locked && lenis.isStopped) lenis.start();
      };
      var mo = new MutationObserver(sync);
      mo.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
      mo.observe(root, { attributes: true, attributeFilter: ['style'] });
    }

    /* ---------- automatsko označavanje (postojeći sajtovi) ---------- */
    if (document.body.getAttribute('data-premium') === 'auto') autoTag();

    /* ---------- reči u naslovima ---------- */
    document.querySelectorAll('[data-reveal="words"]').forEach(splitWords);

    /* ---------- reveal ---------- */
    var from = {
      '': { autoAlpha: 0, y: 36 },
      left: { autoAlpha: 0, x: -40 },
      right: { autoAlpha: 0, x: 40 },
      scale: { autoAlpha: 0, scale: 0.94 },
      clip: { autoAlpha: 1, clipPath: 'inset(12% 8% 12% 8% round 14px)', scale: 1.06 },
    };
    var to = {
      '': { autoAlpha: 1, y: 0 },
      left: { autoAlpha: 1, x: 0 },
      right: { autoAlpha: 1, x: 0 },
      scale: { autoAlpha: 1, scale: 1 },
      clip: { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0% round 0px)', scale: 1 },
    };
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]:not([data-reveal="words"]),[data-pm-auto]'));
    // 1) SVA čitanja stilova, 2) tek onda sva pisanja. Naizmenično čitanje/pisanje
    //    tera pregledač da preračuna stil za svaki element (layout thrashing) —
    //    na slabijem telefonu to je bilo ~100+ ms blokiranja pri učitavanju.
    items.forEach(function (el) {
      var kind = el.getAttribute('data-reveal') || el.getAttribute('data-pm-auto') || '';
      if (!from[kind]) kind = '';
      // Element koji već ima svoju CSS animaciju/transform: samo fade, da ga ne pokvarimo.
      var cs = getComputedStyle(el);
      var safe = cs.animationName === 'none' && (cs.transform === 'none' || kind === 'clip');
      el.__pm = { kind: kind, safe: safe, delay: parseFloat(el.getAttribute('data-reveal-delay') || '0') };
    });
    items.forEach(function (el) { gsap.set(el, el.__pm.safe ? from[el.__pm.kind] : { autoAlpha: 0 }); });
    ST.batch(items, {
      start: 'top 92%',
      once: true,
      onEnter: function (batch) {
        batch.forEach(function (el, i) {
          var p = el.__pm;
          var vars = p.safe ? Object.assign({}, to[p.kind]) : { autoAlpha: 1 };
          vars.duration = p.kind === 'clip' ? 1.2 : 0.9;
          vars.ease = p.kind === 'clip' ? 'power3.inOut' : 'power3.out';
          vars.delay = p.delay + i * 0.08;
          vars.overwrite = true;
          vars.onComplete = function () { if (p.kind === 'clip') gsap.set(el, { clearProps: 'clipPath,transform' }); };
          gsap.to(el, vars);
        });
      },
    });

    // Sve što je već (makar delom) na prvom ekranu otkriva se odmah pri učitavanju,
    // i kad je ispod tačke okidanja — inače dno prvog ekrana ostane prazna traka.
    setTimeout(function () {
      items.forEach(function (el, i) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0 && !gsap.isTweening(el) &&
            parseFloat(getComputedStyle(el).opacity) < 0.05) {
          var p = el.__pm, vars = p.safe ? Object.assign({}, to[p.kind]) : { autoAlpha: 1 };
          vars.duration = 0.9; vars.ease = 'power3.out'; vars.delay = p.delay + 0.1; vars.overwrite = true;
          gsap.to(el, vars);
        }
      });
    }, 60);

    /* ---------- reči ---------- */
    document.querySelectorAll('[data-reveal="words"]').forEach(function (el) {
      var words = el.querySelectorAll('.pm-w');
      gsap.set(el, { autoAlpha: 1 });
      gsap.set(words, { yPercent: 110 });
      ST.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: function () {
          gsap.to(words, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.06,
            delay: parseFloat(el.getAttribute('data-reveal-delay') || '0') });
        },
      });
    });

    /* ---------- paralaks ---------- */
    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      var s = parseFloat(el.getAttribute('data-parallax')) || 0.15;
      gsap.fromTo(el, { yPercent: s * 50 }, { yPercent: -s * 50, ease: 'none',
        scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* ---------- brojevi ---------- */
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      if (isNaN(target)) return;
      // Zaključaj širinu na konačnu vrednost: "0"→"150" inače pomera tekst pored (CLS).
      el.style.display = 'inline-block';
      el.style.fontVariantNumeric = 'tabular-nums';
      el.style.minWidth = el.getBoundingClientRect().width + 'px';
      el.style.textAlign = 'right';
      var obj = { v: 0 };
      ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: function () {
        gsap.to(obj, { v: target, duration: 1.2, ease: 'power2.out',
          onUpdate: function () { el.textContent = Math.round(obj.v).toLocaleString('sr-RS'); } });
      } });
    });

    /* ---------- napredak ---------- */
    document.querySelectorAll('.pm-progress').forEach(function (bar) {
      gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
    });

    setupScrub(gsap, ST);

    /* ---------- spas: nikad trajno nevidljiv sadržaj na ekranu ---------- */
    // Element na samom dnu stranice često ne može da dođe do tačke okidanja
    // (stranica se završi pre toga) — zato na dnu otkrivamo sve odmah.
    var atBottom = function () {
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    };
    var rescue = function () {
      items.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var onScreen = r.top < window.innerHeight - 2 && r.bottom > 0;
        if (onScreen && parseFloat(getComputedStyle(el).opacity) < 0.05) {
          gsap.to(el, { autoAlpha: 1, x: 0, y: 0, scale: 1, clipPath: 'none', duration: 0.4, overwrite: true });
        }
      });
      document.querySelectorAll('[data-reveal="words"]').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
          var stuck = Array.prototype.filter.call(el.querySelectorAll('.pm-w'), function (w) {
            return Math.abs(gsap.getProperty(w, 'yPercent')) > 50 && !gsap.isTweening(w);
          });
          if (stuck.length) gsap.to(stuck, { yPercent: 0, duration: 0.4 });
        }
      });
    };
    var rt;
    window.addEventListener('scroll', function () {
      clearTimeout(rt);
      if (atBottom()) rescue(); else rt = setTimeout(rescue, 1200);
    }, { passive: true });
    setTimeout(rescue, 2600);

    // Fontovi i slike menjaju visine — preračunaj okidače.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
    window.addEventListener('load', function () { ST.refresh(); });

    done();
    window.PM = { lenis: lenis, refresh: function () { ST.refresh(); } };
  }

  /* ---------- automatsko označavanje: samo ono ISPOD prvog ekrana ---------- */
  function autoTag() {
    var fold = window.innerHeight;
    var seen = new Set();
    var tag = function (el, kind) {
      if (seen.has(el) || el.closest('[data-reveal],[data-pm-auto]')) return;
      if (/^(SCRIPT|STYLE|TEMPLATE|DIALOG|BR)$/.test(el.tagName)) return;
      var cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'sticky' || cs.position === 'absolute' || cs.display === 'none') return;
      var r = el.getBoundingClientRect();
      if (r.height < 8 || r.top < fold) return; // vidljivo odmah — ne diramo (bez treptanja)
      seen.add(el);
      el.setAttribute('data-pm-auto', kind);
    };
    // Mreža/lista kartica: animiraj svaku karticu posebno (stepenasto), ne ceo blok.
    var isGroup = function (el) {
      var kids = el.children;
      if (kids.length < 3) return false;
      var d = getComputedStyle(el).display;
      return el.tagName === 'UL' || el.tagName === 'OL' || /grid|flex/.test(d);
    };
    var blocks = document.querySelectorAll('section, article, footer, main > *, body > *');
    blocks.forEach(function (block) {
      if (block.tagName === 'HEADER' || block.tagName === 'NAV' || block === document.body) return;
      var kids = Array.prototype.slice.call(block.children);
      if (kids.length === 1 && kids[0].children.length > 1) kids = Array.prototype.slice.call(kids[0].children);
      if (block.tagName !== 'SECTION' && block.tagName !== 'ARTICLE' && block.tagName !== 'FOOTER' &&
          kids.some(function (k) { return k.tagName === 'SECTION'; })) return; // omotač sekcija — sekcije same
      kids.forEach(function (el) {
        if (el.tagName === 'SECTION') return;
        if (isGroup(el) && el.getBoundingClientRect().top >= fold) {
          Array.prototype.forEach.call(el.children, function (c) { tag(c, c.tagName === 'IMG' || c.tagName === 'FIGURE' ? 'clip' : ''); });
        } else {
          tag(el, el.tagName === 'IMG' || el.tagName === 'FIGURE' ? 'clip' : '');
        }
      });
    });
    document.querySelectorAll('img').forEach(function (img) {
      if (img.closest('[data-pm-auto],[data-reveal]')) return;
      var r = img.getBoundingClientRect();
      if (r.top >= fold && r.height > 60) img.setAttribute('data-pm-auto', 'clip');
    });
  }

  function splitWords(el) {
    if (el.dataset.pmSplit) return;
    el.dataset.pmSplit = '1';
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var m = document.createElement('span'); m.className = 'pm-wm';
            var w = document.createElement('span'); w.className = 'pm-w'; w.textContent = part;
            m.appendChild(w); frag.appendChild(m);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') { walk(n); }
      });
    };
    walk(el);
  }

  /* ---------- rotirajući objekat (sekvenca slika po skrolu) ---------- */
  function frameUrls(sec) {
    var src = sec.getAttribute('data-scrub-src'), n = parseInt(sec.getAttribute('data-scrub-count') || '0', 10);
    var pad = parseInt(sec.getAttribute('data-scrub-pad') || '2', 10), urls = [];
    for (var i = 0; i < n; i++) urls.push(src.replace('{i}', String(i).padStart(pad, '0')));
    return urls;
  }
  function setupScrubStatic() { /* bez animacija: ostaje poster slika */ }
  function setupScrub(gsap, ST) {
    document.querySelectorAll('.pm-scrub[data-scrub-src]').forEach(function (sec) {
      var canvas = sec.querySelector('canvas');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var urls = frameUrls(sec);
      var imgs = new Array(urls.length), loaded = 0, last = '';
      // data-scrub-blend="off": bez mešanja susednih frejmova — za sekvence sa
      // sitnim tekstom koji se pomera (mešanje bi dalo dvostruke slova).
      var blend = sec.getAttribute('data-scrub-blend') !== 'off';
      var draw = function (pos) {
        if (!blend) pos = Math.round(pos);
        var a = Math.floor(pos), b = Math.min(urls.length - 1, a + 1), f = pos - a;
        if (!imgs[a]) return;
        var key = a + ':' + f.toFixed(2);
        if (key === last) return;
        last = key;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1; ctx.drawImage(imgs[a], 0, 0, canvas.width, canvas.height);
        if (f > 0.01 && imgs[b]) { ctx.globalAlpha = f; ctx.drawImage(imgs[b], 0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
      };
      var progress = 0;
      // Lazy: frejmovi se učitavaju tek kad je sekcija blizu (štedi mobilne podatke).
      var load = function () {
      urls.forEach(function (u, i) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = function () {
          imgs[i] = im; loaded++;
          if (i === 0) {
            canvas.width = im.naturalWidth; canvas.height = im.naturalHeight;
            sec.style.setProperty('--pm-ratio', im.naturalWidth + '/' + im.naturalHeight);
            sec.classList.add('is-live');
            draw(0);
          }
          if (loaded === urls.length) { last = ''; draw(progress * (urls.length - 1)); }
        };
        im.src = u;
      });
      };
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) { io.disconnect(); load(); }
        }, { rootMargin: '150% 0px' });
        io.observe(sec);
      } else { load(); }
      ST.create({
        trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true,
        onUpdate: function (self) { progress = self.progress; draw(self.progress * (urls.length - 1)); },
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
