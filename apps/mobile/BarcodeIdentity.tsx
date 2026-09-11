import {useEffect,useState} from 'react';
import {Linking,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {type BarcodeIdentity as Identity, type createClient} from '@metrology/core';

type Theme={text:string;panel:string;border:string;muted:string;soft:string};
const names={wording_found:'Wording found in label',needs_review:'Review label wording',not_available:'Not supplied by lookup'};

export default function BarcodeIdentity({api,caseId,color}:{api:ReturnType<typeof createClient>;caseId:number;color:Theme}){
  const [data,setData]=useState<Identity|null>(null);
  const [message,setMessage]=useState('Reading barcodes from saved photos…');
  const [gtin,setGtin]=useState('');const [registryGtin,setRegistryGtin]=useState('');
  const [company,setCompany]=useState('');const [product,setProduct]=useState('');const [brand,setBrand]=useState('');
  const [outcome,setOutcome]=useState<'found'|'not_found'>('found');
  const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);
  const [expanded,setExpanded]=useState(false);const [showText,setShowText]=useState(false);const [attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;api.barcodeIdentity(caseId).then(value=>{if(active){setData(value);setGtin(value.barcodes[0]?.gtin||'');setMessage(value.barcodes.length?'Barcode decoded. Registration has not been checked automatically.':'No supported barcode decoded. Enter the printed GTIN; it will be recorded as manual entry.');}}).catch(error=>{if(active)setMessage(error.message);});return()=>{active=false;};},[api,caseId,attempt]);
  const text={color:color.text};const muted={color:color.muted};
  function button(title:string,action:()=>void,disabled=false){return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={action} style={[styles.button,{backgroundColor:color.soft,borderColor:color.border,opacity:disabled?.45:1}]}><Text style={[text,styles.bold]}>{title}</Text></Pressable>;}
  function field(label:string,value:string,set:(v:string)=>void,numeric=false){return <View style={styles.group}><Text style={[text,styles.bold]}>{label}</Text><TextInput accessibilityLabel={label} value={value} editable={!busy} onChangeText={v=>{set(v);setConfirmed(false);}} keyboardType={numeric?'number-pad':'default'} autoCorrect={false} maxLength={numeric?32:200} style={[styles.input,{color:color.text,borderColor:color.border,backgroundColor:color.panel}]}/></View>;}
  async function compare(){setBusy(true);setMessage('Comparing with the saved label text…');try{setData(await api.compareBarcode(caseId,{gtin,registry_gtin:registryGtin,outcome,company,product,brand,confirmed:true}));setMessage('Comparison saved to this inspection.');setConfirmed(false);}catch(error){setMessage(error instanceof Error?error.message:'Comparison could not be saved.');}finally{setBusy(false);}}
  return <View style={[styles.card,{borderColor:color.border}]}>
    <Text style={[styles.kicker,muted]}>BEHIND THE BARCODE</Text><Text accessibilityRole="header" style={[styles.title,text]}>Check its registered identity.</Text><Text style={muted}>Compare GS1’s company and product details with your label.</Text><Text accessibilityLiveRegion="polite" style={[text,styles.note,{backgroundColor:color.soft}]}>{message}</Text>
    {!data&&button('Retry barcode check',()=>setAttempt(attempt+1))}
    {data&&<>
      {data.barcodes.map(code=><View key={code.gtin}>{button(`${code.gtin} · ${gtin===code.gtin?'Selected':'Select'}`,()=>{setGtin(code.gtin);setRegistryGtin('');setCompany('');setProduct('');setBrand('');setConfirmed(false);},busy)}<Text style={muted}>{code.format} · Photo {code.photo_numbers.join(', ')}</Text></View>)}
      {!data.barcodes.length&&field('Printed barcode GTIN',gtin,setGtin,true)}
      <Text selectable style={[styles.code,text]}>{gtin}</Text><Text style={muted}>Long press the digits to copy. A valid check digit does not confirm registration.</Text>
      {button('Open Verified by GS1 ↗',()=>{void Linking.openURL('https://www.gs1.org/services/verified-by-gs1').catch(()=>setMessage('Could not open GS1. Try again in your browser.'));})}
      <Text style={muted}>Free public lookup: up to 30 searches per day. Automated lookup needs GS1 API access. This app does not send your photos or barcode to GS1.</Text>
      {button(expanded?'Hide comparison form':'Compare GS1 result with label',()=>setExpanded(!expanded))}
      {expanded&&<View style={styles.group}>
        {field('GTIN shown in GS1 result',registryGtin,setRegistryGtin,true)}
        {button(outcome==='found'?'Result: Company / product information':'Result: No record returned',()=>{setOutcome(outcome==='found'?'not_found':'found');setConfirmed(false);},busy)}
        {outcome==='found'&&<>{field('Registered company / licensee',company,setCompany)}{field('Product description, if available',product,setProduct)}{field('Brand, if available',brand,setBrand)}</>}
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:confirmed}} disabled={busy} onPress={()=>setConfirmed(!confirmed)} style={[styles.button,{borderColor:color.border}]}><Text style={text}>{confirmed?'☑':'☐'} I checked this GTIN on GS1 and copied its result accurately.</Text></Pressable>
        {button(busy?'Comparing…':'Compare with label',()=>{void compare();},busy||!confirmed||!gtin||!registryGtin)}
      </View>}
      {data.reviews.map(review=><View key={review.gtin} style={[styles.card,{borderColor:color.border}]}>
        <Text style={[styles.kicker,muted]}>REVIEWER-ENTERED GS1 RESULT</Text><Text style={[styles.bold,text]}>{review.gtin} · {review.status==='available_wording_found'?'Available wording found':'Needs review'}</Text>
        <Text style={muted}>{review.registry_outcome==='not_found'?'You recorded no result. This does not prove the product is invalid or counterfeit.':'The licensee may differ from the manufacturer, importer or brand. Check the relationship.'}</Text>
        {Object.entries(review.comparison).map(([key,value])=><View key={key} style={styles.group}><Text style={[styles.bold,text]}>{key.toUpperCase()}</Text><Text selectable style={text}>{value.registry_value||'Not available'}</Text><Text style={muted}>{names[value.status]}{value.evidence.length?` · Photo ${value.evidence.map(e=>e.photo_number).join(', ')}`:''}</Text>{value.status==='needs_review'&&<Text style={muted}>No exact wording found in OCR. Inspect the original photo.</Text>}</View>)}
        <Text style={muted}>{new Date(review.checked_at).toLocaleString()} · {review.barcode_source==='decoded_photo'?'Decoded from photo':'Entered manually'}</Text>
      </View>)}
      {button(showText?'Hide captured label text':'View captured label text',()=>setShowText(!showText))}
      {showText&&data.label_photos.map(photo=><View key={photo.photo_number}><Text style={[text,styles.bold]}>Photo {photo.photo_number}</Text><Text selectable style={text}>{photo.text}</Text></View>)}
      <Text style={muted}>{data.notice}</Text>
    </>}
  </View>;
}
const styles=StyleSheet.create({card:{borderWidth:1,borderRadius:16,padding:16,gap:14},group:{gap:8},title:{fontSize:23,fontWeight:'600',letterSpacing:-.6},kicker:{fontSize:10,fontWeight:'700',letterSpacing:1.4},bold:{fontWeight:'600',fontSize:14},note:{padding:12,borderRadius:10,lineHeight:21},code:{fontSize:22,fontWeight:'600',letterSpacing:1},button:{minHeight:46,borderWidth:1,borderRadius:10,padding:12,justifyContent:'center'},input:{minHeight:48,borderWidth:1,borderRadius:10,padding:12,fontSize:16}});
