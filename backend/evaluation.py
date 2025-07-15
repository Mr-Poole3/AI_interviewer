import json
import os
from typing import List, Dict, Any

import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)# 模拟 InterviewPrompts 类，用于存储不同“Agent”的指令片段
# 模拟 InterviewPrompts 类，用于存储不同“Agent”的指令片段
class InterviewPrompts:
    # 基础评估框架，作为所有Agent的共同参考
    BASE_EVALUATION_FRAMEWORK = """
    # 评估框架
    你将从**简历匹配度**和**面试表现**两大核心方面进行评估，并为每个维度给出详细评分（1-5分）及具体评论。

    ### 1. 简历匹配度评估 (总分基于加权计算，权重 40%)
    **目的**: 衡量候选人过往经历与目标职位的契合程度。

    | 维度 | 评分标准 | 分数 | 评价 |
    |---|---|---|---|
    | **经验相关性** | 1=无相关；3=部分相关；5=高度相关，可快速上手 | [ ] | [具体说明候选人过往经验与职位核心职责的匹配度，举例说明] |
    | **技能契合度** | 1=不满足；3=基本满足；5=完全满足或超出 | [ ] | [评估简历中硬/软技能与职位要求的契合度，指出符合或需提升的技能] |
    | **项目/成果** | 1=无关；3=部分相关；5=高度相关且成果显著 | [ ] | [分析候选人项目/成果与职位目标的关联性及影响，量化成果] |
    | **教育/资质** | 1=不满足最低；3=基本满足；5=完全满足或超出 | [ ] | [评估教育背景、证书等与职位基本要求的符合度] |

    **计算公式**: `简历匹配度总分 = (经验相关性×0.4 + 技能契合度×0.3 + 项目/成果×0.2 + 教育/资质×0.1)`

    ### 2. 面试表现评估 (总分基于加权计算，权重 60%)
    **目的**: 评估候选人在面试过程中的实际能力展现。

    | 维度 | 评分标准 | 分数 | 评价 |
    |---|---|---|---|
    | **沟通表达** | 1=混乱；3=基本清晰；5=简洁有力，富有感染力 | [ ] | [评估回答清晰度、逻辑性，举例说明沟通亮点或待改进之处] |
    | **问题解决** | 1=无法拆解；3=基本分析；5=系统化分析，方案创新有效 | [ ] | [分析解决问题的思路、创新性及决策质量，结合具体案例] |
    | **专业深度** | 1=知识错误；3=基础扎实；5=见解独到，能解决复杂问题 | [ ] | [评估专业知识掌握和应用能力，指出深度或不足，引用回答] |
    | **文化适配性** | 1=明显冲突；3=基本适配；5=高度契合，能增强团队活力 | [ ] | [通过情景题或行为问题评估价值观与团队文化的匹配度] |
    | **成长潜力** | 1=固化思维；3=愿学习；5=清晰规划+自驱行动 | [ ] | [评估学习意愿、职业规划清晰度和接受反馈的态度] |

    **计算公式**: `面试表现总分 = (沟通表达×0.2 + 问题解决×0.3 + 专业深度×0.3 + 文化适配性×0.1 + 成长潜力×0.1)`

    ### 3. 整体推荐分数与总结
    **整体推荐分数**: `[ ]` （基于加权计算：`简历匹配度总分 × 0.4 + 面试表现总分 × 0.6`）
    **简述**: `[整合核心亮点与风险点，例如："候选人在[优势维度]表现突出（评分 X/5），但在[风险维度]需关注（评分 Y/5）。整体来看..."]`
    """

    # Agent 1: 简历解析 Agent 的指令
    RESUME_PARSER_AGENT_INSTRUCTION = """
    **第一阶段：简历解析**
    作为“简历解析专家”，你的首要任务是仔细阅读提供的候选人简历文本，并提取所有关键信息。请务必识别并总结以下内容：
    - **候选人姓名**
    - **应聘岗位** (如果简历或对话中明确提及)
    - **主要工作经验**：包括公司名称、职位、任职起止时间、核心职责和量化成就（例如，优化了什么，带来了多少提升）。
    - **教育背景**：学校名称、专业、学历、毕业时间。
    - **核心技能栈**：技术（如React, TypeScript, Python）、工具、方法论等。
    - **关键项目经验**：项目名称、你在项目中的角色、主要职责、项目成果（尽可能量化）。
    请在后续的评估中，充分利用这些提取的信息。
    """

    # Agent 2: 面试对话分析 Agent 的指令
    INTERVIEW_ANALYZER_AGENT_INSTRUCTION = """
    **第二阶段：面试对话分析**
    作为“面试对话分析专家”，你的任务是深入分析面试官（assistant）和候选人（user）的对话记录。针对以下每个面试评估维度，请识别并总结候选人的具体表现、回答的深度、逻辑性，并提取出能够支撑你评价的**具体例子或引述**。

    - **沟通表达**：评估回答的清晰度、逻辑性、条理性，以及是否有亮点（如简洁有力、富有感染力）或待改进之处（如表达混乱、不够清晰）。
    - **问题解决**：分析候选人面对问题时的思路、如何拆解复杂问题、提出解决方案的创新性及决策质量。请结合对话中的具体案例进行分析。
    - **专业深度**：评估候选人对专业知识的掌握程度、应用能力，是否有独到见解，或者是否存在知识盲区。请引用对话中相关的技术讨论或回答。
    - **文化适配性**：通过对话中展现出的态度、价值观、团队协作意愿等，判断其与开放、协作、积极的团队文化的契合度。
    - **成长潜力**：评估候选人的学习意愿、对职业发展的规划清晰度，以及接受反馈和自我驱动的态度。
    请确保你的分析是细致入微且有具体细节支撑的。
    """

    # Agent 3: 评估打分与评论 Agent 的指令
    EVALUATION_SCORER_AGENT_INSTRUCTION = """
    **第三阶段：评估打分与详细评论**
    作为“面试评估打分专家”，你现在已经掌握了简历的关键信息和面试对话的深入分析。请严格遵循以下评估框架和计算公式，为每个维度给出**1-5分**的评分，并在“评价”部分提供**非常详细、具体且有论据支撑的评论**。你的评论必须明确引用简历中提取的信息或面试对话中的具体内容来支撑你的分数。

    ---
    ## 面试评估报告
    **面试者**: `[请从简历或对话中提取候选人姓名]`
    **应聘岗位**: `[请从简历或对话中提取应聘岗位名称]`

    ### 1. 简历匹配度评分
    | 维度 | 评分标准 | 分数 | 评价 |
    |---|---|---|---|
    | **经验相关性** | 1=无相关；3=部分相关；5=高度相关，可快速上手 | `[此处填写分数]` | `[基于简历内容，详细阐述经验与职位匹配度，并给出具体理由和例子]` |
    | **技能契合度** | 1=不满足；3=基本满足；5=完全满足或超出 | `[此处填写分数]` | `[基于简历内容，详细阐述技能与职位要求契合度，并给出具体理由和例子]` |
    | **项目/成果** | 1=无关；3=部分相关；5=高度相关且成果显著 | `[此处填写分数]` | `[基于简历内容，详细阐述项目/成果与职位目标的关联，并给出具体理由和量化成果]` |
    | **教育/资质** | 1=不满足最低；3=基本满足；5=完全满足或超出 | `[此处填写分数]` | `[基于简历内容，详细阐述教育/资质符合度，并给出具体理由]` |
    **简历匹配度总分**: `[计算结果，保留一位小数]`

    ### 2. 面试表现评分
    | 维度 | 评分标准 | 分数 | 评价 |
    |---|---|---|---|
    | **沟通表达** | 1=混乱；3=基本清晰；5=简洁有力，富有感染力 | `[此处填写分数]` | `[基于面试对话，详细阐述沟通表达能力，并给出具体例子和对话引述]` |
    | **问题解决** | 1=无法拆解；3=基本分析；5=系统化分析，方案创新有效 | `[此处填写分数]` | `[基于面试对话，详细阐述问题解决能力，并给出具体例子和对话引述]` |
    | **专业深度** | 1=知识错误；3=基础扎实；5=见解独到，能解决复杂问题 | `[此处填写分数]` | `[基于面试对话，详细阐述专业深度，并给出具体例子和对话引述]` |
    | **文化适配性** | 1=明显冲突；3=基本适配；5=高度契合，能增强团队活力 | `[此处填写分数]` | `[基于面试对话，详细阐述文化适配性，并给出具体例子和对话引述]` |
    | **成长潜力** | 1=固化思维；3=愿学习；5=清晰规划+自驱行动 | `[此处填写分数]` | `[基于面试对话，详细阐述成长潜力，并给出具体例子和对话引述]` |
    **面试表现总分**: `[计算结果，保留一位小数]`

    ---
    ### 3. 综合评价
    #### 3.1 优势亮点
    `[列举候选人在面试中表现出的突出优势，结合简历和面试对话给出具体例子。至少列出3点。]`
    #### 3.2 待提升点/风险点
    `[列举候选人可能存在的不足或风险，结合简历和面试对话给出具体例子和担忧；如果可能，提出验证或弥补建议。至少列出2点。]`
    #### 3.3 与职位匹配度分析
    `[结合具体的职位要求（如有提供），详细分析候选人与职位的匹配程度，包括技能、经验、文化适应性等方面。引用简历和面试表现中的具体信息进行支撑。请使用以下表格形式进行对比分析，并填充至少3个核心要求：]`

    ```markdown
    | 岗位核心要求 | 简历匹配证据 | 面试验证情况 | 差距分析/亮点 |
    |---|---|---|---|
    | `[要求1]` | `[简历中相关经验或技能]` | `[面试中对此的回答/表现]` | `[匹配度分析或存在差距]` |
    | `[要求2]` | `[简历中相关项目/资质]` | `[面试中对此的回答/表现]` | `[匹配度分析或存在差距]` |
    | `[要求3]` | `[简历中相关项目/资质]` | `[面试中对此的回答/表现]` | `[匹配度分析或存在差距]` |
    ```
    #### 3.4 推荐理由或不推荐理由
    `[基于简历匹配度和面试表现的综合评估，总结性地给出明确的推荐或不推荐的核心原因。]`
    """

    # Agent 4: 报告格式化与结构化输出 Agent 的指令
    REPORT_FORMATTER_AGENT_INSTRUCTION = """
    **第四阶段：HTML报告生成与结构化数据输出**
    作为“专业报告生成专家”，你的最终任务是将所有上述评估内容（包括详细评分、评论、综合评价等）封装在一个完整的、美观的HTML结构中。

    HTML报告必须严格遵循以下要求：
    - **完整的HTML文档结构**：包含 `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>` 等标签。
    - **响应式设计**：在 `<head>` 中包含 `<meta name="viewport" content="width=device-width, initial-scale=1.0">`。
    - **美观的UI设计**：
        - **必须使用Tailwind CSS进行样式化**，通过CDN引入 `<script src="https://cdn.tailwindcss.com"></script>`。
        - **字体**：使用 'Inter' 字体，通过Google Fonts CDN引入。
        - **圆角**：所有主要容器、表格、卡片等元素都应使用 `rounded-lg` 或 `rounded-xl` 等Tailwind类实现圆角。
        - **阴影**：主要元素应有 `shadow-md` 或 `shadow-lg` 等阴影效果。
        - **颜色搭配**：使用柔和的背景色（如 `bg-gray-50` 或 `bg-blue-50`），深色文本，以及蓝色系（`bg-blue-500`, `text-blue-800`）作为强调色。
        - **分数显示**：使用圆形标记（`score-circle`）和进度条（`score-bar`）来直观展示分数，并根据分数高低使用不同的颜色（如绿色表示高分，黄色表示中等，红色表示低分）。
        - **布局**：报告内容应居中，有适当的 `margin` 和 `padding`，确保可读性。
    - **内容完整性**：包含所有之前阶段生成的评估信息，包括：
        - 报告标题、面试者姓名、应聘岗位。
        - 简历匹配度评分表（填充所有维度、分数和详细评价）。
        - 面试表现评分表（填充所有维度、分数和详细评价）。
        - 简历匹配度总分和计算公式。
        - 面试表现总分和计算公式。
        - 综合评价部分，包括：优势亮点、待提升点/风险点、与职位匹配度分析（**必须使用表格形式**，填充具体内容）、推荐理由或不推荐理由。
    - **结构化数据输出**：在HTML报告的 `<body>` 标签内部的**最末尾**，紧接着HTML报告内容，以一个独立的 ```json` 代码块的形式，输出以下JSON格式的结构化数据。确保JSON中的分数与HTML报告中的评分保持一致。

    ```json
    {
        "total_score": [整体推荐分数，0-10分，保留一位小数],
        "summary": "[简洁的面试表现总结，1-2句话概括核心评价]",
        "strengths": [
            "[具体优势点1]",
            "[具体优势点2]",
            "[具体优势点3]"
        ],
        "improvements": [
            "[具体改进建议1]",
            "[具体改进建议2]",
            "[具体改进建议3]"
        ],
        "dimension_scores": {
            "resume_match": [简历匹配度总分，0-10分，保留一位小数],
            "communication": [沟通表达分数，0-10分，保留一位小数],
            "problem_solving": [问题解决分数，0-10分，保留一位小数],
            "technical_skills": [专业深度分数，0-10分，保留一位小数],
            "cultural_fit": [文化适配性分数，0-10分，保留一位小数],
            "growth_potential": [成长潜力分数，0-10分，保留一位小数]
        }
    }
    ```
    请确保生成的HTML代码是完整、自洽且无语法错误的。
    """

