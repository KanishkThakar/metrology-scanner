"""Sarvam contract and failure tests; no paid provider requests are made."""
import base64
import os
import unittest
from unittest.mock import patch
import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from language import router

app = FastAPI()
app.include_router(router)


class LanguageTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.env = patch.dict(os.environ, {'SARVAM_API_KEY': ''})
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def test_unconfigured_does_not_fake_translation(self):
        self.assertFalse(self.client.get('/api/language/capabilities').json()['configured'])
        result = self.client.post('/api/language/translate', json={'text':'MRP Rs 99', 'target_language_code':'hi-IN'})
        self.assertEqual(result.status_code, 503)
        self.assertNotIn('translated_text', result.json())

    def test_rejects_unsupported_languages_and_oversize_text(self):
        for body in [{'text':'test','target_language_code':'xx-IN'}, {'text':'x'*2001,'target_language_code':'hi-IN'}, {'text':'   ','target_language_code':'hi-IN'}]:
            self.assertEqual(self.client.post('/api/language/translate',json=body).status_code,422)

    def test_sarvam_request_contracts(self):
        captured = []
        wav = base64.b64encode(b'RIFF\x24\x00\x00\x00WAVEfmt ').decode()
        async def send(request):
            captured.append(request)
            if request.url.path == '/translate': return httpx.Response(200,json={'translated_text':'कीमत ₹99'})
            if request.url.path == '/text-to-speech': return httpx.Response(200,json={'audios':[wav]})
            return httpx.Response(200,json={'transcript':'कीमत क्या है', 'language_code':'hi-IN'})
        original = httpx.AsyncClient
        with patch.dict(os.environ, {'SARVAM_API_KEY':'test-only-not-a-secret'}), patch('language.httpx.AsyncClient',side_effect=lambda **kw: original(transport=httpx.MockTransport(send),**kw)):
            self.assertEqual(self.client.post('/api/language/translate',json={'text':'Price 99','target_language_code':'hi-IN'}).json()['translated_text'],'कीमत ₹99')
            self.assertEqual(self.client.post('/api/language/speak',json={'text':'कीमत ₹99','language_code':'hi-IN'}).json()['audios'],[wav])
            self.assertEqual(self.client.post('/api/language/transcribe',files={'file':('voice.m4a',b'audio','audio/mp4')},data={'language_code':'hi-IN'}).json()['transcript'],'कीमत क्या है')
        self.assertEqual([r.url.path for r in captured],['/translate','/text-to-speech','/speech-to-text'])
        self.assertTrue(all(r.url.host == 'api.sarvam.ai' for r in captured))
        self.assertTrue(all(r.headers['api-subscription-key']=='test-only-not-a-secret' for r in captured))
        self.assertIn(b'"language_code":"hi-IN"',captured[1].content)
        self.assertIn(b'name="file"',captured[2].content)

    def test_provider_errors_are_bounded_and_do_not_leak_body(self):
        for code,expected in [(401,503),(429,429),(500,502),(200,502)]:
            original = httpx.AsyncClient
            transport=httpx.MockTransport(lambda req:httpx.Response(code,json={'secret':'do-not-echo'}))
            with patch.dict(os.environ,{'SARVAM_API_KEY':'test-only'}),patch('language.httpx.AsyncClient',side_effect=lambda **kw:original(transport=transport,**kw)):
                response=self.client.post('/api/language/translate',json={'text':'price','target_language_code':'hi-IN'})
            self.assertEqual(response.status_code,expected)
            self.assertNotIn('do-not-echo',response.text)

    def test_audio_validation(self):
        with patch.dict(os.environ,{'SARVAM_API_KEY':'test-only'}):
            self.assertEqual(self.client.post('/api/language/transcribe',files={'file':('x.txt',b'text','text/plain')}).status_code,415)
            self.assertEqual(self.client.post('/api/language/speak',json={'text':'hello','language_code':'ur-IN'}).status_code,422)


if __name__ == '__main__':
    unittest.main()
