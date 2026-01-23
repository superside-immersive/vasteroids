/**
 * Retro TV post-process overlay for 2D canvas.
 * Designed to be subtle and not overwrite the game's palette;
 * it layers scanlines, noise, RGB drift and analog tracking bars.
 */

(function () {
  function clamp255(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : v);
  }

  var RetroFX = {
    enabled: false,

    _w: 0,
    _h: 0,

    _noiseCanvas: null,
    _noiseCtx: null,
    _noiseW: 0,
    _noiseH: 0,

    _lowCanvas: null,
    _lowCtx: null,
    _lowW: 0,
    _lowH: 0,

    _frame: 0,

    init: function (w, h) {
      this._w = w;
      this._h = h;

      // Noise pattern (low-res, scaled up)
      this._noiseW = Math.max(80, Math.floor(w / 6));
      this._noiseH = Math.max(60, Math.floor(h / 6));
      this._noiseCanvas = document.createElement('canvas');
      this._noiseCanvas.width = this._noiseW;
      this._noiseCanvas.height = this._noiseH;
      this._noiseCtx = this._noiseCanvas.getContext('2d');

      // Low-res buffer for RGB drift (keeps CPU reasonable)
      this._lowW = Math.max(160, Math.floor(w / 2));
      this._lowH = Math.max(120, Math.floor(h / 2));
      this._lowCanvas = document.createElement('canvas');
      this._lowCanvas.width = this._lowW;
      this._lowCanvas.height = this._lowH;
      this._lowCtx = this._lowCanvas.getContext('2d', { willReadFrequently: true });

      this._frame = 0;
      this._refreshNoise();
    },

    setEnabled: function (enabled) {
      this.enabled = !!enabled;
    },

    _refreshNoise: function () {
      if (!this._noiseCtx) return;
      var w = this._noiseW;
      var h = this._noiseH;
      var img = this._noiseCtx.createImageData(w, h);
      var d = img.data;

      for (var i = 0; i < d.length; i += 4) {
        // Grain: mostly dark, occasional brighter specks
        var r = Math.random();
        var v = (r < 0.94) ? (Math.random() * 55) : (120 + Math.random() * 135);
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }

      this._noiseCtx.putImageData(img, 0, 0);
    },

    _applyRgbDriftOverlay: function (ctx, sourceCanvas, t) {
      if (!this._lowCtx) return;

      var lw = this._lowW;
      var lh = this._lowH;
      var lowCtx = this._lowCtx;

      lowCtx.clearRect(0, 0, lw, lh);
      lowCtx.drawImage(sourceCanvas, 0, 0, lw, lh);

      var img;
      try {
        img = lowCtx.getImageData(0, 0, lw, lh);
      } catch (e) {
        // If canvas is tainted for some reason, bail gracefully.
        return;
      }

      var d = img.data;
      var shift = 1;

      // Slight time-varying drift
      var drift = Math.sin(t * 0.0012) * 1.7;
      var driftInt = (drift > 0 ? Math.ceil(drift) : Math.floor(drift));

      // Overlay only (keeps original palette intact under it)
      for (var y = 0; y < lh; y++) {
        // Add a tiny row-dependent wobble for that analog feel
        var wobble = ((y % 32) < 2) ? driftInt : 0;
        for (var x = 0; x < lw; x++) {
          var idx = (y * lw + x) * 4;

          var xr = x + shift + wobble;
          var xb = x - shift + wobble;

          if (xr < 0) xr = 0;
          if (xr >= lw) xr = lw - 1;
          if (xb < 0) xb = 0;
          if (xb >= lw) xb = lw - 1;

          var idxR = (y * lw + xr) * 4;
          var idxB = (y * lw + xb) * 4;

          var r = d[idxR];
          var g = d[idx + 1];
          var b = d[idxB + 2];

          d[idx] = r;
          d[idx + 1] = g;
          d[idx + 2] = b;
        }
      }

      lowCtx.putImageData(img, 0, 0);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.18;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this._lowCanvas, 0, 0, this._w, this._h);
      ctx.restore();
    },

    _applyScanlines: function (ctx, t) {
      var w = this._w;
      var h = this._h;

      // Flicker/scanline intensity variation
      var flicker = 0.08 + 0.03 * (0.5 + 0.5 * Math.sin(t * 0.013));

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = flicker;
      ctx.fillStyle = 'rgba(0,0,0,1)';

      for (var y = 0; y < h; y += 2) {
        ctx.fillRect(0, y, w, 1);
      }
      ctx.restore();
    },

    _applyNoise: function (ctx, t) {
      if (!this._noiseCanvas) return;

      // Refresh noise every other frame for movement
      if ((this._frame % 2) === 0) {
        this._refreshNoise();
      }

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.07;

      // Slightly scroll noise over time
      var nx = Math.floor((t * 0.03) % this._noiseW);
      var ny = Math.floor((t * 0.02) % this._noiseH);
      ctx.drawImage(this._noiseCanvas, -nx, -ny, this._w + nx, this._h + ny);
      ctx.restore();
    },

    _applyTrackingBars: function (ctx, t) {
      var w = this._w;
      var h = this._h;

      // 2 moving bars, subtle
      var y1 = (t * 0.06) % (h + 120) - 60;
      var y2 = (t * 0.04 + 200) % (h + 160) - 80;

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';

      // Dark-to-light band (looks like analog sync)
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.fillRect(0, y1, w, 10);
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(0, y1 + 10, w, 18);

      // Second, thinner bar
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.fillRect(0, y2, w, 6);

      // A tiny bit of horizontal jitter within the bar region
      var jitter = Math.sin(t * 0.02) * 2;
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(jitter, y2 + 6, w, 8);

      ctx.restore();
    },

    apply: function (ctx, sourceCanvas, timeMs) {
      if (!this.enabled) return;
      if (!ctx || !sourceCanvas) return;
      if (!this._w || !this._h) {
        this.init(sourceCanvas.width, sourceCanvas.height);
      }

      this._frame++;
      var t = timeMs || Date.now();

      // Order matters: drift first (color fringing), then scanlines, then tracking & noise.
      this._applyRgbDriftOverlay(ctx, sourceCanvas, t);
      this._applyScanlines(ctx, t);
      this._applyTrackingBars(ctx, t);
      this._applyNoise(ctx, t);
    }
  };

  window.RetroFX = RetroFX;
})();
