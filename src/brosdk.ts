/* eslint-disable */
import koffi from "koffi";

/* ============================================================
   1. 加载 brosdk 动态库（Windows: .dll / macOS: .dylib）
   ============================================================ */

export default class BroSDK {
  #lib: koffi.IKoffiLib;

  /* ============================================================
   2. 类型定义
   ============================================================ */
  // void(int32_t code, void *ud, const char *data, size_t len)
  #ResultCbProto: koffi.IKoffiCType;
  // void(const char *data, size_t len, char **new_data, size_t *new_len, void *ud)
  #CookiesStorageCbProto: koffi.IKoffiCType;
  // char* 和 char** 指针类型，用于输出参数
  #CharPtr: koffi.IKoffiCType;
  #CharPtrPtr: koffi.IKoffiCType;
  // sdk_handle_t* 输出槽
  #HandleSlot: koffi.IKoffiCType;

  /* ============================================================
   3. 函数绑定
   ============================================================ */
  $_register_cb: koffi.KoffiFunction;
  $_register_cookies_cb: koffi.KoffiFunction;
  $_init: koffi.KoffiFunction;
  $_init_async: koffi.KoffiFunction;
  $_init_webapi: koffi.KoffiFunction;
  $_sdk_info: koffi.KoffiFunction;
  $_browser_info: koffi.KoffiFunction;
  $_browser_open: koffi.KoffiFunction;
  $_browser_close: koffi.KoffiFunction;
  $_env_create: koffi.KoffiFunction;
  $_env_update: koffi.KoffiFunction;
  $_env_page: koffi.KoffiFunction;
  $_env_destroy: koffi.KoffiFunction;
  $_token_update: koffi.KoffiFunction;
  $_shutdown: koffi.KoffiFunction;
  $_free: koffi.KoffiFunction;
  $_malloc: koffi.KoffiFunction;
  $_error_name: koffi.KoffiFunction;
  $_error_string: koffi.KoffiFunction;
  $_event_name: koffi.KoffiFunction;
  $_is_error: koffi.KoffiFunction;
  $_is_warn: koffi.KoffiFunction;
  $_is_reqid: koffi.KoffiFunction;
  $_is_ok: koffi.KoffiFunction;
  $_is_done: koffi.KoffiFunction;
  $_is_event: koffi.KoffiFunction;

  /* ============================================================
   4. 回调注册（JS 层持有，防止 GC）
   ============================================================ */
  #resultCb: Function | null = null;
  #nativeCb: koffi.IKoffiRegisteredCallback | null = null;
  #cookiesStorageCb: Function | null = null;
  #nativeCookiesCb: koffi.IKoffiRegisteredCallback | null = null;

