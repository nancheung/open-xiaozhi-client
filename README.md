# 🤖 Open Xiaozhi Client

![WebUI](https://img.shields.io/badge/WebUI-Available-22c55e?style=flat-square)
![Xiaozhi](https://img.shields.io/badge/Xiaozhi-Ecosystem-2563eb?style=flat-square)
![Client](https://img.shields.io/badge/Client-Full%20Protocol%20Implementation-7c3aed?style=flat-square)
![npm](https://img.shields.io/npm/v/open-xiaozhi-client-webui?style=flat-square&color=cb3837)
![License](https://img.shields.io/badge/License-AGPL--3.0-orange?style=flat-square)

![Open Xiaozhi Client WebUI 亮色-双栏](https://raw.githubusercontent.com/nancheung/open-xiaozhi-client/main/docs/images/open-xiaozhi-client-webui-placeholder-1.png)

> 🎙️ 面向 **小智生态** 的开源客户端全协议实现。  
> 让你可以更快地 **学习协议、联调服务端、排查问题、体验小智能力**。

**Open Xiaozhi Client** 是一个基于小智生态的开源客户端项目，目标是提供一个真正可用、可观察、可调试的客户端实现入口。当前已经提供 **WebUI 调试端**，后续会继续扩展到更多平台和终端形态。

它既适合开发者作为 **小智服务端调试工具** 使用，也适合普通用户快速上手体验小智的交互链路。

```bash
npm install -g open-xiaozhi-client-webui
open-xiaozhi-client-webui
```

> ⚡ 1分钟跑起来！执行后自动启动本地服务并打开浏览器，默认访问 `http://127.0.0.1:14100`，按 `Ctrl+C` 退出。

## ✨ 为什么值得关注

- ⚡ **1 分钟跑起来**：安装依赖、启动 WebUI、连接服务端，快速进入调试状态
- 📐 **全协议实现定位**：围绕小智客户端侧能力建设，方便理解消息流和交互链路
- 🔍 **兼顾调试与体验**：既能看协议细节，也能直接体验 WebUI 交互
- 🔗 **适配小智生态**：支持官方小智，也支持开源服务端
- 🔮 **面向未来多端**：当前是 WebUI，未来会继续支持更多客户端形态

## 🚀 当前已经可以做什么

当前版本重点提供一个面向学习、联调、排障的 **WebUI 小智客户端**。

| 能力 | 说明 |
| --- | --- |
| 🖥️ 响应式 WebUI 客户端 | 宽屏双栏布局（对话历史 + 指令中心）/ 窄屏单栏布局，面板宽度可拖拽调整 |
| 📡 连接状态查看 | 查看 OTA 获取、连接中、握手中、就绪、播放中等状态变化 |
| 🎤 三种监听模式 | 对讲机（手动）/ 智能助理（VAD 自动）/ 通话（全双工实时），可随时切换 |
| 🔊 音频可视化 | 录音音量条 + 播放波形动画，实时反映收发音频状态 |
| 📋 协议日志面板 | 实时观察 WebSocket 文本帧、二进制帧、系统日志 |
| 📨 自定义消息发送 | 手动发送 JSON 消息，便于模拟与调试协议行为 |
| 🎛️ 设备控制面板 | 调整音量、屏幕亮度、明暗主题，查看收到的 IoT 命令，设置持久化 |
| 🌐 HTTP 面板 | 在连接态下发送服务端管理指令（更新配置、重启等） |
| ⚙️ 设置面板 | 调整 Hello 参数、音频参数、心跳、日志数量等配置，持久化保存 |
| 🤖 MCP 协议支持 | 客户端作为 MCP Server 响应服务端工具调用（音量、亮度、主题、重启等） |

## 👥 适合谁

- 📖 想学习 **小智协议 / xiaozhi protocol** 的开发者
- 🔧 想联调 **官方小智** 或 **开源服务端** 的开发者
- 🐛 想快速定位连接、握手、消息收发问题的服务端开发者
- 🏗️ 想基于小智生态继续扩展桌面端、移动端或其他客户端的贡献者
- 🌟 想先体验小智交互流程的普通用户

## 🔍 为什么这个项目对服务端调试有价值

很多小智相关项目在服务端开发阶段，最难的不是功能本身，而是：

- 👀 不容易看清楚客户端到底发了什么
- 🔄 不容易复现某个握手或协议问题
- ✅ 不容易快速验证 IoT、HTTP、音频、消息链路是否正常

这个项目的价值就在于提供一个 **可视化、可操作、可观察** 的客户端调试入口：  
你可以一边连接服务端，一边查看协议日志，一边手动发送消息或修改配置，从而更高效地定位问题。

## 🌐 支持的小智生态项目

### 官方小智

- GitHub: https://github.com/78/xiaozhi-esp32

### 开源服务端

- GitHub: https://github.com/xinnan-tech/xiaozhi-esp32-server

> 本项目聚焦 **客户端侧实现、协议学习与服务端调试体验**，不替代服务端项目本身。

## ⚡ 快速开始

```bash
npm install -g open-xiaozhi-client-webui
open-xiaozhi-client-webui
```

命令执行后会自动启动本地服务并打开浏览器，默认访问地址为 `http://127.0.0.1:14100`。若端口被占用会自动顺延。按 `Ctrl+C` 退出。

进入页面后，你可以：

1. 在顶部填写服务地址，默认可按小智服务端 OTA 地址格式接入
2. 点击连接，观察连接状态与握手流程
3. 在协议日志中查看消息收发
4. 在设备控制 / HTTP / 设置面板中继续联调和排障

### 源码开发模式

> 适合在本地修改代码、参与开发的贡献者。

**环境要求**：Node.js 18+、npm 9+

```bash
npm install
npm run dev
```

启动后默认访问：`http://localhost:5173`

## 🏗️ 构建

```bash
npm run build
```

## 📁 项目结构

```text
src/
  🧩 components/   WebUI 组件与调试面板
  ⚙️ features/     连接、协议、音频、IoT、MCP、设备等业务状态
  🪝 hooks/        音频与连接相关 Hook
  🗄️ store/        全局状态管理（Zustand slice 模式）
  📡 ws/           WebSocket 管理与协议收发
```

## 🎯 这个项目的定位

这不是一个单纯的演示页面，也不只是一个简单的调试脚本。

它更适合作为：

- 📌 **小智客户端实现参考**
- 🔧 **小智服务端联调工具**
- 📚 **小智协议学习入口**
- 🏗️ **未来多端客户端的基础工程**

## 🗺️ 路线图

- [x] ~~WebUI 调试端~~ ✅
- [x] ~~面向协议学习与服务端调试的基础交互能力~~ ✅
- [x] ~~响应式双栏布局 + 三种监听模式~~ ✅
- [x] ~~MCP 协议支持 + 设备控制面板~~ ✅
- [ ] 📱 更多客户端形态支持
- [ ] 🖥️ 更完整的多端体验
- [ ] 🔄 持续完善小智生态下的客户端能力

## 🤝 贡献与关注

如果你也在关注 **小智客户端、xiaozhi WebUI、服务端联调、协议实现**，欢迎：

- ⭐ Star 这个项目
- 🐛 提交 Issue 反馈问题或需求
- 🔀 提交 PR 一起完善客户端能力
- 🌍 参与多端扩展与生态适配

---

> 💡 如果你希望有一个 **更容易上手、又足够专业的小智客户端调试入口**，这个项目正是为此而生。
