"""
LLM客户端模块

用于与OpenAI兼容的API进行交互
"""
from typing import Generator, Iterator
from openai import OpenAI
from openai.types.chat import ChatCompletionChunk

from config import get_api_key, get_base_url, get_default_model


class LLMClient:
    """
    LLM客户端类
    
    用于封装OpenAI客户端，提供统一的接口
    """
    
    def __init__(self) -> None:
        """初始化LLM客户端"""
        api_key = get_api_key()
        if not api_key:
            raise ValueError(
                "API密钥未设置！请设置环境变量 OPENAI_API_KEY 或 ARK_API_KEY\n"
                "你可以:\n"
                "1. 在命令行中设置: set OPENAI_API_KEY=your_api_key_here\n"
                "2. 创建.env文件并添加: OPENAI_API_KEY=your_api_key_here\n"
                "3. 直接在环境变量中设置"
            )
        
        self.client = OpenAI(
            base_url=get_base_url(),
            api_key=api_key,
        )
        self.default_model = get_default_model()
    
    def chat_stream(
        self, 
        messages: list[dict[str, str]], 
        model: str | None = None
    ) -> Iterator[str]:
        """
        流式聊天
        
        Args:
            messages: 消息列表
            model: 模型名称，默认使用配置中的模型
            
        Yields:
            响应内容片段
        """
        stream = self.client.chat.completions.create(
            model=model or self.default_model,
            messages=messages,
            stream=True,
        )
        
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content



def main() -> None:
    """
    主函数，用于测试LLM客户端
    """
    try:
        client = LLMClient()
        
        messages = [
            {"role": "system", "content": "你是人工智能助手"},
            {"role": "user", "content": "你好"},
        ]
        for content in client.chat_stream(messages):
            print(content, end="")
        
    except ValueError as e:
        print(f"配置错误: {e}")
    except Exception as e:
        print(f"运行错误: {e}")


if __name__ == "__main__":
    main()