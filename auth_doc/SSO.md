# Homepage SSO 接入 (mineru_replica)

> mineru_replica 已接入 homepage 工作台免登录跳转。本文档供 code agent 维护、排错、改动 auth / 入口代码时参考。
>
> 原始详细资料(更长、更教程化,需要时再翻):[APPS_YAML_GUIDE.md](APPS_YAML_GUIDE.md) · [INTEGRATING_APPS_WITH_JWT_SSO.md](INTEGRATING_APPS_WITH_JWT_SSO.md) · [HOMEPAGE_SSO_INTEGRATION.md](HOMEPAGE_SSO_INTEGRATION.md)

---

## 0. 工作机制(30 秒)

- 共享:HS256 JWT、`JWT_SECRET_KEY`、MongoDB `conference_ws.users`(homepage 与 mineru 同 secret 同库)
- 流程:homepage 登录 → 点工作台卡片 → `/go/<id>` 302 → `http://mineru/#access_token=<jwt>` → 前端同步 loader 把 token 写 `localStorage` 并抹掉 fragment → 业务 API 带 `Authorization: Bearer <jwt>`
- 仅 homepage **`AUTH_MODE=local`** 生效;oidc 模式 homepage 不签 JWT,SSO 自动失效,目标 app 退回自家登录页(零中断)

---

## 1. 协议契约

| 项 | 约定 |
|---|---|
| 签名算法 | HS256 |
| Payload 必填字段 | `sub`(ObjectId 字符串)、`username`、`role`(`"admin"` \| `"user"`)、`iat`、`exp` |
| Payload 可选字段 | `ver`(token_version,只有自家签的 token 才带) |
| 跨域传递 | URL fragment `#access_token=<jwt>`(不进 server log / Referer / ngrok inspect) |
| 浏览器存储键名 | **`auth_token`**(注意:其它兄弟 app 用 `access_token`,mineru 刻意用 `auth_token` 以避免业务代码改名) |
| HTTP API | `Authorization: Bearer <jwt>` |

Fingerprint 自检(部署后必跑一次)——直接对比两边 `.env`,不依赖 shell 是否 `export` 过:

```bash
m=$(grep '^JWT_SECRET_KEY=' /home/edward/research/mineru_replica/.env | cut -d= -f2-)
h=$(grep '^JWT_SECRET_KEY=' /home/edward/research/authentik-weiqu/.env | cut -d= -f2-)
echo "mineru fp:   $(printf %s "$m" | sha256sum | head -c 12)"
echo "homepage fp: $(printf %s "$h" | sha256sum | head -c 12)"
[ "$m" = "$h" ] && echo MATCH || echo MISMATCH
```

如果跑的是已部署容器,直接看容器 env(也是常踩的坑——见 §3 ⚠️):

```bash
docker inspect mineru-replica --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | awk -F= '/^JWT_SECRET_KEY=/{print "len="length($2)}'
# 期望 len=64；若 len=15 说明拿到的是 _env.sh 的 fallback "your-secret-key" → 重 deploy
```

---

## 2. 三处必改(已落地)

### 2.1 前端 fragment loader

