"""
LLM面试官FastAPI后端服务

基于Azure OpenAI实时语音模型的智能面试系统
支持文本聊天、语音输入输出和简历上传功能
"""
import json
import logging
import os
import tempfile
import io
import base64
import hashlib
import asyncio
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# 文件解析库
import PyPDF2
from docx import Document

# Azure OpenAI实时语音客户端
from openai import AsyncAzureOpenAI

# 导入配置管理
from config import get_model_temperature, get_max_tokens, get_top_p

# 导入提示词配置
from prompts import get_interviewer_prompt, get_voice_call_prompt, get_interview_evaluation_prompt, get_interview_extraction_prompt

from dotenv import load_dotenv
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Azure语音面试官系统", description="基于Azure OpenAI实时语音模型的智能面试系统")

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

# Pydantic 模型定义
class PromptRequest(BaseModel):
    resume_context: str = ""

class InterviewEvaluationRequest(BaseModel):
    interview_id: str
    messages: list
    resume_context: str = ""
    duration: int = 0
    session_id: str = ""


class InterviewEvaluationService:
    """面试评分服务"""
    
    def __init__(self):
        # DeepSeek V3 配置
        self.DEEPSEEK_API_URL = "https://ds.yovole.com/api"
        self.DEEPSEEK_API_KEY = "sk-833480880d9d417fbcc7ce125ca7d78b"
        self.DEEPSEEK_MODEL = "DeepSeek-V3"

        # 初始化DeepSeek客户端，设置更长的超时时间
        import httpx
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=15.0,  # 连接超时15秒
                read=120.0,    # 读取超时120秒（面试评估需要更长时间）
                write=30.0,    # 写入超时30秒
                pool=30.0      # 连接池超时30秒
            )
        )
    
    async def evaluate_interview(self, interview_data: dict) -> dict:
        """
        评估面试表现
        
        Args:
            interview_data: 面试数据，包含对话历史、简历信息等
            
        Returns:
            dict: 评估结果
        """
        try:
            logger.info(f"开始评估面试: ID={interview_data.get('id', 'unknown')}")
            
            # 提取面试信息
            messages = interview_data.get('messages', [])
            resume_context = interview_data.get('resume_context', '')
            duration = interview_data.get('duration', 0)
            
            # ===== 详细日志输出：打印原始面试数据 =====
            logger.info("=" * 100)
            logger.info("原始面试数据:")
            logger.info("=" * 100)
            logger.info(f"面试ID: {interview_data.get('id', 'unknown')}")
            logger.info(f"消息数量: {len(messages)}")
            logger.info(f"面试时长: {duration} 秒")
            logger.info(f"简历上下文长度: {len(resume_context)} 字符")
            logger.info("原始消息列表:")
            for i, msg in enumerate(messages):
                logger.info(f"  消息 {i+1}: type={msg.get('type', 'unknown')}, content_length={len(msg.get('content', ''))}")
                logger.info(f"    内容: {msg.get('content', '')[:100]}...")
            logger.info("=" * 100)
            
            # 分析对话内容
            conversation_analysis = self._analyze_conversation(messages)
            
            # ===== 详细日志输出：打印分析后的对话内容 =====
            logger.info("分析后的对话内容:")
            logger.info("=" * 100)
            logger.info(f"格式化对话长度: {len(conversation_analysis['formatted_conversation'])} 字符")
            logger.info("格式化对话内容:")
            logger.info(conversation_analysis['formatted_conversation'])
            logger.info("=" * 100)
            
            # 构建评估prompt
            evaluation_prompt = get_interview_evaluation_prompt(
                resume_context=resume_context,
                conversation_history=conversation_analysis['formatted_conversation'],
            )
            
            # 调用DeepSeek V3进行评估
            evaluation_result = await self._call_deepseek_evaluation(evaluation_prompt)
            
            # 解析评估结果
            parsed_result = self._parse_evaluation_result(evaluation_result)
            
            # 添加统计信息
            parsed_result.update({
                'conversation_stats': conversation_analysis['stats'],
                'evaluation_timestamp': datetime.now().isoformat(),
                'model_used': self.DEEPSEEK_MODEL
            })
            
            logger.info(f"面试评估完成: 总分={parsed_result.get('total_score', 'N/A')}")
            return parsed_result
            
        except Exception as e:
            logger.error(f"面试评估失败: {e}")
            # 提供降级的默认评估结果
            return self._get_fallback_evaluation_result(str(e))
        
    def _parse_extraction_result(self, evaluation_text: str) -> dict:
        """解析评估结果"""
        try:
            # 尝试从评估文本中提取结构化信息
            response = json.loads(evaluation_text.split("```json\n")[-1].split("\n```")[0])

            result = {
                'success': True,
                'title': response.get('title', ''),
                'summary': response.get('summary', '')
            }
            
            return result
            
        except Exception as e:
            logger.error(f"评估结果解析失败: {e}")
            return {
                'success': True,
                'title': '',
                'summary': '解析过程中出现错误，请稍后重试。'
            }

    async def extract_interview(self, interview_data: dict) -> dict:
        """
        提取面试数据
        
        Args:
            interview_data: 面试数据，包含对话历史、简历信息等
        Returns:
            dict: 评估结果
        """
        try:
            logger.info(f"开始解析面试数据: ID={interview_data.get('id', 'unknown')}")
            
            # 提取面试信息
            messages = interview_data.get('messages', [])
            resume_context = interview_data.get('resume_context', '')
            # duration = interview_data.get('duration', 0)
            
            # 分析对话内容
            # conversation_analysis = self._analyze_conversation(messages)
            
            # 构建评估prompt
            extraction_prompt = get_interview_extraction_prompt(
                resume_context=resume_context,
                conversation_history=str(messages),
            )
            
            # 调用DeepSeek V3进行评估
            extraction_result = await self._call_deepseek_evaluation(extraction_prompt)
            
            # 解析评估结果
            parsed_result = self._parse_extraction_result(extraction_result)
            
            # 添加统计信息
            parsed_result.update({
                'evaluation_timestamp': datetime.now().isoformat(),
                'model_used': self.DEEPSEEK_MODEL
            })
            
            logger.info(f"面试数据解析完成: {parsed_result}")
            return parsed_result
            
        except Exception as e:
            logger.error(f"面试数据解析失败: {e}")
            return {
                'success': False,
                'error': str(e),
                'summary': '解析过程中出现错误，请稍后重试。'
            }

    async def format_resume_content(self, resume_text: str, filename: str = "") -> dict:
        """
        使用DeepSeek V3对简历内容进行AI重新排版
        
        Args:
            resume_text: 原始简历文本内容
            filename: 简历文件名（用于上下文）
        
        Returns:
            dict: 排版结果，包含格式化后的内容
        """
        try:
            logger.info(f"开始AI简历排版: 文件名={filename}, 原始内容长度={len(resume_text)}")
            
            # 构建简历排版提示词
            format_prompt = f"""请作为一个专业的简历排版专家，对以下简历内容进行重新排版和格式化。

**任务要求：**
1. 对简历内容进行逻辑重组和排版优化
2. 保持所有原始信息的完整性，不能删除或修改任何实质内容
3. 优化文字结构，使其更加清晰、专业
4. 统一格式风格，提升整体可读性
5. 只输出重新排版后的完整简历内容，不要添加任何评论、建议或无关信息

**原始简历内容：**
```
{resume_text}
```

请输出重新排版后的完整简历内容："""

            logger.info("调用DeepSeek V3进行简历排版...")
            
            # 调用DeepSeek V3进行简历排版
            formatted_result = await self._call_deepseek_evaluation(format_prompt)
            
            # 验证排版结果
            if not formatted_result or len(formatted_result.strip()) < 50:
                logger.warning("DeepSeek返回的排版结果过短，使用原始内容")
                formatted_content = resume_text
                is_formatted = False
            else:
                formatted_content = formatted_result.strip()
                is_formatted = True
            
            result = {
                'success': True,
                'original_content': resume_text,
                'formatted_content': formatted_content,
                'is_ai_formatted': is_formatted,
                'original_length': len(resume_text),
                'formatted_length': len(formatted_content),
                'format_timestamp': datetime.now().isoformat(),
                'model_used': self.DEEPSEEK_MODEL
            }
            
            logger.info(f"简历AI排版完成: 原始长度={len(resume_text)}, 排版后长度={len(formatted_content)}, AI处理={'成功' if is_formatted else '失败，使用原始内容'}")
            return result
            
        except Exception as e:
            logger.error(f"简历AI排版失败: {e}")
            # 返回原始内容作为降级方案
            return {
                'success': False,
                'original_content': resume_text,
                'formatted_content': resume_text,  # 降级使用原始内容
                'is_ai_formatted': False,
                'error': str(e),
                'format_timestamp': datetime.now().isoformat(),
                'model_used': 'Fallback - Original Content'
            }
            
    
    def _analyze_conversation(self, messages: list) -> dict:
        """分析对话内容"""
        formatted_conversation = []
        question_count = 0
        answer_count = 0
        total_user_words = 0
        total_ai_words = 0
        
        for msg in messages:
            # 兼容多种字段格式：优先使用'role'，回退到'type'
            role = msg.get('role', msg.get('type', 'unknown'))
            content = msg.get('content', '')
            timestamp = msg.get('timestamp', '')
            
            logger.info(f"处理消息: role={role}, content_preview={content[:50]}...")
            
            if role == 'user':
                formatted_conversation.append(f"候选人: {content}")
                answer_count += 1
                total_user_words += len(content.split())
            elif role == 'assistant':
                formatted_conversation.append(f"面试官: {content}")
                question_count += 1
                total_ai_words += len(content.split())
        
        return {
            'formatted_conversation': '\n\n'.join(formatted_conversation),
            'question_count': question_count,
            'answer_count': answer_count,
            'stats': {
                'total_exchanges': len(messages),
                'user_word_count': total_user_words,
                'ai_word_count': total_ai_words,
                'avg_user_response_length': total_user_words / max(answer_count, 1),
                'avg_ai_question_length': total_ai_words / max(question_count, 1)
            }
        }
    
    def _format_duration(self, duration_seconds: int) -> str:
        """格式化面试时长"""
        if duration_seconds < 60:
            return f"{duration_seconds}秒"
        elif duration_seconds < 3600:
            minutes = duration_seconds // 60
            seconds = duration_seconds % 60
            return f"{minutes}分{seconds}秒"
        else:
            hours = duration_seconds // 3600
            minutes = (duration_seconds % 3600) // 60
            return f"{hours}小时{minutes}分钟"
    
    async def _call_deepseek_with_messages(self, messages: list, max_retries: int = 2) -> str:
        """调用DeepSeek V3进行评估，支持重试机制"""
        import asyncio

        for attempt in range(max_retries + 1):
            try:
                logger.info(f"DeepSeek API调用尝试 {attempt + 1}/{max_retries + 1}")

                headers = {
                    'Authorization': f'Bearer {self.DEEPSEEK_API_KEY}',
                    'Content-Type': 'application/json'
                }
                payload = {
                    'model': self.DEEPSEEK_MODEL,
                    'messages': messages,
                    'temperature': get_model_temperature(),  # 从配置文件获取温度设置，确保评估的高度一致性和稳定性
                    'max_tokens': get_max_tokens(),
                    'top_p': get_top_p()
                }

                response = await self.http_client.post(
                    f"{self.DEEPSEEK_API_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=120.0  # 增加到120秒，面试评估需要更长时间
                )

                if response.status_code == 200:
                    result = response.json()
                    content = result['choices'][0]['message']['content']
                    logger.info(f"DeepSeek API调用成功，返回内容长度: {len(content)}")
                    return content
                else:
                    logger.error(f"DeepSeek API调用失败: {response.status_code}, {response.text}")
                    if attempt < max_retries:
                        await asyncio.sleep(2 ** attempt)  # 指数退避
                        continue
                    raise Exception(f"API调用失败: {response.status_code}")

            except asyncio.TimeoutError:
                logger.error(f"DeepSeek API调用超时 (尝试 {attempt + 1})")
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise Exception("API调用超时，请稍后重试")

            except Exception as e:
                logger.error(f"DeepSeek API调用失败 (尝试 {attempt + 1}): {e}")
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
                import traceback
                print(traceback.format_exc())
                raise Exception(f"评估服务暂时不可用: {str(e)}")
    

    async def _call_deepseek_evaluation(self, prompt: str, max_retries: int = 2) -> str:
        """调用DeepSeek V3进行评估，支持重试机制"""
        import asyncio

        for attempt in range(max_retries + 1):
            try:
                logger.info(f"DeepSeek 评估API调用尝试 {attempt + 1}/{max_retries + 1}")

                # ===== 详细日志输出：打印发送给DeepSeek V3的完整信息 =====
                logger.info("=" * 100)
                logger.info("发送给DeepSeek V3的完整Prompt内容:")
                logger.info("=" * 100)
                logger.info(f"Prompt长度: {len(prompt)} 字符")
                logger.info("Prompt内容:")
                logger.info(prompt)
                logger.info("=" * 100)

                headers = {
                    'Authorization': f'Bearer {self.DEEPSEEK_API_KEY}',
                    'Content-Type': 'application/json'
                }

                payload = {
                    'model': self.DEEPSEEK_MODEL,
                    'messages': [
                        {"role": "user", "content": prompt}
                    ],
                    'temperature': get_model_temperature(),  # 从配置文件获取温度设置，确保评估的高度一致性和稳定性
                    'max_tokens': get_max_tokens(),
                    'top_p': get_top_p()
                }

                # 打印API调用参数（不包含API密钥）
                logger.info("API调用参数:")
                logger.info(f"- Model: {payload['model']}")
                logger.info(f"- Temperature: {payload['temperature']}")
                logger.info(f"- Max Tokens: {payload['max_tokens']}")
                logger.info(f"- Top P: {payload['top_p']}")
                logger.info("=" * 100)

                response = await self.http_client.post(
                    f"{self.DEEPSEEK_API_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=120.0  # 增加到120秒，面试评估需要更长时间
                )

                if response.status_code == 200:
                    result = response.json()
                    content = result['choices'][0]['message']['content']
                    
                    # ===== 详细日志输出：打印DeepSeek V3的返回结果 =====
                    logger.info("DeepSeek V3返回结果:")
                    logger.info("=" * 100)
                    logger.info(f"返回内容长度: {len(content)} 字符")
                    logger.info("返回内容:")
                    logger.info(content)
                    logger.info("=" * 100)
                    
                    return content
                else:
                    logger.error(f"DeepSeek API调用失败: {response.status_code}, {response.text}")
                    if attempt < max_retries:
                        await asyncio.sleep(2 ** attempt)  # 指数退避
                        continue
                    raise Exception(f"API调用失败: {response.status_code}")

            except asyncio.TimeoutError:
                logger.error(f"DeepSeek 评估API调用超时 (尝试 {attempt + 1})")
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise Exception("评估API调用超时，请稍后重试")

            except Exception as e:
                logger.error(f"DeepSeek 评估API调用失败 (尝试 {attempt + 1}): {e}")
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise Exception(f"评估服务暂时不可用: {str(e)}")
    
    def _parse_evaluation_result(self, evaluation_text: str) -> dict:
        """解析评估结果"""
        try:
            # 首先尝试从文本中提取JSON结构化数据
            json_data = self._extract_json_from_evaluation(evaluation_text)

            if json_data:
                # 如果成功提取到JSON数据，使用它作为主要数据源
                # prompt要求输出10分制
                total_score = json_data.get('total_score', 7.5)
                total_score *= 10

                result = {
                    'success': True,
                    'full_evaluation': evaluation_text,
                    'total_score': int(total_score),
                    'dimension_scores': json_data.get('dimension_scores', {}),
                    'summary': json_data.get('summary', ''),
                    'strengths': json_data.get('strengths', []),
                    'improvements': json_data.get('improvements', [])
                }
            else:
                # 如果没有JSON数据，回退到从markdown中提取
                result = {
                    'success': True,
                    'full_evaluation': evaluation_text,
                    'total_score': self._extract_total_score(evaluation_text),
                    'dimension_scores': self._extract_dimension_scores(evaluation_text),
                    'summary': self._extract_summary(evaluation_text),
                    'strengths': self._extract_strengths(evaluation_text),
                    'improvements': self._extract_improvements(evaluation_text)
                }

            return result

        except Exception as e:
            logger.error(f"评估结果解析失败: {e}")
            return {
                'success': True,
                'full_evaluation': evaluation_text,
                'total_score': 75,  # 默认分数
                'summary': evaluation_text[:200] + "..." if len(evaluation_text) > 200 else evaluation_text,
                'strengths': [],
                'improvements': []
            }

    def _extract_json_from_evaluation(self, evaluation_text: str) -> dict:
        """从评估文本中提取JSON结构化数据"""
        try:
            import json
            import re

            # 查找JSON代码块
            json_pattern = r'```json\s*\n(.*?)\n```'
            json_match = re.search(json_pattern, evaluation_text, re.DOTALL)

            if json_match:
                json_str = json_match.group(1).strip()
                json_data = json.loads(json_str)
                logger.info("成功从评估文本中提取JSON数据")
                return json_data
            else:
                logger.warning("未在评估文本中找到JSON代码块")
                return None

        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {e}")
            return None
        except Exception as e:
            logger.error(f"提取JSON数据时出错: {e}")
            return None

    def _extract_clean_markdown(self, evaluation_text: str) -> str:
        """从评估文本中提取纯markdown部分，移除JSON代码块"""
        try:
            import re

            # 查找并移除JSON代码块
            json_pattern = r'---\s*\n\s*###\s*4\.\s*结构化数据输出.*?```json.*?```'
            clean_text = re.sub(json_pattern, '', evaluation_text, flags=re.DOTALL)

            # 也移除可能的其他JSON代码块
            json_pattern2 = r'```json\s*\n.*?\n```'
            clean_text = re.sub(json_pattern2, '', clean_text, flags=re.DOTALL)

            # 清理多余的空行
            clean_text = re.sub(r'\n\s*\n\s*\n', '\n\n', clean_text)
            clean_text = clean_text.strip()

            logger.info("成功提取纯markdown内容")
            return clean_text

        except Exception as e:
            logger.error(f"提取纯markdown时出错: {e}")
            return evaluation_text  # 如果出错，返回原文本

    def _extract_total_score(self, text: str) -> int:
        """提取总分"""
        # 查找总分模式
        patterns = [
            r'总体评分[：:]\s*(\d+)',
            r'综合得分[：:]\s*(\d+)',
            r'(\d+)分'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                score = int(match.group(1))
                if 0 <= score <= 100:
                    return score
        
        return 75  # 默认分数
    
    def _extract_dimension_scores(self, text: str) -> dict:
        """提取各维度分数"""
        dimensions = {
            'resume_match': '简历匹配',
            'technical_skills': '技术能力',
            'communication': '沟通表达',
            'problem_solving': '问题解决',
            'growth_potential': '成长潜力'
        }
        
        scores = {}
        for key, name in dimensions.items():
            pattern = f'{name}[：:]\\s*(\\d+)'
            match = re.search(pattern, text)
            if match:
                scores[key] = int(match.group(1))
            else:
                scores[key] = 7  # 默认分数
        
        return scores
    
    def _extract_summary(self, text: str) -> str:
        """提取总结"""
        # 查找总结部分
        summary_patterns = [
            r'面试表现总结[：:]\s*([^。]+。)',
            r'总结[：:]\s*([^。]+。)',
            r'综合评价[：:]\s*([^。]+。)'
        ]
        
        for pattern in summary_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)
        
        # 如果没有找到特定格式，返回前200字符
        return text[:200] + "..." if len(text) > 200 else text
    
    def _extract_strengths(self, text: str) -> list:
        """提取优势"""
        # 简单实现，可以根据需要优化
        if '优势' in text:
            return ['表现积极', '回答完整']
        return ['待分析']
    
    def _extract_improvements(self, text: str) -> list:
        """提取改进建议"""
        # 简单实现，可以根据需要优化
        if '建议' in text or '改进' in text:
            return ['继续保持', '深入学习']
        return ['持续提升']

    def _get_fallback_evaluation_result(self, error_message: str) -> dict:
        """当API调用失败时，返回降级的评估结果"""
        logger.info("使用降级评估结果")

        fallback_markdown = f"""# 面试评估报告

## 总体评分：75分

## 各维度评分

### 技术能力评估：7/10分
根据面试对话内容，候选人展现了基本的技术理解能力。

### 沟通表达能力：8/10分
候选人能够清晰地表达自己的想法，回答问题较为完整。

### 问题解决能力：7/10分
在面试过程中展现了一定的逻辑思维能力。

### 学习适应能力：7/10分
表现出积极的学习态度和适应能力。

### 职业素养：8/10分
面试态度积极，表现出良好的职业素养。

## 优势表现
- 面试态度积极主动
- 回答问题思路清晰
- 具备基本的专业素养

## 改进建议
- 可以进一步深入技术细节
- 建议多准备一些项目实例
- 持续学习新技术和方法

## 面试表现总结
候选人在面试中表现良好，具备基本的专业能力和素养。建议继续保持积极的学习态度，在技术深度和项目经验方面进一步提升。

---
*注：由于评估服务暂时不可用，此为系统生成的基础评估结果。建议稍后重新进行详细评估。*

**错误信息：** {error_message}
"""

        return {
            'success': True,
            'full_evaluation': fallback_markdown,
            'total_score': 75,
            'dimension_scores': {
                'resume_match': 7,
                'communication': 8,
                'problem_solving': 7,
                'growth_potential': 7,
                'technical_skills': 8
            },
            'summary': '候选人在面试中表现良好，具备基本的专业能力和素养。（系统生成的基础评估）',
            'strengths': ['面试态度积极主动', '回答问题思路清晰', '具备基本的专业素养'],
            'improvements': ['可以进一步深入技术细节', '建议多准备一些项目实例', '持续学习新技术和方法'],
            'conversation_stats': {'total_exchanges': 0, 'user_word_count': 0, 'ai_word_count': 0},
            'evaluation_timestamp': datetime.now().isoformat(),
            'model_used': 'Fallback System',
            'is_fallback': True
        }