# 模拟 LLM 服务，实际应用中会调用真实的 LLM API
class MockLLMService:
    async def call_llm(self, messages: List[Dict[str, str]]) -> str:
        """
        模拟对 LLM API 的调用。
        在真实场景中，这里会是 `client.chat.completions.create(...)` 等实际 API 调用。
        为了演示“多Agent”的Prompt构建，这里不会返回实际的HTML，而是返回一个占位符。
        实际的HTML报告将由LLM根据完整的Prompt生成。
        """
        print("\n--- 模拟 LLM 调用开始 ---")
        print(f"发送给 LLM 的消息数量: {len(messages)}")
        # 打印部分消息内容，以便调试 Prompt 结构
        # print(f"系统消息 (部分): {messages[0]['content'][:500]}...")
        # print(f"用户简历消息 (部分): {messages[1]['content'][:200]}...")
        # print(f"用户对话消息 (部分): {messages[2]['content'][:200]}...")
        print("--- 模拟 LLM 调用结束 ---")

        # 返回一个简化的模拟响应，表示LLM会返回HTML和JSON
        # 实际的HTML和JSON内容将由LLM根据上述详细Prompt生成
        return """
        <!-- 这是一个模拟的HTML报告片段 -->
        <div class="container">
            <h1>模拟面试评估报告</h1>
            <p>这里是LLM根据多Agent概念性Prompt生成的详细HTML报告内容。</p>
            <p>包括简历匹配度、面试表现的详细评分、评价、优势、劣势、匹配度分析和推荐理由。</p>
        </div>
        ```json
        {
            "total_score": 4.9,
            "summary": "模拟：候选人表现优秀，高度匹配岗位。",
            "strengths": ["经验丰富", "沟通清晰"],
            "improvements": ["教育背景非顶尖"],
            "dimension_scores": {
                "resume_match": 4.9,
                "communication": 5.0,
                "problem_solving": 5.0,
                "technical_skills": 5.0,
                "cultural_fit": 4.0,
                "growth_potential": 5.0
            }
        }
        ```
        """


