/**
 * Touch Controls for Mobile
 * Virtual joystick + fire button
 */

var TouchControls = (function() {
  var isMobile = false;
  var joystickData = {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    identifier: null
  };
  var fireActive = false;
  
  // DOM elements
  var mobileControls = null;
  var joystickZone = null;
  var joystickBase = null;
  var joystickThumb = null;
  var fireButton = null;
  
  // Config
  var JOYSTICK_MAX_DISTANCE = 50;
  var DEAD_ZONE = 10;
  
  function detectMobile() {
    return ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0) || 
           (navigator.msMaxTouchPoints > 0) ||
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  function createMobileUI() {
    // Create container
    mobileControls = document.createElement('div');
    mobileControls.id = 'mobile-controls';
    
    // Create joystick zone (left side)
    joystickZone = document.createElement('div');
    joystickZone.id = 'joystick-zone';
    
    joystickBase = document.createElement('div');
    joystickBase.id = 'joystick-base';
    
    joystickThumb = document.createElement('div');
    joystickThumb.id = 'joystick-thumb';
    
    joystickZone.appendChild(joystickBase);
    joystickZone.appendChild(joystickThumb);
    
    // Create fire button (right side)
    fireButton = document.createElement('div');
    fireButton.id = 'fire-button';
    fireButton.innerHTML = '<span>FIRE</span>';
    
    mobileControls.appendChild(joystickZone);
    mobileControls.appendChild(fireButton);
    
    // Add to game container
    var gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.appendChild(mobileControls);
    }
  }
  
  function getJoystickCenter() {
    var rect = joystickBase.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }
  
  function handleJoystickStart(touch) {
    joystickData.active = true;
    joystickData.identifier = touch.identifier;
    var center = getJoystickCenter();
    joystickData.startX = center.x;
    joystickData.startY = center.y;
    joystickData.currentX = touch.clientX;
    joystickData.currentY = touch.clientY;
    updateJoystickVisual();
    updateKeyStatus();
  }
  
  function handleJoystickMove(touch) {
    if (!joystickData.active) return;
    joystickData.currentX = touch.clientX;
    joystickData.currentY = touch.clientY;
    updateJoystickVisual();
    updateKeyStatus();
  }
  
  function handleJoystickEnd() {
    joystickData.active = false;
    joystickData.identifier = null;
    joystickThumb.style.transform = 'translate(-50%, -50%)';
    
    // Reset keys
    KEY_STATUS.left = false;
    KEY_STATUS.right = false;
    KEY_STATUS.up = false;
  }
  
  function updateJoystickVisual() {
    var center = getJoystickCenter();
    var deltaX = joystickData.currentX - center.x;
    var deltaY = joystickData.currentY - center.y;
    
    // Clamp to max distance
    var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > JOYSTICK_MAX_DISTANCE) {
      deltaX = (deltaX / distance) * JOYSTICK_MAX_DISTANCE;
      deltaY = (deltaY / distance) * JOYSTICK_MAX_DISTANCE;
    }
    
    joystickThumb.style.transform = 'translate(calc(-50% + ' + deltaX + 'px), calc(-50% + ' + deltaY + 'px))';
  }
  
  function updateKeyStatus() {
    var center = getJoystickCenter();
    var deltaX = joystickData.currentX - center.x;
    var deltaY = joystickData.currentY - center.y;
    
    // Horizontal: left/right rotation
    if (deltaX < -DEAD_ZONE) {
      KEY_STATUS.left = true;
      KEY_STATUS.right = false;
    } else if (deltaX > DEAD_ZONE) {
      KEY_STATUS.left = false;
      KEY_STATUS.right = true;
    } else {
      KEY_STATUS.left = false;
      KEY_STATUS.right = false;
    }
    
    // Vertical: up = thrust (negative Y is up on screen)
    if (deltaY < -DEAD_ZONE) {
      KEY_STATUS.up = true;
    } else {
      KEY_STATUS.up = false;
    }
  }
  
  function handleFireStart() {
    fireActive = true;
    KEY_STATUS.space = true;
    fireButton.classList.add('active');
  }
  
  function handleFireEnd() {
    fireActive = false;
    KEY_STATUS.space = false;
    fireButton.classList.remove('active');
  }
  
  function findTouchById(touches, id) {
    for (var i = 0; i < touches.length; i++) {
      if (touches[i].identifier === id) {
        return touches[i];
      }
    }
    return null;
  }
  
  function setupTouchEvents() {
    // Joystick touch events
    joystickZone.addEventListener('touchstart', function(e) {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleJoystickStart(e.touches[0]);
      }
    }, { passive: false });
    
    joystickZone.addEventListener('touchmove', function(e) {
      e.preventDefault();
      var touch = findTouchById(e.touches, joystickData.identifier);
      if (touch) {
        handleJoystickMove(touch);
      }
    }, { passive: false });
    
    joystickZone.addEventListener('touchend', function(e) {
      e.preventDefault();
      var touch = findTouchById(e.changedTouches, joystickData.identifier);
      if (touch || e.touches.length === 0) {
        handleJoystickEnd();
      }
    }, { passive: false });
    
    joystickZone.addEventListener('touchcancel', function(e) {
      handleJoystickEnd();
    });
    
    // Fire button touch events
    fireButton.addEventListener('touchstart', function(e) {
      e.preventDefault();
      handleFireStart();
    }, { passive: false });
    
    fireButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      handleFireEnd();
    }, { passive: false });
    
    fireButton.addEventListener('touchcancel', function(e) {
      handleFireEnd();
    });
    
    // Prevent default touch behaviors on the whole mobile controls area
    mobileControls.addEventListener('touchstart', function(e) {
      // Unlock audio on first touch
      if (window.SFX && typeof SFX.unlock === 'function') {
        try { SFX.unlock(); } catch (err) {}
      }
    }, { passive: true });
  }
  
  function hideDesktopControls() {
    var controlsInfo = document.querySelector('.controls-info');
    if (controlsInfo) {
      controlsInfo.style.display = 'none';
    }
    
    // Hide the slider controls on mobile too
    var sliderDiv = document.querySelector('#char-slider');
    if (sliderDiv && sliderDiv.parentElement) {
      sliderDiv.parentElement.style.display = 'none';
    }
  }
  
  function init() {
    isMobile = detectMobile();
    
    if (!isMobile) {
      return false;
    }
    
    // Wait for DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        createMobileUI();
        setupTouchEvents();
        hideDesktopControls();
      });
    } else {
      createMobileUI();
      setupTouchEvents();
      hideDesktopControls();
    }
    
    return true;
  }
  
  return {
    init: init,
    isMobile: function() { return isMobile; }
  };
})();

// Auto-initialize when script loads
(function() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      TouchControls.init();
    });
  } else {
    TouchControls.init();
  }
})();