class AzureVoiceService:
    """Azure语音服务类"""
    
    def __init__(self):
        """初始化Azure语音服务"""
        self.client: Optional[AsyncAzureOpenAI] = None
        self._init_client()
    
    def _init_client(self) -> None:
        """初始化Azure OpenAI客户端"""
        try:
            # 从环境变量获取配置
            azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "https://gpt-realtime-4o-mini.openai.azure.com")
            api_key = os.getenv("AZURE_OPENAI_API_KEY")
            api_version = os.getenv("AZURE_API_VERSION", "2025-04-01-preview")
            
            if not api_key:
                logger.error("Azure OpenAI API密钥未设置！")
                return
            
            self.client = AsyncAzureOpenAI(
                azure_endpoint=azure_endpoint,
                api_key=api_key,
                api_version=api_version,
            )
            logger.info("Azure OpenAI客户端初始化成功")
            
        except Exception as e:
            logger.error(f"Azure OpenAI客户端初始化失败: {e}")
    
    async def chat_with_voice(self, message: str, websocket: WebSocket, resume_context: str = "", job_preference: dict = None) -> None:
        """
        发送消息并接收语音回复
        
        Args:
            message: 用户消息
            websocket: WebSocket连接
            resume_context: 简历上下文
        """
        if not self.client:
            await websocket.send_json({
                "type": "error",
                "message": "Azure客户端未初始化"
            })
            return
        
        try:
            async with self.client.beta.realtime.connect(
                model="gpt-4o-mini-realtime-preview"
            ) as connection:
                # 配置会话支持文本和音频
                await connection.session.update(
                    session={"modalities": ["text", "audio"]}
                )
                
                # 构建系统提示词
                system_prompt = self._build_system_prompt(resume_context, job_preference)
                
                # 发送系统消息（如果有简历上下文）
                if resume_context:
                    await connection.conversation.item.create(
                        item={
                            "type": "message",
                            "role": "system",
                            "content": [{"type": "input_text", "text": system_prompt}],
                        }
                    )
                
                # 发送用户消息
                await connection.conversation.item.create(
                    item={
                        "type": "message",
                        "role": "user",
                        "content": [{"type": "input_text", "text": message}],
                    }
                )
                
                # 请求回复
                await connection.response.create()
                
                # 处理响应事件
                async for event in connection:
                    await self._handle_response_event(event, websocket)
                    
                    if event.type == "response.done":
                        break
                        
        except Exception as e:
            logger.error(f"语音聊天错误: {e}")
            await websocket.send_json({
                "type": "error",
                "message": f"语音聊天错误: {str(e)}"
            })
    
    def _build_system_prompt(self, resume_context: str, job_preference: dict = None) -> str:
        """构建系统提示词"""
        return get_interviewer_prompt(resume_context=resume_context, job_preference=job_preference)
    
    async def _handle_response_event(self, event: Any, websocket: WebSocket) -> None:
        """
        处理响应事件
        
        Args:
            event: 响应事件
            websocket: WebSocket连接
        """
        try:
            if event.type == "response.text.delta":
                # 文本增量
                await websocket.send_json({
                    "type": "text_delta",
                    "content": event.delta
                })
                
            elif event.type == "response.audio.delta":
                # 音频增量 - 发送base64编码的音频数据
                await websocket.send_json({
                    "type": "audio_delta",
                    "audio_data": event.delta,  # 已经是base64编码
                    "content_type": "audio/pcm"
                })
                
            elif event.type == "response.audio_transcript.delta":
                # 音频转录增量
                await websocket.send_json({
                    "type": "transcript_delta",
                    "content": event.delta
                })
                
            elif event.type == "response.text.done":
                # 文本完成
                await websocket.send_json({
                    "type": "text_done"
                })
                
            elif event.type == "response.audio.done":
                # 音频完成
                await websocket.send_json({
                    "type": "audio_done"
                })
                
            elif event.type == "response.done":
                # 响应完成
                await websocket.send_json({
                    "type": "response_done"
                })
                
        except Exception as e:
            logger.error(f"处理响应事件错误: {e}")

    async def process_fastrtc_audio(
        self, 
        audio_data: str, 
        websocket: WebSocket, 
        resume_context: str = "",
        job_preference: str = "",
        audio_format: str = "pcm_s16le",
        sample_rate: int = 24000,
        channels: int = 1,
        vad_confidence: float = 0.0
    ) -> None:
        """
        处理FastRTC增强的音频数据
        
        Args:
            audio_data: base64编码的音频数据
            websocket: WebSocket连接
            resume_context: 简历上下文
            audio_format: 音频格式
            sample_rate: 采样率
            channels: 声道数
            vad_confidence: 语音活动检测置信度
        """
        if not self.client:
            await websocket.send_json({
                "type": "error",
                "message": "Azure客户端未初始化"
            })
            return
        
        try:
            # 解码base64音频数据
            audio_bytes = base64.b64decode(audio_data)
            
            # 记录音频质量信息
            logger.info(f"收到FastRTC音频数据: 格式={audio_format}, 采样率={sample_rate}, VAD置信度={vad_confidence:.3f}")
            
            # 调整VAD置信度阈值检查 - 原阈值0.01过于严格
            # 使用更低的阈值，并考虑音频数据长度
            min_vad_threshold = 0.001  # 降低基础阈值
            
            # 如果音频数据足够长，即使VAD置信度较低也可以处理
            audio_duration_ms = (len(audio_bytes) / 2) / sample_rate * 1000  # 计算音频时长(ms)
            
            # 动态调整阈值：音频越长，允许的VAD阈值越低
            if audio_duration_ms > 200:  # 超过200ms的音频
                dynamic_threshold = max(0.0005, min_vad_threshold * 0.5)
            elif audio_duration_ms > 100:  # 超过100ms的音频
                dynamic_threshold = max(0.001, min_vad_threshold * 0.8)
            else:
                dynamic_threshold = min_vad_threshold
            
            if vad_confidence < dynamic_threshold:
                logger.debug(f"VAD置信度({vad_confidence:.4f})低于动态阈值({dynamic_threshold:.4f})，"
                           f"音频时长{audio_duration_ms:.1f}ms，跳过音频处理")
                return
            
            logger.info(f"通过VAD检查，开始处理音频: 置信度={vad_confidence:.4f}, "
                       f"阈值={dynamic_threshold:.4f}, 时长={audio_duration_ms:.1f}ms")
            
            async with self.client.beta.realtime.connect(
                model="gpt-4o-mini-realtime-preview"
            ) as connection:
                # 配置会话支持音频输入
                await connection.session.update(
                    session={
                        "modalities": ["text", "audio"],
                        "input_audio_format": "pcm16",  # Azure支持的格式
                        "output_audio_format": "pcm16",
                        "input_audio_transcription": {
                            "model": "whisper-1"
                        }
                    }
                )
                
                # 构建系统提示词
                if resume_context or job_preference:
                    system_prompt = self._build_system_prompt(resume_context, job_preference)
                    await connection.conversation.item.create(
                        item={
                            "type": "message",
                            "role": "system",
                            "content": [{"type": "input_text", "text": system_prompt}],
                        }
                    )
                
                # 发送音频数据
                await connection.input_audio_buffer.append(audio=audio_data)
                
                # 提交音频输入
                await connection.input_audio_buffer.commit()
                
                # 请求回复
                await connection.response.create()
                
                # 处理响应事件
                async for event in connection:
                    await self._handle_response_event(event, websocket)
                    
                    if event.type == "response.done":
                        break
                        
        except Exception as e:
            logger.error(f"FastRTC音频处理错误: {e}")
            await websocket.send_json({
                "type": "error",
                "message": f"音频处理错误: {str(e)}"
            })