class EvaluationService:
    """
    负责调用 LLM 和解析其响应的服务类。
    """
    def __init__(self):
        self.llm_service = MockLLMService()

    def _call_genimi(self, content: str, system: str, max_retries: int = 3) -> str:
        from google import genai
        from google.genai import types

        # The client gets the API key from the environment variable `GEMINI_API_KEY`.
        client = genai.Client()

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=content,
            config=types.GenerateContentConfig(
                system_instruction=system),
        )
        logger.info(f"response: {response.text}")
        return (response.text)

    def _call_openai(self, messages: List[Dict[str, str]], max_retries: int = 3, max_tokens: int = 1500) -> str:
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
    async def _call_deepseek_with_messages(self, messages: List[Dict[str, str]], max_retries: int = 3) -> str:
        """
        封装 LLM 调用。
        """
        # return await self.llm_service.call_llm(messages)
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
                    'max_tokens': 2000,
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
        """
        从 LLM 返回的文本中解析出 JSON 部分。
        """
        try:
            json_start = evaluation_text.rfind("```json")
            json_end = evaluation_text.rfind("```")

            if json_start != -1 and json_end != -1 and json_end > json_start:
                json_str = evaluation_text[json_start + len("```json"):json_end].strip()
                return json.loads(json_str)
            else:
                print("警告: 未在评估结果中找到 JSON 块。")
                return {}
        except json.JSONDecodeError as e:
            print(f"解析评估结果中的 JSON 失败: {e}")
            return {}

    def _extract_clean_html(self, evaluation_text: str) -> str:
        """
        从 LLM 返回的文本中提取纯 HTML 部分（去除 JSON 块）。
        """
        json_start = evaluation_text.rfind("```json")
        if json_start != -1:
            return evaluation_text[:json_start].strip()
        return evaluation_text.strip()


