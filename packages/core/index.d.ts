export type Status = 'PASS' | 'FAIL' | 'REVIEW' | 'EXEMPT';
export interface Rule { key: string; rule_ref: string; status: Status; compliant: boolean; detected_value: string | null; explanation?: string; error_code?: string; penalty_clause?: string; ocr_evidence?: {photo_number: number; readings: {method?: string; text: string}[]}[]; }
export interface ScanResult { inspection_id: number; compliance_status: Status; is_compliant: boolean; rules: Record<string, Rule>; photo_count: number; photos: {photo_number:number; image_url:string; sha256:string; text?:string}[]; detections: {text:string; bbox:number[][]; photo_number:number}[]; symbols: {name:string; bbox?:number[][]}[]; image_url:string; report_pdf_url:string; total_violations:number; extracted_text?:string; evidence_sha256?:string; brand?:string; category?:string; }
export interface Inspection { id:number; caseId:string; time:string; userRole:string; userIdentifier:string; brand:string; location:string; status:Status; violations:string; pdf_url:string; area?:number; category?:string; }
export interface BarcodeReviewInput { gtin:string; registry_gtin:string; outcome:'found'|'not_found'; company:string; product:string; brand:string; confirmed:true; }
export interface BarcodeComparison { registry_value:string; status:'not_available'|'wording_found'|'needs_review'; evidence:{photo_number:number;text:string}[]; }
export interface BarcodeReview { gtin:string; registry_gtin:string; registry_source:'reviewer_entered'; barcode_source:'decoded_photo'|'manually_entered'; registry_outcome:'found'|'not_found'; api_verified:false; checked_at:string; status:'needs_review'|'available_wording_found'; comparison:Record<string,BarcodeComparison>; notice:string; source_url:string; }
export interface BarcodeIdentity { inspection_id:number; evidence_sha256:string; barcodes:{gtin:string;format:string;photo_numbers:number[]}[]; label_photos:{photo_number:number;text:string}[]; reviews:BarcodeReview[]; lookup_url:string; access_mode:'manual_lookup'; api_connected:false; notice:string; decoder:string; }
export interface Preset {id:string; title:string; category:string; pdp_area:number; image_url:string; highlight:string;}
export interface Capabilities { configured:boolean; provider:string; translation_languages:string[]; speech_languages:string[]; message:string; }
export const MAX_PHOTOS: number;
export const MAX_PHOTO_BYTES: number;
export const MAX_TOTAL_BYTES: number;
export const languages: [string,string][];
export const categories: string[];
export function languageCode(language:string): string;
export function validatePhotos(photos:{size?:number;fileSize?:number}[]): void;
export function createClient(baseUrl:string,fetcher?:typeof fetch): {
  url(path:string):string;
  request(path:string,options?:RequestInit,timeout?:number):Promise<any>;
  health():Promise<any>;
  capabilities():Promise<Capabilities>;
  scan(form:FormData):Promise<ScanResult>;
  history():Promise<Inspection[]>;
  inspection(id:number):Promise<ScanResult>;
  barcodeIdentity(id:number):Promise<BarcodeIdentity>;
  compareBarcode(id:number,review:BarcodeReviewInput):Promise<BarcodeIdentity>;
  rules():Promise<any>;
  presets():Promise<Preset[]>;
  chat(query:string):Promise<{answer:string}>;
  draft(form:FormData):Promise<{status:string;message:string;reference_id:string}>;
  translate(text:string,source:string,target:string):Promise<{translated_text:string}>;
  speak(text:string,language:string):Promise<{audios:string[];mime_type:string}>;
  transcribe(form:FormData):Promise<{transcript:string;language_code:string}>;
};
