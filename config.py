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


# 在模块导入时加载环境变量
load_env() 