async def generate_interview_report_with_optimized_prompt(
    interview_messages: List[Dict[str, str]],
    resume_text: str,
    job_description: str = "" # 岗位描述，可选
) -> Dict[str, Any]:
    """
    通过一个高度优化的Prompt，模拟多Agent协作生成面试评估报告。
    """
    evaluation_service = EvaluationService()

    # 构建一个包含所有“概念性Agent”指令的完整系统Prompt
    # 这里的关键在于，将各个Agent的职责和输出要求，清晰地串联起来。
    full_system_prompt = (
        f"你是一个顶级的招聘专家和面试评估顾问，擅长结合职位要求，对候选人的简历和面试表现进行全面、深入的评估，并生成一份结构清晰、洞察力强的面试评估报告。\n\n"
        f"{InterviewPrompts.RESUME_PARSER_AGENT_INSTRUCTION}\n\n"
        f"{InterviewPrompts.INTERVIEW_ANALYZER_AGENT_INSTRUCTION}\n\n"
        f"{InterviewPrompts.EVALUATION_SCORER_AGENT_INSTRUCTION}\n\n"
        f"{InterviewPrompts.REPORT_FORMATTER_AGENT_INSTRUCTION}\n\n"
        f"请严格按照以上四个阶段的指令，一步步执行，最终输出一份完整的HTML报告，并在HTML末尾附带结构化JSON数据。"
    )

    # 准备发送给 LLM 的消息列表
    messages_for_llm = [
        {"role": "system", "content": full_system_prompt},
        {"role": "user", "content": f"以下是候选人提供的简历信息：\n```\n{resume_text}\n```"},
        {"role": "user", "content": f"以下是候选人（user）和面试官（assistant）的对话记录： \n```json\n{json.dumps(interview_messages, ensure_ascii=False)}\n```"},
    ]
    if job_description:
        messages_for_llm.append({"role": "user", "content": f"以下是目标岗位的详细描述，请在评估匹配度时参考：\n```\n{job_description}\n```"})

    # 调用 LLM 服务
    evaluation_result_from_llm = await evaluation_service._call_deepseek_with_messages(messages_for_llm)

    # 解析 LLM 的响应
    parsed_json_data = evaluation_service._parse_evaluation_result(evaluation_result_from_llm)
    clean_html_report = evaluation_service._extract_clean_html(evaluation_result_from_llm)

    return {
        'evaluationHtml': clean_html_report,
        'evaluation': parsed_json_data
    }

