import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const base=process.env.TEST_BASE_URL||'http://localhost:5173';
const output=new URL('../../docs/design/screenshots/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
const movie={id:'1',title:'Вечер у моря',poster_path:null,release_date:'2025-01-01',runtime:104,vote_average:8.2,overview:'Визуальный пример карточки для согласования оформления.',genres:[{id:18,name:'Драма'}]};
const people=[{id:'visual-a',name:'Лера',online:true},{id:'visual-b',name:'Антон',online:true},{id:'visual-c',name:'Николай',online:false}];
const selection={id:'visual-round',participants:people,cancelled:false,movies:[movie]};
const match={id:'visual-match',selectionId:selection.id,movie,participants:people,createdAt:new Date().toISOString()};
try{
 for(const width of [390,1280])for(const theme of ['light','dark'])for(const screen of ['home','room','match']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({theme,screen})=>{localStorage.setItem('wave:theme',theme);if(screen!=='home')localStorage.setItem('wave:mvp:room:v1',JSON.stringify({code:'DESIGN',id:'visual-a',token:'00000000-0000-4000-8000-000000000001',name:'Лера'}));},{theme,screen});
  // Только визуальные фикстуры: ни один запрос к API/Socket.IO не достигает сервера.
  const room={code:'DESIGN',ownerId:'visual-a',revision:1,expiresAt:new Date(Date.now()+86400000).toISOString(),maxParticipants:10,participants:people,filters:{genreIds:[],yearFrom:null,yearTo:null,minRating:null,maxRuntime:null},selection:screen==='match'?selection:null};
  let voted=false,connected=false;
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   let response={room};
   const state=()=>({selectionId:room.selection?.id??null,version:voted?1:0,eligible:true,votes:voted?[{movieId:'1',choice:'like'}]:[],matches:voted?[match]:[]});
   if(path.endsWith('/voting'))response=state();
   if(path.endsWith('/votes')){voted=true;response={state:state(),inserted:true,match};}
   await route.fulfill({json:response});
  });
  await page.route('**/socket.io/**',async route=>{
   if(route.request().method()==='POST')return route.fulfill({body:'ok'});
   const url=new URL(route.request().url());let body;
   if(!url.searchParams.has('sid'))body='0'+JSON.stringify({sid:'visual',upgrades:[],pingInterval:25000,pingTimeout:20000,maxPayload:1000000});
   else if(!connected){connected=true;body='40'+JSON.stringify({sid:'visual'});}
   else {await new Promise(r=>setTimeout(r,1000));body='2';}
   await route.fulfill({body,contentType:'text/plain'}).catch(()=>{});
  });
  await page.goto(base);if(screen!=='match')await page.locator('.sea-wave').first().waitFor({state:'attached'});
  if(screen==='room'){
   await page.getByText('Компания собирается',{exact:true}).waitFor();
   assert.equal(await page.locator('.spinner').count(),0);assert.equal(await page.locator('.member').count(),3);
  }
  if(screen==='match'){
   await page.getByRole('button',{name:'Нравится',exact:true}).click();await page.getByRole('dialog').waitFor();
   await page.screenshot({path:`${output}match-${width}-${theme}-joining.png`,fullPage:true});
   await page.waitForTimeout(3000);
   assert.equal(await page.locator('.sea-wave__union').evaluate(el=>Number(getComputedStyle(el).opacity)),1);
   assert.equal(await page.locator('.sea-wave__left').evaluate(el=>Number(getComputedStyle(el).opacity)),0);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.getByRole('alert').count(),0);
  await page.screenshot({path:`${output}${screen}-${width}-${theme}.png`,fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.ok(await page.locator('.sea-wave *').evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==='none')));
  await context.close();console.log(`OK: ${screen}, ${width}px, ${theme}, reduced-motion`);
 }
 assert.deepEqual(errors,[]);console.log('Визуальные проверки завершены; данные приложения не изменялись.');
}finally{await browser.close();}
