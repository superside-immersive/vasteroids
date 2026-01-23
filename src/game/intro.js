/**
 * Intro Animation
 * Logo animation at game start
 */

var IntroManager = {
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
   * Initialize intro logo
   */
  init: function() {
    var self = this;
    this.logo = new Image();
    // Official asset location
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

    if (this.state.done || !this.logoLoaded) return;

    // Time step for drifting background blobs
    var now = Date.now();
    if (this.lastFrameTs === null) this.lastFrameTs = now;
    var dtMs = Math.min(100, now - this.lastFrameTs);
    this.lastFrameTs = now;

    this._updateAndRenderBackgroundBlob(context, dtMs);

    // If user hasn't requested start yet, keep logo visible (no autoplay).
    if (!this.state.playRequested) {
      this._ensureStaticProps();
      if (this.state.props.logoAlpha > 0.01) {
        this._drawLogo(context, this.state.props.logoScale, this.state.props.logoAlpha);
      }
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

    // Draw logo only if it has some opacity
    if (this.state.props.logoAlpha > 0.01) {
      this._drawLogo(context, this.state.props.logoScale, this.state.props.logoAlpha);
    }

    // Draw ship overlay
    if (elapsed > this.state.shipAppear) {
      this._drawShipOverlay(context, ship, elapsed, this.state.props.shipScale, this.state.props.shipAlpha);
    }
  },

  _ensureStaticProps: function() {
    // Keep it simple: show logo at default scale until START is pressed.
    this.state.props.logoScale = 0.6;
    this.state.props.logoAlpha = 1;
    this.state.props.shipAlpha = 0;
    this.state.props.shipScale = 0.6;
  },

  _ensureTimeline: function(ship) {
    if (this.state.timeline) return;

    // Compute targetScale once per play cycle
    if (this.state.targetScale === null) {
      var fitBase = Math.min(
        (Game.canvasWidth * 0.58) / this.logoSize.w,
        (Game.canvasHeight * 0.43) / this.logoSize.h
      );
      var shipBaseHeight = 36.4;
      var shipBaseWidth = 35.0;
      var desiredShipScale = ship.scale;
      var scaleFromHeight = desiredShipScale * shipBaseHeight / (185 * fitBase);
      var scaleFromWidth = desiredShipScale * shipBaseWidth / (179 * fitBase);
      this.state.targetScale = Math.min(scaleFromHeight, scaleFromWidth);
    }

    var startScale = this.state.targetScale * 0.6;
    this.state.props.logoScale = startScale;
    this.state.props.shipScale = startScale;
    this.state.props.logoAlpha = 1;
    this.state.props.shipAlpha = 0;

    var self = this;
    this.state.timeline = anime.timeline({ autoplay: true });

    this.state.timeline
      .add({
        targets: this.state.props,
        logoScale: this.state.targetScale,
        duration: 1400,
        easing: 'easeOutExpo'
      })
      .add({
        targets: this.state.props,
        shipAlpha: 1,
        shipScale: this.state.targetScale,
        duration: 900,
        easing: 'easeOutQuad'
      }, '-=700')
      .add({
        targets: this.state.props,
        logoAlpha: 0,
        // Keep ship visible for a smoother handoff to gameplay.
        shipAlpha: 1,
        duration: 1100,
        delay: 300,
        easing: 'easeInQuad'
      });

    this.state.timeline.finished.then(function() {
      self.state.done = true;
    });
  },

  /**
   * Draw logo image
   */
  _drawLogo: function(context, introScale, introAlpha) {
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
   * Draw ship during intro
   */
  _drawShipOverlay: function(context, ship, elapsed, introScale, shipAlpha) {
    var fit = Math.min(
      (Game.canvasWidth * 0.58) / this.logoSize.w,
      (Game.canvasHeight * 0.43) / this.logoSize.h
    );
    
    var shipBaseHeight = 36.4;
    var shipBaseWidth = 35.0;
    var aHeightPixels = 185 * fit * introScale;
    var aWidthPixels = 179 * fit * introScale;
    var shipScaleH = aHeightPixels / shipBaseHeight;
    var shipScaleW = aWidthPixels / shipBaseWidth;
    var shipScale = Math.min(shipScaleH, shipScaleW);

    context.save();
    context.globalAlpha = shipAlpha;
    context.strokeStyle = THEME.primary;
    context.lineWidth = 1.0;
    
    ship.x = Game.canvasWidth / 2;
    ship.y = Game.canvasHeight / 2;
    
    var originalScale = ship.scale;
    var originalVisible = ship.visible;
    
    ship.visible = true;
    ship.scale = shipScale;
    ship.configureTransform();
    ship.draw();
    ship.scale = originalScale;
    ship.visible = originalVisible;
    
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
