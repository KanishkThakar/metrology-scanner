import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File as LocalFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAudioPlayer, useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { categories, createClient, languages, languageCode, validatePhotos, type Capabilities, type Inspection, type Preset, type ScanResult } from '@metrology/core';
import catalog from '@metrology/core/catalog';

const geography = catalog.indiaGeography as Record<string,string[]>;
const dictionaries = catalog.i18n as Record<string,typeof catalog.i18n.en>;
const initialApi = process.env.EXPO_PUBLIC_API_URL || `http://${Constants.expoConfig?.hostUri?.split(':')[0] || (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1')}:8000`;
type Session = {role:'CITIZEN'|'OFFICER'; userIdentifier:string};
type Photo = {uri:string;name:string;mimeType:string;fileSize?:number;file?:Blob};
const stripHtml = (text:string) => text.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const errorText = (error:unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function EvidenceImage({url,result}:{url:string;result:ScanResult}) {
  const [size,setSize]=useState({width:1,height:1});
  useEffect(()=>{Image.getSize(url,(width,height)=>setSize({width,height}),()=>{});},[url]);
  return <View style={{width:'100%',aspectRatio:size.width/size.height,position:'relative'}}>
    <Image accessibilityLabel="Scanned package evidence" source={{uri:url}} style={StyleSheet.absoluteFill} resizeMode="contain" />
    {result.detections.map((d,index)=>d.bbox?.length===4 ? <View pointerEvents="none" key={index} style={{position:'absolute',borderWidth:1,borderColor:result.is_compliant?'#16a34a':'#dc2626',left:`${d.bbox[0][0]/size.width*100}%`,top:`${d.bbox[0][1]/size.height*100}%`,width:`${(d.bbox[2][0]-d.bbox[0][0])/size.width*100}%`,height:`${(d.bbox[2][1]-d.bbox[0][1])/size.height*100}%`}} />:null)}
  </View>;
}

const UITheme=createContext({text:'#243248',panel:'#fff'});
function Button({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}) {
    return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={disabled} style={[styles.button,{opacity:disabled?.45:1}]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
  }

function Selection({label,value,values,onChange}:{label:string;value:string;values:[string,string][];onChange:(value:string)=>void}) {
    const color=useContext(UITheme);
    const textStyle={color:color.text};
    return <View><Text style={[styles.label,textStyle]}>{label}</Text><Picker accessibilityLabel={label} selectedValue={value} onValueChange={onChange} style={{color:color.text,backgroundColor:color.panel}}>{values.map(([value,label])=><Picker.Item key={value} label={label} value={value}/>)}</Picker></View>;
  }

function MobileApp() {
  const [apiUrl,setApiUrl]=useState(initialApi);
  const [apiDraft,setApiDraft]=useState(initialApi);
  const api=useMemo(()=>createClient(apiUrl),[apiUrl]);
  const [online,setOnline]=useState(false);
  const [capabilities,setCapabilities]=useState<Capabilities|null>(null);
  const [session,setSession]=useState<Session|null>(null);
  const [role,setRole]=useState<'CITIZEN'|'OFFICER'>('CITIZEN');
  const [identity,setIdentity]=useState('');
  const [password,setPassword]=useState('26034');
  const [dark,setDark]=useState(false);
  const [language,setLanguage]=useState('en');
  const [state,setState]=useState('Delhi');
  const [district,setDistrict]=useState('New Delhi');
  const [pincode,setPincode]=useState('110001');
  const [category,setCategory]=useState('FOOD');
  const [area,setArea]=useState('95');
  const [status,setStatus]=useState('System standby. Add package photos or choose a preset.');
  const [photos,setPhotos]=useState<Photo[]>([]);
  const [busy,setBusy]=useState(false);
  const inFlight=useRef(false);
  const [result,setResult]=useState<ScanResult|null>(null);
  const [history,setHistory]=useState<Inspection[]>([]);
  const [presets,setPresets]=useState<Preset[]>([]);
  const [rules,setRules]=useState<any>(null);
  const [tab,setTab]=useState('Scanner');
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('ALL');
  const [historyCategory,setHistoryCategory]=useState('ALL');
  const [dialog,setDialog]=useState<'rules'|'draft'|'settings'|'tour'|null>(null);
  const [tourStep,setTourStep]=useState(0);
  const [target,setTarget]=useState('LOCAL_BODY');
  const [contact,setContact]=useState('');
  const [query,setQuery]=useState('');
  const [messages,setMessages]=useState<{who:string;text:string}[]>([]);
  const [translated,setTranslated]=useState('');
  const [cameraOpen,setCameraOpen]=useState(false);
  const camera=useRef<CameraView>(null);
  const [permission,requestPermission]=useCameraPermissions();
  const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording=useAudioRecorderState(recorder);
  const player=useAudioPlayer(null);
  const stopTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const dict=dictionaries[language] || dictionaries.en;
  const color=dark?{bg:'#0e1724',panel:'#172338',text:'#f0f6ff',border:'#365070'}:{bg:'#f0f6ff',panel:'#fff',text:'#243248',border:'#bcd7ff'};

  useEffect(()=>{
    let mounted=true;
    AsyncStorage.multiGet(['metrology_api','doca_theme','doca_language']).then(items=>{
      if(!mounted)return;
      const saved=Object.fromEntries(items);
      if(saved.metrology_api){try{createClient(saved.metrology_api);setApiUrl(saved.metrology_api);setApiDraft(saved.metrology_api);}catch{}}
      setDark(saved.doca_theme==='dark');setLanguage(saved.doca_language||'en');
    });
    return()=>{mounted=false;if(stopTimer.current)clearTimeout(stopTimer.current);};
  },[]);
  useEffect(()=>{
    let mounted=true;
    const refresh=()=>api.health().then(()=>{if(mounted)setOnline(true);}).catch(()=>{if(mounted)setOnline(false);});
    refresh();
    api.capabilities().then(data=>{if(mounted)setCapabilities(data);}).catch(()=>{if(mounted)setCapabilities(null);});
    api.presets().then(data=>{if(mounted)setPresets(data);}).catch(()=>{});
    api.rules().then(data=>{if(mounted)setRules(data);}).catch(()=>{});
    const timer=setInterval(refresh,10000);
    return()=>{mounted=false;clearInterval(timer);};
  },[api]);
  useEffect(()=>{if(session?.role==='OFFICER')api.history().then(setHistory).catch(e=>setStatus(errorText(e)));},[session,api]);

  async function task(action:()=>Promise<void>) {
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);
    try{await action();}catch(error){setStatus(errorText(error));}finally{inFlight.current=false;setBusy(false);}
  }
  const textStyle={color:color.text};
  const inputStyle=[styles.input,{backgroundColor:color.panel,color:color.text,borderColor:color.border}];
  async function login() {
    if(role==='CITIZEN'&&!/^([6-9]\d{9}|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(identity.trim())){setStatus('Enter a valid Indian mobile number or email.');return;}
    if(!identity.trim()||!password.trim()||(role==='CITIZEN'&&!/^\d{4,6}$/.test(password))){setStatus('Enter the demo sign-in fields. Citizen OTP: 26034.');return;}
    setSession({role,userIdentifier:identity.trim()});setStatus('Ready to scan.');
    if(!(await AsyncStorage.getItem('doca_tour_done'))){setTourStep(0);setDialog('tour');}
  }
  function addPhotos(next:Photo[]){const merged=[...photos,...next];validatePhotos(merged);setPhotos(merged);setResult(null);setTranslated('');setStatus(`${merged.length} photo(s) ready for verification.`);}
  async function pick(){await task(async()=>{
    const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:8-photos.length,quality:1});
    if(!picked.canceled)addPhotos(picked.assets.map(p=>({uri:p.uri,name:p.fileName||`photo-${Date.now()}.jpg`,mimeType:p.mimeType||'image/jpeg',fileSize:p.fileSize,file:p.file})));
  });}
  async function takePhoto(){await task(async()=>{
    const shot=await camera.current?.takePictureAsync({quality:1});
    if(shot){addPhotos([{uri:shot.uri,name:`camera-${Date.now()}.jpg`,mimeType:'image/jpeg'}]);setCameraOpen(false);}
  });}
  async function appendFile(form:FormData,key:string,photo:Photo){
    if(Platform.OS==='web'){form.append(key,photo.file||await(await fetch(photo.uri)).blob(),photo.name);}
    else form.append(key,new LocalFile(photo.uri),photo.name);
  }
  async function scan(chosen=photos,chosenCategory=category,chosenArea=area){
    await task(async()=>{
      validatePhotos(chosen);
      if(!online)throw new Error('Backend unavailable. Check the API URL in Settings.');
      if(!Number.isFinite(Number(chosenArea))||Number(chosenArea)<=0)throw new Error('Enter a valid display panel area.');
      setStatus('Analyzing packaging with Tesseract OCR…');
      const form=new FormData();for(const photo of chosen)await appendFile(form,'files',photo);
      Object.entries({surface_area:chosenArea,category:chosenCategory,user_role:session!.role,user_identifier:session!.userIdentifier,state,district,pincode}).forEach(([k,v])=>form.append(k,v));
      const data=await api.scan(form);setResult(data);setTranslated('');setStatus(`Audit complete — ${data.photo_count} photo(s), ${data.compliance_status}.`);
      const stored=await api.history();setHistory(session?.role==='OFFICER'?stored:stored.filter(r=>r.userIdentifier===session?.userIdentifier));
    });
  }
  async function preset(p:Preset){
    if(inFlight.current)return;
    try{
      setStatus('Loading preset…');
      const uri=api.url(p.image_url);
      let photo:Photo={uri,name:p.image_url.split('/').pop()!,mimeType:'image/jpeg'};
      if(Platform.OS!=='web'){const downloaded=await LocalFile.downloadFileAsync(uri,new LocalFile(Paths.cache,photo.name),{idempotent:true});photo.uri=downloaded.uri;}
      setPhotos([photo]);setCategory(p.category);setArea(String(p.pdp_area));await scan([photo],p.category,String(p.pdp_area));
    }catch(error){setStatus(errorText(error));}
  }
  async function locate(){await task(async()=>{
    const allowed=await Location.requestForegroundPermissionsAsync();if(!allowed.granted)throw new Error('Location permission denied. You can select the jurisdiction manually.');
    const pos=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
    const [place]=await Location.reverseGeocodeAsync(pos.coords);
    if(!place)throw new Error('No address found. Select the jurisdiction manually.');
    if(place.region&&geography[place.region]){setState(place.region);setDistrict(geography[place.region].find(d=>d===place.city)||geography[place.region][0]);}
    if(place.postalCode)setPincode(place.postalCode);setStatus('Location updated. Review the selected jurisdiction.');
  });}
  async function shareText(content:string,type:'json'|'csv'){
    const name=`Metrology-inspections.${type}`;
    if(Platform.OS==='web'){const url=URL.createObjectURL(new Blob([content],{type:type==='csv'?'text/csv':'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    else {const file=new LocalFile(Paths.cache,name);file.create({overwrite:true});file.write(content);if(await Sharing.isAvailableAsync())await Sharing.shareAsync(file.uri);else throw new Error('File sharing is unavailable on this device.');}
  }
  async function pdf(path:string){await task(async()=>{
    if(Platform.OS==='web'){await Linking.openURL(api.url(path));return;}
    const file=await LocalFile.downloadFileAsync(api.url(path),new LocalFile(Paths.cache,path.split('/').pop()!),{idempotent:true});
    if(await Sharing.isAvailableAsync())await Sharing.shareAsync(file.uri,{mimeType:'application/pdf'});else await Linking.openURL(api.url(path));
  });}
  async function chat(){await task(async()=>{
    const raw=query.trim();if(!raw)return;setQuery('');setMessages(current=>[...current,{who:'You',text:raw}]);
    let english=raw;
    if(language!=='en'&&capabilities?.configured)english=(await api.translate(raw,language,'en')).translated_text;
    let answer=stripHtml((await api.chat(english)).answer);
    if(language!=='en'&&capabilities?.configured)answer=(await api.translate(answer,'en',language)).translated_text;
    setMessages(current=>[...current,{who:'Packaging FAQ',text:answer}]);setStatus('Advisor response ready.');
  });}
  async function readAloud(){await task(async()=>{
    const text=translated||messages.filter(m=>m.who!=='You').at(-1)?.text;
    if(!text)throw new Error('Translate an audit or ask the advisor first.');
    if(text.length>2500)throw new Error('Select a shorter passage (up to 2,500 characters) to read aloud.');
    const speech=await api.speak(text,language);
    player.replace({uri:`data:audio/wav;base64,${speech.audios[0]}`});player.play();setStatus('Playing speech.');
  });}
  async function recordSpeech(){
    if(recording.isRecording){await stopSpeech();return;}
    await task(async()=>{
      const allowed=await AudioModule.requestRecordingPermissionsAsync();if(!allowed.granted)throw new Error('Microphone permission denied.');
      await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});await recorder.prepareToRecordAsync();recorder.record();
      setStatus('Recording… tap Stop recording when finished.');stopTimer.current=setTimeout(()=>void stopSpeech(),28000);
    });
  }
  async function stopSpeech(){
    if(stopTimer.current)clearTimeout(stopTimer.current);
    await task(async()=>{
      await recorder.stop();await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true});
      if(!recorder.uri)throw new Error('No recording captured.');
      const form=new FormData();await appendFile(form,'file',{uri:recorder.uri,name:'recording.m4a',mimeType:Platform.OS==='web'?'audio/webm':'audio/mp4'});
      form.append('language_code',languageCode(language));setQuery((await api.transcribe(form)).transcript);setStatus('Speech transcribed. Review it and tap Send.');
    });
  }
  const filtered=history.filter(r=>(statusFilter==='ALL'||r.status===statusFilter)&&(historyCategory==='ALL'||r.category===historyCategory)&&`${r.caseId} ${r.brand} ${r.location}`.toLowerCase().includes(search.toLowerCase()));
  const tours=['Select your jurisdiction or use GPS.','Add up to eight photos of the same package: front, back and sides.','Enter the principal display panel area in square centimetres.','Run verification, inspect uncertain OCR readings, and save your PDF. Complaint actions create drafts only.'];

  return <UITheme.Provider value={color}><SafeAreaView style={[styles.screen,{backgroundColor:color.bg}]}>
    <StatusBar style={dark?'light':'dark'} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[styles.title,{color:dark?'#8dcaff':'#075985'}]}>⚖️ {dict.agencyTitle}</Text>
      <Text style={textStyle}>PCR 2011 • Legal Metrology</Text>
      <View style={styles.row}><Text style={[styles.status,{color:online?'#16a34a':'#c27803'}]}>{online?'● Backend: Online':'○ Backend: Unavailable'}</Text><Button title="Settings" onPress={()=>setDialog('settings')}/><Button title={dark?'🌙 Dark':'☀️ Light'} onPress={()=>{setDark(!dark);void AsyncStorage.setItem('doca_theme',!dark?'dark':'light');}}/></View>
      <Selection label="Language" value={language} values={languages} onChange={value=>{setLanguage(value);setTranslated('');void AsyncStorage.setItem('doca_language',value);}}/>
      <Text accessibilityLiveRegion="polite" style={[styles.notice,textStyle]}>{status}</Text>
      {!session?<View style={[styles.panel,{backgroundColor:color.panel}]}>
        <Text style={[styles.subtitle,textStyle]}>Demo sign-in</Text>
        <Selection label="Portal" value={role} values={[["CITIZEN","Citizen Portal"],["OFFICER","Officer Portal"]]} onChange={value=>{setRole(value as Session['role']);setPassword(value==='CITIZEN'?'26034':'');}}/>
        <TextInput accessibilityLabel="Mobile, email or officer ID" style={inputStyle} placeholder="Mobile, email or officer ID" placeholderTextColor="#75849a" value={identity} autoCapitalize="none" onChangeText={setIdentity}/>
        <TextInput accessibilityLabel={role==='CITIZEN'?'OTP (Mock: 26034)':'Demo officer password'} style={inputStyle} value={password} secureTextEntry={role==='OFFICER'} onChangeText={setPassword}/>
        <Button title={role==='CITIZEN'?'Enter Citizen Mode':'Enter Officer Mode'} onPress={()=>void login()}/>
      </View>:<>
        <View style={styles.row}><Text style={textStyle}>{session.role}: {session.userIdentifier}</Text><Button title="Switch" onPress={()=>{setSession(null);setPhotos([]);setResult(null);setTab('Scanner');}}/><Button title={dict.viewRulesBtn} onPress={()=>setDialog('rules')}/></View>
        <View style={styles.row}>{['Scanner','Advisor',...(session.role==='OFFICER'?['History']:[])].map(name=><Button key={name} title={name===tab?`● ${name}`:name} onPress={()=>setTab(name)}/>)}</View>
        <View style={[styles.panel,{backgroundColor:color.panel}]}><Text style={textStyle}>{dict.lblTotalScanned}: {history.length} • {dict.lblCompliant}: {history.filter(r=>r.status==='PASS').length} • {dict.lblViolations}: {history.filter(r=>r.status==='FAIL').length}</Text></View>
        {tab==='Scanner'&&<>
          <View style={[styles.panel,{backgroundColor:color.panel}]}>
            <Selection label="State" value={state} values={Object.keys(geography).sort().map(s=>[s,s])} onChange={s=>{setState(s);setDistrict(geography[s][0]);}}/>
            <Selection label="District" value={district} values={(geography[state]||[district]).map(d=>[d,d])} onChange={setDistrict}/>
            <TextInput accessibilityLabel="Pincode" style={inputStyle} value={pincode} keyboardType="number-pad" onChangeText={setPincode}/>
            <Button title="GPS Auto-Detect" disabled={busy} onPress={()=>void locate()}/>
            <Selection label="Commodity category" value={category} values={categories.map(c=>[c,c])} onChange={setCategory}/>
          </View>
          <Text style={[styles.subtitle,textStyle]}>1-Click Demo Presets</Text><ScrollView horizontal contentContainerStyle={styles.row}>{presets.map(p=><Button key={p.id} title={p.title} disabled={busy||!online} onPress={()=>void preset(p)}/>)}</ScrollView>
          <View style={[styles.panel,{backgroundColor:color.panel}]}>
            <Text style={[styles.subtitle,textStyle]}>{dict.lblUploadTitle}</Text><Text style={textStyle}>Add up to 8 photos of the same package — front, back and sides.</Text>
            <View style={styles.row}><Button title="Add photos" disabled={busy||photos.length>=8} onPress={()=>void pick()}/><Button title="Live Camera" disabled={busy||photos.length>=8} onPress={()=>void task(async()=>{const granted=permission?.granted||(await requestPermission()).granted;if(!granted)throw new Error('Camera permission denied. Add photos from your library instead.');setCameraOpen(true);})}/></View>
            <ScrollView horizontal>{photos.map((photo,index)=><View key={`${photo.uri}-${index}`} style={styles.photo}><Image source={{uri:photo.uri}} style={{height:160,width:130}} resizeMode="contain"/><Text numberOfLines={1} style={textStyle}>Photo {index+1}</Text><Button title={`Remove photo ${index+1}`} disabled={busy} onPress={()=>{setPhotos(current=>current.filter((_,i)=>i!==index));setResult(null);}}/></View>)}</ScrollView>
            <Text style={[styles.label,textStyle]}>{dict.lblPdpArea}</Text><TextInput accessibilityLabel="Principal display panel area" style={inputStyle} keyboardType="decimal-pad" value={area} onChangeText={setArea}/>
            <Button title={busy?'Working…':dict.scanBtn} disabled={busy||!online||!photos.length} onPress={()=>void scan()}/>
          </View>
          {result&&<View style={[styles.panel,{backgroundColor:color.panel}]}>
            <Text style={[styles.subtitle,textStyle]}>{dict.lblAuditTitle}</Text><Text style={textStyle}>Case: DoCA-LM-2026-{String(result.inspection_id).padStart(4,'0')} • {result.compliance_status}</Text>
            <EvidenceImage url={api.url(result.image_url)} result={result}/>
            <View style={styles.row}><Button title="Download PDF" onPress={()=>void pdf(result.report_pdf_url)}/>{!result.is_compliant&&<Button title="Prepare Complaint Draft" onPress={()=>setDialog('draft')}/>}</View>
            {result.symbols?.length>0&&<Text style={textStyle}>Detected marks: {result.symbols.map(s=>s.name).join(' • ')}</Text>}
            {Object.entries(result.rules).map(([key,rule])=><View key={key} style={[styles.rule,{borderColor:rule.status==='FAIL'?'#dc2626':rule.status==='REVIEW'?'#e9a23b':'#16a34a'}]}><Text style={[styles.label,textStyle]}>{(dict.rules as Record<string,string>)[key]||key} — {rule.status}</Text><Text selectable style={textStyle}>{rule.detected_value?`Extracted: ${rule.detected_value}`:'Not Detected'}</Text><Text style={textStyle}>{rule.explanation}</Text>{rule.error_code&&<Text style={textStyle}>{rule.status==='REVIEW'?'Inspection notice':'Violation'}: {rule.error_code}{rule.status==='FAIL'&&rule.penalty_clause?` (${rule.penalty_clause})`:''}</Text>}{rule.ocr_evidence?.map((e,i)=><View key={i}><Text style={[styles.label,textStyle]}>Price OCR readings • Photo {e.photo_number}</Text>{e.readings.map((r,j)=><Text key={j} selectable style={textStyle}>{r.method}: {r.text}</Text>)}</View>)}</View>)}
            <Text selectable style={textStyle}>Evidence SHA-256: {result.evidence_sha256}</Text>
            <Button title="Translate audit" disabled={busy||!capabilities?.configured} onPress={()=>void task(async()=>{const source=Object.values(result.rules).map(r=>`${r.key}: ${r.status}\n${r.detected_value||'Not detected'}\n${r.explanation||''}`).join('\n\n');const chunks=source.match(/[\s\S]{1,1900}/g)||[];const output=[];for(const chunk of chunks)output.push((await api.translate(chunk,'en',language)).translated_text);setTranslated(output.join('\n'));setStatus('Translation is a reading aid. Original audit results are unchanged.');})}/>
            {translated?<TextInput multiline accessibilityLabel="Audit translation" value={translated} onChangeText={setTranslated} style={inputStyle}/>:null}
            <Button title="Read aloud" disabled={busy||!translated||!capabilities?.speech_languages.includes(languageCode(language))} onPress={()=>void readAloud()}/>
          </View>}
        </>}
        {tab==='Advisor'&&<View style={[styles.panel,{backgroundColor:color.panel}]}>
          <Text style={[styles.subtitle,textStyle]}>Packaging FAQ Advisor</Text><Text style={textStyle}>{capabilities?.message||'Text FAQ remains available. Sarvam speech is not configured.'}</Text>
          <View style={styles.row}>{['Cooling charges above MRP','Rule 6(11) USP','Section 36 penalties','Consumer Helpline'].map(q=><Button key={q} title={q} onPress={()=>setQuery(q)}/>)}</View>
          {messages.map((m,i)=><View style={styles.rule} key={i}><Text style={[styles.label,textStyle]}>{m.who}</Text><Text selectable style={textStyle}>{m.text}</Text></View>)}
          <TextInput accessibilityLabel="Ask the packaging advisor" multiline style={inputStyle} value={query} onChangeText={setQuery} placeholder="Ask about packaging rules" placeholderTextColor="#75849a"/>
          <View style={styles.row}><Button title="Send" disabled={busy||!query.trim()||!online} onPress={()=>void chat()}/><Button title={recording.isRecording?'Stop recording':'Record speech'} disabled={busy||!capabilities?.configured} onPress={()=>void recordSpeech()}/><Button title="Read answer aloud" disabled={busy||!messages.length||!capabilities?.configured||!capabilities.speech_languages.includes(languageCode(language))} onPress={()=>void readAloud()}/><Button title="Stop audio" onPress={()=>player.pause()}/></View>
        </View>}
        {tab==='History'&&<View style={[styles.panel,{backgroundColor:color.panel}]}>
          <Text style={[styles.subtitle,textStyle]}>Inspection Audit Repository &amp; Evidence Logs</Text>
          <TextInput accessibilityLabel="Search inspections" style={inputStyle} value={search} onChangeText={setSearch} placeholder="Case ID, brand or location" placeholderTextColor="#75849a"/>
          <Selection label="Audit status" value={statusFilter} values={['ALL','PASS','FAIL','REVIEW'].map(s=>[s,s])} onChange={setStatusFilter}/>
          <Selection label="History category" value={historyCategory} values={['ALL',...categories].map(c=>[c,c])} onChange={setHistoryCategory}/>
          <View style={styles.row}><Button title="Refresh history" disabled={busy} onPress={()=>void task(async()=>setHistory(await api.history()))}/><Button title="Export JSON" onPress={()=>void task(()=>shareText(JSON.stringify(filtered,null,2),'json'))}/><Button title="Export CSV" onPress={()=>void task(async()=>{const keys=['caseId','time','brand','location','category','area','status','violations'] as const;const quote=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';await shareText([keys.join(','),...filtered.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\n'),'csv');})}/></View>
          {filtered.map(r=><View key={r.id} style={styles.rule}><Text style={[styles.label,textStyle]}>{r.caseId} • {r.status}</Text><Text style={textStyle}>{r.brand} — {r.location}\n{r.time} • {r.area} cm²</Text><View style={styles.row}><Button title={`View ${r.caseId}`} disabled={busy} onPress={()=>void task(async()=>{setResult(await api.inspection(r.id));setTab('Scanner');})}/><Button title={`PDF ${r.caseId}`} onPress={()=>void pdf(r.pdf_url)}/></View></View>)}
        </View>}
      </>}
      <View style={styles.row}><Button title="API docs" onPress={()=>void Linking.openURL(api.url('/docs'))}/><Button title="National Consumer Helpline" onPress={()=>void Linking.openURL('https://consumerhelpline.gov.in/')}/></View>
    </ScrollView>
    <Modal visible={cameraOpen} onRequestClose={()=>setCameraOpen(false)} animationType="slide"><SafeAreaView style={styles.screen}><CameraView ref={camera} style={{flex:1}} facing="back"/><View style={styles.row}><Button title="Snap Product Frame" disabled={busy} onPress={()=>void takePhoto()}/><Button title="Close camera" onPress={()=>setCameraOpen(false)}/></View></SafeAreaView></Modal>
    <Modal visible={dialog!==null} transparent animationType="fade" onRequestClose={()=>setDialog(null)}><View style={styles.overlay}><View style={[styles.modal,{backgroundColor:color.panel}]}><ScrollView keyboardShouldPersistTaps="handled">
      {dialog==='settings'&&<><Text style={[styles.subtitle,textStyle]}>Backend connection</Text><Text style={textStyle}>Use the Render backend URL, or your computer’s LAN address when testing on a phone.</Text><TextInput accessibilityLabel="Backend URL" autoCapitalize="none" style={inputStyle} value={apiDraft} onChangeText={setApiDraft}/><Button title="Save backend URL" onPress={()=>void task(async()=>{createClient(apiDraft);setApiUrl(apiDraft.replace(/\/$/,''));await AsyncStorage.setItem('metrology_api',apiDraft);setDialog(null);})}/></>}
      {dialog==='rules'&&<><Text style={[styles.subtitle,textStyle]}>PCR 2011 Rules Reference</Text>{(rules?.rules||[]).map((r:any)=><View key={r.key||r.rule_key} style={styles.rule}><Text style={[styles.label,textStyle]}>{r.title} • {r.rule_reference||r.rule_ref}</Text><Text style={textStyle}>{r.description}</Text></View>)}{!rules&&<Text style={textStyle}>Connect the backend to load the rules.</Text>}</>}
      {dialog==='tour'&&<><Text style={[styles.subtitle,textStyle]}>Step {tourStep+1} of {tours.length}</Text><Text style={textStyle}>{tours[tourStep]}</Text><Button title={tourStep===tours.length-1?'Finish tour':'Next step'} onPress={()=>{if(tourStep===tours.length-1){setDialog(null);void AsyncStorage.setItem('doca_tour_done','true');}else setTourStep(s=>s+1);}}/></>}
      {dialog==='draft'&&<><Text style={[styles.subtitle,textStyle]}>Prepare a Complaint Draft</Text><Text style={textStyle}>No email or official complaint is sent. Review and submit your report through the National Consumer Helpline.</Text><Selection label="Recipient" value={target} values={[["LOCAL_BODY","Local authority"],["STATE_COMMISSION","State commission"],["MANUFACTURER","Manufacturer"]]} onChange={setTarget}/><TextInput accessibilityLabel="Recipient email" style={inputStyle} value={contact} autoCapitalize="none" onChangeText={setContact} placeholder="Recipient email" placeholderTextColor="#75849a"/><Button title="Prepare draft" disabled={busy} onPress={()=>void task(async()=>{if(!result||!session)return;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))throw new Error('Enter a valid recipient email.');const form=new FormData();Object.entries({case_id:`DoCA-LM-2026-${String(result.inspection_id).padStart(4,'0')}`,sender_id:session.userIdentifier,recipient_type:target,recipient_contact:contact}).forEach(([k,v])=>form.append(k,v));const draft=await api.draft(form);setStatus(`${draft.reference_id}: ${draft.message}`);setDialog(null);})}/></>}
      <Button title="Close" onPress={()=>setDialog(null)}/>
    </ScrollView></View></View></Modal>
  </SafeAreaView></UITheme.Provider>;
}