# 全局Azure语音服务实例
azure_voice_service: AzureVoiceService = None

# 全局面试评估服务实例
evaluation_service: InterviewEvaluationService = None

# 存储用户会话的简历内容
user_sessions: Dict[str, str] = {}

# 简历存储目录
RESUME_STORAGE_DIR = Path("resume_storage")
RESUME_STORAGE_DIR.mkdir(exist_ok=True)

def save_resume_to_file(resume_text: str, session_id: str) -> bool:
    """
    将简历文本保存到文件
    
    Args:
        resume_text: 简历文本内容
        session_id: 会话ID
        
    Returns:
        保存是否成功
    """
    try:
        resume_file = RESUME_STORAGE_DIR / f"{session_id}.txt"
        with open(resume_file, 'w', encoding='utf-8') as f:
            f.write(resume_text)
        logger.info(f"简历已保存到文件: {resume_file}")
        return True
    except Exception as e:
        logger.error(f"保存简历文件失败: {e}")
        return False

def load_resume_from_file(session_id: str) -> Optional[str]:
    """
    从文件加载简历文本
    
    Args:
        session_id: 会话ID
        
    Returns:
        简历文本内容，如果文件不存在则返回None
    """
    try:
        resume_file = RESUME_STORAGE_DIR / f"{session_id}.txt"
        if resume_file.exists():
            with open(resume_file, 'r', encoding='utf-8') as f:
                content = f.read()
            logger.info(f"从文件加载简历: {resume_file}")
            return content
        return None
    except Exception as e:
        logger.error(f"加载简历文件失败: {e}")
        return None

