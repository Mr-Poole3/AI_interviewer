# AI智能面试官 - 专业语音面试系统

基于 Azure OpenAI 实时语音模型的现代化智能面试系统，提供专业的高质量语音面试体验和现代化用户界面。

## 📑 快速导航

### 关键文件索引
- [`start.py`](start.py) - 系统启动脚本，环境检查与服务启动
- [`backend/app.py`](backend/app.py) - 语音面试主应用，WebSocket语音服务端
- [`static/index.html`](static/index.html) - 现代化面试前端界面，响应式设计
- [`static/app.js`](static/app.js) - 前端交互逻辑，WebSocket通信与功能管理
- [`static/voice-call.js`](static/voice-call.js) - 语音通话管理器，Azure WebRTC集成
- [`static/style.css`](static/style.css) - 现代化UI设计系统，专业面试主题
- [`prompts.py`](prompts.py) - AI提示词配置文件，集中管理所有prompt
- [`config.py`](config.py) - 系统配置文件

### 按功能查找
- **环境配置** → Azure OpenAI API密钥设置
- **启动系统** → [`start.py`](start.py) 
- **语音面试** → 主页面，Azure实时语音通信
- **语音通话** → 点击麦克风按钮，全屏语音交互界面
- **面试保存** → 结束面试时的智能保存确认机制
- **简历管理** → 导航栏"简历管理"页面，个性化面试，支持简历制作工具
- **历史记录** → 导航栏"面试历史"页面，面试记录管理
- **Prompt管理** → [`prompts.py`](prompts.py) 文件，集中配置AI提示词
- **现代化界面** → 响应式设计，支持移动端和桌面端

## 🎯 系统特性

### 现代化界面设计
```javascript
// 现代化面试界面 - 专业设计
访问应用 → 现代化欢迎界面 → 开始语音面试对话

// 全屏语音通话模式 - 沉浸式体验
点击麦克风按钮 → 全屏语音界面 → 实时语音对话 → 智能语音可视化

// 智能面试保存 - 用户友好的保存机制
结束面试 → 保存确认对话框 → 查看面试统计 → 选择保存或丢弃

// 个性化面试流程
导航栏"简历管理" → 拖拽上传文件 → 返回面试 → AI基于简历进行语音提问

// 快捷操作导航 - 优化用户体验
快捷操作区域 → 上传简历/查看历史/设置 → 一键切换页面功能
```

### 核心功能特性
- **🎤 实时语音对话**: 基于Azure OpenAI实时语音模型，支持语音输入和语音输出
- **💬 智能聊天界面**: 现代化聊天气泡设计，支持头像和时间戳
- **📝 混合输入模式**: 支持语音输入和文本输入，灵活切换
- **💾 智能面试保存**: 结束面试时弹出保存确认对话框，用户可选择保存或丢弃面试记录
- **📊 面试统计显示**: 保存确认对话框显示面试时长、对话轮次、简历状态等关键信息
- **📄 智能简历分析**: 拖拽上传简历获得个性化面试，支持完整简历内容传递，简历解析成功后自动隐藏上传界面
- **🔗 简历制作工具**: 在简历管理页面提供天汇AI简历工具入口，无简历时可快速制作专业简历
- **🎯 专业面试评估**: 技术能力全面评估，语音交互更自然
- **🔄 流式语音播放**: 边接收边播放，降低延迟提升体验
- **🎵 音频重播功能**: 生成完整音频文件供重复播放
- **📱 响应式设计**: 完美适配桌面端和移动端设备，优化小屏幕体验
- **🎨 集中Prompt管理**: 所有AI提示词集中在prompts.py文件中管理，支持不同岗位专业模板

