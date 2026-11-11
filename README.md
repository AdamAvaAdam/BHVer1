# Việt Tuấn · Trợ lý bán hàng

Bản HTML dùng trên GitHub Pages, gồm tồn kho/báo giá, doanh số/chương trình, chăm sóc/nhắc hàng, gợi ý bán hàng và bản đồ thị trường. Chỉ đọc dữ liệu đã được công cụ Windows đồng bộ vào Google Sheets; không gọi Warehouse trực tiếp từ trình duyệt.

## Kết nối Google lần đầu
1. Bật Google Sheets API trong dự án Google Cloud.
2. Google Auth Platform: khai báo tên ứng dụng, email hỗ trợ, cấu hình Audience và Test users nếu đang Testing.
3. Tạo OAuth Client ID loại Web application. Authorized JavaScript origin: `https://adamavaadam.github.io` (không thêm đường dẫn repo).
4. Dùng quyền `https://www.googleapis.com/auth/spreadsheets.readonly` và `openid email`. Luồng popup không cần Client secret hoặc redirect URI.
5. Mở website → Đăng nhập Google lần đầu để tải dữ liệu. Client ID công khai đã cấu hình trong bản phát hành.
6. Trang tính cần để Bị hạn chế và chỉ chia sẻ cho tài khoản được phép sử dụng cùng tài khoản đồng bộ. Website không tự thay đổi quyền chia sẻ có sẵn.

Client ID là mã công khai. KHÔNG đưa Client secret, JSON Service Account, khóa Warehouse hoặc access token lên GitHub. Website chỉ dùng GET với Google Sheets và không lưu token vào localStorage.

## Dữ liệu
Các tab WH_ chứa khách hàng, sản phẩm, tồn, đơn, chi tiết, chương trình, doanh số và thông tin lượt đồng bộ. Tra cứu đọc đúng tab Hàng tồn (gid 0), Giá (gid 2018616519) và Thông số sản phẩm trong trang tính Tồn - Giá. Cột F của Giá là giá cuối. Mã hàng nối theo mã vật tư, giữ riêng các biến thể. Tọa độ lấy từ tab Định vị; doanh số bản đồ lấy từ đầu đơn WH_, không lấy doanh số nhập tay trong bảng định vị.
Khi cần dữ liệu mới hoặc kỳ cũ, mở công cụ đồng bộ trên Windows và chọn phạm vi đủ lịch sử. Chương trình và bản đồ báo thiếu dữ liệu nếu khoảng cần xem vượt phạm vi đã đồng bộ. Không coi số liệu thiếu là kết quả đủ kỳ.

## Sử dụng
Doanh số và Gợi ý bán hàng có bộ lọc khu vực riêng, chờ chọn khu vực trước khi tải lịch sử. Bản đồ có bộ lọc riêng và tải toàn bộ khách khi mở. Các chức năng tạo/gia hạn chương trình, phân loại theo thời gian, tổng kết, báo giá và chăm sóc giữ từ bản nâng cấp.
Ghi chú và chương trình tự tạo lưu mã hóa trên thiết bị theo tài khoản Google, chưa tự chuyển giữa máy tính/điện thoại. Dùng Xuất/Nhập sao lưu thiết bị để chuyển. File sao lưu do người dùng tải xuống có thể chứa dữ liệu nghiệp vụ, cần giữ riêng tư.

## Giới hạn bảo vệ
Quyền chỉ đọc được Google thực thi qua OAuth; phạm vi Sheets readonly áp dụng với các spreadsheet mà tài khoản có quyền xem, mã app chỉ gọi file được cấu hình. Biết link hoặc đọc HTML không thay được quyền truy cập của Google, nhưng trang tính công khai vẫn có thể bị đọc trực tiếp. Người có quyền xem có thể sao chép dữ liệu.
Khóa mã hóa thiết bị được lưu trong hồ sơ trình duyệt. Không thay thế bảo vệ thiết bị, không bảo đảm chống mã độc hoặc mã độc hại chạy cùng origin. Không thể giấu hoàn toàn quy tắc kinh doanh được viết trong HTML công khai.

Triển khai `index.html` cùng `sw.js` trong thư mục BHVer1 để mở lại cả khi mất mạng; `index-code.txt` là bản mã HTML tương ứng để tải/copy. Bản phát hành không chứa dữ liệu khách/đơn từ lần đồng bộ, không chứa khóa thực hoặc mã fixture bỏ qua đăng nhập.

Tài liệu Google: https://developers.google.com/identity/oauth2/web/guides/use-token-model


## Ghi nhớ dữ liệu trên thiết bị — 01/11/2026

Sau lần đăng nhập Google và tải giá/tồn thành công, app tự lưu bản dữ liệu trong kho mã hóa theo tài khoản trên trình duyệt đó. Mở lại sẽ vào bản đã lưu mà không gọi Google. Dòng trạng thái luôn ghi thời điểm giá/tồn thực sự được tải; thời điểm này không đổi chỉ vì mở lại app.

Bấm **Cập nhật** trên thanh đầu trang hoặc **Cập nhật giá & tồn** để lấy bảng mới. Khi phiên Google hết hạn, chỉ thao tác cập nhật mới yêu cầu kết nối lại. Hết phiên không đóng app đang xem. Cập nhật lỗi giữ bản thành công trước đó; không trộn các lượt đồng bộ WH_ khác nhau. Chỉ những phần dữ liệu đã tải được mới dùng được khi ngoại tuyến; phần chưa lưu báo rõ cần cập nhật. Thời tiết, nền bản đồ và dịch vụ đường đi vẫn cần mạng.

Service worker chỉ lưu vỏ ứng dụng công khai; dữ liệu kinh doanh nằm trong kho thiết bị, không nằm trong cache công khai hay mã phát hành. Không lưu access token/refresh token Google. Ghi chú/chương trình tự tạo vẫn giữ riêng; sao lưu ghi chú không kèm bản tải dữ liệu. Có nút **Đăng xuất / tắt ghi nhớ** và **Xóa bản dữ liệu tải về trên máy**. Cần dùng cùng trình duyệt; xóa dữ liệu trình duyệt hoặc chế độ riêng tư có thể làm mất bản lưu. Không thêm máy chủ.

Đã kiểm tra 16 bài kiểm tra tự động và luồng trình duyệt với dữ liệu mẫu: đóng/mở lại không Google, hết phiên vẫn xem được, tải lại thật khi ngoại tuyến qua service worker, đối soát bản đồ đã lưu, cập nhật thành công/thất bại, giữ ghi chú, đăng xuất/xóa bản lưu và tồn Có/báo giá/gợi ý. Không đưa fixture hoặc dữ liệu kinh doanh thật vào bản phát hành.