export default function App(){return <SafeAreaProvider><MobileApp/></SafeAreaProvider>;}
const styles=StyleSheet.create({
  screen:{flex:1},content:{padding:18,gap:14,paddingBottom:40,maxWidth:960,width:'100%',alignSelf:'center'},title:{fontSize:25,fontWeight:'800'},subtitle:{fontSize:21,fontWeight:'700',marginBottom:10},label:{fontWeight:'700',marginVertical:8},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},panel:{padding:16,borderRadius:14,gap:10},button:{backgroundColor:'#0284c7',borderRadius:9,paddingHorizontal:14,paddingVertical:12,marginVertical:4},buttonText:{color:'white',fontWeight:'700'},input:{borderWidth:1,borderRadius:8,padding:12,fontSize:16,marginVertical:6},status:{fontWeight:'700',flexGrow:1},notice:{padding:12,borderWidth:1,borderColor:'#bcd7ff',borderRadius:8},photo:{marginRight:12,width:150},rule:{borderWidth:1,borderColor:'#bcd7ff',borderRadius:10,padding:12,marginVertical:7,gap:6},overlay:{flex:1,backgroundColor:'rgba(0,0,0,.6)',justifyContent:'center',padding:20},modal:{borderRadius:18,padding:22,maxHeight:'85%',width:'100%',maxWidth:640,alignSelf:'center'},
});
