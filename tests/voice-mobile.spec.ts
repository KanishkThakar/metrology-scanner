import {test,expect} from '@playwright/test';
const api=process.env.TEST_API_URL||'http://127.0.0.1:8000';
test('Expo voice conversation replies aloud and preserves FAQ and scanner navigation',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});await page.addInitScript(api=>{localStorage.setItem('metrology_api',api);localStorage.setItem('doca_tour_done','true');},api);
 await page.goto(process.env.TEST_MOBILE_URL||'http://127.0.0.1:8082');await page.getByRole('textbox',{name:'Mobile, email or officer ID'}).fill('voice-mobile@example.com');await page.getByRole('button',{name:'Enter Citizen Mode',exact:true}).click();await page.getByRole('tab',{name:'Advisor',exact:true}).click();
 if(process.env.VOICE_LIVE!=='1'){
 await page.route('**/api/voice/reply',r=>r.fulfill({json:{answer:'Hello from the test assistant.',language_code:'en-IN',sources:[]}}));
 await page.route('**/api/language/speak',r=>r.fulfill({status:503,json:{detail:'Test speech failure.'}}));
 }
 await page.getByRole('textbox',{name:'Message to NyayaLens AI'}).fill('Say hello in one short sentence.');await page.getByRole('button',{name:'Send AI message'}).click();
 if(process.env.VOICE_LIVE==='1')await expect(page.getByRole('button',{name:'Play reply',exact:true})).toBeVisible({timeout:60000});else await expect(page.getByText(/Your reply is ready, but speech is unavailable/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.getByRole('button',{name:'Start speaking',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'work/voice-expo-phone.png'});
 await page.getByRole('button',{name:'Quick FAQ',exact:true}).click();await page.getByRole('textbox',{name:'Ask the packaging advisor'}).fill('Consumer Helpline');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText('Packaging FAQ',{exact:true})).toBeVisible();await page.getByRole('tab',{name:'Scan',exact:true}).click();await expect(page.getByRole('button',{name:'Add photos',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
