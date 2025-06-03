"""
LLM面试官FastAPI后端服务

提供WebSocket流式聊天接口和静态文件服务
支持语音聊天和音频流传输
"""
import json
import logging
import os
import tempfile
import io
import base64
from typing import Dict, List, Optional
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 文件解析库
import PyPDF2
from docx import Document

from backend.llm import LLMClient
from backend.voice_chat import GeminiVoiceChat

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="LLM面试官系统", description="基于FastAPI和WebSocket的LLM面试官")

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

# 全局LLM客户端
llm_client: LLMClient = None

# 存储用户会话的简历内容
user_sessions: Dict[str, str] = {}

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
    global llm_client
    try:
        llm_client = LLMClient()
        logger.info("LLM客户端初始化成功")
    except Exception as e:
        logger.error(f"LLM客户端初始化失败: {e}")
        raise e

@app.get("/")
async def read_root():
    """返回主页面"""
    return FileResponse("static/index.html")

@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)) -> JSONResponse:
    """
    上传并解析简历文件
    
    Args:
        file: 上传的简历文件 (PDF或Word格式)
        
    Returns:
        解析结果和状态信息
    """
    try:
        # 验证文件
        validate_file(file)
        
        # 读取文件内容
        file_content = await file.read()
        
        logger.info(f"开始解析简历文件: {file.filename}, 大小: {len(file_content)} bytes")
        
        # 根据文件扩展名选择解析方法
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension == '.pdf':
            resume_text = extract_pdf_text(file_content)
        elif file_extension in ['.doc', '.docx']:
            resume_text = extract_docx_text(file_content)
        else:
            raise HTTPException(status_code=400, detail="不支持的文件格式")
        
        # 检查解析结果
        if not resume_text or len(resume_text.strip()) < 10:
            raise HTTPException(status_code=400, detail="文件内容为空或解析失败，请检查文件是否损坏")
        
        # 简单的会话管理（实际项目中应该使用更安全的方式）
        session_id = f"session_{len(user_sessions)}"
        user_sessions[session_id] = resume_text
        
        logger.info(f"简历解析成功，提取文本长度: {len(resume_text)} 字符")
        
        return JSONResponse({
            "success": True,
            "message": "简历上传并解析成功",
            "session_id": session_id,
            "resume_preview": resume_text[:200] + "..." if len(resume_text) > 200 else resume_text,
            "text_length": len(resume_text)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"简历上传处理失败: {e}")
        raise HTTPException(status_code=500, detail=f"文件处理失败: {str(e)}")

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket聊天接口，支持流式传输和语音聊天"""
    await websocket.accept()
    logger.info("WebSocket连接已建立")
    
    # 面试官系统提示词（默认）
    system_prompt = """你是一个专业的技术面试官。你的任务是：

1. 进行技术面试，评估候选人的技术能力
2. 根据候选人的回答提出有针对性的追问
3. 保持专业、友好的态度
4. 给出建设性的反馈

请开始面试，首先询问候选人想要面试的技术方向（如前端、后端、全栈等），然后开始相应的技术提问。"""

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt}
    ]
    
    # 当前会话的简历内容
    current_resume_content: Optional[str] = None
    
    # 语音聊天客户端（按需初始化）
    voice_chat_client: Optional[GeminiVoiceChat] = None
    is_voice_mode: bool = False
    
    try:
        # 发送初始欢迎消息
        welcome_msg = "欢迎来到LLM技术面试系统！我是您的面试官。您可以选择直接开始面试，或者先上传简历进行个性化面试。如果选择直接面试，请告诉我您想要面试的技术方向。"
        
        await websocket.send_text(json.dumps({
            "type": "message_start",
            "role": "assistant"
        }))
        
        # 逐字符发送欢迎消息模拟流式效果
        for char in welcome_msg:
            await websocket.send_text(json.dumps({
                "type": "content_delta", 
                "content": char
            }))
        
        await websocket.send_text(json.dumps({
            "type": "message_end"
        }))
        
        # 将欢迎消息添加到对话历史
        messages.append({"role": "assistant", "content": welcome_msg})
        
        while True:
            # 接收用户消息
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                
                # 处理语音消息
                if message_data.get("type") == "voice_message":
                    # 前端发送的语音消息实际上是语音识别的文本结果
                    voice_text = message_data.get("content", "").strip()
                    
                    if not voice_text:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "语音消息内容为空"
                        }))
                        continue
                    
                    logger.info(f"收到语音识别消息: {voice_text}")
                    
                    # 将语音识别的文本当作普通用户消息处理
                    messages.append({"role": "user", "content": voice_text})
                    
                    # 发送消息开始标识
                    await websocket.send_text(json.dumps({
                        "type": "message_start",
                        "role": "assistant"
                    }))
                    
                    # 流式生成AI回复
                    assistant_reply = ""
                    try:
                        for content_chunk in llm_client.chat_stream(messages, resume_content=current_resume_content):
                            assistant_reply += content_chunk
                            await websocket.send_text(json.dumps({
                                "type": "content_delta",
                                "content": content_chunk
                            }))
                            
                        # 发送消息结束标识
                        await websocket.send_text(json.dumps({
                            "type": "message_end",
                            "content": assistant_reply  # 传递完整内容给前端
                        }))
                        
                        # 将完整的AI回复添加到对话历史
                        messages.append({"role": "assistant", "content": assistant_reply})
                        logger.info(f"AI回复完成，长度: {len(assistant_reply)}字符")
                        
                    except Exception as llm_error:
                        logger.error(f"LLM生成回复时出错: {llm_error}")
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "生成回复时发生错误，请稍后重试"
                        }))
                    
                    continue
                
                # 处理语音模式切换
                if message_data.get("type") == "voice_mode_toggle":
                    is_voice_mode = message_data.get("enabled", False)
                    
                    if is_voice_mode and not voice_chat_client:
                        try:
                            voice_chat_client = GeminiVoiceChat()
                            logger.info("语音聊天客户端初始化成功")
                        except Exception as e:
                            logger.error(f"语音聊天客户端初始化失败: {e}")
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": "语音功能初始化失败，请稍后重试"
                            }))
                            continue
                    
                    await websocket.send_text(json.dumps({
                        "type": "voice_mode_status",
                        "enabled": is_voice_mode,
                        "message": f"语音模式已{'开启' if is_voice_mode else '关闭'}"
                    }))
                    continue
                
                # 处理音频数据的语音消息（用于真正的语音流）
                if message_data.get("type") == "voice_audio":
                    if not is_voice_mode or not voice_chat_client:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "语音模式未启用"
                        }))
                        continue
                    
                    # 处理语音数据（这里假设前端发送的是base64编码的音频）
                    audio_data_b64 = message_data.get("audio_data")
                    if not audio_data_b64:
                        continue
                    
                    try:
                        # 解码音频数据
                        audio_bytes = base64.b64decode(audio_data_b64)
                        # 这里需要根据实际的音频格式进行处理
                        # 暂时跳过语音处理，直接处理文本
                        logger.info("收到语音音频数据，暂时跳过处理")
                        continue
                        
                    except Exception as e:
                        logger.error(f"语音音频处理失败: {e}")
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "语音音频处理失败"
                        }))
                        continue
                
                # 处理简历上传通知
                if message_data.get("type") == "resume_uploaded":
                    session_id = message_data.get("session_id")
                    if session_id and session_id in user_sessions:
                        current_resume_content = user_sessions[session_id]
                        
                        # 更新系统prompt为基于简历的面试官
                        messages[0]["content"] = llm_client.create_interview_system_prompt(current_resume_content)
                        
                        # 发送确认消息
                        confirm_msg = "我已经收到并分析了您的简历。让我基于您的背景开始面试。"
                        
                        await websocket.send_text(json.dumps({
                            "type": "message_start",
                            "role": "assistant"
                        }))
                        
                        for char in confirm_msg:
                            await websocket.send_text(json.dumps({
                                "type": "content_delta",
                                "content": char
                            }))
                        
                        await websocket.send_text(json.dumps({
                            "type": "message_end"
                        }))
                        
                        messages.append({"role": "assistant", "content": confirm_msg})
                    continue
                
                # 处理普通聊天消息
                user_message = message_data.get("message", "").strip()
                
                if not user_message:
                    continue
                    
                logger.info(f"收到用户消息: {user_message}")
                
                # 添加用户消息到对话历史
                messages.append({"role": "user", "content": user_message})
                
                # 发送消息开始标识
                await websocket.send_text(json.dumps({
                    "type": "message_start",
                    "role": "assistant"
                }))
                
                # 流式生成AI回复
                assistant_reply = ""
                try:
                    for content_chunk in llm_client.chat_stream(messages, resume_content=current_resume_content):
                        assistant_reply += content_chunk
                        await websocket.send_text(json.dumps({
                            "type": "content_delta",
                            "content": content_chunk
                        }))
                        
                    # 发送消息结束标识
                    await websocket.send_text(json.dumps({
                        "type": "message_end",
                        "content": assistant_reply  # 传递完整内容给前端
                    }))
                    
                    # 如果是语音模式，生成并发送音频
                    if is_voice_mode and voice_chat_client and assistant_reply:
                        try:
                            logger.info("开始生成语音回复...")
                            
                            # 使用语音聊天客户端生成TTS音频
                            async for audio_chunk in voice_chat_client._text_to_speech(assistant_reply):
                                sample_rate, audio_array = audio_chunk
                                
                                # 将音频数据转换为base64发送给前端
                                # 注意：这里需要根据前端期望的格式进行调整
                                audio_bytes = audio_array.tobytes()
                                audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
                                
                                await websocket.send_text(json.dumps({
                                    "type": "audio_chunk",
                                    "audio_data": audio_b64,
                                    "sample_rate": sample_rate
                                }))
                            
                            logger.info("语音回复生成完成")
                            
                        except Exception as tts_error:
                            logger.error(f"TTS生成失败: {tts_error}")
                            # TTS失败不影响文本回复
                    
                    # 将完整的AI回复添加到对话历史
                    messages.append({"role": "assistant", "content": assistant_reply})
                    logger.info(f"AI回复完成，长度: {len(assistant_reply)}字符")
                    
                except Exception as llm_error:
                    logger.error(f"LLM生成回复时出错: {llm_error}")
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "生成回复时发生错误，请稍后重试"
                    }))
                    
            except json.JSONDecodeError:
                logger.error(f"收到无效的JSON消息: {data}")
                await websocket.send_text(json.dumps({
                    "type": "error", 
                    "message": "消息格式错误"
                }))
                
    except WebSocketDisconnect:
        logger.info("WebSocket连接已断开")
    except Exception as e:
        logger.error(f"WebSocket处理出错: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "服务器内部错误"
            }))
        except:
            pass

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0", 
        port=8000,
        reload=True,
        log_level="info"
    ) 