/* SafeReach - 3-Second Press & Hold SOS Trigger Engine */

class SOSTriggerEngine {
  constructor(buttonElement, progressCircleElement, options = {}) {
    this.button = buttonElement;
    this.progressCircle = progressCircleElement;
    this.holdDuration = options.holdDuration || 3000; // 3000ms (3 seconds)
    this.onComplete = options.onComplete || (() => {});

    this.timer = null;
    this.startTime = null;
    this.animFrame = null;
    this.isHolding = false;

    if (this.progressCircle) {
      const r = parseFloat(this.progressCircle.getAttribute('r')) || 126;
      this.circumference = 2 * Math.PI * r;
      this.progressCircle.style.strokeDasharray = this.circumference;
      this.progressCircle.style.strokeDashoffset = this.circumference;
    } else {
      this.circumference = 792;
    }

    // Web Audio Synthesizer Beep
    this.audioCtx = null;

    this.initEvents();
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  playAlarmSound(freq = 880, duration = 0.2) {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  initEvents() {
    if (!this.button) return;

    // Mouse events
    this.button.addEventListener('mousedown', (e) => this.startHold(e));
    this.button.addEventListener('mouseup', () => this.cancelHold());
    this.button.addEventListener('mouseleave', () => this.cancelHold());

    // Touch events for mobile responsiveness
    this.button.addEventListener('touchstart', (e) => this.startHold(e));
    this.button.addEventListener('touchend', () => this.cancelHold());
    this.button.addEventListener('touchcancel', () => this.cancelHold());
  }

  startHold(e) {
    if (e.type === 'touchstart') e.preventDefault();
    if (this.isHolding) return;

    this.isHolding = true;
    this.startTime = Date.now();
    this.button.classList.add('pressing');
    this.playAlarmSound(600, 0.1);

    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    this.updateProgress();
  }

  updateProgress() {
    if (!this.isHolding) return;

    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.holdDuration, 1.0);

    // Update SVG Radial Ring Offset
    if (this.progressCircle) {
      const offset = this.circumference * (1 - progress);
      this.progressCircle.style.strokeDashoffset = offset;
    }

    if (progress >= 1.0) {
      this.triggerEmergency();
    } else {
      if (Math.floor(elapsed / 500) > Math.floor((elapsed - 16) / 500)) {
        this.playAlarmSound(800 + progress * 400, 0.08);
      }
      this.animFrame = requestAnimationFrame(() => this.updateProgress());
    }
  }

  cancelHold() {
    if (!this.isHolding) return;
    this.isHolding = false;
    this.button.classList.remove('pressing');
    if (this.animFrame) cancelAnimationFrame(this.animFrame);

    if (this.progressCircle) {
      this.progressCircle.style.strokeDashoffset = this.circumference;
    }
  }

  async triggerEmergency() {
    this.cancelHold();
    this.playAlarmSound(1200, 0.6);

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 500]);
    }

    // Requirement 1 & 11: Use HTML5 Geolocation API and refresh location on every press
    try {
      let locationData;
      if (window.SafeReachLocation) {
        locationData = await SafeReachLocation.getCurrentLocation({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      } else {
        locationData = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            }),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
      }

      this.onComplete(locationData);
    } catch (err) {
      console.error('SOS Location Retrieval Failed:', err);
      if (window.SafeReach && SafeReach.showToast) {
        SafeReach.showToast(err.message || 'Location permission is required to send an emergency alert.', 'danger');
      }
      
      // Update location widget error display if available
      const statusEl = document.getElementById('location-status-text');
      if (statusEl) {
        statusEl.textContent = `❌ ${err.message}`;
        statusEl.className = 'location-status status-error';
      }

      // If user still wants to proceed or callback handles error
      this.onComplete({
        latitude: null,
        longitude: null,
        error: err.message
      });
    }
  }
}

window.SOSTriggerEngine = SOSTriggerEngine;
