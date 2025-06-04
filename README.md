# Azure语音面试官系统 - FastRTC增强版

基于 Azure OpenAI 实时语音模型和 FastRTC 音频增强技术的智能面试系统，提供专业的高质量语音面试体验。

## 📑 快速导航

### 关键文件索引
- [`start_azure_voice_interview.py`](start_azure_voice_interview.py) - Azure语音系统启动脚本，环境检查与服务启动
- [`backend/app.py`](backend/app.py) - Azure语音面试主应用，WebSocket语音服务端，集成FastRTC音频处理
- [`static/index.html`](static/index.html) - Azure语音面试前端界面，多页面路由系统
- [`static/app.js`](static/app.js) - Azure语音客户端逻辑，WebSocket音频通信与数据管理
- [`static/voice-call.js`](static/voice-call.js) - FastRTC增强语音通话模块，专业音频处理与VAD检测
- [`static/style.css`](static/style.css) - Azure主题UI样式，现代化语音交互界面设计
- [`config.py`](config.py) - FastRTC音频增强配置，音频质量与处理参数

### 按功能查找
- **环境配置** → Azure OpenAI API密钥设置
- **启动系统** → [`start_azure_voice_interview.py`](start_azure_voice_interview.py) 
- **语音面试** → 主页面，Azure实时语音通信，FastRTC音频增强
- **语音通话** → 点击麦克风按钮，全屏语音交互界面（纯白色清晰背景）
- **音频质量** → FastRTC专业音频预处理，VAD语音活动检测
- **简历管理** → 导航栏"简历设置"页面，个性化语音面试
- **历史记录** → 导航栏"历史记录"页面，语音面试记录管理
- **音频播放** → 流式语音播放与重播功能
- **响应式设计** → Azure主题CSS，支持移动端语音交互

## 🎯 系统特性

### 核心功能特性
```javascript
// Azure实时语音面试 - 即开即用
访问应用 → 立即开始语音面试对话

// FastRTC增强语音通话模式 - 专业音频处理
点击麦克风按钮 → 全屏语音界面 → 高质量实时语音对话 → 智能语音可视化效果

// 个性化语音面试流程
导航栏"简历设置" → 上传PDF/Word → 返回面试 → Azure AI基于简历进行语音提问
```

### FastRTC音频增强技术特性
- **🎤 专业音频预处理**: 集成高通/低通滤波器、动态压缩器、自动增益控制
- **🧠 智能语音活动检测(VAD)**: 实时检测语音开始/结束，优化音频传输效率
- **🔊 高质量音频编码**: 24kHz采样率、16位深度、PCM格式，确保音频清晰度
- **⚡ 超低延迟处理**: 10ms目标延迟，实时音频处理管道优化
- **🎛️ 动态音频优化**: 自适应降噪、回声消除、音频增强算法
- **📊 实时音频分析**: 音频能量检测、频谱分析、可视化反馈

### Azure语音技术特性
- **🎤 实时语音对话**: 基于Azure OpenAI实时语音模型，支持语音输入和语音输出
- **📝 文本输入支持**: 也可以通过文字进行交流，灵活切换
- **📄 简历分析**: 上传简历获得个性化语音面试
- **🎯 专业面试**: 技术能力全面评估，语音交互更自然
- **🔄 流式语音播放**: 边接收边播放，降低延迟提升体验
- **🎵 音频重播**: 生成完整音频文件供重复播放
- **🖼️ 清晰界面设计**: 全屏语音界面采用纯白色背景，提供清晰、专业的视觉体验

### 多页面导航系统
- **语音面试页面**: Azure实时语音WebSocket通信，FastRTC音频增强处理
- **历史记录页面**: 语音面试记录管理，支持继续面试
- **简历设置页面**: 文件上传管理，个性化语音面试配置

### 技术特性
- **Azure OpenAI集成**: 使用最新的实时语音模型
- **FastRTC音频引擎**: 专业级音频处理与优化
- **WebSocket音频流**: 实时双向语音通信
- **流式音频处理**: PCM音频解码与WAV文件生成
- **本地存储**: localStorage管理面试历史
- **文件处理**: 支持PDF、Word文档解析
- **现代化设计**: Azure主题设计语言，纯白色清晰界面，支持移动端

## 🚀 快速开始

### 1. 环境准备
```bash
# 克隆项目
git clone <repository-url>
cd azure-voice-interview

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# 或
.venv\Scripts\activate     # Windows

# 安装依赖（包含FastRTC音频增强）
pip install -r requirements.txt
```

### 2. 配置Azure OpenAI

**方式一：环境变量**
```bash
export AZURE_OPENAI_API_KEY="your_azure_api_key_here"
export AZURE_OPENAI_ENDPOINT="https://your-resource-name.openai.azure.com"
export AZURE_API_VERSION="2025-04-01-preview"  # 可选
```

