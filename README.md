# Việt Tuấn — bản có máy chủ bảo mật

## Bổ sung ngày 31/10/2026

- Màn hình **Doanh số & chương trình → Lọc khách hàng theo tỉnh cũ** có 63 tỉnh trước sáp nhập. Tổng đơn, thẻ đại lý, số liệu chương trình, bảng chi tiết và xuất CSV đi theo tỉnh được chọn; chuyển về **Tất cả tỉnh cũ** để xem toàn bộ. Bộ lọc không xóa hoặc đổi dữ liệu. Dùng ProvinceId gốc từ khách Warehouse, không đoán theo tên viết tắt của đại lý. Khách thiếu mã hoặc trùng tên khác tỉnh được để trong nhóm cần đối chiếu. Cần bấm cập nhật đơn lần đầu để bản lưu cũ có thông tin tỉnh.
- Giá Bravo được người dùng xác nhận: **D = giá gốc, E = khuyến mãi, F = giá cuối**. Theo yêu cầu mới, bảng giá tiếp tục đọc từ trang tính cũ, tự chọn tab mới nhất qua nguồn Apps Script cũ. Giá bán dùng đúng F; D/E được giữ để đối chiếu, không trừ E lần nữa. Tồn/khách/đơn vẫn từ Warehouse.
- Chạy `npm run check-release` trước khi đóng gói/commit. Bộ kiểm tra quét danh sách tệp được bàn giao, so với bí mật đang cấu hình và chặn database, cấu hình riêng, báo cáo thử, đường dẫn Sheets công bố cũ. Bộ ZIP không chứa đơn hàng, danh sách khách lấy từ API hoặc khóa cấu hình. Mã vẫn có quy tắc chương trình riêng của công ty: chỉ đưa lên repo **Private**.
- **Chưa thể cam kết an toàn dữ liệu hoàn toàn:** vừa xác nhận lại API khách và đơn nguồn trả dữ liệu khi không có Authorization. Cần bên Warehouse sửa trước khi kết luận dữ liệu nguồn đã được bảo vệ. Không có thao tác push GitHub hay triển khai công khai trong lần sửa này.

