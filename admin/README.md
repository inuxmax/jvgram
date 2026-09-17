# Telegram Air Admin

Next.js + MongoDB trên **một cổng 3000**. Người đăng ký đầu tiên là admin; sau đó không còn đăng ký.

## Chạy

1. Cài [MongoDB](https://www.mongodb.com/try/download/community) local, hoặc dùng Atlas.
2. Copy env:

```
copy .env.example .env.local
```

3. Sửa `MONGODB_URI` nếu cần, rồi:

```
cd admin
npm run dev
```

Mở http://localhost:3000

- Lần đầu: `/setup` tạo admin
- Các lần sau: chỉ `/login`
- API health: `GET /api/health`

JSON API (cookie session sau login):

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/auth/status` | Đăng ký còn mở? |
| POST | `/api/auth/setup` | Tạo admin đầu tiên |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Đăng xuất |
| GET/POST/DELETE | `/api/usernames` | Quản lý username |
| GET/POST/PATCH/DELETE | `/api/upgrades` | Gói nâng cấp |
| POST | `/api/telegram/login` | Telegram Air gửi user khi đăng nhập |

Từ root repo: `npm run admin:dev`
