/* Session-only scoreboard storage and rendering - Animated scroll through 100 entries */

var Scoreboard = (function() {
  var scores = [];
  var overlay = null;
  var panel = null;
  var tableBody = null;
  var prompt = null;
  var lastAddedId = null;
  var scrollTimeline = null;
  var autoShowInterval = null;
  var currentViewStart = 0;
  var VISIBLE_ROWS = 10;

  var placeholderNames = [
    'ACE', 'BLAZE', 'VIPER', 'HAWK', 'NOVA', 'STORM', 'RAVEN', 'GHOST',
    'TITAN', 'FLARE', 'ORION', 'STAR', 'VOLT', 'PULSE', 'SURGE', 'DASH',
    'FROST', 'FLAME', 'SHADE', 'SPARK', 'ECHO', 'WOLF', 'EAGLE', 'COBRA',
    'RAZOR', 'BLITZ', 'PRISM', 'NEXUS', 'PYRO', 'BOLT', 'DRIFT', 'FURY',
    'ZERO', 'LUNA', 'OMEGA', 'ALPHA', 'DELTA', 'SIGMA', 'GAMMA', 'APEX',
    'QUARK', 'ION', 'PLASMA', 'PHOTON', 'COMET', 'ASTER', 'SHOCK', 'RIFT',
    'EMBER', 'CINDER', 'BLADE', 'MIRAGE', 'NANO', 'VAPOR', 'STRIKE', 'VECTOR',
    'PHASE', 'CIRRUS', 'STRATA', 'THORN', 'CRUX', 'HALO', 'ONYX', 'XENO',
    'SABLE', 'MARS', 'JUPITER', 'SATURN', 'NEPTUNE', 'PLUTO', 'VENUS', 'MERCURY',
    'METEOR', 'COSMIC', 'NEBULA', 'GALAXY', 'QUASAR', 'PULSAR', 'DARK', 'LIGHT',
    'SHADOW', 'BRIGHT', 'THUNDER', 'LIGHTNING', 'STORM2', 'CYCLONE', 'TORNADO', 'WIND',
    'FIRE', 'ICE', 'EARTH', 'WATER', 'METAL', 'WOOD', 'ROCK', 'SAND',
    'CRYSTAL', 'DIAMOND', 'RUBY', 'JADE'
  ];

  function generatePlaceholders() {
    if (scores.length > 0) return;
    for (var i = 0; i < 100; i++) {
      scores.push({
        id: 'placeholder-' + i,
        name: placeholderNames[i % placeholderNames.length],
        score: 150000 - (i * 1200) - Math.floor(Math.random() * 2000)
      });
    }
  }

  function init(container) {
    generatePlaceholders();
    overlay = document.createElement('div');
    overlay.className = 'ui-overlay interactive hidden';

    panel = document.createElement('div');
    panel.className = 'ui-panel scoreboard-panel';

    var title = document.createElement('div');
    title.className = 'text-glow';
    title.style.fontSize = '22px';
    title.style.marginBottom = '10px';
    title.textContent = 'SCOREBOARD';

    var table = document.createElement('table');
    table.className = 'scoreboard-table';
    var thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>#</th><th>NAME</th><th>SCORE</th></tr>';
    tableBody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tableBody);

    prompt = document.createElement('div');
    prompt.className = 'prompt-pill';
    prompt.style.marginTop = '10px';
    prompt.textContent = 'PRESS START TO INITIALIZE';

    panel.appendChild(title);
    panel.appendChild(table);
    panel.appendChild(prompt);
    overlay.appendChild(panel);
    (container || document.body).appendChild(overlay);
  }

  function isReady() {
    return !!overlay;
  }

  function ensureInit(container) {
    generatePlaceholders();
    if (!overlay) {
      init(container);
    }
  }

  function addEntry(name, score) {
    var entry = { id: Date.now() + Math.random(), name: name || 'ACE', score: score || 0 };
    scores.push(entry);
    scores.sort(function(a, b) { return b.score - a.score; });
    scores = scores.slice(0, 100);
    lastAddedId = entry.id;
  }

  // Render 10 rows starting from startIdx
  function render(startIdx) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    startIdx = Math.max(0, Math.min(startIdx, scores.length - VISIBLE_ROWS));
    currentViewStart = startIdx;
    
    for (var i = startIdx; i < startIdx + VISIBLE_ROWS && i < scores.length; i++) {
      var row = document.createElement('tr');
      if (scores[i].id === lastAddedId) {
        row.className = 'highlight';
      }
      var rank = document.createElement('td');
      rank.textContent = i + 1;
      var nameCell = document.createElement('td');
      nameCell.textContent = scores[i].name;
      var scoreCell = document.createElement('td');
      scoreCell.textContent = scores[i].score;
      row.appendChild(rank);
      row.appendChild(nameCell);
      row.appendChild(scoreCell);
      tableBody.appendChild(row);
    }
  }

  // Elegant animated scroll from startIdx to endIdx
  function animateScroll(fromIdx, toIdx, duration) {
    if (scrollTimeline) {
      try { scrollTimeline.pause(); } catch(e) {}
    }
    
    var scrollState = { position: fromIdx };
    var safeTo = Math.max(0, Math.min(toIdx, scores.length - VISIBLE_ROWS));
    var safeFrom = Math.max(0, Math.min(fromIdx, scores.length - VISIBLE_ROWS));
    
    scrollTimeline = anime({
      targets: scrollState,
      position: [safeFrom, safeTo],
      duration: duration || 5000,
      easing: 'easeInOutCubic',
      update: function() {
        var idx = Math.round(scrollState.position);
        if (idx !== currentViewStart) {
          render(idx);
        }
      },
      complete: function() {
        render(safeTo);
      }
    });
    
    return scrollTimeline;
  }

  function show(withAnimation) {
    generatePlaceholders();
    if (!overlay) {
      ensureInit(document.getElementById('game-container'));
    }
    if (!overlay) return;

    // Stop any existing animation
    if (scrollTimeline) {
      try { scrollTimeline.pause(); } catch(e) {}
      scrollTimeline = null;
    }
    if (window.anime) {
      try { anime.remove(prompt); } catch(e) {}
    }
    
    overlay.classList.remove('hidden');
    
    // Find player's position if they just entered
    var playerPosition = -1;
    if (lastAddedId) {
      for (var i = 0; i < scores.length; i++) {
        if (scores[i].id === lastAddedId) {
          playerPosition = i;
          break;
        }
      }
    }
    
    console.log('[Scoreboard] Player position:', playerPosition, 'withAnimation:', withAnimation);
    
    // Calculate where to show the player (centered in the 10-row window)
    var playerViewStart = Math.max(0, Math.min(playerPosition - 4, scores.length - VISIBLE_ROWS));
    
    if (playerPosition >= 0 && withAnimation && window.anime) {
      if (playerPosition > 9) {
        // Player is outside top 10 - show their position first, then scroll to top
        console.log('[Scoreboard] Starting at position', playerViewStart, 'then animating to top');
        render(playerViewStart);
        setTimeout(function() {
          // Animate from player position to top 10
          var duration = 3000 + (playerViewStart * 60); // Longer for farther positions
          console.log('[Scoreboard] Starting scroll animation, duration:', duration);
          animateScroll(playerViewStart, 0, duration);
        }, 2000); // Wait 2 seconds to show player their position
      } else {
        // Player is in top 10 - just show top 10
        console.log('[Scoreboard] Player in top 10, showing top');
        render(0);
      }
    } else if (withAnimation && window.anime) {
      // Attract mode - start from bottom and scroll up elegantly
      console.log('[Scoreboard] Attract mode - scrolling from bottom');
      render(90);
      setTimeout(function() {
        animateScroll(90, 0, 8000);
      }, 500);
    } else {
      console.log('[Scoreboard] No animation, showing top 10');
      render(0);
    }

    if (panel) {
      panel.style.opacity = '1';
    }
    if (window.anime && window.Animations) {
      Animations.fadeIn(panel, { duration: 480 });
      // Smooth pulse animation for the prompt
      Animations.pulse(prompt);
    }
  }

  function startAutoShow() {
    stopAutoShow();
    autoShowInterval = setInterval(function() {
      if (window.Game && window.Game.FSM && Game.FSM.state === 'waiting') {
        // Clear lastAddedId for attract mode display
        var savedId = lastAddedId;
        lastAddedId = null;
        show(true);
        setTimeout(function() {
          lastAddedId = savedId;
          hide();
        }, 5000); // Show for 5s per flowchart spec
      }
    }, 10000); // Show every 10s per flowchart spec
  }

  function stopAutoShow() {
    if (autoShowInterval) {
      clearInterval(autoShowInterval);
      autoShowInterval = null;
    }
  }

  function hide() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    if (window.anime) anime.remove(prompt);
    if (scrollTimeline) {
      try { scrollTimeline.pause(); } catch(e) {}
    }
  }

  function getLastEntryId() { return lastAddedId; }

  // Check if a score would be a new high score (top 1)
  function isHighScore(score) {
    if (scores.length === 0) return true;
    return score > scores[0].score;
  }

  // Check what position a score would get
  function getPositionForScore(score) {
    for (var i = 0; i < scores.length; i++) {
      if (score > scores[i].score) {
        return i + 1;
      }
    }
    return scores.length + 1;
  }

  return {
    init: init,
    ensureInit: ensureInit,
    isReady: isReady,
    addEntry: addEntry,
    show: show,
    hide: hide,
    render: render,
    startAutoShow: startAutoShow,
    stopAutoShow: stopAutoShow,
    getLastEntryId: getLastEntryId,
    isHighScore: isHighScore,
    getPositionForScore: getPositionForScore
  };
})();
