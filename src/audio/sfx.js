/**
 * Sound Effects Manager
 * Handles audio loading and playback
 */

var SFX = {
  laser:     new Audio('assets/audio/39459__THE_bizniss__laser.wav'),
  explosion: new Audio('assets/audio/51467__smcameron__missile_explosion.wav'),
  muted: false,
  _unlocked: false,
  unlock: function () {
    if (SFX._unlocked) return;
    // Try to unlock audio playback on first user gesture
    for (var key in SFX) {
      if (typeof SFX[key] === 'object' && SFX[key] instanceof Audio) {
        try {
          var a = SFX[key];
          a.preload = 'auto';
          a.muted = true;
          var p = a.play();
          if (p && typeof p.then === 'function') {
            p.then(function () {}).catch(function () {});
          }
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        } catch (e) {}
      }
    }
    SFX._unlocked = true;
  },
  
  // Placeholder methods for new sounds (use existing sounds as fallback)
  fragmentCollect: function() {
    // TODO: Add unique "ping" sound for fragment collection
    // For now, use a quieter laser sound
    if (this.muted) return;
  },
  
  daseActivate: function() {
    // TODO: Add "power-up hum" sound
    if (this.muted) return;
  },
  
  beamSevered: function() {
    // TODO: Add "snap" sound
    if (this.muted) return;
    this.explosion();
  },
  
  beamRestored: function() {
    // TODO: Add "thunderclap" sound  
    if (this.muted) return;
  },
  
  similarityActivate: function() {
    // TODO: Add "shimmer" sound
    if (this.muted) return;
  },
  
  hyperspace: function() {
    // TODO: Add "warp" sound
    if (this.muted) return;
  },
  
  siloSpawn: function() {
    // TODO: Add "warning beep" sound
    if (this.muted) return;
  }
};

// Replace Audio objects with pooled play functions (limits concurrency to avoid clipping)
(function() {
  var configs = {
    laser: { max: 5, cooldown: 60, volume: 0.55 },
    explosion: { max: 3, cooldown: 120, volume: 0.8 }
  };

  function makePool(base, config) {
    base.preload = 'auto';
    var pool = [];
    var lastPlay = 0;
    return function () {
      if (SFX.muted) return null;
      if (!SFX._unlocked) {
        try { SFX.unlock(); } catch (e) {}
      }
      var now = Date.now();
      if (config.cooldown && now - lastPlay < config.cooldown) return null;
      lastPlay = now;

      var audio = null;
      for (var i = 0; i < pool.length; i++) {
        var candidate = pool[i];
        if (candidate.paused || candidate.ended) {
          audio = candidate;
          break;
        }
      }

      if (!audio && pool.length < (config.max || 4)) {
        audio = base.cloneNode(true);
        audio.preload = 'auto';
        pool.push(audio);
      }

      if (!audio && pool.length) {
        audio = pool[0];
      }

      if (!audio) return null;

      try {
        audio.currentTime = 0;
        audio.volume = config.volume != null ? config.volume : 1.0;
        var playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () {});
        }
      } catch (e) {}

      return audio;
    };
  }

  for (var sfx in SFX) {
    if (typeof SFX[sfx] === 'object' && SFX[sfx] instanceof Audio) {
      SFX[sfx] = makePool(SFX[sfx], configs[sfx] || { max: 4, cooldown: 80, volume: 0.7 });
    }
  }
})();
