/**
 * Data Fragment Entity
 * Collectible orbs dropped by destroyed asteroids that fill the DASE meter
 */

var DataFragment = function() {
  // Larger collision area for easier pickup
  this.init("datafragment", [-15, -15, 15, -15, 15, 15, -15, 15]);
  
  this.visible = true;
  this.scale = 1;
  this.postMove = this.wrapPostMove;
  this.collidesWith = ["ship"];
  
  // Visual properties - simple, no glow
  this.pulseTime = 0;
  this.baseRadius = 12; // Bigger for visibility
  
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
   * Draw simple orange diamond/square - NO GLOW
   */
  this.draw = function() {
    if (!this.visible) return;
    
    var ctx = this.context;
    var pulse = Math.sin(this.pulseTime) * 0.15 + 1; // Subtle pulse
    var fadeAlpha = this.age > this.lifetime * 0.7 
      ? 1 - ((this.age - this.lifetime * 0.7) / (this.lifetime * 0.3))
      : 1;
    
    var r = this.baseRadius * pulse;
    
    // Simple diamond shape - solid color
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    
    // Solid orange fill
    ctx.fillStyle = 'rgba(232, 107, 56, ' + fadeAlpha + ')';
    ctx.fill();
    
    // Orange border
    ctx.strokeStyle = 'rgba(255, 150, 80, ' + fadeAlpha + ')';
    ctx.lineWidth = 2;
    ctx.stroke();
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
        // Track stats
        if (Game.stats) {
          Game.stats.fragmentsCollected++;
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
  return fragment;
}