**方式二：Windows命令行**
```cmd
set AZURE_OPENAI_API_KEY=your_azure_api_key_here
set AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
```

### 3. 启动系统
```bash
# 推荐：使用Azure语音启动脚本（包含环境检查）
python start_azure_voice_interview.py

# 或直接启动
uvicorn backend.app:app --host localhost --port 8000 --reload
```

### 4. 开始使用
1. 浏览器访问：http://localhost:8000
2. **直接语音面试**：页面加载后立即开始语音对话
3. **FastRTC增强体验**：点击麦克风按钮体验专业音频处理
4. **个性化语音面试**：通过导航栏"简历设置"上传简历
5. **查看历史**：通过导航栏"历史记录"管理语音面试记录

## 💼 用户指南

### 使用流程

#### 快速语音面试模式
```
启动应用 → 点击语音按钮 → 开始Azure实时语音面试 → FastRTC增强音频体验
```

#### 个性化语音面试模式
```
启动应用 → 导航栏"简历设置" → 上传简历文件 → 返回面试页面 → Azure AI基于简历进行语音提问
```

#### 语音面试历史管理
```
导航栏"历史记录" → 查看过往语音面试 → 支持继续面试、音频重播、删除记录
```

### 界面导航
- **顶部导航栏**: 
  - 🎤 语音面试：Azure实时语音对话界面，FastRTC音频增强
  - 📋 历史记录：语音面试记录管理
  - 📄 简历设置：文件上传管理
- **连接状态**: 实时显示Azure语音服务连接状态
- **语音交互**: 支持语音输入、文本输入、语音输出
- **音频播放**: 流式语音播放与完整音频重播

### FastRTC音频增强功能
- **智能语音检测**: 自动识别语音开始和结束，避免无效音频传输
- **专业音频处理**: 实时降噪、回声消除、音频增强
- **可视化反馈**: 根据语音强度动态调整界面效果
- **音频质量监控**: 实时显示音频质量统计信息
- **延迟优化**: 10ms超低延迟音频处理

### 功能特色
- **即开即用**: Azure语音服务启动后直接可用
- **专业音质**: FastRTC音频增强确保清晰通话质量
- **智能导航**: 清晰的功能分工，直观的页面切换
- **数据持久**: 本地存储语音面试记录，隐私安全
- **跨平台**: 响应式设计，桌面端和移动端完美适配
- **专业语音**: Azure OpenAI实时语音模型，自然流畅

## 🔧 技术架构

### 系统架构图
```
Frontend (Azure语音客户端 + FastRTC音频引擎)
├── index.html        # Azure语音面试界面
├── app.js            # Azure语音WebSocket客户端
│   ├── AzureVoiceChat       # Azure语音聊天管理
│   ├── LocalStorageManager  # 本地数据存储
│   ├── PageRouter          # 页面路由管理  
│   ├── HistoryManager      # 语音面试历史记录
│   ├── ResumeManager       # 简历文件管理
│   └── AzureVoiceInterviewApp # 主应用逻辑
├── voice-call.js     # FastRTC增强语音通话模块
│   ├── 专业音频预处理管道    # 滤波器、压缩器、增益控制
│   ├── 智能VAD语音检测      # 语音活动检测与优化
│   ├── 实时音频分析        # 频谱分析、能量检测
│   └── 音频质量监控        # 统计信息、性能指标
└── style.css         # Azure主题UI样式

Backend (Azure语音服务 + FastRTC音频处理)
├── app.py            # Azure语音面试主应用
│   ├── AzureVoiceService    # Azure语音服务类
│   ├── FastRTC音频处理      # process_fastrtc_audio方法
│   ├── WebSocket端点        # /ws/voice (FastRTC增强)
│   └── 简历上传API          # /api/upload-resume
├── config.py         # FastRTC音频增强配置
└── 文件处理模块       # PDF/Word解析
```

### FastRTC音频处理管道
```
麦克风输入 → WebRTC音频约束 → 音频上下文 → 高通滤波器 → 低通滤波器 
→ 动态压缩器 → 增益控制 → VAD检测 → 音频分析 → PCM编码 → WebSocket传输
```

### 关键技术栈
- **后端**: FastAPI + uvicorn + Azure OpenAI SDK + FastRTC
- **前端**: 原生JavaScript + WebSocket + Web Audio API + FastRTC音频处理
- **Azure集成**: Azure OpenAI实时语音模型
- **音频处理**: FastRTC + PCM解码 + WAV生成 + 流式播放 + VAD检测
- **文件处理**: python-docx + PyPDF2
- **UI设计**: Azure主题设计语言，CSS Grid + Flexbox

### 数据流设计
```
用户语音输入 → FastRTC音频预处理 → VAD检测 → PCM编码 → WebSocket → 
Azure OpenAI → 流式音频响应 → 前端播放 → 本地存储
```

