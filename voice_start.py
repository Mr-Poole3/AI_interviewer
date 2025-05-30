#!/usr/bin/env python3
"""
语音聊天模块独立启动脚本

基于FastRTC和Google Gemini的实时语音交互系统
支持独立运行和集成到现有系统
"""
import os
import sys
import argparse
import asyncio
from typing import Optional

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import load_env, get_GEMINI_API_KEY, get_gemini_model


def print_banner():
    """打印启动横幅"""
    banner = """
    ╔══════════════════════════════════════════════════════════════╗
    ║                    🎤 Gemini语音聊天系统                      ║
    ║                                                              ║
    ║  基于FastRTC + Google Gemini的实时语音交互系统                ║
    ║  支持语音输入、暂停检测、智能回复、语音输出                    ║
    ╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)


def check_dependencies():
    """检查依赖包是否安装"""
    required_packages = [
        ("fastrtc", "FastRTC实时通信库"),
        ("google.generativeai", "Google AI生成式AI库"),
        ("numpy", "数值计算库"),
        ("websockets", "WebSocket库")
    ]
    
    missing_packages = []
    
    for package, description in required_packages:
        try:
            __import__(package)
            print(f"✅ {description} - 已安装")
        except ImportError:
            missing_packages.append((package, description))
            print(f"❌ {description} - 未安装")
    
    if missing_packages:
        print("\n🔧 请安装缺失的依赖包:")
        print("pip install fastrtc[vad,tts] google-generativeai numpy websockets")
        return False
    
    return True


def check_api_config():
    """检查API配置"""
    print("\n🔑 检查API配置...")
    
    api_key = get_GEMINI_API_KEY()
    if not api_key:
        print("❌ Google AI API密钥未设置")
        print("💡 请设置环境变量: GEMINI_API_KEY=your_api_key")
        print("💡 或在.env文件中添加: GEMINI_API_KEY=your_api_key")
        return False
    
    print(f"✅ Google AI API密钥已设置 (***{api_key[-4:]})")
    
    model_name = get_gemini_model()
    print(f"✅ 使用模型: {model_name}")
    
    return True


def run_standalone_mode(args):
    """运行独立模式"""
    print(f"\n🚀 启动独立语音聊天服务...")
    print(f"📡 服务地址: http://{args.host}:{args.port}")
    print(f"🤖 使用模型: {args.model or get_gemini_model()}")
    print(f"💡 提示: 说话后暂停，系统会自动检测并回复")
    print(f"🌐 在浏览器中打开上述地址开始语音聊天")
    
    try:
        # 导入并运行语音聊天模块
        from backend.voice_chat import create_voice_chat_stream
        
        # 创建语音聊天流
        voice_stream = create_voice_chat_stream(model_name=args.model)
        
        # 启动UI
        voice_stream.launch_ui(
            server_name=args.host,
            server_port=args.port,
            share=args.share
        )
        
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        return False
    
    return True


def run_integration_mode(args):
    """运行集成模式"""
    print(f"\n🔗 启动集成模式...")
    print(f"📡 服务地址: http://{args.host}:{args.port}")
    print(f"🤖 使用模型: {args.model or get_gemini_model()}")
    print(f"💡 语音功能将集成到现有面试官系统")
    
    try:
        # 导入并运行集成模块
        from backend.voice_integration import setup_voice_integration
        import uvicorn
        from backend.app import app
        
        # 设置语音集成
        if setup_voice_integration(model_name=args.model):
            print("✅ 语音功能集成成功")
            print("🌐 访问 /voice-interview 开始语音面试")
            print("🌐 访问 / 使用原有文本面试")
            
            # 启动服务
            uvicorn.run(
                app,
                host=args.host,
                port=args.port,
                log_level="info"
            )
        else:
            print("❌ 语音功能集成失败")
            return False
        
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        return False
    
    return True


def main():
    """主函数"""
    # 加载环境变量
    load_env()
    
    # 解析命令行参数
    parser = argparse.ArgumentParser(
        description="Gemini语音聊天系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 独立运行语音聊天
  python voice_start.py --mode standalone
  
  # 集成到现有面试官系统
  python voice_start.py --mode integration
  
  # 自定义端口和模型
  python voice_start.py --port 8080 --model gemini-pro
  
  # 启用公网分享（仅独立模式）
  python voice_start.py --mode standalone --share
        """
    )
    
    parser.add_argument(
        "--mode", 
        choices=["standalone", "integration"], 
        default="standalone",
        help="运行模式: standalone(独立运行) 或 integration(集成模式)"
    )
    parser.add_argument(
        "--port", 
        type=int, 
        default=8000, 
        help="服务端口 (默认: 8000)"
    )
    parser.add_argument(
        "--host", 
        type=str, 
        default="0.0.0.0", 
        help="服务主机 (默认: 0.0.0.0)"
    )
    parser.add_argument(
        "--model", 
        type=str, 
        help="Gemini模型名称 (默认: 从环境变量获取)"
    )
    parser.add_argument(
        "--share", 
        action="store_true", 
        help="启用公网分享 (仅独立模式)"
    )
    parser.add_argument(
        "--skip-checks", 
        action="store_true", 
        help="跳过依赖和配置检查"
    )
    
    args = parser.parse_args()
    
    # 打印横幅
    print_banner()
    
    # 检查依赖和配置
    if not args.skip_checks:
        print("🔍 检查系统环境...")
        
        if not check_dependencies():
            print("\n❌ 依赖检查失败，请安装缺失的依赖包")
            sys.exit(1)
        
        if not check_api_config():
            print("\n❌ API配置检查失败，请设置Google AI API密钥")
            sys.exit(1)
        
        print("\n✅ 环境检查通过")
    
    # 根据模式启动服务
    try:
        if args.mode == "standalone":
            success = run_standalone_mode(args)
        elif args.mode == "integration":
            success = run_integration_mode(args)
        else:
            print(f"❌ 未知运行模式: {args.mode}")
            sys.exit(1)
        
        if not success:
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n👋 服务已停止")
    except Exception as e:
        print(f"\n❌ 运行时错误: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 