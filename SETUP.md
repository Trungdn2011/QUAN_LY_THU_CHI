# Hướng Dẫn Cài Đặt Google Sheets API

## Bước 1: Tạo Google Sheet

1. Truy cập [Google Sheets](https://sheets.google.com) và tạo một sheet mới.
2. Đổi tên tab dưới cùng thành **ThuChi**.
3. Thêm header vào **hàng 1** như sau:

| A  | B    | C        | D      | E       | F        | G      |
|----|------|----------|--------|---------|----------|--------|
| ID | Ngày | Phân loại| Nội dung| Danh mục| Số tiền  | Ghi chú|

4. Copy **Spreadsheet ID** từ URL:
   ```
   https://docs.google.com/spreadsheets/d/[COPY_THIS_PART]/edit
   ```

## Bước 2: Tạo Google Cloud Project

1. Vào [Google Cloud Console](https://console.cloud.google.com/).
2. Tạo **New Project** (đặt tên tùy ý).
3. Chọn project vừa tạo.

## Bước 3: Bật Google Sheets API

1. Vào **APIs & Services → Library**.
2. Tìm kiếm **Google Sheets API** → Click **Enable**.

## Bước 4: Tạo API Key

1. Vào **APIs & Services → Credentials**.
2. Click **+ Create Credentials → API Key**.
3. Copy API Key vừa tạo.
4. (Khuyến khích) Click **Restrict Key** → chọn **Google Sheets API**.

## Bước 5: Tạo OAuth 2.0 Client ID

1. Vào **APIs & Services → Credentials**.
2. Click **+ Create Credentials → OAuth 2.0 Client ID**.
3. Nếu được hỏi, cấu hình **OAuth consent screen** trước:
   - App name: Quản lý Thu Chi
   - User support email: email của bạn
   - Authorized domains: để trống nếu chạy local
   - Nhấn Save
4. Quay lại tạo OAuth Client ID:
   - Application type: **Web application**
   - Authorized JavaScript origins: thêm `http://localhost` và `http://127.0.0.1:5500` (nếu dùng Live Server)
   - Nhấn **Create**
5. Copy **Client ID**.

## Bước 6: Cập nhật config.js

Mở file `config.js` và điền vào:

```js
const CONFIG = {
  API_KEY: 'API Key của bạn',
  CLIENT_ID: 'Client ID của bạn',
  SPREADSHEET_ID: 'Spreadsheet ID của bạn',
  SHEET_NAME: 'ThuChi',
  ...
};
```

## Bước 7: Chạy App

- **Cách 1 (Khuyến khích)**: Dùng **VS Code** + extension [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) → Click **Go Live**.
- **Cách 2**: Dùng Python: `python -m http.server 8000` rồi mở `http://localhost:8000`.
- **Cách 3**: Mở thẳng `index.html` (một số tính năng OAuth có thể không chạy).

## Lưu Ý

- Tài khoản Google dùng đăng nhập phải có quyền **Editor** trên Google Sheet.
- Nếu gặp lỗi "This app isn't verified", click **Advanced → Go to app (unsafe)**.
- Chỉ thêm tài khoản test trong phần OAuth consent screen nếu app ở chế độ **Testing**.
