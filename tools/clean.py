from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1]
for p in [ROOT/'frontend'/'build',ROOT/'frontend'/'dist',ROOT/'release']:
    if p.exists(): shutil.rmtree(p)
    p.mkdir(parents=True,exist_ok=True)
print('Clean: PASS')
