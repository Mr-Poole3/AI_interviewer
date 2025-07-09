/**
 * Azure语音面试官前端应用
 *
 * 基于Azure OpenAI实时语音模型的智能面试系统
 * 支持WebSocket流式通信、语音输出播放、简历上传等功能
 */

/**
 * 面试设置管理器
 */
class InterviewSettingsManager {
    constructor() {
        this.STORAGE_KEY = 'azure_interview_settings';
        this.defaultSettings = {
            voice: {
                threshold: 0.5,           // 语音检测阈值
                silence_duration_ms: 1500, // 静音时长
                prefix_padding_ms: 300,    // 前缀缓冲
            },
            audio: {
                volume: 1.0,              // 音量 (0.0-1.0)
                playbackRate: 1.0,        // 播放速度 (0.5-2.0)
            },
            ui: {
                theme: 'default',         // 主题
                showAdvanced: false       // 显示高级选项
            }
        };

        this.currentSettings = this.loadSettings();
    }

    /**
     * 加载设置
     */
    loadSettings() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const settings = JSON.parse(stored);
                // 合并默认设置和存储的设置，确保新增的设置项有默认值
                return this.mergeSettings(this.defaultSettings, settings);
            }
        } catch (e) {
            console.error('加载设置失败:', e);
        }
        return { ...this.defaultSettings };
    }

    /**
     * 保存设置
     */
    saveSettings(settings = null) {
        try {
            const toSave = settings || this.currentSettings;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
            if (settings) {
                this.currentSettings = { ...toSave };
            }
            return true;
        } catch (e) {
            console.error('保存设置失败:', e);
            return false;
        }
    }

    /**
     * 获取当前设置
     */
    getSettings() {
        return { ...this.currentSettings };
    }

    /**
     * 更新设置
     */
    updateSettings(newSettings) {
        this.currentSettings = this.mergeSettings(this.currentSettings, newSettings);
        return this.saveSettings();
    }

    /**
     * 重置为默认设置
     */
    resetToDefaults() {
        this.currentSettings = { ...this.defaultSettings };
        return this.saveSettings();
    }

    /**
     * 深度合并设置对象
     */
    mergeSettings(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    result[key] = this.mergeSettings(target[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * 获取语音设置
     */
    getVoiceSettings() {
        return { ...this.currentSettings.voice };
    }

    /**
     * 获取音频设置
     */
    getAudioSettings() {
        return { ...this.currentSettings.audio };
    }

    /**
     * 更新语音设置
     */
    updateVoiceSettings(voiceSettings) {
        return this.updateSettings({ voice: voiceSettings });
    }

    /**
     * 更新音频设置
     */
    updateAudioSettings(audioSettings) {
        return this.updateSettings({ audio: audioSettings });
    }
}

/**
 * 评分状态管理器
 */
class EvaluationStatusManager {
    constructor() {
        this.STORAGE_KEY = 'azure_evaluation_status';
        this.evaluationStatuses = this.loadStatuses();
        this.statusCheckInterval = null;
    }

    /**
     * 加载评分状态
     */
    loadStatuses() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('加载评分状态失败:', e);
            return {};
        }
    }

    /**
     * 保存评分状态
     */
    saveStatuses() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.evaluationStatuses));
            return true;
        } catch (e) {
            console.error('保存评分状态失败:', e);
            return false;
        }
    }

    /**
     * 设置面试评分状态
     */
    setEvaluationStatus(interviewId, status, metadata = {}) {
        this.evaluationStatuses[interviewId] = {
            status: status, // 'pending', 'evaluating', 'completed', 'failed'
            timestamp: new Date().toISOString(),
            ...metadata
        };
        this.saveStatuses();
        console.log(`评分状态已更新: ${interviewId} -> ${status}`);
    }

    /**
     * 获取面试评分状态
     */
    getEvaluationStatus(interviewId) {
        return this.evaluationStatuses[interviewId] || { status: 'unknown' };
    }

    /**
     * 获取所有评分中的面试
     */
    getEvaluatingInterviews() {
        return Object.entries(this.evaluationStatuses)
            .filter(([id, status]) => status.status === 'evaluating')
            .map(([id, status]) => ({ id, ...status }));
    }

    /**
     * 清理过期的评分状态
     */
    cleanupExpiredStatuses() {
        const now = new Date();
        const expiredThreshold = 24 * 60 * 60 * 1000; // 24小时

        let hasChanges = false;
        for (const [id, status] of Object.entries(this.evaluationStatuses)) {
            const statusTime = new Date(status.timestamp);
            if (now - statusTime > expiredThreshold && status.status === 'evaluating') {
                // 将超时的评分状态标记为失败
                this.evaluationStatuses[id].status = 'failed';
                this.evaluationStatuses[id].failureReason = 'timeout';
                hasChanges = true;
            }
        }

        if (hasChanges) {
            this.saveStatuses();
        }
    }

    /**
     * 开始状态检查定时器
     */
    startStatusCheck() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }

        // 每30秒检查一次状态
        this.statusCheckInterval = setInterval(() => {
            this.cleanupExpiredStatuses();
            this.checkEvaluatingInterviews();
        }, 30000);
    }

    /**
     * 停止状态检查定时器
     */
    stopStatusCheck() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }

    /**
     * 检查评分中的面试状态
     */
    async checkEvaluatingInterviews() {
        const evaluatingInterviews = this.getEvaluatingInterviews();

        for (const interview of evaluatingInterviews) {
            try {
                // 检查评分是否完成
                const response = await fetch(`/api/interview/evaluation-status/${interview.id}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'completed') {
                        this.setEvaluationStatus(interview.id, 'completed', {
                            evaluation: result.evaluation
                        });

                        // 触发评分完成事件
                        this.onEvaluationCompleted(interview.id, result.evaluation);
                    } else if (result.status === 'failed') {
                        this.setEvaluationStatus(interview.id, 'failed', {
                            error: result.error
                        });
                    }
                }
            } catch (error) {
                console.error(`检查面试 ${interview.id} 评分状态失败:`, error);
            }
        }
    }

    /**
     * 评分完成回调
     */
    onEvaluationCompleted(interviewId, evaluation) {
        console.log(`面试 ${interviewId} 评分完成:`, evaluation);

        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('evaluationCompleted', {
            detail: { interviewId, evaluation }
        }));
    }
}

/**
 * LocalStorage数据管理器
 */
class LocalStorageManager {
    constructor() {
        this.KEYS = {
            INTERVIEWS: 'azure_interviews_history',
            CURRENT_RESUME: 'azure_current_resume',
            APP_SETTINGS: 'azure_app_settings'
        };
    }

    // 检查localStorage是否可用
    isSupported() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    // 保存面试记录
    saveInterview(interview) {
        try {
            const interviews = this.getInterviews();

            // 如果面试记录已有ID，尝试更新现有记录
            if (interview.id) {
                const existingIndex = interviews.findIndex(item => item.id === interview.id);
                if (existingIndex !== -1) {
                    // 更新现有记录，保留原始创建时间
                    const existingInterview = interviews[existingIndex];
                    interview.createdAt = existingInterview.createdAt || interview.createdAt;
                    interviews[existingIndex] = interview;
                    console.log('更新现有面试记录:', interview.id);
                } else {
                    // ID存在但找不到记录，作为新记录处理
                    if (!interview.createdAt) {
                        interview.createdAt = new Date().toISOString();
                    }
                    interviews.unshift(interview);
                    console.log('保存新面试记录:', interview.id);
                }
            } else {
                // 没有ID，创建新记录
                interview.id = Date.now().toString();
                interview.createdAt = new Date().toISOString();
                interviews.unshift(interview);
                console.log('创建新面试记录:', interview.id);
            }

            // 限制最大数量，防止占用过多空间
            if (interviews.length > 50) {
                interviews.splice(50);
            }

            localStorage.setItem(this.KEYS.INTERVIEWS, JSON.stringify(interviews));
            return true;
        } catch (e) {
            console.error('保存面试记录失败:', e);
            return false;
        }
    }

    // 获取所有面试记录
    getInterviews() {
        try {
            const data = localStorage.getItem(this.KEYS.INTERVIEWS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('读取面试记录失败:', e);
            return [];
        }
    }

    // 更新现有面试记录
    updateInterview(interview) {
        try {
            const interviews = this.getInterviews();
            const existingIndex = interviews.findIndex(item => item.id === interview.id);

            if (existingIndex !== -1) {
                // 保留原始创建时间和ID
                const existingInterview = interviews[existingIndex];
                interview.createdAt = existingInterview.createdAt;
                interview.id = existingInterview.id;

                // 更新记录
                interviews[existingIndex] = interview;
                localStorage.setItem(this.KEYS.INTERVIEWS, JSON.stringify(interviews));
                console.log('面试记录已更新:', interview.id);
                return true;
            } else {
                console.warn('未找到要更新的面试记录:', interview.id);
                return false;
            }
        } catch (e) {
            console.error('更新面试记录失败:', e);
            return false;
        }
    }

    // 删除面试记录
    deleteInterview(id) {
        try {
            const interviews = this.getInterviews();
            const filtered = interviews.filter(interview => interview.id !== id);
            localStorage.setItem(this.KEYS.INTERVIEWS, JSON.stringify(filtered));
            return true;
        } catch (e) {
            console.error('删除面试记录失败:', e);
            return false;
        }
    }

    // 清空所有面试记录
    clearInterviews() {
        try {
            localStorage.removeItem(this.KEYS.INTERVIEWS);
            return true;
        } catch (e) {
            console.error('清空面试记录失败:', e);
            return false;
        }
    }

    // 保存当前简历信息
    saveCurrentResume(resumeData) {
        try {
            const enhancedResumeData = {
                fileName: resumeData.fileName,
                sessionId: resumeData.sessionId,
                preview: resumeData.preview,
                textLength: resumeData.textLength,
                uploadedAt: resumeData.uploadedAt || new Date().toISOString(),
                fullText: resumeData.fullText || resumeData.preview,
                version: '2.0'
            };
            
            localStorage.setItem(this.KEYS.CURRENT_RESUME, JSON.stringify(enhancedResumeData));
            console.log('简历信息已保存到本地存储');
            return true;
        } catch (e) {
            console.error('保存简历信息失败:', e);
            return false;
        }
    }

    // 获取当前简历信息
    getCurrentResume() {
        try {
            const data = localStorage.getItem(this.KEYS.CURRENT_RESUME);
            if (!data) return null;
            
            const resumeData = JSON.parse(data);
            return resumeData;
        } catch (e) {
            console.error('读取简历信息失败:', e);
            return null;
        }
    }

    // 删除简历信息
    removeCurrentResume() {
        try {
            localStorage.removeItem(this.KEYS.CURRENT_RESUME);
            return true;
        } catch (e) {
            console.error('删除简历信息失败:', e);
            return false;
        }
    }
}

/**
 * 页面路由管理器
 */
class PageRouter {
    constructor() {
        this.currentPage = 'interview';
        this.pages = ['interview', 'history', 'resume'];
        this.pageElements = {};
        this.navButtons = {};
        
        this.init();
    }

    init() {
        // 获取页面元素
        this.pages.forEach(page => {
            this.pageElements[page] = document.getElementById(`${page}Page`);
            this.navButtons[page] = document.getElementById(`nav${page.charAt(0).toUpperCase() + page.slice(1)}`);
        });

        // 绑定导航事件
        Object.keys(this.navButtons).forEach(page => {
            if (this.navButtons[page]) {
                this.navButtons[page].addEventListener('click', () => {
                    this.navigateTo(page);
                });
            }
        });

        // 显示初始页面
        this.showPage('interview');
    }

    navigateTo(page) {
        if (!this.pages.includes(page)) {
            console.error(`未知页面: ${page}`);
            return;
        }

        this.showPage(page);
        this.updateNavigation(page);
        this.currentPage = page;

        // 触发页面切换事件
        window.dispatchEvent(new CustomEvent('pageChanged', { detail: { page } }));
    }

    showPage(page) {
        // 隐藏所有页面
        Object.values(this.pageElements).forEach(element => {
            if (element) element.style.display = 'none';
        });

        // 显示目标页面
        if (this.pageElements[page]) {
            this.pageElements[page].style.display = 'block';
        }
    }

    updateNavigation(activePage) {
        // 更新导航按钮状态
        Object.keys(this.navButtons).forEach(page => {
            if (this.navButtons[page]) {
                if (page === activePage) {
                    this.navButtons[page].classList.add('active');
                } else {
                    this.navButtons[page].classList.remove('active');
                }
            }
        });
    }

    showNavigation() {
        const navbar = document.getElementById('navbar');
        if (navbar) navbar.style.display = 'block';
    }

    hideNavigation() {
        const navbar = document.getElementById('navbar');
        if (navbar) navbar.style.display = 'none';
    }

    getCurrentPage() {
        return this.currentPage;
    }
}

/**
 * Azure语音聊天管理器
 */
class AzureVoiceChat {
    constructor() {
        this.ws = null;
        this.audioContext = null;
        this.audioQueue = [];
        this.isStreamingAudio = false;
        this.audioSampleRate = 24000;
        this.allAudioData = [];
        this.audioSources = [];
        this.lastPlayTime = 0;
        this.currentSessionId = '';

        // 设置管理器
        this.settingsManager = new InterviewSettingsManager();

        // 评分状态管理器
        this.evaluationStatusManager = new EvaluationStatusManager();

        // 面试记录相关
        this.currentInterviewMessages = [];
        this.interviewStartTime = null;
        this.isInterviewActive = false;
        this.currentInterviewId = null;

        this.initElements();
        this.bindEvents();
        this.initAudio();
        this.setInitialStatus();
        this.initPreparationSettings();
        this.initEvaluationStatusManager();
    }
    
    initElements() {
        this.chatMessages = document.getElementById('chatMessages');
        this.voiceCallButton = document.getElementById('voiceCallButton');
        this.heroStartButton = document.getElementById('heroStartButton');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.voiceHint = document.getElementById('voiceHint');
    }
    
    setInitialStatus() {
        this.setStatus('正在连接Azure语音服务...', 'connecting');
        if (this.voiceHint) {
            this.voiceHint.textContent = '正在连接Azure语音服务...';
        }
    }

    /**
     * 初始化准备页面设置功能
     */
    initPreparationSettings() {
        // 获取设置面板相关元素
        this.preparationSettingsButton = document.getElementById('preparationSettingsButton');
        this.preparationSettingsPanel = document.getElementById('preparationSettingsPanel');
        this.closePreparationSettings = document.getElementById('closePreparationSettings');
        this.resetPreparationSettings = document.getElementById('resetPreparationSettings');
        this.applyPreparationSettings = document.getElementById('applyPreparationSettings');

        // 获取设置控件元素
        this.prepVoiceSensitivity = document.getElementById('prepVoiceSensitivity');
        this.prepVoiceSensitivityValue = document.getElementById('prepVoiceSensitivityValue');
        this.prepSilenceDuration = document.getElementById('prepSilenceDuration');
        this.prepSilenceDurationValue = document.getElementById('prepSilenceDurationValue');
        this.prepPrefixPadding = document.getElementById('prepPrefixPadding');
        this.prepPrefixPaddingValue = document.getElementById('prepPrefixPaddingValue');
        this.prepAudioVolume = document.getElementById('prepAudioVolume');
        this.prepAudioVolumeValue = document.getElementById('prepAudioVolumeValue');
        this.prepPlaybackSpeed = document.getElementById('prepPlaybackSpeed');
        this.prepPlaybackSpeedValue = document.getElementById('prepPlaybackSpeedValue');

        // 绑定事件
        this.bindPreparationSettingsEvents();

        // 加载当前设置到界面
        this.loadSettingsToUI();
    }

    /**
     * 绑定准备页面设置事件
     */
    bindPreparationSettingsEvents() {
        // 设置按钮点击事件
        if (this.preparationSettingsButton) {
            this.preparationSettingsButton.addEventListener('click', () => {
                this.showPreparationSettings();
            });
        }

        // 关闭设置面板
        if (this.closePreparationSettings) {
            this.closePreparationSettings.addEventListener('click', () => {
                this.hidePreparationSettings();
            });
        }

        // 重置设置
        if (this.resetPreparationSettings) {
            this.resetPreparationSettings.addEventListener('click', () => {
                this.resetSettingsToDefaults();
            });
        }

        // 应用设置
        if (this.applyPreparationSettings) {
            this.applyPreparationSettings.addEventListener('click', () => {
                this.applyCurrentSettings();
            });
        }

        // 滑块值变化事件
        this.bindSliderEvents();

        // 点击面板外部关闭
        document.addEventListener('click', (e) => {
            if (this.preparationSettingsPanel &&
                this.preparationSettingsPanel.style.display === 'block' &&
                !this.preparationSettingsPanel.contains(e.target) &&
                !this.preparationSettingsButton.contains(e.target)) {
                this.hidePreparationSettings();
            }
        });
    }

    /**
     * 绑定滑块事件
     */
    bindSliderEvents() {
        // 语音敏感度
        if (this.prepVoiceSensitivity) {
            this.prepVoiceSensitivity.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.prepVoiceSensitivityValue.textContent = value.toFixed(1);
            });
        }

        // 静音时长
        if (this.prepSilenceDuration) {
            this.prepSilenceDuration.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.prepSilenceDurationValue.textContent = `${value}ms`;
            });
        }

        // 语音缓冲
        if (this.prepPrefixPadding) {
            this.prepPrefixPadding.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.prepPrefixPaddingValue.textContent = `${value}ms`;
            });
        }

        // 音量
        if (this.prepAudioVolume) {
            this.prepAudioVolume.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.prepAudioVolumeValue.textContent = `${Math.round(value * 100)}%`;
            });
        }

        // 播放速度
        if (this.prepPlaybackSpeed) {
            this.prepPlaybackSpeed.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.prepPlaybackSpeedValue.textContent = `${value.toFixed(1)}x`;
            });
        }
    }

    /**
     * 显示准备页面设置面板
     */
    showPreparationSettings() {
        if (this.preparationSettingsPanel) {
            this.preparationSettingsPanel.style.display = 'block';
            this.loadSettingsToUI();
            console.log('显示面试设置面板');
        }
    }

    /**
     * 隐藏准备页面设置面板
     */
    hidePreparationSettings() {
        if (this.preparationSettingsPanel) {
            this.preparationSettingsPanel.style.display = 'none';
            console.log('隐藏面试设置面板');
        }
    }

    /**
     * 加载设置到UI
     */
    loadSettingsToUI() {
        const settings = this.settingsManager.getSettings();

        // 加载语音设置
        if (this.prepVoiceSensitivity) {
            this.prepVoiceSensitivity.value = settings.voice.threshold;
            this.prepVoiceSensitivityValue.textContent = settings.voice.threshold.toFixed(1);
        }

        if (this.prepSilenceDuration) {
            this.prepSilenceDuration.value = settings.voice.silence_duration_ms;
            this.prepSilenceDurationValue.textContent = `${settings.voice.silence_duration_ms}ms`;
        }

        if (this.prepPrefixPadding) {
            this.prepPrefixPadding.value = settings.voice.prefix_padding_ms;
            this.prepPrefixPaddingValue.textContent = `${settings.voice.prefix_padding_ms}ms`;
        }

        // 加载音频设置
        if (this.prepAudioVolume) {
            this.prepAudioVolume.value = settings.audio.volume;
            this.prepAudioVolumeValue.textContent = `${Math.round(settings.audio.volume * 100)}%`;
        }

        if (this.prepPlaybackSpeed) {
            this.prepPlaybackSpeed.value = settings.audio.playbackRate;
            this.prepPlaybackSpeedValue.textContent = `${settings.audio.playbackRate.toFixed(1)}x`;
        }
    }

    /**
     * 重置设置为默认值
     */
    resetSettingsToDefaults() {
        this.settingsManager.resetToDefaults();
        this.loadSettingsToUI();
        console.log('设置已重置为默认值');
    }

    /**
     * 应用当前设置
     */
    applyCurrentSettings() {
        const newSettings = {
            voice: {
                threshold: parseFloat(this.prepVoiceSensitivity.value),
                silence_duration_ms: parseInt(this.prepSilenceDuration.value),
                prefix_padding_ms: parseInt(this.prepPrefixPadding.value)
            },
            audio: {
                volume: parseFloat(this.prepAudioVolume.value),
                playbackRate: parseFloat(this.prepPlaybackSpeed.value)
            }
        };

        if (this.settingsManager.updateSettings(newSettings)) {
            console.log('设置已保存:', newSettings);

            // 如果有活跃的语音通话，更新配置
            if (this.voiceCallManager) {
                if (this.voiceCallManager.isConnected) {
                    this.voiceCallManager.updateVADConfig(newSettings.voice);
                }
                this.voiceCallManager.updateAudioSettings(newSettings.audio);
            }

            this.hidePreparationSettings();
        } else {
            console.error('设置保存失败');
        }
    }

    /**
     * 获取当前设置
     */
    getCurrentSettings() {
        return this.settingsManager.getSettings();
    }

    /**
     * 初始化评分状态管理器
     */
    initEvaluationStatusManager() {
        // 启动状态检查
        this.evaluationStatusManager.startStatusCheck();

        // 绑定评分完成事件
        window.addEventListener('evaluationCompleted', (event) => {
            const { interviewId, evaluation } = event.detail;
            this.onEvaluationCompleted(interviewId, evaluation);
        });

        console.log('评分状态管理器已初始化');
    }

    /**
     * 评分完成处理
     */
    onEvaluationCompleted(interviewId, evaluation) {
        console.log(`面试 ${interviewId} 评分完成`, evaluation);

        // 更新本地存储中的面试记录
        if (this.app && this.app.storageManager) {
            const interviews = this.app.storageManager.getInterviews();
            const interview = interviews.find(item => item.id === interviewId);

            if (interview) {
                interview.evaluation = evaluation;
                interview.score = evaluation.total_score;
                interview.evaluationStatus = 'completed';

                if (!interview.summary && evaluation.summary) {
                    interview.summary = evaluation.summary;
                }

                this.app.storageManager.saveInterview(interview);
                console.log('面试记录评分信息已更新');

                // 如果当前在历史记录页面，刷新显示
                if (this.app.router.currentPage === 'history') {
                    this.app.historyManager.refreshHistoryList();
                }
            }
        }

        // 显示评分完成通知
        this.showEvaluationCompleteNotification(interviewId);
    }

    /**
     * 显示评分完成通知
     */
    showEvaluationCompleteNotification(interviewId) {
        const notification = document.createElement('div');
        notification.className = 'evaluation-complete-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="notification-text">
                    <h4>面试评分已完成！</h4>
                    <p>您的面试结果已生成，点击查看详细评分报告</p>
                </div>
                <div class="notification-actions">
                    <button class="btn-primary btn-sm" onclick="window.app.router.navigateTo('history'); this.parentElement.parentElement.parentElement.remove();">
                        查看结果
                    </button>
                    <button class="notification-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            max-width: 400px;
            animation: slideInRight 0.5s ease-out;
        `;

        // 添加到页面
        document.body.appendChild(notification);

        // 自动移除（15秒后）
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.5s ease-out';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 500);
            }
        }, 15000);
    }
    
    bindEvents() {
        // 保存绑定的函数引用，以便后续移除
        this.startInterviewHandler = () => {
            this.startInterview();
        };
        
        this.startActualInterviewHandler = () => {
            this.startActualInterview();
        };
        
        // 语音通话按钮事件
        if (this.voiceCallButton) {
            this.voiceCallButton.addEventListener('click', this.startInterviewHandler);
        }
        
        // 欢迎界面开始面试按钮事件
        if (this.heroStartButton) {
            this.heroStartButton.addEventListener('click', this.startInterviewHandler);
        }
    }
    
    startInterview() {
        console.log('开始面试按钮被点击');
        
        // 检查连接状态
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('WebSocket未连接，显示连接提示');
            alert('正在连接语音服务，请稍候...');
            return;
        }
        
        // 显示准备页面阶段
        this.showPreparationStage();
    }
    
    showPreparationStage() {
        console.log('显示面试准备页面');
        
        // 切换到聊天界面但保持在准备状态
        const welcomeSection = document.querySelector('.interview-welcome');
        const chatSection = document.querySelector('.interview-chat');
        
        if (welcomeSection && chatSection) {
            console.log('切换到准备界面');
            welcomeSection.style.display = 'none';
            chatSection.style.display = 'flex';
            chatSection.classList.add('preparation-mode');
        }
        
        // 更新语音控制按钮为真正的开始面试
        if (this.voiceCallButton) {
            const btnText = this.voiceCallButton.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = '确认开始面试';
            }
            
            // 移除旧的事件监听器并添加新的
            this.voiceCallButton.removeEventListener('click', this.startInterviewHandler);
            this.voiceCallButton.addEventListener('click', this.startActualInterviewHandler);
        }
        
        // 更新状态提示
        if (this.voiceHint) {
            this.voiceHint.textContent = '确认开始您的AI语音面试';
        }
    }
    
    startActualInterview() {
        console.log('确认开始实际面试');
        
        // 移除准备模式样式
        const chatSection = document.querySelector('.interview-chat');
        if (chatSection) {
            chatSection.classList.remove('preparation-mode');
            chatSection.classList.add('active');
        }
        
        // 开始记录面试
        this.startInterviewRecording();
        
        // 恢复按钮原始状态和文本
        if (this.voiceCallButton) {
            const btnText = this.voiceCallButton.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = '开始面试';
            }
            
            // 恢复原始的事件监听器
            this.voiceCallButton.removeEventListener('click', this.startActualInterviewHandler);
            this.voiceCallButton.addEventListener('click', this.startInterviewHandler);
        }
        
        // 启动语音通话
        if (this.app && this.app.voiceCallManager) {
            console.log('启动语音通话管理器');
            this.app.voiceCallManager.startVoiceCall();
        } else {
            console.log('语音通话管理器未初始化，等待初始化完成...');
            // 等待语音通话管理器初始化完成
            const checkVoiceManager = () => {
                if (this.app && this.app.voiceCallManager) {
                    console.log('语音通话管理器已初始化，启动语音通话');
                    this.app.voiceCallManager.startVoiceCall();
                } else {
                    console.log('继续等待语音通话管理器初始化...');
                    setTimeout(checkVoiceManager, 100);
                }
            };
            checkVoiceManager();
        }
    }
    
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.audioSampleRate
            });
            
            // 确保音频上下文处于运行状态
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            console.log('音频上下文初始化成功, 采样率:', this.audioContext.sampleRate);
        } catch (error) {
            console.error('音频初始化失败:', error);
        }
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/voice`;
        
        console.log('正在连接Azure语音服务:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Azure语音WebSocket连接已建立');
            this.setStatus('已连接 - Azure语音服务', 'connected');
            this.enableInput();
            this.hideLoadingOverlay();
            

        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('Azure语音WebSocket连接已断开');
            this.setStatus('连接断开', 'error');
            this.disableInput();
            this.showLoadingOverlay('连接断开，正在重连...');
            // 5秒后重连
            setTimeout(() => this.connect(), 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('Azure语音WebSocket错误:', error);
            this.setStatus('连接错误', 'error');
            this.showLoadingOverlay('连接错误，正在重试...');
        };
    }
    

    setStatus(text, className = '') {
        const statusElement = document.querySelector('.status-text');
        const connectionIndicator = document.querySelector('.connection-indicator');
        
        if (statusElement) {
            statusElement.textContent = text;
        }
        
        if (connectionIndicator) {
            const statusDot = connectionIndicator.querySelector('.status-dot');
            if (statusDot) {
                // 移除所有状态类
                statusDot.classList.remove('connected', 'connecting', 'disconnected', 'error');
                
                // 根据className设置状态
                switch (className) {
                    case 'connected':
                        statusDot.classList.add('connected');
                        break;
                    case 'connecting':
                        statusDot.classList.add('connecting');
                        break;
                    case 'error':
                    case 'disconnected':
                        statusDot.classList.add('disconnected');
                        break;
                    default:
                        statusDot.classList.add('connecting');
                }
            }
        }
        
        // 同时更新状态面板（如果存在）
        if (this.app && this.app.voiceCallManager) {
            switch (className) {
                case 'connected':
                    this.app.voiceCallManager.updateConnectionStatus('connected', text);
                    break;
                case 'connecting':
                    this.app.voiceCallManager.updateConnectionStatus('connecting', text);
                    break;
                case 'error':
                case 'disconnected':
                    this.app.voiceCallManager.updateConnectionStatus('disconnected', text);
                    break;
                default:
                    this.app.voiceCallManager.updateConnectionStatus('connecting', text);
            }
        }
        
        console.log('状态更新:', text, className);
    }
    
    showLoadingOverlay(text = '正在连接天汇AI面试官') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingTitle = overlay?.querySelector('.loading-title');
        const loadingSubtitle = overlay?.querySelector('.loading-subtitle');
        if (overlay) {
            if (loadingTitle) {
                loadingTitle.textContent = text;
            }
            if (loadingSubtitle) {
                loadingSubtitle.textContent = '请稍候，正在初始化语音服务...';
            }
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
        }
    }
    
    hideLoadingOverlay() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
        
        // 隐藏加载动画后，更新状态
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.setStatus('已连接 - Azure语音服务', 'connected');
            if (this.voiceHint) {
                this.voiceHint.textContent = '点击开始语音对话';
            }
        }
    }
    
    resetAudioState() {
        // 停止所有正在播放的音频源
        this.audioSources.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // 忽略已停止的音频源
            }
        });
        
        this.isStreamingAudio = false;
        this.audioQueue = [];
        this.allAudioData = [];
        this.audioSources = [];
        this.lastPlayTime = 0;
    }

    addMessage(content, type = 'assistant') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        // 创建头像
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        if (type === 'assistant') {
            avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
        } else {
            avatarDiv.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        // 创建消息内容容器
        const contentContainer = document.createElement('div');
        contentContainer.className = 'message-content';
        
        // 创建消息气泡
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        
        // 创建消息文本
        const textDiv = document.createElement('p');
        textDiv.className = 'message-text';
        textDiv.textContent = content;
        
        // 创建时间戳
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // 组装消息结构
        bubbleDiv.appendChild(textDiv);
        contentContainer.appendChild(bubbleDiv);
        contentContainer.appendChild(timeDiv);
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentContainer);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        // 记录消息到面试记录
        if (content.trim()) {
            this.recordMessage(content, type);
        }
        
        return messageDiv;
    }

    handleMessage(data) {
        switch (data.type) {
            case 'text_delta':
                this.handleTextDelta(data.content);
                break;
            case 'audio_delta':
                this.handleAudioDelta(data.audio_data);
                break;
            case 'transcript_delta':
                console.log('音频转录:', data.content);
                break;
            case 'audio_done':
                this.handleAudioDone();
                break;
            case 'response_done':
                this.handleResponseDone();
                break;
            case 'interrupt_acknowledged':
                this.handleInterruptAcknowledged();
                break;
            case 'error':
                this.setStatus(data.message, 'error');
                break;
        }
    }
    
    handleTextDelta(content) {
        // 查找最后一个助手消息或创建新的
        let lastMessage = this.chatMessages.querySelector('.message.assistant:last-of-type');
        if (!lastMessage || lastMessage.dataset.completed === 'true') {
            lastMessage = this.addMessage('', 'assistant');
            
            // 添加流式指示器
            const streamingIndicator = document.createElement('span');
            streamingIndicator.className = 'streaming-indicator';
            streamingIndicator.title = '正在流式播放语音';
            lastMessage.appendChild(streamingIndicator);
            
            // 触发AI回复开始事件
            this.dispatchAIResponseEvent('start');
        }
        
        // 更新文本内容
        const textDiv = lastMessage.querySelector('.message-text');
        if (textDiv) {
        textDiv.textContent += content;
        }
        
        this.scrollToBottom();
    }
    
    async handleAudioDelta(audioData) {
        if (!this.audioContext || !audioData) return;
        
        try {
            // 如果是第一个音频块，触发音频播放开始事件
            if (!this.isStreamingAudio) {
                this.isStreamingAudio = true;
                this.dispatchAudioPlaybackEvent('start');
            }
            
            // 解码base64音频数据
            const binaryString = atob(audioData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
            }
            
            // 存储所有音频数据
            this.allAudioData.push(bytes);
            
            // 将音频数据加入队列
            this.audioQueue.push(bytes);
            
            // 立即处理音频队列
            this.processAudioQueue();
            
        } catch (error) {
            console.error('音频处理错误:', error);
        }
    }
    
    async processAudioQueue() {
        // 如果队列中有足够的数据，立即播放
        if (this.audioQueue.length > 0) {
            const audioChunk = this.audioQueue.shift();
            await this.playAudioChunk(audioChunk);
        }
    }
    
    async playAudioChunk(audioChunk) {
        try {
            // 创建音频缓冲区
            const audioBuffer = await this.createAudioBuffer(audioChunk);
            
            if (audioBuffer && audioBuffer.duration > 0) {
                // 创建音频源
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.audioContext.destination);
                
                // 计算播放时间，确保连续播放
                const currentTime = this.audioContext.currentTime;
                const startTime = Math.max(currentTime, this.lastPlayTime);
                
                // 播放音频
                source.start(startTime);
                
                // 更新最后播放时间
                this.lastPlayTime = startTime + audioBuffer.duration;
                
                // 存储音频源以便管理
                this.audioSources.push(source);
                
                // 音频播放完成后清理
                source.onended = () => {
                    const index = this.audioSources.indexOf(source);
                    if (index > -1) {
                        this.audioSources.splice(index, 1);
                    }
                };
                
                console.log(`播放音频块 - 长度: ${audioBuffer.duration.toFixed(3)}秒, 开始时间: ${startTime.toFixed(3)}, 队列长度: ${this.audioQueue.length}`);
            }
            
        } catch (error) {
            console.error('播放音频块错误:', error);
        }
    }
    
    async handleAudioDone() {
        // 播放剩余队列中的音频
        while (this.audioQueue.length > 0) {
            const audioChunk = this.audioQueue.shift();
            await this.playAudioChunk(audioChunk);
        }
        
        // 移除流式指示器并添加最终的音频播放器
        const lastMessage = this.chatMessages.querySelector('.message.assistant:last-of-type');
        if (lastMessage) {
            // 移除流式指示器
            const indicator = lastMessage.querySelector('.streaming-indicator');
            if (indicator) {
                indicator.remove();
            }
            
            // 标记消息完成
            lastMessage.dataset.completed = 'true';
            
            // 等待一段时间后创建重播音频，确保流式播放完成
            setTimeout(async () => {
                await this.createReplayAudio(lastMessage);
            }, 1000);
        }
        
        // 触发音频播放结束事件
        this.dispatchAudioPlaybackEvent('end');
        
        console.log('音频流播放完成');
    }
    
    handleResponseDone() {
        this.setStatus('已连接 - Azure语音服务', 'connected');
        
        // 触发AI回复结束事件
        this.dispatchAIResponseEvent('end');
    }
    
    handleInterruptAcknowledged() {
        console.log('服务器确认打断请求');
        
        // 立即停止音频播放
        this.resetAudioState();
        
        // 触发音频播放结束事件
        this.dispatchAudioPlaybackEvent('end');
        
        // 触发AI回复结束事件
        this.dispatchAIResponseEvent('end');
    }
    
    /**
     * 触发AI回复状态事件
     */
    dispatchAIResponseEvent(type) {
        const event = new CustomEvent(`aiResponse${type.charAt(0).toUpperCase() + type.slice(1)}`, {
            detail: {
                timestamp: Date.now(),
                sessionId: this.currentSessionId
            }
        });
        window.dispatchEvent(event);
        console.log(`触发AI回复${type === 'start' ? '开始' : '结束'}事件`);
    }
    
    /**
     * 触发音频播放状态事件
     */
    dispatchAudioPlaybackEvent(type) {
        const event = new CustomEvent(`audioPlayback${type.charAt(0).toUpperCase() + type.slice(1)}`, {
            detail: {
                timestamp: Date.now(),
                sessionId: this.currentSessionId,
                audioSourcesCount: this.audioSources.length,
                queueLength: this.audioQueue.length
            }
        });
        window.dispatchEvent(event);
        console.log(`触发音频播放${type === 'start' ? '开始' : '结束'}事件`);
    }

    async createReplayAudio(messageElement) {
        try {
            if (this.allAudioData.length === 0) return;
            
            // 合并所有音频数据
            const totalLength = this.allAudioData.reduce((sum, chunk) => sum + chunk.length, 0);
            const combinedBuffer = new Uint8Array(totalLength);
            
            let offset = 0;
            for (const chunk of this.allAudioData) {
                combinedBuffer.set(chunk, offset);
                offset += chunk.length;
            }
            
            // 创建WAV文件
            const wavBlob = this.createWavBlob(combinedBuffer);
            const audioUrl = URL.createObjectURL(wavBlob);
            
            // 添加音频播放器
            const audioContainer = document.createElement('div');
            audioContainer.className = 'audio-container';
            audioContainer.innerHTML = `
                <audio controls class="audio-player" style="margin-top: 8px;" preload="metadata">
                    <source src="${audioUrl}" type="audio/wav">
                    您的浏览器不支持音频播放。
                </audio>
            `;
            messageElement.appendChild(audioContainer);
            
            console.log(`创建重播音频 - 总长度: ${totalLength} 字节`);
            
        } catch (error) {
            console.error('创建重播音频错误:', error);
        }
    }
    
    async createAudioBuffer(pcmData) {
        if (pcmData.length === 0) return null;
        
        // 16位PCM，24kHz采样率
        const sampleRate = this.audioSampleRate;
        const channels = 1;
        
        // 确保数据长度是2的倍数（16位）
        const sampleLength = Math.floor(pcmData.length / 2);
        if (sampleLength === 0) return null;
        
        // 将PCM数据转换为Float32Array
        const samples = new Int16Array(pcmData.buffer, 0, sampleLength);
        const audioBuffer = this.audioContext.createBuffer(channels, sampleLength, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < sampleLength; i++) {
            channelData[i] = samples[i] / 32768.0; // 转换为-1到1的范围
        }
        
        return audioBuffer;
    }
    
    createWavBlob(pcmData) {
        const length = pcmData.length;
        const arrayBuffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(arrayBuffer);
        
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        // WAV头部
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, 24000, true);
        view.setUint32(28, 48000, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * 2, true);
        
        // PCM数据
        let offset = 44;
        for (let i = 0; i < length; i++) {
            view.setInt16(offset, pcmData[i], true);
            offset += 2;
        }
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
    
    enableInput() {
        if (this.messageInput) {
            this.messageInput.disabled = false;
            this.messageInput.placeholder = "请输入您的回答，或点击语音按钮进行语音对话...";
        }
        this.updateSendButton();
    }
    
    disableInput() {
        if (this.messageInput) {
            this.messageInput.disabled = true;
        }
        if (this.sendButton) {
            this.sendButton.disabled = true;
        }
    }
    
    updateSendButton() {
        if (this.sendButton && this.messageInput) {
        const hasText = this.messageInput.value.trim().length > 0;
            const isConnected = this.ws && this.ws.readyState === WebSocket.OPEN;
            this.sendButton.disabled = !hasText || !isConnected || this.messageInput.disabled;
        }
    }
    
    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
    
    setSessionId(sessionId) {
        this.currentSessionId = sessionId || '';
        console.log('设置会话ID:', this.currentSessionId);
    }
    
    showError(message) {
        console.error('AzureVoiceChat错误:', message);
        // 显示错误通知
        if (typeof showNotification === 'function') {
            showNotification('错误', message, 'error');
        } else {
            alert(message);
        }
    }

    
    /**
     * 开始面试记录
     */
    startInterviewRecording() {
        this.isInterviewActive = true;
        this.interviewStartTime = Date.now();
        this.currentInterviewId = Date.now().toString();
        this.currentInterviewMessages = [];
        
        console.log('开始面试记录:', this.currentInterviewId);
        
        // 添加欢迎消息
        this.recordMessage('欢迎参加AI智能面试！我是您的面试官，将为您提供专业的面试体验。请告诉我您应聘的岗位，我们开始面试吧！', 'assistant');
    }
    
    /**
     * 结束面试记录并触发评分
     */
    async endInterviewRecording() {
        if (!this.isInterviewActive) {
            return;
        }
        
        this.isInterviewActive = false;
        const duration = Math.floor((Date.now() - this.interviewStartTime) / 1000);
        
        console.log('结束面试记录，时长:', duration, '秒');
        
        // 保存面试记录到本地存储
        const interview = {
            id: this.currentInterviewId,
            messages: this.currentInterviewMessages,
            duration: duration,
            createdAt: new Date().toISOString(),
            sessionId: this.currentSessionId,
            completed: true
        };
        
        // 保存到本地存储
        // if (this.app && this.app.storageManager) {
        //     this.app.storageManager.saveInterview(interview);
        // }
        
        // 触发面试评分
        // await this.triggerInterviewEvaluation(interview);
        
        // 重置状态
        this.currentInterviewMessages = [];
        this.interviewStartTime = null;
        this.currentInterviewId = null;
    }
    
    /**
     * 记录消息到面试记录
     */
    recordMessage(content, type) {
        if (!this.isInterviewActive) {
            return;
        }
        
        const message = {
            content: content,
            type: type,
            timestamp: new Date().toISOString()
        };
        
        this.currentInterviewMessages.push(message);
        console.log('记录消息:', type, content.substring(0, 50) + '...');
    }
    
    // /**
    //  * 触发面试评分
    //  */
    // async triggerInterviewEvaluation(interview) {
    //     try {
    //         console.log('开始面试评分...');
            
    //         // 获取简历上下文
    //         const resumeContext = await this.getResumeContext();
            
    //         // 构建评分请求
    //         const evaluationRequest = {
    //             interview_id: interview.id,
    //             messages: interview.messages,
    //             resume_context: resumeContext || '',
    //             duration: interview.duration,
    //             session_id: interview.sessionId || ''
    //         };
            
    //         // 显示评分进度
    //         this.showEvaluationProgress();
            
    //         // 调用评分API
    //         const response = await fetch('/api/interview/evaluate', {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             },
    //             body: JSON.stringify(evaluationRequest)
    //         });
            
    //         if (response.ok) {
    //             const result = await response.json();
    //             console.log('面试评分完成:', result);
                
    //             // 显示评分结果
    //             this.showEvaluationResult(result.evaluation);
                
    //             // 更新本地存储的面试记录
    //             this.updateInterviewWithEvaluation(interview.id, result.evaluation);
                
    //         } else {
    //             console.error('面试评分失败:', response.status);
    //             this.showEvaluationError('评分服务暂时不可用，请稍后查看面试记录');
    //         }
            
    //     } catch (error) {
    //         console.error('面试评分错误:', error);
    //         this.showEvaluationError('评分过程中出现错误: ' + error.message);
    //     } finally {
    //         this.hideEvaluationProgress();
    //     }
    // }
    
    /**
     * 获取简历上下文
     */
    async getResumeContext() {
        try {
            if (!this.currentSessionId) {
                return null;
            }
            
            const response = await fetch(`/api/resume/${this.currentSessionId}`);
            if (response.ok) {
                const data = await response.json();
                return data.content;
            }
        } catch (error) {
            console.error('获取简历上下文失败:', error);
        }
        return null;
    }
    
    /**
     * 显示评分进度
     */
    showEvaluationProgress() {
        // 创建评分进度提示
        const progressDiv = document.createElement('div');
        progressDiv.id = 'evaluationProgress';
        progressDiv.className = 'evaluation-progress';
        progressDiv.innerHTML = `
            <div class="evaluation-overlay">
                <div class="evaluation-content">
                    <div class="evaluation-spinner">
                        <i class="fas fa-cog fa-spin"></i>
                    </div>
                    <h3>正在评估面试表现</h3>
                    <p>AI正在分析您的面试表现，请稍候...</p>
                    <div class="evaluation-steps">
                        <div class="step active">分析对话内容</div>
                        <div class="step">评估技能水平</div>
                        <div class="step">生成评分报告</div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(progressDiv);
        
        // 模拟步骤进度
        setTimeout(() => {
            const steps = progressDiv.querySelectorAll('.step');
            if (steps[1]) steps[1].classList.add('active');
        }, 2000);
        
        setTimeout(() => {
            const steps = progressDiv.querySelectorAll('.step');
            if (steps[2]) steps[2].classList.add('active');
        }, 4000);
    }
    
    /**
     * 隐藏评分进度
     */
    hideEvaluationProgress() {
        const progressDiv = document.getElementById('evaluationProgress');
        if (progressDiv) {
            progressDiv.remove();
        }
    }
    
    /**
     * 显示评分结果 - 直接显示完整HTML报告
     */
    showEvaluationResult(evaluation) {
        // 如果有完整的HTML报告，直接显示
        if (evaluation.full_evaluation_html) {
            this.showFullHtmlReportInModal(evaluation.full_evaluation_html);
            return;
        }

        // 否则显示简化版本
        const resultDiv = document.createElement('div');
        resultDiv.className = 'evaluation-result-modal';
        resultDiv.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content evaluation-modal">
                    <div class="modal-header">
                        <h2><i class="fas fa-chart-bar"></i> 面试评分报告</h2>
                        <button class="modal-close" onclick="this.closest('.evaluation-result-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="score-overview">
                            <div class="total-score">
                                <div class="score-circle">
                                    <span class="score-number">${evaluation.total_score || 0}</span>
                                </div>
                            </div>
                            <div class="score-summary">
                                <h3>评估总结</h3>
                                <p>${evaluation.summary || '面试评估已完成'}</p>
                                ${evaluation.recommendation ? `<p class="recommendation"><strong>推荐结果:</strong> ${evaluation.recommendation}</p>` : ''}
                            </div>
                        </div>

                        ${this.createNewScoreBreakdownHTML(evaluation)}

                        <div class="evaluation-details">
                            <div class="detail-section">
                                <h4><i class="fas fa-thumbs-up"></i> 优势表现</h4>
                                <ul>
                                    ${(evaluation.strengths || ['表现积极']).map(strength => `<li>${strength}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="detail-section">
                                <h4><i class="fas fa-lightbulb"></i> 改进建议</h4>
                                <ul>
                                    ${(evaluation.improvements || ['继续保持']).map(improvement => `<li>${improvement}</li>`).join('')}
                                </ul>
                            </div>
                        </div>

                        <div class="evaluation-meta">
                            <small>
                                评估时间: ${new Date().toLocaleString('zh-CN')} |
                                评估模型: DeepSeek-V3 (三Agent协作)
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.evaluation-result-modal').remove()">
                            关闭
                        </button>
                        <button class="btn btn-primary" onclick="window.app.voiceChat.exportEvaluationToPDF(this.closest('.evaluation-result-modal'))">
                            <i class="fas fa-file-pdf"></i> 导出PDF
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(resultDiv);
    }

    /**
     * 创建新的评分细则HTML（适配三Agent系统）
     */
    createNewScoreBreakdownHTML(evaluation) {
        let html = '<div class="score-breakdown">';

        // 简历匹配度评分
        if (evaluation.resume_scores) {
            html += '<div class="score-section">';
            html += '<h4><i class="fas fa-file-alt"></i> 简历匹配度评分</h4>';
            html += '<div class="score-items">';

            const resumeScores = evaluation.resume_scores;
            if (resumeScores.experience_relevance) {
                html += `<div class="score-item">
                    <span class="score-name">经验相关性</span>
                    <span class="score-value">${resumeScores.experience_relevance.score}/5</span>
                </div>`;
            }
            if (resumeScores.skill_match) {
                html += `<div class="score-item">
                    <span class="score-name">技能契合度</span>
                    <span class="score-value">${resumeScores.skill_match.score}/5</span>
                </div>`;
            }
            if (resumeScores.project_results) {
                html += `<div class="score-item">
                    <span class="score-name">项目成果</span>
                    <span class="score-value">${resumeScores.project_results.score}/5</span>
                </div>`;
            }
            if (resumeScores.education) {
                html += `<div class="score-item">
                    <span class="score-name">教育资质</span>
                    <span class="score-value">${resumeScores.education.score}/5</span>
                </div>`;
            }
            if (resumeScores.total) {
                html += `<div class="score-item total">
                    <span class="score-name">简历匹配度总分</span>
                    <span class="score-value">${resumeScores.total.toFixed(1)}/5</span>
                </div>`;
            }

            html += '</div></div>';
        }

        // 面试表现评分
        if (evaluation.interview_scores) {
            html += '<div class="score-section">';
            html += '<h4><i class="fas fa-comments"></i> 面试表现评分</h4>';
            html += '<div class="score-items">';

            const interviewScores = evaluation.interview_scores;
            if (interviewScores.communication) {
                html += `<div class="score-item">
                    <span class="score-name">沟通表达</span>
                    <span class="score-value">${interviewScores.communication.score}/5</span>
                </div>`;
            }
            if (interviewScores.problem_solving) {
                html += `<div class="score-item">
                    <span class="score-name">问题解决</span>
                    <span class="score-value">${interviewScores.problem_solving.score}/5</span>
                </div>`;
            }
            if (interviewScores.technical_depth) {
                html += `<div class="score-item">
                    <span class="score-name">专业深度</span>
                    <span class="score-value">${interviewScores.technical_depth.score}/5</span>
                </div>`;
            }
            if (interviewScores.cultural_fit) {
                html += `<div class="score-item">
                    <span class="score-name">文化适配性</span>
                    <span class="score-value">${interviewScores.cultural_fit.score}/5</span>
                </div>`;
            }
            if (interviewScores.growth_potential) {
                html += `<div class="score-item">
                    <span class="score-name">成长潜力</span>
                    <span class="score-value">${interviewScores.growth_potential.score}/5</span>
                </div>`;
            }

            html += '</div></div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * 在模态框中显示完整HTML报告
     */
    showFullHtmlReportInModal(htmlContent) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'evaluation-result-modal full-html-modal';

        // 创建模态框结构
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content full-html-content';

        // 创建头部
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        modalHeader.innerHTML = `
            <h2><i class="fas fa-file-alt"></i> 完整面试评估报告</h2>
            <div class="modal-header-actions">
                <button class="btn btn-sm btn-outline download-btn">
                    <i class="fas fa-download"></i> 下载
                </button>
                <button class="btn btn-sm btn-outline new-window-btn">
                    <i class="fas fa-external-link-alt"></i> 新窗口打开
                </button>
                <button class="modal-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // 创建主体
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body full-html-body';

        const htmlContainer = document.createElement('div');
        htmlContainer.className = 'html-report-container';
        htmlContainer.innerHTML = htmlContent;

        modalBody.appendChild(htmlContainer);

        // 创建底部
        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        modalFooter.innerHTML = `
            <button class="btn btn-secondary close-btn">关闭</button>
            <button class="btn btn-outline pdf-btn">
                <i class="fas fa-file-pdf"></i> 导出PDF
            </button>
            <button class="btn btn-primary history-btn">查看历史记录</button>
        `;

        // 组装模态框
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modalOverlay.appendChild(modalContent);
        resultDiv.appendChild(modalOverlay);

        // 绑定事件
        modalHeader.querySelector('.download-btn').onclick = () => this.downloadHtmlReportDirect(htmlContent);
        modalHeader.querySelector('.new-window-btn').onclick = () => this.openHtmlInNewWindow(htmlContent);
        modalHeader.querySelector('.modal-close').onclick = () => resultDiv.remove();
        modalFooter.querySelector('.close-btn').onclick = () => resultDiv.remove();
        modalFooter.querySelector('.pdf-btn').onclick = () => this.exportHtmlToPDF(htmlContent);
        modalFooter.querySelector('.history-btn').onclick = () => {
            resultDiv.remove();
            window.app.router.navigateTo('history');
        };

        document.body.appendChild(resultDiv);
    }

    /**
     * 显示完整HTML报告（在新窗口）
     */
    showFullHtmlReport(evaluation) {
        if (!evaluation.full_evaluation_html) {
            alert('完整HTML报告不可用');
            return;
        }

        this.openHtmlInNewWindow(evaluation.full_evaluation_html);
    }

    /**
     * 在新窗口打开HTML内容
     */
    openHtmlInNewWindow(htmlContent) {
        const reportWindow = window.open('', '_blank');
        reportWindow.document.write(htmlContent);
        reportWindow.document.close();
    }

    /**
     * 下载HTML报告
     */
    downloadHtmlReport(evaluation) {
        if (!evaluation.full_evaluation_html) {
            alert('HTML报告不可用');
            return;
        }

        this.downloadHtmlReportDirect(evaluation.full_evaluation_html);
    }

    /**
     * 直接下载HTML内容
     */
    downloadHtmlReportDirect(htmlContent) {
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `面试评估报告_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 导出HTML内容为PDF
     */
    async exportHtmlToPDF(htmlContent) {
        try {
            // 创建临时容器来渲染HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.style.top = '-9999px';
            tempDiv.style.width = '800px';
            document.body.appendChild(tempDiv);

            // 生成文件名
            const now = new Date();
            const fileName = `面试评估报告_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.pdf`;

            // 使用PDF导出器导出
            await window.pdfExporter.exportToPDF(tempDiv, fileName);

            // 清理临时元素
            document.body.removeChild(tempDiv);

            // 显示成功提示
            this.showNotification('PDF导出成功', `文件已保存为: ${fileName}`, 'success');

        } catch (error) {
            console.error('PDF导出失败:', error);
            this.showNotification('导出失败', 'PDF导出失败: ' + error.message, 'error');
        }
    }

    /**
     * 导出评估结果为PDF
     */
    async exportEvaluationToPDF(modalElement) {
        try {
            // 检查PDF导出器是否可用
            if (!window.pdfExporter) {
                alert('PDF导出功能未初始化，请刷新页面重试。');
                return;
            }

            // 测试PDF库状态
            console.log('测试PDF库状态...');
            const isReady = window.pdfExporter.testLibraries();

            if (!isReady) {
                // 尝试重新加载库
                this.showNotification('正在加载PDF库', '请稍等片刻...', 'info');
                try {
                    await window.pdfExporter.loadLibraries();
                    console.log('PDF库重新加载完成');
                } catch (loadError) {
                    console.error('PDF库重新加载失败:', loadError);
                    this.showNotification('加载失败', 'PDF库加载失败，请检查网络连接', 'error');
                    return;
                }
            }

            // 生成文件名
            const now = new Date();
            const fileName = `面试评估报告_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.pdf`;

            // 使用PDF导出器导出
            await window.pdfExporter.exportToPDF(modalElement, fileName);

            // 显示成功提示
            this.showNotification('PDF导出成功', `文件已保存为: ${fileName}`, 'success');

        } catch (error) {
            console.error('PDF导出失败:', error);

            let errorMessage = 'PDF导出失败';
            if (error.message.includes('PDF库未正确加载')) {
                errorMessage = 'PDF库加载失败，请检查网络连接后刷新页面重试。';
            } else if (error.message) {
                errorMessage = `PDF导出失败: ${error.message}`;
            }

            this.showNotification('导出失败', errorMessage, 'error');
        }
    }

    /**
     * 显示通知消息
     */
    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    // /**
    //  * 创建维度评分HTML
    //  */
    // createDimensionScoresHTML(dimensionScores) {
    //     const dimensions = {
    //         'technical_depth': '技术能力',
    //         'communication': '沟通表达',
    //         'problem_solving': '问题解决',
    //         'growth_potential': '成长潜力'
    //     };
        
    //     return `
    //         <div class="dimension-scores">
    //             <h4>各维度评分</h4>
    //             <div class="score-bars">
    //                 ${Object.entries(dimensions).map(([key, name]) => {
    //                     const score = dimensionScores[key] || 7;
    //                     const percentage = (score / 10) * 100;
    //                     return `
    //                         <div class="score-bar">
    //                             <div class="score-label">${name}</div>
    //                             <div class="score-progress">
    //                                 <div class="score-fill" style="width: ${percentage}%"></div>
    //                             </div>
    //                             <div class="score-value">${score}/10</div>
    //                         </div>
    //                     `;
    //                 }).join('')}
    //             </div>
    //         </div>
    //     `;
    // }
    
    /**
     * 显示评分错误
     */
    showEvaluationError(message) {
        console.error('评分错误:', message);
        if (typeof showNotification === 'function') {
            showNotification('评分失败', message, 'error');
        } else {
            alert('面试评分失败: ' + message);
        }
    }
    
    /**
     * 更新面试记录的评分信息
     */
    updateInterviewWithEvaluation(interviewId, evaluation) {
        if (this.app && this.app.storageManager) {
            const interviews = this.app.storageManager.getInterviews();
            const interview = interviews.find(item => item.id === interviewId);

            if (interview) {
                interview.evaluation = evaluation;
                interview.score = evaluation.total_score;

                // 只有在原来没有summary的情况下才设置评估总结
                if (!interview.summary && evaluation.summary) {
                    interview.summary = evaluation.summary;
                }

                // 重新保存
                this.app.storageManager.saveInterview(interview);
                console.log('面试记录已更新评分信息');
            }
        }
    }




}

/**
 * 历史记录管理器
 */
class HistoryManager {
    constructor(storageManager, router) {
        this.storageManager = storageManager;
        this.router = router;
        this.historyList = null;
        this.emptyHistory = null;
        this.sortBy = null;
        this.searchHistoryInput = null; 

        // 获取模态窗口元素
        this.evaluationModal = null;
        this.modalCloseButton = null; // 明确命名为 modalCloseButton
        this.modalEvaluationContent = null;
        this.modalLoadingSpinner = null;
        this.modalActualContent = null;
        
        // 对话详情模态框元素
        this.conversationModal = null;
        this.conversationMessages = null;
        this.conversationDate = null;
        this.conversationDuration = null;
        this.conversationCount = null;
        this.closeConversationModal = null;
        this.exportConversationBtn = null;

        this.init();
    }

    init() {
        this.historyList = document.getElementById('historyList');
        this.emptyHistory = document.getElementById('emptyHistory');
        this.sortBy = document.getElementById('sortBy');
        this.searchHistoryInput = document.getElementById('searchHistoryInput'); 

        this.evaluationModal = document.getElementById('evaluationModal');
        this.modalEvaluationContent = document.getElementById('modalEvaluationContent');
        this.modalLoadingSpinner = this.modalEvaluationContent?.querySelector('.loading-spinner');
        this.modalActualContent = this.modalEvaluationContent?.querySelector('.evaluation-actual-content');
        this.modalCloseButton = this.evaluationModal?.querySelector('.close-button');
        
        // 初始化对话详情模态框元素
        this.conversationModal = document.getElementById('conversationModal');
        this.conversationMessages = document.getElementById('conversationMessages');
        this.conversationDate = document.getElementById('conversationDate');
        this.conversationDuration = document.getElementById('conversationDuration');
        this.conversationCount = document.getElementById('conversationCount');
        this.closeConversationModal = document.getElementById('closeConversationModal');
        this.exportConversationBtn = document.getElementById('exportConversationBtn');
        
        this.bindHistoryEvents();
        this.bindSearchEvents(); 
        this.bindModalEvents();
        this.bindConversationModalEvents();
        this.refreshHistoryList();
    }

    bindHistoryEvents() {
        // 排序方式改变
        if (this.sortBy) {
            this.sortBy.addEventListener('change', () => {
                this.refreshHistoryList();
            });
        }

        // 清空历史记录
        const clearBtn = document.getElementById('clearHistoryBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearHistory();
            });
        }

        // 开始第一次面试
        const startBtn = document.getElementById('startFirstInterviewBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.router.navigateTo('interview');
            });
        }
    }

    // 绑定模态窗口的关闭事件
    bindModalEvents() {
        if (this.evaluationModal && this.modalCloseButton) {
            // 点击关闭按钮时关闭模态窗口
            this.modalCloseButton.addEventListener('click', () => {
                this.evaluationModal.style.display = 'none';
                // 关闭模态框后刷新历史记录列表
                this.refreshHistoryList();
            });

            // 点击模态窗口外部区域时关闭模态窗口
            // 注意：这里事件监听器应该绑定到整个 window，但逻辑判断要精确到点击区域
            window.addEventListener('click', (event) => {
                // 确保点击事件的目标是模态窗口的背景本身，而不是模态内容
                if (event.target === this.evaluationModal) {
                    this.evaluationModal.style.display = 'none';
                    // 关闭模态框后刷新历史记录列表
                    this.refreshHistoryList();
                }
            });

            // 监听 Escape 键关闭模态窗口
            window.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.evaluationModal.style.display === 'flex') {
                    this.evaluationModal.style.display = 'none';
                    // 关闭模态框后刷新历史记录列表
                    this.refreshHistoryList();
                }
            });
        } else {
            console.warn("模态窗口或关闭按钮元素未找到，无法绑定关闭事件。请检查HTML结构和ID/类名。");
        }
    }

    bindSearchEvents() {
        if (this.searchHistoryInput) {
            this.searchHistoryInput.addEventListener('input', () => {
                this.refreshHistoryList(); // Re-render the list on every input
            });
        }
    }
    
    refreshHistoryList() {
        const interviews = this.storageManager.getInterviews();

        // NEW: Filter interviews first
        const filteredInterviews = this.filterInterviews(interviews);
        // Then sort the filtered interviews
        const sortedAndFilteredInterviews = this.sortInterviews(filteredInterviews);

        if (sortedAndFilteredInterviews.length === 0) {
            // Show different empty states based on whether a search query is active
            if (this.searchHistoryInput && this.searchHistoryInput.value.trim() !== '') {
                this.showEmptyState('没有找到匹配的面试记录。');
            } else {
                this.showEmptyState(); // Default empty state for no records at all
            }
        } else {
            this.showHistoryList(sortedAndFilteredInterviews);
        }

        // NEW: Update stats based on the currently displayed (filtered/sorted) interviews
        this.updateStats(sortedAndFilteredInterviews);
    }

        // if (interviews.length === 0) {
        //     this.showEmptyState();
        // } else {
        //     this.showHistoryList(interviews);
        // }
    // }

    // NEW: Filter interviews based on search query
    filterInterviews(interviews) {
        const searchQuery = this.searchHistoryInput?.value.trim().toLowerCase() || '';
        if (!searchQuery) {
            return interviews; // If no search query, return all interviews
        }

        return interviews.filter(interview => {
            const title = (interview.title || '').toLowerCase();
            const summary = (interview.summary || '').toLowerCase();
            return title.includes(searchQuery) || summary.includes(searchQuery);
        });
    }

    // NEW: Update statistics display
    updateStats(interviews) {
        const totalInterviewsSpan = document.querySelector('.filter-stats .stat-item:nth-child(1) .stat-number');
        const totalDurationSpan = document.querySelector('.filter-stats .stat-item:nth-child(2) .stat-number');

        if (totalInterviewsSpan) {
            totalInterviewsSpan.textContent = interviews.length;
        }

        if (totalDurationSpan) {
            const totalSeconds = interviews.reduce((sum, interview) => sum + (interview.duration || 0), 0);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            totalDurationSpan.textContent = `${hours}h ${minutes}m`;
        }
    }

    // showEmptyState() {
    //     if (this.emptyHistory) {
    //         this.emptyHistory.style.display = 'block';
    //     }
    //     if (this.historyList) {
    //         this.historyList.innerHTML = '';
    //     }
    // }

    showEmptyState(message = '开始您的第一次AI语音面试，记录将自动保存在这里') {
        if (this.emptyHistory) {
            this.emptyHistory.style.display = 'block';
            const emptyHistoryText = this.emptyHistory.querySelector('p');
            if (emptyHistoryText) {
                emptyHistoryText.textContent = message; // Set custom message
            }
            // Ensure the start button is visible in default empty state
            const startButton = this.emptyHistory.querySelector('#startFirstInterviewBtn');
            if (startButton) {
                 startButton.style.display = (message === '开始您的第一次AI语音面试，记录将自动保存在这里') ? 'block' : 'none';
            }

        }
        if (this.historyList) {
            this.historyList.innerHTML = '';
        }
    }


    showHistoryList(interviews) {
        if (this.emptyHistory) {
            this.emptyHistory.style.display = 'none';
        }

        const sortedInterviews = this.sortInterviews(interviews);
        
        if (this.historyList) {
            this.historyList.innerHTML = sortedInterviews
                .map(interview => this.createHistoryItemHTML(interview))
                .join('');
            
            this.bindHistoryItemEvents();
        }
    }

    sortInterviews(interviews) {
        const sortValue = this.sortBy?.value || 'date-desc';
        
        return interviews.sort((a, b) => {
            switch (sortValue) {
                case 'date-asc':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'date-desc':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'duration-desc':
                    return (b.duration || 0) - (a.duration || 0);
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });
    }

    createHistoryItemHTML(interview) {
        const date = new Date(interview.createdAt).toLocaleString('zh-CN');
        const duration = interview.duration ? `${Math.floor(interview.duration / 60)}分${interview.duration % 60}秒` : '未知';
        const messageCount = interview.messages?.length || 0;
        const score = interview.score || interview.evaluation?.total_score;
        const hasEvaluation = interview.evaluation || interview.score;

        // 获取评分状态
        const evaluationStatus = interview.evaluationStatus || 'unknown';
        const statusInfo = this.getEvaluationStatusInfo(evaluationStatus, hasEvaluation);

        return `
            <div class="history-item" data-id="${interview.id}">
                <div class="history-icon">
                    <i class="fas fa-microphone"></i>
                </div>
                <div class="history-content">
                    <div class="history-title">
                        ${interview.title || 'AI语音面试记录'}
                        <span class="history-badge ${statusInfo.badgeClass}">
                            ${statusInfo.badgeText}
                        </span>
                        ${score ? `<span class="history-score ${this.getScoreColorClass(score)}">${score}分</span>` : ''}
                    </div>
                    <div class="history-meta">
                        <span><i class="fas fa-clock"></i> ${date}</span>
                        <span><i class="fas fa-stopwatch"></i> ${duration}</span>
                        <span><i class="fas fa-comments"></i> ${messageCount}条对话</span>
                        <span class="evaluation-status ${statusInfo.statusClass}">
                            <i class="${statusInfo.statusIcon}"></i> ${statusInfo.statusText}
                        </span>
                    </div>
                    <div class="history-summary">
                        ${interview.summary || '本次面试涵盖了技术能力、项目经验等多个方面的深入交流...'}
                    </div>
                </div>
                <div class="history-actions">
                    <!-- 查看对话记录 -->
                    <button class="history-action-btn conversation-btn" onclick="historyManager.viewConversation('${interview.id}')" title="查看对话记录">
                        <i class="fas fa-comments"></i>
                        <span class="btn-label">对话</span>
                    </button>

                    <!-- 评分相关按钮 -->
                    ${this.getEvaluationActionButton(interview, evaluationStatus, hasEvaluation)}

                    <!-- 其他操作 -->
                    <button class="history-action-btn delete-btn" onclick="historyManager.deleteInterview('${interview.id}')" title="删除记录">
                        <i class="fas fa-trash"></i>
                        <span class="btn-label">删除</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 获取评分状态信息
     */
    getEvaluationStatusInfo(evaluationStatus, hasEvaluation) {
        switch (evaluationStatus) {
            case 'evaluating':
                return {
                    badgeClass: 'evaluating',
                    badgeText: '评分中',
                    statusClass: 'evaluating',
                    statusIcon: 'fas fa-spinner fa-spin',
                    statusText: '正在评分'
                };
            case 'completed':
                return {
                    badgeClass: 'evaluated',
                    badgeText: '已评分',
                    statusClass: 'completed',
                    statusIcon: 'fas fa-check-circle',
                    statusText: '评分完成'
                };
            case 'failed':
                return {
                    badgeClass: 'evaluation-failed',
                    badgeText: '评分失败',
                    statusClass: 'failed',
                    statusIcon: 'fas fa-exclamation-triangle',
                    statusText: '评分失败'
                };
            default:
                if (hasEvaluation) {
                    return {
                        badgeClass: 'evaluated',
                        badgeText: '已评分',
                        statusClass: 'completed',
                        statusIcon: 'fas fa-chart-bar',
                        statusText: '已评分'
                    };
                } else {
                    return {
                        badgeClass: 'completed',
                        badgeText: '完成',
                        statusClass: 'pending',
                        statusIcon: 'fas fa-clock',
                        statusText: '待评分'
                    };
                }
        }
    }

    /**
     * 获取评分操作按钮
     */
    getEvaluationActionButton(interview, evaluationStatus, hasEvaluation) {
        switch (evaluationStatus) {
            case 'evaluating':
                return `
                    <button class="history-action-btn evaluating-btn" disabled title="正在评分中">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span class="btn-label">评分中</span>
                    </button>
                `;
            case 'completed':
            case 'unknown':
                if (hasEvaluation) {
                    return `
                        <button class="history-action-btn evaluation-btn" onclick="historyManager.viewEvaluation('${interview.id}')" title="查看评分报告">
                            <i class="fas fa-chart-bar"></i>
                            <span class="btn-label">评分</span>
                        </button>
                    `;
                } else {
                    return `
                        <button class="history-action-btn start-evaluation-btn" onclick="historyManager.startEvaluation('${interview.id}')" title="开始评分">
                            <i class="fas fa-star"></i>
                            <span class="btn-label">评分</span>
                        </button>
                    `;
                }
            case 'failed':
                return `
                    <button class="history-action-btn retry-evaluation-btn" onclick="historyManager.retryEvaluation('${interview.id}')" title="重新评分">
                        <i class="fas fa-redo"></i>
                        <span class="btn-label">重试</span>
                    </button>
                `;
            default:
                return `
                    <button class="history-action-btn start-evaluation-btn" onclick="historyManager.startEvaluation('${interview.id}')" title="开始评分">
                        <i class="fas fa-star"></i>
                        <span class="btn-label">评分</span>
                    </button>
                `;
        }
    }
    bindHistoryItemEvents() {
        // 事件已在HTML中绑定
            this.historyList.querySelectorAll('.evaluate-btn').forEach(button => {
            button.onclick = () => this.startEvaluation(button.dataset.id);
        });
    }



    deleteInterview(id) {
        if (confirm('确定要删除这条面试记录吗？')) {
            this.storageManager.deleteInterview(id);
            this.refreshHistoryList();
        }
    }

    clearHistory() {
        if (confirm('确定要清空所有面试记录吗？此操作不可恢复。')) {
            this.storageManager.clearInterviews();
            this.refreshHistoryList();
        }
    }
    async startEvaluation(interviewId) {
        const interviews = this.storageManager.getInterviews();
        let interviewToEvaluate = interviews.find(item => item.id === interviewId);

        if (!interviewToEvaluate || !interviewToEvaluate.messages) {
            alert("错误：未找到面试记录或对话消息。");
            return;
        }

        // 检查是否已经评估过
        const hasEvaluation = interviewToEvaluate.evaluation || interviewToEvaluate.score || 
                             interviewToEvaluate.evaluationMarkdown || interviewToEvaluate.evaluationScore;
        
        if (hasEvaluation) {
            console.log(`面试记录 ${interviewId} 已经评估过，直接显示评估结果`);
            // 如果已评估，直接显示评估结果而不是重新评估
            if (interviewToEvaluate.evaluation && window.app && window.app.voiceChat) {
                window.app.voiceChat.showEvaluationResult(interviewToEvaluate.evaluation);
            } else if (interviewToEvaluate.evaluationMarkdown) {
                // 显示模态窗口
                if (this.evaluationModal) {
                    this.evaluationModal.style.display = 'flex';
                }
                if (this.modalLoadingSpinner) {
                    this.modalLoadingSpinner.style.display = 'none';
                }
                this.displayCompleteEvaluation(interviewToEvaluate);
            } else {
                alert(`该面试记录已评估，评分：${interviewToEvaluate.score || '未知'}分`);
            }
            return;
        }

        // 显示模态窗口
        if (this.evaluationModal) {
            this.evaluationModal.style.display = 'flex'; // 使用 flex 来居中
        }
        if (this.modalLoadingSpinner) {
            this.modalLoadingSpinner.style.display = 'block'; // 显示加载指示
        }
        if (this.modalActualContent) {
            this.modalActualContent.innerHTML = ''; // 清空之前的内容
        }

        // 检查是否已缓存完整评估结果（包含HTML和评分）
        if (interviewToEvaluate.evaluationHtml && interviewToEvaluate.evaluationScore) {
            console.log(`从缓存加载完整评估结果，面试ID: ${interviewId}`);
            this.displayCompleteEvaluation(interviewToEvaluate);
            if (this.modalLoadingSpinner) {
                this.modalLoadingSpinner.style.display = 'none';
            }
            return;
        }

        // 如果没有缓存，则并行调用后端生成评估和提取数据
        try {
            console.log(`调用后端生成完整评估结果，面试ID: ${interviewId}`);

            const resumeData = this.storageManager.getCurrentResume();
            const resumeText = resumeData ? resumeData.fullText : '';

            // 先尝试调用评估API
            console.log('正在调用评估API...');
            const evaluationResponse = await fetch('/api/evaluate-interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    interviewMessages: interviewToEvaluate.messages,
                    resumeText: resumeText,
                    interviewId: interviewToEvaluate.id
                })
            });

            if (!evaluationResponse.ok) {
                const errorDetail = await evaluationResponse.text();
                throw new Error(`评估API请求失败: ${evaluationResponse.status} ${evaluationResponse.statusText} - ${errorDetail}`);
            }

            const evaluationData = await evaluationResponse.json();
            const htmlResult = evaluationData.evaluationHtml;
            const structuredEvaluation = evaluationData.evaluation;
            const analysisResult = evaluationData.analysis;
            const scoringResult = evaluationData.scoring;

            if (htmlResult && structuredEvaluation) {
                // 缓存评估结果到 interview 对象，但保持原有的标题和基本信息
                interviewToEvaluate.evaluationHtml = htmlResult;

                // 使用结构化数据中的分数
                interviewToEvaluate.evaluationScore = structuredEvaluation.overall_score || structuredEvaluation.total_score || 0;
                interviewToEvaluate.score = interviewToEvaluate.evaluationScore; // 确保score字段也被设置

                // 不修改原有的title，保持原面试记录的标题
                // 如果原来没有title，才设置默认标题
                if (!interviewToEvaluate.title) {
                    interviewToEvaluate.title = 'AI语音面试记录';
                }

                // // 使用结构化数据中的总结
                // const evaluationSummary = structuredEvaluation.summary || '面试评估已完成';
                // if (evaluationSummary && !interviewToEvaluate.summary) {
                //     interviewToEvaluate.summary = evaluationSummary;
                // }

                // 创建完整的evaluation对象，包含所有结构化数据
                interviewToEvaluate.evaluation = {
                    total_score: interviewToEvaluate.evaluationScore,
                    // summary: evaluationSummary,
                    full_evaluation_html: htmlResult,
                    strengths: analysisResult.highlights || [],
                    improvements: analysisResult.risks || [],
                };

                this.storageManager.updateInterview(interviewToEvaluate); // 更新 localStorage 中的记录

                // 使用AzureVoiceChat的showEvaluationResult方法显示结构化评分结果
                if (window.app && window.app.voiceChat) {
                    // 关闭当前模态框
                    if (this.evaluationModal) {
                        this.evaluationModal.style.display = 'none';
                    }
                    // 显示结构化评分结果
                    window.app.voiceChat.showEvaluationResult(interviewToEvaluate.evaluation);
                } else {
                    // 降级显示
                    this.displayCompleteEvaluation(interviewToEvaluate);
                }

                // 刷新历史记录列表以显示新的评分
                this.refreshHistoryList();
            } else {
                if (this.modalActualContent) {
                    this.modalActualContent.innerHTML = '<p>未收到评估结果。</p>';
                }
            }

        } catch (error) {
            console.error('面试评估失败:', error);
            if (this.modalActualContent) {
                this.modalActualContent.innerHTML = `
                    <div class="evaluation-error">
                        <div class="error-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3>评估服务暂时不可用</h3>
                        <p>抱歉，面试评估服务当前遇到了一些技术问题。这可能是由于网络连接问题或服务器繁忙导致的。</p>
                        <div class="error-message">
                            <strong>错误详情：</strong> ${error.message}
                        </div>
                        <div class="error-actions">
                            <button class="btn btn-primary" onclick="window.app.historyManager.startEvaluation('${interviewId}')">
                                <i class="fas fa-redo"></i> 重试评估
                            </button>
                            <button class="btn btn-secondary" onclick="this.closest('.modal').style.display='none'">
                                <i class="fas fa-times"></i> 关闭
                            </button>
                        </div>
                        <div class="error-details">
                            <small>
                                建议：请检查网络连接，稍后重试。如果问题持续存在，请联系技术支持。<br>
                                评估服务通常在几分钟内会恢复正常。
                            </small>
                        </div>
                    </div>
                `;
            }
        } finally {
            if (this.modalLoadingSpinner) {
                this.modalLoadingSpinner.style.display = 'none'; // 隐藏加载指示
            }
        }
    }

    /**
     * 使用 marked.js 将 Markdown 渲染到 HTML
     * @param {string} markdown - Markdown 字符串
     * @returns {string} - HTML 字符串
     */
    renderMarkdownToHtml(markdown) {
        // 确保 marked 库已加载
        if (typeof marked === 'undefined') {
            console.error("marked.js 库未加载！请确保在 historyManager.js 之前引入。");
            return `<pre>${markdown}</pre>`; // 降级处理，直接显示Markdown源码
        }
        return marked.parse(markdown);
    }

    /**
     * 从Markdown文本中提取评分
     * @param {string} markdown - Markdown 文本
     * @returns {number} - 提取的分数，默认75
     */
    extractScoreFromMarkdown(markdown) {
        if (!markdown) return 75;

        // 优先匹配新格式的总体评分
        const newFormatPatterns = [
            /##\s*总体评分[：:]\s*(\d+)\s*分/i,
            /总体评分[：:]\s*(\d+)\s*分/i,
            /总分[：:]\s*(\d+)\s*分/i
        ];

        for (const pattern of newFormatPatterns) {
            const match = markdown.match(pattern);
            if (match) {
                const score = parseInt(match[1]);
                if (score >= 0 && score <= 100) {
                    console.log(`从新格式中提取到评分: ${score}`);
                    return score;
                }
            }
        }

        // 兼容旧格式的评分提取
        const legacyPatterns = [
            /综合得分[：:]\s*(\d+)/,
            /评分[：:]\s*(\d+)/,
            /(\d+)\s*分/
        ];

        for (const pattern of legacyPatterns) {
            const match = markdown.match(pattern);
            if (match) {
                const score = parseInt(match[1]);
                if (score >= 0 && score <= 100) {
                    console.log(`从兼容格式中提取到评分: ${score}`);
                    return score;
                }
            }
        }

        console.log('未能提取到有效评分，使用默认值75');
        return 75; // 默认分数
    }

    /**
     * 从Markdown文本中提取评估总结
     * @param {string} markdown - Markdown 文本
     * @returns {string} - 提取的总结
     */
    extractSummaryFromMarkdown(markdown) {
        if (!markdown) return '';

        // 尝试提取总结部分
        const summaryPatterns = [
            /##\s*总结[：:]?\s*\n(.*?)(?=\n##|\n\n|$)/s,
            /##\s*评估总结[：:]?\s*\n(.*?)(?=\n##|\n\n|$)/s,
            /总结[：:]\s*(.*?)(?=\n##|\n\n|$)/s,
            /评估总结[：:]\s*(.*?)(?=\n##|\n\n|$)/s
        ];

        for (const pattern of summaryPatterns) {
            const match = markdown.match(pattern);
            if (match && match[1]) {
                const summary = match[1].trim().replace(/\n+/g, ' ').substring(0, 200);
                if (summary.length > 10) {
                    console.log(`提取到评估总结: ${summary.substring(0, 50)}...`);
                    return summary;
                }
            }
        }

        // 如果没有找到专门的总结，尝试提取第一段内容
        const firstParagraphMatch = markdown.match(/^(.*?)(?=\n\n|\n##|$)/s);
        if (firstParagraphMatch && firstParagraphMatch[1]) {
            const firstParagraph = firstParagraphMatch[1].trim().replace(/\n+/g, ' ').substring(0, 150);
            if (firstParagraph.length > 20) {
                console.log(`使用第一段作为总结: ${firstParagraph.substring(0, 50)}...`);
                return firstParagraph;
            }
        }

        return '面试评估已完成';
    }

    /**
     * 显示完整的评估结果（包含评分卡片和详细HTML报告）
     * @param {Object} interview - 面试对象
     */
    displayCompleteEvaluation(interview) {
        if (!this.modalActualContent) return;

        const score = interview.evaluationScore || 0;
        const title = interview.title || `面试评估 - ${new Date().toLocaleDateString()}`;
        const summary = interview.summary || '面试评估已完成';

        // 创建评分卡片和详细内容的组合HTML
        const completeHTML = `
            <div class="evaluation-complete-view">
                <!-- 评分概览卡片 -->
                <div class="evaluation-score-card">
                    <div class="score-header">
                        <h3><i class="fas fa-chart-bar"></i> ${title}</h3>
                        <div class="score-badge ${this.getScoreLevel(score)}">${score}分</div>
                    </div>
                    <div class="score-summary">
                        <p>${summary}</p>
                    </div>
                    <div class="score-actions">
                        <button class="btn btn-sm btn-outline" onclick="this.closest('.evaluation-complete-view').querySelector('.evaluation-details').scrollIntoView({behavior: 'smooth'})">
                            <i class="fas fa-arrow-down"></i> 查看详细评估
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="window.app.voiceChat.showFullHtmlReport(${JSON.stringify(interview.evaluation || {}).replace(/"/g, '&quot;')})">
                            <i class="fas fa-file-alt"></i> 查看完整报告
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="window.app.voiceChat.downloadHtmlReport(${JSON.stringify(interview.evaluation || {}).replace(/"/g, '&quot;')})">
                            <i class="fas fa-download"></i> 下载HTML
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="window.app.voiceChat.exportEvaluationToPDF(this.closest('.modal'))">
                            <i class="fas fa-file-pdf"></i> 导出PDF
                        </button>
                    </div>
                </div>

                <!-- 详细评估内容 -->
                <div class="evaluation-details">
                    ${interview.evaluation ? this.createNewScoreBreakdownHTML(interview.evaluation) : ''}
                    ${interview.evaluation && interview.evaluation.full_evaluation_html ?
                        `<div class="html-content-preview">
                            <h4><i class="fas fa-file-code"></i> 完整评估报告预览</h4>
                            <div class="html-preview-container">
                                <iframe srcdoc="${interview.evaluation.full_evaluation_html.replace(/"/g, '&quot;')}"
                                        style="width: 100%; height: 400px; border: 1px solid #ddd; border-radius: 6px;">
                                </iframe>
                            </div>
                        </div>` :
                        '<p>详细评估报告不可用</p>'
                    }
                </div>
            </div>
        `;

        this.modalActualContent.innerHTML = completeHTML;
    }

    /**
     * 根据分数获取等级样式
     * @param {number} score - 分数
     * @returns {string} - CSS类名
     */
    getScoreLevel(score) {
        if (score >= 90) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 70) return 'average';
        if (score >= 60) return 'below-average';
        return 'poor';
    }

    /**
     * 根据分数获取历史记录中的颜色样式类
     * @param {number} score - 分数
     * @returns {string} - CSS类名
     */
    getScoreColorClass(score) {
        if (score >= 90) return 'score-excellent';
        if (score >= 80) return 'score-good';
        if (score >= 70) return 'score-average';
        if (score >= 60) return 'score-below-average';
        return 'score-poor';
    }
    
    viewEvaluation(id) {
        const interviews = this.storageManager.getInterviews();
        const interview = interviews.find(item => item.id === id);

        if (interview && interview.evaluation) {
            // 使用AzureVoiceChat的showEvaluationResult方法显示评分
            if (window.app && window.app.voiceChat) {
                window.app.voiceChat.showEvaluationResult(interview.evaluation);
            } else {
                // 简单的评分显示
                alert(`面试评分: ${interview.evaluation.total_score || interview.score || 'N/A'}分\n\n${interview.evaluation.summary || '暂无评估总结'}`);
            }
        } else {
            alert('该面试记录暂无评分信息');
        }
    }

    /**
     * 重试评分
     */
    async retryEvaluation(id) {
        const interviews = this.storageManager.getInterviews();
        const interview = interviews.find(item => item.id === id);

        if (!interview) {
            alert('未找到面试记录');
            return;
        }

        if (confirm('确定要重新评分这次面试吗？')) {
            try {
                // 重置评分状态
                interview.evaluationStatus = 'evaluating';
                interview.evaluation = null;
                interview.score = null;
                this.storageManager.saveInterview(interview);

                // 刷新显示
                this.refreshHistoryList();

                // 触发重新评分
                await this.triggerEvaluationForInterview(interview);

            } catch (error) {
                console.error('重试评分失败:', error);
                alert('重试评分失败: ' + error.message);
            }
        }
    }

    /**
     * 为指定面试触发评分
     */
    async triggerEvaluationForInterview(interview) {
        try {
            // 获取简历上下文
            const resumeContext = await this.getResumeContext();

            // 构建评分请求
            const evaluationRequest = {
                interview_id: interview.id,
                messages: interview.messages,
                resume_context: resumeContext || '',
                duration: interview.duration || 0
            };

            console.log('开始评分处理...');

            // 调用评分API
            const response = await fetch('/api/interview/evaluate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(evaluationRequest)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('评分完成');

                if (result.success) {
                    // 更新面试记录的评分信息
                    interview.evaluation = result.evaluation;
                    interview.score = result.evaluation.total_score;
                    interview.evaluationStatus = 'completed';
                    this.storageManager.saveInterview(interview);

                    // 刷新显示
                    this.refreshHistoryList();

                    alert('评分完成！');
                } else {
                    throw new Error(result.message || '评分失败');
                }
            } else {
                throw new Error(`评分API调用失败: ${response.status}`);
            }

        } catch (error) {
            console.error('评分处理失败:', error);

            // 标记评分失败
            interview.evaluationStatus = 'failed';
            this.storageManager.saveInterview(interview);
            this.refreshHistoryList();

            throw error;
        }
    }

    /**
     * 获取简历上下文（简化版本）
     */
    async getResumeContext() {
        try {
            const resumeData = this.storageManager.getCurrentResume();
            if (resumeData && resumeData.sessionId) {
                const response = await fetch(`/api/resume/${resumeData.sessionId}`);
                if (response.ok) {
                    const data = await response.json();
                    return data.content;
                }
            }
            return null;
        } catch (error) {
            console.error('获取简历上下文失败:', error);
            return null;
        }
    }
    
    /**
     * 绑定对话详情模态框事件
     */
    bindConversationModalEvents() {
        // 关闭按钮事件
        if (this.closeConversationModal) {
            this.closeConversationModal.addEventListener('click', () => {
                this.hideConversationModal();
            });
        }
        
        // 导出按钮事件
        if (this.exportConversationBtn) {
            this.exportConversationBtn.addEventListener('click', () => {
                this.exportConversation();
            });
        }
        
        // 点击模态框外部关闭
        if (this.conversationModal) {
            this.conversationModal.addEventListener('click', (event) => {
                if (event.target === this.conversationModal) {
                    this.hideConversationModal();
                }
            });
        }
        
        // ESC键关闭
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.conversationModal && this.conversationModal.style.display === 'flex') {
                this.hideConversationModal();
            }
        });
    }
    
    /**
     * 查看面试对话详情
     */
    viewConversation(id) {
        const interviews = this.storageManager.getInterviews();
        const interview = interviews.find(item => item.id === id);
        
        if (!interview) {
            alert('未找到面试记录');
            return;
        }
        
        if (!interview.messages || interview.messages.length === 0) {
            alert('该面试记录没有对话内容');
            return;
        }
        
        this.showConversationModal(interview);
    }
    
    /**
     * 显示对话详情模态框
     */
    showConversationModal(interview) {
        if (!this.conversationModal) {
            console.error('对话详情模态框未找到');
            return;
        }
        
        // 设置面试信息
        this.setConversationInfo(interview);
        
        // 渲染对话消息
        this.renderConversationMessages(interview.messages);
        
        // 显示模态框
        this.conversationModal.style.display = 'flex';

        // 记录当前查看的面试ID，用于导出功能
        this.currentViewingInterviewId = interview.id;

        // 延迟更新滚动指示器，确保DOM已渲染
        setTimeout(() => {
            this.updateScrollIndicator();
        }, 200);

        console.log('显示面试对话详情:', interview.id);
    }
    
    /**
     * 隐藏对话详情模态框
     */
    hideConversationModal() {
        if (this.conversationModal) {
            this.conversationModal.style.display = 'none';
            this.currentViewingInterviewId = null;
        }
    }
    
    /**
     * 设置对话信息
     */
    setConversationInfo(interview) {
        // 面试时间
        if (this.conversationDate) {
            const date = new Date(interview.createdAt).toLocaleString('zh-CN');
            this.conversationDate.textContent = date;
        }
        
        // 面试时长
        if (this.conversationDuration) {
            const duration = interview.duration || 0;
            if (duration >= 60) {
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                this.conversationDuration.textContent = `${minutes}分${seconds}秒`;
            } else {
                this.conversationDuration.textContent = `${duration}秒`;
            }
        }
        
        // 对话轮次
        if (this.conversationCount) {
            this.conversationCount.textContent = `${interview.messages.length}条`;
        }
    }
    
    /**
     * 渲染对话消息
     */
    renderConversationMessages(messages) {
        if (!this.conversationMessages) {
            console.error('对话消息容器未找到');
            return;
        }
        
        // 清空现有内容
        this.conversationMessages.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            this.conversationMessages.innerHTML = `
                <div class="conversation-empty">
                    <i class="fas fa-comments"></i>
                    <h3>暂无对话记录</h3>
                    <p>该面试记录中没有保存对话内容</p>
                </div>
            `;
            return;
        }
        
        // 渲染每条消息
        messages.forEach((message, index) => {
            const messageElement = this.createConversationMessageElement(message, index);
            this.conversationMessages.appendChild(messageElement);
        });
        
        // 滚动到底部并检查是否需要滚动提示
        setTimeout(() => {
            this.conversationMessages.scrollTop = this.conversationMessages.scrollHeight;
            this.updateScrollIndicator();
        }, 100);
    }
    
    /**
     * 创建对话消息元素
     */
    createConversationMessageElement(message, index) {
        // 兼容不同的消息格式：type 或 role 字段
        const messageType = message.type || message.role;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `conversation-message ${messageType}`;
        
        // 头像
        const avatar = document.createElement('div');
        avatar.className = 'conversation-avatar';
        avatar.innerHTML = messageType === 'assistant' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
        
        // 对话气泡
        const bubble = document.createElement('div');
        bubble.className = 'conversation-bubble';
        
        const text = document.createElement('p');
        text.className = 'conversation-text';
        text.textContent = message.content;
        
        const time = document.createElement('div');
        time.className = 'conversation-time';
        if (message.timestamp) {
            const messageTime = new Date(message.timestamp);
            time.textContent = messageTime.toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
        } else {
            time.textContent = `第${index + 1}轮`;
        }
        
        bubble.appendChild(text);
        bubble.appendChild(time);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(bubble);
        
        return messageDiv;
    }

    /**
     * 更新滚动指示器
     */
    updateScrollIndicator() {
        if (!this.conversationMessages) return;

        const container = this.conversationMessages.parentElement; // conversation-container
        const hasScroll = this.conversationMessages.scrollHeight > this.conversationMessages.clientHeight;

        if (hasScroll) {
            container.classList.add('has-scroll');
        } else {
            container.classList.remove('has-scroll');
        }

        // 监听滚动事件，当滚动到底部时隐藏指示器
        this.conversationMessages.addEventListener('scroll', () => {
            const isAtBottom = this.conversationMessages.scrollTop + this.conversationMessages.clientHeight >=
                              this.conversationMessages.scrollHeight - 5; // 5px 容差

            if (isAtBottom) {
                container.classList.remove('has-scroll');
            } else if (hasScroll) {
                container.classList.add('has-scroll');
            }
        });
    }
    
    /**
     * 导出对话记录
     */
    exportConversation() {
        if (!this.currentViewingInterviewId) {
            alert('无法导出：未找到当前查看的面试记录');
            return;
        }
        
        const interviews = this.storageManager.getInterviews();
        const interview = interviews.find(item => item.id === this.currentViewingInterviewId);
        
        if (!interview || !interview.messages) {
            alert('无法导出：面试记录数据不完整');
            return;
        }
        
        try {
            // 生成导出内容
            const exportContent = this.generateExportContent(interview);
            
            // 创建并下载文件
            const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `面试记录_${interview.id}_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('对话记录导出成功');
            alert('对话记录导出成功！');
        } catch (error) {
            console.error('导出对话记录失败:', error);
            alert('导出失败：' + error.message);
        }
    }
    
    /**
     * 生成导出内容
     */
    generateExportContent(interview) {
        const lines = [];
        
        // 头部信息
        lines.push('='.repeat(50));
        lines.push('AI面试官 - 面试对话记录');
        lines.push('='.repeat(50));
        lines.push('');
        lines.push(`面试ID: ${interview.id}`);
        lines.push(`面试时间: ${new Date(interview.createdAt).toLocaleString('zh-CN')}`);
        
        if (interview.duration) {
            const duration = interview.duration;
            if (duration >= 60) {
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                lines.push(`面试时长: ${minutes}分${seconds}秒`);
            } else {
                lines.push(`面试时长: ${duration}秒`);
            }
        }
        
        lines.push(`对话轮次: ${interview.messages.length}条`);
        
        if (interview.title) {
            lines.push(`面试标题: ${interview.title}`);
        }
        
        if (interview.summary) {
            lines.push(`面试摘要: ${interview.summary}`);
        }
        
        if (interview.score || (interview.evaluation && interview.evaluation.total_score)) {
            lines.push(`面试评分: ${interview.score || interview.evaluation.total_score}分`);
        }
        
        lines.push('');
        lines.push('-'.repeat(50));
        lines.push('对话内容');
        lines.push('-'.repeat(50));
        lines.push('');
        
        // 对话内容
        interview.messages.forEach((message, index) => {
            const messageType = message.type || message.role;
            const speaker = messageType === 'assistant' ? 'AI面试官' : '求职者';
            const timestamp = message.timestamp ? 
                new Date(message.timestamp).toLocaleTimeString('zh-CN') : 
                `第${index + 1}轮`;
            
            lines.push(`[${timestamp}] ${speaker}:`);
            lines.push(message.content);
            lines.push('');
        });
        
        lines.push('-'.repeat(50));
        lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
        lines.push('由 AI面试官系统 生成');
        lines.push('='.repeat(50));
        
        return lines.join('\n');
    }
}

