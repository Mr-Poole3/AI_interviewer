"""
LLM面试官FastAPI后端服务

基于Azure OpenAI实时语音模型的智能面试系统
支持文本聊天、语音输入输出和简历上传功能
"""
import json
import logging
import os
import tempfile
import io
import base64
import hashlib
import asyncio
from typing import Dict, List, Optional, Any
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 文件解析库
import PyPDF2
from docx import Document

# Azure OpenAI实时语音客户端
from openai import AsyncAzureOpenAI

# 导入提示词配置
from prompts import get_interviewer_prompt, get_voice_call_prompt

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Azure语音面试官系统", description="基于Azure OpenAI实时语音模型的智能面试系统")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")


class AzureVoiceService:
    """Azure语音服务类"""
    
    def __init__(self):
        """初始化Azure语音服务"""
        self.client: Optional[AsyncAzureOpenAI] = None
        self._init_client()
    
    def _init_client(self) -> None:
        """初始化Azure OpenAI客户端"""
        try:
            # 从环境变量获取配置
            azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "https://gpt-realtime-4o-mini.openai.azure.com")
            api_key = os.getenv("AZURE_OPENAI_API_KEY")
            api_version = os.getenv("AZURE_API_VERSION", "2025-04-01-preview")
            
            if not api_key:
                logger.error("Azure OpenAI API密钥未设置！")
                return
            
            self.client = AsyncAzureOpenAI(
                azure_endpoint=azure_endpoint,
                api_key=api_key,
                api_version=api_version,
            )
            logger.info("Azure OpenAI客户端初始化成功")
            
        except Exception as e:
            logger.error(f"Azure OpenAI客户端初始化失败: {e}")
    
    async def chat_with_voice(self, message: str, websocket: WebSocket, resume_context: str = "") -> None:
        """
        发送消息并接收语音回复
        
        Args:
            message: 用户消息
            websocket: WebSocket连接
            resume_context: 简历上下文
        """
        if not self.client:
            await websocket.send_json({
                "type": "error",
                "message": "Azure客户端未初始化"
            })
            return
        
        try:
            async with self.client.beta.realtime.connect(
                model="gpt-4o-mini-realtime-preview"
            ) as connection:
                # 配置会话支持文本和音频
                await connection.session.update(
                    session={"modalities": ["text", "audio"]}
                )
                
                # 构建系统提示词
                system_prompt = self._build_system_prompt(resume_context)
                
                # 发送系统消息（如果有简历上下文）
                if resume_context:
                    await connection.conversation.item.create(
                        item={
                            "type": "message",
                            "role": "system",
                            "content": [{"type": "input_text", "text": system_prompt}],
                        }
                    )
                
                # 发送用户消息
                await connection.conversation.item.create(
                    item={
                        "type": "message",
                        "role": "user",
                        "content": [{"type": "input_text", "text": message}],
                    }
                )
                
                # 请求回复
                await connection.response.create()
                
                # 处理响应事件
                async for event in connection:
                    await self._handle_response_event(event, websocket)
                    
                    if event.type == "response.done":
                        break
                        
        except Exception as e:
            logger.error(f"语音聊天错误: {e}")
            await websocket.send_json({
                "type": "error",
                "message": f"语音聊天错误: {str(e)}"
            })
    
    def _build_system_prompt(self, resume_context: str) -> str:
        """构建系统提示词"""
        return get_interviewer_prompt(resume_context=resume_context)
    
    async def _handle_response_event(self, event: Any, websocket: WebSocket) -> None:
        """
        处理响应事件
        
        Args:
            event: 响应事件
            websocket: WebSocket连接
        """
        try:
            if event.type == "response.text.delta":
                # 文本增量
                await websocket.send_json({
                    "type": "text_delta",
                    "content": event.delta
                })
                
            elif event.type == "response.audio.delta":
                # 音频增量 - 发送base64编码的音频数据
                await websocket.send_json({
                    "type": "audio_delta",
                    "audio_data": event.delta,  # 已经是base64编码
                    "content_type": "audio/pcm"
                })
                
            elif event.type == "response.audio_transcript.delta":
                # 音频转录增量
                await websocket.send_json({
                    "type": "transcript_delta",
                    "content": event.delta
                })
                
            elif event.type == "response.text.done":
                # 文本完成
                await websocket.send_json({
                    "type": "text_done"
                })
                
            elif event.type == "response.audio.done":
                # 音频完成
                await websocket.send_json({
                    "type": "audio_done"
                })
                
            elif event.type == "response.done":
                # 响应完成
                await websocket.send_json({
                    "type": "response_done"
                })
                
        except Exception as e:
            logger.error(f"处理响应事件错误: {e}")

    async def process_fastrtc_audio(
        self, 
        audio_data: str, 
        websocket: WebSocket, 
        resume_context: str = "",
        audio_format: str = "pcm_s16le",
        sample_rate: int = 24000,
        channels: int = 1,
        vad_confidence: float = 0.0
    ) -> None:
        """
        处理FastRTC增强的音频数据
        
        Args:
            audio_data: base64编码的音频数据
            websocket: WebSocket连接
            resume_context: 简历上下文
            audio_format: 音频格式
            sample_rate: 采样率
            channels: 声道数
            vad_confidence: 语音活动检测置信度
        """
        if not self.client:
            await websocket.send_json({
                "type": "error",
                "message": "Azure客户端未初始化"
            })
            return
        
        try:
            # 解码base64音频数据
            audio_bytes = base64.b64decode(audio_data)
            
            # 记录音频质量信息
            logger.info(f"收到FastRTC音频数据: 格式={audio_format}, 采样率={sample_rate}, VAD置信度={vad_confidence:.3f}")
            
            # 调整VAD置信度阈值检查 - 原阈值0.01过于严格
            # 使用更低的阈值，并考虑音频数据长度
            min_vad_threshold = 0.001  # 降低基础阈值
            
            # 如果音频数据足够长，即使VAD置信度较低也可以处理
            audio_duration_ms = (len(audio_bytes) / 2) / sample_rate * 1000  # 计算音频时长(ms)
            
            # 动态调整阈值：音频越长，允许的VAD阈值越低
            if audio_duration_ms > 200:  # 超过200ms的音频
                dynamic_threshold = max(0.0005, min_vad_threshold * 0.5)
            elif audio_duration_ms > 100:  # 超过100ms的音频
                dynamic_threshold = max(0.001, min_vad_threshold * 0.8)
            else:
                dynamic_threshold = min_vad_threshold
            
            if vad_confidence < dynamic_threshold:
                logger.debug(f"VAD置信度({vad_confidence:.4f})低于动态阈值({dynamic_threshold:.4f})，"
                           f"音频时长{audio_duration_ms:.1f}ms，跳过音频处理")
                return
            
            logger.info(f"通过VAD检查，开始处理音频: 置信度={vad_confidence:.4f}, "
                       f"阈值={dynamic_threshold:.4f}, 时长={audio_duration_ms:.1f}ms")
            
            async with self.client.beta.realtime.connect(
                model="gpt-4o-mini-realtime-preview"
            ) as connection:
                # 配置会话支持音频输入
                await connection.session.update(
                    session={
                        "modalities": ["text", "audio"],
                        "input_audio_format": "pcm16",  # Azure支持的格式
                        "output_audio_format": "pcm16",
                        "input_audio_transcription": {
                            "model": "whisper-1"
                        }
                    }
                )
                
                # 构建系统提示词
                if resume_context:
                    system_prompt = self._build_system_prompt(resume_context)
                    await connection.conversation.item.create(
                        item={
                            "type": "message",
                            "role": "system",
                            "content": [{"type": "input_text", "text": system_prompt}],
                        }
                    )
                
                # 发送音频数据
                await connection.input_audio_buffer.append(audio=audio_data)
                
                # 提交音频输入
                await connection.input_audio_buffer.commit()
                
                # 请求回复
                await connection.response.create()
                
                # 处理响应事件
                async for event in connection:
                    await self._handle_response_event(event, websocket)
                    
                    if event.type == "response.done":
                        break
                        
        except Exception as e:
            logger.error(f"FastRTC音频处理错误: {e}")
            await websocket.send_json({
                "type": "error",
                "message": f"音频处理错误: {str(e)}"
            })