### 现代化UI/UX特性
- **🎨 专业设计系统**: 现代化色彩方案，专业面试主题
- **✨ 流畅动画效果**: CSS动画和过渡效果，提升用户体验
- **🌟 玻璃拟态设计**: 现代化卡片设计，渐变背景和阴影效果
- **🔔 智能通知系统**: 实时状态提示和操作反馈
- **📊 可视化状态指示**: 语音状态动画，连接状态实时显示
- **🎯 直观导航系统**: 清晰的功能分区，便捷的页面切换
- **💫 交互式元素**: 悬停效果，点击反馈，提升交互体验
- **🔧 优化快捷操作**: 修复导航按钮功能，支持一键切换页面
- **📐 增强响应式适配**: 优化移动端布局，防止元素遮挡，确保44px最小点击目标
- **💾 智能保存确认**: 美观的保存确认对话框，提供面试统计和保存建议

### 多页面导航系统
- **面试主页**: 欢迎界面 + 聊天界面，Azure实时语音WebSocket通信
- **面试历史页面**: 面试记录管理，支持筛选和统计
- **简历管理页面**: 拖拽上传，文件预览，个性化面试配置
- **全屏语音界面**: 沉浸式语音通话体验
- **快捷操作区域**: 上传简历、查看历史、设置功能的快速访问

### 智能面试保存功能
- **🤔 用户选择权**: 结束面试后不再自动保存，而是让用户主动选择
- **📊 详细统计**: 显示面试时长、对话轮次、简历状态等关键信息
- **💡 保存建议**: 清晰展示保存面试记录的好处和价值
- **🎨 美观界面**: 现代化的确认对话框设计，提升用户体验
- **⚡ 快速操作**: 一键保存或丢弃，操作简单直观
- **🔒 防误操作**: 点击背景不会关闭对话框，避免意外丢失数据

### 技术特性
- **Azure OpenAI集成**: 使用最新的实时语音模型
- **WebSocket音频流**: 实时双向语音通信
- **WebRTC语音通话**: 直连Azure OpenAI Realtime API，低延迟语音交互
- **流式音频处理**: PCM音频解码与WAV文件生成
- **本地存储管理**: localStorage管理面试历史和用户设置
- **文件处理支持**: 支持PDF、Word文档解析
- **现代化前端**: 原生JavaScript + CSS Grid + Flexbox
- **拖拽上传功能**: 现代化文件上传体验
- **移动端优化**: 触摸友好的交互设计，防止内容遮挡
- **集中Prompt管理**: 统一的AI提示词配置系统，支持API动态获取

## 🚀 快速开始

### 1. 环境准备
```bash
# 克隆项目
git clone <repository-url>
cd ai-interview-system

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# 或
.venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置Azure OpenAI

**方式一：环境变量**
```bash
export OPENAI_API_KEY="your_azure_api_key_here"
export OPENAI_BASE_URL="https://your-resource-name.openai.azure.com"
```

**方式二：Windows命令行**
```cmd
set OPENAI_API_KEY=your_azure_api_key_here
set OPENAI_BASE_URL=https://your-resource-name.openai.azure.com
```

**方式三：.env文件**
```env
OPENAI_API_KEY=your_azure_api_key_here
OPENAI_BASE_URL=https://your-resource-name.openai.azure.com
```

### 3. 启动系统
```bash
# 推荐：使用启动脚本（包含环境检查）
python start.py