/**
 * 简历管理器
 */
class ResumeManager {
    constructor(storageManager, router) {
        this.storageManager = storageManager;
        this.router = router;
        this.fileInput = null;
        this.uploadArea = null;
        this.resumeInfo = null;
        
        this.init();
    }

    init() {
        this.fileInput = document.getElementById('resumeFileInput');
        this.uploadArea = document.getElementById('resumeFileUploadArea');
        this.resumeInfo = document.getElementById('resumeInfo');
        
        this.bindResumeEvents();
        this.refreshResumeInfo();
    }

    bindResumeEvents() {
        // 文件选择
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleFileSelect(file);
                }
            });
        }

        // 拖拽上传
        if (this.uploadArea) {
            this.uploadArea.addEventListener('click', () => {
                this.fileInput?.click();
            });

            this.uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.uploadArea.classList.add('drag-over');
            });

            this.uploadArea.addEventListener('dragleave', () => {
                this.uploadArea.classList.remove('drag-over');
            });

            this.uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                this.uploadArea.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileSelect(files[0]);
                }
            });
        }
    }

    refreshResumeInfo() {
        const resumeData = this.storageManager.getCurrentResume();
        
        if (resumeData) {
            this.showResumeInfo(resumeData);
        } else {
            this.showNoResume();
        }
    }

    showResumeInfo(resumeData) {
        if (this.resumeInfo) {
            this.resumeInfo.innerHTML = this.createResumeInfoHTML(resumeData);
            this.bindResumeInfoEvents();
        }
    }

    showNoResume() {
        if (this.resumeInfo) {
            this.resumeInfo.innerHTML = `
                <div class="no-resume" id="noResume">
                    <div class="no-resume-illustration">
                        <i class="fas fa-file-upload"></i>
                    </div>
                    <h3>暂未上传简历</h3>
                    <p>上传简历后，天汇AI面试官将基于您的背景生成个性化面试问题</p>
                    <div class="resume-benefits">
                        <div class="benefit-item">
                            <i class="fas fa-bullseye"></i>
                            <span>针对性问题</span>
                        </div>
                        <div class="benefit-item">
                            <i class="fas fa-star"></i>
                            <span>技能匹配</span>
                        </div>
                        <div class="benefit-item">
                            <i class="fas fa-chart-bar"></i>
                            <span>深度分析</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    createResumeInfoHTML(resumeData) {
        const uploadDate = new Date(resumeData.uploadedAt).toLocaleString('zh-CN');
        
        return `
            <div class="resume-card">
                <div class="resume-header">
                    <div class="resume-icon">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div class="resume-details">
                        <h4>${resumeData.fileName}</h4>
                        <div class="resume-meta">
                            <span><i class="fas fa-calendar"></i> ${uploadDate}</span>
                            <span><i class="fas fa-file-text"></i> ${resumeData.textLength} 字符</span>
                        </div>
                        <div class="resume-status">
                            <span class="status-badge success">
                                <i class="fas fa-check"></i>
                                已解析
                            </span>
                        </div>
                    </div>
                </div>
                <div class="resume-preview">
                    <h5><i class="fas fa-eye"></i> 简历预览</h5>
                    <div class="preview-content">
                    <p class="preview-text">${resumeData.preview}</p>
                    </div>
                </div>
                <div class="resume-actions">
                    <button class="btn-secondary" onclick="resumeManager.removeResume()">
                        <i class="fas fa-trash"></i>
                        删除简历
                    </button>
                </div>
            </div>
        `;
    }

    bindResumeInfoEvents() {
        // 事件已在HTML中绑定
    }

    handleFileSelect(file) {
        if (this.validateFile(file)) {
            this.uploadFile(file);
        }
    }

    validateFile(file) {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!allowedTypes.includes(file.type)) {
            alert('请选择PDF或Word文档格式的文件');
            return false;
        }

        if (file.size > maxSize) {
            alert('文件大小不能超过10MB');
            return false;
        }

        return true;
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            this.showUploadProgress();
            
            const response = await fetch('/api/upload-resume', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.handleUploadSuccess(result, file.name);
            } else {
                this.handleUploadError(result.message || '上传失败');
            }
        } catch (error) {
            console.error('上传错误:', error);
            this.handleUploadError('网络错误，请稍后重试');
        } finally {
            this.hideUploadProgress();
        }
    }

    showUploadProgress() {
        if (this.uploadArea) {
            this.uploadArea.innerHTML = `
                <div class="upload-progress">
                    <div class="loading-spinner"></div>
                    <p>正在上传和解析简历...</p>
                </div>
            `;
        }
    }

    hideUploadProgress() {
        if (this.uploadArea) {
            this.uploadArea.innerHTML = `
                <div class="upload-content">
                    <div class="upload-icon">📁</div>
                    <div class="upload-text">
                        <p class="upload-main-text">拖拽简历文件到此处，或点击选择文件</p>
                        <p class="upload-sub-text">支持 PDF、Word (.doc/.docx) 格式，最大 10MB</p>
                    </div>
                    <input type="file" id="resumeFileInput" class="file-input" accept=".pdf,.doc,.docx" />
                </div>
            `;
            
            // 重新绑定事件
            this.fileInput = document.getElementById('resumeFileInput');
            this.bindResumeEvents();
        }
    }

    handleUploadSuccess(response, fileName) {
        const resumeData = {
            fileName: fileName,
            sessionId: response.session_id,
            preview: response.preview,
            textLength: response.content_length,
            uploadedAt: new Date().toISOString()
        };

        this.storageManager.saveCurrentResume(resumeData);
        this.refreshResumeInfo();

        // 通知主应用简历已上传
        window.dispatchEvent(new CustomEvent('resumeUploaded', { 
            detail: { resumeData, sessionId: response.session_id } 
        }));

        alert('简历上传成功！系统将基于您的简历进行个性化面试。');
    }

    handleUploadError(errorMessage) {
        alert(`简历上传失败: ${errorMessage}`);
    }

    removeResume() {
        if (confirm('确定要删除当前简历吗？')) {
            this.storageManager.removeCurrentResume();
            this.refreshResumeInfo();
            
            // 通知主应用简历已删除
            window.dispatchEvent(new CustomEvent('resumeRemoved'));
            
            alert('简历已删除');
        }
    }
}

/**
 * 主应用类
 */
class AzureVoiceInterviewApp {
    constructor() {
        this.storageManager = new LocalStorageManager();
        this.router = new PageRouter();
        this.voiceChat = new AzureVoiceChat();
        this.historyManager = new HistoryManager(this.storageManager, this.router);
        this.resumeManager = new ResumeManager(this.storageManager, this.router);
        this.voiceCallManager = null; // 将在连接成功后初始化
        
        this.currentInterview = null;
        this.interviewStartTime = null;
        
        // 将app实例传递给voiceChat，以便访问voiceCallManager
        this.voiceChat.app = this;
        
        this.init();
    }

    init() {
        // 立即显示导航栏
        this.router.showNavigation();
        
        // 显示加载动画
        this.voiceChat.showLoadingOverlay('正在连接Azure语音服务...');
        
        // 绑定全局事件
        this.bindGlobalEvents();
        
        // 连接Azure语音服务
        this.voiceChat.connect();
        
        // 加载保存的简历
        this.loadSavedResume();
        
        // 监听连接成功事件，初始化语音通话管理器
        this.waitForConnection();
        
        console.log('Azure语音面试系统初始化完成');
    }
    
    waitForConnection() {
        const checkConnection = () => {
            if (this.voiceChat.ws && this.voiceChat.ws.readyState === WebSocket.OPEN) {
                // 连接成功，初始化语音通话管理器
                this.initVoiceCallManager();
                
                console.log('Azure语音服务连接成功');
            } else {
                // 继续等待连接
                setTimeout(checkConnection, 100);
            }
        };
        checkConnection();
    }
    
    /**
     * 初始化语音通话管理器
     */
    initVoiceCallManager() {
        try {
            this.voiceCallManager = new VoiceCallManager(this.voiceChat, this.storageManager);

            // 确保VoiceCallManager使用最新的设置
            if (this.voiceChat.settingsManager) {
                const settings = this.voiceChat.settingsManager.getSettings();
                this.voiceCallManager.updateVADConfig(settings.voice);
                this.voiceCallManager.updateAudioSettings(settings.audio);
            }

            // 浏览器兼容性检查现在在startVoiceCall方法中进行
            console.log('语音通话管理器初始化完成');


        } catch (error) {
            console.error('语音通话管理器初始化失败:', error);
        }
    }

    bindGlobalEvents() {
        // 简历上传事件
        window.addEventListener('resumeUploaded', (e) => {
            const { sessionId } = e.detail;
            this.voiceChat.setSessionId(sessionId);
        });

        // 简历删除事件
        window.addEventListener('resumeRemoved', () => {
            this.voiceChat.setSessionId('');
        });

        // 继续面试事件
        window.addEventListener('continueInterview', (e) => {
            const { interview } = e.detail;
            this.continueInterviewFromHistory(interview);
        });
    }

    loadSavedResume() {
        const resumeData = this.storageManager.getCurrentResume();
        if (resumeData && resumeData.sessionId) {
            this.voiceChat.setSessionId(resumeData.sessionId);
            console.log('已加载保存的简历会话');
        }
    }


}

// 全局变量，供HTML中的事件处理使用
let historyManager, resumeManager, voiceCallManager;

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    const app = new AzureVoiceInterviewApp();
    
    // 设置全局变量，使应用实例可以在全局访问
    window.app = app;
    historyManager = app.historyManager;
    resumeManager = app.resumeManager;
    
    // 语音通话管理器将在连接成功后设置
    const originalInitVoiceCallManager = app.initVoiceCallManager.bind(app);
    app.initVoiceCallManager = function() {
        originalInitVoiceCallManager();
        voiceCallManager = this.voiceCallManager;
    };
    
    console.log('Azure语音面试官应用已启动');
});

// 拖拽上传功能
function initDragAndDrop() {
    const uploadZone = document.querySelector('.upload-content');
    if (!uploadZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, unhighlight, false);
    });

    uploadZone.addEventListener('drop', handleDrop, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        uploadZone.classList.add('dragover');
    }

    function unhighlight(e) {
        uploadZone.classList.remove('dragover');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        ([...files]).forEach(uploadFile);
    }

    function uploadFile(file) {
        // 这里可以添加文件上传逻辑
        console.log('上传文件:', file.name);
        
        // 显示上传进度
        showUploadProgress(file.name);
    }
}

// 显示上传进度
function showUploadProgress(fileName) {
    const progressHtml = `
        <div class="upload-progress">
            <div class="progress-info">
                <i class="fas fa-file-upload"></i>
                <span>正在上传: ${fileName}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
        </div>
    `;
    
    // 可以添加到适当的容器中显示进度
    console.log('上传进度:', fileName);
}

// 语音状态动画增强
function updateVoiceStatus(status, text) {
    const statusElement = document.querySelector('.voice-status-text');
    if (!statusElement) return;

    // 移除所有状态类
    statusElement.classList.remove('listening', 'processing', 'speaking');
    
    // 添加新状态类
    if (status) {
        statusElement.classList.add(status);
    }
    
    // 更新文本
    if (text) {
        statusElement.textContent = text;
    }
}

// 消息流式显示增强
function displayMessageWithStreaming(message, isUser = false) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = isUser ? 
        '<i class="fas fa-user"></i>' : 
        '<i class="fas fa-robot"></i>';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    const text = document.createElement('div');
    text.className = 'message-text';
    
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    bubble.appendChild(text);
    bubble.appendChild(timestamp);
    content.appendChild(bubble);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    messagesContainer.appendChild(messageDiv);
    
    // 如果不是用户消息，添加流式显示效果
    if (!isUser) {
        const indicator = document.createElement('span');
        indicator.className = 'streaming-indicator';
        text.appendChild(indicator);
        
        // 模拟流式显示
        let currentText = '';
        let index = 0;
        
        function typeWriter() {
            if (index < message.length) {
                currentText += message.charAt(index);
                text.innerHTML = currentText + '<span class="streaming-indicator"></span>';
                index++;
                setTimeout(typeWriter, 30); // 调整打字速度
            } else {
                text.innerHTML = currentText; // 移除指示器
            }
        }
        
        typeWriter();
    } else {
        text.textContent = message;
    }
    
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 统计数据更新
function updateStats(stats) {
    const statElements = {
        total: document.querySelector('.stat-item:nth-child(1) .stat-number'),
        today: document.querySelector('.stat-item:nth-child(2) .stat-number'),
        success: document.querySelector('.stat-item:nth-child(3) .stat-number')
    };
    
    if (stats.total && statElements.total) {
        statElements.total.textContent = stats.total;
    }
    if (stats.today && statElements.today) {
        statElements.today.textContent = stats.today;
    }
    if (stats.success && statElements.success) {
        statElements.success.textContent = stats.success;
    }
}

// 简历卡片生成
function generateResumeCard(resume) {
    return `
        <div class="resume-card">
            <div class="resume-header">
                <div class="resume-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="resume-details">
                    <h4>${resume.name || '未命名简历'}</h4>
                    <div class="resume-meta">
                        <span><i class="fas fa-calendar"></i> ${resume.uploadDate || '未知日期'}</span>
                        <span><i class="fas fa-file-text"></i> ${resume.size || '未知大小'}</span>
                        <span><i class="fas fa-eye"></i> ${resume.views || 0} 次查看</span>
                    </div>
                    <div class="resume-status">
                        <span class="status-badge ${resume.status === 'processed' ? 'success' : 'warning'}">
                            <i class="fas fa-${resume.status === 'processed' ? 'check' : 'clock'}"></i>
                            ${resume.status === 'processed' ? '已处理' : '处理中'}
                        </span>
                    </div>
                </div>
            </div>
            ${resume.preview ? `
                <div class="resume-preview">
                    <h5><i class="fas fa-eye"></i> 简历预览</h5>
                    <div class="preview-content">
                        <p class="preview-text">${resume.preview}</p>
                    </div>
                </div>
            ` : ''}
            <div class="resume-actions">
                <button class="btn btn-secondary" onclick="viewResume('${resume.id}')">
                    <i class="fas fa-eye"></i> 查看详情
                </button>
                <button class="btn btn-primary" onclick="useResume('${resume.id}')">
                    <i class="fas fa-play"></i> 开始面试
                </button>
            </div>
        </div>
    `;
}

// 历史记录增强显示
function generateHistoryItem(item) {
    return `
        <div class="history-item">
            <div class="history-header">
                <div class="history-title">
                    <i class="fas fa-comments"></i>
                    面试记录 #${item.id}
                    ${item.completed ? '<span class="history-badge"><i class="fas fa-check"></i> 已完成</span>' : ''}
                </div>
                <div class="history-meta">
                    <span><i class="fas fa-calendar"></i> ${item.date}</span>
                    <span><i class="fas fa-clock"></i> ${item.duration}</span>
                    <span><i class="fas fa-star"></i> ${item.score || 'N/A'}</span>
                </div>
            </div>
            <div class="history-summary">
                ${item.summary || '暂无总结'}
            </div>
            <div class="history-actions">
                <button class="btn btn-secondary btn-sm" onclick="viewHistory('${item.id}')">
                    <i class="fas fa-eye"></i> 查看详情
                </button>
                <button class="btn btn-primary btn-sm" onclick="continueInterview('${item.id}')">
                    <i class="fas fa-play"></i> 继续面试
                   </button>
            </div>
        </div>
    `;
}

// 快捷操作增强
function addQuickActions() {
    const quickActions = document.querySelector('.quick-actions');
    if (!quickActions) return;

    const buttons = quickActions.querySelectorAll('.quick-btn');

    buttons.forEach((btn, index) => {
        // 跳过已经有特定ID的按钮（如preparationSettingsButton）
        if (btn.id && btn.id !== '') {
            return;
        }

        btn.addEventListener('click', () => {
            // 添加点击动画
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
            }, 150);

            // 根据按钮执行不同操作
            switch(index) {
                case 0: // 上传简历 - 切换到简历页面
                    if (window.app && window.app.router) {
                        window.app.router.navigateTo('resume');
                    }
                    break;
                case 1: // 查看历史 - 切换到历史页面
                    if (window.app && window.app.router) {
                        window.app.router.navigateTo('history');
                    }
                    break;
                case 2: // 设置 - 显示设置面板
                    showSettingsPanel();
                    break;
            }
        });
    });
}

// 设置面板功能
function showSettingsPanel() {
    // 检查是否在准备页面，如果是则显示准备页面设置
    const preparationPage = document.querySelector('.preparation-page');
    if (preparationPage && preparationPage.style.display !== 'none') {
        // 调用准备页面设置功能
        if (window.app && window.app.voiceChat && window.app.voiceChat.showPreparationSettings) {
            window.app.voiceChat.showPreparationSettings();
        } else {
            showNotification('设置', '准备页面设置功能正在加载中...', 'info', 2000);
        }
    } else {
        // 其他页面显示通用设置
        showNotification('设置', '更多设置功能开发中，敬请期待！', 'info', 3000);
    }
    console.log('显示设置面板');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化拖拽上传
    initDragAndDrop();
    
    // 初始化快捷操作
    addQuickActions();
    
    // 初始化统计数据
    updateStats({
        total: 0,
        today: 0,
        success: 0
    });
});

// 通知系统
function showNotification(title, message, type = 'success', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
        <div class="notification-header">
            <div class="notification-title">
                <i class="fas fa-${getNotificationIcon(type)}"></i>
                ${title}
            </div>
            <button class="notification-close" onclick="closeNotification(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="notification-content">${message}</div>
    `;
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => notification.classList.add('show'), 100);
    
    // 自动关闭
    if (duration > 0) {
        setTimeout(() => closeNotification(notification.querySelector('.notification-close')), duration);
    }
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        warning: 'exclamation-triangle',
        error: 'times-circle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function closeNotification(button) {
    const notification = button.closest('.notification');
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
}

