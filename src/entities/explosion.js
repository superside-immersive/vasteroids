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

  // Extra particle sparks for juiciness
  this.sparks = [];
  var sparkCount = 6 + Math.floor(Math.random() * 5);
  for (var i = 0; i < sparkCount; i++) {
    var angle = Math.random() * Math.PI * 2;
    var speed = 1.5 + Math.random() * 3;
    this.sparks.push({
      x: 0, y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.5,
      size: 1 + Math.random() * 2
    });
  }
  this.ringRadius = 0;
  this.ringAlpha = 0.6;

  /**
   * Draw explosion lines + spark particles + expanding ring
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

      // Draw expanding ring
      if (this.ringAlpha > 0.01) {
        this.context.beginPath();
        this.context.arc(0, 0, this.ringRadius / Math.max(0.1, this.scale), 0, Math.PI * 2);
        this.context.strokeStyle = 'rgba(255, 255, 255, ' + this.ringAlpha + ')';
        this.context.lineWidth = (2 + this.ringAlpha * 2) / this.scale;
        this.context.stroke();
      }

      // Draw spark particles
      for (var i = 0; i < this.sparks.length; i++) {
        var s = this.sparks[i];
        if (s.life <= 0) continue;
        this.context.beginPath();
        this.context.arc(s.x / Math.max(0.1, this.scale), s.y / Math.max(0.1, this.scale), s.size / this.scale, 0, Math.PI * 2);
        this.context.fillStyle = 'rgba(255, 255, 255, ' + Math.min(1, s.life * 2) + ')';
        this.context.fill();
      }

      this.context.restore();
    }
  };

  /**
   * Expand and fade out + update sparks + ring
   * @param {number} delta - Time delta
   */
  this.preMove = function (delta) {
    if (this.visible) {
      this.scale += delta;

      // Update sparks
      for (var i = 0; i < this.sparks.length; i++) {
        var s = this.sparks[i];
        s.x += s.vx * delta;
        s.y += s.vy * delta;
        s.vx *= 0.96;
        s.vy *= 0.96;
        s.life -= delta * 0.12;
        s.size *= 0.97;
      }

      // Expanding ring
      this.ringRadius += delta * 8;
      this.ringAlpha *= 0.88;
    }
    if (this.scale > 8) {
      this.die();
    }
  };
};

Explosion.prototype = new Sprite();