# 或直接启动
uvicorn backend.app:app --host localhost --port 8000 --reload
```

### 4. 开始使用
1. 浏览器访问：http://localhost:8000
2. **现代化界面**：体验全新的专业面试界面设计
3. **语音面试**：点击"开始面试"按钮开始语音对话
4. **全屏模式**：点击麦克风按钮体验沉浸式语音通话
5. **智能保存**：结束面试时选择是否保存面试记录，查看详细统计
6. **个性化面试**：通过"简历管理"上传简历获得定制化面试
7. **查看历史**：通过"面试历史"管理面试记录

## 💼 用户指南

### 使用流程

#### 快速语音面试模式
```
启动应用 → 现代化欢迎界面 → 点击"开始面试" → Azure实时语音面试
```

#### 个性化语音面试模式
```
启动应用 → 导航栏"简历管理" → 拖拽上传简历 → 返回面试页面 → AI基于简历进行语音提问
```

#### 简历制作流程
```
导航栏"简历管理" → 无简历时显示制作指引 → 点击"立即制作简历" → 跳转天汇AI简历工具 → 制作完成后上传简历
```

#### 面试历史管理
```
导航栏"面试历史" → 查看过往面试 → 筛选和统计 → 支持继续面试、音频重播
```

#### 智能面试保存流程
```
语音面试进行中 → 点击"结束面试"按钮 → 保存确认对话框弹出 → 查看面试统计 → 选择"保存记录"或"不保存"
```

**保存确认对话框功能**：
- 📊 **面试统计展示**: 自动显示面试时长、对话轮次、简历状态
- 💡 **保存价值说明**: 清晰展示保存后可获得的功能（评分分析、历史查看、PDF导出等）
- ⚡ **一键操作**: 简单的保存或丢弃选择，避免复杂操作
- 🔒 **防误操作**: 点击背景不会关闭对话框，确保用户主动选择

### 界面导航
- **顶部导航栏**: 
  - 🎤 语音面试：现代化面试对话界面
  - 📋 面试历史：面试记录管理和统计
  - 📄 简历管理：文件上传和预览
- **连接状态指示器**: 实时显示Azure语音服务连接状态
- **语音交互控制**: 支持语音输入、文本输入、语音输出
- **现代化通知**: 智能提示系统，操作反馈

### 现代化功能特色
- **拖拽上传**: 现代化文件上传体验，支持拖拽和点击上传
- **简历制作工具**: 提供天汇AI简历制作工具链接，便于用户快速制作专业简历
- **实时通知**: 智能通知系统，提供操作反馈和状态提示
- **流式显示**: 消息流式显示效果，模拟真实打字体验
- **语音状态动画**: 动态语音状态指示，可视化语音交互过程
- **智能保存确认**: 结束面试时的美观确认对话框，提供详细统计和保存建议
- **响应式适配**: 完美适配各种屏幕尺寸，移动端友好
- **专业主题**: 现代化设计语言，专业面试氛围

## 🔧 技术架构

### 系统架构图
```
Frontend (现代化面试客户端)
├── index.html        # 现代化面试界面，响应式设计
├── app.js            # 前端交互逻辑
│   ├── WebSocket通信管理    # 实时语音通信
│   ├── 页面路由系统        # 多页面导航
│   ├── 拖拽上传功能        # 现代化文件上传
│   ├── 简历制作工具指引     # 天汇AI简历工具链接
│   ├── 通知系统           # 智能提示反馈
│   ├── 本地存储管理        # 数据持久化
│   ├── 语音状态动画        # 可视化反馈
│   ├── 消息流式显示        # 打字机效果
│   └── 工具函数库         # 实用工具集
├── voice-call.js     # 语音通话管理器
│   ├── WebRTC连接管理      # Azure实时语音API
│   ├── 音频流处理         # 实时音频传输
│   ├── 简历信息集成        # 个性化面试支持
│   ├── 智能保存确认        # 面试结束时的保存确认机制
│   ├── Prompt动态获取      # API获取提示词
│   └── 调试日志系统        # 开发调试支持
└── style.css         # 现代化设计系统
    ├── CSS变量系统         # 统一设计令牌
    ├── 响应式布局         # 移动端适配
    ├── 动画效果           # 流畅过渡动画
    ├── 组件样式           # 模块化组件
    ├── 主题色彩           # 专业配色方案
    └── 交互反馈           # 悬停和点击效果

Backend (语音面试服务)
├── app.py            # 面试主应用
│   ├── WebSocket端点        # /ws 实时通信
│   ├── 文件上传API         # /upload 简历上传
│   ├── 简历内容API         # /api/resume/{id} 获取简历
│   ├── Prompt管理API       # /api/prompts/* 提示词服务
│   ├── 静态文件服务        # 前端资源
│   └── 错误处理           # 异常管理
├── prompts.py        # AI提示词配置
│   ├── InterviewPrompts    # 面试相关提示词
│   ├── SystemPrompts       # 系统级提示词
│   ├── UIPrompts          # 界面提示词
│   ├── NotificationPrompts # 通知消息
│   ├── 岗位专业模板        # 不同技术栈提示词
│   └── 动态获取函数        # API接口函数
├── config.py         # 系统配置
└── 文件处理模块       # PDF/Word解析
```

### Prompt管理系统
```python
# prompts.py - 集中管理所有AI提示词
from prompts import get_voice_call_prompt, get_interviewer_prompt

