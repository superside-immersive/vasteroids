/* DOM-based HUD for score, lives, DASE meter, and hyperspace */

var HUD = (function() {
  var container = null;
  var root = null;
  var scoreNode = null;
  var livesNode = null;
  var daseMeterContainer = null;
  var daseMeterFill = null;
  var daseMeterLabel = null;
  var daseMeterCounter = null;
  var daseFragmentIcons = null;
  var hyperspaceNode = null;
  var waveNode = null;
  var achievementBadge = null;
  var lastScore = null;
  var lastLives = null;
  var lastDasePercent = null;
  var lastDaseFragments = -1;
  var lastHyperspace = null;
  var lastWave = null;
  var lastAchievementIcon = null;
  var daseJustActivated = false;

  function init(gameContainer) {
    container = gameContainer || document.body;
    root = document.createElement('div');
    // Hidden by default; only show during active gameplay.
    root.className = 'ui-overlay hidden';

    var bar = document.createElement('div');
    bar.className = 'hud-bar';

    scoreNode = document.createElement('div');
    scoreNode.className = 'hud-chip hud-score';
    scoreNode.textContent = 'SCORE 0';

    achievementBadge = document.createElement('div');
    achievementBadge.className = 'hud-badge hidden';
    achievementBadge.textContent = '';

    livesNode = document.createElement('div');
    livesNode.className = 'hud-chip';
    livesNode.textContent = 'LIVES ×0';
    livesNode.style.display = 'none'; // Hide lives display
    
    waveNode = document.createElement('div');
    waveNode.className = 'hud-chip hud-wave';
    waveNode.textContent = 'WAVE 1';
    
    hyperspaceNode = document.createElement('div');
    hyperspaceNode.className = 'hud-chip hud-hyperspace';
    hyperspaceNode.textContent = 'JUMP ×3';

    bar.appendChild(hyperspaceNode);
    bar.appendChild(waveNode);
    bar.appendChild(scoreNode);
    bar.appendChild(achievementBadge);
    bar.appendChild(livesNode);
    root.appendChild(bar);
    
    // DASE Meter at bottom of screen - improved UI
    daseMeterContainer = document.createElement('div');
    daseMeterContainer.className = 'dase-meter-container';
    daseMeterContainer.innerHTML = 
      '<div class="dase-meter-header">' +
        '<span class="dase-meter-label">DATA FRAGMENTS</span>' +
        '<span class="dase-meter-counter">0 / 10</span>' +
      '</div>' +
      '<div class="dase-fragment-icons"></div>' +
      '<div class="dase-meter-bar"><div class="dase-meter-fill"></div></div>' +
      '<div class="dase-activation-text">DASE MODE READY!</div>';
    
    daseMeterLabel = daseMeterContainer.querySelector('.dase-meter-label');
    daseMeterCounter = daseMeterContainer.querySelector('.dase-meter-counter');
    daseMeterFill = daseMeterContainer.querySelector('.dase-meter-fill');
    daseFragmentIcons = daseMeterContainer.querySelector('.dase-fragment-icons');
    
    // Create fragment icon slots
    var maxFragments = 10;
    for (var i = 0; i < maxFragments; i++) {
      var icon = document.createElement('div');
      icon.className = 'dase-fragment-icon';
      icon.innerHTML = '◆';
      daseFragmentIcons.appendChild(icon);
    }
    
    root.appendChild(daseMeterContainer);
    
    // COMBO indicator (for Similarity Pickup)
    var comboIndicator = document.createElement('div');
    comboIndicator.className = 'combo-indicator hidden';
    comboIndicator.id = 'combo-indicator';
    comboIndicator.innerHTML = 
      '<div class="combo-label">COMBO</div>' +
      '<div class="combo-pips"></div>';
    
    var comboPips = comboIndicator.querySelector('.combo-pips');
    for (var i = 0; i < 5; i++) {
      var pip = document.createElement('div');
      pip.className = 'combo-pip';
      comboPips.appendChild(pip);
    }
    
    root.appendChild(comboIndicator);
    
    container.appendChild(root);
  }

  function show() {
    if (!root) return;
    root.classList.remove('hidden');
  }

  function hide() {
    if (!root) return;
    root.classList.add('hidden');
  }

  function updateScore(score) {
    if (score === lastScore) return;
    lastScore = score;
    if (!scoreNode) return;
    scoreNode.textContent = 'SCORE ' + score;
  }

  function updateLives(lives) {
    if (lives === lastLives) return;
    lastLives = lives;
    if (!livesNode) return;
    livesNode.textContent = 'LIVES ×' + Math.max(0, lives);
    Animations.pulse(livesNode, { duration: 320, scale: [1, 1.08, 1] });
  }
  
  function updateWave(wave) {
    if (wave === lastWave) return;
    lastWave = wave;
    if (!waveNode) return;
    waveNode.textContent = 'WAVE ' + wave;
  }
  
  function updateHyperspace(jumps) {
    if (jumps === lastHyperspace) return;
    lastHyperspace = jumps;
    if (!hyperspaceNode) return;
    hyperspaceNode.textContent = 'JUMP ×' + Math.max(0, jumps);
    hyperspaceNode.style.opacity = jumps > 0 ? '1' : '0.4';
  }

  function updateAchievementBadge() {
    if (!achievementBadge || !window.Game || !window.Game.stats) return;
    var icon = window.Game.stats.fragmentAchievementIcon || null;
    if (icon === lastAchievementIcon) return;
    lastAchievementIcon = icon;
    if (icon) {
      achievementBadge.innerHTML = '';
      if (icon.indexOf('.png') !== -1) {
        var img = document.createElement('img');
        img.className = 'hud-badge-icon';
        img.src = icon;
        img.alt = window.Game.stats.fragmentAchievementName || 'Achievement';
        achievementBadge.appendChild(img);
      } else {
        achievementBadge.textContent = icon;
      }
      achievementBadge.classList.remove('hidden');
      Animations.pulse(achievementBadge, { duration: 360, scale: [1, 1.2, 1] });
    } else {
      achievementBadge.innerHTML = '';
      achievementBadge.classList.add('hidden');
    }
  }
  
  function updateDASEMeter() {
    if (!daseMeterFill || !daseMeterLabel || !window.DASEMode) return;
    
    var isActive = DASEMode.isActive();
    var fragments = DASEMode.getFragments();
    var max = DASEMode.getMeterMax();
    var percent = Math.min(100, (fragments / max) * 100);
    
    // Update fragment icons
    if (daseFragmentIcons && fragments !== lastDaseFragments) {
      var icons = daseFragmentIcons.querySelectorAll('.dase-fragment-icon');
      for (var i = 0; i < icons.length; i++) {
        if (i < fragments) {
          icons[i].classList.add('filled');
          // Animate newly filled icon
          if (i === fragments - 1 && fragments > lastDaseFragments) {
            icons[i].classList.add('just-filled');
            setTimeout((function(icon) {
              return function() { icon.classList.remove('just-filled'); };
            })(icons[i]), 400);
          }
        } else {
          icons[i].classList.remove('filled');
        }
      }
      lastDaseFragments = fragments;
    }
    
    if (isActive) {
      // Show remaining duration when active (progress bar only, no exact timer per flowchart spec)
      var durationPercent = DASEMode.getDurationPercent() * 100;
      daseMeterFill.style.width = durationPercent + '%';
      daseMeterFill.style.background = DASEMode.beamSevered 
        ? 'linear-gradient(90deg, #FF0055, #FF3377)'
        : 'linear-gradient(90deg, #1FD9FE, #06D69F)';
      daseMeterLabel.textContent = DASEMode.beamSevered ? '⚠ BEAM SEVERED' : '⚡ TURRET ACTIVE';
      daseMeterLabel.style.color = DASEMode.beamSevered ? '#FF0055' : '#1FD9FE';
      if (daseMeterCounter) {
        // Don't show exact timer per flowchart spec - show status instead
        daseMeterCounter.textContent = DASEMode.beamSevered ? 'PAUSED' : 'ACTIVE';
        daseMeterCounter.style.color = DASEMode.beamSevered ? '#FF0055' : '#1FD9FE';
      }
      daseMeterContainer.classList.add('active');
      daseMeterContainer.classList.remove('ready');
      daseJustActivated = false;
    } else {
      daseMeterFill.style.width = percent + '%';
      daseMeterFill.style.background = 'linear-gradient(90deg, #E86B38, #FFBC42)';
      daseMeterLabel.textContent = 'DATA FRAGMENTS';
      daseMeterLabel.style.color = '#E86B38';
      if (daseMeterCounter) {
        daseMeterCounter.textContent = fragments + ' / ' + max;
        daseMeterCounter.style.color = fragments >= max ? '#06D69F' : '#9ca3af';
      }
      daseMeterContainer.classList.remove('active');
      
      // Check if meter just filled - show celebration!
      if (fragments >= max && !daseJustActivated) {
        daseMeterContainer.classList.add('ready');
        daseJustActivated = true;
      } else if (fragments < max) {
        daseMeterContainer.classList.remove('ready');
        daseJustActivated = false;
      }
    }
  }
  
  function updateCombo() {
    // Combo system removed - Similarity Pickup now drops rarely from asteroids
    // or guaranteed from killing Silo
  }
  
  /**
   * Show floating text at a position (for chain combo bonus etc)
   */
  function showFloatingText(text, x, y) {
    if (!container) return;
    
    var floater = document.createElement('div');
    floater.className = 'floating-text';
    floater.textContent = text;
    floater.style.position = 'absolute';
    floater.style.left = x + 'px';
    floater.style.top = y + 'px';
    floater.style.transform = 'translate(-50%, -50%)';
    floater.style.color = '#00FF00';
    floater.style.fontSize = '24px';
    floater.style.fontWeight = 'bold';
    floater.style.fontFamily = 'monospace';
    floater.style.textShadow = '0 0 10px #00FF00, 0 0 20px #00FF00';
    floater.style.pointerEvents = 'none';
    floater.style.zIndex = '1000';
    floater.style.opacity = '1';
    floater.style.transition = 'transform 1.5s ease-out, opacity 1.5s ease-out';
    
    container.appendChild(floater);
    
    // Trigger animation
    requestAnimationFrame(function() {
      floater.style.transform = 'translate(-50%, -150%)';
      floater.style.opacity = '0';
    });
    
    // Remove after animation
    setTimeout(function() {
      if (floater.parentNode) {
        floater.parentNode.removeChild(floater);
      }
    }, 1600);
  }

  function showAchievementToast(text) {
    if (!container) return;

    var floater = document.createElement('div');
    floater.className = 'floating-text achievement-toast';
    floater.textContent = text || 'ACHIEVEMENT UNLOCKED!';
    floater.style.position = 'absolute';
    floater.style.left = '50%';
    floater.style.top = '30%';
    floater.style.transform = 'translate(-50%, -50%)';
    floater.style.color = '#FFD56A';
    floater.style.fontSize = '26px';
    floater.style.fontWeight = 'bold';
    floater.style.fontFamily = "'Orbitron', 'Audiowide', monospace";
    floater.style.textShadow = '0 0 10px rgba(255, 213, 106, 0.9), 0 0 20px rgba(255, 213, 106, 0.6)';
    floater.style.pointerEvents = 'none';
    floater.style.zIndex = '1000';
    floater.style.opacity = '1';
    floater.style.transition = 'transform 1.6s ease-out, opacity 1.6s ease-out';

    container.appendChild(floater);

    requestAnimationFrame(function() {
      floater.style.transform = 'translate(-50%, -120%)';
      floater.style.opacity = '0';
    });

    setTimeout(function() {
      if (floater.parentNode) {
        floater.parentNode.removeChild(floater);
      }
    }, 1700);
  }

  function showAchievementEmoji(icon) {
    if (!icon) return;

    var target = container || document.body;
    var floater = document.createElement('div');
    floater.className = 'achievement-emoji';
    if (icon.indexOf('.png') !== -1) {
      var img = document.createElement('img');
      img.src = icon;
      img.alt = window.Game && Game.stats ? (Game.stats.fragmentAchievementName || 'Achievement') : 'Achievement';
      img.style.width = '160px';
      img.style.height = '160px';
      img.style.filter = 'drop-shadow(0 0 18px rgba(255, 213, 106, 0.9)) drop-shadow(0 0 32px rgba(255, 213, 106, 0.6))';
      floater.appendChild(img);
    } else {
      floater.textContent = icon;
    }
    floater.style.position = 'absolute';
    floater.style.left = '50%';
    floater.style.top = '50%';
    floater.style.transform = 'translate(-50%, -50%)';
    if (icon.indexOf('.png') === -1) {
      floater.style.fontSize = '160px';
      floater.style.textShadow = '0 0 18px rgba(255, 213, 106, 0.9), 0 0 32px rgba(255, 213, 106, 0.6)';
    }
    floater.style.pointerEvents = 'none';
    floater.style.zIndex = '1000';
    floater.style.opacity = '1';
    floater.style.transition = 'transform 2s ease-out, opacity 2s ease-out';

    target.appendChild(floater);

    requestAnimationFrame(function() {
      floater.style.transform = 'translate(-50%, -70%)';
      floater.style.opacity = '0';
    });

    setTimeout(function() {
      if (floater.parentNode) {
        floater.parentNode.removeChild(floater);
      }
    }, 2100);
  }

  function showDASELogo() {
    if (window.LevelTransitionManager && typeof LevelTransitionManager.isActive === 'function' && LevelTransitionManager.isActive()) {
      return;
    }
    var target = container || document.body;
    var logoDiv = document.createElement('div');
    logoDiv.className = 'dase-logo-popup';
    logoDiv.style.position = 'absolute';
    logoDiv.style.left = '50%';
    logoDiv.style.top = '50%';
    logoDiv.style.transform = 'translate(-50%, -50%) scale(0.5)';
    logoDiv.style.pointerEvents = 'none';
    logoDiv.style.zIndex = '1000';
    logoDiv.style.opacity = '0';
    logoDiv.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease-out';

    var logoImg = document.createElement('img');
    logoImg.src = 'assets/Dase_Mode_Text.png';
    logoImg.alt = 'DASE MODE';
    logoImg.style.display = 'block';
    logoImg.style.width = '360px';
    logoImg.style.height = 'auto';
    logoImg.style.filter = 'drop-shadow(0 0 14px rgba(31, 217, 254, 0.6))';
    logoDiv.appendChild(logoImg);

    target.appendChild(logoDiv);

    // Animate in
    requestAnimationFrame(function() {
      logoDiv.style.opacity = '1';
      logoDiv.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    // Fade out after 1.5 seconds
    setTimeout(function() {
      logoDiv.style.opacity = '0';
      logoDiv.style.transform = 'translate(-50%, -50%) scale(1.2)';
    }, 1500);

    // Remove from DOM
    setTimeout(function() {
      if (logoDiv.parentNode) {
        logoDiv.parentNode.removeChild(logoDiv);
      }
    }, 2000);
  }

  var instructionBillboard = null;
  var instructionBillboardRaf = null;

  function clearInstructionBillboard() {
    if (instructionBillboardRaf) {
      cancelAnimationFrame(instructionBillboardRaf);
      instructionBillboardRaf = null;
    }
    if (instructionBillboard && instructionBillboard.parentNode) {
      instructionBillboard.parentNode.removeChild(instructionBillboard);
    }
    instructionBillboard = null;
  }

  function showInstructionBillboard() {
    var target = container || document.body;
    if (!target) return;

    clearInstructionBillboard();

    var billboard = document.createElement('img');
    billboard.className = 'instruction-billboard';
    billboard.src = 'assets/Instructions_Keyboard.png';
    billboard.alt = 'Instructions';
    target.appendChild(billboard);
    instructionBillboard = billboard;

    var startAt = Date.now();
    var durationMs = 3000;
    var offsetX = 160;
    var offsetY = -160;

    function tick() {
      if (!instructionBillboard) return;
      var ship = window.Game && Game.ship ? Game.ship : null;
      var canvasW = (window.Game && Game.canvasWidth) ? Game.canvasWidth : target.clientWidth;
      var canvasH = (window.Game && Game.canvasHeight) ? Game.canvasHeight : target.clientHeight;

      if (ship && canvasW && canvasH) {
        var halfW = (instructionBillboard.offsetWidth || 220) / 2;
        var halfH = (instructionBillboard.offsetHeight || 120) / 2;
        var x = ship.x + offsetX;
        var y = ship.y + offsetY;
        var minX = halfW + 8;
        var maxX = canvasW - halfW - 8;
        var minY = halfH + 8;
        var maxY = canvasH - halfH - 8;
        if (x < minX) x = minX;
        if (x > maxX) x = maxX;
        if (y < minY) y = minY;
        if (y > maxY) y = maxY;
        instructionBillboard.style.left = x + 'px';
        instructionBillboard.style.top = y + 'px';
      }

      if ((Date.now() - startAt) < durationMs) {
        instructionBillboardRaf = requestAnimationFrame(tick);
      } else {
        instructionBillboard.style.opacity = '0';
        setTimeout(clearInstructionBillboard, 300);
      }
    }

    requestAnimationFrame(function() {
      if (!instructionBillboard) return;
      instructionBillboard.style.opacity = '0.6';
      tick();
    });
  }

  return {
    init: init,
    show: show,
    hide: hide,
    updateScore: updateScore,
    updateLives: updateLives,
    updateWave: updateWave,
    updateHyperspace: updateHyperspace,
    updateDASEMeter: updateDASEMeter,
    updateAchievementBadge: updateAchievementBadge,
    updateCombo: updateCombo,
    showFloatingText: showFloatingText,
    showAchievementToast: showAchievementToast,
    showAchievementEmoji: showAchievementEmoji,
    showDASELogo: showDASELogo,
    showInstructionBillboard: showInstructionBillboard
  };
})();
