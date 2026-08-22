/* =========================================================================
   v3.3.1 Human Conversation Tuning
   Natural follow-up / correction / reference resolution / tool-first policy
   ========================================================================= */
(function installHumanConversationTuningV331(){
  if(typeof window==='undefined'||typeof UnifiedAI==='undefined') return;

  const memory={
    turns:[],
    lastUserText:'',
    lastAssistantText:'',
    lastResolvedReference:null,
    lastResolvedOption:null,
    lastToolNames:[],
    corrections:[],
    goalHistory:[]
  };

  const KOREAN_ORDINALS={
    '첫번째':0,'첫 번째':0,'첫째':0,'1번':0,'1':0,
    '두번째':1,'두 번째':1,'둘째':1,'2번':1,'2':1,
    '세번째':2,'세 번째':2,'셋째':2,'3번':2,'3':2,
    '네번째':3,'네 번째':3,'넷째':3,'4번':3,'4':3
  };

  function clean(text,max){
    const value=String(text||'').replace(/\s+/g,' ').trim();
    return max&&value.length>max?value.slice(0,max)+'…':value;
  }
  function pushTurn(role,text,source){
    const value=clean(text,1200);if(!value)return;
    memory.turns.push({role:String(role||'user'),text:value,source:String(source||'chat'),at:Date.now()});
    if(memory.turns.length>16) memory.turns.splice(0,memory.turns.length-16);
    if(role==='user')memory.lastUserText=value;else memory.lastAssistantText=value;
  }
  function isCorrection(text){
    const value=clean(text);
    return /^(아니|아냐|아니야|그게 아니라|정정|잠깐|아니 내가|내 말은)/.test(value)||/(?:말고|말한 건|뜻한 건|아니고)/.test(value);
  }
  function isExplicitNewGoal(text){
    return /^(새 질문|다른 질문|주제 바꿀게|완전히 새로|이전 건 됐고)/.test(clean(text));
  }
  function isFollowUp(text){
    const value=clean(text);
    if(!value||isExplicitNewGoal(value))return false;
    if(value.length<=45)return true;
    return /^(그리고|그럼|그러면|거기서|그중|그거|이거|여기|아까|방금|그 방식|그걸|이걸|그것도)/.test(value);
  }
  function mentionsCurrentPage(text){return /(이 페이지|현재 페이지|여기|이 문서|지금 페이지)/.test(clean(text));}
  function mentionsSelection(text){return /(이 부분|선택한|선택 영역|선택한 거|이 문장|이 문단)/.test(clean(text));}
  function mentionsPrevious(text){return /(그거|그것|그걸|아까|방금|이전 거|그 방식|그대로|그중|그 내용|그 결과|방금 결과|아까 결과)/.test(clean(text));}

  function optionMatch(text,pending){
    if(!pending||!Array.isArray(pending.options))return null;
    const raw=clean(text).replace(/[.!?]+$/,'');
    const compact=raw.replace(/\s+/g,'');
    if(/^(둘다|둘 다|전부|모두|다 해|다해|양쪽|둘 모두)/.test(raw)){
      return {kind:'multiple',label:pending.options.map(o=>String(o.label||'')).filter(Boolean).join(' + '),index:null};
    }
    for(const [token,index] of Object.entries(KOREAN_ORDINALS)){
      if(raw===token||compact===token.replace(/\s+/g,'')||raw.includes(token)){
        const opt=pending.options[index];if(opt)return {kind:'option',label:String(opt.label||''),index};
      }
    }
    for(let i=0;i<pending.options.length;i++){
      const opt=pending.options[i],label=clean(opt&&opt.label);
      if(label&&(raw===label||compact===label.replace(/\s+/g,'')||raw.includes(label)))return {kind:'option',label,index:i};
    }
    if(/^전체(?:로)?$/.test(raw)){const i=pending.options.findIndex(o=>/(전체|모두)/.test(String(o&&o.label||'')));if(i>=0)return {kind:'option',label:String(pending.options[i].label||''),index:i};}
    if(/^현재(?:로)?$/.test(raw)){const i=pending.options.findIndex(o=>/(현재|이 페이지)/.test(String(o&&o.label||'')));if(i>=0)return {kind:'option',label:String(pending.options[i].label||''),index:i};}
    if(/^(그걸로|그거로|추천|추천한 걸로|기본으로|그대로)/.test(raw)&&pending.options[0])return {kind:'option',label:String(pending.options[0].label||''),index:0};
    return null;
  }

  function resolveReferences(text,context,previousGoal,pending){
    const refs=[];const raw=clean(text);
    const match=optionMatch(raw,pending);
    if(match){refs.push('확인 질문 답변 → '+match.label);memory.lastResolvedOption=match;}
    if(mentionsSelection(raw)&&context&&context.selectedText){refs.push('"이 부분/선택한 것" → 현재 선택 텍스트');memory.lastResolvedReference='selection';}
    else if((mentionsCurrentPage(raw)||/^(이거|여기)/.test(raw))&&context&&context.pageId){refs.push('"이거/여기" → 현재 페이지 '+String(context.pageTitle||context.pageId));memory.lastResolvedReference='current-page';}
    if(mentionsPrevious(raw)&&previousGoal){refs.push('"그거/아까/방금" → 직전 목표: '+clean(previousGoal,300));memory.lastResolvedReference='previous-goal';}
    return refs;
  }

  function evolveGoal(raw,previousGoal,pending,option){
    const text=clean(raw,500);const prev=clean(previousGoal,500);
    if(isExplicitNewGoal(text)||!prev)return text;
    if(pending&&option)return prev+' → 확인 답변: '+option.label;
    if(isCorrection(text))return prev+' → 사용자 정정: '+text;
    if(isFollowUp(text))return prev+' → 후속 요청: '+text;
    return text;
  }

  function recentConversation(){
    const turns=memory.turns.slice(-8);
    if(!turns.length)return '(아직 없음)';
    return turns.map(t=>(t.role==='assistant'?'AI':'사용자')+': '+clean(t.text,220)).join('\n');
  }
  function toolHints(text){
    const value=clean(text);const hints=[];
    if(/(규정|지침|매뉴얼|근거|조항|찾아|검색|어디)/.test(value))hints.push('규정/RAG/검색 도구로 실제 근거를 먼저 확인');
    if(/(이 페이지|현재 페이지|여기|이거|선택|문장|문단)/.test(value))hints.push('현재 페이지/선택 영역을 읽는 도구를 먼저 사용');
    if(/(수정|고쳐|바꿔|넣어|추가|정리해|표로|작성)/.test(value))hints.push('대상을 먼저 읽고 확인한 뒤 쓰기 도구로 실제 행동');
    if(/(왜 안|오류|에러|문제|느려|안돼|안 되)/.test(value))hints.push('추측보다 상태/진단/로그/도구 목록 확인을 우선');
    if(/(최근|지난번|아까 만든|전에 만든)/.test(value))hints.push('최근 작업/페이지 검색/히스토리 도구로 대상을 확인');
    return hints;
  }

  function enrichPrompt(meta,basePrompt){
    const raw=clean(meta&&meta.raw);const previousGoal=clean(meta&&meta.previousGoal);
    const pending=meta&&meta.pendingQuestion?meta.pendingQuestion:null;
    const option=optionMatch(raw,pending);
    const refs=resolveReferences(raw,meta&&meta.context,previousGoal,pending);
    const nextGoal=evolveGoal(raw,previousGoal,pending,option);
    if(nextGoal){
      UnifiedAI.state.currentGoal=nextGoal;
      memory.goalHistory.push(nextGoal);if(memory.goalHistory.length>8)memory.goalHistory.shift();
    }
    if(isCorrection(raw)){memory.corrections.push(raw);if(memory.corrections.length>6)memory.corrections.shift();}
    pushTurn('user',raw,meta&&meta.source);
    const hints=toolHints(raw);
    const human='[Human Conversation Memory]\n'+
      '대화의 현재 목표: '+(nextGoal||'(없음)')+'\n'+
      '직전 목표: '+(previousGoal||'(없음)')+'\n'+
      '참조 해석: '+(refs.length?refs.join(' | '):'(명시적 참조 없음)')+'\n'+
      '사용자 정정 여부: '+(isCorrection(raw)?'예 — 기존 목표 전체를 버리지 말고 정정된 부분만 교체':'아니오')+'\n'+
      '후속 발화 여부: '+(isFollowUp(raw)?'예 — 독립 질문으로 취급하지 말고 앞 작업에 이어서 해석':'아니오')+'\n'+
      '직전 AI 답변: '+(memory.lastAssistantText?clean(memory.lastAssistantText,300):'(없음)')+'\n'+
      '직전 사용 도구: '+(memory.lastToolNames.length?memory.lastToolNames.join(', '):'(없음)')+'\n'+
      '최근 대화:\n'+recentConversation()+'\n\n'+
      '[Human Conversation Policy]\n'+
      '- 사용자는 완성된 명령문을 쓰지 않아도 됩니다. 오타, 생략, 반말, 짧은 후속 답변을 의미 중심으로 해석하세요.\n'+
      '- "아니 그게 아니라", "말고", "내 말은"은 새 대화가 아니라 직전 해석의 부분 수정입니다. 이전 목표에서 틀린 부분만 고쳐 다시 계획하세요.\n'+
      '- "그거/아까 거/방금 것/그 방식"은 최근 목표와 도구 결과를 우선 참조하고, "이거/여기"는 현재 선택 영역과 현재 페이지를 우선 참조하세요.\n'+
      '- 사용자가 1번/2번/두번째/둘다/전체로/그걸로처럼 답하면 직전 확인 질문의 답으로 처리하고 같은 질문을 반복하지 마세요.\n'+
      '- 정보가 앱 안에 있으면 먼저 도구로 확인하세요. 도구로 확인 가능한데 사용자가 다시 설명하게 만들지 마세요.\n'+
      '- 모호함이 있어도 안전하게 추론 가능한 경우 가장 가능성 높은 해석으로 진행하고, 답변에 짧게 어떤 대상을 기준으로 했는지 알려주세요.\n'+
      '- 질문은 결과가 실제로 달라지고 도구로도 해결할 수 없는 핵심 선택에만 한 번 하세요. 추천 기본값을 첫 선택지로 두세요.\n'+
      '- 사용자가 행동을 요청하면 검색/읽기에서 멈추지 말고 검증 후 실제 작업 도구까지 이어가세요. 위험 작업은 기존 승인 절차를 따르세요.\n'+
      '- 실패하면 바로 "모르겠습니다"라고 하지 말고 system.find_tools/describe, 검색, 상태 진단 등 가능한 경로를 확인한 후 막힌 이유와 다음 선택을 설명하세요.\n'+
      '- 최종 답변은 자연스러운 한국어로 간결하게 말하고, 필요한 경우 다음에 할 수 있는 행동을 1~3개만 제안하세요.\n'+
      (hints.length?'\n이번 요청의 우선 행동 힌트:\n- '+hints.join('\n- ')+'\n':'');
    return basePrompt+'\n\n'+human;
  }

  function afterAssistant(result){
    if(!result||typeof result!=='object')return;
    if(result.answer)pushTurn('assistant',String(result.answer),'agent');
    const trace=Array.isArray(result.toolTrace)?result.toolTrace:[];
    memory.lastToolNames=trace.map(x=>String((x&&x.tool)||'')).filter(Boolean).slice(-8);
  }

  const baseAfter=UnifiedAI.afterResult;
  UnifiedAI.afterResult=function(result,container){
    try{afterAssistant(result);}catch(e){console.warn('Human conversation memory:',e);}
    return baseAfter.call(UnifiedAI,result,container);
  };

  window.HumanConversationTuning={
    memory,enrichPrompt,resolveReferences,optionMatch,evolveGoal,isCorrection,isFollowUp,toolHints,afterAssistant,
    snapshot(){return JSON.parse(JSON.stringify({turns:memory.turns,lastResolvedReference:memory.lastResolvedReference,lastResolvedOption:memory.lastResolvedOption,lastToolNames:memory.lastToolNames,corrections:memory.corrections,goalHistory:memory.goalHistory,currentGoal:UnifiedAI.state.currentGoal,pendingQuestion:UnifiedAI.state.pendingQuestion}));}
  };
})();