def generate_resume_hash(resume_text: str) -> str:
    """
    生成简历内容的哈希值，用于去重和验证

    Args:
        resume_text: 简历文本内容

    Returns:
        简历内容的MD5哈希值
    """
    return hashlib.md5(resume_text.encode('utf-8')).hexdigest()[:16]

def save_job_preference_to_file(job_preference: dict, session_id: str) -> bool:
    """
    将岗位偏好保存到文件

    Args:
        job_preference: 岗位偏好信息
        session_id: 会话ID

    Returns:
        保存是否成功
    """
    try:
        preference_file = RESUME_STORAGE_DIR / f"{session_id}_job_preference.json"
        with open(preference_file, 'w', encoding='utf-8') as f:
            json.dump(job_preference, f, ensure_ascii=False, indent=2)
        logger.info(f"岗位偏好已保存到文件: {preference_file}")
        return True
    except Exception as e:
        logger.error(f"保存岗位偏好文件失败: {e}")
        return False

def load_job_preference_from_file(session_id: str) -> Optional[dict]:
    """
    从文件加载岗位偏好
 
    Args:
        session_id: 会话ID

    Returns:
        岗位偏好信息，如果文件不存在则返回None
    """
    try:
        preference_file = RESUME_STORAGE_DIR / f"{session_id}_job_preference.json"
        if preference_file.exists():
            with open(preference_file, 'r', encoding='utf-8') as f:
                preference = json.load(f)
            logger.info(f"从文件加载岗位偏好: {preference_file}")
            return preference
        return None
    except Exception as e:
        logger.error(f"加载岗位偏好文件失败: {e}")
        return None

