/**
 * Ship Entity
 * Player-controlled spaceship with VAST logo design
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

// Ship SVG assets (preloaded)
var ShipAssets = {
  body: null,
  body2lives: null,
  body1life: null,
  thrust: null,
  bodyLoaded: false,
  body2livesLoaded: false,
  body1lifeLoaded: false,
  thrustLoaded: false,
  
  init: function() {
    var self = this;
    
    // Load ship body SVG (default - 3 lives)
    this.body = new Image();
    this.body.onload = function() { self.bodyLoaded = true; };
    this.body.src = 'assets/images/ship-body.svg';
    
    // Load ship body SVG for 2 lives
    this.body2lives = new Image();
    this.body2lives.onload = function() { self.body2livesLoaded = true; };
    this.body2lives.src = 'assets/images/ship-body-2lives.svg';
    
    // Load ship body SVG for 1 life
    this.body1life = new Image();
    this.body1life.onload = function() { self.body1lifeLoaded = true; };
    this.body1life.src = 'assets/images/ship-body-1lives.svg';
    
    // Load ship thrust SVG
    this.thrust = new Image();
    this.thrust.onload = function() { self.thrustLoaded = true; };
    this.thrust.src = 'assets/images/ship-thrust.svg';
  },
  
  isReady: function() {
    return this.bodyLoaded && this.thrustLoaded;
  },
  
  /** Return the correct body image based on current lives */
  getBody: function() {
    // Only switch variants during active gameplay
    if (typeof Game !== 'undefined' && Game.FSM && 
        (Game.FSM.state === 'run' || Game.FSM.state === 'new_level' || Game.FSM.state === 'spawn_ship' || Game.FSM.state === 'player_died')) {
      if (Game.lives === 0 && this.body1lifeLoaded) {
        return this.body1life;
      }
      if (Game.lives === 1 && this.body2livesLoaded) {
        return this.body2lives;
      }
    }
    return this.body;
  }
};

// The ship SVG is from VAST logo (viewBox: 0 0 70 60)
// Pivot marker is at (34.5, 23.5) in the SVG
var SHIP_SVG_ROTATION_CORRECTION_DEG = 0;
// Fine-tune to align shots perfectly with cyan tip edge
var SHIP_CYAN_TIP_OFFSET_DEG = -29.1;
// Ship body draw dimensions from VAST logo icon
var SHIP_BODY_WIDTH = 70;
var SHIP_BODY_HEIGHT = 60;
// Pivot offset matches the circle marker in VAST_Logo.svg (34.5, 23.5)
// Adjusted to center: pivot is at (34.5, 23.5), center is at (35, 30)
var SHIP_PIVOT_OFFSET_X = -0.5;
var SHIP_PIVOT_OFFSET_Y = -6.5;
// Cyan tip location in ship local space (cyan arrow tip at right)
var SHIP_TIP_LOCAL_X = 35.0;
var SHIP_TIP_LOCAL_Y = -10.0;

function getShipAngleOffsetDeg() {
  return (typeof window !== 'undefined' && window.SHIP_CYAN_TIP_OFFSET_DEG != null)
    ? window.SHIP_CYAN_TIP_OFFSET_DEG
    : SHIP_CYAN_TIP_OFFSET_DEG;
}

function getShipTipLocalX() {
  return (typeof window !== 'undefined' && window.SHIP_TIP_LOCAL_X != null)
    ? window.SHIP_TIP_LOCAL_X
    : SHIP_TIP_LOCAL_X;
}

function getShipTipLocalY() {
  return (typeof window !== 'undefined' && window.SHIP_TIP_LOCAL_Y != null)
    ? window.SHIP_TIP_LOCAL_Y
    : SHIP_TIP_LOCAL_Y;
}

function getShipPivotOffsetX() {
  return (typeof window !== 'undefined' && window.SHIP_PIVOT_OFFSET_X != null)
    ? window.SHIP_PIVOT_OFFSET_X
    : SHIP_PIVOT_OFFSET_X;
}

