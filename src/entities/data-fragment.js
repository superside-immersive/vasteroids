/**
 * Data Fragment Entity
 * Collectible orbs dropped by destroyed asteroids that fill the DASE meter
 */

// Preload data fragment sprite
var DATA_FRAGMENT_IMG = new Image();
DATA_FRAGMENT_IMG.src = 'assets/images/data-fragment.svg';

var DataFragment = function() {
  // Larger collision area for easier pickup
  this.init("datafragment", [-15, -15, 15, -15, 15, 15, -15, 15]);
  
  this.visible = true;
  this.scale = 1;
  this.postMove = this.wrapPostMove;
  this.collidesWith = ["ship"];
  
  // Visual properties
  this.pulseTime = 0;
  this.baseRadius = 18; // Size for the sprite
  
  // Lifetime before auto-despawn (15 seconds - longer to collect)
  this.lifetime = 900;
  this.age = 0;
  
  // Slight drift
  this.vel.x = (Math.random() - 0.5) * 1;
  this.vel.y = (Math.random() - 0.5) * 1;
  
  /**
   * Pre-move update - handle lifetime
   */
  this.preMove = function(delta) {
    this.pulseTime += delta * 0.15;
    this.age += delta;
    
    if (this.age > this.lifetime) {
      this.die();
    }
  };
  
  /**
   * Draw data fragment using sprite image
   */
  this.draw = function() {
    if (!this.visible) return;
    
    var ctx = this.context;
    var pulse = Math.sin(this.pulseTime) * 0.1 + 1; // Subtle pulse
    var fadeAlpha = this.age > this.lifetime * 0.7 
      ? 1 - ((this.age - this.lifetime * 0.7) / (this.lifetime * 0.3))
      : 1;
    
    var size = this.baseRadius * 2 * pulse;
    
    ctx.globalAlpha = fadeAlpha;
    
    // Draw the sprite centered
    if (DATA_FRAGMENT_IMG.complete && DATA_FRAGMENT_IMG.naturalWidth > 0) {
      ctx.drawImage(DATA_FRAGMENT_IMG, -size/2, -size/2, size, size);
    } else {
      // Fallback: simple diamond if image not loaded
      ctx.beginPath();
      ctx.moveTo(0, -size/2);
      ctx.lineTo(size/2, 0);
      ctx.lineTo(0, size/2);
      ctx.lineTo(-size/2, 0);
      ctx.closePath();
      ctx.fillStyle = '#E86B38';
      ctx.fill();
    }
    
    ctx.globalAlpha = 1;
  };
  
  /**
   * Handle collision with ship - collect fragment
   */
  this.collision = function(other) {
    if (other.name === 'ship') {
      // Add to DASE meter
      if (window.DASEMode) {
        DASEMode.addFragment(1);
        SFX.fragmentCollect();

        // ——— JUICE: fragment collect pop ———
        if (window.Juice) {
          Juice.shake(2, 0.08);
          Juice.flash('#E86B38', 0.08, 0.1);  // subtle orange flash
        }

        // Track stats
        if (window.Game && window.Game.stats) {
          window.Game.stats.fragmentsCollected++;
          var total = window.Game.stats.fragmentsCollected;
          var tier = window.Game.stats.fragmentAchievementTier || 0;
          var nextTier = tier;
          var nextIcon = window.Game.stats.fragmentAchievementIcon || null;
          var announceText = null;

          if (total >= 60 && tier < 3) {
            nextTier = 3;
            nextIcon = 'assets/Badge_Exabyte_Legend_60.png';
            announceText = 'EXABYTE LEGEND ACHIEVED!';
            window.Game.stats.fragmentAchievementName = 'EXABYTE LEGEND';
          } else if (total >= 40 && tier < 2) {
            nextTier = 2;
            nextIcon = 'assets/Badge_Petabyte_Architect_40.png';
            announceText = 'PETABYTE ARCHITECT ACHIEVED!';
            window.Game.stats.fragmentAchievementName = 'PETABYTE ARCHITECT';
          } else if (total >= 20 && tier < 1) {
            nextTier = 1;
            nextIcon = 'assets/Badge_Data_Engineer_20.png';
            announceText = 'DATA ENGINEER ACHIEVED!';
            window.Game.stats.fragmentAchievementName = 'DATA ENGINEER';
          }

          if (nextTier !== tier) {
            window.Game.stats.fragmentAchievementTier = nextTier;
            window.Game.stats.fragmentAchievementIcon = nextIcon;
            console.log('[DataFragment] Achievement unlocked!', nextIcon, announceText, 'Total fragments:', total);
            if (window.SFX && typeof SFX.badgeUnlock === 'function') {
              SFX.badgeUnlock();
            }
            if (window.HUD && typeof HUD.showAchievementToast === 'function') {
              HUD.showAchievementToast(announceText || 'ACHIEVEMENT UNLOCKED!');
            }
            if (window.HUD && typeof HUD.showAchievementEmoji === 'function') {
              HUD.showAchievementEmoji(nextIcon);
            }
          }
        }
      }
      this.die();
    }
  };
  
  /**
   * Get collision points - larger hitbox for easier pickup
   */
  this.transformedPoints = function() {
    if (this.transPoints) return this.transPoints;
    
    var r = 20 * this.scale; // Big collision radius
    var trans = [];
    for (var i = 0; i < 8; i++) {
      var angle = (i / 8) * Math.PI * 2;
      trans.push(this.x + Math.cos(angle) * r);
      trans.push(this.y + Math.sin(angle) * r);
    }
    
    this.transPoints = trans;
    return trans;
  };
};

DataFragment.prototype = new Sprite();

/**
 * Spawn a data fragment at position
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function spawnDataFragment(x, y) {
  var fragment = new DataFragment();
  fragment.x = x;
  fragment.y = y;
  fragment.visible = true;
  Game.sprites.push(fragment);

  if (window.GameCinematics && typeof GameCinematics.onDataFragmentSpawn === 'function') {
    GameCinematics.onDataFragmentSpawn(fragment);
  }

  return fragment;
}