# 支持不同岗位的专业提示词
positions = ["frontend", "backend", "fullstack", "ai_ml", "data_science"]

# 动态获取提示词
prompt = get_interviewer_prompt(position="frontend", resume_context=resume_text)

# API端点
GET  /api/prompts/list                # 列出所有可用prompt类型
GET  /api/prompts/voice-call-default  # 获取默认语音通话prompt
POST /api/prompts/voice-call          # 获取语音通话专用prompt（带简历上下文）
GET  /api/prompts/validate            # 验证prompt管理状态
```

#### Prompt管理架构
```
prompts.py (集中配置)
    ↓
backend/app.py (API服务)
    ↓
static/voice-call.js (前端调用)
    ↓
Azure OpenAI Realtime API (最终使用)
```

#### 回退机制
1. **主要路径**: 从 `/api/prompts/voice-call` 获取带简历上下文的prompt
2. **回退路径**: 从 `/api/prompts/voice-call-default` 获取默认prompt
3. **最后回退**: 前端硬编码prompt（仅在API完全不可用时）

## 📊 日志规范

### Prompt管理日志
系统自动记录Prompt获取和使用情况：

```
[2025-01-XX XX:XX:XX] [Prompt API] - 获取语音通话prompt: 成功, 包含简历: 是
[2025-01-XX XX:XX:XX] [Prompt Fallback] - API获取失败，使用默认prompt
[2025-01-XX XX:XX:XX] [Prompt Update] - 会话指令更新: 长度=1024字符
[2025-01-XX XX:XX:XX] [Resume Integration] - 简历信息集成到prompt: 文件=resume.pdf
```

### 前端交互日志
系统自动记录前端用户交互和功能使用情况：

```
[2025-01-XX XX:XX:XX] [Frontend] - 应用初始化完成，现代化界面加载
[2025-01-XX XX:XX:XX] [Navigation] - 页面切换: 面试主页 → 简历管理
[2025-01-XX XX:XX:XX] [Upload] - 文件拖拽上传: resume.pdf, 大小: 2.3MB
[2025-01-XX XX:XX:XX] [WebSocket] - 语音连接建立，状态: 已连接
[2025-01-XX XX:XX:XX] [Voice] - 语音状态变更: 静音 → 聆听
[2025-01-XX XX:XX:XX] [Notification] - 显示通知: 文件上传成功
```

### 语音通话日志
WebRTC语音通话的详细日志记录：

```
[2025-01-XX XX:XX:XX] [WebRTC] - 获取临时密钥: 成功
[2025-01-XX XX:XX:XX] [WebRTC] - 建立PeerConnection: 成功
[2025-01-XX XX:XX:XX] [WebRTC] - 数据通道已打开
[2025-01-XX XX:XX:XX] [WebRTC] - 会话指令更新: 包含简历信息
[2025-01-XX XX:XX:XX] [WebRTC] - 语音状态: 正在聆听 → 正在处理
[2025-01-XX XX:XX:XX] [WebRTC] - 语音通话已结束
[2025-01-XX XX:XX:XX] [SaveConfirm] - 显示保存面试确认对话框
[2025-01-XX XX:XX:XX] [SaveConfirm] - 用户选择保存面试记录
[2025-01-XX XX:XX:XX] [SaveConfirm] - 面试记录保存成功
```

### 用户体验日志
- **界面交互**: 记录页面切换、按钮点击、拖拽操作
- **语音状态**: 记录语音开始、结束、状态变更
- **文件操作**: 记录文件上传、预览、删除操作
- **保存确认**: 记录保存确认对话框显示、用户选择、保存结果
- **通知系统**: 记录通知显示、关闭、用户反馈
- **Prompt获取**: 记录提示词API调用、回退机制使用

### 性能监控
- **加载时间**: 记录页面和资源加载时间
- **响应延迟**: 记录WebSocket通信延迟
- **内存使用**: 记录前端内存占用情况
- **错误追踪**: 记录JavaScript错误和异常
- **API性能**: 记录Prompt API响应时间

## 🎨 设计系统

### 色彩方案
```css
/* 主色调 - 专业蓝色系 */
--primary-color: #2563eb;      /* 主要蓝色 */
--primary-light: #dbeafe;      /* 浅蓝色 */
--primary-dark: #1e40af;       /* 深蓝色 */

