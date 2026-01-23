VAST Asteroids (HTML5 Canvas)
============================

A feature-rich Asteroids-style game built with plain JavaScript + HTML5 Canvas, featuring vector visuals, post-processing effects, and a modern glow/bloom aesthetic.

This codebase started from the classic HTML5-Asteroids approach, but the **official version in this repo is the modular entry** (`index-modular.html` loading `src/`).
For convenience, `index.html` is now the same modular entry point (an alias).

Original inspiration (Doug McInnes, 2010):
http://dougmcinnes.com/2010/05/12/html-5-asteroids/

---

## Features

### Gameplay
- **Classic Asteroids mechanics**: Rotate, thrust, and shoot to destroy asteroid clusters
- **Character-based asteroids**: Asteroids are clusters of floating ASCII characters with 3D orbital motion
- **Multi-stage destruction**: Asteroids split into smaller fragments with visual outlines
  - First fragments: Irregular polygon outlines
  - Final fragments: Square/cube outlines
- **Upgrade system**: Ship visually upgrades at score milestones (fractal ship clones)
- **Alien UFO**: Enemy that spawns periodically and shoots at the player
- **Level progression**: Animated level transitions with increasing difficulty

### Visual Effects
- **Bloom/Glow**: Real-time additive bloom via offscreen canvas blur compositing
- **Retro TV Mode**: Toggle-able CRT monitor effect with:
  - Scanlines
  - Static/noise grain
  - RGB chromatic aberration (color drift)
  - Analog tracking bars
  - Subtle flicker
- **Fragment outlines**: Destroyed asteroids show styled polygon/cube wireframes
- **Glowing projectiles**: Multi-layer glow trails for player and alien bullets
- **3D asteroid animation**: Characters orbit and rotate with depth-based scaling/alpha

### Intro & UI
- **Animated intro**: Logo zoom with ship reveal animation
- **Background asteroid pass**: Large close-up asteroid drifts behind logo occasionally
- **HUD overlay**: Score and lives display with Orbitron font
- **Scoreboard**: Animated score counter
- **Game Over screen**: Styled end-game UI

---

## Run

Recommended (local server):

```bash
cd vasteroid_demo
python3 -m http.server 8000
```

Open:
- http://localhost:8000/index.html
- http://localhost:8000/index-modular.html

---

## Controls

| Key | Action |
|-----|--------|
| ← → | Rotate ship |
| ↑ | Thrust |
| SPACE | Fire |
| P | Pause |
| M | Mute audio |
| F | Show FPS |
| G | Debug grid (collision cells) |

### UI Controls
- **Character density slider**: Adjust asteroid character count (40-400)
- **Retro TV button**: Toggle CRT post-processing effect
- **Test Next Level**: Debug button to trigger level transition

---

## Engine Architecture

### Core Loop
- Single `requestAnimationFrame` loop in `src/main.js`
- Delta-time based updates for consistent speed
- Frame timing with FPS calculation

### State Machine
- `GameFSM` manages states: `boot`, `waiting`, `start`, `spawn_ship`, `run`, `player_died`, `end_game`, `new_level`
- Clean state transitions with enter/execute handlers

### Entity System
- `Sprite` base class with:
  - `preMove`/`postMove` hooks
  - Velocity/acceleration physics
  - Screen wrapping
  - Collision detection via transformed points
  - Per-instance matrix transforms (lazy initialization)

### Entities
| Entity | Description |
|--------|-------------|
| `Ship` | Player-controlled ship with fractal upgrade visuals |
| `Bullet` | Player projectile with cyan glow trail |
| `Asteroid` | Character cluster with 3D orbital animation |
| `BigAlien` | Enemy UFO with AI movement and shooting |
| `AlienBullet` | Enemy projectile with orange/red glow |
| `Explosion` | Particle effect on destruction |

---

## Graphics & Rendering

### Canvas 2D
- Native HTML5 Canvas 2D context (no WebGL)
- Wireframe/vector aesthetic via canvas transforms
- HUD text via `Text.renderText` using vector_battle typeface

### Post-Processing Pipeline
1. **Clear & render**: All sprites drawn to main canvas
2. **Bloom pass**: Copy to offscreen canvas → blur filter → additive composite
3. **Retro FX pass** (optional): Scanlines → RGB drift → tracking bars → noise overlay

