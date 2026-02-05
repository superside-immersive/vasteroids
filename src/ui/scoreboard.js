/* Global scoreboard with server sync and WebSocket real-time updates */

var Scoreboard = (function() {
  var scores = [];
  var overlay = null;
  var panel = null;
  var tableBody = null;
  var prompt = null;
  var lastAddedId = null;
  var lastAddedPosition = null; // 0-based index within `scores`
  var scrollTimeline = null;
  var autoShowInterval = null;
  var autoShowFirstTimeout = null;
  var autoShowHideTimeout = null;
  var autoShowCycleTimeout = null;
  var autoShowSavedId = null;
  var autoShowSavedPos = null;
  var autoShowVisible = false;
  var autoShowActive = false;
  var autoShowNextAt = 0;
  var autoShowTimer = null;
  var suppressShow = false;
  var allowAnimatedShow = false;
  var currentViewStart = 0;
  var VISIBLE_ROWS = 10;

  // Persist chosen server URL so GH Pages users don't need to keep ?server=...
  var SERVER_URL_STORAGE_KEY = 'vasteroids.serverUrl.v1';

  // Server configuration
  function normalizeBaseUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  function isLocalhostHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  function isLocalBaseUrl(url) {
    try {
      var u = new URL(url);
      return isLocalhostHost(u.hostname);
    } catch (e) {
      return false;
    }
  }

  function loadRememberedServerUrl() {
    try {
      var raw = localStorage.getItem(SERVER_URL_STORAGE_KEY);
      if (!raw) return null;
      var normalized = normalizeBaseUrl(raw);
      if (!normalized) return null;
      // Don't reuse a localhost URL when we're on a non-localhost page.
      try {
        var pageHost = (window.location && window.location.hostname) ? window.location.hostname : '';
        if (!isLocalhostHost(pageHost) && isLocalBaseUrl(normalized)) return null;
      } catch (e) {}
      return normalized;
    } catch (e) {
      return null;
    }
  }

  function rememberServerUrl(url) {
    try { localStorage.setItem(SERVER_URL_STORAGE_KEY, normalizeBaseUrl(url)); } catch (e) {}
  }

  function resolveServerUrl() {
    try {
      var qs = new URLSearchParams(window.location.search || '');
      var fromQs = qs.get('server');
      if (fromQs) return normalizeBaseUrl(fromQs);
    } catch (e) {}

    try {
      if (window.VASTEROIDS_SERVER_URL) {
        return normalizeBaseUrl(window.VASTEROIDS_SERVER_URL);
      }
    } catch (e) {}

    var remembered = loadRememberedServerUrl();
    if (remembered) return remembered;

    // Sensible defaults by environment:
    // - Local dev: localhost
    // - Render: if this page is served from the same service, same-origin works.
    // - GitHub Pages / other static hosting: default to the canonical Render service name.
    try {
      var hostname = (window.location && window.location.hostname) ? window.location.hostname : '';
      if (isLocalhostHost(hostname)) return 'http://localhost:3000';
      if (hostname && hostname.indexOf('onrender.com') !== -1) return normalizeBaseUrl(window.location.origin);
    } catch (e) {}

    return 'https://vasteroids-scoreboard.onrender.com';
  }

  function resolveWsUrl(serverUrl) {
    try {
      var u = new URL(serverUrl);
      u.protocol = (u.protocol === 'https:') ? 'wss:' : 'ws:';
      // Ensure no trailing slash
      return u.toString().replace(/\/+$/, '');
    } catch (e) {
      return 'ws://localhost:3000';
    }
  }

  var SERVER_URL = resolveServerUrl();
  var WS_URL = resolveWsUrl(SERVER_URL);
  var ws = null;
  var serverAvailable = false;
  var reconnectTimeout = null;
  var hasServerSnapshot = false;

  // Offline-first: placeholders per session + last-known server snapshot across reloads
  var SESSION_PLACEHOLDERS_KEY = 'vasteroids.sessionPlaceholders.v1';
  var LAST_SERVER_SCORES_KEY = 'vasteroids.lastServerScores.v1';
  var PENDING_SUBMISSIONS_KEY = 'vasteroids.pendingSubmissions.v1';
  var flushInFlight = false;

  // When we show the game-over rank and scroll to top, ignore live re-renders that would
  // snap the view back to top 10 mid-animation.
  var liveUpdateHoldUntil = 0;

  // If the page reloads right after submitting a score (common with Live Server watching
  // server/scores.json), we persist a small hint in sessionStorage and resume the
  // rank->top reveal once on next load.
  var PENDING_REVEAL_KEY = 'vasteroids.pendingReveal';
  var PENDING_REVEAL_TTL_MS = 20000;
  var pendingRevealConsumed = false;

  // Retry/backoff to avoid jitter when server isn't running (e.g. Live Preview)
  var fetchInFlight = null;
  var lastFetchAttemptAt = 0;
  var FETCH_RETRY_MS = 20000;

  function safeFetch(url, options) {
    try {
      return fetch(url, options);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function loadLastServerScores() {
    try {
      var raw = localStorage.getItem(LAST_SERVER_SCORES_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.scores || !parsed.scores.length) return null;
      return parsed.scores;
    } catch (e) {
      return null;
    }
  }

  function persistLastServerScores(nextScores) {
    try {
      localStorage.setItem(LAST_SERVER_SCORES_KEY, JSON.stringify({
        at: Date.now(),
        scores: (nextScores || []).slice(0, 100)
      }));
    } catch (e) {}
  }

  function clearSessionPlaceholders() {
    try { sessionStorage.removeItem(SESSION_PLACEHOLDERS_KEY); } catch (e) {}
  }

  function ensureSessionPlaceholders() {
    try {
      var raw = sessionStorage.getItem(SESSION_PLACEHOLDERS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.scores && parsed.scores.length >= 100) {
          return parsed.scores.slice(0, 100);
        }
      }
    } catch (e) {}

    var namePool = [
      'NOVA', 'ACE', 'BLAZE', 'ORION', 'PULSE', 'DRIFT', 'KITE', 'ZEN', 'LUNA', 'VAST',
      'ECHO', 'BYTE', 'NEON', 'SOL', 'RIFT', 'STAR', 'VORTX', 'ION', 'FLUX', 'NIMBUS'
    ];

    var list = [];
    var score = 220000 + Math.floor(Math.random() * 40000);
    for (var i = 0; i < 100; i++) {
      var baseName = namePool[i % namePool.length];
      var suffix = (i >= namePool.length) ? String(i % 10) : '';
      var name = (baseName + suffix).substring(0, 10);

      var ratio = 0.86 + (Math.random() * 0.08);
      score = Math.max(250, Math.floor(score * ratio - (Math.random() * 1200)));
      if (i === 0) score = Math.max(score, 180000);
      if (i === 9) score = Math.min(score, 35000);

      list.push({
        id: 'ph-' + Date.now().toString(36) + '-' + i,
        name: name,
        score: score,
        placeholder: true,
        timestamp: new Date(Date.now() - (100 - i) * 60000).toISOString()
      });
    }
    list.sort(function(a, b) { return b.score - a.score; });
    list = list.slice(0, 100);
    try {
      sessionStorage.setItem(SESSION_PLACEHOLDERS_KEY, JSON.stringify({ at: Date.now(), scores: list }));
    } catch (e) {}
    return list;
  }

  function loadPendingSubmissions() {
    try {
      var raw = localStorage.getItem(PENDING_SUBMISSIONS_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.length) return [];
      return parsed;
    } catch (e) {
      return [];
    }
  }

  function savePendingSubmissions(list) {
    try {
      localStorage.setItem(PENDING_SUBMISSIONS_KEY, JSON.stringify(list || []));
    } catch (e) {}
  }

  function enqueueSubmission(payload) {
    var list = loadPendingSubmissions();
    list.push(payload);
    // Keep queue bounded
    if (list.length > 50) list = list.slice(list.length - 50);
    savePendingSubmissions(list);
  }

  function flushPendingSubmissions() {
    if (flushInFlight) return;
    flushInFlight = true;

    var list = loadPendingSubmissions();
    if (!list.length) {
      flushInFlight = false;
      return;
    }

    // Post sequentially; stop on first failure.
    var postOne = function() {
      if (!list.length) {
        savePendingSubmissions([]);
        flushInFlight = false;
        return;
      }
      var item = list[0];
      return safeFetch(SERVER_URL + '/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name, score: item.score, clientSubmissionId: item.clientSubmissionId })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.success) {
          list.shift();
          savePendingSubmissions(list);
          // Keep our local state fresh.
          if (data.scores) {
            scores = data.scores;
            hasServerSnapshot = true;
            serverAvailable = true;
            persistLastServerScores(scores);
            clearSessionPlaceholders();
          }
          return postOne();
        }
        throw new Error('Submit failed');
      })
      .catch(function() {
        // Keep remaining; retry later.
        savePendingSubmissions(list);
        flushInFlight = false;
      });
    };

    Promise.resolve().then(postOne);
  }

  function maybeFetchScores(force) {
    var now = Date.now();
    if (!force && (now - lastFetchAttemptAt) < FETCH_RETRY_MS) {
      return Promise.resolve(false);
    }
    if (fetchInFlight) {
      return fetchInFlight;
    }
    lastFetchAttemptAt = now;
    fetchInFlight = fetchScores().then(
      function() {
        fetchInFlight = null;
        return true;
      },
      function() {
        fetchInFlight = null;
        return false;
      }
    );
    return fetchInFlight;
  }

  // Fetch scores from server
  function fetchScores() {
    return safeFetch(SERVER_URL + '/api/scores')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        scores = data.scores || [];
        serverAvailable = true;
        hasServerSnapshot = true;
        rememberServerUrl(SERVER_URL);
        persistLastServerScores(scores);
        clearSessionPlaceholders();
        flushPendingSubmissions();
        // If we already have a lastAddedId, try to re-resolve its index after refresh.
        if (lastAddedId !== null && lastAddedId !== undefined) {
          lastAddedPosition = null;
          for (var i = 0; i < scores.length; i++) {
            if (scores[i].id == lastAddedId) {
              lastAddedPosition = i;
              break;
            }
          }
        }
        console.log('[Scoreboard] Loaded', scores.length, 'scores from server');
      })
      .catch(function(err) {
        console.warn('[Scoreboard] Server unavailable, using local fallback:', err.message);
        serverAvailable = false;
        // If we already have a server snapshot, keep it (do not revert to placeholders).
        if (hasServerSnapshot && scores && scores.length) {
          return;
        }
        // Try last-known server snapshot from previous run, otherwise session placeholders.
        if (!scores || scores.length === 0) {
          scores = loadLastServerScores() || ensureSessionPlaceholders();
        }
      });
  }

  // Submit score to server
  function submitScore(name, score, meta) {
    var clientSubmissionId = 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    var achievementIcon = meta && meta.achievementIcon ? meta.achievementIcon : null;
    var normalizedName = String(name || 'ACE')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 10);
    if (!normalizedName) normalizedName = 'ACE';
    var entry = { 
      id: Date.now() + Math.random(), 
      name: normalizedName, 
      score: score || 0,
      clientSubmissionId: clientSubmissionId,
      achievementIcon: achievementIcon
    };

    // Add locally first for immediate feedback
    scores.push(entry);
    scores.sort(function(a, b) { return b.score - a.score; });
    scores = scores.slice(0, 100);
    lastAddedId = entry.id;
    // Persist the index so game-over can still animate even if ID matching fails later.
    lastAddedPosition = null;
    for (var i = 0; i < scores.length; i++) {
      if (scores[i].id == entry.id) {
        lastAddedPosition = i;
        break;
      }
    }

    // Try to submit to server
    return safeFetch(SERVER_URL + '/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: entry.name, score: entry.score, clientSubmissionId: clientSubmissionId, achievementIcon: achievementIcon })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success && data.scores) {
        var serverRank = (typeof data.rank === 'number') ? data.rank : null;
        var keepLocalForReveal = serverRank && data.scores.length && serverRank > data.scores.length;
        if (!keepLocalForReveal) {
          scores = data.scores;
        }
        // Update lastAddedId to server-generated ID
        lastAddedId = data.entry.id;
        if (typeof data.rank === 'number') {
          lastAddedPosition = Math.max(0, data.rank - 1);
        }
        serverAvailable = true;
        hasServerSnapshot = true;
        persistLastServerScores(scores);
        clearSessionPlaceholders();
        flushPendingSubmissions();
        console.log('[Scoreboard] Score submitted, rank:', data.rank);
        return { success: true, rank: data.rank, entry: data.entry };
      }
      return { success: false, rank: getPositionForScore(score) };
    })
    .catch(function(err) {
      console.warn('[Scoreboard] Could not submit to server:', err.message);
      serverAvailable = false;
      enqueueSubmission({ name: entry.name, score: entry.score, clientSubmissionId: clientSubmissionId, at: Date.now() });
      return { success: false, rank: getPositionForScore(score) };
    });
  }

  // Connect to WebSocket for real-time updates
  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = function() {
        console.log('[Scoreboard] WebSocket connected');
        serverAvailable = true;
        flushPendingSubmissions();
      };

      ws.onmessage = function(event) {
        try {
          var data = JSON.parse(event.data);
          if (data.type === 'init' && data.scores) {
            scores = data.scores;
            hasServerSnapshot = true;
            persistLastServerScores(scores);
            clearSessionPlaceholders();
            flushPendingSubmissions();
            // Re-resolve lastAddedPosition after WS refresh.
            if (lastAddedId !== null && lastAddedId !== undefined) {
              lastAddedPosition = null;
              for (var i = 0; i < scores.length; i++) {
                if (scores[i].id == lastAddedId) {
                  lastAddedPosition = i;
                  break;
                }
              }
            }
            console.log('[Scoreboard] Received', scores.length, 'scores via WebSocket');
            if (overlay && !overlay.classList.contains('hidden')) {
              // Don't disrupt an in-progress scroll / game-over reveal.
              if (!scrollTimeline && Date.now() >= liveUpdateHoldUntil) {
                render(currentViewStart || 0);
              }
            }
          } else if (data.type === 'new_score' && data.scores) {
            // Don't overwrite if this is our own score we just submitted
            if (data.entry && data.entry.id !== lastAddedId) {
              scores = data.scores;
              hasServerSnapshot = true;
              persistLastServerScores(scores);
              clearSessionPlaceholders();
              console.log('[Scoreboard] New score received:', data.entry.name, data.entry.score);
              if (overlay && !overlay.classList.contains('hidden')) {
                if (!scrollTimeline && Date.now() >= liveUpdateHoldUntil) {
                  render(currentViewStart || 0);
                }
              }
            }
          }
        } catch (e) {
          console.warn('[Scoreboard] WebSocket message parse error:', e);
        }
      };

      ws.onclose = function() {
        var retryMs = serverAvailable ? 5000 : 20000;
        console.log('[Scoreboard] WebSocket disconnected, reconnecting in', (retryMs / 1000) + 's...');
        serverAvailable = false;
        reconnectTimeout = setTimeout(connectWebSocket, retryMs);
      };

      ws.onerror = function() {
        ws.close();
      };
    } catch (e) {
      console.warn('[Scoreboard] WebSocket connection failed:', e);
    }
  }

  function init(container) {
    // Seed initial state so the scoreboard always has something to show even offline.
    if (!scores || !scores.length) {
      scores = loadLastServerScores() || ensureSessionPlaceholders();
    }

    // Try to fetch from server, fall back to placeholders
    maybeFetchScores(true).then(function() {
      connectWebSocket();
    });

    overlay = document.createElement('div');
    overlay.className = 'ui-overlay interactive hidden';
    // Keep background transparent so stars/game show through
    overlay.style.backgroundColor = 'transparent';

    var shell = document.createElement('div');
    shell.className = 'ui-panel scoreboard-shell';

    panel = document.createElement('div');
    panel.className = 'scoreboard-panel';

    var title = document.createElement('div');
    title.className = 'scoreboard-title text-glow';
    title.textContent = 'SCOREBOARD';

    var table = document.createElement('table');
    table.className = 'scoreboard-table';
    var thead = document.createElement('thead');
    thead.innerHTML = '<tr><th class="col-rank">#</th><th class="col-badge"></th><th class="col-name">NAME</th><th class="col-score">SCORE</th></tr>';
    tableBody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tableBody);

    var indicator = document.createElement('div');
    indicator.className = 'scoreboard-scroll-indicator';
    indicator.innerHTML = '<span class="scoreboard-scroll-dot"></span>';

    prompt = document.createElement('div');
    prompt.className = 'prompt-pill scoreboard-cta';
    prompt.textContent = 'Press Start to Play';

    panel.appendChild(table);
    panel.appendChild(indicator);

    shell.appendChild(title);
    shell.appendChild(panel);
    shell.appendChild(prompt);
    overlay.appendChild(shell);
    (container || document.body).appendChild(overlay);
  }

  function isReady() {
    return !!overlay;
  }

  function ensureInit(container) {
    if (!overlay) {
      init(container);
    }

    // If we have a pending reveal, force a refresh so we can locate the submitted score.
    var hasPendingReveal = false;
    try { hasPendingReveal = !!sessionStorage.getItem(PENDING_REVEAL_KEY); } catch (e) {}

    // Opportunistically refresh scores, but throttle to avoid request spam.
    maybeFetchScores(hasPendingReveal).then(function() {
      // If server becomes available later, try to attach WS.
      connectWebSocket();

      // After we have (maybe) refreshed scores, try to run the pending reveal once.
      tryConsumePendingReveal();
    });
  }

  function tryConsumePendingReveal() {
    if (pendingRevealConsumed) return;

    var raw = null;
    try { raw = sessionStorage.getItem(PENDING_REVEAL_KEY); } catch (e) { raw = null; }
    if (!raw) return;

    var payload = null;
    try { payload = JSON.parse(raw); } catch (e) { payload = null; }
    if (!payload || !payload.name || typeof payload.score !== 'number') {
      try { sessionStorage.removeItem(PENDING_REVEAL_KEY); } catch (e) {}
      pendingRevealConsumed = true;
      return;
    }

    if (payload.at && (Date.now() - payload.at) > PENDING_REVEAL_TTL_MS) {
      try { sessionStorage.removeItem(PENDING_REVEAL_KEY); } catch (e) {}
      pendingRevealConsumed = true;
      return;
    }

    pendingRevealConsumed = true;

    // Resolve the user's rank from current scores.
    var i;
    var resolvedPos = -1;
    for (i = 0; i < scores.length; i++) {
      if (scores[i] && scores[i].name === payload.name && scores[i].score === payload.score) {
        resolvedPos = i;
        break;
      }
    }
    if (resolvedPos < 0) {
      // Best-effort fallback: compute where this score would land.
      var rank = getPositionForScore(payload.score);
      resolvedPos = Math.max(0, Math.min(rank - 1, scores.length - 1));
    }

    lastAddedId = null;
    lastAddedPosition = resolvedPos;

    // Make sure idle autoshow doesn't interfere.
    suppressShow = false;
    stopAutoShow();
    allowAnimatedShowOnce();

    // Run the reveal shortly after init so layout is ready.
    setTimeout(function() {
      try {
        show(true);
      } catch (e) {
        console.warn('[Scoreboard] Pending reveal failed:', e);
      }
      try { sessionStorage.removeItem(PENDING_REVEAL_KEY); } catch (e) {}

      // After the reveal, return to idle auto-show (important after a reload).
      (function scheduleIdleRestore() {
        try {
          var revealMs = 0;
          if (resolvedPos > 9) {
            var viewStart = resolvedPos - 5;
            if (viewStart < 0) viewStart = 0;
            if (viewStart > 90) viewStart = 90;
            var scrollMs = 3000 + (viewStart * 60);
            revealMs = 2000 + scrollMs;
          }
          var totalMs = revealMs + 5000 + 250;
          setTimeout(function() {
            // Only restore auto-show if we're in waiting/idle.
            if (window.Game && Game.FSM && Game.FSM.state === 'waiting') {
              try { hide(true); } catch (e) {}
              try { setSuppressed(false); } catch (e) {}
              try { startAutoShow(); } catch (e) {}
            }
          }, totalMs);
        } catch (e) {}
      })();
    }, 250);
  }

  // Keep old addEntry for backward compatibility, but prefer submitScore
  function addEntry(name, score, meta) {
    return submitScore(name, score, meta);
  }

  // Render 10 rows starting from startIdx
  function render(startIdx) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    startIdx = Math.max(0, Math.min(startIdx, scores.length - VISIBLE_ROWS));
    currentViewStart = startIdx;

    function normalizeBadgeIcon(icon) {
      if (!icon) return null;
      if (icon.indexOf('.png') !== -1) return icon;
      if (icon === '👑') return 'assets/Badge_Exabyte_Legend_60.png';
      if (icon === '🏗️') return 'assets/Badge_Petabyte_Architect_40.png';
      if (icon === '🧪') return 'assets/Badge_Data_Engineer_20.png';
      return icon;
    }
    
    for (var i = startIdx; i < startIdx + VISIBLE_ROWS && i < scores.length; i++) {
      var row = document.createElement('tr');
      if ((lastAddedId !== null && lastAddedId !== undefined && scores[i].id == lastAddedId) ||
          (lastAddedPosition !== null && lastAddedPosition === i)) {
        row.className = 'highlight';
      }
      var rank = document.createElement('td');
      rank.textContent = i + 1;
      var badgeCell = document.createElement('td');
      badgeCell.className = 'scoreboard-badge-cell';
      var nameCell = document.createElement('td');
      nameCell.className = 'scoreboard-name-cell';
      var nameText = String(scores[i].name || '').substring(0, 10);
      var icon = scores[i].achievementIcon || scores[i].achievement_icon;
      icon = normalizeBadgeIcon(icon);
      nameCell.textContent = nameText;
      if (icon) {
        if (icon.indexOf('.png') !== -1) {
          var badgeImg = document.createElement('img');
          badgeImg.className = 'scoreboard-badge-icon';
          badgeImg.src = icon;
          badgeImg.alt = 'Achievement';
          badgeCell.appendChild(badgeImg);
        } else {
          badgeCell.textContent = icon;
        }
      }
      var scoreCell = document.createElement('td');
      scoreCell.textContent = scores[i].score;
      row.appendChild(rank);
      row.appendChild(badgeCell);
      row.appendChild(nameCell);
      row.appendChild(scoreCell);
      tableBody.appendChild(row);
    }
    for (var j = i; j < startIdx + VISIBLE_ROWS; j++) {
      var emptyRow = document.createElement('tr');
      var emptyRank = document.createElement('td');
      emptyRank.textContent = j + 1;
      var emptyBadge = document.createElement('td');
      emptyBadge.textContent = '';
      var emptyName = document.createElement('td');
      emptyName.textContent = '---';
      var emptyScore = document.createElement('td');
      emptyScore.textContent = '---';
      emptyRow.appendChild(emptyRank);
      emptyRow.appendChild(emptyBadge);
      emptyRow.appendChild(emptyName);
      emptyRow.appendChild(emptyScore);
      tableBody.appendChild(emptyRow);
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

  // Create or get tracking bar element for retro effect
  function ensureTrackingBar() {
    if (!panel) return;
    var bar = panel.querySelector('.retro-tracking-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'retro-tracking-bar';
      panel.appendChild(bar);
    }
    return bar;
  }

  function show(withAnimation) {
    console.log('[Scoreboard] show() called, withAnimation:', withAnimation);
    if (withAnimation === true) {
      if (!allowAnimatedShow) {
        if (!window.Game || !Game.FSM || Game.FSM.state === 'waiting' || autoShowActive) {
          console.log('[Scoreboard] Ignoring animated show() outside game-over flow');
          return;
        }
      }
      allowAnimatedShow = false;
    }
    if (suppressShow) {
      console.log('[Scoreboard] Show suppressed');
      return;
    }
    if (scores.length === 0) {
      scores = [];
    }
    if (!overlay) {
      ensureInit(document.getElementById('game-container'));
    }
    if (!overlay) {
      console.log('[Scoreboard] ERROR: overlay not created');
      return;
    }

    // Stop any existing animation
    if (scrollTimeline) {
      try { scrollTimeline.pause(); } catch(e) {}
      scrollTimeline = null;
    }
    if (window.anime) {
      try { anime.remove(prompt); } catch(e) {}
    }
    
    // Make sure overlay is visible and on top - semi-transparent to show animation behind
    overlay.classList.remove('hidden');
    
    // Reset any previous styles and apply necessary overrides without !important
    overlay.style.cssText = '';
    panel.style.cssText = '';
    
    // Apply functional styles directly
    overlay.style.display = 'block';
    overlay.style.zIndex = '9999';
    overlay.style.pointerEvents = 'auto';
    overlay.style.backgroundColor = 'transparent'; // Let CSS handle background or override here
    
    panel.style.display = 'block';
    panel.style.visibility = 'visible';
    panel.style.opacity = '1';
    panel.style.backgroundColor = 'rgba(18,26,54,0.9)';
    
    // Add retro tracking bar for TV effect
    ensureTrackingBar();
    console.log('[Scoreboard] overlay shown, scores count:', scores.length, 'overlay parent:', overlay.parentNode ? overlay.parentNode.id : 'no parent');
    
    // Find player's position if they just entered
    var playerPosition = -1;
    if (lastAddedId !== null && lastAddedId !== undefined) {
      for (var i = 0; i < scores.length; i++) {
        // Be tolerant of server/client id type differences (number vs string)
        if (scores[i].id == lastAddedId) {
          playerPosition = i;
          break;
        }
      }
    }

    // Fallback: if we couldn't find by id (rare race/type mismatch), use the saved position.
    if (playerPosition < 0 && lastAddedPosition !== null && lastAddedPosition >= 0 && lastAddedPosition < scores.length) {
      playerPosition = lastAddedPosition;
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
          // Hold live updates until the reveal+scroll finishes.
          liveUpdateHoldUntil = Date.now() + duration + 300;
          animateScroll(playerViewStart, 0, duration);
        }, 2000); // Wait 2 seconds to show player their position

        // Also hold during the initial 2s reveal.
        liveUpdateHoldUntil = Date.now() + 2000 + 300;
      } else {
        // Player is in top 10 - just show top 10
        console.log('[Scoreboard] Player in top 10, showing top');
        render(0);
      }
    } else if (withAnimation && window.anime) {
      // Only use attract-mode scroll during idle/waiting. In game-over, always show immediately.
      if (window.Game && Game.FSM && (Game.FSM.state === 'waiting' || autoShowActive)) {
        console.log('[Scoreboard] Attract mode - scrolling from bottom');
        render(90);
        setTimeout(function() {
          animateScroll(90, 0, 8000);
        }, 500);
      } else {
        console.log('[Scoreboard] No player position found; showing top 10');
        render(0);
      }
    } else {
      console.log('[Scoreboard] No animation, showing top 10');
      render(0);
    }

    if (panel) {
      panel.style.opacity = '1';
    }
    if (withAnimation && window.anime && window.Animations) {
      Animations.fadeIn(panel, { duration: 480 });
      // Smooth pulse animation for the prompt
      Animations.pulse(prompt);
    }
  }

  function startAutoShow() {
    stopAutoShow();
    autoShowActive = true;
    autoShowNextAt = Date.now();

    // Start hidden in idle; first show happens after a delay.
    hide(true);

    function schedule(delay, fn) {
      if (autoShowTimer) {
        clearTimeout(autoShowTimer);
        autoShowTimer = null;
      }
      autoShowTimer = setTimeout(fn, delay);
    }

    function shouldRun() {
      return window.Game && window.Game.FSM && Game.FSM.state === 'waiting' && !suppressShow;
    }

    function doShow() {
      if (!shouldRun()) {
        schedule(1000, doShow);
        return;
      }
      console.log('[Scoreboard] Showing scoreboard in idle mode');
      autoShowSavedId = lastAddedId;
      autoShowSavedPos = lastAddedPosition;
      lastAddedId = null;
      lastAddedPosition = null;
      autoShowVisible = true;
      // Keep server sync attempts gentle in idle.
      maybeFetchScores(false);
      try {
        show(false);
      } catch (e) {
        console.warn('[Scoreboard] Idle show failed:', e);
      }
      schedule(10000, doHide);
    }

    function doHide() {
      if (!shouldRun()) {
        schedule(1000, doHide);
        return;
      }
      console.log('[Scoreboard] Hiding scoreboard in idle mode');
      autoShowVisible = false;
      try {
        // Force deterministic hide in idle (no animation dependency)
        hide(true);
      } catch (e) {
        console.warn('[Scoreboard] Idle hide failed:', e);
      }

      // Restore last-added tracking after hiding so game-over can still animate correctly.
      if (autoShowSavedId !== null && autoShowSavedId !== undefined) {
        lastAddedId = autoShowSavedId;
      }
      if (autoShowSavedPos !== null && autoShowSavedPos !== undefined) {
        lastAddedPosition = autoShowSavedPos;
      }
      autoShowSavedId = null;
      autoShowSavedPos = null;

      schedule(10000, doShow);
    }

    console.log('[Scoreboard] First autoshow trigger');
    schedule(10000, doShow);
  }

  function stopAutoShow() {
    autoShowActive = false;
    if (autoShowFirstTimeout) {
      clearTimeout(autoShowFirstTimeout);
      autoShowFirstTimeout = null;
    }
    if (autoShowHideTimeout) {
      clearTimeout(autoShowHideTimeout);
      autoShowHideTimeout = null;
    }
    if (autoShowCycleTimeout) {
      clearTimeout(autoShowCycleTimeout);
      autoShowCycleTimeout = null;
    }
    autoShowSavedId = null;
    autoShowVisible = false;
    if (autoShowInterval) {
      clearInterval(autoShowInterval);
      autoShowInterval = null;
    }
    if (autoShowTimer) {
      clearTimeout(autoShowTimer);
      autoShowTimer = null;
    }
  }

  function hide(force) {
    if (!overlay) return;

    // Stop any running animations first
    if (window.anime) {
      anime.remove(panel);
      anime.remove(prompt);
    }
    if (scrollTimeline) {
      try { scrollTimeline.pause(); } catch(e) {}
      scrollTimeline = null;
    }

    var applyHide = function() {
      // Clear inline styles so .hidden class works
      overlay.style.cssText = '';
      panel.style.cssText = '';
      overlay.style.display = 'none';
      panel.style.display = 'none';
      overlay.classList.add('hidden');
      panel.style.opacity = '1'; // Reset for next show
    };

    if (!force && window.anime && panel) {
      anime({
        targets: panel,
        opacity: [1, 0],
        duration: 500,
        easing: 'easeOutQuad',
        complete: applyHide
      });
    } else {
      // No animation - just hide immediately
      applyHide();
    }
  }

  function getLastEntryId() { return lastAddedId; }
  function isAutoShowActive() { return autoShowActive; }
  function setSuppressed(value) { suppressShow = !!value; }
  function allowAnimatedShowOnce() { allowAnimatedShow = true; }
  function isVisible() { return !!overlay && !overlay.classList.contains('hidden'); }

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
    submitScore: submitScore,
    fetchScores: fetchScores,
    show: show,
    hide: hide,
    render: render,
    startAutoShow: startAutoShow,
    stopAutoShow: stopAutoShow,
    getLastEntryId: getLastEntryId,
    isAutoShowActive: isAutoShowActive,
    setSuppressed: setSuppressed,
    allowAnimatedShowOnce: allowAnimatedShowOnce,
    isVisible: isVisible,
    isHighScore: isHighScore,
    getPositionForScore: getPositionForScore
  };
})();
