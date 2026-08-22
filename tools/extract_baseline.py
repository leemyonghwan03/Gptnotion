from __future__ import annotations
import json, re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'baseline'/'GptNotion_RAGV2_4_FastPath.html'
OUT=ROOT/'frontend'/'src'
LEG=OUT/'legacy'
LEG.mkdir(parents=True,exist_ok=True)
html=BASE.read_text(encoding='utf-8')

style_re=re.compile(r'<style(?P<attrs>[^>]*)>(?P<body>.*?)</style>',re.I|re.S)
styles=list(style_re.finditer(html))
if not styles:
    raise SystemExit('No style found')
app_style=styles[0].group('body')
(OUT/'app.css').write_text(app_style,encoding='utf-8')
html=html[:styles[0].start()]+'<!--GPTNOTION_STYLE-->'+html[styles[0].end():]

script_re=re.compile(r'<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>',re.I|re.S)
scripts=list(script_re.finditer(html))
if not scripts:
    raise SystemExit('No scripts found')
script_bodies=[m.group('body') for m in scripts]
script_attrs=[m.group('attrs') for m in scripts]

parts=[]; pos=0
for idx,m in enumerate(scripts):
    parts.append(html[pos:m.start()])
    if idx==0:
        parts.append('<!--GPTNOTION_SCRIPTS-->')
    pos=m.end()
parts.append(html[pos:])
shell=''.join(parts)
(OUT/'index.shell.html').write_text(shell,encoding='utf-8')

main=script_bodies[0]
lines=main.splitlines(keepends=True)
starts=[]
for i,line in enumerate(lines):
    if line.lstrip().startswith('/* ========================================================================='):
        title='section'
        for j in range(i+1,min(i+5,len(lines))):
            cand=lines[j].strip()
            if cand and '====' not in cand:
                title=re.sub(r'[^0-9A-Za-z가-힣]+','-',cand).strip('-')[:55] or 'section'
                break
        starts.append((i,title))
if starts and starts[0][0] != 0:
    starts[0]=(0,starts[0][1])
starts.append((len(lines),'END'))
main_files=[]
used={}
for n in range(len(starts)-1):
    a,title=starts[n]; b=starts[n+1][0]
    slug=title.lower() or f'section-{n:02d}'
    used[slug]=used.get(slug,0)+1
    if used[slug]>1: slug=f'{slug}-{used[slug]}'
    name=f'00-{n:02d}-{slug}.legacy.js'
    (LEG/name).write_text(''.join(lines[a:b]),encoding='utf-8')
    main_files.append(name)

manifest={'groups':[{'name':'legacy-main','classic':True,'files':main_files}]}
for i,body in enumerate(script_bodies[1:],1):
    name=f'{i:02d}-patch.legacy.js'
    (LEG/name).write_text(body,encoding='utf-8')
    manifest['groups'].append({'name':f'legacy-script-{i:02d}','classic':True,'files':[name]})
(LEG/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Extracted style={len(app_style):,} chars, scripts={len(script_bodies)}, main sections={len(main_files)}')
