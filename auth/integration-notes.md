# stepfun-realtime-bot 用户系统集成说明

与 `mygpt-audio-streaming-frontend` 共享 MongoDB `conference_ws.users` 集合和 ES `mygpt_user` 索引。此文档记录 stepfun 侧与迁移指南的差异点和联调要点。

## 与 mygpt app 的差异

| 维度 | stepfun | mygpt |
|---|---|---|
| 强制认证范围 | 仅 `WebSocket /ws` | 全量 HTTP + WS |
| WS 凭证通道 | query `?token=<jwt>` / `?token2=<es>` + cookies `access_token` / `token2` 双通道 | HTTP header 为主 |
| 公开 HTTP | `/`, `/landing`, `/scenarios`, `/config`, `/voices`, `/login`, `/admin`, 所有 `/static/*` | 基本全闭 |
| 前端登录页 | 独立 `/login` SPA | 项目内 |
| 管理页 | 独立 `/admin` SPA | 项目内 |
| ES 后台同步 | 启用（`ES_SYNC_INTERVAL_SECONDS=300`） | 同 |

## 关键配置

配置优先级：**OS 环境变量 > `stepfun_bot/auth/defaults.yaml` > 代码默认值**。

Docker 部署时 YAML 提供默认，用 `-e` 注入的变量总是生效，典型：

```bash
docker run -d \
  -e JWT_SECRET_KEY="shared-with-mygpt" \
  -e MONGO_URL="mongodb://10.0.0.93:27017" \
  -p 8000:8000 stepfun-realtime-bot:latest
```

未注入时按 YAML 默认（`mongodb://10.0.0.93:27017`、`conference_ws`、ES 启用等）。`.env.example` 列出全部可选变量名。最易踩坑的两项：

- `JWT_SECRET_KEY`: **故意不放进 YAML**，必须通过环境变量注入，且与 mygpt 完全一致，否则两边互不认 token。启动日志会打印 `jwt_secret_fingerprint=<sha256 前 8 位>`，两边比对即可。
- `MONGO_URL` / `DB_NAME`: 指向同一个 MongoDB 实例和库名（`conference_ws`）。

## 认证流程

```
请求到达
├─ 是 /ws 吗？
│    ├─ 是 → 取 query/cookie 中的 JWT 或 ES token
│    │       JWT 优先 → 解码 + MongoDB 回查 active
│    │       JWT 失败 → ES token 查 ES → 显式绑定/创建 ES 账号并换 JWT
│    │       都失败且 WS_AUTH_REQUIRED=true → close(4401)
│    └─ 否 → 走 HTTP 中间件
│           - 静态 + 公开路径 → 直接放行
│           - 其它 /api/* → 读 Authorization: Bearer，解码+回查，失败置 user=None
│           - 路由用 Depends(get_current_user) / require_admin 兜底 401/403
```

## 代码结构

```
stepfun_bot/auth/
├── config.py             # AuthConfig.from_env()
├── user_model.py         # UserDocument + UserRole + UserStatus
├── user_repository.py    # UserRepository (幂等索引)
├── auth_service.py       # bcrypt + SHA256 迁移 + JWT 签/解
├── es_auth_service.py    # ES token 查询 + 策略回退 + 影子 upsert + full sync
├── middleware.py         # AuthMiddleware (try/except 降级)
├── ws_auth.py            # WebSocket 握手认证
├── deps.py               # get_current_user / require_admin
├── routes_auth.py        # /api/auth/login, /me, /logout, /verify-es-token
├── routes_users.py       # /api/users CRUD (admin)
└── lifespan.py           # Mongo + ES 客户端生命周期 + 后台同步任务
```

前端：
- `static/login.html|js|css` — 登录表单
- `static/admin.html|js|css` — 管理界面
- `static/app.js` — HUD 建 WS 前调 `__ensureJwt()`，无 JWT 时尝试用 ES cookie 换 JWT，失败才跳 `/login`

## ES 绑定规则

- 显式 ES 鉴权（`/api/auth/verify-es-token` 或 `/ws?token2=`）命中同名已有账号时，会复用原账号 id，并把 `auth_source` 更新为 `es`。
- 后台 `full_sync` 只会创建新影子用户，或更新已是 `auth_source="es"` 的账号；遇到同名本地账号仅记 warning 并跳过，不会被动改写。
- 显式绑定不会恢复被本地禁用的账号；命中 disabled 用户时，不会签发新的 JWT。
- Mongo 不可用时不会初始化 ES 鉴权服务；`/api/auth/login`、`/api/auth/verify-es-token`、`/api/users*` 统一返回 `503 auth storage unavailable`。

## 联调 checklist

- [ ] 启动日志 `jwt_secret_fingerprint` 两边一致
- [ ] mygpt 登录拿到的 JWT，贴到 stepfun 的 `localStorage.access_token`，刷新 `/` 可直连 `/ws`
- [ ] 带 mygpt 的 `token2` cookie 访问 `/`，前端自动调 `/api/auth/verify-es-token` 换 JWT
- [ ] 关停容器观察日志，无 `Task exception was never retrieved`（pitfall #12）
- [ ] admin 账号访问 `/admin`，能看到 ES 同步进来的影子用户；非 admin 访问 `/api/users` 返回 403
- [ ] ES 侧字段 `tokens` 类型变化（keyword↔text）时，重启后 `detect_query_strategy` 自动切换

## 踩坑对照

详见 `用户系统踩坑记录.md`。stepfun 实现已覆盖：

| # | 坑 | 落点 |
|---|---|---|
| 1 | ES 字段类型不匹配 | `es_auth_service.detect_query_strategy` + 运行时回退 |
| 2 | MongoDB 索引名冲突 | `user_repository.ensure_indexes` 先查 `index_information` |
| 3 | JWT 密钥不一致 | 启动打印 fingerprint |
| 4 | 中间件异常 500 | `AuthMiddleware.dispatch` 整段 try/except |
| 5 | 静态资源走认证 | `STATIC_EXT` + `PUBLIC_EXACT` + `PUBLIC_PREFIXES` 跳过 |
| 6 | JWT 非无状态 | 每次中间件/WS 握手都回查 MongoDB 的 active 状态 |
| 7 | ES token 大小写/引号 | `es_auth_service.get_token_from_request` |
| 8 | ES 全量同步排序 | `full_sync` 三级回退 `username.keyword` → `username` → unsorted |
| 9 | 密码哈希迁移 | `auth_service.verify_password` 登录时透明升级 |
| 10 | 硬删除 | `user_repository.delete` 用 `delete_one`，测试断言 404 |
| 12 | 异步任务优雅关闭 | `lifespan` shutdown 里 `cancel() + await + 吞 CancelledError` |