/* 功能色彩 */
--success-color: #10b981;      /* 成功绿色 */
--warning-color: #f59e0b;      /* 警告橙色 */
--error-color: #ef4444;        /* 错误红色 */

/* 中性色彩 */
--text-primary: #1f2937;       /* 主要文本 */
--text-secondary: #6b7280;     /* 次要文本 */
--bg-primary: #ffffff;         /* 主背景 */
--bg-secondary: #f9fafb;       /* 次背景 */
```

### 设计原则
- **简洁专业**: 清晰的视觉层次，专业的面试氛围
- **现代化**: 使用最新的设计趋势和交互模式
- **响应式**: 完美适配各种设备和屏幕尺寸
- **可访问性**: 符合WCAG无障碍设计标准
- **一致性**: 统一的设计语言和交互模式

## 🎯 Prompt管理指南

### Prompt配置文件结构
```python
# prompts.py 文件结构
InterviewPrompts        # 面试相关提示词
├── BASE_INTERVIEWER   # 基础面试官提示词
├── VOICE_CALL_INTERVIEWER  # 语音通话专用
├── WITH_RESUME_TEMPLATE    # 带简历上下文模板
└── POSITION_SPECIFIC       # 不同岗位专业提示词
    ├── frontend           # 前端技术面试
    ├── backend            # 后端技术面试
    ├── fullstack          # 全栈技术面试
    ├── ai_ml              # AI/机器学习面试
    └── data_science       # 数据科学面试

SystemPrompts           # 系统级提示词
├── WELCOME_MESSAGE    # 欢迎消息
├── ERROR_MESSAGES     # 错误处理消息
└── STATUS_MESSAGES    # 状态提示消息

UIPrompts              # 用户界面提示词
├── BUTTON_TEXTS       # 按钮文本
├── PLACEHOLDERS       # 占位符文本
└── HINTS              # 提示文本

NotificationPrompts    # 通知消息提示词
├── SUCCESS_MESSAGES   # 成功消息
├── WARNING_MESSAGES   # 警告消息
└── ERROR_MESSAGES     # 错误消息
```

### 修改Prompt的方法

#### 方法一：直接编辑prompts.py文件
```python
# 修改基础面试官提示词
InterviewPrompts.BASE_INTERVIEWER = """
你是一位专业的AI面试官，负责进行技术面试。
请遵循以下原则：
1. 保持专业、友好的态度
2. 根据候选人的回答进行深入追问
3. 评估技术能力、解决问题的思路和沟通能力
4. 提供建设性的反馈
5. 语音回复要简洁明了，适合口语交流
"""

# 添加新的岗位专业提示词
InterviewPrompts.POSITION_SPECIFIC["devops"] = """
你是一位DevOps技术面试官，专注于以下技术领域：
- CI/CD流水线设计和实现
- 容器化技术（Docker/Kubernetes）
- 云平台服务（AWS/Azure/GCP）
- 基础设施即代码（Terraform/Ansible）
- 监控和日志管理
"""
```

#### 方法二：通过API查看当前配置
```bash
# 查看所有可用的prompt类型
curl http://localhost:8000/api/prompts/list

# 获取语音通话专用prompt
curl -X POST http://localhost:8000/api/prompts/voice-call \
  -H "Content-Type: application/json" \
  -d '{"resume_context": "候选人简历内容..."}'
```

#### 方法三：使用辅助函数
```python
# 使用辅助函数获取特定岗位的prompt
from prompts import get_interviewer_prompt

# 获取前端面试官prompt
frontend_prompt = get_interviewer_prompt(position="frontend")