Danh mục tỉnh tham khảo [sổ tay điều tra dân số giữa kỳ 2024, phụ lục mã tỉnh](https://www.gso.gov.vn/wp-content/uploads/2024/03/So-tay_HDNV_DT-DSGK_-PN_2024.pdf); không chuyển mã tỉnh cũ sang mã sáp nhập.

Bản này giữ app bán hàng/chăm sóc đại lý/chương trình Sharp và Hương Anh, bổ sung đăng nhập **Admin** thực sự ở máy chủ. Người chưa đăng nhập không tải được giao diện nghiệp vụ hoặc API dữ liệu. Khóa Warehouse không được gửi xuống trình duyệt. Dữ liệu lưu trữ chuyển từ localStorage sang bộ nhớ phiên và máy chủ mã hóa.

**Không đưa bộ này lên GitHub Pages.** Pages chỉ chạy trang tĩnh, không chạy máy chủ Node.js. Một màn hình mật khẩu bằng JavaScript không bảo vệ dữ liệu. Dùng repository **Private**, tắt Pages và triển khai Node.js trên máy chủ riêng hoặc môi trường chạy container. Không ai có thể giấu hoàn toàn mã HTML/JavaScript khỏi người đã được cấp quyền sử dụng trang; phần máy chủ và bí mật không gửi cho họ.

## Dùng ngay trên máy hiện tại

Tệp `.env` riêng trên máy đã được cấu hình bằng mật khẩu Admin và khóa Warehouse bạn yêu cầu. Không có tệp này trong ZIP bàn giao. Trong thư mục này, chạy:

```sh
npm start
```

Mở `http://127.0.0.1:8080`, đăng nhập **Admin** bằng mật khẩu đã yêu cầu. Bấm **Doanh số & chương trình** để xem tổng đơn từng đại lý. App chờ chọn tỉnh cũ ở bộ lọc trước khi tải đơn, sau đó cập nhật riêng khu vực mỗi 5 phút khi trang đang mở; chọn Tất cả mới đọc toàn bộ đơn. Không cần nhập khóa trên trình duyệt. Theo xác nhận của công ty: cộng mọi trạng thái đơn bán, dùng TotalAmount đã gồm VAT, không nhân VAT lần nữa.

## Đưa code lên GitHub và triển khai trên máy chủ khác

1. Tạo repository **Private**, upload nội dung gói ZIP. Giữ `.gitignore`, `.dockerignore`. Tắt GitHub Pages. Không upload cả thư mục dự án cha.
2. Cài Node.js 22.17 trở lên thuộc nhánh còn được hỗ trợ. Không cần `npm install`: app dùng thư viện có sẵn của Node.
3. Trên máy chủ, trong thư mục code, chạy `npm run setup`. Nhập lần lượt mật khẩu Admin, khóa Warehouse, địa chỉ website chính xác như `https://app.tenmiencuaban.vn`. Công cụ tạo `.env` riêng; không commit tệp này. Mật khẩu phải ít nhất 15 ký tự.
4. Chạy `npm run mfa`. Thêm mã thiết lập vừa hiện vào Authenticator dưới dạng TOTP, 6 số, chu kỳ 30 giây. Mã thiết lập này là bí mật, không upload hoặc gửi cho người khác. Bản chạy Internet bắt buộc bật 2FA.
5. Trỏ DNS của tên miền vào máy chủ. Có thể dùng Docker Compose đi kèm để chạy HTTPS:

```sh
docker compose up -d --build
```

Trên Linux, tệp `.env` gắn vào container phải đọc được bởi UID 1000 (tài khoản `node`) nhưng không được mở cho mọi người. Nếu tạo bằng root, đặt chủ sở hữu UID 1000 và quyền `600` trước khi chạy. Container app không công khai cổng 8080 ra Internet; chỉ Caddy mở cổng 80/443. HTTPS cần DNS đúng và các cổng này thông suốt.

Nếu đã có reverse proxy, có thể chạy `npm start` phía sau HTTPS; chỉ mở máy chủ Node trên loopback hoặc mạng nội bộ. `PUBLIC_ORIGIN` phải đúng tên miền thực tế. Không bật tùy chọn bỏ qua kiểm tra tên miền.

## Dữ liệu và các tính năng cũ

- Sao lưu app cũ trước. Đăng nhập bản mới rồi dùng các nút phục hồi sao lưu hiện có để chuyển dữ liệu. Bản mới không tự đọc dữ liệu localStorage của website cũ.
- Ghi chú, sổ doanh số và cấu hình của app được lưu vào SQLite sau khi mã hóa AES-256-GCM bằng `DATA_KEY`. Thanh phía trên hiển thị trạng thái lưu. Khi lỗi hoặc xung đột thiết bị, sao lưu thao tác hiện tại trước khi tải lại.
- Tự hết phiên khi không thao tác trong 30 phút, giới hạn tuyệt đối 8 giờ. Đổi mật khẩu sẽ kết thúc toàn bộ phiên cũ. Nút đổi mật khẩu có ở thanh Admin.
- Khóa Warehouse lấy từ máy chủ, chỉ dùng đăng nhập API và đọc các resource đã chỉ định. Không hỗ trợ ghi/xóa dữ liệu Warehouse.
- Chỉ bảng giá đọc từ trang tính cũ qua máy chủ. Bộ proxy tùy ý vẫn từ chối Google; luồng đọc giá riêng chỉ nhận nguồn cấu hình, xác minh đúng spreadsheet và tab mới nhất. Danh mục, tồn, khách và đơn đọc trực tiếp Warehouse API.
- Đã nối giá Sheets với sản phẩm/tồn Warehouse bằng SKU chuẩn hóa, hoặc model khớp duy nhất. Mã không khớp không được đoán giá. Nếu bảng giá lỗi thì tồn và doanh số vẫn hoạt động; báo giá bị khóa cho tới khi đọc lại được giá. Khi cập nhật sẽ bỏ lựa chọn báo giá cũ.
- Đồng bộ Supabase cũ được ẩn và thay bằng lưu trữ bảo mật trên máy chủ. Các file sao lưu/báo cáo do bạn chủ động tải về vẫn có thể chứa dữ liệu nghiệp vụ rõ; quản lý chúng ở nơi riêng tư.
- Tổng đơn theo đại lý lấy đúng TotalAmount đầu đơn, kể cả đơn chờ phân loại sản phẩm. Đơn một sản phẩm dùng trọn số tiền đầu đơn. Đơn nhiều sản phẩm chỉ phân bổ khi chi tiết khớp và không có chiết khấu chưa rõ; không tự chia chiết khấu theo tỷ lệ. Đơn điều chỉnh/tiền không dương vẫn có trong tổng đơn, chờ quy tắc điều chỉnh chương trình.
- Danh sách đại lý và tổng đơn hiển thị 50 dòng/trang hoặc 50 kết quả theo tìm kiếm để tránh dựng hàng nghìn thẻ cùng lúc; số tổng/báo cáo vẫn tính toàn bộ.
- Tồn theo SKU: dùng ProductSku; chỉ khi thiếu mới đối chiếu ItemCode trùng danh mục SKU. Lấy bản cập nhật mới nhất; nếu trùng cùng mốc thì báo chưa rõ tồn, không cộng các dòng tùy ý.
- Giữ `DATA_KEY` khi chuyển máy hoặc phục hồi. Mất khóa này sẽ không giải mã được dữ liệu. Không sao lưu nó cùng nơi công khai với database. Khi sao lưu database đang chạy, dùng công cụ SQLite backup hoặc dừng dịch vụ trước để bảo đảm WAL nhất quán.

## Sửa code

- `source/legacy.html`: toàn bộ tính năng bán hàng/chương trình đang dùng.
- `source/client.js`: ánh xạ dữ liệu Warehouse và đối soát tiền.
- `api-transform.cjs`: chuyển các luồng dữ liệu cũ sang API và phân trang, không gọi Google.
- `server/warehouse-data.mjs`: đọc API, đối chiếu sản phẩm, chuẩn hóa tổng đơn và tồn kho.
- `build.cjs`: tạo `private/app.html` với cầu nối bảo mật. Sau khi sửa nguồn, chạy `npm run build`.
- `server/app.mjs`: xác thực, phiên, dữ liệu mã hóa, bộ đọc API.
- `public/`: chỉ màn hình đăng nhập và lớp bảo vệ phiên. Không có mật khẩu hoặc khóa API.

`server/app-code.txt` là bản TXT tương ứng để mở và copy mã máy chủ nếu cần. Toàn bộ ứng dụng cần nhiều tệp; không thể triển khai an toàn bằng cách chỉ dán một file HTML vào Pages.

## Kiểm tra

```sh
npm run build
npm test
```

Đã có 30 kiểm tra tự động, gồm bảo mật, cộng tổng đơn/VAT, tình huống Sheets không truy cập được và phân trang 1.000 đại lý. Đã đọc thật 8.859 đơn tháng 10 cho 2.468 đại lý; tổng tiền lưu trong ledger khớp tổng tiền đầu đơn. Danh mục API có 2.529 sản phẩm đủ tên/SKU để hiển thị, trong lần thử có 355 sản phẩm còn hàng. Có 3.491 đơn cần phân loại sản phẩm; tiền vẫn có trong tổng đơn. Các số này là ảnh chụp lần thử, thay đổi theo nguồn. Chưa triển khai tên miền/HTTPS thật; cấu hình mạng, chứng chỉ, quyền máy chủ, cơ chế sao lưu và quyền API Warehouse phải được xác minh tại nơi triển khai. Đây không phải chứng nhận kiểm toán độc lập hay cam kết an toàn tuyệt đối. Đọc thêm `SECURITY-REVIEW.md` trước khi dùng dữ liệu thật trên Internet.

Nguồn chính thức: [GitHub Pages chỉ lưu trang tĩnh](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [quản lý phiên OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [xác thực OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/), [HTTPS tự động của Caddy](https://caddyserver.com/docs/automatic-https).

Cấu hình giá khi chuyển máy chủ: điền `PRICE_SPREADSHEET_ID` và `PRICE_TABS_URL` vào `.env` riêng (địa chỉ Web app cũ, kết thúc /exec). Hai giá trị đã được cấu hình trên máy hiện tại, không đưa vào GitHub/ZIP. Bảng giá vẫn phải có quyền cho máy chủ đọc; cách nối này không làm trang tính vốn đang chia sẻ trở thành riêng tư. Nguồn chọn tab hiện báo Giá 30/10/2026; ngày trong từng dòng được giữ nguyên để đối chiếu.

## Màn hình doanh số mới

Bộ lọc dọc trái: chọn tỉnh cũ trước, khoảng ngày, tìm/nhóm/sắp xếp đại lý. Trung tâm: chương trình đang/sắp chạy, tiến độ đại lý; bảng đối chiếu đơn được thu gọn. Cột phải: chương trình đã kết thúc và bảng kết quả. Chưa có chương trình kết thúc thì cột phải báo trống, không tạo kết quả mẫu. Menu Công cụ chương trình ở đầu bộ lọc chứa Tạo chương trình, Gia hạn, Tiện ích & dữ liệu; các banner thương hiệu lớn đã ẩn, tài khoản nằm trong menu nhỏ.

Tạo chương trình hỗ trợ doanh số toàn bộ đơn, theo hãng hoặc từ khóa sản phẩm; đặt mục tiêu gồm VAT cho mỗi đại lý, khu vực, thời gian và phần thưởng. Loại theo sản phẩm/hãng chỉ tính dòng đã phân loại. Gia hạn giữ lịch sử và chuyển trạng thái theo thời gian. Chương trình mới lưu vào kho dữ liệu riêng của app, không ghi sang Warehouse. Báo cáo dựa trên dữ liệu đã tải; cần chọn đủ khoảng ngày của chương trình trước khi tổng kết.

Máy chủ lọc đơn theo mã khách thuộc tỉnh trước khi đọc chi tiết, cache tách theo tỉnh/kỳ/nhân viên. Snapshot khu vực không xóa dữ liệu tỉnh khác. Phản hồi cũ khi chuyển tỉnh nhanh bị bỏ qua. Lịch sử gợi ý cũng chờ chọn khu vực; backend từ chối tải lịch sử/snapshot không chỉ rõ khu vực.

## Gợi ý bán hàng và bản đồ Warehouse

Gợi ý bán hàng là tab riêng, chọn tỉnh cũ hoặc Tất cả khu vực ngay trong tab. Chưa chọn khu vực thì không tải lịch sử; không dùng bộ lọc Doanh số & chương trình. Tồn kho & chào hàng dùng toàn bộ chiều rộng.

Bản đồ tự tải toàn bộ danh mục khách Warehouse và tọa độ trang tính khi mở tab; không cần chọn tỉnh ở tab khác. Ghép chính xác theo mã khách (bỏ khoảng trắng đầu/cuối, không phân biệt hoa thường), không ghép theo tên. Chỉ tọa độ lấy từ MAP_CSV_URL; tuyệt đối bỏ qua cột doanh số trang tính. Mỗi mã Warehouse chỉ cộng một lần. Nhiều mã cùng tọa độ giữ nguyên, bấm điểm để xem danh sách. Khách chưa có tọa độ hợp lệ nằm ở Chưa định vị; mã tọa độ không khớp Warehouse nằm riêng, không tự gán tiền.

Doanh số dùng wh_sales_orders.TotalAmount đã có VAT, tất cả trạng thái theo quy tắc người dùng. Không đọc chi tiết hàng khi tính bản đồ. Mặc định từ ngày 01 tháng hiện tại tới hôm nay theo giờ Việt Nam. Chọn tháng, quý, 6 tháng đầu/cuối năm hoặc năm; kỳ lịch hiện tại kết thúc hôm nay, kỳ cũ lấy đủ kỳ. Kỳ dài đọc lần lượt từng tháng, dùng bộ nhớ đệm 2 phút. Có nút tải lại và bảng đối soát tổng = đã định vị + chưa định vị + đơn chưa khớp danh mục khách. Số âm vẫn trong tổng, điểm có tiền không dương hiển thị xám. Lỗi nguồn không lấy số trang tính thay thế.

Giữ kho, bán kính, khoanh vùng, lộ trình, nhãn, xuất Excel/cài đặt và 708 ranh giới huyện cũ từ code cung cấp. Lớp OSM có tên đường và lớp chú thích tỉnh/huyện cũ riêng; dịch vụ ảnh không phản hồi thì chuyển nền hành chính cũ. Không có cam kết mọi mức zoom luôn đầy đủ tên đường hoặc dữ liệu hành chính cập nhật.

Địa chỉ CSV cấu hình riêng bằng MAP_CSV_URL trong .env, không đưa GitHub/ZIP. Giá vẫn từ trang tính cũ theo D/E/F. Các trang tính đã publish vẫn có quyền chia sẻ hiện hữu; ứng dụng không tự thay đổi quyền đó.

Tìm ranh giới/tính đường sử dụng Nominatim, OSRM hoặc Valhalla theo chức năng được bấm; tọa độ truy vấn gửi tới dịch vụ đó, không gửi khóa Warehouse hay danh sách tên khách. Nền ảnh gửi vị trí ô bản đồ tới OSM/Esri. Riêng trang bản đồ dùng strict-origin-when-cross-origin để đáp ứng chính sách ảnh OSM; API còn giữ no-referrer. Bản đồ dùng chung đăng nhập Admin và kho cài đặt mã hóa.
