'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient, type BarcodeIdentity as Identity, type BarcodeReviewInput } from '@metrology/core';

const GS1 = 'https://www.gs1.org/services/verified-by-gs1';
const statusLabel = {wording_found:'Wording found in label',needs_review:'Review label wording',not_available:'Not supplied by lookup'};

export default function BarcodeIdentity({apiUrl}:{apiUrl:string}) {
  const [caseId,setCaseId] = useState<number|null>(null);
  useEffect(()=>{
    const receive=(event:Event)=>setCaseId((event as CustomEvent<{inspection_id:number}>).detail.inspection_id);
    window.addEventListener('nyayalens:inspection',receive);
    return ()=>window.removeEventListener('nyayalens:inspection',receive);
  },[]);
  return <section className="barcode-identity" aria-labelledby="barcodeIdentityTitle" id="barcodeIdentity">
    <div className="barcode-title"><svg viewBox="0 0 32 24" fill="none" aria-hidden="true"><path d="M2 2v20M6 2v20M11 2v20M14 2v20M20 2v20M24 2v20M30 2v20" stroke="currentColor" strokeWidth="2"/></svg><div><span className="section-kicker">BEHIND THE BARCODE</span><h3 id="barcodeIdentityTitle">Check its registered identity.</h3></div></div>
    <p>Compare the barcode’s registered company and product details with the text on your package.</p>
    {caseId ? <IdentityCheck key={`${apiUrl}:${caseId}`} apiUrl={apiUrl} caseId={caseId}/> : <p className="barcode-note">Run a package scan first. Its barcodes and label text will appear here for comparison.</p>}
  </section>;
}

