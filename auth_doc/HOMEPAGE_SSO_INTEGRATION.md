# Homepage SSO 接入笔记(mineru_replica 侧)

> **配套阅读**
> - [INTEGRATING_APPS_WITH_JWT_SSO.md](INTEGRATING_APPS_WITH_JWT_SSO.md) — 协议契约(homepage 侧定义,language-agnostic)
> - [APPS_YAML_GUIDE.md](APPS_YAML_GUIDE.md) — homepage 那边 `apps.yaml` 怎么填
>
> 这份文档**只记录 mineru_replica 仓库里实际做了哪些改动、踩过哪些坑、怎么验证**。是事后笔记不是协议规范。

---

## TL;DR

| 改动 | 文件 | 行 |
|---|---|---|
| 前端入口加同步 fragment loader | [frontend/index.html](frontend/index.html) | 5-14 |
| AuthContext 允许只有 token 的 bootstrap | [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx) | 38-47, 88 |
| 后端 `ver` 字段缺失时跳过 token_version 校验 | [backend/app/auth/dependencies.py](backend/app/auth/dependencies.py) | 39-58, 86-91 |
| SSO 兼容性单测 | [backend/tests/unit/test_auth_dependencies.py](backend/tests/unit/test_auth_dependencies.py) | `test_non_strict_version_skips_mismatch_check`, `test_jwt_without_ver_claim_bypasses_version_check` |

后端 50 个 auth_dependencies 单测全过。Playwright 端到端验证已确认 homepage → mineru 免登跳转链路通畅。

---

## 协议侧零改动

项目本身就跟 homepage SSO 协议高度对齐,**无需改动**的部分:

