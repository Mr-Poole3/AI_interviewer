# LLM面试官系统

一个基于FastAPI和WebSocket的前后端分离LLM技术面试系统，具有Chrome风格的现代化UI设计，支持实时流式对话和智能简历解析。

## 🎯 功能特性

### 核心功能
- **智能面试官**: 基于LLM的专业技术面试官，能够进行多轮技术问答
- **📄 简历上传**: 支持PDF和Word格式简历上传，基于简历内容进行个性化面试
- **🎯 个性化面试**: 根据简历背景自动生成针对性面试问题和评估标准
- **流式对话**: 支持WebSocket实时流式消息传输，提供类似ChatGPT的打字效果
- **Chrome风格UI**: 采用Google Chrome设计规范，现代化界面体验
- **响应式设计**: 完美适配桌面端和移动端设备
- **实时状态**: 连接状态指示器，实时显示连接状态

### 技术特性
- **前后端分离**: FastAPI后端 + 原生JavaScript前端
- **WebSocket通信**: 低延迟实时双向通信
- **流式传输**: 支持LLM模型的流式输出显示
- **文档解析**: 智能解析PDF和Word文档，提取简历内容
- **拖拽上传**: 现代化的文件上传界面，支持拖拽和点击上传
- **双Prompt架构**: 结合简历信息和面试指导的智能prompt生成
- **错误处理**: 完善的错误处理和用户反馈机制
- **自动重连**: WebSocket断线自动重连机制

## 🛠️ 技术栈

### 后端
- **FastAPI**: 现代Python Web框架
- **WebSocket**: 实时通信协议
- **OpenAI客户端**: 兼容OpenAI API的LLM客户端
- **Uvicorn**: ASGI服务器
- **PyPDF2**: PDF文档解析库
- **python-docx**: Word文档解析库
- **python-multipart**: 文件上传支持

### 前端
- **原生JavaScript**: 无框架依赖，轻量级实现
- **CSS3**: 现代CSS特性，Chrome设计风格
- **WebSocket API**: 浏览器原生WebSocket支持
- **File API**: 浏览器原生文件处理支持

## 📁 项目结构

```
web_rules_test/
├── backend/                 # 后端模块
│   ├── app.py              # FastAPI主程序，包含WebSocket和文件上传接口
│   └── llm.py              # LLM客户端封装，支持双Prompt模式
├── static/                 # 前端静态文件
│   ├── index.html          # 主页面，包含简历上传UI
│   ├── style.css           # 样式文件，包含上传组件样式
│   └── app.js              # JavaScript逻辑，包含文件上传处理
├── start.py                # 启动脚本（推荐使用）
├── config.py               # 配置管理
├── requirements.txt        # Python依赖
└── README.md               # 项目文档
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
python backend/app.py
```

或使用uvicorn直接启动：
```bash
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

### 5. 访问应用

打开浏览器访问：http://localhost:8000

## 🎮 使用指南

### 基础使用流程

1. **打开应用**: 访问主页后会看到简历上传界面
2. **选择面试方式**：
   - **上传简历**：获得基于个人背景的个性化面试
   - **跳过上传**：进行通用技术方向面试
3. **简历上传**（可选）：
   - 支持PDF、DOC、DOCX格式
   - 文件大小限制：最大10MB
   - 支持拖拽上传或点击选择
4. **开始面试**: 享受流式对话体验，就像与真人面试官交流
5. **查看状态**: 右上角显示连接状态，绿点表示已连接

### 简历上传功能

#### 支持的文件格式
- **PDF文档** (.pdf)
- **Word文档** (.doc, .docx)

#### 上传方式
1. **拖拽上传**: 直接将文件拖拽到上传区域
2. **点击上传**: 点击上传区域选择文件
3. **实时进度**: 显示上传进度和解析状态

#### 个性化面试体验
- 系统会自动解析简历内容
- 基于技术栈、项目经验和工作背景生成问题
- 面试难度自动匹配经验水平
- 针对性的技术深度评估

## ⚙️ 配置选项

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API密钥 | 必填 |
| `OPENAI_BASE_URL` | API基础URL | `https://ark.cn-beijing.volces.com/api/v3` |
| `DEFAULT_MODEL` | 默认模型名称 | `deepseek-v3-250324` |

### 服务器配置

在`backend/app.py`中可以修改：
- 服务器端口（默认8000）
- 主机地址（默认0.0.0.0）
- 是否启用热重载
- 文件上传大小限制（默认10MB）

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
- **文件上传**: 现代化的拖拽上传界面
- **进度显示**: 实时的上传进度和处理状态
- **错误处理**: 友好的错误提示和重试机制

## 🔧 开发说明

### 前端架构
- **模块化设计**: 单个InterviewApp类管理整个应用
- **事件驱动**: 基于DOM事件的交互处理
- **状态管理**: 完整的应用状态管理
- **文件处理**: 集成文件验证、上传和进度监控

