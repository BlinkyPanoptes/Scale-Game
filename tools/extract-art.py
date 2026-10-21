import json, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

SRC = r"C:\Users\LENOVO\JS_Trial\Scale Game\IMG-20261021-WA0000.jpg"
ASSETS = r"C:\Users\LENOVO\JS_Trial\Scale Game\Assets"
OUT = r"C:\Users\LENOVO\JS_Trial\Scale Game\game\assets\images"
os.makedirs(OUT + r"\tiles", exist_ok=True)
os.makedirs(OUT + r"\items", exist_ok=True)

im = np.array(Image.open(SRC).convert("RGB"))
H, W = im.shape[:2]
f = im.astype(np.float32)
PARCH = np.array([240, 170, 87], np.float32)
dist = np.linalg.norm(f - PARCH, axis=2)
ramp = lambda x, a, b: np.clip((x - a) / (b - a), 0, 1)

PX, PY = 629.5, 187.5          # pivot of beam and needle
layout = {"stage": [W, H], "pivot": [PX, PY]}

def save_rgba(rgb, alpha, rect, name):
    x0, y0, x1, y1 = rect
    a = np.dstack([rgb[y0:y1, x0:x1], (alpha[y0:y1, x0:x1] * 255).astype(np.uint8)])
    Image.fromarray(a, "RGBA").save(f"{OUT}\\{name}.png")

kill = np.zeros((H, W), bool)   # everything to remove from the background

# ---------- beam ----------
BR = (266, 152, 994, 224)
beam_a = np.zeros((H, W), np.float32)
rows = np.arange(H)[:, None]
edge = np.clip(1 - np.abs(rows - 190.25) / 17.0 + 0.0, 0, 1)  # placeholder, replaced below
body = np.zeros((H, W), np.float32)
body[174:207, 295:964] = 1
body[173, 295:964] = 0.4
body[207, 295:964] = 0.4
blue = ramp(f[..., 2] - f[..., 0], 40, 90)
capzone = np.zeros((H, W), bool)
capzone[155:216, 262:306] = True
capzone[155:216, 953:998] = True
cap_a = blue * capzone
cap_a = ndi.binary_closing(cap_a > 0.3, iterations=3)
cap_a = ndi.binary_fill_holes(cap_a)
cap_a = cv2.GaussianBlur(cap_a.astype(np.float32), (3, 3), 0.8)
beam_a = np.maximum(body, cap_a)
beam_rgb = im.copy()
# paint the hook link out of the beam wood
link = np.zeros((H, W), np.uint8)
for hx in (315.5, 943.5):
    link[160:215, int(hx - 8):int(hx + 9)] = 255
link[:, :] = np.where(beam_a > 0, link, 0)
beam_rgb = cv2.inpaint(beam_rgb, link, 4, cv2.INPAINT_TELEA)
save_rgba(beam_rgb, beam_a, BR, "beam")
layout["beam"] = {"rect": list(BR), "origin": [PX - BR[0], PY - BR[1]]}

# ---------- static centre cap (stays put while the beam turns) ----------
CAPR = 22
yy, xx = np.mgrid[0:H, 0:W]
cd = np.hypot(xx - PX, yy - PY)
cap_c = ramp(CAPR + 0.5 - cd, 0, 1.5)
CR = (int(PX - 24), int(PY - 24), int(PX + 25), int(PY + 25))
save_rgba(im, cap_c, CR, "pivot-cap")
layout["cap"] = {"rect": list(CR)}

# ---------- pans (with hook, ropes) ----------
def make_pan(name, rect, hx):
    x0, y0, x1, y1 = rect
    a = np.zeros((H, W), np.float32)
    dm = ramp(dist, 18, 48)
    a[209:y1, x0:x1] = dm[209:y1, x0:x1]
    # top of the hook link sits on parchment above the beam
    a[160:174, int(hx - 12):int(hx + 13)] = dm[160:174, int(hx - 12):int(hx + 13)]
    # inside the beam rows the link is opaque
    colw = ramp(4.6 - np.abs(np.arange(W) - hx), 0, 2.0)
    a[174:209, :] = np.maximum(a[174:209, :] * 0, colw[None, :] * 1.0)
    m = np.zeros((H, W), np.float32); m[y0:y1, x0:x1] = 1
    a *= m
    a = ndi.binary_opening(a > 0.5, iterations=1) * a  # drop speckles
    lab, n = ndi.label(a > 0.1)
    if n:
        sizes = ndi.sum(a > 0.1, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 120])
        a = a * keep
    save_rgba(im, a, rect, name)
    return a

