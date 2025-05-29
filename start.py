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
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("ARK_API_KEY")
    if not api_key:
        print("⚠️  警告：未检测到API密钥")
        print("   请设置环境变量 OPENAI_API_KEY 或 ARK_API_KEY")
        print("   或创建 .env 文件配置")
        
        # 检查是否存在 .env 文件
        if Path(".env").exists():
            print("✅ 发现 .env 文件，将尝试加载配置")
        else:
            print("💡 提示：您可以创建 .env 文件来配置API密钥")
            print("   示例内容：")
            print("   OPENAI_API_KEY=your_api_key_here")
            print("   OPENAI_BASE_URL=your_base_url_here")
            
        choice = input("\n是否继续启动？(y/N): ").lower().strip()
        if choice not in ['y', 'yes']:
            return False
    else:
        print("✅ API密钥配置检查通过")
    
    return True

def start_server():
    """启动服务器"""
    print("\n🚀 正在启动LLM面试官系统...")
    print("   服务地址：http://localhost:8000")
    print("   按 Ctrl+C 停止服务\n")
    
    try:
        # 启动uvicorn服务器
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "backend.app:app", 
            "--host", "localhost",
            "--port", "8000",
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