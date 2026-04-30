# BroSDK TypeScript SDK

English | [简体中文](README.md)

[![npm](https://img.shields.io/npm/v/brosdk)](https://www.npmjs.com/package/brosdk)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

`brosdk-typescript` is the TypeScript / Node.js wrapper for BroSDK. It calls the BroSDK native dynamic library through [koffi](https://koffi.dev/) and provides browser environment management for Electron main processes, Node.js automation scripts, and desktop clients.

This SDK is designed for JavaScript / TypeScript applications that need to create independent browser environments, launch browser instances, reuse Cookie/Storage state, and listen to SDK callback events.

## Core Capabilities

- Dynamically load BroSDK native libraries on Windows and macOS.
- Initialize the SDK and start the embedded HTTP Web API service.
- Create, query, update, and destroy browser environments.
- Launch and close browser instances for specified environments.
- Register result callbacks and Cookie/Storage persistence callbacks.
- Provide utilities for error codes, event codes, and status checks.
- Support ESM, CommonJS, and TypeScript type declarations.

## Requirements

| Item | Requirement |
|------|-------------|
| Node.js | 18.0.0+ |
| Electron | 20.0.0+, optional and provided by the host application |
| Platform | Windows x64 / arm64, macOS x64 / arm64 |
| Native library | `brosdk.dll` or `brosdk.dylib` |

## Installation

```bash
npm install brosdk
```

`koffi` is installed as a runtime dependency. `electron` is an optional peer dependency and is usually installed by the host application.

## Native Library Layout

The SDK usually locates the native library from the project root or Electron resources directory by platform. Recommended structure:

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

During Electron development, locate `sdk/` based on `app.getAppPath()`. After packaging, locate `sdk/` based on `process.resourcesPath`.

## Quick Start

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

APIs such as `browserOpen` may be asynchronous. The synchronous return value only indicates whether the request was submitted successfully; final launch status should be handled through the callback registered by `registerResultCb`.

## Electron Integration Recommendations

- Create and hold the BroSDK instance in the main process. Do not load the native library directly in the renderer process.
- Expose controlled methods through IPC, such as `sdk:init`, `sdk:env-page`, and `sdk:browser-open`.
- Forward SDK callback events to the renderer process so the UI can display launch status, errors, and download progress.
- Copy platform dynamic libraries to `resources/sdk/<platform>/` during packaging and resolve them with `process.resourcesPath` at runtime.
- Treat API Keys, `userSig`, cookies, and proxy configurations as sensitive information. Do not write them into frontend static assets.

## API Overview

### Initialization And Lifecycle

| API | Description |
|-----|-------------|
| `new BroSDK(libPath)` | Load the specified native dynamic library |
| `init(json)` | Initialize the SDK and start the embedded HTTP service on success |
| `initAsync(json)` | Initialize asynchronously; result is returned by callback |
| `initWebAPI(port)` | Start the embedded Web API service |
| `shutdown()` | Shut down the SDK and release resources |
| `freePointer(ptr)` | Release output memory allocated by the native SDK |

### Information

| API | Description |
|-----|-------------|
| `sdkInfo()` | Get SDK version and runtime information |
| `browserInfo()` | Get browser runtime information |

### Browser Control

| API | Description |
|-----|-------------|
| `browserOpen(json)` | Launch a browser environment |
| `browserClose(json)` | Close a browser environment |

### Environment Management

| API | Description |
|-----|-------------|
| `envCreate(json)` | Create a browser environment |
| `envUpdate(json)` | Update environment configuration |
| `envPage(json)` | Query environments by page |
| `envDestroy(json)` | Destroy an environment |

### Token And Callback

| API | Description |
|-----|-------------|
| `tokenUpdate(json)` | Update authentication token |
| `registerResultCb(fn)` | Register SDK result and event callback |
| `registerCookiesStorageCb(fn)` | Register Cookie/Storage persistence callback |

## Web API

The `port` field in initialization parameters starts the embedded HTTP service. Base URL:

```text
http://127.0.0.1:{port}
```

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sdk/v1/init` | Initialize SDK |
| `POST` | `/sdk/v1/token/update` | Refresh token |
| `POST` | `/sdk/v1/browser/open` | Open browser |
| `POST` | `/sdk/v1/browser/close` | Close browser |
| `POST` | `/sdk/v1/env/create` | Create environment |
| `POST` | `/sdk/v1/env/update` | Update environment |
| `POST` | `/sdk/v1/env/page` | Query environment list by page |
| `POST` | `/sdk/v1/env/destroy` | Destroy environment |
| `POST` | `/sdk/v1/shutdown` | Stop SDK |

Example:

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

## Types

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

## Directory Layout

```text
brosdk-typescript/
├── src/
│   ├── index.ts      # Package entry
│   ├── brosdk.ts     # BroSDK class wrapper
│   └── type.ts       # Type definitions
├── dist/             # Build output
├── package.json
├── tsconfig.json
└── README.md
```

## Development

```bash
npm install
npm run build
npm run clean
```

Before publishing, verify that:

- `dist/` has been rebuilt from the current source.
- README examples use placeholder secrets and environment IDs.
- Electron packaging copies the dynamic library for the target platform.
- Callback events can be reliably forwarded and released in the main process.

## Related Repositories

| Repository | Description |
|------------|-------------|
| [brosdk](https://github.com/browsersdk/brosdk) | Native C/C++ SDK |
| [brosdk-core](https://github.com/browsersdk/brosdk-core) | Browser core versions and platform support |
| [brosdk-docs](https://github.com/browsersdk/brosdk-docs) | Official documentation and API reference |
| [browser-demo](https://github.com/browsersdk/browser-demo) | Electron + Vue + Go full example |

## License

MIT
