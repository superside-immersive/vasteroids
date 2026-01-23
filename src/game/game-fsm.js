/**
 * Game State Machine
 * Handles game states and transitions
 */

var GameFSM = {
  timer: null,
  state: 'boot',
  _startRequested: false,

  /**
   * Initial boot state
   */
  boot: function () {
    Game.spawnAsteroids(5);
    if (window.IntroManager && typeof IntroManager.reset === 'function') {
      IntroManager.reset();
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

    // User pressed START/Space: play intro zoom-in (do not instantly hide logo).
    if (!this._startRequested && (KEY_STATUS.space || window.gameStart)) {
      KEY_STATUS.space = false;
      window.gameStart = false;
      this._startRequested = true;
      Game.skipWaiting = false;
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
    if (window.Scoreboard) { 
      Scoreboard.hide();
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

    // Initialize game state using new method
    Game.initNewGame();
    Game.totalAsteroids = 2;
    Game.spawnAsteroids();

    Game.nextBigAlienTime = Date.now() + 30000 + (30000 * Math.random());

    this.state = 'spawn_ship';
  },

  /**
   * Spawn player ship
   */
  spawn_ship: function () {
    Game.ship.x = Game.canvasWidth / 2;
    Game.ship.y = Game.canvasHeight / 2;

    // Clear asteroids in spawn radius to prevent instant death
    var spawnClearRadius = 80;
    for (var i = 0; i < Game.sprites.length; i++) {
      var sprite = Game.sprites[i];
      if (sprite.name === 'asteroid' && sprite.visible) {
        var dx = sprite.x - Game.ship.x;
        var dy = sprite.y - Game.ship.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < spawnClearRadius) {
          Game.explosionAt(sprite.x, sprite.y);
          sprite.die();
        }
      }
    }

    // Keep ship visible immediately; state gate controls when it can move/shoot.
    Game.ship.visible = true;
    
    if (Game.ship.isClear()) {
      Game.ship.rot = 0;
      Game.ship.vel.x = 0;
      Game.ship.vel.y = 0;
      this.state = 'run';
    }
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

      // Hide UFO + any alien bullets during the level transition
      if (Game.bigAlien) {
        Game.bigAlien.visible = false;
      }
      for (var i = 0; i < Game.sprites.length; i++) {
        if (Game.sprites[i].name == 'alienbullet') {
          Game.sprites[i].visible = false;
        }
      }
      // Push next UFO spawn a bit so it won't pop in right after transition
      Game.nextBigAlienTime = Date.now() + 12000;
      
      // Check for Similarity drop on wave 5
      if (window.SimilarityMode && SimilarityMode.shouldDropOnWaveClear(Game.currentWave)) {
        // Spawn near center of screen
        spawnSimilarityPickup(Game.canvasWidth / 2, Game.canvasHeight / 2);
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
      
      if (Date.now() - this.timer > 1000) {
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
        GameOverUI.start(Game.score);
      }

      if (GameOverUI.readyForRestart() && (KEY_STATUS.space || window.gameStart)) {
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