// 工具函数
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// 本地存储管理
const Storage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('无法保存到本地存储:', e);
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn('无法从本地存储读取:', e);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('无法从本地存储删除:', e);
        }
    }
};

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 复制到剪贴板
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('复制成功', '内容已复制到剪贴板', 'success', 2000);
        return true;
    } catch (err) {
        console.error('复制失败:', err);
        showNotification('复制失败', '无法复制到剪贴板', 'error', 3000);
        return false;
    }
}

// 下载文件
function downloadFile(content, filename, contentType = 'text/plain') {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// 骨架屏加载
function showSkeleton(container, count = 3) {
    const skeletonHtml = Array(count).fill().map(() => `
        <div class="skeleton-item" style="margin-bottom: 1rem;">
            <div class="skeleton skeleton-text" style="height: 1.2em; margin-bottom: 0.5rem;"></div>
            <div class="skeleton skeleton-text" style="height: 1em; width: 80%;"></div>
        </div>
    `).join('');
    
    if (typeof container === 'string') {
        container = document.querySelector(container);
    }
    
    if (container) {
        container.innerHTML = skeletonHtml;
    }
}

// 移除骨架屏
function hideSkeleton(container) {
    if (typeof container === 'string') {
        container = document.querySelector(container);
    }
    
    if (container) {
        const skeletons = container.querySelectorAll('.skeleton-item');
        skeletons.forEach(skeleton => skeleton.remove());
    }
}

// 模拟API调用
function mockApiCall(data, delay = 1000) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(data), delay);
    });
}

