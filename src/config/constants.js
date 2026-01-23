/**
 * Game Constants and Configuration
 * Contains all global constants, key codes, and theme settings
 */

// Key code mappings
var KEY_CODES = {
  16: 'shift',
  32: 'space',
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  70: 'f',
  71: 'g',
  72: 'h',
  77: 'm',
  80: 'p'
};

// Key status tracker
var KEY_STATUS = { keyDown: false };
for (var code in KEY_CODES) {
  KEY_STATUS[KEY_CODES[code]] = false;
}

// Grid size for spatial partitioning
var GRID_SIZE = 60;

// Visual theme (VAST-inspired)
var THEME = {
  bg: '#0E142C',
  text: '#E5E7EB',
  primary: '#1FD9FE',
  secondary: '#06D69F',
  danger: '#D91247',
  warning: '#FFBC42',
  muted: '#9CA3AF'
};

// Character pool for asteroid letters/numbers
var ASTEROID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=?!';

// Default asteroid character count (modifiable via UI slider)
var ASTEROID_CHAR_COUNT = 200;

// Global flag for showing hitboxes (debug)
var SHOW_HITBOXES = false;

// ========================================
// Game Balance Configuration
// ========================================

var GAME_CONFIG = {
  // Ship settings
  ship: {
    rotationSpeed: 5,
    thrustAcceleration: 0.35,
    drag: 0.995,  // Slight friction so ship slows down gradually (1.0 = no drag)
    bulletCooldown: 10,
    hitCooldown: 15,
    doubleFireUpgradeLevel: 2,
    hyperspaceInvulnerability: 120, // 2 seconds at 60fps
    maxHyperspaceJumps: 3
  },

  // Bullet settings
  bullet: {
    lifetime: 50,
    speed: 10,
    length: 8
  },

  // Alien settings
  alien: {
    speed: 1.5,
    bulletSpeed: 6,
    bulletCooldown: 22,
    bulletCount: 3,
    spawnDelayMs: 30000,
    scoreValue: 200
  },

  // Asteroid settings
  asteroid: {
    minSplitChars: 12,
    tripleSplitThreshold: 36,
    fragmentRadiusMultiplier: 0.65,
    scorePerChar: 5,
    fragmentDropChance: 0.30  // 30% per flowchart spec
  },

  // DASE Mode settings\n  dase: {\n    meterMax: 10,           // Fragments needed to activate\n    baseDuration: 1200,     // ~20 seconds at 60fps\n    maxExtension: 600,      // Max +10 seconds extension\n    turretOrbitRadius: 70,\n    turretFireRate: 18      // Slower fire rate for balance\n  },

  // Gameplay settings
  gameplay: {
    startingLives: 3,
    extraLifeScore: 10000,
    initialAsteroidCount: 5,
    maxAsteroidCount: 12
  }
};

/**
 * Get stroke color based on sprite name
 * @param {string} name - Sprite name
 * @returns {string} - Hex color
 */
function strokeForSpriteName(name) {
  switch (name) {
    case 'ship':
      return THEME.primary;
    case 'bullet':
      return THEME.secondary;
    case 'alienbullet':
    case 'bigalien':
      return THEME.danger;
    case 'asteroid':
      return THEME.muted;
    case 'explosion':
      return THEME.warning;
    default:
      return THEME.primary;
  }
}
