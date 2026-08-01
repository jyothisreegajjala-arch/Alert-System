/* CareConnect - Web Speech API Voice Assistant & TTS Engine */

const CareConnectVoice = {
  isSpeaking: false,
  speechSynth: window.speechSynthesis || null,

  // Map language codes to BCP 47 language tags for SpeechSynthesis
  langVoiceMap: {
    en: 'en-US',
    te: 'te-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    bn: 'bn-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    pa: 'pa-IN',
    or: 'or-IN',
    ur: 'ur-PK'
  },

  // Speak a text string aloud in the currently selected language
  speak: (textKeyOrString, options = {}) => {
    if (!CareConnectVoice.speechSynth) {
      console.warn('[Voice Assistant] SpeechSynthesis is not supported in this browser.');
      return;
    }

    // Cancel any ongoing speech
    CareConnectVoice.speechSynth.cancel();

    const currentLang = window.CareConnectI18n ? CareConnectI18n.getLanguage() : 'en';
    const textToSpeak = (window.CareConnectI18n && CareConnectI18n.t(textKeyOrString) !== textKeyOrString) 
      ? CareConnectI18n.t(textKeyOrString) 
      : textKeyOrString;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = CareConnectVoice.langVoiceMap[currentLang] || 'en-US';
    utterance.rate = options.rate || 0.95;
    utterance.pitch = options.pitch || 1.0;

    // Attempt to match best regional voice if available
    const voices = CareConnectVoice.speechSynth.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(currentLang) || v.lang === utterance.lang);
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      CareConnectVoice.isSpeaking = true;
      CareConnectVoice.updateVoiceButtonState(true);
    };

    utterance.onend = () => {
      CareConnectVoice.isSpeaking = false;
      CareConnectVoice.updateVoiceButtonState(false);
    };

    utterance.onerror = (e) => {
      console.warn('[Voice Assistant Error]:', e);
      CareConnectVoice.isSpeaking = false;
      CareConnectVoice.updateVoiceButtonState(false);
    };

    CareConnectVoice.speechSynth.speak(utterance);
  },

  stop: () => {
    if (CareConnectVoice.speechSynth) {
      CareConnectVoice.speechSynth.cancel();
      CareConnectVoice.isSpeaking = false;
      CareConnectVoice.updateVoiceButtonState(false);
    }
  },

  // Read entire visible screen content aloud (Requirement 5)
  readScreenAloud: () => {
    if (CareConnectVoice.isSpeaking) {
      CareConnectVoice.stop();
      return;
    }

    const currentLang = window.CareConnectI18n ? CareConnectI18n.getLanguage() : 'en';
    const welcome = CareConnectI18n.t('welcome_voice');
    const sosInstruction = CareConnectI18n.t('sos_voice_prompt');
    
    // Collect main visible text headings and descriptions
    let visibleText = `${welcome}. ${sosInstruction} `;

    document.querySelectorAll('h1, h2, h3, .sos-subtitle, .active-sos-card, .location-status').forEach(el => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0 && el.innerText) {
        visibleText += `${el.innerText}. `;
      }
    });

    CareConnectVoice.speak(visibleText);
  },

  // Text-To-Speech Notification Announcement (Requirement 6)
  announceNotification: (notificationMessage) => {
    CareConnectVoice.speak(notificationMessage, { rate: 1.0, pitch: 1.1 });
  },

  // Update floating voice button icon & animation
  updateVoiceButtonState: (active) => {
    const btn = document.getElementById('btn-voice-assistant');
    if (btn) {
      if (active) {
        btn.classList.add('voice-active');
        btn.innerHTML = '🔊 Speaking...';
      } else {
        btn.classList.remove('voice-active');
        btn.innerHTML = '🔊 Voice Assistant';
      }
    }
  }
};

window.CareConnectVoice = CareConnectVoice;