function getShipPivotOffsetY() {
  return (typeof window !== 'undefined' && window.SHIP_PIVOT_OFFSET_Y != null)
    ? window.SHIP_PIVOT_OFFSET_Y
    : SHIP_PIVOT_OFFSET_Y;
}

// Initialize ship assets
ShipAssets.init();

var Ship = function () {
  // Collision polygon - adjusted to match VAST logo ship orientation
  // In VAST logo: ship points to the right, with cyan tip at front
  this.init("ship", [
    22.0, 0.0,      // front point (cyan tip, points right)
    -20.0, -18.0,   // back top
    -20.0, 18.0     // back bottom
  ]);

  // Exhaust visible flag (no longer a child sprite - we draw SVG thrust)
  this.showThrust = false;

  this.bulletCounter = 0;
  this.hitCooldown = 0;
  this.postMove = this.wrapPostMove;
  this.collidesWith = ["asteroid", "bigalien", "alienbullet", "datafragment", "similaritypickup"]; // Silo removed - it can't kill player
  
  // Hyperspace state
  this.hyperspaceInvulnerable = 0;
  this.hyperspaceCooldown = 0;
  
  // Protective shield state (for spawn/teleport)
  this.protectiveShield = 0;
  this.protectiveShieldRadius = 56;

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
    
    // Update protective shield (destroys asteroids that touch it)
    if (this.protectiveShield > 0) {
      this.protectiveShield -= delta;
      this.updateProtectiveShield();
    }
    
    // During level transition, ship is frozen
    if (inTransition) {
      this.vel.rot = 0;
      this.vel.x = 0;
      this.vel.y = 0;
      this.acc.x = 0;
      this.acc.y = 0;
      this.showThrust = false;
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
      // Forward direction should align with cyan tip
      var rad = ((this.rot + SHIP_SVG_ROTATION_CORRECTION_DEG + getShipAngleOffsetDeg()) * Math.PI) / 180;
      this.acc.x = GAME_CONFIG.ship.thrustAcceleration * Math.cos(rad);
      this.acc.y = GAME_CONFIG.ship.thrustAcceleration * Math.sin(rad);
      this.showThrust = Math.random() > 0.1;
    } else {
      this.acc.x = 0;
      this.acc.y = 0;
      this.showThrust = false;
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
            // Fire from cyan tip direction
            var rad = ((this.rot + SHIP_SVG_ROTATION_CORRECTION_DEG + getShipAngleOffsetDeg()) * Math.PI) / 180;
            
            // Fire from the ship center with slight angle spread for multiple bullets
            var angleSpread = 0;
            if (bulletsToFire > 1) {
              // Spread bullets in a small cone
              angleSpread = (bulletsFired - (bulletsToFire - 1) / 2) * 0.15;
            }
            var spreadRad = rad + angleSpread;
            var spreadX = Math.cos(spreadRad);
            var spreadY = Math.sin(spreadRad);
            
            // Spawn from the cyan tip of the ship (front point)
            var tipLocalX = getShipTipLocalX() - getShipPivotOffsetX();
            var tipLocalY = getShipTipLocalY() - getShipPivotOffsetY();
            var tipX = tipLocalX * (this.scale || 1);
            var tipY = tipLocalY * (this.scale || 1);
            var cosR = Math.cos(rad);
            var sinR = Math.sin(rad);
            var tipWorldX = tipX * cosR - tipY * sinR;
            var tipWorldY = tipX * sinR + tipY * cosR;
            bullet.x = this.x + tipWorldX;
            bullet.y = this.y + tipWorldY;
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
   * Update protective shield - destroys asteroids that enter the shield radius
   */
  this.updateProtectiveShield = function() {
    if (this.protectiveShield <= 0) return;
    
    var shieldX = this.x;
    var shieldY = this.y;
    var radius = this.protectiveShieldRadius;
    
    // Check all asteroids
    for (var i = 0; i < Game.sprites.length; i++) {
      var sprite = Game.sprites[i];
      if (sprite.name === 'asteroid' && sprite.visible) {
        var dx = sprite.x - shieldX;
        var dy = sprite.y - shieldY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < radius + 20) { // Shield radius + asteroid buffer
          // Destroy asteroid
          Game.explosionAt(sprite.x, sprite.y);
          if (window.SFX && typeof SFX.asteroidExplosion === 'function') {
            SFX.asteroidExplosion();
          }
          sprite.die();
        }
      }
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
    
    // Immune during protective shield
    if (this.protectiveShield > 0) {
      return;
    }
    
    // Prevent multiple hits in the same frame/edge-bridge pass
    if (this.hitCooldown > 0) {
      return;
    }

    // Collision = lose a life immediately (no shields/upgrades)
    SFX.playerDeath();
    Game.explosionAt(this.x, this.y);

    // ——— JUICE: player death impact ———
    if (window.Juice) {
      Juice.shake(22, 0.9);                   // massive screen shake
      Juice.flash('#D91247', 0.5, 0.03);      // red flash
      Juice.chromatic(10);                     // heavy chromatic split
      Juice.hitstop(6);                        // dramatic freeze
    }

    // Drop DASE turret on death
    if (window.DASEMode && typeof DASEMode.isActive === 'function' && DASEMode.isActive()) {
      DASEMode.deactivate();
    }
    Game.FSM.state = 'player_died';
    this.visible = false;
    this.currentNode.leave(this);
    this.currentNode = null;
    Game.lives--;
    if (Game.lives < 0) {
      SFX.gameOverAlarm();
      // ——— JUICE: game over slam ———
      if (window.Juice) {
        Juice.shake(20, 0.8);
        Juice.flash('#D91247', 0.5, 0.02);
        Juice.chromatic(12);
      }
    }
  };
  
  /**
   * Hyperspace jump - teleport to random safe location
   */
  this.hyperspace = function() {
    if (Game.hyperspaceJumps <= 0) return;
    
    Game.hyperspaceJumps--;
    
    // Track stats
    if (Game.stats) {
      Game.stats.hyperspaceUsed++;
    }
    
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
    
    // Create shockwave effect that clears asteroids in radius (visible feedback)
    var safetyRadius = 80;
    Game.shockwaveAt(safeX, safeY, safetyRadius, '#06D69F');
    
    // Create arrival particles
    this.createHyperspaceEffect(safeX, safeY, 'arrival');
    
    // Grant invulnerability
    this.hyperspaceInvulnerable = GAME_CONFIG.ship.hyperspaceInvulnerability;
    this.hyperspaceCooldown = 60; // 1.0s cooldown per flowchart spec
    
    // Activate protective shield for 3 seconds on teleport
    this.protectiveShield = 180; // 3 seconds at 60fps
    this.protectiveShieldRadius = 56;
    
    // Play sound
    SFX.hyperspace();

    // ——— JUICE: hyperspace warp ———
    if (window.Juice) {
      Juice.shake(12, 0.5);
      Juice.flash('#06D69F', 0.25, 0.05);
      Juice.chromatic(6);
    }
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

// Draw ship using SVG images
// The ship SVG is oriented as in the Figma logo (pointing down-left ~150° from up)
// We rotate it by -150° to make it point UP, then the game rotation works normally
Ship.prototype.draw = function () {
  if (!this.visible) return;

  var ctx = this.context;
  // Keep visuals at base level (no clone upgrade), firing upgrades stay active
  var offsets = getFractalOffsets(0);

  // Ship SVG dimensions from viewBox (75 x 65)
  var shipWidth = SHIP_BODY_WIDTH;
  var shipHeight = SHIP_BODY_HEIGHT;
  
  // Apply correction so the cyan tip aligns with the ship's forward vector
  var svgRotationCorrection = SHIP_SVG_ROTATION_CORRECTION_DEG * Math.PI / 180;

  var count = offsets.length;
  for (var i = 0; i < count; i++) {
    var off = offsets[i];
    ctx.save();
    ctx.translate(off.x, off.y);

    // Smooth sequenced transparency across the formation
    if (count > 1) {
      ctx.globalAlpha = 1.0 - (i / (count - 1)) * 0.55;
    } else {
      ctx.globalAlpha = 1.0;
    }

    // Apply rotation correction for SVG orientation
    ctx.rotate(svgRotationCorrection);

    // Shift visuals so rotation pivot aligns with visual center
    var pivotX = getShipPivotOffsetX();
    var pivotY = getShipPivotOffsetY();
    ctx.translate(-pivotX, -pivotY);

    // Maintain collision path for isPointInPath checks
    ctx.beginPath();
    ctx.moveTo(this.points[0] - pivotX, this.points[1] - pivotY);
    for (var p = 2; p < this.points.length; p += 2) {
      ctx.lineTo(this.points[p] - pivotX, this.points[p + 1] - pivotY);
    }
    ctx.closePath();

    // Draw thrust glow FIRST (behind ship body) when accelerating
    if (this.showThrust && ShipAssets.thrustLoaded) {
      ctx.save();
      // Position thrust exactly opposite the cyan tip
      var thrustScale = 0.55;
      var thrustWidth = 138 * thrustScale;
      var thrustHeight = 158 * thrustScale;
      // Same local tip used for bullets (relative to ship center)
      var tipLocalX = getShipTipLocalX() - getShipPivotOffsetX();
      var tipLocalY = getShipTipLocalY() - getShipPivotOffsetY();
      // Opposite direction of tip
      var thrustCenterX = -tipLocalX;
      var thrustCenterY = -tipLocalY;
      ctx.globalAlpha *= 0.85;
      ctx.drawImage(
        ShipAssets.thrust,
        thrustCenterX - thrustWidth * 0.5,
        thrustCenterY - thrustHeight * 0.4,
        thrustWidth,
        thrustHeight
      );
      // Extra pass to boost visibility
      var boostScale = 1.12;
      ctx.globalAlpha *= 0.85;
      ctx.drawImage(
        ShipAssets.thrust,
        thrustCenterX - (thrustWidth * boostScale) * 0.5,
        thrustCenterY - (thrustHeight * boostScale) * 0.4,
        thrustWidth * boostScale,
        thrustHeight * boostScale
      );
      ctx.restore();
    }

    // Draw ship body SVG (swap asset when player has 2 lives)
    var currentBody = ShipAssets.getBody();
    if (currentBody) {
      ctx.drawImage(
        currentBody,
        -shipWidth / 2,
        -shipHeight / 2,
        shipWidth,
        shipHeight
      );
    } else {
      // Fallback: draw collision polygon outline while loading
      ctx.beginPath();
      ctx.moveTo(this.points[0], this.points[1]);
      for (var p = 1; p < this.points.length / 2; p++) {
        var xi = p * 2;
        var yi = xi + 1;
        ctx.lineTo(this.points[xi], this.points[yi]);
      }
      ctx.closePath();
      ctx.strokeStyle = '#1FD9FE';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }
  
  // Draw protective shield ring if active
  if (this.protectiveShield > 0) {
    ctx.save();
    // Shield is centered on the ship's rotation center (no pivot offset)
    var shieldAlpha = Math.min(1, this.protectiveShield / 60); // Fade out in last second
    var pulseSpeed = 0.15;
    var pulse = 0.7 + Math.sin(Date.now() * pulseSpeed * 0.01) * 0.3;
    
    // Outer glow ring
    ctx.beginPath();
    ctx.arc(0, 0, this.protectiveShieldRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#1FD9FE';
    ctx.lineWidth = 3 * pulse;
    ctx.globalAlpha = shieldAlpha * 0.8 * pulse;
    ctx.shadowColor = '#1FD9FE';
    ctx.shadowBlur = 20;
    ctx.stroke();
    
    // Inner ring
    ctx.beginPath();
    ctx.arc(0, 0, this.protectiveShieldRadius * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = '#1FD9FE';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = shieldAlpha * 0.4;
    ctx.stroke();
    
    // Fill with subtle glow
    ctx.beginPath();
    ctx.arc(0, 0, this.protectiveShieldRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(31, 217, 254, 0.1)';
    ctx.globalAlpha = shieldAlpha * pulse;
    ctx.fill();
    
    ctx.restore();
  }
};
