# 用户系统与权限体系 — 完整迁移指南

> **目标读者**: Code Agent / 开发者
> **源项目**: mygpt-audio-streaming-frontend (Python/FastAPI)
> **截止日期**: 2026-04-09
> **重要**: 两个 app 共享同一个 MongoDB 数据库、同一个 `users` collection、同一个 Elasticsearch 实例

---

## 目录

1. [架构总览](#1-架构总览)
2. [基础设施层 — 环境变量与连接配置](#2-基础设施层--环境变量与连接配置)
3. [数据模型层 — UserDocument](#3-数据模型层--userdocument)
4. [仓库层 — user_repository](#4-仓库层--user_repository)
5. [认证服务层 — auth_service](#5-认证服务层--auth_service)
6. [ES 认证服务层 — es_auth_service](#6-es-认证服务层--es_auth_service)
7. [路由层 — 依赖注入与端点](#7-路由层--依赖注入与端点)
8. [业务权限层 — 数据访问控制](#8-业务权限层--数据访问控制)
9. [应用启动与后台任务](#9-应用启动与后台任务)
10. [最近关键改动（必须对齐）](#10-最近关键改动必须对齐)
11. [Python 依赖](#11-python-依赖)
12. [集成验证检查清单](#12-集成验证检查清单)

---

## 1. 架构总览

系统采用分层架构，从底层到上层：

```
┌─────────────────────────────────────────────────────┐
│                    路由层 (Routes)                     │
│  auth_routes.py — HTTP 端点 + 依赖注入                 │
│  (get_current_user / require_admin / get_optional_user)│
├─────────────────────────────────────────────────────┤
│                   认证服务层 (Services)                 │
│  auth_service.py     — JWT + 密码 + 用户管理           │
│  es_auth_service.py  — ES Token 认证 + 用户同步        │
├─────────────────────────────────────────────────────┤
│                    仓库层 (Repository)                  │
│  user_repository.py  — MongoDB CRUD                   │
├─────────────────────────────────────────────────────┤
│                   数据模型层 (Models)                    │
│  user_model.py       — UserDocument + Enums            │
├─────────────────────────────────────────────────────┤
│                  基础设施层 (Infrastructure)             │
│  MongoDB (motor async) + Elasticsearch (httpx)        │
│  配置: ws_config.py ← YAML + .env + 环境变量           │
└─────────────────────────────────────────────────────┘
```

### 认证流程总览

```
请求到达
  │
  ├─ 有 Authorization: Bearer <jwt> ?
  │    ├─ YES → 解码 JWT → 查 MongoDB 验证用户存在且 active → 返回 user_info
  │    └─ NO  ↓
  │
  ├─ 有 Cookie(token2) 或 Header(X-token-2) ?
  │    ├─ YES → 查 ES → 返回 user_info
  │    └─ NO  → 401 Unauthorized
  │
  └─ 特殊: verify-es-token 端点
       → 查 ES → 在 MongoDB 创建/更新影子用户 → 签发 JWT → 返回 JWT + user_info
```

### 双认证共存规则

| 场景 | 行为 |
|------|------|
| 有 JWT 且有效 | 用 JWT（本地优先） |
| JWT 无效/过期，有 ES Token | 用 ES Token |
| 两者都没有 | 401 |
| ES 用户首次登录 | 调 verify-es-token → 创建影子用户 → 发 JWT |
| ES 用户后续请求 | 用之前拿到的 JWT |

---

## 2. 基础设施层 — 环境变量与连接配置

### 2.1 完整环境变量清单

#### MongoDB 配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `MONGO_ENABLED` | bool | `false` | 是否启用 MongoDB |
| `MONGO_URL` | str | `mongodb://localhost:27017` | MongoDB 连接 URL |
| `DB_NAME` | str | `conference_ws` | 数据库名称 |
| `MONGO_TIMEOUT_MS` | int | `5000` | 单次操作超时（毫秒） |
| `MONGO_MAX_POOL_SIZE` | int | `10` | 连接池大小 |

**⚠️ 重要**: 两个 app 使用相同的 `MONGO_URL` 和 `DB_NAME`，共享同一个 `users` collection。

**当前生产配置**:
```yaml
mongodb:
  MONGO_ENABLED: true
  MONGO_URL: "mongodb://10.0.0.93:27017"
  DB_NAME: "conference_ws"
  MONGO_TIMEOUT_MS: 5000
  MONGO_MAX_POOL_SIZE: 10
```

**带认证的连接字符串**（生产环境推荐通过环境变量覆盖）:
```bash
export MONGO_URL="mongodb://conference_app:<password>@10.0.0.93:27017/conference_ws?authSource=conference_ws"
```

#### JWT 认证配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `JWT_SECRET_KEY` | str | 自动生成随机密钥 | JWT 签名密钥 |
| `JWT_EXPIRE_DAYS` | int | `7` | Token 有效期（天） |
| `MAX_USERS` | int | `50` | 用户数量上限 |

**⚠️ 关键**: 两个 app **必须使用相同的 `JWT_SECRET_KEY`**，否则一个 app 签发的 JWT 另一个无法验证。如果不设置，每次重启会自动生成随机密钥，所有已签发的 token 都会失效。

```bash
# 生成一个密钥，两个 app 共享
export JWT_SECRET_KEY="your-shared-secret-key-here"
```

#### WebSocket 认证配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `WS_AUTH_REQUIRED` | bool | `true` | WebSocket 是否强制认证 |

#### Elasticsearch 外部认证配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ES_AUTH_ENABLED` | bool | `false` | 是否启用 ES 认证 |
| `ES_AUTH_URL` | str | `http://10.0.0.33:9201` | ES 服务地址 |
| `ES_USER_INDEX` | str | `users` | ES 用户索引名称 |
| `ES_AUTH_TIMEOUT` | int | `5` | ES 查询超时（秒） |
| `ES_TOKEN_COOKIE_NAME` | str | `token2` | Cookie 中的 Token 键名 |
| `ES_TOKEN_HEADER_NAME` | str | `X-token-2` | Header 中的 Token 键名 |
| `ES_TOKEN_LENGTH` | int | `32` | 有效 Token 长度 |
| `ES_SYNC_INTERVAL_SECONDS` | int | `300` | 全量同步间隔（秒），0=禁用 |

**当前生产配置**:
```yaml
external_auth:
  ES_AUTH_ENABLED: true
  ES_AUTH_URL: "http://10.0.0.33:9201"
  ES_USER_INDEX: "mygpt_user"
  ES_AUTH_TIMEOUT: 5
  ES_TOKEN_COOKIE_NAME: "token2"
  ES_TOKEN_HEADER_NAME: "X-token-2"
  ES_TOKEN_LENGTH: 32
  ES_SYNC_INTERVAL_SECONDS: 300
```

#### 安全配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ALLOWED_ORIGINS` | str | `http://localhost:5179` | CORS 白名单（逗号分隔） |
| `MAX_AUDIO_SIZE` | int | `20971520` | 最大上传大小（字节，20MB） |
| `RATE_LIMIT_RPM` | int | `3000` | 每分钟请求上限 |

当前生产 CORS 配置:
```yaml
security:
  ALLOWED_ORIGINS: "http://10.0.0.93:5179,http://10.0.0.32:5179,http://localhost:5179"
```

### 2.2 配置加载层级

优先级从低到高：

1. 代码默认值
2. YAML 配置文件 (`config/environments/{ENVIRONMENT}.yaml`)
3. `.env` 文件变量
4. OS 环境变量
5. 命令行参数

选择环境: 在 `config/environments/.env` 中设置 `ENVIRONMENT=office_linux`

### 2.3 MongoDB `users` Collection 索引

两个 app 共享同一个 collection，**只需创建一次索引**（推荐在启动时幂等创建）:

```python
async def ensure_indexes() -> None:
    collection = db["users"]

    # 用户名唯一索引
    await collection.create_index(
        [("username", 1)],
        unique=True,
        name="idx_username_unique"
    )

    # 角色索引（用于筛选）
    await collection.create_index(
        [("role", 1)],
        name="idx_role"
    )

    # 状态索引（用于筛选）
    await collection.create_index(
        [("status", 1)],
        name="idx_status"
    )

    # 创建时间索引（用于排序）
    await collection.create_index(
        [("created_at", -1)],
        name="idx_created_at"
    )
```

### 2.4 Elasticsearch 用户索引

**索引名称**: `mygpt_user`（由 `ES_USER_INDEX` 配置）

**ES 用户文档结构**（由外部系统管理，你的 app 只读）:
```json
{
  "username": "string",
  "realname": "string（显示名称）",
  "is_admin": true/false,
  "tokens": ["32字符token1", "32字符token2"],
  "api_keys": ["key1", "key2"],
  "deepseek_enabled": true/false
}
```

**Token 查询方式**:
```json
POST /mygpt_user/_search
{
  "query": {
    "bool": {
      "must": [
        {"term": {"tokens": "<32字符token>"}}
      ]
    }
  },
  "size": 1
}
```

**全量拉取方式**（用于后台同步）:
```json
POST /mygpt_user/_search
{
  "query": {"match_all": {}},
  "size": 200,
  "sort": [{"username.keyword": "asc"}],
  "search_after": ["上一页最后一条的sort值"]
}
```

---

## 3. 数据模型层 — UserDocument

### 3.1 完整代码

```python
# user_model.py
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
from bson import ObjectId

from your_app.utils.time_utils import format_datetime_iso, get_cst_now

logger = logging.getLogger(__name__)


class UserRole(str, Enum):
    """用户角色 — 只有两个，不要加 guest"""
    ADMIN = "admin"    # 管理员：完全权限
    USER = "user"      # 普通用户


class UserStatus(str, Enum):
    """用户状态"""
    ACTIVE = "active"
    DISABLED = "disabled"


class UserDocument(BaseModel):
    """
    用户 MongoDB 文档模型

    字段分类:
    - 标识: id, username
    - 认证: password_hash, salt
    - 基本信息: display_name, role, status, auth_source
    - 时间戳: created_at, updated_at, last_login, created_by
    """
    id: Optional[str] = Field(default=None, alias="_id")
    username: str = Field(..., min_length=3, max_length=50)
    password_hash: str = Field(..., description="bcrypt 或 SHA256 哈希")
    salt: str = Field(..., description="SHA256 盐值，bcrypt 时为空字符串")
    display_name: str = Field(..., max_length=100)
    role: UserRole = Field(default=UserRole.USER)
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    auth_source: str = Field(default="local", description="local | es")
    created_at: datetime = Field(default_factory=get_cst_now)
    created_by: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=get_cst_now)
    last_login: Optional[datetime] = Field(default=None)

    class Config:
        populate_by_name = True
        use_enum_values = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }

    def to_mongo_dict(self) -> Dict[str, Any]:
        data = self.model_dump(by_alias=True, exclude_none=False)
        if data.get("_id") is None:
            data.pop("_id", None)
        if isinstance(data.get("role"), UserRole):
            data["role"] = data["role"].value
        if isinstance(data.get("status"), UserStatus):
            data["status"] = data["status"].value
        return data

    @classmethod
    def from_mongo_dict(cls, data: Dict[str, Any]) -> Optional["UserDocument"]:
        if data is None:
            return None
        data = dict(data)
        if "_id" in data:
            data["_id"] = str(data["_id"])
        if data.get("created_by"):
            data["created_by"] = str(data["created_by"])
        # ⚠️ 关键: 修正已废弃的角色值（如 guest），回退为 user
        valid_roles = {r.value for r in UserRole}
        if data.get("role") not in valid_roles:
            logger.warning(f"用户 {data.get('username')} 角色 '{data.get('role')}' 无效，回退为 user")
            data["role"] = UserRole.USER.value
        return cls(**data)

    def to_public_dict(self) -> Dict[str, Any]:
        """返回可公开的用户信息（不含密码）"""
        return {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name,
            "role": self.role.value if isinstance(self.role, UserRole) else self.role,
            "status": self.status.value if isinstance(self.status, UserStatus) else self.status,
            "auth_source": self.auth_source,
            "created_at": format_datetime_iso(self.created_at),
            "last_login": format_datetime_iso(self.last_login),
        }

    def is_admin(self) -> bool:
        role_value = self.role.value if isinstance(self.role, UserRole) else self.role
        return role_value == UserRole.ADMIN.value

    def can_create_meeting(self) -> bool:
        role_value = self.role.value if isinstance(self.role, UserRole) else self.role
        return role_value in [UserRole.ADMIN.value, UserRole.USER.value]

    def is_active(self) -> bool:
        status_value = self.status.value if isinstance(self.status, UserStatus) else self.status
        return status_value == UserStatus.ACTIVE.value
```

### 3.2 MongoDB 文档结构

```json
{
  "_id": ObjectId("..."),
  "username": "zhangsan",
  "password_hash": "$2b$12$...(bcrypt格式)",
  "salt": "",
  "display_name": "张三",
  "role": "admin",
  "status": "active",
  "auth_source": "es",
  "created_at": ISODate("2026-03-15T10:00:00+08:00"),
  "created_by": "es_sync",
  "updated_at": ISODate("2026-04-09T14:30:00+08:00"),
  "last_login": ISODate("2026-04-09T14:30:00+08:00")
}
```

### 3.3 查询/更新构建器

```python
class UserQuery:
    @staticmethod
    def find_by_id(user_id: str) -> Dict:
        try:
            return {"_id": ObjectId(user_id)}
        except Exception:
            return {"_id": user_id}

    @staticmethod
    def find_by_username(username: str) -> Dict:
        return {"username": username}

    @staticmethod
    def find_active_users() -> Dict:
        return {"status": "active"}

    @staticmethod
    def find_admins() -> Dict:
        return {"role": "admin"}


class UserUpdate:
    @staticmethod
    def update_login() -> Dict:
        return {"$set": {"last_login": get_cst_now(), "updated_at": get_cst_now()}}

    @staticmethod
    def update_password(password_hash: str, salt: str) -> Dict:
        return {"$set": {"password_hash": password_hash, "salt": salt, "updated_at": get_cst_now()}}

    @staticmethod
    def update_profile(display_name=None, role=None) -> Dict:
        updates = {"updated_at": get_cst_now()}
        if display_name is not None:
            updates["display_name"] = display_name
        if role is not None:
            updates["role"] = role
        return {"$set": updates}
```

---

## 4. 仓库层 — user_repository

### 4.1 模块结构

```python
# user_repository.py — 函数式模块，无 class

_db = None                    # 模块级状态，启动时通过 init() 注入
_collection_name = "users"    # ⚠️ 两个 app 共享此 collection
```

### 4.2 关键函数签名

```python
def init(db) -> None:
    """初始化仓储，传入 AsyncIOMotorDatabase 实例。在 app lifespan startup 中调用。"""

async def create(user: UserDocument) -> Optional[str]:
    """创建用户，返回 user_id 或 None"""

async def get_by_id(user_id: str) -> Optional[UserDocument]:
    """按 ID 获取用户"""

async def get_by_username(username: str) -> Optional[UserDocument]:
    """按用户名获取用户"""

async def list_users(page=1, limit=20, role=None, status=None) -> Tuple[List[UserDocument], int]:
    """分页列出用户"""

async def exists_by_username(username: str) -> bool:
    """检查用户名是否已存在"""

async def update(user_id: str, updates: dict) -> bool:
    """更新用户字段（自动追加 updated_at）"""

async def update_last_login(user_id: str) -> bool:
    """更新最后登录时间"""

async def update_password(user_id: str, password_hash: str, salt: str) -> bool:
    """更新密码"""

async def set_status(user_id: str, status: UserStatus) -> bool:
    """设置用户状态"""

async def delete(user_id: str) -> bool:
    """硬删除用户"""

async def count_by_role() -> Dict[str, int]:
    """按角色统计用户数"""

async def count_total() -> int:
    """获取用户总数"""

async def ensure_indexes() -> None:
    """确保索引存在（幂等）"""
```

### 4.3 关键实现细节

**_id 查询兼容**: 由于历史原因，user_id 可能是 ObjectId 也可能是字符串，所以查询用 `$in`:

```python
def _id_filter(user_id: str) -> dict:
    try:
        return {"_id": {"$in": [ObjectId(user_id), user_id]}}
    except (InvalidId, Exception):
        return {"_id": user_id}
```

**更新操作**: 所有 update 自动追加 `updated_at`:

```python
async def update(user_id: str, updates: Dict[str, Any]) -> bool:
    collection = _get_collection()
    updates["updated_at"] = get_cst_now()
    result = await collection.update_one(
        _id_filter(user_id),
        {"$set": updates}
    )
    return result.modified_count > 0
```

---

## 5. 认证服务层 — auth_service

### 5.1 完整代码

这是核心模块，贴完整代码:

```python
# auth_service.py — 函数式模块
import os, logging, hashlib, hmac, secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple

import bcrypt as _bcrypt
import jwt

from your_app.models.user_model import UserDocument, UserRole, UserStatus
from your_app.repositories import user_repository
from your_app.utils.time_utils import get_cst_now

logger = logging.getLogger(__name__)

# ─── 配置常量 ───────────────────────────────────────
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
if not JWT_SECRET_KEY:
    JWT_SECRET_KEY = secrets.token_urlsafe(48)
    logger.warning("⚠️ JWT_SECRET_KEY 未设置，已自动生成随机密钥（重启后所有 token 失效）")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = int(os.environ.get("JWT_EXPIRE_DAYS", "7"))
JWT_REMEMBER_ME_DAYS = 30
SALT_LENGTH = 16
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"
DEFAULT_ADMIN_DISPLAY_NAME = "系统管理员"
MAX_USERS = int(os.environ.get("MAX_USERS", "50"))


# ─── 密码处理 ───────────────────────────────────────

def generate_salt() -> str:
    return secrets.token_hex(SALT_LENGTH)

def hash_password(password: str, salt: str) -> str:
    """SHA256 + 盐值（旧格式，仅用于验证历史密码）"""
    salted = f"{salt}{password}{salt}"
    return hashlib.sha256(salted.encode('utf-8')).hexdigest()

def verify_password(password: str, salt: str, password_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password, salt), password_hash)

def hash_password_bcrypt(password: str) -> str:
    """bcrypt 哈希（推荐，新密码统一使用）"""
    return _bcrypt.hashpw(password.encode('utf-8'), _bcrypt.gensalt()).decode('utf-8')

def verify_password_bcrypt(password: str, password_hash: str) -> bool:
    return _bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def is_bcrypt_hash(password_hash: str) -> bool:
    return password_hash.startswith("$2b$")


# ─── JWT Token ──────────────────────────────────────

def create_token(user_id: str, username: str, role: str, expire_days: Optional[int] = None) -> str:
    now = datetime.utcnow()
    days = expire_days if expire_days is not None else JWT_EXPIRE_DAYS
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(days=days)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_token_user_info(token: str) -> Optional[Dict[str, Any]]:
    payload = decode_token(token)
    if not payload:
        return None
    return {
        "user_id": payload.get("sub"),
        "username": payload.get("username"),
        "role": payload.get("role")
    }


# ─── 认证操作 ───────────────────────────────────────

async def authenticate(username: str, password: str, remember_me: bool = False) -> Tuple[Optional[str], Optional[str]]:
    """
    用户认证（登录）
    Returns: (token, error_message)
    """
    user = await user_repository.get_by_username(username)
    if not user:
        return None, "用户名或密码错误"

    if not user.is_active():
        return None, "用户已被禁用"

    # 验证密码（支持 bcrypt 和旧 SHA-256 格式）
    if is_bcrypt_hash(user.password_hash):
        if not verify_password_bcrypt(password, user.password_hash):
            return None, "用户名或密码错误"
    else:
        if not verify_password(password, user.salt, user.password_hash):
            return None, "用户名或密码错误"
        # ⚠️ 透明迁移到 bcrypt
        new_hash = hash_password_bcrypt(password)
        await user_repository.update_password(user.id, new_hash, salt="")
        logger.info(f"用户 {username} 密码哈希已迁移到 bcrypt")

    await user_repository.update_last_login(user.id)

    role = user.role.value if isinstance(user.role, UserRole) else user.role
    expire_days = JWT_REMEMBER_ME_DAYS if remember_me else None
    token = create_token(user.id, user.username, role, expire_days=expire_days)
    return token, None


async def create_user(
    username: str, password: str, display_name: str,
    role: str = "user", created_by: Optional[str] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    创建新用户
    Returns: (user_id, error_message)
    """
    if len(username) < 3:
        return None, "用户名至少 3 个字符"
    if len(username) > 50:
        return None, "用户名最多 50 个字符"
    if len(password) < 6:
        return None, "密码至少 6 个字符"

    valid_roles = [r.value for r in UserRole]
    if role not in valid_roles:
        return None, f"无效的角色，可选: {', '.join(valid_roles)}"

    if await user_repository.exists_by_username(username):
        return None, "用户名已存在"

    current_count = await user_repository.count_total()
    if current_count >= MAX_USERS:
        return None, f"已达到用户数量上限（{MAX_USERS}）"

    password_hash = hash_password_bcrypt(password)
    user = UserDocument(
        username=username, password_hash=password_hash, salt="",
        display_name=display_name, role=UserRole(role),
        status=UserStatus.ACTIVE, created_by=created_by
    )
    user_id = await user_repository.create(user)
    if not user_id:
        return None, "创建用户失败，请重试"
    return user_id, None


async def sync_es_user_to_local(es_user_info: dict) -> Tuple[Optional[str], Optional[dict]]:
    """
    将 ES 认证用户同步到本地 MongoDB，签发本地 JWT。
    弱一致性：仅在用户通过 ES Token 登录时触发。
    - 已存在：更新 display_name / role / last_login
    - 不存在：创建影子用户（随机密码，auth_source=es）
    Returns: (jwt_token, local_user_public_dict) 或 (None, None)
    """
    username = es_user_info.get("username", "")
    if not username:
        return None, None

    display_name = es_user_info.get("display_name") or username
    role = es_user_info.get("role", "user")
    local_user = await user_repository.get_by_username(username)

    if local_user:
        updates = {"last_login": get_cst_now()}
        if local_user.display_name != display_name:
            updates["display_name"] = display_name
        local_role = role if role in ("admin", "user") else "user"
        current_role = local_user.role.value if isinstance(local_user.role, UserRole) else local_user.role
        if current_role != local_role:
            updates["role"] = local_role
        if getattr(local_user, "auth_source", "local") != "es":
            updates["auth_source"] = "es"
        await user_repository.update(local_user.id, updates)
        local_user = await user_repository.get_by_id(local_user.id)
    else:
        random_password = secrets.token_urlsafe(24)
        user_id, error = await create_user(
            username=username, password=random_password,
            display_name=display_name, role=role, created_by="es_sync",
        )
        if error:
            return None, None
        await user_repository.update(user_id, {"auth_source": "es"})
        local_user = await user_repository.get_by_id(user_id)

    if not local_user:
        return None, None

    local_role = local_user.role.value if isinstance(local_user.role, UserRole) else local_user.role
    token = create_token(local_user.id, local_user.username, local_role)
    return token, local_user.to_public_dict()


async def sync_all_es_users() -> dict:
    """
    从 ES 全量拉取用户并批量同步到本地 MongoDB（后台任务调用）。
    不签发 JWT，仅同步数据。
    Returns: {"total", "created", "updated", "failed"}
    """
    from your_app.services import es_auth_service

    stats = {"total": 0, "created": 0, "updated": 0, "failed": 0}
    if not es_auth_service.is_enabled():
        return stats

    es_users = await es_auth_service.query_all_users()
    stats["total"] = len(es_users)

    for es_doc in es_users:
        username = es_doc.get("username", "")
        if not username:
            stats["failed"] += 1
            continue
        display_name = es_doc.get("realname") or username
        role = es_auth_service.map_es_role(es_doc)

        try:
            local_user = await user_repository.get_by_username(username)
            if local_user:
                updates = {}
                if local_user.display_name != display_name:
                    updates["display_name"] = display_name
                current_role = local_user.role.value if isinstance(local_user.role, UserRole) else local_user.role
                if current_role != role:
                    updates["role"] = role
                if getattr(local_user, "auth_source", "local") != "es":
                    updates["auth_source"] = "es"
                if updates:
                    await user_repository.update(local_user.id, updates)
                    stats["updated"] += 1
            else:
                random_password = secrets.token_urlsafe(24)
                user_id, error = await create_user(
                    username=username, password=random_password,
                    display_name=display_name, role=role, created_by="es_sync",
                )
                if error:
                    stats["failed"] += 1
                    continue
                await user_repository.update(user_id, {"auth_source": "es"})
                stats["created"] += 1
        except Exception as e:
            logger.error(f"[ES批量同步] 同步用户 {username} 异常: {e}")
            stats["failed"] += 1

    logger.info(f"[ES批量同步] 完成: {stats}")
    return stats


async def change_password(user_id: str, old_password: str, new_password: str) -> Tuple[bool, Optional[str]]:
    """修改密码（用户自己）。Returns: (success, error_message)"""
    user = await user_repository.get_by_id(user_id)
    if not user:
        return False, "用户不存在"
    if is_bcrypt_hash(user.password_hash):
        if not verify_password_bcrypt(old_password, user.password_hash):
            return False, "原密码错误"
    else:
        if not verify_password(old_password, user.salt, user.password_hash):
            return False, "原密码错误"
    if len(new_password) < 6:
        return False, "新密码至少 6 个字符"
    new_hash = hash_password_bcrypt(new_password)
    success = await user_repository.update_password(user_id, new_hash, salt="")
    return (True, None) if success else (False, "更新失败，请重试")


async def reset_password(user_id: str, new_password: str) -> Tuple[bool, Optional[str]]:
    """重置密码（管理员操作）"""
    if len(new_password) < 6:
        return False, "新密码至少 6 个字符"
    user = await user_repository.get_by_id(user_id)
    if not user:
        return False, "用户不存在"
    new_hash = hash_password_bcrypt(new_password)
    success = await user_repository.update_password(user_id, new_hash, salt="")
    return (True, None) if success else (False, "更新失败，请重试")


# ─── 角色权限检查 ────────────────────────────────────

def can_create_meeting(role: str) -> bool:
    """admin 和 user 都可以创建"""
    return role in ["admin", "user"]

def can_manage_users(role: str) -> bool:
    """仅 admin"""
    return role in ["admin"]

def can_end_or_delete_meeting(user_info: dict, meeting_created_by_user_id: Optional[str]) -> bool:
    """
    admin: 可操作所有会议
    user: 只能操作自己创建的
    """
    if not user_info:
        return False
    role = user_info.get("role", "")
    if role == "admin":
        return True
    if role == "user":
        if not meeting_created_by_user_id:
            return True  # 旧数据无创建者，允许
        return user_info.get("user_id", "") == meeting_created_by_user_id
    return False


# ─── 初始化 ─────────────────────────────────────────

async def ensure_admin_exists() -> bool:
    """确保至少存在一个管理员（启动时调用）"""
    try:
        stats = await user_repository.count_by_role()
        admin_count = stats.get("admin", 0)
        if admin_count > 0:
            return True
        user_id, error = await create_user(
            username=DEFAULT_ADMIN_USERNAME,
            password=DEFAULT_ADMIN_PASSWORD,
            display_name=DEFAULT_ADMIN_DISPLAY_NAME,
            role="admin",
        )
        return user_id is not None
    except Exception as e:
        logger.error(f"检查管理员账户失败: {e}")
        return False


async def get_user_by_id(user_id: str) -> Optional[UserDocument]:
    return await user_repository.get_by_id(user_id)

async def get_user_by_username(username: str) -> Optional[UserDocument]:
    return await user_repository.get_by_username(username)

def get_max_users() -> int:
    return MAX_USERS
```

---

## 6. ES 认证服务层 — es_auth_service

### 6.1 完整代码

```python
# es_auth_service.py — 函数式模块
import logging
from typing import Optional, Dict, Any, List
import httpx
from your_app.config.ws_config import config

logger = logging.getLogger(__name__)

# ─── 模块级状态 ─────────────────────────────────────
# 清理时机: app shutdown 时调用 close()
_es_client: Optional[httpx.AsyncClient] = None
_initialized: bool = False


async def init() -> bool:
    """初始化 httpx 客户端连接 ES。启动时调用。"""
    global _es_client, _initialized
    if not config.ES_AUTH_ENABLED:
        logger.info("ES 认证已禁用，跳过初始化")
        return True
    try:
        _es_client = httpx.AsyncClient(
            base_url=config.ES_AUTH_URL,
            timeout=httpx.Timeout(config.ES_AUTH_TIMEOUT)
        )
        _initialized = True
        return True
    except Exception as e:
        logger.error(f"ES 认证服务初始化失败: {e}")
        _initialized = False
        return False


async def close():
    """关闭 ES 客户端。shutdown 时调用。"""
    global _es_client, _initialized
    if _es_client:
        try:
            await _es_client.aclose()
        except Exception:
            pass
        finally:
            _es_client = None
    _initialized = False


def is_enabled() -> bool:
    return config.ES_AUTH_ENABLED and _initialized


def is_valid_token_format(token: Optional[str]) -> bool:
    if token is None:
        return False
    return len(token) == config.ES_TOKEN_LENGTH


def _mask(token: Optional[str]) -> str:
    """Token 脱敏：只显示前6位"""
    if not token:
        return "<empty>"
    return f"{token[:6]}*** (len={len(token)})"


def get_token_from_request(cookies: Dict[str, str], headers: Dict[str, str]) -> Optional[str]:
    """
    从请求中提取 ES Token。优先级: Cookie > Header。
    """
    cookie_name = config.ES_TOKEN_COOKIE_NAME
    header_name = config.ES_TOKEN_HEADER_NAME

    # 优先从 cookie 获取
    token = cookies.get(cookie_name)
    if token is not None and is_valid_token_format(token):
        return token

    # 其次从 header 获取
    token = headers.get(header_name)
    if token is not None and is_valid_token_format(token):
        return token

    # 尝试小写版本
    lower_name = header_name.lower()
    token = headers.get(lower_name)
    if token is not None and is_valid_token_format(token):
        return token

    return None


async def query_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    """通过 Token 查询 ES 用户"""
    if not _es_client or not is_valid_token_format(token):
        return None
    query = {
        "query": {"bool": {"must": [{"term": {"tokens": token}}]}},
        "size": 1
    }
    try:
        response = await _es_client.post(
            f"/{config.ES_USER_INDEX}/_search",
            json=query,
            params={"preference": "primary"}
        )
        if response.status_code != 200:
            return None
        data = response.json()
        hits = data.get("hits", {}).get("hits", [])
        if hits:
            return hits[0].get("_source")
        return None
    except (httpx.TimeoutException, httpx.ConnectError, Exception) as e:
        logger.error(f"[ES查询] 异常: {type(e).__name__}: {e}")
        return None


async def query_all_users(batch_size: int = 200) -> List[Dict[str, Any]]:
    """从 ES 分页拉取所有用户（search_after 方式）"""
    if not _es_client:
        return []
    all_users: List[Dict[str, Any]] = []
    search_after = None
    try:
        while True:
            query: Dict[str, Any] = {
                "query": {"match_all": {}},
                "size": batch_size,
                "sort": [{"username.keyword": "asc"}],
            }
            if search_after is not None:
                query["search_after"] = search_after
            response = await _es_client.post(
                f"/{config.ES_USER_INDEX}/_search", json=query
            )
            if response.status_code != 200:
                break
            data = response.json()
            hits = data.get("hits", {}).get("hits", [])
            if not hits:
                break
            for hit in hits:
                all_users.append(hit["_source"])
            search_after = hits[-1].get("sort")
            if not search_after:
                break
    except Exception as e:
        logger.error(f"[ES全量查询] 异常: {type(e).__name__}: {e}")
    return all_users


def map_es_role(es_user: Dict[str, Any]) -> str:
    """is_admin=true → admin，其他 → user"""
    if es_user.get("is_admin") is True:
        return "admin"
    return "user"


async def authenticate_by_token(token: str) -> Optional[Dict[str, Any]]:
    """
    通过 Token 认证用户。返回标准化用户信息或 None。

    返回格式:
    {
        "user_id": str,
        "username": str,
        "display_name": str,
        "role": "admin" | "user",
        "auth_source": "es",
        "api_keys": list,
        "deepseek_enabled": bool
    }
    """
    if not is_enabled() or not is_valid_token_format(token):
        return None
    es_user = await query_user_by_token(token)
    if not es_user:
        return None
    return {
        "user_id": str(es_user.get("id", "")),
        "username": es_user.get("username", ""),
        "display_name": es_user.get("realname") or es_user.get("username", ""),
        "role": map_es_role(es_user),
        "auth_source": "es",
        "api_keys": es_user.get("api_keys", []),
        "deepseek_enabled": es_user.get("deepseek_enabled", False)
    }
```

---

## 7. 路由层 — 依赖注入与端点

### 7.1 依赖注入函数（核心）

这三个函数是所有端点权限控制的基础，**必须完整实现**:

```python
async def _get_local_user_from_token(token: str) -> Optional[dict]:
    """解析 JWT 并回查数据库，避免已删除/禁用用户继续使用旧 token"""
    token_user = auth_service.get_token_user_info(token)
    if not token_user:
        return None
    user_id = token_user.get("user_id")
    if not user_id:
        return None
    user = await auth_service.get_user_by_id(user_id)
    if not user or not user.is_active():
        return None
    role = user.role.value if hasattr(user.role, "value") else user.role
    status = user.status.value if hasattr(user.status, "value") else user.status
    return {
        "user_id": user.id or user_id,
        "username": user.username,
        "display_name": user.display_name,
        "role": role,
        "status": status,
        "auth_source": "local",
    }


async def get_current_user(
    authorization: Optional[str] = Header(None),
    request: Request = None
) -> dict:
    """
    从请求获取当前用户（支持 JWT + ES Token 双认证）
    优先级: JWT > ES Token
    Raises: HTTPException 401
    """
    # 1. 尝试 JWT 认证
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            user_info = await _get_local_user_from_token(parts[1])
            if user_info:
                return user_info

    # 2. 尝试 ES Token 认证
    if es_auth_service.is_enabled() and request:
        es_token = es_auth_service.get_token_from_request(
            cookies=dict(request.cookies),
            headers=dict(request.headers)
        )
        if es_token:
            user_info = await es_auth_service.authenticate_by_token(es_token)
            if user_info:
                return user_info

    raise HTTPException(status_code=401, detail="未提供有效的认证信息")


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """要求管理员权限。Raises: HTTPException 403"""
    if not auth_service.can_manage_users(current_user.get("role")):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return current_user


async def require_user_or_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """要求至少 user 权限。Raises: HTTPException 403"""
    if not auth_service.can_create_meeting(current_user.get("role")):
        raise HTTPException(status_code=403, detail="权限不足")
    return current_user


async def get_optional_user(
    authorization: Optional[str] = Header(None),
    request: Request = None
) -> Optional[dict]:
    """可选认证，不强制。返回 user_info 或 None"""
    # 逻辑同 get_current_user，但不 raise 401
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            user_info = await _get_local_user_from_token(parts[1])
            if user_info:
                return user_info
    if es_auth_service.is_enabled() and request:
        es_token = es_auth_service.get_token_from_request(
            cookies=dict(request.cookies),
            headers=dict(request.headers)
        )
        if es_token:
            user_info = await es_auth_service.authenticate_by_token(es_token)
            if user_info:
                return user_info
    return None
```

### 7.2 安全规则

| 规则 | 说明 |
|------|------|
| 返回敏感数据的端点 | **必须**使用 `get_current_user` 或 `require_admin` |
| `get_optional_user` | **禁止**用于返回敏感数据的端点 |
| 用户管理端点 | **必须**使用 `require_admin` |
| 日志中 | **禁止**输出 token、密码、API Key，用 `_mask()` 脱敏 |
| WebSocket 连接 | **必须**在握手阶段验证 token |

### 7.3 请求/响应模型

```python
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    remember_me: bool = Field(default=False)

class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    user: Optional[dict] = None
    message: Optional[str] = None

class UserResponse(BaseModel):
    success: bool
    user: Optional[dict] = None
    message: Optional[str] = None

class UserListResponse(BaseModel):
    success: bool
    users: List[dict] = []
    total: int = 0
    page: int = 1
    limit: int = 20
    max_users: int = 50

class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    display_name: str = Field(..., max_length=100)
    role: str = Field(default="user")

class UpdateUserRequest(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=100)
    role: Optional[str] = Field(default=None)
    status: Optional[str] = Field(default=None)

class ChangePasswordRequest(BaseModel):
    old_password: str = Field(...)
    new_password: str = Field(..., min_length=6)

class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6)

class MessageResponse(BaseModel):
    success: bool
    message: Optional[str] = None
```

### 7.4 完整端点清单

#### 认证端点 (prefix: `/api/auth`)

| Method | Path | 认证 | 角色 | 功能 |
|--------|------|------|------|------|
| POST | `/login` | 无 | 无 | 用户登录，返回 JWT + user_info |
| GET | `/me` | `get_current_user` | 任意 | 获取当前用户信息 |
| POST | `/change-password` | `get_current_user` | 任意 | 修改密码 |
| GET | `/verify-es-token` | 无（从 Cookie/Header 提取） | 无 | 验证 ES Token，同步用户，签发 JWT |
| GET | `/auth-config` | 无 | 无 | 返回认证配置（前端用） |

#### 用户管理端点 (prefix: `/api/users`)

| Method | Path | 认证 | 角色 | 功能 |
|--------|------|------|------|------|
| GET | `/` | `require_admin` | admin | 用户列表（分页） |
| POST | `/` | `require_admin` | admin | 创建用户 |
| GET | `/{user_id}` | `require_admin` | admin | 用户详情 |
| PUT | `/{user_id}` | `require_admin` | admin | 更新用户 |
| DELETE | `/{user_id}` | `require_admin` | admin | 删除用户（不能删自己） |
| POST | `/{user_id}/reset-password` | `require_admin` | admin | 重置密码 |
| GET | `/public` | `get_current_user` | 任意 | 活跃用户列表（用于 UI 选人） |

### 7.5 登录速率限制

```python
class LoginRateLimiter:
    """IP 级别的登录速率限制器"""

    def __init__(self, max_attempts: int = 5, lockout_seconds: int = 300):
        self.max_attempts = max_attempts
        self.lockout_seconds = lockout_seconds
        self._failed_attempts: dict = {}  # ip -> {"count": int, "locked_until": float}
        # 清理时机: 在 is_locked() 中过期自动清理

    def is_locked(self, ip: str) -> bool: ...
    def record_failure(self, ip: str) -> None: ...
    def record_success(self, ip: str) -> None: ...
    def get_retry_after(self, ip: str) -> int: ...

# 用法: 在 login 端点中
_login_rate_limiter = LoginRateLimiter()

# 登录前检查
if _login_rate_limiter.is_locked(client_ip):
    retry_after = _login_rate_limiter.get_retry_after(client_ip)
    raise HTTPException(status_code=429, headers={"Retry-After": str(retry_after)})

# 登录失败
_login_rate_limiter.record_failure(client_ip)

# 登录成功
_login_rate_limiter.record_success(client_ip)
```

---

## 8. 业务权限层 — 数据访问控制

### 8.1 权限矩阵

| 操作 | admin | user |
|------|-------|------|
| 登录 | ✅ | ✅ |
| 查看自己的信息 | ✅ | ✅ |
| 修改自己的密码 | ✅ | ✅ |
| 创建资源（如会议） | ✅ | ✅ |
| 删除自己创建的资源 | ✅ | ✅ |
| 删除他人创建的资源 | ✅ | ❌ |
| 查看所有资源 | ✅ | ❌（只看自己的+公开的） |
| 管理用户 | ✅ | ❌ |
| 重置他人密码 | ✅ | ❌ |

### 8.2 数据过滤模式

对于有所有权概念的资源（如会议），非 admin 用户只能看到:

```python
# 构建查询条件示例
if user_role != "admin":
    query["$or"] = [
        {"allowed_participants": None},         # 公开资源
        {"allowed_participants": []},
        {"allowed_participants": {"$exists": False}},
        {"created_by_user_id": viewer_user_id}, # 自己创建的
        {"participants": viewer_user_id},        # 参与者
        {"allowed_participants": viewer_user_id}, # 白名单
    ]
# admin 不加 $or 过滤 → 看到所有
```

### 8.3 资源级权限检查

```python
def can_end_or_delete_resource(user_info: dict, resource_created_by_user_id: Optional[str]) -> bool:
    role = user_info.get("role", "")
    if role == "admin":
        return True
    if role == "user":
        if not resource_created_by_user_id:
            return True  # 旧数据无创建者
        return user_info.get("user_id", "") == resource_created_by_user_id
    return False
```

---

## 9. 应用启动与后台任务

### 9.1 启动顺序（在 FastAPI lifespan 中）

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # ─── Startup ───
    # 1. 连接 MongoDB
    db = await connect_mongodb(config.MONGO_URL, config.DB_NAME)

    # 2. 初始化用户仓库
    user_repository.init(db)
    await user_repository.ensure_indexes()

    # 3. 确保默认管理员存在
    await auth_service.ensure_admin_exists()

    # 4. 初始化 ES 认证服务
    await es_auth_service.init()

    # 5. 启动后台 ES 同步任务
    es_sync_task = None
    if es_auth_service.is_enabled() and config.ES_SYNC_INTERVAL_SECONDS > 0:
        es_sync_task = asyncio.create_task(periodic_es_user_sync())

    yield

    # ─── Shutdown ───
    if es_sync_task:
        es_sync_task.cancel()
        try:
            await es_sync_task
        except asyncio.CancelledError:
            pass
    await es_auth_service.close()
    await close_mongodb()
```

### 9.2 后台 ES 同步任务

```python
async def periodic_es_user_sync():
    """后台定期全量同步 ES 用户"""
    interval = config.ES_SYNC_INTERVAL_SECONDS
    while True:
        try:
            await asyncio.sleep(interval)
            stats = await auth_service.sync_all_es_users()
            logger.info(f"[ES定期同步] 结果: {stats}")
        except asyncio.CancelledError:
            break  # ⚠️ 必须捕获并 break
        except Exception as e:
            logger.error(f"[ES定期同步] 异常: {e}")
            await asyncio.sleep(30)  # 异常后短暂等待再重试
```

### 9.3 路由注册

```python
# 在 app 创建后调用
from your_app.routes.auth_routes import register_auth_routes
register_auth_routes(app, config)
```

### 9.4 CORS 中间件

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,  # 从环境变量或配置加载
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 10. 最近关键改动（必须对齐）

以下是最近的关键改动，**你的 app 必须同步这些变更**:

### 10.1 guest 角色完全移除

**相关 commits**: `a3e324b`, `e8cc0a0`, `c04cddb`, `c84754b`

- `UserRole` 枚举只有 `ADMIN` 和 `USER`
- `from_mongo_dict()` 中对旧数据的 `role='guest'` 自动回退为 `user`
- 所有权限检查函数只判断 `admin` 和 `user`
- **你的 app 不要有 guest 角色**

### 10.2 ES Token 用户切换检测

**相关 commits**: `0c1b1f1`, `21f8722`

- 前端行为变更: ES 来源的用户在页面刷新时，**不使用缓存的 JWT**，而是始终调用 `/api/auth/verify-es-token` 重新验证
- 目的: 当 ES cookie 切换到另一个用户时，能及时检测并更新本地身份
- 本地用户不受影响（仍用 JWT 缓存）
- **你的 app 前端如果有类似的 auth 缓存逻辑，需要加入同样的判断**

### 10.3 密码从 SHA256 透明迁移到 bcrypt

**行为**: 用户用旧 SHA256 密码登录成功后，自动将密码升级为 bcrypt 格式:
- 新的 `password_hash` 以 `$2b$` 开头
- `salt` 字段设为空字符串（bcrypt 自带盐值）
- **你的 app 必须同时支持验证 bcrypt 和旧 SHA256 格式**

### 10.4 auth_source 字段

- 每个用户文档新增 `auth_source` 字段
- `"local"` = 本地创建的用户
- `"es"` = 从 ES 同步的影子用户
- **你的 app 应能识别此字段**

### 10.5 影子用户机制

- ES 用户首次通过 `verify-es-token` 登录时，在 MongoDB 自动创建影子用户
- 影子用户有随机密码（不可本地登录）
- `created_by = "es_sync"`
- 后续通过 JWT 访问，与本地用户一致
- 后台定期全量同步（每5分钟）确保新 ES 用户也被创建

---

## 10.6 时间工具依赖

代码中引用了 `time_utils` 模块，你需要实现两个函数:

```python
# time_utils.py
from datetime import datetime, timezone, timedelta

CST = timezone(timedelta(hours=8))

def get_cst_now() -> datetime:
    """返回当前 CST（UTC+8）时间"""
    return datetime.now(CST)

def format_datetime_iso(dt: Optional[datetime]) -> Optional[str]:
    """格式化为 ISO 8601 字符串，None 返回 None"""
    if dt is None:
        return None
    return dt.isoformat()
```

---

## 11. Python 依赖

```
# 认证相关
PyJWT>=2.0          # JWT 编解码
bcrypt>=4.0         # 密码哈希（推荐格式）
httpx>=0.24         # ES 认证 HTTP 客户端

# 数据库
motor>=3.0          # MongoDB 异步驱动
pymongo>=4.0        # motor 依赖

# Web 框架
fastapi>=0.100
pydantic>=2.0
uvicorn>=0.20

# 工具
python-dotenv       # .env 加载（可选）
```

---

## 12. 集成验证检查清单

完成迁移后，逐项验证:

### 基础连接
- [ ] MongoDB 连接成功，能读写 `users` collection
- [ ] ES 连接成功（如果启用），能查询 `mygpt_user` 索引
- [ ] `JWT_SECRET_KEY` 与另一个 app 相同
- [ ] `DB_NAME` 与另一个 app 相同 (`conference_ws`)

### 用户 CRUD
- [ ] 启动时自动创建 admin（如果不存在）
- [ ] 用户名唯一索引生效（重复创建报错）
- [ ] 创建用户使用 bcrypt 密码
- [ ] 列出用户支持分页和角色/状态筛选
- [ ] 删除用户不能删自己

### 认证流程
- [ ] 本地用户登录 → 返回 JWT
- [ ] JWT 过期/无效 → 401
- [ ] ES Token 登录 → 创建影子用户 → 返回 JWT
- [ ] 已禁用用户 → 拒绝登录
- [ ] 旧 SHA256 密码登录 → 自动迁移到 bcrypt

### 权限控制
- [ ] 非 admin 调用用户管理接口 → 403
- [ ] user 角色只能操作自己的资源
- [ ] admin 可以操作所有资源
- [ ] `get_optional_user` 未被用于敏感端点

### ES 同步
- [ ] verify-es-token 端点正常工作
- [ ] 后台定期同步运行（日志可见）
- [ ] ES 用户角色正确映射（is_admin → admin）
- [ ] 同步创建的影子用户 `auth_source=es`

### 速率限制
- [ ] 连续 5 次登录失败 → 锁定 300 秒
- [ ] 返回 `Retry-After` header
- [ ] 登录成功后清除失败计数

### 安全
- [ ] 日志中无 token/密码明文
- [ ] CORS 白名单正确配置
- [ ] WebSocket 握手验证 token（如有 WS）

---

> **提示**: 由于两个 app 共享 MongoDB，在一个 app 中创建的用户，另一个 app 立即可见。但 JWT 需要共享相同的 `JWT_SECRET_KEY` 才能跨 app 使用。
