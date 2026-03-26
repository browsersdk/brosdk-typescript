/** 初始化入参 */
export interface InitParam {
  /** 服务端口 */
  port: number;
  /** 唯一key值 */
  userSig: string;
  /** 工作目录 */
  workDir: string;
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
