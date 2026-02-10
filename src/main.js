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

  /**
   * Main game loop
   */
  var mainLoop = function () {
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

    // Execute game state
    Game.FSM.execute();

    // Upgrade fractal ships based on score milestones
    checkFractalUpgrades();

    // Debug grid
    if (KEY_STATUS.g) {
      drawDebugGrid(context, grid);
    }

    // Calculate delta time
    var thisFrame = Date.now();
    var elapsed = thisFrame - lastFrame;
    lastFrame = thisFrame;
    var delta = elapsed / 30;

    // Update sprites (but not during waiting state)
    var inWaiting = Game.FSM.state === 'waiting';
    for (var i = 0; i < Game.sprites.length; i++) {
      var sprite = Game.sprites[i];
      if (!inWaiting) {
        context.strokeStyle = strokeForSpriteName(sprite.name);
        sprite.run(delta);
        
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

    // Level transition overlay
    if (window.LevelTransitionManager) {
      LevelTransitionManager.render(context);
    }

    // HUD should only be visible during active gameplay
    if (window.HUD && typeof HUD.show === 'function' && typeof HUD.hide === 'function') {
      if (Game.FSM.state === 'run') HUD.show();
      else HUD.hide();
    }
    if (Game.FSM.state === 'run') {
      drawHUD(context, extraDude);
    }

    // Additive bloom/glow overlay for extra punch
    if (bloomEnabled) {
      applyGlowBloom();
    }

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
        fpsReadout.textContent = 'FPS: ' + avgFramerate;
      }
    }

    // On-canvas FPS overlay (top-right corner, always visible when enabled)
    if (fpsEnabled && avgFramerate > 0) {
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
