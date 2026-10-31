# Hai việc cần bên quản trị Warehouse/Bravo xử lý

## 1. Đồng bộ đủ bảng giá chương trình

Người dùng xác nhận bảng giá Bravo có D = giá gốc, E = khuyến mãi, F = giá cuối. Ứng dụng cần dữ liệu tương ứng từng sản phẩm và từng chương trình; không dùng giá đơn hàng lịch sử thay giá hiện hành.

Đã đọc trực tiếp sản phẩm SHAMGESTN91ENDG (ES-TN91EN-DG), chương trình SHAT10.23.1 và chi tiết liên quan trong các endpoint có tài liệu `wh_products`, `wh_promotions`, `wh_promotion_details`. Dòng chương trình cơ sở có DiscountValue = 0; các gói/chương trình bổ sung có DiscountValue = 200000 hoặc 300000. Note rỗng, temp rỗng; chưa có trường giá gốc hoặc giá cuối trong các bản ghi này. Giá trị chiết khấu này không được tự coi là giá bán.

Đề nghị cung cấp endpoint/bổ sung đồng bộ các trường: SKU, mã chương trình, giá gốc, nội dung khuyến mãi, giá cuối, đơn vị tiền, giá đã gồm VAT hay chưa, thời gian hiệu lực, số lượng tối thiểu/tối đa và phạm vi đại lý/tỉnh. Cần xác nhận giá cuối đã áp dụng những khoản nào để tránh trừ chiết khấu hai lần. Tên trường cụ thể phải theo API của bên phát triển, không phải tên trường do ứng dụng tự đoán.

## 2. Bắt buộc xác thực nguồn dữ liệu

Kiểm tra lại ngày 31/10/2026: GET không có Authorization vào `/v1/wh_sales_orders/paginate?_page=1&_limit=1` và `/v1/wh_customers/paginate?_page=1&_limit=1` vẫn trả HTTP 200 và có bản ghi. Cần bắt buộc xác thực/phân quyền theo đối tác ở tất cả route nghiệp vụ. Sau sửa, request ẩn danh phải nhận 401/403, khóa chỉ đọc phải không có quyền ghi và không đọc được phạm vi ngoài được cấp.

Không gửi khóa hoặc dữ liệu khách hàng kèm báo cáo này. Đây là tài liệu để người dùng chuyển cho đơn vị phát triển; ứng dụng chưa gửi cho bên nào.
