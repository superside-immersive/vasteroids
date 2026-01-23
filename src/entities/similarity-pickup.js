/**
 * Similarity Reduction Pickup
 * Rare power-up that activates pattern recognition mode
 */

var SimilarityPickup = function() {
  // Hexagon shape
  this.init("similaritypickup", [
    0, -12,
    10, -6,
    10, 6,
    0, 12,
    -10, 6,
    -10, -6
  ]);
  
  this.visible = true;
  this.scale = 1;
  this.postMove = this.wrapPostMove;
  this.collidesWith = ["ship"];
  
  // Visual properties
  this.pulseTime = 0;
  this.colorCycle = 0;
  
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
    this.colorCycle += delta * 0.05;
    this.age += delta;
    
    if (this.age > this.lifetime) {
      this.die();
    }
  };
  
  /**
   * Draw the multi-colored pickup
   */
  this.draw = function() {
    if (!this.visible) return;
    
    var ctx = this.context;
    var pulse = Math.sin(this.pulseTime) * 0.2 + 1;
    var fadeAlpha = this.age > this.lifetime * 0.7
      ? 1 - ((this.age - this.lifetime * 0.7) / (this.lifetime * 0.3))
      : 1;
    
    // Cycling colors (cyan, magenta, yellow)
    var colors = ['#00FFFF', '#FF00FF', '#FFFF00'];
    var colorIndex = Math.floor(this.colorCycle) % 3;
    var currentColor = colors[colorIndex];
    var nextColor = colors[(colorIndex + 1) % 3];
    var blend = this.colorCycle % 1;
    
    ctx.save();
    ctx.scale(pulse, pulse);
    
    // Outer glow with current color
    ctx.shadowColor = currentColor;
    ctx.shadowBlur = 20;
    
    ctx.beginPath();
    ctx.moveTo(this.points[0], this.points[1]);
    for (var i = 2; i < this.points.length; i += 2) {
      ctx.lineTo(this.points[i], this.points[i + 1]);
    }
    ctx.closePath();
    
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = fadeAlpha;
    ctx.stroke();
    
    // Inner pattern - three overlapping triangles
    ctx.globalAlpha = fadeAlpha * 0.4;
    for (var c = 0; c < 3; c++) {
      ctx.fillStyle = colors[c];
      ctx.beginPath();
      var offset = (c / 3) * Math.PI * 2 + this.colorCycle * 0.5;
      for (var i = 0; i < 3; i++) {
        var angle = offset + (i / 3) * Math.PI * 2;
        var r = 6;
        var px = Math.cos(angle) * r;
        var py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
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
