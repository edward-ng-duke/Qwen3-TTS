# 自家 App 接入 Homepage 免登录跳转

> **适用场景**：homepage 已开启 `AUTH_MODE=local`、跟你的 app 共享同一个 MongoDB `conference_ws.users` 集合和 `JWT_SECRET_KEY` 的部署。
>
> **不适用**：homepage 跑在 `AUTH_MODE=oidc` 时本机制不工作（那种场景每个 app 各自走 Authentik OIDC 流程，免登录由 Authentik 的 session 提供，不在本文档讨论范围内）。

---

## TL;DR

- Homepage 已经是**令牌发行人**。你只需要在你的 app 里加 ~30 行 JS + ~50 行后端代码就能让用户从 homepage 跳过来时直接登录态。
- 关键约定：`JWT_SECRET_KEY` 与 homepage 完全一致；JWT 通过 URL fragment `#access_token=<jwt>` 传递；前端拿到后立刻写进 `localStorage.access_token` 并把 fragment 从地址栏抹掉。
- 流程：homepage 登录 → 用户点工作台卡片 → 浏览器跳 `https://homepage.ngrok/go/<id>` → homepage 302 → `https://yourapp.ngrok/#access_token=<jwt>` → 你 app 的早期 JS 把 token 收进 localStorage → 业务请求 `Authorization: Bearer <jwt>` → 你 app 后端解码 JWT → 拿到用户身份。

---

## 1. 你需要先确认的前提

1. **共用同一个用户库**：你的 app 跟 homepage 共用 MongoDB 上的 `conference_ws.users` 集合。用户文档至少含 `{_id, username, password_hash, role, status, ...}`。
2. **共用同一个 JWT 签名密钥**：你的 app 部署环境里 `JWT_SECRET_KEY` 与 homepage（以及 stepfun-realtime-bot / mygpt 等已接入的兄弟 app）完全一致。
   - **怎么对齐**：homepage 启动日志会打印 `jwt_fp=<sha256 前 8 位>`，你 app 启动时也按同样办法计算一次自己的 fingerprint，肉眼比对一致即可。
3. **暴露到外网**：你的 app 通过 ngrok / 自有域名暴露到一个 HTTPS URL，并把这个 URL 填进 homepage 仓库的 `homepage/config/apps.yaml`（见 §5）。
4. **首页用户能登进 homepage**：homepage 端用户已经能用 `username + password` 登进去（local 模式），并且这个 username 在你 app 看来也是合法的（最简单情况是同一个 username）。

---

## 2. 协议契约（不要偏离）

| 项 | 约定 |
|---|---|
| 签名算法 | HS256 |
| Payload 字段 | `sub` (str, ObjectId 字符串), `username` (str), `role` (`"admin"` 或 `"user"`), `iat` (int, Unix 秒), `exp` (int, Unix 秒) |
| 生命周期 | 默认 7 天（与 homepage 同步）；homepage 重新登录时刷新 |
| 跨域传递方式 | URL fragment `#access_token=<jwt>` |
| 浏览器端存储 | `localStorage.access_token` |
| HTTP API 调用 | header `Authorization: Bearer <jwt>` |
| WebSocket 握手 | query `?token=<jwt>`（兼容 stepfun-realtime-bot 既有约定） |

**为什么用 fragment 不用 query**：fragment 不发送到服务器、不写 nginx/ngrok 访问日志、不进 `Referer` header。代价是只能 JS 读取——正好就是方案要求。

---

## 3. 前端改造（必做，5-10 分钟）

### 3.1 加同步 loader

在你 app 的入口 HTML 的 `<head>` 顶部，**所有 `<script src="…">` 之前**（包括框架 bundle、analytics、polyfill），加这段同步执行的 IIFE：

```html
<script>
(function () {
  var m = location.hash.match(/(?:^#|&)access_token=([^&]+)/);
  if (m) {
    try { localStorage.setItem('access_token', decodeURIComponent(m[1])); } catch (e) {}
    var newHash = location.hash.replace(/(^#|&)access_token=[^&]+/, '').replace(/^#&/, '#');
    history.replaceState(null, '', location.pathname + location.search + (newHash && newHash !== '#' ? newHash : ''));
  }
})();
</script>
```

