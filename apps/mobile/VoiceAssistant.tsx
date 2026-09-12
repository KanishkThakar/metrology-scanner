import {useEffect,useRef,useState} from 'react';
import {AppState,Platform,Pressable,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {AudioModule,RecordingPresets,setAudioModeAsync,useAudioPlayer,useAudioPlayerStatus,useAudioRecorder,useAudioRecorderState} from 'expo-audio';
import {File,Paths} from 'expo-file-system';
import {createClient,languages,languageCode,type VoiceCapabilities,type VoiceReply,type VoiceTurn} from '@metrology/core';

type Theme={text:string;panel:string;border:string;muted:string;soft:string};
type Phase='idle'|'requesting'|'listening'|'transcribing'|'thinking'|'preparing'|'speaking';
type Message=VoiceTurn&{sources?:VoiceReply['sources']};
const labels:Record<Phase,string>={idle:'A little clarity. Just ask.',requesting:'Opening your microphone…',listening:'Go ahead. I’m listening.',transcribing:'Catching your words…',thinking:'Thinking it through…',preparing:'Getting your reply ready…',speaking:'Here’s what I think.'};

export default function VoiceAssistant({api,inspectionId,color}:{api:ReturnType<typeof createClient>;inspectionId?:number;color:Theme}){
  const [cap,setCap]=useState<VoiceCapabilities|null>(null),[retry,setRetry]=useState(0);
  const [phase,setPhase]=useState<Phase>('idle'),[notice,setNotice]=useState('Connecting to Sarvam…');
  const phaseRef=useRef<Phase>('idle'),run=useRef(0),abort=useRef<AbortController|null>(null);
  const [messages,setMessages]=useState<Message[]>([]),history=useRef<Message[]>([]);
  const [draft,setDraft]=useState(''),[language,setLanguage]=useState('auto'),[speaker,setSpeaker]=useState('ritu'),[attach,setAttach]=useState(false);
  const [handsFree,setHandsFree]=useState(false),handsRef=useRef(false);
  const [audios,setAudios]=useState<string[]>([]),queue=useRef<string[]>([]),audioFile=useRef<File|null>(null);
  const webAudio=useRef<HTMLAudioElement|null>(null);
  const recorder=useAudioRecorder({...RecordingPresets.HIGH_QUALITY,isMeteringEnabled:true});
  const recording=useAudioRecorderState(recorder,100);
  const player=useAudioPlayer(null,{updateInterval:100}),playback=useAudioPlayerStatus(player);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null),next=useRef<ReturnType<typeof setTimeout>|null>(null);
  const started=useRef(0),heard=useRef(false),lastSound=useRef(0),beginRef=useRef<()=>void>(()=>{}),finishRef=useRef<()=>void>(()=>{});
  function transition(value:Phase){phaseRef.current=value;setPhase(value);}
  function clearFile(){try{if(audioFile.current?.exists)audioFile.current.delete();}catch{}audioFile.current=null;}
  function stop(){run.current++;abort.current?.abort();if(timer.current)clearTimeout(timer.current);if(next.current)clearTimeout(next.current);queue.current=[];player.pause();if(webAudio.current){webAudio.current.onended=null;webAudio.current.pause();webAudio.current.src='';webAudio.current=null;}if(recorder.isRecording)void recorder.stop().catch(()=>{});clearFile();transition('idle');}
  function end(){stop();handsRef.current=false;setHandsFree(false);setNotice('Stopped. Tap the microphone when you’re ready.');}
  function reset(){stop();history.current=[];setMessages([]);setAudios([]);setNotice('A fresh conversation. What would you like to know?');}
  useEffect(()=>{let alive=true;api.voiceCapabilities().then(c=>{if(alive){setCap(c);setNotice(c.configured?'Speak, then tap Finish speaking.':c.message);}}).catch(()=>{if(alive)setNotice('Voice service unavailable. The FAQ below still works.');});const sub=AppState.addEventListener('change',state=>{if(state!=='active')end();});return()=>{alive=false;stop();sub.remove();};},[api,retry]);
  useEffect(()=>{if(attach)reset();},[inspectionId]);
  function add(message:Message){history.current=[...history.current,message].slice(-16);setMessages(history.current);}
  async function post(path:string,body:unknown,id:number,form=false){const result=await api.request(path,{method:'POST',signal:abort.current?.signal,...(form?{body:body as FormData}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})},60000);if(id!==run.current)throw new Error('Stopped');return result;}
  function playNext(id:number){
    if(id!==run.current)return;
    const audio=queue.current.shift();clearFile();
    if(!audio){transition('idle');setNotice('Your turn.');if(handsRef.current)next.current=setTimeout(()=>beginRef.current(),400);return;}
    try{let uri=`data:audio/wav;base64,${audio}`;if(Platform.OS==='web'){const playback=new Audio(uri);webAudio.current=playback;playback.onended=()=>playNext(id);playback.onerror=()=>{if(id===run.current){queue.current=[];transition('idle');setNotice('Audio could not play. Your written reply is below.');}};transition('speaking');void playback.play().catch(()=>{if(id===run.current){queue.current=[];transition('idle');setNotice('Tap Play reply to allow audio in this browser.');}});return;}{const file=new File(Paths.cache,`nyayalens-voice-${Date.now()}.wav`);file.write(audio,{encoding:'base64'});audioFile.current=file;uri=file.uri;}player.replace({uri});player.play();transition('speaking');}
    catch{queue.current=[];transition('idle');setNotice('Audio could not play. Your written reply is below.');}
  }
  useEffect(()=>{if(playback.didJustFinish&&phaseRef.current==='speaking')playNext(run.current);},[playback.didJustFinish]);
  useEffect(()=>{if(phaseRef.current==='speaking'&&playback.playbackState==='error'){queue.current=[];transition('idle');setNotice('Audio could not play. Tap Play reply to retry.');}},[playback.playbackState]);
  async function respond(question:string,id:number){
    const previous=history.current.slice(-8).map(({role,content})=>({role,content}));add({role:'user',content:question});setDraft('');setAudios([]);transition('thinking');
    try{const result:VoiceReply=await post('/api/voice/reply',{message:question,history:previous,language_code:language,inspection_id:attach?inspectionId:null},id);add({role:'assistant',content:result.answer,sources:result.sources});transition('preparing');
      try{const speech=await post('/api/language/speak',{text:result.answer,language_code:result.language_code,speaker},id);await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true});if(id!==run.current)return;setAudios(speech.audios);queue.current=[...speech.audios];playNext(id);}
      catch(error){if(id===run.current){transition('idle');setNotice(`Your reply is ready, but speech is unavailable. ${error instanceof Error?error.message:''}`);}}
    }catch(error){if(id===run.current){history.current=history.current.slice(0,-1);setMessages(history.current);setDraft(question);transition('idle');setNotice(error instanceof Error?error.message:'Try again.');}}
  }
  async function send(question=draft){if(!question.trim()||!cap?.configured)return;stop();abort.current=new AbortController();await respond(question.trim(),run.current);}
  async function finish(){
    if(phaseRef.current!=='listening')return;const id=run.current;transition('transcribing');if(timer.current)clearTimeout(timer.current);
    try{await recorder.stop();if(id!==run.current)return;const uri=recorder.uri;if(!uri)throw new Error('No recording was captured. Please try again.');
      const form=new FormData();
      if(Platform.OS==='web'){const blob=await(await fetch(uri)).blob();if(blob.size>4*1024*1024)throw new Error('Try a shorter recording, under 30 seconds.');form.append('file',blob,'voice.webm');}
      else{const file=new File(uri);if(file.size>4*1024*1024)throw new Error('Try a shorter recording, under 30 seconds.');form.append('file',{uri,name:'voice.m4a',type:'audio/mp4'} as unknown as Blob);}
      form.append('language_code',language==='auto'?'unknown':language);const speech=await post('/api/language/transcribe',form,id,true);await respond(speech.transcript,id);
    }catch(error){if(id===run.current){transition('idle');setNotice(error instanceof Error?error.message:'Speech could not be understood.');}}
  }
  finishRef.current=()=>{void finish();};
  async function begin(){
    if(!cap?.configured)return;stop();const id=run.current;abort.current=new AbortController();transition('requesting');
    try{const permission=await AudioModule.requestRecordingPermissionsAsync();if(id!==run.current)return;if(!permission.granted)throw new Error('Allow microphone access, or type your message below.');
      await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});if(id!==run.current)return;
      await recorder.prepareToRecordAsync();if(id!==run.current){await recorder.stop();return;}
      recorder.record();started.current=lastSound.current=Date.now();heard.current=false;transition('listening');setNotice(Platform.OS==='web'?'Tap Finish speaking to send your message.':'Pause to send, or tap Finish speaking.');timer.current=setTimeout(()=>finishRef.current(),26000);
    }catch(error){if(id===run.current){transition('idle');setNotice(error instanceof Error?error.message:'Microphone unavailable. You can type instead.');}}
  }
  beginRef.current=()=>{void begin();};
  useEffect(()=>{if(phaseRef.current!=='listening'||recording.metering===undefined)return;const now=Date.now();if(recording.metering>-35){heard.current=true;lastSound.current=now;}if(heard.current&&now-lastSound.current>1500)finishRef.current();else if(!heard.current&&now-started.current>6500){stop();setNotice('I didn’t hear speech. Tap the microphone and try again.');}},[recording]);
  const busy=phase!=='idle',text={color:color.text};
  function Button({title,onPress,disabled=false,primary=false}:{title:string;onPress:()=>void;disabled?:boolean;primary?:boolean}){return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[styles.button,{backgroundColor:primary?'#17684e':color.soft,borderColor:color.border,opacity:disabled?.4:1}]}><Text style={{color:primary?'#fff':color.text,fontWeight:'600'}}>{title}</Text></Pressable>;}
  return <View style={[styles.panel,{backgroundColor:color.panel,borderColor:color.border}]}>
    <View style={styles.hero}><View style={styles.orb}><Text style={styles.wave}>ıIı</Text></View><Text style={[styles.kicker,{color:color.muted}]}>NYAYALENS · POWERED BY SARVAM</Text><Text accessibilityRole="header" style={[styles.title,text]}>{labels[phase]}</Text><Text accessibilityLiveRegion="polite" style={[styles.note,{color:color.muted}]}>{notice}</Text></View>
    {!cap?.configured&&<Button title="Reconnect voice service" onPress={()=>setRetry(n=>n+1)}/>}
    <Text style={[styles.label,text]}>Language</Text><Picker accessibilityLabel="Conversation language" enabled={!busy} selectedValue={language} onValueChange={setLanguage} style={{color:color.text,backgroundColor:color.soft,minHeight:48}}><Picker.Item value="auto" label="Auto · Hindi, English & more"/>{languages.filter(([code])=>code!=='ur').map(([code,label])=><Picker.Item key={code} value={languageCode(code)} label={label}/>)}</Picker>
    <Text style={[styles.label,text]}>Voice</Text><Picker accessibilityLabel="Assistant voice" enabled={!busy} selectedValue={speaker} onValueChange={setSpeaker} style={{color:color.text,backgroundColor:color.soft,minHeight:48}}>{['ritu','shubh','priya','aditya'].map(s=><Picker.Item key={s} value={s} label={s[0].toUpperCase()+s.slice(1)}/>)}</Picker>
    <View style={styles.toggle}><View style={{flex:1}}><Text style={text}>Keep the conversation going</Text><Text style={[styles.small,{color:color.muted}]}>Listen again after each spoken reply.</Text></View><Switch accessibilityLabel="Keep the conversation going" value={handsFree} onValueChange={v=>{handsRef.current=v;setHandsFree(v);}} trackColor={{true:'#43866e'}}/></View>
    {inspectionId&&<View style={styles.toggle}><Text style={[text,{flex:1}]}>Use saved scan #{inspectionId}</Text><Switch accessibilityLabel="Use saved scan" disabled={busy} value={attach} onValueChange={v=>{reset();setAttach(v);}}/></View>}
    {messages.map((m,i)=><View key={i} style={[styles.message,{backgroundColor:m.role==='user'?color.soft:color.panel,borderColor:color.border}]}><Text style={[styles.label,{color:color.muted}]}>{m.role==='user'?'You':'NyayaLens'}</Text><Text selectable style={[text,{lineHeight:24}]}>{m.content}</Text>{m.sources?.map(s=><Text key={s.key} selectable style={[styles.small,{color:color.muted}]}>{s.reference||s.key} · {s.status}: {s.value}. {s.explanation}</Text>)}</View>)}
    {!messages.length&&<Button title="What should I check on a label?" disabled={busy||!cap?.configured} onPress={()=>void send('What should I check on a label?')}/>}
    <View style={styles.row}><Button title={phase==='listening'?'Finish speaking':phase==='speaking'?'Interrupt and speak':'Start speaking'} primary disabled={!cap?.configured||['requesting','thinking','transcribing','preparing'].includes(phase)} onPress={()=>phase==='listening'?void finish():void begin()}/>{busy?<Button title="Stop conversation" onPress={end}/>:<Button title="Clear conversation" onPress={reset}/>}</View>
    {!busy&&audios.length>0&&<Button title="Play reply" onPress={()=>{stop();queue.current=[...audios];playNext(run.current);}}/>}
    <TextInput accessibilityLabel="Message to NyayaLens AI" value={draft} onChangeText={setDraft} maxLength={1500} multiline editable={!busy} placeholder="Or type what’s on your mind…" placeholderTextColor={color.muted} style={[styles.input,text,{borderColor:color.border}]}/><Button title="Send AI message" disabled={busy||!draft.trim()||!cap?.configured} onPress={()=>void send()}/>
    <Text style={[styles.small,{color:color.muted}]}>Audio and messages go to Sarvam. AI explanations can be mistaken; review important details.</Text>
  </View>;
}
const styles=StyleSheet.create({panel:{padding:22,borderRadius:24,borderWidth:1,gap:12},hero:{alignItems:'center',gap:12,paddingVertical:12},orb:{width:86,height:86,borderRadius:43,backgroundColor:'#43866e',borderWidth:8,borderColor:'#dcece3',alignItems:'center',justifyContent:'center'},wave:{fontSize:42,color:'#fff',fontWeight:'300'},kicker:{fontSize:9,letterSpacing:1.7},title:{fontSize:27,fontWeight:'500',letterSpacing:-1,textAlign:'center'},note:{fontSize:13,lineHeight:21,textAlign:'center'},label:{fontSize:12,fontWeight:'600'},small:{fontSize:11,lineHeight:17},row:{flexDirection:'row',flexWrap:'wrap',gap:8},button:{minHeight:48,paddingHorizontal:18,paddingVertical:14,borderRadius:24,borderWidth:1,justifyContent:'center',alignItems:'center'},toggle:{flexDirection:'row',alignItems:'center',gap:12,marginVertical:8},message:{padding:14,borderWidth:1,borderRadius:16,gap:7},input:{borderWidth:1,borderRadius:14,minHeight:54,padding:14,fontSize:16}});
