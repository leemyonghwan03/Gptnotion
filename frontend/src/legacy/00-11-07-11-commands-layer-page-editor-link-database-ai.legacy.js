/* =========================================================================
   07-11 Commands Layer (Page / Editor / Link / Database / AI)
   ========================================================================= */
const StorageWriteGuard = {
  async ensurePersonalWritable(){
    if(!StorageConfig.isLocal()) return {mode:'indexeddb',ok:true};
    try{
      const h=await LocalDBClient.health();
      if(!h || h.ok===false || h.sqlite===false) throw new Error('SQLite 저장 엔진 상태가 정상이 아닙니다.');
      return Object.assign({mode:'localdb',ok:true},h||{});
    }catch(e){
      const base=StorageConfig.get().localEngineUrl||STORAGE_DEFAULTS.localEngineUrl;
      const err=new Error('현재 저장 방식이 로컬 SQLite인데 Local MCP에 연결할 수 없습니다.\n'+
        '먼저 start_gptnotion_local_mcp_v4.bat 를 실행한 뒤 다시 시도하세요.\n'+
        '연결 주소: '+base+'\n'+
        '원인: '+((e&&e.message)||String(e)));
      err.code='LOCAL_MCP_UNAVAILABLE';
      throw err;
    }
  },
  message(e){
    if(e&&e.code==='LOCAL_MCP_UNAVAILABLE') return e.message;
    const msg=(e&&e.message)?e.message:String(e||'알 수 없는 오류');
    if(StorageConfig.isLocal()) return '로컬 SQLite 저장 실패: '+msg+'\nLocal MCP 연결 상태를 확인하세요.';
    return '페이지 저장 실패: '+msg;
  }
};

const PageCommands = {
  async createPage(parentId, opts){
    setSaveStatus('saving');
    let page=null;
    let initialBlockCreated=false;
    const wantsTeam=!!(opts&&opts.team) || !!(parentId && isTeamPageId(parentId));
    try{
      if(!wantsTeam) await StorageWriteGuard.ensurePersonalWritable();
      page = wantsTeam
        ? await TeamPageFS.createPage(parentId||null, {icon:(opts&&opts.icon)||'📄'})
        : await PageStore.create({title:'', parentId: parentId||null, icon: (opts&&opts.icon) || '📄'});
      if(!wantsTeam){
        await BlockStore.create({pageId: page.id, type:'paragraph', content:''});
        initialBlockCreated=true;
      }
      if(parentId){ AppState.sidebar.expandedPages.add(parentId); }
      setSaveStatus('saved');
      renderSidebar();
      await App.openPage(page.id);
      focusTitle();
      return page;
    }catch(e){
      console.error('[PageCommands.createPage]',e);
      // 개인 페이지 레코드만 저장되고 최초 블록 저장에 실패한 경우 orphan page를 남기지 않는다.
      if(page && !wantsTeam && !initialBlockCreated){
        try{ await DBM.delete('pages',page.id); }catch(_){ }
        Cache.pages=Cache.pages.filter(p=>p.id!==page.id);
        Cache.blocks=Cache.blocks.filter(b=>b.pageId!==page.id);
      }
      setSaveStatus('error');
      const msg=StorageWriteGuard.message(e);
      toast(msg,'error');
      return null;
    }
  },
  async deletePage(pageId){
    if(AppState.currentView==='page' && AppState.currentPageId===pageId) await NoteCore.flushCurrent();
    if(isTeamPageId(pageId)){
      const p=PageStore.get(pageId);
      if(!confirm('팀 페이지 "'+((p&&p.title)||'제목 없음')+'"를 삭제하시겠습니까?\n이 페이지의 JSON 파일이 팀 폴더에서 삭제되어 모든 팀원에게 반영됩니다.')) return;
      setSaveStatus('saving');
      await TeamPageFS.permanentDelete(pageId);
      setSaveStatus('saved');
      renderSidebar();
      if(AppState.currentPageId===pageId) App.openFirstAvailable();
      toast('팀 페이지를 삭제했습니다.');
      return;
    }
    setSaveStatus('saving');
    await PageStore.delete(pageId);
    setSaveStatus('saved');
    renderSidebar();
    if(AppState.currentPageId === pageId){ App.openFirstAvailable(); }
    toast('휴지통으로 이동했습니다.');
  },
  async restorePage(pageId){
    await PageStore.restore(pageId);
    renderSidebar();
    renderCurrentView();
    toast('페이지를 복구했습니다.');
  },
  async permanentDeletePage(pageId){
    await PageStore.permanentDelete(pageId);
    renderSidebar();
    renderCurrentView();
    toast('영구 삭제되었습니다.');
  },
  async duplicatePage(pageId){
    if(AppState.currentView==='page' && AppState.currentPageId===pageId) await NoteCore.flushCurrent();
    setSaveStatus('saving');
    const p = await PageStore.duplicate(pageId);
    setSaveStatus('saved');
    renderSidebar();
    await App.openPage(p.id);
    toast('페이지를 복제했습니다.');
  },
  async renamePage(pageId, title){
    await PageStore.update(pageId, {title});
    renderSidebar();
    renderBreadcrumb();
    refreshAllMentionLabels();
  },
  async changeIcon(pageId, icon){
    await PageStore.update(pageId, {icon});
    renderSidebar();
    if(AppState.currentPageId===pageId) renderPageHeader();
  },
  async toggleFavorite(pageId){
    await PageStore.toggleFavorite(pageId);
    renderSidebar();
    if(AppState.currentView==='favorites') renderCurrentView();
  }
};