要点：

- **必须同步、最早执行**——如果晚于某个 bundle，那个 bundle 可能在 token 入库前就读 localStorage 失败、把用户踢去自己的 `/login`。
- 正则兼容三种形态：`#access_token=t`、`#a=1&access_token=t`、`#access_token=t&b=2`。
- 用 `history.replaceState` 抹 fragment 不会触发跳转、不污染浏览器历史栈。
- `localStorage.setItem` 在隐私模式 / 第三方 cookie 被禁的浏览器里可能抛异常，吞掉即可——失败的情况下后续 fetch 会拿到 401，跳你 app 自己的 `/login`，整体是软降级。

### 3.2 业务代码读 token 的标准写法

对齐 stepfun-realtime-bot 既有的 `__ensureJwt()` 钩子：

```js
function getAccessToken() {
  return localStorage.getItem('access_token') || '';
}

async function authedFetch(url, opts = {}) {
  const tok = getAccessToken();
  const headers = Object.assign({}, opts.headers || {});
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const r = await fetch(url, Object.assign({}, opts, { headers }));
  if (r.status === 401) {
    localStorage.removeItem('access_token');
    location.href = '/login';   // 你 app 自己的登录页（备用入口）
  }
  return r;
}
```

### 3.3 WebSocket 握手

```js
const ws = new WebSocket('wss://yourapp.ngrok.app/ws?token=' + encodeURIComponent(getAccessToken()));
```

`/ws` 后端读 `query.token`，按 §4.3 的方式 verify 即可。

---

## 4. 后端改造（必做，10-20 分钟）

下面以 Python + FastAPI 为例；其他语言原理一致——只要找 HS256 JWT 库 verify。

### 4.1 安装依赖

```bash
pip install PyJWT bcrypt motor pymongo
```

`bcrypt` / `motor` / `pymongo` 仅在你 app 还需要读写 users 集合时必须；纯 verify token 只需要 PyJWT。

### 4.2 配置 + 启动 fingerprint

```python
import hashlib, os, sys

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
if not JWT_SECRET_KEY:
    print("FATAL: JWT_SECRET_KEY not set", file=sys.stderr)
    sys.exit(1)

JWT_ALGORITHM = "HS256"
JWT_FP = hashlib.sha256(JWT_SECRET_KEY.encode()).hexdigest()[:8]
print(f"jwt_fp={JWT_FP}")
```

上线时跟 homepage 启动日志 `jwt_fp=…` 比对，必须完全相同。不一致就是 secret 漂移了，先修这个再继续。

### 4.3 验证函数

```python
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
import jwt

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "missing_token")
    payload = decode_token(auth[7:])
    if not payload:
        raise HTTPException(401, "invalid_token")
    # 可选但推荐：去 mongo 回查 active 状态，防止被禁用的用户用旧 token 进来
    # from bson import ObjectId
    # doc = await mongo_db.users.find_one({"_id": ObjectId(payload["sub"])})
    # if not doc or doc.get("status") != "active":
    #     raise HTTPException(401, "user_inactive")
    return {
        "sub": payload["sub"],
        "username": payload["username"],
        "role": payload["role"],
    }
```

业务路由：

```python
@app.get("/api/my-data")
async def my_data(user: dict = Depends(get_current_user)):
    return {"hello": user["username"]}
```

### 4.4 跟你已有的「用户名密码登录页」并存

如果你 app 本来就有 `/login` POST 端点（stepfun-realtime-bot 那种），保留它作为「直接登录」入口。本方案完全并存——
- 用户从 homepage 跳过来 → URL 带 fragment → loader 写 localStorage → 直接登录态。
- 用户直接打开你 app URL → 没 fragment → loader 不写 localStorage → fetch 401 → 你 app 自己的 `/login`。
- 用户在你 app 的 `/login` 输用户名密码 → 你 app 后端 mint 一个 JWT → 写 `localStorage.access_token` 直接登录态。

