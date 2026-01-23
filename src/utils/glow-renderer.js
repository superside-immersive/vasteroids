/**
 * Glow Trail Renderer Utility
 * Shared rendering for player and alien bullets
 */

var GlowRenderer = {
  /**
   * Draw a multi-layer glowing projectile trail
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Head X position
   * @param {number} y - Head Y position
   * @param {number} dirX - Normalized direction X
   * @param {number} dirY - Normalized direction Y
   * @param {number} length - Trail length in pixels
   * @param {Object} colors - Color configuration
   */
  drawTrail: function(ctx, x, y, dirX, dirY, length, colors) {
    var tailX = x - dirX * length;
    var tailY = y - dirY * length;

    ctx.save();
    ctx.lineCap = 'round';

    // Layer 1: Outer glow (large, faint)
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(x + dirX * 2, y + dirY * 2);
    ctx.strokeStyle = colors.outer;
    ctx.lineWidth = colors.outerWidth || 12;
    ctx.stroke();

    // Layer 2: Medium glow
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(x + dirX * 2, y + dirY * 2);
    ctx.strokeStyle = colors.medium;
    ctx.lineWidth = colors.mediumWidth || 8;
    ctx.stroke();

    // Layer 3: Inner glow
    ctx.beginPath();
    ctx.moveTo(tailX + dirX * 2, tailY + dirY * 2);
    ctx.lineTo(x + dirX * 2, y + dirY * 2);
    ctx.strokeStyle = colors.inner;
    ctx.lineWidth = colors.innerWidth || 5;
    ctx.stroke();

    // Layer 4: Core bright line
    ctx.beginPath();
    ctx.moveTo(tailX + dirX * 3, tailY + dirY * 3);
    ctx.lineTo(x + dirX * 2, y + dirY * 2);
    ctx.strokeStyle = colors.core;
    ctx.lineWidth = colors.coreWidth || 3;
    ctx.stroke();

    // Layer 5: Hot center (white core)
    ctx.beginPath();
    ctx.moveTo(tailX + dirX * 4, tailY + dirY * 4);
    ctx.lineTo(x + dirX * 1, y + dirY * 1);
    ctx.strokeStyle = colors.center || '#FFFFFF';
    ctx.lineWidth = colors.centerWidth || 1.5;
    ctx.stroke();

    ctx.restore();
  },

  /**
   * Draw tip glow point (for player bullets)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Tip X position
   * @param {number} y - Tip Y position
   * @param {string} glowColor - Outer glow color
   */
  drawTipGlow: function(ctx, x, y, glowColor) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = glowColor || 'rgba(31, 217, 254, 0.5)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  },

  // Pre-defined color sets
  PLAYER_COLORS: {
    outer: 'rgba(31, 217, 254, 0.15)',
    outerWidth: 12,
    medium: 'rgba(31, 217, 254, 0.3)',
    mediumWidth: 8,
    inner: 'rgba(31, 217, 254, 0.6)',
    innerWidth: 5,
    core: 'rgba(200, 240, 255, 0.9)',
    coreWidth: 3,
    center: '#FFFFFF',
    centerWidth: 1.5
  },

  ALIEN_COLORS: {
    outer: 'rgba(255, 100, 50, 0.2)',
    outerWidth: 10,
    medium: 'rgba(255, 80, 30, 0.4)',
    mediumWidth: 6,
    inner: 'rgba(255, 150, 50, 0.7)',
    innerWidth: 3,
    core: 'rgba(255, 220, 150, 0.95)',
    coreWidth: 1.5,
    center: '#FFFFFF',
    centerWidth: 1
  }
};