// 表单验证
function validateForm(formElement) {
    const errors = [];
    const inputs = formElement.querySelectorAll('input[required], textarea[required], select[required]');
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            errors.push(`${input.getAttribute('data-label') || input.name} 不能为空`);
            input.classList.add('error');
        } else {
            input.classList.remove('error');
        }
        
        // 邮箱验证
        if (input.type === 'email' && input.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.value)) {
                errors.push('请输入有效的邮箱地址');
                input.classList.add('error');
            }
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// 页面可见性检测
function onVisibilityChange(callback) {
    document.addEventListener('visibilitychange', () => {
        callback(!document.hidden);
    });
}

// 网络状态检测
function onNetworkChange(callback) {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
}

// 初始化所有功能
function initializeApp() {
    // 初始化拖拽上传
    initDragAndDrop();
    
    // 初始化快捷操作
    addQuickActions();
    
    // 初始化统计数据
    updateStats({
        total: Storage.get('interview_total', 0),
        today: Storage.get('interview_today', 0),
        success: Storage.get('interview_success', 0)
    });
    
    // 网络状态监听
    onNetworkChange((isOnline) => {
        if (isOnline) {
            showNotification('网络连接', '网络连接已恢复', 'success', 3000);
        } else {
            showNotification('网络断开', '网络连接已断开，请检查网络设置', 'warning', 0);
        }
    });
    
    // 页面可见性监听
    onVisibilityChange((isVisible) => {
        if (isVisible) {
            console.log('页面变为可见');
            // 可以在这里刷新数据
        } else {
            console.log('页面变为隐藏');
            // 可以在这里暂停某些操作
        }
    });
    
    console.log('AI智能面试官应用已完全初始化');

    // 初始化新手引导系统集成
    initTutorialIntegration();
}

