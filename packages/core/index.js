export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
export const languageCode = (language) => (language === 'or' ? 'od' : language) + '-IN';
export const languages = [
  ['en','English'],['te','తెలుగు'],['hi','हिन्दी'],['ta','தமிழ்'],
  ['kn','ಕನ್ನಡ'],['ml','മലയാളം'],['mr','मराठी'],['gu','ગુજરાતી'],
  ['bn','বাংলা'],['pa','ਪੰਜਾਬੀ'],['or','ଓଡ଼ିଆ'],['ur','اردو'],
];
export const categories = ['FOOD','DRINKS','SOAP','COSMETICS','ELECTRONICS'];

export function validatePhotos(photos) {
  if (!photos.length || photos.length > MAX_PHOTOS) throw new Error('Choose 1 to 8 photos of the same package.');
  if (photos.some(p => (p.size ?? p.fileSize ?? 0) > MAX_PHOTO_BYTES)) throw new Error('Each photo must be 15 MB or smaller.');
  if (photos.reduce((n,p) => n + (p.size ?? p.fileSize ?? 0), 0) > MAX_TOTAL_BYTES) throw new Error('The total upload must be 60 MB or smaller.');
}

export function createClient(baseUrl, fetcher = globalThis.fetch) {
  const base = baseUrl.replace(/\/$/, '');
  if (!/^https?:\/\//.test(base)) throw new Error('Set the backend URL to an HTTP or HTTPS origin.');
  const origin = new URL(base);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('Use the backend origin without a path or credentials.');
  const url = (path) => base + '/' + path.replace(/^\/+/, '');
  async function request(path, options = {}, timeout = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetcher(url(path), { ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data.error || (typeof data.detail === 'string' ? data.detail : data.detail?.message);
        throw new Error(detail || 'Backend returned HTTP ' + response.status);
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The backend took too long. Check the connection and try again.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  const json = (data) => ({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  return {
    url, request,
    health: () => request('/api/health'),
    capabilities: () => request('/api/language/capabilities'),
    scan: form => request('/api/scan', {method:'POST',body:form}, 180000),
    history: () => request('/api/inspections'),
    inspection: id => request('/api/inspections/' + encodeURIComponent(id)),
    rules: () => request('/api/rules'),
    presets: () => request('/api/presets'),
    chat: query => request('/api/advisor/chat',json({query})),
    draft: form => request('/api/complaints/dispatch',{method:'POST',body:form}),
    translate: (text, source, target) => request('/api/language/translate',json({text,source_language_code:languageCode(source),target_language_code:languageCode(target)}),60000),
    speak: (text, language) => request('/api/language/speak',json({text,language_code:languageCode(language)}),60000),
    transcribe: form => request('/api/language/transcribe',{method:'POST',body:form},60000),
  };
}