function IdentityCheck({apiUrl,caseId}:{apiUrl:string;caseId:number}) {
  const api=useMemo(()=>createClient(apiUrl || (location.protocol==='https:'?location.origin:`http://${location.hostname}:8000`)),[apiUrl]);
  const [data,setData]=useState<Identity|null>(null);
  const [message,setMessage]=useState('Reading barcodes from your saved photos…');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [gtin,setGtin]=useState('');
  const [registryGtin,setRegistryGtin]=useState('');
  const [outcome,setOutcome]=useState<'found'|'not_found'>('found');
  const [company,setCompany]=useState('');
  const [product,setProduct]=useState('');
  const [brand,setBrand]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    api.barcodeIdentity(caseId).then(value=>{if(active){setData(value);setGtin(value.barcodes[0]?.gtin||'');setMessage(value.barcodes.length?'Barcode decoded. Registration has not been checked automatically.':'No supported barcode decoded. Enter its printed GTIN below; this will be recorded as manual entry.');}})
      .catch(error=>{if(active)setMessage(error.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[api,caseId,attempt]);
  function changeGtin(value:string){setGtin(value);setRegistryGtin('');setCompany('');setProduct('');setBrand('');setConfirmed(false);}
  async function compare(event:React.FormEvent){
    event.preventDefault();setBusy(true);setMessage('Comparing with the saved label text…');
    try{
      const review:BarcodeReviewInput={gtin,registry_gtin:registryGtin,outcome,company,product,brand,confirmed:true};
      setData(await api.compareBarcode(caseId,review));setMessage('Comparison saved to this inspection. Review the evidence below.');setConfirmed(false);
    }catch(error){setMessage(error instanceof Error?error.message:'Comparison could not be saved.');}
    finally{setBusy(false);}
  }
  function download(){
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`NyayaLens-barcode-${caseId}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <>
    <strong className="barcode-case">Identity check · Inspection #{caseId}</strong>
    <p role="status" className="barcode-note">{message}</p>
    {!data&&!loading&&<button className="btn-secondary" onClick={()=>{setLoading(true);setAttempt(attempt+1);}}>Retry barcode check</button>}
    {data&&<>
      <div className="barcode-code"><label htmlFor="identityGtin">01 / Barcode on this package</label>
        {data.barcodes.length>0?<select id="identityGtin" value={gtin} onChange={e=>changeGtin(e.target.value)} disabled={busy}>{data.barcodes.map(code=><option key={code.gtin} value={code.gtin}>{code.gtin} · {code.format} · Photo {code.photo_numbers.join(', ')}</option>)}</select>:<input id="identityGtin" inputMode="numeric" maxLength={32} value={gtin} onChange={e=>changeGtin(e.target.value)} placeholder="Enter printed barcode digits" disabled={busy}/>}
        <small>A valid check digit checks the number’s structure. It does not confirm GS1 registration.</small>
      </div>
      <div className="barcode-lookup"><div><strong>02 / Look it up with GS1</strong><p>Free public lookup: up to 30 searches per day. Company details are returned when found; product information may be unavailable.</p></div>
        <div className="barcode-actions"><button className="btn-secondary" disabled={!gtin} onClick={()=>navigator.clipboard.writeText(gtin).then(()=>setMessage('Barcode copied. Paste it into the GS1 lookup.')).catch(()=>setMessage('Copy was unavailable. Select and copy the barcode digits above.'))}>Copy barcode</button><a className="btn-secondary" href={GS1} target="_blank" rel="noopener noreferrer">Open Verified by GS1 ↗</a></div>
        <small>Automated lookup requires GS1 API access. No barcode or photo is sent to GS1 by this app.</small>
      </div>
      <details className="barcode-entry"><summary>03 / Compare the GS1 result with your label</summary>
        <form onSubmit={compare}><fieldset disabled={busy}>
          <label htmlFor="registryGtin">GTIN shown in the GS1 result</label><input id="registryGtin" value={registryGtin} onChange={e=>{setRegistryGtin(e.target.value);setConfirmed(false);}} required inputMode="numeric" maxLength={32} placeholder="Enter the lookup result’s GTIN"/>
          <label htmlFor="registryOutcome">What did GS1 return?</label><select id="registryOutcome" value={outcome} onChange={e=>{setOutcome(e.target.value as 'found'|'not_found');setConfirmed(false);}}><option value="found">Company or product information</option><option value="not_found">No record returned</option></select>
          {outcome==='found'&&<><label htmlFor="registryCompany">Registered company / licensee</label><input id="registryCompany" maxLength={300} value={company} onChange={e=>{setCompany(e.target.value);setConfirmed(false);}} placeholder="Exactly as returned by GS1"/><label htmlFor="registryProduct">Product description, if available</label><input id="registryProduct" maxLength={300} value={product} onChange={e=>{setProduct(e.target.value);setConfirmed(false);}}/><label htmlFor="registryBrand">Brand, if available</label><input id="registryBrand" maxLength={200} value={brand} onChange={e=>{setBrand(e.target.value);setConfirmed(false);}}/></>}
          <label className="barcode-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/>I checked this GTIN on GS1 and copied its result accurately.</label>
          <button className="btn-primary" disabled={!confirmed||!gtin||!registryGtin}>{busy?'Comparing…':'Compare with label'}</button>
        </fieldset></form>
      </details>
      {data.reviews.map(review=><article className="barcode-review" key={review.gtin}>
        <span className="section-kicker">REVIEWER-ENTERED GS1 RESULT</span><h4>{review.gtin} · {review.status==='available_wording_found'?'Available wording found':'Needs review'}</h4>
        <p className="barcode-note">{review.registry_outcome==='not_found'?'You recorded no GS1 result. This is not proof of an invalid or counterfeit product.':'The GS1 licensee may differ from the manufacturer, importer or brand printed on the label. Check the relationship before drawing a conclusion.'}</p>
        {Object.entries(review.comparison).map(([key,value])=><div className="barcode-comparison" key={key}><strong>{key==='company'?'Company / licensee':key==='product'?'Product':'Brand'}</strong><p>{value.registry_value||'Not available'}</p><span className="barcode-status">{statusLabel[value.status]}</span>{value.evidence.map(e=><details key={e.photo_number}><summary>Label evidence · Photo {e.photo_number}</summary><pre>{e.text}</pre></details>)}{value.status==='needs_review'&&<small>No exact wording found in OCR. Inspect the original photo; OCR can miss or misread text.</small>}</div>)}
        <small>{new Date(review.checked_at).toLocaleString()} · {review.barcode_source==='decoded_photo'?'Barcode decoded from photo':'Barcode entered manually'}</small>
      </article>)}
      <details className="barcode-label"><summary>View captured label text</summary>{data.label_photos.map(photo=><div key={photo.photo_number}><strong>Photo {photo.photo_number}</strong><pre>{photo.text}</pre></div>)}</details>
      {data.reviews.length>0&&<button className="btn-secondary" onClick={download}>Download identity comparison</button>}
      <p className="barcode-disclaimer">{data.notice}</p>
    </>}
  </>;
}
