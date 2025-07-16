#!/usr/bin/env python3
"""
LLM面试官系统启动脚本

提供友好的启动体验和环境检查
"""
import os
import sys
import subprocess
import time
from pathlib import Path

def print_banner():
    """打印启动横幅"""
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                    🎯 LLM面试官系统                          ║
║              基于FastAPI和WebSocket的智能面试系统              ║
╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)


def check_env_config():
    """检查环境变量配置"""
    # 自动加载 .env 文件
    env_file = Path(".env")
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
            print("✅ 自动加载 .env 文件配置")
        except ImportError:
            print("⚠️  未安装 python-dotenv，无法加载 .env 文件")
        except Exception as e:
            print(f"⚠️  加载 .env 文件失败: {e}")
    
    # 检查关键环境变量（检查但不强制要求）
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("ARK_API_KEY") or os.environ.get("AZURE_OPENAI_API_KEY")
    if api_key:
        print("✅ API密钥配置检查通过")
    else:
        print("ℹ️  未检测到API密钥，将尝试使用其他配置")
        if not env_file.exists():
            print("💡 提示：您可以创建 .env 文件来配置API密钥")
            print("   示例内容：")
            print("   AZURE_OPENAI_API_KEY=your_api_key_here")
    
    # 总是返回 True，让系统自动启动
    return True

def start_server():
    """启动服务器"""
    print("\n🚀 正在启动LLM面试官系统...")
    print("   服务地址：http://localhost:9000")
    print("   按 Ctrl+C 停止服务\n")
    
    try:
        # 启动uvicorn服务器
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "backend.app:app", 
            "--host", "localhost",
            "--port", "9000",
            "--reload"
        ])
    except KeyboardInterrupt:
        print("\n\n👋 感谢使用LLM面试官系统！")
    except Exception as e:
        print(f"\n❌ 启动失败：{e}")
        return False
    
    return True

def main():
    """主函数"""
    print_banner()
    
    if not check_env_config():
        sys.exit(1)
    
    # 启动服务
    start_server()

if __name__ == "__main__":
    main() 