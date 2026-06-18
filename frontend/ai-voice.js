/**
 * AI chat voice input — server Whisper STT (Egyptian Arabic) with browser STT fallback (English only).
 */
(function(global){
  'use strict';

  const SpeechRecognitionCtor = global.SpeechRecognition || global.webkitSpeechRecognition;
  const mediaSupported = !!(global.navigator && global.navigator.mediaDevices && global.MediaRecorder);

  const AiVoiceInput = {
    supported: !!SpeechRecognitionCtor || mediaSupported,
    listening: false,
    processing: false,
    serverSttAvailable: false,
    serverSttReady: false,
    recognition: null,
    recorder: null,
    mediaStream: null,
    audioChunks: [],
    bound: false,
    recordStartedAt: 0,

    getLang(){
      const lang = (global.currentLang || (global.localStorage && global.localStorage.getItem('lang')) || 'en');
      return lang === 'ar' ? 'ar-EG' : 'en-US';
    },

    isArabic(){
      return this.getLang().startsWith('ar');
    },

    /** Arabic: always record and send to Whisper when the server has voice enabled. */
    useServerRecording(){
      return this.isArabic() && this.serverSttAvailable && mediaSupported;
    },

    useServerStt(){
      return this.useServerRecording() && this.serverSttReady;
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
      const busy = this.processing;
      btn.classList.toggle('chat-voice-btn--active', !!active);
      btn.classList.toggle('chat-voice-btn--processing', !!busy);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      if(busy){
        btn.title = this.t('voiceTranscribing', 'Transcribing…');
      } else if(active){
        btn.title = this.t('voiceStop', 'Stop listening');
      } else {
        btn.title = this.supported
          ? this.t('voiceInput', 'Voice input')
          : this.t('voiceNotSupported', 'Voice input not supported in this browser');
      }
      btn.disabled = !this.supported || busy;
    },

    clearVoiceSession(input){
      if(!input) return;
      delete input.dataset.voiceBase;
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

    stopMedia(){
      if(this.recorder && this.recorder.state !== 'inactive'){
        try{ this.recorder.stop(); }catch(_e){}
      }
      if(this.mediaStream){
        this.mediaStream.getTracks().forEach(t => { try{ t.stop(); }catch(_e){} });
        this.mediaStream = null;
      }
    },

    stop(){
      this.listening = false;
      if(this.recognition){
        try{ this.recognition.onend = null; }catch(_e){}
        try{ this.recognition.stop(); }catch(_e){}
        try{ this.recognition.abort(); }catch(_e){}
        this.recognition = null;
      }
      this.stopMedia();
      if(!this.processing){
        this.setUiState(false);
        this.clearVoiceSession(this.getInput());
      }
    },

    async blobToBase64(blob){
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const step = 0x8000;
      for(let i = 0; i < bytes.length; i += step){
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
      }
      return global.btoa(binary);
    },

    pickMimeType(){
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      for(const mime of candidates){
        if(global.MediaRecorder.isTypeSupported(mime)) return mime;
      }
      return '';
    },

    sleep(ms){
      return new Promise(resolve => global.setTimeout(resolve, ms));
    },

    isLoadingError(msg){
      return /loading|not ready|try again/i.test(String(msg || ''));
    },

    async refreshServerStatus(){
      try{
        const url = typeof global.apiUrl === 'function'
          ? global.apiUrl('/api/chat/voice/status')
          : '/api/chat/voice/status';
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const data = await res.json().catch(()=>({}));
        this.serverSttAvailable = !!data.serverStt;
        this.serverSttReady = !!data.ready;
        if(data.loading) this.serverSttReady = false;
        this.serverSttModel = data.model || null;
      }catch(_e){
        this.serverSttAvailable = false;
        this.serverSttReady = false;
      }
      const btn = this.getButton();
      if(btn && this.isArabic() && this.serverSttAvailable){
        btn.classList.remove('chat-voice-btn--unsupported');
      }
      return this.serverSttReady;
    },

    async waitForServerReady(maxMs){
      const deadline = Date.now() + (maxMs || 120000);
      while(Date.now() < deadline){
        if(await this.refreshServerStatus()) return true;
        if(!this.serverSttAvailable) return false;
        await this.sleep(2000);
      }
      return this.serverSttReady;
    },

    async startServerCapture(){
      if(this.listening || this.processing) return;
      try{
        const stream = await global.navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: { ideal: 48000 }
          }
        });
        this.mediaStream = stream;
        const mime = this.pickMimeType();
        const opts = mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 };
        this.recorder = new global.MediaRecorder(stream, opts);
        this.audioChunks = [];
        this.recorder.ondataavailable = (e) => {
          if(e.data && e.data.size) this.audioChunks.push(e.data);
        };
        this.recorder.onstop = async () => {
          const type = (this.recorder && this.recorder.mimeType) || mime || 'audio/webm';
          this.stopMedia();
          const blob = new Blob(this.audioChunks, { type });
          this.audioChunks = [];
          this.listening = false;
          const elapsed = Date.now() - (this.recordStartedAt || 0);
          if(elapsed < 1800){
            this.setUiState(false);
            this.toast(this.t('voiceTooShort', 'Recording too short — speak for at least 2 seconds, then click the mic to stop.'));
            return;
          }
          if(!blob.size || blob.size < 800){
            this.setUiState(false);
            this.toast(this.t('voiceTooShort', 'Recording too short — speak for at least 2 seconds, then click the mic to stop.'));
            return;
          }
          this.processing = true;
          this.setUiState(false);
          try{
            const text = await this.transcribeViaApi(blob, type);
            if(text) this.applyTranscript(text);
            else this.toast(this.t('voiceError', 'Voice input failed. Try again or type your message.'));
          }catch(err){
            console.warn('Server STT failed:', err);
            if(!this.isArabic() && SpeechRecognitionCtor){
              this.toast(this.t('voiceServerFallback', 'Server voice busy — using browser microphone…'));
              this.startBrowserCapture();
            } else {
              this.toast(err.message || this.t('voiceError', 'Voice input failed. Try again or type your message.'));
            }
          }finally{
            this.processing = false;
            this.setUiState(false);
          }
        };
        this.recorder.start(500);
        this.recordStartedAt = Date.now();
        this.listening = true;
        this.setUiState(true);
        this.toast(this.t('voiceListeningHint', 'Speak now — click the mic again when finished.'));
      }catch(_e){
        this.toast(this.t('voiceError', 'Could not start voice input.'));
        this.stop();
        if(!this.isArabic() && SpeechRecognitionCtor) this.startBrowserCapture();
      }
    },

    stopServerCapture(){
      if(this.recorder && this.recorder.state === 'recording'){
        this.recorder.stop();
      } else {
        this.stop();
      }
    },

    createRecognition(){
      if(!SpeechRecognitionCtor) return null;
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
          input.value = `${base} ${finalText}`.trim();
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
        this.clearVoiceSession(this.getInput());
      };

      return rec;
    },

    startBrowserCapture(){
      if(!SpeechRecognitionCtor){
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

    async start(){
      await this.refreshServerStatus();

      if(this.useServerRecording()){
        if(!this.serverSttReady){
          this.processing = true;
          this.setUiState(false);
          this.toast(this.t('voiceModelLoading', 'Loading Egyptian voice model — please wait…'));
          const ready = await this.waitForServerReady(180000);
          this.processing = false;
          if(!ready){
            this.setUiState(false);
            this.toast(this.t('voiceModelNotReady', 'Voice model is still loading. Make sure the RAG API is running, wait about a minute, then try again.'));
            return;
          }
        }
        const weak = String(this.serverSttModel || '').toLowerCase();
        if(weak === 'tiny' || weak === 'tiny.en' || weak === 'base'){
          console.warn('[voice] Whisper model is too small for Egyptian Arabic:', this.serverSttModel);
        }
        return this.startServerCapture();
      }

      if(this.isArabic()){
        this.toast(this.t('voiceServerRequired', 'Accurate Egyptian voice needs the RAG API running (backend/start-rag.ps1).'));
        return;
      }

      if(this.useServerStt()) return this.startServerCapture();
      return this.startBrowserCapture();
    },

    toggle(){
      if(this.processing) return;
      if(this.listening){
        if(this.recorder && this.recorder.state === 'recording'){
          this.stopServerCapture();
        } else {
          this.stop();
        }
      } else {
        this.start();
      }
    },

    async transcribeViaApi(audioBlob, mimeType){
      const token = global.localStorage && global.localStorage.getItem('lg_token');
      const headers = { 'Content-Type': 'application/json' };
      if(token) headers.Authorization = 'Bearer ' + token;
      const audioBase64 = await this.blobToBase64(audioBlob);
      const base = typeof global.apiUrl === 'function'
        ? global.apiUrl('/api/chat/voice/transcribe')
        : '/api/chat/voice/transcribe';

      const maxAttempts = 40;
      let lastError = 'Transcription failed';
      for(let attempt = 0; attempt < maxAttempts; attempt++){
        const res = await fetch(base, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(90000),
          body: JSON.stringify({
            audioBase64,
            mimeType: mimeType || 'audio/webm',
            lang: this.getLang()
          })
        });
        const data = await res.json().catch(()=>({}));
        if(res.ok && data.ok) return data.text || '';
        lastError = data.error || 'Transcription failed';
        if(this.isLoadingError(lastError) && attempt < maxAttempts - 1){
          await this.refreshServerStatus();
          await this.sleep(2000);
          continue;
        }
        throw new Error(lastError);
      }
      throw new Error(lastError);
    },

    init(){
      if(this.bound) return;
      const btn = this.getButton();
      if(!btn) return;
      this.bound = true;
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        this.toggle();
      });
      this.refreshServerStatus();
      this._voiceStatusTimer = global.setInterval(() => this.refreshServerStatus(), 5000);
      this.setUiState(false);
      if(!this.supported) btn.classList.add('chat-voice-btn--unsupported');

      document.addEventListener('visibilitychange', ()=>{
        if(document.hidden) this.stop();
      });
    },

    refreshLabels(){
      this.setUiState(this.listening || this.processing);
    }
  };

  global.AiVoiceInput = AiVoiceInput;
  global.toggleAiVoiceInput = function(){ AiVoiceInput.toggle(); };
  global.stopAiVoiceInput = function(){ AiVoiceInput.stop(); };

})(typeof window !== 'undefined' ? window : globalThis);
