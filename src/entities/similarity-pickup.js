/**
 * Similarity Reduction Pickup
 * Rare power-up that activates pattern recognition mode
 */

// Preload similarity orb sprite
var SIMILARITY_ORB_IMG = new Image();
SIMILARITY_ORB_IMG.src = 'assets/images/similarity-orb.svg';

var SimilarityPickup = function() {
  // Collision area
  this.init("similaritypickup", [
    0, -18,
    16, -9,
    16, 9,
    0, 18,
    -16, 9,
    -16, -9
  ]);
  
  this.visible = true;
  this.scale = 1;
  this.postMove = this.wrapPostMove;
  this.collidesWith = ["ship"];
  
  // Visual properties
  this.pulseTime = 0;
  this.rotationAngle = 0;
  
  // Lifetime (15 seconds)
  this.lifetime = 900;
  this.age = 0;
  
  // Slight drift
  this.vel.x = (Math.random() - 0.5) * 0.8;
  this.vel.y = (Math.random() - 0.5) * 0.8;
  
  /**
   * Pre-move update
   */
  this.preMove = function(delta) {
    this.pulseTime += delta * 0.08;
    this.rotationAngle += delta * 0.02;
    this.age += delta;
    
    if (this.age > this.lifetime) {
      this.die();
    }
  };
  
  /**
   * Draw the similarity orb using sprite image
   */
  this.draw = function() {
    if (!this.visible) return;
    
    var ctx = this.context;
    var pulse = Math.sin(this.pulseTime) * 0.15 + 1;
    var fadeAlpha = this.age > this.lifetime * 0.7
      ? 1 - ((this.age - this.lifetime * 0.7) / (this.lifetime * 0.3))
      : 1;
    
    var size = 40 * pulse;
    
    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    ctx.rotate(this.rotationAngle);

    // Maintain collision path for isPointInPath checks
    ctx.beginPath();
    ctx.moveTo(this.points[0], this.points[1]);
    for (var i = 2; i < this.points.length; i += 2) {
      ctx.lineTo(this.points[i], this.points[i + 1]);
    }
    ctx.closePath();
    
    // Draw the sprite centered
    if (SIMILARITY_ORB_IMG.complete && SIMILARITY_ORB_IMG.naturalWidth > 0) {
      ctx.drawImage(SIMILARITY_ORB_IMG, -size/2, -size/2, size, size);
    } else {
      // Fallback: colored circles if image not loaded
      var colors = ['#FF3B30', '#FFD60A', '#34C759', '#0A84FF'];
      for (var i = 0; i < 4; i++) {
        ctx.fillStyle = colors[i];
        ctx.globalAlpha = fadeAlpha * 0.5;
        var angle = (i / 4) * Math.PI * 2 + this.rotationAngle;
        var cx = Math.cos(angle) * 6;
        var cy = Math.sin(angle) * 6;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.restore();
  };
  
  /**
   * Handle collision with ship - activate Similarity Mode
   */
  this.collision = function(other) {
    if (other.name === 'ship') {
      if (window.SimilarityMode) {
        SimilarityMode.activate();
        SFX.similarityActivate();
      }
      this.die();
    }
  };
};

SimilarityPickup.prototype = new Sprite();

/**
 * Spawn a similarity pickup at position
 */
function spawnSimilarityPickup(x, y) {
  if (window.SimilarityMode && SimilarityMode.getDropsUsed() >= 2) {
    return null; // Max 2 per run
  }
  
  var pickup = new SimilarityPickup();
  pickup.x = x;
  pickup.y = y;
  pickup.visible = true;
  Game.sprites.push(pickup);
  
  if (window.SimilarityMode) {
    SimilarityMode.incrementDrops();
  }
  
  return pickup;
}
