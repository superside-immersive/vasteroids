/**
 * Asteroid Entity
 * Character cluster that floats in space
 * Performance optimized using cached sprite rendering
 */

// Precalculated trig values for collision octagon
var OCTAGON_COS = [];
var OCTAGON_SIN = [];
for (var i = 0; i < 8; i++) {
  var angle = (i / 8) * Math.PI * 2;
  OCTAGON_COS[i] = Math.cos(angle);
  OCTAGON_SIN[i] = Math.sin(angle);
}

// Character sprite cache - pre-render all chars at high resolution with glow
var CHAR_CACHE = {};
var CHAR_CACHE_SIZE = 8; // display size in pixels
var CHAR_CACHE_SCALE = 4; // render at 4x for crisp text

// Colored character cache for similarity mode
var COLORED_CHAR_CACHE = {};

function getCharSprite(char, color) {
  // If color specified, use colored cache
  if (color) {
    var key = char + '_' + color;
    if (COLORED_CHAR_CACHE[key]) return COLORED_CHAR_CACHE[key];
    
    var renderSize = CHAR_CACHE_SIZE * CHAR_CACHE_SCALE;
    var glowPadding = renderSize * 0.8;
    var canvasSize = renderSize * 2 + glowPadding * 2;
    var canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    var ctx = canvas.getContext('2d');
    
    var centerX = canvasSize / 2;
    var centerY = canvasSize / 2;
    
    ctx.font = 'bold ' + renderSize + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Layer 1: Outer colored glow
    ctx.shadowColor = color;
    ctx.shadowBlur = renderSize * 1.2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
    ctx.fillText(char, centerX, centerY);
    
    // Layer 2: Medium colored glow
    ctx.shadowColor = color;
    ctx.shadowBlur = renderSize * 0.6;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillText(char, centerX, centerY);
    
    // Layer 3: Inner tight glow (brighter)
    ctx.shadowColor = color;
    ctx.shadowBlur = renderSize * 0.25;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.fillText(char, centerX, centerY);
    
    // Layer 4: Core text - colored
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = renderSize * 0.08;
    ctx.fillStyle = color;
    ctx.fillText(char, centerX, centerY);
    
    // Layer 5: Highlight pass
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillText(char, centerX, centerY);
    
    COLORED_CHAR_CACHE[key] = canvas;
    return canvas;
  }
  
  // Original non-colored version
  if (CHAR_CACHE[char]) return CHAR_CACHE[char];
  
  var renderSize = CHAR_CACHE_SIZE * CHAR_CACHE_SCALE;
  var glowPadding = renderSize * 0.8; // extra space for glow
  var canvasSize = renderSize * 2 + glowPadding * 2;
  var canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  var ctx = canvas.getContext('2d');
  
  var centerX = canvasSize / 2;
  var centerY = canvasSize / 2;
  
  ctx.font = 'bold ' + renderSize + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Layer 1: Outer soft white glow (very subtle, wide)
  ctx.shadowColor = 'rgba(255, 255, 255, 0.12)';
  ctx.shadowBlur = renderSize * 1.2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.fillText(char, centerX, centerY);
  
  // Layer 2: Medium white glow
  ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
  ctx.shadowBlur = renderSize * 0.6;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fillText(char, centerX, centerY);
  
  // Layer 3: Inner tight glow (brighter)
  ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
  ctx.shadowBlur = renderSize * 0.25;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillText(char, centerX, centerY);
  
  // Layer 4: Core text - crisp white
  ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
  ctx.shadowBlur = renderSize * 0.08;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(char, centerX, centerY);
  
  // Layer 5: Highlight pass - very subtle bright core
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText(char, centerX, centerY);
  
  CHAR_CACHE[char] = canvas;
  return canvas;
}

// Pre-cache all asteroid chars on load
(function() {
  for (var i = 0; i < ASTEROID_CHARS.length; i++) {
    getCharSprite(ASTEROID_CHARS[i]);
  }
})();

