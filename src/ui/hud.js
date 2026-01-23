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
  var lastScore = null;
  var lastLives = null;
  var lastDasePercent = null;
  var lastDaseFragments = -1;
  var lastHyperspace = null;
  var lastWave = null;
  var daseJustActivated = false;

  function init(gameContainer) {
    container = gameContainer || document.body;
    root = document.createElement('div');
    // Hidden by default; only show during active gameplay.
    root.className = 'ui-overlay hidden';

    var bar = document.createElement('div');
    bar.className = 'hud-bar';

    scoreNode = document.createElement('div');
    scoreNode.className = 'hud-score text-glow';
    scoreNode.textContent = 'SCORE 0';

    livesNode = document.createElement('div');
    livesNode.className = 'hud-chip';
    livesNode.textContent = 'LIVES ×0';
    livesNode.style.display = 'none'; // Hide lives display
    
    waveNode = document.createElement('div');
    waveNode.className = 'hud-chip hud-wave';
    waveNode.textContent = 'WAVE 1';
    waveNode.style.marginLeft = 'auto';
    
    hyperspaceNode = document.createElement('div');
    hyperspaceNode.className = 'hud-chip hud-hyperspace';
    hyperspaceNode.textContent = 'JUMP ×3';
    hyperspaceNode.style.marginLeft = '10px';

    bar.appendChild(scoreNode);
    bar.appendChild(livesNode);
    bar.appendChild(waveNode);
    bar.appendChild(hyperspaceNode);
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
    Animations.pulse(scoreNode, { duration: 360 });
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

  return {
    init: init,
    show: show,
    hide: hide,
    updateScore: updateScore,
    updateLives: updateLives,
    updateWave: updateWave,
    updateHyperspace: updateHyperspace,
    updateDASEMeter: updateDASEMeter,
    updateCombo: updateCombo
  };
})();
