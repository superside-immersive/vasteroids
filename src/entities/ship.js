/**
 * Ship Entity
 * Player-controlled spaceship
 */

// Generate offsets so clones form readable triangles per upgrade level
function getFractalOffsets(level) {
  var offsets = [{ x: 0, y: 0 }];
  var spacing = 16; // base distance between ships for clarity

  for (var l = 0; l < level; l++) {
    var next = [];
    for (var i = 0; i < offsets.length; i++) {
      var base = offsets[i];
      next.push({ x: base.x, y: base.y });
      next.push({ x: base.x + spacing, y: base.y });
      next.push({ x: base.x + spacing * 0.5, y: base.y + spacing * 0.9 });
    }
    offsets = next;
    spacing = Math.max(8, spacing * 0.72); // shrink gently for higher levels without overlap
  }

  // Center the whole formation around (0,0) so the ship position is the group's center
  var sumX = 0;
  var sumY = 0;
  for (var i = 0; i < offsets.length; i++) {
    sumX += offsets[i].x;
    sumY += offsets[i].y;
  }
  var meanX = sumX / offsets.length;
  var meanY = sumY / offsets.length;
  for (var i = 0; i < offsets.length; i++) {
    offsets[i].x -= meanX;
    offsets[i].y -= meanY;
  }

  return offsets;
}

// Approximate a sprite radius for size comparisons (uses clusterRadius or polygon bounds)
function approxSpriteRadius(sprite) {
  if (sprite && sprite.clusterRadius) {
    return Math.abs(sprite.clusterRadius) * (sprite.scale || 1);
  }
  if (!sprite || !sprite.points || sprite.points.length < 2) return 20;
  var maxR = 0;
  for (var i = 0; i < sprite.points.length; i += 2) {
    var r = Math.sqrt(sprite.points[i] * sprite.points[i] + sprite.points[i + 1] * sprite.points[i + 1]);
    if (r > maxR) maxR = r;
  }
  return maxR * (sprite.scale || 1);
}

