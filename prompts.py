"""
AI面试官系统 - 提示词配置文件

集中管理所有AI提示词，方便维护和修改
"""

class InterviewPrompts:
    """面试相关提示词"""
    
    # 基础面试官提示词
    BASE_INTERVIEWER = """你是一位专业的AI面试官，负责进行技术面试。请遵循以下原则：

1. 保持专业、友好的态度
2. 根据候选人的回答进行深入追问
3. 评估技术能力、解决问题的思路和沟通能力
4. 提供建设性的反馈
5. 语音回复要简洁明了，适合口语交流"""

    # 语音通话专用提示词
    VOICE_CALL_INTERVIEWER = """你是一位专业的AI面试官，请用自然、友好的语调进行面试对话。根据候选人的简历内容，提出相关的技术和行为问题。保持对话流畅，适时给出反馈和鼓励。"""
    
    # 带简历上下文的提示词模板
    WITH_RESUME_TEMPLATE = """{base_prompt}

候选人简历信息：
{resume_context}

请根据简历内容进行针对性的面试提问。"""

    # 不同岗位的专业提示词
    POSITION_SPECIFIC = {
        "frontend": """你是一位前端技术面试官，专注于以下技术领域：
- HTML/CSS/JavaScript基础
- React/Vue/Angular等前端框架
- 响应式设计和移动端开发
- 前端工程化和性能优化
- 浏览器兼容性和调试技能""",
        
        "backend": """你是一位后端技术面试官，专注于以下技术领域：
- 编程语言基础（Python/Java/Go等）
- 数据库设计和SQL优化
- API设计和微服务架构
- 系统设计和性能优化
- 安全性和并发处理""",
        
        "fullstack": """你是一位全栈技术面试官，专注于以下技术领域：
- 前端和后端技术栈
- 系统架构和设计模式
- 数据库设计和优化
- DevOps和部署流程
- 项目管理和团队协作""",
        
        "ai_ml": """你是一位AI/机器学习技术面试官，专注于以下技术领域：
- 机器学习算法和模型
- 深度学习框架（TensorFlow/PyTorch）
- 数据预处理和特征工程
- 模型训练和优化
- AI应用场景和实践经验""",
        
        "data_science": """你是一位数据科学面试官，专注于以下技术领域：
- 统计学和数据分析
- Python/R数据科学工具栈
- 数据可视化和报告
- 大数据处理技术
- 业务理解和数据驱动决策"""
    }

class SystemPrompts:
    """系统级提示词"""
    
    # 欢迎消息
    WELCOME_MESSAGE = """欢迎参加AI智能面试！我是您的面试官，将为您提供专业的面试体验。

面试准备提示：
• 确保您的网络连接稳定
• 选择安静的环境进行面试
• 建议上传简历以获得个性化问题
• 放松心情，真实表达自己

请告诉我您应聘的岗位，我们开始面试吧！"""

    # 错误处理消息
    ERROR_MESSAGES = {
        "connection_failed": "抱歉，连接出现问题。请检查网络连接后重试。",
        "audio_failed": "音频处理失败，请检查麦克风权限或刷新页面重试。",
        "upload_failed": "文件上传失败，请检查文件格式（支持PDF、DOC、DOCX）和大小（不超过10MB）。",
        "resume_not_found": "未找到简历信息，建议先上传简历以获得个性化面试体验。",
        "session_expired": "会话已过期，请刷新页面重新开始面试。"
    }

    # 状态提示消息
    STATUS_MESSAGES = {
        "connecting": "正在连接AI面试官...",
        "connected": "已连接 - Azure语音服务",
        "listening": "正在聆听您的声音...",
        "processing": "正在处理您的回答...",
        "speaking": "AI正在回复...",
        "muted": "麦克风已静音",
        "disconnected": "连接断开"
    }

class UIPrompts:
    """用户界面提示词"""
    
    # 按钮文本
    BUTTON_TEXTS = {
        "start_interview": "开始面试",
        "end_interview": "结束面试",
        "upload_resume": "上传简历",
        "start_voice": "开始语音",
        "mute": "静音",
        "unmute": "取消静音",
        "continue_interview": "继续面试",
        "delete_record": "删除记录"
    }
    
    # 占位符文本
    PLACEHOLDERS = {
        "message_input": "请输入您的回答，或点击语音按钮进行语音对话...",
        "message_input_disabled": "请等待连接建立...",
        "file_upload": "拖拽简历文件到此处或点击选择文件"
    }
    
    # 提示文本
    HINTS = {
        "voice_permission": "请允许浏览器访问麦克风权限",
        "upload_formats": "支持PDF、DOC、DOCX格式，大小不超过10MB",
        "interview_tips": "建议在安静环境中进行面试，确保网络连接稳定"
    }

