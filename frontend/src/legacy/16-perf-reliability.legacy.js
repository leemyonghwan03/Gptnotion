/* v3.1 reliability: keep derived DB indexes coherent after deep page duplication. */
(function(){
  if(window.GptNotionCacheIndex && PageStore && typeof PageStore.duplicate==='function'){
    const originalDuplicate=PageStore.duplicate.bind(PageStore);
    PageStore.duplicate=async function(id){
      const result=await originalDuplicate(id);
      if(result) GptNotionCacheIndex.rebuildDatabases();
      return result;
    };
  }
})();
