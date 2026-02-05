/**
 * The Latency Drone (Silo)
 * Enemy that hunts the Energy Beam during DASE Mode
 * Red diamond ship that moves erratically toward the beam connection
 * Drops 3 Data Fragments guaranteed when destroyed
 */

// Preload silo sprite
var SILO_IMG = new Image();
SILO_IMG.src = 'assets/images/silo-main.svg';

var Silo = function() {
  // Diamond shape (collision area)
  this.init("silo", [
    0, -24,    // top
    18, 0,     // right
    0, 24,     // bottom
    -18, 0     // left
  ]);
  
  this.visible = false;
  this.scale = 1;
  this.postMove = this.wrapPostMove;
  this.collidesWith = ["bullet"]; // Only player bullets can hit Silo, NOT turret bullets
  
  // Movement properties - faster and more erratic
  this.baseSpeed = 5;
  this.speed = this.baseSpeed;
  this.zigzagTimer = 0;
  this.zigzagDirection = 1;
  this.zigzagFrequency = 0.35; // More frequent direction changes
  
  // Health - takes 3 hits to destroy
  this.health = 3;
  this.hitFlashTimer = 0;
  
  // Score value
  this.scoreValue = 5000;
  
  /**
   * Pre-move - erratic movement toward beam OR fleeing after severing
   */
  this.preMove = function(delta) {
    if (!this.visible) return;

    // If DASE is inactive or turret is missing, remove Silo
    if (!window.DASEMode || !DASEMode.isActive() || !DASEMode.turret) {
      this.die();
      return;
    }
    
    // Flash timer countdown
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
    }
    
    // Zigzag movement
    this.zigzagTimer += delta * this.zigzagFrequency;
    if (Math.sin(this.zigzagTimer) > 0.8) {
      this.zigzagDirection *= -1;
    }
    
    // Determine target based on beam state
    var targetX = Game.canvasWidth / 2;
    var targetY = Game.canvasHeight / 2;
    var fleeing = false;
    
    if (window.DASEMode && DASEMode.isActive()) {
      if (DASEMode.beamSevered && Game.ship) {
        // BEAM SEVERED: Flee from player! Run away!
        fleeing = true;
        var dx = this.x - Game.ship.x;
        var dy = this.y - Game.ship.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          targetX = this.x + (dx / dist) * 200; // Run away direction
          targetY = this.y + (dy / dist) * 200;
        }
      } else if (DASEMode.turret && Game.ship) {
        // BEAM ACTIVE: Target the middle of the energy beam
        targetX = (Game.ship.x + DASEMode.turret.x) / 2;
        targetY = (Game.ship.y + DASEMode.turret.y) / 2;
      }
    } else if (Game.ship && Game.ship.visible) {
      // DASE NOT ACTIVE: Hunt the player ship instead of staying still
      targetX = Game.ship.x;
      targetY = Game.ship.y;
    }
    
    // Direction to target
    var dx = targetX - this.x;
    var dy = targetY - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0) {
      // Normalize and apply speed
      var dirX = dx / dist;
      var dirY = dy / dist;
      
      // Add zigzag perpendicular movement - more erratic
      var perpX = -dirY * this.zigzagDirection;
      var perpY = dirX * this.zigzagDirection;
      
      // Fleeing = faster and more direct
      if (fleeing) {
        this.vel.x = (dirX * 0.9 + perpX * 0.4) * this.speed * 1.3;
        this.vel.y = (dirY * 0.9 + perpY * 0.4) * this.speed * 1.3;
      } else {
        this.vel.x = (dirX * 0.5 + perpX * 0.8) * this.speed;
        this.vel.y = (dirY * 0.5 + perpY * 0.8) * this.speed;
      }

      // Edge avoidance when fleeing (prevent corner camping)
      if (fleeing) {
        var edgeMargin = 80;
        var edgePushX = 0;
        var edgePushY = 0;

        if (this.x < edgeMargin) edgePushX += (edgeMargin - this.x) / edgeMargin;
        if (this.x > Game.canvasWidth - edgeMargin) edgePushX -= (this.x - (Game.canvasWidth - edgeMargin)) / edgeMargin;
        if (this.y < edgeMargin) edgePushY += (edgeMargin - this.y) / edgeMargin;
        if (this.y > Game.canvasHeight - edgeMargin) edgePushY -= (this.y - (Game.canvasHeight - edgeMargin)) / edgeMargin;

        this.vel.x += edgePushX * this.speed * 1.2;
        this.vel.y += edgePushY * this.speed * 1.2;
      }
      
      // Rotate to face movement direction
      this.rot = Math.atan2(this.vel.y, this.vel.x) * 180 / Math.PI + 90;
    }
    
    // Check collision with energy beam (only if not already severed)
    if (window.DASEMode && DASEMode.isActive() && !DASEMode.beamSevered) {
      if (this.checkBeamCollision()) {
        DASEMode.severBeam();
        SFX.beamSevered();
      }
    }
  };
  
  /**
   * Check if Silo collides with the energy beam
   */
  this.checkBeamCollision = function() {
    if (!DASEMode.turret || !Game.ship) return false;
    
    var shipX = Game.ship.x;
    var shipY = Game.ship.y;
    var turretX = DASEMode.turret.x;
    var turretY = DASEMode.turret.y;
    
    // Point-to-line-segment distance
    var dist = this.pointToLineDistance(
      this.x, this.y,
      shipX, shipY,
      turretX, turretY
    );
    
    return dist < 20; // Collision threshold
  };
  
  /**
   * Calculate distance from point to line segment
   */
  this.pointToLineDistance = function(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var lenSq = dx * dx + dy * dy;
    
    if (lenSq === 0) {
      dx = px - x1;
      dy = py - y1;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    var nearX = x1 + t * dx;
    var nearY = y1 + t * dy;
    
    dx = px - nearX;
    dy = py - nearY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  /**
   * Draw the red diamond ship using sprite
   */
  this.draw = function() {
    if (!this.visible) return;
    
    var ctx = this.context;
    
    // Hit flash effect
    var flashAlpha = this.hitFlashTimer > 0 ? 0.5 + Math.sin(this.hitFlashTimer * 2) * 0.5 : 1;
    
    ctx.save();
    ctx.globalAlpha = flashAlpha;

    // Maintain collision path for isPointInPath checks
    ctx.beginPath();
    ctx.moveTo(this.points[0], this.points[1]);
    for (var i = 2; i < this.points.length; i += 2) {
      ctx.lineTo(this.points[i], this.points[i + 1]);
    }
    ctx.closePath();
    
    // Draw the sprite centered
    var size = 48;
    if (SILO_IMG.complete && SILO_IMG.naturalWidth > 0) {
      // Apply flash effect by drawing white overlay
      if (this.hitFlashTimer > 0) {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(SILO_IMG, -size/2, -size/2, size, size);
    } else {
      // Fallback: red diamond
      ctx.shadowColor = '#FF0055';
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.moveTo(this.points[0], this.points[1]);
      for (var i = 2; i < this.points.length; i += 2) {
        ctx.lineTo(this.points[i], this.points[i + 1]);
      }
      ctx.closePath();
      
      ctx.strokeStyle = this.hitFlashTimer > 0 ? '#FFFFFF' : '#FF0055';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(255, 0, 85, 0.3)';
      ctx.fill();
    }
    
    ctx.restore();
  };
  
  /**
   * Handle collision - take damage
   */
  this.collision = function(other) {
    if (other.name === 'bullet' || other.name === 'turretbullet') {
      this.health--;
      this.hitFlashTimer = 10;
      SFX.explosion();
      
      if (this.health <= 0) {
        // Destroyed - give rewards
        Game.score += this.scoreValue;
        Game.explosionAt(this.x, this.y);
        
        // Track stats
        if (Game.stats) {
          Game.stats.silosDestroyed++;
          Game.stats.silosScore += this.scoreValue;
        }
        
        // Drop guaranteed fragments (3 per flowchart spec)
        for (var i = 0; i < 3; i++) {
          var frag = spawnDataFragment(
            this.x + (Math.random() - 0.5) * 40,
            this.y + (Math.random() - 0.5) * 40
          );
        }
        
        // Restore beam if severed
        if (window.DASEMode && DASEMode.beamSevered) {
          DASEMode.restoreBeam();
          SFX.beamRestored();
        }
        
        // GUARANTEED Similarity drop from Silo (max 2 per game)
        if (window.SimilarityMode && SimilarityMode.getDropsUsed() < 2) {
          spawnSimilarityPickup(this.x, this.y);
        }
        
        // Notify DASE system
        if (window.DASEMode) {
          DASEMode.onSiloDestroyed();
        }
        
        this.die();
      }
    }
  };
  
  /**
   * Set difficulty level (affects speed)
   */
  this.setDifficulty = function(wave) {
    if (wave >= 8) {
      this.speed = this.baseSpeed * 1.5;
      this.zigzagFrequency = 0.25;
    } else if (wave >= 4) {
      this.speed = this.baseSpeed * 1.2;
      this.zigzagFrequency = 0.2;
    } else {
      this.speed = this.baseSpeed;
      this.zigzagFrequency = 0.15;
    }
  };
  
  /**
   * Spawn the Silo at a random edge position
   */
  this.spawn = function() {
    var edge = Math.floor(Math.random() * 4);
    switch(edge) {
      case 0: // Top
        this.x = Math.random() * Game.canvasWidth;
        this.y = -30;
        break;
      case 1: // Right
        this.x = Game.canvasWidth + 30;
        this.y = Math.random() * Game.canvasHeight;
        break;
      case 2: // Bottom
        this.x = Math.random() * Game.canvasWidth;
        this.y = Game.canvasHeight + 30;
        break;
      case 3: // Left
        this.x = -30;
        this.y = Math.random() * Game.canvasHeight;
        break;
    }
    
    this.health = 3;
    this.visible = true;
    this.hitFlashTimer = 0;
    this.setDifficulty(Game.currentWave || 1);
    Game.sprites.push(this);
  };
};

Silo.prototype = new Sprite();
