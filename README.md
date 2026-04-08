# brosdk

> BroSDK 的 TypeScript / Node.js 封装，通过 [koffi](https://koffi.dev/) 调用原生动态库（Windows `.dll` / macOS `.dylib`），专为 Electron 主进程设计。

---

## 目录

- [环境要求](#环境要求)
- [安装](#安装)
- [动态库放置](#动态库放置)
- [快速上手](#快速上手)
- [在 Electron IPC 中使用](#在-electron-ipc-中使用)
- [API 参考](#api-参考)
- [Web API 接口（HTTP）](#web-api-接口http)
- [错误码工具](#错误码工具)
- [事件回调](#事件回调)
- [附录](#附录)
  - [附录 A · 错误码全表](#附录-a--错误码全表)
  - [附录 B · 事件码全表](#附录-b--事件码全表)
- [注意事项](#注意事项)

---

## 环境要求

| 项目 | 要求 |
|------|------|
| Node.js | ≥ 18.0.0 |
| 平台 | Windows x64 / arm64，macOS x64 / arm64 |

---

## 安装

```bash
npm install brosdk
```

`koffi` 是运行时依赖，会随包自动安装。`electron` 由宿主应用提供，无需重复安装。

---

## 动态库放置

> SDK 会在以下路径自动寻找原生库，**请按平台将对应目录放入项目**：

```base
项目根目录/
└── sdk/
    ├── windows-x64/
    │   └── brosdk.dll        # Windows x64
    ├── arm64-windows/
    │   └── brosdk.dll        # Windows arm64
    ├── x64-osx/
    │   └── brosdk.dylib      # macOS x64
    └── arm64-osx/
        └── brosdk.dylib      # macOS arm64
└──workDir
   └── cores    
```

- **开发阶段**：路径基于 `app.getAppPath()/sdk/...`
- **打包后**：路径基于 `process.resourcesPath/sdk/...`

---

## 快速上手

```typescript
import path from "path";
import BroSDK from "brosdk";
import type { SDKResponse, InitParam } from "brosdk";

const platform = process.platform;
const arch = process.arch; // 'x64' | 'arm64'
let sdk: BroSDK;
let _DLL_PATH = "";

/** 初始化dll */
const init = () => {
  if (platform === "darwin") {
    const osxDir = arch === "x64" ? "x64-osx" : "arm64-osx";
    _DLL_PATH = path.join(".", "sdk", osxDir, "brosdk.dylib");
  } else if (platform === "win32") {
    const winDir = arch === "arm64" ? "arm64-windows" : "windows-x64";
    _DLL_PATH = path.join(".", "sdk", winDir, "brosdk.dll");
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  sdk = new BroSDK(_DLL_PATH);
};
/** 判断 */
const bind = async (param: InitParam): Promise<SDKResponse> => {
  const res = await sdk.init(JSON.stringify(param));
  console.log("res...", initParam, res);
  return res;
};

init();

const initParam = {
  port: 65535,
  userSig:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyaWQiOiIy******************************Y0NjA0NDE2LCJ1aWQiOjIwMjE0MDI0ODk2NDcwMDk3OTIsImNpZCI6IjUiLCJpc3MiOiJicyIsImV4cCI6MTc3NDYwMDg5NH0.H7G2mCopEJOPiJpbMoBZtdiz_S7qC7Gilh5_dON1Ykc",
  workDir: path.join(".", "workDir"),
};
const bindRes = await bind(initParam);
const { code } = bindRes;
if (code === 0) {
  console.log("绑定成功");
  console.log(
    sdk!.browserOpen({
      envs: [
        {
          envId: "203627257**************",
          args: [],
        },
      ],
    }),
  );
}

// 防止程序自动退出
process.stdin.resume();
```

---

## API 参考

### type

```ts
/** 初始化入参 */
export interface InitParam {
    /** 服务端口 */
    port: number;
    /** 唯一key值 */
    userSig: string;
    /** 工作目录 */
    workDir?: string;
}
/** 请求返回 */
export interface SDKResponse {
    /** 0:成功 其他:失败 */
    code: number;
    ptr: unknown;
    len: number;
    /**
     * 提示信息
     * @description 供参数
     */
    response: string | null;
}
```

### 构造函数

```typescript
const sdk = new BroSDK('动态库文件路径')
```

根据当前平台（`process.platform`）和架构（`process.arch`）设置对应动态库路径。

---

### 初始化

#### `init(json)`

同步初始化 SDK。**初始化成功后，SDK 会启动一个 HTTP 服务，监听端口为初始化参数中指定的 `port`**。

```typescript
import type { SDKResponse, InitParam } from "brosdk";

const param: InitParam =  {
  port: 65535,
  userSig:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.******************.H7G2mCopEJOPiJpbMoBZtdiz_S7qC7Gilh5_dON1Ykc",
  workDir: path.join(".", "workDir"),
}
const res: SDKResponse = await sdk.init(JSON.stringify(param))
sdk.freePointer(res.ptr)  // 使用完毕后必须释放
```

> **注意**：`port` 字段必须指定，SDK 将在此端口启动内嵌 HTTP 服务，提供 Web API 接口（详见下方 [Web API 接口](#web-api-接口http)）。

#### `initAsync(json): number`

异步初始化，结果通过 `registerResultCb` 回调返回，返回值为请求 ID。

```typescript
const reqId = sdk.initAsync({ port: 65535, userSig: 'xxx' })
```

#### `initWebAPI(port): number`

启动内置 Web API 服务。

```typescript
sdk.initWebAPI(8080)
```

---

### 信息查询

#### `sdkInfo()`

获取 SDK 版本及基础信息。

```typescript
const info = sdk.sdkInfo()
console.log(info.response)  // JSON 字符串
sdk.freePointer(info.ptr)
```

#### `browserInfo()`

获取内置浏览器信息。

```typescript
const info = sdk.browserInfo()
console.log(info.response)
sdk.freePointer(info.ptr)
```

---

### 浏览器控制

#### `browserOpen(json): number`

打开浏览器环境。

```typescript
const code = sdk.browserOpen({ envId: 'env-001' })
```

#### `browserClose(json): number`

关闭浏览器环境。

```typescript
const code = sdk.browserClose({ envId: 'env-001' })
```

---

### 环境管理

所有环境接口均返回 `{ code, ptr, len, response }`，调用后需 `freePointer(res.ptr)` 释放内存。

#### `envCreate(json)`

创建浏览器环境。

```typescript
const res = sdk.envCreate({ envName: '测试环境'})
const env = JSON.parse(res.response ?? '{}')
sdk.freePointer(res.ptr)
```

#### `envUpdate(json)`

更新环境配置。

```typescript
const res = sdk.envUpdate({ envId: 'env-001', envName: '新名称' })
sdk.freePointer(res.ptr)
```

#### `envPage(json)`

分页查询环境列表。

```typescript
const res = sdk.envPage({ page: 1, pageSize: 20 })
const list = JSON.parse(res.response ?? '{}')
sdk.freePointer(res.ptr)
```

#### `envDestroy(json)`

删除环境。

```typescript
const res = sdk.envDestroy({ envId: 'env-001' })
sdk.freePointer(res.ptr)
```

---

### Token 管理

#### `tokenUpdate(json): number`

更新鉴权 Token。

```typescript
const code = sdk.tokenUpdate({ token: 'new-token' })
```

---

### 生命周期

#### `shutdown(): number`

关闭 SDK，自动注销所有已注册回调，释放原生资源。

```typescript
const code = sdk.shutdown()
```

#### `freePointer(ptr): void`

释放由 SDK 分配的内存（`init`、`sdkInfo`、`envCreate` 等有输出缓冲区的接口）。

```typescript
sdk.freePointer(res.ptr)
```

---

### 回调注册

#### `registerResultCb(fn)`

注册全局结果回调，SDK 内部线程触发时，koffi 会将调用调度回 Node.js 主线程。

```typescript
sdk.registerResultCb((code: number, data: string) => {
  if (sdk.isOk(code)) {
    const payload = JSON.parse(data)
    // 处理结果...
  } else if (sdk.isEvent(code)) {
    console.log('事件:', sdk.eventName(code), data)
  } else if (sdk.isError(code)) {
    console.error('错误:', sdk.errorString(code))
  }
})
```

#### `registerCookiesStorageCb(fn?)`

注册 Cookie 持久化回调。`fn` 接收 Cookie 数据字符串，返回修改后的字符串或 `null`（透传）。

```typescript
sdk.registerCookiesStorageCb((cookies) => {
  // 可将 cookies 持久化到本地文件/数据库
  saveCookiesToDisk(cookies)
  return null  // 不修改内容
})
```

---

## Web API 接口（HTTP）

> **前提**：需先在 `sdk_init` 请求 JSON 中指定 `port` 字段启动内嵌 HTTP 服务。

**通用请求头**：`Content-Type: application/json`  
**Base URL**：`http://127.0.0.1:{port}`

Web API 的请求/响应格式与 C API 完全一致。以下仅列出端点路径与简要说明。

| 方法 | 路径 | 说明 | 对应 C API |
|------|------|------|-----------|
| `POST` | `/sdk/v1/init` | 初始化 SDK | `sdk_init` |
| `POST` | `/sdk/v1/token/update` | 刷新令牌 | `sdk_token_update` |
| `POST` | `/sdk/v1/browser/open` | 打开浏览器 | `sdk_browser_open` |
| `POST` | `/sdk/v1/browser/close` | 关闭浏览器 | `sdk_browser_close` |
| `POST` | `/sdk/v1/env/create` | 创建环境 | `sdk_env_create` |
| `POST` | `/sdk/v1/env/update` | 更新环境 | `sdk_env_update` |
| `POST` | `/sdk/v1/env/page` | 环境列表（分页） | `sdk_env_page` |
| `POST` | `/sdk/v1/env/destroy` | 销毁环境 | `sdk_env_destroy` |
| `POST` | `/sdk/v1/shutdown` | 停止 SDK | `sdk_shutdown` |

**请求/响应示例**

```http
POST http://127.0.0.1:9527/sdk/v1/browser/open
Content-Type: application/json

{
  "envs": [
    {
      "envId": 2028432501503954944,
      "urls": ["https://www.example.com"]
    }
  ]
}
```

```json
{
  "reqid": 1006901417,
  "code": 0,
  "msg": "ok",
  "result": {
    "envId": 2028432501503954944,
    "eventId": 20111
  }
}
```
