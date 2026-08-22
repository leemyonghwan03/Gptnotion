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
    print('Human conversation benchmark: SKIP (browser not found)')
    raise SystemExit(0)

debug_port=free_port(); profile=tempfile.mkdtemp(prefix='gptnotion_human_bench_')
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

    script=r'''(()=>{
      const H=HumanConversationTuning;let total=0,pass=0;const failed=[];
      const check=(name,ok)=>{total++;if(ok)pass++;else failed.push(name);};
      ['아니 국내 말고 국외','그게 아니라 숙박비','내 말은 두번째야','정정할게','A 말고 B','아니고 이쪽'].forEach((x,i)=>check('correction-'+i,H.isCorrection(x)===true));
      ['숙박비만','그럼 표로','그것도','아까 거','2번','전체로','그대로 해'].forEach((x,i)=>check('followup-'+i,H.isFollowUp(x)===true));
      check('new-goal',H.isFollowUp('새 질문 출장비 알려줘')===false);
      const pending={options:[{id:'1',label:'현재 페이지'},{id:'2',label:'전체 자료실'}]};
      check('option-2',H.optionMatch('2번',pending).label==='전체 자료실');
      check('option-second',H.optionMatch('두번째',pending).label==='전체 자료실');
      check('option-whole',H.optionMatch('전체로',pending).label==='전체 자료실');
      check('option-current',H.optionMatch('현재로',pending).label==='현재 페이지');
      check('option-default',H.optionMatch('그걸로',pending).label==='현재 페이지');
      const both=H.optionMatch('둘 다',{options:[{label:'A'},{label:'B'}]});check('option-both',both&&both.label==='A + B');
      const g1=H.evolveGoal('숙박비만','출장 규정 정리',null,null);check('goal-follow',g1.includes('출장 규정 정리')&&g1.includes('후속 요청: 숙박비만'));
      const g2=H.evolveGoal('아니 국내 말고 국외','국내 출장 규정',null,null);check('goal-correct',g2.includes('국내 출장 규정')&&g2.includes('사용자 정정'));
      const g3=H.evolveGoal('새 질문 보안 규정','이전 목표',null,null);check('goal-new',g3==='새 질문 보안 규정');
      const refs1=H.resolveReferences('이 페이지 봐줘',{pageId:'p1',pageTitle:'출장',selectedText:null},'이전 목표',null);check('ref-page',refs1.some(x=>x.includes('현재 페이지 출장')));
      const refs2=H.resolveReferences('이 부분 고쳐',{pageId:'p1',pageTitle:'출장',selectedText:'선택문장'},'이전 목표',null);check('ref-selection',refs2.some(x=>x.includes('현재 선택 텍스트')));
      const refs3=H.resolveReferences('아까 그거 계속',{pageId:'p1',pageTitle:'출장',selectedText:null},'출장 규정 정리',null);check('ref-previous',refs3.some(x=>x.includes('직전 목표')));
      check('tool-rag',H.toolHints('USB 규정 찾아줘').some(x=>x.includes('RAG')));
      const writeHints=H.toolHints('이거 고쳐줘');check('tool-page-write',writeHints.some(x=>x.includes('현재 페이지'))&&writeHints.some(x=>x.includes('쓰기')));
      check('tool-diagnostic',H.toolHints('왜 검색이 안돼?').some(x=>x.includes('진단')));
      check('tool-history',H.toolHints('지난번 만든 문서 찾아줘').some(x=>x.includes('히스토리')));
      return {total,pass,failed,rate:total?pass/total:0};
    })()'''
    result=evaluate(script)
    if not isinstance(result,dict): raise SystemExit('Benchmark result missing')
    if result.get('failed'):
        raise SystemExit('Human conversation benchmark failed: '+json.dumps(result,ensure_ascii=False))
    if float(result.get('rate',0)) < .95:
        raise SystemExit('Human conversation benchmark below 95%: '+json.dumps(result,ensure_ascii=False))
    print(f"Human conversation benchmark: PASS ({result['pass']}/{result['total']}, {result['rate']*100:.1f}%)")
    ws.close()
finally:
    chrome.terminate()
    try: chrome.wait(timeout=5)
    except subprocess.TimeoutExpired: chrome.kill()