# 获取带简历上下文的prompt
personalized_prompt = get_interviewer_prompt(
    position="ai_ml", 
    resume_context="候选人的AI/ML背景..."
)
```

### Prompt最佳实践
1. **保持一致性**: 所有prompt应保持相同的语调和风格
2. **简洁明了**: 语音回复的prompt要特别注意简洁性
3. **个性化**: 充分利用简历上下文进行个性化提问
4. **专业性**: 不同岗位的prompt要体现专业深度
5. **可维护性**: 定期审查和更新prompt内容

## 🔍 故障排除

### 常见问题

#### Prompt相关问题
```bash
# Prompt API无响应
检查prompts.py文件语法 → 确认导入路径正确 → 重启服务

# 语音通话获取不到简历信息
检查简历上传状态 → 验证session_id匹配 → 查看API日志

# 默认prompt回退机制
确认网络连接 → 检查API端点可用性 → 验证回退逻辑
```

#### UI界面和导航问题
```bash
# 导航按钮无响应
检查浏览器控制台 → 确认JavaScript加载 → 刷新页面重新初始化

# 移动端布局问题
检查屏幕尺寸 → 确认响应式CSS加载 → 验证触摸目标大小(≥44px)

# 快捷操作按钮功能异常
确认应用实例初始化 → 检查页面路由系统 → 验证事件监听器绑定
```

#### Azure服务连接问题
```bash
# 检查Azure配置
echo $OPENAI_API_KEY
echo $OPENAI_BASE_URL

# 验证网络连接
curl -H "Authorization: Bearer $OPENAI_API_KEY" $OPENAI_BASE_URL/v1/models
```

#### 前端界面问题
- **浏览器兼容性**: 确保使用支持ES6+的现代浏览器
- **缓存问题**: 清除浏览器缓存，强制刷新页面
- **JavaScript错误**: 检查浏览器控制台错误信息
- **CSS样式问题**: 确保CSS文件正确加载
- **响应式布局**: 在不同屏幕尺寸下测试界面适配
- **触摸交互**: 确保移动端触摸目标足够大(最小44px)

#### 音频播放问题
- **浏览器权限**: 检查浏览器音频播放权限设置
- **网络延迟**: 检查网络连接质量，影响实时音频传输
- **设备兼容**: 确保音频设备正常工作

#### 文件上传问题
- **文件格式**: 仅支持PDF、DOC、DOCX格式
- **文件大小**: 建议10MB以内
- **拖拽功能**: 确保浏览器支持HTML5拖拽API

#### 简历信息传递问题
- **会话ID匹配**: 确保前端和后端session_id一致
- **API可用性**: 检查 `/api/resume/{session_id}` 端点状态
- **简历内容**: 验证简历文件解析是否成功

## 🚀 部署指南

### 生产环境部署
```bash
# 设置生产环境变量
export ENVIRONMENT=production
export OPENAI_API_KEY=your_production_api_key
export OPENAI_BASE_URL=your_production_endpoint

# 使用Gunicorn部署
pip install gunicorn
gunicorn backend.app:app --host 0.0.0.0 --port 8000 --workers 4

# 使用Docker部署
docker build -t ai-interview-system .
docker run -p 8000:8000 -e OPENAI_API_KEY=your_key ai-interview-system
```

### 环境变量配置

| 变量名 | 描述 | 必需 | 默认值 |
|--------|------|------|--------|
| `OPENAI_API_KEY` | Azure OpenAI API密钥 | 是 | - |
| `OPENAI_BASE_URL` | Azure OpenAI端点URL | 是 | - |
| `ARK_API_KEY` | 备用API密钥 | 否 | - |
| `MODEL_TEMPERATURE` | LLM模型温度设置 | 否 | 0.1 |
| `MAX_TOKENS` | 最大token数量 | 否 | 2000 |
| `TOP_P` | top_p参数 | 否 | 0.9 |

### 推荐配置
```env
# Azure OpenAI配置
OPENAI_API_KEY=your_azure_api_key_here
OPENAI_BASE_URL=https://your-resource-name.openai.azure.com

