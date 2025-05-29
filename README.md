# LLM面试官系统

一个基于FastAPI和WebSocket的前后端分离LLM技术面试系统，具有Chrome风格的现代化UI设计，支持实时流式对话。

## 🎯 功能特性

### 核心功能
- **智能面试官**: 基于LLM的专业技术面试官，能够进行多轮技术问答
- **流式对话**: 支持WebSocket实时流式消息传输，提供类似ChatGPT的打字效果
- **Chrome风格UI**: 采用Google Chrome设计规范，现代化界面体验
- **响应式设计**: 完美适配桌面端和移动端设备
- **实时状态**: 连接状态指示器，实时显示连接状态

### 技术特性
- **前后端分离**: FastAPI后端 + 原生JavaScript前端
- **WebSocket通信**: 低延迟实时双向通信
- **流式传输**: 支持LLM模型的流式输出显示
- **错误处理**: 完善的错误处理和用户反馈机制
- **自动重连**: WebSocket断线自动重连机制

## 🛠️ 技术栈

### 后端
- **FastAPI**: 现代Python Web框架
- **WebSocket**: 实时通信协议
- **OpenAI客户端**: 兼容OpenAI API的LLM客户端
- **Uvicorn**: ASGI服务器

### 前端
- **原生JavaScript**: 无框架依赖，轻量级实现
- **CSS3**: 现代CSS特性，Chrome设计风格
- **WebSocket API**: 浏览器原生WebSocket支持

## 📁 项目结构

```
web_rules_test/
├── app.py              # FastAPI后端主程序
├── llm.py              # LLM客户端封装
├── config.py           # 配置管理
├── start.py            # 启动脚本（推荐使用）
├── requirements.txt    # Python依赖
├── static/            # 前端静态文件
│   ├── index.html     # 主页面
│   ├── style.css      # 样式文件
│   └── app.js         # JavaScript逻辑
└── README.md          # 项目文档
```

## 🚀 快速开始

### 1. 环境准备

确保已安装Python 3.8+：

```bash
python --version
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置API密钥

创建`.env`文件或设置环境变量：

```bash
# 方式1：创建.env文件
echo "OPENAI_API_KEY=your_api_key_here" > .env
echo "OPENAI_BASE_URL=your_base_url_here" >> .env
echo "DEFAULT_MODEL=your_model_name" >> .env

# 方式2：设置环境变量（Windows）
set OPENAI_API_KEY=your_api_key_here
set OPENAI_BASE_URL=your_base_url_here
set DEFAULT_MODEL=your_model_name

# 方式3：设置环境变量（Linux/Mac）
export OPENAI_API_KEY=your_api_key_here
export OPENAI_BASE_URL=your_base_url_here
export DEFAULT_MODEL=your_model_name
```

### 4. 启动服务

**推荐方式 - 使用启动脚本：**
```bash
python start.py
```

启动脚本会自动进行环境检查，包括：
- Python版本检查
- 依赖包完整性验证
- API密钥配置检查
- 友好的错误提示和解决建议

**传统方式：**
```bash
python app.py
```

或使用uvicorn直接启动：
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### 5. 访问应用

打开浏览器访问：http://localhost:8000

## 🎮 使用指南

1. **打开应用**: 访问主页后会自动连接到面试官
2. **开始面试**: 告诉面试官您想要面试的技术方向
3. **实时对话**: 享受流式对话体验，就像与真人面试官交流
4. **查看状态**: 右上角显示连接状态，绿点表示已连接

## ⚙️ 配置选项

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API密钥 | 必填 |
| `OPENAI_BASE_URL` | API基础URL | `https://ark.cn-beijing.volces.com/api/v3` |
| `DEFAULT_MODEL` | 默认模型名称 | `deepseek-v3-250324` |

### 服务器配置

在`app.py`中可以修改：
- 服务器端口（默认8000）
- 主机地址（默认0.0.0.0）
- 是否启用热重载

## 🎨 UI特性

### Chrome设计风格
- **Material Design色彩**: 采用Google Material Design配色
- **现代化布局**: 清爽的卡片式设计
- **流畅动画**: 丰富的过渡动画效果
- **响应式设计**: 完美适配各种屏幕尺寸

### 交互体验
- **打字动画**: 三点跳动的打字指示器
- **流式文本**: 文字逐个显示的流式效果
- **状态反馈**: 清晰的连接状态和操作提示
- **错误处理**: 友好的错误提示和重试机制

## 🔧 开发说明

### 前端架构
- **模块化设计**: 单个InterviewApp类管理整个应用
- **事件驱动**: 基于DOM事件的交互处理
- **状态管理**: 完整的应用状态管理

### 后端架构
- **异步处理**: 基于asyncio的异步WebSocket处理
- **流式传输**: 支持LLM模型的流式输出
- **错误恢复**: 完善的异常处理和日志记录

### WebSocket消息协议

```javascript
// 消息开始
{"type": "message_start", "role": "assistant"}

// 内容片段
{"type": "content_delta", "content": "文本片段"}

// 消息结束
{"type": "message_end"}

// 错误消息
{"type": "error", "message": "错误描述"}
```

## 📝 日志规范

### 日志记录标准
本项目遵循统一的日志记录规范，确保所有关键操作都有完整的日志追踪：

- **WebSocket连接**: 记录连接建立、断开和错误信息
- **LLM调用**: 记录API调用状态、响应时间和错误详情
- **用户交互**: 记录用户消息和系统响应的关键节点
- **系统错误**: 详细记录异常堆栈和上下文信息

### 日志格式
```
[时间戳] [模块名] [日志级别] - 日志消息
示例：2024-01-01 12:00:00 - app - INFO - WebSocket连接已建立
```

## 🐛 常见问题

### 1. 连接失败
- 检查API密钥是否正确设置
- 确认网络连接正常
- 查看控制台错误信息

### 2. 流式效果不正常
- 确认WebSocket连接正常
- 检查浏览器是否支持WebSocket
- 查看后端日志输出

### 3. 样式显示异常
- 清除浏览器缓存
- 检查CSS文件是否正确加载
- 确认浏览器版本支持CSS3特性

### 4. 启动脚本问题
- 确保使用Python 3.8+版本
- 检查所有依赖是否正确安装
- 查看启动脚本的详细错误提示

## 📝 更新日志

### v1.0.0 (当前版本)
- ✅ 实现基础的LLM面试官功能
- ✅ 支持WebSocket流式对话
- ✅ Chrome风格UI设计
- ✅ 响应式布局适配
- ✅ 完善的错误处理机制
- ✅ 友好的启动脚本和环境检查

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进项目！

## 📄 许可证

本项目采用MIT许可证，详见LICENSE文件。

---

**享受您的LLM面试体验！** 🎉 