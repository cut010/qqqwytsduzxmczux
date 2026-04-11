(function () {
  'use strict';
  window.__s = true;

  // Nuke
  function _0xN() {
    try {
      document.documentElement.innerHTML = '';
      document.title = '';
      window.location.replace('about:blank');
    } catch (e) {
      document.body.innerHTML = '';
    }
  }

  // Anti-iframe
  if (window.self !== window.top) {
    try { window.top.location = window.self.location; } catch (e) { /* cross-origin, leave it */ }
  }

  // Block context menu
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); return false; }, true);

  // Block devtools shortcuts
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F12') { e.preventDefault(); return false; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'E')) { e.preventDefault(); return false; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 's')) { e.preventDefault(); return false; }
  }, true);

  // Anti-copy/drag
  document.addEventListener('copy', function (e) { e.preventDefault(); }, true);
  document.addEventListener('cut', function (e) { e.preventDefault(); }, true);
  document.addEventListener('dragstart', function (e) { e.preventDefault(); }, true);
  document.addEventListener('selectstart', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    e.preventDefault();
  }, true);

  // CSS selection prevention
  var _style = document.createElement('style');
  _style.textContent = '*, *::before, *::after { -webkit-user-select: none !important; user-select: none !important; } input, textarea, [contenteditable] { -webkit-user-select: text !important; user-select: text !important; }';
  (document.head || document.documentElement).appendChild(_style);

  // Console neutralization
  var _noop = function () { return undefined; };
  ['log','debug','info','warn','error','table','trace','dir','dirxml','group','groupEnd','time','timeEnd','count','assert','profile','profileEnd','clear'].forEach(function (m) {
    try { Object.defineProperty(console, m, { value: _noop, writable: false, configurable: false }); } catch (e) {}
  });

  // Block CORS proxies
  var _origFetch = window.fetch;
  window.fetch = function () {
    var url = arguments[0];
    if (typeof url === 'string' || url instanceof URL) {
      var s = url.toString();
      if (s.includes('cors-anywhere') || s.includes('allorigins') || s.includes('cors.sh')) {
        return Promise.reject(new TypeError('Network request failed'));
      }
    }
    return _origFetch.apply(this, arguments);
  };

  // Source protection
  var _origToStr = Function.prototype.toString;
  Function.prototype.toString = function () {
    if (this === _0xN) return 'function () { [native code] }';
    return _origToStr.call(this);
  };

})();
