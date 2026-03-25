// ==UserScript==
// @name         Amex Add All Offers
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Adds all Amex Offers to your card with one click
// @author       Andrew Porzio
// @match        https://global.americanexpress.com/offers*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ── Selectors (verify and update these on the live page) ─────────────────
  // Matches each individual offer card in the list.
  // To verify: open DevTools → Elements, inspect one offer card,
  // find the outermost repeating container element, update selector below.
  const CARD_SELECTOR = '[data-testid*="offer-tile"]'; // UPDATE after live testing

  // Set to true if the page scrolls on window (check: scroll page, does window.scrollY change?)
  // Set to false and fill SCROLL_CONTAINER_SELECTOR if offers scroll inside an inner div.
  const USE_WINDOW_SCROLL = true; // UPDATE after live testing
  const SCROLL_CONTAINER_SELECTOR = null; // set to CSS selector if USE_WINDOW_SCROLL is false
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

  function clickAllOffers() {
    const buttons = Array.from(document.querySelectorAll('button')).filter(btn =>
      btn.textContent.trim() === 'Add to Card' && !btn.disabled
    );
    buttons.forEach(btn => btn.click());
    return buttons.length;
  }

  function injectButton() {
    if (document.getElementById('amex-add-all-btn')) return null; // already injected
    const btn = document.createElement('button');
    btn.id = 'amex-add-all-btn';
    btn.textContent = 'Add All Offers';
    btn.style.cssText = [
      'position:fixed',
      'bottom:24px',
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

    const added = clickAllOffers();

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
