# 💊 药匣子 MedBox AI

> 基于多模态 AI 的用药安全辅助系统 - 让用药更安全、更简单

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ 功能特性

### 🔍 智能药品识别
- 上传药盒/说明书图片，自动识别药品信息
- 基于 **Kimi Vision** 多模态大模型进行 OCR 识别
- 识别药品名称、适应症、用法用量、禁忌、不良反应等

### 🤖 AI 用药指导
- 基于 **Kimi 大模型** 生成通俗易懂的用药说明
- 自动补充缺失的药品信息（基于药品名称检索知识库）
- 支持多轮对话问答，解答用药相关问题

### 🎙️ 语音播报系统
- 使用 **微软晓晓** 温柔女声朗读药品介绍
- 分段生成语音，支持播放控制（播放/暂停/停止/下一段）
- 自动过滤 emoji，生成自然流畅的语音

### 🎤 语音输入
- 支持语音提问（基于 Web Speech API）
- 实时语音识别，自动提交问题

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18.0
- **Python** >= 3.10
- **Kimi API Key**（从 [Moonshot AI](https://platform.moonshot.cn/) 获取）

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/18020281002-boop/medicalbox.git
cd medicalbox
```

#### 2. 安装 Node.js 依赖

```bash
npm install
```

#### 3. 安装 Python 依赖

```bash
pip install websockets edge-tts -i https://pypi.tuna.tsinghua.edu.cn/simple
```

#### 4. 配置 API Key

编辑 `server.js`，设置你的 Kimi API Key：

```javascript
const KIMI_API_KEY = 'your-kimi-api-key-here';
```

#### 5. 启动服务

**启动 TTS 语音服务（终端 1）：**

```bash
python tts_server.py
```

**启动 Node.js 后端（终端 2）：**

```bash
npm start
```

#### 6. 访问应用

打开浏览器访问：http://localhost:3000

---

## 📖 使用指南

### 识别药品

1. 点击上传区域或拖拽药盒/说明书图片
2. 点击「🔍 开始分析」按钮
3. 等待 AI 识别和分析
4. 查看 OCR 原始识别结果和 AI 解读

### 语音播报

- 分析完成后自动开始语音播报
- 使用播放器控制：▶️ 播放/暂停、⏹️ 停止、⏭️ 下一段
- 进度条显示当前播放进度

### 提问咨询

**文字提问：**
- 在输入框中输入问题
- 点击「提问」按钮或按回车

**语音提问：**
- 点击 🎤 麦克风按钮
- 说出你的问题
- 自动识别并提交

---

## 🏗️ 项目架构

```
medicalbox/
├── 📁 public/              # 前端静态文件
│   └── index.html         # 主页面
├── 📁 uploads/            # 上传的图片文件
├── 📁 voice/              # 生成的语音文件
├── 📄 server.js           # Node.js 后端服务
├── 📄 tts_server.py       # Python TTS 语音服务
├── 📄 package.json        # Node.js 依赖配置
└── 📄 README.md           # 项目说明文档
```

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | HTML5, CSS3, JavaScript (原生) |
| **后端** | Node.js, Express 5.2.1 |
| **AI 模型** | Kimi Vision (OCR), Kimi Chat (对话) |
| **语音合成** | edge-tts (微软晓晓) |
| **实时通信** | WebSocket |

---

## 🔧 配置说明

### 环境变量（可选）

创建 `.env` 文件：

```env
# Kimi API 配置
KIMI_API_KEY=your-api-key
KIMI_API_URL=https://api.moonshot.cn/v1/chat/completions

# TTS 服务配置
TTS_WS_PORT=8765
TTS_VOICE=zh-CN-XiaoxiaoNeural

# 服务器配置
PORT=3000
```

### 自定义语音角色

编辑 `tts_server.py` 修改语音角色：

```python
VOICE = "zh-CN-XiaoxiaoNeural"  # 微软晓晓温柔女声
# 其他可选：zh-CN-YunxiNeural, zh-CN-XiaoyiNeural 等
```

---

## ⚠️ 免责声明

本项目仅供参考学习，**不能替代医生诊断**。如有健康问题，请咨询专业医生或药师。

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

---

## 📄 许可证

本项目基于 [MIT](LICENSE) 许可证开源。

---

## 🙏 致谢

- [Moonshot AI](https://platform.moonshot.cn/) - 提供 Kimi 大模型 API
- [Microsoft Edge TTS](https://github.com/rany2/edge-tts) - 提供语音合成服务

---

<p align="center">
  💊 药匣子 MedBox AI - 守护您的用药安全
</p>
