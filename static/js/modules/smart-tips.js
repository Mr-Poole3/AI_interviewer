/**
 * 智能提示系统 - 上下文相关的帮助和建议
 * 
 * 功能特性：
 * - 🧠 智能上下文分析
 * - 💡 实时操作建议
 * - 🎯 个性化提示内容
 * - 📱 响应式提示显示
 * - 🔄 自适应提示频率
 */

class SmartTipsSystem {
    constructor() {
        this.isEnabled = true;
        this.currentContext = null;
        this.tipHistory = [];
        this.userInteractions = [];
        this.tipContainer = null;
        
        // 提示配置
        this.config = {
            maxTipsPerSession: 5,
            tipDisplayDuration: 8000,
            contextSwitchDelay: 2000,
            userIdleThreshold: 30000, // 30秒无操作
            tipCooldown: 10000 // 10秒冷却时间
        };
        
        // 存储键
        this.STORAGE_KEYS = {
            TIPS_ENABLED: 'smart_tips_enabled',
            TIPS_HISTORY: 'smart_tips_history',
            USER_PREFERENCES: 'smart_tips_preferences',
            DISMISSED_TIPS: 'dismissed_tips'
        };
        
        this.init();
    }
    
    init() {
        this.loadUserPreferences();
        this.createTipContainer();
        this.bindContextListeners();
        this.startContextMonitoring();
    }
    
    /**
     * 加载用户偏好设置
     */
    loadUserPreferences() {
        const enabled = localStorage.getItem(this.STORAGE_KEYS.TIPS_ENABLED);
        this.isEnabled = enabled !== 'false'; // 默认启用
        
        const history = localStorage.getItem(this.STORAGE_KEYS.TIPS_HISTORY);
        this.tipHistory = history ? JSON.parse(history) : [];
        
        const dismissed = localStorage.getItem(this.STORAGE_KEYS.DISMISSED_TIPS);
        this.dismissedTips = dismissed ? JSON.parse(dismissed) : [];
    }
    
