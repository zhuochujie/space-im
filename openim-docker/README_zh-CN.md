# SPACE IM Docker 部署

这个目录用于一键启动 SPACE IM 依赖服务、OpenIM Server、`chat-server` 和管理后台。

## 前置条件

- 已安装 Docker 和 Docker Compose 插件。
- 已从仓库根目录保留 `chat-server`、`admin`、`openim-docker` 三个目录。

## 1. 生成配置

```bash
cd openim-docker
cp .env.example .env
```

至少修改下面三项：

```env
SPACE_ADMIN_PASSWORD=请改成强密码
SPACE_ADMIN_SESSION_SECRET=请改成长随机字符串
MINIO_EXTERNAL_ADDRESS=http://你的服务器IP或域名:10005
```

默认会初始化一个后台管理员账号：

```text
手机号：18888888888
密码：SPACE_ADMIN_PASSWORD
```

## 2. 启动服务

推荐使用部署脚本：

```bash
./deploy.sh
```

脚本会在 `.env` 不存在时自动复制 `.env.example`，并提醒你先修改关键配置。

也可以直接执行 Docker Compose：

```bash
docker compose up -d --build
```

启动后访问：

```text
客户端认证接口：http://服务器IP:3000
SPACE IM 管理后台：http://服务器IP:18080
OpenIM API：http://服务器IP:10002
OpenIM 消息网关：服务器IP:10001
MinIO：http://服务器IP:10005
```

安卓在线更新 APK 会持久化在：

```text
openim-docker/components/chat-server/storage/app-updates/android/latest.apk
```

## 3. 查看状态和日志

```bash
docker compose ps
docker logs -f chat-server
docker logs -f space-admin
docker logs -f openim-server
```

## 4. 更新部署

拉取代码后重新构建本项目镜像：

```bash
docker compose up -d --build chat-server space-admin
```

如果依赖服务配置也变了，直接执行：

```bash
docker compose up -d --build
```

## 5. 停止服务

```bash
docker compose down
```

如果需要同时删除容器网络和匿名卷：

```bash
docker compose down -v
```
