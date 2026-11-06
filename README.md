# Olist Insight — Frontend

Giao diện phân tích dữ liệu thương mại điện tử Olist, dùng React, TypeScript và Vite. Giao diện hiển thị bằng tiếng Anh, bao gồm thông báo, nhãn biểu đồ và tiêu đề CSV/Excel. Các giá trị gốc dùng khi gọi API và nội dung do người dùng nhập (ví dụ tên campaign) được giữ nguyên.

## Chạy ứng dụng

Cần Node.js 20 trở lên (đã kiểm tra với Node 24) và npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Ứng dụng dùng cổng **5173**, không tự chuyển cổng khi cổng này bận. Đặt `VITE_API_BASE_URL` trong `.env.local` thành địa chỉ backend, mặc định `http://localhost:8000`. Khởi động lại Vite sau khi thay đổi biến này. Khi triển khai, đặt biến trước lúc build vì Vite nhúng cấu hình vào bundle. Backend cần cho phép CORS từ địa chỉ frontend.

```sh
npm run build   # TypeScript + production bundle trong dist/
npm run preview
```

Repo này không chứa backend, ETL, cơ sở dữ liệu hay mô hình HGB. Các màn hình không tự sinh dữ liệu hoặc kết quả dự đoán khi backend vắng mặt.

## Các màn hình

- `#/manager`: KPI tổng thể; doanh thu theo thời gian/bang; bộ lọc năm/ngành/vùng; giao hàng, review; 10 tuyến giao trễ nhiều nhất; 10 sản phẩm có doanh thu thấp nhất. Đã bỏ khối Top 10 sản phẩm theo doanh thu. Bộ lọc chỉ tác động đến doanh thu, không thay đổi KPI hoặc phân tích giao hàng.
- `#/ops`: lọc đơn rủi ro, mô phỏng dời hẹn giao (không lưu thay đổi đơn), gắn khách vào campaign, xem chất lượng mô hình.
- `#/campaigns`: danh sách campaign hiển thị trước; nút Create campaign mở form tạo tại chỗ; sửa/xóa campaign, xem/xóa tệp khách, xuất danh sách.
- `#/predict`: nhập đơn và yêu cầu backend dự đoán giao trễ hoặc review thấp; hiển thị ngưỡng, lịch sử tuyến và các giá trị mô hình dùng. Đổi đầu vào sẽ xóa kết quả cũ.

Mã ngành và bang giữ nguyên khi gửi API. `utils/format.ts` chứa mapping đủ 27 mã bang Brazil và định dạng `cool_stuff` thành `Cool Stuff`. Dataset không có tên sản phẩm; bảng hiển thị mã rút gọn và mã đầy đủ khi di chuột. CSV/Excel xuất các dòng đang hiển thị, giữ mã định danh đầy đủ.

## API cần cung cấp

Chi tiết kiểu dữ liệu và payload nằm trong `api.ts`, giữ theo bản nguồn được cung cấp:

| Nhóm      | Endpoint                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard | `GET /dashboard/kpi-summary`, `/revenue-trend`, `/top-products?ascending=true`, `/delivery-trend`, `/delivery-routes`, `/review-by-delay` (cùng tiền tố `/dashboard`) |
| Ops       | `GET /risk/{model}/summary`, `/orders`, `/importance`; `GET /risk/metrics`; `POST /risk/{model}/what-if`                                                              |
| Dự đoán   | `GET /risk/predict/options`, `/risk/predict/distance`; `POST /risk/{model}/predict`                                                                                   |
| Campaign  | `GET/POST /campaigns`; `PUT/DELETE /campaigns/{code}`; `GET/POST/DELETE /campaigns/{code}/targets`                                                                    |

`model` là `late_delivery` hoặc `low_review`. Điểm rủi ro và tỷ lệ theo hợp đồng hiện tại là số từ 0 đến 1. Cần đối chiếu hợp đồng này với backend thực tế trước khi demo tích hợp. Không đưa mật khẩu, token hoặc `.env.local` lên Git.

## Kiểm thử frontend

```sh
npx playwright install chromium
npm test
```

