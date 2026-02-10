/**
 * Intro Animation
 * Logo animation at game start with VAST branding
 */

var IntroManager = {
  // Main VAST logo (logo + "VAST" text) - viewBox: 0 0 242.201 60
  // Aspect ratio: 4.04 (wider than tall)
  vastLogo: null,
  vastLogoLoaded: false,
  vastLogoSize: { w: 242.201, h: 60 },  // Fixed from SVG viewBox - DO NOT CHANGE
  
  // Vasteroids title logo - PNG: 2263 x 452
  // Aspect ratio: 5.01 (very wide, short)
  titleLogo: null,
  titleLogoLoaded: false,
  titleLogoSize: { w: 2263, h: 452 },  // Fixed from PNG dimensions - DO NOT CHANGE
  
  // Legacy logo for fallback
  logo: null,
  logoLoaded: false,
  logoSize: { w: 1438, h: 356 },

  // Background close-up asteroids drifting down behind the logo
  bgBlob: null,
  nextBlobAt: 0,
  lastFrameTs: null,

  state: {
    done: false,
    startTime: null,
    duration: 5000,
    fadeStart: 3600,
    shipAppear: 1400,
    endHold: 0,
    targetScale: null,
    gameTriggered: false,
    timeline: null,
    playRequested: false,
    props: {
      logoScale: 0.6,
      logoAlpha: 1,
      titleAlpha: 1,
      vastTextAlpha: 1,  // For fading "VAST" text separately
      shipAlpha: 0,
      shipScale: 0.6
    }
  },

  reset: function() {
    if (this.state.timeline) {
      try { this.state.timeline.pause(); } catch (e) {}
    }
    this.state.done = false;
    this.state.startTime = null;
    this.state.targetScale = null;
    this.state.gameTriggered = false;
    this.state.timeline = null;
    this.state.playRequested = false;
    this.state.props.logoScale = 0.6;
    this.state.props.logoAlpha = 1;
    this.state.props.titleAlpha = 1;
    this.state.props.vastTextAlpha = 1;
    this.state.props.shipAlpha = 0;
    this.state.props.shipScale = 0.6;

    this.bgBlob = null;
    this.nextBlobAt = Date.now() + 2200;
    this.lastFrameTs = null;
  },

  /**
   * Request playing the intro sequence (zoom-in) and then starting the game.
   */
  requestPlay: function() {
    this.state.playRequested = true;
    this.state.done = false;
    this.state.startTime = null;
    this.state.gameTriggered = false;
    if (this.state.timeline) {
      try { this.state.timeline.pause(); } catch (e) {}
    }
    this.state.timeline = null;
  },

  /**
   * Initialize intro logos
   */
  init: function() {
    var self = this;
    
    // Load VAST logo (ship + "VAST" text)
    this.vastLogo = new Image();
    this.vastLogo.src = 'assets/images/vast-logo-new.svg';
    this.vastLogo.onload = function() {
      self.vastLogoLoaded = true;
      // Note: Using fixed dimensions from SVG viewBox, not naturalWidth/Height
      // SVG naturalWidth/Height can be unreliable across browsers
    };
    
    // Load vasteroids title logo
    this.titleLogo = new Image();
    this.titleLogo.src = 'assets/images/Vasteroids_Logo_ByLetter.png';
    this.titleLogo.onload = function() {
      self.titleLogoLoaded = true;
      // Note: Using fixed dimensions from PNG, not naturalWidth/Height
    };
    
    // Legacy logo fallback
    this.logo = new Image();
    this.logo.src = 'assets/images/logo.svg';

    this.logo.onload = function() {
      self.logoLoaded = true;
      if (self.logo.naturalWidth && self.logo.naturalHeight) {
        self.logoSize = { w: self.logo.naturalWidth, h: self.logo.naturalHeight };
      }
    };

    this.logo.onerror = function() {
      // Backwards-compatible fallbacks (older layouts)
      if (self.logo.src && self.logo.src.indexOf('assets/images/logo.svg') !== -1) {
        self.logo.src = 'LOGO.svg';
        return;
      }
      if (self.logo.src && self.logo.src.indexOf('LOGO.svg') !== -1) {
        self.logo.src = 'logo.svg';
      }
    };
  },

  /**
   * Check if logo is currently visible (for coordination with other animations)
   */
  isLogoVisible: function() {
    if (this.state.done) return false;
    return this.state.props.logoAlpha > 0.05;
  },

  /**
   * Render intro animation
   * @param {CanvasRenderingContext2D} context - Canvas context
   * @param {Ship} ship - Ship instance for overlay
   */
  render: function(context, ship) {
    // Only render intro during waiting state
    if (window.Game && Game.FSM && Game.FSM.state !== 'waiting') {
      return;
    }

    if (this.state.done) return;

    // Time step for drifting background blobs
    var now = Date.now();
    if (this.lastFrameTs === null) this.lastFrameTs = now;
    var dtMs = Math.min(100, now - this.lastFrameTs);
    this.lastFrameTs = now;

    this._updateAndRenderBackgroundBlob(context, dtMs);

    // If user hasn't requested start yet, keep logo visible (no autoplay).
    if (!this.state.playRequested) {
      this._ensureStaticProps();
      this._drawIdleScreen(context);
      return;
    }

    if (!this.state.startTime) {
      this.state.startTime = Date.now();
    }

    this._ensureTimeline(ship);

    var elapsed = Date.now() - this.state.startTime;

    // Trigger game start near the end so the logo doesn't disappear abruptly.
    if (!this.state.gameTriggered && (this.state.props.logoAlpha <= 0.06 || elapsed >= (this.state.duration - 120))) {
      this.state.gameTriggered = true;
      Game.skipWaiting = true;
    }

    if (elapsed >= this.state.duration + this.state.endHold) {
      this.state.done = true;
      return;
    }

    // Draw vasteroids title at top (fading out)
    if (this.state.props.titleAlpha > 0.01) {
      this._drawTitleLogo(context, this.state.props.titleAlpha);
    }

    // Draw VAST logo (ship icon part stays, text fades)
    if (this.state.props.logoAlpha > 0.01) {
      this._drawVastLogo(context, this.state.props.logoScale, this.state.props.logoAlpha, this.state.props.vastTextAlpha);
    }

    // Draw ship overlay when it appears
    if (elapsed > this.state.shipAppear) {
      this._drawShipOverlay(context, ship, elapsed, this.state.props.shipScale, this.state.props.shipAlpha);
    }
  },

  /**
   * Draw idle screen (before START is pressed)
   */
  _drawIdleScreen: function(context) {
    // Draw vasteroids title at top
    if (this.titleLogoLoaded) {
      this._drawTitleLogo(context, 1.0);
    }
    
    // Draw VAST logo (ship + "VAST" text) below center
    if (this.vastLogoLoaded) {
      this._drawVastLogo(context, 1.0, 1.0, 1.0);
    } else if (this.logoLoaded) {
      // Fallback to legacy logo
      this._drawLogo(context, this.state.props.logoScale, this.state.props.logoAlpha);
    }
  },

  _ensureStaticProps: function() {
    // Keep it simple: show logos at default scale until START is pressed.
    this.state.props.logoScale = 1.0;
    this.state.props.logoAlpha = 1;
    this.state.props.titleAlpha = 1;
    this.state.props.vastTextAlpha = 1;
    this.state.props.shipAlpha = 0;
    this.state.props.shipScale = 0.6;
  },

  _ensureTimeline: function(ship) {
    if (this.state.timeline) return;

    // Compute targetScale once per play cycle
    if (this.state.targetScale === null) {
      // Scale ship to appear roughly same size as the VAST logo ship icon
      this.state.targetScale = 1.0;
    }

    var startScale = 1.0;
    this.state.props.logoScale = startScale;
    this.state.props.shipScale = startScale;
    this.state.props.logoAlpha = 1;
    this.state.props.titleAlpha = 1;
    this.state.props.vastTextAlpha = 1;
    this.state.props.shipAlpha = 0;

    var self = this;
    this.state.timeline = anime.timeline({ autoplay: true });

    // Animation sequence:
    // 1. Fade out title logo (vasteroids) and "VAST" text
    // 2. Ship logo icon remains visible, then fades to reveal ship sprite
    this.state.timeline
      .add({
        targets: this.state.props,
        titleAlpha: 0,
        vastTextAlpha: 0,
        duration: 1200,
        easing: 'easeOutQuad'
      })
      .add({
        targets: this.state.props,
        shipAlpha: 1,
        duration: 800,
        easing: 'easeOutQuad'
      }, '-=400')
      .add({
        targets: this.state.props,
        logoAlpha: 0,
        duration: 900,
        delay: 200,
        easing: 'easeInQuad'
      });

    this.state.timeline.finished.then(function() {
      // Ensure game start is triggered even if the timeline finishes
      // before the elapsed-time check in render() fires
      if (!self.state.gameTriggered) {
        self.state.gameTriggered = true;
        Game.skipWaiting = true;
      }
      self.state.done = true;
    });
  },

  /**
   * Draw vasteroids title logo at top of screen
   * PNG: 2263 x 452 (wide, short) - aspect ratio ~5.01
   */
  _drawTitleLogo: function(context, alpha) {
    if (!this.titleLogoLoaded) return;
    
    // Maintain correct aspect ratio (2263 / 452 = 5.01)
    var aspectRatio = this.titleLogoSize.w / this.titleLogoSize.h;  // 5.01
    // Use fixed 540-based reference so logo is same absolute size in both orientations
    var REF = 540;
    var w = REF * 0.75;
    var h = w / aspectRatio;
    
    var x = (Game.canvasWidth - w) / 2;
    // In landscape (short canvas), push title higher so it doesn't overlap VAST logo
    var isLandscape = Game.canvasWidth > Game.canvasHeight;
    var y = isLandscape ? (Game.canvasHeight * 0.18) : (Game.canvasHeight * 0.36);
    
    context.save();
    context.globalAlpha = alpha;
    context.drawImage(this.titleLogo, x, y, w, h);
    context.restore();
  },

  /**
   * Draw VAST logo (ship icon + "VAST" text) below center
   * SVG viewBox: 242.201 x 60 (aspect ~4.04)
   * @param {number} scale - Scale factor
   * @param {number} alpha - Overall alpha
   * @param {number} textAlpha - Alpha for the "VAST" text portion (fades separately)
   */
  _drawVastLogo: function(context, scale, alpha, textAlpha) {
    if (!this.vastLogoLoaded) return;
    
    // VAST logo positioning - centered below middle
    var aspectRatio = this.vastLogoSize.w / this.vastLogoSize.h;  // ~4.04
    // Use fixed 540-based reference so logo is same absolute size in both orientations
    var REF = 540;
    var maxWidth = REF * 0.35;
    var w = maxWidth * scale;
    var h = w / aspectRatio;
    
    var x = (Game.canvasWidth - w) / 2;
    // In landscape, push VAST logo a bit lower to increase gap from title
    var isLandscape = Game.canvasWidth > Game.canvasHeight;
    var y = isLandscape ? (Game.canvasHeight * 0.58) : (Game.canvasHeight * 0.50);
    
    context.save();
    context.globalAlpha = alpha;
    context.drawImage(this.vastLogo, x, y, w, h);
    context.restore();
  },

  /**
   * Draw legacy logo image (fallback)
   */
  _drawLogo: function(context, introScale, introAlpha) {
    if (!this.logoLoaded) return;
    
    var fit = Math.min(
      (Game.canvasWidth * 0.58) / this.logoSize.w,
      (Game.canvasHeight * 0.43) / this.logoSize.h
    );
    var logoTargetW = this.logoSize.w * fit * introScale;
    var logoTargetH = this.logoSize.h * fit * introScale;

    var aXRatio = 0.59;
    var aYRatio = 0.51;
    var offsetX = -logoTargetW / 2 - (aXRatio - 0.5) * logoTargetW;
    var offsetY = -logoTargetH / 2 - (aYRatio - 0.5) * logoTargetH;

    context.save();
    context.globalAlpha = introAlpha;
    context.translate(Game.canvasWidth / 2, Game.canvasHeight / 2);
    context.drawImage(this.logo, offsetX, offsetY, logoTargetW, logoTargetH);
    context.restore();
  },

  /**
   * Draw ship during intro (takes over from VAST logo ship icon)
   */
  _drawShipOverlay: function(context, ship, elapsed, introScale, shipAlpha) {
    if (!ship || shipAlpha < 0.01 || !this.vastLogoLoaded) return;
    
    // Match the ship icon inside the VAST logo (same formula as _drawVastLogo)
    var aspectRatio = this.vastLogoSize.w / this.vastLogoSize.h;  // ~4.04
    // Use fixed 540-based reference so ship position matches logo in both orientations
    var REF = 540;
    var logoWidth = REF * 0.35;
    var logoHeight = logoWidth / aspectRatio;
    var logoX = (Game.canvasWidth - logoWidth) / 2;
    var isLandscape = Game.canvasWidth > Game.canvasHeight;
    var logoY = isLandscape ? (Game.canvasHeight * 0.58) : (Game.canvasHeight * 0.50);
    
    // Icon pivot is at (34.5, 23.5) in the logo's viewBox coordinates
    // Scale these coordinates to match the drawn logo size
    var scaleX = logoWidth / this.vastLogoSize.w;
    var scaleY = logoHeight / this.vastLogoSize.h;
    var shipX = logoX + (34.5 * scaleX);
    var shipY = logoY + (23.5 * scaleY);

    context.save();
    context.globalAlpha = shipAlpha;
    context.strokeStyle = THEME.primary;
    context.lineWidth = 1.0;
    
    var originalX = ship.x;
    var originalY = ship.y;
    var originalScale = ship.scale;
    var originalVisible = ship.visible;
    var originalRot = ship.rot;
    
    var introRot = (typeof window.SHIP_INTRO_ROT_DEG !== 'undefined') ? window.SHIP_INTRO_ROT_DEG : 0;
    ship.x = shipX;
    ship.y = shipY;
    ship.visible = true;
    ship.rot = introRot;  // Match logo icon orientation
    // Scale ship to match logo height
    var shipBaseHeight = SHIP_BODY_HEIGHT; // ship SVG height
    ship.scale = (logoHeight * 0.95) / shipBaseHeight;
    ship.configureTransform();
    ship.draw();
    
    ship.x = originalX;
    ship.y = originalY;
    ship.scale = originalScale;
    ship.visible = originalVisible;
    ship.rot = originalRot;
    
    context.restore();
  },

  /**
   * Spawn a large “close” asteroid to drift behind the logo
   */
  _spawnBackgroundBlob: function() {
    var blob = new Asteroid();

    // Much higher density than before (avoid “floating letters everywhere” look)
    // Keep it bounded to feel like one cohesive asteroid.
    var desiredChars = Math.max(520, Math.floor((ASTEROID_CHAR_COUNT || 200) * 2.6));
    desiredChars = Math.min(900, desiredChars);

    // Radius tuned so density reads as a solid blob, not sparse points.
    var radius = 68 + Math.random() * 18;
    blob.setSize(desiredChars, radius);

    // Scale chosen so blob can feel huge but still show its silhouette/limits on screen.
    var minDim = Math.min(Game.canvasWidth, Game.canvasHeight);
    var targetDiameter = minDim * (0.78 + Math.random() * 0.12); // keeps edges visible
    blob.scale = targetDiameter / (2 * radius);

    // Center X in a safe range so the silhouette stays visible.
    var maxXInset = Math.min(Game.canvasWidth * 0.25, radius * blob.scale * 0.35);
    blob.x = maxXInset + Math.random() * (Game.canvasWidth - 2 * maxXInset);

    // Start fully above screen and drift down past bottom.
    blob.y = -(radius * blob.scale) - 60;

    blob.bridgesH = false;
    blob.bridgesV = false;
    blob.visible = true;

    // Downward drift. Faster than stars a bit so it clearly “passes by”.
    blob.speedY = 55 + Math.random() * 45;
    blob.driftX = (Math.random() - 0.5) * 10;
    blob.time = Math.random() * 12;
    blob.timeScale = 1.35 + Math.random() * 0.9;

    // Slight dim so it stays behind the logo visually.
    blob.alphaScale = 0.65;

    return blob;
  },

  /**
   * Update and render close-up asteroids behind the logo
   */
  _updateAndRenderBackgroundBlob: function(context, dtMs) {
    var now = Date.now();

    // Spawn occasionally (not constant on-screen)
    if (!this.bgBlob && now >= this.nextBlobAt) {
      this.bgBlob = this._spawnBackgroundBlob();
    }

    if (!this.bgBlob) return;

    var b = this.bgBlob;
    var dt = dtMs / 1000;
    b.y += b.speedY * dt;
    b.x += b.driftX * dt;
    b.time += dt * (b.timeScale || 1);

    // Render behind the logo
    context.save();
    b.draw();
    context.restore();

    // Cull once fully off-screen and set a cooldown.
    var bottomEdge = b.y - (b.clusterRadius * b.scale);
    if (bottomEdge > Game.canvasHeight + 80) {
      this.bgBlob = null;
      this.nextBlobAt = now + 4200 + Math.random() * 4200;
    }
  }
};
