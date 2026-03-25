// ==UserScript==
// @name         Amex Add All Offers
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Adds all Amex Offers to your card with one click
// @author       Andrew Porzio
// @match        https://global.americanexpress.com/offers*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ── Selectors (verified against live DOM 2026-03-25) ─────────────────────
  // Each individual offer card.
  const CARD_SELECTOR = '[data-testid="tileDiv"]';

  // The offers list scrolls inside an inner div, not window.
  const USE_WINDOW_SCROLL = false;
  const SCROLL_CONTAINER_SELECTOR = '[data-testid="scroll-container"]';

  // The "Add to Card" button testid — more reliable than text matching.
  const ADD_BTN_SELECTOR = '[data-testid="merchantOfferListAddButton"]';
  // ─────────────────────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getScrollContainer() {
    if (USE_WINDOW_SCROLL) return window;
    return document.querySelector(SCROLL_CONTAINER_SELECTOR) || window;
  }

  async function scrollToLoad(scrollContainer) {
    let prevCount = 0;
    let stableRounds = 0;
    let maxIterations = 60; // 60 × 900ms ≈ 54s ceiling

    while (stableRounds < 2 && maxIterations-- > 0) {
      const currentCount = document.querySelectorAll(CARD_SELECTOR).length;

      if (currentCount === prevCount) {
        stableRounds++;
      } else {
        stableRounds = 0;
        prevCount = currentCount;
      }

      scrollContainer.scrollBy(0, 800);
      await sleep(900); // wait for XHR + React re-render before next count check
    }

    scrollContainer.scrollTo(0, 0);
  }

  async function clickAllOffers(statusBtn) {
    const buttons = Array.from(document.querySelectorAll(ADD_BTN_SELECTOR)).filter(btn =>
      !btn.disabled
    );
    for (let i = 0; i < buttons.length; i++) {
      statusBtn.textContent = `Adding ${i + 1} of ${buttons.length}...`;
      buttons[i].click();
      await sleep(1500); // wait for the add request to complete before clicking next
    }
    return buttons.length;
  }

  function injectButton() {
    if (document.getElementById('amex-add-all-btn')) return null; // already injected
    const btn = document.createElement('button');
    btn.id = 'amex-add-all-btn';
    btn.textContent = 'Add All Offers';
    btn.style.cssText = [
      'position:fixed',
      'top:24px',
      'right:24px',
      'z-index:99999',
      'background:#006fcf',
      'color:#fff',
      'border:none',
      'border-radius:8px',
      'padding:12px 20px',
      'font-size:14px',
      'font-weight:600',
      'cursor:pointer',
      'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
      'font-family:sans-serif',
    ].join(';');
    document.body.appendChild(btn);
    return btn;
  }

  async function handleClick(btn) {
    btn.disabled = true;
    btn.textContent = 'Loading offers...';

    const scrollContainer = getScrollContainer();
    await scrollToLoad(scrollContainer);

    // Guard for wrong/outdated CARD_SELECTOR — "all already added" is handled below via added === 0
    const cardCount = document.querySelectorAll(CARD_SELECTOR).length;
    if (cardCount === 0) {
      btn.textContent = 'No offers found';
      btn.disabled = false;
      return;
    }

    const added = await clickAllOffers(btn);

    if (added === 0) {
      btn.textContent = 'All offers already added';
    } else {
      btn.textContent = `Done — added ${added} offer${added === 1 ? '' : 's'}`;
    }

    btn.disabled = false;
  }

  // Poll until the first offer card appears in the DOM, then inject the button.
  // The CARD_SELECTOR acts as the sentinel — button won't appear until React has rendered.
  const initInterval = setInterval(() => {
    if (document.querySelector(CARD_SELECTOR)) {
      clearInterval(initInterval);
      const btn = injectButton();
      if (btn) btn.addEventListener('click', () => handleClick(btn));
    }
  }, 200);

})();