var Ship = function () {
  // Ship shape based on A.svg path - high resolution polygon
  this.init("ship", [
    0.0, -18.1,     // top center point
    3.5, -16.1,     // right of top
    7.0, -10.0,     // right upper slope
    11.0, -2.0,     // right mid-upper
    14.5, 6.0,      // right mid
    17.5, 13.5,     // right lower outer
    16.3, 16.9,     // right bottom curve
    14.0, 18.3,     // right bottom
    12.7, 18.3,     // right base
    10.5, 16.5,     // right inner start
    9.0, 13.5,      // right inner
    6.0, 6.0,       // right inner mid
    3.0, -1.0,      // right inner upper
    0.0, -5.3,      // center notch (top of A hole)
    -3.0, -1.0,     // left inner upper
    -6.0, 6.0,      // left inner mid
    -9.0, 13.5,     // left inner
    -10.5, 16.5,    // left inner start
    -12.7, 18.3,    // left base
    -14.0, 18.3,    // left bottom
    -16.3, 16.9,    // left bottom curve
    -17.5, 13.5,    // left lower outer
    -14.5, 6.0,     // left mid
    -11.0, -2.0,    // left mid-upper
    -7.0, -10.0,    // left upper slope
    -3.5, -16.1     // left of top
  ]);

  // Exhaust flame
  this.children.exhaust = new Sprite();
  this.children.exhaust.init("exhaust", [-4, 20, 0, 28, 4, 20]);

  this.bulletCounter = 0;
  this.hitCooldown = 0;
  this.postMove = this.wrapPostMove;
  this.collidesWith = ["asteroid", "bigalien", "alienbullet", "datafragment", "similaritypickup"]; // Silo removed - it can't kill player
  
  // Hyperspace state
  this.hyperspaceInvulnerable = 0;
  this.hyperspaceCooldown = 0;

  /**
   * Pre-move update - handles input and physics
   * @param {number} delta - Time delta
   */
  this.preMove = function (delta) {
    // Check if in level transition - freeze all controls
    var inTransition = window.LevelTransitionManager && LevelTransitionManager.isActive();
    
    // Update hyperspace invulnerability
    if (this.hyperspaceInvulnerable > 0) {
      this.hyperspaceInvulnerable -= delta;
    }
    if (this.hyperspaceCooldown > 0) {
      this.hyperspaceCooldown -= delta;
    }
    
    // During level transition, ship is frozen
    if (inTransition) {
      this.vel.rot = 0;
      this.vel.x = 0;
      this.vel.y = 0;
      this.acc.x = 0;
      this.acc.y = 0;
      this.children.exhaust.visible = false;
      return; // Skip all input processing
    }
    
    // Rotation control
    if (KEY_STATUS.left) {
      this.vel.rot = -GAME_CONFIG.ship.rotationSpeed;
    } else if (KEY_STATUS.right) {
      this.vel.rot = GAME_CONFIG.ship.rotationSpeed;
    } else {
      this.vel.rot = 0;
    }

    // Thrust control
    if (KEY_STATUS.up) {
      var rad = ((this.rot - 90) * Math.PI) / 180;
      this.acc.x = GAME_CONFIG.ship.thrustAcceleration * Math.cos(rad);
      this.acc.y = GAME_CONFIG.ship.thrustAcceleration * Math.sin(rad);
      this.children.exhaust.visible = Math.random() > 0.1;
    } else {
      this.acc.x = 0;
      this.acc.y = 0;
      this.children.exhaust.visible = false;
    }
    
    // Apply drag (slight friction) for easier control
    var drag = GAME_CONFIG.ship.drag || 0.995;
    this.vel.x *= drag;
    this.vel.y *= drag;
    
    // Hyperspace Jump (Shift key) - disabled during level transition
    var inTransition = window.LevelTransitionManager && LevelTransitionManager.isActive();
    if (KEY_STATUS.shift && this.hyperspaceCooldown <= 0 && Game.hyperspaceJumps > 0 && !inTransition) {
      this.hyperspace();
      KEY_STATUS.shift = false; // Consume input
    }

    // Shooting - allowed during DASE mode; only disabled during level transition
    if (this.bulletCounter > 0) {
      this.bulletCounter -= delta;
    }

    if (this.hitCooldown > 0) {
      this.hitCooldown -= delta;
    }
    
    // Only fire if not in transition
    if (KEY_STATUS.space && !inTransition) {
      if (this.bulletCounter <= 0) {
        this.bulletCounter = GAME_CONFIG.ship.bulletCooldown;
        
        // Double shot at upgrade level 2+ (requested)
        var bulletsToFire = (Game.upgradeLevel >= GAME_CONFIG.ship.doubleFireUpgradeLevel) ? 2 : 1;
        var bulletsFired = 0;
        
        for (var i = 0; i < this.bullets.length && bulletsFired < bulletsToFire; i++) {
          if (!this.bullets[i].visible) {
            SFX.laser();
            var bullet = this.bullets[i];
            var rad = ((this.rot - 90) * Math.PI) / 180;
            
            // Fire from the ship center with slight angle spread for multiple bullets
            var angleSpread = 0;
            if (bulletsToFire > 1) {
              // Spread bullets in a small cone
              angleSpread = (bulletsFired - (bulletsToFire - 1) / 2) * 0.15;
            }
            var spreadRad = rad + angleSpread;
            var spreadX = Math.cos(spreadRad);
            var spreadY = Math.sin(spreadRad);
            
            // Spawn from the CENTER of the whole formation (group centered in draw)
            bullet.x = this.x + spreadX * 4;
            bullet.y = this.y + spreadY * 4;
            bullet.vel.x = GAME_CONFIG.bullet.speed * spreadX;
            bullet.vel.y = GAME_CONFIG.bullet.speed * spreadY;
            bullet.visible = true;
            bulletsFired++;
          }
        }
      }
    }

    // Limit speed
    if (Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y) > 8) {
      this.vel.x *= 0.95;
      this.vel.y *= 0.95;
    }
  };

  /**
   * Handle collision with another sprite
   * @param {Sprite} other - Colliding sprite
   */
  this.collision = function (other) {
    // Data fragments and similarity pickups are non-damaging
    // They handle their own collection logic
    if (other.name === 'datafragment' || other.name === 'similaritypickup') {
      return;
    }
    
    // Immune during hyperspace invulnerability
    if (this.hyperspaceInvulnerable > 0) {
      return;
    }
    
    // Prevent multiple hits in the same frame/edge-bridge pass
    if (this.hitCooldown > 0) {
      return;
    }

    // Collision = lose a life immediately (no shields/upgrades)
    SFX.explosion();
    Game.explosionAt(this.x, this.y);
    // Drop DASE turret on death
    if (window.DASEMode && typeof DASEMode.isActive === 'function' && DASEMode.isActive()) {
      DASEMode.deactivate();
    }
    Game.FSM.state = 'player_died';
    this.visible = false;
    this.currentNode.leave(this);
    this.currentNode = null;
    Game.lives--;
  };
  
  /**
   * Hyperspace jump - teleport to random safe location
   */
  this.hyperspace = function() {
    if (Game.hyperspaceJumps <= 0) return;
    
    Game.hyperspaceJumps--;
    
    // Store old position for departure effect
    var oldX = this.x;
    var oldY = this.y;
    
    // Create departure particles
    this.createHyperspaceEffect(oldX, oldY, 'departure');
    
    // Find a safe location (away from asteroids)
    var attempts = 0;
    var safeX, safeY;
    var minDist = 100;
    
    do {
      safeX = 50 + Math.random() * (Game.canvasWidth - 100);
      safeY = 50 + Math.random() * (Game.canvasHeight - 100);
      
      var safe = true;
      for (var i = 0; i < Game.sprites.length; i++) {
        var sprite = Game.sprites[i];
        if (sprite.name === 'asteroid' && sprite.visible) {
          var dx = sprite.x - safeX;
          var dy = sprite.y - safeY;
          if (Math.sqrt(dx*dx + dy*dy) < minDist) {
            safe = false;
            break;
          }
        }
      }
      
      if (safe) break;
      attempts++;
    } while (attempts < 20);
    
    // Teleport
    this.x = safeX;
    this.y = safeY;
    this.vel.x = 0;
    this.vel.y = 0;
    
    // Clear small safety radius around landing point (per flowchart spec)
    // Only destroys asteroids within ~50px to prevent spawn-kill without being a "panic nuke"
    var safetyRadius = 50;
    for (var i = 0; i < Game.sprites.length; i++) {
      var sprite = Game.sprites[i];
      if (sprite.name === 'asteroid' && sprite.visible) {
        var dx = sprite.x - safeX;
        var dy = sprite.y - safeY;
        var distToLanding = Math.sqrt(dx*dx + dy*dy);
        if (distToLanding < safetyRadius) {
          // Destroy asteroid in safety zone (no score, no fragments - just clearance)
          Game.explosionAt(sprite.x, sprite.y);
          sprite.die();
        }
      }
    }
    
    // Create arrival particles
    this.createHyperspaceEffect(safeX, safeY, 'arrival');
    
    // Grant invulnerability
    this.hyperspaceInvulnerable = GAME_CONFIG.ship.hyperspaceInvulnerability;
    this.hyperspaceCooldown = 60; // 1.0s cooldown per flowchart spec
    
    // Play sound
    SFX.hyperspace();
  };
  
  /**
   * Create hyperspace visual effect
   */
  this.createHyperspaceEffect = function(x, y, type) {
    if (!Game.hyperspaceParticles) Game.hyperspaceParticles = [];
    
    var numParticles = type === 'departure' ? 20 : 15;
    var color = type === 'departure' ? '#06D69F' : '#1FD9FE';
    
    for (var i = 0; i < numParticles; i++) {
      var angle = (i / numParticles) * Math.PI * 2;
      var particle = {
        x: x,
        y: y,
        life: 1,
        type: type,
        color: color
      };
      
      if (type === 'departure') {
        // Explode outward from old position
        var speed = 5 + Math.random() * 8;
        particle.vx = Math.cos(angle) * speed;
        particle.vy = Math.sin(angle) * speed;
        particle.size = 3 + Math.random() * 4;
      } else {
        // Converge inward to new position
        var dist = 80 + Math.random() * 40;
        particle.x = x + Math.cos(angle) * dist;
        particle.y = y + Math.sin(angle) * dist;
        particle.targetX = x;
        particle.targetY = y;
        particle.size = 2 + Math.random() * 3;
      }
      
      Game.hyperspaceParticles.push(particle);
    }
  };
};

Ship.prototype = new Sprite();

// Draw multiple tightly overlapped ships according to current upgrade level
Ship.prototype.draw = function () {
  if (!this.visible) return;

  var ctx = this.context;
  var offsets = getFractalOffsets(Game.upgradeLevel);
  var lineW = 1.0 / this.scale;

  var count = offsets.length;
  for (var i = 0; i < count; i++) {
    var off = offsets[i];
    ctx.save();
    ctx.translate(off.x, off.y);
    ctx.lineWidth = lineW;

    // Smooth sequenced transparency across the formation
    if (count > 1) {
      ctx.globalAlpha = 1.0 - (i / (count - 1)) * 0.55;
    } else {
      ctx.globalAlpha = 1.0;
    }

    for (var child in this.children) {
      this.children[child].draw();
    }

    ctx.beginPath();
    ctx.moveTo(this.points[0], this.points[1]);
    for (var p = 1; p < this.points.length / 2; p++) {
      var xi = p * 2;
      var yi = xi + 1;
      ctx.lineTo(this.points[xi], this.points[yi]);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }
};
