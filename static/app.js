/**
 * LLM面试官前端应用
 * 
 * 实现WebSocket连接、流式消息显示、用户交互等功能
 * 新增功能：页面路由、历史记录管理、本地数据存储
 */

/**
 * LocalStorage数据管理器
 */
class LocalStorageManager {
    constructor() {
        this.KEYS = {
            INTERVIEWS: 'llm_interviews_history',
            CURRENT_RESUME: 'llm_current_resume',
            APP_SETTINGS: 'llm_app_settings'
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
            interview.id = Date.now().toString();
            interview.createdAt = new Date().toISOString();
            interviews.unshift(interview);
            
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
            localStorage.setItem(this.KEYS.CURRENT_RESUME, JSON.stringify(resumeData));
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
            return data ? JSON.parse(data) : null;
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
            const button = this.navButtons[page];
            if (button) {
                if (page === activePage) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }
        });
    }

    showNavigation() {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.style.display = 'block';
        }
    }

    hideNavigation() {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.style.display = 'none';
        }
    }

    getCurrentPage() {
        return this.currentPage;
    }
}

/**
 * 面试历史记录管理器
 */
class HistoryManager {
    constructor(storageManager, router) {
        this.storage = storageManager;
        this.router = router;
        this.currentSort = 'date-desc';
        
        this.init();
    }

    init() {
        // 绑定页面切换事件
        window.addEventListener('pageChanged', (e) => {
            if (e.detail.page === 'history') {
                this.refreshHistoryList();
            }
        });

        // 绑定历史记录页面事件
        this.bindHistoryEvents();
    }

    bindHistoryEvents() {
        // 排序选择
        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
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
        const startFirstBtn = document.getElementById('startFirstInterviewBtn');
        if (startFirstBtn) {
            startFirstBtn.addEventListener('click', () => {
                this.router.navigateTo('interview');
            });
        }
    }

    refreshHistoryList() {
        const historyList = document.getElementById('historyList');
        const emptyHistory = document.getElementById('emptyHistory');
        
        if (!historyList) return;

        const interviews = this.storage.getInterviews();
        
        if (interviews.length === 0) {
            // 显示空状态
            historyList.innerHTML = '';
            historyList.appendChild(emptyHistory);
            return;
        }

        // 隐藏空状态
        if (emptyHistory && emptyHistory.parentNode) {
            emptyHistory.parentNode.removeChild(emptyHistory);
        }

        // 排序面试记录
        const sortedInterviews = this.sortInterviews(interviews);

        // 生成历史记录列表
        historyList.innerHTML = sortedInterviews.map(interview => 
            this.createHistoryItemHTML(interview)
        ).join('');

        // 绑定历史记录项事件
        this.bindHistoryItemEvents();
    }

