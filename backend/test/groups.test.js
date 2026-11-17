import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoomLimit} from '../src/config.js';
const enabled=process.env.RUN_DB_TESTS==='1';
async function api(path,method='GET',token,body){
 const r=await fetch(`http://localhost:3001/api${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:r.status,...await r.json()};
}
test('лимит комнаты: только целые 2–10',()=>{
 for(const n of [2,3,5,10])assert.equal(parseRoomLimit(String(n)),n);
 for(const n of [0,1,11,'2.5','abc',''])assert.throws(()=>parseRoomLimit(n));
});
test('групповые раунды и жизненный цикл', {skip:!enabled},async t=>{
 const {pool}=await import('../src/db.js');const cleanup=[];
 async function create(n){const c=await api('/rooms','POST',null,{name:'Группа 1'});cleanup.push(c.room.code);const members=[c.participant];for(let i=1;i<n;i++)members.push((await api(`/rooms/${c.room.code}/join`,'POST',null,{name:`Группа ${i+1}`})).participant);const room=(await api(`/rooms/${c.room.code}`,'GET',members[0].token)).room;return {room,members};}
 async function start(room,token,newRound=false){return api(`/rooms/${room.code}/selection`,'POST',token,{revision:room.revision,newRound});}
 const vote=(room,p,index,choice='like')=>api(`/rooms/${room.code}/votes`,'POST',p.token,{selectionId:room.selection.id,movieId:room.selection.movies[index].id,choice});
 try{
 for(const n of [2,3,5,10])await t.test(`${n} участников: все лайки, дизлайк, разные скорости, параллельные повторы`,async()=>{
   let {room,members}=await create(n);room=(await start(room,members[0].token)).room;assert.equal(room.selection.participants.length,n);
   for(const p of members.slice(0,-1)){const r=await vote(room,p,0);assert.equal(r.status,200);assert.equal(r.match,null);}
   await vote(room,members[0],1,'dislike');
   const last=await vote(room,members.at(-1),0);assert.equal(last.match.participants.length,n);
   const duplicates=await Promise.all(members.map(p=>vote(room,p,0)));assert.ok(duplicates.every(r=>r.inserted===false));
   for(const p of members.slice(1))assert.equal((await vote(room,p,1)).match,null);
   const simultaneous=await Promise.all(members.flatMap(p=>[vote(room,p,2),vote(room,p,2)]));
   assert.ok(simultaneous.every(r=>r.status===200));assert.equal(simultaneous.filter(r=>r.match).length,1);
   for(const p of members){const state=await api(`/rooms/${room.code}/voting`,'GET',p.token);assert.equal(state.votes.length,3);assert.equal(state.matches.length,2);}
 });
 await t.test('конкурентный вход не превышает лимит',async()=>{
   const {room,members}=await create(1);const results=await Promise.all(Array.from({length:15},(_,i)=>api(`/rooms/${room.code}/join`,'POST',null,{name:`Гонка ${i}`})));
   assert.equal(results.filter(r=>r.status===201).length,room.maxParticipants-1);assert.ok(results.every(r=>[201,409].includes(r.status)));
   assert.equal((await api(`/rooms/${room.code}`,'GET',members[0].token)).room.participants.length,room.maxParticipants);
 });
 await t.test('поздний вход, выход, передача ведущего, новый раунд и пустая комната',async()=>{
   let {room,members}=await create(3);room=(await start(room,members[0].token)).room;
   const late=(await api(`/rooms/${room.code}/join`,'POST',null,{name:'Поздний'})).participant;
   assert.equal((await vote(room,late,0)).status,403);
   await vote(room,members[0],0);await vote(room,members[1],0);
   assert.equal((await api(`/rooms/${room.code}/me`,'DELETE',members[0].token)).status,200);
   assert.equal((await vote(room,members[2],0)).status,409);
   assert.equal((await vote(room,members[0],0)).status,403);
   room=(await api(`/rooms/${room.code}`,'GET',members[1].token)).room;
   assert.equal(room.ownerId,members[1].id);assert.equal(room.selection.cancelled,true);
   const stale=room;room=(await start(room,members[1].token,true)).room;
   assert.equal((await start(stale,members[1].token,true)).status,409);
   assert.equal(room.selection.participants.length,3);
   assert.equal((await vote(stale,members[1],0)).status,409);
   const all=await Promise.all([members[1],members[2],late].map(p=>vote(room,p,0)));assert.equal(all.filter(r=>r.match).length,1);
   for(const p of [members[1],members[2],late])await api(`/rooms/${room.code}/me`,'DELETE',p.token);
   const fresh=await api(`/rooms/${room.code}/join`,'POST',null,{name:'Новый ведущий'});assert.equal(fresh.room.ownerId,fresh.participant.id);
   assert.equal((await start(fresh.room,fresh.participant.token,true)).status,409);
   assert.equal((await api(`/rooms/${room.code}/voting`,'GET',fresh.participant.token)).matches.length,1);
 });
 }finally{for(const code of cleanup)await pool.query('DELETE FROM rooms WHERE code=$1',[code]);await pool.end();}
});
