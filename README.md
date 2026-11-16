# Sky-Island Homestead · Vườn Trên Mây

Web game nông trại cozy 2D, chơi bất đồng bộ với React + TypeScript + Vite. Supabase cung cấp đăng nhập, PostgreSQL/RPC và Realtime.

## Bắt đầu

1. Mở project Supabase `hrpwjetowibwrgzgdbzs` và chọn **SQL Editor → New query**.
2. Chạy toàn bộ file `supabase_setup.sql`. File tạo bảng, RLS, trigger tạo hồ sơ/nông trại và các hàm RPC cho gameplay. Có thể chạy lại để cập nhật policies, functions và trigger.
3. Cài Node.js LTS nếu máy chưa có, mở terminal tại thư mục `FunFarm` và chạy:

   ```powershell
   npm install
   npm run dev
   ```

4. Mở địa chỉ Vite hiện trong terminal. Đăng ký chỉ cần username và password; username được chuẩn hóa thành chữ thường, bỏ khoảng trắng, chỉ nhận chữ cái và chữ số. Auth ghép email nội bộ dạng `username@skyfarm.local`.

Thông tin Supabase anon key là khóa công khai dành cho frontend; bảo mật dữ liệu dựa vào RLS và kiểm tra quyền trong RPC. Không đưa `service_role` key vào trình duyệt.

## Core loop

- Nông trại mở đầu có 16 ô trong lưới 4×4; có thể mở khóa tuần tự tới 36 ô. Ô tiếp theo tốn 50 vàng, các ô sau tăng 25 vàng mỗi ô.
- Bốn hạt giống, thời gian lớn, giá mua/bán và EXP theo đúng danh sách trong yêu cầu.
- Bấm ô đất trống để chọn hạt giống. Bấm cây đang lớn để tưới một lần, giảm 20% thời gian tổng. Bấm cây chín để thu hoạch.
- Thu hoạch thường nhận 2 nông sản; nếu có người hái trộm thì chủ đảo nhận 1.
- Bản đồ hiển thị tài khoản khác, cấp độ, vàng và Supabase Presence. Vào đảo khác có thể tưới hộ (+10 vàng, +5 EXP), hái cây chín một lần hoặc để lại lời nhắn.
- Nước đi quan trọng gọi PostgreSQL RPC qua session JWT; trình duyệt không tự quyết định giá, thời gian lớn, phần thưởng, quyền sở hữu hay trạng thái trưởng thành.
- Realtime Postgres Changes theo dõi `plots` và `guestbook` của đảo đang xem; Presence theo dõi người chơi đang online. Web Audio API tạo hiệu ứng gieo, tưới, thu hoạch và nhận vàng, không cần file âm thanh ngoài.

## GitHub Pages

1. Đẩy project lên GitHub và tạo repository.
2. Cập nhật `homepage`/base nếu muốn dùng đường dẫn đặc biệt (hiện Vite dùng base tương đối `./`, phù hợp trang project).
3. Chạy build, sau đó deploy thư mục `dist` bằng workflow GitHub Pages hoặc `npm run deploy` (script dùng `gh-pages`).
4. `.env` hiện chứa Supabase URL và anon key theo cấu hình được cung cấp. Nếu build trong CI, thêm hai biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` vào GitHub Actions Variables; không thêm `service_role` key.

## Các bảng và quyền

- `profiles`: tên, vàng, EXP, level; người chơi đăng nhập đọc hồ sơ công khai để xem bản đồ.
- `inventories`: số lượng hạt giống/nông sản; chỉ chủ tài khoản được SELECT.
- `plots`: tối đa 36 ô đất mỗi đảo; người chơi đăng nhập đọc đảo công khai, thay đổi chỉ qua RPC.
- `guestbook`: lưu tin nhắn, hành động tưới và hái trộm; người chơi đọc được nhật ký đảo, chỉ RPC mới ghi.
- Trigger `sky_on_auth_user_created` đánh dấu email nội bộ đã xác nhận, tạo profile, 100 vàng, 5 hạt wheat và 36 hàng đất (16 hàng mở khóa).
- `plant_seed`, `water_plot`, `harvest_crop`, `steal_crop`, `buy_seed`, `sell_crop`, `unlock_plot`, `leave_message` xác thực `auth.uid()` và thực hiện nghiệp vụ trên server trong transaction.

## Cấu trúc chính

```text
FunFarm/
├── supabase_setup.sql
├── src/
│   ├── App.tsx
│   ├── lib/supabase.ts
│   ├── types/game.ts
│   └── components/
│       ├── Auth.tsx
│       ├── FarmGrid.tsx
│       ├── ShopInventory.tsx
│       ├── NeighborList.tsx
│       └── Guestbook.tsx
└── package.json
```
