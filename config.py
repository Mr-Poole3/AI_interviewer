"""
配置管理模块

用于管理API密钥和其他配置信息
"""
import os
from typing import Optional


def load_env() -> None:
    """
    加载环境变量配置
    
    如果存在.env文件，则加载其中的环境变量
    """
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        print("提示: 安装python-dotenv可以使用.env文件管理环境变量")
        print("pip install python-dotenv")


def get_api_key() -> Optional[str]:
    """
    获取API密钥
    
    Returns:
        API密钥字符串，如果未设置则返回None
    """
    # 优先使用OPENAI_API_KEY，如果没有则尝试ARK_API_KEY
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("ARK_API_KEY")
    return api_key


def get_base_url() -> str:
    """
    获取API基础URL
    
    Returns:
        API基础URL
    """
    return os.environ.get("OPENAI_BASE_URL", "https://ds.yovole.com/api")


def get_default_model() -> str:
    """
    获取默认模型
    
    Returns:
        默认模型名称
    """
    return os.environ.get("DEFAULT_MODEL", "DeepSeek-V3")


def get_GEMINI_API_KEY() -> Optional[str]:
    """
    获取Google AI API密钥
    
    Returns:
        Google AI API密钥字符串，如果未设置则返回None
    """
    return os.environ.get("GEMINI_API_KEY")


def get_gemini_model() -> str:
    """
    获取Gemini模型名称
    
    Returns:
        Gemini模型名称
    """
    return os.environ.get("GEMINI_MODEL", "gemini-2.0-flash-exp")


# FastRTC音频增强配置
class FastRTCAudioConfig:
    """FastRTC音频增强配置"""
    
    # 音频质量设置
    SAMPLE_RATE = 24000  # 采样率 (Hz)
    BIT_DEPTH = 16       # 位深度
    CHANNELS = 1         # 声道数（单声道）
    CHUNK_DURATION = 50  # 音频块持续时间 (ms)
    
    # 语音活动检测 (VAD) 设置
    VAD_THRESHOLD = 0.01           # VAD阈值
    VAD_SMOOTHING_FACTOR = 0.8     # VAD平滑因子
    MIN_SPEECH_DURATION = 300      # 最小语音持续时间 (ms)
    MAX_SILENCE_DURATION = 1500    # 最大静音持续时间 (ms)
    SILENCE_TIMEOUT = 500          # 静音超时 (ms)
    
    # 音频处理设置
    AUDIO_CONTEXT_LATENCY = 'interactive'  # 音频上下文延迟模式
    TARGET_LATENCY = 0.01                  # 目标延迟 (10ms)
    
    # 音频滤波器设置
    HIGH_PASS_FREQUENCY = 80       # 高通滤波器频率 (Hz)
    LOW_PASS_FREQUENCY = 8000      # 低通滤波器频率 (Hz)
    FILTER_Q_VALUE = 0.7           # 滤波器Q值
    
    # 动态压缩器设置
    COMPRESSOR_THRESHOLD = -24     # 压缩器阈值 (dB)
    COMPRESSOR_KNEE = 30           # 压缩器膝点
    COMPRESSOR_RATIO = 12          # 压缩比
    COMPRESSOR_ATTACK = 0.003      # 压缩器攻击时间 (s)
    COMPRESSOR_RELEASE = 0.25      # 压缩器释放时间 (s)
    
    # 增益控制设置
    DEFAULT_GAIN = 1.0             # 默认增益
    AGC_GAIN = 15                  # 自动增益控制增益
    
    # 音频缓冲设置
    AUDIO_BUFFER_SIZE = 4096       # 音频缓冲区大小
    FFT_SIZE = 2048                # FFT大小（用于分析）
    SMOOTHING_TIME_CONSTANT = 0.8  # 平滑时间常数
    
    # WebRTC音频约束
    WEBRTC_CONSTRAINTS = {
        'echoCancellation': True,
        'noiseSuppression': True,
        'autoGainControl': True,
        'googEchoCancellation': True,
        'googAutoGainControl': True,
        'googNoiseSuppression': True,
        'googHighpassFilter': True,
        'googTypingNoiseDetection': True,
        'googAudioMirroring': False,
        'googNoiseReduction': True
    }
    
    @classmethod
    def get_audio_constraints(cls):
        """获取完整的音频约束配置"""
        constraints = cls.WEBRTC_CONSTRAINTS.copy()
        constraints.update({
            'sampleRate': cls.SAMPLE_RATE,
            'sampleSize': cls.BIT_DEPTH,
            'channelCount': cls.CHANNELS,
            'latency': cls.TARGET_LATENCY,
            'googAGCGain': cls.AGC_GAIN
        })
        return constraints
    
    @classmethod
    def get_audio_context_config(cls):
        """获取音频上下文配置"""
        return {
            'sampleRate': cls.SAMPLE_RATE,
            'latencyHint': cls.AUDIO_CONTEXT_LATENCY
        }
    
    @classmethod
    def get_vad_config(cls):
        """获取VAD配置"""
        return {
            'threshold': cls.VAD_THRESHOLD,
            'smoothingFactor': cls.VAD_SMOOTHING_FACTOR,
            'minSpeechDuration': cls.MIN_SPEECH_DURATION,
            'maxSilenceDuration': cls.MAX_SILENCE_DURATION,
            'silenceTimeout': cls.SILENCE_TIMEOUT
        }

# 在模块导入时加载环境变量
load_env() 