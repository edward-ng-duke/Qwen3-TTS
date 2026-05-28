# apps.yaml 填写指南

> 这份文档讲怎么在 [homepage/config/apps.yaml](homepage/config/apps.yaml) 加一张应用卡片、改一张已有卡片、或者新增分类。
>
> **跟它互补的另一份文档**：[INTEGRATING_APPS_WITH_JWT_SSO.md](INTEGRATING_APPS_WITH_JWT_SSO.md) — 讲目标 app 那一侧（前端 loader + 后端 verify）要怎么改才能"免登录跳进来"。本文档**只管 homepage 这一侧 YAML 怎么填**。

---

## TL;DR

最常见的需求：**加一个新 app，要免登录跳转**。复制以下模板到 [apps.yaml](homepage/config/apps.yaml) 的 `apps:` 列表末尾，改 7 处即可：

```yaml
  - id: my-cool-app                          # ① 英文 kebab-case 全局唯一
    name: "我的炫酷工具"                       # ② 中文卡片标题
    description: "一句话简介，会显示在标题下方"   # ③ 副标题（可省）
    url: "https://my-cool-app.ngrok.app/"     # ④ 你 app 的入口 URL
    share_token: true                          # ⑤ 要免登录跳转就填 true
    icon: "🚀"                                 # ⑥ emoji（或换成 icon_svg）
    color: "#2563eb"                           # ⑦ 卡片强调色（hex）
    category: "办公协作"                       # 用现有分类名
    keywords: "工具 自动化 my cool"             # 可省，给搜索面板用
```

改完执行：

```bash
docker compose restart homepage
```

——刷新浏览器即生效。**不需要 build 镜像**（yaml 通过 volume 挂入容器，每次请求重读）。

---

## 字段一览（按重要性排序）

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| `id` | **必填** | string (kebab-case) | 全局唯一，URL `/go/<id>` 会用到。建议短、见名知意 |
| `name` | **必填** | string | 卡片标题，4-8 字最美观 |
| `url` | **二选一** | URL string | 入口地址。不带 fragment（homepage 会拼） |
| `url_env` | **二选一** | string | env 变量名，运行时从环境读 URL 覆盖 `url`。两者至少填一个 |
| `share_token` | 推荐 | bool | `true` = 跳转带 JWT 免登录；缺省 = 不带 |
| `description` | 可选 | string | 副标题，<20 字最佳 |
| `icon` | 二选一 | 1 char | emoji 或单字符 |
| `icon_svg` | 二选一 | string | 18×18 inline SVG，效果更精致 |
| `color` | 可选 | hex `#RRGGBB` | 卡片左侧强调彩条 + 图标晕色。缺省 `#6366f1` |
| `category` | 可选 | string | 必须匹配 yaml 顶部 `categories:` 块的某个 key |
| `keywords` | 可选 | string | 搜索面板关键词，**空格分隔**（不是逗号） |
| `groups` | 可选 | list[string] | OIDC 群组白名单（**本地模式慎用，见下方陷阱**） |
| `beta` | 可选 | bool | `true` 显示「BETA」角标 |
| `maintain` | 可选 | bool | `true` 点击卡片弹「维护中」模态，不跳转 |
| `locked` | 可选 | bool | `true` 点击卡片弹「权限申请」模态，不跳转 |
| `locked_reason` | 可选 | string | `locked: true` 时显示的解释文本 |

---

## 5 个常用模板（直接拷）

### 模板 A：自家 app + 免登录跳转

最常见。配合 `share_token: true` 实现 SSO。

```yaml
  - id: stepfun-bot
    name: "实时语音"
    description: "Stepfun 实时语音对话"
    url: "https://stepfun.ngrok.app/"
    share_token: true
    icon: "🎙"
    color: "#7c3aed"
    category: "语音"
    keywords: "stepfun realtime 语音 实时 对话"
```

### 模板 B：第三方/外部链接（不带 token）

链接到 SaaS / 文档站 / 第三方工具。点击直接跳，**不带 token**。

