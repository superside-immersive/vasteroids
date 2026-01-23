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
      maxLen = maxLen || 8;
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
                             '<button class="confirm-btn confirm-ok selected" id="btn-ok">OK</button>' +
                             '<button class="confirm-btn confirm-cancel" id="btn-cancel">RESCAN</button>' +
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
    input.maxLength = 8;
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

    submitBtn.addEventListener('click', finalizeName);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') finalizeName();
    });

    // Get button references after DOM is ready
    setTimeout(function() {
      btnOk = document.getElementById('btn-ok');
      btnCancel = document.getElementById('btn-cancel');
      
      if (btnOk) {
        btnOk.addEventListener('click', confirmOk);
      }
      if (btnCancel) {
        btnCancel.addEventListener('click', confirmCancel);
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
    var html = '';
    
    // Total score with position
    html += '<div class="breakdown-row total-row">';
    html += '<span class="breakdown-label">TOTAL SCORE</span>';
    html += '<span class="breakdown-value">' + formatNumber(totalScore) + '</span>';
    html += '</div>';
    
    // Position indicator
    html += '<div class="breakdown-row position-row">';
    html += '<span class="breakdown-label">RANK</span>';
    html += '<span class="breakdown-value rank-' + (position <= 3 ? position : 'other') + '">#' + position + '</span>';
    html += '</div>';
    
    html += '<div class="breakdown-divider"></div>';
    
    // Waves completed
    html += '<div class="breakdown-row">';
    html += '<span class="breakdown-label">WAVES COMPLETED</span>';
    html += '<span class="breakdown-value">' + (stats.wavesCompleted || 0) + '</span>';
    html += '</div>';
    
    // Asteroids destroyed
    if (stats.asteroidsDestroyed) {
      html += '<div class="breakdown-row">';
      html += '<span class="breakdown-label">ASTEROIDS (' + stats.asteroidsDestroyed + ')</span>';
      html += '<span class="breakdown-value">+' + formatNumber(stats.asteroidsScore || 0) + '</span>';
      html += '</div>';
    }
    
    // Silos destroyed
    if (stats.silosDestroyed) {
      html += '<div class="breakdown-row">';
      html += '<span class="breakdown-label">LATENCY DRONES (' + stats.silosDestroyed + ')</span>';
      html += '<span class="breakdown-value">+' + formatNumber(stats.silosScore || 0) + '</span>';
      html += '</div>';
    }
    
    // Similarity bonus
    if (stats.similarityBonus) {
      html += '<div class="breakdown-row bonus-row">';
      html += '<span class="breakdown-label">SIMILARITY BONUS</span>';
      html += '<span class="breakdown-value">+' + formatNumber(stats.similarityBonus) + '</span>';
      html += '</div>';
    }
    
    html += '<div class="breakdown-divider"></div>';
    
    // Items collected
    html += '<div class="breakdown-row">';
    html += '<span class="breakdown-label">FRAGMENTS COLLECTED</span>';
    html += '<span class="breakdown-value">' + (stats.fragmentsCollected || 0) + '</span>';
    html += '</div>';
    
    // DASE activations
    if (stats.daseActivations) {
      html += '<div class="breakdown-row">';
      html += '<span class="breakdown-label">DASE ACTIVATIONS</span>';
      html += '<span class="breakdown-value">' + stats.daseActivations + '</span>';
      html += '</div>';
    }
    
    // Hyperspace used
    if (stats.hyperspaceUsed) {
      html += '<div class="breakdown-row">';
      html += '<span class="breakdown-label">HYPERSPACE JUMPS</span>';
      html += '<span class="breakdown-value">' + stats.hyperspaceUsed + '</span>';
      html += '</div>';
    }
    
    content.innerHTML = html;
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
    var displayName = QRParser.getDisplayName(parsed, 8);

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
    Scoreboard.addEntry(name.substring(0, 8), scoreValue);
    // Show scoreboard with animation (true = animate from player position to top)
    Scoreboard.show(true);
    hint.style.display = 'inline-block';
    awaitingRestart = true;
    try { input.blur(); } catch (e) {}
    Animations.fadeOut(panel, { duration: 320 });
    setTimeout(function() {
      overlay.classList.add('hidden');
    }, 340);
  }

  function readyForRestart() {
    return awaitingRestart;
  }

  function hide() {
    stopScanning();
    removeKeyHandler();
    awaitingConfirm = false;
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
