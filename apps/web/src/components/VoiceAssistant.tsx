'use client';

import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {createClient,languages,type VoiceCapabilities,type VoiceReply,type VoiceTurn} from '@metrology/core';

type Phase='idle'|'requesting'|'listening'|'transcribing'|'thinking'|'preparing'|'speaking';
type Message=VoiceTurn & {sources?:VoiceReply['sources']};
const phaseText:Record<Phase,string>={idle:'A little clarity. Just ask.',requesting:'Opening your microphone…',listening:'Go ahead. I’m listening.',transcribing:'Catching your words…',thinking:'Thinking it through…',preparing:'Getting your reply ready…',speaking:'Here’s what I think.'};

export default function VoiceAssistant({apiUrl,children}:{apiUrl:string;children:ReactNode}){
  const [tab,setTab]=useState('voice');
  return <div className="voice-workspace">
    <div className="voice-tabs" role="tablist" aria-label="Advisor mode"><button role="tab" aria-selected={tab==='voice'} onClick={()=>setTab('voice')}>Talk with AI</button><button role="tab" aria-selected={tab==='faq'} onClick={()=>setTab('faq')}>Quick FAQ</button></div>
    <div hidden={tab!=='voice'} className="voice-tab-panel"><Conversation apiUrl={apiUrl} active={tab==='voice'}/></div>
    <div hidden={tab!=='faq'} className="voice-faq">{children}</div>
  </div>;
}