    sortInterviews(interviews) {
        return [...interviews].sort((a, b) => {
            switch (this.currentSort) {
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
        const date = new Date(interview.createdAt);
        const dateStr = date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const duration = interview.duration ? 
            `${Math.floor(interview.duration / 60)}分钟` : '未知';

        const messageCount = interview.messages ? interview.messages.length : 0;
        const hasResume = interview.resumeInfo ? '有简历' : '无简历';

        return `
            <div class="history-item" data-id="${interview.id}">
                <div class="history-header">
                    <div class="history-title">
                        <h4>面试记录 - ${dateStr}</h4>
                        <div class="history-tags">
                            <span class="tag">${hasResume}</span>
                            <span class="tag">${messageCount}条对话</span>
                            <span class="tag">${duration}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="btn-text continue-btn" data-id="${interview.id}">
                            继续面试
                        </button>
                        <button class="btn-text view-btn" data-id="${interview.id}">
                            查看详情
                        </button>
                        <button class="btn-text delete-btn" data-id="${interview.id}">
                            删除
                        </button>
                    </div>
                </div>
                <div class="history-preview">
                    <p class="preview-text">${this.getInterviewPreview(interview)}</p>
                </div>
                <div class="history-details" style="display: none;">
                    ${this.createHistoryDetailsHTML(interview)}
                </div>
            </div>
        `;
    }

    createHistoryDetailsHTML(interview) {
        if (!interview.messages || interview.messages.length === 0) {
            return '<p>暂无对话记录</p>';
        }

        const messagesHTML = interview.messages.map(msg => `
            <div class="detail-message ${msg.role}">
                <div class="message-header">
                    <span class="message-role">${msg.role === 'user' ? '您' : 'AI面试官'}</span>
                    <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString('zh-CN')}</span>
                </div>
                <div class="message-content">${msg.content}</div>
            </div>
        `).join('');

        return `
            <div class="interview-details">
                <div class="details-header">
                    <h5>详细对话记录</h5>
                </div>
                <div class="details-messages">
                    ${messagesHTML}
                </div>
            </div>
        `;
    }

    getInterviewPreview(interview) {
        if (!interview.messages || interview.messages.length === 0) {
            return '暂无对话记录';
        }

        const firstMessage = interview.messages.find(msg => msg.role === 'assistant');
        if (firstMessage) {
            return firstMessage.content.substring(0, 100) + (firstMessage.content.length > 100 ? '...' : '');
        }

        return '面试记录';
    }

    bindHistoryItemEvents() {
        // 继续面试按钮
        document.querySelectorAll('.continue-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.continueInterview(id);
            });
        });

        // 查看详情按钮
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.toggleDetails(id);
            });
        });

        // 删除按钮
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.deleteInterview(id);
            });
        });
    }

    continueInterview(id) {
        const interviews = this.storage.getInterviews();
        const interview = interviews.find(item => item.id === id);
        
        if (!interview) {
            alert('面试记录不存在');
            return;
        }

        // 触发继续面试事件
        window.dispatchEvent(new CustomEvent('continueInterview', { 
            detail: { interview } 
        }));

        // 切换到面试页面
        this.router.navigateTo('interview');
    }

    toggleDetails(id) {
        const historyItem = document.querySelector(`[data-id="${id}"]`);
        if (!historyItem) return;

        const details = historyItem.querySelector('.history-details');
        const viewBtn = historyItem.querySelector('.view-btn');
        
        if (details.style.display === 'none') {
            details.style.display = 'block';
            viewBtn.textContent = '收起详情';
        } else {
            details.style.display = 'none';
            viewBtn.textContent = '查看详情';
        }
    }

    deleteInterview(id) {
        if (confirm('确定要删除这条面试记录吗？此操作不可恢复。')) {
            if (this.storage.deleteInterview(id)) {
                this.refreshHistoryList();
            } else {
                alert('删除失败，请重试');
            }
        }
    }

    clearHistory() {
        if (confirm('确定要清空所有面试记录吗？此操作不可恢复。')) {
            if (this.storage.clearInterviews()) {
                this.refreshHistoryList();
            } else {
                alert('清空失败，请重试');
            }
        }
    }
}

/**
 * 简历管理器
 */
class ResumeManager {
    constructor(storageManager, router) {
        this.storage = storageManager;
        this.router = router;
        
        this.init();
    }

    init() {
        // 绑定页面切换事件
        window.addEventListener('pageChanged', (e) => {
            if (e.detail.page === 'resume') {
                this.refreshResumeInfo();
            }
        });

        // 绑定简历页面事件
        this.bindResumeEvents();
    }