/**
 * Generate random characters for an asteroid cluster
 * Uses spherical distribution for 3D orbital effect
 * @param {number} count - Number of characters
 * @returns {Array} - Array of character objects
 */
function generateAsteroidChars(count) {
  var chars = [];
  var goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (var i = 0; i < count; i++) {
    // Spherical distribution for 3D effect
    var theta = i * goldenAngle; // horizontal angle
    var phi = Math.acos(1 - 2 * (i + 0.5) / count); // vertical angle for even sphere distribution
    
    // 3D position on unit sphere
    var x3d = Math.sin(phi) * Math.cos(theta);
    var y3d = Math.sin(phi) * Math.sin(theta);
    var z3d = Math.cos(phi);
    
    // Orbital parameters - each char orbits around its own axis
    var orbitTilt = Math.random() * Math.PI; // tilt of orbit plane
    var orbitSpeed = 0.15 + Math.random() * 0.25;
    var orbitPhase = Math.random() * Math.PI * 2;
    var orbitRadius = 0.03 + Math.random() * 0.04; // small orbital wobble

    chars.push({
      char: ASTEROID_CHARS[Math.floor(Math.random() * ASTEROID_CHARS.length)],
      // Base 3D position
      baseX: x3d * 0.7,
      baseY: y3d * 0.7,
      baseZ: z3d * 0.5,
      // Orbital motion params
      orbitTilt: orbitTilt,
      orbitSpeed: orbitSpeed,
      orbitPhase: orbitPhase,
      orbitRadius: orbitRadius,
      // Spin
      rot: Math.random() * Math.PI * 2,
      rotVel: (Math.random() - 0.5) * 0.03
    });
  }
  return chars;
}