### Asteroid Rendering
- Pre-cached character sprites with glow layers
- Spherical distribution using golden angle
- Per-character 3D orbital motion
- Depth sorting (back-to-front) each frame
- Fragment generation tracking for outline styles

### Glow Renderer Utility
- Shared `GlowRenderer` for bullet trails
- Multi-layer stroke rendering (5 layers: outer → core)
- Pre-defined color sets for player/alien

---

## Audio System

- `SFX` module with pooled audio instances
- Sounds: laser, explosion
- Cooldown system to prevent audio stacking
- Mute toggle support

---

## Optimizations

| Technique | Benefit |
|-----------|---------|
| **Spatial partitioning grid** | O(1) collision lookups vs O(n²) |
| **Object pooling** | Bullets pre-created, zero allocation during gameplay |
| **Character sprite cache** | Pre-rendered glowing chars via `drawImage` |
| **Precomputed trig** | Octagon hitbox uses cached sin/cos arrays |
| **Lazy matrix instantiation** | Per-sprite matrices avoid prototype pollution |
| **Transform caching** | `transPoints` cached until position changes |

### Performance Tuning
- **Character density slider**: Main CPU knob (40-400 chars/asteroid)
- Higher density = more `setTransform` calls + larger depth-sort arrays

---

## Configuration

All game balance values are centralized in `GAME_CONFIG` (`src/config/constants.js`):

```javascript
GAME_CONFIG = {
  ship: { rotationSpeed, thrustAcceleration, bulletCooldown, hitCooldown },
  bullet: { lifetime, speed, length },
  alien: { speed, bulletSpeed, bulletCooldown, scoreValue },
  asteroid: { minSplitChars, tripleSplitThreshold, fragmentRadiusMultiplier, scorePerChar },
  gameplay: { startingLives, extraLifeScore, initialAsteroidCount, maxAsteroidCount }
}
```

### Theme Colors
```javascript
THEME = {
  bg: '#0E142C',      // Dark blue background
  text: '#E5E7EB',    // Light gray text
  primary: '#1FD9FE', // Cyan (ship, UI)
  secondary: '#06D69F', // Green (player bullets)
  danger: '#D91247',  // Red (alien, damage)
  warning: '#FFBC42', // Orange (explosions)
  muted: '#9CA3AF'    // Gray (asteroids)
}
```

---

## Project Structure

```
vasteroid_demo/
├── index.html              # Main entry point
├── index-modular.html      # Modular entry (identical)
├── src/
│   ├── main.js             # Bootstrap, main loop, bloom
│   ├── config/
│   │   └── constants.js    # GAME_CONFIG, THEME, key codes
│   ├── entities/
│   │   ├── sprite.js       # Base entity class
│   │   ├── ship.js         # Player ship + fractal upgrades
│   │   ├── bullet.js       # Player & alien bullets
│   │   ├── asteroid.js     # Character cluster + outlines
│   │   ├── alien.js        # BigAlien UFO enemy
│   │   └── explosion.js    # Particle explosion
│   ├── game/
│   │   ├── game.js         # Game state object
│   │   ├── game-fsm.js     # Finite state machine
│   │   └── intro.js        # Intro animation + bg asteroid
│   ├── ui/
│   │   ├── hud.js          # Score/lives HUD
│   │   ├── scoreboard.js   # Animated score display
│   │   ├── game-over.js    # Game over screen
│   │   ├── animations.js   # UI animation utilities
│   │   └── retro-fx.js     # CRT post-processing effect
│   ├── audio/
│   │   └── sfx.js          # Sound effects + pooling
│   ├── input/
│   │   └── input-handler.js # Keyboard input
│   ├── utils/
│   │   ├── matrix.js       # 2D transform matrix
│   │   ├── grid-node.js    # Spatial partitioning
│   │   ├── text-renderer.js # Vector text rendering
│   │   └── glow-renderer.js # Shared glow trail utility
│   └── styles/
│       └── ui.css          # UI component styles
├── assets/
│   ├── images/             # Logo, sprites
│   └── audio/              # Sound files
└── vendor/
    ├── jquery-1.4.1.min.js
    └── vector_battle_regular.typeface.js
```

---

## Credits

- Original HTML5-Asteroids concept: Doug McInnes (2010)
- Vector typeface: `vector_battle_regular.typeface.js`
- Animation library: anime.js (CDN)

---

## License

MIT