function Conversation({apiUrl,active}:{apiUrl:string;active:boolean}){
  const api=useMemo(()=>createClient(apiUrl||(typeof location==='undefined'?'http://127.0.0.1:8000':location.protocol==='https:'?location.origin:`http://${location.hostname}:8000`)),[apiUrl]);
  const [cap,setCap]=useState<VoiceCapabilities|null>(null);
  const [retry,setRetry]=useState(0);
  const [phase,setPhase]=useState<Phase>('idle');const phaseRef=useRef<Phase>('idle');
  const [message,setMessage]=useState('Connecting to your voice assistant…');
  const [messages,setMessages]=useState<Message[]>([]);const history=useRef<Message[]>([]);
  const [draft,setDraft]=useState('');const [language,setLanguage]=useState('auto');const [speaker,setSpeaker]=useState('ritu');
  const [handsFree,setHandsFree]=useState(false);const handsFreeRef=useRef(false);
  const [inspection,setInspection]=useState<number|null>(null);const [attach,setAttach]=useState(false);const attachRef=useRef(false);
  const [replyAudio,setReplyAudio]=useState<string[]>([]);const [level,setLevel]=useState(0);
  const generation=useRef(0);const controller=useRef<AbortController|null>(null);
  const recorder=useRef<MediaRecorder|null>(null);const stream=useRef<MediaStream|null>(null);
  const context=useRef<AudioContext|null>(null);const meterTimer=useRef<ReturnType<typeof setInterval>|null>(null);
  const timeout=useRef<ReturnType<typeof setTimeout>|null>(null);const nextTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const player=useRef<HTMLAudioElement|null>(null);const beginRef=useRef<()=>void>(()=>{});
  const transcript=useRef<HTMLDivElement|null>(null);
  function transition(value:Phase){phaseRef.current=value;setPhase(value);}
  function releaseMic(){
    if(timeout.current)clearTimeout(timeout.current);if(meterTimer.current)clearInterval(meterTimer.current);
    stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
    if(context.current){void context.current.close().catch(()=>{});context.current=null;}setLevel(0);
  }
  function stop(){
    generation.current++;controller.current?.abort();controller.current=null;
    if(nextTimer.current)clearTimeout(nextTimer.current);
    if(recorder.current){recorder.current.onstop=null;if(recorder.current.state!=='inactive')recorder.current.stop();recorder.current=null;}
    releaseMic();if(player.current){player.current.onended=null;player.current.pause();player.current.src='';player.current=null;}
    transition('idle');
  }
  function endConversation(){stop();handsFreeRef.current=false;setHandsFree(false);setMessage('Stopped. Tap the microphone whenever you’re ready.');}
  function add(item:Message){history.current=[...history.current,item].slice(-16);setMessages(history.current);}
  function reset(){stop();history.current=[];setMessages([]);setReplyAudio([]);setDraft('');setMessage('A fresh conversation. What would you like to know?');}
  useEffect(()=>{
    let alive=true;
    api.voiceCapabilities().then(value=>{if(alive){setCap(value);setMessage(value.configured?'Speak naturally. Pause when you’re done.':value.message);}}).catch(()=>{if(alive)setMessage('Voice service unavailable. Quick FAQ is still available.');});
    const receive=(event:Event)=>{const id=(event as CustomEvent).detail.inspection_id;if(attachRef.current)reset();setInspection(id);};
    window.addEventListener('nyayalens:inspection',receive);
    const hidden=()=>{if(document.hidden)endConversation();};document.addEventListener('visibilitychange',hidden);
    const panel=document.getElementById('aiChatWindow');
    const observer=new MutationObserver(()=>{if(panel?.style.display==='none')endConversation();});
    if(panel)observer.observe(panel,{attributes:true,attributeFilter:['style']});
    return()=>{alive=false;stop();observer.disconnect();window.removeEventListener('nyayalens:inspection',receive);document.removeEventListener('visibilitychange',hidden);};
  },[api,retry]);
  useEffect(()=>{if(!active)endConversation();},[active]);
  useEffect(()=>{transcript.current?.parentElement?.scrollTo({top:transcript.current.parentElement.scrollHeight});},[messages,phase]);
  async function post(path:string,body:unknown,run:number,form=false){
    const signal=controller.current?.signal;
    const result=await api.request(path,{method:'POST',signal,...(form?{body:body as FormData}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})},60000);
    if(run!==generation.current)throw new DOMException('Stopped','AbortError');
    return result;
  }
  function finishPlayback(run:number){
    if(run!==generation.current)return;transition('idle');setMessage('Your turn.');
    if(handsFreeRef.current)nextTimer.current=setTimeout(()=>beginRef.current(),350);
  }
  function play(chunks:string[],run:number,index=0){
    if(run!==generation.current)return;
    if(index>=chunks.length){finishPlayback(run);return;}
    const audio=new Audio(`data:audio/wav;base64,${chunks[index]}`);player.current=audio;
    audio.onended=()=>play(chunks,run,index+1);
    audio.onerror=()=>{if(run===generation.current){transition('idle');setMessage('Audio could not play. Your written reply is below.');}};
    transition('speaking');
    void audio.play().catch(()=>{if(run===generation.current){transition('idle');setMessage('Tap Play reply to allow audio in this browser.');}});
  }
  async function respond(question:string,replyLanguage:string,run:number){
    const previous=history.current.slice(-8).map(({role,content})=>({role,content}));
    add({role:'user',content:question});setDraft('');setReplyAudio([]);transition('thinking');
    try{
      const result:VoiceReply=await post('/api/voice/reply',{message:question,history:previous,language_code:replyLanguage,inspection_id:attach?inspection:null},run);
      add({role:'assistant',content:result.answer,sources:result.sources});transition('preparing');
      try{
        const speech=await post('/api/language/speak',{text:result.answer,language_code:result.language_code,speaker},run);
        setReplyAudio(speech.audios);play(speech.audios,run);
      }catch(error){if(run===generation.current){transition('idle');setMessage('Your reply is ready, but speech is unavailable. '+(error instanceof Error?error.message:''));}}
    }catch(error){if(run===generation.current){history.current=history.current.slice(0,-1);setMessages(history.current);transition('idle');setDraft(question);setMessage(error instanceof Error?error.message:'The reply failed. Try again.');}}
  }
  async function typed(question=draft){
    if(!question.trim()||!cap?.configured)return;stop();const run=generation.current;controller.current=new AbortController();await respond(question.trim(),language,run);
  }
  async function begin(){
    if(!cap?.configured)return;
    stop();const run=generation.current;controller.current=new AbortController();transition('requesting');
    try{
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Microphone recording is unavailable here. You can still type your message.');
      const input=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(run!==generation.current){input.getTracks().forEach(track=>track.stop());return;}
      stream.current=input;
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg'].find(type=>MediaRecorder.isTypeSupported(type));
      const capture=new MediaRecorder(input,mime?{mimeType:mime}:undefined);recorder.current=capture;
      const chunks:Blob[]=[];let bytes=0;let heard=false;let metering=false;let speechFrames=0;let lastSound=performance.now();const started=lastSound;
      capture.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);bytes+=event.data.size;if(bytes>4*1024*1024){stop();setMessage('That recording is too large. Try a shorter message.');}}};
      capture.onerror=()=>{if(run===generation.current){stop();setMessage('Microphone recording failed. Please try again.');}};
      capture.onstop=()=>{
        releaseMic();recorder.current=null;if(run!==generation.current)return;
        if(metering&&!heard){transition('idle');setMessage('I didn’t hear speech. Tap the microphone and try again.');return;}
        transition('transcribing');
        const form=new FormData();form.append('file',new Blob(chunks,{type:capture.mimeType}),capture.mimeType.includes('mp4')?'voice.m4a':'voice.webm');form.append('language_code',language==='auto'?'unknown':language);
        void post('/api/language/transcribe',form,run,true).then(result=>respond(result.transcript,language==='auto'?(cap.speech_languages.includes(result.language_code)?result.language_code:'auto'):language,run)).catch(error=>{if(run===generation.current){transition('idle');setMessage(error.message||'Speech could not be understood.');}});
      };
      try{
        const audioContext=new AudioContext();context.current=audioContext;await audioContext.resume();
        if(run!==generation.current){releaseMic();return;}
        const analyser=audioContext.createAnalyser();analyser.fftSize=1024;audioContext.createMediaStreamSource(input).connect(analyser);const samples=new Float32Array(analyser.fftSize);metering=true;
        meterTimer.current=setInterval(()=>{
          analyser.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((sum,n)=>sum+n*n,0)/samples.length);setLevel(Math.min(1,rms*10));
          const now=performance.now();if(rms>.018){speechFrames++;if(speechFrames>=2)heard=true;lastSound=now;}else speechFrames=0;
          if(capture.state==='recording'&&((heard&&now-lastSound>1400)||(!heard&&now-started>6500)))capture.stop();
        },120);
      }catch{metering=false;}
      if(run!==generation.current){releaseMic();return;}
      capture.start(250);transition('listening');setMessage('Pause to send, or tap Finish speaking.');
      timeout.current=setTimeout(()=>{if(capture.state==='recording')capture.stop();},26000);
    }catch(error){if(run===generation.current){releaseMic();transition('idle');setMessage(error instanceof Error?error.message:'Microphone access was denied.');}}
  }
  beginRef.current=()=>{void begin();};
  const busy=phase!=='idle';
  return <div className="voice-conversation">
    <div className="voice-scroll">
      <div className={`voice-hero is-${phase}`}><div className="voice-orb" style={{'--voice-level':level} as React.CSSProperties}><span/><span/><span/><i/></div><span className="section-kicker">NYAYALENS · POWERED BY SARVAM</span><h3>{phaseText[phase]}</h3><p role="status" aria-live="polite">{message}</p></div>
      <div className="voice-options"><label>Language<select aria-label="Conversation language" disabled={busy} value={language} onChange={e=>setLanguage(e.target.value)}><option value="auto">Auto · Hindi, English & more</option>{languages.filter(([code])=>code!=='ur').map(([code,label])=><option key={code} value={`${code==='or'?'od':code}-IN`}>{label}</option>)}</select></label><label>Voice<select aria-label="Assistant voice" disabled={busy} value={speaker} onChange={e=>setSpeaker(e.target.value)}>{['ritu','shubh','priya','aditya'].map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label></div>
      <label className="voice-check"><input type="checkbox" checked={handsFree} onChange={e=>{handsFreeRef.current=e.target.checked;setHandsFree(e.target.checked);}}/>Keep the conversation going<span>Listen again after each spoken reply.</span></label>
      {inspection&&<label className="voice-check"><input type="checkbox" checked={attach} disabled={busy} onChange={e=>{reset();attachRef.current=e.target.checked;setAttach(e.target.checked);}}/>Use scan #{inspection}<span>Share saved label text and preliminary results.</span></label>}
      <div className="voice-transcript" ref={transcript} role="log" aria-label="AI conversation">{messages.map((item,index)=><article key={index} className={`voice-message ${item.role}`}><strong>{item.role==='user'?'You':'NyayaLens'}</strong><p>{item.content}</p>{item.sources?.map(source=><details key={source.key}><summary>{source.reference||source.key} · {source.status}</summary><p>{source.value}</p><small>{source.explanation}</small></details>)}</article>)}</div>
      {!messages.length&&<div className="voice-prompts">{['What should I check on a label?','मुझे आसान भाषा में समझाओ'].map(question=><button key={question} disabled={busy||!cap?.configured} onClick={()=>void typed(question)}>{question} ↗</button>)}</div>}
    </div>
    <div className="voice-controls">
      {!cap?.configured&&<button className="btn-secondary" onClick={()=>setRetry(value=>value+1)}>Reconnect voice service</button>}
      <div className="voice-call-actions"><button className="voice-mic" disabled={!cap?.configured||['transcribing','thinking','preparing','requesting'].includes(phase)} onClick={()=>phase==='listening'?recorder.current?.stop():void begin()} aria-label={phase==='listening'?'Finish speaking':phase==='speaking'?'Interrupt and speak':'Start speaking'}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>{phase==='listening'?'Finish speaking':phase==='speaking'?'Interrupt':'Let’s talk'}</button>{busy&&<button className="btn-secondary" onClick={endConversation}>Stop</button>}{!busy&&replyAudio.length>0&&<button className="btn-secondary" onClick={()=>{stop();play(replyAudio,generation.current);}}>Play reply</button>}<button className="voice-clear" disabled={busy} onClick={reset} aria-label="Clear conversation">↺</button></div>
      <form className="voice-compose" onSubmit={e=>{e.preventDefault();void typed();}}><input aria-label="Message to NyayaLens AI" maxLength={1500} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Or type what’s on your mind…" disabled={busy}/><button aria-label="Send AI message" disabled={busy||!cap?.configured||!draft.trim()}>↑</button></form>
      <small className="voice-privacy">Audio and messages go to Sarvam. AI explanations can be mistaken; review important details.</small>
    </div>
  </div>;
}
