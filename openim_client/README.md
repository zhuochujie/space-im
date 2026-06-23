# OpenIM React Native Client

基于 React Native 0.86 和 `@openim/rn-client-sdk` 的 OpenIM 移动客户端。

## 已实现

- OpenIM Server API / WebSocket 地址配置
- 用户名 + 密码注册和登录
- 自动获取 `userID` 和 OpenIM `token`
- 本地保存会话，重新打开 App 时自动登录
- SDK 初始化、前后台状态同步和连接状态监听
- 会话列表、未读数和实时会话更新
- 好友与已加入群组列表
- 通过用户名发送好友申请、申请加入群聊
- 查看收到的好友申请，并通过或拒绝
- 创建群聊并选择初始好友成员
- 单聊好友设置、修改备注和删除好友
- 群聊设置和退出群组
- 群聊邀请好友入群
- 消息列表长按删除会话
- 联系人列表长按删除好友、退出或解散群聊
- 单聊、群聊历史消息和实时文本消息收发
- 个人信息、当前服务器信息和退出登录

## 运行

```sh
npm install

# iOS
cd ios && bundle exec pod install && cd ..
npm run ios

# Android
npm run android
```

服务地址固定配置在 `src/config/openim.ts`：

```text
API: http://127.0.0.1:10002
WebSocket: ws://127.0.0.1:10001
Chat Server: http://127.0.0.1:3000
```

地址需要按运行环境调整：

- iOS 模拟器访问 Mac 上的 Docker：`127.0.0.1`
- Android 模拟器访问宿主机：`10.0.2.2`
- 真机：填写运行 OpenIM Server 的局域网 IP，不能使用 `127.0.0.1`

服务地址不在登录界面展示为输入项，发布或切换环境时修改配置文件。

客户端调用业务服务的 `POST /auth/register` 完成注册，调用 `POST /auth/login`
完成业务账号认证，再使用响应中的 `userID` 和 `token` 登录底层 IM SDK。用户无需
输入底层 ID 或 token。

登录成功后仅保存业务服务返回的会话 token，不保存用户密码。主动退出、被踢下线或
token 失效时会自动清除本地会话。

## 检查

```sh
npx tsc --noEmit
npm run lint
npm test -- --runInBand --no-watchman
```

本地 HTTP/WS 仅适合开发环境。发布前应为 OpenIM Server 配置 HTTPS/WSS，并关闭
iOS `NSAllowsArbitraryLoads`。

## 接口文档

- [OpenIM API](docs/api.md)