/**
 * 初始化新手引导系统集成
 */
function initTutorialIntegration() {
    // 等待引导系统加载完成
    const checkTutorialSystem = () => {
        if (window.tutorialGuide) {
            // 绑定引导触发事件
            bindTutorialTriggers();
            console.log('✅ 新手引导系统集成完成');
        } else {
            setTimeout(checkTutorialSystem, 100);
        }
    };
    checkTutorialSystem();
}

/**
 * 绑定引导触发器
 */
function bindTutorialTriggers() {
    // 添加设置中的引导重启选项
    addTutorialSettings();

    // 监听页面切换事件，提供上下文相关的引导
    window.addEventListener('pageChanged', (event) => {
        const page = event.detail.page;
        handlePageSpecificTutorial(page);
    });

    // 监听简历上传事件，提供相关引导
    window.addEventListener('resumeUploaded', () => {
        showContextualTip('resume-uploaded');
    });

    // 监听面试开始事件
    window.addEventListener('interviewStarted', () => {
        showContextualTip('interview-started');
    });
}

/**
 * 添加引导相关的设置选项
 */
function addTutorialSettings() {
    // 在设置面板中添加引导选项
    const settingsPanel = document.querySelector('.settings-panel');
    if (settingsPanel) {
        const tutorialSection = document.createElement('div');
        tutorialSection.className = 'settings-section';
        tutorialSection.innerHTML = `
            <h3 class="settings-title">
                <i class="fas fa-graduation-cap"></i>
                新手引导与帮助
            </h3>
            <div class="settings-item">
                <label class="settings-label">
                    <span>重新开始引导教程</span>
                    <button class="btn-secondary btn-sm" id="restartTutorialBtn">
                        <i class="fas fa-redo"></i>
                        重新开始
                    </button>
                </label>
            </div>
            <div class="settings-item">
                <label class="settings-label">
                    <span>功能引导</span>
                    <select class="settings-select" id="featureTutorialSelect">
                        <option value="">选择功能引导</option>
                        <option value="voice-interview">语音面试</option>
                        <option value="resume-upload">简历上传</option>
                        <option value="interview-history">面试历史</option>
                    </select>
                </label>
            </div>
            <div class="settings-item">
                <label class="settings-label">
                    <span>智能提示</span>
                    <div class="settings-toggle">
                        <input type="checkbox" id="smartTipsToggle" checked>
                        <span class="toggle-slider"></span>
                    </div>
                </label>
            </div>
            <div class="settings-item">
                <label class="settings-label">
                    <span>引导数据管理</span>
                    <div class="settings-actions">
                        <button class="btn-outline btn-sm" id="exportTutorialDataBtn">
                            <i class="fas fa-download"></i>
                            导出数据
                        </button>
                        <button class="btn-outline btn-sm" id="resetTutorialDataBtn">
                            <i class="fas fa-trash"></i>
                            重置数据
                        </button>
                    </div>
                </label>
            </div>
            <div class="settings-item">
                <label class="settings-label">
                    <span>引导统计</span>
                    <div class="tutorial-stats" id="tutorialStats">
                        <div class="stat-item">
                            <span class="stat-label">完成的引导:</span>
                            <span class="stat-value" id="completedTutorials">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">智能提示:</span>
                            <span class="stat-value" id="smartTipsCount">0</span>
                        </div>
                    </div>
                </label>
            </div>
        `;

        settingsPanel.appendChild(tutorialSection);

        // 绑定事件
        bindTutorialSettingsEvents();

        // 更新统计数据
        updateTutorialStats();
    }
}

