/**
 * BigAlien Entity
 * Enemy UFO that shoots at player
 */

var BigAlien = function () {
  this.init("bigalien", [
    -20, 0,
    -12, -4,
    12, -4,
    20, 0,
    12, 4,
    -12, 4,
    -20, 0,
    20, 0
  ]);

  // Top part of UFO
  this.children.top = new Sprite();
  this.children.top.init("bigalien_top", [-8, -4, -6, -6, 6, -6, 8, -4]);
  this.children.top.visible = true;

  // Bottom part of UFO
  this.children.bottom = new Sprite();
  this.children.bottom.init("bigalien_top", [8, 4, 6, 6, -6, 6, -8, 4]);
  this.children.bottom.visible = true;

  this.collidesWith = ["asteroid", "ship", "bullet"];
  this.bridgesH = false;
  this.bullets = [];
  this.bulletCounter = 0;

  /**
   * Set random starting position at screen edge
   */
  this.newPosition = function () {
    if (Math.random() < 0.5) {
      this.x = -20;
      this.vel.x = GAME_CONFIG.alien.speed;
    } else {
      this.x = Game.canvasWidth + 20;
      this.vel.x = -GAME_CONFIG.alien.speed;
    }
    this.y = Math.random() * Game.canvasHeight;
  };

  /**
   * Initialize alien and create bullets
   */
  this.setup = function () {
    this.newPosition();

    for (var i = 0; i < GAME_CONFIG.alien.bulletCount; i++) {
      var bull = new AlienBullet();
      this.bullets.push(bull);
      Game.sprites.push(bull);
    }
  };

  /**
   * AI movement and shooting
   * @param {number} delta - Time delta
   */
  this.preMove = function (delta) {
    var cn = this.currentNode;
    if (cn == null) return;

    // Count sprites above and below
    var topCount = 0;
    if (cn.north.nextSprite) topCount++;
    if (cn.north.east.nextSprite) topCount++;
    if (cn.north.west.nextSprite) topCount++;

    var bottomCount = 0;
    if (cn.south.nextSprite) bottomCount++;
    if (cn.south.east.nextSprite) bottomCount++;
    if (cn.south.west.nextSprite) bottomCount++;

    // Move toward emptier space
    if (topCount > bottomCount) {
      this.vel.y = 1;
    } else if (topCount < bottomCount) {
      this.vel.y = -1;
    } else if (Math.random() < 0.01) {
      this.vel.y = -this.vel.y;
    }

    // Shooting logic
    this.bulletCounter -= delta;
    if (this.bulletCounter <= 0) {
      this.bulletCounter = GAME_CONFIG.alien.bulletCooldown;
      
      for (var i = 0; i < this.bullets.length; i++) {
        if (!this.bullets[i].visible) {
          var bullet = this.bullets[i];
          var rad = 2 * Math.PI * Math.random();
          var vectorx = Math.cos(rad);
          var vectory = Math.sin(rad);
          
          bullet.x = this.x;
          bullet.y = this.y;
          bullet.vel.x = GAME_CONFIG.alien.bulletSpeed * vectorx;
          bullet.vel.y = GAME_CONFIG.alien.bulletSpeed * vectory;
          bullet.visible = true;
          SFX.laser();
          break;
        }
      }
    }
  };

  /**
   * Handle screen wrapping and respawn
   */
  this.postMove = function () {
    if (this.y > Game.canvasHeight) {
      this.y = 0;
    } else if (this.y < 0) {
      this.y = Game.canvasHeight;
    }

    // Crossed the screen, respawn
    if ((this.vel.x > 0 && this.x > Game.canvasWidth + 20) ||
        (this.vel.x < 0 && this.x < -20)) {
      this.visible = false;
      this.newPosition();
    }
  };
};

BigAlien.prototype = new Sprite();

/**
 * Handle collision with another sprite
 * @param {Sprite} other - Colliding sprite
 */
BigAlien.prototype.collision = function (other) {
  if (other.name == "bullet") Game.score += GAME_CONFIG.alien.scoreValue;
  SFX.explosion();
  Game.explosionAt(other.x, other.y);
  this.visible = false;
  this.newPosition();
};
