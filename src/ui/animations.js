/* Anime.js helper utilities and level transition renderer */

var Animations = (function() {
  function pulse(targets, opts) {
    // Smooth breathing pulse for buttons
    return anime(Object.assign({
      targets: targets,
      scale: [1, 1.05, 1],
      opacity: [0.85, 1, 0.85],
      duration: 1800,
      easing: 'easeInOutSine',
      loop: true
    }, opts || {}));
  }

  function pulseGlow(targets, opts) {
    // Elegant glow pulse with text-shadow animation
    return anime(Object.assign({
      targets: targets,
      scale: [1, 1.03, 1],
      opacity: [0.8, 1, 0.8],
      textShadow: [
        '0 0 8px rgba(124, 240, 255, 0.4)',
        '0 0 20px rgba(124, 240, 255, 0.8), 0 0 40px rgba(31, 217, 254, 0.4)',
        '0 0 8px rgba(124, 240, 255, 0.4)'
      ],
      duration: 2000,
      easing: 'easeInOutSine',
      loop: true
    }, opts || {}));
  }

  function fadeIn(targets, opts) {
    return anime(Object.assign({
      targets: targets,
      opacity: [0, 1],
      duration: 450,
      easing: 'easeOutQuad'
    }, opts || {}));
  }

  function fadeOut(targets, opts) {
    return anime(Object.assign({
      targets: targets,
      opacity: [1, 0],
      duration: 450,
      easing: 'easeInQuad'
    }, opts || {}));
  }

  function staggerLetters(el, text, opts) {
    if (!el) return null;
    el.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var span = document.createElement('span');
      span.textContent = text[i];
      span.style.display = 'inline-block';
      span.style.opacity = '0';
      frag.appendChild(span);
    }
    el.appendChild(frag);
    return anime(Object.assign({
      targets: el.children,
      opacity: [0, 1],
      translateY: [8, 0],
      delay: anime.stagger(40),
      duration: 320,
      easing: 'easeOutCubic'
    }, opts || {}));
  }

  return {
    pulse: pulse,
    pulseGlow: pulseGlow,
    fadeIn: fadeIn,
    fadeOut: fadeOut,
    staggerLetters: staggerLetters
  };
})();