/**
 * 绑定引导设置事件
 */
function bindTutorialSettingsEvents() {
    // 重新开始引导
    document.getElementById('restartTutorialBtn')?.addEventListener('click', () => {
        if (window.tutorialGuide) {
            window.tutorialGuide.restartTutorial();
            hideCurrentSettingsPanel();
        }
    });

    // 功能引导选择
    document.getElementById('featureTutorialSelect')?.addEventListener('change', (e) => {
        const feature = e.target.value;
        if (feature && window.tutorialGuide) {
            window.tutorialGuide.startFeatureTutorial(feature);
            hideCurrentSettingsPanel();
            e.target.value = '';
        }
    });

    // 智能提示开关
    document.getElementById('smartTipsToggle')?.addEventListener('change', (e) => {
        if (window.smartTips) {
            window.smartTips.setEnabled(e.target.checked);
            showNotification(
                '设置已保存',
                `智能提示已${e.target.checked ? '启用' : '禁用'}`,
                'success',
                2000
            );
        }
    });

    // 导出引导数据
    document.getElementById('exportTutorialDataBtn')?.addEventListener('click', () => {
        exportTutorialData();
    });

    // 重置引导数据
    document.getElementById('resetTutorialDataBtn')?.addEventListener('click', () => {
        if (confirm('确定要重置所有引导数据吗？这将清除您的引导进度和偏好设置。')) {
            resetTutorialData();
            updateTutorialStats();
            showNotification('数据已重置', '所有引导数据已清除', 'success', 3000);
        }
    });
}

