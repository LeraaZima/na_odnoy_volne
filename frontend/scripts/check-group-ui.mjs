import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const base=process.env.TEST_BASE_URL||'http://localhost:5173';
const browsers=[],pages=[],extra=[];let code;
async function state(page){return page.evaluate(async()=>{const s=JSON.parse(localStorage.getItem('wave:mvp:room:v1'));return(await fetch(`/api/rooms/${s.code}/voting`,{headers:{Authorization:`Bearer ${s.token}`}})).json();});}
try{
 for(let i=0;i<3;i++){const b=await chromium.launch({channel:'chrome',headless:true});browsers.push(b);const c=await b.newContext({viewport:i?{width:390,height:844}:{width:1280,height:1000},reducedMotion:i?'reduce':'no-preference'});const p=await c.newPage();pages.push(p);p.setDefaultTimeout(15000);await p.goto(base);await p.getByLabel('Как тебя зовут?').fill(`Гость ${i+1}`);}
 const [a,b,c]=pages;await a.getByRole('button',{name:'Создать комнату'}).click();code=await a.locator('.invite-box__code').innerText();
 for(const p of [b,c]){await p.getByRole('textbox',{name:'Код комнаты'}).fill(code);await p.getByRole('button',{name:'Войти',exact:true}).click();await p.getByRole('button',{name:'К выбору фильмов'}).waitFor();}
 await a.getByText('Гость 3',{exact:true}).waitFor();
 await a.getByRole('button',{name:'К выбору фильмов'}).click();await a.getByRole('button',{name:'Начать выбор',exact:true}).click();
 for(const p of pages)await p.locator('.swipe-card').waitFor();
 const lateBrowser=await chromium.launch({channel:'chrome',headless:true});browsers.push(lateBrowser);const late=await lateBrowser.newPage();await late.goto(base+'/?room='+code);await late.getByLabel('Как тебя зовут?').fill('Поздний зритель');await late.getByRole('button',{name:'Войти',exact:true}).click();await late.getByText('Вы ожидаете следующего раунда',{exact:true}).waitFor();await late.getByRole('button',{name:'Вернуться в комнату'}).click();await late.getByRole('button',{name:'Покинуть комнату'}).click();

 await a.getByRole('button',{name:'Нравится',exact:true}).click();await b.getByRole('button',{name:'Нравится',exact:true}).click();
 assert.equal((await state(a)).matches.length,0);
 await c.getByRole('button',{name:'Нравится',exact:true}).click();for(const p of pages)await p.getByRole('dialog').waitFor();
 assert.equal((await state(a)).matches[0].participants.length,3);
 for(const [i,p] of pages.entries()){
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(i)assert.equal(await p.locator('.match-mascot .sea-wave__union').evaluate(el=>getComputedStyle(el).animationName),'none');
  await p.screenshot({path:`/tmp/wave-group-match-${i}.png`});await p.getByRole('button',{name:'Продолжить выбор',exact:true}).click();await p.reload();await p.locator('.swipe-card').waitFor();assert.equal((await state(p)).votes.length,1);
 }
 await c.getByRole('button',{name:'Вернуться в комнату'}).click();await c.getByRole('button',{name:'Покинуть комнату'}).click();await a.getByText('Нужен новый раунд',{exact:true}).waitFor();
 await c.getByRole('textbox',{name:'Код комнаты'}).fill(code);await c.getByRole('button',{name:'Войти',exact:true}).click();await c.getByText('Нужен новый раунд',{exact:true}).waitFor();
 await a.getByRole('button',{name:'Вернуться к фильтрам'}).click();await a.getByRole('button',{name:'Новый раунд с текущим составом'}).click();for(const p of pages)await p.locator('.swipe-card').waitFor();
 for(let i=3;i<10;i++){const r=await fetch(`${base}/api/rooms/${code}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Компания ${i+1}`})});assert.equal(r.status,201);extra.push((await r.json()).participant);}
 for(const p of pages){await p.getByRole('button',{name:'Вернуться в комнату'}).click();await p.getByText('Компания 10',{exact:true}).waitFor();for(const theme of ['light','dark']){if(await p.locator('html').getAttribute('data-theme')!==theme)await p.getByLabel('Переключить тему').click();assert.equal(await p.locator('.member:not(.member--waiting)').count(),10);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);} }
 await b.screenshot({path:'/tmp/wave-group-room-mobile.png',fullPage:true});
 console.log('OK: три независимых Chrome через заданный origin, 3/3 Match, перезагрузка, остановка при выходе, новый раунд, 10 участников в мобильной комнате, обе темы и SVG reduced-motion.');
}finally{
 for(const p of pages)try{await p.evaluate(async()=>{const s=JSON.parse(localStorage.getItem('wave:mvp:room:v1'));if(s)await fetch(`/api/rooms/${s.code}/me`,{method:'DELETE',headers:{Authorization:`Bearer ${s.token}`}});});}catch{}
 for(const p of extra)await fetch(`${base}/api/rooms/${code}/me`,{method:'DELETE',headers:{Authorization:`Bearer ${p.token}`}});
 await Promise.all(browsers.map(b=>b.close()));
}
