# `/v1` API 安全迁移说明

适用版本：引入 `qwen_tts.serve.api_security` 之后的版本。

## 行为变化

- 本机 CLI 默认监听地址从 `0.0.0.0` 改为 `127.0.0.1`。
- Docker Compose 默认只发布到宿主机 `127.0.0.1:4967`。
- 非回环暴露时，服务必须满足以下至少一项：
  - 配置静态 `API_TOKEN` / `API_TOKENS`；
  - 启用已有 Mongo/JWT 用户系统；
  - 仅在隔离开发网络由责任人显式设置
    `ALLOW_UNAUTHENTICATED_PUBLIC_API=true`，接受无鉴权风险。
- 需要保护的 `/v1` 路由接受两种凭据：
  - `Authorization: Bearer <token>`；
  - `X-API-Key: <token>`。
- 登录用户也可通过原 `access_token` HttpOnly cookie 或 JWT Bearer 调用。
- 健康检查、语言列表、内置音色列表及已启用的公开分享读取接口保持可读；
  匿名健康检查只返回 `status`、`model_ready` 和 `variant`，不再暴露本地模型路径；
  试听音频首次生成会消耗 GPU，因此需要凭据。
- 生成接口按调用主体执行单进程滑动窗口限流；默认每分钟 20 次。
- `/v1` 写请求按 `Content-Length` 限制为 12 MiB；Base 分支的参考音频和
  `.pt` 声音提示即使使用分块传输，也会在读取 10 MiB 后拒绝。
- 静态 API Token 不能安全注入普通浏览器。仅配置静态 Token、未启用 JWT
  用户系统时，`/`、`/legacy/*` 和接口文档也要求 Bearer/API-Key，避免从
  Gradio 直接调用模型绕过 `/v1` 鉴权。需要公网 UI 时必须启用用户系统。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---:|---|
| `BIND_HOST` | `127.0.0.1` | Compose 在宿主机发布的地址 |
| `API_EXPOSURE_HOST` | 服务监听地址 | 容器用于声明宿主机实际暴露地址；Compose 自动设置 |
| `API_AUTH_REQUIRED` | `auto` | `auto` / `true` / `false` |
| `API_TOKEN` | 空 | 单个静态 Token，建议至少 32 个随机字节 |
| `API_TOKENS` | 空 | 逗号分隔的轮换 Token 列表 |
| `API_RATE_LIMIT_PER_MINUTE` | `20` | 单进程、按用户/API Token/IP 的生成限流 |
| `API_MAX_BODY_BYTES` | `12582912` | 声明的请求体最大字节数 |
| `API_MAX_UPLOAD_BYTES` | `10485760` | Base 参考音频/声音提示读取上限 |
| `ALLOW_UNAUTHENTICATED_PUBLIC_API` | `false` | 隔离开发网临时风险确认，不得用于互联网生产 |

## 推荐配置

API 客户端部署：

```bash
API_TOKEN="$(openssl rand -hex 32)"
export API_TOKEN
export BIND_HOST=0.0.0.0
docker compose up -d
```

服务会拒绝任何少于 32 个字符的 `API_TOKEN/API_TOKENS` 项，错误信息不会回显 Token。推荐使用 `openssl rand -hex 32` 生成 64 个十六进制字符，而不是人工编写口令。

调用：

```bash
curl -X POST http://server:4967/v1/tts \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"text":"安全迁移测试","speaker":"vivian"}' \
  --output out.wav
```

浏览器 UI 部署：启用现有 `AUTH_ENABLED=true`、Mongo 和 JWT 配置，并通过
HTTPS 反向代理暴露。静态 API Token 仅供服务器到服务器调用，不写入前端包。

## OpenAI 客户端迁移

旧代码中的 `api_key="not-needed"` 必须改成真实 `API_TOKEN`：

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://tts.example.com/v1",
    api_key="从密钥管理服务读取，不写进源码",
)
```

## 限制与后续工作

- 当前限流在单个 Python 进程内；多副本必须在网关使用 Redis/集中式限流。
- 通用 JSON 请求大小主要依据 `Content-Length`；生产网关必须同时限制分块请求体。
- 此改造不等于完成实名、内容审核、声音授权、投诉处置、日志留存或生成音频
  标识；这些仍是上线门禁。
- Token 不得写入仓库、前端 JavaScript、URL 查询参数或访问日志。
