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
        base_prompt = """你是一位专业的AI面试官，负责进行技术面试。请遵循以下原则：

1. 保持专业、友好的态度
2. 根据候选人的回答进行深入追问
3. 评估技术能力、解决问题的思路和沟通能力
4. 提供建设性的反馈
5. 语音回复要简洁明了，适合口语交流"""

        if resume_context:
            return f"""{base_prompt}

候选人简历信息：
{resume_context}

请根据简历内容进行针对性的面试提问。"""
        
        return base_prompt
    
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
            logger.info(f"FastRTC音频处理: 格式={audio_format}, 采样率={sample_rate}Hz, "
                       f"声道={channels}, 数据长度={len(audio_bytes)}字节, VAD置信度={vad_confidence:.3f}")
            
            # 只有当VAD置信度足够高时才处理音频
            if vad_confidence < 0.01:  # 阈值可调整
                logger.debug(f"VAD置信度过低({vad_confidence:.3f})，跳过音频处理")
                return
            
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