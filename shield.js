/**
 * LIDLT Shield — Anti-reverse-engineering layer
 * Runs before any app code. Self-contained, no dependencies.
 */
(function () {
  'use strict';
  window.__s = true;

  // ═══════════════════════════════════════════════════════
  // 1. DEVTOOLS DETECTION & DETERRENCE
  // ═══════════════════════════════════════════════════════

  var _0x1 = 0;
  var _0x2 = false;

  // Detect devtools via debugger timing
  function _0xCheck() {
    var a = performance.now();
    debugger;
    var b = performance.now();
    if (b - a > 50) {
      _0x1++;
      if (_0x1 > 2 && !_0x2) {
        _0x2 = true;
        _0xNuke();
      }
    }
  }

  // Detect devtools via console profiling
  var _0xImg = new Image();
  Object.defineProperty(_0xImg, 'id', {
    get: function () {
      _0x1++;
      if (_0x1 > 1 && !_0x2) {
        _0x2 = true;
        _0xNuke();
      }
    }
  });

  // Periodic devtools check via outer/inner window size diff
  function _0xSizeCheck() {
    var w = window.outerWidth - window.innerWidth > 160;
    var h = window.outerHeight - window.innerHeight > 160;
    if (w || h) {
      _0x1++;
      if (_0x1 > 3 && !_0x2) {
        _0x2 = true;
        _0xNuke();
      }
    }
  }

  // Nuke: destroy page content when devtools detected
  function _0xNuke() {
    try {
      document.documentElement.innerHTML = '';
      document.title = '';
      window.location.replace('about:blank');
    } catch (e) {
      // fallback
      document.body.innerHTML = '';
    }
  }

  // Run checks periodically
  setInterval(_0xCheck, 3000);
  setInterval(_0xSizeCheck, 2000);
  setInterval(function () { console.log(_0xImg); }, 4000);
  // Initial delayed check
  setTimeout(_0xCheck, 1000);

  // ═══════════════════════════════════════════════════════
  // 2. CONSOLE NEUTRALIZATION
  // ═══════════════════════════════════════════════════════

  var _0xNoop = function () { return undefined; };
  var _methods = ['log', 'debug', 'info', 'warn', 'error', 'table', 'trace', 'dir', 'dirxml', 'group', 'groupEnd', 'time', 'timeEnd', 'count', 'assert', 'profile', 'profileEnd'];

  _methods.forEach(function (m) {
    try {
      Object.defineProperty(console, m, {
        value: _0xNoop,
        writable: false,
        configurable: false
      });
    } catch (e) { }
  });

  // Trap console.clear to prevent clearing our overrides
  try {
    Object.defineProperty(console, 'clear', {
      value: _0xNoop,
      writable: false,
      configurable: false
    });
  } catch (e) { }

  // ═══════════════════════════════════════════════════════
  // 3. RIGHT-CLICK & KEYBOARD SHORTCUT BLOCKING
  // ═══════════════════════════════════════════════════════

  // Block context menu
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  }, true);

  // Block devtools shortcuts and text selection shortcuts
  document.addEventListener('keydown', function (e) {
    // F12
    if (e.key === 'F12') { e.preventDefault(); return false; }
    // Ctrl+Shift+I / Cmd+Opt+I (Inspector)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') { e.preventDefault(); return false; }
    // Ctrl+Shift+J / Cmd+Opt+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') { e.preventDefault(); return false; }
    // Ctrl+Shift+C (Element picker)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') { e.preventDefault(); return false; }
    // Ctrl+U / Cmd+U (View source)
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); return false; }
    // Ctrl+S / Cmd+S (Save page)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); return false; }
    // Ctrl+Shift+E (Network)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') { e.preventDefault(); return false; }
  }, true);

  // ═══════════════════════════════════════════════════════
  // 4. ANTI-IFRAME / ANTI-EMBED
  // ═══════════════════════════════════════════════════════

  if (window.self !== window.top) {
    try {
      window.top.location = window.self.location;
    } catch (e) {
      _0xNuke();
    }
  }

  // ═══════════════════════════════════════════════════════
  // 5. ANTI-COPY / ANTI-DRAG / ANTI-SELECT
  // ═══════════════════════════════════════════════════════

  document.addEventListener('copy', function (e) { e.preventDefault(); }, true);
  document.addEventListener('cut', function (e) { e.preventDefault(); }, true);
  document.addEventListener('dragstart', function (e) { e.preventDefault(); }, true);
  document.addEventListener('selectstart', function (e) {
    // Allow selection in input/textarea
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    e.preventDefault();
  }, true);

  // CSS-level selection prevention
  var _style = document.createElement('style');
  _style.textContent = '*, *::before, *::after { -webkit-user-select: none !important; -moz-user-select: none !important; -ms-user-select: none !important; user-select: none !important; } input, textarea, [contenteditable] { -webkit-user-select: text !important; -moz-user-select: text !important; user-select: text !important; }';
  (document.head || document.documentElement).appendChild(_style);

  // ═══════════════════════════════════════════════════════
  // 6. SOURCE PROTECTION — Trap & poison toString
  // ═══════════════════════════════════════════════════════

  // Prevent function source inspection
  var _origToStr = Function.prototype.toString;
  Function.prototype.toString = function () {
    // If someone tries to read our shield functions, return noise
    if (this === _0xCheck || this === _0xNuke || this === _0xSizeCheck) {
      return 'function () { [native code] }';
    }
    return _origToStr.call(this);
  };

  // ═══════════════════════════════════════════════════════
  // 7. NETWORK REQUEST PROTECTION
  // ═══════════════════════════════════════════════════════

  // Wrap fetch to block unauthorized origins from reading responses
  var _origFetch = window.fetch;
  window.fetch = function () {
    var url = arguments[0];
    if (typeof url === 'string' || url instanceof URL) {
      var s = url.toString();
      // Block if someone is trying to proxy our API through a different origin
      if (s.includes('cors-anywhere') || s.includes('allorigins') || s.includes('cors.sh')) {
        return Promise.reject(new TypeError('Network request failed'));
      }
    }
    return _origFetch.apply(this, arguments);
  };

  // ═══════════════════════════════════════════════════════
  // 9. TIMING ATTACK DETECTION
  // ═══════════════════════════════════════════════════════

  // Detect if code is being stepped through
  var _0xLast = Date.now();
  setInterval(function () {
    var now = Date.now();
    // If interval is much longer than expected, debugger is pausing execution
    if (now - _0xLast > 5000) {
      _0x1 += 2;
      if (_0x1 > 4 && !_0x2) {
        _0x2 = true;
        _0xNuke();
      }
    }
    _0xLast = now;
  }, 1000);

  // ═══════════════════════════════════════════════════════
  // 10. ANTI-AUTOMATION / HEADLESS BROWSER DETECTION
  // ═══════════════════════════════════════════════════════

  var _0xUA = navigator.userAgent || '';
  var _0xIsLegitBot = /Googlebot|bingbot|Baiduspider|yandex|duckduckbot|facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot/i.test(_0xUA);

  if (!_0xIsLegitBot) {
    var _0xBot = false;
    if (navigator.webdriver) _0xBot = true;
    if (!window.chrome && /Chrome/.test(_0xUA)) _0xBot = true;
    if (navigator.languages && navigator.languages.length === 0) _0xBot = true;

    if (_0xBot) {
      setTimeout(function () {
        document.documentElement.innerHTML = '<html><body></body></html>';
      }, 2000);
    }
  }

})();