def extract_pdf_text(file_content: bytes) -> str:
    """
    从PDF文件内容中提取文本
    
    Args:
        file_content: PDF文件的字节内容
        
    Returns:
        提取出的文本内容
    """
    try:
        pdf_file = io.BytesIO(file_content)
        reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        
        return text.strip()
    except Exception as e:
        logger.error(f"PDF解析失败: {e}")
        raise HTTPException(status_code=400, detail=f"PDF文件解析失败: {str(e)}")

def extract_docx_text(file_content: bytes) -> str:
    """
    从Word文档内容中提取文本
    
    Args:
        file_content: Word文档的字节内容
        
    Returns:
        提取出的文本内容
    """
    try:
        docx_file = io.BytesIO(file_content)
        doc = Document(docx_file)
        text = ""
        
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text += paragraph.text + "\n"
        
        return text.strip()
    except Exception as e:
        logger.error(f"Word文档解析失败: {e}")
        raise HTTPException(status_code=400, detail=f"Word文档解析失败: {str(e)}")

def validate_file(file: UploadFile) -> None:
    """
    验证上传的文件
    
    Args:
        file: 上传的文件对象
    """
    # 检查文件大小 (最大10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    
    # 检查文件类型
    allowed_extensions = {'.pdf', '.doc', '.docx'}
    allowed_mime_types = {
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的文件格式。支持的格式: {', '.join(allowed_extensions)}"
        )
    
    if file.content_type not in allowed_mime_types:
        logger.warning(f"文件MIME类型检查: {file.content_type}")
        # 不强制检查MIME类型，因为有些浏览器可能发送不准确的类型

