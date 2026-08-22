/* =========================================================================
   06 Store Layer
   ========================================================================= */
const PageStore = {
  async create({title, parentId, icon}){
    const p = {
      id: uid('page'), title: title || '제목 없음', icon: icon || '📄', parentId: parentId || null,
      pinned:false, deleted:false, createdAt: Utils.now(), updatedAt: Utils.now(), accessedAt: Utils.now(),
      share: {enabled:false, shareId:null, permission:'view'}
    };
    await DBM.put('pages', p);
    Cache.pages.push(p);
    return p;
  },
  get(id){ return Cache.pages.find(p => p.id === id) || null; },
  getAll(){ return Cache.pages; },
  async update(id, patch){
    const p=PageStore.get(id);
    if(!p) return null;
    if(isTeamPageObject(p)){Object.assign(p,patch,{updatedAt:Utils.now()});TeamPageFS.scheduleSave(id);return p;}
    const next=Object.assign({},p,patch,{updatedAt:Utils.now()});
    await DBM.put('pages',next);
    Object.assign(p,next);
    return p;
  },
  async delete(id){
    return PageStore.update(id, {deleted:true});
  },
  async restore(id){
    return PageStore.update(id, {deleted:false});
  },
  async permanentDelete(id){
    if(isTeamPageId(id)) return TeamPageFS.permanentDelete(id);
    const blocks = Cache.blocks.filter(b => b.pageId === id);
    const links = Cache.links.filter(l => l.sourcePageId === id || l.targetPageId === id);
    for(const b of blocks){ await DBM.delete('blocks', b.id); }
    for(const l of links){ await DBM.delete('links', l.id); }
    await DBM.delete('pages', id);
    Cache.blocks = Cache.blocks.filter(b => b.pageId !== id);
    Cache.links = Cache.links.filter(l => l.sourcePageId !== id && l.targetPageId !== id);
    Cache.pages = Cache.pages.filter(p => p.id !== id);
    const dbBlockIds = blocks.filter(b=>b.type==='database').map(b=>b.properties && b.properties.databaseId).filter(Boolean);
    for(const dbId of dbBlockIds){ await DatabaseCommands.deleteDatabase(dbId); }
    const children = Cache.pages.filter(p => p.parentId === id);
    for(const c of children){ await PageStore.permanentDelete(c.id); }
  },
  async duplicate(id){
    const orig = PageStore.get(id);
    if(!orig) return null;
    if(isTeamPageObject(orig)) return TeamPageFS.duplicatePage(id);
    const now=Utils.now();
    const newPage={id:uid('page'),title:orig.title+' (복사본)',icon:orig.icon||'📄',parentId:orig.parentId||null,pinned:false,deleted:false,createdAt:now,updatedAt:now,accessedAt:now,share:{enabled:false,shareId:null,permission:'view'}};
    const sourceBlocks=BlockStore.getByPage(id), blockPuts=[], databasePuts=[], columnPuts=[], rowPuts=[];
    for(const b of sourceBlocks){
      const props=JSON.parse(JSON.stringify(b.properties||{}));
      if(b.type==='database'&&props.databaseId){
        const srcDb=DatabaseStore.get(props.databaseId);
        if(srcDb){
          const newDbId=uid('database'),columnIdMap=new Map();
          databasePuts.push(Object.assign({},srcDb,{id:newDbId,pageId:newPage.id,name:srcDb.name,createdAt:now,updatedAt:now}));
          for(const c of DatabaseStore.getColumns(srcDb.id)){
            const newColId=uid('col'); columnIdMap.set(c.id,newColId);
            columnPuts.push(Object.assign({},c,{id:newColId,databaseId:newDbId,properties:JSON.parse(JSON.stringify(c.properties||{}))}));
          }
          for(const r of DatabaseStore.getRows(srcDb.id)){
            const values={};
            for(const [oldColId,value] of Object.entries(r.values||{})) values[columnIdMap.get(oldColId)||oldColId]=JSON.parse(JSON.stringify(value));
            rowPuts.push(Object.assign({},r,{id:uid('row'),databaseId:newDbId,pageId:null,values,createdAt:now,updatedAt:now}));
          }
          props.databaseId=newDbId;
        }
      }
      blockPuts.push({id:uid('block'),pageId:newPage.id,type:b.type,content:b.content,depth:b.depth||0,properties:props,order:b.order,createdAt:now,updatedAt:now});
    }
    const puts={pages:[newPage]};
    if(blockPuts.length) puts.blocks=blockPuts;
    if(databasePuts.length) puts.databases=databasePuts;
    if(columnPuts.length) puts.databaseColumns=columnPuts;
    if(rowPuts.length) puts.databaseRows=rowPuts;
    await DBM.atomicBatch({puts,deletes:{}});
    Cache.pages.push(newPage); Cache.blocks.push(...blockPuts); Cache.databases.push(...databasePuts); Cache.columns.push(...columnPuts); Cache.rows.push(...rowPuts);
    return newPage;
  },
  async toggleFavorite(id){
    const p = PageStore.get(id);
    if(!p) return null;
    return PageStore.update(id, {pinned: !p.pinned});
  },
  async touch(id){
    const p=PageStore.get(id);
    if(isTeamPageObject(p)){ p.accessedAt=Utils.now(); return p; }
    return PageStore.update(id, {accessedAt: Utils.now()});
  },
  getChildren(parentId){
    return Cache.pages.filter(p => p.storageScope!=='team' && p.parentId === parentId && !p.deleted).sort((a,b)=>a.createdAt-b.createdAt);
  },
  getTree(){
    return PageStore.getChildren(null);
  }
};

