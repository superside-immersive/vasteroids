/**
 * Similarity Reduction System
 * Pattern recognition power-up that groups asteroids by color
 * Drops: Very rare from asteroids (~5%) OR guaranteed from killing Silo
 */

var SimilarityMode = (function() {
  var active = false;
  var duration = 0;
  var baseDuration = 600; // 10 seconds at 60fps - extended for better gameplay
  
  var dropsUsed = 0;
  var maxDrops = 2;
  
  // Asteroid groupings
  var groups = {
    cyan: [],    // Small asteroids
    magenta: [], // Medium asteroids  
    yellow: []   // Large asteroids
  };
  
  // Track destroyed groups for combos
  var groupsCleared = 0;
  var comboMultiplier = 1;
  
  // Color definitions
  var colors = {
    cyan: '#00FFFF',
    magenta: '#FF00FF', 
    yellow: '#FFFF00'
  };
  
  /**
   * Categorize asteroids by size
   */
  function categorizeAsteroids() {
    groups.cyan = [];
    groups.magenta = [];
    groups.yellow = [];
    
    for (var i = 0; i < Game.sprites.length; i++) {
      var sprite = Game.sprites[i];
      if (sprite.name !== 'asteroid' || !sprite.visible) continue;
      
      var size = sprite.charCount || 100;
      
      // Categorize by size
      if (size < 30) {
        groups.cyan.push(sprite);
        sprite.similarityGroup = 'cyan';
      } else if (size < 80) {
        groups.magenta.push(sprite);
        sprite.similarityGroup = 'magenta';
      } else {
        groups.yellow.push(sprite);
        sprite.similarityGroup = 'yellow';
      }
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
   * Award combo bonus for clearing a group
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
    
    // DASE extension if active
    if (window.DASEMode && DASEMode.isActive()) {
      // Extension handled via fragments
    }
    
    // Screen clear if 3+ groups cleared
    if (groupsCleared >= 3) {
      // Clear remaining small asteroids
      for (var i = 0; i < Game.sprites.length; i++) {
        var sprite = Game.sprites[i];
        if (sprite.name === 'asteroid' && sprite.visible && sprite.charCount < 50) {
          Game.score += 100;
          Game.explosionAt(sprite.x, sprite.y);
          sprite.die();
        }
      }
    }
  }
  
  return {
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
      groups.cyan = [];
      groups.magenta = [];
      groups.yellow = [];
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
     */
    onAsteroidDestroyed: function(asteroid) {
      if (!active) return;
      
      var group = asteroid.similarityGroup;
      if (!group) return;
      
      // Check if group is now cleared
      if (checkGroupCleared(group)) {
        awardGroupBonus(group);
      }
    },
    
    /**
     * Update (called each frame)
     */
    update: function(delta) {
      if (!active) return;
      
      duration -= delta;
      if (duration <= 0) {
        this.deactivate();
      }
    },
    
    /**
     * Deactivate
     */
    deactivate: function() {
      active = false;
      duration = 0;
      
      // Clear group assignments
      for (var i = 0; i < Game.sprites.length; i++) {
        var sprite = Game.sprites[i];
        if (sprite.similarityGroup) {
          delete sprite.similarityGroup;
        }
      }
      
      groups.cyan = [];
      groups.magenta = [];
      groups.yellow = [];
    },
    
    /**
     * Get group color for asteroid
     */
    getGroupColor: function(asteroid) {
      if (!active || !asteroid.similarityGroup) return null;
      return colors[asteroid.similarityGroup];
    },
    
    /**
     * Draw overlay for asteroid (called from asteroid draw)
     */
    drawOverlay: function(ctx, asteroid) {
      if (!active || !asteroid.similarityGroup) return;
      
      var color = colors[asteroid.similarityGroup];
      var r = (asteroid.clusterRadius || 50) * (asteroid.scale || 1);
      
      ctx.save();
      ctx.translate(asteroid.x, asteroid.y);
      
      // Pulsing ring
      var pulse = Math.sin(Date.now() * 0.005) * 0.2 + 1;
      
      ctx.beginPath();
      ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      
      // Inner glow
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.15;
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