/**
 * 更新引导统计数据
 */
function updateTutorialStats() {
    const completedElement = document.getElementById('completedTutorials');
    const tipsCountElement = document.getElementById('smartTipsCount');

    if (completedElement && tipsCountElement) {
        // 统计完成的引导数量
        const completedTutorials = getTutorialCompletionCount();
        const smartTipsCount = getSmartTipsCount();

        completedElement.textContent = completedTutorials;
        tipsCountElement.textContent = smartTipsCount;
    }

    // 更新智能提示开关状态
    const smartTipsToggle = document.getElementById('smartTipsToggle');
    if (smartTipsToggle && window.smartTips) {
        smartTipsToggle.checked = window.smartTips.isEnabled;
    }
}

/**
 * 获取引导完成数量
 */
function getTutorialCompletionCount() {
    const keys = [
        'tutorial_completed',
        'tutorial_welcome_completed',
        'tutorial_voice-interview_completed',
        'tutorial_resume-upload_completed',
        'tutorial_interview-history_completed'
    ];

    return keys.filter(key => localStorage.getItem(key) === 'true').length;
}

/**
 * 获取智能提示数量
 */
function getSmartTipsCount() {
    const tipsHistory = localStorage.getItem('smart_tips_history');
    if (tipsHistory) {
        try {
            return JSON.parse(tipsHistory).length;
        } catch (e) {
            return 0;
        }
    }
    return 0;
}

