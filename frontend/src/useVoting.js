import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from './api.js';

export function useVoting(session, selectionId, refreshKey) {
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const identity=`${session?.token || ''}:${selectionId || ''}`;
  const current=useRef(identity);
  current.current=identity;
  const accept=useCallback((state,key) => {
    if(current.current!==key || state.selectionId!==(selectionId ?? null)) return;
    setData(previous=>previous?.key===key && previous.state.version>state.version ? previous : {key,state});
  },[selectionId]);
  const reload=useCallback(async () => {
    if(!session) return;
    const key=identity;
    try {
      const state=await request(`/rooms/${session.code}/voting`,{token:session.token});
      if(current.current===key) { accept(state,key); setError(''); }
    } catch(err) { if(current.current===key) setError(err.message); }
  },[session?.code,session?.token,identity,accept]);
  useEffect(()=>{setError(''); void reload();},[reload,refreshKey]);
  // Вкладка могла пропустить событие, пока устройство спало.
  useEffect(()=>{
    const wake=()=>{if(document.visibilityState==='visible') void reload();};
    window.addEventListener('focus',wake); document.addEventListener('visibilitychange',wake);
    return ()=>{window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
  },[reload]);
  async function vote(movieId,choice) {
    const key=identity;
    try {
      const result=await request(`/rooms/${session.code}/votes`,{method:'POST',token:session.token,body:{selectionId,movieId,choice}});
      accept(result.state,key);
      return result;
    } catch(err) {
      // При потерянном ответе БД могла уже принять голос. Перечитываем прогресс, не двигаем индекс локально.
      await reload();
      throw err;
    }
  }
  return {state:data?.key===identity ? data.state : null,error,reload,vote};
}
