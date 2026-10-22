# E-commerce Dashboard — hướng dẫn cài đặt

## Cấu trúc
- `PO`: dữ liệu đơn hàng. Mã nguồn giả định hàng tiêu đề là dòng 3 (`PO!A3:AL`), dữ liệu từ dòng 4.
- `TRAFFIC`: tiêu đề ở dòng 1 (`TRAFFIC!A1:E`).
- Doanh thu = `Giá thực bán × SL`.
- Đơn hàng được đếm theo `Số PO` duy nhất.

## Bước 1 — Cài Node.js
Cài bản Node.js LTS từ https://nodejs.org/ rồi đóng/mở lại Command Prompt.
Kiểm tra:
```bat
node -v
npm -v
```

## Bước 2 — Tạo Service Account để đọc Google Sheets
1. Mở https://console.cloud.google.com/
2. Tạo project mới.
3. Vào APIs & Services → Library → bật Google Sheets API.
4. Vào IAM & Admin → Service Accounts → Create service account.
5. Tạo JSON key và tải xuống. Giữ file này riêng tư, không đưa lên GitHub.
6. Mở JSON và sao chép toàn bộ nội dung; sau đó trong Netlify lưu vào biến môi trường `GOOGLE_SERVICE_ACCOUNT_JSON`.
7. Chia sẻ Google Sheet cho email `client_email` trong JSON với quyền Viewer. Không cần bật công khai toàn bộ bảng tính.

## Bước 3 — Chạy thử tại máy
Giải nén ZIP. Mở Command Prompt tại thư mục dự án và chạy:
```bat
npm install
npm run dev
```
Lưu ý: API Google Sheets Function chỉ chạy trong Netlify Dev; để test function tại máy, cài Netlify CLI (`npm install -g netlify-cli`) và chạy:
```bat
netlify dev
```
Cần cấu hình các biến môi trường bên dưới trước khi gọi API.

## Bước 4 — Đưa mã lên GitHub và Netlify
1. Tạo repository GitHub riêng tư, tải toàn bộ mã nguồn lên.
2. Trong Netlify chọn Add new site → Import an existing project → GitHub repository.
3. Build command: `npm run build`; Publish directory: `dist`.
4. Trong Site configuration → Environment variables, tạo:
   - `GOOGLE_SHEET_ID` = `1w0RjspFJggVaSZWg3cNI6x-fhYBEXPLS7JzplnGCQBc`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = toàn bộ JSON key (dạng JSON hợp lệ, một dòng nếu giao diện yêu cầu).
5. Deploy site. Mở URL Netlify; nhấn Làm mới để lấy dữ liệu mới.

## Cần kiểm tra trước khi dùng chính thức
- Mã nguồn hiện chưa xác định được cột nền tảng trong `PO`. Trong file CSV được cung cấp, cột `Sàn ID` có vẻ chứa mã định danh, không phải tên nền tảng. Vì vậy doanh thu theo nền tảng hiện sẽ hiển thị `Chưa xác định` cho đến khi xác định cột hoặc có bảng ánh xạ.
- Nếu Google Sheets thực tế có hàng tiêu đề khác dòng 3, đổi range trong `netlify/functions/dashboard.js`.
- TRAFFIC cần điền số Visits/Potential buyers dạng số, không để chữ “Bạn nhập”.
- Mã nguồn lọc các dòng có ngày, mã đơn và tên sản phẩm; cần đối chiếu quy tắc trạng thái để quyết định có loại đơn hủy/hoàn hay không.
- Số lượng đơn được tính theo mã `Số PO` duy nhất, không phải số dòng sản phẩm.