LP = (170, 160, 460, 476); RP = (797, 160, 1087, 476)
al = make_pan("pan-left", LP, 315.5)
ar = make_pan("pan-right", RP, 943.5)
layout["panLeft"] = {"rect": list(LP), "hook": [315.5 - LP[0], 0]}
layout["panRight"] = {"rect": list(RP), "hook": [943.5 - RP[0], 0]}
kill_pan = cv2.dilate(((al + ar) > 0.02).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
kill |= kill_pan

# pan surface geometry (top face of the tray)
for nm, a in (("panLeft", al), ("panRight", ar)):
    ys, xs = np.where(a[400:476] > 0.5)
    ys = ys + 400
    # wide rows only (the tray, not the ropes)
    wide = [y for y in np.unique(ys) if (ys == y).sum() > 150]
    xs_w = xs[np.isin(ys, wide)]
    layout[nm]["tray"] = [int(xs_w.min()), int(xs_w.max()), int(min(wide)), int(max(wide))]

# ---------- needle ----------
NR = (612, 258, 648, 382)
nb = ramp(f[..., 2] - f[..., 0], 35, 85)
nz = np.zeros((H, W), np.float32); nz[258:382, 612:648] = 1
needle_a = nb * nz
needle_a = ndi.binary_closing(needle_a > 0.3, iterations=2) * np.maximum(needle_a, 0.6)
save_rgba(im, needle_a, NR, "needle")
layout["needle"] = {"rect": list(NR), "origin": [PX - NR[0], 364 - NR[1]]}
layout["needlePivot"] = [PX, 364.0]
kill_needle = cv2.dilate((needle_a > 0.02).astype(np.uint8), np.ones((13, 13), np.uint8)) > 0
kill_needle[:272] = False

# ---------- tray tiles ----------
ty0, ty1, tx0, tx1 = 565, 912, 48, 1212
reg = f[ty0:ty1, tx0:tx1]
tray = np.median(reg.reshape(-1, 3), axis=0)
td = np.linalg.norm(reg - tray, axis=2)
tm = td > 55
tm = ndi.binary_closing(tm, iterations=2)
tm = ndi.binary_fill_holes(tm)
tm = ndi.binary_opening(tm, iterations=2)
lab, n = ndi.label(tm)
objs = ndi.find_objects(lab)
blobs = []
for i, sl in enumerate(objs):
    area = (lab[sl] == i + 1).sum()
    if area > 3000:
        blobs.append((sl, i + 1, area))
print("blobs", len(blobs), tray)
cy = lambda b: (b[0][0].start + b[0][0].stop) / 2
blobs.sort(key=cy)
split = (ty1 - ty0) / 2
top = sorted([b for b in blobs if cy(b) < 130], key=lambda b: b[0][1].start)
bot = sorted([b for b in blobs if cy(b) >= 130], key=lambda b: b[0][1].start)
print("rows", len(top), len(bot))
ORDER = ["books", "chair", "boy", "girl", "bicycle", "trampoline", "scooter", "car", "family", "tree", "hut",
         "tractor", "purple-truck", "school-bus", "fire-truck", "delivery-truck", "house", "airplane"]
tiles = {}
tile_mask_full = np.zeros((H, W), np.float32)
for name, (sl, lid, area) in zip(ORDER, top + bot):
    m = (lab == lid)
    m = cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0.7)
    y0, y1, x0, x1 = sl[0].start - 3, sl[0].stop + 3, sl[1].start - 3, sl[1].stop + 3
    full = np.zeros((H, W), np.float32)
    full[ty0:ty1, tx0:tx1] = m
    tile_mask_full = np.maximum(tile_mask_full, full)
    rect = (x0 + tx0, y0 + ty0, x1 + tx0, y1 + ty0)
    save_rgba(im, full, rect, f"tiles\\{name}")
    tiles[name] = list(rect)
layout["tiles"] = tiles
kill_tiles = cv2.dilate((tile_mask_full > 0.02).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0

# ---------- clean background ----------
bg = im.copy()
# beam band: copy clean parchment from above, outside the post
for xa, xb in [(255, 556), (704, 1002)]:
    bg[154:221, xa:xb] = im[154 - 67:221 - 67, xa:xb]
# beam band on the post: stretch the wood grain vertically (keep the round cap)
for x in range(556, 705):
    top_c, bot_c = im[169, x].astype(np.float32), im[212, x].astype(np.float32)
    for y in range(171, 211):
        if np.hypot(x - PX, y - PY) <= CAPR + 1.5:
            continue
        t = (y - 169) / (212 - 169)
        bg[y, x] = (top_c * (1 - t) + bot_c * t).astype(np.uint8)
bg = cv2.inpaint(bg, kill.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
bg = cv2.inpaint(bg, kill_needle.astype(np.uint8) * 255, 6, cv2.INPAINT_NS)
# tray: fill each tile's footprint with the row's own tray colour plus soft mottling
rng = np.random.default_rng(3)
noise = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 4) * 9
bgf = bg.astype(np.float32)
for y in range(ty0, ty1):
    row_ok = ~kill_tiles[y, 60:1200]
    base = np.median(bgf[y, 60:1200][row_ok], axis=0) if row_ok.sum() > 50 else tray
    sel = kill_tiles[y]
    bgf[y, sel] = base + noise[y, sel][:, None]
bg = np.clip(bgf, 0, 255).astype(np.uint8)
pil = Image.fromarray(bg)
d = ImageDraw.Draw(pil)
try:
    font = ImageFont.truetype("arialbd.ttf", 15)
except Exception:
    font = ImageFont.load_default()
d.text((PX, 268), "0", fill=(54, 140, 230), font=font, anchor="mm")
pil.save(OUT + r"\background.jpg", quality=93)
Image.fromarray(bg).save(OUT.replace("images", "") + "..\\..\\..\\bg_debug.png") if False else None

# ---------- item pictures from the client's Assets folder ----------
items = {}
for name in ORDER:
    a = Image.open(f"{ASSETS}\\{name}.png").convert("RGBA")
    bb = a.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    a = a.crop(bb)
    a.save(f"{OUT}\\items\\{name}.png")
    items[name] = list(a.size)
layout["itemNative"] = items
json.dump(layout, open(OUT + r"\layout.json", "w"), indent=1)
print(json.dumps(layout, indent=0)[:3000])