三条路径同一份 localStorage 数据，互相兼容。

---

## 5. apps.yaml 注册

在 homepage 仓库的 `homepage/config/apps.yaml` 里把你的 app 加进 `apps:` 列表。关键字段：

```yaml
- id: my-cool-app                          # 必填，全局唯一
  name: "我的炫酷工具"
  description: "一句话简介"
  url: "https://my-cool-app.ngrok.app/"    # 你 app 的入口 URL
  share_token: true                         # 关键：跳转时带 JWT
  category: "办公协作"
  icon_svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="..."/></svg>'
  color: "#2563eb"
  keywords: "工具 自动化"
```

**不加 `share_token: true` 的 app**：homepage 会照常显示卡片，但点击时不带 token——目标 app 自行处理登录。适用于第三方 SaaS、不接入 conference_ws 用户库的服务。

修改 `apps.yaml` 后 homepage 那边不需要重建镜像，但需要 restart 容器：`docker compose restart homepage`（apps.yaml 通过 volume 挂进容器，每次请求读盘，但 catalog 可能有缓存——restart 最稳妥）。

---

## 6. 完整测试流程

1. **同步 secret**：把 homepage 用的 `JWT_SECRET_KEY` 注入你 app 的环境变量。比对两边启动日志 `jwt_fp=` 一致。
2. **homepage 一侧**：
   ```bash
   docker compose build homepage && docker compose up -d --force-recreate homepage
   docker compose logs --tail=10 homepage | grep jwt_fp
   ```
   确认 `AUTH_MODE=local` + `MongoDB ready` + `jwt_fp=<同你 app 的 8 位 hex>`。
3. **你 app 一侧**：完成 §3 + §4 改动，部署，启动日志看 `jwt_fp=` 同上一致。
4. **浏览器流程**：
   1. 打开 `http://localhost:3478/`（homepage），登录（用 conference_ws.users 里你自己的账号）。
   2. 在工作台点你的 app 卡片。新 tab 打开。
   3. 新 tab 的地址栏**会短暂**出现 `…#access_token=ey…`，约 100ms 后被 loader 抹掉。
   4. DevTools → Application → Local Storage → 看到 `access_token` 已写入。
   5. DevTools → Network → 业务 API 请求都带 `Authorization: Bearer …`。

---

## 7. 风险 / 边界

1. **JWT 过期 / 无效**：你 app 应该 401 → 跳自己的 `/login`。这是 stepfun 既有行为，符合预期。
2. **同名账号但 email 不同**：homepage 用 `<username>@local` 作为占位 email；你 app 的 email 字段可能不同。**建议下游始终用 `sub`（ObjectId 字符串）作为用户主键**，不要按 email join。
3. **homepage 改密后旧 token 仍可用 7 天**：homepage 改密时只清自己 session 里的 token；**其它 app 上 localStorage 里的旧 token 不会主动失效**。如果你对此敏感：
   - 短期：把 homepage 的 `JWT_EXPIRE_DAYS` 调小（如 1 天）；
   - 长期：在你 app 后端加 token 黑名单或在 `users.token_version` 字段每次改密 +1、JWT payload 也带 `token_version`，不匹配就拒绝。
4. **截图泄露**：用户截屏时如果正好在 fragment 抹掉前那 100ms，截图里会有 token。可接受。如真在意，可改用 POST 自动 submit / hidden form 方案（工程量大很多，不推荐）。
5. **浏览器历史**：`history.replaceState` 替换当前条目，token 不会进入浏览器历史栈。
6. **新 tab 卡住**：如果目标 app 服务挂了，新 tab 停留在 ngrok 加载页时地址栏仍有 token——但 token 没发到任何 server，只在浏览器本地可见。可接受。
7. **多 tab 并发**：用户开多 tab 都会写同一份 `localStorage.access_token`，后写的覆盖前写的。无副作用——token 是无状态的，谁覆盖谁都能用。
8. **ngrok dashboard inspect**：fragment 部分浏览器不发送到 server，所以 ngrok 后台 inspect 看不到 token。安全。