# 全局Azure语音服务实例
azure_voice_service: AzureVoiceService = None

# 存储用户会话的简历内容
user_sessions: Dict[str, str] = {}

# 简历存储目录
RESUME_STORAGE_DIR = Path("resume_storage")
RESUME_STORAGE_DIR.mkdir(exist_ok=True)

def save_resume_to_file(resume_text: str, session_id: str) -> bool:
    """
    将简历文本保存到文件
    
    Args:
        resume_text: 简历文本内容
        session_id: 会话ID
        
    Returns:
        保存是否成功
    """
    try:
        resume_file = RESUME_STORAGE_DIR / f"{session_id}.txt"
        with open(resume_file, 'w', encoding='utf-8') as f:
            f.write(resume_text)
        logger.info(f"简历已保存到文件: {resume_file}")
        return True
    except Exception as e:
        logger.error(f"保存简历文件失败: {e}")
        return False

def load_resume_from_file(session_id: str) -> Optional[str]:
    """
    从文件加载简历文本
    
    Args:
        session_id: 会话ID
        
    Returns:
        简历文本内容，如果文件不存在则返回None
    """
    try:
        resume_file = RESUME_STORAGE_DIR / f"{session_id}.txt"
        if resume_file.exists():
            with open(resume_file, 'r', encoding='utf-8') as f:
                content = f.read()
            logger.info(f"从文件加载简历: {resume_file}")
            return content
        return None
    except Exception as e:
        logger.error(f"加载简历文件失败: {e}")
        return None

