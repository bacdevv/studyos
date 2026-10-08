# StudyOS — Functional MVP

Ứng dụng học tập cá nhân với Next.js 16.4.0, React 19.3.0, TypeScript strict, Tailwind CSS 4, Radix UI/shadcn-style components và Supabase PostgreSQL/Auth.

## Phạm vi bản này

Đã triển khai Phase 1–2: xác thực, habit tùy chỉnh, nhật ký habit, phiên học thủ công và focus timer, dashboard tính từ dữ liệu lưu trong database. Bổ sung analytics, lịch hoạt động, theme/timezone và export để MVP dùng được hằng ngày.

- Đăng ký, xác nhận email, đăng nhập/đăng xuất, quên mật khẩu và đổi mật khẩu qua email.
- Route được bảo vệ ở server; cookies được refresh qua `src/proxy.ts` và `getClaims()`; API kiểm tra `getUser()`.
- Habit checkbox, số, thời lượng và số đo cá nhân; ngày trong tuần; mục tiêu/đơn vị; tạo/sửa/xóa/archive/restore/move-first.
- Nhập theo ngày, mặc định hôm nay theo timezone profile; log duy nhất cho mỗi habit/ngày.
- Focus start/pause/resume/finish lưu ở server; refresh không làm mất bộ đếm.
- Phiên thủ công tối đa 24 giờ; chỉnh sửa/xóa; database từ chối khoảng thời gian chồng lấn.
- Dashboard, khoảng ngày tùy chỉnh, biểu đồ, heatmap tháng, streak, mục tiêu học tuần và lịch sử.
- Theme sáng/tối/system; timezone; export JSON toàn bộ dữ liệu và CSV habit.
- Responsive sidebar, dialog có focus trap, xác nhận xóa, trạng thái loading/error/saving.

Chưa triển khai Phase 3: Courses/Lessons, Books/Reading, Goals/Tasks. CSV import với mapping/preview và xóa toàn bộ tài khoản cũng chưa triển khai. Không có menu giả dẫn tới các tính năng này. Không tuyên bố bản MVP là toàn bộ 10 module hoặc đã sẵn sàng production khi chưa kiểm tra Supabase thật.

## Chạy ngay

Yêu cầu Node.js 24 và pnpm 11.25.0.

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
```

Bản ZIP cá nhân có `.env.local` chứa project URL và publishable key bạn đã cung cấp. Hai giá trị này dùng cho client Supabase; không có service-role key. `.gitignore` loại trừ `.env.local`. Nếu dùng source không có file này:

```bash
cp .env.example .env.local
```

Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` bằng project của bạn.

### Tạo database — bắt buộc một lần

1. Mở Supabase Dashboard → project → SQL Editor → New query.
2. Dán **toàn bộ** `supabase/migrations/202610080001_studyos.sql`.
3. Nhấn Run. Script nằm trong một transaction: hoặc áp dụng toàn bộ hoặc rollback.
4. Đây là migration khởi tạo cho schema mới; không chạy lặp lại trên schema đã tồn tại.

Publishable key không có quyền tạo schema. Khi kiểm tra dự án được cung cấp, REST API phản hồi `PGRST205: public.habits not found`; migration chưa được áp dụng vào dự án thật.

### Cấu hình Auth

Trong Authentication → URL Configuration:

- Site URL cho local: `http://localhost:3000`.
- Redirect URLs: `http://localhost:3000/auth/callback` và `http://localhost:3000/auth/callback?next=/auth/reset`.
- Sau khi deploy, thêm cùng hai URL với domain HTTPS thật và đổi Site URL sang domain đó.
- Bật Email provider và giữ xác nhận email. Dùng email hợp lệ mà bạn kiểm soát.
- Nếu Supabase báo giới hạn gửi email hoặc recipient không được phép, cấu hình SMTP riêng phù hợp trước khi mở đăng ký rộng rãi; không coi UI thành công là bằng chứng thư đã được nhận.
- Giữ email templates hỗ trợ redirect PKCE của Supabase; callback đổi `code` thành session. Link reset cần được mở trong browser đã yêu cầu reset.

```bash
pnpm dev
```

Mở `http://localhost:3000`, tạo tài khoản, xác nhận email và đăng nhập. Dashboard ban đầu trống có chủ đích.