    bindResumeEvents() {
        // 文件上传
        const fileInput = document.getElementById('resumeFileInput');
        const uploadArea = document.getElementById('resumeFileUploadArea');

        if (fileInput && uploadArea) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files[0]);
                }
            });

            // 拖拽上传
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileSelect(files[0]);
                }
            });

            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });
        }
    }

    refreshResumeInfo() {
        const resumeInfo = document.getElementById('resumeInfo');
        const noResume = document.getElementById('noResume');
        
        if (!resumeInfo) return;

        const currentResume = this.storage.getCurrentResume();
        
        if (!currentResume) {
            // 显示无简历状态
            resumeInfo.innerHTML = '';
            resumeInfo.appendChild(noResume);
            return;
        }

        // 显示简历信息
        resumeInfo.innerHTML = this.createResumeInfoHTML(currentResume);
        this.bindResumeInfoEvents();
    }

    createResumeInfoHTML(resumeData) {
        const uploadDate = new Date(resumeData.uploadedAt).toLocaleDateString('zh-CN');
        
        return `
            <div class="resume-card">
                <div class="resume-header">
                    <div class="resume-icon">📄</div>
                    <div class="resume-details">
                        <h4>${resumeData.fileName}</h4>
                    </div>
                </div>

                <div class="resume-actions">
                    <button class="btn-secondary" id="removeResumeBtn">移除简历</button>
                    <button class="btn-primary" id="useResumeBtn">使用此简历面试</button>
                </div>
            </div>
        `;
    }

    bindResumeInfoEvents() {
        // 移除简历
        const removeBtn = document.getElementById('removeResumeBtn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                this.removeResume();
            });
        }

        // 使用简历面试
        const useBtn = document.getElementById('useResumeBtn');
        if (useBtn) {
            useBtn.addEventListener('click', () => {
                this.router.navigateTo('interview');
            });
        }
    }

    handleFileSelect(file) {
        if (!this.validateFile(file)) {
            return;
        }

        this.uploadFile(file);
    }

    validateFile(file) {
        // 检查文件大小 (最大10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('文件大小不能超过10MB');
            return false;
        }

        // 检查文件类型
        const allowedTypes = ['application/pdf', 'application/msword', 
                             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const allowedExtensions = ['.pdf', '.doc', '.docx'];

        const fileName = file.name.toLowerCase();
        const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            alert('只支持PDF和Word文档格式 (.pdf, .doc, .docx)');
            return false;
        }

        return true;
    }

    async uploadFile(file) {
        try {
            this.showUploadProgress();
            this.updateUploadProgress(0, '准备上传...');

            const formData = new FormData();
            formData.append('file', file);

            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    this.updateUploadProgress(percentComplete, `上传中... ${Math.round(percentComplete)}%`);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    this.handleUploadSuccess(response, file.name);
                } else {
                    const errorResponse = JSON.parse(xhr.responseText);
                    this.handleUploadError(errorResponse.detail || '上传失败');
                }
            };

            xhr.onerror = () => {
                this.handleUploadError('网络错误，请检查网络连接');
            };

            xhr.open('POST', '/api/upload-resume');
            xhr.send(formData);

        } catch (error) {
            console.error('上传文件时发生错误:', error);
            this.handleUploadError('上传失败：' + error.message);
        }
    }

    showUploadProgress() {
        const progress = document.getElementById('resumeUploadProgress');
        if (progress) {
            progress.style.display = 'block';
        }
    }

    updateUploadProgress(percent, text) {
        const progressFill = document.getElementById('resumeProgressFill');
        const progressText = document.getElementById('resumeProgressText');
        
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = text;
    }

    hideUploadProgress() {
        const progress = document.getElementById('resumeUploadProgress');
        if (progress) {
            progress.style.display = 'none';
        }
    }

    handleUploadSuccess(response, fileName) {
        this.hideUploadProgress();
        
        // 保存简历信息到localStorage
        const resumeData = {
            fileName: fileName,
            sessionId: response.session_id,
            preview: response.resume_preview,
            textLength: response.text_length,
            uploadedAt: new Date().toISOString()
        };

        if (this.storage.saveCurrentResume(resumeData)) {
            alert('简历上传成功！');
            this.refreshResumeInfo();
            
            // 通知面试应用更新简历状态
            if (window.interviewApp) {
                window.interviewApp.resumeSessionId = response.session_id;
                window.interviewApp.isResumeUploaded = true;
                
                // 如果WebSocket已连接，立即通知后端
                if (window.interviewApp.isConnected) {
                    console.log('简历上传成功，立即通知后端');
                    window.interviewApp.notifyResumeUploaded();
                }
            }
        } else {
            alert('简历保存失败，请重试');
        }
    }

    handleUploadError(errorMessage) {
        this.hideUploadProgress();
        alert('上传失败：' + errorMessage);
    }

    removeResume() {
        if (confirm('确定要移除当前简历吗？')) {
            if (this.storage.removeCurrentResume()) {
                this.refreshResumeInfo();
                
                // 通知面试应用清除简历状态
                if (window.interviewApp) {
                    window.interviewApp.resumeSessionId = null;
                    window.interviewApp.isResumeUploaded = false;
                    console.log('简历已移除，清除面试应用中的简历状态');
                }
            } else {
                alert('移除失败，请重试');
            }
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

/**
 * 主应用类 - 简化版本
 */
class InterviewApp {
    constructor() {
        // DOM元素 - 聊天相关
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.inputHint = document.getElementById('inputHint');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.chatContainer = document.getElementById('chatContainer');
        
        // DOM元素 - 聊天操作
        this.chatActions = document.getElementById('chatActions');
        this.saveInterviewBtn = document.getElementById('saveInterviewBtn');
        this.newInterviewBtn = document.getElementById('newInterviewBtn');
        
        // 状态管理
        this.socket = null;
        this.isConnected = false;
        this.isStreaming = false;
        this.currentMessageElement = null;
        this.currentMessageText = '';
        this.messageHistory = [];
        
        // 简历状态
        this.resumeSessionId = null;
        this.isResumeUploaded = false;
        
        // 面试记录
        this.currentInterview = {
            id: null,
            startTime: null,
            messages: [],
            resumeInfo: null,
            duration: 0
        };
        
        // 管理器实例
        this.storageManager = new LocalStorageManager();
        this.pageRouter = new PageRouter();
        this.historyManager = new HistoryManager(this.storageManager, this.pageRouter);
        this.resumeManager = new ResumeManager(this.storageManager, this.pageRouter);
        
        // 初始化应用
        this.init();
    }
    
    init() {
        console.log('初始化LLM面试官应用...');
        
        // 检查localStorage支持
        if (!this.storageManager.isSupported()) {
            console.warn('localStorage不支持，历史记录功能将不可用');
        }
        
        // 绑定事件监听器
        this.bindEvents();
        
        // 连接WebSocket
        this.connectWebSocket();
        
        // 自动调整输入框高度
        this.setupAutoResizeTextarea();
        
        // 加载已保存的简历信息
        this.loadSavedResume();
        
        // 直接显示聊天界面
        this.showChatInterface();
        
        // 初始化面试记录
        this.initCurrentInterview();
        
        // 初始化语音通话管理器
        this.voiceCallManager = new VoiceCallManager(this);
    }
    
    bindEvents() {
        // 发送按钮点击事件
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // 输入框键盘事件
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 输入框输入事件
        this.messageInput.addEventListener('input', () => {
            this.updateSendButton();
        });
        
        // 聊天操作按钮事件
        if (this.saveInterviewBtn) {
            this.saveInterviewBtn.addEventListener('click', () => {
                this.saveCurrentInterview();
            });
        }
        
        if (this.newInterviewBtn) {
            this.newInterviewBtn.addEventListener('click', () => {
                this.startNewInterview();
            });
        }
        
        // 监听继续面试事件
        window.addEventListener('continueInterview', (e) => {
            this.continueInterviewFromHistory(e.detail.interview);
        });
    }
    
    startNewInterview() {
        // 重置当前面试
        this.initCurrentInterview();
        
        // 清空聊天记录
        this.clearChatMessages();
        
        // 重新开始面试
        if (this.isResumeUploaded) {
            this.notifyResumeUploaded();
        }
    }
    
    initCurrentInterview() {
        this.currentInterview = {
            id: Date.now().toString(),
            startTime: new Date().toISOString(),
            messages: [],
            resumeInfo: this.storageManager.getCurrentResume(),
            duration: 0
        };
    }
    
    saveCurrentInterview() {
        if (this.currentInterview.messages.length === 0) {
            alert('暂无面试内容可保存');
            return;
        }
        
        // 计算面试时长
        const startTime = new Date(this.currentInterview.startTime);
        const endTime = new Date();
        this.currentInterview.duration = Math.floor((endTime - startTime) / 1000);
        
        // 保存到localStorage
        if (this.storageManager.saveInterview(this.currentInterview)) {
            alert('面试记录已保存');
            
            // 显示聊天操作按钮
            if (this.chatActions) {
                this.chatActions.style.display = 'block';
            }
        } else {
            alert('保存失败，请重试');
        }
    }
    
    continueInterviewFromHistory(interview) {
        console.log('从历史记录继续面试:', interview);
        
        // 恢复简历信息
        if (interview.resumeInfo) {
            this.storageManager.saveCurrentResume(interview.resumeInfo);
            this.resumeSessionId = interview.resumeInfo.sessionId;
            this.isResumeUploaded = true;
        }
        
        // 初始化新的面试会话
        this.initCurrentInterview();
        
        // 显示聊天界面
        this.showChatInterface();
        
        // 显示导航栏
        this.pageRouter.showNavigation();
        
        // 如果有简历，发送简历信息通知
        if (this.isResumeUploaded) {
            this.notifyResumeUploaded();
        }
    }
    
    loadSavedResume() {
        const savedResume = this.storageManager.getCurrentResume();
        if (savedResume) {
            this.resumeSessionId = savedResume.sessionId;
            this.isResumeUploaded = true;
        }
    }
    
    showChatInterface() {
        // 显示聊天区域
        this.chatContainer.style.display = 'block';
        
        // 隐藏初始头部
        const initialHeader = document.getElementById('initialHeader');
        if (initialHeader) {
            initialHeader.style.display = 'none';
        }
        
        // 显示导航栏
        this.pageRouter.showNavigation();
        
        // 滚动到底部
        this.scrollToBottom();
        
        // 启用输入
        this.enableInput();
        
        console.log('聊天界面已显示');
    }
    
    clearChatMessages() {
        const messages = this.chatMessages.querySelectorAll('.message:not(.welcome-message)');
        messages.forEach(message => message.remove());
    }
    
    notifyResumeUploaded() {
        console.log('通知简历已上传，会话ID:', this.resumeSessionId);
        
        // 发送特殊消息通知后端简历已上传
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'resume_uploaded',
                session_id: this.resumeSessionId,
                message: '请基于我的简历开始面试'
            };
            
            this.socket.send(JSON.stringify(message));
        }
    }
    
    setupAutoResizeTextarea() {
        this.messageInput.addEventListener('input', () => {
            // 重置高度以获得正确的scrollHeight
            this.messageInput.style.height = 'auto';
            
            // 设置新高度
            const newHeight = Math.min(this.messageInput.scrollHeight, 120); // 最大120px
            this.messageInput.style.height = newHeight + 'px';
        });
    }
    
    connectWebSocket() {
        console.log('正在连接WebSocket...');
        
        // 显示加载状态
        this.updateConnectionStatus('connecting', '连接中...');
        this.showLoadingOverlay();
        
        // 确定WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket连接已建立');
                this.isConnected = true;
                this.updateConnectionStatus('connected', '已连接');
                this.hideLoadingOverlay();
                this.enableInput();
                
                // 如果有已上传的简历，自动通知后端
                if (this.isResumeUploaded && this.resumeSessionId) {
                    console.log('检测到已上传的简历，自动通知后端');
                    this.notifyResumeUploaded();
                }
            };
            
            this.socket.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };
            
            this.socket.onclose = (event) => {
                console.log('WebSocket连接已关闭:', event.code, event.reason);
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', '连接断开');
                this.disableInput();
                
                // 如果不是正常关闭，尝试重连
                if (event.code !== 1000) {
                    console.log('尝试重新连接...');
                    setTimeout(() => {
                        this.connectWebSocket();
                    }, 3000);
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket错误:', error);
                this.updateConnectionStatus('error', '连接错误');
                this.showError('WebSocket连接失败，请刷新页面重试');
            };
            
        } catch (error) {
            console.error('创建WebSocket连接失败:', error);
            this.showError('无法建立连接，请检查网络设置');
        }
    }
    
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('收到消息:', data);
            
            switch (data.type) {
                case 'message_start':
                    this.handleMessageStart(data);
                    break;
                    
                case 'content_delta':
                    this.handleContentDelta(data);
                    break;
                    
                case 'message_end':
                    this.handleMessageEnd(data);
                    break;
                    
                case 'error':
                    this.handleError(data);
                    break;
                    
                default:
                    console.warn('未知消息类型:', data.type);
            }
            
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    }
    
    handleMessageStart(data) {
        console.log('开始接收消息');
        
        this.isStreaming = true;
        this.hideTypingIndicator();
        
        // 创建新的消息元素
        this.currentMessageElement = this.createMessageElement('assistant', '');
        this.chatMessages.appendChild(this.currentMessageElement);
        this.currentMessageText = '';
        
        // 滚动到底部
        this.scrollToBottom();
    }
    
    handleContentDelta(data) {
        if (this.currentMessageElement && data.content) {
            this.currentMessageText += data.content;
            
            // 更新消息内容
            const bubbleElement = this.currentMessageElement.querySelector('.message-bubble');
            if (bubbleElement) {
                bubbleElement.textContent = this.currentMessageText;
            }
            
            // 滚动到底部
            this.scrollToBottom();
        }
    }
    
    handleMessageEnd(data) {
        console.log('消息接收完成');
        
        this.isStreaming = false;
        
        // 添加时间戳
        if (this.currentMessageElement) {
            this.addMessageTimestamp(this.currentMessageElement);
            
            // 保存到面试记录
            this.currentInterview.messages.push({
                role: 'assistant',
                content: this.currentMessageText,
                timestamp: new Date().toISOString()
            });
        }
        
        // 重新启用输入
        this.enableInput();
        
        // 显示聊天操作按钮
        if (this.chatActions && this.currentInterview.messages.length > 2) {
            this.chatActions.style.display = 'block';
        }
        
        // 重置当前消息状态
        this.currentMessageElement = null;
        this.currentMessageText = '';
        
        // 如果正在语音通话，播放AI回复
        if (this.voiceCallManager && this.voiceCallManager.isCallActive && data.content) {
            this.voiceCallManager.handleAIMessage(data.content);
        }
    }
    
    handleError(data) {
        console.error('服务器错误:', data.message);
        this.showError(data.message || '处理请求时发生错误');
        this.isStreaming = false;
        this.enableInput();
    }
    
    sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message || !this.isConnected || this.isStreaming) {
            return;
        }
        
        console.log('发送消息:', message);
        
        // 显示用户消息
        this.displayUserMessage(message);
        
        // 保存到面试记录
        this.currentInterview.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        // 清空输入框
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.updateSendButton();
        
        // 禁用输入
        this.disableInput();
        
        // 显示加载指示器
        this.showTypingIndicator();
        
        // 发送到服务器
        const payload = {
            type: 'user_message',
            message: message,
            session_id: this.resumeSessionId
        };
        
        this.socket.send(JSON.stringify(payload));
    }
    
    displayUserMessage(message) {
        const messageElement = this.createMessageElement('user', message);
        this.chatMessages.appendChild(messageElement);
        
        // 添加时间戳
        this.addMessageTimestamp(messageElement);
        
        // 滚动到底部
        this.scrollToBottom();
    }
    
    createMessageElement(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = role === 'user' ? '👤' : '🤖';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        bubbleDiv.textContent = content;
        
        contentDiv.appendChild(bubbleDiv);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        
        return messageDiv;
    }
    
    addMessageTimestamp(messageElement) {
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageElement.appendChild(timestamp);
    }
    
    showTypingIndicator() {
        // 移除现有的打字指示器
        this.hideTypingIndicator();
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-indicator';
        typingDiv.id = 'typingIndicator';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = '🤖';
        
        const dotsDiv = document.createElement('div');
        dotsDiv.className = 'typing-dots';
        dotsDiv.innerHTML = '<span></span><span></span><span></span>';
        
        typingDiv.appendChild(avatar);
        typingDiv.appendChild(dotsDiv);
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    updateConnectionStatus(status, text) {
        const statusElements = [
            document.getElementById('connectionStatus'),
            document.getElementById('initialConnectionStatus')
        ].filter(el => el);
        
        statusElements.forEach(element => {
            const dot = element.querySelector('.status-dot');
            const textElement = element.querySelector('.status-text');
            
            if (dot && textElement) {
                dot.className = `status-dot ${status}`;
                textElement.textContent = text;
            }
        });
    }
    
    enableInput() {
        if (this.messageInput && this.sendButton) {
            this.messageInput.disabled = false;
            this.sendButton.disabled = false;
            this.inputHint.textContent = '输入您的回答...';
            this.messageInput.focus();
        }
    }
    
    disableInput() {
        if (this.messageInput && this.sendButton) {
            this.messageInput.disabled = true;
            this.sendButton.disabled = true;
            this.inputHint.textContent = '正在处理...';
        }
    }
    
    updateSendButton() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendButton.disabled = !hasText || !this.isConnected || this.isStreaming;
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 10);
    }
    
    showError(message) {
        // 创建错误消息元素
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span class="error-text">${message}</span>
            </div>
        `;
        
        // 添加到聊天区域
        this.chatMessages.appendChild(errorDiv);
        this.scrollToBottom();
        
        // 3秒后自动移除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }
    
    hideLoadingOverlay() {
        this.loadingOverlay.style.display = 'none';
    }
    
    showLoadingOverlay() {
        this.loadingOverlay.style.display = 'flex';
    }
}

/**
 * 语音通话管理器
 * 实现语音识别、语音合成、通话界面管理等功能
 */
class VoiceCallManager {
    constructor(interviewApp) {
        this.interviewApp = interviewApp;
        this.isCallActive = false;
        this.isMuted = false;
        this.isListening = false;
        this.callStartTime = null;
        this.callTimer = null;
        
        // 语音识别和合成
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        
        // DOM元素
        this.voiceCallButton = null;
        this.voiceCallOverlay = null;
        this.callStatus = null;
        this.callTimerElement = null;
        this.transcriptContent = null;
        this.voiceVisualizer = null;
        this.muteButton = null;
        this.speakerButton = null;
        this.endCallButton = null;
        this.callMinimize = null;
        
        this.init();
    }

    init() {
        this.initDOMElements();
        this.bindEvents();
        this.initSpeechRecognition();
    }

    initDOMElements() {
        this.voiceCallButton = document.getElementById('voiceCallButton');
        this.voiceCallOverlay = document.getElementById('voiceCallOverlay');
        this.callStatus = document.getElementById('callStatus');
        this.callTimerElement = document.getElementById('callTimer');
        this.transcriptContent = document.getElementById('transcriptContent');
        this.voiceVisualizer = document.getElementById('voiceVisualizer');
        this.muteButton = document.getElementById('muteButton');
        this.speakerButton = document.getElementById('speakerButton');
        this.endCallButton = document.getElementById('endCallButton');
        this.callMinimize = document.getElementById('callMinimize');
    }

    bindEvents() {
        // 语音通话按钮
        if (this.voiceCallButton) {
            this.voiceCallButton.addEventListener('click', () => {
                this.startVoiceCall();
            });
        }

        // 通话控制按钮
        if (this.muteButton) {
            this.muteButton.addEventListener('click', () => {
                this.toggleMute();
            });
        }

        if (this.speakerButton) {
            this.speakerButton.addEventListener('click', () => {
                this.toggleSpeaker();
            });
        }

        if (this.endCallButton) {
            this.endCallButton.addEventListener('click', () => {
                this.endVoiceCall();
            });
        }

        if (this.callMinimize) {
            this.callMinimize.addEventListener('click', () => {
                this.minimizeCall();
            });
        }

        // 点击遮罩层关闭
        if (this.voiceCallOverlay) {
            this.voiceCallOverlay.addEventListener('click', (e) => {
                if (e.target === this.voiceCallOverlay) {
                    this.minimizeCall();
                }
            });
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (this.isCallActive) {
                if (e.key === 'Escape') {
                    this.endVoiceCall();
                } else if (e.key === 'm' || e.key === 'M') {
                    this.toggleMute();
                }
            }
        });
    }

    initSpeechRecognition() {
        // 检查浏览器支持
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('浏览器不支持语音识别功能');
            this.disableVoiceCall('浏览器不支持语音识别');
            return;
        }

        // 初始化语音识别
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'zh-CN';

        // 语音识别事件
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateCallStatus('listening', '正在聆听...');
            this.activateVoiceVisualizer();
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                this.addTranscript('user', finalTranscript);
                this.sendVoiceMessage(finalTranscript);
            }

            // 显示临时识别结果
            if (interimTranscript) {
                this.showInterimTranscript(interimTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('语音识别错误:', event.error);
            this.updateCallStatus('connected', '识别错误，请重试');
            this.deactivateVoiceVisualizer();
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.isCallActive && !this.isMuted) {
                // 自动重启语音识别
                setTimeout(() => {
                    if (this.isCallActive && !this.isMuted) {
                        this.startListening();
                    }
                }, 1000);
            }
            this.deactivateVoiceVisualizer();
        };
    }

    async startVoiceCall() {
        try {
            // 请求麦克风权限
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // 立即停止，只是为了获取权限

            this.isCallActive = true;
            this.callStartTime = Date.now();
            
            this.showCallInterface();
            this.updateCallStatus('connecting', '正在连接...');
            this.startCallTimer();
            
            // 模拟连接延迟
            setTimeout(() => {
                this.updateCallStatus('connected', '通话中');
                this.startListening();
            }, 1500);

        } catch (error) {
            console.error('无法访问麦克风:', error);
            this.showError('无法访问麦克风，请检查权限设置');
        }
    }

    endVoiceCall() {
        this.isCallActive = false;
        this.stopListening();
        this.stopCallTimer();
        this.hideCallInterface();
        
        // 停止语音合成
        if (this.synthesis) {
            this.synthesis.cancel();
        }
        
        this.updateCallStatus('', '通话已结束');
    }

    minimizeCall() {
        if (this.voiceCallOverlay) {
            this.voiceCallOverlay.style.display = 'none';
        }
        // 可以在这里添加最小化到角落的小窗口
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.isMuted) {
            this.stopListening();
            this.muteButton.classList.add('muted');
            this.updateCallStatus('connected', '已静音');
        } else {
            this.startListening();
            this.muteButton.classList.remove('muted');
            this.updateCallStatus('connected', '通话中');
        }
    }

    toggleSpeaker() {
        // 这里可以实现扬声器开关逻辑
        this.speakerButton.classList.toggle('active');
    }

    startListening() {
        if (this.recognition && !this.isListening && !this.isMuted) {
            try {
                this.recognition.start();
            } catch (error) {
                console.error('启动语音识别失败:', error);
            }
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    sendVoiceMessage(message) {
        // 通过现有的消息发送系统发送语音转录的消息
        if (this.interviewApp && message.trim()) {
            // 设置消息输入框的值
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.value = message;
                // 触发发送
                this.interviewApp.sendMessage();
            }
        }
    }

    speakMessage(text) {
        if (!this.synthesis || !text) return;

        // 停止当前播放
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onstart = () => {
            this.updateCallStatus('speaking', 'AI正在回答...');
            this.activateVoiceVisualizer();
        };

        utterance.onend = () => {
            this.updateCallStatus('connected', '通话中');
            this.deactivateVoiceVisualizer();
            // 重新开始监听
            if (this.isCallActive && !this.isMuted) {
                setTimeout(() => this.startListening(), 500);
            }
        };

        utterance.onerror = (event) => {
            console.error('语音合成错误:', event);
            this.deactivateVoiceVisualizer();
        };

        this.currentUtterance = utterance;
        this.synthesis.speak(utterance);
    }

    showCallInterface() {
        if (this.voiceCallOverlay) {
            this.voiceCallOverlay.style.display = 'flex';
        }
    }

    hideCallInterface() {
        if (this.voiceCallOverlay) {
            this.voiceCallOverlay.style.display = 'none';
        }
    }

    updateCallStatus(statusClass, statusText) {
        if (this.callStatus) {
            this.callStatus.className = `call-status ${statusClass}`;
            this.callStatus.textContent = statusText;
        }
    }

    startCallTimer() {
        this.callTimer = setInterval(() => {
            if (this.callStartTime && this.callTimerElement) {
                const elapsed = Date.now() - this.callStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                this.callTimerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    activateVoiceVisualizer() {
        if (this.voiceVisualizer) {
            const waveElement = this.voiceVisualizer.querySelector('.voice-wave');
            if (waveElement) {
                waveElement.classList.add('active');
                if (this.isListening) {
                    waveElement.classList.add('listening');
                }
            }
        }
    }

    deactivateVoiceVisualizer() {
        if (this.voiceVisualizer) {
            const waveElement = this.voiceVisualizer.querySelector('.voice-wave');
            if (waveElement) {
                waveElement.classList.remove('active', 'listening');
            }
        }
    }

    addTranscript(role, text) {
        if (!this.transcriptContent) return;

        // 移除提示文本
        const hint = this.transcriptContent.querySelector('.transcript-hint');
        if (hint) {
            hint.remove();
        }

        const transcriptElement = document.createElement('p');
        transcriptElement.className = `transcript-text ${role}`;
        transcriptElement.textContent = `${role === 'user' ? '您' : 'AI'}: ${text}`;
        
        this.transcriptContent.appendChild(transcriptElement);
        this.transcriptContent.scrollTop = this.transcriptContent.scrollHeight;
    }

    showInterimTranscript(text) {
        if (!this.transcriptContent) return;

        // 移除之前的临时转录
        const existingInterim = this.transcriptContent.querySelector('.transcript-interim');
        if (existingInterim) {
            existingInterim.remove();
        }

        if (text.trim()) {
            const interimElement = document.createElement('p');
            interimElement.className = 'transcript-text user transcript-interim';
            interimElement.style.opacity = '0.6';
            interimElement.style.fontStyle = 'italic';
            interimElement.textContent = `您: ${text}`;
            
            this.transcriptContent.appendChild(interimElement);
            this.transcriptContent.scrollTop = this.transcriptContent.scrollHeight;
        }
    }

    disableVoiceCall(reason) {
        if (this.voiceCallButton) {
            this.voiceCallButton.disabled = true;
            this.voiceCallButton.title = reason;
        }
    }

    showError(message) {
        // 使用现有的错误显示系统
        if (this.interviewApp && this.interviewApp.showError) {
            this.interviewApp.showError(message);
        } else {
            alert(message);
        }
    }

    // 处理来自AI的消息，进行语音播放
    handleAIMessage(message) {
        if (this.isCallActive && message) {
            this.addTranscript('assistant', message);
            this.speakMessage(message);
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，初始化应用...');
    window.interviewApp = new InterviewApp();
}); 