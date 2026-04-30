# BroSDK TypeScript SDK

[English](README_EN.md) | 简体中文

[![npm](https://img.shields.io/npm/v/brosdk)](https://www.npmjs.com/package/brosdk)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

`brosdk-typescript` 是 BroSDK 的 TypeScript / Node.js 封装。它通过 [koffi](https://koffi.dev/) 调用 BroSDK 原生动态库，为 Electron 主进程、Node.js 自动化脚本和桌面客户端提供浏览器环境管理能力。

该 SDK 适合需要在 JavaScript / TypeScript 技术栈中创建独立浏览器环境、启动浏览器实例、复用 Cookie/Storage 状态、监听 SDK 回调事件的应用。

## 核心能力

- 动态加载 Windows / macOS 平台 BroSDK 原生库。
- 初始化 SDK 并启动内置 HTTP Web API 服务。
- 创建、查询、更新、销毁浏览器环境。
- 启动和关闭指定环境的浏览器实例。
- 注册结果回调和 Cookie/Storage 持久化回调。
- 提供错误码、事件码和状态判断工具。
- 同时支持 ESM、CommonJS 和 TypeScript 类型声明。

## 环境要求

| 项目 | 要求 |
|------|------|
| Node.js | 18.0.0+ |
| Electron | 20.0.0+，可选，由宿主应用提供 |
| 平台 | Windows x64 / arm64，macOS x64 / arm64 |
| 原生库 | `brosdk.dll` 或 `brosdk.dylib` |

## 安装

```bash
npm install brosdk
```

`koffi` 是运行时依赖，会随包自动安装。`electron` 是可选 peer dependency，通常由宿主应用安装。

## 原生库放置

SDK 通常按平台从项目根目录或 Electron resources 目录查找原生库。推荐结构：

```text
project-root/
├── sdk/
│   ├── windows-x64/
│   │   └── brosdk.dll
│   ├── arm64-windows/
│   │   └── brosdk.dll
│   ├── x64-osx/
│   │   └── brosdk.dylib
│   └── arm64-osx/
│       └── brosdk.dylib
└── workDir/
    └── cores/
```

Electron 开发阶段可基于 `app.getAppPath()` 定位 `sdk/`，打包后可基于 `process.resourcesPath` 定位 `sdk/`。

## 快速开始

```typescript
import path from "node:path";
import BroSDK from "brosdk";
import type { InitParam, SDKResponse } from "brosdk";

function resolveLibraryPath() {
  if (process.platform === "darwin") {
    const dir = process.arch === "x64" ? "x64-osx" : "arm64-osx";
    return path.join(".", "sdk", dir, "brosdk.dylib");
  }

  if (process.platform === "win32") {
    const dir = process.arch === "arm64" ? "arm64-windows" : "windows-x64";
    return path.join(".", "sdk", dir, "brosdk.dll");
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

const sdk = new BroSDK(resolveLibraryPath());

sdk.registerResultCb((code: number, data: string) => {
  if (sdk.isOk(code)) {
    console.log("SDK success:", data);
  } else if (sdk.isEvent(code)) {
    console.log("SDK event:", sdk.eventName(code), data);
  } else if (sdk.isError(code)) {
    console.error("SDK error:", sdk.errorString(code), data);
  }
});

const initParam: InitParam = {
  port: 65535,
  userSig: "your_user_sig",
  workDir: path.join(".", "workDir"),
};

const res: SDKResponse = await sdk.init(JSON.stringify(initParam));
try {
  if (res.code !== 0) {
    throw new Error(res.response ?? "SDK init failed");
  }

  sdk.browserOpen({
    envs: [
      {
        envId: "env-001",
        args: ["--no-first-run"],
      },
    ],
  });
} finally {
  sdk.freePointer(res.ptr);
}
```

`browserOpen` 等接口可能是异步操作，同步返回值只表示请求是否提交成功，最终启动状态应通过 `registerResultCb` 注册的回调判断。

## Electron 集成建议

- 在主进程中创建并持有 BroSDK 实例，不建议在渲染进程中直接加载原生库。
- 通过 IPC 暴露受控方法，例如 `sdk:init`、`sdk:env-page`、`sdk:browser-open`。
- 将 SDK 回调事件转发到渲染进程，由 UI 展示环境启动状态、错误信息和下载进度。
- 打包时将平台动态库复制到 `resources/sdk/<platform>/`，并在运行时根据 `process.resourcesPath` 定位。
- API Key、`userSig`、Cookie 和代理配置应按敏感信息处理，避免写入前端静态资源。

## API 概览

### 初始化与生命周期

| API | 说明 |
|-----|------|
| `new BroSDK(libPath)` | 加载指定原生动态库 |
| `init(json)` | 初始化 SDK，成功后启动内置 HTTP 服务 |
| `initAsync(json)` | 异步初始化，结果通过回调返回 |
| `initWebAPI(port)` | 启动内置 Web API 服务 |
| `shutdown()` | 关闭 SDK 并释放资源 |
| `freePointer(ptr)` | 释放原生 SDK 分配的输出内存 |

### 信息查询

| API | 说明 |
|-----|------|
| `sdkInfo()` | 获取 SDK 版本和运行时信息 |
| `browserInfo()` | 获取浏览器运行信息 |

### 浏览器控制

| API | 说明 |
|-----|------|
| `browserOpen(json)` | 启动浏览器环境 |
| `browserClose(json)` | 关闭浏览器环境 |

### 环境管理

| API | 说明 |
|-----|------|
| `envCreate(json)` | 创建浏览器环境 |
| `envUpdate(json)` | 更新环境配置 |
| `envPage(json)` | 分页查询环境列表 |
| `envDestroy(json)` | 销毁环境 |

### Token 与回调

| API | 说明 |
|-----|------|
| `tokenUpdate(json)` | 更新鉴权 Token |
| `registerResultCb(fn)` | 注册 SDK 结果和事件回调 |
| `registerCookiesStorageCb(fn)` | 注册 Cookie/Storage 持久化回调 |

## Web API

初始化参数中的 `port` 会启动内置 HTTP 服务。Base URL：

```text
http://127.0.0.1:{port}
```

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/sdk/v1/init` | 初始化 SDK |
| `POST` | `/sdk/v1/token/update` | 刷新令牌 |
| `POST` | `/sdk/v1/browser/open` | 打开浏览器 |
| `POST` | `/sdk/v1/browser/close` | 关闭浏览器 |
| `POST` | `/sdk/v1/env/create` | 创建环境 |
| `POST` | `/sdk/v1/env/update` | 更新环境 |
| `POST` | `/sdk/v1/env/page` | 分页查询环境 |
| `POST` | `/sdk/v1/env/destroy` | 销毁环境 |
| `POST` | `/sdk/v1/shutdown` | 停止 SDK |

示例：

```http
POST http://127.0.0.1:9527/sdk/v1/browser/open
Content-Type: application/json

{
  "envs": [
    {
      "envId": "env-001",
      "urls": ["https://www.example.com"]
    }
  ]
}
```

## 类型

```typescript
export interface InitParam {
  port: number;
  userSig: string;
  workDir?: string;
}

export interface SDKResponse {
  code: number;
  ptr: unknown;
  len: number;
  response: string | null;
}
```

## 项目结构

```text
brosdk-typescript/
├── src/
│   ├── index.ts      # 包入口
│   ├── brosdk.ts     # BroSDK 类封装
│   └── type.ts       # 类型定义
├── dist/             # 编译产物
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
npm install
npm run build
npm run clean
```

发布前建议确认：

- `dist/` 已由当前源码重新构建。
- README 示例中的密钥和环境 ID 均为占位符。
- Electron 打包配置已复制目标平台动态库。
- 回调事件在主进程中可被稳定转发和释放。

## 与 BroSDK 生态的关系

| 仓库 | 说明 |
|------|------|
| [brosdk](https://github.com/browsersdk/brosdk) | 原生 C/C++ SDK |
| [brosdk-core](https://github.com/browsersdk/brosdk-core) | 浏览器内核版本和平台支持 |
| [brosdk-docs](https://github.com/browsersdk/brosdk-docs) | 官方文档和 API 参考 |
| [browser-demo](https://github.com/browsersdk/browser-demo) | Electron + Vue + Go 完整示例 |

## License

MIT
