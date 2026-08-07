/*
 * FiberOS — Yarn Colorways loader (Phase 5: slim + fetch-on-demand)
 * -----------------------------------------------------------------
 * Loads yarn data from a slim JSON file ON DEMAND instead of parsing a 3.9MB inline
 * script on every page. The browser caches the fetch, so it downloads once and is
 * reused across Studio, Packet, and Yarn Library.
 *
 * Same public interface as before: FiberOSYarnAPI.load() -> Promise<{meta, colorways}>.
 * Still validates the Yarn Colorways API v3 source/version before exposing anything.
 * If an inline export is present (legacy fallback), it is used without a network call.
 */
(() => {
  const EXPECTED_SOURCE = 'https://temperature-blanket.com/api/yarn-colorways';
  const EXPECTED_VERSION = 'v3';
  const DATA_URL = 'yarn-colorways.json';
  const INLINE_URL = 'yarn-colorways.js';
  let request;

  // Load the yarn data by injecting a <script> that sets a global. Script tags load
  // fine from file:// URLs, where fetch() is blocked. Used when the page is opened
  // directly (double-clicked) or if the normal fetch is unavailable.
  function loadInline() {
    return new Promise((resolve, reject) => {
      if (window.FIBEROS_YARN_COLORWAYS_API_EXPORT) {
        resolve(window.FIBEROS_YARN_COLORWAYS_API_EXPORT);
        return;
      }
      const el = document.createElement('script');
      el.src = INLINE_URL;
      el.onload = () => window.FIBEROS_YARN_COLORWAYS_API_EXPORT
        ? resolve(window.FIBEROS_YARN_COLORWAYS_API_EXPORT)
        : reject(new Error('Yarn data script loaded but no export was found.'));
      el.onerror = () => reject(new Error('Could not load yarn data (' + INLINE_URL + ').'));
      document.head.appendChild(el);
    });
  }

  function validate(payload) {
    if (!payload || payload?.meta?.source !== EXPECTED_SOURCE || payload?.meta?.apiVersion !== EXPECTED_VERSION) {
      throw new Error('The yarn data is not a valid Yarn Colorways API v3 export.');
    }
    if (!Array.isArray(payload.data) || !payload.data.length) {
      throw new Error('The Yarn Colorways API export contains no colorways.');
    }
    const colorways = payload.data.filter(item => item && item.hex && item.name && item.brandName);
    if (!colorways.length) throw new Error('The Yarn Colorways API export has no valid colorways.');
    return Object.freeze({ meta: payload.meta, colorways: Object.freeze(colorways) });
  }

  function load() {
    if (!request) {
      let source;
      if (window.FIBEROS_YARN_COLORWAYS_API_EXPORT) {
        source = Promise.resolve(window.FIBEROS_YARN_COLORWAYS_API_EXPORT); // already inlined
      } else if (typeof fetch !== 'function' || location.protocol === 'file:') {
        // Opened directly from disk: fetch() of a local file is blocked in most
        // browsers, so load the data via a <script> tag instead.
        source = loadInline();
      } else {
        source = fetch(DATA_URL, { cache: 'force-cache' })
          .then(res => {
            if (!res.ok) throw new Error('Could not load yarn data (' + res.status + ').');
            return res.json();
          })
          .catch(loadInline); // network/CORS failure: fall back to the inline script
      }
      request = source.then(validate);
    }
    return request;
  }

  window.FiberOSYarnAPI = Object.freeze({ load, source: EXPECTED_SOURCE, version: EXPECTED_VERSION, dataUrl: DATA_URL });
})();