const BlockStore = {
  async create({pageId, type, content, depth, properties, order}){
    const b = {
      id: uid('block'), pageId, type: type || 'paragraph', content: content || '',
      depth: depth || 0, properties: properties || {}, order: order != null ? order : BlockStore.nextOrder(pageId),
      createdAt: Utils.now(), updatedAt: Utils.now()
    };
    if(isTeamPageId(pageId)){ b.storageScope='team'; Cache.blocks.push(b); TeamPageFS.scheduleSave(pageId); return b; }
    await DBM.put('blocks', b);
    Cache.blocks.push(b);
    return b;
  },
  nextOrder(pageId){
    const list = Cache.blocks.filter(b=>b.pageId===pageId);
    return list.length ? Math.max(...list.map(b=>b.order)) + 1 : 0;
  },
  get(id){ return Cache.blocks.find(b=>b.id===id) || null; },
  getByPage(pageId){ return Cache.blocks.filter(b=>b.pageId===pageId).sort((a,b)=>a.order-b.order); },
  async update(id, patch){
    const b=BlockStore.get(id);
    if(!b) return null;
    if(isTeamPageId(b.pageId)){Object.assign(b,patch,{updatedAt:Utils.now(),storageScope:'team'});TeamPageFS.scheduleSave(b.pageId);return b;}
    const next=Object.assign({},b,patch,{updatedAt:Utils.now()});
    await DBM.put('blocks',next);
    Object.assign(b,next);
    return b;
  },
  async delete(id){
    const existing=BlockStore.get(id);
    if(!existing) return;
    const teamPageId=isTeamPageId(existing.pageId)?existing.pageId:null;
    const links=Cache.links.filter(l=>l.sourceBlockId===id);
    if(!teamPageId) await DBM.atomicBatch({puts:{},deletes:{blocks:[id],links:links.map(l=>l.id)}});
    Cache.blocks=Cache.blocks.filter(b=>b.id!==id);
    const linkIds=new Set(links.map(l=>l.id));
    Cache.links=Cache.links.filter(l=>!linkIds.has(l.id));
    if(teamPageId) TeamPageFS.scheduleSave(teamPageId);
  },
  async deleteByPage(pageId){
    const list = BlockStore.getByPage(pageId);
    for(const b of list){ await BlockStore.delete(b.id); }
  },
  async move(blockId, targetBlockId, position){
    const list = BlockStore.getByPage(BlockStore.get(blockId).pageId);
    const filtered = list.filter(b=>b.id!==blockId);
    const moving = BlockStore.get(blockId);
    let idx = filtered.findIndex(b=>b.id===targetBlockId);
    if(idx===-1) idx = filtered.length-1;
    if(position==='after') idx += 1;
    filtered.splice(idx, 0, moving);
    const team=isTeamPageId(moving.pageId);
    for(let i=0;i<filtered.length;i++){
      filtered[i].order = i;
      if(!team) await DBM.put('blocks', filtered[i]);
    }
    if(team) TeamPageFS.scheduleSave(moving.pageId);
    return true;
  },
  async changeType(id, newType, extra){
    return BlockStore.update(id, Object.assign({type:newType}, extra||{}));
  }
};