var Asteroid = function () {
  this.init("asteroid", [-10, -10, 10, -10, 10, 10, -10, 10]);

  this.visible = true;
  this.scale = 1;
  this.postMove = this.wrapPostMove;

  // Character cluster properties - configurable via ASTEROID_CHAR_COUNT
  this.charCount = ASTEROID_CHAR_COUNT || 200;
  this.chars = generateAsteroidChars(this.charCount);
  this.clusterRadius = 60;
  this.time = 0;

  // Spawn-in animation state (scale + character reveal)
  this._spawn = null;
  this._spawnCharLimit = null;

  this.beginSpawnIn = function(opts) {
    opts = opts || {};
    var now = Date.now();
    var endChars = (this.chars && this.chars.length) ? this.chars.length : (this.charCount || 1);
    var startChars = (opts.startChars != null) ? opts.startChars : Math.max(10, Math.min(50, Math.floor(endChars * 0.2)));
    var startScale = (opts.startScale != null) ? opts.startScale : 0.22;
    var durationMs = (opts.durationMs != null) ? opts.durationMs : 240;

    this._spawn = {
      start: now,
      duration: durationMs,
      startScale: startScale,
      endScale: 1,
      startChars: startChars,
      endChars: endChars
    };
    this.scale = startScale;
    this._spawnCharLimit = startChars;
  };

  this._updateSpawnIn = function() {
    if (!this._spawn) return;
    var now = Date.now();
    var t = (now - this._spawn.start) / Math.max(1, this._spawn.duration);
    if (t >= 1) {
      this.scale = this._spawn.endScale;
      this._spawnCharLimit = null;
      this._spawn = null;
      return;
    }

    // Ease-out quad
    var e = 1 - (1 - t) * (1 - t);
    this.scale = this._spawn.startScale + (this._spawn.endScale - this._spawn.startScale) * e;

    var charsNow = Math.floor(this._spawn.startChars + (this._spawn.endChars - this._spawn.startChars) * e);
    charsNow = Math.max(1, Math.min(this._spawn.endChars, charsNow));
    this._spawnCharLimit = charsNow;
  };

  // Hook spawn updates into the normal sprite lifecycle
  this.preMove = function(delta) {
    this._updateSpawnIn();
  };
  
  // Billboard alignment: fragments gradually align rotation to face user
  this.isFragment = false;
  this.billboardLerp = 0.03; // Speed of rotation alignment (higher = faster)

  // Fragment generation: 0 = original, 1 = first split, 2 = second split, etc.
  // Used for outline styling: generations 1+ get irregular polygon, final (non-splittable) gets cube
  this.fragmentGeneration = 0;

  // Pre-generate irregular outline vertices for this asteroid
  this._outlinePoints = null;

  this.collidesWith = ["ship", "bullet", "bigalien", "alienbullet", "turretbullet"];

  /**
   * Render character cluster with floating animation
   * Ultra-optimized: uses cached sprites and drawImage
   */
  this.draw = function () {
    if (!this.visible) return;

    var ctx = this.context;
    ctx.save();

    this.time += 0.016;

    // Create collision path (required for isPointInPath)
    this._createCollisionPath(ctx);

    if (SHOW_HITBOXES) {
      this._drawHitbox(ctx);
    }

    // Ultra-optimized character rendering using cached sprites
    this._drawCharacters(ctx);

    // Draw outline for fragments
    if (this.isFragment && this.fragmentGeneration > 0) {
      this._drawFragmentOutline(ctx);
    }

    ctx.restore();
  };

  /**
   * Create collision path using precalculated values
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  this._createCollisionPath = function(ctx) {
    var r = this.clusterRadius * this.scale * 0.75;
    ctx.beginPath();
    ctx.moveTo(OCTAGON_COS[0] * r, OCTAGON_SIN[0] * r);
    for (var i = 1; i < 8; i++) {
      ctx.lineTo(OCTAGON_COS[i] * r, OCTAGON_SIN[i] * r);
    }
    ctx.closePath();
  };

  /**
   * Draw debug hitbox visualization
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  this._drawHitbox = function(ctx) {
    ctx.strokeStyle = '#FF00FF';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.fillStyle = '#FF00FF';
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  /**
   * Generate irregular polygon outline points
   * @param {number} numPoints - Number of vertices
   * @param {number} radius - Base radius
   * @returns {Array} - Array of {x, y} points
   */
  this._generateIrregularOutline = function(numPoints, radius) {
    var points = [];
    var angleStep = (Math.PI * 2) / numPoints;
    for (var i = 0; i < numPoints; i++) {
      var angle = i * angleStep + (Math.random() - 0.5) * angleStep * 0.6;
      var r = radius * (0.75 + Math.random() * 0.5);
      points.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r
      });
    }
    return points;
  };

  /**
   * Draw outline around fragment based on generation
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  this._drawFragmentOutline = function(ctx) {
    var r = this.clusterRadius * this.scale * 0.85;
    var isFinalFragment = this.charCount < GAME_CONFIG.asteroid.minSplitChars;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Slight rotation wobble for visual interest
    var wobble = Math.sin(this.time * 1.5) * 0.03;
    ctx.rotate(wobble);

    var outlineColor = '#FFFFFF';
    if (this.similarityGroup && window.SimilarityMode && SimilarityMode.isActive()) {
      var colors = SimilarityMode.getColors();
      outlineColor = colors[this.similarityGroup] || outlineColor;
    }

    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.45 + Math.sin(this.time * 2) * 0.1;

    ctx.beginPath();

    if (isFinalFragment) {
      // Final fragment: draw a cube/square outline
      var s = r * 0.9;
      ctx.rect(-s, -s, s * 2, s * 2);
    } else {
      // Non-final fragment: irregular polygon outline
      if (!this._outlinePoints) {
        var numVerts = 6 + Math.floor(Math.random() * 4); // 6-9 vertices
        this._outlinePoints = this._generateIrregularOutline(numVerts, r);
      }

      var pts = this._outlinePoints;
      var scale = r / (this.clusterRadius * 0.85); // Adjust for current scale
      ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
      for (var i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * scale, pts[i].y * scale);
      }
      ctx.closePath();
    }

    ctx.stroke();

    // Add subtle inner glow
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = outlineColor;
    ctx.fill();

    ctx.restore();
  };

  /**
   * Draw all characters using cached sprite images with 3D orbital motion
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  this._drawCharacters = function(ctx) {
    var alphaScale = (this.alphaScale == null) ? 1 : this.alphaScale;
    var radius = this.clusterRadius * this.scale;
    var t = this.time;
    var chars = this.chars;
    var len = chars.length;
    if (this._spawnCharLimit != null) {
      len = Math.min(len, this._spawnCharLimit);
    }
    var x0 = this.x;
    var y0 = this.y;
    
    // Apply compression scale during implosion
    var compressionScale = this.compressionScale || 1;
    radius *= compressionScale;
    
    // Get similarity color if active
    var similarityColor = null;
    if (this.similarityGroup && window.SimilarityMode && SimilarityMode.isActive()) {
      var colors = SimilarityMode.getColors();
      similarityColor = colors[this.similarityGroup];
    }
    
    // Scale factor: render high-res cache scaled down for crisp display
    // Account for glow padding in sprite size
    var renderSize = CHAR_CACHE_SIZE * CHAR_CACHE_SCALE;
    var glowPadding = renderSize * 0.8;
    var spriteSize = renderSize * 2 + glowPadding * 2;
    var halfSprite = spriteSize / 2;
    var baseScale = 1 / CHAR_CACHE_SCALE;
    
    // Apply compression to character scale
    baseScale *= compressionScale;

    // Sort by Z depth for proper layering (back to front)
    var sortedChars = [];
    for (var i = 0; i < len; i++) {
      var c = chars[i];
      
      // 3D orbital motion
      var orbitAngle = t * c.orbitSpeed + c.orbitPhase;
      var orbitX = Math.cos(orbitAngle) * c.orbitRadius;
      var orbitY = Math.sin(orbitAngle) * c.orbitRadius * Math.cos(c.orbitTilt);
      var orbitZ = Math.sin(orbitAngle) * c.orbitRadius * Math.sin(c.orbitTilt);
      
      // Final 3D position
      var px = c.baseX + orbitX;
      var py = c.baseY + orbitY;
      var pz = c.baseZ + orbitZ;
      
      // Rotate entire cluster slowly in 3D
      var clusterRot = t * 0.08;
      var cosR = Math.cos(clusterRot);
      var sinR = Math.sin(clusterRot);
      var rotX = px * cosR - pz * sinR;
      var rotZ = px * sinR + pz * cosR;
      
      sortedChars.push({
        c: c,
        x: rotX * radius,
        y: py * radius,
        z: rotZ
      });
    }
    
    // Sort back to front
    sortedChars.sort(function(a, b) { return a.z - b.z; });

    // Vibration offset for implosion
    var vibrationIntensity = this.vibrationIntensity || 0;

    // Render sorted
    for (var i = 0; i < sortedChars.length; i++) {
      var sc = sortedChars[i];
      var c = sc.c;
      
      // Update spin rotation
      if (this.isFragment) {
        // Billboard alignment: gradually align rotation to 0 (facing user)
        c.rot = c.rot * (1 - this.billboardLerp);
        // Also slow down rotVel for smoother settling
        c.rotVel *= 0.98;
      } else {
        c.rot += c.rotVel;
      }
      
      // Depth effects: scale and alpha based on Z
      var depthFactor = 0.6 + (sc.z + 0.5) * 0.8; // 0.6 to 1.4
      var alpha = (0.5 + (sc.z + 0.5) * 0.5) * alphaScale; // 0.5..1.0 scaled
      
      var drawScale = baseScale * depthFactor;
      
      var minAlpha = 0.3 * alphaScale;
      ctx.globalAlpha = Math.min(1, Math.max(minAlpha, alpha));
      
      // Calculate position with vibration
      var drawX = x0 + sc.x;
      var drawY = y0 + sc.y;
      
      if (vibrationIntensity > 0) {
        drawX += (Math.random() - 0.5) * vibrationIntensity * 3;
        drawY += (Math.random() - 0.5) * vibrationIntensity * 3;
      }
      
      // Draw cached sprite with rotation
      var cos = Math.cos(c.rot) * drawScale;
      var sin = Math.sin(c.rot) * drawScale;
      ctx.setTransform(cos, sin, -sin, cos, drawX, drawY);
      ctx.drawImage(getCharSprite(c.char, similarityColor), -halfSprite, -halfSprite);
    }
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  };

  /**
   * Get collision points as octagon hitbox
   * Uses precalculated trig values
   * @returns {Array} - Transformed collision points
   */
  this.transformedPoints = function () {
    if (this.transPoints) return this.transPoints;

    var r = this.clusterRadius * this.scale * 0.75;
    var trans = new Array(16);
    var x = this.x, y = this.y;
    
    for (var i = 0; i < 8; i++) {
      trans[i * 2] = x + OCTAGON_COS[i] * r;
      trans[i * 2 + 1] = y + OCTAGON_SIN[i] * r;
    }

    this.transPoints = trans;
    return trans;
  };

  /**
   * Handle collision - split into smaller clusters
   * @param {Sprite} other - Colliding sprite
   */
  this.collision = function (other) {
    // If this asteroid is being imploded, ignore collision
    if (this.implosionState) return;
    
    SFX.explosion();
    
    // Check if Similarity Mode should trigger chain destruction
    if (window.SimilarityMode && SimilarityMode.isActive() && this.similarityGroup && !SimilarityMode.isChainTriggered()) {
      // Trigger chain destruction - this asteroid and all same-colored ones will implode
      SimilarityMode.triggerChainDestruction(this, this.similarityGroup);
      
      // Award score for the triggering asteroid (full points)
      if (other.name == "bullet" || other.name == "turretbullet") {
        var asteroidScore = Math.floor(GAME_CONFIG.asteroid.scorePerChar * this.charCount);
        Game.score += asteroidScore;
        if (Game.stats) {
          Game.stats.asteroidsDestroyed++;
          Game.stats.asteroidsScore += asteroidScore;
        }
      }
      
      // Don't split or die normally - the implosion system handles this
      Game.explosionAt(other.x, other.y);
      return;
    }
    
    // Apply Similarity multiplier if active (for non-chain kills)
    var scoreMultiplier = (window.SimilarityMode && SimilarityMode.isActive()) 
      ? SimilarityMode.getMultiplier() 
      : 1;
    
    if (other.name == "bullet" || other.name == "turretbullet") {
      var asteroidScore = Math.floor(GAME_CONFIG.asteroid.scorePerChar * this.charCount * scoreMultiplier);
      Game.score += asteroidScore;
      // Track stats
      if (Game.stats) {
        Game.stats.asteroidsDestroyed++;
        Game.stats.asteroidsScore += asteroidScore;
      }
    }

    // Split into smaller clusters (lower threshold so it always subdivides)
    if (this.charCount >= GAME_CONFIG.asteroid.minSplitChars) {
      var numGroups = this.charCount >= GAME_CONFIG.asteroid.tripleSplitThreshold ? 3 : 2;
      var baseSize = Math.floor(this.charCount / numGroups);
      var remainder = this.charCount % numGroups;

      for (var g = 0; g < numGroups; g++) {
        var groupSize = baseSize + (g < remainder ? 1 : 0);
        this._createFragment(g, numGroups, groupSize);
      }
    } else {
      // Final destruction - 30% chance to drop data fragment
      if (Math.random() < 0.30 && typeof spawnDataFragment === 'function') {
        spawnDataFragment(this.x, this.y);
      }
      
      // Very rare Similarity pickup drop (3% chance, max 2 per game)
      if (window.SimilarityMode && SimilarityMode.getDropsUsed() < 2 && Math.random() < 0.03) {
        if (typeof spawnSimilarityPickup === 'function') {
          spawnSimilarityPickup(this.x, this.y);
        }
      }
    }

    Game.explosionAt(other.x, other.y);
    this.die();
  };

  /**
   * Create a fragment asteroid
   * @param {number} groupIndex - Which fragment this is
   * @param {number} totalGroups - Total fragments being created
   * @param {number} charsPerGroup - Characters per fragment
   */
  this._createFragment = function(groupIndex, totalGroups, charsPerGroup) {
    var newRoid = new Asteroid();
    newRoid.x = this.x + (Math.random() - 0.5) * 40;
    newRoid.y = this.y + (Math.random() - 0.5) * 40;
    
    // Calculate velocity AWAY from player ship
    var baseSpeed = 2 + Math.random() * 2; // Speed between 2-4
    var angle;
    
    if (Game.ship && Game.ship.visible) {
      // Direction from ship to asteroid
      var dx = this.x - Game.ship.x;
      var dy = this.y - Game.ship.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0) {
        // Base angle pointing AWAY from ship
        var awayAngle = Math.atan2(dy, dx);
        
        // Spread fragments in a cone away from player (±60 degrees)
        var spreadAngle = (Math.PI / 3); // 60 degrees
        var fragmentSpread = (groupIndex / (totalGroups - 1 || 1)) * 2 - 1; // -1 to 1
        angle = awayAngle + fragmentSpread * spreadAngle;
      } else {
        angle = Math.random() * Math.PI * 2;
      }
    } else {
      // No ship visible, random direction
      angle = Math.random() * Math.PI * 2;
    }
    
    newRoid.vel.x = Math.cos(angle) * baseSpeed;
    newRoid.vel.y = Math.sin(angle) * baseSpeed;
    newRoid.vel.rot = Math.random() * 2 - 1;

    // Mark as fragment for billboard alignment
    newRoid.isFragment = true;
    
    // Increment fragment generation for outline styling
    newRoid.fragmentGeneration = (this.fragmentGeneration || 0) + 1;
    
    newRoid.charCount = charsPerGroup;
    newRoid.chars = [];

    var startIdx = groupIndex * charsPerGroup;
    var goldenAngle = Math.PI * (3 - Math.sqrt(5));
    
    for (var i = 0; i < charsPerGroup && startIdx + i < this.chars.length; i++) {
      var oldChar = this.chars[startIdx + i];
      
      // Grid-like but with 3D orbital motion
      var theta = i * goldenAngle;
      var phi = Math.acos(1 - 2 * (i + 0.5) / charsPerGroup);
      
      var x3d = Math.sin(phi) * Math.cos(theta) * 0.6;
      var y3d = Math.sin(phi) * Math.sin(theta) * 0.6;
      var z3d = Math.cos(phi) * 0.4;
      
      newRoid.chars.push({
        char: oldChar.char,
        baseX: x3d,
        baseY: y3d,
        baseZ: z3d,
        orbitTilt: Math.random() * Math.PI,
        orbitSpeed: 0.2 + Math.random() * 0.3,
        orbitPhase: Math.random() * Math.PI * 2,
        orbitRadius: 0.03 + Math.random() * 0.04,
        rot: oldChar.rot,
        rotVel: oldChar.rotVel + (Math.random() - 0.5) * 0.02
      });
    }

    newRoid.clusterRadius = Math.max(25, this.clusterRadius * GAME_CONFIG.asteroid.fragmentRadiusMultiplier);
    newRoid.scale = this.scale;
    newRoid.time = 0;

    // Push away from explosion
    var angle = (groupIndex / totalGroups) * Math.PI * 2 + Math.random() * 0.5;
    newRoid.vel.x += Math.cos(angle) * 2;
    newRoid.vel.y += Math.sin(angle) * 2;

    newRoid.visible = true;
    Game.sprites.push(newRoid);
  };

  /**
   * Configure asteroid size
   * @param {number} charCount - Number of characters
   * @param {number} clusterRadius - Radius of cluster
   * @returns {Asteroid} - This asteroid for chaining
   */
  this.setSize = function(charCount, clusterRadius) {
    this.charCount = charCount || ASTEROID_CHAR_COUNT || 200;
    this.clusterRadius = clusterRadius || 60;
    this.chars = generateAsteroidChars(this.charCount);
    return this;
  };
};

Asteroid.prototype = new Sprite();
