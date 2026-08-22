/* =========================================================================
   v3.3 Unified AI Agent · one brain for topbar/chat/selection/page AI
   ========================================================================= */
(function installUnifiedAIAgentV33(){
  if(typeof window==='undefined'||typeof AIChat==='undefined'||typeof sendAIChatMessage!=='function') return;

  const state={
    conversationId:'agent_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),
    source:'chat',
    currentGoal:null,
    pendingQuestion:null,
    lastContext:null,
    busy:false
  };

  function normalizeSource(source){
    const allowed=['chat','topbar','selection-ai','page-ai','ai-tools','quick-reply'];
    return allowed.includes(source)?source:'chat';
  }
  function selectedBlockIds(){
    try{
      if(typeof ProductivityBlocks==='undefined'||ProductivityBlocks.selectionPageId!==AppState.currentPageId) return [];
      return Array.from(ProductivityBlocks.selectedIds||[]).map(String);
    }catch(_){ return []; }
  }
  function selectedText(){
    try{
      const sel=window.getSelection();
      const text=sel&&sel.rangeCount?String(sel.toString()||'').trim():'';
      return text?text.slice(0,4000):null;
    }catch(_){ return null; }
  }
  function captureContext(source){
    const pageId=(typeof AppState!=='undefined'&&AppState.currentPageId)?String(AppState.currentPageId):null;
    let pageTitle=null;
    try{const p=pageId&&typeof PageStore!=='undefined'?PageStore.get(pageId):null;pageTitle=p?String(p.title||'제목 없음'):null;}catch(_){}
    const ctx={
      source:normalizeSource(source),
      view:(typeof AppState!=='undefined'&&AppState.currentView)?String(AppState.currentView):'unknown',
      pageId,
      pageTitle,
      selectedBlockIds:selectedBlockIds(),
      selectedText:selectedText()
    };
    state.lastContext=ctx;
    return ctx;
  }
  function contextLabel(ctx){
    const parts=[];
    if(ctx.pageTitle) parts.push('📄 '+ctx.pageTitle);
    else if(ctx.view) parts.push('화면: '+ctx.view);
    if(ctx.selectedBlockIds.length) parts.push('선택 '+ctx.selectedBlockIds.length+'개');
    if(ctx.selectedText) parts.push('텍스트 선택됨');
    return parts.join(' · ')||'워크스페이스';
  }
  function ensureContextChip(){
    const panel=document.getElementById('ai-panel');
    if(!panel) return null;
    let chip=panel.querySelector('#unified-ai-context-chip');
    if(!chip){
      chip=document.createElement('div');chip.id='unified-ai-context-chip';
      chip.style.cssText='margin:6px 10px 0;padding:7px 9px;border:1px solid var(--border);border-radius:8px;background:var(--bg-subtle);font-size:11px;color:var(--text-dim);display:flex;gap:8px;align-items:center;justify-content:space-between;';
      const header=panel.querySelector('.ai-panel-header');
      if(header&&header.parentNode) header.parentNode.insertBefore(chip,header.nextSibling);
    }
    return chip;
  }
  function updateContextChip(){
    const ctx=captureContext(state.source);
    const chip=ensureContextChip();if(!chip)return;
    const pending=state.pendingQuestion?' · 답변 대기 중':'';
    chip.innerHTML='<span>🧭 '+Utils.escapeHtml(contextLabel(ctx))+Utils.escapeHtml(pending)+'</span><span style="white-space:nowrap;">통합 Agent</span>';
  }
  function open(source){
    state.source=normalizeSource(source);
    AIChat.operatorMode=true;
    toggleAIPanel(true);
    updateAIOperatorModeUI();
    updateContextChip();
    requestAnimationFrame(()=>{const input=document.getElementById('ai-chat-input');if(input){input.focus();input.setAttribute('data-placeholder',placeholderFor(state.source));}});
  }
  function placeholderFor(source){
    if(source==='topbar') return '현재 페이지를 기준으로 그냥 말하세요. 예: "규정이랑 비교해서 이상한 부분 고쳐줘"';
    if(source==='selection-ai') return '선택한 내용에 원하는 작업을 말하세요. 예: "이걸 더 간결하게 정리해줘"';
    if(source==='page-ai') return '현재 페이지에 원하는 일을 그대로 말하세요.';
    return '무엇이든 말하세요. 필요한 Gpt노션 도구는 Agent가 찾아서 사용합니다.';
  }
  function looksLikeCancellation(text){return /^(취소|그만|중단|새 질문|다른 질문|완전히 새로)(?:\s*(?:할게|할래|해줘|하자))?$/.test(String(text||'').trim());}
  function pendingReplyText(text){
    const p=state.pendingQuestion;if(!p)return null;
    if(looksLikeCancellation(text)){state.pendingQuestion=null;return null;}
    const raw=String(text||'').trim();if(!raw)return null;
    const options=Array.isArray(p.options)?p.options:[];
    const short=raw.length<=100;
    const matched=options.some((o,i)=>raw===String(o.label||'')||raw===String(o.id||'')||raw===String(i+1)+'번'||raw===String(i+1));
    if(!short&&!matched)return null;
    return '[직전 확인 질문에 대한 사용자 답변]\n질문: '+p.question+'\n선택지: '+options.map((o,i)=>(i+1)+'. '+o.label).join(' | ')+'\n사용자 답변: '+raw+'\n원래 목표: '+String(p.originalGoal||state.currentGoal||'')+'\n이 답변을 반영해 원래 작업을 계속하세요. 같은 질문을 반복하지 마세요.';
  }
  function prepare(text,source){
    const raw=String(text||'').trim();
    const ctx=captureContext(source||state.source);
    const previousGoal=state.currentGoal;
    const pending=pendingReplyText(raw);
    if(!pending) state.currentGoal=raw||state.currentGoal;
    const context='[Unified Agent Context]\n'+
      '진입점: '+ctx.source+'\n현재 화면: '+ctx.view+'\n현재 페이지: '+(ctx.pageTitle||'(없음)')+' / '+(ctx.pageId||'(없음)')+'\n'+
      '선택 블록: '+(ctx.selectedBlockIds.length?ctx.selectedBlockIds.join(', '):'(없음)')+'\n'+
      '선택 텍스트: '+(ctx.selectedText||'(없음)')+'\n현재 목표: '+String(state.currentGoal||raw||'')+'\n\n'+
      '[Unified Agent Policy]\n'+
      '- "이거/여기/현재/방금 것"은 현재 페이지, 선택 영역, 최근 대화의 순서로 우선 해석합니다.\n'+
      '- 페이지/규정/RAG/DB/파일/최근 작업처럼 앱 안에서 확인 가능한 사실은 관련 Tool로 먼저 확인합니다. 확인 가능한데 바로 "모르겠습니다"로 끝내지 않습니다.\n'+
      '- 사용자가 행동을 요청하면 설명만 하지 말고 필요한 Tool을 연속 실행해 목표를 달성합니다.\n'+
      '- Tool로 해결 가능한 모호함은 사용자에게 묻지 말고 먼저 검색/읽기/resolve 도구를 사용합니다.\n'+
      '- 정말로 결과가 달라지는 선택이 필요할 때만 질문 하나를 하고 2~4개 선택지를 제공합니다. 사용자는 같은 입력창에 자연어로 답할 수 있습니다.\n'+
      '- 확인 질문이 꼭 필요하면 기존 Operator와 호환되도록 final.answer를 [[GPTN_CLARIFY]]{\"question\":\"질문\",\"options\":[\"추천 선택\",\"다른 선택\"],\"reason\":\"필요한 이유\"} 형식으로 반환합니다.\n'+
      '- 삭제/전체 교체/관리자 변경 등 위험 작업의 승인 절차는 기존 앱 정책을 그대로 따릅니다.\n';
    const basePrompt=context+'\n'+(pending||('[사용자 요청]\n'+raw));
    try{
      if(window.HumanConversationTuning&&typeof window.HumanConversationTuning.enrichPrompt==='function'){
        return window.HumanConversationTuning.enrichPrompt({raw,source:ctx.source,context:ctx,pendingText:pending,previousGoal,currentGoal:state.currentGoal,pendingQuestion:state.pendingQuestion},basePrompt);
      }
    }catch(e){console.warn('Human conversation tuning fallback:',e);}
    return basePrompt;
  }
  function normalizeClarification(raw){
    if(!raw||typeof raw!=='object')return null;
    const question=String(raw.question||'').trim();if(!question)return null;
    const options=(Array.isArray(raw.options)?raw.options:[]).slice(0,4).map((x,i)=>typeof x==='string'?{id:String(i+1),label:x}:{id:String((x&&x.id)||i+1),label:String((x&&x.label)||'')}).filter(x=>x.label.trim());
    return {question,options,reason:String(raw.reason||''),originalGoal:String(raw.originalGoal||state.currentGoal||'')};
  }
  function setPending(raw){
    state.pendingQuestion=normalizeClarification(raw);updateContextChip();return state.pendingQuestion;
  }
  function clearPending(){state.pendingQuestion=null;updateContextChip();}
  function renderQuickReplies(container,pending){
    if(!container||!pending)return;
    const wrap=document.createElement('div');wrap.className='unified-ai-quick-replies';wrap.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;';
    pending.options.forEach((opt,i)=>{
      const btn=document.createElement('button');btn.className='btn';btn.type='button';btn.textContent=opt.label;btn.dataset.agentReply=opt.id||String(i+1);
      btn.addEventListener('click',()=>{const label=opt.label;sendAIChatMessage({textOverride:label,displayText:label,agentSource:'quick-reply'});});wrap.appendChild(btn);
    });
    if(pending.options.length){const hint=document.createElement('div');hint.className='hint';hint.style.cssText='width:100%;margin-top:2px;';hint.textContent='버튼을 누르거나 아래 입력창에 그냥 답해도 됩니다.';wrap.appendChild(hint);}
    container.appendChild(wrap);
  }
  function afterResult(result,container){
    if(result&&result.clarification){const pending=setPending(result.clarification);renderQuickReplies(container,pending);}
    else if(state.pendingQuestion) clearPending();
  }

  const baseSend=sendAIChatMessage;
  sendAIChatMessage=async function(options){
    const opts=(options&&typeof options==='object'&&!(typeof Event!=='undefined'&&options instanceof Event))?Object.assign({},options):{};
    const input=document.getElementById('ai-chat-input');
    const raw=opts.textOverride!=null?String(opts.textOverride).trim():(input?Utils.htmlToText(input.innerHTML).trim():'');
    if(!raw)return;
    const source=normalizeSource(opts.agentSource||state.source||'chat');state.source=source;
    if(!AIChat.automationMode&&opts.forcePlainChat!==true){AIChat.operatorMode=true;try{updateAIOperatorModeUI();}catch(_){}}
    const mentions=Array.isArray(opts.mentionedIds)?opts.mentionedIds:(input?extractMentionedPageIds(input):[]);
    opts.textOverride=raw;opts.displayText=opts.displayText!=null?opts.displayText:raw;opts.agentSource=source;opts.mentionedIds=mentions;
    state.busy=true;updateContextChip();
    try{
      const out=await baseSend(opts);
      if(state.pendingQuestion){
        const log=document.getElementById('ai-chat-log'),last=log&&log.lastElementChild;
        if(last&&!last.querySelector('.unified-ai-quick-replies'))renderQuickReplies(last,state.pendingQuestion);
      }
      return out;
    }finally{state.busy=false;updateContextChip();}
  };

  const baseToggle=toggleAIPanel;
  toggleAIPanel=function(force){const out=baseToggle(force);if(AIChat.panelOpen)requestAnimationFrame(updateContextChip);return out;};

  openUnifiedAIAction=async function(){
    try{if(typeof NoteCore!=='undefined'&&NoteCore.flushCurrent)await NoteCore.flushCurrent();}catch(_){}
    const ids=selectedBlockIds();open(ids.length?'selection-ai':'topbar');
  };

  function parseCompatClarification(answer){
    const text=String(answer||''),marker='[[GPTN_CLARIFY]]',idx=text.indexOf(marker);
    if(idx<0)return null;
    const raw=text.slice(idx+marker.length).trim();
    let data=null;
    try{data=JSON.parse(raw);}catch(_){try{data=typeof parseJSONLoose==='function'?parseJSONLoose(raw):null;}catch(__){data=null;}}
    return normalizeClarification(data);
  }

  const baseOperatorTurn=typeof aiOperatorTurn==='function'?aiOperatorTurn:null;
  if(baseOperatorTurn){
    aiOperatorTurn=async function(userText,mentionedIds,options){
      const raw=String(userText||'').trim();
      const prepared=raw.includes('[Unified Agent Context]')?raw:prepare(raw,state.source||'chat');
      const result=await baseOperatorTurn(prepared,mentionedIds,options);
      const clarification=parseCompatClarification(result&&result.answer);
      if(clarification){result.answer=clarification.question;result.clarification=clarification;}
      try{if(window.UnifiedAI&&typeof window.UnifiedAI.afterResult==='function')window.UnifiedAI.afterResult(result,null);}catch(e){console.warn('Unified Agent result hook:',e);}
      return result;
    };
  }

  const legacySelectionModal=typeof openAIFormatSelectedModal==='function'?openAIFormatSelectedModal:null;
  const legacyPageModal=typeof openCurrentPageAICommandModal==='function'?openCurrentPageAICommandModal:null;
  window.GptNotionLegacyAIModals={selection:legacySelectionModal,page:legacyPageModal};
  openAIFormatSelectedModal=function(){open('selection-ai');};
  openCurrentPageAICommandModal=function(){open('page-ai');};

  window.UnifiedAI={
    state,captureContext,prepare,open,setPending,clearPending,afterResult,updateContextChip,parseCompatClarification,
    snapshot(){return {conversationId:state.conversationId,source:state.source,currentGoal:state.currentGoal,pendingQuestion:state.pendingQuestion,lastContext:state.lastContext,busy:state.busy};}
  };
})();
