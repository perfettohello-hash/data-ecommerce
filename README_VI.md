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
   - `GOOGLE_SHEET_ID` = ID của Google Sheet đang sử dụng.
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = toàn bộ JSON key (dạng JSON hợp lệ, một dòng nếu giao diện yêu cầu).
5. Deploy site. Mở URL Netlify; nhấn Làm mới để lấy dữ liệu mới.

## Cần kiểm tra trước khi dùng chính thức
- Shop được đọc trực tiếp từ cột C (`PFT ID`) của PO, giữ nguyên chữ hoa/thường, khoảng trắng và dấu gạch ngang. Chỉ ô trống dùng `Chưa xác định`; không gộp các shop thành sàn chung.
- Nếu Google Sheets thực tế có hàng tiêu đề khác dòng 3, đổi range trong `netlify/functions/dashboard.js`.
- TRAFFIC cần điền số Visits/Potential buyers dạng số, không để chữ “Bạn nhập”.
- Mã nguồn lọc các dòng có ngày, mã đơn và tên sản phẩm; cần đối chiếu quy tắc trạng thái để quyết định có loại đơn hủy/hoàn hay không.
- Số lượng đơn được tính theo mã `Số PO` duy nhất, không phải số dòng sản phẩm.

## Tổng hợp tháng và năm

Bảng tháng có đủ 12 tháng, bộ chọn năm, doanh thu VND, số PO duy nhất và tổng số lượng bán. Tổng số đơn năm được đếm duy nhất trên cả năm, không cộng số đơn từng tháng khi cùng PO xuất hiện ở nhiều tháng. Hai bảng tổng hợp áp dụng bộ lọc shop/brand/category nhưng dùng năm riêng, không bị giới hạn bởi kỳ tuần/tháng của biểu đồ phía trên. Ngày dạng ngày trong sheet được giữ theo lịch Việt Nam; timestamp có múi giờ được chuyển sang Asia/Ho_Chi_Minh.

Ánh xạ CAT đã đối chiếu tên sản phẩm và `ID Per`: `Coffee maker` → Máy pha cà phê; `Coffee` → Cà phê; `Hygiene products` → Hóa chất. Các nhãn tiếng Việt tương đương cũng được nhận diện. Tất cả danh mục còn lại (bao gồm máy xay, phụ kiện, trà) và CAT trống vào Khác / Chưa phân loại. Không tự suy đoán nhóm từ tên hoặc mã sản phẩm. Tổng bốn nhóm luôn bằng doanh thu năm.

PO có hai cột `Số PO`; parser giữ ưu tiên cột cuối như phiên bản trước, dùng cột trước khi cột cuối trống. Giá hoặc số lượng thiếu/không hợp lệ bị bỏ qua với cảnh báo; giá 0 hợp lệ được giữ. Không thay đổi quy tắc trạng thái đơn hàng.

API `/api/dashboard` giữ `orders`, `traffic`, `warnings`, `updatedAt` và bổ sung `reports.shops`, `reports.monthly`, `reports.yearly` trên toàn bộ dữ liệu hợp lệ. Frontend sử dụng cùng hàm tổng hợp cho các bộ lọc. Chạy kiểm thử với `npm test`. Chạy preview có Functions bằng `netlify dev --port 8889`.
