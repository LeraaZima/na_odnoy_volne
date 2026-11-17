import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const base=process.env.TEST_BASE_URL || 'http://localhost:5173';
const browsers=[];
const pages=[];
async function card(page) { await page.locator('.swipe-card .film-card').waitFor(); return page.locator('.swipe-card .film-card').getAttribute('data-movie-id'); }
async function changed(page,id) { await page.waitForFunction(old=>document.querySelector('.swipe-card .film-card')?.dataset.movieId && document.querySelector('.swipe-card .film-card').dataset.movieId!==old,id); }
async function voting(page) {
  return page.evaluate(async()=>{
    const s=JSON.parse(localStorage.getItem('wave:mvp:room:v1'));
    return (await fetch(`/api/rooms/${s.code}/voting`,{headers:{Authorization:`Bearer ${s.token}`}})).json();
  });
}
try {
  for(let i=0;i<2;i++) {
    const browser=await chromium.launch({channel:'chrome',headless:true});browsers.push(browser);
    const context=await browser.newContext(i ? {viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'} : {viewport:{width:1280,height:1000}});
    const page=await context.newPage();pages.push(page);page.setDefaultTimeout(12000);
    await page.goto(base);
    await page.getByLabel('Как тебя зовут?').fill(i?'UI Антон':'UI Лера');
  }
  const [a,b]=pages;
  await a.getByRole('button',{name:'Создать комнату'}).click();
  const code=await a.locator('.invite-box__code').innerText();
  await b.getByRole('textbox',{name:'Код комнаты'}).fill(code);
  await b.getByRole('button',{name:'Войти',exact:true}).click();
  await b.getByText('UI Лера',{exact:true}).waitFor();
  await a.getByRole('button',{name:'К выбору фильмов'}).click();
  await b.getByRole('button',{name:'К выбору фильмов'}).click();
  await a.getByLabel('Год от',{exact:true}).fill('2000');
  await a.getByLabel('Рейтинг от',{exact:true}).fill('1');
  await a.getByLabel('Длительность до, мин',{exact:true}).fill('300');
  await a.getByRole('button',{name:'Сохранить настройки'}).click();
  await b.waitForFunction(()=>document.querySelector('input[type=number]')?.value==='2000');
  assert.equal(await b.getByLabel('Год от',{exact:true}).isDisabled(),true);
  await a.getByRole('button',{name:'Начать выбор',exact:true}).click();
  const first=await card(a);assert.equal(await card(b),first);

  const poster=a.locator('.swipe-card .film-poster');await poster.scrollIntoViewIfNeeded();
  const box=await poster.boundingBox();
  await a.mouse.move(box.x+100,box.y+130);await a.mouse.down();await a.mouse.move(box.x+260,box.y+130,{steps:10});
  assert.equal(await a.locator('.swipe-label').innerText(),'Нравится');
  assert.equal(await a.locator('.swipe-label').evaluate(el=>Number(getComputedStyle(el).opacity)),1);
  await a.mouse.up();await changed(a,first);
  const second=await card(a);
  await a.locator('.swipe-zone').focus();await a.keyboard.press('ArrowLeft');await changed(a,second);
  const third=await card(a);
  await a.reload();assert.equal(await card(a),third);
  assert.equal(await card(b),first);
  console.log('OK: мышь, визуальная реакция, клавиатура, разная скорость, восстановление прогресса.');

  const mobilePoster=b.locator('.swipe-card .film-poster');await mobilePoster.scrollIntoViewIfNeeded();
  const mobileBox=await mobilePoster.boundingBox();
  const cdp=await b.context().newCDPSession(b);
  const x=mobileBox.x+65,y=Math.max(50,Math.min(650,mobileBox.y+100));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let step=1;step<=8;step++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+step*18,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await a.getByRole('dialog').waitFor();await b.getByRole('dialog').waitFor();
  assert.equal(await b.locator('.match-waves').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await a.keyboard.press('Tab');assert.ok(await a.evaluate(()=>!!document.activeElement.closest('dialog')));
  await a.screenshot({path:'/tmp/wave-match-desktop.png'});
  await b.screenshot({path:'/tmp/wave-match-mobile.png'});
  await a.keyboard.press('Escape');await b.getByRole('button',{name:'Продолжить выбор',exact:true}).click();
  await changed(b,first);
  assert.equal((await voting(a)).matches.length,1);
  console.log('OK: настоящий touch-жест, Match на двух экранах, фокус диалога, reduced-motion и мобильная ширина.');

  await b.getByRole('button',{name:'Нравится',exact:true}).click();await changed(b,second);
  assert.equal((await voting(b)).matches.length,1);
  await Promise.all([a.getByRole('button',{name:'Нравится',exact:true}).dblclick(),b.getByRole('button',{name:'Нравится',exact:true}).click()]);
  await a.getByRole('dialog').waitFor();await b.getByRole('dialog').waitFor();
  await a.getByRole('button',{name:'Продолжить выбор',exact:true}).click();await b.getByRole('button',{name:'Продолжить выбор',exact:true}).click();
  await changed(a,third);await changed(b,third);
  assert.equal((await voting(a)).votes.length,3);
  assert.equal((await voting(a)).matches.length,2);
  console.log('OK: лайк/дизлайк без Match, одновременные лайки, двойной клик без пропуска.');

  const fourth=await card(a);
  await a.route('**/api/rooms/*/votes',async route=>{await route.fetch();await route.abort();});
  await a.getByRole('button',{name:'Нравится',exact:true}).click();await changed(a,fourth);await a.unrouteAll();
  assert.equal((await voting(a)).votes.length,4);
  await b.route('**/api/rooms/*/votes',route=>route.abort());
  await b.getByRole('button',{name:'Нравится',exact:true}).click();await b.getByRole('alert').waitFor();
  assert.equal(await card(b),fourth);assert.equal((await voting(b)).votes.length,3);
  await b.unrouteAll();await b.getByRole('button',{name:'Нравится',exact:true}).click();
  await a.getByRole('dialog').waitFor();await b.getByRole('dialog').waitFor();
  await a.getByRole('button',{name:'Продолжить выбор',exact:true}).click();await b.getByRole('button',{name:'Продолжить выбор',exact:true}).click();
  await changed(b,fourth);
  const fifth=await card(a);
  await Promise.all([a.reload(),b.reload()]);assert.equal(await card(a),fifth);assert.equal(await card(b),fifth);
  for(const page of pages){
    await page.getByRole('button',{name:'Открыть совпадения'}).click();
    await page.locator('.match-item').first().waitFor();assert.equal(await page.locator('.match-item').count(),3);
    await page.locator('.match-item summary').first().click();
    await page.getByRole('button',{name:'Подробнее о фильме',exact:true}).first().click();
    await page.locator('.film-description').first().waitFor();
  }
  console.log('OK: потерянный ответ не пропускает карточку, несохранённый голос можно повторить, история переживает перезагрузку.');
  await a.getByRole('button',{name:'Переключить тему'}).click();
  await a.screenshot({path:'/tmp/wave-matches-list.png'});
  for(const page of pages) {
    for(const theme of ['light','dark']) {
      if(await page.locator('html').getAttribute('data-theme')!==theme) await page.getByLabel('Переключить тему').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
  }
  await b.getByRole('button',{name:'Вернуться в комнату'}).click();
  await b.getByRole('button',{name:'Покинуть комнату'}).click();
  await b.getByLabel('Как тебя зовут?').fill('UI Новый гость');
  await b.getByRole('textbox',{name:'Код комнаты'}).fill(code);
  await b.getByRole('button',{name:'Войти',exact:true}).click();
  await b.getByText('Нужен новый раунд',{exact:true}).waitFor();
  assert.equal((await voting(b)).votes.length,0);
  assert.equal((await voting(b)).matches.length,3);
  await a.getByRole('button',{name:'Вернуться в комнату'}).click();
  await a.getByText('UI Новый гость',{exact:true}).waitFor();
  console.log('OK: синхронизация фильтров, обе темы, выход и новый гость с отдельным прогрессом и общей историей.');
  console.log('Все браузерные проверки пройдены.');
} finally {
  for(const page of pages) {
    try { await page.unrouteAll();await page.evaluate(async()=>{const s=JSON.parse(localStorage.getItem('wave:mvp:room:v1'));if(s)await fetch(`/api/rooms/${s.code}/me`,{method:'DELETE',headers:{Authorization:`Bearer ${s.token}`}});}); } catch {}
  }
  await Promise.all(browsers.map(browser=>browser.close()));
}