var LevelTransitionManager = (function() {
  var active = false;
  var startTime = 0;
  // Shorter transition: rotate ship first, then stars
  // Total transition time = duration + tail (ms)
  // Reduced: ~3 seconds total
  var duration = 2400;
  var tail = 600;
  // Start stars after rotation completes
  var starDelay = 600;
  var stars = [];
  var waveBanner = { show: false, wave: 1, alpha: 0 };
  var shipOverlay = {
    active: false,
    ship: null,
    origin: null,
    rot: 0,
    yOffset: 0,
    scale: 1,
    alpha: 1,
    textArmed: false
  };

  function createStars(count) {
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Game.canvasWidth + Math.random() * Game.canvasWidth * 0.6, // Start from right
        y: Math.random() * Game.canvasHeight,
        speed: 4 + Math.random() * 6,
        len: 10 + Math.random() * 18,
        alpha: 0.35 + Math.random() * 0.45
      });
    }
  }

  function start(ship, waveNumber) {
    active = true;
    startTime = Date.now();
    createStars(90);
    setupShipOverlay(ship);
    // Show wave banner
    waveBanner.show = true;
    waveBanner.wave = (waveNumber || Game.currentWave || 1) + 1; // +1 because we're going TO next wave
    waveBanner.alpha = 0;
  }

  function setupShipOverlay(ship) {
    if (!ship) return;
    shipOverlay.ship = ship;
    shipOverlay.origin = {
      x: ship.x,
      y: ship.y,
      rot: ship.rot,
      visible: ship.visible,
      scale: ship.scale,
      velX: ship.vel && ship.vel.x,
      velY: ship.vel && ship.vel.y
    };
    shipOverlay.active = true;
    shipOverlay.rot = ship.rot;
    // Keep ship in place; only rotate
    shipOverlay.yOffset = 0;
    shipOverlay.scale = ship.scale;
    shipOverlay.alpha = 1;
    shipOverlay.textArmed = false;
    
    // FREEZE ship completely - store fixed position
    shipOverlay.frozenX = ship.x;
    shipOverlay.frozenY = ship.y;

    ship.vel.x = 0;
    ship.vel.y = 0;
    ship.acc.x = 0;
    ship.acc.y = 0;
    // Keep real ship visible to avoid pop-out perception
    ship.visible = true;

    var timeline = anime.timeline({ autoplay: true });
    // Rotate ship to point RIGHT (match calibrated forward vector)
    timeline.add({
      targets: shipOverlay,
      rot: 29.1, // Point right (compensate cyan tip offset)
      duration: 900,
      easing: 'easeOutCubic'
    });

    timeline.finished.then(function() {
      shipOverlay.textArmed = true;
    });
  }

  function render(ctx) {
    if (!active) return;
    var elapsed = Date.now() - startTime;
    var total = (duration + tail);
    var progress = elapsed / total;
    if (progress >= 1) {
      active = false;
      finishShipOverlay();
      return;
    }

    // Fade out elegantly during the last tail segment
    var fadeFactor = 1;
    if (elapsed > duration) {
      fadeFactor = (total - elapsed) / Math.max(1, tail);
      if (fadeFactor < 0) fadeFactor = 0;
      if (fadeFactor > 1) fadeFactor = 1;
    }

    // Stars only appear after ship rotation begins
    var starElapsed = Math.max(0, elapsed - starDelay);
    var starProgress = starElapsed / Math.max(1, (total - starDelay));
    if (starProgress > 1) starProgress = 1;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;

    if (starElapsed > 0) {
      ctx.globalAlpha = fadeFactor;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.x -= s.speed * (1.0 + starProgress * 2.4); // Move LEFT
        var len = s.len * (1.0 + starProgress * 1.2);
        var y = s.y + Math.sin(starProgress * 3 + i * 0.5) * 1.2; // subtle drift
        var x1 = s.x;
        var x2 = s.x + len; // Horizontal trail

        ctx.strokeStyle = 'rgba(124, 240, 255,' + (s.alpha * (1 - starProgress * 0.15)) + ')';
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y); // Horizontal line
        ctx.stroke();

        // Recycle stars from right when they exit left
        if (x2 < -80) {
          s.x = Game.canvasWidth + Math.random() * Game.canvasWidth * 0.6;
          s.y = Math.random() * Game.canvasHeight;
          s.alpha = 0.35 + Math.random() * 0.45;
          s.speed = 4 + Math.random() * 6;
          s.len = 10 + Math.random() * 18;
        }
      }
    }

    // Ship overlay: only drive rotation (avoid teleport/movement)
    if (shipOverlay.active && shipOverlay.ship) {
      var ship = shipOverlay.ship;
      ship.rot = shipOverlay.rot;
      // FREEZE position - keep ship exactly where it was
      ship.x = shipOverlay.frozenX;
      ship.y = shipOverlay.frozenY;
      ship.vel.x = 0;
      ship.vel.y = 0;
      ship.acc.x = 0;
      ship.acc.y = 0;
    }
    
    // Move uncollected data fragments to the left (ship is going right)
    for (var i = 0; i < Game.sprites.length; i++) {
      var sprite = Game.sprites[i];
      if (sprite.visible && sprite.name === 'datafragment') {
        sprite.x -= 8; // Move left quickly
      }
    }
    
    // Position turret behind ship (to the left) if DASE is active
    if (window.DASEMode && DASEMode.isActive() && DASEMode.turret) {
      var turret = DASEMode.turret;
      // Position to the LEFT of ship (behind, since ship faces right)
      turret.x = shipOverlay.frozenX - turret.orbitRadius;
      turret.y = shipOverlay.frozenY;
    }
    
    // Draw WAVE banner with INGEST RATE INCREASING per flowchart spec
    if (waveBanner.show) {
      waveBanner.alpha = Math.min(1, waveBanner.alpha + 0.05);
      ctx.save();
      ctx.globalAlpha = waveBanner.alpha * fadeFactor;
      ctx.font = 'bold 72px "Vector Battle", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1FD9FE';
      ctx.shadowColor = '#1FD9FE';
      ctx.shadowBlur = 20;
      ctx.fillText('WAVE ' + waveBanner.wave, Game.canvasWidth / 2, Game.canvasHeight / 2 - 50);
      // Secondary text per flowchart
      ctx.font = 'bold 28px "Vector Battle", monospace';
      ctx.fillStyle = '#06D69F';
      ctx.shadowColor = '#06D69F';
      ctx.shadowBlur = 15;
      ctx.fillText('INGEST RATE INCREASING', Game.canvasWidth / 2, Game.canvasHeight / 2 + 20);
      ctx.restore();
    }

    ctx.restore();
  }

  function isActive() { return active; }

  function finishShipOverlay() {
    if (!shipOverlay.active || !shipOverlay.ship) return;
    // Restore original ship state (don't force a fixed rotation)
    shipOverlay.ship.visible = true;
    if (shipOverlay.origin) {
      shipOverlay.ship.x = shipOverlay.origin.x;
      shipOverlay.ship.y = shipOverlay.origin.y;
      shipOverlay.ship.rot = shipOverlay.origin.rot;
      shipOverlay.ship.scale = shipOverlay.origin.scale;
    }
    if (shipOverlay.ship.vel) {
      shipOverlay.ship.vel.x = 0;
      shipOverlay.ship.vel.y = 0;
    }
    shipOverlay.active = false;
  }

  function reset() {
    active = false;
    startTime = 0;
    waveBanner.show = false;
    waveBanner.alpha = 0;
    finishShipOverlay();
    shipOverlay.ship = null;
  }

  // Hook into lifecycle end
  var originalIsActive = isActive;
  isActive = function() {
    if (!active) {
      finishShipOverlay();
    }
    return active;
  };

  function resetShipOverlayIfDone() {
    if (!active) {
      finishShipOverlay();
    }
  }

  return {
    start: start,
    render: render,
    isActive: isActive,
    reset: reset,
    _finishShipOverlay: finishShipOverlay,
    _resetShipOverlayIfDone: resetShipOverlayIfDone
  };
})();

