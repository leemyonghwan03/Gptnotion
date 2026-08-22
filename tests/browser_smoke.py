from __future__ import annotations
import json, socket, subprocess, tempfile, time, urllib.request, pathlib, shutil, os
import websocket

ROOT=pathlib.Path(__file__).resolve().parents[1]
HTML_PATH=(ROOT/'frontend'/'dist'/'GptNotion.html').resolve()
if not HTML_PATH.exists(): raise SystemExit('Built HTML missing')
HTML=HTML_PATH.read_text(encoding='utf-8')

def free_port() -> int:
    s=socket.socket(); s.bind(('127.0.0.1',0)); port=s.getsockname()[1]; s.close(); return port

debug_port=free_port(); profile=tempfile.mkdtemp(prefix='gptnotion_chrome_')

def find_browser() -> str | None:
    for name in ('chromium','chromium-browser','google-chrome','chrome','msedge'):
        found=shutil.which(name)
        if found: return found
    if os.name == 'nt':
        roots=[os.environ.get('PROGRAMFILES',''),os.environ.get('PROGRAMFILES(X86)',''),os.environ.get('LOCALAPPDATA','')]
        suffixes=[r'Google\Chrome\Application\chrome.exe',r'Microsoft\Edge\Application\msedge.exe']
        for root in roots:
            if not root: continue
            for suffix in suffixes:
                candidate=pathlib.Path(root)/suffix
                if candidate.exists(): return str(candidate)
    return None

browser=find_browser()
if not browser:
    print('Browser smoke: SKIP (Chromium/Chrome/Edge not found)')
    raise SystemExit(0)

chrome=subprocess.Popen([
    browser,'--headless','--no-sandbox','--disable-gpu','--disable-background-networking',
    f'--remote-debugging-port={debug_port}','--remote-allow-origins=*',f'--user-data-dir={profile}','about:blank'
],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    targets=[]
    for _ in range(120):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{debug_port}/json/list',timeout=0.5) as r:
                targets=[x for x in json.load(r) if x.get('type')=='page']
            if targets: break
        except Exception: pass
        time.sleep(0.1)
    if not targets: raise SystemExit('Chromium DevTools target not available')
    ws=websocket.create_connection(targets[0]['webSocketDebuggerUrl'],timeout=10,origin=f'http://127.0.0.1:{debug_port}',max_size=5_000_000)
    seq=0
    def command(method: str, params: dict[str, object] | None = None) -> dict[str, object]:
        nonlocal_seq=None
        global seq
        seq += 1; call_id=seq
        ws.send(json.dumps({'id':call_id,'method':method,'params':params or {}}))
        end=time.time()+20
        while time.time()<end:
            msg=json.loads(ws.recv())
            if msg.get('id')==call_id:
                return msg
        raise TimeoutError(method)
    def evaluate(expression: str):
        msg=command('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True})
        outer=msg.get('result',{})
        if isinstance(outer,dict) and outer.get('exceptionDetails'):
            raise RuntimeError(str(outer['exceptionDetails']))
        result=outer.get('result',{}) if isinstance(outer,dict) else {}
        return result.get('value') if isinstance(result,dict) else None

    command('Page.enable'); command('Runtime.enable')
    tree=command('Page.getFrameTree')
    frame_id=tree['result']['frameTree']['frame']['id']
    command('Page.setDocumentContent',{'frameId':frame_id,'html':HTML})
    time.sleep(2.5)

    version=evaluate("document.documentElement.dataset.gptnotionModular || ''")
    api=evaluate("Boolean(window.GptNotionModular && window.GptNotionModular.rag && window.GptNotionModular.mcp)")
    title=evaluate("document.title")
    bridge=evaluate("Boolean(window.__GPT_LEGACY__ && window.__GPT_LEGACY__.PageStore && window.__GPT_LEGACY__.BlockStore)")
    scripts=evaluate("document.scripts.length")
    app_dom=evaluate("Boolean(document.getElementById('app') && document.getElementById('sidebar') && document.getElementById('view-root'))")
    if version!='3.1.0-perf-reliability': raise SystemExit(f'Modular dataset missing: {version!r}')
    if api is not True: raise SystemExit('GptNotionModular public API missing')
    if bridge is not True: raise SystemExit('Legacy compatibility bridge missing PageStore/BlockStore')
    if not isinstance(scripts,(int,float)) or scripts < 18: raise SystemExit(f'Expected script groups not loaded: {scripts!r}')
    if app_dom is not True: raise SystemExit('Core app DOM missing')
    if not isinstance(title,str) or 'Gpt노션' not in title: raise SystemExit(f'Unexpected document title: {title!r}')
    print(f'Browser smoke: PASS (title={title!r}, version={version}, scripts={scripts})')
    ws.close()
finally:
    chrome.terminate()
    try: chrome.wait(timeout=5)
    except subprocess.TimeoutExpired: chrome.kill()
