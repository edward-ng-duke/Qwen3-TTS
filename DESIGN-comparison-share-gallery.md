# DESIGN — 对比作品 + 公开画廊

> Brainstorm 产物（2026-05-28）。本文是 *设计草案*，不是实现计划——决定方向、敲定形状、留好风险记录。具体任务分解和代码改动留到后续 spec / plan 阶段再做。

---

## 1. 背景与定位

Qwen3-TTS 当前的 React Studio 已经能跑完整的"用预置音色合成 → 历史 → 重放 / 下载 / 复制 cURL"闭环，后端有 OpenAI 兼容 API、主站 SSO、JWT 鉴权、Docker 多变体部署、远端 MongoDB（`conference_ws` 库已接入）。

但 App 的 **真实定位** 不是工具，是 **研究 / 能力展示 Demo**：

- **受众**：产品 / 业务合作方——"一听就哇但听不懂参数"
- **场景**：现场演示、微信转发、PR 链接、论文配套页

围绕这个定位，下一步要补的不是更多的合成参数，而是 **让模型卖点"可见"** 和 **让 demo "容易传播"** 的功能。

---

## 2. 范围

### 要做（按本次讨论收敛）

| 主题 | 简述 |
|---|---|
| **B：A/B 并排对比** | Composer 增加"对比模式"，按音色 / 情绪 / 语种 / 温度 / 语速选一个轴，跑出 2–4 条并排卡片 |
| **D-share：公开分享链接** | 任何对比卡片可一键发布，得到 `/share/<slug>` 短链；微信扫码不登录可听 |
| **D-gallery：首页画廊** | 独立路由 `/gallery`，4 个预制场景（9 音色巡礼 / 11 语种同义句 / 7 情绪同句 / 方言专场） |

**关键观察**：B 和 D 共用同一种"对比作品"数据结构和同一个 `<ComparisonCard>` 组件。画廊 = 开发者预制好的、`kind='gallery'` 的对比作品。

### 不做（明确不做）

- 克隆 UI（即便后端 `/v1/clone` 已具备）
- VoiceDesign 描述生成 UI（即便后端 `/v1/tts/design` 已具备）
- 真·token 级流式播放（伪流式继续够用）
- 计费 / API Key / 用量统计 / 配额 / Webhook
- 长文本切分 / 多角色剧本 / SSML / SRT 字幕
- 音频后处理（变速、混音、BGM、淡入淡出）
- "所有生成默认上云" 的 SaaS 模式——本地 IndexedDB 仍是默认历史，只有手动点"发布"才进 Mongo

---

## 3. 数据模型

新增 collection（挂在已经连通的 `conference_ws` Mongo 库里）：

### `tts_share_works`

```jsonc
{
  "_id": ObjectId,
  "slug": "a1b2c3d4",             // 8 位短 ID，URL 用
  "text": "今天的天气真不错",
  "dimension": "voice",            // 对比维度：voice/emotion/language/temperature/speed
  "variants": [
    {
      "id": "v0",
      "label": "vivian",
      "voice": "vivian",
      "language": "zh",
      "emotion": "neutral",
      "temperature": 0.7,
      "top_k": 50,
      "top_p": 0.95,
      "speed": 1.0,
      "audio_path": "shared/a1b2c3d4/v0.wav",
      "duration_ms": 2840
    }
    // ... up to 4 variants for user works, up to 11 for gallery
  ],
  "created_at": ISODate,
  "public": true,
  "kind": "user",                  // "user" | "gallery"
  "gallery_order": null,           // gallery 类型才有：决定首页排序
  "created_by": null               // 用户作品可选填 SSO user id；画廊作品为 null
}
```

**音频文件**：落本地磁盘 `./shared/<slug>/<variant_id>.wav`，对应 docker volume `qwen-tts-shared:/var/qwen-tts/shared`。Mongo 只存路径，不进 GridFS。

**索引**：`slug` 唯一索引；`(kind, gallery_order)` 复合索引用于画廊首页查询。

---

## 4. 后端 API

全部挂在 `/v1/share/*` 路径下——`/v1/*` 已被 SSO 鉴权中间件设为公开（OpenAI 兼容 API 要免登录），分享流自动绕过登录。