    /**
     * 创建提示容器
     */
    createTipContainer() {
        this.tipContainer = document.createElement('div');
        this.tipContainer.className = 'smart-tips-container';
        this.tipContainer.innerHTML = `
            <div class="smart-tip" id="smartTip" style="display: none;">
                <div class="tip-icon">
                    <i class="fas fa-lightbulb"></i>
                </div>
                <div class="tip-content">
                    <div class="tip-title">智能提示</div>
                    <div class="tip-message">这里是提示内容</div>
                </div>
                <div class="tip-actions">
                    <button class="tip-action-btn" data-action="dismiss">
                        <i class="fas fa-times"></i>
                    </button>
                    <button class="tip-action-btn" data-action="more" style="display: none;">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.tipContainer);
        this.bindTipEvents();
    }
    
    /**
     * 绑定提示事件
     */
    bindTipEvents() {
        this.tipContainer.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action) {
                this.handleTipAction(action);
            }
        });
    }
    
    /**
     * 绑定上下文监听器
     */
    bindContextListeners() {
        // 页面切换监听
        window.addEventListener('pageChanged', (e) => {
            this.handleContextChange('page', e.detail.page);
        });
        
        // 面试状态监听
        window.addEventListener('interviewStarted', () => {
            this.handleContextChange('interview', 'started');
        });
        
        window.addEventListener('interviewEnded', () => {
            this.handleContextChange('interview', 'ended');
        });
        
        // 简历上传监听
        window.addEventListener('resumeUploaded', () => {
            this.handleContextChange('resume', 'uploaded');
        });
        
        // 用户交互监听
        document.addEventListener('click', (e) => {
            this.recordUserInteraction('click', e.target);
        });
        
        document.addEventListener('keydown', (e) => {
            this.recordUserInteraction('keydown', e.key);
        });
    }
    
    /**
     * 开始上下文监控
     */
    startContextMonitoring() {
        // 定期检查用户状态
        setInterval(() => {
            this.analyzeUserBehavior();
        }, 5000);
        
        // 检查用户空闲状态
        this.lastInteractionTime = Date.now();
        setInterval(() => {
            const idleTime = Date.now() - this.lastInteractionTime;
            if (idleTime > this.config.userIdleThreshold) {
                this.handleUserIdle();
            }
        }, 10000);
    }
    
    /**
     * 处理上下文变化
     */
    handleContextChange(type, value) {
        const newContext = { type, value, timestamp: Date.now() };
        this.currentContext = newContext;
            
        
        // 延迟显示提示，等待页面稳定
        setTimeout(() => {
            this.generateContextualTip(newContext);
        }, this.config.contextSwitchDelay);
    }
    
    /**
     * 记录用户交互
     */
    recordUserInteraction(type, target) {
        this.lastInteractionTime = Date.now();
        this.userInteractions.push({
            type,
            target: typeof target === 'string' ? target : target.className || target.tagName,
            timestamp: Date.now()
        });
        
        // 保持最近100个交互记录
        if (this.userInteractions.length > 100) {
            this.userInteractions = this.userInteractions.slice(-100);
        }
    }
    
    /**
     * 生成上下文相关提示
     */
    generateContextualTip(context) {
        if (!this.isEnabled || this.isOnCooldown()) {
            return;
        }
        
        const tip = this.getContextualTipContent(context);
        if (tip && !this.isTipDismissed(tip.id)) {
            this.showTip(tip);
        }
    }
    
    /**
     * 获取上下文相关的提示内容
     */
    getContextualTipContent(context) {
        const tips = {
            // 页面相关提示
            'page-interview': {
                id: 'page-interview',
                title: '语音面试小贴士',
                message: '💡 建议先上传简历以获得个性化面试体验，点击右上角的"简历管理"开始。',
                condition: () => !this.hasResume(),
                priority: 'high'
            },
            'page-resume': {
                id: 'page-resume',
                title: '简历上传指南',
                message: '📄 支持拖拽上传PDF或Word格式的简历文件，上传后AI将根据您的背景进行针对性提问。',
                condition: () => !this.hasResume(),
                priority: 'medium'
            },
            'page-history': {
                id: 'page-history',
                title: '面试记录管理',
                message: '📊 点击任意面试记录可查看详细的评分报告和改进建议，帮助您持续提升面试表现。',
                condition: () => this.hasInterviewHistory(),
                priority: 'low'
            },
            
            // 功能相关提示
            'interview-started': {
                id: 'interview-started',
                title: '面试进行中',
                message: '🎤 您可以随时切换语音和文字输入模式。保持放松，正常发挥即可！',
                condition: () => true,
                priority: 'high'
            },
            'resume-uploaded': {
                id: 'resume-uploaded',
                title: '简历上传成功',
                message: '✅ 现在可以开始个性化面试了！AI将基于您的简历背景进行专业提问。',
                condition: () => true,
                priority: 'high'
            },
            
            // 行为分析提示
            'user-struggling': {
                id: 'user-struggling',
                title: '需要帮助吗？',
                message: '🤔 看起来您可能遇到了困难。可以查看新手引导或联系客服获取帮助。',
                condition: () => this.detectUserStruggling(),
                priority: 'high'
            },
            'feature-discovery': {
                id: 'feature-discovery',
                title: '发现新功能',
                message: '🎯 您知道吗？可以在设置中调整语音识别灵敏度和播放速度，获得更好的体验。',
                condition: () => this.shouldShowFeatureDiscovery(),
                priority: 'low'
            }
        };
        
        const key = `${context.type}-${context.value}`;
        const tip = tips[key];
        
        if (tip && tip.condition()) {
            return tip;
        }
        
        return null;
    }
    
    /**
     * 显示提示
     */
    showTip(tip) {
        const tipElement = document.getElementById('smartTip');
        if (!tipElement) return;
        
        // 更新提示内容
        const titleElement = tipElement.querySelector('.tip-title');
        const messageElement = tipElement.querySelector('.tip-message');
        const iconElement = tipElement.querySelector('.tip-icon i');
        
        titleElement.textContent = tip.title;
        messageElement.textContent = tip.message;
        
        // 根据优先级设置图标和样式
        this.updateTipStyle(tipElement, tip.priority);
        
        // 显示提示
        tipElement.style.display = 'flex';
        tipElement.classList.add('tip-show');
        
        // 记录提示历史
        this.recordTipShown(tip);
        
        // 自动隐藏
        setTimeout(() => {
            this.hideTip();
        }, this.config.tipDisplayDuration);
    }
    
    /**
     * 更新提示样式
     */
    updateTipStyle(tipElement, priority) {
        const iconElement = tipElement.querySelector('.tip-icon i');
        
        // 移除所有优先级类
        tipElement.classList.remove('tip-high', 'tip-medium', 'tip-low');
        iconElement.classList.remove('fa-lightbulb', 'fa-info-circle', 'fa-exclamation-triangle');
        
        // 根据优先级设置样式
        switch (priority) {
            case 'high':
                tipElement.classList.add('tip-high');
                iconElement.classList.add('fa-exclamation-triangle');
                break;
            case 'medium':
                tipElement.classList.add('tip-medium');
                iconElement.classList.add('fa-info-circle');
                break;
            case 'low':
            default:
                tipElement.classList.add('tip-low');
                iconElement.classList.add('fa-lightbulb');
                break;
        }
    }
    
    /**
     * 隐藏提示
     */
    hideTip() {
        const tipElement = document.getElementById('smartTip');
        if (tipElement) {
            tipElement.classList.remove('tip-show');
            setTimeout(() => {
                tipElement.style.display = 'none';
            }, 300);
        }
    }
    
    /**
     * 处理提示操作
     */
    handleTipAction(action) {
        switch (action) {
            case 'dismiss':
                this.dismissCurrentTip();
                break;
            case 'more':
                this.showMoreInfo();
                break;
        }
    }
    
    /**
     * 忽略当前提示
     */
    dismissCurrentTip() {
        const tipElement = document.getElementById('smartTip');
        const tipTitle = tipElement?.querySelector('.tip-title')?.textContent;
        
        if (tipTitle) {
            this.dismissedTips.push(tipTitle);
            localStorage.setItem(this.STORAGE_KEYS.DISMISSED_TIPS, JSON.stringify(this.dismissedTips));
        }
        
        this.hideTip();
    }
    
    /**
     * 分析用户行为
     */
    analyzeUserBehavior() {
        const recentInteractions = this.userInteractions.filter(
            interaction => Date.now() - interaction.timestamp < 60000 // 最近1分钟
        );
        
        // 检测用户是否在某个功能上停留过久
        if (recentInteractions.length < 3 && this.currentContext) {
            this.generateBehaviorTip('low-activity');
        }
    }
    
    /**
     * 生成行为分析提示
     */
    generateBehaviorTip(behaviorType) {
        const tips = {
            'low-activity': {
                id: 'low-activity',
                title: '探索更多功能',
                message: '🔍 试试上传简历或查看面试历史，发现更多有用的功能！',
                condition: () => true,
                priority: 'low'
            }
        };
        
        const tip = tips[behaviorType];
        if (tip && tip.condition() && !this.isTipDismissed(tip.id)) {
            this.showTip(tip);
        }
    }
    
    /**
     * 处理用户空闲
     */
    handleUserIdle() {
        if (this.isEnabled && !this.isOnCooldown()) {
            const idleTip = {
                id: 'user-idle',
                title: '还在吗？',
                message: '💭 如果需要帮助，可以查看新手引导或尝试开始一次面试练习。',
                priority: 'low'
            };
            
            if (!this.isTipDismissed(idleTip.id)) {
                this.showTip(idleTip);
            }
        }
    }
    
    /**
     * 辅助方法
     */
    hasResume() {
        return localStorage.getItem('azure_current_resume') !== null;
    }
    
    hasInterviewHistory() {
        const history = localStorage.getItem('interview_history');
        return history && JSON.parse(history).length > 0;
    }
    
    detectUserStruggling() {
        // 简单的困难检测：频繁的点击但没有明显进展
        const recentClicks = this.userInteractions.filter(
            i => i.type === 'click' && Date.now() - i.timestamp < 30000
        );
        return recentClicks.length > 10;
    }
    
    shouldShowFeatureDiscovery() {
        // 用户使用了一段时间但没有探索高级功能
        return this.tipHistory.length > 3 && !this.hasUsedAdvancedFeatures();
    }
    
    hasUsedAdvancedFeatures() {
        // 检查是否使用过高级功能（简化实现）
        return localStorage.getItem('used_advanced_features') === 'true';
    }
    
    isOnCooldown() {
        const lastTipTime = this.tipHistory[this.tipHistory.length - 1]?.timestamp || 0;
        return Date.now() - lastTipTime < this.config.tipCooldown;
    }
    
    isTipDismissed(tipId) {
        return this.dismissedTips.includes(tipId);
    }
    
    recordTipShown(tip) {
        this.tipHistory.push({
            id: tip.id,
            title: tip.title,
            timestamp: Date.now()
        });
        
        // 保持最近50个提示记录
        if (this.tipHistory.length > 50) {
            this.tipHistory = this.tipHistory.slice(-50);
        }
        
        localStorage.setItem(this.STORAGE_KEYS.TIPS_HISTORY, JSON.stringify(this.tipHistory));
    }
    
    /**
     * 启用/禁用智能提示
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        localStorage.setItem(this.STORAGE_KEYS.TIPS_ENABLED, enabled.toString());
        
        if (!enabled) {
            this.hideTip();
        }
    }
    
    /**
     * 重置提示历史
     */
    resetTipHistory() {
        this.tipHistory = [];
        this.dismissedTips = [];
        localStorage.removeItem(this.STORAGE_KEYS.TIPS_HISTORY);
        localStorage.removeItem(this.STORAGE_KEYS.DISMISSED_TIPS);
    }
    
    /**
     * 手动触发提示
     */
    triggerTip(tipId) {
        const context = { type: 'manual', value: tipId, timestamp: Date.now() };
        this.generateContextualTip(context);
    }
}

// 全局智能提示系统实例
window.smartTips = null;

// 初始化智能提示系统
document.addEventListener('DOMContentLoaded', () => {
    window.smartTips = new SmartTipsSystem();
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartTipsSystem;
}
