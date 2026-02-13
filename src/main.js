/**
 * Main Application Entry Point
 * Initializes game and runs main loop
 */

$(function () {
  (function initNavDebug() {
    var enabled = false;
    try {
      enabled = localStorage.getItem('debugNav') === '1';
    } catch (e) {
      enabled = false;
    }
    if (!enabled) return;

    var loadN = 1;
    try {
      loadN = Number(sessionStorage.getItem('debugNavLoad') || '0') + 1;
      sessionStorage.setItem('debugNavLoad', String(loadN));
    } catch (e) {}

    console.log('[NavDebug] Load #' + loadN + ' at ' + new Date().toISOString());
    window.addEventListener('pageshow', function (e) {
      console.log('[NavDebug] pageshow, persisted:', !!(e && e.persisted));
    });
    window.addEventListener('pagehide', function (e) {
      console.log('[NavDebug] pagehide, persisted:', !!(e && e.persisted));
    });
    window.addEventListener('beforeunload', function () {
      console.log('[NavDebug] beforeunload');
    });
    window.addEventListener('unload', function () {
      console.log('[NavDebug] unload');
    });
  })();

  // Canvas setup
  var canvas = $("#canvas");
  Game.canvasWidth = canvas[0].width;
  Game.canvasHeight = canvas[0].height;

  var context = canvas[0].getContext("2d");
  var canvasNode = canvas[0];
  var gameContainer = document.getElementById('game-container');

  // Retro TV post-process toggle (scanlines/noise/RGB drift/tracking)
  var retroEnabled = false;
  (function initRetroToggle() {
    try {
      retroEnabled = localStorage.getItem('retroTvEnabled') === '1';
    } catch (e) {
      retroEnabled = false;
    }

    if (window.RetroFX && typeof RetroFX.init === 'function') {
      RetroFX.init(Game.canvasWidth, Game.canvasHeight);
      RetroFX.setEnabled(retroEnabled);
    }

    var btn = document.getElementById('toggle-retro-tv');
    var renderBtn = function () {
      if (!btn) return;
      btn.textContent = retroEnabled ? 'Retro TV: ON' : 'Retro TV: OFF';
      btn.setAttribute('aria-pressed', retroEnabled ? 'true' : 'false');
    };
    renderBtn();

    if (btn) {
      btn.addEventListener('click', function () {
        retroEnabled = !retroEnabled;
        if (window.RetroFX && typeof RetroFX.setEnabled === 'function') {
          RetroFX.setEnabled(retroEnabled);
        }
        try {
          localStorage.setItem('retroTvEnabled', retroEnabled ? '1' : '0');
        } catch (e) {}
        renderBtn();
      });
    }
  })();

  // Offscreen buffer for a quick-and-dirty bloom/glow pass
  var glowCanvas = document.createElement('canvas');
  glowCanvas.width = Game.canvasWidth;
  glowCanvas.height = Game.canvasHeight;
  var glowCtx = glowCanvas.getContext('2d');
  var bloomEnabled = true;

  // FPS display (bottom debug area)
  var fpsEnabled = false;
  var fpsBtn = null;
  var fpsReadout = null;

  (function initFpsUi() {
    // FPS enabled by default; user can toggle off and preference is remembered
    fpsEnabled = true;
    try {
      var stored = localStorage.getItem('fpsEnabled');
      if (stored !== null) fpsEnabled = stored === '1';
    } catch (e) {}

    fpsBtn = document.getElementById('toggle-fps');
    fpsReadout = document.getElementById('fps-readout');

    function renderFpsUi() {
      if (fpsBtn) {
        fpsBtn.textContent = fpsEnabled ? 'FPS: ON' : 'FPS: OFF';
        fpsBtn.setAttribute('aria-pressed', fpsEnabled ? 'true' : 'false');
      }
      if (fpsReadout) {
        fpsReadout.style.display = fpsEnabled ? 'inline-block' : 'none';
      }
    }

    function setFpsEnabled(next) {
      fpsEnabled = !!next;
      try {
        localStorage.setItem('fpsEnabled', fpsEnabled ? '1' : '0');
      } catch (e) {}
      renderFpsUi();
    }

    // Expose for hotkeys
    window.toggleFpsDisplay = function () {
      setFpsEnabled(!fpsEnabled);
    };

    if (fpsBtn) {
      fpsBtn.addEventListener('click', function () {
        setFpsEnabled(!fpsEnabled);
      });
    }

    renderFpsUi();
  })();

  // Text renderer setup
  Text.context = context;
  Text.face = vector_battle;

  // UI overlays
  if (window.HUD) { HUD.init(gameContainer); }
  if (window.Scoreboard) { 
    Scoreboard.init(gameContainer); 
  }
  if (window.GameOverUI) { GameOverUI.init(gameContainer); }

  // Initialize FSM
  Game.FSM = GameFSM;

  // Initialize intro
  IntroManager.init();

  // Grid setup for spatial partitioning
  var grid = initializeGrid();

  // Sprite setup
  Game.sprites = [];
  Sprite.prototype.context = context;
  Sprite.prototype.grid = grid;
  // Each sprite gets its own matrix via lazy getter to avoid prototype pollution
  Sprite.prototype.getMatrix = function() {
    if (!this._matrix) this._matrix = new Matrix(2, 3);
    return this._matrix;
  };

  // Create ship
  var ship = new Ship();
  // Start ship where VAST logo ship icon is (below center, left portion)
  ship.x = Game.canvasWidth * 0.5;
  ship.y = Game.canvasHeight * 0.66;
  Game.sprites.push(ship);

  // Create bullets
  ship.bullets = [];
  for (var i = 0; i < 10; i++) {
    var bull = new Bullet();
    ship.bullets.push(bull);
    Game.sprites.push(bull);
  }
  Game.ship = ship;

  // Create alien
  var bigAlien = new BigAlien();
  bigAlien.setup();
  Game.sprites.push(bigAlien);
  Game.bigAlien = bigAlien;

  // Extra life indicator
  var extraDude = new Ship();
  extraDude.scale = 0.6;
  extraDude.visible = true;
  extraDude.preMove = null;
  extraDude.children = [];

  // Slider to control asteroid character count
  var charSlider = document.getElementById('char-slider');
  var charValue = document.getElementById('char-value');
  if (charSlider && charValue) {
    var applyCharCount = function(val) {
      var v = Math.max(40, Math.min(400, parseInt(val, 10) || ASTEROID_CHAR_COUNT || 200));
      ASTEROID_CHAR_COUNT = v;
      charSlider.value = v;
      charValue.textContent = v;
      // Regenerate existing asteroids to reflect new density
      for (var i = 0; i < Game.sprites.length; i++) {
        var s = Game.sprites[i];
        if (s.name === 'asteroid') {
          s.setSize(v, s.clusterRadius, s.fontSize);
        }
      }
    };

    applyCharCount(ASTEROID_CHAR_COUNT);
    charSlider.addEventListener('input', function(e) { applyCharCount(e.target.value); });
    charSlider.addEventListener('change', function(e) { applyCharCount(e.target.value); });
  }
  
  // Slider to control difficulty increase per wave
  var diffSlider = document.getElementById('difficulty-slider');
  var diffValue = document.getElementById('difficulty-value');
  if (diffSlider && diffValue) {
    // Initialize global difficulty multiplier
    window.DIFFICULTY_INCREASE_PER_WAVE = 0.10; // 10% default
    
    var applyDifficulty = function(val) {
      var v = Math.max(0, Math.min(30, parseInt(val, 10) || 10));
      window.DIFFICULTY_INCREASE_PER_WAVE = v / 100; // Convert to decimal
      diffSlider.value = v;
      diffValue.textContent = v + '%';
    };
    
    applyDifficulty(10);
    diffSlider.addEventListener('input', function(e) { applyDifficulty(e.target.value); });
    diffSlider.addEventListener('change', function(e) { applyDifficulty(e.target.value); });
  }

  // Frame timing
  var paused = false;
  // Framerate display removed
  var avgFramerate = 0;
  var frameCount = 0;
  var elapsedCounter = 0;
  var lastFrame = Date.now();

  // ====================================================================
  // JUICE SYSTEM — screen shake, flash overlay, hitstop, chromatic pulse
  // ====================================================================
  var screenShake = { x: 0, y: 0, intensity: 0, decay: 0.88, trauma: 0 };
  var screenFlash = { alpha: 0, color: '#FFFFFF', decay: 0.06 };
  var hitstop = { frames: 0 }; // freeze game for N render frames on big hits
  var chromaticPulse = { intensity: 0, decay: 0.92 };

  /**
   * Trigger screen shake.
   * @param {number} intensity — max pixel offset (e.g. 6 = gentle, 18 = heavy)
   * @param {number} [duration] — optional trauma seed (0–1). Higher = longer shake.
   */
  function triggerScreenShake(intensity, duration) {
    var t = (typeof duration === 'number') ? duration : Math.min(1, intensity / 20);
    screenShake.trauma = Math.min(1, screenShake.trauma + t);
    screenShake.intensity = Math.max(screenShake.intensity, intensity);
  }

  /**
   * Trigger a brief full-screen colour flash.
   * @param {string} color — CSS colour
   * @param {number} [alpha] — starting opacity (0–1, default 0.35)
   * @param {number} [decayRate] — per-frame alpha subtract (default 0.06)
   */
  function triggerScreenFlash(color, alpha, decayRate) {
    screenFlash.color = color || '#FFFFFF';
    screenFlash.alpha = Math.min(1, typeof alpha === 'number' ? alpha : 0.35);
    screenFlash.decay = typeof decayRate === 'number' ? decayRate : 0.06;
  }

  /**
   * Freeze the game for a few render frames (hitstop).
   * @param {number} frames — freeze frame count (2–8 feels good)
   */
  function triggerHitstop(frames) {
    hitstop.frames = Math.max(hitstop.frames, Math.round(frames) || 0);
  }

  /**
   * Trigger a brief chromatic-aberration pulse on the bloom pass.
   * @param {number} intensity — pixel offset for RGB split (3–8)
   */
  function triggerChromaticPulse(intensity) {
    chromaticPulse.intensity = Math.max(chromaticPulse.intensity, intensity || 4);
  }

  function updateScreenShake() {
    screenShake.trauma *= screenShake.decay;
    if (screenShake.trauma < 0.005) { screenShake.trauma = 0; }
    var t = screenShake.trauma;
    var maxOff = screenShake.intensity * t * t; // quadratic falloff
    screenShake.x = (Math.random() * 2 - 1) * maxOff;
    screenShake.y = (Math.random() * 2 - 1) * maxOff;
    if (t === 0) { screenShake.x = 0; screenShake.y = 0; screenShake.intensity = 0; }
  }

  function drawScreenFlash(ctx) {
    if (screenFlash.alpha <= 0.005) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = screenFlash.alpha;
    ctx.fillStyle = screenFlash.color;
    ctx.fillRect(0, 0, Game.canvasWidth, Game.canvasHeight);
    ctx.restore();
    screenFlash.alpha = Math.max(0, screenFlash.alpha - screenFlash.decay);
  }

  function updateChromaticPulse() {
    chromaticPulse.intensity *= chromaticPulse.decay;
    if (chromaticPulse.intensity < 0.15) { chromaticPulse.intensity = 0; }
  }

  // Expose globally so entities can trigger juice without circular deps
  window.Juice = {
    shake: triggerScreenShake,
    flash: triggerScreenFlash,
    hitstop: triggerHitstop,
    chromatic: triggerChromaticPulse
  };

  var tutorialFlags = {
    dataFragment: false,
    daseFirst: false,
    similarityFirst: false
  };
  var cinematicQueue = [];
  var activeCinematic = null;
  var cinematicTimeScale = 1;
  var cinematicZoom = 1;
  var cinematicTargetTimeScale = 1;
  var cinematicTargetZoom = 1;
  var cinematicFocusResolver = null;
  var cinematicFocusPoint = { x: 0, y: 0 };
  var cinematicFocusInitialized = false;
  var cinematicPanZoomRange = 0.3;
  var CINEMATIC_SETTLE_EPSILON = 0.002;

  function easeOutCubic(t) {
    var p = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - p, 3);
  }

  function easeInOutSine(t) {
    var p = Math.max(0, Math.min(1, t));
    return -(Math.cos(Math.PI * p) - 1) / 2;
  }

  function smoothTo(current, target, elapsedMs, responseMs) {
    var ms = Math.max(1, elapsedMs || 16);
    var factor = 1 - Math.exp(-ms / Math.max(1, responseMs));
    return current + (target - current) * factor;
  }

  function getShipFocusPoint() {
    if (Game.ship && Game.ship.visible) {
      return { x: Game.ship.x, y: Game.ship.y };
    }
    return { x: Game.canvasWidth * 0.5, y: Game.canvasHeight * 0.5 };
  }

  function getResolvedFocusTarget() {
    if (typeof cinematicFocusResolver === 'function') {
      var pt = cinematicFocusResolver();
      if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
        return { x: pt.x, y: pt.y };
      }
    }
    return getShipFocusPoint();
  }

  function getDesiredFocusPoint() {
    if (activeCinematic) {
      var target = getResolvedFocusTarget();
      var ship = getShipFocusPoint();
      var panStart = activeCinematic.panStartMs || 0;
      var panEnd = activeCinematic.panEndMs || panStart;
      var blend = 1;

      if (activeCinematic.elapsedMs <= panStart) {
        blend = 0;
      } else if (activeCinematic.elapsedMs >= panEnd) {
        blend = 1;
      } else {
        var panProgress = (activeCinematic.elapsedMs - panStart) / Math.max(1, panEnd - panStart);
        blend = easeInOutSine(Math.max(0, Math.min(1, panProgress)));
      }

      return {
        x: ship.x + (target.x - ship.x) * blend,
        y: ship.y + (target.y - ship.y) * blend
      };
    }

    return getResolvedFocusTarget();
  }

  function updateFocusPoint(elapsedMs) {
    var desired = getDesiredFocusPoint();
    if (!cinematicFocusInitialized) {
      cinematicFocusPoint.x = desired.x;
      cinematicFocusPoint.y = desired.y;
      cinematicFocusInitialized = true;
      return;
    }

    cinematicFocusPoint.x = smoothTo(cinematicFocusPoint.x, desired.x, elapsedMs, 120);
    cinematicFocusPoint.y = smoothTo(cinematicFocusPoint.y, desired.y, elapsedMs, 120);
  }

  function getSafeFocusPoint() {
    if (!cinematicFocusInitialized) {
      return getDesiredFocusPoint();
    }
    return { x: cinematicFocusPoint.x, y: cinematicFocusPoint.y };
  }

  function enqueueCinematic(config) {
    cinematicQueue.push(config);
  }

  function canStartCinematicNow() {
    if (!Game || !Game.FSM || Game.FSM.state !== 'run') return false;
    if (window.LevelTransitionManager && typeof LevelTransitionManager.isActive === 'function' && LevelTransitionManager.isActive()) {
      return false;
    }
    return true;
  }

  function startNextCinematic() {
    if (activeCinematic || !cinematicQueue.length || !canStartCinematicNow()) return;
    var next = cinematicQueue.shift();
    var totalMs = next.totalMs || 2600;
    var introMs = Math.min(next.introMs || 340, totalMs);
    var outroMs = Math.min(next.outroMs || 380, totalMs);
    var panStartMs = typeof next.panStartMs === 'number' ? Math.max(0, Math.min(totalMs, next.panStartMs)) : 0;
    var panEndLimit = Math.max(panStartMs + 1, totalMs - outroMs);
    var panEndMs = typeof next.panEndMs === 'number'
      ? Math.max(panStartMs + 1, Math.min(totalMs, next.panEndMs))
      : Math.max(panStartMs + 220, Math.round(totalMs * 0.52));
    panEndMs = Math.min(panEndLimit, panEndMs);

    activeCinematic = {
      config: next,
      elapsedMs: 0,
      totalMs: totalMs,
      introMs: introMs,
      outroMs: outroMs,
      targetTimeScale: typeof next.timeScale === 'number' ? next.timeScale : 0.35,
      targetZoom: typeof next.zoom === 'number' ? next.zoom : 1.3,
      focusResolver: next.focusResolver || null,
      panStartMs: panStartMs,
      panEndMs: panEndMs,
      startFocus: getShipFocusPoint()
    };
    cinematicPanZoomRange = Math.max(0.05, activeCinematic.targetZoom - 1);
    cinematicFocusResolver = activeCinematic.focusResolver;
    cinematicFocusPoint.x = activeCinematic.startFocus.x;
    cinematicFocusPoint.y = activeCinematic.startFocus.y;
    cinematicFocusInitialized = true;

    if (window.HUD && typeof HUD.showTutorialCard === 'function' && next.lines && next.lines.length) {
      HUD.showTutorialCard(next.lines, {
        duration: Math.max(1800, activeCinematic.totalMs - 120),
        topPercent: typeof next.cardTopPercent === 'number' ? next.cardTopPercent : 28,
        accent: next.accent || '#1FD9FE',
        targetResolver: function() {
          if (typeof next.focusResolver !== 'function') return null;
          var point = next.focusResolver();
          return worldToScreenPoint(point);
        }
      });
    }

    if (typeof next.onStart === 'function') {
      next.onStart();
    }
  }

  function updateCinematics(elapsedMs) {
    updateFocusPoint(elapsedMs);

    var zoomSettled = Math.abs(cinematicZoom - 1) <= CINEMATIC_SETTLE_EPSILON;
    var timeScaleSettled = Math.abs(cinematicTimeScale - 1) <= 0.01;
    var cameraSettled = zoomSettled && timeScaleSettled;

    if (!activeCinematic) {
      cinematicTargetTimeScale = 1;
      cinematicTargetZoom = 1;

      if (cameraSettled) {
        cinematicFocusResolver = null;
      }

      cinematicTimeScale = smoothTo(cinematicTimeScale, cinematicTargetTimeScale, elapsedMs, 140);
      cinematicZoom = smoothTo(cinematicZoom, cinematicTargetZoom, elapsedMs, 220);

      if (cameraSettled && !activeCinematic) {
        cinematicFocusInitialized = false;
      }

      if (cameraSettled) {
        startNextCinematic();
      }
      return;
    }

    activeCinematic.elapsedMs += elapsedMs;
    var cfg = activeCinematic;
    var total = Math.max(1, cfg.totalMs);
    var introMs = Math.min(cfg.introMs, total);
    var outroMs = Math.min(cfg.outroMs, total);
    var remaining = total - cfg.elapsedMs;

    var inFactor = introMs > 0 ? easeInOutSine(cfg.elapsedMs / introMs) : 1;
    var outFactor = 1;
    if (remaining < outroMs) {
      outFactor = outroMs > 0 ? 1 - easeInOutSine((outroMs - remaining) / outroMs) : 0;
    }
    var blend = Math.max(0, Math.min(1, inFactor * outFactor));

    cinematicTargetTimeScale = 1 + (cfg.targetTimeScale - 1) * blend;
    cinematicTargetZoom = 1 + (cfg.targetZoom - 1) * blend;

    cinematicTimeScale = smoothTo(cinematicTimeScale, cinematicTargetTimeScale, elapsedMs, 130);
    var zoomResponse = cinematicTargetZoom > cinematicZoom ? 260 : 130;
    cinematicZoom = smoothTo(cinematicZoom, cinematicTargetZoom, elapsedMs, zoomResponse);

    if (cfg.elapsedMs >= total || !canStartCinematicNow()) {
      activeCinematic = null;
      cinematicTargetTimeScale = 1;
      cinematicTargetZoom = 1;
      cinematicFocusResolver = null;
      if (window.HUD && typeof HUD.clearTutorialCard === 'function') {
        HUD.clearTutorialCard();
      }
    }
  }

  function getCameraTransformData() {
    var focus = getSafeFocusPoint();
    var centerX = Game.canvasWidth * 0.5;
    var centerY = Game.canvasHeight * 0.5;
    var fx = Math.max(0, Math.min(Game.canvasWidth, focus.x));
    var fy = Math.max(0, Math.min(Game.canvasHeight, focus.y));

    var zoom = cinematicZoom;
    var panRaw = (zoom - 1) / Math.max(0.001, cinematicPanZoomRange);
    var panBlend = easeInOutSine(Math.max(0, Math.min(1, panRaw)));

    var effectiveScale = (1 - panBlend) + (panBlend * zoom);
    var tx = panBlend * (centerX - (zoom * fx));
    var ty = panBlend * (centerY - (zoom * fy));

    return {
      scale: effectiveScale,
      tx: tx,
      ty: ty,
      panBlend: panBlend
    };
  }

  function isCameraTransformActive() {
    var data = getCameraTransformData();
    return Math.abs(data.scale - 1) > CINEMATIC_SETTLE_EPSILON || Math.abs(data.tx) > 0.25 || Math.abs(data.ty) > 0.25;
  }

  function applyWorldZoomTransform(ctx) {
    var data = getCameraTransformData();
    if (Math.abs(data.scale - 1) <= CINEMATIC_SETTLE_EPSILON && Math.abs(data.tx) <= 0.25 && Math.abs(data.ty) <= 0.25) {
      return;
    }
    ctx.translate(data.tx, data.ty);
    ctx.scale(data.scale, data.scale);
  }

  function worldToScreenPoint(worldPoint) {
    if (!worldPoint || typeof worldPoint.x !== 'number' || typeof worldPoint.y !== 'number') {
      return null;
    }

    var data = getCameraTransformData();
    if (Math.abs(data.scale - 1) <= CINEMATIC_SETTLE_EPSILON && Math.abs(data.tx) <= 0.25 && Math.abs(data.ty) <= 0.25) {
      return { x: worldPoint.x, y: worldPoint.y };
    }

    return {
      x: (worldPoint.x * data.scale) + data.tx,
      y: (worldPoint.y * data.scale) + data.ty
    };
  }

  window.GameCinematics = {
    resetRun: function() {
      tutorialFlags.dataFragment = false;
      tutorialFlags.daseFirst = false;
      tutorialFlags.similarityFirst = false;
      cinematicQueue = [];
      activeCinematic = null;
      cinematicTimeScale = 1;
      cinematicZoom = 1;
      cinematicTargetTimeScale = 1;
      cinematicTargetZoom = 1;
      cinematicFocusResolver = null;
      cinematicFocusInitialized = false;
      cinematicPanZoomRange = 0.3;
      cinematicFocusPoint.x = Game.canvasWidth * 0.5;
      cinematicFocusPoint.y = Game.canvasHeight * 0.5;
      // Reset juice state for new run
      screenShake.trauma = 0; screenShake.x = 0; screenShake.y = 0; screenShake.intensity = 0;
      screenFlash.alpha = 0;
      hitstop.frames = 0;
      chromaticPulse.intensity = 0;
      if (window.HUD && typeof HUD.clearTutorialCard === 'function') {
        HUD.clearTutorialCard();
      }
    },
    onDataFragmentSpawn: function(fragment) {
      if (tutorialFlags.dataFragment) return;
      tutorialFlags.dataFragment = true;
      enqueueCinematic({
        id: 'data-fragment',
        totalMs: 4000,
        introMs: 420,
        outroMs: 520,
        timeScale: 0.3,
        zoom: 1.3,
        lines: ['collect data fragments', 'to upgrade DASE MODE'],
        cardTopPercent: 23,
        accent: '#1FD9FE',
        focusResolver: function() {
          if (fragment && fragment.visible) {
            return { x: fragment.x, y: fragment.y };
          }
          return null;
        }
      });
    },
    onDASEFirstActivate: function() {
      if (tutorialFlags.daseFirst) return;
      tutorialFlags.daseFirst = true;
      enqueueCinematic({
        id: 'dase-first',
        totalMs: 3200,
        introMs: 360,
        outroMs: 420,
        timeScale: 0.32,
        zoom: 1.3,
        focusResolver: function() {
          if (Game.ship && Game.ship.visible) {
            return { x: Game.ship.x, y: Game.ship.y };
          }
          return null;
        },
        onStart: function() {
          if (window.HUD && typeof HUD.showDASELogo === 'function') {
            HUD.showDASELogo({ topPercent: 27, holdMs: 1700 });
          }
          if (window.DASEMode && typeof DASEMode.startCinematicDeploy === 'function') {
            DASEMode.startCinematicDeploy();
          }
        }
      });
    },
    onSimilarityPickupSpawn: function(pickup) {
      if (tutorialFlags.similarityFirst) return;
      tutorialFlags.similarityFirst = true;
      enqueueCinematic({
        id: 'similarity-first',
        totalMs: 3000,
        introMs: 320,
        outroMs: 420,
        timeScale: 0.35,
        zoom: 1.3,
        lines: ['collect to start SIMILARITY MODE', 'destroy one color to implode the whole group'],
        cardTopPercent: 22,
        accent: '#1FD9FE',
        focusResolver: function() {
          if (pickup && pickup.visible) {
            return { x: pickup.x, y: pickup.y };
          }
          return null;
        }
      });
    },
    getTimeScale: function() {
      return cinematicTimeScale;
    },
    isActive: function() {
      return !!activeCinematic;
    }
  };

  // RequestAnimationFrame shim
  window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame ||
           window.oRequestAnimationFrame ||
           window.msRequestAnimationFrame ||
           function (callback, element) {
             window.setTimeout(callback, 1000 / 60);
           };
  })();

  /**
   * Upgrade ship visuals every time score crosses threshold
   */
  function checkFractalUpgrades() {
    // Earn 1 "upgrade charge" per 1000 points (no cap), so you can re-upgrade after downgrades
    var earnedSteps = Math.max(0, Math.floor(Game.score / Game.upgradeStepScore));

    // Hits can't exceed earned steps; otherwise we'd go negative forever
    if (Game.upgradeHits > earnedSteps) {
      Game.upgradeHits = earnedSteps;
    }

    var available = earnedSteps - Game.upgradeHits;
    var currentLevel = Math.max(0, Math.min(Game.upgradeMaxLevel, available));

    if (currentLevel > Game.upgradeLevel) {
      Game.upgradeLevel = currentLevel;
      SFX.explosion(); // celebratory bump on gaining an upgrade
    } else {
      Game.upgradeLevel = currentLevel;
    }
  }

  function drawSpriteStatic(sprite) {
    if (!sprite || !sprite.visible || typeof sprite.draw !== 'function') return;

    context.save();
    if (typeof sprite.configureTransform === 'function') {
      sprite.configureTransform();
    }
    sprite.draw();
    context.restore();
  }

  /**
   * Main game loop
   */
  var mainLoop = function () {
    // Calculate delta time first so FSM and gameplay systems can consume current frame pace
    var thisFrame = Date.now();
    var elapsed = thisFrame - lastFrame;
    lastFrame = thisFrame;
    var delta = elapsed / 30;

    // — HITSTOP: skip game logic + hold the current frame —
    if (hitstop.frames > 0) {
      hitstop.frames--;
      // Still run the rAF loop but skip everything else
      requestAnimFrame(mainLoop, canvasNode);
      return;
    }

    // Update juice systems
    updateScreenShake();
    updateChromaticPulse();

    updateCinematics(elapsed);
    var scaledDelta = delta * cinematicTimeScale;
    Game.frameDelta = scaledDelta;
    Game.timeScale = cinematicTimeScale;
    var cinematicActive = !!activeCinematic || isCameraTransformActive() || Math.abs(cinematicTimeScale - 1) > 0.01;
    var gameplayPausedByCinematic = cinematicActive && Game.FSM && Game.FSM.state === 'run';
    Game.cinematicPaused = gameplayPausedByCinematic;

    // Clear canvas
    context.fillStyle = THEME.bg;
    context.fillRect(0, 0, Game.canvasWidth, Game.canvasHeight);
    context.strokeStyle = THEME.primary;
    context.fillStyle = THEME.text;

    // Render intro if not done
    IntroManager.render(context, ship);

    // Render idle animation in waiting state
    if (window.IdleAnimationManager && Game.FSM.state === 'waiting') {
      IdleAnimationManager.render(context);
    }

    // Execute game state (fully paused during cinematic in active gameplay)
    if (!gameplayPausedByCinematic) {
      Game.FSM.execute();
    } else if (window.DASEMode && typeof DASEMode.updateCinematicDeploy === 'function') {
      // Keep only DASE turret build animation progressing during cinematic freeze
      DASEMode.updateCinematicDeploy(delta);
    }

    // Upgrade fractal ships based on score milestones
    if (!gameplayPausedByCinematic) {
      checkFractalUpgrades();
    }

    // Debug grid
    if (KEY_STATUS.g) {
      drawDebugGrid(context, grid);
    }

    // Update sprites (but not during waiting state)
    var inWaiting = Game.FSM.state === 'waiting';

    context.save();
    // Apply screen-shake offset (before world zoom so shake is in screen-space)
    if (screenShake.trauma > 0) {
      context.translate(screenShake.x, screenShake.y);
    }
    applyWorldZoomTransform(context);
    for (var i = 0; i < Game.sprites.length; i++) {
      var sprite = Game.sprites[i];
      if (!inWaiting) {
        context.strokeStyle = strokeForSpriteName(sprite.name);
        if (gameplayPausedByCinematic) {
          drawSpriteStatic(sprite);
        } else {
          sprite.run(scaledDelta);
        }
        
        // Draw Similarity overlay on asteroids
        if (window.SimilarityMode && SimilarityMode.isActive() && sprite.name === 'asteroid' && sprite.visible) {
          SimilarityMode.drawOverlay(context, sprite);
        }
      }

      if (sprite.reap) {
        sprite.reap = false;
        Game.sprites.splice(i, 1);
        i--;
      }
    }
    
    // Draw DASE mode elements (beam, turret, core glow)
    if (window.DASEMode && DASEMode.isActive()) {
      DASEMode.draw(context);
    }
    
    // Draw Similarity implosion particles
    if (window.SimilarityMode && (SimilarityMode.isActive() || SimilarityMode.hasParticles())) {
      SimilarityMode.drawImplosionParticles(context);
    }
    
    // Draw hyperspace particles
    if (Game.hyperspaceParticles && Game.hyperspaceParticles.length > 0) {
      drawHyperspaceParticles(context);
    }
    
    // Draw shockwave effects (spawn/teleport visual feedback)
    if (Game.updateShockwaves) {
      Game.updateShockwaves(context);
    }

    context.restore();

    // Level transition overlay
    if (window.LevelTransitionManager) {
      LevelTransitionManager.render(context);
    }

    // HUD should only be visible during active gameplay
    if (window.HUD && typeof HUD.show === 'function' && typeof HUD.hide === 'function') {
      if (Game.FSM.state === 'run' && !cinematicActive) HUD.show();
      else HUD.hide();
    }
    if (Game.FSM.state === 'run' && !cinematicActive) {
      drawHUD(context, extraDude);
    }

    // Additive bloom/glow overlay for extra punch
    if (bloomEnabled) {
      applyGlowBloom();
    }

    // Chromatic aberration pulse (RGB split on bloom canvas)
    if (chromaticPulse.intensity > 0.15) {
      context.save();
      context.globalCompositeOperation = 'lighter';
      var ci = chromaticPulse.intensity;
      // Red channel shift
      context.globalAlpha = 0.12;
      context.drawImage(canvasNode, ci, 0);
      // Blue channel shift
      context.drawImage(canvasNode, -ci, 0);
      context.restore();
    }

    // Screen flash overlay
    drawScreenFlash(context);

    // Retro TV overlay pass (keeps base colors, adds subtle monitor artifacts)
    if (retroEnabled && window.RetroFX && typeof RetroFX.apply === 'function') {
      RetroFX.apply(context, canvasNode, thisFrame);
    }

    // Update framerate counter
    frameCount++;
    elapsedCounter += elapsed;
    if (elapsedCounter > 1000) {
      elapsedCounter -= 1000;
      avgFramerate = frameCount;
      frameCount = 0;

      // Publish + render FPS (update only once per second)
      window.__vasteroidsAvgFps = avgFramerate;
      if (fpsEnabled && fpsReadout) {
        if (cinematicActive) {
          fpsReadout.style.display = 'none';
        } else {
          fpsReadout.style.display = 'inline-block';
        }
        fpsReadout.textContent = 'FPS: ' + avgFramerate;
      }
    }

    // On-canvas FPS overlay (top-right corner, always visible when enabled)
    if (fpsEnabled && avgFramerate > 0 && !cinematicActive) {
      context.save();
      var fpsText = avgFramerate + ' FPS';
      var fpsColor = avgFramerate >= 55 ? '#00ff88' : avgFramerate >= 30 ? '#ffcc00' : '#ff3333';
      context.font = 'bold 14px monospace';
      context.textAlign = 'right';
      context.textBaseline = 'top';
      // Background pill for readability
      var tw = context.measureText(fpsText).width;
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(Game.canvasWidth - tw - 18, 8, tw + 12, 22);
      // FPS text
      context.fillStyle = fpsColor;
      context.fillText(fpsText, Game.canvasWidth - 12, 12);
      context.restore();
    }

    // Continue loop or show pause
    if (paused) {
      Text.renderText('PAUSED', 72, Game.canvasWidth / 2 - 160, 120);
    } else {
      requestAnimFrame(mainLoop, canvasNode);
    }
  };

  /**
   * Initialize spatial partitioning grid
   * @returns {Array} - 2D grid array
   */
  function initializeGrid() {
    var gridWidth = Math.round(Game.canvasWidth / GRID_SIZE);
    var gridHeight = Math.round(Game.canvasHeight / GRID_SIZE);
    var grid = new Array(gridWidth);

    for (var i = 0; i < gridWidth; i++) {
      grid[i] = new Array(gridHeight);
      for (var j = 0; j < gridHeight; j++) {
        grid[i][j] = new GridNode();
      }
    }

    // Set up positional references
    for (var i = 0; i < gridWidth; i++) {
      for (var j = 0; j < gridHeight; j++) {
        var node = grid[i][j];
        node.north = grid[i][(j == 0) ? gridHeight - 1 : j - 1];
        node.south = grid[i][(j == gridHeight - 1) ? 0 : j + 1];
        node.west = grid[(i == 0) ? gridWidth - 1 : i - 1][j];
        node.east = grid[(i == gridWidth - 1) ? 0 : i + 1][j];
      }
    }

    // Set up borders for screen wrapping
    for (var i = 0; i < gridWidth; i++) {
      grid[i][0].dupe.vertical = Game.canvasHeight;
      grid[i][gridHeight - 1].dupe.vertical = -Game.canvasHeight;
    }

    for (var j = 0; j < gridHeight; j++) {
      grid[0][j].dupe.horizontal = Game.canvasWidth;
      grid[gridWidth - 1][j].dupe.horizontal = -Game.canvasWidth;
    }

    return grid;
  }

  /**
   * Simple post-process bloom using a blurred copy of the frame
   */
  function applyGlowBloom() {
    glowCtx.clearRect(0, 0, Game.canvasWidth, Game.canvasHeight);
    glowCtx.filter = 'blur(7px) brightness(1.35)';
    glowCtx.globalCompositeOperation = 'source-over';
    glowCtx.drawImage(canvasNode, 0, 0);
    glowCtx.filter = 'none';

    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = 0.35;
    context.drawImage(glowCanvas, 0, 0);
    context.restore();
  }

  /**
   * Draw debug grid overlay
   */
  function drawDebugGrid(ctx, grid) {
    var gridWidth = grid.length;
    var gridHeight = grid[0].length;

    ctx.beginPath();
    for (var i = 0; i < gridWidth; i++) {
      ctx.moveTo(i * GRID_SIZE, 0);
      ctx.lineTo(i * GRID_SIZE, Game.canvasHeight);
    }
    for (var j = 0; j < gridHeight; j++) {
      ctx.moveTo(0, j * GRID_SIZE);
      ctx.lineTo(Game.canvasWidth, j * GRID_SIZE);
    }
    ctx.closePath();
    ctx.strokeStyle = THEME.muted;
    ctx.stroke();
  }
  
  /**
   * Draw hyperspace particles (departure/arrival effects)
   */
  function drawHyperspaceParticles(ctx) {
    if (!Game.hyperspaceParticles) return;
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    for (var i = Game.hyperspaceParticles.length - 1; i >= 0; i--) {
      var p = Game.hyperspaceParticles[i];
      
      // Update particle
      if (p.type === 'departure') {
        // Exploding outward
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
      } else {
        // Converging inward
        p.x += (p.targetX - p.x) * 0.15;
        p.y += (p.targetY - p.y) * 0.15;
      }
      
      p.life -= 0.03;
      
      // Remove dead particles
      if (p.life <= 0) {
        Game.hyperspaceParticles.splice(i, 1);
        continue;
      }
      
      // Draw particle with glow
      var alpha = p.life;
      var size = p.size * p.life;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      
      // Convert hex to rgba
      var hex = p.color;
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
      ctx.fill();
      
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10 * alpha;
    }
    
    ctx.restore();
  }

  /**
   * Draw heads-up display (score, wave, hyperspace, DASE meter)
   */
  function drawHUD(ctx, extraDude) {
    HUD.updateScore(Game.score);
    HUD.updateWave(Game.currentWave || 1);
    HUD.updateHyperspace(Game.hyperspaceJumps);
    HUD.updateDASEMeter();
    HUD.updateAchievementBadge();
    HUD.updateCombo();
  }

  // Start game loop
  mainLoop();

  // Keyboard controls
  $(window).keydown(function (e) {
    switch (KEY_CODES[e.keyCode]) {
      case 'm':
        SFX.muted = !SFX.muted;
        break;
    }
  });
});