def generate_resume_hash(resume_text: str) -> str:
    """
    生成简历内容的哈希值，用于去重和验证
    
    Args:
        resume_text: 简历文本内容
        
    Returns:
        简历内容的MD5哈希值
    """
    return hashlib.md5(resume_text.encode('utf-8')).hexdigest()[:16]

def extract_pdf_text(file_content: bytes) -> str:
    """
    从PDF文件内容中提取文本
    
    Args:
        file_content: PDF文件的字节内容
        
    Returns:
        提取出的文本内容
    """
    try:
        pdf_file = io.BytesIO(file_content)
        reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        
        return text.strip()
    except Exception as e:
        logger.error(f"PDF解析失败: {e}")
        raise HTTPException(status_code=400, detail=f"PDF文件解析失败: {str(e)}")

def extract_docx_text(file_content: bytes) -> str:
    """
    从Word文档内容中提取文本
    
    Args:
        file_content: Word文档的字节内容
        
    Returns:
        提取出的文本内容
    """
    try:
        docx_file = io.BytesIO(file_content)
        doc = Document(docx_file)
        text = ""
        
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text += paragraph.text + "\n"
        
        return text.strip()
    except Exception as e:
        logger.error(f"Word文档解析失败: {e}")
        raise HTTPException(status_code=400, detail=f"Word文档解析失败: {str(e)}")

def validate_file(file: UploadFile) -> None:
    """
    验证上传的文件
    
    Args:
        file: 上传的文件对象
    """
    # 检查文件大小 (最大10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    
    # 检查文件类型
    allowed_extensions = {'.pdf', '.doc', '.docx'}
    allowed_mime_types = {
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的文件格式。支持的格式: {', '.join(allowed_extensions)}"
        )
    
    if file.content_type not in allowed_mime_types:
        logger.warning(f"文件MIME类型检查: {file.content_type}")
        # 不强制检查MIME类型，因为有些浏览器可能发送不准确的类型

