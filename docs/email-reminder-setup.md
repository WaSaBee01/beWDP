## Hướng dẫn cấu hình email reminder

### 1. Tổng quan
- Scheduler sử dụng `node-cron` để mỗi tối (mặc định 21:00 `Asia/Ho_Chi_Minh`) quét trước `REMINDER_LOOKAHEAD_DAYS` để tạo `setTimeout` gửi mail nhắc nhở.
- Khi người dùng thêm/cập nhật/xóa ngày tiến trình hoặc apply plan, API sẽ gọi `refreshRemindersForDate` để cập nhật lại lịch gửi ngay.
- Mail gửi trước giờ ăn/tập theo offset cấu hình (`MEAL_REMINDER_OFFSET_MINUTES`, `EXERCISE_REMINDER_OFFSET_MINUTES`).

### 2. Chuẩn bị `.env`
1. Sao chép `backend/env.example` thành `backend/.env`.
2. Điền các giá trị:
   - **MongoDB**: `MONGODB_URI`.
   - **JWT**: `JWT_SECRET`, `JWT_EXPIRES_IN`.
   - **OAuth Google**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
   - **Cloudinary**: `CLOUDINARY_*`.
   - **PayOS**: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
   - **SMTP** (bắt buộc để gửi mail):
     - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (true nếu port 465).
     - `SMTP_USER`, `SMTP_PASS` (app-password đối với Gmail/Workspace).
     - `SMTP_FROM` (chuỗi hiển thị, ví dụ `"GymNet <no-reply@gymnet.app>"`).
   - **Reminder options** (có thể để mặc định):
     - `REMINDER_TIMEZONE`
     - `NIGHTLY_REMINDER_CRON`
     - `REMINDER_LOOKAHEAD_DAYS`
     - `MEAL_REMINDER_OFFSET_MINUTES`
     - `EXERCISE_REMINDER_OFFSET_MINUTES`
    - `LOCAL_TIMEZONE_OFFSET_MINUTES` (phút lệch UTC của giờ địa phương, mặc định 420 cho GMT+7)

### 3. Lấy SMTP/App password
- **Gmail / Google Workspace**
  1. Bật 2FA.
  2. Security → App passwords → chọn App: Mail, Device: Other → đặt tên → tạo → copy 16 ký tự vào `SMTP_PASS`.
  3. Host: `smtp.gmail.com`, Port: `465`, Secure: `true`, User: địa chỉ Gmail.
- **SendGrid**
  1. Settings → API Keys → Create API Key (Full Access hoặc Mail Send).
  2. Host: `smtp.sendgrid.net`, Port: `465`/`587`, User: `apikey`, Pass: chính API key.
- **Brevo/Elastic Email** tương tự (dùng host/port do nhà cung cấp cung cấp).

### 4. Khởi chạy backend
```bash
cd backend
npm install
npm run dev
```
Log sẽ hiển thị:
- `📧 Reminder scheduler initialized`: cron đã đăng ký.
- Lỗi SMTP sẽ xuất hiện ngay khi tới giờ gửi mail → kiểm tra biến môi trường.

### 5. Kiểm thử thủ công
1. Đảm bảo có user với email thật.
2. Trong giao diện Progress, áp dụng plan hoặc thêm bữa ăn/bài tập cho ngày hôm sau.
3. Kiểm tra log server xem có dòng `[ReminderScheduler]` và chờ mail tới trước giờ theo offset.
4. Thử chỉnh sửa/xóa ngày để chắc chắn scheduler refresh (không còn gửi mail cũ).

### 6. Tùy chỉnh và lưu ý
- `NIGHTLY_REMINDER_CRON`: định dạng chuẩn cron 5 trường (phút giờ ngày tháng thứ). Ví dụ gửi lúc 20:30 hằng ngày: `30 20 * * *`.
- `LOCAL_TIMEZONE_OFFSET_MINUTES`: nếu deploy ở múi giờ khác, cập nhật theo phút lệch UTC (ví dụ GMT+8 => 480).
- Nếu deploy nhiều instance, cân nhắc chỉ cho 1 instance chạy cron (dùng cờ env `RUN_REMINDER_SCHEDULER=true` và kiểm tra trước khi gọi `initReminderScheduler`).
- Scheduler sử dụng `setTimeout` trong RAM -> khi server restart phải khởi động lại để tái tạo lịch (đã được gọi trong `server.ts`).
- Không nên đặt offset âm. Nếu offset lớn hơn thời gian thực, scheduler sẽ bỏ qua do `reminderTime <= now`.

### 7. Troubleshoot nhanh
- **Không gửi mail**: kiểm tra SMTP logs, firewall, chính xác port/secure, tài khoản bị chặn (gmail: kiểm tra “Less secure apps”/App password).
- **Sai giờ gửi**: xác nhận timezone server + `REMINDER_TIMEZONE`. Scheduler dùng UTC nội bộ và convert timezone cho cron.
- **Spam/quá nhiều mail**: tăng `REMINDER_LOOKAHEAD_DAYS` và offset hoặc thêm logic group mail (tùy nhu cầu).