[frontend/index.html:5-14](../frontend/index.html#L5-L14) `<head>` 顶部、所有 `<script src>` 之前的同步 IIFE。读 `location.hash` 里的 `access_token`,写入 `localStorage.auth_token`,`history.replaceState` 抹 fragment。

> ⚠️ **必须同步早执行**。Vite module script 是 defer 的——如果 loader 写在 `main.tsx` 里,React 会先尝试渲染、ProtectedRoute 先读到空 token 把用户踢去 `/login`,fragment 还来不及解析。

### 2.2 AuthContext token-only bootstrap

[frontend/src/contexts/AuthContext.tsx:38-47, 88, 92](../frontend/src/contexts/AuthContext.tsx#L38-L47) 入口判断只判 `if (!token) return`,不再要求 `existingUser` 同时存在。后续 `/api/auth/me`(L83-92)拉回 user 并回填 `localStorage.auth_user`。`display_name` 用可选链 `existingUser?.display_name`(L88)。

> ⚠️ **陷阱**:原代码是 `if (!(existingUser && token)) return` —— `&&` 双条件,任何一个缺都早退。SSO 跳过来的瞬间只有 token 没 user,会被早退扔掉,用户直接被踢到 `/login`。
>
> **改 AuthContext mount 入口逻辑时,不要重新引入这个 `&&`。**

### 2.3 后端 `ver` 字段缺失容忍

[backend/app/auth/dependencies.py:39-58, 86-91](../backend/app/auth/dependencies.py#L39-L58)

- `_build_local_user_info` 加 `strict_version: bool = True` kwarg
- `get_current_user` 调用时传 `strict_version="ver" in payload`

行为:

| token 来源 | 带 `ver`? | 行为 |
|---|---|---|
| mineru 自家 `/login` 签 | 是 | 严格校验 `token_version`,保留 logout / 改密失效语义 |
| homepage 签 | 否 | 跳过版本校验,接受 token |

> ⚠️ **Resource token 路径不变**:[`get_current_user_for_resource`](../backend/app/auth/dependencies.py#L116-L136) → `validate_resource_token`,resource token 始终自家签自带 `ver`,逻辑不动。改 §2.3 时只动 `get_current_user`,不要顺手改 resource 路径。

---

## 3. 部署对齐

| 项 | 位置 | 要求 |
|---|---|---|
| `JWT_SECRET_KEY` | `.env:9`(`.gitignore`) | 与 homepage 完全一致 |
| `MONGO_URL` | `.env:7` | 必须与 homepage 指向同一 MongoDB 实例(否则 `sub` 查不到用户 → 401) |
| 前端端口 | Vite 5173(`make dev` 跑 `npm run dev:remote`) | 后端 15279,Vite proxy `/api` |

**homepage 仓库 apps.yaml**(参考,不在本仓库改):

```yaml
- id: mineru-replica
  url_env: MINERU_REPLICA_EXTERNAL_URL  # ngrok / 公网 URL,在 authentik-weiqu/.env 里给值
  url: "http://10.0.0.93:5173/"         # 内网 fallback,url_env 空时用这个
  share_token: true                     # SSO 开关,必须 true,否则跳转不带 token
  category: "办公协作"
```

详细的 ngrok 双隧道部署见 §6。

> ⚠️ **`make deploy` 不会自动 source `.env`** —— [deploy/_env.sh](../deploy/_env.sh) 用 `${VAR-fallback}`
> 语法,只读 shell 当前 export 的值;shell 没 `export` 时静默落到 fallback,而 `JWT_SECRET_KEY` 的
> fallback 是 `your-secret-key`(15 字符)。容器会健康跑起来,但 homepage 签的 token 验签全部 401,
> 而且 mineru 自己没打 `jwt_fp=` 日志,从外部看不出来。**每次 deploy 都要**:
>
> ```bash
> cd /home/edward/research/mineru_replica
> set -a && source .env && set +a && make deploy
> ```
>
> 部署完立刻用 §1 那个 `docker inspect ... len=` 命令确认 `JWT_SECRET_KEY` 长度是 64 不是 15。

---

## 4. 验证

### 4.1 单测(改 §2.3 时必跑)

```bash
make test-backend
# 或
python -m pytest backend/tests/unit/test_auth_dependencies.py --no-cov -q
```

关键 case([backend/tests/unit/test_auth_dependencies.py](../backend/tests/unit/test_auth_dependencies.py)):

- `test_non_strict_version_skips_mismatch_check` — `_build_local_user_info` 单元层
- `test_jwt_without_ver_claim_bypasses_version_check` — `get_current_user` 集成层,模拟 homepage 签的无 `ver` token + DB `token_version=2`,必须放行

### 4.2 端到端(浏览器)

1. `make dev`(后端 15279 + 前端 5173)
2. homepage 用 `conference_ws.users` 里的账号登录
3. 工作台点「文件处理」卡 → 新 tab 打开 `http://<LAN-IP>:5173/`
4. DevTools → Application → Local Storage:
   - `auth_token` 立即出现(loader 干的)
   - `auth_user` ~100ms 后被 `/api/auth/me` 填上
5. URL 不停在 `/login`,直接渲染主界面、左下角显示用户名 + 角色
6. Network:`/api/auth/me` 200,后续业务 API header 含 `Authorization: Bearer ey...`

### 4.3 排错对照表

| 现象 | 原因 |
|---|---|
| 跳到 `/login` 而非主界面 | §2.2 修复未生效 / 浏览器缓存旧 bundle → 强刷 |
| `/api/auth/me` 401 | `JWT_SECRET_KEY` 两边不一致(算 sha256[:8] 比对) |
| `/api/auth/me` 401 但用户存在 | MongoDB 不是同一个实例,`sub` 查不到 |
| 地址栏 fragment 不消失 | §2.1 IIFE 没装 / 被放到 `<script type="module">` 之后被 defer |
| 自家 logout 后从 homepage 跳不进来 | §2.3 `ver` 容忍补丁失效 → 跑 `test_jwt_without_ver_claim_bypasses_version_check` |
| 部署后所有 SSO 跳转 401,自家 `/login` 却能用 | `make deploy` 前没 source `.env` → 容器拿到 `JWT_SECRET_KEY=your-secret-key` fallback(§3 ⚠️)。`docker inspect mineru-replica` 看 env 长度,重 deploy |
| homepage 卡片点完仍跳到内网 IP `10.0.0.93:5173` | apps.yaml 加了 `url_env` 但 homepage 容器没读到该 env var → 检查 `authentik-weiqu/docker-compose.yml` homepage 服务 `environment:` 块是否显式透传了 `MINERU_REPLICA_EXTERNAL_URL`,以及 `authentik-weiqu/.env` 是否填了值;改完用 `docker compose up -d homepage`(不能 `restart`,新 env var 需要 recreate) |

---

## 5. 改动时不踩雷

- **键名是 `auth_token`,不是 `access_token`** — loader、AuthService、AuthContext 三处必须一致
- **AuthContext mount 入口用单条件 `if (!token)`,不要 `&&` 双条件早退**(§2.2 陷阱)
- **`get_current_user` 保持 `strict_version="ver" in payload` 这行**(§2.3);改签名时配套改 `_build_local_user_info` 默认 `True` 不要动
- **`<head>` 顶部的 IIFE 必须在所有 `<script src>` 之前**(§2.1);新增统计脚本 / polyfill 时别插到它前面
- **不要加 token 黑名单 / 跨 app 主动失效** — 接受 homepage 改密后 7 天 TTL 内其它 app 旧 token 仍有效(双方默契,见原文档 §7.3)
- **本项目无 WebSocket** — 暂不需要处理 `?token=<jwt>` query 透传
- **Resource token 路径不要顺手"统一"成 `get_current_user`** — resource token 独立体系,自带 `ver`,共用反而会破坏失效语义
- **`make deploy` 必须先 `set -a && source .env && set +a`**(§3 ⚠️);否则 `JWT_SECRET_KEY` 静默落到 fallback,SSO 全 401

---

## 6. ngrok / 公网部署(双隧道跨站)

场景:mineru 挂在 `https://weiqu.ngrok-free.dev`,homepage 挂在 `https://weiqu-home.ngrok.app`,两个子域跨站。SSO 协议层零改动——主登录走 localStorage + `Authorization` header,不依赖 cookie 跨站。

### 6.1 mineru 这一侧

| 项 | 位置 | 期望值 | 备注 |
|---|---|---|---|
| 前端基址 | [docker/Dockerfile:26](../docker/Dockerfile#L26) `ENV VITE_API_BASE_URL=""` | 已 hardcode 空串 | 镜像 build 时 baked-in,前端走相对路径 → 同源 |
| 同源托管开关 | [deploy/_env.sh:29](../deploy/_env.sh#L29) `SERVE_FRONTEND=true` | 默认开启 | 后端 FastAPI mount `frontend/dist`,见 [backend/app/main.py:290-315](../backend/app/main.py#L290-L315) |
| CORS env 兜底 | [backend/app/config/__init__.py](../backend/app/config/__init__.py) `CORS_ORIGINS` env var | 同源部署留空即可 | 跨 app fetch / iframe 场景才需要填 ngrok 域,逗号分隔,union 到默认 localhost 列表 |
| 部署 | `set -a && source .env && set +a && make deploy` | — | 必须 source `.env`(§3 ⚠️) |
| ngrok 隧道 | `ngrok http 3100 --domain=weiqu.ngrok-free.dev` | host port 3100 | 容器 EXPOSE 3100,见 [docker/Dockerfile:79](../docker/Dockerfile#L79) |

### 6.2 homepage 这一侧(`/home/edward/research/authentik-weiqu/`)

3 处都要就位,缺一个 url_env 就静默 fallback 到内网 IP:

| 项 | 位置 | 值 |
|---|---|---|
| 注册表声明 | `homepage/config/apps.yaml` mineru-replica 条目 | `url_env: MINERU_REPLICA_EXTERNAL_URL`(保留 `url:` 作内网 fallback) |
| 容器透传 | `docker-compose.yml` homepage 服务 `environment:` 块 | `MINERU_REPLICA_EXTERNAL_URL: ${MINERU_REPLICA_EXTERNAL_URL:-}` |
| 主仓库 .env | `authentik-weiqu/.env` | `MINERU_REPLICA_EXTERNAL_URL=https://weiqu.ngrok-free.dev/`(尾 `/` 与 fallback 一致) |
| 重启 | `cd /home/edward/research/authentik-weiqu && docker compose up -d homepage` | 注入新 env var 必须 recreate,`restart` 不够 |
| ngrok 隧道 | `ngrok http 3478 --domain=weiqu-home.ngrok.app` | host port 见 `HOMEPAGE_PORT` |

> ⚠️ `resolve_app_url`([homepage/helpers.py:65-82](外部)) 字面读 env,不做 `${...}` 插值、不规整尾斜杠。

### 6.3 不在本节范围

- **流式接口的 ngrok-free chunked drop**:已修(buffered Content-Length / `text/plain`),与 SSO 无关,部署 SSO 时不必复测。
- **`resource_token` httpOnly cookie**:跨站时 SameSite=Lax 会限制,但 SSO 主路径不经过它(走 Bearer header),业务 API 不受影响;只在资源下载快路径(image 直链、PDF 预览)受限,实际遇到再追加 `cookie.samesite="none"` + `secure=true`。

### 6.4 一次性验证清单

```bash
# 1. JWT secret 两边一致(§1 fingerprint 块)
# 2. 新容器拿到真 secret
docker inspect mineru-replica --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | awk -F= '/^JWT_SECRET_KEY=/{print "len="length($2)}'   # 期望 64
# 3. homepage 卡片 URL
curl -s https://weiqu-home.ngrok.app/ | grep -oE 'href="[^"]*"[^>]*>[^<]*文件处理'
# 4. 浏览器无痕开 https://weiqu-home.ngrok.app/ 登录 → 点「文件处理」→
#    URL 应短暂出现 #access_token=... 然后被 §2.1 IIFE 抹掉,
#    localStorage.auth_token 有值,/api/auth/me 200。
```
