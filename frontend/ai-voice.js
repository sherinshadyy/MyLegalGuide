/**
 * AI chat voice input — server Whisper STT (Egyptian Arabic) with browser STT fallback.
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

    getLang(){
      const lang = (global.currentLang || (global.localStorage && global.localStorage.getItem('lang')) || 'en');
      return lang === 'ar' ? 'ar-EG' : 'en-US';
    },

    isArabic(){
      return this.getLang().startsWith('ar');
    },

    useServerStt(){
      return this.isArabic() && this.serverSttAvailable && this.serverSttReady && mediaSupported;
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
      if(this.recognition){
        try{ this.recognition.stop(); }catch(_e){}
        try{ this.recognition.abort(); }catch(_e){}
      }
      this.stopMedia();
      if(!this.processing){
        this.listening = false;
        this.setUiState(false);
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

    async startServerCapture(){
      if(this.listening || this.processing) return;
      try{
        const stream = await global.navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaStream = stream;
        const mime = this.pickMimeType();
        const opts = mime ? { mimeType: mime } : undefined;
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
          if(!blob.size){
            this.setUiState(false);
            this.toast(this.t('voiceError', 'Voice input failed. Try again or type your message.'));
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
            this.toast(this.t('voiceServerFallback', 'Server voice busy — using browser microphone…'));
            this.startBrowserCapture();
          }finally{
            this.processing = false;
            this.setUiState(false);
          }
        };
        this.recorder.start(250);
        this.listening = true;
        this.setUiState(true);
      }catch(_e){
        this.toast(this.t('voiceError', 'Could not start voice input.'));
        this.stop();
        if(SpeechRecognitionCtor) this.startBrowserCapture();
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
        const input = this.getInput();
        if(input) delete input.dataset.voiceBase;
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

    start(){
      if(this.useServerStt()) return this.startServerCapture();
      return this.startBrowserCapture();
    },

    toggle(){
      if(this.processing) return;
      if(this.listening){
        if(this.useServerStt() && this.recorder) this.stopServerCapture();
        else this.stop();
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
      const res = await fetch(base, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          audioBase64,
          mimeType: mimeType || 'audio/webm',
          lang: this.getLang()
        })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data.ok) throw new Error(data.error || 'Transcription failed');
      return data.text || '';
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
      }catch(_e){
        this.serverSttAvailable = false;
        this.serverSttReady = false;
      }
      const btn = this.getButton();
      if(btn && this.isArabic() && this.serverSttAvailable){
        btn.classList.remove('chat-voice-btn--unsupported');
      }
    },

    init(){
      if(this.bound) return;
      const btn = this.getButton();
      if(!btn) return;
      this.bound = true;
      btn.addEventListener('click', ()=> this.toggle());
      this.refreshServerStatus();
      this._voiceStatusTimer = global.setInterval(() => this.refreshServerStatus(), 20000);
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
