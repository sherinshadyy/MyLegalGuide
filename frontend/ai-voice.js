/**
 * AI chat voice input — browser STT now; swap transcribeViaApi() for server STT later.
 */
(function(global){
  'use strict';

  const SpeechRecognitionCtor = global.SpeechRecognition || global.webkitSpeechRecognition;

  const AiVoiceInput = {
    supported: !!SpeechRecognitionCtor,
    listening: false,
    recognition: null,
    bound: false,

    getLang(){
      const lang = (global.currentLang || (global.localStorage && global.localStorage.getItem('lang')) || 'en');
      return lang === 'ar' ? 'ar-EG' : 'en-US';
    },

    t(key, fallback){
      if(typeof global.t === 'function') return global.t(key);
      return fallback || key;
    },

    toast(msg){
      if(typeof global.toast === 'function') global.toast(msg);
    },

    getInput(){
      return document.getElementById('chatInput');
    },

    getButton(){
      return document.getElementById('chatVoiceBtn');
    },

    setUiState(active){
      const btn = this.getButton();
      if(!btn) return;
      btn.classList.toggle('chat-voice-btn--active', !!active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.title = active
        ? this.t('voiceStop', 'Stop listening')
        : (this.supported
          ? this.t('voiceInput', 'Voice input')
          : this.t('voiceNotSupported', 'Voice input not supported in this browser'));
      btn.disabled = !this.supported;
    },

    applyTranscript(text){
      const input = this.getInput();
      if(!input) return;
      const chunk = String(text || '').trim();
      if(!chunk) return;
      const prev = String(input.value || '').trim();
      input.value = prev ? `${prev} ${chunk}` : chunk;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    },

    stop(){
      if(this.recognition){
        try{ this.recognition.stop(); }catch(_e){}
        try{ this.recognition.abort(); }catch(_e){}
      }
      this.listening = false;
      this.setUiState(false);
    },

    createRecognition(){
      if(!this.supported) return null;
      const rec = new SpeechRecognitionCtor();
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = this.getLang();

      rec.onstart = ()=>{
        this.listening = true;
        this.setUiState(true);
      };

      rec.onresult = (event)=>{
        const input = this.getInput();
        const base = input ? (input.dataset.voiceBase || '') : '';
        let interim = '';
        let finalText = '';
        for(let i = event.resultIndex; i < event.results.length; i++){
          const piece = event.results[i][0].transcript || '';
          if(event.results[i].isFinal) finalText += piece;
          else interim += piece;
        }
        if(!input) return;
        if(finalText){
          const merged = `${base} ${finalText}`.trim();
          input.value = merged;
          delete input.dataset.voiceBase;
        } else if(interim){
          input.value = `${base} ${interim}`.trim();
        }
      };

      rec.onerror = (event)=>{
        const code = (event && event.error) || '';
        if(code === 'aborted' || code === 'no-speech') return;
        this.toast(this.t('voiceError', 'Voice input failed. Try again or type your message.'));
        this.stop();
      };

      rec.onend = ()=>{
        this.listening = false;
        this.setUiState(false);
        const input = this.getInput();
        if(input) delete input.dataset.voiceBase;
      };

      return rec;
    },

    start(){
      if(!this.supported){
        this.toast(this.t('voiceNotSupported', 'Voice input is not supported in this browser yet.'));
        return;
      }
      if(this.listening) return;

      this.stop();
      const input = this.getInput();
      if(input) input.dataset.voiceBase = input.value || '';

      try{
        this.recognition = this.createRecognition();
        if(!this.recognition) return;
        this.recognition.start();
      }catch(_e){
        this.toast(this.t('voiceError', 'Could not start voice input.'));
        this.stop();
      }
    },

    toggle(){
      if(this.listening) this.stop();
      else this.start();
    },

    /** Future: POST audio to /api/chat/voice/transcribe */
    async transcribeViaApi(audioBlob, mimeType){
      const token = global.localStorage && global.localStorage.getItem('lg_token');
      const headers = {};
      if(token) headers.Authorization = 'Bearer ' + token;
      const body = new FormData();
      body.append('audio', audioBlob, 'voice.webm');
      body.append('mimeType', mimeType || 'audio/webm');
      const base = typeof global.apiUrl === 'function' ? global.apiUrl('/api/chat/voice/transcribe') : '/api/chat/voice/transcribe';
      const res = await fetch(base, { method: 'POST', headers, body });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data.ok) throw new Error(data.error || 'Transcription failed');
      return data.text || '';
    },

    init(){
      if(this.bound) return;
      const btn = this.getButton();
      if(!btn) return;
      this.bound = true;
      btn.addEventListener('click', ()=> this.toggle());
      this.setUiState(false);
      if(!this.supported) btn.classList.add('chat-voice-btn--unsupported');

      document.addEventListener('visibilitychange', ()=>{
        if(document.hidden) this.stop();
      });
    },

    refreshLabels(){
      this.setUiState(this.listening);
    }
  };

  global.AiVoiceInput = AiVoiceInput;
  global.toggleAiVoiceInput = function(){ AiVoiceInput.toggle(); };
  global.stopAiVoiceInput = function(){ AiVoiceInput.stop(); };

})(typeof window !== 'undefined' ? window : globalThis);