### `POST /v1/share/publish`

- **请求**：`multipart/form-data`
  - `metadata`：JSON 字符串，含 `text` / `dimension` / `variants[]` 的非音频字段
  - `audio_<variant_id>`：每个 variant 的 wav 文件
- **行为**：生成 8 位 slug → 落盘 `./shared/<slug>/<variant_id>.wav` → 写 Mongo（`kind='user'`, `public=true`）→ 返回 slug
- **鉴权**：可选登录。登录用户的 `created_by` 写入 SSO id；未登录也允许（保持零门槛，仅做 IP 速率限制）

### `GET /v1/share/<slug>`

- **响应**：完整元数据 + 各 variant 的 `audio_url`（`/v1/share/<slug>/audio/<variant_id>`）
- 404 if not found / `public=false`

### `GET /v1/share/<slug>/audio/<variant_id>`

- **响应**：流式 wav（带 `Range` 支持，方便波形拖拽）
- 鉴权：完全公开

### `GET /v1/gallery`

- **响应**：`{ items: [<work>...] }`，仅返回 `kind='gallery'` 且 `public=true` 的，按 `gallery_order` 升序
- 鉴权：完全公开

### `POST /v1/share/regenerate`（用于画廊"换一句话"按钮）

- **请求**：`{ source_slug, new_text }`
- **行为**：读取 `source_slug` 的 dimension 和 variant 参数 → 对每个 variant 调内部合成 → 返回结果（不落库，临时给当前会话）
- **鉴权**：公开但带 IP 速率限制（`new_text` 长度 ≤ 50 字，单 IP 每分钟 ≤ 3 次）

**实现工具**：用 `motor`（async MongoDB driver）保持 FastAPI 风格一致。

---

## 5. 前端改动（React）

### 5.1 Composer "对比模式"

- 顶部 ToggleGroup：`[关闭] [按音色] [按情绪] [按语种] [按温度] [按语速]`
- 打开后，对应的 selector 变成多选（最多 4 个），其他参数保持单值固定
- Generate 按钮文案 → "并排生成 N 条"
- 调度：前端并发触发 N 个 `/v1/audio/speech`（最多 4 并发），所有完成后写入对比 store

### 5.2 `<ComparisonCard>`（B 和 D 共用的核心组件）

- 横向 2–4 列（画廊的多语言场景可到 11 列，横向滚动）
- 每列：变体 label / 波形缩略 / 播放暂停 / 时长 / 下载按钮
- 顶部："全部同步播"按钮（同时按 play，进度独立显示）
- 右上："发布为公开链接"按钮 → 弹 URL + 二维码（含 ToS 勾选）
- 左上："用这套参数到 Studio" → 把任一变体的参数复刻到 Composer

### 5.3 画廊页 `/gallery`

- 顶部 4 张场景卡：`9 音色巡礼` / `11 语种同义句` / `7 情绪同句` / `方言专场`
- 点进去：`/gallery/<slug>`，复用 `<ComparisonCard>` 渲染
- 页面顶部输入框 + 按钮 "换一句话试试" → 调 `/v1/share/regenerate` → 临时显示新结果，不持久化

### 5.4 分享页 `/share/<slug>`

- 完全公开路由，无登录可达
- 复用 `<ComparisonCard>`
- 底部 CTA："想自己也做一个？登录 Studio" → 跳 SSO

### 5.5 Topbar

- 已登录：`Studio · 画廊 · 主题 · 用户菜单`
- 路由白名单：`/gallery` 和 `/share/*` 必须能在未登录状态访问，前端守卫和后端 SSO 中间件都要放行

---

## 6. 部署 / 一次性脚本

### docker-compose.yml

加一个 named volume，让分享音频跨容器重启持久化：

```yaml
volumes:
  qwen-tts-previews:
  qwen-tts-shared:            # new

services:
  qwen-tts:
    volumes:
      - qwen-tts-previews:/var/qwen-tts/previews
      - qwen-tts-shared:/var/qwen-tts/shared    # new
```

MongoDB 已经通过 `MONGO_URL` 接入，**无需新容器**。

### scripts/seed-gallery.py

首次部署时跑一次：

