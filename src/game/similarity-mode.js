/**
 * Similarity Reduction System
 * Pattern recognition power-up that groups asteroids by color
 * Drops: Very rare from asteroids (~5%) OR guaranteed from killing Silo
 * 
 * NEW BEHAVIOR: Asteroids are randomly grouped into 4 colors.
 * Destroying one asteroid triggers chain implosion of all same-colored asteroids.
 * Mode deactivates after chain destruction completes.
 */

var SimilarityMode = (function() {
  var active = false;
  var duration = 0;
  var baseDuration = 600; // 10 seconds at 60fps - extended for better gameplay
  
  var dropsUsed = 0;
  var maxDrops = 2;
  
  // Asteroid groupings - now 4 random groups
  var groups = {
    red: [],
    yellow: [],
    green: [],
    blue: []
  };
  
  // Chain destruction state
  var chainTriggered = false;
  var pendingImplosions = []; // Asteroids being imploded
  var implosionDuration = 55; // Frames for implosion animation (longer for better effect)
  var chainBonus = 0;
  var chainGroupSize = 0;
  
  // Sparkle particles for implosion effect
  var implosionParticles = [];
  
  // Track destroyed groups for combos
  var groupsCleared = 0;
  var comboMultiplier = 1;
  
  // Color definitions - 4 colors now
  var colors = {
    red: '#FF3B30',
    yellow: '#FFD60A',
    green: '#34C759',
    blue: '#0A84FF'
  };
  
  /**
   * Categorize asteroids randomly into 4 color groups
   */
  function categorizeAsteroids() {
    groups.red = [];
    groups.yellow = [];
    groups.green = [];
    groups.blue = [];
    
    // Collect all visible asteroids
    var asteroids = [];
    for (var i = 0; i < Game.sprites.length; i++) {
      var sprite = Game.sprites[i];
      if (sprite.name !== 'asteroid' || !sprite.visible) continue;
      asteroids.push(sprite);
    }
    
    // Shuffle asteroids for random distribution
    for (var i = asteroids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = asteroids[i];
      asteroids[i] = asteroids[j];
      asteroids[j] = temp;
    }
    
    // Distribute evenly across 4 groups (round-robin)
    var groupNames = ['red', 'yellow', 'green', 'blue'];
    for (var i = 0; i < asteroids.length; i++) {
      var groupName = groupNames[i % 4];
      groups[groupName].push(asteroids[i]);
      asteroids[i].similarityGroup = groupName;
    }
  }
  
  /**
   * Check if a group has been cleared
   */
  function checkGroupCleared(groupName) {
    var group = groups[groupName];
    if (!group || group.length === 0) return false;
    
    // Check if all in group are destroyed
    for (var i = 0; i < group.length; i++) {
      if (group[i].visible) return false;
    }
    
    return true;
  }
  
  /**
   * Start implosion animation for an asteroid
   */
  function startImplosion(asteroid, delay) {
    asteroid.implosionState = {
      progress: 0,
      delay: delay || 0,
      started: false,
      duration: implosionDuration
    };
    pendingImplosions.push(asteroid);
  }
  
  /**
   * Update all pending implosions
   */
  function updateImplosions() {
    if (pendingImplosions.length === 0) return;
    
    var completed = [];
    
    for (var i = 0; i < pendingImplosions.length; i++) {
      var asteroid = pendingImplosions[i];
      var state = asteroid.implosionState;
      
      if (!state) {
        completed.push(i);
        continue;
      }
      
      // Handle delay before starting
      if (state.delay > 0) {
        state.delay--;
        continue;
      }
      
      state.started = true;
      state.progress++;
      
      // Calculate implosion progress 0-1
      var t = state.progress / state.duration;
      asteroid.implosionProgress = t;
      
      // Compression scale (1 -> 0) - compress to nothing
      asteroid.compressionScale = 1 - t;
      
      // Vibration intensity increases as compression progresses
      asteroid.vibrationIntensity = t * 6;
      
      // Spawn sparkle particles during compression
      if (Math.random() < 0.4 + t * 0.5) {
        var color = colors[asteroid.similarityGroup] || '#FFFFFF';
        var radius = (asteroid.clusterRadius || 50) * asteroid.compressionScale;
        var angle = Math.random() * Math.PI * 2;
        var dist = radius * (0.5 + Math.random() * 0.5);
        implosionParticles.push({
          x: asteroid.x + Math.cos(angle) * dist,
          y: asteroid.y + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          color: color,
          life: 15 + Math.random() * 10,
          size: 2 + Math.random() * 3
        });
      }
      
      // Check if implosion complete
      if (state.progress >= state.duration) {
        completed.push(i);
        
        // Award reduced points (50%)
        var baseScore = Math.floor(GAME_CONFIG.asteroid.scorePerChar * asteroid.charCount * 0.5);
        Game.score += baseScore;
        chainBonus += baseScore;
        
        // Create explosion and destroy (no split - mark as chain destroyed)
        asteroid.chainDestroyed = true; // Flag to prevent splitting
        Game.explosionAt(asteroid.x, asteroid.y);
        asteroid.visible = false;
        asteroid.die();
      }
    }
    
    // Remove completed implosions (in reverse order to preserve indices)
    for (var i = completed.length - 1; i >= 0; i--) {
      pendingImplosions.splice(completed[i], 1);
    }
    
    // Check if all implosions complete
    if (chainTriggered && pendingImplosions.length === 0) {
      // Award combo bonus
      var comboBonus = chainGroupSize * 100;
      Game.score += comboBonus;
      
      // Show floating text (if HUD available)
      if (window.HUD && HUD.showFloatingText) {
        HUD.showFloatingText('CHAIN x' + chainGroupSize + '! +' + (chainBonus + comboBonus), Game.canvasWidth / 2, Game.canvasHeight / 2);
      }
      
      // Deactivate mode after chain completes (but keep particles alive)
      deactivateMode();
    }
    
    // Update particles
    updateParticles();
  }
  
  /**
   * Update sparkle particles
   */
  function updateParticles() {
    for (var i = implosionParticles.length - 1; i >= 0; i--) {
      var p = implosionParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      p.size *= 0.95;
      
      if (p.life <= 0 || p.size < 0.5) {
        implosionParticles.splice(i, 1);
      }
    }
  }
  
  /**
   * Draw sparkle particles
   */
  function drawParticles(ctx) {
    for (var i = 0; i < implosionParticles.length; i++) {
      var p = implosionParticles[i];
      var alpha = p.life / 25;
      
      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw a small cross/star shape
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - p.size * 1.5, p.y);
      ctx.lineTo(p.x + p.size * 1.5, p.y);
      ctx.moveTo(p.x, p.y - p.size * 1.5);
      ctx.lineTo(p.x, p.y + p.size * 1.5);
      ctx.stroke();
      
      ctx.restore();
    }
  }
  
  /**
   * Full deactivation (internal)
   */
  function deactivateMode() {
    active = false;
    duration = 0;
    chainTriggered = false;
    pendingImplosions = [];
    chainBonus = 0;
    chainGroupSize = 0;
    // Don't clear particles here - let them fade out naturally
    
    // Clear group assignments
    for (var i = 0; i < Game.sprites.length; i++) {
      var sprite = Game.sprites[i];
      if (sprite.similarityGroup) {
        delete sprite.similarityGroup;
        delete sprite.implosionState;
        delete sprite.implosionProgress;
        delete sprite.compressionScale;
        delete sprite.vibrationIntensity;
        delete sprite.chainDestroyed;
      }
    }
    
    groups.red = [];
    groups.yellow = [];
    groups.green = [];
    groups.blue = [];
  }
  
  /**
   * Award combo bonus for clearing a group (legacy - kept for compatibility)
   */
  function awardGroupBonus(groupName) {
    groupsCleared++;
    
    // Score multiplier
    comboMultiplier = Math.min(3, 1 + groupsCleared);
    
    // Bonus fragments
    var bonusFragments = 3;
    if (window.DASEMode) {
      DASEMode.addFragment(bonusFragments);
    }
  }
  
  return {
    /**
     * Get color map for external use
     */
    getColors: function() {
      return colors;
    },
    
    /**
     * Check if chain has been triggered
     */
    isChainTriggered: function() {
      return chainTriggered;
    },
    /**
     * Get drops used count
     */
    getDropsUsed: function() {
      return dropsUsed;
    },
    
    /**
     * Increment drops used (called when pickup spawns)
     */
    incrementDrops: function() {
      dropsUsed++;
    },
    
    /**
     * Initialize for new game
     */
    init: function() {
      active = false;
      duration = 0;
      dropsUsed = 0;
      groupsCleared = 0;
      comboMultiplier = 1;
      chainTriggered = false;
      pendingImplosions = [];
      chainBonus = 0;
      chainGroupSize = 0;
      implosionParticles = [];
      groups.red = [];
      groups.yellow = [];
      groups.green = [];
      groups.blue = [];
    },
    
    /**
     * Draw implosion particles (call from game render loop)
     */
    drawImplosionParticles: function(ctx) {
      drawParticles(ctx);
    },
    
    /**
     * Check if there are active particles
     */
    hasParticles: function() {
      return implosionParticles.length > 0;
    },
    
    /**
     * Activate Similarity Mode
     */
    activate: function() {
      if (active) return;
      
      active = true;
      duration = baseDuration;
      groupsCleared = 0;
      comboMultiplier = 1;
      
      // Categorize all current asteroids
      categorizeAsteroids();
    },
    
    /**
     * Check if active
     */
    isActive: function() {
      return active;
    },
    
    /**
     * Get current combo multiplier
     */
    getMultiplier: function() {
      return active ? comboMultiplier : 1;
    },
    
    /**
     * Notify that an asteroid was destroyed (for similarity grouping)
     * Now triggers chain destruction
     */
    onAsteroidDestroyed: function(asteroid) {
      if (!active) return;
      if (chainTriggered) return; // Chain already in progress
      
      var group = asteroid.similarityGroup;
      if (!group) return;
      
      // Trigger chain destruction for all asteroids in same group
      this.triggerChainDestruction(asteroid, group);
    },
    
    /**
     * Trigger chain destruction of all asteroids in the same color group
     */
    triggerChainDestruction: function(triggeredAsteroid, groupName) {
      if (chainTriggered) return;
      
      chainTriggered = true;
      chainBonus = 0;
      chainGroupSize = 0;
      
      // Play implosion sound
      if (window.SFX && SFX.chainImplosion) {
        SFX.chainImplosion();
      }
      
      // Get all asteroids in the same group
      var groupAsteroids = groups[groupName];
      if (!groupAsteroids) return;
      
      var delay = 0;
      
      // Add the triggered asteroid first (no delay)
      if (triggeredAsteroid && triggeredAsteroid.visible) {
        startImplosion(triggeredAsteroid, 0);
        chainGroupSize++;
        delay = 2;
      }
      
      // Add all other asteroids in the same group
      for (var i = 0; i < groupAsteroids.length; i++) {
        var asteroid = groupAsteroids[i];
        if (asteroid.visible && asteroid !== triggeredAsteroid) {
          startImplosion(asteroid, delay);
          chainGroupSize++;
          delay += 2; // 2-frame stagger for near-simultaneous effect
        }
      }
      
      // If no asteroids to chain, just deactivate
      if (chainGroupSize === 0) {
        deactivateMode();
      }
    },
    
    /**
     * Update (called each frame)
     */
    update: function(delta) {
      // Always update particles (even when not active, so they fade out)
      updateParticles();
      
      if (!active) return;
      
      // Update implosion animations
      updateImplosions();
      
      // Only count down duration if chain not triggered
      if (!chainTriggered) {
        duration -= delta;
        if (duration <= 0) {
          this.deactivate();
        }
      }
    },
    
    /**
     * Deactivate
     */
    deactivate: function() {
      deactivateMode();
    },
    
    /**
     * Get group color for asteroid
     */
    getGroupColor: function(asteroid) {
      if (!active || !asteroid.similarityGroup) return null;
      return colors[asteroid.similarityGroup];
    },
    
    /**
     * Draw overlay for asteroid (called from game render)
     */
    drawOverlay: function(ctx, asteroid) {
      if (!active || !asteroid.similarityGroup) return;
      
      var color = colors[asteroid.similarityGroup];
      var baseRadius = (asteroid.clusterRadius || 50) * (asteroid.scale || 1);
      
      // Apply compression if imploding
      var compressionScale = asteroid.compressionScale || 1;
      var r = baseRadius * compressionScale;
      
      ctx.save();
      ctx.translate(asteroid.x, asteroid.y);
      
      // Pulsing ring (unless imploding)
      var pulse = 1;
      if (!asteroid.implosionProgress) {
        pulse = Math.sin(Date.now() * 0.005) * 0.2 + 1;
      } else {
        // During implosion, ring compresses faster than asteroid
        r = baseRadius * (1 - asteroid.implosionProgress);
      }
      
      // Vibration during implosion
      if (asteroid.vibrationIntensity) {
        var vx = (Math.random() - 0.5) * asteroid.vibrationIntensity * 2;
        var vy = (Math.random() - 0.5) * asteroid.vibrationIntensity * 2;
        ctx.translate(vx, vy);
      }
      
      ctx.beginPath();
      ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      
      // Brighter during implosion
      if (asteroid.implosionProgress) {
        ctx.lineWidth = 4 + asteroid.implosionProgress * 3;
        ctx.globalAlpha = 0.8 + asteroid.implosionProgress * 0.2;
      }
      
      ctx.stroke();
      
      // Inner glow
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.15;
      if (asteroid.implosionProgress) {
        ctx.globalAlpha = 0.15 + asteroid.implosionProgress * 0.3;
      }
      ctx.fill();
      
      ctx.restore();
    },
    
    /**
     * Check if should drop pickup on wave clear
     */
    shouldDropOnWaveClear: function(waveNumber) {
      // Guaranteed on wave 5
      if (waveNumber === 5 && dropsUsed === 0) {
        return true;
      }
      return false;
    },
    
    /**
     * Get remaining duration percent
     */
    getDurationPercent: function() {
      if (!active) return 0;
      return duration / baseDuration;
    }
  };
})();