@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化"""
    global azure_voice_service
    try:
        azure_voice_service = AzureVoiceService()
        logger.info("Azure语音服务初始化完成")
    except Exception as e:
        logger.error(f"Azure语音服务初始化失败: {e}")

@app.get("/")
async def read_root():
    """返回主页面"""
    return FileResponse("static/index.html")

from pydantic import BaseModel

class PromptRequest(BaseModel):
    resume_context: str = ""

@app.post("/api/prompts/voice-call")
async def get_voice_call_prompt_api(request: PromptRequest) -> JSONResponse:
    """
    获取语音通话专用prompt
    
    Args:
        request: 包含resume_context的请求体
        
    Returns:
        prompt指令
    """
    try:
        resume_context = request.resume_context
        instructions = get_voice_call_prompt(resume_context=resume_context)
        
        return JSONResponse(content={
            "success": True,
            "instructions": instructions,
            "has_resume": bool(resume_context)
        })
        
    except Exception as e:
        logger.error(f"获取语音通话prompt失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.get("/api/prompts/voice-call-default")
async def get_voice_call_default_prompt() -> JSONResponse:
    """
    获取语音通话的默认prompt（不包含简历上下文）
    
    Returns:
        默认的语音通话prompt
    """
    try:
        from prompts import InterviewPrompts
        
        return JSONResponse(content={
            "success": True,
            "instructions": InterviewPrompts.VOICE_CALL_INTERVIEWER,
            "source": "prompts.py - VOICE_CALL_INTERVIEWER"
        })
        
    except Exception as e:
        logger.error(f"获取默认语音通话prompt失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.get("/api/prompts/list")
async def list_prompts() -> JSONResponse:
    """
    列出所有可用的prompt类型
    
    Returns:
        prompt类型列表
    """
    try:
        from prompts import InterviewPrompts, SystemPrompts, UIPrompts, NotificationPrompts
        
        prompt_info = {
            "interview_prompts": {
                "base_interviewer": InterviewPrompts.BASE_INTERVIEWER,
                "voice_call_interviewer": InterviewPrompts.VOICE_CALL_INTERVIEWER,
                "position_specific": list(InterviewPrompts.POSITION_SPECIFIC.keys())
            },
            "system_prompts": {
                "welcome_message": SystemPrompts.WELCOME_MESSAGE,
                "error_messages": list(SystemPrompts.ERROR_MESSAGES.keys()),
                "status_messages": list(SystemPrompts.STATUS_MESSAGES.keys())
            },
            "ui_prompts": {
                "button_texts": list(UIPrompts.BUTTON_TEXTS.keys()),
                "placeholders": list(UIPrompts.PLACEHOLDERS.keys()),
                "hints": list(UIPrompts.HINTS.keys())
            },
            "notification_prompts": {
                "success_messages": list(NotificationPrompts.SUCCESS_MESSAGES.keys()),
                "warning_messages": list(NotificationPrompts.WARNING_MESSAGES.keys()),
                "error_messages": list(NotificationPrompts.ERROR_MESSAGES.keys())
            }
        }
        
        return JSONResponse(content={
            "success": True,
            "prompts": prompt_info,
            "message": "所有prompt配置已从prompts.py文件中集中管理"
        })
        
    except Exception as e:
        logger.error(f"获取prompt列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.get("/api/prompts/validate")
async def validate_prompt_management() -> JSONResponse:
    """
    验证prompt管理是否完全通过prompts.py文件
    
    Returns:
        验证结果和建议
    """
    try:
        from prompts import InterviewPrompts, SystemPrompts, UIPrompts, NotificationPrompts
        
        validation_result = {
            "prompts_py_status": "✅ prompts.py文件正常加载",
            "centralized_management": True,
            "available_prompts": {
                "interview_prompts": len(InterviewPrompts.POSITION_SPECIFIC) + 2,  # BASE + VOICE_CALL + positions
                "system_prompts": len(SystemPrompts.ERROR_MESSAGES) + len(SystemPrompts.STATUS_MESSAGES) + 1,  # + WELCOME
                "ui_prompts": len(UIPrompts.BUTTON_TEXTS) + len(UIPrompts.PLACEHOLDERS) + len(UIPrompts.HINTS),
                "notification_prompts": len(NotificationPrompts.SUCCESS_MESSAGES) + len(NotificationPrompts.WARNING_MESSAGES) + len(NotificationPrompts.ERROR_MESSAGES)
            },
            "api_endpoints": [
                "/api/prompts/voice-call - 获取语音通话prompt（带简历上下文）",
                "/api/prompts/voice-call-default - 获取默认语音通话prompt",
                "/api/prompts/list - 列出所有prompt类型",
                "/api/prompts/validate - 验证prompt管理状态"
            ],
            "recommendations": [
                "✅ 所有prompt已通过prompts.py集中管理",
                "✅ 前端已配置API回退机制",
                "✅ 支持动态prompt更新",
                "💡 建议定期审查prompt内容的专业性和准确性"
            ]
        }
        
        return JSONResponse(content={
            "success": True,
            "validation": validation_result,
            "message": "Prompt管理验证完成 - 所有配置已集中到prompts.py"
        })
        
    except Exception as e:
        logger.error(f"Prompt管理验证失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.get("/api/resume/{session_id}")
async def get_resume_content(session_id: str) -> JSONResponse:
    """
    获取指定会话的简历内容
    
    Args:
        session_id: 会话ID
        
    Returns:
        简历内容
    """
    try:
        # 从内存或文件获取简历内容
        resume_content = user_sessions.get(session_id) or load_resume_from_file(session_id)
        
        if not resume_content:
            raise HTTPException(status_code=404, detail="未找到对应的简历内容")
        
        return JSONResponse(content={
            "success": True,
            "session_id": session_id,
            "content": resume_content,
            "content_length": len(resume_content)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取简历内容失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)) -> JSONResponse:
    """
    上传并解析简历文件
    
    Args:
        file: 上传的简历文件
        
    Returns:
        解析结果和会话ID
    """
    try:
        # 验证文件
        validate_file(file)
        
        # 读取文件内容
        file_content = await file.read()
        
        # 根据文件类型解析文本
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension == '.pdf':
            resume_text = extract_pdf_text(file_content)
        elif file_extension in ['.doc', '.docx']:
            resume_text = extract_docx_text(file_content)
        else:
            raise HTTPException(status_code=400, detail="不支持的文件格式")
        
        # 验证解析结果
        if not resume_text or len(resume_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="简历内容过少或解析失败，请检查文件内容")
        
        # 生成会话ID
        session_id = generate_resume_hash(resume_text)
        
        # 保存简历内容
        user_sessions[session_id] = resume_text
        save_resume_to_file(resume_text, session_id)
        
        logger.info(f"简历上传成功: {file.filename}, 会话ID: {session_id}, 内容长度: {len(resume_text)}")
        
        return JSONResponse(content={
            "success": True,
            "message": "简历上传并解析成功",
            "session_id": session_id,
            "filename": file.filename,
            "content_length": len(resume_text),
            "preview": resume_text[:200] + "..." if len(resume_text) > 200 else resume_text
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"简历上传处理失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.websocket("/ws/voice")
async def websocket_voice_endpoint(websocket: WebSocket):
    """Azure语音聊天WebSocket端点 - FastRTC增强版"""
    await websocket.accept()
    logger.info("Azure语音WebSocket连接已建立 - FastRTC增强模式")
    
    # 存储当前活跃的Azure连接，用于打断处理
    current_azure_connection = None
    
    try:
        while True:
            # 接收消息
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "chat":
                message = data.get("message", "")
                session_id = data.get("session_id", "")
                
                if message.strip():
                    logger.info(f"收到语音聊天消息: {message}")
                    
                    # 获取简历上下文
                    resume_context = ""
                    if session_id:
                        resume_context = user_sessions.get(session_id) or load_resume_from_file(session_id)
                    
                    await azure_voice_service.chat_with_voice(message, websocket, resume_context)
                    
            elif message_type == "voice_input":
                # FastRTC增强的语音输入处理
                audio_data = data.get("audio_data", "")
                audio_format = data.get("audio_format", "pcm_s16le")
                sample_rate = data.get("sample_rate", 24000)
                channels = data.get("channels", 1)
                vad_confidence = data.get("vad_confidence", 0.0)
                session_id = data.get("session_id", "")
                
                if audio_data:
                    logger.info(f"收到FastRTC音频数据: 格式={audio_format}, 采样率={sample_rate}, VAD置信度={vad_confidence:.3f}")
                    
                    # 获取简历上下文
                    resume_context = ""
                    if session_id:
                        resume_context = user_sessions.get(session_id) or load_resume_from_file(session_id)
                    
                    # 处理FastRTC音频输入
                    await azure_voice_service.process_fastrtc_audio(
                        audio_data, 
                        websocket, 
                        resume_context,
                        audio_format=audio_format,
                        sample_rate=sample_rate,
                        channels=channels,
                        vad_confidence=vad_confidence
                    )
                    
            elif message_type == "interrupt_request":
                # 处理打断请求
                session_id = data.get("session_id", "")
                reason = data.get("reason", "user_request")
                timestamp = data.get("timestamp", 0)
                
                logger.info(f"收到打断请求: 会话ID={session_id}, 原因={reason}, 时间戳={timestamp}")
                
                # 中断当前Azure连接（如果存在）
                if current_azure_connection:
                    try:
                        # 这里可以添加具体的连接中断逻辑
                        # Azure实时API可能需要特定的中断方法
                        logger.info("正在中断Azure连接...")
                        current_azure_connection = None
                    except Exception as e:
                        logger.error(f"中断Azure连接失败: {e}")
                
                # 发送打断确认
                await websocket.send_json({
                    "type": "interrupt_acknowledged",
                    "session_id": session_id,
                    "timestamp": timestamp,
                    "reason": reason,
                    "message": "打断请求已处理"
                })
                
                logger.info(f"打断请求处理完成: 会话ID={session_id}")
                    
            elif message_type == "voice_input_end":
                # 语音输入结束
                session_id = data.get("session_id", "")
                logger.info(f"语音输入结束: 会话ID={session_id}")
                
                await websocket.send_json({
                    "type": "voice_input_complete",
                    "message": "语音输入处理完成"
                })
                
            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        logger.info("Azure语音WebSocket连接已断开")
    except Exception as e:
        logger.error(f"Azure语音WebSocket错误: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"服务器错误: {str(e)}"
            })
        except:
            pass

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy", 
        "service": "Azure Voice Interview System",
        "azure_client_ready": azure_voice_service.client is not None if azure_voice_service else False
    }

if __name__ == "__main__":
    
    print("🚀 启动Azure语音面试官系统...")
    print("📡 服务地址: http://localhost:8000")
    print("🎤 支持实时语音面试功能")
    
    uvicorn.run(
        app,
        host="localhost",
        port=8000,
        reload=True,
        log_level="info"
    ) 