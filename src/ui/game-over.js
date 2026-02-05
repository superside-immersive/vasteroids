/* Game over and name entry flow - with integrated QR scanner */

var GameOverUI = (function() {
  var overlay = null;
  var panel = null;
  var title = null;
  var input = null;
  var submitBtn = null;
  var qrPreview = null;
  var qrStatus = null;
  var scanLine = null;
  var hint = null;
   var confirmPanel = null;
  var btnOk = null;
  var btnCancel = null;
  var selectedButton = 0; // 0 = OK, 1 = Cancel
  var scoreValue = 0;
  var awaitingRestart = false;
  var awaitingConfirm = false;
  var autoReturnTimer = null;
  var scanner = null;
  var isScanning = false;
  var keyHandler = null;

  // QR Parser (embedded)
  var QRParser = {
    DELIMITERS: ['^', '*', '%', '|'],
    parse: function(qrData) {
      if (!qrData || typeof qrData !== 'string') {
        return { error: 'Invalid QR data', raw: qrData };
      }
      var trimmedData = qrData.trim();
      if (this.isMeCardFormat(trimmedData)) return this.parseMeCard(trimmedData);
      if (this.isDelimitedFormat(trimmedData)) return this.parseDelimited(trimmedData);
      if (this.isEmailFormat(trimmedData)) return this.parseEmail(trimmedData);
      return this.parseReferenceId(trimmedData);
    },
    isMeCardFormat: function(data) { return data.toUpperCase().indexOf('MECARD:') === 0; },
    parseMeCard: function(data) {
      var result = { format: 'MeCard', raw: data, firstName: null, lastName: null, email: null, company: null };
      try {
        var nameMatch = data.match(/N:([^;]*)/i);
        if (nameMatch && nameMatch[1]) {
          var nameParts = nameMatch[1].split(',');
          if (nameParts.length >= 2) { result.lastName = nameParts[0].trim(); result.firstName = nameParts[1].trim(); }
          else if (nameParts.length === 1) { result.lastName = nameParts[0].trim(); }
        }
        var emailMatch = data.match(/EMAIL:([^;]*)/i);
        if (emailMatch && emailMatch[1]) result.email = emailMatch[1].trim() || null;
        var orgMatch = data.match(/ORG:([^;]*)/i);
        if (orgMatch && orgMatch[1]) result.company = orgMatch[1].trim() || null;
      } catch (e) {}
      return result;
    },
    isDelimitedFormat: function(data) {
      for (var i = 0; i < this.DELIMITERS.length; i++) {
        if (data.indexOf(this.DELIMITERS[i]) !== -1 && data.split(this.DELIMITERS[i]).length >= 3) return true;
      }
      return false;
    },
    parseDelimited: function(data) {
      var result = { format: 'Delimited', raw: data, firstName: null, lastName: null, email: null, company: null };
      try {
        var delimiter = null, maxParts = 0;
        for (var i = 0; i < this.DELIMITERS.length; i++) {
          var parts = data.split(this.DELIMITERS[i]);
          if (parts.length > maxParts) { maxParts = parts.length; delimiter = this.DELIMITERS[i]; }
        }
        if (delimiter) {
          var parts = data.split(delimiter);
          if (parts[1]) result.firstName = parts[1].trim();
          if (parts[2]) result.lastName = parts[2].trim();
          if (parts[3]) result.email = parts[3].trim();
          if (parts[5]) result.company = parts[5].trim();
        }
      } catch (e) {}
      return result;
    },
    isEmailFormat: function(data) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data); },
    parseEmail: function(data) { return { format: 'Email', raw: data, email: data, firstName: null, lastName: null, company: null, referenceId: null }; },
    parseReferenceId: function(data) { return { format: 'Reference ID', raw: data, firstName: null, lastName: null, email: null, company: null, referenceId: data }; },
    getDisplayName: function(parsedData, maxLen) {
      maxLen = maxLen || 10;
      var name = null;
      if (parsedData.firstName && parsedData.lastName) {
        name = parsedData.firstName.toUpperCase();
        if (name.length < maxLen - 1) name = (parsedData.firstName[0] + parsedData.lastName).toUpperCase();
      } else if (parsedData.firstName) { name = parsedData.firstName.toUpperCase(); }
      else if (parsedData.lastName) { name = parsedData.lastName.toUpperCase(); }
      else if (parsedData.email) { name = parsedData.email.split('@')[0].toUpperCase(); }
      else if (parsedData.referenceId) { name = parsedData.referenceId.toUpperCase(); }
      if (name) name = name.replace(/[^A-Z0-9]/g, '').substring(0, maxLen);
      return name || 'PLAYER';
    }
  };

  function init(container) {
    overlay = document.createElement('div');
    overlay.className = 'ui-overlay interactive hidden';

    panel = document.createElement('div');
    panel.className = 'ui-panel game-over-panel';

    title = document.createElement('div');
    title.className = 'text-glow';
    title.style.fontSize = '28px';
    title.style.marginBottom = '16px';
    title.textContent = 'CAPACITY REACHED';

    // Create two-column layout
    var entryRow = document.createElement('div');
    entryRow.className = 'name-entry-row';

    // Left side: QR Scanner
    var qrSection = document.createElement('div');
    qrSection.className = 'qr-section';

    var qrLabel = document.createElement('div');
    qrLabel.className = 'section-label';
    qrLabel.textContent = 'SCAN BADGE';

    var qrWrapper = document.createElement('div');
    qrWrapper.className = 'qr-inline-wrapper';

    qrPreview = document.createElement('div');
    qrPreview.id = 'qr-inline-preview';
    qrPreview.className = 'qr-inline-preview';

    scanLine = document.createElement('div');
    scanLine.className = 'qr-scan-line-inline';

    var corners = document.createElement('div');
    corners.className = 'qr-corners-inline';
    corners.innerHTML = '<div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>';

    qrWrapper.appendChild(qrPreview);
    qrWrapper.appendChild(scanLine);
    qrWrapper.appendChild(corners);

    qrStatus = document.createElement('div');
    qrStatus.className = 'qr-inline-status';
    qrStatus.textContent = 'SCANNING...';

    qrSection.appendChild(qrLabel);
    qrSection.appendChild(qrWrapper);
    qrSection.appendChild(qrStatus);

    // Confirmation panel (hidden initially, shows after scan)
    confirmPanel = document.createElement('div');
    confirmPanel.className = 'qr-confirm-panel hidden';
    confirmPanel.innerHTML = '<div class="confirm-name" id="confirm-name"></div>' +
                 '<div class="confirm-buttons">' +
                 '<button type="button" class="confirm-btn confirm-ok selected" id="btn-ok">OK</button>' +
                 '<button type="button" class="confirm-btn confirm-cancel" id="btn-cancel">RESCAN</button>' +
                 '</div>' +
                 '<div class="confirm-hint">← → SELECT &nbsp; SPACE CONFIRM</div>';
    qrSection.appendChild(confirmPanel);

    // Divider
    var divider = document.createElement('div');
    divider.className = 'entry-divider';
    divider.innerHTML = '<span>OR</span>';

    // Right side: Manual input
    var inputSection = document.createElement('div');
    inputSection.className = 'input-section';

    var inputLabel = document.createElement('div');
    inputLabel.className = 'section-label';
    inputLabel.textContent = 'TYPE NAME';

    input = document.createElement('input');
    input.className = 'input-name';
    input.maxLength = 10;
    input.placeholder = 'YOUR NAME';

    inputSection.appendChild(inputLabel);
    inputSection.appendChild(input);

    entryRow.appendChild(qrSection);
    entryRow.appendChild(divider);
    entryRow.appendChild(inputSection);

    // Score breakdown section
    var breakdownSection = document.createElement('div');
    breakdownSection.className = 'score-breakdown';
    breakdownSection.id = 'score-breakdown';
    breakdownSection.innerHTML = '<div class="breakdown-title">SCORE BREAKDOWN</div><div class="breakdown-content" id="breakdown-content"></div>';

    submitBtn = document.createElement('div');
    submitBtn.className = 'prompt-pill submit-btn';
    submitBtn.textContent = 'SAVE SCORE';
    submitBtn.style.cursor = 'pointer';

    hint = document.createElement('div');
    hint.className = 'prompt-pill';
    hint.style.marginTop = '10px';
    hint.textContent = 'PRESS START TO INITIALIZE';
    hint.style.display = 'none';

    panel.appendChild(title);
    panel.appendChild(breakdownSection);
    panel.appendChild(entryRow);
    panel.appendChild(submitBtn);
    panel.appendChild(hint);
    overlay.appendChild(panel);
    (container || document.body).appendChild(overlay);

    // Guard against any accidental navigation (e.g. implicit form submission)
    overlay.addEventListener('submit', function(e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      return false;
    }, true);

    submitBtn.addEventListener('click', function(e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      finalizeName();
      return false;
    });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        finalizeName();
        return false;
      }
    });

    // Get button references after DOM is ready
    setTimeout(function() {
      btnOk = document.getElementById('btn-ok');
      btnCancel = document.getElementById('btn-cancel');
      
      if (btnOk) {
        btnOk.addEventListener('click', function(e) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          confirmOk();
          return false;
        });
      }
      if (btnCancel) {
        btnCancel.addEventListener('click', function(e) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          confirmCancel();
          return false;
        });
      }
    }, 0);
  }

  function updateButtonSelection() {
    if (!btnOk || !btnCancel) return;
    if (selectedButton === 0) {
      btnOk.classList.add('selected');
      btnCancel.classList.remove('selected');
    } else {
      btnOk.classList.remove('selected');
      btnCancel.classList.add('selected');
    }
  }

  function handleKeyDown(e) {
    if (!awaitingConfirm) return;
    
    // Arrow keys or A/D for selection
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      selectedButton = 0;
      updateButtonSelection();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      selectedButton = 1;
      updateButtonSelection();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (selectedButton === 0) {
        confirmOk();
      } else {
        confirmCancel();
      }
    }
  }

  function confirmOk() {
    if (!awaitingConfirm) return;
    awaitingConfirm = false;
    removeKeyHandler();
    confirmPanel.classList.add('hidden');
    // Name is already in input, just flash and let user save
    input.classList.add('flash');
    setTimeout(function() { input.classList.remove('flash'); }, 500);
  }

  function confirmCancel() {
    if (!awaitingConfirm) return;
    awaitingConfirm = false;
    removeKeyHandler();
    confirmPanel.classList.add('hidden');
    input.value = '';
    qrStatus.textContent = 'SCANNING...';
    qrStatus.classList.remove('success');
    scanLine.style.display = 'block';
    // Restart scanning
    startScanning();
  }

  function updateBreakdown(totalScore, position) {
    var content = document.getElementById('breakdown-content');
    if (!content) return;
    
    var stats = (window.Game && Game.stats) ? Game.stats : {};
    
    // Build rows data array for sequential animation
    var rows = [];
    
    function badgeIconHtml(icon) {
      if (!icon) return '';
      if (icon.indexOf('.png') === -1) return icon;
      return '<img class="breakdown-badge-icon" src="' + icon + '" alt="Achievement" />';
    }
    
    // Total score (simple, no rank badge inside)
    rows.push({
      type: 'total',
      label: 'TOTAL SCORE',
      value: formatNumber(totalScore)
    });
    
    // Waves completed
    rows.push({
      type: 'stat',
      label: 'WAVES',
      value: stats.wavesCompleted || 0
    });
    
    // Asteroids destroyed (just count, no score)
    rows.push({
      type: 'stat',
      label: 'ASTEROIDS',
      value: stats.asteroidsDestroyed || 0
    });
    
    // Fragments collected
    rows.push({
      type: 'stat',
      label: 'FRAGMENTS',
      value: stats.fragmentsCollected || 0
    });

    // Achievement badge (icon + name on its own row)
    if (stats.fragmentAchievementIcon || stats.fragmentAchievementName) {
      var badgeName = stats.fragmentAchievementName || 'ACHIEVEMENT';
      var badgeIcon = stats.fragmentAchievementIcon || '';
      rows.push({
        type: 'badge',
        icon: badgeIcon,
        name: badgeName
      });
    }
    
    // Clear and render with sequential animations
    content.innerHTML = '';
    
    // Create all elements first but hidden
    var elements = rows.map(function(row, index) {
      var div = document.createElement('div');
      div.className = 'breakdown-row breakdown-row--' + row.type + ' breakdown-row--hidden';
      
      if (row.type === 'total') {
        div.innerHTML = 
          '<span class="breakdown-label">' + row.label + '</span>' +
          '<span class="breakdown-value breakdown-value--total"><span class="value-counter" data-target="' + totalScore + '">0</span></span>';
      } else if (row.type === 'badge') {
        div.innerHTML = 
          '<span class="breakdown-badge-row">' +
            (row.icon ? '<img class="breakdown-badge-icon" src="' + row.icon + '" alt="Badge" />' : '') +
            '<span class="breakdown-badge-name">' + row.name + '</span>' +
          '</span>';
      } else {
        div.innerHTML = 
          '<span class="breakdown-label">' + row.label + '</span>' +
          '<span class="breakdown-value">' + row.value + '</span>';
      }
      
      content.appendChild(div);
      return { element: div, row: row, index: index };
    });
    
    // Animate each row sequentially with sound tick
    function revealRow(idx) {
      if (idx >= elements.length) return;
      
      var item = elements[idx];
      item.element.classList.remove('breakdown-row--hidden');
      item.element.classList.add('breakdown-row--reveal');
      
      // Play tick sound for each reveal
      if (window.SFX && SFX.play) {
        SFX.play('tick');
      }
      
      // For total row, animate the counter
      if (item.row.type === 'total') {
        var counter = item.element.querySelector('.value-counter');
        if (counter) {
          animateCounter(counter, 0, parseInt(counter.dataset.target), 600);
        }
      }
      
      // Schedule next row
      setTimeout(function() {
        revealRow(idx + 1);
      }, 150);
    }
    
    // Start reveal sequence after a brief delay
    setTimeout(function() {
      revealRow(0);
    }, 200);
  }
  
  // Animate counter from start to end
  function animateCounter(element, start, end, duration) {
    var startTime = null;
    var diff = end - start;
    
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Easing: ease-out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(start + diff * eased);
      element.textContent = formatNumber(current);
      
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    
    requestAnimationFrame(step);
  }
  
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function addKeyHandler() {
    if (keyHandler) return;
    keyHandler = handleKeyDown;
    document.addEventListener('keydown', keyHandler);
  }

  function removeKeyHandler() {
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
  }

  function startScanning() {
    if (isScanning) return;
    
    // Load html5-qrcode if not loaded
    if (typeof Html5Qrcode === 'undefined') {
      qrStatus.textContent = 'LOADING...';
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.onload = function() { initScanner(); };
      script.onerror = function() { qrStatus.textContent = 'SCANNER ERROR'; };
      document.head.appendChild(script);
    } else {
      initScanner();
    }
  }

  function initScanner() {
    if (scanner) {
      try { scanner.stop(); } catch (e) {}
    }

    scanner = new Html5Qrcode('qr-inline-preview');
    isScanning = true;
    scanLine.style.display = 'block';

    var config = { fps: 10, qrbox: { width: 100, height: 100 }, aspectRatio: 1.0 };

    qrStatus.textContent = 'STARTING CAMERA...';

    scanner.start(
      { facingMode: 'environment' },
      config,
      onScanSuccess,
      function() {}
    ).then(function() {
      qrStatus.textContent = 'SCANNING...';
      try { localStorage.setItem('qr_camera_permission', 'granted'); } catch(e) {}
    }).catch(function(err) {
      // Try front camera
      scanner.start({ facingMode: 'user' }, config, onScanSuccess, function() {})
        .then(function() {
          qrStatus.textContent = 'SCANNING...';
          try { localStorage.setItem('qr_camera_permission', 'granted'); } catch(e) {}
        })
        .catch(function(err2) {
          qrStatus.textContent = 'NO CAMERA';
          isScanning = false;
        });
    });
  }

  function onScanSuccess(decodedText) {
    scanLine.style.display = 'none';
    isScanning = false;

    var parsed = QRParser.parse(decodedText);
    var displayName = QRParser.getDisplayName(parsed, 10);

    input.value = displayName;
    qrStatus.textContent = '✓ DETECTED';
    qrStatus.classList.add('success');

    // Play sound if available
    if (window.SFX && SFX.playPowerUp) SFX.playPowerUp();

    // Stop scanner
    if (scanner) { try { scanner.stop(); } catch (e) {} }

    // Show confirmation panel
    var confirmName = document.getElementById('confirm-name');
    if (confirmName) confirmName.textContent = displayName;
    selectedButton = 0;
    updateButtonSelection();
    confirmPanel.classList.remove('hidden');
    awaitingConfirm = true;
    addKeyHandler();

    // Flash the input
    input.classList.add('flash');
    setTimeout(function() { input.classList.remove('flash'); }, 500);
  }

  function stopScanning() {
    isScanning = false;
    if (scanner) {
      try { scanner.stop(); } catch (e) {}
    }
  }

  function start(score) {
    scoreValue = score || 0;
    awaitingRestart = false;
    awaitingConfirm = false;
    if (autoReturnTimer) {
      clearTimeout(autoReturnTimer);
      autoReturnTimer = null;
    }
    overlay.classList.remove('hidden');
    panel.style.opacity = '1';
    hint.style.display = 'none';
    input.value = '';
    qrStatus.textContent = 'SCANNING...';
    qrStatus.classList.remove('success');
    scanLine.style.display = 'block';
    confirmPanel.classList.add('hidden');
    removeKeyHandler();

    // Check for high score
    var isHighScore = window.Scoreboard && Scoreboard.isHighScore(scoreValue);
    var position = window.Scoreboard ? Scoreboard.getPositionForScore(scoreValue) : 1;
    
    // Build title based on high score status
    var titleText = isHighScore ? 'NEW HIGH SCORE!' : 'CAPACITY REACHED';
    
    Animations.staggerLetters(title, titleText, { duration: 520 });
    
    // Show high score celebration or regular title
    if (isHighScore) {
      title.style.color = '#FFBC42';
      title.classList.add('high-score-glow');
    } else {
      title.style.color = '';
      title.classList.remove('high-score-glow');
    }
    
    // Update breakdown display
    updateBreakdown(scoreValue, position);
    
    Animations.fadeIn(panel, { duration: 420 });

    // Start QR scanning automatically
    setTimeout(function() {
      startScanning();
    }, 500);
  }

  function finalizeName() {
    if (awaitingRestart) return;
    stopScanning();
    var name = (input.value || '').trim().toUpperCase();
    if (!name) name = 'ACE';

    function computePostGameTotalDelayMs(rank) {
      // Scoreboard.show(true) does:
      // - render around player immediately
      // - wait 2000ms
      // - scroll to top over duration = 3000 + (viewStart * 60)
      // Then we want to show the top 10 for ~5s before returning to idle.
      var revealMs = 0;
      if (typeof rank === 'number' && rank > 10) {
        var playerPos = rank - 1;
        var viewStart = playerPos - 5;
        if (viewStart < 0) viewStart = 0;
        if (viewStart > 90) viewStart = 90;
        var scrollMs = 3000 + (viewStart * 60);
        revealMs = 2000 + scrollMs;
      }
      // showScoreboardPostGameOver triggers Scoreboard.show(true) after ~380ms.
      return 380 + revealMs + 5000 + 250;
    }

    function scheduleAutoReturnToIdle(rank) {
      if (autoReturnTimer) {
        clearTimeout(autoReturnTimer);
        autoReturnTimer = null;
      }
      var totalDelay = computePostGameTotalDelayMs(rank);
      autoReturnTimer = setTimeout(function() {
        try {
          // Ensure we don't instantly start a new game due to a held SPACE.
          if (window.KEY_STATUS) {
            KEY_STATUS.space = false;
          }
          window.gameStart = false;

          if (window.Scoreboard) {
            if (typeof Scoreboard.hide === 'function') {
              Scoreboard.hide(true);
            }
            if (typeof Scoreboard.setSuppressed === 'function') {
              Scoreboard.setSuppressed(false);
            }
          }

          // Return to idle flow (boot -> waiting) without requiring a key press.
          if (window.Game && Game.FSM) {
            Game.FSM.timer = null;
            Game.skipWaiting = false;
            if (window.IntroManager && typeof IntroManager.reset === 'function') {
              IntroManager.reset();
            }
            Game.FSM._startRequested = false;
            Game.FSM._restartArmed = false;
            Game.FSM.state = 'boot';
          } else if (window.GameFSM) {
            GameFSM.timer = null;
            if (window.IntroManager && typeof IntroManager.reset === 'function') {
              IntroManager.reset();
            }
            GameFSM._startRequested = false;
            GameFSM._restartArmed = false;
            GameFSM.state = 'boot';
          }
        } catch (e) {
          console.warn('[GameOver] Auto-return to idle failed:', e);
        }
      }, totalDelay);
    }

    // If the page reloads right after submit (e.g. Live Server reload on scores.json write),
    // persist enough info to resume the post-game scoreboard reveal on next load.
    try {
      sessionStorage.setItem('vasteroids.pendingReveal', JSON.stringify({
        name: name.substring(0, 10),
        score: scoreValue,
        at: Date.now()
      }));
    } catch (e) {}
    
    // Show loading state
    submitBtn.textContent = 'SAVING...';
    submitBtn.style.pointerEvents = 'none';
    
    function showScoreboardPostGameOver() {
      // Ensure nothing is suppressing the scoreboard.
      if (window.Scoreboard && typeof Scoreboard.setSuppressed === 'function') {
        Scoreboard.setSuppressed(false);
      }
      if (window.Scoreboard && typeof Scoreboard.stopAutoShow === 'function') {
        Scoreboard.stopAutoShow();
      }
      if (window.Scoreboard && typeof Scoreboard.allowAnimatedShowOnce === 'function') {
        Scoreboard.allowAnimatedShowOnce();
      }

      // Prevent a held SPACE from immediately restarting and skipping the scoreboard.
      if (window.KEY_STATUS) {
        KEY_STATUS.space = false;
      }
      window.gameStart = false;

      // Hide the game-over panel first so the scoreboard is visible for the full reveal.
      setTimeout(function() {
        try {
          if (window.Scoreboard && typeof Scoreboard.ensureInit === 'function') {
            Scoreboard.ensureInit(document.getElementById('game-container'));
          }
          Scoreboard.show(true);
        } catch (e) {
          console.warn('[GameOver] Failed to show scoreboard:', e);
        }

        // If something else hid it immediately, retry once.
        setTimeout(function() {
          try {
            if (window.Scoreboard && typeof Scoreboard.isVisible === 'function' && !Scoreboard.isVisible()) {
              if (window.Scoreboard && typeof Scoreboard.allowAnimatedShowOnce === 'function') {
                Scoreboard.allowAnimatedShowOnce();
              }
              Scoreboard.show(true);
            }
          } catch (e) {}
        }, 180);
      }, 380);
    }

    // Submit score (async, handles server + fallback). Wrap to catch sync failures too.
    Promise.resolve().then(function() {
      var achievementIcon = null;
      if (window.Game && Game.stats && Game.stats.fragmentAchievementIcon) {
        achievementIcon = Game.stats.fragmentAchievementIcon;
      }
      return Scoreboard.addEntry(name.substring(0, 10), scoreValue, {
        achievementIcon: achievementIcon
      });
    }).then(function(result) {
      console.log('[GameOver] Score submitted:', result);

      try { sessionStorage.removeItem('vasteroids.pendingReveal'); } catch (e) {}

      showScoreboardPostGameOver();
      hint.textContent = 'RETURNING TO IDLE...';
      hint.style.display = 'inline-block';
      awaitingRestart = true;
      scheduleAutoReturnToIdle(result && typeof result.rank === 'number' ? result.rank : null);
      try { input.blur(); } catch (e) {}
      Animations.fadeOut(panel, { duration: 320 });
      setTimeout(function() {
        overlay.classList.add('hidden');
        submitBtn.textContent = 'SAVE SCORE';
        submitBtn.style.pointerEvents = '';
      }, 340);
    }).catch(function(err) {
      console.error('[GameOver] Error submitting score:', err);

      try { sessionStorage.removeItem('vasteroids.pendingReveal'); } catch (e) {}

      // Still show scoreboard even if server failed
      showScoreboardPostGameOver();
      hint.textContent = 'RETURNING TO IDLE...';
      hint.style.display = 'inline-block';
      awaitingRestart = true;
      // Best-effort: approximate rank from current scoreboard snapshot.
      scheduleAutoReturnToIdle(window.Scoreboard ? Scoreboard.getPositionForScore(scoreValue) : null);
      Animations.fadeOut(panel, { duration: 320 });
      setTimeout(function() {
        overlay.classList.add('hidden');
        submitBtn.textContent = 'SAVE SCORE';
        submitBtn.style.pointerEvents = '';
      }, 340);
    });
  }

  function readyForRestart() {
    return awaitingRestart;
  }

  function hide() {
    stopScanning();
    removeKeyHandler();
    awaitingConfirm = false;
    if (autoReturnTimer) {
      clearTimeout(autoReturnTimer);
      autoReturnTimer = null;
    }
    overlay.classList.add('hidden');
    Scoreboard.hide();
    awaitingRestart = false;
  }

  return {
    init: init,
    start: start,
    readyForRestart: readyForRestart,
    hide: hide
  };
})();