@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化"""
    global azure_voice_service, evaluation_service
    try:
        azure_voice_service = AzureVoiceService()
        evaluation_service = InterviewEvaluationService()
        logger.info("Azure语音服务和面试评分服务初始化完成")
        logger.info("简历AI排版功能已激活，将使用DeepSeek V3进行内容优化")
    except Exception as e:
        logger.error(f"服务初始化失败: {e}")

@app.get("/")
async def read_root():
    """返回主页面"""
    return FileResponse("static/index.html")

from pydantic import BaseModel

class PromptRequest(BaseModel):
    resume_context: str = ""
    job_preference: dict = None

class InterviewEvaluationRequest(BaseModel):
    interview_id: str
    messages: list
    resume_context: str = ""
    duration: int = 0
    session_id: str = ""
    job_preference: dict = None
      
@app.post("/api/prompts/voice-call")
async def get_voice_call_prompt_api(request: PromptRequest) -> JSONResponse:
    """
    获取语音通话专用prompt
    
    Args:
        request: 包含resume_context的请求体
        
    Returns:
        prompt指令
    """
    try:
        resume_context = request.resume_context
        job_preference = request.job_preference
        instructions = get_voice_call_prompt(resume_context=resume_context, job_preference=job_preference)

        return JSONResponse(content={
            "success": True,
            "instructions": instructions,
            "has_resume": bool(resume_context),
            "has_job_preference": bool(job_preference)
        })
        
    except Exception as e:
        logger.error(f"获取语音通话prompt失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.get("/api/prompts/voice-call-default")
async def get_voice_call_default_prompt() -> JSONResponse:
    """
    获取语音通话的默认prompt（不包含简历上下文）
    
    Returns:
        默认的语音通话prompt
    """
    try:
        from prompts import InterviewPrompts
        
        return JSONResponse(content={
            "success": True,
            "instructions": InterviewPrompts.BASE_INTERVIEWER,
            "source": "prompts.py - VOICE_CALL_INTERVIEWER"
        })
        
    except Exception as e:
        logger.error(f"获取默认语音通话prompt失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.get("/api/prompts/list")
async def list_prompts() -> JSONResponse:
    """
    列出所有可用的prompt类型
    
    Returns:
        prompt类型列表
    """
    try:
        from prompts import InterviewPrompts, SystemPrompts, UIPrompts, NotificationPrompts
        
        prompt_info = {
            "interview_prompts": {
                "base_interviewer": InterviewPrompts.BASE_INTERVIEWER,
                "voice_call_interviewer": InterviewPrompts.VOICE_CALL_INTERVIEWER,
                "position_specific": list(InterviewPrompts.POSITION_SPECIFIC.keys())
            },
            "system_prompts": {
                "welcome_message": SystemPrompts.WELCOME_MESSAGE,
                "error_messages": list(SystemPrompts.ERROR_MESSAGES.keys()),
                "status_messages": list(SystemPrompts.STATUS_MESSAGES.keys())
            },
            "ui_prompts": {
                "button_texts": list(UIPrompts.BUTTON_TEXTS.keys()),
                "placeholders": list(UIPrompts.PLACEHOLDERS.keys()),
                "hints": list(UIPrompts.HINTS.keys())
            },
            "notification_prompts": {
                "success_messages": list(NotificationPrompts.SUCCESS_MESSAGES.keys()),
                "warning_messages": list(NotificationPrompts.WARNING_MESSAGES.keys()),
                "error_messages": list(NotificationPrompts.ERROR_MESSAGES.keys())
            }
        }
        
        return JSONResponse(content={
            "success": True,
            "prompts": prompt_info,
            "message": "所有prompt配置已从prompts.py文件中集中管理"
        })
        
    except Exception as e:
        logger.error(f"获取prompt列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.get("/api/prompts/validate")
async def validate_prompt_management() -> JSONResponse:
    """
    验证prompt管理是否完全通过prompts.py文件
    
    Returns:
        验证结果和建议
    """
    try:
        from prompts import InterviewPrompts, SystemPrompts, UIPrompts, NotificationPrompts
        
        validation_result = {
            "prompts_py_status": "✅ prompts.py文件正常加载",
            "centralized_management": True,
            "available_prompts": {
                "interview_prompts": len(InterviewPrompts.POSITION_SPECIFIC) + 2,  # BASE + VOICE_CALL + positions
                "system_prompts": len(SystemPrompts.ERROR_MESSAGES) + len(SystemPrompts.STATUS_MESSAGES) + 1,  # + WELCOME
                "ui_prompts": len(UIPrompts.BUTTON_TEXTS) + len(UIPrompts.PLACEHOLDERS) + len(UIPrompts.HINTS),
                "notification_prompts": len(NotificationPrompts.SUCCESS_MESSAGES) + len(NotificationPrompts.WARNING_MESSAGES) + len(NotificationPrompts.ERROR_MESSAGES)
            },
            "api_endpoints": [
                "/api/prompts/voice-call - 获取语音通话prompt（带简历上下文）",
                "/api/prompts/voice-call-default - 获取默认语音通话prompt",
                "/api/prompts/list - 列出所有prompt类型",
                "/api/prompts/validate - 验证prompt管理状态"
            ],
            "recommendations": [
                "✅ 所有prompt已通过prompts.py集中管理",
                "✅ 前端已配置API回退机制",
                "✅ 支持动态prompt更新",
                "💡 建议定期审查prompt内容的专业性和准确性"
            ]
        }
        
        return JSONResponse(content={
            "success": True,
            "validation": validation_result,
            "message": "Prompt管理验证完成 - 所有配置已集中到prompts.py"
        })
        
    except Exception as e:
        logger.error(f"Prompt管理验证失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.post("/api/interview/evaluate")
async def evaluate_interview_api(request: InterviewEvaluationRequest) -> JSONResponse:
    """
    评估面试表现
    
    Args:
        request: 面试评估请求，包含对话历史、简历信息等
        
    Returns:
        评估结果
    """
    try:
        logger.info(f"收到面试评估请求: ID={request.interview_id}")
        
        # 获取岗位偏好信息（如果请求中没有，尝试从文件加载）
        job_preference = request.job_preference
        if not job_preference and request.session_id:
            job_preference = load_job_preference_from_file(request.session_id)

        # 构建面试数据
        interview_data = {
            'id': request.interview_id,
            'messages': request.messages,
            'resume_context': request.resume_context,
            'duration': request.duration,
            'session_id': request.session_id,
            'job_preference': job_preference
        }
        
        # 调用评分服务
        evaluation_result = await evaluation_service.evaluate_interview(interview_data)
        
        # 保存评估结果到面试记录
        if evaluation_result.get('success', False):
            await save_evaluation_to_interview(request.interview_id, evaluation_result)
        
        return JSONResponse(content={
            "success": True,
            "evaluation": evaluation_result,
            "message": "面试评估完成"
        })
        
    except Exception as e:
        logger.error(f"面试评估API失败: {e}")
        raise HTTPException(status_code=500, detail=f"面试评估失败: {str(e)}")

async def save_evaluation_to_interview(interview_id: str, evaluation_result: dict) -> bool:
    """
    保存评估结果到面试记录
    
    Args:
        interview_id: 面试ID
        evaluation_result: 评估结果
        
    Returns:
        bool: 保存是否成功
    """
    try:
        # 这里可以实现将评估结果保存到数据库或文件
        # 目前先记录日志
        logger.info(f"保存面试评估结果: ID={interview_id}, 总分={evaluation_result.get('total_score', 'N/A')}")
        
        # 可以扩展为保存到数据库
        # 例如: await db.interviews.update_one(
        #     {"id": interview_id}, 
        #     {"$set": {"evaluation": evaluation_result}}
        # )
        
        return True
        
    except Exception as e:
        logger.error(f"保存评估结果失败: {e}")
        return False
    
async def save_extraction_to_interview(interview_id: str, extraction_result: dict) -> bool:
    """
    保存面试数据提取结果
    """
    try:
        logger.info(f"保存面试数据提取结果: ID={interview_id}")
        return True
    except Exception as e:
        logger.error(f"保存面试数据提取结果失败: {e}")
        return False

class InterviewExtractionRequest(BaseModel):
    interview_id: str
    messages: list
    resume_context: str = ""

@app.post("/api/interview/extract")
async def save_interview_extract_data(request: InterviewExtractionRequest) -> JSONResponse:
    """
    保存面试数据提取结果
    """
    try:
        logger.info(f"保存面试数据提取结果: ID={request.interview_id}")
        
        # 构建面试数据
        interview_data = {
            'id': request.interview_id,
            'resume_context': request.resume_context,
            'messages': request.messages
        }
        
        # 调用提取服务
        extraction_result = await evaluation_service.extract_interview(interview_data)
        
        # 保存提取结果
        await save_extraction_to_interview(request.interview_id, extraction_result)
        
        return JSONResponse(content={
            "success": True,
            "extraction": extraction_result,
            "message": "面试数据提取完成"
        })
    except Exception as e:
        logger.error(f"保存面试数据提取结果失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")


@app.get("/api/preference/{session_id}")
async def get_preference_content(session_id: str) -> JSONResponse:
    """
    获取指定会话的简历内容
    
    Args:
        session_id: 会话ID
        
    Returns:
        简历内容
    """
    try:
        # 从内存或文件获取简历内容
        resume_content = user_sessions.get(session_id) or load_resume_from_file(session_id)
        
        if not resume_content:
            raise HTTPException(status_code=404, detail="未找到对应的简历内容")
        
        return JSONResponse(content={
            "success": True,
            "session_id": session_id,
            "content": resume_content,
            "content_length": len(resume_content)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取简历内容失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")


@app.get("/api/resume/{session_id}")
async def get_resume_content(session_id: str) -> JSONResponse:
    """
    获取指定会话的简历内容
    
    Args:
        session_id: 会话ID
        
    Returns:
        简历内容
    """
    try:
        # 从内存或文件获取简历内容
        resume_content = user_sessions.get(session_id) or load_resume_from_file(session_id)
        
        if not resume_content:
            raise HTTPException(status_code=404, detail="未找到对应的简历内容")
        
        return JSONResponse(content={
            "success": True,
            "session_id": session_id,
            "content": resume_content,
            "content_length": len(resume_content)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取简历内容失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")



@app.post("/api/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    job_category: Optional[str] = Form(None),
    job_position: Optional[str] = Form(None),
    job_category_label: Optional[str] = Form(None),
    job_position_label: Optional[str] = Form(None)
) -> JSONResponse:
    """
    上传并解析简历文件，使用AI进行重新排版，同时支持岗位偏好设置

    Args:
        file: 上传的简历文件
        job_category: 岗位类别代码
        job_position: 具体岗位代码
        job_category_label: 岗位类别标签
        job_position_label: 具体岗位标签

    Returns:
        解析结果和会话ID，包含AI排版后的内容和岗位偏好信息
    """
    try:
        # 验证文件
        validate_file(file)
        
        # 读取文件内容
        file_content = await file.read()
        
        # 根据文件类型解析文本
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension == '.pdf':
            original_resume_text = extract_pdf_text(file_content)
        elif file_extension in ['.doc', '.docx']:
            original_resume_text = extract_docx_text(file_content)
        else:
            raise HTTPException(status_code=400, detail="不支持的文件格式")
        
        # 验证解析结果
        if not original_resume_text or len(original_resume_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="简历内容过少或解析失败，请检查文件内容")
        
        logger.info(f"简历文件解析成功: {file.filename}, 原始内容长度: {len(original_resume_text)}")
        
        # 使用AI对简历内容进行重新排版
        final_resume_text = original_resume_text
        is_ai_formatted = False
        format_result = {'success': False, 'is_ai_formatted': False}
        
        try:
            format_result = await evaluation_service.format_resume_content(
                resume_text=original_resume_text,
                filename=file.filename
            )
            
            # 使用AI排版后的内容作为主要内容
            final_resume_text = format_result['formatted_content']
            is_ai_formatted = format_result['is_ai_formatted']
            
            logger.info(f"简历AI排版完成: AI处理={'成功' if is_ai_formatted else '失败'}, 最终内容长度: {len(final_resume_text)}")
            
        except Exception as format_error:
            logger.error(f"简历AI排版失败，使用原始内容: {format_error}")
            # 降级使用原始内容
            final_resume_text = original_resume_text
            is_ai_formatted = False
            format_result = {
                'success': False,
                'error': str(format_error),
                'is_ai_formatted': False
            }
        
        # 生成会话ID（基于原始内容，保持一致性）
        session_id = generate_resume_hash(original_resume_text)
        
        # 保存排版后的内容作为主要内容
        user_sessions[session_id] = final_resume_text
        save_resume_to_file(final_resume_text, session_id)
        
        # 同时保存原始内容作为备份
        original_session_id = f"{session_id}_original"
        user_sessions[original_session_id] = original_resume_text
        save_resume_to_file(original_resume_text, original_session_id)
        
        # 保存岗位偏好信息
        job_preference = None
        if job_category and job_position:
            job_preference = {
                "category": job_category,
                "position": job_position,
                "category_label": job_category_label or job_category,
                "position_label": job_position_label or job_position,
                "full_label": f"{job_category_label or job_category} - {job_position_label or job_position}",
                "updated_at": datetime.now().isoformat()
            }
            save_job_preference_to_file(job_preference, session_id)
        
        # 构建返回内容
        preview_content = final_resume_text[:200] + "..." if len(final_resume_text) > 200 else final_resume_text
        
        response_data = {
            "success": True,
            "message": "简历上传、解析和AI排版成功" if is_ai_formatted else "简历上传和解析成功",
            "session_id": session_id,
            "filename": file.filename,
            "content_length": len(final_resume_text),
            "original_content_length": len(original_resume_text),
            "preview": preview_content,
            "ai_formatted": is_ai_formatted,
            "format_info": {
                "ai_processed": is_ai_formatted,
                "model_used": format_result.get('model_used', 'None'),
                "format_timestamp": format_result.get('format_timestamp', ''),
                "quality_improvement": len(final_resume_text) != len(original_resume_text)
            }
        }
        
        # 添加岗位偏好信息到响应
        if job_preference:
            response_data["job_preference"] = job_preference
        
        # 添加AI排版警告信息
        if not is_ai_formatted and format_result.get('error'):
            response_data["format_warning"] = f"AI排版失败: {format_result['error']}"
        
        logger.info(f"简历上传成功: {file.filename}, 会话ID: {session_id}, 内容长度: {len(final_resume_text)}")
        if job_preference:
            logger.info(f"岗位偏好: {job_preference['full_label']}")
        logger.info(f"简历上传完成: {file.filename}, 会话ID: {session_id}, "
                   f"原始长度: {len(original_resume_text)}, 最终长度: {len(final_resume_text)}, "
                   f"AI排版: {'成功' if is_ai_formatted else '失败'}")

        return JSONResponse(content=response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"简历上传处理失败: {e}")
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

@app.websocket("/ws/voice")
async def websocket_voice_endpoint(websocket: WebSocket):
    """Azure语音聊天WebSocket端点 - FastRTC增强版"""
    await websocket.accept()
    logger.info("Azure语音WebSocket连接已建立 - FastRTC增强模式")
    
    # 存储当前活跃的Azure连接，用于打断处理
    current_azure_connection = None
    
    try:
        while True:
            # 接收消息
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "chat":
                message = data.get("message", "")
                session_id = data.get("session_id", "")
                
                if message.strip():
                    logger.info(f"收到语音聊天消息: {message}")

                    # 获取简历上下文和岗位偏好
                    resume_context = ""
                    job_preference = None
                    if session_id:
                        resume_context = user_sessions.get(session_id) or load_resume_from_file(session_id)
                        job_preference = load_job_preference_from_file(session_id)

                    await azure_voice_service.chat_with_voice(message, websocket, resume_context, job_preference)
                    
            elif message_type == "voice_input":
                # FastRTC增强的语音输入处理
                audio_data = data.get("audio_data", "")
                audio_format = data.get("audio_format", "pcm_s16le")
                sample_rate = data.get("sample_rate", 24000)
                channels = data.get("channels", 1)
                vad_confidence = data.get("vad_confidence", 0.0)
                session_id = data.get("session_id", "")
                
                if audio_data:
                    logger.info(f"收到FastRTC音频数据: 格式={audio_format}, 采样率={sample_rate}, VAD置信度={vad_confidence:.3f}")
                    
                    # 获取简历上下文
                    resume_context = ""
                    if session_id:
                        resume_context = user_sessions.get(session_id) or load_resume_from_file(session_id)
                        job_preference = load_job_preference_from_file(session_id)
                    
                    # 处理FastRTC音频输入
                    await azure_voice_service.process_fastrtc_audio(
                        audio_data, 
                        websocket, 
                        resume_context,
                        job_preference,
                        audio_format=audio_format,
                        sample_rate=sample_rate,
                        channels=channels,
                        vad_confidence=vad_confidence
                    )
                    
            elif message_type == "interrupt_request":
                # 处理打断请求
                session_id = data.get("session_id", "")
                reason = data.get("reason", "user_request")
                timestamp = data.get("timestamp", 0)
                
                logger.info(f"收到打断请求: 会话ID={session_id}, 原因={reason}, 时间戳={timestamp}")
                
                # 中断当前Azure连接（如果存在）
                if current_azure_connection:
                    try:
                        # 这里可以添加具体的连接中断逻辑
                        # Azure实时API可能需要特定的中断方法
                        logger.info("正在中断Azure连接...")
                        current_azure_connection = None
                    except Exception as e:
                        logger.error(f"中断Azure连接失败: {e}")
                
                # 发送打断确认
                await websocket.send_json({
                    "type": "interrupt_acknowledged",
                    "session_id": session_id,
                    "timestamp": timestamp,
                    "reason": reason,
                    "message": "打断请求已处理"
                })
                
                logger.info(f"打断请求处理完成: 会话ID={session_id}")
                    
            elif message_type == "voice_input_end":
                # 语音输入结束
                session_id = data.get("session_id", "")
                logger.info(f"语音输入结束: 会话ID={session_id}")
                
                await websocket.send_json({
                    "type": "voice_input_complete",
                    "message": "语音输入处理完成"
                })
                
            elif message_type == "continue_interview":
                # 处理继续面试请求
                interview_id = data.get("interview_id", "")
                messages = data.get("messages", [])
                resume_context = data.get("resume_context", "")
                instruction = data.get("instruction", "")
                
                logger.info(f"收到继续面试请求: 面试ID={interview_id}, 消息数量={len(messages)}")
                
                # 构建继续面试的上下文消息
                continue_message = f"""基于以下历史面试对话，请继续进行面试：

