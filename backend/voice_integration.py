"""
语音聊天集成模块

将Gemini语音聊天功能集成到现有的LLM面试官系统中
支持语音面试、文本面试的无缝切换
"""
import logging
from typing import Optional, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import json

# 导入现有模块
from .voice_chat import VoiceChatStream, create_voice_chat_stream
from .app import app as main_app

# 配置日志
logger = logging.getLogger(__name__)


class VoiceInterviewIntegration:
    """
    语音面试集成器
    
    将语音聊天功能集成到现有面试系统中
    """
    
    def __init__(self, main_app: FastAPI):
        """
        初始化语音面试集成器
        
        Args:
            main_app: 主FastAPI应用实例
        """
        self.main_app = main_app
        self.voice_stream = None
        self.active_sessions: Dict[str, Any] = {}
        
        logger.info("语音面试集成器初始化完成")
    
    def setup_voice_chat(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        """
        设置语音聊天功能
        
        Args:
            api_key: Google AI API密钥
            model_name: Gemini模型名称
        """
        try:
            self.voice_stream = create_voice_chat_stream(api_key, model_name)
            logger.info("语音聊天功能设置完成")
        except Exception as e:
            logger.error(f"语音聊天功能设置失败: {e}")
            raise
    
    def mount_voice_endpoints(self):
        """
        挂载语音相关的API端点到主应用
        """
        if not self.voice_stream:
            raise ValueError("语音聊天功能未设置，请先调用setup_voice_chat()")
        
        # 挂载语音流到主应用
        self.voice_stream.mount_to_app(self.main_app)
        
        # 添加语音面试页面路由
        @self.main_app.get("/voice-interview")
        async def voice_interview_page():
            """语音面试页面"""
            return HTMLResponse(content=self._get_voice_interview_html())
        
        # 添加语音面试WebSocket端点
        @self.main_app.websocket("/ws/voice-interview")
        async def voice_interview_websocket(websocket: WebSocket):
            """语音面试WebSocket连接"""
            await self._handle_voice_interview_websocket(websocket)
        
        logger.info("语音端点挂载完成")
    
    async def _handle_voice_interview_websocket(self, websocket: WebSocket):
        """
        处理语音面试WebSocket连接
        
        Args:
            websocket: WebSocket连接
        """
        await websocket.accept()
        session_id = id(websocket)
        self.active_sessions[session_id] = {
            "websocket": websocket,
            "type": "voice",
            "status": "connected"
        }
        
        try:
            logger.info(f"语音面试会话开始: {session_id}")
            
            while True:
                # 接收消息
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # 处理不同类型的消息
                if message_data.get("type") == "voice_data":
                    # 处理语音数据
                    await self._process_voice_data(websocket, message_data)
                elif message_data.get("type") == "control":
                    # 处理控制消息
                    await self._process_control_message(websocket, message_data)
                
        except WebSocketDisconnect:
            logger.info(f"语音面试会话断开: {session_id}")
        except Exception as e:
            logger.error(f"语音面试会话错误: {e}")
        finally:
            # 清理会话
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
    
    async def _process_voice_data(self, websocket: WebSocket, message_data: Dict[str, Any]):
        """
        处理语音数据
        
        Args:
            websocket: WebSocket连接
            message_data: 消息数据
        """
        try:
            # 这里可以集成语音处理逻辑
            # 例如：语音转文字、AI回复生成、文字转语音等
            
            # 发送处理状态
            await websocket.send_text(json.dumps({
                "type": "status",
                "message": "正在处理语音..."
            }))
            
            # 模拟处理结果
            response = {
                "type": "voice_response",
                "transcription": "用户语音转录结果",
                "ai_response": "AI回复内容",
                "audio_data": "base64编码的音频数据"
            }
            
            await websocket.send_text(json.dumps(response))
            
        except Exception as e:
            logger.error(f"语音数据处理失败: {e}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "语音处理失败"
            }))
    
    async def _process_control_message(self, websocket: WebSocket, message_data: Dict[str, Any]):
        """
        处理控制消息
        
        Args:
            websocket: WebSocket连接
            message_data: 消息数据
        """
        try:
            command = message_data.get("command")
            
            if command == "start_recording":
                await websocket.send_text(json.dumps({
                    "type": "status",
                    "message": "开始录音"
                }))
            elif command == "stop_recording":
                await websocket.send_text(json.dumps({
                    "type": "status",
                    "message": "停止录音"
                }))
            elif command == "switch_to_text":
                await websocket.send_text(json.dumps({
                    "type": "mode_switch",
                    "new_mode": "text",
                    "message": "已切换到文本模式"
                }))
            
        except Exception as e:
            logger.error(f"控制消息处理失败: {e}")
    
    def _get_voice_interview_html(self) -> str:
        """
        获取语音面试页面HTML
        
        Returns:
            HTML页面内容
        """
        return """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>语音面试 - AI面试官</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .voice-controls {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin: 30px 0;
        }
        
        .voice-btn {
            padding: 15px 30px;
            border: none;
            border-radius: 50px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .record-btn {
            background: #e74c3c;
            color: white;
        }
        
        .record-btn:hover {
            background: #c0392b;
        }
        
        .record-btn.recording {
            background: #27ae60;
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .switch-btn {
            background: #3498db;
            color: white;
        }
        
        .switch-btn:hover {
            background: #2980b9;
        }
        
        .status {
            text-align: center;
            padding: 15px;
            margin: 20px 0;
            border-radius: 8px;
            background: #ecf0f1;
            color: #2c3e50;
        }
        
        .conversation {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 8px;
        }
        
        .user-message {
            background: #3498db;
            color: white;
            margin-left: 20%;
        }
        
        .ai-message {
            background: #ecf0f1;
            color: #2c3e50;
            margin-right: 20%;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎤 语音面试</h1>
            <p>使用语音与AI面试官进行实时对话</p>
        </div>
        
        <div class="voice-controls">
            <button id="recordBtn" class="voice-btn record-btn">开始录音</button>
            <button id="switchBtn" class="voice-btn switch-btn">切换到文本模式</button>
        </div>
        
        <div id="status" class="status">
            准备就绪，点击开始录音按钮开始语音面试
        </div>
        
        <div id="conversation" class="conversation">
            <div class="message ai-message">
                您好！我是AI面试官，很高兴为您进行语音面试。请点击录音按钮开始我们的对话。
            </div>
        </div>
    </div>
    
    <script>
        class VoiceInterview {
            constructor() {
                this.ws = null;
                this.isRecording = false;
                this.mediaRecorder = null;
                this.audioChunks = [];
                
                this.initElements();
                this.connectWebSocket();
            }
            
            initElements() {
                this.recordBtn = document.getElementById('recordBtn');
                this.switchBtn = document.getElementById('switchBtn');
                this.status = document.getElementById('status');
                this.conversation = document.getElementById('conversation');
                
                this.recordBtn.addEventListener('click', () => this.toggleRecording());
                this.switchBtn.addEventListener('click', () => this.switchToTextMode());
            }
            
            connectWebSocket() {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws/voice-interview`;
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    this.updateStatus('WebSocket连接已建立');
                };
                
                this.ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                };
                
                this.ws.onclose = () => {
                    this.updateStatus('连接已断开，正在重连...');
                    setTimeout(() => this.connectWebSocket(), 3000);
                };
                
                this.ws.onerror = (error) => {
                    this.updateStatus('连接错误，请检查网络');
                };
            }
            
            handleWebSocketMessage(data) {
                switch(data.type) {
                    case 'status':
                        this.updateStatus(data.message);
                        break;
                    case 'voice_response':
                        this.addMessage('user', data.transcription);
                        this.addMessage('ai', data.ai_response);
                        break;
                    case 'mode_switch':
                        if (data.new_mode === 'text') {
                            window.location.href = '/';
                        }
                        break;
                    case 'error':
                        this.updateStatus(`错误: ${data.message}`);
                        break;
                }
            }
            
            async toggleRecording() {
                if (!this.isRecording) {
                    await this.startRecording();
                } else {
                    this.stopRecording();
                }
            }
            
            async startRecording() {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    this.mediaRecorder = new MediaRecorder(stream);
                    this.audioChunks = [];
                    
                    this.mediaRecorder.ondataavailable = (event) => {
                        this.audioChunks.push(event.data);
                    };
                    
                    this.mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                        this.sendAudioData(audioBlob);
                    };
                    
                    this.mediaRecorder.start();
                    this.isRecording = true;
                    this.recordBtn.textContent = '停止录音';
                    this.recordBtn.classList.add('recording');
                    this.updateStatus('正在录音...');
                    
                    // 发送开始录音控制消息
                    this.sendControlMessage('start_recording');
                    
                } catch (error) {
                    this.updateStatus('无法访问麦克风，请检查权限设置');
                }
            }
            
            stopRecording() {
                if (this.mediaRecorder && this.isRecording) {
                    this.mediaRecorder.stop();
                    this.isRecording = false;
                    this.recordBtn.textContent = '开始录音';
                    this.recordBtn.classList.remove('recording');
                    this.updateStatus('录音已停止，正在处理...');
                    
                    // 发送停止录音控制消息
                    this.sendControlMessage('stop_recording');
                }
            }
            
            sendAudioData(audioBlob) {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64Audio = reader.result.split(',')[1];
                    this.ws.send(JSON.stringify({
                        type: 'voice_data',
                        audio: base64Audio
                    }));
                };
                reader.readAsDataURL(audioBlob);
            }
            
            sendControlMessage(command) {
                this.ws.send(JSON.stringify({
                    type: 'control',
                    command: command
                }));
            }
            
            switchToTextMode() {
                this.sendControlMessage('switch_to_text');
            }
            
            updateStatus(message) {
                this.status.textContent = message;
            }
            
            addMessage(sender, content) {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${sender}-message`;
                messageDiv.textContent = content;
                this.conversation.appendChild(messageDiv);
                this.conversation.scrollTop = this.conversation.scrollHeight;
            }
        }
        
        // 初始化语音面试
        document.addEventListener('DOMContentLoaded', () => {
            new VoiceInterview();
        });
    </script>
</body>
</html>
        """
    
    def get_integration_status(self) -> Dict[str, Any]:
        """
        获取集成状态
        
        Returns:
            集成状态信息
        """
        return {
            "voice_chat_enabled": self.voice_stream is not None,
            "active_sessions": len(self.active_sessions),
            "session_types": [session["type"] for session in self.active_sessions.values()]
        }


# 创建全局集成实例
voice_integration = VoiceInterviewIntegration(main_app)


def setup_voice_integration(api_key: Optional[str] = None, model_name: Optional[str] = None):
    """
    设置语音集成功能
    
    Args:
        api_key: Google AI API密钥
        model_name: Gemini模型名称
    """
    try:
        voice_integration.setup_voice_chat(api_key, model_name)
        voice_integration.mount_voice_endpoints()
        logger.info("语音集成功能设置完成")
        return True
    except Exception as e:
        logger.error(f"语音集成功能设置失败: {e}")
        return False


# 添加到主应用的启动事件
@main_app.on_event("startup")
async def setup_voice_on_startup():
    """
    应用启动时自动设置语音功能
    """
    try:
        # 尝试自动设置语音功能
        setup_voice_integration()
        logger.info("语音功能自动设置完成")
    except Exception as e:
        logger.warning(f"语音功能自动设置失败，将在手动配置后可用: {e}")


# 添加状态检查端点
@main_app.get("/api/voice/status")
async def get_voice_status():
    """
    获取语音功能状态
    """
    return voice_integration.get_integration_status() 