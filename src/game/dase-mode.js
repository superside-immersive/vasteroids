/**
 * DASE Mode System
 * Disaggregated Shared Everything - Core power state
 * Spawns orbiting turret with energy beam connection
 */

// Preload turret sprite
var TURRET_IMG = new Image();
TURRET_IMG.src = 'assets/images/turret.svg';

var DASEMode = (function() {
  // DASE Meter state
  var fragments = 0;
  var meterMax = 6; // Fragments needed to fill meter (dynamic per wave)
  
  // DASE Mode state
  var active = false;
  var duration = 0; // Remaining time in frames
  var baseDuration = 1200; // ~20 seconds at 60fps
  var maxExtension = 600; // Max +10 seconds
  var extensionAdded = 0;
  
  // Beam state
  var beamSevered = false;
  var meterFrozenValue = 0;
  
  // Silo tracking
  var siloSpawnTimer = 0;
  var silosSpawnedThisDASE = 0;
  var siloKillTime = 0;
  var maxSilosPerDASE = 2;
  
  // Turret reference
  var turret = null;
  
  /**
   * Calculate fragments needed based on current wave
   */
  function calculateMeterMax() {
    var wave = Game.currentWave || 1;
    if (wave === 1) return 6;
    if (wave === 2) return 8;
    return 10; // Wave 3+
  }
  
  /**
   * Turret class - orbiting auto-firing weapon
   */
  function Turret() {
    this.x = 0;
    this.y = 0;
    this.orbitAngle = 0;
    this.orbitRadius = 70; // Closer to ship
    this.orbitSpeed = 0.04; // Faster orbit
    this.baseOrbitSpeed = 0.04;
    
    this.fireTimer = 0;
    this.fireRate = 10; // Balanced fire rate (was 18 - too slow)
    this.baseFireRate = 10;
    
    this.bullets = [];
    this.maxBullets = 20; // More bullets for better coverage
    
    // Initialize bullet pool
    for (var i = 0; i < this.maxBullets; i++) {
      var bullet = new TurretBullet();
      this.bullets.push(bullet);
      Game.sprites.push(bullet);
    }
    
    this.visible = true;
    this.disabled = false;
    this.targetAngle = 0; // For smooth aiming
  }
  
  Turret.prototype.update = function(delta) {
    if (!Game.ship || !Game.ship.visible) return;
    
    // Orbit around ship - but smoothly follow if ship moves fast
    this.orbitAngle += this.orbitSpeed * delta;
    
    // Calculate target position on orbit
    var targetX = Game.ship.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    var targetY = Game.ship.y + Math.sin(this.orbitAngle) * this.orbitRadius;
    
    // Smooth follow - turret catches up to target position
    // This prevents cable from stretching when ship moves fast
    var followSpeed = 0.3;
    this.x += (targetX - this.x) * followSpeed;
    this.y += (targetY - this.y) * followSpeed;
    
    // If too far from ship, snap closer (max cable length)
    var maxDist = this.orbitRadius * 1.2;
    var dx = this.x - Game.ship.x;
    var dy = this.y - Game.ship.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      var scale = maxDist / dist;
      this.x = Game.ship.x + dx * scale;
      this.y = Game.ship.y + dy * scale;
    }
    
    // Auto-fire at nearest target (if not disabled)
    if (!this.disabled) {
      this.fireTimer -= delta;
      if (this.fireTimer <= 0) {
        this.fireAtNearestTarget();
        this.fireTimer = this.fireRate;
      }
    }
  };
  
  Turret.prototype.fireAtNearestTarget = function() {
    // Find nearest asteroid or silo - prioritize Silo if present
    var nearest = null;
    var nearestDist = Infinity;
    var siloTarget = null;
    
    for (var i = 0; i < Game.sprites.length; i++) {
      var sprite = Game.sprites[i];
      if (!sprite.visible) continue;
      if (sprite.name !== 'asteroid' && sprite.name !== 'silo') continue;
      
      var dx = sprite.x - this.x;
      var dy = sprite.y - this.y;
      var dist = dx * dx + dy * dy;
      
      // Prioritize Silo - it's the main threat
      if (sprite.name === 'silo') {
        siloTarget = sprite;
      }
      
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = sprite;
      }
    }
    
    // Target Silo first if present, otherwise nearest
    var target = siloTarget || nearest;
    
    if (target) {
      // Find available bullet
      for (var i = 0; i < this.bullets.length; i++) {
        if (!this.bullets[i].visible) {
          var bullet = this.bullets[i];
          
          // Fire directly at target's CURRENT position (no prediction)
          // Once fired, bullet travels in straight line
          var bulletSpeed = 14;
          var dx = target.x - this.x;
          var dy = target.y - this.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          
          bullet.x = this.x;
          bullet.y = this.y;
          bullet.vel.x = (dx / dist) * bulletSpeed;
          bullet.vel.y = (dy / dist) * bulletSpeed;
          bullet.visible = true;
          bullet.lifetime = 50;
          
          SFX.laser();
          break;
        }
      }
    }
  };
  
  Turret.prototype.draw = function(ctx) {
    if (!this.visible) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.orbitAngle);
    
    var size = 36;
    
    // Draw turret using sprite
    if (TURRET_IMG.complete && TURRET_IMG.naturalWidth > 0) {
      if (this.disabled) {
        ctx.globalAlpha = 0.5;
      }
      ctx.drawImage(TURRET_IMG, -size/2, -size/2, size, size);
    } else {
      // Fallback: diamond shape
      var color = this.disabled ? '#666666' : '#1FD9FE';
      var fillColor = this.disabled ? 'rgba(100, 100, 100, 0.5)' : 'rgba(31, 217, 254, 0.5)';
      
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 16);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      
      ctx.fillStyle = fillColor;
      ctx.fill();
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    
    ctx.restore();
  };
  
  Turret.prototype.setScaling = function(fragmentCount) {
    // Linear scaling - more fragments = faster everything
    var bonus = Math.min(fragmentCount / 10, 1); // 0 to 1 scale
    this.orbitSpeed = this.baseOrbitSpeed * (1 + bonus * 0.5);
    this.fireRate = Math.max(6, this.baseFireRate - bonus * 4);
  };
  
  /**
   * TurretBullet class
   */
  function TurretBullet() {
    this.init("turretbullet", [-2, -2, 2, -2, 2, 2, -2, 2]);
    this.visible = false;
    this.lifetime = 0;
    this.postMove = this.wrapPostMove;
    this.collidesWith = ["asteroid"]; // Turret bullets only hit asteroids, NOT Silo
  }
  
  TurretBullet.prototype = new Sprite();
  
  TurretBullet.prototype.preMove = function(delta) {
    if (this.visible) {
      this.lifetime -= delta;
      if (this.lifetime <= 0) {
        this.visible = false;
      }
    }
  };
  
  TurretBullet.prototype.draw = function() {
    if (!this.visible) return;
    
    var ctx = this.context;
    
    // Cyan bullet with glow
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1FD9FE';
    ctx.shadowColor = '#1FD9FE';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  
  TurretBullet.prototype.collision = function(other) {
    if (other.name === 'asteroid' || other.name === 'silo') {
      this.visible = false;
    }
  };
  
  // Public API
  return {
    turret: null,
    beamSevered: false,
    
    /**
     * Initialize DASE system for new game
     */
    init: function() {
      fragments = 0;
      active = false;
      duration = 0;
      extensionAdded = 0;
      beamSevered = false;
      this.beamSevered = false;
      meterFrozenValue = 0;
      siloSpawnTimer = 0;
      silosSpawnedThisDASE = 0;
      siloKillTime = 0;
      turret = null;
      this.turret = null;
    },
    
    /**
     * Add fragments to the meter
     */
    addFragment: function(count) {
      count = count || 1;
      
      if (active && !beamSevered) {
        // During DASE: extend duration
        var extension = count * 60; // +1 second per fragment
        if (extensionAdded + extension <= maxExtension) {
          duration += extension;
          extensionAdded += extension;
        }
        // Also boost turret
        if (turret) {
          turret.setScaling(fragments + count);
        }
      }
      
      fragments += count;
      
      // Check for auto-activation (use dynamic meterMax)
      var currentMeterMax = calculateMeterMax();
      if (!active && fragments >= currentMeterMax) {
        this.activate();
      }
    },
    
    /**
     * Get current fragment count
     */
    getFragments: function() {
      return fragments;
    },
    
    /**
     * Get meter max
     */
    getMeterMax: function() {
      return calculateMeterMax();
    },
    
    /**
     * Check if DASE mode is active
     */
    isActive: function() {
      return active;
    },
    
    /**
     * Activate DASE mode
     */
    activate: function() {
      if (active) return;
      
      active = true;
      duration = baseDuration;
      extensionAdded = 0;
      beamSevered = false;
      this.beamSevered = false;
      silosSpawnedThisDASE = 0;
      siloKillTime = 0;
      
      // Track stats
      if (Game.stats) {
        Game.stats.daseActivations++;
      }
      
      // Spawn turret
      turret = new Turret();
      this.turret = turret;
      
      // Schedule Silo (Latency Drone) spawn - appears later in DASE to give player time
      siloSpawnTimer = 420 + Math.random() * 180; // 7-10 seconds after DASE starts
      
      // Show DASE logo animation
      if (window.HUD && HUD.showDASELogo) {
        HUD.showDASELogo();
      }
      
      SFX.daseActivate();
    },
    
    /**
     * Deactivate DASE mode
     */
    deactivate: function() {
      active = false;
      duration = 0;
      
      // Remove turret bullets
      if (turret) {
        for (var i = 0; i < turret.bullets.length; i++) {
          turret.bullets[i].visible = false;
        }
      }
      
      turret = null;
      this.turret = null;
      beamSevered = false;
      this.beamSevered = false;
      
      // Reset meter (keep some fragments)
      fragments = Math.floor(fragments * 0.2);
      
    },
    
    /**
     * Sever the energy beam (Silo hit it)
     */
    severBeam: function() {
      beamSevered = true;
      this.beamSevered = true;
      meterFrozenValue = fragments;
      
      // Disable turret
      if (turret) {
        turret.disabled = true;
      }
    },
    
    /**
     * Restore the energy beam (Silo destroyed)
     */
    restoreBeam: function() {
      beamSevered = false;
      this.beamSevered = false;
      
      // Re-enable turret
      if (turret) {
        turret.disabled = false;
      }
      
      // Bonus time
      duration += 300; // +5 seconds
      
      // Play sound
      SFX.beamRestored();
    },
    
    /**
     * Called when Silo is destroyed
     */
    onSiloDestroyed: function() {
      siloKillTime = Date.now();
      
      // If killed quickly (<5 seconds since DASE started), spawn another
      if (silosSpawnedThisDASE < maxSilosPerDASE) {
        siloSpawnTimer = 180; // 3 second delay
      }
    },
    
    /**
     * Update DASE mode (called each frame)
     */
    update: function(delta) {
      if (!active) return;
      
      // Update turret
      if (turret && !beamSevered) {
        turret.update(delta);
      }
      
      // Spawn Silo timer
      if (siloSpawnTimer > 0) {
        siloSpawnTimer -= delta;
        if (siloSpawnTimer <= 0 && silosSpawnedThisDASE < maxSilosPerDASE) {
          var silo = new Silo();
          silo.spawn();
          silosSpawnedThisDASE++;
          siloSpawnTimer = -1;
          SFX.siloSpawn();
        }
      }
      
      // Duration countdown (paused if beam severed)
      if (!beamSevered) {
        duration -= delta;
        if (duration <= 0) {
          this.deactivate();
        }
      }
    },
    
    /**
     * Draw DASE elements (turret, beam)
     */
    draw: function(ctx) {
      if (!active || !turret) return;
      
      // Draw energy beam (connect to dotted orbit ring, not ship center)
      if (Game.ship && Game.ship.visible) {
        var ringRadius = Math.max(32, turret.orbitRadius * 0.55);
        var dxRing = turret.x - Game.ship.x;
        var dyRing = turret.y - Game.ship.y;
        var distRing = Math.sqrt(dxRing * dxRing + dyRing * dyRing) || 1;
        var ringX = Game.ship.x + (dxRing / distRing) * ringRadius;
        var ringY = Game.ship.y + (dyRing / distRing) * ringRadius;
        var stemLength = 10;
        var stemX = ringX + (dxRing / distRing) * stemLength;
        var stemY = ringY + (dyRing / distRing) * stemLength;

        // Dotted ring around ship
        ctx.save();
        ctx.strokeStyle = '#1FD9FE';
        ctx.globalAlpha = beamSevered ? 0.35 : 0.7;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 10]);
        ctx.beginPath();
        ctx.arc(Game.ship.x, Game.ship.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        
        if (beamSevered) {
          // Severed beam - flickering red
          ctx.strokeStyle = '#FF0055';
          ctx.globalAlpha = 0.3 + Math.random() * 0.3;
          ctx.setLineDash([10, 10]);
        } else {
          // Active beam - solid cyan
          ctx.strokeStyle = '#1FD9FE';
          ctx.globalAlpha = 0.8;
        }
        
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ringX, ringY);
        ctx.lineTo(stemX, stemY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(stemX, stemY);
        ctx.lineTo(turret.x, turret.y);
        ctx.stroke();
        
        // Glow pass
        if (!beamSevered) {
          ctx.strokeStyle = '#1FD9FE';
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 8;
          ctx.stroke();
        }

        // Cyan node at ring connection
        ctx.beginPath();
        ctx.arc(ringX, ringY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#1FD9FE';
        ctx.shadowColor = '#1FD9FE';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.restore();
      }
      
      // Draw turret
      turret.draw(ctx);
      
      // Draw core glow on ship
      if (Game.ship && Game.ship.visible && !beamSevered) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(Game.ship.x, Game.ship.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(31, 217, 254, 0.3)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(Game.ship.x, Game.ship.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(31, 217, 254, 0.6)';
        ctx.fill();
        ctx.restore();
      }
      
      // Draw turret duration bar below turret
      if (turret && turret.visible) {
        var durationPercent = duration / (baseDuration + maxExtension);
        var barWidth = 60;
        var barHeight = 6;
        var barX = turret.x - barWidth / 2;
        var barY = turret.y + 25;
        
        ctx.save();
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        
        // Fill
        var fillColor = beamSevered ? '#FF0055' : '#1FD9FE';
        ctx.fillStyle = fillColor;
        ctx.fillRect(barX, barY, barWidth * durationPercent, barHeight);
        
        // Border
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        ctx.restore();
      }
    },
    
    /**
     * Get remaining duration as percentage
     */
    getDurationPercent: function() {
      if (!active) return 0;
      return duration / (baseDuration + maxExtension);
    }
  };
})();