class NotificationPrompts:
    """通知消息提示词"""
    
    # 成功消息
    SUCCESS_MESSAGES = {
        "resume_uploaded": "简历上传成功！系统将基于您的简历进行个性化面试。",
        "interview_started": "面试已开始，请开始回答问题。",
        "voice_connected": "语音连接成功，可以开始语音对话。",
        "settings_saved": "设置已保存。"
    }
    
    # 警告消息
    WARNING_MESSAGES = {
        "no_resume": "建议上传简历以获得更好的面试体验。",
        "browser_compatibility": "建议使用Chrome、Firefox或Safari浏览器以获得最佳体验。",
        "network_slow": "网络连接较慢，可能影响语音质量。"
    }
    
    # 错误消息
    ERROR_MESSAGES = {
        "upload_failed": "文件上传失败，请检查文件格式和大小。",
        "connection_error": "连接失败，请检查网络设置。",
        "permission_denied": "麦克风权限被拒绝，请在浏览器设置中允许麦克风访问。",
        "unsupported_format": "不支持的文件格式，请上传PDF、DOC或DOCX文件。"
    }

class DebugPrompts:
    """调试日志提示词"""
    
    # 日志消息模板
    LOG_TEMPLATES = {
        "session_start": "会话开始: 用户ID={user_id}, 时间={timestamp}",
        "resume_loaded": "简历加载成功: 文件={filename}, 大小={size}字符",
        "voice_status": "语音状态变更: {old_status} → {new_status}",
        "api_call": "API调用: {endpoint}, 参数={params}, 结果={result}",
        "error_occurred": "错误发生: {error_type}, 消息={message}, 堆栈={stack}"
    }

def get_interviewer_prompt(position=None, resume_context=None):
    """
    获取面试官提示词
    
    Args:
        position: 岗位类型 (frontend/backend/fullstack/ai_ml/data_science)
        resume_context: 简历上下文
    
    Returns:
        str: 完整的面试官提示词
    """
    # 选择基础提示词
    if position and position in InterviewPrompts.POSITION_SPECIFIC:
        base_prompt = InterviewPrompts.POSITION_SPECIFIC[position]
    else:
        base_prompt = InterviewPrompts.BASE_INTERVIEWER
    
    # 如果有简历上下文，使用模板
    if resume_context:
        return InterviewPrompts.WITH_RESUME_TEMPLATE.format(
            base_prompt=base_prompt,
            resume_context=resume_context
        )
    
    return base_prompt

def get_voice_call_prompt(resume_context=None):
    """
    获取语音通话专用提示词
    
    Args:
        resume_context: 简历上下文
    
    Returns:
        str: 语音通话提示词
    """
    base_prompt = InterviewPrompts.VOICE_CALL_INTERVIEWER
    
    if resume_context:
        return InterviewPrompts.WITH_RESUME_TEMPLATE.format(
            base_prompt=base_prompt,
            resume_context=resume_context
        )
    
    return base_prompt

def get_system_message(message_type):
    """
    获取系统消息
    
    Args:
        message_type: 消息类型
    
    Returns:
        str: 系统消息内容
    """
    return SystemPrompts.ERROR_MESSAGES.get(message_type) or \
           SystemPrompts.STATUS_MESSAGES.get(message_type) or \
           "未知消息类型"

def get_notification_message(message_type, category="success"):
    """
    获取通知消息
    
    Args:
        message_type: 消息类型
        category: 消息类别 (success/warning/error)
    
    Returns:
        str: 通知消息内容
    """
    if category == "success":
        return NotificationPrompts.SUCCESS_MESSAGES.get(message_type, "操作成功")
    elif category == "warning":
        return NotificationPrompts.WARNING_MESSAGES.get(message_type, "请注意")
    elif category == "error":
        return NotificationPrompts.ERROR_MESSAGES.get(message_type, "操作失败")
    else:
        return "未知消息" 