1. 读取一份 `scripts/gallery-scenarios.json`（场景定义：文本 + dimension + variant 参数列表）
2. 对每个场景，逐个 variant 调本地 `/v1/audio/speech` 拿到 wav
3. 调 `/v1/share/publish` 落库，得到 slug
4. 改 Mongo 把这条记录的 `kind` 改为 `'gallery'`，设置 `gallery_order`

之后维护画廊只需要改 `gallery-scenarios.json` 重跑这个脚本。

---

## 7. 用户旅程

### 7.1 Demo 主人（你自己）

1. Studio 输入文本 → 打开"对比模式：按音色" → 勾 4 个音色
2. Generate → 4 列并排卡片秒出
3. 觉得满意 → 点"发布为公开链接" → 勾 ToS → 拿到 `https://your-site/share/a1b2c3d4`
4. 截图二维码或复制链接，扔进微信 / Slack

### 7.2 微信访客

1. 点链接 → 浏览器打开 `/share/a1b2c3d4`
2. **完全不需要登录**，直接看到 4 列卡片
3. 点"全部同步播" → 听到差异
4. 底部 CTA "想自己做一个？" → 跳 SSO → 登录后回到 Studio

### 7.3 画廊首访者

1. 任何人（含未登录）从 Topbar 点"画廊"或直接进 `/gallery`
2. 看到 4 张场景卡 → 点"11 语种同义句"
3. 进入 `/gallery/<slug>`，11 列卡片渲染好
4. 顶部输入框输入"我爱你" → 点"换一句话" → 11 条重跑
5. 听完想自己玩 → CTA 跳 Studio

---

## 8. 风险与权衡

### 8.1 GPU 并发压力（中）

A/B 对比一次 4 条并行 + 画廊"换一句话"重跑 11 条 + 可能多个访客同时点画廊，最坏情况下 GPU 队列会被压满。

**当前对策**：
- 前端最多 4 并发
- 后端 `/v1/audio/speech` 排队（沿用现有 FastAPI worker 模型）
- 画廊重跑加 IP 速率限制（≤ 50 字 / 单 IP 3 次/分钟）

**升级路径**：如果上线后发现卡，给 `/v1/share/regenerate` 加任务队列 + WebSocket 推送进度。

### 8.2 画廊重跑被滥用（中）

未登录访客就能跑 GPU，存在被脚本刷的可能。

**当前对策**：上面提到的 IP + 文本长度限制。**不**强制登录，因为零门槛是 demo 的核心价值。

**升级路径**：必要时加 Cloudflare Turnstile / reCAPTCHA。

### 8.3 公开链接的内容合规（中–高）

用户可以用 TTS 生成不当内容并发布，链接转发出去 = 你的域名背锅。

**当前对策**：
- 发布按钮带 ToS 勾选（用户声明内容合规）
- 管理员后台可设 `public=false` 下架
- Mongo 记录 `created_by` 便于追溯

**升级路径**：上线给真实流量前必须加内容审核（关键词过滤 / LLM 二次审 / 人工 review）。研究 demo 阶段先这样。

### 8.4 跳过克隆 UI 的代价（中）

A/B 对比的 "哇" 上限有天花板——4 个预置音色之间的差异，不如 "我刚说话 3 秒就被克隆出我的声音" 戏剧。

**当前选择**：用户拍板暂不做克隆 UI。

**升级路径（未来候选）**：见第 9 节。

---

## 9. 未来候选

如果画廊上线后发现 "震撼度不够"，第一个回炉的就是 **加现场克隆 demo 进画廊**：

- 画廊新增第 5 张场景卡："现场克隆 60 秒"
- 浏览器内麦克风录音 3 秒 → 调 `/v1/clone` → 同句话的"原声 vs 克隆声"并排
- 复用 `<ComparisonCard>` 组件（2 列就够）
- 录音和克隆音频也走 `/v1/share/publish` 机制，可分享

这是工程上 **唯一** 需要的"克隆 UI 增量"，避免把整个 Base 变体的工作流前端化。

其他可能的回炉选项（优先级递减）：
- VoiceDesign 描述生成（"中年男 / 温柔 / 广东口音"→ 合成）
- 真·token 级流式 + 首包延迟实时可视化
- 长文本切分 + 多角色剧本

均不在本次设计范围内。