/**
 * 导出引导数据
 */
function exportTutorialData() {
    const tutorialData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
            tutorialCompleted: localStorage.getItem('tutorial_completed'),
            tutorialProgress: localStorage.getItem('tutorial_progress'),
            userPreferences: localStorage.getItem('tutorial_preferences'),
            skipTutorials: localStorage.getItem('skip_tutorials'),
            smartTipsEnabled: localStorage.getItem('smart_tips_enabled'),
            smartTipsHistory: localStorage.getItem('smart_tips_history'),
            dismissedTips: localStorage.getItem('dismissed_tips'),
            completedTutorials: getTutorialCompletionCount(),
            smartTipsCount: getSmartTipsCount()
        }
    };

    const dataStr = JSON.stringify(tutorialData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `tutorial-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    showNotification('导出成功', '引导数据已导出到文件', 'success', 3000);
}

/**
 * 重置引导数据
 */
function resetTutorialData() {
    const tutorialKeys = [
        'tutorial_completed',
        'tutorial_progress',
        'tutorial_preferences',
        'skip_tutorials',
        'smart_tips_enabled',
        'smart_tips_history',
        'dismissed_tips',
        'tutorial_welcome_completed',
        'tutorial_voice-interview_completed',
        'tutorial_resume-upload_completed',
        'tutorial_interview-history_completed',
        'tutorial_interview_shown',
        'tutorial_resume_shown',
        'tutorial_history_shown'
    ];

    tutorialKeys.forEach(key => {
        localStorage.removeItem(key);
    });

    // 重置引导系统状态
    if (window.tutorialGuide) {
        window.tutorialGuide.endTutorial();
    }

    // 重置智能提示系统
    if (window.smartTips) {
        window.smartTips.resetTipHistory();
        window.smartTips.setEnabled(true);
    }
}

/**
 * 隐藏当前显示的设置面板
 */
function hideCurrentSettingsPanel() {
    // 隐藏准备页面设置面板
    const preparationSettingsPanel = document.getElementById('preparationSettingsPanel');
    if (preparationSettingsPanel && preparationSettingsPanel.style.display === 'block') {
        preparationSettingsPanel.style.display = 'none';
        return;
    }

    // 隐藏其他可能的设置面板
    const settingsPanels = document.querySelectorAll('.settings-panel, .modal[style*="display: block"]');
    settingsPanels.forEach(panel => {
        if (panel.style.display === 'block' || panel.style.display === 'flex') {
            panel.style.display = 'none';
        }
    });
}

/**
 * 处理页面特定的引导
 */
function handlePageSpecificTutorial(page) {
    // 检查用户是否需要该页面的引导
    const tutorialKey = `tutorial_${page}_shown`;
    const hasShownTutorial = localStorage.getItem(tutorialKey);

    if (!hasShownTutorial && window.tutorialGuide) {
        // 延迟显示，等待页面渲染完成
        setTimeout(() => {
            switch(page) {
                case 'resume':
                    if (document.querySelector('.upload-area')) {
                        window.tutorialGuide.startFeatureTutorial('resume-upload');
                        localStorage.setItem(tutorialKey, 'true');
                    }
                    break;
                case 'history':
                    if (document.querySelector('.history-list')) {
                        window.tutorialGuide.startFeatureTutorial('interview-history');
                        localStorage.setItem(tutorialKey, 'true');
                    }
                    break;
            }
        }, 500);
    }
}

/**
 * 显示上下文相关的提示
 */
function showContextualTip(context) {
    const tips = {
        'resume-uploaded': {
            title: '简历上传成功！',
            message: '现在AI将基于您的简历进行个性化面试。建议您先熟悉一下语音面试功能。',
            action: () => {
                if (window.tutorialGuide) {
                    window.tutorialGuide.startFeatureTutorial('voice-interview');
                }
            }
        },
        'interview-started': {
            title: '面试开始提示',
            message: '💡 小贴士：您可以随时切换语音和文字输入模式，放松心情，正常发挥即可。',
            duration: 5000
        }
    };

    const tip = tips[context];
    if (tip) {
        if (tip.action) {
            // 显示带操作的提示
            const result = confirm(`${tip.title}\n\n${tip.message}\n\n是否查看语音面试引导？`);
            if (result) {
                tip.action();
            }
        } else {
            // 显示普通提示
            showNotification(tip.title, tip.message, 'info', tip.duration || 3000);
        }
    }
}

// 删除重复的DOMContentLoaded监听器，使用主应用初始化

// 导出常用函数到全局作用域
window.showNotification = showNotification;
window.copyToClipboard = copyToClipboard;
window.downloadFile = downloadFile;
window.formatFileSize = formatFileSize;
window.formatDate = formatDate;
window.formatDuration = formatDuration;

window.addEventListener('keydown', (event) => {
    const modal = document.getElementById('evaluationModal');
    if (event.key === 'Escape' && modal.style.display === 'flex') {
        modal.style.display = 'none';
    }
});