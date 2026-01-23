/**
 * Explosion Entity
 * Visual effect when something is destroyed
 */

var Explosion = function () {
  this.init("explosion");

  this.bridgesH = false;
  this.bridgesV = false;

  // Generate random explosion lines
  this.lines = [];
  for (var i = 0; i < 5; i++) {
    var rad = 2 * Math.PI * Math.random();
    var x = Math.cos(rad);
    var y = Math.sin(rad);
    this.lines.push([x, y, x * 2, y * 2]);
  }

  /**
   * Draw explosion lines
   */
  this.draw = function () {
    if (this.visible) {
      this.context.save();
      this.context.lineWidth = 1.0 / this.scale;
      this.context.beginPath();
      
      for (var i = 0; i < 5; i++) {
        var line = this.lines[i];
        this.context.moveTo(line[0], line[1]);
        this.context.lineTo(line[2], line[3]);
      }
      
      this.context.stroke();
      this.context.restore();
    }
  };

  /**
   * Expand and fade out
   * @param {number} delta - Time delta
   */
  this.preMove = function (delta) {
    if (this.visible) {
      this.scale += delta;
    }
    if (this.scale > 8) {
      this.die();
    }
  };
};

Explosion.prototype = new Sprite();
