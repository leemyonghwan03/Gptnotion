
/* =========================================================================
   OPT Runtime 1~3 · transport / pagination / batch / bootstrap
   ========================================================================= */
const GptNotionOptimization = window.GptNotionOptimization || (window.GptNotionOptimization={version:'OPT-1~3',startedAt:Date.now(),metrics:{requests:0,failures:0,totalMs:0,last:[]}});
(function installOpt1to3(){
  function timeoutFor(path,opt){
    if(opt&&Number(opt.timeoutMs)>0)return Number(opt.timeoutMs);
    const p=String(path||'');
    if(p==='/health')return 2200;
    if(p.startsWith('/api/stores')||p==='/api/bootstrap'||p==='/api/batch'||p==='/api/stats')return 10000;
    if(p.startsWith('/api/mcp/'))return 45000;
    if(p.startsWith('/api/jobs'))return 15000;
    return 30000;
  }
  LocalDBClient.request=async function(path,options){
    const started=performance.now(),controller=(typeof AbortController!=='undefined')?new AbortController():null;
    const opt=Object.assign({},options||{}),timeoutMs=timeoutFor(path,opt);delete opt.timeoutMs;
    const method=String(opt.method||'GET').toUpperCase(),headers=Object.assign({},opt.headers||{});
    if(method!=='GET'&&method!=='HEAD'&&opt.body!=null&&!Object.keys(headers).some(k=>k.toLowerCase()==='content-type'))headers['Content-Type']='application/json';
    opt.headers=headers;if(controller)opt.signal=controller.signal;
    const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;GptNotionOptimization.metrics.requests++;
    try{const res=await fetch(this.base()+path,opt),text=await res.text();let data=null;try{data=text?JSON.parse(text):null;}catch(e){data={message:text};}if(!res.ok)throw new Error((data&&data.error)||(data&&data.message)||('HTTP '+res.status));return data;}
    catch(e){GptNotionOptimization.metrics.failures++;throw e;}
    finally{if(timer)clearTimeout(timer);const ms=performance.now()-started,m=GptNotionOptimization.metrics;m.totalMs+=ms;m.last.push({path:String(path),ms:Math.round(ms),at:Date.now()});if(m.last.length>80)m.last.splice(0,m.last.length-80);}
  };
  LocalDBClient.health=function(){return this.request('/health',{method:'GET',timeoutMs:2200});};
  LocalDBClient.getAll=async function(store){const all=[];let offset=0,guard=0;do{const r=await this.request('/api/stores/'+encodeURIComponent(store)+'?limit=1000&offset='+offset,{method:'GET'}),items=Array.isArray(r&&r.items)?r.items:[];all.push(...items);if(!r||!r.hasMore)break;const next=Number(r.nextOffset);if(!Number.isFinite(next)||next<=offset)break;offset=next;}while(++guard<10000);return all;};
  LocalDBClient.bootstrap=async function(stores){const q=(stores||[]).map(String).join(',');return this.request('/api/bootstrap'+(q?'?stores='+encodeURIComponent(q):''),{method:'GET',timeoutMs:15000});};
  LocalDBClient.batch=async function(payload){return this.request('/api/batch',{method:'POST',body:JSON.stringify(payload||{}),timeoutMs:15000});};
  LocalDBClient.multiPut=async function(store,items){if(!items||!items.length)return true;await this.batch({puts:{[store]:items},deletes:{}});return true;};
  LocalDBClient.bulkDelete=async function(store,keys){if(!keys||!keys.length)return true;await this.batch({puts:{},deletes:{[store]:keys}});return true;};
  DBM.atomicBatch=async function(payload){payload=payload||{};if(StorageConfig.isLocal())return LocalDBClient.batch(payload);return DBM.rawIDBAtomicBatch(payload);};
  const originalLoadAllCaches=loadAllCaches;
  loadAllCaches=async function(){
    if(!StorageConfig.isLocal())return originalLoadAllCaches();
    const stores=['pages','blocks','links','inbox','databases','databaseColumns','databaseRows','settings','metadata','pageVersions','ragDocuments','ragChunks','ragEmbeddings'];
    try{const boot=await LocalDBClient.bootstrap(stores),s=(boot&&boot.stores)||{};Cache.pages=s.pages||[];Cache.blocks=s.blocks||[];Cache.links=s.links||[];Cache.inbox=s.inbox||[];Cache.databases=s.databases||[];Cache.columns=s.databaseColumns||[];Cache.rows=s.databaseRows||[];Cache.versions=s.pageVersions||[];Cache.ragDocuments=s.ragDocuments||[];Cache.ragChunks=s.ragChunks||[];Cache.ragEmbeddings=s.ragEmbeddings||[];const settings=Array.isArray(s.settings)?s.settings.slice():[];try{const browser=(await DBM.rawIDBGetAll('settings')).filter(x=>BROWSER_ONLY_SETTING_KEYS.has(String(x.key))),map=new Map(settings.map(x=>[x.key,x]));browser.forEach(x=>map.set(x.key,x));const row=map.get('ragFolders');Cache.ragFolders=row&&Array.isArray(row.value)?row.value:[];}catch(_){const row=settings.find(x=>x&&x.key==='ragFolders');Cache.ragFolders=row&&Array.isArray(row.value)?row.value:[];}GptNotionOptimization.bootstrap={at:Date.now(),counts:boot&&boot.counts||{}};return true;}
    catch(e){console.warn('[OPT bootstrap fallback]',e);return originalLoadAllCaches();}
  };
})();
