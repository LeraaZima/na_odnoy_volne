import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
const base=process.env.TEST_BASE_URL||'http://localhost:5173';
const members=[],sockets=[];let code;
async function api(path,method='GET',body,token){const r=await fetch(`${base}/api${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};}
function event(s,name,test=()=>true){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{s.off(name,cb);reject(new Error(`Нет ${name}`));},12000);const cb=data=>{if(test(data)){clearTimeout(timer);s.off(name,cb);resolve(data);}};s.on(name,cb);});}
try{
 const created=await api('/rooms','POST',{name:'Группа сокет 1'});code=created.room.code;members.push(created.participant);
 for(let i=1;i<5;i++)members.push((await api(`/rooms/${code}/join`,'POST',{name:`Группа сокет ${i+1}`})).participant);
 for(const [i,p] of members.entries()){const s=io(base,{auth:{code,token:p.token},transports:i%2?['websocket']:['polling'],autoConnect:false});sockets.push(s);const ready=event(s,'room:updated');s.connect();await ready;}
 let room=(await api(`/rooms/${code}`,'GET',null,members[0].token)).room;
 room=(await api(`/rooms/${code}/selection`,'POST',{revision:room.revision},members[0].token)).room;
 const last=sockets.at(-1),lastMember=members.at(-1);
 const offline=event(sockets[0],'room:presence',ps=>ps.find(p=>p.id===lastMember.id)?.online===false);last.disconnect();await offline;
 assert.deepEqual((await api(`/rooms/${code}`,'GET',null,members[0].token)).room.selection.participants,room.selection.participants);
 const vote=(p,i)=>api(`/rooms/${code}/votes`,'POST',{selectionId:room.selection.id,movieId:room.selection.movies[i].id,choice:'like'},p.token);
 for(const p of members.slice(0,-1))assert.equal((await vote(p,0)).match,null);
 assert.equal((await api(`/rooms/${code}/voting`,'GET',null,members[0].token)).matches.length,0);
 const back=event(last,'room:updated');last.connect();await back;
 const notifications=sockets.map(s=>event(s,'match:created'));await vote(lastMember,0);
 const matches=await Promise.all(notifications);assert.equal(new Set(matches.map(m=>m.id)).size,1);assert.equal(matches[0].participants.length,5);
 const resumed=event(last,'room:updated');last.disconnect();last.connect();await resumed;
 assert.equal((await api(`/rooms/${code}/voting`,'GET',null,lastMember.token)).matches.length,1);
 const stopped=event(sockets[1],'room:updated',r=>r?.selection?.cancelled && r.ownerId!==members[0].id);
 await api(`/rooms/${code}/me`,'DELETE',null,members[0].token);await stopped;
 console.log('OK: 5 сокетов polling/WebSocket, статусы online/offline, неизменный состав без сети, ожидание пятого лайка, Match всем, восстановление истории, выход и передача прав.');
}finally{sockets.forEach(s=>s.disconnect());for(const p of members)await api(`/rooms/${code}/me`,'DELETE',null,p.token);}
