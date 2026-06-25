# SPACE IM Docker Deployment

This directory starts SPACE IM dependencies, OpenIM Server, `chat-server`, and the admin console.

## Quick Start

```bash
cd openim-docker
cp .env.example .env
```

Edit at least:

```env
SPACE_ADMIN_PASSWORD=change-to-a-strong-password
SPACE_ADMIN_SESSION_SECRET=change-to-a-long-random-secret
MINIO_EXTERNAL_ADDRESS=http://your-server-ip-or-domain:10005
```

Then start everything with the helper script:

```bash
./deploy.sh
```

Or run Docker Compose directly:

```bash
docker compose up -d --build
```

Default admin account:

```text
Phone: 18888888888
Password: SPACE_ADMIN_PASSWORD
```

Default endpoints:

```text
chat-server: http://server-ip:3000
SPACE IM admin: http://server-ip:18080
OpenIM API: http://server-ip:10002
OpenIM gateway: server-ip:10001
MinIO: http://server-ip:10005
```

Android update APK storage:

```text
openim-docker/components/chat-server/storage/app-updates/android/latest.apk
```

## Logs

```bash
docker compose ps
docker logs -f chat-server
docker logs -f space-admin
docker logs -f openim-server
```

## Update

```bash
docker compose up -d --build chat-server space-admin
```

Use this when dependency service configuration changed:

```bash
docker compose up -d --build
```

## Stop

```bash
docker compose down
```