---

## 8. FAQ

**Q: 我 app 现在跑在本地 8000 端口，没 ngrok，能本地联调吗？**

A: 能。把 apps.yaml 里 url 写 `http://10.0.0.93:8000/`（或你 LAN IP），保证 homepage docker 容器到这个地址网络可达（默认 host 网络已通）。

**Q: 我 app 不是 Python，用 Node.js / Go / Rust？**

A: 协议契约（§2）跟语言无关。任何 HS256 JWT 库 verify 即可。Node 用 `jsonwebtoken`、Go 用 `github.com/golang-jwt/jwt`、Rust 用 `jsonwebtoken` crate。**密钥同一个，算法同一个，payload 字段同一个**。

**Q: 我能反过来吗——我 app 签 token，homepage 接？**

A: homepage 当前的 local 模式只接受**自己**签发的 token。如果你想让 homepage 也接受 stepfun 等签发的 token，需要在 homepage 这边加双向 verify（暂未实现）。提需求即可。

**Q: token 能透传到第三方 SaaS 吗？**

A: 不行——第三方无法验证你的 HS256 密钥。第三方 app 在 `apps.yaml` 里**不要**加 `share_token: true`，homepage 会让卡片照常显示但跳转不带 token。

**Q: 用户首次跳过来时同时没登录 homepage 会怎样？**

A: 用户访问 homepage `/go/<id>` 时 `require_login` 拦截，返回 401。浏览器会显示 401 错误（不会跳登录页因为这是 fetch / 新窗口）。这是预期：用户应该先登录 homepage 再点卡片。

**Q: homepage 关掉 local 模式（切回 oidc）会怎样？**

A: oidc 模式下 homepage 不签 JWT，`/go/<id>` 也不会注入 token——302 直接跳目标 URL。你 app 会因为没 token 跳自己的 `/login`，相当于回到「未接入」状态。零中断。

---

## 9. 联调 Checklist

接入前后逐条 ✓：

- [ ] 你 app 启动日志 `jwt_fp=…` 跟 homepage 完全一致
- [ ] 你 app 入口 HTML 的 `<head>` 顶部加了同步 loader（§3.1）
- [ ] 业务 fetch 使用 `Authorization: Bearer <token>`（§3.2）
- [ ] 后端 `get_current_user` 实现并接入业务路由（§4.3）
- [ ] homepage 仓库的 `apps.yaml` 里你 app 条目加了 `share_token: true`（§5）
- [ ] homepage `docker compose restart homepage` 让 yaml 改动生效
- [ ] 浏览器测试：homepage 登录 → 点卡片 → 新 tab 地址栏 fragment 出现/消失 → DevTools 看 localStorage 有值（§6）
- [ ] DevTools Network 看 API 请求带 `Authorization: Bearer …`
- [ ] 你 app 后端日志不出现 token 明文（不要把 `Authorization` header 内容写日志）

---

## 附录：homepage 端的相关代码

如果你想深入了解 homepage 这边的实现：

| 文件 | 作用 |
|---|---|
| `homepage/app/auth_local/auth_service.py` | `create_token()` / `decode_token()` / `authenticate()` |
| `homepage/app/auth_local/routes_auth.py` | `login_submit()` 登录成功后把 JWT 存进 `session.access_token` |
| `homepage/app/api/go.py` | `/go/<app_id>` 端点：lookup apps.yaml + 拼 fragment + 302 |
| `homepage/static/appopen.js` | 卡片点击改走 `/go/<id>`（而不是直接 `window.open(url)`） |
| `homepage/config/apps.yaml` | `share_token: true` 字段定义 |
| `homepage/auth_doc/USER_SYSTEM_MIGRATION_GUIDE.md` | conference_ws.users + JWT 体系完整说明（自家 app 共享同一份） |
