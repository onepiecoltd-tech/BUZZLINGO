# Prompt tạo hình cho truyện Bắp & Blu (Gemini)

Bản thử dùng **16 ảnh biểu cảm** (8 cho mỗi nhân vật) và **3 ảnh nền** (một cho mỗi tập 1–3). Chưa có ảnh nào thì app tự dùng avatar hiện tại kèm biểu tượng cảm xúc, nên bạn có thể làm dần.

## Cách làm để giữ đúng Bắp và Blu hiện tại

1. Mở **một cuộc chat Gemini mới cho mỗi nhân vật** (không trộn Bắp và Blu trong cùng cuộc chat).
2. Đính kèm ảnh tham chiếu từ thư mục `design/masters/`:
   - Bắp: `bap-coach-avatar.png` và `mascot-model-reference.png`
   - Blu: `blu-coach-avatar.png` và `mascot-model-reference.png`
3. Gửi **prompt chung** của nhân vật đó trước. Sau đó mỗi tin nhắn chỉ gửi **một dòng biểu cảm**, mỗi lần một ảnh.
4. Ảnh nào lệch thiết kế (sai màu lông, mất nơ, đổi màu áo, sai màu mắt…) thì bảo Gemini: *"Keep the character exactly identical to the reference images, only change the facial expression."*
5. Lưu ảnh đúng tên ở cột "Tên file" rồi để vào `design/story/raw/`. Báo mình, mình sẽ tách nền, nén sang WebP và gắn vào app.

---

## Prompt chung: Bắp

```
You are creating expression stickers for an existing mascot. Use the attached images as the exact character reference and keep her 100% identical: same face shape, same fur colors and markings, same eyes, same accessories, same 3D render style. Do not redesign her.

Character: "Bắp", a cute female puppy, older-sister personality (warm, playful, a little teasing). Brown and white fur, white blaze down the middle of the face and white muzzle and chest, tall upright pointed ears with pink inner ears and white fluffy tufts, warm brown eyes with eyelashes, soft pink cheeks, small dark brown nose, a mustard-yellow knotted bow headband, a brown collar with a small yellow bone charm, and a mustard-yellow hoodie.

Style: high-quality 3D Pixar-like cartoon render, soft studio lighting, subtle fur detail, friendly and expressive.

Framing for every image: head-and-shoulders portrait, character centered, facing the viewer at a slight 3/4 angle, square 1:1, whole head and ears fully inside the frame with small margins.

Background for every image: one flat solid pure magenta color (#FF00FF), no gradient, no shadow on the background, no floor, no props, no text, no watermark.

I will now send one expression at a time. Generate exactly one image per message.
```

## Prompt chung: Blu

```
You are creating expression stickers for an existing mascot. Use the attached images as the exact character reference and keep him 100% identical: same face shape, same fur, same eyes, same hoodie, same 3D render style. Do not redesign him.

Character: "Blu", a cute male kitten, younger-brother personality (curious, eager, a bit clumsy). Snow-white fluffy fur with a soft tuft of fur on top of the head, big pointed ears with pink inner ears, bright teal-blue eyes, small pink nose, soft grey eyebrows, white whiskers, a long fluffy white tail, and a bright sky-blue hoodie with white drawstrings.

Style: high-quality 3D Pixar-like cartoon render, soft studio lighting, subtle fur detail, friendly and expressive.

Framing for every image: head-and-shoulders portrait, character centered, facing the viewer at a slight 3/4 angle, square 1:1, whole head and ears fully inside the frame with small margins.

Background for every image: one flat solid pure magenta color (#FF00FF), no gradient, no shadow on the background, no floor, no props, no text, no watermark.

I will now send one expression at a time. Generate exactly one image per message.
```

> Nền màu hồng sẫm (magenta) để mình tách nền tự động mà không ăn vào lông trắng của Blu. Không cần nền trong suốt.

---

## 8 biểu cảm (dùng cho cả hai nhân vật)

Gửi từng dòng tiếng Anh sau prompt chung. Tên file thay `{nv}` bằng `bap` hoặc `blu`.

