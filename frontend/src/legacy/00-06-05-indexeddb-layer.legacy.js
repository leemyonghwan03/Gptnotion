/* =========================================================================
   05 IndexedDB Layer
   ========================================================================= */
const DBM = (() => {
  let db = null;
  function initIDB(){
    return new Promise((resolve, reject) => {
      if(typeof indexedDB === 'undefined' || !indexedDB){
        reject(new Error('이 브라우저/환경에서는 IndexedDB를 사용할 수 없습니다. 브라우저 저장소는 팀 폴더 권한 보존에도 필요합니다.'));
        return;
      }
      let req;
      try{ req = indexedDB.open(DB_NAME, DB_VERSION); }catch(e){ reject(e); return; }
      req.onblocked = () => reject(new Error('다른 탭이나 창에서 이 앱(이전 버전 포함)이 이미 열려 있어 데이터베이스 업그레이드가 차단되었습니다. 다른 탭을 모두 닫고 새로고침해 주세요.'));
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if(!idb.objectStoreNames.contains('pages')){
          const st = idb.createObjectStore('pages', {keyPath:'id'});
          st.createIndex('parentId','parentId'); st.createIndex('deleted','deleted'); st.createIndex('pinned','pinned'); st.createIndex('updatedAt','updatedAt'); st.createIndex('accessedAt','accessedAt');
        }
        if(!idb.objectStoreNames.contains('blocks')){ const st=idb.createObjectStore('blocks',{keyPath:'id'}); st.createIndex('pageId','pageId'); st.createIndex('order','order'); st.createIndex('type','type'); }
        if(!idb.objectStoreNames.contains('links')){ const st=idb.createObjectStore('links',{keyPath:'id'}); st.createIndex('sourcePageId','sourcePageId'); st.createIndex('sourceBlockId','sourceBlockId'); st.createIndex('targetPageId','targetPageId'); }
        if(!idb.objectStoreNames.contains('inbox')) idb.createObjectStore('inbox',{keyPath:'id'});
        if(!idb.objectStoreNames.contains('databases')) idb.createObjectStore('databases',{keyPath:'id'});
        if(!idb.objectStoreNames.contains('databaseColumns')) idb.createObjectStore('databaseColumns',{keyPath:'id'});
        if(!idb.objectStoreNames.contains('databaseRows')) idb.createObjectStore('databaseRows',{keyPath:'id'});
        if(!idb.objectStoreNames.contains('settings')) idb.createObjectStore('settings',{keyPath:'key'});
        if(!idb.objectStoreNames.contains('metadata')) idb.createObjectStore('metadata',{keyPath:'key'});
        if(!idb.objectStoreNames.contains('pageVersions')){ const st=idb.createObjectStore('pageVersions',{keyPath:'id'}); st.createIndex('pageId','pageId'); st.createIndex('createdAt','createdAt'); }
        if(!idb.objectStoreNames.contains('blockEmbeddings')) idb.createObjectStore('blockEmbeddings',{keyPath:'blockId'});
        if(!idb.objectStoreNames.contains('ragDocuments')){ const st=idb.createObjectStore('ragDocuments',{keyPath:'id'}); st.createIndex('name','name'); st.createIndex('updatedAt','updatedAt'); }
        if(!idb.objectStoreNames.contains('ragChunks')){ const st=idb.createObjectStore('ragChunks',{keyPath:'id'}); st.createIndex('documentId','documentId'); st.createIndex('order','order'); }
        if(!idb.objectStoreNames.contains('ragEmbeddings')){ const st=idb.createObjectStore('ragEmbeddings',{keyPath:'chunkId'}); st.createIndex('documentId','documentId'); }
      };
      req.onsuccess = e => { db=e.target.result; resolve(db); };
      req.onerror = e => { const er=e.target.error; reject(new Error((er&&er.name?er.name+': ':'')+(er&&er.message?er.message:'IndexedDB 초기화 오류'))); };
    });
  }
  async function init(){
    await initIDB();
    if(StorageConfig.isLocal()){
      try{ await LocalDBClient.health(); }
      catch(e){ throw new Error('로컬 DB 모드가 선택되어 있지만 GptNotion Local Engine에 연결할 수 없습니다. Local Engine을 먼저 실행하거나 설정을 IndexedDB로 되돌려 주세요.\n'+e.message); }
    }
    return db;
  }
  function tx(storeNames, mode){ return db.transaction(storeNames, mode||'readonly'); }
  function idbGetAll(store){ return new Promise((resolve,reject)=>{ try{ const req=tx([store]).objectStore(store).getAll(); req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error); }catch(e){reject(e);} }); }
  function idbGet(store,id){ return new Promise((resolve,reject)=>{ try{ const req=tx([store]).objectStore(store).get(id); req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>reject(req.error); }catch(e){reject(e);} }); }
  function idbPut(store,obj){ return new Promise((resolve,reject)=>{ try{ const t=tx([store],'readwrite'); t.objectStore(store).put(obj); t.oncomplete=()=>resolve(obj); t.onerror=()=>reject(t.error); }catch(e){reject(e);} }); }
  function idbDel(store,id){ return new Promise((resolve,reject)=>{ try{ const t=tx([store],'readwrite'); t.objectStore(store).delete(id); t.oncomplete=()=>resolve(true); t.onerror=()=>reject(t.error); }catch(e){reject(e);} }); }
  function idbMultiPut(store,items){ return new Promise((resolve,reject)=>{ try{ const t=tx([store],'readwrite'); const os=t.objectStore(store); (items||[]).forEach(it=>os.put(it)); t.oncomplete=()=>resolve(true); t.onerror=()=>reject(t.error); }catch(e){reject(e);} }); }
  function idbClearStore(store){ return new Promise((resolve,reject)=>{ try{ const t=tx([store],'readwrite'); t.objectStore(store).clear(); t.oncomplete=()=>resolve(true); t.onerror=()=>reject(t.error); }catch(e){reject(e);} }); }
  function idbAtomicBatch(payload){
    payload=payload||{};
    const puts=payload.puts||{}, dels=payload.deletes||{};
    const stores=Array.from(new Set(Object.keys(puts).concat(Object.keys(dels)))).filter(Boolean);
    if(!stores.length) return Promise.resolve({ok:true,puts:0,deletes:0,operations:0});
    return new Promise((resolve,reject)=>{
      try{
        const t=tx(stores,'readwrite'); let putCount=0,deleteCount=0;
        for(const store of stores){
          const os=t.objectStore(store);
          for(const item of (puts[store]||[])){ os.put(item); putCount++; }
          for(const key of (dels[store]||[])){ os.delete(key); deleteCount++; }
        }
        t.oncomplete=()=>resolve({ok:true,puts:putCount,deletes:deleteCount,operations:putCount+deleteCount});
        t.onerror=()=>reject(t.error||new Error('IndexedDB atomic batch failed'));
        t.onabort=()=>reject(t.error||new Error('IndexedDB atomic batch aborted'));
      }catch(e){ reject(e); }
    });
  }
  function browserOnly(store,keyOrObj){
    if(store!=='settings') return false;
    const key=(keyOrObj&&typeof keyOrObj==='object') ? keyOrObj.key : keyOrObj;
    return BROWSER_ONLY_SETTING_KEYS.has(String(key));
  }
  async function getAll(store){
    if(!StorageConfig.isLocal()) return idbGetAll(store);
    if(store!=='settings') return LocalDBClient.getAll(store);
    const local=await LocalDBClient.getAll(store);
    const browser=(await idbGetAll(store)).filter(x=>browserOnly(store,x));
    const map=new Map(local.map(x=>[x.key,x])); browser.forEach(x=>map.set(x.key,x)); return Array.from(map.values());
  }
  async function get(store,id){ if(!StorageConfig.isLocal() || browserOnly(store,id)) return idbGet(store,id); return LocalDBClient.get(store,id); }
  async function put(store,obj){ if(!StorageConfig.isLocal() || browserOnly(store,obj)) return idbPut(store,obj); return LocalDBClient.put(store,obj); }
  async function del(store,id){ if(!StorageConfig.isLocal() || browserOnly(store,id)) return idbDel(store,id); return LocalDBClient.del(store,id); }
  async function multiPut(store,items){
    if(!StorageConfig.isLocal()) return idbMultiPut(store,items);
    if(store!=='settings') return LocalDBClient.multiPut(store,items);
    const browser=(items||[]).filter(x=>browserOnly(store,x)); const local=(items||[]).filter(x=>!browserOnly(store,x));
    if(browser.length) await idbMultiPut(store,browser); if(local.length) await LocalDBClient.multiPut(store,local); return true;
  }
  async function clearStore(store){
    if(!StorageConfig.isLocal()) return idbClearStore(store);
    if(store!=='settings') return LocalDBClient.clearStore(store);
    await LocalDBClient.clearStore(store);
    return true;
  }
  async function clearAll(){
    if(StorageConfig.isLocal()) await LocalDBClient.clearAll();
    else for(const st of STORES) await idbClearStore(st);
  }
  return {
    init, getAll, get, put, delete:del, multiPut, clearStore, clearAll,
    rawIDBGetAll:idbGetAll, rawIDBGet:idbGet, rawIDBPut:idbPut, rawIDBDelete:idbDel, rawIDBMultiPut:idbMultiPut, rawIDBClearStore:idbClearStore, rawIDBAtomicBatch:idbAtomicBatch
  };
})();