# LLM模型参数配置（优化稳定性）
MODEL_TEMPERATURE=0.1    # 极低温度确保高稳定性和一致性
MAX_TOKENS=2000         # 最大token数量
TOP_P=0.9              # top_p参数

# 服务配置
HOST=localhost
PORT=8000
LOG_LEVEL=INFO
```

### 🎯 模型参数优化

#### 温度设置说明
系统默认使用 `MODEL_TEMPERATURE=0.1` 的极低温度设置，这样配置的优势：

- **高稳定性**: 模型输出更加一致和可预测
- **减少随机性**: 降低面试评分的波动性
- **提升准确性**: 确保评估结果的客观性和可靠性
- **一致体验**: 相同条件下的面试会得到相似的评分

#### 温度值建议
- `0.1` - **推荐值**: 极高稳定性，适合面试评分
- `0.3` - 平衡稳定性和创造性
- `0.7` - 更多创造性，但稳定性降低
- `1.0` - 最大创造性，但结果不可预测

#### 自定义配置
如需调整模型行为，可在 `.env` 文件中修改：
```env
# 更保守的设置（更高稳定性）
MODEL_TEMPERATURE=0.05

# 稍微增加创造性
MODEL_TEMPERATURE=0.2
```

## 📈 性能优化

### 前端优化
- **资源压缩**: CSS/JS文件压缩和合并
- **图片优化**: 使用WebP格式，适当压缩
- **缓存策略**: 合理设置浏览器缓存
- **懒加载**: 非关键资源延迟加载

### 后端优化
- **异步处理**: 使用FastAPI的异步特性
- **连接池**: 数据库和API连接池管理
- **缓存机制**: Redis缓存热点数据
- **负载均衡**: 多实例部署和负载分发

### 语音优化
- **音频压缩**: 合适的音频编码格式
- **网络优化**: CDN加速和就近接入
- **缓冲策略**: 音频流缓冲和预加载
- **错误恢复**: 网络中断自动重连

## 🔒 安全考虑

### 数据安全
- **API密钥保护**: 环境变量存储，避免硬编码
- **文件上传限制**: 文件类型和大小限制
- **输入验证**: 严格的输入参数验证
- **错误处理**: 避免敏感信息泄露

### 网络安全
- **HTTPS部署**: 生产环境强制HTTPS
- **CORS配置**: 合理的跨域资源共享设置
- **请求限制**: API请求频率限制
- **日志审计**: 详细的操作日志记录

## 📝 开发指南

### 添加新功能
1. **需求分析**: 明确功能需求和用户场景
2. **设计方案**: 技术方案设计和架构考虑
3. **代码实现**: 遵循项目代码规范
4. **测试验证**: 单元测试和集成测试
5. **文档更新**: 更新README和API文档

### 代码规范
- **Python**: 遵循PEP 8代码风格
- **JavaScript**: 使用ES6+语法特性
- **CSS**: 使用CSS变量和模块化设计
- **注释**: 关键逻辑添加详细注释
- **命名**: 使用有意义的变量和函数名

### 测试策略
- **单元测试**: 核心业务逻辑测试
- **集成测试**: API接口和数据流测试
- **前端测试**: 用户交互和界面测试
- **性能测试**: 负载和压力测试
- **兼容性测试**: 多浏览器和设备测试

## 🤝 贡献指南

### 提交代码
1. Fork项目到个人仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

### 报告问题
- 使用GitHub Issues报告bug
- 提供详细的复现步骤
- 包含错误日志和截图
- 说明运行环境信息

### 功能建议
- 在Issues中提出功能建议
- 详细描述使用场景
- 考虑实现的可行性
- 讨论设计方案

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service) - 提供强大的AI语音模型
- [FastAPI](https://fastapi.tiangolo.com/) - 现代化的Python Web框架
- [WebRTC](https://webrtc.org/) - 实时通信技术支持
- 所有贡献者和用户的支持与反馈

---

**🎯 开始您的AI面试之旅！** 访问 http://localhost:8000 体验专业的语音面试系统。