Nếu máy đã có Chromium, có thể dùng `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm test` (Linux). Kiểm thử tự chạy Vite ở cổng 5180, mô phỏng API trong trình duyệt và không thay đổi dữ liệu backend thật. Bao gồm bộ lọc Manager, mapping nhãn, mô phỏng xử lý, gắn khách, CRUD campaign, xuất CSV/XLSX, dự đoán, đầu vào không hợp lệ, lỗi kết nối và bố cục 1440px, 1024px, 768px, 390px. Kiểm tra thêm danh sách đủ 27 bang, biểu đồ chuyển từ hai cột sang một cột trên mobile, form tạo campaign khi lưu/lỗi, bảng mở rộng trên màn hình hẹp và thao tác bàn phím với thông tin nguồn dữ liệu. Các ảnh chụp khi kiểm thử nằm trong `/tmp/olist-*.png` trên Linux.

Kiểm thử mô phỏng xác minh frontend; chưa chứng minh backend hoặc mô hình thực tế hoạt động.

## Giao diện tích hợp từ Figma Make

Bố cục, màu sắc và phong cách bảng/form được cập nhật theo bản `DW UI.zip` mới và các ảnh tham chiếu ngày 06/11/2026. Thanh ngang chỉ chứa bốn tab. Tiêu đề mỗi trang gói trong một hàng cùng hành động và thông tin nguồn dữ liệu, tự xuống hàng khi màn hình hẹp. Giữ màu xanh/trắng/xám hiện có, tăng độ dễ đọc và giảm icon, badge trang trí, khung lồng nhau.

- Manager: năm KPI gọn; biểu đồ doanh thu và xếp hạng bang nằm cạnh nhau theo tỷ lệ 2:1; xếp hạng dùng thanh ngang và giữ đủ các bang do API trả về trong vùng cuộn. Hai biểu đồ giao hàng nằm cùng hàng; các bảng tuyến/sản phẩm nằm bên dưới.
- Ops: hai danh sách đơn hiển thị toàn chiều rộng; mô phỏng mở ngay dưới đơn được chọn. Phần gắn campaign gọn hơn; các bảng chất lượng mô hình và hai biểu đồ được nhóm trong một surface.
- Campaign: ưu tiên danh sách; form tạo mở bằng nút ở tiêu đề, hỗ trợ Cancel, giữ đầu vào nếu API báo lỗi và khóa đóng form khi đang lưu. Sửa và chi tiết vẫn mở trong bảng.
- Predictor: sáu trường dùng chung trên một hàng ở desktop rộng, tự xếp lại trên tablet/mobile; hai thẻ dự đoán có hướng dẫn ngắn, không còn vùng trống lớn. Kết quả, ngưỡng, lịch sử tuyến và Model inputs lấy từ API.

Ứng dụng tiếp tục dùng React 18, Vite 5, Recharts 2 và ExcelJS của project; bổ sung `lucide-react` cho bộ icon tương ứng mẫu Figma. Không cần runtime Figma hoặc Tailwind. Sau khi pull bản mới, chạy lại `npm ci` để cài đủ dependency.

Dữ liệu demo, các bộ điều khiển mô phỏng lỗi và kho campaign trong bộ nhớ của bản Figma không được đưa vào ứng dụng. Nhãn nguồn là **API data** với giải thích mở được bằng bàn phím, thay cho nhãn Demo data của bản mẫu. Nhãn này mô tả nguồn API, không khẳng định dữ liệu đang tải thành công hoặc mô hình đã được kiểm định; lỗi kết nối vẫn hiển thị tại từng phần. Các màn hình đọc/ghi qua `api.ts` hiện có; khách gắn ở Ops và danh sách Campaign cùng sử dụng backend. Nút Export report trên Manager xuất các dòng doanh thu theo bộ lọc đang chọn thành CSV. Tệp CSV/XLSX của các danh sách xuất các dòng đã tải, kèm ID đầy đủ; không tự tải toàn bộ các dòng chưa được API trả về.

### Ghép source vào project backend hiện có

Nếu backend đã có cấu hình frontend, thay toàn bộ các file/thư mục source sau, giữ nguyên vị trí tương đối:

```text
App.tsx
main.tsx
api.ts
vite-env.d.ts
styles.css
pages/
components/     # Gồm Dashboard.tsx và ListTools.tsx
utils/          # Gồm display.ts và format.ts
```

Đối chiếu `package.json`/lockfile để có đủ React, Recharts, ExcelJS và Lucide React. Đặc biệt không bỏ sót `components/Dashboard.tsx` hoặc `utils/display.ts`. Phần `.figma/` và các script chạy riêng của bản xuất Figma không cần cho ứng dụng này.
