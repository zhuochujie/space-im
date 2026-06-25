# SPACE IM Admin

SPACE IM 管理后台，提供用户管理和消息查询页面。

## 功能

- 用户管理：查询用户、重置密码、禁用或启用登录。
- 消息管理：按发送者、接收者、群 ID、关键词查询聊天记录。
- App 更新：上传安卓最新 APK，维护最新版本元信息。

## 配置与部署

生产构建默认通过 `/api` 访问后端，Docker 镜像内的 Nginx 会把 `/api` 反代到
`chat-server:3000`。本地开发时 Vite 也会把 `/api` 代理到 `http://localhost:3000`。

后台登录使用 chat-server 用户表账号，只有 `isAdmin=true` 的用户可以登录。Docker
部署时可在 `openim-docker/.env` 中配置 `SPACE_ADMIN_PHONE_NUMBER` 和
`SPACE_ADMIN_PASSWORD` 初始化管理员账号。

## 启动

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```