## Kiến trúc và nơi đọc code

| Đường dẫn | Vai trò |
|---|---|
| `src/app/(workspace)` | Server kiểm tra đăng nhập, route màn hình |
| `src/app/api/data/route.ts` | API đọc dữ liệu, xác thực và validate mutation |
| `src/lib/supabase` | Client SSR/browser có type Database |
| `src/proxy.ts` | Refresh cookie session theo Next.js 16 |
| `src/lib/validation.ts` | Zod schemas ở server và form |
| `src/lib/analytics.ts` | Công thức thuần, kiểm thử độc lập |
| `src/features` | Habits, study, dashboard, history, settings |
| `src/components/ui` | Dialog/alert-dialog dựa trên Radix |
| `supabase/migrations` | Schema, constraints, indexes, RLS, RPC |
| `tests` | Unit, PostgreSQL/RLS integration, Playwright |

Luồng ghi: form → same-origin API → `getUser()` → Zod → Supabase với JWT của người dùng → RLS/constraints. Không có service-role client. Habit definitions và habit logs tách riêng. Sessions chứa metadata/trạng thái; segments chứa từng khoảng thực học, không chứa pause. Calendar và dashboard dùng cùng nguồn dữ liệu.

`profiles.id` là khóa ngoại tới Auth user. Mỗi bảng còn lại có `user_id` và RLS owner. Foreign key `(habit_id,user_id)` và `(session_id,user_id)` ngăn gắn bản ghi con vào dữ liệu người khác. RPC chạy SECURITY INVOKER; transaction và advisory lock theo user giúp serialize timer từ nhiều tab. Exclusion constraint trên khoảng thời gian ngăn tính trùng.

Types hiện được khai báo thủ công khớp migration trong `src/types/models.ts`. Khi mở rộng schema nên sinh lại type bằng Supabase CLI (`supabase gen types typescript --project-id YOUR_PROJECT_ID`) và đối chiếu các domain types.

## Định nghĩa chỉ số

- **Study hours**: tổng độ dài giao giữa segments đã lưu và ngày trong timezone profile, chia 60 thành giờ. Phần đang chạy chỉ được ghi khi pause/finish và chưa cộng vào dashboard.
- **Study streak**: chuỗi ngày có ít nhất 1 phút học. Hôm nay chưa học thì tính lùi từ hôm qua.
- **Habit completion**: số log đạt target / số habit được lên lịch trong khoảng ngày. Không có log = chưa hoàn thành; bỏ qua ngày trước start_date và số đo cá nhân.
- **Habit streak**: bỏ qua ngày không lên lịch; hôm nay chưa hoàn thành chưa làm đứt streak.
- **Weekly goal**: thứ Hai đến hôm nay theo timezone profile.
- **Measurement**: lưu số và đơn vị; không cộng vào điểm completion, không diễn giải y khoa.
- Đổi lịch/target hoặc archive habit sẽ tính lại lịch sử theo cấu hình hiện tại. Chưa có version lịch biểu theo thời gian; các log gốc vẫn còn.
- Đổi timezone tính lại ranh giới ngày của study segments. Habit logs là ngày người dùng đã chọn và không tự dịch ngày.

## Những giới hạn cần biết

- Một focus đang mở mỗi user. Khi còn focus mở, phải finish trước khi tạo/sửa phiên thủ công.
- Đóng browser không pause timer. Một khoảng chạy bị giới hạn 24 giờ khi lưu, tránh log vô hạn khi quên timer. Có thể sửa/xóa sau khi finish.
- Sửa phiên focus nhiều segment thay thế bằng một khoảng thủ công; dialog cảnh báo rõ rằng phải loại thời gian pause khi nhập.
- Lần tải lấy dữ liệu owner theo từng trang 1.000 dòng để không bị cắt mặc định. Phù hợp MVP cá nhân; với nhiều năm dữ liệu nên chuyển aggregates/filtering sang SQL và phân trang từng màn hình.
- Không có realtime cross-device subscription. Điều hướng hoặc refresh để nhận cập nhật từ thiết bị khác.
- Dùng duration habit với một đơn vị nhất quán do bạn chọn, ví dụ minutes. App không tự chuyển minutes/hours.
- Không hỗ trợ offline sync. Docker web vẫn cần Supabase qua mạng.

