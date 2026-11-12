/**
 * Winblur v4 — точечный блюр Winline на slay-award.ru
 *
 * БЛЮРИМ (изображения/видео):
 *   • Логотипы Winline (header, footer, partners, preloader)
 *   • Hero-баннер с WINLINE на кристалле
 *   • Промо-картинки в слайдере легенд
 *   • Визуал золотого билета
 *
 * ЗАМЕНЯЕМ ТЕКСТ (не блюрим, а подменяем содержимое):
 *   • Все текстовые ноды с WINLINE → заменяем на "5opka42"
 *
 * НЕ ЗАДЕВАЕМ:
 *   • Кнопку «Авторизоваться» (data-golden-auth)
 *   • Кнопку «Купить билет»
 *   • Текст «SLAY»
 *   • Навигацию, номинации, FAQ
 */

(() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  //  КОНФИГ
  // ═══════════════════════════════════════════════════════════════
  const C = {
    blurAmount : 8,         // px — сила размытия для изображений
    maxBlocks  : 20,        // жёсткий лимит элементов
    overlayTxt : 'Реклама скрыта',
    textReplace: '5opka42', // чем заменять WINLINE в тексте
    textKeys   : [/winline/i, /винлайн/i],
    textMinLen : 1,
    textMaxLen : 30,       // только короткие надписи
  };

  // ═══════════════════════════════════════════════════════════════
  //  СОСТОЯНИЕ
  // ═══════════════════════════════════════════════════════════════
  let enabled      = true;
  let blurAmount   = C.blurAmount;
  let blocked      = 0;
  let statsEl      = null;
  let rafScheduled = false;
  let observer     = null;

  // ═══════════════════════════════════════════════════════════════
  //  СТИЛИ
  // ═══════════════════════════════════════════════════════════════
  function initStyles() {
    if (document.getElementById('wb-s')) return;
    const s = document.createElement('style');
    s.id = 'wb-s';
    s.textContent = `
      .wb-blur{filter:blur(var(--wb-b,${C.blurAmount}px))!important;
               pointer-events:none!important;user-select:none!important;
               transition:filter .2s ease!important}
      .wb-overlay{position:absolute;top:0;left:0;width:100%;height:100%;
                  display:flex;align-items:center;justify-content:center;
                  z-index:999999!important;pointer-events:none;border-radius:inherit}
      .wb-panel{position:fixed;bottom:16px;right:16px;background:rgba(14,14,14,.97);
                border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px 16px;
                z-index:2147483647!important;min-width:210px;backdrop-filter:blur(10px);
                box-shadow:0 4px 20px rgba(0,0,0,.7);font-family:Arial,sans-serif;
                color:#fff;font-size:12px;line-height:1.5}
      .wb-panel h3{margin:0 0 8px;font-size:13px;display:flex;align-items:center;gap:5px}
      .wb-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px}
      .wb-row label{color:#999;font-size:11px}
      .wb-row input[type=range]{width:96px;accent-color:#e63946}
      .wb-btn{background:#e63946;color:#fff;border:none;border-radius:5px;padding:4px 10px;
              cursor:pointer;font-size:11px;transition:background .15s}
      .wb-btn:hover{background:#c1121f}
      .wb-btn.sec{background:rgba(255,255,255,.08)}
      .wb-btn.sec:hover{background:rgba(255,255,255,.16)}
      .wb-stat{margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.07);
               color:#555;font-size:10px}
    `;
    document.head.appendChild(s);
  }

  function setBlurAmount(px) {
    blurAmount = px;
    document.documentElement.style.setProperty('--wb-b', px + 'px');
  }

  // ═══════════════════════════════════════════════════════════════
  //  Утилиты
  // ═══════════════════════════════════════════════════════════════
  function doBlur(el, tag) {
    if (!enabled || !el || el.dataset._wb) return;
    if (el.closest('.wb-panel')) return;
    if (blocked >= C.maxBlocks) return;
    el.dataset._wb = tag || 'scan';
    el.classList.add('wb-blur');
    blocked++;
    injectOverlay(el);
    updateStats();
  }

  function doUnblur(el) {
    if (!el || !el.dataset._wb) return;
    el.classList.remove('wb-blur');
    delete el.dataset._wb;
    el.querySelector(':scope > .wb-overlay')?.remove();
  }

  function injectOverlay(el) {
    if (el.querySelector('.wb-overlay')) return;
    const ov = document.createElement('div');
    ov.className = 'wb-overlay';
    el.appendChild(ov);
  }

  function updateStats() {
    if (statsEl) statsEl.textContent = `${blocked} / ${C.maxBlocks}`;
  }

  function collect(rules) {
    const set = new Set();
    for (const sel of rules) {
      try { document.querySelectorAll(sel).forEach(e => set.add(e)); } catch(_) {}
    }
    return set;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ЗАМЕНА ТЕКСТА WINLINE → 5opka42
  //  Работает с текстовыми нодами, не затрагивая HTML-структуру
  // ═══════════════════════════════════════════════════════════════
  function replaceTextWinline() {
    if (!enabled) return;

    // Проходим по всем текстовым узлам
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          // Пропускаем если родитель уже в панели управления
          if (node.parentElement.closest('.wb-panel')) return NodeFilter.FILTER_REJECT;
          // Пропускаем скрытые элементы
          if (node.parentElement.offsetParent === null && node.parentElement.tagName !== 'SCRIPT') {
            return NodeFilter.FILTER_REJECT;
          }
          const txt = node.textContent || '';
          if (/winline|винлайн/i.test(txt)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodesToChange = [];
    while (walker.nextNode()) {
      nodesToChange.push(walker.currentNode);
    }

    nodesToChange.forEach(textNode => {
      const original = textNode.textContent;
      const replaced = original
        .replace(/winline/gi, C.textReplace)
        .replace(/винлайн/gi, C.textReplace);
      if (original !== replaced) {
        textNode.textContent = replaced;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  СКАНИРОВАНИЕ — ТОЛЬКО ИЗОБРАЖЕНИЯ И ВИДЕО
  // ═══════════════════════════════════════════════════════════════
  function scanPage() {
    if (!enabled) return;

    // ── 1. ПРЕЛОАДЕР ───────────────────────────────────────────────
    collect([
      '[data-preloader] .preloader__logo',
      '[data-preloader] img[src*="winline"]',
      '[data-preloader] img[alt*="Winline"]',
    ]).forEach(e => doBlur(e, 'preloader'));

    // ── 2. ШАПКА (HEADER) ──────────────────────────────────────────
    collect([
      '.header__logo img[src*="winline"]',
      '.header__logo img[alt*="Winline"]',
      '.header__logo[aria-label*="Winline"]',
    ]).forEach(e => doBlur(e, 'header-logo'));

    // ── 3. ПАРТНЁРЫ ────────────────────────────────────────────────
    collect([
      '.partners__logo--winline',
      '.partners__item:has(img[src*="winline"])',
      '.partners__item img[src*="winline"]',
    ]).forEach(e => doBlur(e, 'partners'));

    // ── 4. HERO-СЕКЦИЯ (главный баннер) ─────────────────────────────
    // Hero содержит WINLINE на кристалле — размываем медиа
    collect([
      '.hero__media img.hero__image',
      '.hero__video',
    ]).forEach(e => doBlur(e, 'hero'));

    // ── 5. СЛАЙДЕР ЛЕГЕНД (картинки со WINLINE) ─────────────────────
    document.querySelectorAll('.legends__slide').forEach(slide => {
      const txt = slide.textContent || '';
      if (/winline/i.test(txt)) {
        const pic = slide.querySelector('.legends__picture');
        if (pic) doBlur(pic, 'legends-img');
      }
    });

    // ── 6. ЗОЛОТОЙ БИЛЕТ (визуал, БЕЗ кнопки авторизации) ──────────
    collect([
      '.golden-ticket__layer--ticket',
      '.golden-ticket__visual img',
      '.golden-ticket__scene img',
      '.golden-ticket__visual',
    ]).forEach(e => doBlur(e, 'golden-visual'));

    // ── 7. ПОДВАЛ (FOOTER) ──────────────────────────────────────────
    collect([
      '.footer__winline',
      '.footer__brand img[src*="winline"]',
      '.footer__brand img[alt*="Winline"]',
      '.footer__brand[aria-label*="Winline"]',
    ]).forEach(e => doBlur(e, 'footer'));

    // ── 8. IFRAME-РЕКЛАМА ───────────────────────────────────────────
    collect([
      'iframe[src*="winline"]',
      'iframe[src*="betting"]',
      'iframe[src*="advert"]',
      'iframe[src*="banner"]',
    ]).forEach(e => doBlur(e, 'iframe-ad'));

    // ── 9. Фоллбэк: любые img с winline ────────────────────────────
    collect(['img[src*="winline"]']).forEach(e => {
      if (!e.dataset._wb) doBlur(e, 'img-global');
    });

    // ── 10. ЗАМЕНА ТЕКСТА WINLINE → 5opka42 ────────────────────────
    replaceTextWinline();

    updateStats();
  }

  // ═══════════════════════════════════════════════════════════════
  //  ПАНЕЛЬ УПРАВЛЕНИЯ
  // ═══════════════════════════════════════════════════════════════
  function buildPanel() {
    if (document.querySelector('.wb-panel')) return;
    const p = document.createElement('div');
    p.className = 'wb-panel';
    p.innerHTML = `
      <h3>\uD83D\uDED1 Winblur</h3>
      <div class="wb-row"><label>Скрыто:</label><span id="wb-cnt">0 / ${C.maxBlocks}</span></div>
      <div class="wb-row"><label>Размытие:</label>
        <input type="range" min="2" max="20" value="${blurAmount}" id="wb-range"></div>
      <div class="wb-row">
        <button id="wb-toggle" class="wb-btn sec">Выключить</button>
        <button id="wb-refresh" class="wb-btn">Обновить</button>
      </div>
      <div id="wb-status" class="wb-stat">Запуск…</div>
    `;
    document.body.appendChild(p);
    statsEl = document.getElementById('wb-cnt');

    p.querySelector('#wb-range').addEventListener('input', e => setBlurAmount(+e.target.value));

    p.querySelector('#wb-toggle').addEventListener('click', () => {
      enabled = !enabled;
      const btn  = p.querySelector('#wb-toggle');
      const stat = p.querySelector('#wb-status');
      if (enabled) {
        btn.textContent = 'Выключить';
        btn.classList.remove('sec');
        stat.textContent = 'Включено ✓';
        scanPage();
      } else {
        btn.textContent = 'Включить';
        btn.classList.add('sec');
        stat.textContent = 'Выключено';
        document.querySelectorAll('.wb-blur').forEach(doUnblur);
      }
    });

    p.querySelector('#wb-refresh').addEventListener('click', () => {
      document.querySelectorAll('.wb-blur').forEach(doUnblur);
      blocked = 0;
      scanPage();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  OBSERVER — rAF-throttled (~16мс)
  // ═══════════════════════════════════════════════════════════════
  function setupObserver() {
    observer = new MutationObserver(() => {
      if (!enabled || rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        scanPage();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ═══════════════════════════════════════════════════════════════
  //  ЗАПУСК
  // ═══════════════════════════════════════════════════════════════
  function init() {
    initStyles();
    buildPanel();
    scanPage();           // первый проход
    setupObserver();      // дальнейший мониторинг
    setTimeout(scanPage, 2500); // второй проход
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