const LinkStore = {
  async create({sourcePageId, sourceBlockId, targetPageId, type}){
    const l = { id: uid('link'), sourcePageId, sourceBlockId, targetPageId, type: type||'mention', createdAt: Utils.now() };
    if(isTeamPageId(sourcePageId)){ l.storageScope='team'; Cache.links.push(l); TeamPageFS.scheduleSave(sourcePageId); return l; }
    await DBM.put('links', l);
    Cache.links.push(l);
    return l;
  },
  get(id){ return Cache.links.find(l=>l.id===id) || null; },
  async delete(id){
    const l=LinkStore.get(id);
    const teamPid=l && isTeamPageId(l.sourcePageId) ? l.sourcePageId : null;
    if(!teamPid) await DBM.delete('links', id);
    Cache.links = Cache.links.filter(x=>x.id!==id);
    if(teamPid) TeamPageFS.scheduleSave(teamPid);
  },
  getBySourcePage(pageId){ return Cache.links.filter(l=>l.sourcePageId===pageId); },
  getBySourceBlock(blockId){ return Cache.links.filter(l=>l.sourceBlockId===blockId); },
  getBacklinks(targetPageId){ return Cache.links.filter(l=>l.targetPageId===targetPageId); },
  async deleteByPage(pageId){
    const list = Cache.links.filter(l=>l.sourcePageId===pageId || l.targetPageId===pageId);
    for(const l of list){ await LinkStore.delete(l.id); }
  },
  async deleteBySourceBlock(blockId){
    const list = LinkStore.getBySourceBlock(blockId);
    for(const l of list){ await LinkStore.delete(l.id); }
  }
};

const InboxStore = {
  async create(content){
    const it = { id: uid('inbox'), content: content||'', type:'note', createdAt: Utils.now(), updatedAt: Utils.now(), convertedPageId:null };
    await DBM.put('inbox', it);
    Cache.inbox.unshift(it);
    return it;
  },
  get(id){ return Cache.inbox.find(i=>i.id===id) || null; },
  getAll(){ return Cache.inbox.slice().sort((a,b)=>b.createdAt-a.createdAt); },
  async update(id, patch){
    const it=InboxStore.get(id);
    if(!it) return null;
    const next=Object.assign({},it,patch,{updatedAt:Utils.now()});
    await DBM.put('inbox',next);
    Object.assign(it,next);
    return it;
  },
  async delete(id){
    await DBM.delete('inbox', id);
    Cache.inbox = Cache.inbox.filter(i=>i.id!==id);
  },
  async convertToPage(id){
    const it = InboxStore.get(id);
    if(!it) return null;
    const page = await PageStore.create({title: (it.content||'제목 없음').slice(0,60), parentId:null});
    await BlockStore.create({pageId: page.id, type:'paragraph', content: Utils.escapeHtml(it.content||'')});
    await InboxStore.update(id, {convertedPageId: page.id});
    return page;
  }
};

