/**
 * Input Handler
 * Manages keyboard input events
 */

(function() {
  var fpsToggleLatch = false;

  // Modern key mapping fallback (e.code / e.key) for consistent key handling
  var CODE_MAP = {
    'ShiftLeft': 'shift', 'ShiftRight': 'shift',
    'Space': 'space',
    'ArrowLeft': 'left',
    'ArrowUp': 'up',
    'ArrowRight': 'right',
    'ArrowDown': 'down',
    'KeyF': 'f',
    'KeyG': 'g',
    'KeyH': 'h',
    'KeyM': 'm'
  };
  var KEY_MAP = {
    'Shift': 'shift',
    ' ': 'space',
    'ArrowLeft': 'left',
    'ArrowUp': 'up',
    'ArrowRight': 'right',
    'ArrowDown': 'down',
    'f': 'f', 'F': 'f',
    'g': 'g', 'G': 'g',
    'h': 'h', 'H': 'h',
    'm': 'm', 'M': 'm'
  };

  function resolveKey(e) {
    // Try legacy keyCode first, then modern e.code, then e.key
    if (e.keyCode && KEY_CODES[e.keyCode]) return KEY_CODES[e.keyCode];
    if (e.code && CODE_MAP[e.code]) return CODE_MAP[e.code];
    if (e.key && KEY_MAP[e.key]) return KEY_MAP[e.key];
    return null;
  }

  // Unlock audio on first user gesture (required by most browsers)
  $(window).one('keydown mousedown touchstart', function () {
    if (window.SFX && typeof SFX.unlock === 'function') {
      try { SFX.unlock(); } catch (e) {}
    }
  });

  // Set up keyboard event listeners
  $(window).keydown(function (e) {
    if (e.target && e.target.tagName === 'INPUT') { return; }
    KEY_STATUS.keyDown = true;
    var mapped = resolveKey(e);
    if (mapped) {
      e.preventDefault();
      KEY_STATUS[mapped] = true;

      // Toggle FPS display on first keydown only (avoid key repeat)
      if (mapped === 'f' && !fpsToggleLatch) {
        fpsToggleLatch = true;
        if (window.toggleFpsDisplay && typeof window.toggleFpsDisplay === 'function') {
          window.toggleFpsDisplay();
        }
      }
    }
  }).keyup(function (e) {
    if (e.target && e.target.tagName === 'INPUT') { return; }
    KEY_STATUS.keyDown = false;
    var mapped = resolveKey(e);
    if (mapped) {
      e.preventDefault();
      KEY_STATUS[mapped] = false;

      if (mapped === 'f') {
        fpsToggleLatch = false;
      }
    }
  });

})();
