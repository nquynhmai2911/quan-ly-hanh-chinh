# Quy trình và kiểm thử cục bộ

## Văn bản đến

| Bước | Người được thao tác | Dữ liệu phải lưu |
| --- | --- | --- |
| Nộp trực tuyến | Người dân, hoặc quản trị viên hỗ trợ | Mã hồ sơ duy nhất, người nộp, thông tin liên hệ và toàn bộ tệp gốc |
| Tiếp nhận, vào sổ | Văn thư | Sổ, số đến, năm, ngày tiếp nhận, người tiếp nhận |
| Trình lãnh đạo | Văn thư | Lãnh đạo cụ thể; cần số đến và tệp gốc |
| Bút phê, phân phối | Lãnh đạo được chọn | Ý kiến chỉ đạo, phòng ban và trưởng phòng cụ thể, hạn xử lý nếu có |
| Phân công | Trưởng phòng được giao | Cán bộ trong phòng được giao; đúng một chủ trì, có thể thêm phối hợp và nhận để biết |
| Báo cáo | Cán bộ chủ trì/phối hợp được phân công | Báo cáo của chính người đăng nhập; người nhận để biết không được báo cáo |
| Trình duyệt kết thúc | Chủ trì hoặc trưởng phòng phụ trách | Tất cả người chủ trì/phối hợp phải báo cáo |
| Duyệt hoặc yêu cầu làm lại | Trưởng phòng phụ trách | Quyết định, lý do trả lại; hoàn thành sẽ khóa hồ sơ |

Quản trị viên hỗ trợ thao tác nhưng vẫn phải tuân thủ trạng thái, tệp và các điều kiện nghiệp vụ. Lãnh đạo có thể trả lại văn thư; trưởng phòng có thể trả lại lãnh đạo trước khi phân công. Khi báo cáo bị trả lại, các cán bộ chủ trì/phối hợp phải nộp lại trước khi trình duyệt.

Danh sách, chi tiết, tra cứu, tệp, thông báo và bàn làm việc dùng người nhận thực tế để kiểm tra quyền. Người dân chỉ xem hồ sơ của mình. Các thao tác thay đổi văn bản được khóa và kiểm tra trong giao dịch cơ sở dữ liệu, rồi mới ghi trạng thái, lịch sử và thông báo.

Hồ sơ cũ đã chuyển bước nhưng chưa có người nhận và nhiệm vụ có nút **Trả lại văn thư** cho quản trị viên, bắt buộc ghi lý do. Sau đó văn thư bổ sung tệp và trình lại theo quy trình. Không tự suy đoán người nhận hay ghép các tệp tải lên cũ vào hồ sơ.

## Tệp đính kèm

Tải tệp tạo bản ghi chờ có chủ sở hữu và hạn dùng 24 giờ. Khi nộp hồ sơ, máy chủ đối chiếu người tải, dung lượng và mã băm nội dung, rồi gắn tệp vào hồ sơ trong cùng giao dịch. Tệp đã sử dụng không thể bị lấy sang hồ sơ khác bằng mã tải lên. Nếu tải hoặc lưu thất bại, giao diện giữ lỗi và không báo nộp thành công.

Dịch vụ công hỗ trợ 1–10 tệp, tối đa 25 MB mỗi tệp theo cấu hình mặc định. Có danh sách hồ sơ đã nộp và các tệp sau khi tải lại trang. PDF và ảnh xem trực tiếp; tài liệu Word/bảng tính tải về để mở bằng ứng dụng phù hợp. Không sinh PDF thay thế khi thiếu tệp gốc.

## Các phần liên quan

- Bàn làm việc gồm nhiệm vụ được giao và các văn bản đang đến lượt người đăng nhập.
- Nhật ký hiển thị tên thao tác tiếng Việt; ghi đúng tài khoản đã thực hiện.
- Thống kê, xuất sổ và danh mục đọc dữ liệu thật; lỗi cơ sở dữ liệu không được thay bằng dữ liệu mẫu.
- Xuất sổ lọc theo năm đã cấp số và quyền truy cập; năm trống chỉ xuất tiêu đề cột.
- Văn bản đi gắn tệp tải lên vào dự thảo, ghi chuỗi duyệt, cập nhật bước duyệt và phê duyệt điện tử trong cùng giao dịch. Phê duyệt ở đây là ghi nhận tài khoản và mã băm tệp, chưa phải chữ ký số từ thiết bị hoặc nhà cung cấp chứng thư số.

## Khởi động và kiểm thử

```sh
npm ci
# Tạo .env từ .env.example nếu chưa có; đặt URL ứng dụng về cổng 3001.
node scripts/start-db.mjs
# Trong cửa sổ khác:
npx prisma db push
npm run db:seed
npm run dev -- --hostname 127.0.0.1
# Khi máy chủ đã chạy, trong cửa sổ khác:
npm run test:workflow
npx tsc --noEmit
```

Các kiểm thử dùng tài khoản local trong README, tạo hồ sơ/người dùng kiểm thử riêng và dọn chúng sau khi chạy. Chỉ chạy trên cơ sở dữ liệu phát triển. Số văn bản đã cấp trong kiểm thử không bị tái sử dụng. Có thể đặt `TEST_BASE_URL` để đổi địa chỉ máy chủ kiểm thử.

`tests/incoming-workflow.mjs` kiểm tra quyền từng vai trò, người khác cùng vai trò, phòng ban, tệp gốc, đường trả lại, báo cáo phối hợp, yêu cầu làm lại, khóa hoàn thành và hai yêu cầu phân công đồng thời.

`tests/other-modules.mjs` kiểm tra quyền quản trị, thống kê/xuất sổ trống, tra cứu nhật ký, lưu trữ, bàn làm việc và chuỗi văn bản đi từ dự thảo tới ban hành.
