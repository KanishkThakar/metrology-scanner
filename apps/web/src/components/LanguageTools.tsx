'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, languageCode, type Capabilities } from '@metrology/core';

export default function LanguageTools({ apiUrl }: { apiUrl: string }) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [language, setLanguage] = useState('en');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('Checking language service…');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<string[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const client = () => createClient(apiUrl || (location.protocol === 'https:' ? location.origin : `http://${location.hostname}:8000`));

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    client().capabilities().then(data => { if (!cancelled) { setCapabilities(data); setMessage(data.message); } })
      .catch(() => { if (!cancelled) setMessage('Language service is unavailable. Existing scanning and language labels are unaffected.'); });
    const selector = document.getElementById('languageSelector') as HTMLSelectElement | null;
    const change = () => { setLanguage(selector?.value || 'en'); setText(''); setAudio([]); };
    selector?.addEventListener('change', change);
    return () => {
      cancelled = true; alive.current = false;
      selector?.removeEventListener('change', change);
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === 'recording') recorder.current.stop();
      recorder.current?.stream.getTracks().forEach(track => track.stop());
    };
  }, [apiUrl]); // apiUrl is the server-provided origin, never a provider key.

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('Working…');
    try { await action(); setMessage('Ready. Original OCR evidence and audit results are unchanged.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Language request failed.'); }
    finally { setBusy(false); }
  }

  async function record() {
    if (recording) { recorder.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setMessage('Audio recording is not supported in this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      if (!alive.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const mime = ['audio/webm','audio/mp4','audio/ogg'].find(m => MediaRecorder.isTypeSupported(m));
      const capture = new MediaRecorder(stream, mime ? {mimeType:mime} : undefined);
      recorder.current = capture;
      const chunks: Blob[] = [];
      capture.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      capture.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        stream.getTracks().forEach(track => track.stop());
        if (!alive.current) return;
        setRecording(false);
        void run(async () => {
          const form = new FormData();
          form.append('file', new Blob(chunks,{type:capture.mimeType}), 'recording');
          form.append('language_code',languageCode(language));
          const result = await client().transcribe(form);
          setText(result.transcript);
          const input = document.getElementById('chatTextInput') as HTMLInputElement | null;
          if (input) input.value = result.transcript;
        });
      };
      capture.start(); setRecording(true); setMessage('Recording… stop when finished (maximum 28 seconds).');
      timer.current = setTimeout(() => { if (capture.state === 'recording') capture.stop(); },28000);
    } catch { setMessage('Microphone access was denied or the microphone is unavailable.'); }
  }

  return <details className="language-tools">
    <summary>Language &amp; voice</summary>
    <p role="status">{message}</p>
    <p>Use the language selector above. Translations are reading aids; the original audit remains the source.</p>
    <div className="language-actions">
      <button className="btn-secondary" disabled={busy || recording || !capabilities?.configured} onClick={() => run(async () => {
        const source = document.getElementById('rulesList')?.innerText.trim();
        if (!source) throw new Error('Run a scan first.');
        const chunks = source.match(/[\s\S]{1,1900}/g) || [];
        const results = [];
        for (const chunk of chunks) results.push((await client().translate(chunk,'en',language)).translated_text);
        setText(results.join('\n')); setAudio([]);
      })}>Translate audit</button>
      <button className="btn-secondary" disabled={busy || !capabilities?.configured} onClick={record}>{recording ? 'Stop recording' : 'Record speech'}</button>
      <button className="btn-secondary" disabled={busy || recording || !capabilities?.configured || !text.trim()} onClick={() => run(async () => {
        if (!capabilities?.speech_languages.includes(languageCode(language))) throw new Error('Speech output is unavailable in this language.');
        const chunks = text.match(/[\s\S]{1,2400}/g) || [];
        const output: string[] = [];
        for (const chunk of chunks) output.push(...(await client().speak(chunk,language)).audios);
        setAudio(output);
      })}>Read aloud</button>
    </div>
    <label htmlFor="languageText">Translation or transcribed speech</label>
    <textarea id="languageText" rows={5} value={text} maxLength={16000} onChange={e => {setText(e.target.value); setAudio([]);}} />
    {audio.map((data,index) => <audio key={index} controls src={`data:audio/wav;base64,${data}`} aria-label={`Speech segment ${index+1}`} />)}
  </details>;
}
