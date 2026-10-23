#!/usr/bin/env python3
"""Xử lý ảnh truyện Bắp & Blu do Gemini tạo: design/story/raw/* → dist/assets/story/*.webp

- Biểu cảm ({bap|blu}-{bieu-cam}): tách nền magenta, khử viền hồng, cắt vuông quanh nhân vật, 512×512 WebP có nền trong suốt.
- Nền (bg-*): cắt 16:9, 1280×720 WebP.
Tên file gốc được chuẩn hoá: "BAP - VUI.png.jpg" → bap-vui.
Chạy: python3 tools/process-story-art.py
"""
import re, sys, pathlib
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / 'design/story/raw', ROOT / 'dist/assets/story'
EXPR = {'vui', 'cuoi', 'ngac-nhien', 'boi-roi', 'lo', 'buon', 'tu-hao', 'suy-nghi'}

def norm(name):
    s = name.lower()
    s = re.sub(r'(\.(png|jpe?g|webp))+$', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s).strip('-')
    return s

def key_magenta(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = np.minimum(r, b) - g                      # "độ magenta": nền ~150–240, lông trắng/vàng/xanh < 30
    alpha = np.clip((115 - d) / (115 - 55), 0, 1)  # d ≥ 115 → trong suốt, d ≤ 55 → đặc
    # chỉ giữ khối nhân vật lớn nhất (bỏ logo ✦ nhỏ ở góc)
    mask = alpha > 0.5
    from collections import deque
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32); best = (0, 0); cur = 0
    ys, xs = np.nonzero(mask[::4, ::4])
    for y0, x0 in zip(ys * 4, xs * 4):
        if lab[y0, x0] or not mask[y0, x0]: continue
        cur += 1; q = deque([(y0, x0)]); lab[y0, x0] = cur; n = 0
        while q:
            y, x = q.popleft(); n += 1
            for yy, xx in ((y+1, x), (y-1, x), (y, x+1), (y, x-1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = cur; q.append((yy, xx))
        if n > best[1]: best = (cur, n)
    keep = lab == best[0]
    keep = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    alpha = alpha * keep
    # khử viền hồng: ở vùng bán trong suốt / sát nền, kéo R và B về gần G
    edge = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7))) < 250
    spill = np.clip(np.minimum(r, b) - g, 0, None) * edge
    k = np.clip(spill / 120, 0, 1) * 0.85
    avg_rb = (r + b) / 2
    target = np.maximum(g, avg_rb - spill)
    r2 = r - (r - np.minimum(r, target + 10)) * k
    b2 = b - (b - np.minimum(b, target + 10)) * k
    rgba = np.dstack([r2, g, b2, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')

def square_crop(rgba, pad=0.06):
    al = np.asarray(rgba)[..., 3]
    ys, xs = np.nonzero(al > 20)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    w, h = x1 - x0, y1 - y0
    side = int(max(w, h) * (1 + 2 * pad))
    cx = (x0 + x1) // 2
    top = max(0, y0 - int(side * pad))            # giữ tai trọn vẹn, cắt dưới (vai) nếu cần
    box = (cx - side // 2, top, cx - side // 2 + side, top + side)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(rgba.crop(box), (0, 0))
    return canvas

def cover(im, W, H):
    w, h = im.size; s = max(W / w, H / h)
    im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((l, t, l + W, t + H))

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    done, skipped = [], []
    for f in sorted(RAW.iterdir()):
        if f.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'): continue
        name = norm(f.name)
        im = Image.open(f)
        if name.startswith('bg-'):
            cover(im.convert('RGB'), 1280, 720).save(OUT / f'{name}.webp', 'WEBP', quality=70, method=6)
        elif re.fullmatch(r'(bap|blu)-(.+)', name) and name.split('-', 1)[1] in EXPR:
            face = square_crop(key_magenta(im)).resize((512, 512), Image.LANCZOS)
            face.save(OUT / f'{name}.webp', 'WEBP', quality=86, method=6)
        else:
            skipped.append(f.name); continue
        done.append(name)
    print(f'{len(done)} ảnh → {OUT.relative_to(ROOT)}: {" ".join(done)}')
    if skipped: print('Bỏ qua (tên không khớp):', ', '.join(skipped))
    missing = [f'{w}-{e}' for w in ('bap', 'blu') for e in sorted(EXPR) if f'{w}-{e}' not in done]
    if missing: print('Còn thiếu:', ' '.join(missing))

if __name__ == '__main__':
    main()
