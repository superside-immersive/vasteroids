/**
 * Sound Effects Manager
 * Handles audio loading and playback
 * 
 * Sound effects from "512 Sound Effects (8-bit style)" by SubspaceAudio
 * (CC0 / Public Domain) - https://opengameart.org/content/512-sound-effects-8-bit-style
 */

var SFX = {
  // Original sounds
  laser:              new Audio('assets/audio/39459__THE_bizniss__laser.wav'),
  explosion:          new Audio('assets/audio/asteroid_explosion.wav'),
  asteroidExplosionAudio: new Audio('assets/audio/asteroid_explosion.wav'),
  badgeUnlockAudio:   new Audio('assets/audio/badge_unlock.wav'),
  
  // New sounds
  hyperspaceAudio:    new Audio('assets/audio/hyperspace.wav'),
  fragmentAudio:      new Audio('assets/audio/fragment_collect.wav'),
  daseAudio:          new Audio('assets/audio/dase_activate.wav'),
  beamSeveredAudio:   new Audio('assets/audio/beam_severed.wav'),
  beamRestoredAudio:  new Audio('assets/audio/beam_restored.wav'),
  similarityAudio:    new Audio('assets/audio/similarity_activate.wav'),
  siloAudio:          new Audio('assets/audio/silo_spawn.wav'),
  waveCompleteAudio:  new Audio('assets/audio/wave_complete.wav'),
  playerDeathAudio:   new Audio('assets/audio/player_death.wav'),
  gameOverAlarmAudio: new Audio('assets/audio/game_over_alarm.wav'),
  nameAcceptAudio:    new Audio('assets/audio/name_accept.wav'),
  menuSelectAudio:    new Audio('assets/audio/menu_select.wav'),
  gameStartAudio:     new Audio('assets/audio/game_start.wav'),
  shieldHumAudio:     new Audio('assets/audio/shield_hum.wav'),
  chainImplosionAudio: new Audio('assets/audio/chain_implosion.wav'),
  
  // Shield hum loop control
  _shieldHumPlaying:  null,
  
  muted: false,
  _unlocked: false,
  _soundSources: {
    laser: 'assets/audio/39459__THE_bizniss__laser.wav',
    explosion: 'assets/audio/asteroid_explosion.wav',
    asteroidExplosionAudio: 'assets/audio/asteroid_explosion.wav',
    badgeUnlockAudio: 'assets/audio/badge_unlock.wav',
    hyperspaceAudio: 'assets/audio/hyperspace.wav',
    fragmentAudio: 'assets/audio/fragment_collect.wav',
    daseAudio: 'assets/audio/dase_activate.wav',
    beamSeveredAudio: 'assets/audio/beam_severed.wav',
    beamRestoredAudio: 'assets/audio/beam_restored.wav',
    similarityAudio: 'assets/audio/similarity_activate.wav',
    siloAudio: 'assets/audio/silo_spawn.wav',
    waveCompleteAudio: 'assets/audio/wave_complete.wav',
    playerDeathAudio: 'assets/audio/player_death.wav',
    gameOverAlarmAudio: 'assets/audio/game_over_alarm.wav',
    nameAcceptAudio: 'assets/audio/name_accept.wav',
    menuSelectAudio: 'assets/audio/menu_select.wav',
    gameStartAudio: 'assets/audio/game_start.wav',
    shieldHumAudio: 'assets/audio/shield_hum.wav',
    chainImplosionAudio: 'assets/audio/chain_implosion.wav'
  },
  _soundMeta: {
    laser: 'Player/alien laser shot',
    explosion: 'Generic explosion (legacy)',
    asteroidExplosionAudio: 'Asteroid destruction',
    badgeUnlockAudio: 'Badge unlocked (achievement)',
    hyperspaceAudio: 'Hyperspace teleport',
    fragmentAudio: 'Fragment collect',
    daseAudio: 'DASE activation',
    beamSeveredAudio: 'DASE beam severed',
    beamRestoredAudio: 'DASE beam restored',
    similarityAudio: 'Similarity activation',
    siloAudio: 'Silo spawn',
    waveCompleteAudio: 'Wave complete',
    playerDeathAudio: 'Player death',
    gameOverAlarmAudio: 'Game over alarm',
    nameAcceptAudio: 'Name accept confirm',
    menuSelectAudio: 'Menu select (start)',
    gameStartAudio: 'Game start',
    shieldHumAudio: 'Shield hum loop',
    chainImplosionAudio: 'Similarity chain implosion'
  },
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
  }
};