  /**
   *
   * @param path dll 路径
   */
  constructor(path: string) {
    this.#lib = koffi.load(path);

    // ---------- 回调类型原型 ----------
    // koffi 在非 Windows 平台上忽略 __cdecl，跨平台安全
    this.#ResultCbProto = koffi.proto(
      "void __cdecl sdk_result_cb_t(int32_t code, void *ud, const char *data, size_t len)",
    );
    this.#CookiesStorageCbProto = koffi.proto(
      "void __cdecl sdk_cookies_storage_cb_t(const char *data, size_t len, uint8 **new_data, size_t *new_len, void *ud)",
    );

    // ---------- 输出参数辅助类型 ----------
    this.#CharPtr = koffi.pointer("uint8");
    this.#CharPtrPtr = koffi.pointer(this.#CharPtr);
    this.#HandleSlot = koffi.out(koffi.pointer("size_t"));

    // ---------- 函数绑定 ----------
    this.$_register_cb = this.#lib.func(
      "int32_t __cdecl sdk_register_result_cb(sdk_result_cb_t *cb, void *ud)",
    );
    this.$_register_cookies_cb = this.#lib.func(
      "int32_t __cdecl sdk_register_cookies_storage_cb(sdk_cookies_storage_cb_t *cb, void *ud)",
    );

    this.$_init = this.#lib.func("sdk_init", "int32", [
      this.#HandleSlot,
      "str",
      "size_t",
      koffi.out(this.#CharPtrPtr),
      koffi.out(koffi.pointer("size_t")),
    ]);
    this.$_init_async = this.#lib.func("sdk_init_async", "int32", [
      this.#HandleSlot,
      "str",
      "size_t",
    ]);
    this.$_init_webapi = this.#lib.func(
      "int32_t __cdecl sdk_init_webapi(uint16_t port)",
    );

    // sdk_info / sdk_browser_info：无输入，仅输出
    this.$_sdk_info = this.#lib.func("sdk_info", "int32", [
      koffi.out(this.#CharPtrPtr),
      koffi.out(koffi.pointer("size_t")),
    ]);
    this.$_browser_info = this.#lib.func("sdk_browser_info", "int32", [
      koffi.out(this.#CharPtrPtr),
      koffi.out(koffi.pointer("size_t")),
    ]);

    // 环境管理：(const char *data, size_t len, char **out_data, size_t *out_len)
    this.$_env_create = this.#lib.func("sdk_env_create", "int32", [
      "str",
      "size_t",
      koffi.out(this.#CharPtrPtr),
      koffi.out(koffi.pointer("size_t")),
    ]);
    this.$_env_update = this.#lib.func("sdk_env_update", "int32", [
      "str",
      "size_t",
      koffi.out(this.#CharPtrPtr),
      koffi.out(koffi.pointer("size_t")),
    ]);
    this.$_env_page = this.#lib.func("sdk_env_page", "int32", [
      "str",
      "size_t",
      koffi.out(this.#CharPtrPtr),
      koffi.out(koffi.pointer("size_t")),
    ]);
    this.$_env_destroy = this.#lib.func("sdk_env_destroy", "int32", [
      "str",
      "size_t",
      koffi.out(this.#CharPtrPtr),
      koffi.out(koffi.pointer("size_t")),
    ]);

    this.$_browser_open = this.#lib.func(
      "int32_t __cdecl sdk_browser_open(const char *data, size_t len)",
    );
    this.$_browser_close = this.#lib.func(
      "int32_t __cdecl sdk_browser_close(const char *data, size_t len)",
    );
    this.$_token_update = this.#lib.func(
      "int32_t __cdecl sdk_token_update(const char *data, size_t len)",
    );
    this.$_shutdown = this.#lib.func("int32_t __cdecl sdk_shutdown(void)");
    this.$_free = this.#lib.func("void __cdecl sdk_free(void *ptr)");
    this.$_malloc = this.#lib.func("void * __cdecl sdk_malloc(size_t size)");
    this.$_error_name = this.#lib.func(
      "const char * __cdecl sdk_error_name(int32_t code)",
    );
    this.$_error_string = this.#lib.func(
      "const char * __cdecl sdk_error_string(int32_t code)",
    );
    this.$_event_name = this.#lib.func(
      "const char * __cdecl sdk_event_name(int32_t evtid)",
    );
    this.$_is_error = this.#lib.func("bool __cdecl sdk_is_error(int32_t code)");
    this.$_is_warn = this.#lib.func("bool __cdecl sdk_is_warn(int32_t code)");
    this.$_is_reqid = this.#lib.func("bool __cdecl sdk_is_reqid(int32_t code)");
    this.$_is_ok = this.#lib.func("bool __cdecl sdk_is_ok(int32_t code)");
    this.$_is_done = this.#lib.func("bool __cdecl sdk_is_done(int32_t code)");
    this.$_is_event = this.#lib.func("bool __cdecl sdk_is_event(int32_t code)");
  }
  registerResultCb = (fn: (code: number, data: string) => void) => {
    this.#resultCb = fn;
    if (this.#nativeCb) {
      koffi.unregister(this.#nativeCb);

      this.#nativeCb = null;
    }
    // register: SDK 从内部线程调用此指针时，koffi 将调用调度到 Node.js 主线程
    this.#nativeCb = koffi.register(
      (code: number, _ud: unknown, data: string, _len: number) => {
        if (this.#resultCb) this.#resultCb(code, data || "");
      },
      koffi.pointer(this.#ResultCbProto),
    );
    return this.$_register_cb(this.#nativeCb, null);
  };

  /**
   * 注册 Cookie 持久化回调。
   * SDK 调用此回调来读写 Cookie 存储；回调应将 data 持久化并可选择性地返回修改后的数据。
   * 简单 Demo 实现：透传原始数据（不修改）。
   */
  registerCookiesStorageCb = (fn?: (data: string) => string | null) => {
    if (this.#nativeCookiesCb) {
      koffi.unregister(this.#nativeCookiesCb);
      this.#nativeCookiesCb = null;
    }
    this.#cookiesStorageCb = fn ?? null;
    this.#nativeCookiesCb = koffi.register(
      (
        data: string,
        _len: number,
        newDataPtr: unknown,
        newLenPtr: unknown,
        _ud: unknown,
      ) => {
        // 默认透传：不修改 Cookie 数据
        const result = this.#cookiesStorageCb
          ? this.#cookiesStorageCb(data || "")
          : null;
        if (result && newDataPtr && newLenPtr) {
          // 将结果写回（需要 SDK 支持由调用方分配内存的协议）
          // 此处简单置空，由 SDK 保留原数据
        }
      },
      koffi.pointer(this.#CookiesStorageCbProto),
    );
    return this.$_register_cookies_cb(this.#nativeCookiesCb, null);
  };
  // Accepts a string or a plain object (auto-serialised to JSON).
  // All DLL entry points pass their payload through here to get the byte length.
  strLen = (s: string): number => {
    return Buffer.byteLength(s, "utf8");
  };

  // Normalise a caller-supplied payload to a UTF-8 JSON string.
  // Accepts: string | object | null | undefined.
  #toJson = (v: unknown): string => {
    if (v === null || v === undefined) return "{}";
    if (typeof v === "string") return v;
    return JSON.stringify(v);
  };

  /** 解码 SDK 输出的 char* 缓冲区到 UTF-8 字符串，并返回原始指针供调用方 freePointer */
  #decodeOutBuf = (
    outData: unknown[],
    outLen: unknown[],
  ): { ptr: unknown; len: number; response: string | null } => {
    const len = Number(outLen[0]);
    let response: string | null = null;
    if (outData[0] && len > 0) {
      const bytes = koffi.decode(outData[0], "uint8", len);
      response = Buffer.from(bytes).toString("utf8");
    }
    return { ptr: outData[0], len, response };
  };

  init = (json: unknown) => {
    const input = this.#toJson(json);
    const handle = [0];
    const outData = [null];
    const outLen = [0];
    const ret = this.$_init(handle, input, this.strLen(input), outData, outLen);
    const { ptr, len, response } = this.#decodeOutBuf(outData, outLen);
    return { code: ret, ptr, len, response };
  };

  /** 释放由 SDK 分配的指针（sdk_init / sdk_info 等返回的 out_data） */
  freePointer = (ptr: unknown): void => {
    if (ptr) this.$_free(ptr);
  };

  /** 异步初始化，结果通过 registerResultCb 回调返回。 */
  initAsync = (json: unknown): number => {
    const input = this.#toJson(json);
    const handle = [0];
    return this.$_init_async(handle, input, this.strLen(input));
  };

  initWebAPI = (port: number): number => {
    return this.$_init_webapi(port);
  };

  /** 获取 SDK 版本/信息（无输入参数）。 */
  sdkInfo = () => {
    const outData = [null];
    const outLen = [0];
    const ret = this.$_sdk_info(outData, outLen);
    const { ptr, len, response } = this.#decodeOutBuf(outData, outLen);
    return { code: ret, ptr, len, response };
  };

  /** 获取内置浏览器信息（无输入参数）。 */
  browserInfo = () => {
    const outData = [null];
    const outLen = [0];
    const ret = this.$_browser_info(outData, outLen);
    const { ptr, len, response } = this.#decodeOutBuf(outData, outLen);
    return { code: ret, ptr, len, response };
  };

  browserOpen = (json: unknown): number => {
    const s = this.#toJson(json);
    return this.$_browser_open(s, this.strLen(s));
  };

  browserClose = (json: unknown): number => {
    const s = this.#toJson(json);
    return this.$_browser_close(s, this.strLen(s));
  };

  /** 创建浏览器环境，返回新环境信息 JSON。 */
  envCreate = (json: unknown) => {
    const s = this.#toJson(json);
    const outData = [null];
    const outLen = [0];
    const ret = this.$_env_create(s, this.strLen(s), outData, outLen);
    const { ptr, len, response } = this.#decodeOutBuf(outData, outLen);
    return { code: ret, ptr, len, response };
  };

  /** 更新浏览器环境配置，返回更新后的环境信息 JSON。 */
  envUpdate = (json: unknown) => {
    const s = this.#toJson(json);
    const outData = [null];
    const outLen = [0];
    const ret = this.$_env_update(s, this.strLen(s), outData, outLen);
    const { ptr, len, response } = this.#decodeOutBuf(outData, outLen);
    return { code: ret, ptr, len, response };
  };

  /** 分页查询浏览器环境列表。 */
  envPage = (json: unknown) => {
    const s = this.#toJson(json);
    const outData = [null];
    const outLen = [0];
    const ret = this.$_env_page(s, this.strLen(s), outData, outLen);
    const { ptr, len, response } = this.#decodeOutBuf(outData, outLen);
    return { code: ret, ptr, len, response };
  };

  /** 删除浏览器环境。 */
  envDestroy = (json: unknown) => {
    const s = this.#toJson(json);
    const outData = [null];
    const outLen = [0];
    const ret = this.$_env_destroy(s, this.strLen(s), outData, outLen);
    const { ptr, len, response } = this.#decodeOutBuf(outData, outLen);
    return { code: ret, ptr, len, response };
  };

  tokenUpdate = (json: unknown): number => {
    const s = this.#toJson(json);
    return this.$_token_update(s, this.strLen(s));
  };

  shutdown = (): number => {
    const ret = this.$_shutdown();
    if (this.#nativeCb) {
      koffi.unregister(this.#nativeCb);
      this.#nativeCb = null;
    }
    if (this.#nativeCookiesCb) {
      koffi.unregister(this.#nativeCookiesCb);
      this.#nativeCookiesCb = null;
    }
    return ret;
  };

  sdkMalloc = (size: number): unknown => {
    return this.$_malloc(size);
  };

  errorName = (code: number): string => {
    return this.$_error_name(code) || "";
  };
  errorString = (code: number): string => {
    return this.$_error_string(code) || "";
  };
  eventName = (evtid: number): string => {
    return this.$_event_name(evtid) || "";
  };

  isOk = (code: number): boolean => {
    return this.$_is_ok(code);
  };
  isError = (code: number): boolean => {
    return this.$_is_error(code);
  };
  isDone = (code: number): boolean => {
    return this.$_is_done(code);
  };
  isReqid = (code: number): boolean => {
    return this.$_is_reqid(code);
  };
  isWarn = (code: number): boolean => {
    return this.$_is_warn(code);
  };
  isEvent = (code: number): boolean => {
    return this.$_is_event(code);
  };

  printErrno = (tag: string, code: number): void => {
    const label = this.isOk(code)
      ? "OK"
      : this.isDone(code)
        ? "DONE"
        : this.isError(code)
          ? "ERROR"
          : this.isEvent(code)
            ? "EVENT"
            : this.isWarn(code)
              ? "WARN"
              : "UNKNOWN";
    const name = this.errorName(code);
    const msg = this.errorString(code);
    console.log(`[${tag}] ${label}  code=${code}  (${name}): ${msg}`);
  };
}