const DatabaseStore = {
  async create({name, pageId}){
    const d = { id: uid('database'), name: name || '데이터베이스', pageId, createdAt: Utils.now(), updatedAt: Utils.now() };
    if(isTeamPageId(pageId)){ d.storageScope='team'; Cache.databases.push(d); TeamPageFS.scheduleSave(pageId); return d; }
    await DBM.put('databases', d);
    Cache.databases.push(d);
    return d;
  },
  get(id){ return Cache.databases.find(d=>d.id===id) || null; },
  async update(id, patch){
    const d=DatabaseStore.get(id);
    if(!d) return null;
    if(isTeamPageId(d.pageId)){Object.assign(d,patch,{updatedAt:Utils.now(),storageScope:'team'});TeamPageFS.scheduleSave(d.pageId);return d;}
    const next=Object.assign({},d,patch,{updatedAt:Utils.now()});
    await DBM.put('databases',next);
    Object.assign(d,next);
    return d;
  },
  async delete(id){
    const db=DatabaseStore.get(id);
    const teamPid=db && isTeamPageId(db.pageId) ? db.pageId : null;
    const cols = Cache.columns.filter(c=>c.databaseId===id);
    const rows = Cache.rows.filter(r=>r.databaseId===id);
    if(!teamPid) await DBM.atomicBatch({puts:{},deletes:{databaseColumns:cols.map(c=>c.id),databaseRows:rows.map(r=>r.id),databases:[id]}});
    Cache.columns = Cache.columns.filter(c=>c.databaseId!==id);
    Cache.rows = Cache.rows.filter(r=>r.databaseId!==id);
    Cache.databases = Cache.databases.filter(d=>d.id!==id);
    if(teamPid) TeamPageFS.scheduleSave(teamPid);
  },
  getColumns(databaseId){ return Cache.columns.filter(c=>c.databaseId===databaseId).sort((a,b)=>a.order-b.order); },
  getRows(databaseId){ return Cache.rows.filter(r=>r.databaseId===databaseId); },
  async addColumn(databaseId, {name, type, properties}){
    pushUndoForDatabase(databaseId);
    const order = DatabaseStore.getColumns(databaseId).length;
    const c = { id: uid('col'), databaseId, name: name||'속성', type: type||'text', order, properties: properties || (type==='select' ? {options:[]} : {}) };
    if(isTeamDatabase(databaseId)){ c.storageScope='team'; Cache.columns.push(c); TeamPageFS.scheduleSave(databasePageId(databaseId)); return c; }
    await DBM.put('databaseColumns', c);
    Cache.columns.push(c);
    return c;
  },
  async updateColumn(id, patch){
    const c=Cache.columns.find(x=>x.id===id);
    if(!c) return null;
    pushUndoForDatabase(c.databaseId);
    if(isTeamDatabase(c.databaseId)){Object.assign(c,patch,{storageScope:'team'});TeamPageFS.scheduleSave(databasePageId(c.databaseId));return c;}
    const next=Object.assign({},c,patch);
    await DBM.put('databaseColumns',next);
    Object.assign(c,next);
    return c;
  },
  async deleteColumn(id){
    const c=Cache.columns.find(x=>x.id===id);
    if(!c) return;
    pushUndoForDatabase(c.databaseId);
    const teamPid=isTeamDatabase(c.databaseId)?databasePageId(c.databaseId):null;
    const affected=Cache.rows.filter(r=>r.databaseId===c.databaseId&&r.values&&Object.prototype.hasOwnProperty.call(r.values,id));
    const nextRows=affected.map(r=>Object.assign({},r,{values:Object.assign({},r.values),updatedAt:Utils.now()}));
    nextRows.forEach(r=>delete r.values[id]);
    if(!teamPid) await DBM.atomicBatch({puts:{databaseRows:nextRows},deletes:{databaseColumns:[id]}});
    Cache.columns=Cache.columns.filter(x=>x.id!==id);
    if(teamPid){
      for(const r of affected) if(r.values) delete r.values[id];
      TeamPageFS.scheduleSave(teamPid);
    }else{
      const byId=new Map(nextRows.map(r=>[r.id,r]));
      Cache.rows=Cache.rows.map(r=>byId.get(r.id)||r);
    }
  },
  async addRow(databaseId, values){
    pushUndoForDatabase(databaseId);
    const r = { id: uid('row'), databaseId, values: values||{}, pageId:null, createdAt: Utils.now(), updatedAt: Utils.now() };
    if(isTeamDatabase(databaseId)){ r.storageScope='team'; Cache.rows.push(r); TeamPageFS.scheduleSave(databasePageId(databaseId)); return r; }
    await DBM.put('databaseRows', r);
    Cache.rows.push(r);
    return r;
  },
  async updateRow(id, values){
    const r=Cache.rows.find(x=>x.id===id);
    if(!r) return null;
    const burstKey='dbrow_'+id;
    if(!ActiveEditBursts.has(burstKey)){
      ActiveEditBursts.add(burstKey); pushUndoForDatabase(r.databaseId);
      setTimeout(()=>ActiveEditBursts.delete(burstKey),SAVE_DEBOUNCE+200);
    }
    if(isTeamDatabase(r.databaseId)){
      r.values=Object.assign({},r.values,values); r.updatedAt=Utils.now(); r.storageScope='team'; TeamPageFS.scheduleSave(databasePageId(r.databaseId)); return r;
    }
    const next=Object.assign({},r,{values:Object.assign({},r.values,values),updatedAt:Utils.now()});
    await DBM.put('databaseRows',next);
    Object.assign(r,next);
    return r;
  },
  async deleteRow(id){
    const r = Cache.rows.find(x=>x.id===id);
    if(r) pushUndoForDatabase(r.databaseId);
    const teamPid=r && isTeamDatabase(r.databaseId) ? databasePageId(r.databaseId) : null;
    if(!teamPid) await DBM.delete('databaseRows', id);
    Cache.rows = Cache.rows.filter(x=>x.id!==id);
    if(teamPid) TeamPageFS.scheduleSave(teamPid);
  },
  filter(databaseId, colId, matcher){
    return DatabaseStore.getRows(databaseId).filter(r => matcher(r.values ? r.values[colId] : undefined));
  },
  sort(rows, colId, dir){
    return rows.slice().sort((a,b)=>{
      const av = (a.values||{})[colId], bv = (b.values||{})[colId];
      if(av==null && bv==null) return 0;
      if(av==null) return 1; if(bv==null) return -1;
      if(av>bv) return dir==='asc'?1:-1;
      if(av<bv) return dir==='asc'?-1:1;
      return 0;
    });
  }
};
function pushUndoForDatabase(databaseId){
  try{
    const hostBlock = Cache.blocks.find(b => b.type==='database' && b.properties && b.properties.databaseId === databaseId);
    if(hostBlock) UndoManager.pushUndo(hostBlock.pageId);
  }catch(e){ console.error('DB undo 훅 오류:', e); }
}