// Replace Audio objects with pooled play functions (limits concurrency to avoid clipping)
(function() {
  var configs = {
    laser:              { max: 5, cooldown: 60, volume: 0.55 },
    explosion:          { max: 3, cooldown: 120, volume: 0.8 },
    asteroidExplosionAudio: { max: 3, cooldown: 120, volume: 0.85 },
    badgeUnlockAudio:   { max: 1, cooldown: 300, volume: 0.75 },
    hyperspaceAudio:    { max: 2, cooldown: 500, volume: 0.7 },
    fragmentAudio:      { max: 6, cooldown: 30, volume: 0.5 },
    daseAudio:          { max: 1, cooldown: 1000, volume: 0.75 },
    beamSeveredAudio:   { max: 2, cooldown: 200, volume: 0.8 },
    beamRestoredAudio:  { max: 2, cooldown: 200, volume: 0.65 },
    similarityAudio:    { max: 1, cooldown: 500, volume: 0.7 },
    siloAudio:          { max: 2, cooldown: 0, volume: 0.7 },
    waveCompleteAudio:  { max: 1, cooldown: 1000, volume: 0.75 },
    playerDeathAudio:   { max: 2, cooldown: 300, volume: 0.85 },
    gameOverAlarmAudio: { max: 1, cooldown: 1000, volume: 0.8 },
    nameAcceptAudio:    { max: 2, cooldown: 120, volume: 0.7 },
    menuSelectAudio:    { max: 2, cooldown: 120, volume: 0.7 },
    gameStartAudio:     { max: 1, cooldown: 500, volume: 0.7 },
    shieldHumAudio:     { max: 1, cooldown: 0, volume: 0.4 },
    chainImplosionAudio: { max: 1, cooldown: 300, volume: 0.8 }
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

  SFX._soundConfigs = configs;
  SFX._makePool = makePool;

  for (var sfx in SFX) {
    if (typeof SFX[sfx] === 'object' && SFX[sfx] instanceof Audio) {
      SFX[sfx] = makePool(SFX[sfx], configs[sfx] || { max: 4, cooldown: 80, volume: 0.7 });
    }
  }
})();

// Convenience methods for playing sounds
SFX.fragmentCollect = function() {
  this.fragmentAudio();
};

SFX.daseActivate = function() {
  this.daseAudio();
};

SFX.beamSevered = function() {
  this.beamSeveredAudio();
};

SFX.beamRestored = function() {
  this.beamRestoredAudio();
};

SFX.similarityActivate = function() {
  this.similarityAudio();
};

SFX.hyperspace = function() {
  this.hyperspaceAudio();
};

SFX.siloSpawn = function() {
  if (SFX.muted) return;
  var played = this.siloAudio();
  if (!played) {
    try {
      if (!SFX._unlocked) {
        try { SFX.unlock(); } catch (e) {}
      }
      var audio = new Audio(SFX._soundSources.siloAudio || 'assets/audio/silo_spawn.wav');
      audio.volume = 0.7;
      audio.play().catch(function(){});
    } catch (e) {}
  }
};

SFX.waveComplete = function() {
  this.waveCompleteAudio();
};

SFX.playerDeath = function() {
  this.playerDeathAudio();
};

SFX.gameOverAlarm = function() {
  this.gameOverAlarmAudio();
};

SFX.nameAccept = function() {
  this.nameAcceptAudio();
};

SFX.menuSelect = function() {
  this.menuSelectAudio();
};

SFX.gameStart = function() {
  this.gameStartAudio();
};

SFX.chainImplosion = function() {
  this.chainImplosionAudio();
};

SFX.asteroidExplosion = function() {
  this.asteroidExplosionAudio();
};

SFX.badgeUnlock = function() {
  this.badgeUnlockAudio();
};

SFX.startShieldHum = function() {
  if (SFX.muted || SFX._shieldHumPlaying) return;
  try {
    var audio = new Audio(SFX._soundSources.shieldHumAudio || 'assets/audio/shield_hum.wav');
    audio.loop = true;
    audio.volume = 0.35;
    audio.play().catch(function(){});
    SFX._shieldHumPlaying = audio;
  } catch(e) {}
};

SFX.stopShieldHum = function() {
  if (SFX._shieldHumPlaying) {
    try {
      SFX._shieldHumPlaying.pause();
      SFX._shieldHumPlaying.currentTime = 0;
    } catch(e) {}
    SFX._shieldHumPlaying = null;
  }
};

SFX.setSound = function(key, url) {
  if (!key || !url) return false;
  if (!SFX._soundConfigs || !SFX._makePool) return false;
  if (!SFX._soundConfigs[key]) return false;
  try {
    SFX._soundSources[key] = url;
    var audio = new Audio(url);
    audio.preload = 'auto';
    SFX[key] = SFX._makePool(audio, SFX._soundConfigs[key]);
    return true;
  } catch (e) {
    return false;
  }
};
