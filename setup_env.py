#!/usr/bin/env python3
"""
虚拟环境自动设置脚本

用于快速构建项目的Python虚拟环境
支持Windows、macOS和Linux系统
"""
import os
import sys
import subprocess
import platform
from pathlib import Path


def print_banner():
    """打印设置横幅"""
    banner = """
    ╔══════════════════════════════════════════════════════════════╗
    ║                    🐍 Python环境自动设置                      ║
    ║                                                              ║
    ║  自动创建虚拟环境、安装依赖、配置环境变量                      ║
    ║  支持Windows、macOS、Linux系统                               ║
    ╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)


def check_python_version():
    """检查Python版本"""
    print("🔍 检查Python版本...")
    
    if sys.version_info < (3, 8):
        print("❌ Python版本过低，需要Python 3.8或更高版本")
        print(f"   当前版本: {sys.version}")
        return False
    
    print(f"✅ Python版本检查通过: {sys.version.split()[0]}")
    return True


def check_pip():
    """检查pip是否可用"""
    print("🔍 检查pip...")
    
    try:
        subprocess.run([sys.executable, "-m", "pip", "--version"], 
                      check=True, capture_output=True)
        print("✅ pip可用")
        return True
    except subprocess.CalledProcessError:
        print("❌ pip不可用，请先安装pip")
        return False


def create_virtual_environment():
    """创建虚拟环境"""
    print("🏗️  创建虚拟环境...")
    
    venv_path = Path(".venv")
    
    if venv_path.exists():
        print("⚠️  虚拟环境已存在，是否重新创建？(y/N): ", end="")
        choice = input().strip().lower()
        if choice == 'y':
            print("🗑️  删除现有虚拟环境...")
            import shutil
            shutil.rmtree(venv_path)
        else:
            print("✅ 使用现有虚拟环境")
            return True
    
    try:
        subprocess.run([sys.executable, "-m", "venv", ".venv"], check=True)
        print("✅ 虚拟环境创建成功")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ 虚拟环境创建失败: {e}")
        return False


def get_activation_command():
    """获取虚拟环境激活命令"""
    system = platform.system().lower()
    
    if system == "windows":
        return ".venv\\Scripts\\activate"
    else:
        return "source .venv/bin/activate"


def get_python_executable():
    """获取虚拟环境中的Python可执行文件路径"""
    system = platform.system().lower()
    
    if system == "windows":
        return Path(".venv/Scripts/python.exe")
    else:
        return Path(".venv/bin/python")


def install_dependencies():
    """安装项目依赖"""
    print("📦 安装项目依赖...")
    
    python_exe = get_python_executable()
    
    if not python_exe.exists():
        print("❌ 虚拟环境Python可执行文件不存在")
        return False
    
    # 升级pip
    print("⬆️  升级pip...")
    try:
        subprocess.run([str(python_exe), "-m", "pip", "install", "--upgrade", "pip"], 
                      check=True)
        print("✅ pip升级成功")
    except subprocess.CalledProcessError as e:
        print(f"⚠️  pip升级失败: {e}")
    
    # 安装依赖
    requirements_file = Path("requirements.txt")
    if not requirements_file.exists():
        print("❌ requirements.txt文件不存在")
        return False
    
    try:
        print("📥 安装requirements.txt中的依赖...")
        subprocess.run([str(python_exe), "-m", "pip", "install", "-r", "requirements.txt"], 
                      check=True)
        print("✅ 依赖安装成功")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ 依赖安装失败: {e}")
        return False


def create_env_file():
    """创建.env环境变量文件"""
    print("⚙️  配置环境变量...")
    
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if env_file.exists():
        print("✅ .env文件已存在")
        return True
    
    if env_example.exists():
        print("📋 从.env.example复制配置...")
        import shutil
        shutil.copy(env_example, env_file)
        print("✅ .env文件创建成功")
        print("💡 请编辑.env文件，填入正确的配置值")
    else:
        print("📝 创建基础.env文件...")
        env_content = """# Google AI API配置
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-pro

# OpenAI API配置（可选）
OPENAI_API_KEY=your_openai_api_key_here

# 服务配置
HOST=0.0.0.0
PORT=8000
DEBUG=True

# 其他配置
# 添加其他需要的环境变量
"""
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(env_content)
        print("✅ .env文件创建成功")
        print("💡 请编辑.env文件，填入正确的API密钥")
    
    return True


def verify_installation():
    """验证安装"""
    print("🔍 验证安装...")
    
    python_exe = get_python_executable()
    
    # 检查关键包是否安装成功
    key_packages = ["fastapi", "uvicorn", "google.generativeai", "fastrtc"]
    
    for package in key_packages:
        try:
            subprocess.run([str(python_exe), "-c", f"import {package}"], 
                          check=True, capture_output=True)
            print(f"✅ {package} 安装成功")
        except subprocess.CalledProcessError:
            print(f"❌ {package} 安装失败")
            return False
    
    print("✅ 所有关键包验证通过")
    return True


def print_next_steps():
    """打印后续步骤"""
    activation_cmd = get_activation_command()
    
    print("\n" + "="*60)
    print("🎉 环境设置完成！")
    print("="*60)
    print("\n📋 后续步骤:")
    print(f"1. 激活虚拟环境:")
    print(f"   {activation_cmd}")
    print("\n2. 配置环境变量:")
    print("   编辑 .env 文件，填入正确的API密钥")
    print("\n3. 启动项目:")
    print("   python start.py")
    print("   或")
    print("   python voice_start.py")
    print("\n4. 访问应用:")
    print("   http://localhost:8000")
    print("\n💡 提示:")
    print("   - 确保已设置GEMINI_API_KEY环境变量")
    print("   - 如需语音功能，请确保麦克风权限已开启")
    print("   - 详细文档请查看 README.md")


def main():
    """主函数"""
    print_banner()
    
    # 检查系统要求
    if not check_python_version():
        sys.exit(1)
    
    if not check_pip():
        sys.exit(1)
    
    # 创建虚拟环境
    if not create_virtual_environment():
        sys.exit(1)
    
    # 安装依赖
    if not install_dependencies():
        sys.exit(1)
    
    # 创建环境配置文件
    if not create_env_file():
        sys.exit(1)
    
    # 验证安装
    if not verify_installation():
        print("⚠️  安装验证失败，但基本环境已设置完成")
    
    # 打印后续步骤
    print_next_steps()


if __name__ == "__main__":
    main() 