var IdleAnimationManager = (function() {
  var active = false;
  var stars = [];
  var textState = { x: 0, alpha: 1 };
  var textTimeline = null;
  var textStarted = false;
  var cycleCount = 0;

  function createStars(count) {
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Game.canvasWidth + Math.random() * 100,
        y: Math.random() * Game.canvasHeight,
        speed: 2 + Math.random() * 4,
        len: 6 + Math.random() * 12,
        alpha: 0.25 + Math.random() * 0.35
      });
    }
  }

  function resetTextState() {
    textState.x = Game.canvasWidth + 200;
    textState.alpha = 1;
    textStarted = false;
    cycleCount = 0;
    if (textTimeline) {
      try { textTimeline.pause(); } catch(e) {}
    }
    textTimeline = null;
  }

  function start() {
    if (active) return;
    active = true;
    createStars(60);
    resetTextState();
  }

  function startTextCycle() {
    if (textTimeline || !active) return;

    var startX = Game.canvasWidth + 200;
    var endX = -400;

    textStarted = true;
    textState.x = startX;
    textState.alpha = 1;

    textTimeline = anime.timeline({ loop: false });
    textTimeline
      .add({
        targets: textState,
        x: [startX, endX],
        duration: 6000,
        easing: 'linear'
      });

    textTimeline.finished.then(function() {
      if (!active) return;
      cycleCount++;
      textTimeline = null;
      textStarted = false;
      textState.x = startX;
      
      // Small delay before next cycle
      setTimeout(function() {
        if (active) {
          startTextCycle();
        }
      }, 1200);
    });
  }

  function stop() {
    active = false;
    resetTextState();
  }

  function maybeStartTextCycle() {
    if (textTimeline || !active) return;
    startTextCycle();
  }

  function render(ctx) {
    if (!active) return;

    // Ensure scoreboard is initialized (some embeds may skip init ordering)
    if (window.Scoreboard && typeof Scoreboard.ensureInit === 'function') {
      if (typeof Scoreboard.isReady !== 'function' || !Scoreboard.isReady()) {
        Scoreboard.ensureInit(document.getElementById('game-container'));
      }
    }

    maybeStartTextCycle();

    // Always render stars (moving right to left)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x -= s.speed;
      var y = s.y + Math.sin(Date.now() * 0.0005 + i) * 0.8;
      var x1 = s.x;
      var x2 = s.x + s.len;

      ctx.strokeStyle = 'rgba(124, 240, 255,' + s.alpha + ')';
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      // Recycle from right when exiting left
      if (x2 < -60) {
        s.x = Game.canvasWidth + Math.random() * 100;
        s.y = Math.random() * Game.canvasHeight;
      }
    }

    ctx.restore();
  }

  function isActive() { return active; }
  function isTextVisible() { return textStarted && textState.x > -300 && textState.x < Game.canvasWidth + 100; }

  return {
    start: start,
    stop: stop,
    render: render,
    isActive: isActive,
    isTextVisible: isTextVisible
  };
})();
