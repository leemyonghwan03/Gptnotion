from __future__ import annotations
import json, socket, subprocess, tempfile, time, urllib.request, pathlib, shutil, os
import websocket
ROOT=pathlib.Path(__file__).resolve().parents[1]; HTML=(ROOT/'frontend'/'dist'/'GptNotion.html').read_text(encoding='utf-8')
def free_port():
 s=socket.socket();s.bind(('127.0.0.1',0));p=s.getsockname()[1];s.close();return p
def browser_path():
 for n in ('chromium','chromium-browser','google-chrome','chrome','msedge'):
  f=shutil.which(n)
  if f:return f
 return None
browser=browser_path(); debug=free_port(); profile=tempfile.mkdtemp(prefix='gpt_func2_')
chrome=subprocess.Popen([browser,'--headless','--no-sandbox','--disable-gpu','--disable-background-networking',f'--remote-debugging-port={debug}','--remote-allow-origins=*',f'--user-data-dir={profile}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 targets=[]
 for _ in range(120):
  try:
   with urllib.request.urlopen(f'http://127.0.0.1:{debug}/json/list',timeout=.5) as r:targets=[x for x in json.load(r) if x.get('type')=='page']
   if targets:break
  except:pass
  time.sleep(.1)
 ws=websocket.create_connection(targets[0]['webSocketDebuggerUrl'],timeout=15,origin=f'http://127.0.0.1:{debug}',max_size=10_000_000); seq=0
 def cmd(method,params=None):
  nonlocal_dummy=None
  global seq
  seq+=1;cid=seq;ws.send(json.dumps({'id':cid,'method':method,'params':params or {}}))
  end=time.time()+30
  while time.time()<end:
   m=json.loads(ws.recv())
   if m.get('id')==cid:return m
  raise TimeoutError(method)
 def ev(expr):
  m=cmd('Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True}); out=m.get('result',{})
  if out.get('exceptionDetails'): raise RuntimeError(str(out['exceptionDetails']))
  return out.get('result',{}).get('value')
 cmd('Page.enable');cmd('Runtime.enable'); tree=cmd('Page.getFrameTree');fid=tree['result']['frameTree']['frame']['id'];cmd('Page.setDocumentContent',{'frameId':fid,'html':HTML});time.sleep(2.5)
 result=ev("""(async()=>{
   Cache.pages=[];Cache.blocks=[];Cache.links=[];Cache.databases=[];Cache.columns=[];Cache.rows=[];
   if(window.GptNotionCacheIndex)GptNotionCacheIndex.rebuild();
   const mem={pages:new Map(),blocks:new Map(),databases:new Map(),databaseColumns:new Map(),databaseRows:new Map(),links:new Map()};
   DBM.put=async function(store,obj){mem[store]&&mem[store].set(obj.id||obj.key||obj.chunkId,JSON.parse(JSON.stringify(obj)));return obj;};
   DBM.atomicBatch=async function(payload){for(const [st,items] of Object.entries(payload.puts||{})){for(const item of(items||[]))mem[st]&&mem[st].set(item.id||item.key||item.chunkId,JSON.parse(JSON.stringify(item)));}for(const [st,keys] of Object.entries(payload.deletes||{})){for(const k of(keys||[]))mem[st]&&mem[st].delete(k);}return{ok:true};};
   const p=await PageStore.create({title:'FUNC TEST',parentId:null,icon:'🧪'});
   const b=await BlockStore.create({pageId:p.id,type:'paragraph',content:'db host'});
   const db=await DatabaseCommands.createDatabase(p.id,b.id);
   const firstCol=DatabaseStore.getColumns(db.id)[0]; await DatabaseStore.addRow(db.id,{[firstCol.id]:'original'});
   const copy=await PageStore.duplicate(p.id);
   if(window.GptNotionCacheIndex)GptNotionCacheIndex.rebuild();
   const copyBlock=BlockStore.getByPage(copy.id).find(x=>x.type==='database'); const copyDb=copyBlock&&DatabaseStore.get(copyBlock.properties.databaseId);
   const originalRows=DatabaseStore.getRows(db.id),copyRows=copyDb?DatabaseStore.getRows(copyDb.id):[];
   const copyCols=copyDb?DatabaseStore.getColumns(copyDb.id):[]; const copiedValue=copyRows.length&&copyCols.length?copyRows[0].values[copyCols[0].id]:undefined; const independent=Boolean(copyDb&&copyDb.id!==db.id&&copyRows.length===originalRows.length&&copyRows[0].id!==originalRows[0].id&&copiedValue==='original');
   const before=p.title,oldPut=DBM.put;DBM.put=async()=>{throw new Error('forced-write-failure')};let failed=false;try{await PageStore.update(p.id,{title:'SHOULD NOT STICK'});}catch(e){failed=true;}DBM.put=oldPut;
   const persistSafe=failed&&p.title===before;
   const chatRoot=document.createElement('div');document.body.appendChild(chatRoot);RagChat.history=[];RagChat.busy=false;RagChat.requestSeq=0;
   const oldAnswer=ragChatAnswer;let chatCalls=0;ragChatAnswer=async()=>{chatCalls++;await new Promise(r=>setTimeout(r,60));return{answer:'ok',sources:[],retrievalMethod:'test'};};
   renderRagChatView(chatRoot);const chatInput=chatRoot.querySelector('#rc-input'),chatReset=chatRoot.querySelector('#rc-reset-btn');chatInput.value='질문';
   chatInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));chatInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
   await new Promise(r=>setTimeout(r,10));const busyBlocked=chatCalls===1&&RagChat.busy===true;const beforeResetLen=RagChat.history.length;chatReset.click();const resetBlocked=RagChat.history.length===beforeResetLen;
   await new Promise(r=>setTimeout(r,90));const chatStable=chatCalls===1&&RagChat.busy===false&&RagChat.history.length===2&&RagChat.history[1].text==='ok';ragChatAnswer=oldAnswer;chatRoot.remove();
   const oldFetch=window.fetch,oldPhase4Get=OperatorPhase4Config.get.bind(OperatorPhase4Config);let authFetchCalls=0,authFailed=false;
   OperatorPhase4Config.get=async()=>({enabled:false,adapterMode:'auto',autoProbe:false,directFallback:true,showProfile:true});
   window.fetch=async()=>{authFetchCalls++;return{ok:false,status:401,text:async()=>'{"error":{"message":"bad key"}}',headers:{get:()=> 'application/json'}};};
   try{await AICommands.chatStream({endpoint:'http://example.invalid',model:'test',apiMode:'chat',apiKey:'bad'},[{role:'user',content:'x'}]);}catch(e){authFailed=String(e&&e.message||e).includes('HTTP 401');}
   window.fetch=oldFetch;OperatorPhase4Config.get=oldPhase4Get;const aiAuthSingle=authFailed&&authFetchCalls===1;
   return {independent,persistSafe,busyBlocked,resetBlocked,chatStable,aiAuthSingle};
 })()""")
 print(json.dumps(result,ensure_ascii=False));
 if not all(result.get(k) for k in ('independent','persistSafe','busyBlocked','resetBlocked','chatStable','aiAuthSingle')):raise SystemExit('reliability assertions failed')
finally:
 chrome.terminate();
 try:chrome.wait(timeout=5)
 except:chrome.kill()
