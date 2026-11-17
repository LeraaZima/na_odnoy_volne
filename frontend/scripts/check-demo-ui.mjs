import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const base = process.env.TEST_BASE_URL || 'http://localhost:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(12000);
let code;
try {
  await page.goto(base);
  await page.getByLabel('Как тебя зовут?').fill('Аудит демо');
  await page.getByRole('button', {name:'Создать комнату'}).click();
  code = await page.locator('.invite-box__code').innerText();
  await page.evaluate(async code=>{await fetch('/api/rooms/'+code+'/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Гость аудита'})});},code);
  for (const width of [390, 1280]) {
    await page.setViewportSize({width, height:900});
    for (const theme of ['light','dark']) {
      if(await page.locator('html').getAttribute('data-theme') !== theme) await page.getByLabel('Переключить тему').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
      await page.getByRole('button',{name:'К выбору фильмов'}).click();
      await page.getByLabel('Год от',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
      await page.screenshot({path:`/tmp/wave-filters-${width}-${theme}.png`,fullPage:true});
      await page.getByRole('button',{name:'Вернуться в комнату'}).click();
    }
  }
  await page.getByRole('button',{name:'К выбору фильмов'}).click();
  await page.getByLabel('Год от',{exact:true}).fill('1880');
  await page.getByLabel('Год до',{exact:true}).fill('1880');
  await page.getByRole('button',{name:'Начать выбор',exact:true}).click();
  await page.getByText('Подходящих фильмов нет. Попробуйте изменить фильтры.',{exact:false}).waitFor();
  console.log('OK: комната и фильтры 390/1280 px, обе темы, пустая подборка.');
  await page.getByRole('button',{name:'Вернуться к фильтрам'}).click();
  await page.getByLabel('Год от',{exact:true}).fill('');
  await page.getByLabel('Год до',{exact:true}).fill('');
  await page.getByRole('button',{name:'Начать выбор',exact:true}).click();
  await page.locator('.swipe-card .film-card').waitFor();
  await page.evaluate(async()=>{
    const s=JSON.parse(localStorage.getItem('wave:mvp:room:v1'));
    const headers={Authorization:'Bearer '+s.token,'Content-Type':'application/json'};
    const {room}=await (await fetch('/api/rooms/'+s.code,{headers})).json();
    const index=room.selection.movies.findIndex(m=>!m.overview?.trim());
    if(index<0) throw new Error('В каталоге нет фильма без описания');
    for(const movie of room.selection.movies.slice(0,index)) {
      const r=await fetch('/api/rooms/'+s.code+'/votes',{method:'POST',headers,body:JSON.stringify({selectionId:room.selection.id,movieId:movie.id,choice:'dislike'})});
      if(!r.ok)throw new Error('Не удалось подготовить проверку описания');
    }
  });
  await page.route('https://image.tmdb.org/**',route=>route.abort());
  await page.reload();
  await page.getByRole('button',{name:'Подробнее о фильме',exact:true}).click();
  await page.getByText('Описание пока недоступно',{exact:true}).waitFor();
  await page.getByRole('img',{name:'Фирменная заглушка постера'}).waitFor();
  console.log('OK: фильм из реального каталога без описания, заглушка при недоступности постера.');
  await context.setOffline(true);
  // Меняем срок только собственной тестовой комнаты, пользовательские данные не затрагиваются.
  assert.match(code,/^[A-Z0-9]{6}$/);
  execFileSync('docker',['compose','exec','-T','db','psql','-U','wave','-d','wave','-c',`UPDATE rooms SET expires_at=now()-interval '1 second' WHERE code='${code}'`],{stdio:'pipe'});
  await new Promise(resolve=>setTimeout(resolve,46000));
  await context.setOffline(false);
  await page.getByRole('button',{name:'Создать комнату'}).waitFor();
  console.log('OK: восстановление сети после истечения срока возвращает на главную.');
} finally {
  if(code && /^[A-Z0-9]{6}$/.test(code)) execFileSync('docker',['compose','exec','-T','db','psql','-U','wave','-d','wave','-c',`DELETE FROM rooms WHERE code='${code}'`],{stdio:'pipe'});
  await browser.close();
}