| 维度 | 现状 |
|---|---|
| 框架 / JWT 库 / 算法 | FastAPI + PyJWT 2.8 + HS256 |
| Secret env 名 | `JWT_SECRET_KEY` |
| 用户库 | MongoDB `conference_ws.users`(与 homepage 同库同集合) |
| `Authorization: Bearer` 解析 | [dependencies.py:75-79](backend/app/auth/dependencies.py#L75-L79) 已支持 |
| `?token=` 查询参数 | 同上,已支持 |
| 401 软降级到 `/login` | [config.ts:17-37](frontend/src/config.ts#L17-L37) `handleAuthExpired()` |
| axios 自动注入 Bearer | [config.ts:42-48](frontend/src/config.ts#L42-L48) 拦截器 |

---

## 三处必改 + 踩过的坑

### 1. 前端入口同步 loader

[frontend/index.html](frontend/index.html) `<head>` 顶部插入 10 行 IIFE,读 `location.hash` 里的 `access_token`,写入 `localStorage.auth_token`,然后 `history.replaceState` 抹掉 fragment。

**键名**用项目自己的 `auth_token`(不是文档里的 `access_token`),业务代码零改动。

**位置**必须放在 `<script type="module" src="/src/main.tsx">` 之前——Vite 的 module script 是 defer 的,如果 loader 写在 `main.tsx` 里,React 会先尝试渲染、ProtectedRoute 先读到空 token 把用户踢到 `/login`,fragment 还来不及解析。

### 2. AuthContext token-only bootstrap(这次踩的坑)

**问题**:loader 只往 localStorage 写了 `auth_token`,**没写** `auth_user`(按设计应该是 [AuthContext](frontend/src/contexts/AuthContext.tsx) 启动时调 `/api/auth/me` 拉回来填)。但 AuthContext 原代码在 line 38 的入口判断是:

```ts
const existingUser = AuthService.getUser();
const token = AuthService.getToken();
if (!(existingUser && token)) {
  // ⚠️ 没 user 直接放弃 → 永远走不到下面的 /me 调用
  return;
}
```

——`existingUser` 和 `token` 用 `&&`,任何一个缺都早退。SSO 跳过来的瞬间只有 token 没 user,这个早退直接把会话扔了,UI 渲染时检查 `isAuthenticated` 为 false,跳 `/login`。

**修复**(line 38-47):

```ts
// Token is sufficient to bootstrap; if `auth_user` is missing (e.g.
// foreign-issued SSO token from homepage), the /api/auth/me call
// below will populate it. Previously this required both, which
// silently dropped SSO sessions.
if (!token) {
  if (isMounted) setLoading(false);
  return;
}
```

只判 token 缺失;后续 `setUser(existingUser)` 在 user 为 null 时是 no-op,接着 `/api/auth/me` 拉回完整 user 信息并回填 `localStorage.auth_user`(line 92)。同时 line 88 把 `existingUser.display_name` 改成可选链 `existingUser?.display_name` 配合 user 可能为 null 的新现实。

**根因反思**:原代码假设"token 和 user 永远同时出现"——这是只有自家 `/login` 流程时的事实,引入 SSO 后被打破。注释里写的 "All JWT tokens go through DB validation" 跟下面 /me 的调用逻辑都对,**但入口的 `&&` 让代码根本走不到那里**。

### 3. 后端 `ver` 字段缺失容忍

[backend/app/auth/dependencies.py](backend/app/auth/dependencies.py) `_build_local_user_info` 加 `strict_version: bool = True` kwarg;[L86-L91](backend/app/auth/dependencies.py#L86-L91) `get_current_user` 调用时传 `strict_version="ver" in payload`:

- 项目自家签的 JWT 带 `ver` → 严格校验 `token_version`,保留 logout/改密失效语义
- homepage 签的 JWT 不带 `ver` → 跳过版本校验,接受 token

资源 token 路径([`get_current_user_for_resource`](backend/app/auth/dependencies.py#L116-L136))走 `validate_resource_token`,resource token 始终是项目自己签的,自然带 `ver`,行为不变。

---

## 部署对齐(代码外)

### JWT secret(本机 `make dev` / 容器 `make deploy`)

本项目不在 `.env` 保存 raw `JWT_SECRET_KEY`。`make dev` 与 `make deploy` 都从本地文件读取:

```
JWT_SECRET_FILE=auth_doc/jwt
```

运行时由 Makefile / Docker compose secret 注入 `JWT_SECRET_KEY`;不要把 raw secret 写进 `.env`、镜像或 git。

> Fingerprint 自检:`python -c "import hashlib,os;print(hashlib.sha256(os.environ['JWT_SECRET_KEY'].encode()).hexdigest()[:8])"` 跟 homepage 启动日志 `jwt_fp=` 比对一致。

### MongoDB

[.env:7](.env#L7) `MONGO_URL=mongodb://10.0.0.93:27017` 必须跟 homepage 指向同一个 MongoDB 实例。两边共享 `conference_ws.users` 集合,otherwise homepage 签的 token 里的 `sub` 在 mineru 这边查不到用户,401。

### homepage 仓库 apps.yaml

最小条目(IP 替换为你的 LAN IP):

```yaml
  - id: mineru-replica
    name: "文件处理"
    description: "PDF 翻译与表格抽取"
    url: "http://10.0.0.93:5173/"
    share_token: true
    color: "#2563eb"
    category: "办公协作"
    keywords: "pdf 翻译 ocr 表格 mineru"
```

- `url` 端口 `5173`:[Makefile dev](Makefile) 实际跑 `npm run dev:remote`,Vite remote mode 监听 5173 并 proxy `/api` 到 backend 15279
- `share_token: true`:必须,否则 homepage 跳过来不会带 token
- 改完 `docker compose restart homepage` + 浏览器强刷

---

## 验证流程

### 自动化(后端单测)

```bash
make test-backend  # 或直接:
python -m pytest backend/tests/unit/test_auth_dependencies.py --no-cov -q
```

新增两个 case:
- `test_non_strict_version_skips_mismatch_check` — `_build_local_user_info` 单元层面
- `test_jwt_without_ver_claim_bypasses_version_check` — `get_current_user` 集成层面,模拟 homepage 签的 token + DB `token_version=2`,必须放行

### 端到端(浏览器)

1. 启动 mineru:`make dev`(后端 15279 + 前端 5173)
2. homepage 用 conference_ws.users 里的账号登录
3. 工作台点「文件处理」卡片 → 新 tab 打开 `http://<LAN-IP>:5173/`
4. DevTools → Application → Local Storage 应看到:
   - `auth_token` 已写入(loader 干的)
   - `auth_user` 在约 100ms 后被 AuthContext 调 `/api/auth/me` 填上
5. URL 不会停在 `/login`,直接渲染主界面,左下角显示用户名 + 角色
6. Network 面板:`/api/auth/me` 200,后续业务 API header 含 `Authorization: Bearer ey...`

### 失败排查表

| 现象 | 大概原因 |
|---|---|
| 跳到 `/login` 而不是主界面 | AuthContext 修复没生效 / 浏览器缓存了旧 bundle,强刷 |
| `/api/auth/me` 返回 401 | `JWT_SECRET_KEY` 两边不一致(算 sha256[:8] 比对) |
| `/api/auth/me` 返回 401 + 用户存在 | mineru MongoDB 没连到 homepage 同一个实例,`sub` 查不到 |
| 地址栏 fragment 不消失 | IIFE 没装 / 装在了 `<script type="module">` 之后,被 defer 了 |
| 用户在 mineru 自家登出过后从 homepage 跳不进来 | `ver` 容忍补丁没生效,跑下 `test_jwt_without_ver_claim_bypasses_version_check` 验证 |

---

## 不做(刻意决定)

- **不把 `auth_token` 改名为 `access_token`**:IIFE 直接写 `auth_token`,业务代码零改动。
- **不加 `jwt_fp` 启动日志**:部署时手算 sha256 比对即可,避免 log 噪声。
- **不加 token 黑名单 / 主动 bump token_version 跨 app 同步**:[INTEGRATING_APPS_WITH_JWT_SSO.md §7.3](INTEGRATING_APPS_WITH_JWT_SSO.md) 明确"homepage 改密只清自家 session,其它 app 旧 token 在 7 天 TTL 内继续有效",符合双方默契。
- **不动 WebSocket 相关**:本项目没有 WebSocket。