const EditorCommands = {
  async createBlock(pageId, afterBlockId, type){
    if(!window.GptNotionModular || !window.GptNotionModular.editor) throw new Error('MODULAR_EDITOR_UNAVAILABLE');
    return window.GptNotionModular.editor.createBlock(pageId, afterBlockId||null, type||'paragraph');
  },
  async deleteBlock(blockId){
    if(!window.GptNotionModular || !window.GptNotionModular.editor) throw new Error('MODULAR_EDITOR_UNAVAILABLE');
    return window.GptNotionModular.editor.deleteBlock(blockId);
  },
  async convertBlock(blockId, newType){
    let extra = {};
    if(newType==='todo') extra = {properties:{checked:false}};
    return BlockStore.changeType(blockId, newType, extra);
  },
  async moveBlock(blockId, targetId, position){
    if(!window.GptNotionModular || !window.GptNotionModular.editor) throw new Error('MODULAR_EDITOR_UNAVAILABLE');
    return window.GptNotionModular.editor.moveBlock(blockId, targetId, position);
  }
};

const LinkCommands = {
  async createMention(sourcePageId, sourceBlockId, targetPageId){
    return LinkStore.create({sourcePageId, sourceBlockId, targetPageId, type:'mention'});
  },
  async removeLink(linkId){
    return LinkStore.delete(linkId);
  },
  async syncBlockLinks(block){
    // recompute links for a block based on mention spans currently in its content
    await LinkStore.deleteBySourceBlock(block.id);
    const tmp = document.createElement('div');
    tmp.innerHTML = block.content || '';
    const spans = tmp.querySelectorAll('.mention[data-page-id]');
    for(const sp of spans){
      const targetId = sp.getAttribute('data-page-id');
      if(PageStore.get(targetId)){
        await LinkCommands.createMention(block.pageId, block.id, targetId);
      }
    }
  }
};

const DatabaseCommands = {
  async createDatabase(pageId, blockId){
    const db = await DatabaseStore.create({name:'데이터베이스', pageId});
    await DatabaseStore.addColumn(db.id, {name:'이름', type:'text'});
    await DatabaseStore.addColumn(db.id, {name:'상태', type:'select', properties:{options:[]}});
    await BlockStore.update(blockId, {type:'database', properties:{databaseId: db.id}});
    return db;
  },
  async deleteDatabase(databaseId){
    return DatabaseStore.delete(databaseId);
  }
};

