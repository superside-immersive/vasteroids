/**
 * Bullet Entity
 * Player projectile with sci-fi glow effect
 */

var Bullet = function () {
  this.init("bullet", [0, 0]);
  this.time = 0;
  this.bridgesH = false;
  this.bridgesV = false;
  this.postMove = this.wrapPostMove;

  /**
   * Override transform (bullets don't rotate)
   */
  this.configureTransform = function () {};

  /**
   * Draw bullet as a glowing sci-fi projectile
   */
  this.draw = function () {
    if (this.visible) {
      var ctx = this.context;
      var x = this.x;
      var y = this.y;
      
      // Calculate bullet direction for elongated shape
      var speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
      var dirX = speed > 0 ? this.vel.x / speed : 0;
      var dirY = speed > 0 ? this.vel.y / speed : 0;
      
      // Use shared glow renderer
      var length = GAME_CONFIG.bullet.length;
      GlowRenderer.drawTrail(ctx, x, y, dirX, dirY, length, GlowRenderer.PLAYER_COLORS);
      
      // Front tip glow point
      GlowRenderer.drawTipGlow(ctx, x + dirX * 2, y + dirY * 2, 'rgba(31, 217, 254, 0.5)');
    }
  };

  /**
   * Update bullet lifetime
   * @param {number} delta - Time delta
   */
  this.preMove = function (delta) {
    if (this.visible) {
      this.time += delta;
    }
    if (this.time > GAME_CONFIG.bullet.lifetime) {
      this.visible = false;
      this.time = 0;
    }
  };

  /**
   * Handle collision
   * @param {Sprite} other - Colliding sprite
   */
  this.collision = function (other) {
    this.time = 0;
    this.visible = false;
    this.currentNode.leave(this);
    this.currentNode = null;
  };

  /**
   * Get collision point (single point for bullet)
   * @returns {Array} - Point coordinates
   */
  this.transformedPoints = function (other) {
    return [this.x, this.y];
  };
};

Bullet.prototype = new Sprite();

/**
 * Alien Bullet Entity
 * Enemy projectile with red/orange glow
 */
var AlienBullet = function () {
  this.init("alienbullet");

  /**
   * Draw bullet as a glowing enemy projectile
   */
  this.draw = function () {
    if (this.visible) {
      var ctx = this.context;
      var x = this.x;
      var y = this.y;
      
      // Calculate bullet direction
      var speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
      var dirX = speed > 0 ? this.vel.x / speed : 0;
      var dirY = speed > 0 ? this.vel.y / speed : 0;
      
      // Use shared glow renderer with alien colors
      GlowRenderer.drawTrail(ctx, x, y, dirX, dirY, 6, GlowRenderer.ALIEN_COLORS);
    }
  };
};

AlienBullet.prototype = new Bullet();
