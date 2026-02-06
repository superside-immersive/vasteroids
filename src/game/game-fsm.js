/**
 * Game State Machine
 * Handles game states and transitions
 */

var GameFSM = {
  timer: null,
  state: 'boot',
  _startRequested: false,
  _restartArmed: false,

  /**
   * Initial boot state
   */
  boot: function () {
    Game.spawnAsteroids(5);
    if (window.IntroManager && typeof IntroManager.reset === 'function') {
      IntroManager.reset();
    }
    // Restart scoreboard auto-show for idle mode
    if (window.Scoreboard && typeof Scoreboard.startAutoShow === 'function') {
      Scoreboard.setSuppressed(false);
      Scoreboard.startAutoShow();
    }
    Game.skipWaiting = false;
    this._startRequested = false;
    this.state = 'waiting';
  },

  /**
   * Waiting for player to start
   */
  waiting: function () {
    if (window.GameOverUI) {
      GameOverUI.hide();
    }
    // Ensure intro is ready each time we land in waiting
    if (window.IntroManager && IntroManager.state && IntroManager.state.done) {
      IntroManager.reset();
      Game.skipWaiting = false;
    }
    // Start idle animation while waiting (but not during the START intro sequence)
    if (!this._startRequested && window.IdleAnimationManager && !IdleAnimationManager.isActive()) {
      IdleAnimationManager.start();
    }

    if (!this._startRequested && window.Scoreboard) {
      if (typeof Scoreboard.setSuppressed === 'function') {
        Scoreboard.setSuppressed(false);
      }
      if (typeof Scoreboard.isAutoShowActive === 'function' && !Scoreboard.isAutoShowActive()) {
        Scoreboard.startAutoShow();
      }
    }

    // User pressed START/Space: play intro zoom-in (do not instantly hide logo).
    if (!this._startRequested && (KEY_STATUS.space || window.gameStart)) {
      KEY_STATUS.space = false;
      window.gameStart = false;
      this._startRequested = true;
      if (window.SFX && SFX.menuSelect) {
        SFX.menuSelect();
      }
      Game.skipWaiting = false;
      if (window.Scoreboard) {
        Scoreboard.setSuppressed(true);
        Scoreboard.hide(true);
        Scoreboard.stopAutoShow();
      }
      if (window.IdleAnimationManager) { IdleAnimationManager.stop(); }
      if (window.IntroManager && typeof IntroManager.requestPlay === 'function') {
        IntroManager.reset();
        IntroManager.requestPlay();
      }
    }

    // Intro signals when to begin the game.
    if (this._startRequested && Game.skipWaiting) {
      Game.skipWaiting = false;
      this._startRequested = false;

      // Prevent a one-frame flash of the "waiting" asteroids/UFO when we switch out of waiting.
      for (var i = 0; i < Game.sprites.length; i++) {
        var s = Game.sprites[i];
        if (s && (s.name === 'asteroid' || s.name === 'bigalien' || s.name === 'alienbullet')) {
          s.visible = false;
        }
      }

      this.state = 'start';
    }
  },

  /**
   * Start a new game
   */
  start: function () {
    if (window.LevelTransitionManager && typeof LevelTransitionManager.reset === 'function') {
      LevelTransitionManager.reset();
    }
    if (window.Scoreboard) { 
      Scoreboard.hide(true); // Force hide immediately
      Scoreboard.stopAutoShow(); // Stop auto-show during gameplay
    }
    if (window.GameOverUI) { GameOverUI.hide(); }
    if (window.IdleAnimationManager) { IdleAnimationManager.stop(); }
    // Clear existing asteroids
    for (var i = 0; i < Game.sprites.length; i++) {
      if (Game.sprites[i].name == 'asteroid') {
        // Avoid one-frame flicker by hiding immediately
        Game.sprites[i].visible = false;
        Game.sprites[i].die();
      } else if (Game.sprites[i].name == 'bullet' ||
                 Game.sprites[i].name == 'bigalien') {
        Game.sprites[i].visible = false;
      } else if (Game.sprites[i].name == 'alienbullet') {
        Game.sprites[i].visible = false;
      } else if (Game.sprites[i].name == 'datafragment' ||
                 Game.sprites[i].name == 'silo' ||
                 Game.sprites[i].name == 'similaritypickup' ||
                 Game.sprites[i].name == 'turretbullet') {
        Game.sprites[i].visible = false;
        Game.sprites[i].die();
      }
    }

    Game.initNewGame();
    Game.totalAsteroids = 2;
    Game.spawnAsteroids();

    Game.nextBigAlienTime = Date.now() + 30000 + (30000 * Math.random());

    // Play game start sound
    SFX.gameStart();
    
    this._showInstructionBillboard = true;
    this.state = 'spawn_ship';
  },

  /**
   * Spawn player ship
   */
  spawn_ship: function () {
    // Reset ship to VAST logo icon position (match intro logo - same formula as _drawVastLogo)
    var aspectRatio = IntroManager && IntroManager.vastLogoSize
      ? (IntroManager.vastLogoSize.w / IntroManager.vastLogoSize.h)
      : (242.201 / 60);
    // Use fixed 540-based reference so ship size is same in both orientations
    var REF = 540;
    var logoWidth = REF * 0.35;
    var logoHeight = logoWidth / aspectRatio;
    var logoX = (Game.canvasWidth - logoWidth) / 2;
    var isLandscape = Game.canvasWidth > Game.canvasHeight;
    var logoY = isLandscape ? (Game.canvasHeight * 0.58) : (Game.canvasHeight * 0.50);
    // Pivot is at (34.5, 23.5) in viewBox coordinates - scale to match drawn logo
    var vastLogoSize = IntroManager && IntroManager.vastLogoSize ? IntroManager.vastLogoSize : { w: 242.201, h: 60 };
    var scaleX = logoWidth / vastLogoSize.w;
    var scaleY = logoHeight / vastLogoSize.h;
    Game.ship.x = logoX + (34.5 * scaleX);
    Game.ship.y = logoY + (23.5 * scaleY);

    // Create shockwave effect that clears asteroids (visible feedback)
    var spawnClearRadius = 100;
    Game.shockwaveAt(Game.ship.x, Game.ship.y, spawnClearRadius, '#1FD9FE');

    // Keep ship visible immediately; state gate controls when it can move/shoot.
    Game.ship.visible = true;
    var startRot = (typeof window.SHIP_START_ROT_DEG !== 'undefined') ? window.SHIP_START_ROT_DEG : 0;
    Game.ship.rot = startRot;
    Game.ship.vel.x = 0;
    Game.ship.vel.y = 0;
    // Scale ship to match logo icon height
    var shipBaseHeight = SHIP_BODY_HEIGHT;
    Game.ship.scale = (logoHeight * 0.95) / shipBaseHeight;
    
    // Activate protective shield for 3 seconds on respawn
    Game.ship.protectiveShield = 180; // 3 seconds at 60fps
    Game.ship.protectiveShieldRadius = 56;

    if (window.HUD && typeof HUD.showInstructionBillboard === 'function' && this._showInstructionBillboard !== false) {
      HUD.showInstructionBillboard();
    }
    this._showInstructionBillboard = false;
    
    // Immediately transition to run state (no waiting)
    this.state = 'run';
  },

  /**
   * Main gameplay state
   */
  run: function () {
    // Update DASE mode
    if (window.DASEMode) {
      DASEMode.update(1);
    }
    
    // Update Similarity mode
    if (window.SimilarityMode) {
      SimilarityMode.update(1);
    }
    
    // Check if all asteroids destroyed
    var asteroidsExist = false;
    for (var i = 0; i < Game.sprites.length; i++) {
      if (Game.sprites[i].name == 'asteroid') {
        asteroidsExist = true;
        break;
      }
    }
    
    if (!asteroidsExist) {
      SFX.waveComplete();
      this.state = 'new_level';
    }

    // UFO removed from scope
    // if (!Game.bigAlien.visible && Date.now() > Game.nextBigAlienTime) {
    //   Game.bigAlien.visible = true;
    //   Game.nextBigAlienTime = Date.now() + (30000 * Math.random());
    // }
  },

  /**
   * Advance to next level
   */
  new_level: function () {
    if (this.timer == null) {
      this.timer = Date.now();
      if (window.LevelTransitionManager) {
        LevelTransitionManager.start(Game.ship);
      }

      // If DASE was disabled (beam severed), clear it on level transition
      if (window.DASEMode && DASEMode.beamSevered && typeof DASEMode.isActive === 'function' && DASEMode.isActive()) {
        DASEMode.deactivate();
      }

      // Hide UFO + any alien bullets during the level transition
      if (Game.bigAlien) {
        Game.bigAlien.visible = false;
      }
      for (var i = 0; i < Game.sprites.length; i++) {
        if (Game.sprites[i].name == 'alienbullet') {
          Game.sprites[i].visible = false;
        }
        // Hide Silo during level transition - don't let it chase during warp
        if (Game.sprites[i].name == 'silo') {
          Game.sprites[i].visible = false;
          Game.sprites[i].die();
        }
        // Clear all data fragments on level advance
        if (Game.sprites[i].name == 'datafragment') {
          Game.sprites[i].visible = false;
          Game.sprites[i].die();
        }
      }
      // Push next UFO spawn a bit so it won't pop in right after transition
      Game.nextBigAlienTime = Date.now() + 12000;
      
      // Check for Similarity drop on wave 5
      if (window.SimilarityMode && SimilarityMode.shouldDropOnWaveClear(Game.currentWave)) {
        // Spawn near center of screen
        spawnSimilarityPickup(Game.canvasWidth / 2, Game.canvasHeight / 2);
      }
      
      // Track wave completion
      if (Game.stats) {
        Game.stats.wavesCompleted++;
      }
    }
    var hold = (window.LevelTransitionManager ? 2000 : 1000); // Reduced to ~2s per flowchart spec
    if ((Date.now() - this.timer > hold) && (!window.LevelTransitionManager || !LevelTransitionManager.isActive())) {
      this.timer = null;
      Game.totalAsteroids++;
      Game.currentWave++;
      if (Game.totalAsteroids > 12) Game.totalAsteroids = 12;
      
      // Increase difficulty with wave number (configurable via slider)
      var diffIncrease = window.DIFFICULTY_INCREASE_PER_WAVE || 0.10;
      var waveSpeedMultiplier = 1 + (Game.currentWave - 1) * diffIncrease;
      var minVelY = 1.2 * waveSpeedMultiplier;
      var maxVelY = 3.2 * waveSpeedMultiplier;
      
      Game.spawnAsteroids(null, { velY: [minVelY, maxVelY], velX: [-2 * waveSpeedMultiplier, 2 * waveSpeedMultiplier] });
      this.state = 'run';
    }
  },

  /**
   * Player died state
   */
  player_died: function () {
    // Ensure DASE/turret is fully cleared on death to avoid lockups
    if (window.DASEMode && typeof DASEMode.isActive === 'function' && DASEMode.isActive()) {
      DASEMode.deactivate();
    }
    if (Game.lives < 0) {
      this.state = 'end_game';
    } else {
      if (this.timer == null) {
        this.timer = Date.now();
      }
      
      // Reduced delay for faster respawn (300ms instead of 1000ms)
      if (Date.now() - this.timer > 300) {
        this.timer = null;
        this.state = 'spawn_ship';
      }
    }
  },

  /**
   * Game over state
   */
  end_game: function () {
    if (window.GameOverUI) {
      if (this.timer == null) {
        this.timer = Date.now();
        // Require a fresh START/SPACE press to restart (prevents held SPACE from skipping the post-game scoreboard).
        this._restartArmed = false;
        if (window.Scoreboard) {
          Scoreboard.setSuppressed(false);
        }
        GameOverUI.start(Game.score);
      }

      // Arm restart only after keys are released once.
      if (GameOverUI.readyForRestart() && !this._restartArmed && !KEY_STATUS.space && !window.gameStart) {
        this._restartArmed = true;
      }

      if (GameOverUI.readyForRestart() && this._restartArmed && (KEY_STATUS.space || window.gameStart)) {
        KEY_STATUS.space = false;
        window.gameStart = false;
        this.timer = null;
        Game.skipWaiting = false;
        if (window.IntroManager && typeof IntroManager.reset === 'function') {
          IntroManager.reset();
        }
        this._startRequested = false;
        this.state = 'boot';
        return;
      }
    } else {
      Text.renderText('CAPACITY REACHED', 50, Game.canvasWidth/2 - 260, Game.canvasHeight/2 + 10);
      if (this.timer == null) {
        this.timer = Date.now();
      }
      if (Date.now() - this.timer > 5000) {
        this.timer = null;
        if (window.IntroManager && typeof IntroManager.reset === 'function') {
          IntroManager.reset();
        }
        this._startRequested = false;
        this.state = 'boot';
      }
    }

    window.gameStart = false;
  },

  /**
   * Execute current state
   */
  execute: function () {
    this[this.state]();
  }
};
