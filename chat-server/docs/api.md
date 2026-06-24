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
| `401` | 用户名或密码错误 |
| `404` | 用户不存在 |
| `409` | 用户名已存在 |
| `502` | OpenIM 请求失败或响应异常 |
| `503` | OpenIM 或服务配置缺失 |
| `500` | 服务内部错误 |

## 参数校验规则

| 字段 | 规则 |
| --- | --- |
| `username` | 必填，字符串，长度 3-32，只能包含字母、数字、下划线、点和短横线 |
| `password` | 必填，字符串，长度 8-128 |
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
  "username": "alice",
  "password": "password123"
}
```

`platformID` 不需要在注册时传入。注册成功后，服务会在 MongoDB 保存 Argon2id
密码哈希，并把用户同步注册到 OpenIM。由于 OpenIM 注册用户时昵称不能为空，
未传昵称时会先使用 `username` 作为临时昵称，客户端登录后会引导用户设置正式昵称。

请求示例：

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"password123"}'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userID": "1234567890",
    "username": "alice"
  },
  "timestamp": 1760000000000,
  "path": "/auth/register"
}
```

失败示例：

```json
{
  "code": 409,
  "message": "用户名已存在",
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
  "username": "alice",
  "password": "password123",
  "platformID": 5
}
```

`platformID` 用于向 OpenIM 获取对应平台的用户 token，因此登录时必传。

请求示例：

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"password123","platformID":5}'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userID": "1234567890",
    "username": "alice",
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
  "message": "用户名或密码错误",
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

## 通过用户名查询 userID

```http
GET /auth/users/by-username?username=alice
```

该接口按用户名精确匹配，只查询已注册成功的 active 用户。

请求示例：

```bash
curl 'http://localhost:3000/auth/users/by-username?username=alice'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userID": "1234567890",
    "username": "alice"
  },
  "timestamp": 1760000000000,
  "path": "/auth/users/by-username?username=alice"
}
```

找不到用户：

```json
{
  "code": 404,
  "message": "用户不存在",
  "data": null,
  "timestamp": 1760000000000,
  "path": "/auth/users/by-username?username=alice"
}
```
