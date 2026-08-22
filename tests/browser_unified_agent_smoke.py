from __future__ import annotations
import json, socket, subprocess, tempfile, time, urllib.request, pathlib, shutil, os
import websocket

ROOT=pathlib.Path(__file__).resolve().parents[1]
HTML_PATH=(ROOT/'frontend'/'dist'/'GptNotion.html').resolve()
if not HTML_PATH.exists(): raise SystemExit('Built HTML missing')
HTML=HTML_PATH.read_text(encoding='utf-8')

def free_port() -> int:
    s=socket.socket(); s.bind(('127.0.0.1',0)); port=s.getsockname()[1]; s.close(); return port

def find_browser() -> str | None:
    for name in ('chromium','chromium-browser','google-chrome','chrome','msedge'):
        found=shutil.which(name)
        if found: return found
    return None

browser=find_browser()
if not browser:
    print('Unified agent browser smoke: SKIP (browser not found)')
    raise SystemExit(0)

debug_port=free_port(); profile=tempfile.mkdtemp(prefix='gptnotion_agent_')
chrome=subprocess.Popen([browser,'--headless','--no-sandbox','--disable-gpu','--disable-background-networking',f'--remote-debugging-port={debug_port}','--remote-allow-origins=*',f'--user-data-dir={profile}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    targets=[]
    for _ in range(120):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{debug_port}/json/list',timeout=.5) as r: targets=[x for x in json.load(r) if x.get('type')=='page']
            if targets: break
        except Exception: pass
        time.sleep(.1)
    if not targets: raise SystemExit('Chromium DevTools target not available')
    ws=websocket.create_connection(targets[0]['webSocketDebuggerUrl'],timeout=10,origin=f'http://127.0.0.1:{debug_port}',max_size=8_000_000)
    seq=0
    def command(method: str, params: dict[str,object] | None=None):
        nonlocal_seq=None
        global seq
        seq+=1; cid=seq; ws.send(json.dumps({'id':cid,'method':method,'params':params or {}}))
        end=time.time()+20
        while time.time()<end:
            msg=json.loads(ws.recv())
            if msg.get('id')==cid:return msg
        raise TimeoutError(method)
    def evaluate(expr: str):
        msg=command('Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True})
        outer=msg.get('result',{})
        if isinstance(outer,dict) and outer.get('exceptionDetails'): raise RuntimeError(str(outer['exceptionDetails']))
        result=outer.get('result',{}) if isinstance(outer,dict) else {}
        return result.get('value') if isinstance(result,dict) else None
    command('Page.enable');command('Runtime.enable')
    frame=command('Page.getFrameTree')['result']['frameTree']['frame']['id']
    command('Page.setDocumentContent',{'frameId':frame,'html':HTML});time.sleep(2.5)

    if evaluate("Boolean(window.UnifiedAI && UnifiedAI.prepare && UnifiedAI.open)") is not True: raise SystemExit('UnifiedAI global missing')
    prepared=evaluate("UnifiedAI.prepare('이거 규정이랑 비교해서 고쳐줘','topbar')")
    if not isinstance(prepared,str) or 'Unified Agent Context' not in prepared or '관련 Tool로 먼저 확인' not in prepared: raise SystemExit('Agent context/policy missing')
    clarify=evaluate("JSON.stringify(UnifiedAI.parseCompatClarification('[[GPTN_CLARIFY]]'+JSON.stringify({question:'범위?',options:['현재 페이지','전체 자료실'],reason:'범위 필요'})))")
    parsed=json.loads(clarify)
    if parsed.get('question')!='범위?' or len(parsed.get('options',[]))!=2: raise SystemExit('Clarification compatibility protocol failed')
    pending=evaluate("UnifiedAI.setPending({question:'범위?',options:['현재 페이지','전체 자료실'],originalGoal:'규정 검토'}); UnifiedAI.prepare('전체 자료실','chat')")
    if not isinstance(pending,str) or '직전 확인 질문에 대한 사용자 답변' not in pending or '전체 자료실' not in pending: raise SystemExit('Pending clarification continuation failed')
    opened=evaluate("(async()=>{Cache.pages.push({id:'agent_test_page',title:'Agent Test',icon:'📄',parentId:null,pinned:false,deleted:false,createdAt:Date.now(),updatedAt:Date.now(),accessedAt:Date.now(),share:{enabled:false,shareId:null,permission:'view'}});AppState.currentPageId='agent_test_page';AppState.currentView='page';const oldFlush=NoteCore.flushCurrent;NoteCore.flushCurrent=async()=>true;try{await openUnifiedAIAction();}finally{NoteCore.flushCurrent=oldFlush;}return {open:AIChat.panelOpen,source:UnifiedAI.snapshot().source,chip:Boolean(document.getElementById('unified-ai-context-chip'))};})()")
    if not isinstance(opened,dict) or opened.get('open') is not True or opened.get('source') not in ('topbar','selection-ai') or opened.get('chip') is not True: raise SystemExit(f'Topbar AI did not route to unified panel: {opened!r}')
    print('Unified agent browser smoke: PASS')
    ws.close()
finally:
    chrome.terminate()
    try: chrome.wait(timeout=5)
    except subprocess.TimeoutExpired: chrome.kill()