## 📝 配置参考

### 关键环境变量
| 变量名 | 说明 | 必需 | 默认值 |
|--------|------|------|--------|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API密钥 | 是 | - |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI端点URL | 是 | - |
| `AZURE_API_VERSION` | Azure API版本 | 否 | 2025-04-01-preview |

### FastRTC音频配置
```python
# 音频质量设置
SAMPLE_RATE = 24000      # 采样率 (Hz)
BIT_DEPTH = 16           # 位深度
CHANNELS = 1             # 声道数（单声道）

# VAD语音活动检测
VAD_THRESHOLD = 0.01     # VAD阈值
MIN_SPEECH_DURATION = 300 # 最小语音持续时间 (ms)
TARGET_LATENCY = 0.01    # 目标延迟 (10ms)

# 音频滤波器
HIGH_PASS_FREQUENCY = 80  # 高通滤波器 (Hz)
LOW_PASS_FREQUENCY = 8000 # 低通滤波器 (Hz)
```

### 推荐配置
```env
# Azure OpenAI配置
AZURE_OPENAI_API_KEY=your_azure_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_API_VERSION=2025-04-01-preview

# 服务配置
HOST=localhost
PORT=8000
LOG_LEVEL=INFO
```

## 🎵 FastRTC音频增强详解

### 音频处理管道
1. **音频采集**: 24kHz高质量采样，16位深度
2. **预处理**: 高通/低通滤波器去除噪音
3. **动态处理**: 压缩器优化音频动态范围
4. **增益控制**: 自动增益确保音量一致性
5. **VAD检测**: 智能识别语音活动
6. **编码传输**: PCM格式高效传输

### 语音活动检测(VAD)
- **实时检测**: 基于音频能量的RMS计算
- **平滑处理**: 避免误触发和频繁切换
- **智能缓冲**: 语音结束后延迟发送，确保完整性
- **质量过滤**: 只传输高质量语音片段

### 音频质量优化
- **降噪处理**: 多级滤波器去除环境噪音
- **回声消除**: WebRTC内置回声消除算法
- **音频增强**: 动态压缩和增益控制
- **延迟优化**: 10ms超低延迟处理

### 可视化反馈
- **实时波形**: 根据音频强度动态显示
- **状态指示**: 聆听、处理、静音状态可视化
- **质量监控**: 音频质量统计信息显示

## 📊 日志规范

### 音频处理日志
系统自动记录FastRTC音频处理的关键信息：

```
[2025-01-XX XX:XX:XX] [FastRTC Audio] - 音频处理管道初始化完成
[2025-01-XX XX:XX:XX] [VAD Detection] - 检测到语音开始，VAD置信度: 0.045
[2025-01-XX XX:XX:XX] [Audio Quality] - 发送音频数据，长度: 8192, 格式: pcm_s16le
[2025-01-XX XX:XX:XX] [WebSocket] - 收到FastRTC音频数据: 格式=pcm_s16le, 采样率=24000, VAD置信度=0.045
```

### 错误追踪
- **音频初始化错误**: 记录设备访问、权限问题
- **处理管道错误**: 记录音频处理节点连接失败
- **VAD检测错误**: 记录语音活动检测异常
- **传输错误**: 记录WebSocket音频传输问题

### 性能监控
- **延迟统计**: 记录音频处理延迟
- **质量指标**: 记录音频质量参数
- **资源使用**: 记录CPU、内存使用情况
- **连接状态**: 记录WebSocket连接稳定性

## 🔍 故障排除

### 常见问题

#### Azure服务连接问题
```bash
# 检查Azure配置
echo $AZURE_OPENAI_API_KEY
echo $AZURE_OPENAI_ENDPOINT

# 验证网络连接
curl -H "api-key: $AZURE_OPENAI_API_KEY" $AZURE_OPENAI_ENDPOINT/openai/deployments
```

#### 音频播放问题
- **浏览器兼容性**: 确保使用支持Web Audio API的现代浏览器
- **音频权限**: 检查浏览器音频播放权限设置
- **网络延迟**: 检查网络连接质量，影响实时音频传输

#### 简历上传问题
- **文件格式**: 仅支持PDF、DOC、DOCX格式
- **文件大小**: 限制10MB以内
- **编码问题**: 确保文档使用标准编码格式

## 🚀 部署指南

### 生产环境部署
```bash
# 设置生产环境变量
export AZURE_OPENAI_API_KEY="your_production_key"
export AZURE_OPENAI_ENDPOINT="your_production_endpoint"

# 启动生产服务
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --workers 4
```

### Docker部署
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进Azure语音面试系统！

### 开发流程
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

**Azure语音面试官系统** - 让面试更智能，让交流更自然 🎤✨