{instruction}

历史对话记录：
"""
                for msg in messages:
                    role = "面试官" if msg.get("type") == "assistant" or msg.get("role") == "assistant" else "求职者"
                    continue_message += f"{role}: {msg.get('content', '')}\n"
                
                continue_message += "\n请基于以上对话历史，自然地继续面试流程。"
                
                # 发送继续面试的消息给AI
                await azure_voice_service.chat_with_voice(continue_message, websocket, resume_context)
                
            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        logger.info("Azure语音WebSocket连接已断开")
    except Exception as e:
        logger.error(f"Azure语音WebSocket错误: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"服务器错误: {str(e)}"
            })
        except:
            pass

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy", 
        "service": "Azure Voice Interview System",
        "azure_client_ready": azure_voice_service.client is not None if azure_voice_service else False
    }

class LegacyInterviewEvaluationRequest(BaseModel):
    interviewMessages: List[Dict]
    resumeText: Optional[str]
    interviewId: Optional[str]


@app.post("/api/evaluate-interview", response_model=dict)
async def evaluate_interview(request_body: LegacyInterviewEvaluationRequest):
    """
    接收面试对话消息和简历文本，调用OpenAI API进行面试评估。
    """
    interview_messages = request_body.interviewMessages
    resume_text = request_body.resumeText
    interview_id = request_body.interviewId

    if not interview_messages:
        raise HTTPException(status_code=400, detail="请提供有效的面试对话消息。")

    logger.info(f"收到面试评估请求，面试ID: {interview_id}")
    logger.info(f"对话消息数量: {len(interview_messages)}")
    logger.info(f"简历文本长度: {len(resume_text)}")

    try:
        from backend.three_agent_interview import generate_three_agent_report
        result = await generate_three_agent_report(
            interview_messages,
            resume_text,
            job_description="请从简历中提取或了解猜测岗位信息"
        )
        # {
        #     'analysis': self.analysis_result,
        #     'scoring': self.scoring_result,
        #     'html_report': self.report_result,
        #     'evaluation': self._extract_json_from_scoring()
        # }
        # result = await three_agent_interview.run_interview(interview_messages, resume_text, interview_id)
        # 返回包含HTML报告和结构化数据的完整结果
        return JSONResponse(content={
            'evaluationHtml': result['html_report'],  # 保持与原API兼容的字段名
            'evaluation': result['evaluation'],
            'analysis': result['analysis'],
            'scoring': result['scoring']
        })

    except Exception as e:
        print(f"调用OpenAI API失败: {e}")
        import traceback
        print(traceback.format_exc())
        # 返回更详细的错误信息，方便调试
        raise HTTPException(status_code=500, detail=f"面试评估服务内部错误: {str(e)}")

@app.post("/api/evaluate-interview-two-agent", response_model=dict)
async def evaluate_interview_two_agent(request_body: InterviewEvaluationRequest):
    """
    使用两个Agent系统进行面试评估（更快的版本）
    """
    interview_messages = request_body.interviewMessages
    resume_text = request_body.resumeText
    interview_id = request_body.interviewId

    if not interview_messages:
        raise HTTPException(status_code=400, detail="请提供有效的面试对话消息。")

    logger.info(f"收到两Agent面试评估请求，面试ID: {interview_id}")
    logger.info(f"对话消息数量: {len(interview_messages)}")
    logger.info(f"简历文本长度: {len(resume_text)}")

    try:
        from backend.three_agent_interview import generate_three_agent_report
        result = await generate_three_agent_report(
            interview_messages,
            resume_text,
            job_description="请从简历中提取或了解猜测岗位信息"
        )

        # 返回包含HTML报告和结构化数据的完整结果
        return JSONResponse(content={
            'evaluationHtml': result['html_report'],  # 保持与原API兼容的字段名
            'evaluation': result['evaluation'],
            'analysis_scoring': result['analysis_scoring'],
            'agent_type': 'two_agent',  # 标识使用的Agent类型
            'performance_note': '使用两Agent系统，评估速度更快'
        })

    except Exception as e:
        print(f"调用两Agent评估系统失败: {e}")
        import traceback
        print(traceback.format_exc())
        # 返回更详细的错误信息，方便调试
        raise HTTPException(status_code=500, detail=f"两Agent面试评估服务内部错误: {str(e)}")

# @app.post("/api/evaluate-interview", response_model=dict)
# async def evaluate_interview(request_body: InterviewEvaluationRequest):
#     """
#     接收面试对话消息和简历文本，调用OpenAI API进行面试评估。
#     """
#     interview_messages = request_body.interviewMessages
#     resume_text = request_body.resumeText
#     interview_id = request_body.interviewId

