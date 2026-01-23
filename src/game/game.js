/**
 * Game Object
 * Main game state and configuration
 */

var Game = {
  score: 0,
  totalAsteroids: GAME_CONFIG ? GAME_CONFIG.gameplay.initialAsteroidCount : 5,
  lives: 0,
  currentWave: 1,
  hyperspaceJumps: 3,

  // Fractal upgrade state (triples visual ship clones per level)
  upgradeLevel: 0,
  upgradeHits: 0,
  upgradeMaxLevel: 3,
  upgradeStepScore: 1000,

  canvasWidth: 800,
  canvasHeight: 600,

  sprites: [],
  ship: null,
  bigAlien: null,

  skipWaiting: false,
  nextBigAlienTime: null,

  FSM: null,

  /**
   * Initialize/reset game state for new game
   */
  initNewGame: function() {
    this.score = 0;
    this.lives = 2;
    this.currentWave = 1;
    this.hyperspaceJumps = 3;
    this.upgradeLevel = 0;
    this.upgradeHits = 0;
    
    // Initialize DASE and Similarity systems
    if (window.DASEMode) DASEMode.init();
    if (window.SimilarityMode) SimilarityMode.init();
  },

  /**
   * Spawn asteroid clusters
   * @param {number} count - Number of asteroids to spawn
   */
  spawnAsteroids: function (count, opts) {
    opts = opts || {};
    if (!count) count = this.totalAsteroids;
    var vx = opts.velX || [-2, 2];
    var vy = opts.velY || [-2, 2];
    
    for (var i = 0; i < count; i++) {
      var roid = new Asteroid();
      var charCount = ASTEROID_CHAR_COUNT || 200;
      roid.setSize(charCount, 55 + Math.random() * 20);

      roid.x = Math.random() * this.canvasWidth;
      roid.y = Math.random() * this.canvasHeight;
      
      while (!roid.isClear()) {
        roid.x = Math.random() * this.canvasWidth;
        roid.y = Math.random() * this.canvasHeight;
      }
      
      roid.vel.x = vx[0] + Math.random() * (vx[1] - vx[0]);
      roid.vel.y = vy[0] + Math.random() * (vy[1] - vy[0]);
      roid.vel.rot = Math.random() * 2 - 1;
      roid.scale = 1;

      // Fast, elegant spawn-in (scale + character reveal)
      if (typeof roid.beginSpawnIn === 'function') {
        roid.beginSpawnIn({ durationMs: 240, startScale: 0.22, startChars: Math.max(10, Math.min(50, Math.floor(charCount * 0.2))) });
      }
      
      Game.sprites.push(roid);
    }
  },

  /**
   * Create explosion at position
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  explosionAt: function (x, y) {
    var splosion = new Explosion();
    splosion.x = x;
    splosion.y = y;
    splosion.visible = true;
    Game.sprites.push(splosion);
  }
};
