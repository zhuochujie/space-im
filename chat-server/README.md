# Chat Server

基于 NestJS 和 OpenIM Server 的认证服务，提供手机号/密码注册和登录接口。

OpenIM Server 本身不负责业务用户的密码验证。本服务在 MongoDB 保存 Argon2id
密码哈希，注册成功后将用户导入 OpenIM，登录成功后返回 OpenIM 用户
token。

## 配置

复制 `.env.example` 中的配置到运行环境：

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | HTTP 服务端口 | `3000` |
| `ADMIN_SESSION_SECRET` | 后台登录会话签名密钥 | 必填 |
| `SPACE_ADMIN_PHONE_NUMBER` | 初始后台管理员手机号 | 可选 |
| `SPACE_ADMIN_PASSWORD` | 初始后台管理员密码（仅首次创建时写入） | 可选 |
| `MONGODB_URI` | MongoDB 连接地址 | `mongodb://mongo:27017` |
| `MONGODB_DATABASE` | MongoDB 数据库名称 | `chat_server` |
| `MONGO_USERNAME` | MongoDB 用户名 | 可选 |
| `MONGO_PASSWORD` | MongoDB 密码 | 可选 |
| `MONGO_AUTH_SOURCE` | MongoDB 认证数据库 | `chat_server` |
| `OPENIM_API_URL` | OpenIM REST API 地址 | 必填 |
| `OPENIM_SECRET` | OpenIM `config/share.yml` 中的 secret | 必填 |
| `OPENIM_ADMIN_USER_ID` | OpenIM 管理员用户 ID | `imAdmin` |
| `OPENIM_MESSAGE_SEARCH_PATH` | OpenIM 消息查询接口路径 | `/msg/search_msg` |

项目启动时会自动读取根目录的 `.env` 文件。Docker Compose 或部署平台也可以直接
注入这些环境变量，系统环境变量的优先级高于 `.env`。在 Docker Compose 中使用
`mongo`、`openim-server` 这类容器服务名；如果在宿主机本地开发运行，再改成
`127.0.0.1` 和映射端口。

使用 `openim-docker/docker-compose.yaml` 部署时，不需要单独复制
`chat-server/.env.example`。请复制并编辑 `openim-docker/.env.example`：

```bash
cd openim-docker
cp .env.example .env
```

Compose 会把 `SPACE_CHAT_*` 配置注入到 `chat-server` 容器。

## 启动

```bash
npm install
MONGODB_URI=mongodb://127.0.0.1:37017 \
MONGO_USERNAME=chatService \
MONGO_PASSWORD=chatService123 \
MONGO_AUTH_SOURCE=chat_server \
ADMIN_SESSION_SECRET=change-me \
SPACE_ADMIN_PHONE_NUMBER=18888888888 \
SPACE_ADMIN_PASSWORD=password123 \
OPENIM_API_URL=http://127.0.0.1:10002 \
OPENIM_SECRET=openIM123 \
npm run start:dev
```

## 文档

- 接口文档：[docs/api.md](docs/api.md)
- 接口测试：[api.http](api.http)

## 验证

```bash
npm run build
npm test -- --runInBand --no-watchman
npm run test:e2e -- --runInBand --no-watchman
```
