from __future__ import annotations
import json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
src=ROOT/'frontend'/'src'; leg=src/'legacy'; build=ROOT/'frontend'/'build'; dist=ROOT/'frontend'/'dist'
modular=build/'gptnotion.modular.js'
if not modular.exists(): raise SystemExit('TypeScript bundle missing. Run tsc first.')
shell=(src/'index.shell.html').read_text(encoding='utf-8')
css=(src/'app.css').read_text(encoding='utf-8')
manifest=json.loads((leg/'manifest.json').read_text(encoding='utf-8'))
version=json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))
script_tags=[]
for group in manifest['groups']:
    code=''.join((leg/name).read_text(encoding='utf-8') for name in group['files'])
    script_tags.append(f'<script>\n/* source-group: {group["name"]} */\n{code}\n</script>')
bridge="""<script>\n/* GptNotion modular compatibility bridge. Keep legacy identifiers behind one typed boundary. */\nwindow.__GPT_LEGACY__ = Object.freeze({\n  baseline: 'RAG V2.4 FAST PATH / MCP 6.8',\n  PageStore: typeof PageStore !== 'undefined' ? PageStore : undefined,\n  BlockStore: typeof BlockStore !== 'undefined' ? BlockStore : undefined,\n  LinkStore: typeof LinkStore !== 'undefined' ? LinkStore : undefined,\n  DatabaseStore: typeof DatabaseStore !== 'undefined' ? DatabaseStore : undefined,\n  RagLibraryStore: typeof RagLibraryStore !== 'undefined' ? RagLibraryStore : undefined,\n  RagFolderStore: typeof RagFolderStore !== 'undefined' ? RagFolderStore : undefined,\n  LocalMCPBridge: typeof LocalMCPBridge !== 'undefined' ? LocalMCPBridge : undefined,\n  AppState: typeof AppState !== 'undefined' ? AppState : undefined,\n  App: typeof App !== 'undefined' ? App : undefined,\n  DBM: typeof DBM !== 'undefined' ? DBM : undefined,\n  Cache: typeof Cache !== 'undefined' ? Cache : undefined,\n  CacheIndex: typeof GptNotionCacheIndex !== 'undefined' ? GptNotionCacheIndex : undefined,\n  StorageConfig: typeof StorageConfig !== 'undefined' ? StorageConfig : undefined,\n  UndoManager: typeof UndoManager !== 'undefined' ? UndoManager : undefined,\n  isTeamPageId: typeof isTeamPageId !== 'undefined' ? isTeamPageId : undefined,\n  uid: typeof uid !== 'undefined' ? uid : undefined,\n  now: typeof Utils !== 'undefined' && typeof Utils.now === 'function' ? Utils.now.bind(Utils) : undefined\n});\n</script>"""
modular_tag='<script>\n/* GptNotion TypeScript Modular Bundle '+version['appVersion']+' */\n'+modular.read_text(encoding='utf-8')+'\n</script>'
all_scripts='\n'.join(script_tags+[bridge,modular_tag])
if '<!--GPTNOTION_STYLE-->' not in shell or '<!--GPTNOTION_SCRIPTS-->' not in shell:
    raise SystemExit('Build placeholders missing from shell')
out=shell.replace('<!--GPTNOTION_STYLE-->','<style>\n'+css+'\n</style>',1).replace('<!--GPTNOTION_SCRIPTS-->',all_scripts,1)
out=out.replace('<title>','<meta name="gptnotion-build" content="'+version['appVersion']+'">\n<title>',1)
# Air-gap guard: output must not reference external JS/CSS assets.
for pat,label in [(r'<script[^>]+src\s*=','external script'),(r'<link[^>]+rel=["\']stylesheet["\']','external stylesheet')]:
    if re.search(pat,out,re.I): raise SystemExit(f'Air-gap build guard failed: {label}')
dist.mkdir(parents=True,exist_ok=True)
outfile=dist/'GptNotion.html'; outfile.write_text(out,encoding='utf-8')
print(f'Frontend single-file build: {outfile} ({outfile.stat().st_size:,} bytes)')