| Tên file | Biểu cảm | Dòng gửi Gemini |
|---|---|---|
| `{nv}-vui.png` | Vui, mỉm cười | `Expression: happy and friendly — warm open smile, bright eyes, ears up, relaxed.` |
| `{nv}-cuoi.png` | Cười trêu | `Expression: laughing playfully, teasing — big grin, one eye winking, head tilted slightly, one paw raised near the mouth.` |
| `{nv}-ngac-nhien.png` | Ngạc nhiên | `Expression: surprised — eyes wide open, small round "o" mouth, ears perked straight up, both paws raised slightly.` |
| `{nv}-boi-roi.png` | Bối rối | `Expression: confused — head tilted, one eyebrow raised, awkward small smile, one paw scratching the side of the head, a single small sweat drop near the forehead.` |
| `{nv}-lo.png` | Lo lắng | `Expression: worried and nervous — eyebrows tilted upward, small frown, ears slightly lowered, paws held together in front of the chest.` |
| `{nv}-buon.png` | Buồn, nhớ nhà | `Expression: sad and a little homesick — droopy ears, glossy teary eyes, small pout, looking slightly down.` |
| `{nv}-tu-hao.png` | Tự hào | `Expression: proud and confident — chin up, eyes happily closed with a big smile, one paw on the chest (or giving a thumbs up).` |
| `{nv}-suy-nghi.png` | Suy nghĩ | `Expression: thinking — one paw on the chin, eyes looking up and to the side, mouth slightly pursed.` |

---

## 3 ảnh nền (Tập 1–3)

Gửi trong **một cuộc chat mới**, không đính kèm ảnh nhân vật. Mỗi lần một ảnh.

**Prompt chung cho ảnh nền:**

```
Create background illustrations for a children-friendly language-learning comic. Style: soft 3D Pixar-like environment render matching cute cartoon mascots, warm gentle lighting, slightly simplified shapes, shallow depth of field so the background feels soft and does not compete with characters placed in front of it. Landscape 16:9. Leave the lower-middle area fairly open and uncluttered. No characters, no people, no animals, no text, no letters, no signs with writing, no logos, no watermark.

I will send one scene at a time. Generate exactly one image per message.
```

| Tên file | Tập | Dòng gửi Gemini |
|---|---|---|
| `bg-airport.png` | Tập 1 · Đặt chân đến Bắc Kinh | `Scene: the arrival hall of a modern Beijing airport in the early morning — big glass windows with soft sunrise light, a few rolling suitcases left near a bench, clean light floor, light blue and cream palette.` |
| `bg-campus.png` | Tập 2 · Ngày đầu đến trường | `Scene: a sunny university campus in Beijing in early autumn — a wide path lined with trees with golden leaves, traditional red-brick buildings with grey tiled roofs in the distance, a few empty benches, fresh green and warm cream palette.` |
| `bg-home.png` | Tập 3 · Một ngày ở nhà chị Bắp | `Scene: a cozy small apartment living room in Beijing — warm afternoon light through the window, a low wooden table with two cups of tea, a soft sofa with cushions, a small bookshelf, a framed family photo seen from afar with no visible faces, warm peach and cream palette.` |

---

## Kích thước và nơi để file

- Biểu cảm: ảnh vuông, càng nét càng tốt (Gemini thường xuất 1024×1024).
- Nền: ngang 16:9.
- Để tất cả vào `design/story/raw/` với đúng tên ở trên (đuôi `.png` hay `.jpg` đều được).
- Mình sẽ tách nền magenta, cắt về 512×512 cho biểu cảm và 1280×720 cho nền, nén WebP vào `dist/assets/story/`, rồi dựng lại gói nội dung để app nhận ảnh.

## Khi làm tiếp các tập sau

- Biểu cảm dùng chung cho mọi tập, chỉ cần làm một lần.
- Mỗi chương mới cần thêm một ảnh nền. Dùng lại prompt chung cho ảnh nền, chỉ thay dòng `Scene: …`.

## Đưa ảnh vào app

```bash
python3 tools/process-story-art.py   # design/story/raw → dist/assets/story (tách nền, cắt, nén WebP)
node tools/build-content.mjs         # cập nhật danh sách ảnh trong gói nội dung
```

Tên file gốc không cần đúng tuyệt đối: chữ hoa, khoảng trắng và đuôi kép như `BAP - VUI.png.jpg` đều được chuẩn hoá thành `bap-vui`.
