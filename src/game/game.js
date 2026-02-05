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

  // Stats tracking for score breakdown
  stats: {
    asteroidsDestroyed: 0,
    asteroidsScore: 0,
    fragmentsCollected: 0,
    fragmentAchievementTier: 0,
    fragmentAchievementIcon: null,
    fragmentAchievementName: null,
    silosDestroyed: 0,
    silosScore: 0,
    daseActivations: 0,
    similarityBonus: 0,
    wavesCompleted: 0,
    hyperspaceUsed: 0
  },

  // Fractal upgrade state (triples visual ship clones per level)
  upgradeLevel: 0,
  upgradeHits: 0,
  upgradeMaxLevel: 3,
  upgradeStepScore: 10000,

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

    // Ensure ship resets to the default starting position for a new game
    if (this.ship) {
      // Start ship where VAST logo ship icon is (below center, left portion)
      var startRot = (typeof window.SHIP_START_ROT_DEG !== 'undefined') ? window.SHIP_START_ROT_DEG : 0;
      this.ship.x = this.canvasWidth * 0.5;
      this.ship.y = this.canvasHeight * 0.66;
      this.ship.vel.x = 0;
      this.ship.vel.y = 0;
      this.ship.rot = startRot; // Match VAST logo orientation
    }
    
    // Reset stats for new game
    this.stats = {
      asteroidsDestroyed: 0,
      asteroidsScore: 0,
      fragmentsCollected: 0,
      fragmentAchievementTier: 0,
      fragmentAchievementIcon: null,
      fragmentAchievementName: null,
      silosDestroyed: 0,
      silosScore: 0,
      daseActivations: 0,
      similarityBonus: 0,
      wavesCompleted: 0,
      hyperspaceUsed: 0
    };
    
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
  },
  
  /**
   * Create expanding shockwave effect that clears asteroids
   * @param {number} x - Center X position
   * @param {number} y - Center Y position  
   * @param {number} radius - Radius to clear
   * @param {string} color - Color of the shockwave
   */
  shockwaveAt: function(x, y, radius, color) {
    color = color || '#1FD9FE';
    radius = radius || 80;
    
    // Create shockwave visual effect
    if (!this.shockwaves) this.shockwaves = [];
    this.shockwaves.push({
      x: x,
      y: y,
      radius: 0,
      maxRadius: radius,
      alpha: 1,
      color: color,
      lineWidth: 4
    });
    
    // Destroy asteroids in radius
    for (var i = 0; i < this.sprites.length; i++) {
      var sprite = this.sprites[i];
      if (sprite.name === 'asteroid' && sprite.visible) {
        var dx = sprite.x - x;
        var dy = sprite.y - y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius) {
          this.explosionAt(sprite.x, sprite.y);
          sprite.die();
        }
      }
    }
  },
  
  /**
   * Update and render shockwaves
   */
  updateShockwaves: function(ctx) {
    if (!this.shockwaves) return;
    
    for (var i = this.shockwaves.length - 1; i >= 0; i--) {
      var sw = this.shockwaves[i];
      
      // Expand shockwave
      sw.radius += 8;
      sw.alpha = 1 - (sw.radius / sw.maxRadius);
      sw.lineWidth = Math.max(1, 4 * sw.alpha);
      
      // Draw shockwave ring
      if (sw.alpha > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = sw.lineWidth;
        ctx.globalAlpha = sw.alpha;
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = 15;
        ctx.stroke();
        
        // Inner glow ring
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius * 0.8, 0, Math.PI * 2);
        ctx.globalAlpha = sw.alpha * 0.3;
        ctx.lineWidth = sw.lineWidth * 2;
        ctx.stroke();
        ctx.restore();
      }
      
      // Remove finished shockwaves
      if (sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }
  }
};
