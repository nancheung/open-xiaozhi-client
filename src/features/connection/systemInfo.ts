// OTA 请求头与系统信息体 —— 对齐 xiaozhi-esp32 固件标准。
//
// 参考：
//   - 请求头：xiaozhi-esp32/main/ota.cc 的 SetupHttp()
//       Activation-Version / Device-Id / Client-Id / User-Agent / Accept-Language / Content-Type
//       （Serial-Number 仅在设备烧录了序列号时携带；Web 端无序列号，故 Activation-Version 固定 "1"）
//   - 请求体：xiaozhi-esp32/main/boards/common/board.cc 的 GetSystemInfoJson()

const CLIENT_NAME = 'open-xiaozhi-client'
const BOARD_TYPE = 'open-xiaozhi-client'

/** 浏览器当前语言，回退到 zh-CN（等价固件的 Lang::CODE） */
function currentLanguage(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  return 'zh-CN'
}

/** 构造 OTA 请求头（对齐 SetupHttp） */
export function buildOtaHeaders(deviceId: string, clientId: string): Record<string, string> {
  return {
    // Web 端无 eFuse 序列号，对应固件 has_serial_number_ == false → "1"
    'Activation-Version': '1',
    'Device-Id': deviceId,
    'Client-Id': clientId,
    'User-Agent': `${CLIENT_NAME}/${__APP_VERSION__}`,
    'Accept-Language': currentLanguage(),
    'Content-Type': 'application/json',
  }
}

/** 构造 OTA 请求体（对齐 GetSystemInfoJson，浏览器适配） */
export function buildSystemInfoBody(deviceId: string, clientId: string): Record<string, unknown> {
  return {
    version: 2,
    language: currentLanguage(),
    mac_address: deviceId,
    uuid: clientId,
    chip_model_name: 'web',
    application: {
      name: CLIENT_NAME,
      version: __APP_VERSION__,
      compile_time: '',
      idf_version: '',
      elf_sha256: '',
    },
    board: { type: BOARD_TYPE },
  }
}
