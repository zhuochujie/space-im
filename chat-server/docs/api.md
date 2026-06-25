# API 文档

基础地址：

```text
http://localhost:3000
```

可直接使用 [api.http](../api.http) 进行接口测试。

## 统一响应

所有接口返回统一 JSON 结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": 1760000000000,
  "path": "/auth/login"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | number | 业务码。成功为 `0`，异常时为 HTTP 状态码 |
| `message` | string | 成功为 `success`，异常时为错误信息 |
| `data` | object/null | 成功数据。异常时为 `null` |
| `timestamp` | number | 服务端返回时间戳，单位毫秒 |
| `path` | string | 请求路径 |

## 通用错误码

| HTTP 状态码 | 场景 |
| --- | --- |
| `400` | 参数校验失败 |
| `401` | 手机号或密码错误 |
| `404` | 用户不存在 |
| `409` | 手机号已注册 |
| `502` | OpenIM 请求失败或响应异常 |
| `503` | OpenIM 或服务配置缺失 |
| `500` | 服务内部错误 |

## 参数校验规则

| 字段 | 规则 |
| --- | --- |
| `phoneNumber` | 必填，字符串，手机号格式，示例：13800138000 |
| `password` | 必填，字符串，长度 6-128 |
| `platformID` | 登录必填，整数，大于 0。Web 通常为 `5` |

## 健康检查

```http
GET /
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "ok"
  },
  "timestamp": 1760000000000,
  "path": "/"
}
```

## 注册

```http
POST /auth/register
Content-Type: application/json
```

请求体：

```json
{
  "phoneNumber": "18888888888",
  "password": "password123"
}
```

`platformID` 不需要在注册时传入。注册成功后，服务会在 MongoDB 保存 Argon2id
密码哈希，并把用户同步注册到 OpenIM。由于 OpenIM 注册用户时昵称不能为空，
未传昵称时会使用手机号作为默认昵称。

请求示例：

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"13800138000","password":"password123"}'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userID": "1234567890",
    "phoneNumber": "13800138000"
  },
  "timestamp": 1760000000000,
  "path": "/auth/register"
}
```

失败示例：

```json
{
  "code": 409,
  "message": "手机号已注册",
  "data": null,
  "timestamp": 1760000000000,
  "path": "/auth/register"
}
```

## 登录

```http
POST /auth/login
Content-Type: application/json
```

请求体：

```json
{
  "phoneNumber": "13800138000",
  "password": "password123",
  "platformID": 5
}
```

`platformID` 用于向 OpenIM 获取对应平台的用户 token，因此登录时必传。

请求示例：

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"13800138000","password":"password123","platformID":5}'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userID": "1234567890",
    "phoneNumber": "13800138000",
    "token": "OpenIM user token",
    "expireTimeSeconds": 7776000
  },
  "timestamp": 1760000000000,
  "path": "/auth/login"
}
```

失败示例：

```json
{
  "code": 401,
  "message": "手机号或密码错误",
  "data": null,
  "timestamp": 1760000000000,
  "path": "/auth/login"
}
```

参数错误示例：

```json
{
  "code": 400,
  "message": "platformID 必须是整数",
  "data": null,
  "timestamp": 1760000000000,
  "path": "/auth/login"
}
```

## 通过手机号查询 userID

```http
GET /auth/users/by-phone-number?phoneNumber=13800138000
```

该接口按手机号精确匹配，只查询已注册成功的 active 用户。

请求示例：

```bash
curl 'http://localhost:3000/auth/users/by-phone-number?phoneNumber=13800138000'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userID": "1234567890",
    "phoneNumber": "13800138000"
  },
  "timestamp": 1760000000000,
  "path": "/auth/users/by-phone-number?phoneNumber=13800138000"
}
```

## 管理员：登录后台

```http
POST /admin/auth/login
Content-Type: application/json
```

请求体：

```json
{
  "phoneNumber": "13800138000",
  "password": "password123"
}
```

只有用户表中 `isAdmin=true` 且 `status=active` 的用户可以登录后台。Docker
部署时可通过 `SPACE_ADMIN_PHONE_NUMBER` 和 `SPACE_ADMIN_PASSWORD` 初始化一个
管理员账号。

成功响应中的 `token` 用于访问其他 `/admin/*` 接口：

```http
Authorization: Bearer <token>
```

## 管理员：用户列表

```http
GET /admin/users?search=138&status=active&offset=0&count=50
Authorization: Bearer <token>
```

查询参数：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `search` | string | 可选，按手机号或 userID 模糊搜索 |
| `status` | string | 可选，`pending`、`active`、`disabled` |
| `offset` | number | 可选，默认 `0` |
| `count` | number | 可选，默认 `50`，最大 `100` |

## 管理员：重置用户密码

```http
POST /admin/users/1234567890/reset-password
Content-Type: application/json
Authorization: Bearer <token>
```

请求体：

```json
{
  "newPassword": "new-password123"
}
```

## 管理员：禁用 / 启用用户登录

```http
POST /admin/users/1234567890/status
Content-Type: application/json
Authorization: Bearer <token>
```

请求体：

```json
{
  "status": "disabled"
}
```

`status` 只能传 `active` 或 `disabled`。登录接口只允许 `active` 用户登录。

## 管理员：查询聊天记录

```http
GET /admin/messages?sendID=1234567890&recvID=0987654321&keyword=hello&count=50
Authorization: Bearer <token>
```

查询参数会透传到 OpenIM 消息查询接口。默认 OpenIM 路径为 `/msg/search_msg`，
如当前 OpenIM 版本路径不同，可通过 `OPENIM_MESSAGE_SEARCH_PATH` 覆盖。

## App 更新：查询安卓最新版本

```http
GET /app-update/android/latest
```

未上传安装包时 `data` 为 `null`。上传后返回：

```json
{
  "platform": "android",
  "versionCode": 2,
  "versionName": "1.0.1",
  "forceUpdate": false,
  "releaseNotes": "修复已知问题",
  "fileSize": 42000000,
  "sha256": "apk sha256",
  "apkUrl": "http://localhost:3000/app-update/android/download",
  "updatedAt": "2026-06-25T10:00:00.000Z"
}
```

## App 更新：下载安卓最新安装包

```http
GET /app-update/android/download
```

返回最新 APK 文件。

## 管理员：上传安卓最新安装包

```http
PUT /admin/app-update/android?versionCode=2&versionName=1.0.1&forceUpdate=false&releaseNotes=修复已知问题
Content-Type: application/vnd.android.package-archive
Authorization: Bearer <token>

<APK binary>
```

服务器只保存最新一个 APK。上传成功后会覆盖旧 APK，并更新版本元信息。

找不到用户：

```json
{
  "code": 404,
  "message": "用户不存在",
  "data": null,
  "timestamp": 1760000000000,
  "path": "/auth/users/by-phone-number?phoneNumber=13800138000"
}
```
