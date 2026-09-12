"""Optional Sarvam language services. OCR and compliance never depend on these."""
import base64
import os
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from provider_limits import provider_budget

router = APIRouter(prefix='/api/language', tags=['Language and speech'])
Language = Literal['en-IN', 'hi-IN', 'te-IN', 'ta-IN', 'kn-IN', 'ml-IN',
                   'mr-IN', 'gu-IN', 'bn-IN', 'pa-IN', 'od-IN', 'ur-IN']
LANGUAGES = list(Language.__args__)
SPEECH_LANGUAGES = [code for code in LANGUAGES if code != 'ur-IN']
SARVAM_ORIGIN = 'https://api.sarvam.ai'


class TranslationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    text: str = Field(min_length=1, max_length=2000)
    source_language_code: Language = 'en-IN'
    target_language_code: Language


class SpeechRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    text: str = Field(min_length=1, max_length=2500)
    language_code: Language
    speaker: Literal['shubh','ritu','priya','aditya'] = 'shubh'


def require_key():
    key = os.getenv('SARVAM_API_KEY', '').strip()
    if not key:
        raise HTTPException(503, detail='Sarvam language services are not configured. Scanning and the built-in language labels remain available.')
    return key


async def sarvam_request(path, **kwargs):
    key = require_key()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(50, connect=10)) as client:
            response = await client.post(SARVAM_ORIGIN + path, headers={'api-subscription-key': key}, **kwargs)
        if response.status_code == 429:
            raise HTTPException(429, detail='Sarvam is busy or its quota is exhausted. Please try again later.')
        if response.status_code in (401, 403):
            raise HTTPException(503, detail='Sarvam credentials need attention. Scanning is still available.')
        if response.status_code >= 400:
            raise HTTPException(502, detail='Sarvam could not process this request. Please try clearer audio or shorter text.')
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError('Invalid response')
        return result
    except httpx.TimeoutException:
        raise HTTPException(504, detail='Sarvam timed out. Scanning is still available.') from None
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, detail='Sarvam returned an unavailable or unreadable response.') from None


@router.get('/capabilities')
def capabilities():
    configured = bool(os.getenv('SARVAM_API_KEY', '').strip())
    return {'provider': 'Sarvam', 'configured': configured,
            'translation_languages': LANGUAGES, 'speech_languages': SPEECH_LANGUAGES,
            'message': 'Sarvam configured; availability checked when used.' if configured else
                       'Sarvam key not configured. Built-in language labels and scanning still work.'}


@router.post('/translate', dependencies=[Depends(provider_budget)])
async def translate(body: TranslationRequest):
    if body.source_language_code == body.target_language_code:
        return {'translated_text': body.text, 'provider': 'identity', 'source_language_code': body.source_language_code}
    result = await sarvam_request('/translate', json={
        'input': body.text, 'source_language_code': body.source_language_code,
        'target_language_code': body.target_language_code,
        'model': 'sarvam-translate:v1', 'mode': 'formal',
    })
    text = result.get('translated_text')
    if not isinstance(text, str) or not text.strip() or len(text) > 16000:
        raise HTTPException(502, detail='Sarvam returned no usable translation.')
    return {'translated_text': text, 'provider': 'Sarvam', 'source_language_code': body.source_language_code}


@router.post('/speak', dependencies=[Depends(provider_budget)])
async def speak(body: SpeechRequest):
    if body.language_code not in SPEECH_LANGUAGES:
        raise HTTPException(422, detail='Speech output is not available in this language. Text translation is still supported.')
    result = await sarvam_request('/text-to-speech', json={
        'text': body.text, 'language_code': body.language_code, 'model': 'bulbul:v3',
        'speaker': body.speaker, 'speech_sample_rate': 24000, 'output_audio_codec': 'wav',
    })
    audios = result.get('audios')
    try:
        if not isinstance(audios, list) or not 1 <= len(audios) <= 8:
            raise ValueError()
        for audio in audios:
            if not isinstance(audio, str) or len(audio) > 12000000:
                raise ValueError()
            decoded = base64.b64decode(audio, validate=True)
            if decoded[:4] != b'RIFF' or decoded[8:12] != b'WAVE':
                raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(502, detail='Sarvam returned no playable speech.') from None
    return {'audios': audios, 'mime_type': 'audio/wav', 'provider': 'Sarvam'}


@router.post('/transcribe', dependencies=[Depends(provider_budget)])
async def transcribe(file: UploadFile = File(...), language_code: str = Form('en-IN')):
    require_key()
    if language_code not in LANGUAGES + ['unknown']:
        raise HTTPException(422, detail='Choose a supported speech language or automatic detection.')
    data = await file.read(4 * 1024 * 1024 + 1)
    if not data or len(data) > 4 * 1024 * 1024:
        raise HTTPException(413, detail='Record up to 30 seconds of audio, smaller than 4 MB.')
    mime = (file.content_type or '').split(';')[0]
    extensions = {'audio/wav':'wav', 'audio/x-wav':'wav', 'audio/webm':'webm',
                  'audio/mp4':'m4a', 'audio/m4a':'m4a', 'audio/x-m4a':'m4a',
                  'audio/mpeg':'mp3', 'audio/ogg':'ogg', 'video/mp4':'mp4'}
    if mime not in extensions:
        raise HTTPException(415, detail='Use a WAV, WebM, M4A, MP3 or OGG audio recording.')
    result = await sarvam_request('/speech-to-text',
        files={'file': ('recording.' + extensions[mime], data, mime)},
        data={'model':'saaras:v3', 'language_code': language_code, 'mode':'transcribe'})
    transcript = result.get('transcript')
    if not isinstance(transcript, str) or not transcript.strip() or len(transcript) > 16000:
        raise HTTPException(502, detail='No clear speech was transcribed. Please try again.')
    return {'transcript': transcript, 'language_code': result.get('language_code', language_code), 'provider':'Sarvam'}
