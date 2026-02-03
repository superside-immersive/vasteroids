/**
 * Input Handler
 * Manages keyboard input events
 */

(function() {
  var fpsToggleLatch = false;

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
    if (KEY_CODES[e.keyCode]) {
      e.preventDefault();
      KEY_STATUS[KEY_CODES[e.keyCode]] = true;

      // Toggle FPS display on first keydown only (avoid key repeat)
      if (KEY_CODES[e.keyCode] === 'f' && !fpsToggleLatch) {
        fpsToggleLatch = true;
        if (window.toggleFpsDisplay && typeof window.toggleFpsDisplay === 'function') {
          window.toggleFpsDisplay();
        }
      }
    }
  }).keyup(function (e) {
    if (e.target && e.target.tagName === 'INPUT') { return; }
    KEY_STATUS.keyDown = false;
    if (KEY_CODES[e.keyCode]) {
      e.preventDefault();
      KEY_STATUS[KEY_CODES[e.keyCode]] = false;

      if (KEY_CODES[e.keyCode] === 'f') {
        fpsToggleLatch = false;
      }
    }
  });
})();
