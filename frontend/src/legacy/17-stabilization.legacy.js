/* =========================================================================
   v3.2 Stabilization · large-library lazy RAG chunks + bounded browser cache
   ========================================================================= */
(function installStabilizationV32(){
  if(typeof window==='undefined'||typeof LocalDBClient==='undefined'||typeof RagLibraryStore==='undefined')return;
  const LazyChunks={
    threshold:12000,maxResident:7000,enabled:false,loaded:new Map(),pending:new Map(),sourceCount:0,
    touch(id){const rec=this.loaded.get(id);if(rec){rec.at=Date.now();this.loaded.delete(id);this.loaded.set(id,rec);}},
    async ensure(documentId){
      if(!this.enabled||!StorageConfig.isLocal())return RagLibraryStore.getChunks(documentId);
      if(this.loaded.has(documentId)){this.touch(documentId);return RagLibraryStore.getChunks(documentId);}
      if(this.pending.has(documentId))return this.pending.get(documentId);
      const job=(async()=>{
        const rows=[];let offset=0,guard=0;
        do{
          const r=await LocalMCPBridge.call('rag.document_chunks',{documentId:String(documentId),limit:2000,offset});
          const items=Array.isArray(r&&r.items)?r.items:[];rows.push(...items);
          if(!r||!r.hasMore)break;const next=Number(r.nextOffset);if(!Number.isFinite(next)||next<=offset)break;offset=next;
        }while(++guard<1000);
        Cache.ragChunks=Cache.ragChunks.filter(c=>c.documentId!==documentId);Cache.ragChunks.push(...rows);
        this.loaded.set(documentId,{at:Date.now(),count:rows.length});this.evict(documentId);
        return RagLibraryStore.getChunks(documentId);
      })().finally(()=>this.pending.delete(documentId));
      this.pending.set(documentId,job);return job;
    },
    evict(protectId){
      if(Cache.ragChunks.length<=this.maxResident)return;
      for(const [id] of this.loaded){
        if(id===protectId)continue;
        Cache.ragChunks=Cache.ragChunks.filter(c=>c.documentId!==id);this.loaded.delete(id);
        if(Cache.ragChunks.length<=this.maxResident)break;
      }
    },
    drop(documentId){Cache.ragChunks=Cache.ragChunks.filter(c=>c.documentId!==documentId);this.loaded.delete(documentId);this.pending.delete(documentId);}
  };
  window.GptNotionRagChunkLazy=LazyChunks;

  const previousLoad=loadAllCaches;
  loadAllCaches=async function(){
    if(!StorageConfig.isLocal())return previousLoad();
    try{
      const stats=await LocalDBClient.request('/api/stats',{method:'GET',timeoutMs:5000});
      const count=Number(stats&&stats.stores&&stats.stores.ragChunks||0);LazyChunks.sourceCount=count;LazyChunks.enabled=count>LazyChunks.threshold;
      if(!LazyChunks.enabled)return previousLoad();
      const stores=['pages','blocks','links','inbox','databases','databaseColumns','databaseRows','settings','metadata','pageVersions','ragDocuments'];
      const boot=await LocalDBClient.bootstrap(stores),s=(boot&&boot.stores)||{};
      Cache.pages=s.pages||[];Cache.blocks=s.blocks||[];Cache.links=s.links||[];Cache.inbox=s.inbox||[];Cache.databases=s.databases||[];Cache.columns=s.databaseColumns||[];Cache.rows=s.databaseRows||[];Cache.versions=s.pageVersions||[];Cache.ragDocuments=s.ragDocuments||[];Cache.ragChunks=[];Cache.ragEmbeddings=[];
      if(window.GptNotionRagLazy){GptNotionRagLazy.embeddingsLoaded=false;GptNotionRagLazy.embeddingPromise=null;}
      const settings=Array.isArray(s.settings)?s.settings.slice():[];
      try{const browser=(await DBM.rawIDBGetAll('settings')).filter(x=>BROWSER_ONLY_SETTING_KEYS.has(String(x.key))),map=new Map(settings.map(x=>[x.key,x]));browser.forEach(x=>map.set(x.key,x));const row=map.get('ragFolders');Cache.ragFolders=row&&Array.isArray(row.value)?row.value:[];}catch(_){const row=settings.find(x=>x&&x.key==='ragFolders');Cache.ragFolders=row&&Array.isArray(row.value)?row.value:[];}
      if(window.GptNotionCacheIndex)GptNotionCacheIndex.rebuild();
      GptNotionOptimization.bootstrap={at:Date.now(),counts:boot&&boot.counts||{},lazyEmbeddings:true,lazyChunks:true,sourceRagChunks:count};return true;
    }catch(e){console.warn('[v3.2 lazy chunk bootstrap fallback]',e);return previousLoad();}
  };

  RagLibraryStore.ensureChunks=async function(documentId){return LazyChunks.ensure(documentId);};
  const oldDelete=RagLibraryStore._deleteChunks.bind(RagLibraryStore);
  RagLibraryStore._deleteChunks=async function(documentId){
    if(LazyChunks.enabled&&StorageConfig.isLocal()){const out=await LocalMCPBridge.call('rag.document_purge',{documentId:String(documentId)});LazyChunks.drop(documentId);return out;}
    const out=await oldDelete(documentId);LazyChunks.drop(documentId);return out;
  };
  const oldReindex=RagLibraryStore.reindex.bind(RagLibraryStore);
  RagLibraryStore.reindex=async function(documentId,onProgress){if(LazyChunks.enabled)await LazyChunks.ensure(documentId);return oldReindex(documentId,onProgress);};
  const oldIndex=RagLibraryStore.indexEmbeddings.bind(RagLibraryStore);
  RagLibraryStore.indexEmbeddings=async function(documentId,onProgress){if(LazyChunks.enabled)await LazyChunks.ensure(documentId);return oldIndex(documentId,onProgress);};

  const oldPreview=window.openRagDocumentPreview;
  window.openRagDocumentPreview=function(documentId){
    if(!LazyChunks.enabled)return oldPreview(documentId);
    const d=RagLibraryStore.getDocument(documentId);if(!d)return;
    openModal('📚 '+d.name,'<div class="result-box">청크를 불러오는 중...</div>','<button class="btn" id="rag-preview-close">닫기</button>');
    const close=document.getElementById('rag-preview-close');if(close)close.addEventListener('click',closeModal);
    LazyChunks.ensure(documentId).then(()=>oldPreview(documentId)).catch(e=>toast(e.message,'error'));
  };
})();
