/**
 * Input Handler
 * Manages keyboard input events
 */

(function() {
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
    }
  }).keyup(function (e) {
    if (e.target && e.target.tagName === 'INPUT') { return; }
    KEY_STATUS.keyDown = false;
    if (KEY_CODES[e.keyCode]) {
      e.preventDefault();
      KEY_STATUS[KEY_CODES[e.keyCode]] = false;
    }
  });
})();
