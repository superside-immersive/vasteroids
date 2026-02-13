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
    var delta = score - (lastScore || 0);
    lastScore = score;
    if (!scoreNode) return;
    scoreNode.textContent = 'SCORE ' + score;

    // Juicy pulse on big score jumps
    if (delta >= 500) {
      scoreNode.style.transition = 'transform 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.6)';
      scoreNode.style.transform = 'scale(1.18)';
      setTimeout(function() {
        scoreNode.style.transition = 'transform 0.3s ease-out';
        scoreNode.style.transform = 'scale(1)';
      }, 130);
    }
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
    var isNewWave = lastWave !== null && wave > lastWave;
    lastWave = wave;
    if (!waveNode) return;
    waveNode.textContent = 'WAVE ' + wave;

    // Juicy bump on wave change
    if (isNewWave) {
      waveNode.style.transition = 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.6)';
      waveNode.style.transform = 'scale(1.22)';
      setTimeout(function() {
        waveNode.style.transition = 'transform 0.35s ease-out';
        waveNode.style.transform = 'scale(1)';
      }, 160);

      // Show a big centered wave banner
      showWaveBanner(wave);
    }
  }

  function showWaveBanner(wave) {
    if (!container) return;
    var banner = document.createElement('div');
    banner.className = 'wave-banner';
    banner.textContent = 'WAVE ' + wave;
    banner.style.cssText = 'position:absolute;left:50%;top:45%;transform:translate(-50%,-50%) scale(0.5);' +
      'font-family:\"Orbitron\",\"Audiowide\",monospace;font-size:48px;font-weight:bold;letter-spacing:6px;' +
      'color:#FFBC42;text-shadow:0 0 20px rgba(255,188,66,0.8),0 0 40px rgba(255,188,66,0.4);' +
      'pointer-events:none;z-index:1100;opacity:0;' +
      'transition:transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.25s ease-out;';
    container.appendChild(banner);

    requestAnimationFrame(function() {
      banner.style.opacity = '1';
      banner.style.transform = 'translate(-50%,-50%) scale(1)';

      setTimeout(function() {
        banner.style.transition = 'transform 0.8s ease-in, opacity 0.6s ease-in';
        banner.style.transform = 'translate(-50%,-50%) scale(1.3)';
        banner.style.opacity = '0';
      }, 900);

      setTimeout(function() {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 1800);
    });
  }
  
  function updateHyperspace(jumps) {
    if (jumps === lastHyperspace) return;
    var wasHigher = lastHyperspace !== null && jumps < lastHyperspace;
    lastHyperspace = jumps;
    if (!hyperspaceNode) return;
    hyperspaceNode.textContent = 'JUMP ×' + Math.max(0, jumps);
    hyperspaceNode.style.opacity = jumps > 0 ? '1' : '0.4';

    // Shake chip when a jump is used
    if (wasHigher) {
      hyperspaceNode.style.transition = 'transform 0.1s ease';
      hyperspaceNode.style.transform = 'scale(1.15) rotate(-3deg)';
      setTimeout(function() {
        hyperspaceNode.style.transition = 'transform 0.3s ease-out';
        hyperspaceNode.style.transform = 'scale(1) rotate(0deg)';
      }, 110);
    }
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
    floater.style.transform = 'translate(-50%, -50%) scale(0.3)';
    floater.style.color = '#00FF00';
    floater.style.fontSize = '28px';
    floater.style.fontWeight = 'bold';
    floater.style.fontFamily = "'Orbitron', 'Audiowide', monospace";
    floater.style.textShadow = '0 0 12px #00FF00, 0 0 24px #00FF00';
    floater.style.pointerEvents = 'none';
    floater.style.zIndex = '1000';
    floater.style.opacity = '0';
    floater.style.transition = 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.6), opacity 0.15s ease-out';
    
    container.appendChild(floater);
    
    // Phase 1: scale-in with overshoot
    requestAnimationFrame(function() {
      floater.style.opacity = '0.95';
      floater.style.transform = 'translate(-50%, -50%) scale(1.1)';

      // Phase 2: settle + float up and fade
      setTimeout(function() {
        floater.style.transition = 'transform 1.4s ease-out, opacity 1.2s ease-in';
        floater.style.transform = 'translate(-50%, -200%) scale(0.8)';
        floater.style.opacity = '0';
      }, 280);
    });
    
    // Remove after animation
    setTimeout(function() {
      if (floater.parentNode) {
        floater.parentNode.removeChild(floater);
      }
    }, 1800);
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
    floater.style.opacity = '0.92';
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
    floater.style.opacity = '0.92';
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

  function showDASELogo(options) {
    if (window.LevelTransitionManager && typeof LevelTransitionManager.isActive === 'function' && LevelTransitionManager.isActive()) {
      return;
    }
    options = options || {};
    var topPercent = typeof options.topPercent === 'number' ? options.topPercent : 50;
    var holdMs = typeof options.holdMs === 'number' ? options.holdMs : 1500;
    var target = container || document.body;
    var logoDiv = document.createElement('div');
    logoDiv.className = 'dase-logo-popup';
    logoDiv.style.position = 'absolute';
    logoDiv.style.left = '50%';
    logoDiv.style.top = topPercent + '%';
    logoDiv.style.transform = 'translate(-50%, -50%) scale(0.5)';
    logoDiv.style.pointerEvents = 'none';
    logoDiv.style.zIndex = '2400';
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
      logoDiv.style.opacity = '0.9';
      logoDiv.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    // Fade out after 1.5 seconds
    setTimeout(function() {
      logoDiv.style.opacity = '0';
      logoDiv.style.transform = 'translate(-50%, -50%) scale(1.2)';
    }, holdMs);

    // Remove from DOM
    setTimeout(function() {
      if (logoDiv.parentNode) {
        logoDiv.parentNode.removeChild(logoDiv);
      }
    }, holdMs + 500);
  }

  var tutorialCard = null;
  var tutorialCardTimer = null;
  var tutorialCardLine = null;
  var tutorialCardDot = null;
  var tutorialCardLineRaf = null;
  var tutorialCardTargetResolver = null;

  function clearTutorialPointerLine() {
    if (tutorialCardLineRaf) {
      cancelAnimationFrame(tutorialCardLineRaf);
      tutorialCardLineRaf = null;
    }
    tutorialCardTargetResolver = null;
    if (tutorialCardLine && tutorialCardLine.parentNode) {
      tutorialCardLine.parentNode.removeChild(tutorialCardLine);
    }
    tutorialCardLine = null;
    if (tutorialCardDot && tutorialCardDot.parentNode) {
      tutorialCardDot.parentNode.removeChild(tutorialCardDot);
    }
    tutorialCardDot = null;
  }

  function updateTutorialPointerLine() {
    if (!tutorialCard || typeof tutorialCardTargetResolver !== 'function') {
      tutorialCardLineRaf = null;
      return;
    }

    var targetPos = tutorialCardTargetResolver();
    if (!targetPos || typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
      if (tutorialCardLine) tutorialCardLine.style.opacity = '0';
      if (tutorialCardDot) tutorialCardDot.style.opacity = '0';
      tutorialCardLineRaf = requestAnimationFrame(updateTutorialPointerLine);
      return;
    }

    // Dynamically position card above the target object
    var containerHeight = (container || document.body).offsetHeight || 540;
    var containerWidth = (container || document.body).offsetWidth || 960;
    var cardHeight = tutorialCard.offsetHeight || 50;
    var cardOffset = 70; // px gap between card bottom and target
    var cardTop = targetPos.y - cardHeight - cardOffset;
    // If card would go off-screen top, put it below instead
    var cardBelow = false;
    if (cardTop < 20) {
      cardTop = targetPos.y + cardOffset;
      cardBelow = true;
    }
    // Clamp within container
    cardTop = Math.max(10, Math.min(containerHeight - cardHeight - 10, cardTop));
    tutorialCard.style.top = cardTop + 'px';
    // Also adjust horizontal to follow target (clamped to stay mostly centered)
    var cardLeft = Math.max(containerWidth * 0.18, Math.min(containerWidth * 0.82, targetPos.x));
    tutorialCard.style.left = cardLeft + 'px';

    // Draw pointer line from card edge to target
    if (tutorialCardLine) {
      var cardRect = tutorialCard.getBoundingClientRect();
      var containerRect = (container || document.body).getBoundingClientRect();
      var startX = (cardRect.left + cardRect.width / 2) - containerRect.left;
      var startY = cardBelow
        ? cardRect.top - containerRect.top - 2
        : cardRect.bottom - containerRect.top + 2;
      var endX = targetPos.x;
      var endY = targetPos.y;

      var dx = endX - startX;
      var dy = endY - startY;
      var length = Math.sqrt(dx * dx + dy * dy);

      tutorialCardLine.style.left = startX + 'px';
      tutorialCardLine.style.top = startY + 'px';
      tutorialCardLine.style.width = Math.max(0, length) + 'px';
      tutorialCardLine.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
      tutorialCardLine.style.opacity = length > 8 ? '0.92' : '0';

      if (tutorialCardDot) {
        tutorialCardDot.style.left = endX + 'px';
        tutorialCardDot.style.top = endY + 'px';
        tutorialCardDot.style.opacity = length > 8 ? '0.9' : '0';
      }
    }

    tutorialCardLineRaf = requestAnimationFrame(updateTutorialPointerLine);
  }

  function clearTutorialCard() {
    clearTutorialPointerLine();
    if (tutorialCardTimer) {
      clearTimeout(tutorialCardTimer);
      tutorialCardTimer = null;
    }
    if (tutorialCard && tutorialCard.parentNode) {
      tutorialCard.parentNode.removeChild(tutorialCard);
    }
    tutorialCard = null;
  }

  function showTutorialCard(lines, options) {
    var target = container || document.body;
    if (!target) return;

    options = options || {};
    var duration = typeof options.duration === 'number' ? options.duration : 2600;
    var topPercent = typeof options.topPercent === 'number' ? options.topPercent : 30;
    var accent = options.accent || '#1FD9FE';
    tutorialCardTargetResolver = typeof options.targetResolver === 'function' ? options.targetResolver : null;
    var normalized = [];

    if (typeof lines === 'string') {
      normalized = [lines];
    } else if (lines && lines.length) {
      normalized = lines.slice(0, 2);
    }
    if (!normalized.length) return;

    clearTutorialCard();

    var card = document.createElement('div');
    card.className = 'tutorial-card';
    card.style.top = topPercent + '%';
    card.style.setProperty('--tutorial-accent', accent);

    for (var i = 0; i < normalized.length; i++) {
      var line = document.createElement('div');
      line.className = 'tutorial-card-line';
      line.textContent = normalized[i];
      card.appendChild(line);
    }

    target.appendChild(card);
    tutorialCard = card;

    if (tutorialCardTargetResolver) {
      var pointer = document.createElement('div');
      pointer.className = 'tutorial-card-pointer-line';
      pointer.style.setProperty('--tutorial-accent', accent);
      target.appendChild(pointer);
      tutorialCardLine = pointer;

      var dot = document.createElement('div');
      dot.className = 'tutorial-card-pointer-dot';
      dot.style.setProperty('--tutorial-accent', accent);
      target.appendChild(dot);
      tutorialCardDot = dot;

      tutorialCardLineRaf = requestAnimationFrame(updateTutorialPointerLine);
    }

    requestAnimationFrame(function() {
      if (!tutorialCard) return;
      tutorialCard.classList.add('visible');
    });

    tutorialCardTimer = setTimeout(function() {
      if (!tutorialCard) return;
      tutorialCard.classList.remove('visible');
      setTimeout(clearTutorialCard, 280);
    }, duration);
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
    showInstructionBillboard: showInstructionBillboard,
    showTutorialCard: showTutorialCard,
    clearTutorialCard: clearTutorialCard
  };
})();
