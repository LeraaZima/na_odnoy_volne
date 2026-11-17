import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVote } from '../src/voting.js';

const uuid='12345678-1234-1234-1234-123456789abc';
test('голос: строгая проверка сессии, фильма и значения',()=>{
  assert.deepEqual(validateVote({selectionId:uuid,movieId:155,choice:'like'}),{selectionId:uuid,movieId:'155',choice:'like'});
  for(const body of [null,{}, {selectionId:uuid,movieId:[155],choice:'like'},{selectionId:'bad',movieId:155,choice:'like'},{selectionId:uuid,movieId:-1,choice:'like'},{selectionId:uuid,movieId:155,choice:'yes'}]) assert.throws(()=>validateVote(body));
});

test('голоса и Match в PostgreSQL', {skip:process.env.RUN_DB_TESTS!=='1'}, async t=>{
  const {pool}=await import('../src/db.js');
  const cleanup=[];
  async function api(path,method='GET',token,body){
    const r=await fetch(`http://localhost:3001/api${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,...await r.json()};
  }
  try {
    const created=await api('/rooms','POST',null,{name:'Тест голос А'});cleanup.push(created.room.code);
    const code=created.room.code,a=created.participant.token;
    const guest=await api(`/rooms/${code}/join`,'POST',null,{name:'Тест голос Б'}),b=guest.participant.token;
    const outsider=await api('/rooms','POST',null,{name:'Тест чужой'});cleanup.push(outsider.room.code);
    let room=(await api(`/rooms/${code}/selection`,'POST',a,{revision:guest.room.revision})).room;
    const oldSelection=room.selection.id;
    const movies=room.selection.movies;
    assert.ok(movies.length>=6,'Для интеграционных тестов импортируйте каталог TMDB');
    const vote=(token,index,choice='like',selectionId=room.selection.id)=>api(`/rooms/${code}/votes`,'POST',token,{selectionId,movieId:movies[index].id,choice});
    const state=token=>api(`/rooms/${code}/voting`,'GET',token);
    await t.test('без токена, чужая комната, посторонний фильм и пропуск карточки запрещены',async()=>{
      assert.equal((await vote(null,0)).status,403);
      assert.equal((await vote(outsider.participant.token,0)).status,403);
      assert.equal((await state(outsider.participant.token)).status,403);
      assert.equal((await api(`/rooms/${code}/votes`,'POST',a,{selectionId:room.selection.id,movieId:'99999999999999',choice:'like'})).status,400);
      assert.equal((await vote(a,1)).status,409);
    });
    await t.test('разная скорость: один лайк ждёт второго, прогресс независим',async()=>{
      assert.equal((await vote(a,0)).state.matches.length,0);
      assert.equal((await vote(a,1,'dislike')).state.votes.length,2);
      assert.equal((await state(b)).votes.length,0);
    });
    await t.test('два лайка создают Match, лайк и дизлайк — нет',async()=>{
      const yes=await vote(b,0);assert.equal(yes.status,200);assert.equal(yes.match.movie.id,movies[0].id);
      const no=await vote(b,1);assert.equal(no.match,null);assert.equal(no.state.matches.length,1);
    });
    await t.test('повтор безопасен, изменить голос нельзя, прогресс восстанавливается',async()=>{
      const duplicate=await vote(b,0);assert.equal(duplicate.inserted,false);assert.equal(duplicate.match,null);
      assert.equal(duplicate.state.votes.length,2);
      assert.equal((await vote(b,0,'dislike')).status,409);
      assert.deepEqual((await state(a)).votes.map(v=>v.movieId).sort(),movies.slice(0,2).map(m=>m.id).sort());
      assert.equal((await state(b)).matches.length,1);
    });
    await t.test('одновременные лайки создают ровно одно совпадение',async()=>{
      const results=await Promise.all([vote(a,2),vote(b,2)]);
      assert.ok(results.every(r=>r.status===200));
      assert.equal(results.filter(r=>r.match).length,1);
      const count=await pool.query('SELECT count(*)::int AS n FROM matches WHERE selection_id=$1 AND movie_tmdb_id=$2',[room.selection.id,movies[2].id]);
      assert.equal(count.rows[0].n,1);
    });
    await t.test('одновременные повторы записывают единственный голос',async()=>{
      const results=await Promise.all([vote(a,3),vote(a,3)]);
      assert.equal(results.filter(r=>r.inserted).length,1);
      assert.ok(results.every(r=>r.status===200));
      await vote(b,3,'dislike');
      assert.equal((await state(a)).votes.length,4);
      assert.equal((await state(a)).matches.length,2);
    });
    await t.test('выход отзывает доступ; лайк ушедшего не участвует в новых Match',async()=>{
      await vote(b,4);
      assert.equal((await api(`/rooms/${code}/me`,'DELETE',b)).status,200);
      assert.equal((await vote(b,5)).status,403);
      assert.equal((await state(b)).status,403);
      assert.equal((await vote(a,4)).status,409);
      assert.equal((await state(a)).matches.length,2);
    });
    const replacement=await api(`/rooms/${code}/join`,'POST',null,{name:'Тест голос В'}),c=replacement.participant.token;
    await t.test('новый участник не наследует оценки; история совпадений сохраняется',async()=>{
      const fresh=await state(c);assert.equal(fresh.votes.length,0);assert.equal(fresh.matches.length,2);
      assert.ok(fresh.matches[0].participants.some(p=>p.name==='Тест голос Б'));
    });
    await t.test('новая подборка отделена от старой; старый запрос не голосует в новой',async()=>{
      room=(await api(`/rooms/${code}`,'GET',a)).room;
      room=(await api(`/rooms/${code}/filters`,'PUT',a,{revision:room.revision,filters:{}})).room;
      room=(await api(`/rooms/${code}/selection`,'POST',a,{revision:room.revision})).room;
      assert.notEqual(room.selection.id,oldSelection);
      assert.equal((await vote(a,0,'like',oldSelection)).status,409);
      assert.equal((await state(a)).votes.length,0);
      assert.equal((await state(a)).matches.length,2);
      await vote(a,0);const matched=await vote(c,0);
      assert.ok(matched.match);assert.equal(matched.state.matches.length,3);
    });
    await t.test('истёкшая комната запрещает чтение и запись голосов',async()=>{
      await pool.query("UPDATE rooms SET expires_at=now()-interval '1 second' WHERE code=$1",[code]);
      assert.equal((await state(a)).status,403);assert.equal((await vote(a,1)).status,403);
    });
  } finally {
    for(const code of cleanup)await pool.query('DELETE FROM rooms WHERE code=$1',[code]);
    await pool.end();
  }
});
