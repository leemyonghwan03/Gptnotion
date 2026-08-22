from __future__ import annotations
import json, socket, subprocess, tempfile, time, urllib.request, pathlib, shutil
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
    print('Human conversation browser smoke: SKIP (browser not found)')
    raise SystemExit(0)

debug_port=free_port(); profile=tempfile.mkdtemp(prefix='gptnotion_human_chat_')
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

    if evaluate("Boolean(window.UnifiedAI && window.HumanConversationTuning)") is not True:
        raise SystemExit('HumanConversationTuning global missing')

    setup=evaluate("(()=>{Cache.pages.push({id:'human_page',title:'출장 규정 초안',icon:'📄',parentId:null,pinned:false,deleted:false,createdAt:Date.now(),updatedAt:Date.now(),accessedAt:Date.now(),share:{enabled:false,shareId:null,permission:'view'}});AppState.currentPageId='human_page';AppState.currentView='page';UnifiedAI.state.currentGoal=null;UnifiedAI.clearPending();return true;})()")
    if setup is not True: raise SystemExit('Conversation setup failed')

    first=evaluate("UnifiedAI.prepare('이거 규정이랑 비교해줘','topbar')")
    if not isinstance(first,str) or 'Human Conversation Memory' not in first or '현재 페이지 출장 규정 초안' not in first or '규정/RAG/검색 도구' not in first:
        raise SystemExit('Current-page reference/tool-first prompt failed')

    follow=evaluate("UnifiedAI.prepare('숙박비만','chat'); HumanConversationTuning.snapshot().currentGoal")
    if not isinstance(follow,str) or '후속 요청: 숙박비만' not in follow or '규정이랑 비교' not in follow:
        raise SystemExit(f'Follow-up goal did not preserve previous goal: {follow!r}')

    correction=evaluate("UnifiedAI.prepare('아니 국내 말고 국외','chat'); HumanConversationTuning.snapshot().currentGoal")
    if not isinstance(correction,str) or '사용자 정정: 아니 국내 말고 국외' not in correction or '숙박비만' not in correction:
        raise SystemExit(f'Correction reset the goal instead of revising it: {correction!r}')

    whole=evaluate("UnifiedAI.setPending({question:'범위?',options:['현재 페이지','전체 자료실'],originalGoal:UnifiedAI.state.currentGoal}); UnifiedAI.prepare('전체로','chat')")
    if not isinstance(whole,str) or '확인 질문 답변 → 전체 자료실' not in whole:
        raise SystemExit('Natural pending answer "전체로" did not resolve')

    second=evaluate("UnifiedAI.setPending({question:'어느 규정?',options:['A 규정','B 규정'],originalGoal:'규정 비교'}); UnifiedAI.prepare('아니 그거 말고 두번째','chat')")
    if not isinstance(second,str) or '확인 질문 답변 → B 규정' not in second:
        raise SystemExit('Correction + ordinal pending answer did not resolve second option')

    both=evaluate("UnifiedAI.setPending({question:'어느 쪽?',options:['A','B'],originalGoal:'비교'}); UnifiedAI.prepare('둘다','chat')")
    if not isinstance(both,str) or '확인 질문 답변 → A + B' not in both:
        raise SystemExit('Natural pending answer "둘다" did not resolve both')

    assistant=evaluate("UnifiedAI.afterResult({answer:'확인했어요.',toolTrace:[{tool:'rag.search'},{tool:'page.read'}]}, document.createElement('div')); JSON.stringify(HumanConversationTuning.snapshot())")
    snap=json.loads(assistant)
    if snap.get('lastToolNames') != ['rag.search','page.read']:
        raise SystemExit(f'Tool memory missing: {snap!r}')
    if not snap.get('turns') or snap['turns'][-1].get('role')!='assistant':
        raise SystemExit('Assistant turn was not remembered')

    print('Human conversation browser smoke: PASS')
    ws.close()
finally:
    chrome.terminate()
    try: chrome.wait(timeout=5)
    except subprocess.TimeoutExpired: chrome.kill()
