import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, validatePhotos, languageCode } from '../packages/core/index.js';

test('mobile and web use the existing multipart scan contract', async () => {
  const body = new FormData(); body.append('files',new Blob(['image']),'photo.jpg');
  const client = createClient('https://api.example.test/', async (url,options) => {
    assert.equal(url,'https://api.example.test/api/scan');
    assert.equal(options.method,'POST'); assert.equal(options.body,body);
    assert.equal(options.headers,undefined); // Browser/native transport supplies multipart boundary.
    return Response.json({photo_count:1, rules:{mrp:{status:'REVIEW',detected_value:'₹ 99.00'}}});
  });
  assert.equal((await client.scan(body)).rules.mrp.status,'REVIEW');
});

test('validation preserves upload limits and Odia provider mapping', () => {
  assert.throws(()=>validatePhotos([])); assert.throws(()=>validatePhotos(Array(9).fill({size:1})));
  assert.throws(()=>validatePhotos([{fileSize:16*1024*1024}]));
  assert.throws(()=>validatePhotos(Array(8).fill({size:10*1024*1024})));
  assert.doesNotThrow(()=>validatePhotos([{size:20}])); assert.equal(languageCode('or'),'od-IN');
});

test('backend failures stay failures and retain useful messages', async () => {
  const api = createClient('https://api.example.test',async()=>Response.json({error:'Photo 2 is unreadable.'},{status:422}));
  await assert.rejects(api.scan(new FormData()),/Photo 2 is unreadable/);
  assert.throws(()=>createClient('https://api.example.test/api'));
  assert.throws(()=>createClient('https://secret@example.test'));
});
