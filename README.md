# Olist Insight — Frontend

Giao diện phân tích dữ liệu thương mại điện tử Olist, dùng React, TypeScript và Vite.

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
- `#/campaigns`: thêm/sửa/xóa campaign, xem/xóa tệp khách, xuất danh sách.
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

Nếu máy đã có Chromium, có thể dùng `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm test` (Linux). Kiểm thử tự chạy Vite ở cổng 5180, mô phỏng API trong trình duyệt và không thay đổi dữ liệu backend thật. Bao gồm bộ lọc Manager, mapping nhãn, mô phỏng xử lý, gắn khách, CRUD campaign, xuất CSV/XLSX, dự đoán, đầu vào không hợp lệ, lỗi kết nối và bố cục 390px. Các ảnh chụp khi kiểm thử nằm trong `/tmp/olist-*.png` trên Linux.

Kiểm thử mô phỏng xác minh frontend; chưa chứng minh backend hoặc mô hình thực tế hoạt động.
