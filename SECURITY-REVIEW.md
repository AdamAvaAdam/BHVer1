# Kiểm tra bảo mật — 31/10/2026

Cập nhật lần rà soát này: kiểm tra ẩn danh hai endpoint nguồn vẫn có bản ghi (HTTP 200). Chưa đủ điều kiện tuyên bố hệ thống nguồn an toàn. Bộ bàn giao đã xóa các đường dẫn Sheets công bố cũ khỏi nguồn/bản build và bổ sung `npm run check-release` để chặn bí mật cấu hình cùng tệp dữ liệu vận hành trong danh sách đóng gói. Repo Private vẫn cần thiết vì mã chứa quy tắc kinh doanh của công ty. Kiểm tra tự động đã chạy lại: 30/30 đạt, gồm lọc Thái Bình riêng Hưng Yên theo tỉnh cũ và giữ nguyên toàn bộ ledger.

## Những điểm đã xử lý trong bản mới

| Hạng mục | Cách xử lý |
|---|---|
| Đăng nhập bằng HTML có thể bị vượt qua | Tất cả dữ liệu và app nghiệp vụ yêu cầu phiên máy chủ |
| Lộ mật khẩu/khóa trong mã công khai | Mật khẩu băm scrypt N=131072/r=8/p=1 với salt ngẫu nhiên; khóa Warehouse ở cấu hình riêng |
| Lộ dữ liệu trình duyệt lưu lâu dài | Bản mới dùng bộ nhớ phiên và dữ liệu AES-256-GCM trên máy chủ, không ghi nghiệp vụ vào localStorage |
| Đoán mật khẩu | Giới hạn bền vững theo địa chỉ kết nối và toàn tài khoản; giới hạn xử lý scrypt đồng thời |
| Chiếm phiên | Cookie HttpOnly, SameSite=Strict, Secure và tiền tố __Host- khi dùng HTTPS; token ngẫu nhiên chỉ lưu dạng hash ở server |
| Phiên quá lâu | 30 phút không hoạt động; tối đa 8 giờ; đăng xuất/đổi mật khẩu thu hồi phiên |
| Đánh cắp mật khẩu dùng lại | Bắt buộc TOTP 2FA khi chạy Internet; chống dùng lại mã OTP |
| Giả mạo yêu cầu | Kiểm tra Origin + CSRF token trên thao tác ghi; từ chối Sec-Fetch-Site cross-site |
| XSS/clickjacking | CSP với nonce cho script, connect-src self, frame-ancestors self, không cho object; không đưa mật khẩu vào DOM nghiệp vụ |
| Proxy bị lợi dụng để vào mạng nội bộ | Chỉ GET tài nguyên Warehouse định trước; từ chối nguồn tùy ý, chuyển hướng không được phép và tham số lạ |
| Trả quá nhiều dữ liệu | Loại điện thoại, địa chỉ, giấy tờ, email khỏi phản hồi API của app nếu không cần tính năng |
| Mất dữ liệu khi hai máy cùng lưu | Revision và giao dịch SQLite; trả lỗi xung đột thay vì ghi đè âm thầm |
| Lộ database/config qua đường dẫn | Không phục vụ filesystem tùy ý; đường dẫn `.env`, `data`, mã server, private không có route tải |
| Rò rỉ container | Không chạy app bằng root, filesystem chỉ đọc, cổng nội bộ, secrets chỉ gắn cho container app |

## Vấn đề thực tế ở hệ thống nguồn — chưa được sửa bởi bản này

**Mức nghiêm trọng cao:** kiểm tra không gửi Authorization vào hai endpoint `wh_sales_orders/paginate` và `wh_customers/paginate` vẫn nhận HTTP 200. Kiểm tra trước đó trong phiên làm việc còn xác nhận chúng trả bản ghi nghiệp vụ. Khóa đăng nhập của app mới không ngăn người khác truy cập trực tiếp các endpoint nguồn này.

Cần bên phát triển Warehouse bắt buộc xác thực ở tất cả route dữ liệu, kiểm tra quyền đối tác/tài khoản theo từng resource và thao tác, giới hạn phạm vi nhân viên/kho, rồi kiểm tra lại các request ẩn danh phải bị từ chối. Không suy ra quyền của khóa mới chỉ từ tên “Reader”; cần cấp riêng đúng quyền GET cần dùng và không có quyền tạo/sửa/xóa. App hiện chỉ gọi đọc nhưng không thể tự thu hẹp quyền của một khóa rộng trên máy chủ nguồn.

**Nguồn Google Sheets cũ:** theo yêu cầu mới, bảng giá và tọa độ bản đồ tiếp tục đọc từ các trang tính cấu hình riêng qua máy chủ, xác minh nguồn/tab và giới hạn chuyển hướng Google. Bộ proxy tùy ý vẫn từ chối Google. Địa chỉ nguồn giữ trong cấu hình riêng, không trả xuống trình duyệt và không đưa vào ZIP; điều này không đổi quyền chia sẻ vốn có của bảng. Các bản app cũ và bảng đã publish trước đó vẫn có thể tồn tại bên ngoài bản mới. Cần quản trị nguồn kiểm tra quyền chia sẻ và thay bằng kênh đọc được xác thực trước khi tuyên bố toàn bộ dữ liệu đã kín. Bản mới không tự thay quyền chia sẻ vì có thể làm hỏng các ứng dụng đang dùng.

