"""
LLM面试官FastAPI后端服务

提供WebSocket流式聊天接口和静态文件服务
"""
import json
import logging
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.llm import LLMClient

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

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket聊天接口，支持流式传输"""
    await websocket.accept()
    logger.info("WebSocket连接已建立")
    
    # 面试官系统提示词
    system_prompt = """你是一个专业的技术面试官。你的任务是：

1. 进行技术面试，评估候选人的技术能力
2. 根据候选人的回答提出有针对性的追问
3. 保持专业、友好的态度
4. 给出建设性的反馈

请开始面试，首先询问候选人想要面试的技术方向（如前端、后端、全栈等），然后开始相应的技术提问。"""

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt}
    ]
    
    try:
        # 发送初始欢迎消息
        welcome_msg = "欢迎来到LLM技术面试系统！我是您的面试官。请告诉我您想要面试的技术方向，比如前端开发、后端开发、全栈开发等，我会为您准备相应的技术问题。"
        
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
                    for content_chunk in llm_client.chat_stream(messages):
                        assistant_reply += content_chunk
                        await websocket.send_text(json.dumps({
                            "type": "content_delta",
                            "content": content_chunk
                        }))
                        
                    # 发送消息结束标识
                    await websocket.send_text(json.dumps({
                        "type": "message_end"
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