```yaml
  - id: external-wiki
    name: "团队 Wiki"
    description: "Notion 知识库"
    url: "https://www.notion.so/your-team"
    icon: "📚"
    color: "#475569"
    category: "办公协作"
    keywords: "wiki notion 文档"
```

不写 `share_token` 即可。

### 模板 C：ngrok 地址会变 → 用 env 覆写

ngrok 免费版每次重启 URL 都变。把 URL 通过 docker-compose 环境变量注入，yaml 里只填变量名。

```yaml
  - id: my-app
    name: "我的应用"
    url: "https://placeholder.invalid/"        # 备用值，env 不存在时回退
    url_env: MY_APP_EXTERNAL_URL                # 优先从这个 env 读
    share_token: true
    icon: "🔧"
    color: "#10b981"
    category: "办公协作"
```

然后在 `docker-compose.yml` homepage 服务的 environment 块加：

```yaml
      MY_APP_EXTERNAL_URL: ${MY_APP_EXTERNAL_URL:-}
```

再在 `.env` 里：

```
MY_APP_EXTERNAL_URL=https://abc-xyz.ngrok.app
```

ngrok 重连只改 `.env`，`docker compose restart homepage` 即可，不用动 yaml。

### 模板 D：占位卡（敬请期待）

功能还没上线但想先在工作台占个位。

```yaml
  - id: future-thing
    name: "敬请期待"
    description: "Q3 上线的新功能"
    url: "http://10.0.0.93:3478/coming-soon"   # 跳 homepage 自带的占位页
    icon: "✨"
    color: "#94a3b8"
    category: "模型"
    beta: true
```

`/coming-soon` 是 homepage 内置的占位页，不需要其他配置。

### 模板 E：权限受限的功能（点了弹申请模态）

想让用户看到卡片但点击时引导他申请权限。

```yaml
  - id: admin-only-tool
    name: "高级管理"
    description: "运维专用工具"
    url: "https://admin-tool.local/"
    share_token: true
    icon: "🛡"
    color: "#dc2626"
    category: "控制台"
    locked: true
    locked_reason: "需要运维组权限，请联系 IT"
```

`locked: true` 让点击触发申请模态而不是跳转。`locked_reason` 显示在模态里。

---

## 字段详解（非显然的部分）

### `id`：URL 的一部分，慎改

- 必须 kebab-case（小写 + 连字符）、全局唯一
- 一旦发布后**不要随便改**：用户的「收藏」「最近使用」「历史记录」都用 id 关联，改了等同于删除老卡片创建新卡片
- 出现在 `/go/<id>` URL 里，太长不好看，建议 ≤ 25 字符

### `url` vs `url_env`

