import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView } from 'react-native';
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

const UITheme=createContext({text:'#18392c',panel:'#fff',border:'#dfe6df',muted:'#65776d',soft:'#f6f8f5'});
function Button({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
  const color=useContext(UITheme);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled}} onPress={onPress} disabled={disabled}
    style={({pressed})=>[styles.button,{backgroundColor:secondary?color.soft:'#17684e',borderColor:secondary?color.border:'#17684e',opacity:disabled?.45:pressed?.8:1}]}>
    <Text style={[styles.buttonText,{color:secondary?color.text:'#fff'}]}>{title}</Text>
  </Pressable>;
}

function Selection({label,value,values,onChange}:{label:string;value:string;values:[string,string][];onChange:(value:string)=>void}) {
    const color=useContext(UITheme);
    const textStyle={color:color.text};
    return <View><Text style={[styles.label,textStyle]}>{label}</Text><Picker accessibilityLabel={label} selectedValue={value} onValueChange={onChange} style={{color:color.text,backgroundColor:color.soft,borderWidth:1,borderColor:color.border,borderRadius:10,minHeight:48,fontSize:16}}>{values.map(([value,label])=><Picker.Item key={value} label={label} value={value}/>)}</Picker></View>;
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
  const [scanOptions,setScanOptions]=useState(false);
  const [showSamples,setShowSamples]=useState(false);
  const [ocrEngine,setOcrEngine]=useState('hybrid');
  const scroll=useRef<ScrollView>(null);
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
  const color=dark?{bg:'#101b17',panel:'#192820',text:'#edf6ee',border:'#334b3e',muted:'#a5b8ac',soft:'#203229'}:{bg:'#f5f5f0',panel:'#fff',text:'#18392c',border:'#dfe6df',muted:'#65776d',soft:'#f6f8f5'};

  useEffect(()=>{
    let mounted=true;
    AsyncStorage.multiGet(['metrology_api','doca_theme','doca_language','metrology_ocr_engine']).then(items=>{
      if(!mounted)return;
      const saved=Object.fromEntries(items);
      if(saved.metrology_api){try{createClient(saved.metrology_api);setApiUrl(saved.metrology_api);setApiDraft(saved.metrology_api);}catch{}}
      if(['paddleocr','tesseract','hybrid'].includes(saved.metrology_ocr_engine||''))setOcrEngine(saved.metrology_ocr_engine!);
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

  useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[tab]);

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
      setStatus(`Reading ${chosen.length} photo(s) with ${ocrEngine==='hybrid'?'PaddleOCR + Tesseract':ocrEngine==='paddleocr'?'PaddleOCR':'Tesseract'}…`);
      const form=new FormData();for(const photo of chosen)await appendFile(form,'files',photo);
      Object.entries({ocr_engine:ocrEngine,surface_area:chosenArea,category:chosenCategory,user_role:session!.role,user_identifier:session!.userIdentifier,state,district,pincode}).forEach(([k,v])=>form.append(k,v));
      const data=await api.scan(form);setResult(data);setTab('Results');setTranslated('');setStatus(`Audit complete — ${data.photo_count} photo(s), ${data.compliance_status}.`);
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

  return <UITheme.Provider value={color}><SafeAreaView edges={['top','left','right']} style={[styles.screen,{backgroundColor:color.bg}]}>
    <StatusBar style={dark?'light':'dark'} />
    <View style={[styles.header,{backgroundColor:color.panel,borderColor:color.border}]}>
      <View style={styles.brand}><View style={styles.brandIcon}><Text style={styles.brandGlyph}>≋</Text></View><Text style={[styles.wordmark,textStyle]}>metrology<Text style={{color:'#4d9b72'}}>.</Text></Text></View>
      <View style={styles.row}><Text accessibilityLabel={online?'Backend online':'Backend unavailable'} style={[styles.connectionDot,{color:online?'#4f9670':'#b17b25'}]}>●</Text><Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={()=>setDialog('settings')} style={[styles.iconButton,{backgroundColor:color.soft,borderColor:color.border}]}><Text style={[styles.more,textStyle]}>•••</Text></Pressable></View>
    </View>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!session?<>
        <View style={styles.welcomeCard}><Text style={styles.welcomeEyebrow}>METROLOGY / LABEL INTELLIGENCE</Text><Text style={styles.welcomeTitle}>A little clarity.</Text><Text style={styles.welcomeItalic}>On every label.</Text><Text style={styles.welcomeNote}>Demo workspace · Human review matters</Text></View>
        <View style={[styles.panel,{backgroundColor:color.panel,borderColor:color.border}]}>
          <Text style={[styles.subtitle,textStyle]}>Welcome to your workspace</Text><Text style={[styles.helper,{color:color.muted}]}>Choose how you’d like to explore.</Text>
          <View style={[styles.segment,{backgroundColor:color.soft}]}>{(['CITIZEN','OFFICER'] as const).map(option=><Pressable key={option} accessibilityRole="button" accessibilityLabel={option==='CITIZEN'?'Citizen':'Officer demo'} accessibilityState={{selected:role===option}} aria-selected={role===option} onPress={()=>{setRole(option);setPassword(option==='CITIZEN'?'26034':'');}} style={[styles.segmentButton,role===option&&styles.segmentActive]}><Text style={[styles.segmentText,{color:role===option?'#fff':color.muted}]}>{option==='CITIZEN'?'Citizen':'Officer demo'}</Text></Pressable>)}</View>
          <Text style={[styles.label,textStyle]}>Mobile, email or officer ID</Text><TextInput accessibilityLabel="Mobile, email or officer ID" style={inputStyle} placeholder="Enter your details" placeholderTextColor={color.muted} value={identity} autoCapitalize="none" onChangeText={setIdentity}/>
          <Text style={[styles.label,textStyle]}>{role==='CITIZEN'?'Demo code: 26034':'Demo officer password'}</Text><TextInput accessibilityLabel={role==='CITIZEN'?'OTP (Mock: 26034)':'Demo officer password'} style={inputStyle} value={password} secureTextEntry={role==='OFFICER'} onChangeText={setPassword}/>
          <Button title={role==='CITIZEN'?'Enter Citizen Mode':'Enter Officer Mode'} onPress={()=>void login()}/>
        </View>
      </>:<>
        <View style={styles.intro}><Text style={[styles.eyebrow,{color:color.muted}]}>{tab==='Scanner'?'YOUR PACKAGE. IN FOCUS.':tab==='Results'?'FROM PHOTO TO FINDINGS.':tab==='Advisor'?'A LITTLE GUIDANCE.':'YOUR INSPECTION LIBRARY.'}</Text>
          <Text accessibilityRole="header" style={[styles.heroTitle,textStyle]}>{tab==='Scanner'?'Know your ':tab==='Results'?'A clearer ':tab==='Advisor'?'Let’s talk ':'Every '}<Text style={styles.heroItalic}>{tab==='Scanner'?'label.':tab==='Results'?'picture.':tab==='Advisor'?'labels.':'inspection.'}</Text></Text>
          <Text style={[styles.helper,{color:color.muted}]}>{tab==='Scanner'?'A clearer read. A more informed decision.':tab==='Results'?'Inspect the evidence. Review the details.':tab==='Advisor'?'Explore packaging questions, in your language.':'Find, review and share your past scans.'}</Text>
        </View>
        {tab==='Scanner'&&<View style={[styles.panel,{backgroundColor:color.panel,borderColor:color.border}]}>
          <Text style={[styles.eyebrow,{color:color.muted}]}>01 / CAPTURE</Text><Text style={[styles.subtitle,textStyle]}>{dict.lblUploadTitle}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose package photos" disabled={busy||photos.length>=8} onPress={()=>void pick()} style={[styles.captureZone,{backgroundColor:color.soft,borderColor:color.border}]}><View style={[styles.captureIcon,{backgroundColor:color.panel}]}><Text style={{fontSize:32,color:'#43825f'}}>⊞</Text></View><Text style={[styles.label,textStyle]}>Add package photos</Text><Text style={[styles.helper,{color:color.muted}]}>Front, back and sides. Up to 8 photos.</Text></Pressable>
          <View style={styles.captureActions}><Button secondary title="Add photos" disabled={busy||photos.length>=8} onPress={()=>void pick()}/><Button secondary title="Live Camera" disabled={busy||photos.length>=8} onPress={()=>void task(async()=>{const granted=permission?.granted||(await requestPermission()).granted;if(!granted)throw new Error('Camera permission denied. Add photos from your library instead.');setCameraOpen(true);})}/></View>
          {photos.length>0&&<><Text style={[styles.helper,{color:color.muted}]}>{photos.length} / 8 photos added</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10}}>{photos.map((photo,index)=><View key={`${photo.uri}-${index}`} style={[styles.photo,{backgroundColor:color.soft,borderColor:color.border}]}><Image accessibilityLabel={`Package photo ${index+1}`} source={{uri:photo.uri}} style={{height:110,width:110,borderRadius:10}} resizeMode="cover"/><Text numberOfLines={1} style={[styles.helper,textStyle]}>Photo {index+1}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index+1}`} disabled={busy} onPress={()=>{setPhotos(current=>current.filter((_,i)=>i!==index));setResult(null);}} style={styles.removePhoto}><Text style={{color:'#fff',fontSize:18}}>×</Text></Pressable></View>)}</ScrollView></>}
          <Text style={[styles.label,textStyle]}>Choose your reader</Text><View style={[styles.segment,{backgroundColor:color.soft}]}>{[['paddleocr','PaddleOCR'],['tesseract','Tesseract'],['hybrid','Both']].map(([value,title])=><Pressable key={value} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{selected:ocrEngine===value,disabled:busy}} aria-selected={ocrEngine===value} disabled={busy} onPress={()=>{setOcrEngine(value);void AsyncStorage.setItem('metrology_ocr_engine',value);}} style={[styles.segmentButton,ocrEngine===value&&styles.segmentActive]}><Text style={[styles.segmentText,{color:ocrEngine===value?'#fff':color.muted}]}>{title}</Text></Pressable>)}</View>
          <Pressable accessibilityRole="button" accessibilityLabel="Scan settings" accessibilityState={{expanded:scanOptions}} aria-expanded={scanOptions} onPress={()=>setScanOptions(!scanOptions)} style={[styles.disclosure,{borderColor:color.border}]}><View><Text style={[styles.label,textStyle]}>Scan settings</Text><Text style={[styles.helper,{color:color.muted}]}>Category, location &amp; label area</Text></View><Text style={textStyle}>{scanOptions?'−':'+'}</Text></Pressable>
          {scanOptions&&<View style={styles.settingsFields}><Selection label="State" value={state} values={Object.keys(geography).sort().map(s=>[s,s])} onChange={s=>{setState(s);setDistrict(geography[s][0]);}}/>
            <Selection label="District" value={district} values={(geography[state]||[district]).map(d=>[d,d])} onChange={setDistrict}/>
            <TextInput accessibilityLabel="Pincode" style={inputStyle} value={pincode} keyboardType="number-pad" onChangeText={setPincode}/><Button secondary title="GPS Auto-Detect" disabled={busy} onPress={()=>void locate()}/>
            <Selection label="Commodity category" value={category} values={categories.map(c=>[c,c])} onChange={setCategory}/><Text style={[styles.label,textStyle]}>{dict.lblPdpArea}</Text><TextInput accessibilityLabel="Principal display panel area" style={inputStyle} keyboardType="decimal-pad" value={area} onChangeText={setArea}/>
          </View>}
          <Button title={busy?'Reading your label…':dict.scanBtn} disabled={busy||!online||!photos.length} onPress={()=>void scan()}/>
          <Pressable accessibilityRole="button" accessibilityLabel="Try a sample" accessibilityState={{expanded:showSamples}} aria-expanded={showSamples} onPress={()=>setShowSamples(!showSamples)} style={styles.sampleLink}><Text style={[styles.helper,{color:color.muted}]}>Just exploring?</Text><Text style={[styles.label,textStyle]}>Try a sample ↗</Text></Pressable>
          {showSamples&&presets.map(p=><Button secondary key={p.id} title={p.title} disabled={busy||!online} onPress={()=>void preset(p)}/>)}
        </View>}
        {tab==='Results'&&(result?<View style={[styles.panel,{backgroundColor:color.panel}]}>
            <Text style={[styles.subtitle,textStyle]}>{dict.lblAuditTitle}</Text><Text style={textStyle}>Case: DoCA-LM-2026-{String(result.inspection_id).padStart(4,'0')} • {result.compliance_status}</Text>
            <EvidenceImage url={api.url(result.image_url)} result={result}/>
            <View style={styles.row}><Button title="Download PDF" onPress={()=>void pdf(result.report_pdf_url)}/>{!result.is_compliant&&<Button title="Prepare Complaint Draft" onPress={()=>setDialog('draft')}/>}</View>
            {result.symbols?.length>0&&<Text style={textStyle}>Detected marks: {result.symbols.map(s=>s.name).join(' • ')}</Text>}
            {Object.entries(result.rules).map(([key,rule])=><View key={key} style={[styles.rule,{borderColor:rule.status==='FAIL'?'#dc2626':rule.status==='REVIEW'?'#e9a23b':'#16a34a'}]}><Text style={[styles.label,textStyle]}>{(dict.rules as Record<string,string>)[key]||key} — {rule.status}</Text><Text selectable style={textStyle}>{rule.detected_value?`Extracted: ${rule.detected_value}`:'Not Detected'}</Text><Text style={textStyle}>{rule.explanation}</Text>{rule.error_code&&<Text style={textStyle}>{rule.status==='REVIEW'?'Inspection notice':'Violation'}: {rule.error_code}{rule.status==='FAIL'&&rule.penalty_clause?` (${rule.penalty_clause})`:''}</Text>}{rule.ocr_evidence?.map((e,i)=><View key={i}><Text style={[styles.label,textStyle]}>Price OCR readings • Photo {e.photo_number}</Text>{e.readings.map((r,j)=><Text key={j} selectable style={textStyle}>{r.method}: {r.text}</Text>)}</View>)}</View>)}
            <Text selectable style={textStyle}>Evidence SHA-256: {result.evidence_sha256}</Text>
            <Button title="Translate audit" disabled={busy||!capabilities?.configured} onPress={()=>void task(async()=>{const source=Object.values(result.rules).map(r=>`${r.key}: ${r.status}\n${r.detected_value||'Not detected'}\n${r.explanation||''}`).join('\n\n');const chunks=source.match(/[\s\S]{1,1900}/g)||[];const output=[];for(const chunk of chunks)output.push((await api.translate(chunk,'en',language)).translated_text);setTranslated(output.join('\n'));setStatus('Translation is a reading aid. Original audit results are unchanged.');})}/>
            {translated?<TextInput multiline accessibilityLabel="Audit translation" value={translated} onChangeText={setTranslated} style={inputStyle}/>:null}
            <Button title="Read aloud" disabled={busy||!translated||!capabilities?.speech_languages.includes(languageCode(language))} onPress={()=>void readAloud()}/>
          </View>:<View style={[styles.panel,styles.emptyState,{backgroundColor:color.panel,borderColor:color.border}]}><Text style={styles.emptyIcon}>◎</Text><Text style={[styles.subtitle,textStyle]}>Your label story starts here.</Text><Text style={[styles.helper,{color:color.muted,textAlign:'center'}]}>Add photos and run a scan to see your review.</Text><Button title="Start a scan" onPress={()=>setTab('Scanner')}/></View>)}
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
          {filtered.map(r=><View key={r.id} style={styles.rule}><Text style={[styles.label,textStyle]}>{r.caseId} • {r.status}</Text><Text style={textStyle}>{r.brand} — {r.location}\n{r.time} • {r.area} cm²</Text><View style={styles.row}><Button title={`View ${r.caseId}`} disabled={busy} onPress={()=>void task(async()=>{setResult(await api.inspection(r.id));setTab('Results');})}/><Button title={`PDF ${r.caseId}`} onPress={()=>void pdf(r.pdf_url)}/></View></View>)}
        </View>}

      </>}
      <Text accessibilityLiveRegion="polite" style={[styles.notice,{color:color.muted,borderColor:color.border}]}>{status}</Text>
      <Text style={[styles.footer,{color:color.muted}]}>Built for clearer labels. Findings need human review.</Text>
    </ScrollView>
    </KeyboardAvoidingView>
    {session&&<SafeAreaView edges={['bottom']} style={[styles.dock,{backgroundColor:color.panel,borderColor:color.border}]}><View style={styles.dockRow}>{[['Scanner','⊞','Scan'],['Results','▤','Results'],['Advisor','☷','Advisor'],...(session.role==='OFFICER'?[['History','◷','History']]:[])].map(([name,icon,label])=><Pressable key={name} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected:tab===name}} aria-selected={tab===name} onPress={()=>setTab(name)} style={[styles.dockItem,tab===name&&{backgroundColor:color.soft}]}><Text style={[styles.dockIcon,{color:tab===name?color.text:color.muted}]}>{icon}</Text><Text style={[styles.dockLabel,{color:tab===name?color.text:color.muted}]}>{label}</Text></Pressable>)}</View></SafeAreaView>}
    <Modal visible={cameraOpen} onRequestClose={()=>setCameraOpen(false)} animationType="slide"><SafeAreaView style={styles.screen}><CameraView ref={camera} style={{flex:1}} facing="back"/><View style={styles.row}><Button title="Snap Product Frame" disabled={busy} onPress={()=>void takePhoto()}/><Button title="Close camera" onPress={()=>setCameraOpen(false)}/></View></SafeAreaView></Modal>
    <Modal visible={dialog!==null} transparent animationType="fade" onRequestClose={()=>setDialog(null)}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={styles.overlay}><View style={[styles.modal,{backgroundColor:color.panel}]}><ScrollView keyboardShouldPersistTaps="handled">
      {dialog==='settings'&&<>
        <Text style={[styles.subtitle,textStyle]}>Your workspace</Text>
        <Text style={[styles.helper,{color:color.muted}]}>Make it feel like yours.</Text>
        <Selection label="Language" value={language} values={languages} onChange={value=>{setLanguage(value);setTranslated('');void AsyncStorage.setItem('doca_language',value);}}/>
        <Button secondary title={dark?'Switch to light appearance':'Switch to dark appearance'} onPress={()=>{setDark(!dark);void AsyncStorage.setItem('doca_theme',!dark?'dark':'light');}}/>
        {session&&<><Text style={[styles.label,textStyle]}>{session.role==='OFFICER'?'Officer':'Citizen'} workspace</Text><Text style={[styles.helper,{color:color.muted}]}>{session.userIdentifier}</Text>
        <View style={styles.statRow}>{[['Scans',history.length],['Passed',history.filter(r=>r.status==='PASS').length],['Flagged',history.filter(r=>r.status==='FAIL').length]].map(([label,value])=><View key={label} style={[styles.stat,{backgroundColor:color.soft}]}><Text style={[styles.statValue,textStyle]}>{value}</Text><Text style={[styles.helper,{color:color.muted}]}>{label}</Text></View>)}</View>
        <Button secondary title="Switch account" onPress={()=>{setSession(null);setPhotos([]);setResult(null);setTab('Scanner');setDialog(null);}}/>
        <Button secondary title={dict.viewRulesBtn} onPress={()=>setDialog('rules')}/></>}
        <Text style={[styles.label,textStyle]}>Connection</Text><Text style={[styles.helper,{color:color.muted}]}>Use your hosted backend, or a LAN address for local testing.</Text>
        <TextInput accessibilityLabel="Backend URL" autoCapitalize="none" style={inputStyle} value={apiDraft} onChangeText={setApiDraft}/>
        <Button title="Save backend URL" onPress={()=>void task(async()=>{createClient(apiDraft);setApiUrl(apiDraft.replace(/\/$/,''));await AsyncStorage.setItem('metrology_api',apiDraft);setDialog(null);})}/>
        <Button secondary title="API docs" onPress={()=>void Linking.openURL(api.url('/docs'))}/>
        <Button secondary title="National Consumer Helpline" onPress={()=>void Linking.openURL('https://consumerhelpline.gov.in/')}/>
      </>}
      {dialog==='rules'&&<><Text style={[styles.subtitle,textStyle]}>PCR 2011 Rules Reference</Text>{(rules?.rules||[]).map((r:any)=><View key={r.key||r.rule_key} style={styles.rule}><Text style={[styles.label,textStyle]}>{r.title} • {r.rule_reference||r.rule_ref}</Text><Text style={textStyle}>{r.description}</Text></View>)}{!rules&&<Text style={textStyle}>Connect the backend to load the rules.</Text>}</>}
      {dialog==='tour'&&<><Text style={[styles.subtitle,textStyle]}>Step {tourStep+1} of {tours.length}</Text><Text style={textStyle}>{tours[tourStep]}</Text><Button title={tourStep===tours.length-1?'Finish tour':'Next step'} onPress={()=>{if(tourStep===tours.length-1){setDialog(null);void AsyncStorage.setItem('doca_tour_done','true');}else setTourStep(s=>s+1);}}/></>}
      {dialog==='draft'&&<><Text style={[styles.subtitle,textStyle]}>Prepare a Complaint Draft</Text><Text style={textStyle}>No email or official complaint is sent. Review and submit your report through the National Consumer Helpline.</Text><Selection label="Recipient" value={target} values={[["LOCAL_BODY","Local authority"],["STATE_COMMISSION","State commission"],["MANUFACTURER","Manufacturer"]]} onChange={setTarget}/><TextInput accessibilityLabel="Recipient email" style={inputStyle} value={contact} autoCapitalize="none" onChangeText={setContact} placeholder="Recipient email" placeholderTextColor="#75849a"/><Button title="Prepare draft" disabled={busy} onPress={()=>void task(async()=>{if(!result||!session)return;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))throw new Error('Enter a valid recipient email.');const form=new FormData();Object.entries({case_id:`DoCA-LM-2026-${String(result.inspection_id).padStart(4,'0')}`,sender_id:session.userIdentifier,recipient_type:target,recipient_contact:contact}).forEach(([k,v])=>form.append(k,v));const draft=await api.draft(form);setStatus(`${draft.reference_id}: ${draft.message}`);setDialog(null);})}/></>}
      <Button title="Close" onPress={()=>setDialog(null)}/>
    </ScrollView></View></KeyboardAvoidingView></Modal>

  </SafeAreaView></UITheme.Provider>;
}

export default function App(){return <SafeAreaProvider><MobileApp/></SafeAreaProvider>;}
const styles=StyleSheet.create({
  screen:{flex:1},content:{padding:16,gap:18,paddingBottom:24,maxWidth:760,width:'100%',alignSelf:'center'},
  header:{paddingHorizontal:20,paddingVertical:12,borderBottomWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  brand:{flexDirection:'row',gap:10,alignItems:'center'},brandIcon:{width:34,height:34,borderRadius:10,backgroundColor:'#17684e',alignItems:'center',justifyContent:'center'},brandGlyph:{fontSize:28,color:'#fff',lineHeight:30},wordmark:{fontSize:24,fontWeight:'800',letterSpacing:-1.2},connectionDot:{fontSize:10},iconButton:{width:44,height:44,borderWidth:1,borderRadius:13,alignItems:'center',justifyContent:'center'},more:{fontSize:17,letterSpacing:2},
  intro:{paddingHorizontal:4,paddingTop:12,paddingBottom:8,gap:10},eyebrow:{fontSize:9,fontWeight:'700',letterSpacing:1.6},heroTitle:{fontSize:35,fontWeight:'600',letterSpacing:-1.6,lineHeight:43},heroItalic:{fontFamily:Platform.OS==='ios'?'Georgia':Platform.OS==='web'?'Georgia, serif':'serif',fontStyle:'italic',fontWeight:'400',color:'#488767'},helper:{fontSize:12,lineHeight:19},subtitle:{fontSize:20,fontWeight:'600',letterSpacing:-.5,lineHeight:28},label:{fontWeight:'700',fontSize:12,lineHeight:19},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},
  panel:{padding:20,borderRadius:22,gap:16,borderWidth:1,borderColor:'#dfe6df'},button:{borderWidth:1,borderRadius:12,minHeight:48,paddingHorizontal:16,paddingVertical:13,alignItems:'center',justifyContent:'center',marginVertical:2},buttonText:{fontSize:12,fontWeight:'700',lineHeight:19,textAlign:'center'},input:{borderWidth:1,borderRadius:10,padding:14,minHeight:50,fontSize:16,marginVertical:2},notice:{padding:12,fontSize:11,lineHeight:18,borderTopWidth:1},
  captureZone:{borderWidth:1,borderStyle:'dashed',borderRadius:16,paddingVertical:28,paddingHorizontal:16,alignItems:'center',gap:8},captureIcon:{width:54,height:54,borderRadius:17,alignItems:'center',justifyContent:'center',marginBottom:4},captureActions:{flexDirection:'row',gap:10,justifyContent:'space-between'},photo:{borderRadius:14,padding:7,gap:6,borderWidth:1},removePhoto:{position:'absolute',top:4,right:4,width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:'#173f30cc'},
  segment:{flexDirection:'row',padding:4,borderRadius:12,gap:3},segmentButton:{flex:1,minHeight:44,paddingHorizontal:6,paddingVertical:12,borderRadius:9,alignItems:'center',justifyContent:'center'},segmentActive:{backgroundColor:'#17684e'},segmentText:{fontSize:11,fontWeight:'700'},disclosure:{borderWidth:1,borderRadius:12,padding:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},settingsFields:{gap:12},sampleLink:{minHeight:48,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  rule:{borderWidth:1,borderColor:'#9cb6a4',borderRadius:12,padding:14,marginVertical:5,gap:8},emptyState:{alignItems:'center',paddingVertical:44},emptyIcon:{fontFamily:'serif',fontSize:64,color:'#a5bdae'},footer:{fontSize:10,textAlign:'center',lineHeight:18,marginVertical:10},
  dock:{borderTopWidth:1},dockRow:{flexDirection:'row',paddingHorizontal:14,paddingVertical:8,gap:6},dockItem:{flex:1,minHeight:52,alignItems:'center',justifyContent:'center',gap:2,borderRadius:12},dockIcon:{fontSize:23,lineHeight:26},dockLabel:{fontSize:10,fontWeight:'600'},
  welcomeCard:{backgroundColor:'#173f30',padding:28,borderRadius:24,gap:8,marginTop:12},welcomeEyebrow:{fontSize:8,letterSpacing:1.6,color:'#c5dccc',marginBottom:16},welcomeTitle:{fontSize:30,fontWeight:'500',letterSpacing:-1,color:'#fff'},welcomeItalic:{fontFamily:Platform.OS==='ios'?'Georgia':'serif',fontSize:32,fontStyle:'italic',color:'#cce3b7'},welcomeNote:{marginTop:18,paddingTop:16,borderTopWidth:1,borderColor:'#87b79b33',fontSize:9,color:'#c5dccc'},
  statRow:{flexDirection:'row',gap:10,marginVertical:16},stat:{flex:1,padding:12,borderRadius:12,gap:4},statValue:{fontSize:24,fontWeight:'600'},overlay:{flex:1,backgroundColor:'#122a20bb',justifyContent:'center',padding:18},modal:{borderRadius:22,padding:22,maxHeight:'88%',width:'100%',maxWidth:640,alignSelf:'center'},
});
