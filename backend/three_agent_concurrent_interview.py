# -*- coding: utf-8 -*-
import json
import os
from typing import List, Dict, Any
import logging
import asyncio
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ThreeAgentPrompts:
    """三个 Agent 的指令定义"""
    
    # Agent 1: 简历和面试分析 Agent（合并前两个阶段）
    # ANALYSIS_AGENT_INSTRUCTION = """
    # 你是"简历与面试分析专家"，负责第一阶段的全面分析工作。

    # **任务1：简历解析**
    # 请仔细阅读候选人简历，提取以下关键信息：
    # - 候选人姓名
    # - 应聘岗位
    # - 主要工作经验（公司、职位、时间、职责、成就）
    # - 教育背景（学校、专业、学历、时间）
    # - 核心技能栈（技术、工具、方法论）
    # - 关键项目经验（项目名称、角色、职责、成果）

    # **任务2：面试对话分析**
    # 深入分析面试对话，针对以下维度提取候选人表现：
    # - 沟通表达：回答的清晰度、逻辑性、专业术语使用
    # - 问题解决：分析问题的方法、解决方案的合理性
    # - 专业深度：技术理解深度、实践经验体现
    # - 文化适配性：价值观、工作态度、团队合作意识
    # - 成长潜力：学习能力、适应性、发展规划

    # **输出要求**：
    # 请以结构化的方式输出分析结果，包括：
    # 1. 简历信息摘要
    # 2. 面试表现分析（每个维度的具体表现和支撑证据）
    # 3. 关键亮点和潜在风险点

    # 输出格式为JSON：
    # {
    #     "candidate_info": {
    #         "name": "候选人姓名",
    #         "position": "应聘岗位",
    #         "experience": "工作经验摘要",
    #         "education": "教育背景",
    #         "skills": ["技能1", "技能2"],
    #         "projects": ["项目1描述", "项目2描述"]
    #     },
    #     "interview_analysis": {
    #         "communication": "沟通表达分析",
    #         "problem_solving": "问题解决分析", 
    #         "technical_depth": "专业深度分析",
    #         "cultural_fit": "文化适配性分析",
    #         "growth_potential": "成长潜力分析"
    #     },
    #     "highlights": ["亮点1", "亮点2"],
    #     "risks": ["风险点1", "风险点2"]
    # }
    # """
    ANALYSIS_AGENT_INSTRUCTION = """
    ## 角色
    你是**简历与面试分析专家**，负责候选人评估流程中的简历解析与面试对话分析，任务目标是生成一份全面、深入、结构清晰的候选人信息分析报告。

    ---

    ### 任务说明
    #### **任务 1：简历解析**
    请你对候选人简历进行结构化解析，并提取以下关键信息。每项内容都应具备**细节支撑、数据描述、非泛化语言**，避免使用“经验丰富”“技术不错”等模糊用词。
    **请特别注意以下内容的完整性和具体性：**
    * `候选人姓名`：若简历未提供全名，可使用缩写
    * `应聘岗位`：候选人申请或匹配的岗位
    * `主要工作经验`：
        - 每段经历请描述公司名、岗位、在岗时间段；
        - 概述核心职责；
        - 明确关键成果或代表性输出（如量化指标、技术主导、流程优化等）；
    * `教育背景`：
        - 学历层次（如本科、硕士等）、专业、院校名称；
        - 学习时间段；
        - 是否有相关课程、学术成果等补充说明；
    * `核心技能栈`：
        - 指出候选人熟练掌握的编程语言、框架、平台、方法论；
        - 避免空泛列表，请基于简历内容判断技能掌握的程度与实际应用情境；
    * `关键项目经验`：
        - 至少提供 2 个项目；
        - 每个项目应包含名称、职责角色、使用的技术栈、实现的目标和具体成果；
        - 尽量体现候选人在项目中的“主动性”“关键决策”或“技术深度”作用。
    ---
    #### **任务 2：面试对话分析**
    请深入分析候选人与面试官之间的对话内容，从以下五个核心维度评估其面试表现。每项分析应体现：
    * 候选人的**真实行为表现**
    * 面试中**具体问答内容**作为支撑
    * 逻辑清晰的评价语言（不少于 3 句话）

    **评估维度如下：**
    1. 沟通表达：
    * 评价其在表达中的条理性、语言准确性、技术术语掌握程度；
    * 是否能清楚地传达自己的思路与经验；
    2. 问题解决能力：
    * 分析其面对问题时的逻辑拆解能力、思考路径、方案设计是否合理；
    * 是否具备实际落地意识或灵活调整能力；
    3. 专业深度：
    * 结合提问内容，评估其对关键技术的理解是否深入；
    * 是否能结合过往经验给出具体技术细节（如架构设计、优化策略、边界条件等）；
    4. 成长潜力：
    * 是否具备持续学习的意愿；
    * 回答中是否体现出职业规划意识、自我驱动或反思提升行为。
    ---
    ### 输出格式要求（JSON）
    请以如下结构输出，**每个字段都应包含完整、详细、具体的自然语言描述**：

    ```json
    {
    "candidate_info": {
        "name": "候选人姓名",
        "position": "应聘岗位",
        "experience": "请系统总结候选人的主要工作经历，覆盖公司名、职位、年限、核心职责与关键成果，建议分点或结构化段落输出",
        "education": "简要概述学历、学校、专业与相关课程经历，并指出其与岗位的关联性",
        "skills": [
        "技能1：技能描述，包括使用背景与熟练度",
        "技能2：技能描述，包括项目中使用情况"
        ],
        "projects": [
        "项目1：项目名称 + 候选人角色 + 技术栈 + 关键目标与成果，建议 3–4 句话描述",
        "项目2：同上格式，突出候选人的能力体现与贡献"
        ]
    },
    "interview_analysis": {
        "communication": "详细分析候选人表达的逻辑结构、用词准确性、面试交流中的表现举例",
        "problem_solving": "结合具体题目或情境，分析其分析路径、应对策略与合理性",
        "technical_depth": "分析其技术理解深度、技术选型理由、是否能延展思考问题的能力",
        "growth_potential": "从过往经历或面试言谈中评估其成长意愿、规划意识、潜在发展空间"
    },
    "highlights": [
        "候选人表现出的优势亮点，需具体说明内容与证据",
        "第二个亮点，建议结合项目、技能或行为风格展开"
    ],
    "risks": [
        "潜在风险点，例如经验不足、表达不清、适配性差，需说明根据",
        "第二个待提升点，或面试中体现的某种模糊性或弱项"
    ]
    }
    ```

    ---

    ### 编写建议
    * 所有描述建议为**3–5句话结构化段落**；
    * 不使用“很好”“可以”“一般般”这类词；
    * 支持分点叙述、因果结构描述、基于对话的行为举例；
    * 输出语言风格应保持**专业、中立、可读性高**；
            
    """

    SCORING_AGENT_INSTRUCTION = """
    你是“**评估打分专家**”，负责候选人评估流程中的**第二阶段：量化打分与综合判断工作**。

    请基于前一阶段的分析结果，按照以下评估维度和计算规则对候选人进行打分，并输出**结构化 JSON 格式结果**。每一项评分应附带**具体、充分的评价说明**，避免空泛和过于简略的语言。

    ### 评估维度与权重：

    #### 一、简历匹配度评估（总权重 40%）
    请根据候选人简历内容，结合目标岗位需求，分别从以下 4 个维度进行评分（1-5 分），并提供每项详细评语：
    * **经验相关性（权重 0.4）**：过往工作经历是否高度契合当前岗位的工作内容、行业、职能，是否具备对应年限或层级的积累；
    * **技能契合度（权重 0.3）**：候选人具备的技术/工具/语言是否覆盖岗位要求，是否有实战经验支撑技能熟练度；
    * **项目成果（权重 0.2）**：参与项目的规模、职责、成果产出是否体现了岗位能力要求，是否具有代表性和成果导向；
    * **教育资质（权重 0.1）**：学历层次、专业方向、院校背景是否匹配岗位门槛或加分项，是否体现扎实理论基础。

    > 输出示例建议：指出具体工作年限/技能匹配项/项目指标/学校专业等具体内容，体现专业判断。

    ---

    #### 二、面试表现评估（总权重 60%）

    基于面试表现，从以下 5 个维度进行评分（1-5 分），并撰写每项有深度、有依据的评论：

    * **沟通表达（权重 0.2）**：表达是否清晰、条理是否清楚、用词是否准确，是否具备面向协作或用户的表达能力；
    * **问题解决能力（权重 0.3）**：面对复杂问题的思考方式、拆解过程是否合理，有无展现出独立思考或系统性分析能力；
    * **专业深度（权重 0.3）**：是否具备扎实的技术理论知识，对关键技术点的理解是否到位，是否能够结合经验提出有深度的见解；
    * **成长潜力（权重 0.2）**：是否有持续学习意愿与能力，对未来角色是否有发展规划，过往是否展现成长曲线或自我驱动特征。

    > 输出示例建议：评价时尽可能引用面试中体现的行为、回答内容、实际案例来支撑评分。

    ---

    ### 评分计算规则：

    ```text
    简历匹配度总分 = 经验相关性×0.4 + 技能契合度×0.3 + 项目成果×0.2 + 教育资质×0.1
    面试表现总分 = 沟通表达×0.2 + 问题解决×0.3 + 专业深度×0.3 + 成长潜力×0.2
    综合总分 = 简历匹配度总分×0.4 + 面试表现总分×0.6
    ```

    ---

    ### 输出格式要求（JSON）：

    请以如下格式输出（内容需详细，不能使用“表现良好”“技能不错”等空泛语言）：

    ```json
    {
    "resume_scores": {
        "experience_relevance": {
        "score": 分数（1-5）,
        "comment": "结合候选人的过往经历和岗位要求，具体说明匹配度情况，指出优势和潜在不足"
        },
        "skill_match": {
        "score": 分数,
        "comment": "列举候选人具备的核心技能，并说明与岗位技能要求的覆盖度和熟练度"
        },
        "project_results": {
        "score": 分数,
        "comment": "分析其主导/参与的项目是否具有代表性，是否体现岗位价值能力，是否有明确成果"
        },
        "education": {
        "score": 分数,
        "comment": "根据学历层次、专业背景、院校水平等因素，分析其教育背景与岗位匹配程度"
        },
        "total": 简历匹配度加权总分（浮点数，保留两位小数）
    },
    "interview_scores": {
        "communication": {
        "score": 分数,
        "comment": "结合面试语言表达、回答结构、现场互动等表现，评价其沟通能力优劣"
        },
        "problem_solving": {
        "score": 分数,
        "comment": "说明其在问题分析与解决方案构建中体现的逻辑思维、系统性、创新点等"
        },
        "technical_depth": {
        "score": 分数,
        "comment": "评估其技术知识掌握深度，是否能结合实际经验做深入分析，是否具备架构/优化思维"
        },
        "cultural_fit": {
        "score": 分数,
        "comment": "评价其性格特质、价值观、行为风格与企业/团队文化的一致性"
        },
        "growth_potential": {
        "score": 分数,
        "comment": "说明其学习能力、自我驱动表现，是否能胜任更复杂任务，有无职业成长的迹象"
        },
        "total": 面试表现加权总分（浮点数，保留两位小数）
    },
    "overall_score": 综合总分（浮点数，保留两位小数）,
    "recommendation": "推荐/保留考虑/不推荐",
    "strengths": [
        "从履历和面试中提炼的优势点，具体描述",
        "可支持推荐的第二优势点，详细说明"
    ],
    "improvements": [
        "需要重点改进的方面，指出具体表现或缺失",
        "第二个改进建议，说明提升空间"
    ]
    }
    ```

    ### 其他要求
    * 避免笼统用词如“挺好”“不错”“合适”等；
    * 每项评论建议不低于 3 句话，建议用客观描述+分析判断的方式撰写；
    * 推荐等级请结合岗位要求和整体评分给出，避免空泛赞扬。

    """

    REPORT_AGENT_INSTRUCTION = """

    ## 角色
    你是一个html报告生成专家，负责为一场面试生成评估报告。
    请你参考面试分析与评分结果，基于面试对话和简历生成一份视觉美观、内容详细、结构合理、展示专业的HTML格式候选人面试评估报告页面。

    ### 要求

    #### 页面结构与技术规范：
    1. 提供**完整的 HTML 文档结构**（包含 `<!DOCTYPE>`、`<html>`、`<head>`、`<body>` 等标准标签）；
    2. 页面应支持**响应式设计**，通过 `<meta name="viewport" content="width=device-width, initial-scale=1.0">` 适配不同设备；
    3. 引入 **Tailwind CSS（通过 CDN 加载）** 用于页面样式美化；
    4. 引入 **Google Fonts 的 Inter 字体**，确保整体风格现代、清晰；
    5. 页面整体设计应采用：**圆角、卡片布局、阴影效果、柔和配色**，整体视觉风格偏“简洁专业”；
    6. 所有分数展示需使用 **圆形进度环** 可视化（如 `conic-gradient`），并根据得分使用颜色编码区分（绿色：高分，黄色：中分，红色：低分）；
    7. 页面可包含少量内联 CSS/JS，但**不使用任何前端框架（如 Vue、React 等）**，保持轻量可维护性。

    ### 内容结构设计（各模块内容详细说明）

    #### 1. 报告标题与基本信息
    * 页面顶端显示“xxx面试评估报告”
    * 包含报告生成日期、评估轮次、岗位名称等基本信息

    #### 2. 候选人信息摘要
    * 包括：姓名、性别、年龄、申请职位、学历背景、毕业院校、工作年限、最近任职公司
    * 使用卡片式设计展示，信息清晰、易于快速识别

    #### 3. 简历匹配度评分表
    * 子项评分包括：
    - 专业技能匹配度
    - 项目经验相关性
    - 岗位关键词覆盖度
    - 教育背景匹配度

    * 每项：
        - 分值范围为 0–100
        - 使用可视化圆形进度环展示得分
        - 配有详细评语（优点/待提升点， 不少于200字）

    #### 4. 面试表现评分表
    * 子项评分包括：
    - 沟通与表达能力
    - 专业技术能力
    - 问题解决能力
    - 学习与成长潜力

    * 每项：
      - 分值范围为 0–100
      - 可视化环形进度展示
      - 附带详细评语以及依据（优点/待提升点， 不少于200字）

    #### 5. 综合评价与分析
    * 总结候选人主要**优势亮点**（不少于 3 条 300 字以上）
    * 明确候选人**存在的改进空间**（不少于 2 条 300 字以上）
    * 提供综合匹配度（百分比形式）及相应分析依据
    * 可选择加入：评分雷达图、得分趋势图、评委评语小结等补充内容，增强展示深度

    #### 6. 推荐结论
    * 推荐等级采用显著视觉标签显示（强烈推荐 / 推荐 / 保留考虑 / 不推荐）
    * 简要阐明推荐理由（支持 Bullet Point 列表）

    #### 7. 附件信息或备注
    * 包括但不限于：评估说明、评分标准等

    ### 设计美观性要求

    | 分数区间   | 环形进度条颜色                             |
    | ------ | ----------------------------------- |
    | 85–100 | `bg-green-400` + `text-green-800`   |
    | 60–84  | `bg-yellow-300` + `text-yellow-800` |
    | 0–59   | `bg-red-300` + `text-red-800`       |

    * 各模块建议使用 **栅格化布局（如两列卡片展示）**，合理分区，避免信息拥堵；
    * 整体色调建议为：**浅灰背景 + 白色内容卡片 + 柔和色条/评分色圈**；
    * 每个评分项建议使用卡片封装，采用统一宽高、圆角阴影风格，保持视觉一致性。

    ### 特别说明
    * 输出的 HTML 可直接保存为 `.html` 文件，用于展示或邮件发送；
    * **最终请直接输出完整 HTML 代码内容**，无需添加任何解释或额外描述；
    * 请确保页面逻辑结构清晰、代码无语法错误、评分展示正常。
    * 请确保你的分析和评价都要非常详细，有充分的依据，内容充实具体，避免空泛和过于简略的语言，表达专业，逻辑性强。
    """

