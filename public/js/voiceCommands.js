/* CareConnect - Speech-to-Text Voice Commands Engine */

const CareConnectVoiceCommands = {
  recognition: null,
  isListening: false,

  // Command phrase dictionary mapped across languages
  commandPatterns: {
    help: ['help', 'emergency', 'sos', 'मदद', 'सहायता', 'సహాయం', 'అత్యవసరం', 'அவசரம்', 'ಸಹಾಯ', 'സഹായം', 'সাহায্য', 'મદદ', 'ਮਦਦ', 'ସାହାଯ୍ୟ', 'مدد'],
    cancel: ['cancel', 'stop', 'रद्द', 'రద్దు', 'ரத்து', 'ರದ್ದು', 'ਰੱਦ', 'منسوخ'],
    ambulance: ['ambulance', 'doctor', 'एम्बुलेंस', 'అంబులెన్స్', 'ആംബുലൻസ്', 'অ্যাম্বুলেন্স', 'એમ્બ્યુલન્સ', 'ਐਂਬੂਲੈਂਸ'],
    call_son: ['call son', 'family', 'बेटे को कॉल', 'కొడుకు', 'மகன்', 'ಮಗ', 'ಪುತ್ರ']
  },

  init: () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Voice Commands] SpeechRecognition API not supported in this browser.');
      return false;
    }

    CareConnectVoiceCommands.recognition = new SpeechRecognition();
    CareConnectVoiceCommands.recognition.continuous = false;
    CareConnectVoiceCommands.recognition.interimResults = false;

    CareConnectVoiceCommands.recognition.onstart = () => {
      CareConnectVoiceCommands.isListening = true;
      CareConnectVoiceCommands.updateMicButtonState(true);
      if (window.SafeReach && SafeReach.showToast) {
        SafeReach.showToast('🎙️ Listening for voice command... (e.g. "Help", "Emergency", "मदद")', 'info');
      }
    };

    CareConnectVoiceCommands.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      console.log('[Voice Command Heard]:', transcript);
      CareConnectVoiceCommands.handleCommand(transcript);
    };

    CareConnectVoiceCommands.recognition.onerror = (e) => {
      console.warn('[Voice Command Error]:', e.error);
      CareConnectVoiceCommands.isListening = false;
      CareConnectVoiceCommands.updateMicButtonState(false);
      if (e.error === 'not-allowed' && window.SafeReach) {
        SafeReach.showToast('Microphone permission required for voice commands.', 'warning');
      }
    };

    CareConnectVoiceCommands.recognition.onend = () => {
      CareConnectVoiceCommands.isListening = false;
      CareConnectVoiceCommands.updateMicButtonState(false);
    };

    return true;
  },

  // Toggle listening session
  toggleListening: () => {
    if (CareConnectVoiceCommands.isListening) {
      if (CareConnectVoiceCommands.recognition) CareConnectVoiceCommands.recognition.stop();
      return;
    }

    if (!CareConnectVoiceCommands.recognition) {
      if (!CareConnectVoiceCommands.init()) {
        if (window.SafeReach) SafeReach.showToast('Voice commands are not supported on this browser.', 'warning');
        return;
      }
    }

    const currentLang = window.CareConnectI18n ? CareConnectI18n.getLanguage() : 'en';
    const langCodeMap = {
      en: 'en-US', te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN',
      ml: 'ml-IN', bn: 'bn-IN', mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN', or: 'or-IN', ur: 'ur-PK'
    };
    CareConnectVoiceCommands.recognition.lang = langCodeMap[currentLang] || 'en-US';

    try {
      CareConnectVoiceCommands.recognition.start();
    } catch (e) {
      console.warn('Voice recognition start error:', e);
    }
  },

  // Match recognized transcript to emergency or navigation action
  handleCommand: (transcript) => {
    if (window.SafeReach && SafeReach.showToast) {
      SafeReach.showToast(`🗣️ Voice Command Recognized: "${transcript}"`, 'success');
    }

    // Check emergency trigger phrases
    const isEmergency = CareConnectVoiceCommands.commandPatterns.help.some(keyword => transcript.includes(keyword));
    const isCancel = CareConnectVoiceCommands.commandPatterns.cancel.some(keyword => transcript.includes(keyword));
    const isAmbulance = CareConnectVoiceCommands.commandPatterns.ambulance.some(keyword => transcript.includes(keyword));

    if (isEmergency) {
      if (window.CareConnectVoice) {
        CareConnectVoice.speak('Emergency voice command detected. Triggering SOS alert now!');
      }
      
      // Auto-trigger SOS via button or engine
      const sosBtn = document.getElementById('sos-press-btn');
      if (sosBtn) {
        sosBtn.click();
      } else if (window.SafeReach) {
        SafeReach.api('/api/emergency/trigger', {
          method: 'POST',
          body: JSON.stringify({ emergencyType: 'Voice Command Emergency (SOS)' })
        }).then(data => {
          SafeReach.showToast('🚨 EMERGENCY ALERT TRIGGERED VIA VOICE COMMAND!', 'danger');
        });
      }
    } else if (isCancel) {
      const activeCard = document.querySelector('.active-sos-card button');
      if (activeCard) activeCard.click();
    } else if (isAmbulance) {
      window.location.href = 'tel:108';
    }
  },

  updateMicButtonState: (active) => {
    const btn = document.getElementById('btn-voice-command');
    if (btn) {
      if (active) {
        btn.classList.add('mic-active');
        btn.innerHTML = '🎙️ Listening...';
      } else {
        btn.classList.remove('mic-active');
        btn.innerHTML = '🎙️ Voice Command';
      }
    }
  }
};

window.CareConnectVoiceCommands = CareConnectVoiceCommands;