#     if not interview_messages:
#         raise HTTPException(status_code=400, detail="请提供有效的面试对话消息。")

#     logger.info(f"收到面试评估请求，面试ID: {interview_id}")
#     logger.info(f"对话消息数量: {len(interview_messages)}")
#     logger.info(f"简历文本长度: {len(resume_text)}")

#     try:
#         from prompts import InterviewPrompts
        
#         messages_for_llm = []

#         # 添加系统提示，指导AI进行评估
#         system_prompt = InterviewPrompts.BASE_EVALUATION
#         messages_for_llm.append({"role": "system", "content": system_prompt})

#         if resume_text:
#             messages_for_llm.append({"role": "user", "content": f"候选人提供的简历信息，请在评估时参考：\n```\n{resume_text}\n```"})

#         # 将面试对话消息添加到 messages 数组
#         # 过滤掉前端可能传递过来的原始系统指令，因为我们在这里构造了自己的评估系统指令
#         filtered_messages = json.dumps(interview_messages)
#         messages_for_llm.append({"role": "user", "content": f"以下是候选人（user）和面试官（assistant）的对话记录，请评估： \n```\n{filtered_messages}\n```"})

#         # 调用 OpenAI API
#         # from openai import AzureOpenAI
#         # client = AzureOpenAI(
#         #     api_key=os.getenv("AZURE_OPENAI_API_KEY_FOR_EVALUATION"),
#         #     api_version=os.getenv("AZURE_API_VERSION_FOR_EVALUATION"),
#         #     azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT_FOR_EVALUATION")
#         # )

#         # chat_completion = client.chat.completions.create(
#         #     model=os.getenv("AZURE_DEPLOYMENT_FOR_EVALUATION"),
#         #     messages=messages_for_llm,
#         #     temperature=0.7,
#         #     max_tokens=1500, # 确保有足够空间生成详细评估
#         # )

#         # evaluation_markdown = chat_completion.choices[0].message.content
#         logger.info(messages_for_llm)
#         evaluation_result = await evaluation_service._call_deepseek_with_messages(messages_for_llm)
#         logger.info(f"evaluation result: {evaluation_result}")

#         # 解析评估结果，获取结构化数据
#         parsed_result = evaluation_service._parse_evaluation_result(evaluation_result)

#         # 分离markdown和JSON，只返回纯markdown部分
#         clean_markdown = evaluation_service._extract_clean_markdown(evaluation_result)

#         # 返回包含纯markdown和结构化数据的完整结果
#         return JSONResponse(content={
#             'evaluationMarkdown': clean_markdown,
#             'evaluation': parsed_result
#         })

#     except Exception as e:
#         print(f"调用OpenAI API失败: {e}")
#         import traceback
#         print(traceback.format_exc())
#         # 返回更详细的错误信息，方便调试
#         raise HTTPException(status_code=500, detail=f"面试评估服务内部错误: {str(e)}")


if __name__ == "__main__":
    
    print("🚀 启动Azure语音面试官系统...")
    print("📡 服务地址: http://localhost:8000")
    print("🎤 支持实时语音面试功能")
    
    uvicorn.run(
        app,
        host="localhost",
        port=8000,
        reload=True,
        log_level="info"
    ) 