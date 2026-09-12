import {test,expect,chromium} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
const web=process.env.TEST_WEB_URL||'http://127.0.0.1:3001';
const api=process.env.TEST_API_URL||'http://127.0.0.1:8000';
async function enter(page:any){await page.addInitScript(()=>localStorage.setItem('doca_tour_done','true'));await page.goto(web);await page.locator('#tabOfficerBtn').click();await page.locator('#officerIdInput').fill('voice-test');await page.locator('#officerPassInput').fill('test');await page.locator('#officerLoginForm button').click();await page.locator('#aiFab').click();}

test('voice UI handles history, inert model text, playback failure and preserved FAQ',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const requests:any[]=[];
 await page.route('**/api/voice/capabilities',route=>route.fulfill({json:{configured:true,speech_languages:['en-IN','hi-IN'],voices:['ritu']}}));
 await page.route('**/api/voice/reply',route=>{requests.push(route.request().postDataJSON());return route.fulfill({json:{answer:'Here is your <img src=x onerror=alert(1)> answer.',language_code:'en-IN',sources:[]}});});
 await page.route('**/api/language/speak',route=>route.fulfill({status:503,json:{detail:'Speech unavailable in this test.'}}));
 await enter(page);await page.getByRole('textbox',{name:'Message to NyayaLens AI'}).fill('Hello');await page.getByRole('button',{name:'Send AI message'}).click();
 await expect(page.locator('.voice-message.assistant')).toContainText('<img src=x onerror=alert(1)>');expect(await page.locator('.voice-message img').count()).toBe(0);await expect(page.locator('.voice-hero')).toContainText('speech is unavailable');
 await page.getByRole('textbox',{name:'Message to NyayaLens AI'}).fill('Tell me more');await page.getByRole('button',{name:'Send AI message'}).click();await expect(page.locator('.voice-message.assistant')).toHaveCount(2);expect(requests[1].history).toHaveLength(2);
 await page.getByRole('tab',{name:'Quick FAQ',exact:true}).click();await page.locator('#chatTextInput').fill('Consumer Helpline');await page.locator('#chatSendBtn').click();await expect(page.locator('#chatMessages')).toContainText('1915');await page.getByRole('tab',{name:'Talk with AI',exact:true}).click();
 for(const width of [390,320,768,1440]){await page.setViewportSize({width,height:844});await expect(page.locator('.voice-compose')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);const box=await page.locator('#aiChatWindow').boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'work/voice-phone.png'});expect(errors).toEqual([]);
});

test('closing voice during microphone permission releases the eventual stream',async({page})=>{
 await page.addInitScript(()=>{(window as any).stoppedTracks=0;(window as any).resolveMic=null;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>new Promise(resolve=>{(window as any).resolveMic=()=>resolve({getTracks:()=>[{stop:()=>{(window as any).stoppedTracks++;}}]});})});});
 await enter(page);await expect(page.getByRole('button',{name:'Start speaking',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Start speaking',exact:true}).click();await expect(page.locator('.voice-hero h3')).toContainText('Opening');await page.locator('#chatCloseBtn').click();await page.evaluate(()=>(window as any).resolveMic());await expect.poll(()=>page.evaluate(()=>(window as any).stoppedTracks)).toBe(1);
});

test('real Sarvam typed follow-up returns spoken playback',async({page})=>{
 test.skip(process.env.VOICE_LIVE!=='1','Explicit live provider test');test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await enter(page);await page.getByRole('textbox',{name:'Message to NyayaLens AI'}).fill('My name is Asha. Say hello in one short sentence.');await page.getByRole('button',{name:'Send AI message'}).click();await expect(page.locator('.voice-message.assistant')).toHaveCount(1,{timeout:60000});await expect(page.getByRole('button',{name:'Play reply',exact:true})).toBeVisible({timeout:60000});
 await page.getByRole('textbox',{name:'Message to NyayaLens AI'}).fill('What is my name? Answer in one short sentence.');const reply=page.waitForResponse(r=>r.url().endsWith('/api/voice/reply'));await page.getByRole('button',{name:'Send AI message'}).click();const response=await reply;expect(response.status()).toBe(200);expect((await response.json()).answer).toContain('Asha');await expect(page.getByRole('button',{name:'Play reply',exact:true})).toBeVisible({timeout:60000});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'work/voice-live-phone.png'});expect(errors).toEqual([]);
});

test('real microphone recording automatically transcribes, replies and plays',async()=>{
 test.skip(process.env.VOICE_MIC!=='1','Explicit live provider microphone test');test.setTimeout(120000);
 const browser=await chromium.launch();
 try{const context=await browser.newContext({permissions:['microphone']});const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const old=HTMLMediaElement.prototype.play;(window as any).audioEnded=0;HTMLMediaElement.prototype.play=function(){this.addEventListener('ended',()=>{(window as any).audioEnded++;},{once:true});return old.call(this);};});
 await page.addInitScript((audio)=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{const ctx=new AudioContext();await ctx.resume();const buffer=await ctx.decodeAudioData(Uint8Array.from(atob(audio),c=>c.charCodeAt(0)).buffer);const source=ctx.createBufferSource();source.buffer=buffer;const destination=ctx.createMediaStreamDestination();source.connect(destination);source.start(ctx.currentTime+.25);return destination.stream;}});},fs.readFileSync(path.resolve('work/voice-microphone-fixture.wav')).toString('base64'));
 await enter(page);await expect(page.getByRole('button',{name:'Start speaking',exact:true})).toBeEnabled();const transcription=page.waitForResponse(r=>r.url().endsWith('/api/language/transcribe'));await page.getByRole('button',{name:'Start speaking',exact:true}).click();
 const response=await transcription;expect(response.status()).toBe(200);expect((await response.json()).transcript.toLowerCase()).toContain('introduce');await expect(page.locator('.voice-message.assistant')).toHaveCount(1,{timeout:60000});await expect.poll(()=>page.evaluate(()=>(window as any).audioEnded),{timeout:60000}).toBeGreaterThan(0);await expect(page.getByRole('button',{name:'Start speaking',exact:true})).toBeEnabled();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'work/voice-microphone-phone.png'});expect(errors).toEqual([]);
 }finally{await browser.close();}
});
