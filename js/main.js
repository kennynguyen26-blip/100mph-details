/* 100 MPH Details: site behavior. Plain JS, no build step. */
(function () {
  'use strict';

  var PHONE = '+13463775983';
  var IG_URL = 'https://instagram.com/100mph.details';
  var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reducedMotion() { return reduceMotionQuery.matches; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Header: transparent over hero, solid on scroll ---------- */
  function initHeader() {
    var header = $('[data-header]');
    if (!header || header.classList.contains('is-static')) return;
    function update() { header.classList.toggle('is-solid', window.scrollY > 8); }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* ---------- Mobile menu with focus trap ---------- */
  function initMenu() {
    var toggle = $('[data-menu-toggle]');
    var menu = $('[data-menu]');
    var label = $('[data-menu-label]');
    if (!toggle || !menu) return;
    var mobile = window.matchMedia('(max-width: 899px)');

    var headerCta = $('.header-actions .btn');

    // Same order as the DOM tab order: menu links, header CTA, toggle.
    function focusables() {
      var items = $$('a[href]', menu);
      if (headerCta) items.push(headerCta);
      items.push(toggle);
      return items;
    }

    function isOpen() { return toggle.getAttribute('aria-expanded') === 'true'; }

    function open() {
      toggle.setAttribute('aria-expanded', 'true');
      if (label) label.textContent = 'Close menu';
      menu.classList.add('is-open');
      document.body.classList.add('menu-open');
      document.addEventListener('keydown', onKey);
      var first = $('a', menu);
      if (first) first.focus();
    }

    function close(returnFocus) {
      if (!isOpen()) return;
      toggle.setAttribute('aria-expanded', 'false');
      if (label) label.textContent = 'Open menu';
      menu.classList.remove('is-open');
      document.body.classList.remove('menu-open');
      document.removeEventListener('keydown', onKey);
      if (returnFocus) toggle.focus();
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key !== 'Tab') return;
      var list = focusables();
      var first = list[0];
      var last = list[list.length - 1];
      var idx = list.indexOf(document.activeElement);
      if (e.shiftKey && (idx <= 0)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (idx === list.length - 1 || idx === -1)) { e.preventDefault(); first.focus(); }
    }

    toggle.addEventListener('click', function () { isOpen() ? close(false) : open(); });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) close(false);
    });
    function onBreakpoint() { if (!mobile.matches) close(false); }
    if (mobile.addEventListener) mobile.addEventListener('change', onBreakpoint);
    else if (mobile.addListener) mobile.addListener(onBreakpoint);
  }

  /* ---------- Package "See what's included" toggles (mobile) ---------- */
  function initPackages() {
    $$('[data-pkg-toggle]').forEach(function (btn) {
      var pkg = btn.closest('[data-pkg]');
      btn.addEventListener('click', function () {
        var openNow = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(openNow));
        btn.textContent = openNow ? 'Hide what\'s included' : 'See what\'s included';
        pkg.classList.toggle('is-open', openNow);
      });
    });
  }

  /* ---------- Quote builder ---------- */
  function initQuote() {
    var root = $('[data-quote]');
    if (!root) return;

    var estimateEl = $('[data-estimate]', root);
    var messageEl = $('[data-message]', root);
    var smsBtn = $('[data-send-sms]', root);
    var dmBtn = $('[data-copy-dm]', root);
    var statusEl = $('[data-quote-status]', root);
    var addonNote = $('[data-addon-note]', root);
    var deskNumber = $('[data-desk-number]', root);
    var addons = $$('input[name="addon"]', root);
    var statusTimer = null;

    // Desktop without touch: show the plain number to text from a phone.
    var noTouch = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !('ontouchstart' in window) && (navigator.maxTouchPoints || 0) === 0;
    if (deskNumber && noTouch) deskNumber.hidden = false;

    function val(name) {
      var el = $('input[name="' + name + '"]', root);
      return el ? el.value.trim() : '';
    }

    function state() {
      var vehicle = $('input[name="vehicle"]:checked', root);
      var service = $('input[name="service"]:checked', root);
      var chosen = addons.filter(function (a) { return a.checked && !a.disabled; });
      return {
        vehicle: vehicle ? vehicle.value : '',
        serviceKey: service ? service.value : '',
        serviceName: service ? service.getAttribute('data-name') : '',
        base: service ? Number(service.getAttribute('data-price')) : 0,
        addons: chosen.map(function (a) { return a.value; }),
        addMin: chosen.reduce(function (s, a) { return s + Number(a.getAttribute('data-min')); }, 0),
        addMax: chosen.reduce(function (s, a) { return s + Number(a.getAttribute('data-max')); }, 0),
        name: val('name'),
        area: val('area'),
        day: val('day')
      };
    }

    function estimateText(s) {
      if (!s.serviceKey) return '';
      if (!s.addons.length) return 'Starting at $' + s.base;
      return 'Starting at $' + (s.base + s.addMin) + ' to $' + (s.base + s.addMax);
    }

    function article(word) { return /^[aeiou]/i.test(word) ? 'an' : 'a'; }

    function buildMessage(s) {
      return 'Hi 100 MPH Details! I\'d like to book ' + article(s.serviceName) + ' ' + s.serviceName +
        ' for my ' + s.vehicle + '.' +
        ' Add-ons: ' + (s.addons.length ? s.addons.join(', ') : 'none') + '.' +
        (s.area ? ' Area: ' + s.area + '.' : '') +
        (s.day ? ' Preferred day: ' + s.day + '.' : '') +
        (s.name ? ' Name: ' + s.name + '.' : '') +
        ' Estimate from your site: ' + estimateText(s) + '.';
    }

    function smsHref(message) {
      return 'sms:' + PHONE + '?&body=' + encodeURIComponent(message);
    }

    function syncAddons(serviceKey) {
      var disable = serviceKey === 'exterior' || serviceKey === 'deep';
      addons.forEach(function (a) {
        a.disabled = disable;
        if (disable) a.checked = false;
      });
      if (serviceKey === 'deep') addonNote.textContent = 'Pet hair and stain treatment already included.';
      else if (serviceKey === 'exterior') addonNote.textContent = 'These add-ons are interior work, so they don\'t apply to Exterior Only.';
      else addonNote.textContent = '';
    }

    function setStatus(text) {
      statusEl.textContent = text;
      clearTimeout(statusTimer);
      if (text) statusTimer = setTimeout(function () { statusEl.textContent = ''; }, 4000);
    }

    function render() {
      var s = state();
      var est = estimateText(s);
      estimateEl.textContent = est || 'Pick a service';
      estimateEl.classList.toggle('is-set', !!est);

      var ready = !!(s.vehicle && s.serviceKey);
      if (ready) {
        var msg = buildMessage(s);
        messageEl.textContent = msg;
        smsBtn.setAttribute('href', smsHref(msg));
        smsBtn.removeAttribute('aria-disabled');
        dmBtn.removeAttribute('aria-disabled');
      } else {
        messageEl.textContent = !s.vehicle && !s.serviceKey
          ? 'Choose a vehicle and a service to build your message.'
          : (!s.vehicle ? 'Choose a vehicle to finish your message.' : 'Choose a service to finish your message.');
        smsBtn.setAttribute('href', 'sms:' + PHONE);
        smsBtn.setAttribute('aria-disabled', 'true');
        dmBtn.setAttribute('aria-disabled', 'true');
      }
      return { state: s, ready: ready, message: ready ? buildMessage(s) : '' };
    }

    function focusMissing() {
      var s = state();
      var group = !s.vehicle ? 'vehicle' : 'service';
      var first = $('input[name="' + group + '"]', root);
      setStatus(!s.vehicle ? 'Pick a vehicle first.' : 'Pick a service first.');
      if (first) {
        first.focus({ preventScroll: true });
        first.closest('fieldset').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      }
    }

    function copyText(text) {
      // Synchronous fallback first so it runs inside the click gesture everywhere.
      var ok = false;
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { ok = false; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
        ok = true;
      }
      return ok;
    }

    root.addEventListener('change', function (e) {
      if (e.target.name === 'service') syncAddons(e.target.value);
      render();
    });
    root.addEventListener('input', function (e) {
      if (e.target.matches('input[type="text"]')) render();
    });

    smsBtn.addEventListener('click', function (e) {
      var r = render();
      if (!r.ready) { e.preventDefault(); focusMissing(); }
    });

    dmBtn.addEventListener('click', function (e) {
      var r = render();
      if (!r.ready) { e.preventDefault(); focusMissing(); return; }
      // The link itself opens Instagram in a new tab, so pop-up blockers don't interfere.
      var copied = copyText(r.message);
      setStatus(copied ? 'Copied. Paste it into your Instagram DM.' : 'Couldn\'t copy automatically. Select the message above and copy it.');
    });

    render();

    // "Quote this package" links: pre-select the service, then the #quote link scrolls there.
    $$('[data-pick-service]').forEach(function (link) {
      link.addEventListener('click', function () {
        var input = $('input[name="service"][value="' + link.getAttribute('data-pick-service') + '"]', root);
        if (!input) return;
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  /* ---------- Our work: render only photos that actually exist ---------- */
  function probe(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img.naturalWidth > 0 ? src : null); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function initWork() {
    var section = $('[data-work]');
    if (!section) return Promise.resolve();
    var baList = $('[data-ba-list]', section);
    var gallery = $('[data-gallery]', section);
    var navLink = $('[data-work-link]');

    var pairs = [1, 2, 3].map(function (n) {
      return Promise.all([probe('images/before-' + n + '.jpg'), probe('images/after-' + n + '.jpg')]);
    });
    var works = [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return probe('images/work-' + n + '.jpg'); });

    return Promise.all([Promise.all(pairs), Promise.all(works)]).then(function (res) {
      var goodPairs = res[0].filter(function (p) { return p[0] && p[1]; });
      var goodWorks = res[1].filter(Boolean);
      if (!goodPairs.length && !goodWorks.length) return; // stays hidden, nav link stays hidden

      goodPairs.forEach(function (p, i) { baList.appendChild(buildSlider(p[0], p[1], i + 1)); });
      if (goodPairs.length) $('[data-ba-lede]', section).hidden = false;
      else baList.hidden = true;

      if (goodWorks.length) buildGallery(gallery, goodWorks);
      else gallery.hidden = true;

      section.hidden = false;
      if (navLink) navLink.hidden = false;
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  function buildSlider(beforeSrc, afterSrc, n) {
    var wrap = document.createElement('div');
    wrap.className = 'ba';
    wrap.innerHTML =
      '<img class="ba-after" alt="After detailing, job ' + n + '" draggable="false">' +
      '<img class="ba-before" alt="Before detailing, job ' + n + '" draggable="false">' +
      '<span class="ba-label ba-label-before" aria-hidden="true">Before</span>' +
      '<span class="ba-label ba-label-after" aria-hidden="true">After</span>' +
      '<div class="ba-handle" role="slider" tabindex="0" aria-label="Before and after comparison ' + n + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-valuetext="50% before"><span class="ba-grip"></span></div>';
    $('.ba-after', wrap).src = afterSrc;
    $('.ba-before', wrap).src = beforeSrc;
    var handle = $('.ba-handle', wrap);
    var pos = 50;
    var dragging = false;

    function setPos(p) {
      pos = Math.max(0, Math.min(100, p));
      wrap.style.setProperty('--pos', pos + '%');
      handle.setAttribute('aria-valuenow', String(Math.round(pos)));
      handle.setAttribute('aria-valuetext', Math.round(pos) + '% before');
    }
    function fromEvent(e) {
      var rect = wrap.getBoundingClientRect();
      setPos(((e.clientX - rect.left) / rect.width) * 100);
    }

    wrap.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
      fromEvent(e);
      if (e.pointerType === 'mouse') handle.focus({ preventScroll: true });
    });
    wrap.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
    function stop() { dragging = false; }
    wrap.addEventListener('pointerup', stop);
    wrap.addEventListener('pointercancel', stop);
    wrap.addEventListener('lostpointercapture', stop);

    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 10 : 5;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setPos(pos - step); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setPos(pos + step); }
      else if (e.key === 'Home') { e.preventDefault(); setPos(0); }
      else if (e.key === 'End') { e.preventDefault(); setPos(100); }
    });
    return wrap;
  }

  function buildGallery(gallery, srcs) {
    var dialog = $('[data-lightbox]');
    var lbImg = $('[data-lb-img]');
    var lbCount = $('[data-lb-count]');
    var current = 0;
    var lastTrigger = null;

    srcs.forEach(function (src, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gallery-item';
      btn.setAttribute('aria-label', 'Open photo ' + (i + 1) + ' of ' + srcs.length);
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Detailing work photo ' + (i + 1);
      img.loading = 'lazy';
      img.decoding = 'async';
      btn.appendChild(img);
      btn.addEventListener('click', function () { lastTrigger = btn; show(i); });
      gallery.appendChild(btn);
    });

    function show(i) {
      current = (i + srcs.length) % srcs.length;
      lbImg.src = srcs[current];
      lbImg.alt = 'Detailing work photo ' + (current + 1);
      lbCount.textContent = (current + 1) + ' / ' + srcs.length;
      var single = srcs.length < 2;
      $('[data-lb-prev]').hidden = single;
      $('[data-lb-next]').hidden = single;
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        document.body.classList.add('menu-open');
        $('[data-lb-close]').focus();
      }
    }
    function close() {
      if (typeof dialog.close === 'function') dialog.close(); else { dialog.removeAttribute('open'); onClosed(); }
    }
    function onClosed() {
      document.body.classList.remove('menu-open');
      if (lastTrigger) lastTrigger.focus();
    }

    $('[data-lb-prev]').addEventListener('click', function () { show(current - 1); });
    $('[data-lb-next]').addEventListener('click', function () { show(current + 1); });
    $('[data-lb-close]').addEventListener('click', close);
    dialog.addEventListener('close', onClosed);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); });
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
    });
  }

  /* ---------- Floating "Text Us": hide while quote or contact is in view ---------- */
  function initFloat() {
    var btn = $('[data-float]');
    if (!btn) return;
    var targets = ['#quote', '#contact'].map(function (s) { return $(s); }).filter(Boolean);
    if (!('IntersectionObserver' in window) || !targets.length) return;
    var visible = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target);
      });
      var hide = visible.size > 0;
      btn.classList.toggle('is-hidden', hide);
      $$('a', btn).forEach(function (a) {
        if (hide) a.setAttribute('tabindex', '-1'); else a.removeAttribute('tabindex');
      });
    }, { threshold: 0, rootMargin: '-20% 0px -20% 0px' }); // ignore slivers at the screen edges
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ---------- Scroll reveals (GSAP, light touch) ---------- */
  function initReveals() {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    if (!gsap || !ST || reducedMotion()) return;
    gsap.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true }); // before any ScrollTrigger is created
    $$('[data-reveal]').forEach(function (el) {
      gsap.from(el, {
        y: 20,
        autoAlpha: 0,
        duration: 0.5,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });
  }

  function init() {
    initHeader();
    initMenu();
    initPackages();
    initQuote();
    initFloat();
    initReveals();
    initWork();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