## Kiểm thử

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm test` gồm 15 bài tính toán/validation và 9 bài PostgreSQL tích hợp. PGlite thực thi **migration thật**, mô phỏng `auth.uid()` và roles Supabase để kiểm tra owner isolation, forged ownership, foreign keys, uniqueness, overlap, rollback và focus transitions. Nó không kiểm tra cấu hình Auth/SMTP/RLS đã triển khai trên Supabase thật.

Playwright gồm 2 smoke tests × desktop/mobile. Để bật bài lifecycle trên tài khoản Supabase thật, tạo một tài khoản thử nghiệm đã xác nhận email, chạy migration và đặt `E2E_EMAIL`, `E2E_PASSWORD` trong môi trường terminal. Không dùng tài khoản chứa dữ liệu quan trọng; bài này tạo/xóa habit và tạo một phiên focus ngắn.

```bash
E2E_EMAIL=your-test-email E2E_PASSWORD=your-test-password pnpm test:e2e
```

PowerShell: đặt `$env:E2E_EMAIL` và `$env:E2E_PASSWORD` trước khi chạy. Không commit thông tin này.

Đã chạy trong môi trường xây dựng: typecheck, lint, production build, 24 tests và 4 browser smoke tests qua. 2 browser lifecycle tests skip vì thiếu tài khoản thử nghiệm và schema thật. Docker chưa chạy do môi trường không có Docker engine. Xem `VALIDATION.md` để biết kết quả cuối cùng.

## Docker với managed Supabase

```bash
docker compose --env-file .env.local up --build -d
```

Web mở tại `http://localhost:3000`. Biến `NEXT_PUBLIC_*` được đưa vào build; đổi project/key cần rebuild image. Container chạy non-root và dùng Next standalone. Database/auth vẫn là managed Supabase, không phải môi trường offline.

```bash
docker compose down
```

Muốn stack database local đầy đủ: cài Supabase CLI + Docker theo tài liệu chính thức, `supabase init`, `supabase start`, dùng URL/key được CLI trả về và áp migration bằng `supabase db reset` **chỉ trên database local**. Không chạy reset vào database có dữ liệu cần giữ. Bản này không đóng gói toàn bộ stack Supabase vào Compose.

## Deploy lên Vercel

1. Tạo repository GitHub và push source; `.env.local` không vào Git.
2. Import repository vào Vercel, chọn framework Next.js, Node 24. Root directory là thư mục chứa `package.json`.
3. Install command: `pnpm install --frozen-lockfile`; Build: `pnpm build`; output để mặc định Next.js.
4. Thêm hai biến môi trường Supabase cho Production/Preview cần dùng, rồi deploy.
5. Cập nhật Site URL và Redirect URLs trên Supabase đúng HTTPS domain đã cấp.
6. Kiểm tra đăng ký/xác nhận email, đăng nhập, reset password, tạo habit, log hôm nay, log phiên học, refresh, sửa/xóa và sign-out/sign-in.
7. Kiểm tra hai tài khoản thật không đọc được dữ liệu nhau. Không bật RLS-off để chữa lỗi truy cập.

Chưa deploy lên Vercel vì chưa có tài khoản/deployment integration được cung cấp. Không có URL production trong bản giao này.

### Free tier

Kiểm tra tài liệu chính thức ngày 2026-10-08:

- Vercel Hobby dành cho dự án cá nhân phi thương mại; có quota tài nguyên, chạm giới hạn có thể phải đợi reset. Không kích hoạt Pro trial để chạy ứng dụng này.
- Supabase Free: 500 MB database, 5 GB egress, 1 GB storage; project có thể pause sau một tuần không hoạt động; không gồm automatic backups. Export định kỳ nếu dùng làm dữ liệu chính.

Nguồn: https://vercel.com/docs/plans/hobby và https://supabase.com/pricing. Các quota có thể thay đổi; kiểm tra dashboard trước khi mở rộng.

## Bước tiếp theo

Sau khi migration và acceptance flow thật qua: Course + Lessons → Books + Reading logs → Goals/Tasks → CSV import (mapping, preview, duplicate detection, confirmation) → account deletion. Giữ schema normalized và mở rộng feature theo từng mốc chạy được.
#   s t u d y o s  
 