- **二选一，但至少要有一个能解析出 URL**，否则 homepage 启动会跳过这条 app 并打 warning
- 优先级：`url_env` 指向的环境变量值（如果非空）> `url` 字面值
- 用 `url_env` 的好处：URL 变化（ngrok / 端口调整）不用改 yaml，改 `.env` 即可
- 实现见 [helpers.py:66-81](homepage/helpers.py#L66-L81)

### `share_token`：跨 app SSO 的开关

- **仅在 `AUTH_MODE=local` 时生效**；oidc 模式下永远不带 token（用户走 Authentik OIDC 流程各 app 各自完成）
- 设了之后，homepage 点击卡片会拼 `#access_token=<jwt>` 到 URL fragment
- 目标 app 需要做前端 loader + 后端 verify 才能用——参见 [INTEGRATING_APPS_WITH_JWT_SSO.md](INTEGRATING_APPS_WITH_JWT_SSO.md)
- 第三方 app / 无法改源码的 app **不要**设 `share_token: true`（设了它们也不会读 fragment，无副作用，但 token 会"暴露"在用户的浏览器地址栏里几秒钟，无意义）

### `icon` vs `icon_svg`

- 两者都填时 `icon_svg` 优先
- emoji 简单粗暴；SVG 跟现有应用风格统一更精致
- SVG 标准模板（直接改 `path` 即可）：

  ```yaml
  icon_svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="..."/></svg>'
  ```

  关键参数：`width="18"`、`height="18"`、`viewBox="0 0 24 24"`、`stroke="currentColor"`（继承卡片色）、`stroke-width="2.1"`（手感最佳）
- 找 SVG 推荐 [Lucide](https://lucide.dev/) / [Heroicons](https://heroicons.com/) / [Tabler](https://tabler.io/icons) 三套（都是 24×24 outline 风格，跟现有卡片一致）。复制 SVG，把宽高改成 `18`，把 stroke-width 调到 `2.1`

### `color`：选 5 个常用色

跟现有卡片视觉统一推荐这 5 个：

| 用途 | hex |
|---|---|
| 蓝（默认/办公） | `#2563eb` |
| 紫（创意/语音/AI） | `#7c3aed` |
| 青（检索/数据） | `#0891b2` |
| 绿（工具/效率） | `#10b981` |
| 红（管理/审计） | `#dc2626` |
| 灰（占位/暂未启用） | `#94a3b8` |
| 深色（控制台） | `#0b1220` |

不写 `color` 默认 `#6366f1`（紫蓝偏冷）。

### `category`：必须匹配现有分类 key

现有 5 个（看 [apps.yaml:29-49](homepage/config/apps.yaml#L29-L49) 的 `categories:` 块）：

- `控制台` — 管理与运营中心
- `办公协作` — 日常文书与会议协作
- `检索` — 跨库联合知识检索
- `语音` — 语音转写与实时助手
- `模型` — 基础模型与工具

填别的字符串不会报错但会归入「全部」分组（视觉上散落）。要新增分类见下一节。

### `keywords`：**空格**分隔，不是逗号

```yaml
keywords: "搜索 语义 知识库 search rag"     # 对
keywords: "搜索,语义,知识库"                  # 错（会被当成一个长词）
```

中英文都能写，搜索面板支持模糊匹配。

### `groups`：**本地模式陷阱！**

`groups` 是给 OIDC 模式用的群组白名单。在本地模式（`AUTH_MODE=local`）下：

- 本地用户的 `groups` 字段**只有 `["admin"]` 或 `["user"]` 两种**（从 `users.role` 派生）
- 如果你给某 app 设 `groups: [some-custom-group]`，本地模式下**所有人都看不到这张卡**
- 这正是 `weiqu-console` 在本地模式下"消失"的原因（它要求 `weiqu-console-admin` 群组）

**本地模式建议**：

- 不写 `groups` → 所有登录用户都能看到
- 真的要限制某些卡片只给 admin 看 → 写 `groups: [admin]`（注意是字面 `admin`，跟 role 对齐）
- 跨多群组的细粒度控制 → 切回 OIDC 模式，由 Authentik 管群组

### `beta` / `maintain` / `locked`

- `beta: true` → 卡片右上角显示「BETA」徽章，不影响点击
- `maintain: true` → 点击不跳转，弹「维护中」模态
- `locked: true` → 点击不跳转，弹「申请权限」模态；可配 `locked_reason: "原因说明"`

三者互斥不要同时写。

---

## 新增分类（少见，但要会）

在 yaml 顶部 `categories:` 块加一条：

```yaml
categories:
  # ... 已有分类不动 ...
  分析:                              # 分类 key（中文也行）
    color: "#0891b2"                 # 必填，hex
    tip: "数据分析与可视化"            # 必填，鼠标悬停提示
    icon_svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg>'
```

注意分类的 SVG 是 **14×14**，不是 app 卡片的 18×18。

然后 app 条目 `category` 字段填这个新 key 即可：`category: "分析"`。

---

## 修改后怎么生效

| 改了什么 | 怎么生效 |
|---|---|
| 只动 [apps.yaml](homepage/config/apps.yaml) | `docker compose restart homepage`（约 3 秒） |
| 动了 [docker-compose.yml](docker-compose.yml) 或 `.env`（如 `url_env`） | `docker compose up -d homepage`（recreate 容器） |
| 动了 homepage 代码 | `docker compose build homepage && docker compose up -d --force-recreate homepage` |
| 本地开发（`make dev`） | 不用做任何事，`--reload` 自动重读 yaml |

刷新浏览器时**强制刷新**（Ctrl+Shift+R / Cmd+Shift+R），否则浏览器缓存的旧 catalog JSON 不会更新。

---

## 常见错误 / 排错

### "我加了卡片，工作台不显示？"

按顺序排查：

1. **重启了吗？** `docker compose restart homepage`
2. **强制刷新浏览器了吗？** 不是普通 F5
3. **`groups:` 写了 OIDC 群组名 + 你在本地模式？** 删掉 `groups:` 试试
4. **`category` 拼错了？** 看 yaml 顶部 `categories:` 块的 key，必须完全一致
5. **`id` 跟别的 app 撞了？** 启动日志会报 `Duplicate id`，看 `docker compose logs homepage`
6. **`url` 和 `url_env` 都没设？** 启动日志会跳过这条并 warning
7. **缩进错了？** yaml 对缩进敏感。新条目里所有字段必须比 `- id:` 多缩 2 格

### "卡片显示了，但点击没反应？"

- F12 → Console → 看 JS 错误
- F12 → Network → 看 `/api/history` 请求是否成功（点击会先 POST 一条 history）
- 看 `data-url` / `data-id` 是不是空的（F12 → Elements → 找 `.app-card`）

### "免登录跳转过去，目标 app 还是要求登录？"

- 目标 app 那边的前端 loader / 后端 verify 都做了吗？参见 [INTEGRATING_APPS_WITH_JWT_SSO.md](INTEGRATING_APPS_WITH_JWT_SSO.md) §3 + §4
- 启动日志 `jwt_fp=` 是否两边一致？不一致 = secret 不同，token 验不过
- 你 yaml 里写了 `share_token: true` 没？
- homepage 是 `AUTH_MODE=local` 不是 `oidc`？

### "Yaml 改错把整个工作台搞挂了？"

- `docker compose logs --tail=30 homepage` 看启动报错
- 最常见：缩进、引号没闭合、列表项忘了开头 `- `
- 回滚：`git checkout homepage/config/apps.yaml`，重启容器

---

## FAQ

**Q: 同一个 app 我想在「办公协作」和「检索」两个分类下都显示，行吗？**

A: 不行。一个 `id` 只能在一个 `category` 里。如果真的想，复制条目改 `id`（如 `my-app` + `my-app-search`），但用户搜索时会出现两张卡，体验不好。建议改用 `keywords` 让搜索跨分类命中。

**Q: 卡片排序怎么控制？**

A: 当前按 yaml 里的出现顺序渲染（每个分类内独立）。想调位置就在 yaml 里上下挪条目即可。

**Q: 我想做"管理员才能看到的卡片"，本地模式怎么搞？**

A: 写 `groups: [admin]`（字面 `admin`，跟 `users.role` 对齐）。`user` 角色用户看不到，`admin` 能看到。

**Q: `share_token: true` 但 ngrok URL 老变，token 拼错了 URL 怎么办？**

A: 不会拼错。homepage 的 `/go/<id>` 端点会运行时读取 catalog（每次请求重读 yaml + env），URL 变了就拿新的去拼 fragment。**配合 `url_env`** 让 URL 完全可热更（参见模板 C）。

**Q: 占位卡也要 `share_token` 吗？**

A: 不需要。占位卡 url 指向 `/coming-soon`（homepage 自己），跳转没意义。

**Q: 删 app 安全吗？**

A: yaml 里删条目是安全的，但用户的「收藏」「最近使用」里那条记录可能残留（指向已不存在的 `id`），UI 上会显示成「未知应用」。彻底清理需要清 Postgres `homepage_db` 里对应表，一般 YAGNI。

---

## 字段速查（一行命令）

`docker compose exec homepage python -c "import yaml; d=yaml.safe_load(open('/app/config/apps.yaml')); [print(a['id'], '→', a.get('url','(no url)')) for a in d['apps']]"`

打印当前所有 app 的 id + url，确认配置生效。
