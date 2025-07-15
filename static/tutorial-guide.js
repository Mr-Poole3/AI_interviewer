/**
 * 新手引导系统 - 交互式教程和智能提示
 * 
 * 功能特性：
 * - 🎯 交互式引导流程
 * - 🎨 高亮显示和遮罩效果
 * - 📱 响应式设计适配
 * - 💾 引导进度持久化
 * - 🧠 智能上下文提示
 */

class TutorialGuideSystem {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.currentTutorial = null;
        this.overlay = null;
        this.tooltip = null;
        this.progressBar = null;
        
        // 引导数据存储键
        this.STORAGE_KEYS = {
            TUTORIAL_COMPLETED: 'tutorial_completed',
            TUTORIAL_PROGRESS: 'tutorial_progress',
            USER_PREFERENCES: 'tutorial_preferences',
            SKIP_TUTORIALS: 'skip_tutorials'
        };
        
        // 初始化引导系统
        this.init();
    }
    
    init() {
        this.createOverlayElements();
        this.bindEvents();
        this.checkFirstVisit();
        console.log('🎯 新手引导系统已初始化');
    }
    
    /**
     * 创建引导遮罩和提示元素
     */
    createOverlayElements() {
        // 创建主遮罩层
        this.overlay = document.createElement('div');
        this.overlay.className = 'tutorial-overlay';
        this.overlay.innerHTML = `
            <div class="tutorial-backdrop"></div>
            <div class="tutorial-highlight"></div>
        `;
        
        // 创建提示工具栏
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tutorial-tooltip';
        this.tooltip.innerHTML = `
            <div class="tooltip-header">
                <div class="tooltip-progress">
                    <span class="step-counter">1/6</span>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                </div>
                <button class="tooltip-close" title="跳过引导">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="tooltip-content">
                <div class="tooltip-title">欢迎使用AI面试系统</div>
                <div class="tooltip-description">让我们开始一个快速的功能介绍</div>
                <div class="tooltip-tips"></div>
                <div class="tooltip-custom-action" style="display: none;"></div>
            </div>
            <div class="tooltip-actions">
                <button class="btn-tutorial btn-secondary" data-action="prev">
                    <i class="fas fa-chevron-left"></i>
                    上一步
                </button>
                <button class="btn-tutorial btn-primary" data-action="next">
                    下一步
                    <i class="fas fa-chevron-right"></i>
                </button>
                <button class="btn-tutorial btn-success" data-action="complete" style="display: none;">
                    <i class="fas fa-check"></i>
                    完成引导
                </button>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.tooltip);

        // 初始隐藏
        this.overlay.style.display = 'none';
        this.tooltip.style.display = 'none';

        // 绑定按钮事件（直接绑定到具体按钮）
        this.bindButtonEvents();
    }

    /**
     * 绑定按钮事件
     */
    bindButtonEvents() {
        // 等待DOM更新后绑定事件
        setTimeout(() => {
            const prevBtn = this.tooltip.querySelector('[data-action="prev"]');
            const nextBtn = this.tooltip.querySelector('[data-action="next"]');
            const completeBtn = this.tooltip.querySelector('[data-action="complete"]');
            const closeBtn = this.tooltip.querySelector('.tooltip-close');

            if (prevBtn) {
                prevBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🎯 点击上一步按钮');
                    this.prevStep();
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🎯 点击下一步按钮');
                    this.nextStep();
                });
            }

            if (completeBtn) {
                completeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🎯 点击完成按钮');
                    this.completeTutorial();
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🎯 点击关闭按钮');
                    this.skipTutorial();
                });
            }

            console.log('🎯 引导按钮事件绑定完成');
        }, 100);
    }
    
    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 工具栏按钮事件 - 使用事件委托
        this.tooltip.addEventListener('click', (e) => {
            e.stopPropagation();
            const actionButton = e.target.closest('[data-action]');
            if (actionButton) {
                const action = actionButton.dataset.action;
                console.log(`🎯 引导操作: ${action}`);
                this.handleAction(action);
            }
        });

        // 关闭按钮事件
        this.tooltip.addEventListener('click', (e) => {
            if (e.target.closest('.tooltip-close')) {
                e.stopPropagation();
                console.log('🎯 关闭引导');
                this.skipTutorial();
            }
        });
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (!this.isActive) return;
            
            switch(e.key) {
                case 'Escape':
                    this.skipTutorial();
                    break;
                case 'ArrowLeft':
                    this.prevStep();
                    break;
                case 'ArrowRight':
                case ' ':
                    this.nextStep();
                    break;
            }
        });
        
        // 窗口大小变化时重新定位
        window.addEventListener('resize', () => {
            if (this.isActive) {
                this.updateTooltipPosition();
            }
        });

        // 遮罩背景点击事件 - 不关闭引导，只是阻止事件冒泡
        this.overlay.addEventListener('click', (e) => {
            if (e.target.classList.contains('tutorial-backdrop')) {
                e.stopPropagation();
                // 可以添加一个提示动画，提醒用户使用工具栏
                this.tooltip.classList.add('tooltip-attention');
                setTimeout(() => {
                    this.tooltip.classList.remove('tooltip-attention');
                }, 1000);
            }
        });
    }
    
    /**
     * 检查是否为首次访问
     */
    checkFirstVisit() {
        const hasCompletedTutorial = localStorage.getItem(this.STORAGE_KEYS.TUTORIAL_COMPLETED);
        const skipTutorials = localStorage.getItem(this.STORAGE_KEYS.SKIP_TUTORIALS);
        
        if (!hasCompletedTutorial && !skipTutorials) {
            // 延迟启动，等待页面完全加载
            setTimeout(() => {
                this.startWelcomeTutorial();
            }, 1000);
        }
    }
    
    /**
     * 开始欢迎引导
     */
    startWelcomeTutorial() {
        const welcomeTutorial = {
            id: 'welcome',
            title: '欢迎使用AI面试系统',
            steps: [
                {
                    target: '.nav-brand',
                    title: '欢迎来到天汇AI',
                    description: '这是一个专业的AI语音面试系统，让我们开始一个快速的功能介绍吧！',
                    tips: '💡 您可以随时按 ESC 键跳过引导',
                    position: 'bottom'
                },
                {
                    target: '#navInterview',
                    title: '语音面试功能',
                    description: '点击这里开始AI语音面试，支持实时语音对话和智能评估',
                    tips: '🎤 语音通话面试！',
                    position: 'bottom'
                },
                {
                    target: '#navHistory',
                    title: '面试记录管理',
                    description: '查看您的历史面试记录，包括详细的评分报告和改进建议',
                    tips: '📊 每次面试都会生成专业的评估报告',
                    position: 'bottom'
                },
                {
                    target: '#navResume',
                    title: '简历管理',
                    description: '上传您的简历，AI将基于简历内容进行个性化面试提问',
                    tips: '📄 支持PDF和Word格式的简历文件',
                    position: 'bottom'
                },
                {
                    target: '#navResume',
                    title: '快速创建简历',
                    description: '还没有简历？点击这个"简历管理"按钮进入页面，页面中有天汇AI工具可以快速制作专业简历',
                    tips: '🚀 天汇AI工具可以帮您生成专业简历，提升面试成功率',
                    position: 'bottom',
                    customAction: {
                        text: '立即制作简历',
                        icon: 'fas fa-magic',
                        action: () => {
                            window.open('https://tianhuiai.com.cn/', '_blank');
                        }
                    }
                },
                {
                    target: '#navInterview',
                    title: '开始您的面试之旅',
                    description: '恭喜！您已经了解了系统的主要功能。现在点击这个"语音面试"按钮开始您的AI面试体验吧！',
                    tips: '🚀 建议先上传简历以获得更好的面试体验',
                    position: 'bottom'
                }
            ]
        };
        
        this.startTutorial(welcomeTutorial);
    }
    
    /**
     * 开始指定的引导教程
     */
    startTutorial(tutorial) {
        this.currentTutorial = tutorial;
        this.currentStep = 0;
        this.isActive = true;
        
        // 显示遮罩和工具栏
        this.overlay.style.display = 'block';
        this.tooltip.style.display = 'block';
        
        // 添加页面类名
        document.body.classList.add('tutorial-active');
        
        // 显示第一步
        this.showStep(0);
        
        // 记录开始时间
        this.tutorialStartTime = Date.now();
        
        console.log(`🎯 开始引导教程: ${tutorial.title}`);
    }
    
    /**
     * 显示指定步骤
     */
    showStep(stepIndex) {
        if (!this.currentTutorial || stepIndex >= this.currentTutorial.steps.length) {
            return;
        }
        
        const step = this.currentTutorial.steps[stepIndex];
        this.currentStep = stepIndex;
        
        // 更新进度
        this.updateProgress();
        
        // 高亮目标元素
        this.highlightElement(step.target);
        
        // 更新工具栏内容
        this.updateTooltipContent(step);
        
        // 更新工具栏位置
        this.updateTooltipPosition(step);
        
        // 更新按钮状态
        this.updateButtonStates();
        
        // 保存进度
        this.saveProgress();
        
        console.log(`📍 显示引导步骤 ${stepIndex + 1}/${this.currentTutorial.steps.length}: ${step.title}`);
    }
    
    /**
     * 高亮显示目标元素
     */
    highlightElement(selector) {
        const targetElement = document.querySelector(selector);
        const highlight = this.overlay.querySelector('.tutorial-highlight');
        
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const padding = 8;
            
            // 设置高亮区域
            highlight.style.left = `${rect.left - padding}px`;
            highlight.style.top = `${rect.top - padding}px`;
            highlight.style.width = `${rect.width + padding * 2}px`;
            highlight.style.height = `${rect.height + padding * 2}px`;
            highlight.style.borderRadius = getComputedStyle(targetElement).borderRadius || '8px';
            
            // 添加高亮动画
            highlight.classList.add('highlight-pulse');
            setTimeout(() => {
                highlight.classList.remove('highlight-pulse');
            }, 1000);
            
            // 滚动到可视区域
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }
    
    /**
     * 更新工具栏内容
     */
    updateTooltipContent(step) {
        const titleElement = this.tooltip.querySelector('.tooltip-title');
        const descriptionElement = this.tooltip.querySelector('.tooltip-description');
        const tipsElement = this.tooltip.querySelector('.tooltip-tips');
        const customActionElement = this.tooltip.querySelector('.tooltip-custom-action');
        
        titleElement.textContent = step.title;
        descriptionElement.textContent = step.description;
        tipsElement.textContent = step.tips || '';
        tipsElement.style.display = step.tips ? 'block' : 'none';
        
        // 处理自定义按钮
        if (step.customAction) {
            customActionElement.innerHTML = `
                <button class="btn-tutorial btn-custom" id="customActionBtn" style="
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    margin-top: 12px;
                    width: 100%;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 6px -1px rgb(139 92 246 / 0.25);
                ">
                    <i class="${step.customAction.icon || 'fas fa-external-link-alt'}"></i>
                    ${step.customAction.text}
                </button>
            `;
            customActionElement.style.display = 'block';
            
            // 绑定自定义按钮事件
            const customBtn = customActionElement.querySelector('#customActionBtn');
            if (customBtn) {
                customBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (step.customAction.action) {
                        step.customAction.action();
                    }
                });
                
                // 添加悬停效果
                customBtn.addEventListener('mouseenter', () => {
                    customBtn.style.transform = 'translateY(-2px)';
                    customBtn.style.boxShadow = '0 10px 15px -3px rgb(139 92 246 / 0.3)';
                });
                
                customBtn.addEventListener('mouseleave', () => {
                    customBtn.style.transform = 'translateY(0)';
                    customBtn.style.boxShadow = '0 4px 6px -1px rgb(139 92 246 / 0.25)';
                });
            }
        } else {
            customActionElement.style.display = 'none';
            customActionElement.innerHTML = '';
        }
    }
    
    /**
     * 更新工具栏位置
     */
    updateTooltipPosition(step) {
        if (!step) {
            if (!this.currentTutorial) {
                console.warn('⚠️ 没有活动的教程，无法更新工具栏位置');
                return;
            }
            step = this.currentTutorial.steps[this.currentStep];
        }
        
        const targetElement = document.querySelector(step.target);
        if (!targetElement) return;
        
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left, top;
        const offset = 20;
        
        // 根据位置偏好计算坐标
        switch (step.position) {
            case 'top':
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                top = rect.top - tooltipRect.height - offset;
                break;
            case 'bottom':
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                top = rect.bottom + offset;
                break;
            case 'left':
                left = rect.left - tooltipRect.width - offset;
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                break;
            case 'right':
                left = rect.right + offset;
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                break;
            default:
                left = rect.right + offset;
                top = rect.top;
        }
        
        // 边界检查和调整
        left = Math.max(10, Math.min(left, viewportWidth - tooltipRect.width - 10));
        top = Math.max(10, Math.min(top, viewportHeight - tooltipRect.height - 10));
        
        // 应用位置
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
        
        // 添加位置类名用于箭头指向
        this.tooltip.className = `tutorial-tooltip position-${step.position || 'right'}`;
    }
    
    /**
     * 更新进度显示
     */
    updateProgress() {
        if (!this.currentTutorial) {
            console.warn('⚠️ 没有活动的教程，无法更新进度显示');
            return;
        }
        
        const stepCounter = this.tooltip.querySelector('.step-counter');
        const progressFill = this.tooltip.querySelector('.progress-fill');
        
        const current = this.currentStep + 1;
        const total = this.currentTutorial.steps.length;
        const percentage = (current / total) * 100;
        
        stepCounter.textContent = `${current}/${total}`;
        progressFill.style.width = `${percentage}%`;
    }
    
    /**
     * 更新按钮状态
     */
    updateButtonStates() {
        if (!this.currentTutorial) {
            console.warn('⚠️ 没有活动的教程，无法更新按钮状态');
            return;
        }
        
        const prevBtn = this.tooltip.querySelector('[data-action="prev"]');
        const nextBtn = this.tooltip.querySelector('[data-action="next"]');
        const completeBtn = this.tooltip.querySelector('[data-action="complete"]');
        
        const isFirst = this.currentStep === 0;
        const isLast = this.currentStep === this.currentTutorial.steps.length - 1;
        
        prevBtn.style.display = isFirst ? 'none' : 'inline-flex';
        nextBtn.style.display = isLast ? 'none' : 'inline-flex';
        completeBtn.style.display = isLast ? 'inline-flex' : 'none';
    }
    
    /**
     * 处理用户操作
     */
    handleAction(action) {
        console.log(`🎯 处理引导操作: ${action}`);

        switch (action) {
            case 'prev':
                this.prevStep();
                break;
            case 'next':
                this.nextStep();
                break;
            case 'complete':
                this.completeTutorial();
                break;
            default:
                console.warn(`未知的引导操作: ${action}`);
        }
    }
    
    /**
     * 上一步
     */
    prevStep() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }
    
    /**
     * 下一步
     */
    nextStep() {
        if (!this.currentTutorial) {
            console.warn('⚠️ 没有活动的教程，无法执行下一步');
            return;
        }
        
        if (this.currentStep < this.currentTutorial.steps.length - 1) {
            this.showStep(this.currentStep + 1);
        }
    }
    
    /**
     * 完成引导
     */
    completeTutorial() {
        // 保存当前教程信息，避免 endTutorial() 后丢失
        const currentTutorial = this.currentTutorial;
        
        // 检查当前教程是否存在
        if (!currentTutorial) {
            console.warn('⚠️ 没有活动的教程可以完成');
            return;
        }
        
        this.endTutorial();
        
        // 标记为已完成
        localStorage.setItem(this.STORAGE_KEYS.TUTORIAL_COMPLETED, 'true');
        localStorage.setItem(`tutorial_${currentTutorial.id}_completed`, 'true');
        
        // 显示完成提示
        this.showCompletionMessage();
        
        console.log(`✅ 引导教程完成: ${currentTutorial.title}`);
    }
    
    /**
     * 跳过引导
     */
    skipTutorial() {
        if (confirm('确定要跳过新手引导吗？您可以稍后在设置中重新开启。')) {
            this.endTutorial();
            localStorage.setItem(this.STORAGE_KEYS.SKIP_TUTORIALS, 'true');
            console.log('⏭️ 用户跳过了引导教程');
        }
    }
    
    /**
     * 结束引导
     */
    endTutorial() {
        this.isActive = false;
        this.currentTutorial = null;
        this.currentStep = 0;
        
        // 隐藏遮罩和工具栏
        this.overlay.style.display = 'none';
        this.tooltip.style.display = 'none';
        
        // 移除页面类名
        document.body.classList.remove('tutorial-active');
        
        // 清除进度
        localStorage.removeItem(this.STORAGE_KEYS.TUTORIAL_PROGRESS);
    }
    
    /**
     * 显示完成消息
     */
    showCompletionMessage() {
        // 这里可以显示一个漂亮的完成动画或消息
        setTimeout(() => {
            alert('🎉 恭喜！您已完成新手引导。现在可以开始使用AI面试系统了！');
        }, 500);
    }
    
    /**
     * 保存引导进度
     */
    saveProgress() {
        if (!this.currentTutorial) {
            console.warn('⚠️ 没有活动的教程，无法保存进度');
            return;
        }
        
        const progress = {
            tutorialId: this.currentTutorial.id,
            currentStep: this.currentStep,
            timestamp: Date.now()
        };
        localStorage.setItem(this.STORAGE_KEYS.TUTORIAL_PROGRESS, JSON.stringify(progress));
    }
    
    /**
     * 恢复引导进度
     */
    restoreProgress() {
        const progressData = localStorage.getItem(this.STORAGE_KEYS.TUTORIAL_PROGRESS);
        if (progressData) {
            try {
                const progress = JSON.parse(progressData);
                // 可以在这里实现进度恢复逻辑
                console.log('📂 发现未完成的引导进度:', progress);
            } catch (e) {
                console.warn('引导进度数据解析失败:', e);
            }
        }
    }
    
    /**
     * 重新开始引导
     */
    restartTutorial() {
        localStorage.removeItem(this.STORAGE_KEYS.TUTORIAL_COMPLETED);
        localStorage.removeItem(this.STORAGE_KEYS.SKIP_TUTORIALS);
        this.startWelcomeTutorial();
    }
    
    /**
     * 启动特定功能的引导
     */
    startFeatureTutorial(featureName) {
        const tutorials = {
            'voice-interview': this.getVoiceInterviewTutorial(),
            'resume-upload': this.getResumeUploadTutorial(),
            'resume-upload-simple': this.getResumeUploadSimpleTutorial(),
            'interview-history': this.getHistoryTutorial()
        };
        
        const tutorial = tutorials[featureName];
        if (tutorial) {
            this.startTutorial(tutorial);
        }
    }
    
    /**
     * 获取语音面试引导
     */
    getVoiceInterviewTutorial() {
        return {
            id: 'voice-interview',
            title: '语音面试功能介绍',
            steps: [
                {
                    target: '.voice-call-button',
                    title: '开始语音面试',
                    description: '点击麦克风按钮开始语音面试，系统会自动连接AI面试官',
                    tips: '🎤 请确保您的麦克风权限已开启',
                    position: 'top'
                },
                {
                    target: '.chat-messages',
                    title: '面试对话区域',
                    description: '这里会显示您与AI面试官的对话内容，支持语音和文字两种方式',
                    tips: '💬 您可以随时切换语音和文字输入模式',
                    position: 'left'
                }
            ]
        };
    }
    
    /**
     * 获取简历上传引导
     */
    getResumeUploadTutorial() {
        return {
            id: 'resume-upload',
            title: '简历管理功能',
            steps: [
                {
                    target: '.header-action-btn',
                    title: '快速制作简历',
                    description: '还没有简历？点击这里使用天汇AI工具快速制作专业简历',
                    tips: '🚀 天汇AI工具可以帮您快速生成专业简历，提升面试通过率',
                    position: 'bottom'
                },
                {
                    target: '.upload-area',
                    title: '上传您的简历',
                    description: '拖拽简历文件到这里，或点击选择文件。支持PDF和Word格式',
                    tips: '📄 上传简历后，AI会根据您的背景进行个性化提问',
                    position: 'top'
                }
            ]
        };
    }

    /**
     * 获取简化版简历上传引导（已有简历用户）
     */
    getResumeUploadSimpleTutorial() {
        return {
            id: 'resume-upload-simple',
            title: '更新简历',
            steps: [
                {
                    target: '.upload-area',
                    title: '更新您的简历',
                    description: '拖拽新的简历文件到这里，或点击选择文件进行更新。支持PDF和Word格式',
                    tips: '📄 更新简历后，AI会根据您的最新背景进行个性化提问',
                    position: 'top'
                }
            ]
        };
    }
    
    /**
     * 获取历史记录引导
     */
    getHistoryTutorial() {
        return {
            id: 'interview-history',
            title: '面试历史功能',
            steps: [
                {
                    target: '.history-list',
                    title: '查看面试记录',
                    description: '这里显示您的所有面试记录，包括时间、评分和详细报告',
                    tips: '📊 点击任意记录可以查看详细的面试分析',
                    position: 'top'
                }
            ]
        };
    }
}

// 全局引导系统实例
window.tutorialGuide = null;

// 初始化引导系统
document.addEventListener('DOMContentLoaded', () => {
    window.tutorialGuide = new TutorialGuideSystem();
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TutorialGuideSystem;
}
