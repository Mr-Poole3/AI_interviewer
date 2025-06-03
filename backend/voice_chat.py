"""
实时语音交互模块

基于FastRTC和Google Gemini语音API的实时语音对话系统
支持语音输入、暂停检测、实时响应和语音输出
"""
import logging
import asyncio
from typing import Optional, AsyncGenerator, Tuple
import numpy as np
import google.generativeai as genai
from fastrtc import Stream, ReplyOnPause, audio_to_bytes, aggregate_bytes_to_16bit, get_tts_model
import io
import wave

# 导入项目配置
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_GEMINI_API_KEY, get_gemini_model

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GeminiVoiceChat:
    """
    Gemini语音聊天客户端
    
    提供实时语音交互功能，包括：
    - 语音转文字（通过Gemini Live API）
    - 智能对话生成
    - 文字转语音输出（使用FastRTC TTS）
    - 自动暂停检测
    """
    
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        """
        初始化Gemini语音聊天客户端
        
        Args:
            api_key: Google AI API密钥
            model_name: Gemini模型名称
        """
        self.api_key = api_key or get_GEMINI_API_KEY()
        self.model_name = model_name or get_gemini_model()
        
        if not self.api_key:
            raise ValueError("Google AI API密钥未设置，请设置GEMINI_API_KEY环境变量")
        
        # 配置Google AI
        genai.configure(api_key=self.api_key)
        
        # 初始化模型
        self.model = genai.GenerativeModel(self.model_name)
        
        # 初始化FastRTC TTS模型
        try:
            self.tts_model = get_tts_model()
            logger.info("FastRTC TTS模型初始化成功")
        except Exception as e:
            logger.error(f"FastRTC TTS模型初始化失败: {e}")
            self.tts_model = None
        
        # 对话历史
        self.chat_history = []
        
        logger.info(f"Gemini语音聊天客户端初始化完成，模型: {self.model_name}")
    
    def _audio_to_wav_bytes(self, audio_data: Tuple[int, np.ndarray]) -> bytes:
        """
        将音频数据转换为WAV格式字节流
        
        Args:
            audio_data: (采样率, 音频数组) 元组
            
        Returns:
            WAV格式的字节流
        """
        sample_rate, audio_array = audio_data
        
        # 确保音频数据是正确的格式
        if audio_array.dtype != np.int16:
            audio_array = (audio_array * 32767).astype(np.int16)
        
        # 创建WAV文件字节流
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # 单声道
            wav_file.setsampwidth(2)  # 16位
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_array.tobytes())
        
        wav_buffer.seek(0)
        return wav_buffer.read()
    
    async def _transcribe_audio(self, audio_data: Tuple[int, np.ndarray]) -> str:
        """
        使用Gemini进行语音转文字
        
        Args:
            audio_data: 音频数据
            
        Returns:
            转录的文本
        """
        try:
            # 将音频转换为WAV格式
            wav_bytes = self._audio_to_wav_bytes(audio_data)
            
            # 使用Gemini进行语音转录
            # 注意：这里使用文本生成模型配合音频输入
            prompt = "请转录这段音频的内容（可能会有错别字，请根据上下文进行修正）："
            
            # 创建音频部分
            audio_part = {
                "mime_type": "audio/wav",
                "data": wav_bytes
            }
            
            # 生成响应
            response = await asyncio.to_thread(
                self.model.generate_content,
                [prompt, audio_part]
            )
            
            transcription = response.text.strip()
            logger.info(f"语音转录完成: {transcription}")
            return transcription
            
        except Exception as e:
            logger.error(f"语音转录失败: {e}")
            return ""
    
    async def _generate_response(self, user_input: str) -> str:
        """
        生成AI回复
        
        Args:
            user_input: 用户输入文本
            
        Returns:
            AI回复文本
        """
        try:
            # 添加到对话历史
            self.chat_history.append({"role": "user", "content": user_input})
            
            # 构建对话上下文
            context = "\n".join([
                f"{msg['role']}: {msg['content']}" 
                for msg in self.chat_history[-10:]  # 保留最近10轮对话
            ])
            
            # 生成回复
            prompt = f"""你是一个友好的AI助手，正在进行语音对话。请根据以下对话历史生成简洁、自然的回复：

{context}

请用简洁、口语化的方式回复，适合语音交流："""
            
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt
            )
            
            ai_response = response.text.strip()
            
            # 添加到对话历史
            self.chat_history.append({"role": "assistant", "content": ai_response})
            
            logger.info(f"AI回复生成: {ai_response}")
            return ai_response
            
        except Exception as e:
            logger.error(f"AI回复生成失败: {e}")
            return "抱歉，我现在无法回复，请稍后再试。"
    
    async def _text_to_speech(self, text: str) -> AsyncGenerator[Tuple[int, np.ndarray], None]:
        """
        文字转语音 - 使用FastRTC TTS
        
        Args:
            text: 要转换的文本
            
        Yields:
            音频数据块 (sample_rate, audio_array)
        """
        try:
            if not self.tts_model:
                logger.error("TTS模型未初始化，无法进行语音合成")
                return
            
            logger.info(f"开始TTS转换: {text[:50]}...")
            
            # 使用FastRTC的流式TTS
            async for audio_chunk in self.tts_model.stream_tts(text):
                # FastRTC返回的音频格式可能需要转换
                if isinstance(audio_chunk, tuple) and len(audio_chunk) == 2:
                    # 如果已经是(sample_rate, audio_array)格式
                    yield audio_chunk
                else:
                    # 如果是其他格式，需要转换
                    # 假设返回的是16kHz的音频数据
                    sample_rate = 16000
                    if isinstance(audio_chunk, np.ndarray):
                        yield (sample_rate, audio_chunk)
                    else:
                        # 转换为numpy数组
                        audio_array = np.array(audio_chunk, dtype=np.float32)
                        # 确保是正确的形状
                        if audio_array.ndim == 1:
                            audio_array = audio_array.reshape(1, -1)
                        yield (sample_rate, audio_array)
            
            logger.info(f"TTS转换完成: {text[:50]}...")
            
        except Exception as e:
            logger.error(f"FastRTC TTS转换失败: {e}")
            # 降级到简单的错误提示音频
            try:
                sample_rate = 16000
                duration = 1.0  # 1秒错误提示音
                t = np.linspace(0, duration, int(sample_rate * duration))
                # 生成简单的提示音（两个音调）
                frequency1, frequency2 = 800, 400
                audio_signal = (np.sin(2 * np.pi * frequency1 * t[:len(t)//2]) * 0.3 + 
                               np.sin(2 * np.pi * frequency2 * t[len(t)//2:]) * 0.3)
                
                # 转换为正确格式
                audio_array = audio_signal.astype(np.float32).reshape(1, -1)
                yield (sample_rate, audio_array)
                
            except Exception as fallback_error:
                logger.error(f"错误提示音生成也失败: {fallback_error}")
    
    async def process_voice_input(self, audio_data: Tuple[int, np.ndarray]) -> AsyncGenerator[Tuple[int, np.ndarray], None]:
        """
        处理语音输入并生成语音回复
        
        Args:
            audio_data: 输入的音频数据
            
        Yields:
            回复的音频数据
        """
        try:
            logger.info("开始处理语音输入")
            
            # 1. 语音转文字
            transcription = await self._transcribe_audio(audio_data)
            if not transcription:
                logger.warning("语音转录为空，跳过处理")
                return
            
            # 2. 生成AI回复
            response_text = await self._generate_response(transcription)
            
            # 3. 文字转语音并流式返回
            async for audio_chunk in self._text_to_speech(response_text):
                yield audio_chunk
                
        except Exception as e:
            logger.error(f"语音处理失败: {e}")
            # 返回错误提示音频
            error_message = "抱歉，处理您的语音时出现了错误。"
            async for audio_chunk in self._text_to_speech(error_message):
                yield audio_chunk


class VoiceChatStream:
    """
    语音聊天流处理器
    
    基于FastRTC的实时语音交互流
    """
    
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        """
        初始化语音聊天流
        
        Args:
            api_key: Google AI API密钥
            model_name: Gemini模型名称
        """
        self.gemini_client = GeminiVoiceChat(api_key, model_name)
        
        # 创建FastRTC流
        self.stream = Stream(
            handler=ReplyOnPause(self._handle_voice_input),
            modality="audio",
            mode="send-receive",
        )
        
        logger.info("语音聊天流初始化完成")
    
    async def _handle_voice_input(self, audio_data: Tuple[int, np.ndarray]) -> AsyncGenerator[Tuple[int, np.ndarray], None]:
        """
        处理语音输入的回调函数
        
        Args:
            audio_data: 输入音频数据
            
        Yields:
            回复音频数据
        """
        async for audio_chunk in self.gemini_client.process_voice_input(audio_data):
            yield audio_chunk
    
    def launch_ui(self, **kwargs):
        """
        启动内置UI界面
        
        Args:
            **kwargs: 传递给stream.ui.launch()的参数
        """
        logger.info("启动语音聊天UI界面")
        return self.stream.ui.launch(**kwargs)
    
    def mount_to_app(self, app):
        """
        将语音聊天流挂载到FastAPI应用
        
        Args:
            app: FastAPI应用实例
        """
        logger.info("将语音聊天流挂载到FastAPI应用")
        return self.stream.mount(app)


def create_voice_chat_stream(api_key: Optional[str] = None, model_name: Optional[str] = None) -> VoiceChatStream:
    """
    创建语音聊天流实例
    
    Args:
        api_key: Google AI API密钥
        model_name: Gemini模型名称
        
    Returns:
        语音聊天流实例
    """
    return VoiceChatStream(api_key, model_name)


# 独立运行模块
if __name__ == "__main__":
    """
    独立运行语音聊天模块
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Gemini语音聊天系统")
    parser.add_argument("--port", type=int, default=7860, help="服务端口")
    parser.add_argument("--host", type=str, default="localhost", help="服务主机")
    parser.add_argument("--model", type=str, help="Gemini模型名称")
    
    args = parser.parse_args()
    
    try:
        # 创建语音聊天流
        voice_stream = create_voice_chat_stream(model_name=args.model)
        
        # 启动UI
        print(f"🎤 启动Gemini语音聊天系统...")
        print(f"📡 服务地址: http://{args.host}:{args.port}")
        print(f"🤖 使用模型: {voice_stream.gemini_client.model_name}")
        print(f"💡 提示: 说话后暂停，系统会自动检测并回复")
        
        voice_stream.launch_ui(
            server_name=args.host,
            server_port=args.port,
            share=False
        )
        
    except Exception as e:
        logger.error(f"启动失败: {e}")
        print(f"❌ 启动失败: {e}")
        print("💡 请检查:")
        print("   1. GEMINI_API_KEY环境变量是否设置")
        print("   2. 网络连接是否正常")
        print("   3. 依赖包是否正确安装") 