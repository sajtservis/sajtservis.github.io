/* Sajt Servis — zajednički JS za sve strane (meni, vrh, kopiranje, forma, smena primera, video u karticama). */
(function () {
  'use strict';
  var manjeAnimacija = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- hamburger meni ---------- */
  var dugmeMeni = $('dugmeMeni'), vezeMeni = $('vezeMeni');
  if (dugmeMeni && vezeMeni) {
    var zatvoriMeni = function () { vezeMeni.classList.remove('otvoren'); dugmeMeni.setAttribute('aria-expanded', 'false'); };
    dugmeMeni.addEventListener('click', function () {
      var otvoren = vezeMeni.classList.toggle('otvoren');
      dugmeMeni.setAttribute('aria-expanded', String(otvoren));
    });
    vezeMeni.addEventListener('click', function (e) { if (e.target.tagName === 'A') zatvoriMeni(); });
    document.addEventListener('click', function (e) {
      if (!vezeMeni.classList.contains('otvoren')) return;
      if (!vezeMeni.contains(e.target) && !dugmeMeni.contains(e.target)) zatvoriMeni();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zatvoriMeni(); });
    window.matchMedia('(min-width:901px)').addEventListener('change', zatvoriMeni);
  }

  /* ---------- nazad na vrh ---------- */
  var dugmeVrh = $('dugmeVrh');
  if (dugmeVrh) {
    window.addEventListener('scroll', function () { dugmeVrh.classList.toggle('vidi', window.scrollY > 500); }, { passive: true });
    dugmeVrh.addEventListener('click', function () {
      if (window.PM && window.PM.lenis) { window.PM.lenis.scrollTo(0); return; }
      window.scrollTo({ top: 0, behavior: manjeAnimacija ? 'auto' : 'smooth' });
    });
  }

  /* ---------- kopiraj u clipboard ---------- */
  document.querySelectorAll('.kopiraj').forEach(function (dugme) {
    dugme.addEventListener('click', function () {
      var tekst = dugme.dataset.kopiraj;
      var gotovo = function () {
        var izvorno = dugme.innerHTML;
        dugme.classList.add('kopirano');
        dugme.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
        setTimeout(function () { dugme.classList.remove('kopirano'); dugme.innerHTML = izvorno; }, 1800);
      };
      var rezerva = function () {
        var polje = document.createElement('textarea');
        polje.value = tekst; polje.style.position = 'fixed'; polje.style.opacity = '0';
        document.body.appendChild(polje); polje.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(polje); gotovo();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tekst).then(gotovo, rezerva);
      else rezerva();
    });
  });

  /* ---------- forma → WhatsApp ---------- */
  var forma = $('forma'), status = $('statusPoruke');
  if (forma) {
    // ?paket=galerija u adresi unapred bira paket (dugmad "Zatražite" sa strane Cene)
    var izbor = new URLSearchParams(location.search).get('paket');
    var mapa = { jednostrani: 1, galerija: 2, zakazivanje: 3, qr: 4 };
    if (izbor && mapa[izbor] && $('pPaket')) $('pPaket').selectedIndex = mapa[izbor];
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (id) { var el = $(id); return ((el && el.value) || '').trim(); };
      if (v('pSajt')) return;
      var ime = v('pIme'), kontakt = v('pKontakt');
      if (!ime || !kontakt) {
        status.className = 'poruka-status vidi los';
        status.textContent = 'Popunite ime i kontakt, pa šaljemo.';
        return;
      }
      var redovi = ['Upit sa sajta', 'Ime i biznis: ' + ime, 'Kontakt: ' + kontakt, 'Zanima me: ' + v('pPaket')];
      var opis = v('pPoruka');
      if (opis) redovi.push('Čime se bavi: ' + opis);
      window.open('https://wa.me/381621088760?text=' + encodeURIComponent(redovi.join('\n')), '_blank', 'noopener');
      status.className = 'poruka-status vidi ok';
      status.textContent = 'Otvara se WhatsApp sa vašim upitom. Pošaljite poruku i javljamo se još danas.';
      forma.reset();
    });
  }

  /* ---------- početna: smena pravih primera u prozoru ---------- */
  var ekran = $('ekran');
  if (ekran) {
    var slajdovi = [].slice.call(ekran.querySelectorAll('.slajd'));
    var tacke = $('tackeSlajda'), adresa = $('adresaSlajda'), dugmePauza = $('dugmePauza');
    var aktivni = 0, auto = null, rucno = manjeAnimacija;
    tacke.innerHTML = slajdovi.map(function (s, i) {
      return '<button type="button" aria-current="' + (i === 0) + '" aria-label="Primer ' + (i + 1) + ': ' + s.dataset.ime + '" data-i="' + i + '"></button>';
    }).join('');
    var pokazi = function (i) {
      aktivni = i;
      slajdovi.forEach(function (s, j) {
        s.classList.toggle('aktivan', i === j);
        s.setAttribute('aria-hidden', String(i !== j));
        s.tabIndex = i === j ? 0 : -1;
      });
      [].forEach.call(tacke.children, function (b, j) { b.setAttribute('aria-current', String(i === j)); });
      adresa.textContent = slajdovi[i].dataset.adresa;
    };
    var pokreni = function () { if (!rucno && !auto) auto = setInterval(function () { pokazi((aktivni + 1) % slajdovi.length); }, 4200); };
    var zaustavi = function () { if (auto) { clearInterval(auto); auto = null; } };
    tacke.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      pokazi(+b.dataset.i); zaustavi();
    });
    var ikonaPauza = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
    var ikonaPusti = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>';
    var postaviDugme = function () {
      dugmePauza.innerHTML = rucno ? ikonaPusti : ikonaPauza;
      dugmePauza.setAttribute('aria-label', rucno ? 'Pokreni automatsku smenu primera' : 'Pauziraj automatsku smenu primera');
    };
    dugmePauza.addEventListener('click', function () { rucno = !rucno; rucno ? zaustavi() : pokreni(); postaviDugme(); });
    ekran.addEventListener('mouseenter', zaustavi);
    ekran.addEventListener('mouseleave', pokreni);
    ekran.addEventListener('focusin', zaustavi);
    postaviDugme(); pokazi(0); pokreni();
  }

  /* ---------- kartice radova: snimak skrola se pušta kad je kartica na ekranu ---------- */
  var videi = document.querySelectorAll('video[data-pusti]');
  if (videi.length && 'IntersectionObserver' in window && !manjeAnimacija) {
    var io = new IntersectionObserver(function (unosi) {
      unosi.forEach(function (u) {
        var v = u.target;
        if (u.isIntersecting) {
          if (v.preload === 'none') { v.preload = 'auto'; }
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else { v.pause(); }
      });
    }, { threshold: 0.35 });
    videi.forEach(function (v) { io.observe(v); });
  }

  /* ---------- QR strana: živi primer menija se učitava tek kad je blizu ---------- */
  var ram = document.querySelector('iframe[data-src]');
  if (ram && 'IntersectionObserver' in window) {
    var io2 = new IntersectionObserver(function (unosi) {
      if (!unosi[0].isIntersecting) return;
      ram.src = ram.dataset.src; ram.removeAttribute('data-src'); io2.disconnect();
      ram.addEventListener('load', function () { var p = ram.parentNode.querySelector('.poster'); if (p) p.remove(); });
    }, { rootMargin: '300px' });
    io2.observe(ram);
  }
})();
