/* =========================================================================
   27.7d RAG 전용 채팅 뷰 (별도 UI, 대화형, 검색 범위 지정)
   ========================================================================= */
const RagChat = { history: [], scopePageIds: null, scopeDocumentIds: null, useRagLibrary: true, workspaceMode:'all', busy:false, requestSeq:0 };
function renderRagChatView(root){
  const wrap = document.createElement('div');
  wrap.className = 'view-container';
  wrap.style.maxWidth = '900px';
  wrap.innerHTML =
    '<div class="view-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">'+
      '<span>🔎 RAG 채팅</span>'+
      '<div style="display:flex;gap:6px;">'+
        '<button class="btn" id="rc-scope-btn">검색 범위: 전체</button>'+
        '<button class="btn" id="rc-reset-btn">대화 초기화</button>'+
      '</div>'+
    '</div>'+
    '<div class="hint" style="margin-bottom:12px;">저장된 메모(데이터베이스 값 포함)만 근거로 답변하는 전용 채팅입니다. 이전 대화 맥락을 기억하고, 가장 최근 답변 아래에 참고문서명만 중복 없이 한 번 표시합니다.</div>'+
    '<div id="rc-log" style="border:1px solid var(--border);border-radius:10px;padding:14px;min-height:340px;max-height:56vh;overflow-y:auto;display:flex;flex-direction:column;gap:12px;margin-bottom:10px;background:#fff;"></div>'+
    '<div style="display:flex;gap:8px;">'+
      '<input type="text" id="rc-input" placeholder="메모에 대해 무엇이든 물어보세요..." style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:13.5px;font-family:var(--font);">'+
      '<button class="btn btn-primary" id="rc-send">질문하기</button>'+
    '</div>';
  root.appendChild(wrap);

  function updateScopeBtnLabel(){
    const btn = wrap.querySelector('#rc-scope-btn');
    if(RagChat.workspaceMode==='none') btn.textContent='검색 범위: RAG 자료실';
    else if(RagChat.workspaceMode==='current') btn.textContent='검색 범위: 자료실 + 현재 페이지';
    else if(RagChat.workspaceMode==='selected') btn.textContent='검색 범위: 자료실 + '+((RagChat.scopePageIds&&RagChat.scopePageIds.length)||0)+'개 페이지';
    else btn.textContent='검색 범위: 전체';
  }
  updateScopeBtnLabel();

  function drawLog(){
    const log = wrap.querySelector('#rc-log');
    log.innerHTML = '';
    if(!RagChat.history.length){
      log.innerHTML = '<div class="empty-state">메모 기반으로 궁금한 점을 물어보세요.<br>예: "지난 회의에서 결정된 사항 정리해줘", "진행중인 항목만 알려줘"(후속 질문도 가능)</div>';
      return;
    }
    RagChat.history.forEach(turn=>{
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (turn.role==='user' ? 'user' : 'assistant');
      if(turn.role === 'user'){
        div.textContent = turn.text;
      } else {
        div.innerHTML = renderMarkdownToHTML(turn.text || '');
        if(turn.sources && turn.sources.length && turn === RagChat.history[RagChat.history.length-1]){
          const seen=new Set(); const labels=[];
          turn.sources.forEach(s=>{
            const key=s.source==='rag-document' ? 'rag:'+(s.documentId||s.title||'') : 'page:'+(s.pageId||s.title||'')+(s.source==='database'?':'+(s.databaseName||''):'');
            if(seen.has(key)) return; seen.add(key);
            if(s.source==='rag-document') labels.push('📚 '+(s.title||'RAG 자료'));
            else if(s.source==='database') labels.push('▤ '+(s.title||'제목 없음')+(s.databaseName?' / '+s.databaseName:''));
            else labels.push((s.icon||'📄')+' '+(s.title||'제목 없음'));
          });
          if(labels.length){
            const srcWrap=document.createElement('div');
            const shown=labels.slice(0,6);
            srcWrap.innerHTML='<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border);font-size:11.5px;color:var(--text-faint);white-space:normal;"><strong style="color:var(--text-dim);font-weight:600;">참고문서:</strong> '+shown.map(Utils.escapeHtml).join(' · ')+(labels.length>shown.length?' · 외 '+(labels.length-shown.length)+'개':'')+'</div>';
            div.appendChild(srcWrap);
          }
        }
      }
      log.appendChild(div);
    });
    log.scrollTop = log.scrollHeight;
  }
  drawLog();

  wrap.querySelector('#rc-scope-btn').addEventListener('click', ()=>{
    openRagScopeModal((ids)=>{ RagChat.scopePageIds = (ids && ids.length) ? ids : null; updateScopeBtnLabel(); });
  });
  const resetBtn=wrap.querySelector('#rc-reset-btn');
  resetBtn.addEventListener('click',()=>{
    if(RagChat.busy){toast('답변 생성이 끝난 뒤 대화를 초기화해 주세요.','error');return;}
    RagChat.requestSeq++;
    RagChat.history=[];
    drawLog();
  });

  const inputEl = wrap.querySelector('#rc-input');
  const sendBtn = wrap.querySelector('#rc-send');
  async function send(){
    if(RagChat.busy) return;
    const q=inputEl.value.trim(); if(!q) return;
    const requestId=++RagChat.requestSeq; RagChat.busy=true; sendBtn.disabled=true; resetBtn.disabled=true;
    RagChat.history.push({role:'user',text:q}); if(RagChat.history.length>30)RagChat.history.splice(0,RagChat.history.length-30);
    inputEl.value='';
    const pending={role:'assistant',text:'',sources:[],requestId}; RagChat.history.push(pending); drawLog();
    const log=wrap.querySelector('#rc-log'),lastBubble=log.lastElementChild; if(lastBubble)lastBubble.innerHTML='<span style="color:var(--text-faint);">생각하는 중...</span>';
    try{
      const prior=RagChat.history.filter(t=>t!==pending);
      const {answer,sources,retrievalMethod}=await ragChatAnswer(q,prior,RagChat.scopePageIds,(delta,full)=>{if(RagChat.requestSeq===requestId&&lastBubble){lastBubble.innerHTML=renderMarkdownToHTML(full);log.scrollTop=log.scrollHeight;}});
      if(RagChat.requestSeq!==requestId) return;
      const idx=RagChat.history.indexOf(pending); if(idx>=0)RagChat.history[idx]={role:'assistant',text:answer,sources,retrievalMethod};
    }catch(e){
      if(RagChat.requestSeq===requestId){const idx=RagChat.history.indexOf(pending);if(idx>=0)RagChat.history[idx]={role:'assistant',text:'오류: '+e.message,sources:[]};}
    }finally{
      if(RagChat.requestSeq===requestId){RagChat.busy=false;sendBtn.disabled=false;resetBtn.disabled=false;drawLog();}
    }
  }
  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();if(!RagChat.busy)send();}});
}
function openRagScopeModal(onConfirm){
  const docs = RagLibraryStore.getDocuments();
  const mode=RagChat.workspaceMode||'all';
  const bodyHtml =
    '<div class="form-row"><label>검색 소스</label><div style="display:flex;flex-direction:column;gap:5px;font-size:13px;">'+
      '<label><input type="radio" name="rc-workspace-mode" value="none" '+(mode==='none'?'checked':'')+'> RAG 자료실만</label>'+
      '<label><input type="radio" name="rc-workspace-mode" value="current" '+(mode==='current'?'checked':'')+'> RAG 자료실 + 현재 페이지</label>'+
      '<label><input type="radio" name="rc-workspace-mode" value="selected" '+(mode==='selected'?'checked':'')+'> RAG 자료실 + 선택한 페이지</label>'+
      '<label><input type="radio" name="rc-workspace-mode" value="all" '+(mode==='all'?'checked':'')+'> RAG 자료실 + 전체 워크스페이스</label>'+
    '</div></div>'+
    '<div class="form-row"><label>📚 RAG 자료실</label><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:400;color:var(--text);"><input type="checkbox" id="rc-use-library" '+(RagChat.useRagLibrary?'checked':'')+'> RAG 자료실을 우선 검색</label>'+
    '<div class="hint" style="margin:5px 0 7px;">문서를 선택하지 않으면 등록된 모든 RAG 자료를 사용합니다.</div>'+
    '<div id="rc-doc-list" style="border:1px solid var(--border);border-radius:8px;padding:6px;max-height:160px;overflow-y:auto;">'+
      (docs.length ? docs.map(d=>'<label class="picker-row"><span style="display:flex;align-items:center;gap:7px;min-width:0;"><input type="checkbox" class="rc-doc-check" value="'+d.id+'" '+((!RagChat.scopeDocumentIds||RagChat.scopeDocumentIds.includes(d.id))?'checked':'')+'><span>📚 '+Utils.escapeHtml(d.name)+'</span></span><span style="font-size:11px;color:var(--text-faint);">'+(d.chunkCount||0)+' 청크</span></label>').join('') : '<div class="popup-empty">등록된 RAG 자료가 없습니다.</div>')+
    '</div></div>'+
    '<div class="form-row" style="margin-top:12px;"><label>📄 기존 페이지 선택</label><div class="hint" style="margin-bottom:8px;">위에서 “선택한 페이지”를 고른 경우 적용됩니다. 기존 페이지 범위 선택 기능은 그대로 유지됩니다.</div>'+
    '<div style="border:1px solid var(--border);border-radius:8px;padding:6px;max-height:250px;overflow-y:auto;" id="rc-scope-tree"></div></div>';
  const box = openModal('RAG 검색 범위 설정', bodyHtml, '<button class="btn" id="rc-scope-cancel">취소</button><button class="btn btn-primary" id="rc-scope-apply">적용</button>');
  renderPagePickerTree(box.querySelector('#rc-scope-tree'));
  box.querySelector('#rc-scope-cancel').addEventListener('click', closeModal);
  box.querySelector('#rc-scope-apply').addEventListener('click', ()=>{
    const selectedMode=box.querySelector('input[name=rc-workspace-mode]:checked').value;
    const entries = getSelectedContextPages(box.querySelector('#rc-scope-tree'));
    const idSet = new Set();
    entries.forEach(e=>{
      idSet.add(e.pageId);
      if(e.includeSub){
        (function walk(pid){ PageStore.getChildren(pid).forEach(c=>{ idSet.add(c.id); walk(c.id); }); })(e.pageId);
      }
    });
    let pageIds=null;
    if(selectedMode==='current') pageIds=AppState.currentPageId ? [AppState.currentPageId] : [];
    else if(selectedMode==='selected') pageIds=Array.from(idSet);
    else pageIds=null;
    const checkedDocs=Array.from(box.querySelectorAll('.rc-doc-check:checked')).map(el=>el.value);
    const allDocCount=box.querySelectorAll('.rc-doc-check').length;
    RagChat.useRagLibrary=box.querySelector('#rc-use-library').checked;
    RagChat.scopeDocumentIds = (checkedDocs.length===0 || checkedDocs.length===allDocCount) ? null : checkedDocs;
    RagChat.workspaceMode=selectedMode;
    closeModal();
    onConfirm(pageIds);
  });
}
