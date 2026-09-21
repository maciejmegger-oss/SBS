#!/bin/bash
# $1 = html, $2 = out png, $3 = width, $4 = height
set -e
PAD=260
/opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless=new --no-sandbox --disable-gpu \
  --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=$3,$(($4+PAD)) --virtual-time-budget=8000 \
  --screenshot=_raw.png "file://$PWD/$1" >/dev/null 2>&1
python3 - "$2" "$3" "$4" << 'PY'
from PIL import Image
import sys
out,w,h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
im = Image.open('_raw.png').crop((0,0,w*2,h*2))
im.save(out)
im.resize((w//2,h//2), Image.LANCZOS).convert('RGB').save('preview.png')
print(out, im.size)
PY