# --- 示例用法 (此部分代码不会在Canvas环境中直接运行，仅作说明) ---
async def main():
    # 假设的面试对话和简历内容
    mock_interview_messages = [
        {"role": "assistant", "content": "你好，李明。很高兴今天能和你交流。请你先简单介绍一下你自己和你的工作经验。"},
        {"role": "user", "content": "面试官您好！我叫李明，有5年前端开发经验。我之前在一家大型电商公司担任高级前端工程师，主要负责React和TypeScript的项目开发，包括性能优化和用户体验提升。我主导过一个将首屏加载时间从5秒优化到2秒的项目。"},
        {"role": "assistant", "content": "听起来很棒！能具体说说你在性能优化方面都做了哪些工作吗？遇到了什么挑战，又是如何解决的？"},
        {"role": "user", "content": "当然。我们主要采用了代码分割、懒加载、图片优化（WebP格式转换、按需加载）以及CDN加速。最大的挑战是旧代码库的模块化程度不高，导致Tree Shaking效果不佳。我通过重构部分核心模块，并引入Webpack的Code Splitting，显著提升了打包效率和加载速度。"}
    ]
    mock_resume_text = """
    李明 - 高级前端开发工程师
    联系方式: xxx@email.com | 138xxxxxxx
    教育背景:
    - 2014-2018: 某大学, 计算机科学与技术, 学士

    工作经验:
    1. 某电商科技公司 | 高级前端工程师 | 2019.07 - 至今
       - 负责核心电商平台前端架构设计与开发，使用React, TypeScript。
       - 主导前端性能优化项目，将首页加载时间从5s降低至2s，提升用户体验。
       - 参与组件库建设，提升开发效率。
       - 负责跨部门技术协作与沟通。
    2. 某互联网公司 | 前端开发工程师 | 2018.07 - 2019.06
       - 参与营销活动页开发，使用Vue.js。

    核心技能:
    - 前端框架: React, Vue.js, Next.js
    - 语言: JavaScript (ES6+), TypeScript, HTML5, CSS3
    - 工具: Webpack, Babel, Git
    - 性能优化, 响应式设计, 用户体验优化

    项目经验:
    - **电商平台性能优化项目**: 作为核心成员，负责制定并实施前端性能优化方案，包括代码分割、图片懒加载、CDN优化等，使首屏加载时间降低60%。
    - **内部组件库建设**: 参与设计和开发公司级React组件库，提高团队开发效率30%。
    """
    mock_job_description = """
    高级前端开发工程师
    职责：
    1. 负责公司核心产品的前端架构设计、开发与优化。
    2. 独立承担复杂前端模块的开发任务，确保代码质量和性能。
    3. 参与技术选型，引入前沿技术，提升团队整体技术水平。
    4. 解决前端开发中的各类技术难题。
    5. 具备良好的团队协作和沟通能力。
    要求：
    1. 计算机相关专业本科及以上学历。
    2. 5年以上前端开发经验，精通React或Vue.js。
    3. 熟悉前端性能优化、工程化、组件化开发。
    4. 具备良好的问题分析和解决能力。
    5. 积极主动，有持续学习和成长的意愿。
    """

    # 运行模拟的报告生成流程
    result = await generate_interview_report_with_optimized_prompt(
        mock_interview_messages,
        mock_resume_text,
        mock_job_description
    )
    print("\n--- 模拟 LLM 返回的 HTML (部分) ---")
    print(result['evaluationHtml'][:500])
    print("\n--- 模拟 LLM 返回的 JSON ---")
    print(json.dumps(result['evaluation'], indent=2, ensure_ascii=False))

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