**Bí mật đã trao đổi:** mật khẩu Admin và khóa API từng được gửi trong chat. Bản local đã cấu hình theo yêu cầu nhưng không chứa chúng trong gói code. Khi đưa lên dùng thật, nên dùng mật khẩu Admin riêng và thay khóa API ở nguồn, sau khi có kế hoạch chuyển các hệ thống đang phụ thuộc. Không tự thu hồi khóa Bravo hiện có.

## Giới hạn và vận hành

- Không có “bảo mật cao nhất” tuyệt đối. Máy chủ/máy trạm nhiễm mã độc hoặc người có quyền quản trị hệ điều hành vẫn có thể lấy dữ liệu và khóa đang được sử dụng.
- Không giấu được mã giao diện khỏi Admin đã đăng nhập. Không dùng tắt chuột phải, chặn F12 hay xáo trộn JavaScript làm lớp bảo mật. Muốn không công khai mã nguồn trên GitHub thì dùng repo Private, phân quyền ít người và tắt Pages.
- Bản cũ trên Pages và dữ liệu localStorage cũ vẫn tồn tại cho đến khi bạn có kế hoạch sao lưu, chuyển nguồn và gỡ/thu hẹp chúng. Bản này chưa tự xóa bản cũ hoặc lịch sử GitHub.
- Các báo cáo/sao lưu tải xuống theo chủ ý của Admin không được tự mã hóa; cần lưu chúng ở nơi được bảo vệ. Database AES-GCM không thay cho sao lưu và quản lý `DATA_KEY`.
- Mã cũ được giữ để bảo toàn tính năng; CSP vẫn cho inline style để phù hợp giao diện. Đã có kiểm tra kỹ thuật tự động nhưng chưa kiểm toán độc lập toàn bộ code cũ, chưa thử trên tên miền sản xuất hoặc thực hiện pentest bên ngoài.
- Các kiểm tra tự động không ghi/xóa dữ liệu nghiệp vụ Warehouse. Không có bước triển khai, cấp quyền hay đổi cấu hình nguồn nào đã được thực hiện.

## Kết quả kiểm tra tự động

30 kiểm tra đạt, gồm: băm mật khẩu/mã hóa/TOTP; chặn ẩn danh và sai Origin/Host; CSRF và xung đột lưu; khóa không xuống client và giới hạn proxy; đăng xuất/đổi mật khẩu; yêu cầu MFA và cờ cookie; giới hạn đăng nhập sai; cookie HTTPS và chống replay OTP; chặn redirect vào mạng nội bộ; giữ đúng định dạng JSON qua bộ đọc nguồn; từ chối Google khi nguồn bị xóa; tổng đơn gồm VAT theo mọi trạng thái; giữ tiền đơn thiếu chi tiết; không lấy chiết khấu làm giá bán; cache API; phân trang đại lý mà giữ đúng tổng.

Tham chiếu: [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Bổ sung kiểm tra giá: D/E/F đúng cột và không trừ hai lần; giữ tồn API; từ chối model trùng mơ hồ; từ chối HTML; kiểm tra đúng bảng/tab; cache yêu cầu đồng thời; chặn chuyển hướng nội bộ.

Luồng mới yêu cầu chọn khu vực trước khi đọc snapshot/lịch sử. Máy chủ lọc đầu đơn bằng CustomerCode của khách thuộc tỉnh, kiểm tra phản hồi không lẫn khách ngoài phạm vi, cache tách theo tỉnh. Đây là bộ lọc hiệu năng cho tài khoản Admin hiện có, không phải cơ chế phân quyền nhiều nhân viên. Kiểm tra bổ sung: chưa chọn không dựng đại lý; không tải toàn bộ đơn khi chọn một tỉnh; cập nhật tỉnh giữ nguyên tỉnh khác; tổng kết tách sang bảng hoàn thành; bản sao lưu chương trình không hợp lệ bị từ chối.

Tab bản đồ: dùng chung phiên Admin; loại bỏ mật khẩu băm cố định và đường dẫn Sheets khỏi HTML. Thư viện Leaflet được đóng gói tại máy chủ, giữ CSP nonce và không cho script ngoài/inline event handler. Nguồn CSV cố định trong cấu hình; bộ dịch vụ chỉ cho đúng máy chủ và đường dẫn Nominatim/OSRM/Valhalla, chặn chuyển hướng, giới hạn dung lượng/tần suất và yêu cầu CSRF cho bộ trung gian. Cài đặt bản đồ lưu qua kho mã hóa như phần còn lại. Kiểm tra xác thực tab/asset, CSRF, SSRF và chuyển tỉnh đã đạt. Không tự đổi quyền nguồn Sheets hoặc Warehouse.

Bản đồ mới chỉ đọc tọa độ CSV, lấy tiền từ đầu đơn Warehouse, có đối soát và không dùng tiền CSV dự phòng. Bộ lọc bản đồ/Gợi ý/Doanh số độc lập. Referrer của riêng HTML bản đồ là strict-origin-when-cross-origin để gửi origin cho OSM; không gửi khóa hay doanh số. API vẫn no-referrer. Không bảo đảm an toàn 100%; các hạn chế nguồn Warehouse/Sheets nêu trên vẫn còn.
