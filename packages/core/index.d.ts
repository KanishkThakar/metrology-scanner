export type Status = 'PASS' | 'FAIL' | 'REVIEW' | 'EXEMPT';
export interface Rule { key: string; rule_ref: string; status: Status; compliant: boolean; detected_value: string | null; explanation?: string; error_code?: string; penalty_clause?: string; ocr_evidence?: {photo_number: number; readings: {method?: string; text: string}[]}[]; }
export interface ScanResult { inspection_id: number; compliance_status: Status; is_compliant: boolean; rules: Record<string, Rule>; photo_count: number; photos: {photo_number:number; image_url:string; sha256:string; text?:string}[]; detections: {text:string; bbox:number[][]; photo_number:number}[]; symbols: {name:string; bbox?:number[][]}[]; image_url:string; report_pdf_url:string; total_violations:number; extracted_text?:string; evidence_sha256?:string; brand?:string; category?:string; }
export interface Inspection { id:number; caseId:string; time:string; userRole:string; userIdentifier:string; brand:string; location:string; status:Status; violations:string; pdf_url:string; area?:number; category?:string; }
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
  rules():Promise<any>;
  presets():Promise<Preset[]>;
  chat(query:string):Promise<{answer:string}>;
  draft(form:FormData):Promise<{status:string;message:string;reference_id:string}>;
  translate(text:string,source:string,target:string):Promise<{translated_text:string}>;
  speak(text:string,language:string):Promise<{audios:string[];mime_type:string}>;
  transcribe(form:FormData):Promise<{transcript:string;language_code:string}>;
};