class LLMService:
    """真实的DeepSeek LLM服务"""

    def __init__(self):
        # DeepSeek API 配置
        self.DEEPSEEK_API_URL = "https://ds.yovole.com/api"
        self.DEEPSEEK_API_KEY = "sk-833480880d9d417fbcc7ce125ca7d78b"
        self.DEEPSEEK_MODEL = "DeepSeek-V3"

        # 初始化HTTP客户端
        import httpx
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=15.0,  # 连接超时15秒
                read=120.0,    # 读取超时120秒（面试评估需要更长时间）
                write=30.0,    # 写入超时30秒
                pool=30.0      # 连接池超时30秒
            )
        )

    async def call_llm(self, messages: List[Dict[str, str]], agent_name: str = "", type: str = "openai", max_tokens: int = 1500) -> str:
        """调用DeepSeek API"""
        logger.info(f"调用 {agent_name} - 消息数量: {len(messages)}")
        if type == "gemini":
            return await self._call_gemini(messages)
        elif type == "openai":
            return self._call_openai(messages, max_tokens=max_tokens)
        else:
            return await self._call_deepseek_with_messages(messages)

    def _call_openai(self, messages: List[Dict[str, str]], max_retries: int = 3, max_tokens: int = 1500) -> str:
        for attempt in range(max_retries + 1):
            try:
                from openai import AzureOpenAI
                client = AzureOpenAI(
                    api_key=os.getenv("AZURE_OPENAI_API_KEY_FOR_EVALUATION"),
                    api_version=os.getenv("AZURE_API_VERSION_FOR_EVALUATION"),
                    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT_FOR_EVALUATION")
                )

                chat_completion = client.chat.completions.create(
                    model=os.getenv("AZURE_DEPLOYMENT_FOR_EVALUATION"),
                    messages=messages,
                    temperature=0.7,
                    max_tokens=max_tokens, # 确保有足够空间生成详细评估
                    )
                return chat_completion.choices[0].message.content
            except Exception as e:
                logger.error(f"OpenAI API调用失败: {e}")
                if attempt < max_retries:
                    import time
                    time.sleep(2 ** attempt)
                    continue
            raise Exception(f"API调用失败")

    async def _call_gemini(self, messages: List[Dict[str, str]], max_retries: int = 2) -> str:
        """调用Gemini API"""
        import asyncio

        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Gemini API调用尝试 {attempt + 1}/{max_retries + 1}")
                from google import genai
                from google.genai import types

                # https://ai.google.dev/gemini-api/docs?hl=zh-cn
                # The client gets the API key from the environment variable `GEMINI_API_KEY`.
                contents = ""
                system_instruction = ""
                for m in messages:
                    if m['role'] == 'user':
                        contents += m['content']
                    elif m['role'] == 'assistant':
                        contents += m['content']
                    elif m['role'] == 'system':
                        system_instruction += m['content']

                client = genai.Client()
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction),
                )
                return response.text
            except Exception as e:
                logger.error(f"Gemini API调用失败: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise Exception(f"API调用失败: {e}")

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
                    'temperature': 0.3,  # 较低的温度确保评估的一致性
                    'max_tokens': 4000,  # 增加token数量以支持更长的HTML报告
                    'top_p': 0.9
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

    def _parse_evaluation_result(self, evaluation_text: str) -> Dict[str, Any]:
        """从LLM返回的文本中解析出JSON部分"""
        try:
            json_start = evaluation_text.rfind("```json")
            json_end = evaluation_text.rfind("```")

            if json_start != -1 and json_end != -1 and json_end > json_start:
                json_str = evaluation_text[json_start + len("```json"):json_end].strip()
                return json.loads(json_str)
            else:
                logger.warning("未在评估结果中找到JSON块")
                return {}
        except json.JSONDecodeError as e:
            logger.error(f"解析评估结果中的JSON失败: {e}")
            return {}

    def _extract_clean_html(self, evaluation_text: str) -> str:
        """从LLM返回的文本中提取HTML部分"""
        # 查找HTML开始标记
        html_start = evaluation_text.find("<!DOCTYPE html>")
        if html_start == -1:
            html_start = evaluation_text.find("<html")

        if html_start != -1:
            # 查找JSON开始标记，HTML应该在JSON之前结束
            json_start = evaluation_text.find("```json")
            if json_start != -1:
                out = evaluation_text[html_start:json_start].strip()
            else:
                # 如果没有JSON，查找</html>结束标记
                html_end = evaluation_text.rfind("</html>")
                if html_end != -1:
                    out = evaluation_text[html_start:html_end + 7].strip()
        else:
            out = evaluation_text.strip()
        if out.startswith("```html"):
            out = out[len("```html"):]
        if out.endswith("```"):
            out = out[:-len("```")]
        return out

class ConcurrentThreeAgentInterviewSystem:
    """三个Agent协作的评估服务"""

    def __init__(self):
        self.llm_service = LLMService()
        self.analysis_result = None
        self.scoring_result = None
        self.report_result = None
    
    async def run_three_agent_evaluation(
        self,
        interview_messages: List[Dict[str, str]],
        resume_text: str,
        job_description: str = "",
        job_preference: dict = None
    ) -> Dict[str, Any]:
        """
        并发执行面试评估
        
        Args:
            interview_messages: 面试对话记录
            resume_text: 简历文本
            job_description: 职位描述
            
        Returns:
            包含评估结果的字典
        """
        logger.info("开始并发三Agent面试评估...")
        
        try:
            # 阶段1: 并发执行数据提取和分析评分
            logger.info("🚀 阶段1: 并发执行数据提取Agent和分析评分Agent...")
            
            # 创建并发任务
            analysis_task = asyncio.create_task(
                self._run_analysis_agent(interview_messages, resume_text, job_description, job_preference)
            )
            scoring_task = asyncio.create_task(
                self._run_scoring_agent(interview_messages, resume_text, job_description, job_preference)
            )
            
            # 等待两个Agent并发完成
            analysis_result, scoring_result = await asyncio.gather(
                analysis_task, 
                scoring_task,
                return_exceptions=True
            )
            
            # 检查是否有异常
            if isinstance(scoring_result, Exception):
                logger.error(f"数据提取Agent失败: {scoring_result}")
                scoring_result = "数据提取失败"
            
            if isinstance(analysis_result, Exception):
                logger.error(f"分析评分Agent失败: {analysis_result}")
                analysis_result = "分析评分失败"
            
            self.scoring_result = scoring_result
            self.analysis_result = analysis_result
            
            logger.info("✅ 阶段1完成: 数据提取和分析评分并发执行完毕")
            
            # 阶段2: 基于前两个Agent的结果生成HTML报告
            logger.info("🚀 阶段2: 生成HTML报告...")
            
            report_result = await self._run_report_agent(
                analysis_result, scoring_result, job_description, resume_text
            )
            
            logger.info("✅ 阶段2完成: HTML报告生成完毕")
            
            # 解析结构化评估数据
            self.report_result = self.llm_service._extract_clean_html(report_result)
            
            # 保存HTML报告
            await self._save_html_report()
            
            logger.info("🎉 并发三Agent评估完成！")
            
            return {
            'analysis': self.analysis_result,
            'scoring': self.scoring_result,
            'html_report': self.report_result,
            'evaluation': self._extract_json_from_scoring()
        }
            
        except Exception as e:
            logger.error(f"并发三Agent评估失败: {e}")
            raise e

    async def _run_analysis_agent(
        self,
        interview_messages: List[Dict[str, str]],
        resume_text: str,
        job_description: str,
        job_preference: dict = None
    ) -> str:
        """运行分析Agent"""

        # 构建面试对话文本
        interview_text = "\n".join([
            f"{'面试官' if msg['role'] == 'assistant' else '候选人'}: {msg['content']}"
            for msg in interview_messages
        ])

        messages = [
            {
                "role": "system",
                "content": ThreeAgentPrompts.ANALYSIS_AGENT_INSTRUCTION
            },
            {
                "role": "user",
                "content": f"""
请分析以下候选人信息：

**岗位描述：**
{job_description}

**候选人简历：**
{resume_text}

{self._build_job_preference_section(job_preference)}

**面试对话记录：**
{interview_text}

请按照指令要求进行分析并输出JSON格式的结果。特别关注候选人的技能与意向岗位的匹配度。
                """
            }
        ]

        result = await self.llm_service.call_llm(messages, "简历与面试分析专家")
        return result

    async def _run_scoring_agent(self, interview_messages: str, resume_text: str, job_description: str, job_preference: dict = None) -> str:
        """运行打分Agent"""

        messages = [
            {
                "role": "system",
                "content": ThreeAgentPrompts.SCORING_AGENT_INSTRUCTION
            },
            {
                "role": "user",
                "content": f"""
基于以下分析结果进行评估打分：

**岗位描述：**
{job_description}

**面试记录：**
{interview_messages}

**候选人简历：**
{resume_text}

{self._build_job_preference_section(job_preference)}

请按照评估框架进行打分并输出JSON格式的结果。特别关注候选人的技能与意向岗位的匹配度。
                """
            }
        ]

        result = await self.llm_service.call_llm(messages, "评估打分专家")
        return result

    async def _run_report_agent(self, analysis_result: str, scoring_result: str, job_description: str, resume_text: str) -> str:
        """运行报告Agent"""

        messages = [
            {
                "role": "system",
                "content": ThreeAgentPrompts.REPORT_AGENT_INSTRUCTION
            },
            {
                "role": "user",
                "content": f"""
基于以下基础面试对话，相关简历，岗位描述，初步分析和评分结果生成HTML报告：

**岗位描述：**
{job_description}

**候选人简历：**
{resume_text}

**分析结果：**
{analysis_result}

**评分结果：**
{scoring_result}

请生成完整的HTML面试评估报告。
                """
            }
        ]

        result = await self.llm_service.call_llm(messages, "HTML报告生成专家", max_tokens=10000)
        return result

    async def _save_html_report(self):
        """保存HTML报告到文件"""
        if not self.report_result:
            logger.warning("没有HTML报告内容可保存")
            return

        # 创建reports目录（如果不存在）
        reports_dir = "reports"
        if not os.path.exists(reports_dir):
            os.makedirs(reports_dir)

        # 生成文件名（包含时间戳）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"interview_report_{timestamp}.html"
        filepath = os.path.join(reports_dir, filename)

        # 保存HTML文件
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(self.report_result)
            logger.info(f"HTML报告已保存到: {filepath}")
        except Exception as e:
            logger.error(f"保存HTML报告失败: {e}")

    def _extract_json_from_scoring(self) -> Dict[str, Any]:
        """从打分结果中提取JSON数据"""
        if not self.scoring_result:
            return {}

        # 使用DeepSeek服务的JSON解析方法
        return self.llm_service._parse_evaluation_result(self.scoring_result)

    def _build_job_preference_section(self, job_preference: dict = None) -> str:
        """构建岗位偏好信息部分"""
        if not job_preference:
            return ""

        return f"""
**候选人意向岗位：**
岗位类别: {job_preference.get('category_label', job_preference.get('category', ''))}
具体岗位: {job_preference.get('position_label', job_preference.get('position', ''))}
完整岗位: {job_preference.get('full_label', '')}
"""

# 主要的接口函数
async def generate_concurrent_three_agent_report(
    interview_messages: List[Dict[str, str]],
    resume_text: str,
    job_description: str = "",
    job_preference: dict = None
) -> Dict[str, Any]:
    """
    使用三个Agent协作生成面试评估报告

    Args:
        interview_messages: 面试对话消息列表
        resume_text: 候选人简历文本
        job_description: 岗位描述（可选）

    Returns:
        包含分析、评分、HTML报告和结构化数据的字典
    """
    service = ConcurrentThreeAgentInterviewSystem()
    return await service.run_three_agent_evaluation(
        interview_messages, resume_text, job_description, job_preference
    )

# 示例用法和测试
async def main():
    """示例用法"""

    # 模拟面试对话
    mock_interview_messages = [
        {
            "role": "assistant",
            "content": "你好，李明。很高兴今天能和你交流。请你先简单介绍一下你自己和你的工作经验。"
        },
        {
            "role": "user",
            "content": "面试官您好！我叫李明，有5年前端开发经验。我之前在一家大型电商公司担任高级前端工程师，主要负责React和TypeScript的项目开发，包括性能优化和用户体验提升。我主导过一个将首屏加载时间从5秒优化到2秒的项目。"
        },
        {
            "role": "assistant",
            "content": "听起来很棒！能具体说说你在性能优化方面都做了哪些工作吗？遇到了什么挑战，又是如何解决的？"
        },
        {
            "role": "user",
            "content": "当然。我们主要采用了代码分割、懒加载、图片优化（WebP格式转换、按需加载）以及CDN加速。最大的挑战是旧代码库的模块化程度不高，导致Tree Shaking效果不佳。我通过重构部分核心模块，并引入Webpack的Code Splitting，显著提升了打包效率和加载速度。"
        }
    ]

    # 模拟简历
    mock_resume_text = """
    李明 - 高级前端开发工程师

    教育背景:
    - 华中科技大学，计算机科学与技术，本科，2018年毕业

    工作经验:
    - 2019-2024: 阿里巴巴集团，高级前端工程师
      * 负责淘宝商城前端架构设计和性能优化
      * 主导电商平台性能优化项目，首屏加载时间优化60%
      * 参与内部React组件库建设，提升团队开发效率30%

    核心技能:
    - 前端框架: React, Vue.js, Next.js
    - 语言: JavaScript (ES6+), TypeScript, HTML5, CSS3
    - 工具: Webpack, Babel, Git
    - 性能优化, 响应式设计, 用户体验优化
    """

    # 模拟岗位描述
    mock_job_description = """
    高级前端开发工程师

    职责：
    1. 负责公司核心产品的前端架构设计、开发与优化
    2. 独立承担复杂前端模块的开发任务，确保代码质量和性能
    3. 参与技术选型，引入前沿技术，提升团队整体技术水平
    4. 解决前端开发中的各类技术难题
    5. 具备良好的团队协作和沟通能力

    要求：
    1. 计算机相关专业本科及以上学历
    2. 5年以上前端开发经验，精通React或Vue.js
    3. 熟悉前端性能优化、工程化、组件化开发
    4. 具备良好的问题分析和解决能力
    5. 积极主动，有持续学习和成长的意愿
    """

    # 运行三个Agent协作评估
    logger.info("开始运行三个Agent协作评估示例")
    result = await generate_concurrent_three_agent_report(
        mock_interview_messages,
        mock_resume_text,
        mock_job_description
    )

    logger.info("评估完成！")
    logger.info(f"分析结果长度: {len(result.get('analysis', ''))}")
    logger.info(f"评分结果长度: {len(result.get('scoring', ''))}")
    logger.info(f"HTML报告长度: {len(result.get('html_report', ''))}")

    return result

if __name__ == "__main__":
    # 运行示例
    asyncio.run(main())
