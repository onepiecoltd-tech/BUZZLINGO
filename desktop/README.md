# BuzzLingo cho Windows (.exe)

Bọc thư mục `../dist` thành ứng dụng Windows bằng Electron. Cần Node.js 18+ trên máy.

```powershell
cd desktop
npm install          # lần đầu
npm start            # chạy thử
npm run build        # -> release\BuzzLingo-0.5.0.exe (1 file, chạy luôn)
npm run build:setup  # -> release\BuzzLingo-Setup-0.5.0.exe (bộ cài, có shortcut)
```

Sửa nội dung xong thì chạy lại `node tools/build-content.mjs` ở thư mục gốc rồi `npm run build`. Dữ liệu học lưu trong `%APPDATA%\BuzzLingo`.