### 后端架构
- **异步处理**: 基于asyncio的异步WebSocket处理
- **流式传输**: 支持LLM模型的流式输出
- **文件解析**: 支持PDF和Word文档内容提取
- **会话管理**: 简单而有效的用户会话管理
- **错误恢复**: 完善的异常处理和日志记录

### API接口

#### WebSocket消息协议

```javascript
// 消息开始
{"type": "message_start", "role": "assistant"}

// 内容片段
{"type": "content_delta", "content": "文本片段"}

// 消息结束
{"type": "message_end"}

// 简历上传通知
{"type": "resume_uploaded", "session_id": "session_123"}

// 错误消息
{"type": "error", "message": "错误描述"}
```

#### HTTP接口

**简历上传接口**
```http
POST /api/upload-resume
Content-Type: multipart/form-data

参数:
- file: 上传的简历文件 (PDF/Word)

响应:
{
    "success": true,
    "message": "简历上传并解析成功",
    "session_id": "session_123",
    "resume_preview": "简历内容预览...",
    "text_length": 1250
}
```

### 双Prompt架构

系统采用创新的双Prompt架构：

1. **Prompt1（简历信息）**: 包含用户简历的完整内容
2. **Prompt2（面试指导）**: 专业面试官的角色设定和评估标准

```python
def create_interview_system_prompt(resume_content: str) -> str:
    prompt1 = f"用户简历信息：\n{resume_content}\n\n"
    prompt2 = """你是一个专业的技术面试官。基于用户的简历信息，请：
    1. 分析候选人的技术背景、工作经验和项目经历
    2. 针对简历中提到的技术栈、项目和工作经验提出相关问题
    3. 评估候选人的技术深度和广度
    4. 关注简历中的关键技能和项目成果
    5. 根据候选人的经验水平调整问题难度
    """
    return prompt1 + prompt2
```

## 📝 日志规范

### 日志记录标准
本项目遵循统一的日志记录规范，确保所有关键操作都有完整的日志追踪：

- **WebSocket连接**: 记录连接建立、断开和错误信息
- **LLM调用**: 记录API调用状态、响应时间和错误详情
- **文件上传**: 记录文件上传、解析过程和结果状态
- **简历处理**: 记录简历解析成功/失败及文本提取长度
- **用户交互**: 记录用户消息和系统响应的关键节点
- **系统错误**: 详细记录异常堆栈和上下文信息

### 关键操作日志
- **简历上传**: `简历上传处理 - 文件名: xxx.pdf, 大小: 2MB, 解析状态: 成功`
- **个性化面试**: `基于简历内容生成个性化面试prompt - 会话ID: session_123`
- **文档解析**: `PDF解析完成 - 提取文本长度: 1250字符`

### 日志格式
```
[时间戳] [模块名] [日志级别] - 日志消息
示例：2024-01-01 12:00:00 - backend.app - INFO - 简历上传并解析成功，提取文本长度: 1250 字符
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

### 4. 简历上传问题
- **文件格式不支持**: 确保文件为PDF、DOC或DOCX格式
- **文件过大**: 检查文件大小是否超过10MB限制
- **解析失败**: 确认文档没有损坏，内容可读
- **上传失败**: 检查网络连接和服务器状态

### 5. 个性化面试问题
- **问题不够针对**: 检查简历内容是否完整，技术信息是否明确
- **面试官无响应**: 查看控制台错误，确认API密钥有效
- **问题过简单/复杂**: 系统会根据简历经验自动调整难度

### 6. 启动脚本问题
- 确保使用Python 3.8+版本
- 检查所有依赖是否正确安装（特别是新增的文档解析库）
- 查看启动脚本的详细错误提示

## 📝 更新日志

### v1.1.0 (当前版本)
- ✅ **新增简历上传功能**: 支持PDF和Word格式文档上传
- ✅ **个性化面试体验**: 基于简历内容生成针对性面试问题
- ✅ **拖拽上传界面**: 现代化的文件上传用户体验
- ✅ **双Prompt架构**: 智能结合简历信息和面试指导
- ✅ **文档解析引擎**: 自动提取PDF和Word文档文本内容
- ✅ **实时进度反馈**: 文件上传和解析进度可视化
- ✅ **升级依赖库**: 更新OpenAI库到1.82.0，修复兼容性问题

### v1.0.0
- ✅ 实现基础的LLM面试官功能
- ✅ 支持WebSocket流式对话
- ✅ Chrome风格UI设计
- ✅ 响应式布局适配
- ✅ 完善的错误处理机制
- ✅ 友好的启动脚本和环境检查

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进项目！

### 开发环境设置
1. 克隆项目：`git clone <project-url>`
2. 安装依赖：`pip install -r requirements.txt`
3. 配置环境变量
4. 运行测试：`python -m pytest` (如果有测试)

### 代码规范
- 遵循PEP 8编码规范
- 添加必要的类型注解
- 编写清晰的文档字符串
- 保持代码注释的及时更新

## 📄 许可证

本项目采用MIT许可证，详见LICENSE文件。

---

**享受您的LLM面试体验！** 🎉 