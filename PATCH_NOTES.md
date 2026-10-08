# StudyOS — Performance Patch (08/10/2026)

## Đã thay đổi

- `src/app/(workspace)/layout.tsx`: giữ Workspace ở layout bảo vệ dùng chung giữa các section.
- `src/app/(workspace)/[section]/page.tsx`: kiểm tra section hợp lệ; UI không còn remount theo từng page.
- `src/components/workspace.tsx`: điều hướng sidebar client-side bằng Next-integrated History API, lazy-load views và áp dụng kết quả đột biến vào state hiện có.
- `src/app/api/data/route.ts`: trả record mới của habit/log/profile, trả duy nhất session và segments vừa cập nhật từ focus/session; không GET tất cả bảng sau từng thao tác.
- `src/lib/workspace-data.ts`: reducer thuần cho các thay đổi đã được Supabase xác nhận; xóa habit và study session dọn dữ liệu con khỏi cache.
- `tests/workspace-data.test.ts`: kiểm thử reducer.
- `tests/e2e/smoke.spec.ts`: bổ sung bài kiểm thử số lượng request khi chuyển section bằng tài khoản thử nghiệm.

**Không đổi database schema, migrations, URL, project Supabase, environment variables hay logic xác thực.**

## Đã kiểm tra trong môi trường chuẩn bị patch

- TypeScript/TSX **syntax transpilation**: PASS, 30 files. Không tương đương `tsc --noEmit`.
- Reducer runtime smoke tests: PASS, 7/7.
- API contract mock smoke tests: PASS, 5/5 (mocked Supabase + mocked NextResponse, không phải database thật).
- Kiểm tra package manifest / migration giữ nguyên.

## Chưa kiểm tra được

- `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, Playwright E2E, và Vercel production runtime. Lý do: môi trường patch không truy cập được npm registry, không có node_modules.
- Chưa đo trực tiếp tốc độ / Web Vitals khi đăng nhập tại Vercel. Không cam kết một mức thời gian phản hồi cụ thể.

## Kiểm tra lại trước khi deploy

Tại thư mục chứa `package.json`:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Với tài khoản test Supabase:

```bash
E2E_EMAIL=your-test-email E2E_PASSWORD=your-test-password pnpm test:e2e
```

Nếu có thể, mở Chrome DevTools → Network → Fetch/XHR → chuyển `Dashboard → Habits → Study → Dashboard` và kiểm tra **không có GET `/api/data` mới** trong lúc chuyển section. POST update habit/log phải trả row vừa thay đổi. POST focus/session trả `studyPatch` với session và segments của session đó.

## Cập nhật website Vercel

1. Backup repo đang sử dụng, sau đó chép các file từ ZIP này **vào repo hiện tại** (thay các file tương ứng). Không upload file `.env.local`.
2. Commit và push vào nhánh GitHub đang liên kết với Vercel.
3. Chờ Vercel build và trạng thái Ready, mở domain StudyOS và xác minh thao tác đăng nhập, habit, timer, điều hướng, refresh, sign out.
4. Không chạy lại migration tạo bảng của MVP nếu database đã có các bảng, vì bản patch không đổi schema.

Đường dẫn Vercel hiện tại vẫn dùng được sau khi deploy phiên bản mã nguồn mới qua repo đã liên kết; ZIP này **chưa** tự động cập nhật website đang chạy.
