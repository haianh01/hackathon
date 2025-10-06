HACKATHON DEV DOCUMENT - 2025

Tài liệu này mô tả những file đội thi cần chuẩn bị và giao thức socket giữa Bot và server cho môi trường thi đấu.

## Các mục cần đội chơi chuẩn bị
1. `Dockerfile` (*) — Dockerfile hỗ trợ chạy bot đã được build (nên dùng multi-stage nếu dự án cần build như TypeScript).
2. File `.env` — BTC sẽ cập nhật biến `SOCKET_SERVER` khi vào thi đấu.

Ví dụ file `.env` (đặt tên `.env` trong gói nộp):

```
# Sẽ được sửa bởi BTC khi thi đấu
SOCKET_SERVER=SOCKET_SERVER:PORT
PORT=3000
```

3. `docker-compose.yml` — Ví dụ cấu hình bao gồm service `bot`:

```yaml
version: '3.8'

services:
  bot:
    build:
      context: .
      dockerfile: Dockerfile
    env_file:
      - .env
    deploy:
      mode: replicated
      replicas: 1
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 250M
```

Lệnh chạy/ dừng bot (local / trình diễn):

```bash
# build image và khởi động service
docker compose up -d --build bot

# dừng service
docker compose stop bot
```

(*) Tùy ngôn ngữ: teams chuẩn bị Dockerfile tương ứng (Node/Python/Go/Java etc.).

---

## Lưu ý chung về môi trường
Có 2 loại môi trường:
- Môi trường luyện tập: kiểu chơi hồi sinh — game kéo 5 phút, bot bị hạ gục sẽ được hồi sinh; sau 5 phút map reset.
- Môi trường thi đấu: kiểu sinh tồn — bot bị hạ gục sẽ bị loại khỏi trận; bot chỉ bắt đầu hoạt động sau sự kiện `start` và nhận `finish` khi trận kết thúc.

Lưu ý: code nộp cho BTC PHẢI LÀ code cho MÔI TRƯỜNG THI ĐẤU.

Trận đấu kết thúc khi thỏa một trong hai: hết 5 phút hoặc chỉ còn 1 bot.

---

## Giao thức sự kiện (Socket)
Các event bot gửi và nhận là JSON/Plain objects qua socket.io (hoặc websocket tương đương).

### 1) Kết nối / Đăng nhập
Khi kết nối, bot gửi token để xác thực:

```js
const auth = { token: YOUR_TOKEN };
const socket = io(SOCKET_SERVER_ADDR, { auth });
```

Payload:
- token: token do BTC cung cấp

### 2) Tham gia phòng
- Event (bot -> server): `join`
- Data: `{}`

### 3) Di chuyển
- Event (bot -> server): `move`
- Data: `{ orient: 'UP'|'DOWN'|'LEFT'|'RIGHT' }`

### 4) Đặt bom
- Event (bot -> server): `place_bomb`
- Data: `{}` (bom đặt dựa trên vị trí hiện tại của bot)

---

## Các event server gửi cho bot

### A) `user` — initial state khi bot join
Response data (ví dụ):

```json
{
  "map": [
    ["W","C",null],
    ["W","C",null]
  ],
  "bombers": [
    {
      "x": 568,
      "y": 568,
      "speed": 1,
      "type": 1,
      "uid": "1sEo7KS7efpHtJViAAAB",
      "orient": "UP",
      "isAlive": true,
      "size": 35,
      "name": "zarenabot",
      "movable": true,
      "score": 0,
      "color": 1,
      "explosionRange": 2,
      "bombCount": 1,
      "speedCount": 0
    }
  ],
  "bombs": [ { "x":599.5, "y":33.5, "uid":"UID", "id":691 } ],
  "chests": [ { "x":80, "y":160, "size":40, "type":"C", "isDestroyed":false } ],
  "items": [ { "x":40, "y":160, "type":"SPEED", "size":8, "isCollected":false } ]
}
```

Ghi chú trường quan trọng trong `bombers`:
- x, y: tọa độ
- uid: UID duy nhất của bot (dùng làm id)
- orient: hướng hiện tại
- isAlive, size, name, score, explosionRange, bombCount, ...

### B) `new_enemy`
Gửi khi có bot mới tham gia. Data gồm `bomber` (chi tiết) và `bombers` (danh sách hiện tại).

### C) `player_move`
Gửi khi một bot di chuyển; payload giống object bomber (update vị trí/ orient/score...).

### D) `new_bomb`
Gửi khi một bom mới được đặt.
Ví dụ payload:
```json
{ "x":579.5, "y":295.5, "ownerName":"zarenabot", "uid":"xxx", "id":4708 }
```

### E) `bomb_explode` và `map_update`
Khi bom nổ, server gửi `bomb_explode` (tọa độ + explosionArea) và `map_update` (cập nhật chests/items hiện có).

`bomb_explode` ví dụ:
```json
{ "x":160, "y":160, "uid":"xxx", "id":4708, "explosionArea": [{"x":120,"y":120},{"x":180,"y":180}] }
```

`map_update` ví dụ:
```json
{ "chests": [...], "items": [...] }
```

### F) `user_die_update` / `new_life`
Khi bot bị hạ hoặc mới hồi sinh (chỉ có ở môi trường practice). `user_die_update` có payload gồm `killer`, `killed`, `bomb`, và `bombers` (danh sách hiện tại).

### G) `chest_destroyed` / `item_collected`
Khi hòm đồ bị phá, server gửi `chest_destroyed` (kèm item nếu có). Khi bot nhặt item, gửi `item_collected`.

### H) `user_disconnect`
Gửi khi bot rời phòng hoặc disconnect.

### I) `start` và `finish`
- `start` (contest env): server gửi thời điểm bắt đầu: `{ start_at: ISODate }` — bot chỉ bắt đầu hành xử sau event này.
- `finish` (contest env): kết thúc trận; server gửi event rỗng hoặc kết quả.

---

## Ghi chú kỹ thuật (cho teams)
- Token/credentials: BTC sẽ cung cấp token hoặc phương thức xác thực trước khi thi.
- Môi trường thi đấu: bot cần tuân thủ event `start`/`finish` và không tự động reconnect/revive thành bot mới (tuỳ BTC quy định reconnect).
- Tọa độ/scale: server trả tọa độ pixel (ví dụ 0..640). Bạn nên chuẩn hoá sang grid nếu cần.

## Mẫu nhanh (client JS minimal)

```js
const socket = io(process.env.SOCKET_SERVER, { auth: { token: process.env.BOT_TOKEN } });
socket.on('connect', () => socket.emit('join', {}));
socket.on('user', data => { /* init state */ });
socket.on('start', () => { /* begin AI loop */ });
// send move
socket.emit('move', { orient: 'UP' });
// place bomb
socket.emit('place_bomb', {});
```

---

Nếu cần, tôi có thể bổ sung thêm ví dụ Dockerfile cho Python hoặc Go, workflow CI để build/publish image, và script health-check cho BTC.
