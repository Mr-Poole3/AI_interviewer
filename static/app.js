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
            // 增强数据结构，确保包含完整信息
            const enhancedResumeData = {
                fileName: resumeData.fileName,
                sessionId: resumeData.sessionId,
                preview: resumeData.preview,
                textLength: resumeData.textLength,
                uploadedAt: resumeData.uploadedAt || new Date().toISOString(),
                // 新增：保存完整简历文本内容
                fullText: resumeData.fullText || resumeData.preview,
                // 新增：数据版本号，用于兼容性检查
                version: '1.1'
            };
            
            localStorage.setItem(this.KEYS.CURRENT_RESUME, JSON.stringify(enhancedResumeData));
            console.log('简历信息已保存到本地存储，包含完整文本内容');
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
            
            // 数据版本兼容性检查
            if (!resumeData.version || resumeData.version < '1.1') {
                console.warn('检测到旧版本简历数据，可能缺少完整文本内容');
                // 如果是旧版本数据，标记需要重新上传
                resumeData.needsReupload = true;
            }
            
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
        
        // 保存简历信息到localStorage，包含完整文本内容
        const resumeData = {
            fileName: fileName,
            sessionId: response.session_id,
            preview: response.resume_preview,
            textLength: response.text_length,
            uploadedAt: new Date().toISOString(),
            // 新增：保存完整简历文本内容
            fullText: response.full_text || response.resume_preview,
            version: '1.1'
        };

        if (this.storage.saveCurrentResume(resumeData)) {
            alert('简历上传成功！');
            this.refreshResumeInfo();
            
            // 通知面试应用更新简历状态
            if (window.interviewApp) {
                window.interviewApp.resumeSessionId = response.session_id;
                window.interviewApp.isResumeUploaded = true;
                window.interviewApp.currentResumeData = resumeData; // 保存完整数据引用
                
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
        
        // 延迟初始化语音通话管理器，确保DOM完全加载
        setTimeout(() => {
            this.voiceCallManager = new VoiceCallManager(this);
        }, 100);
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
            // 检查数据完整性
            if (savedResume.needsReupload) {
                console.warn('检测到不完整的简历数据，建议重新上传');
                // 可以在UI上显示提示，建议用户重新上传
                this.showResumeReuploadHint();
                return;
            }
            
            this.resumeSessionId = savedResume.sessionId;
            this.isResumeUploaded = true;
            this.currentResumeData = savedResume; // 保存完整数据引用
            
            console.log('已恢复保存的简历信息:', {
                fileName: savedResume.fileName,
                textLength: savedResume.textLength,
                hasFullText: !!savedResume.fullText
            });
        }
    }
    
    // 新增：显示简历重新上传提示
    showResumeReuploadHint() {
        // 可以在界面上显示一个温和的提示
        console.log('建议重新上传简历以获得更好的面试体验');
        // 这里可以添加UI提示逻辑
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
            // 优化：直接发送完整简历文本内容，不依赖后端session存储
            const resumeContent = this.currentResumeData?.fullText || 
                                 this.storageManager.getCurrentResume()?.fullText;
            
            if (!resumeContent) {
                console.warn('未找到简历文本内容，无法进行个性化面试');
                this.showError('简历数据不完整，请重新上传简历');
                return;
            }
            
            const message = {
                type: 'resume_uploaded',
                session_id: this.resumeSessionId,
                resume_content: resumeContent, // 直接发送完整文本内容
                message: '请基于我的简历开始面试'
            };
            
            console.log('发送简历内容到后端，文本长度:', resumeContent.length);
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
            // 检查是否是二进制数据（音频流）
            if (event.data instanceof ArrayBuffer) {
                this.handleAudioData(event.data);
                return;
            }
            
            const data = JSON.parse(event.data);
            
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
                    
                case 'audio_chunk':
                    this.handleAudioChunk(data);
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

    handleAudioData(arrayBuffer) {
        /**
         * 处理二进制音频数据
         * @param {ArrayBuffer} arrayBuffer - 音频数据
         */
        if (this.voiceCallManager && this.voiceCallManager.isCallActive) {
            this.voiceCallManager.handleAudioStream(arrayBuffer);
        }
    }

    handleAudioChunk(data) {
        /**
         * 处理JSON格式的音频数据
         * @param {Object} data - 包含音频数据的消息对象
         */
        if (this.voiceCallManager && this.voiceCallManager.isCallActive && data.audio_data) {
            // 将base64音频数据转换为ArrayBuffer
            try {
                const binaryString = atob(data.audio_data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                this.voiceCallManager.handleAudioStream(bytes.buffer);
            } catch (error) {
                console.error('音频数据解码失败:', error);
            }
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
        
        // 如果正在语音通话，传递消息给语音管理器
        // 注意：音频数据现在通过单独的音频流传递，这里只传递文本
        if (this.voiceCallManager && this.voiceCallManager.isCallActive && data.content) {
            // 不再传递音频数据，因为音频通过专门的音频流处理
            this.voiceCallManager.handleAIMessage(data.content, null);
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
        
        // 语音识别（保留）
        this.recognition = null;
        
        // 音频播放相关（替换TTS）
        this.audioContext = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.currentAudioSource = null;
        this.audioAnalyser = null;
        this.audioDataArray = null;
        
        // DOM元素 - 更新为新的全屏界面元素
        this.voiceCallButton = null;
        this.voiceCallFullscreen = null;
        this.voiceCallBackdrop = null;
        this.voiceAnimationContainer = null;
        this.voiceLottiePlayer = null;
        this.voiceStatusDisplay = null;
        this.voiceTimer = null;
        this.voiceMuteBtn = null;
        this.voiceEndBtn = null;
        
        // 保留原有的弹窗元素作为备用
        this.voiceCallOverlay = null;
        this.callStatus = null;
        this.callTimerElement = null;
        this.voiceVisualizer = null;
        this.voiceStatusText = null;
        this.endCallButton = null;
        this.callMinimize = null;
        
        this.init();
    }

    init() {
        this.initDOMElements();
        this.bindEvents();
        this.initSpeechRecognition();
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            // 初始化Web Audio API
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 创建音频分析器用于音量检测
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 256;
            this.audioDataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
            
            console.log('音频上下文初始化成功');
        } catch (error) {
            console.error('音频上下文初始化失败:', error);
        }
    }

    initDOMElements() {
        // 获取新的全屏语音界面元素
        this.voiceCallButton = document.getElementById('voiceCallButton');
        this.voiceCallFullscreen = document.getElementById('voiceCallFullscreen');
        this.voiceCallBackdrop = document.getElementById('voiceCallBackdrop');
        this.voiceAnimationContainer = document.getElementById('voiceAnimationContainer');
        this.voiceLottiePlayer = document.getElementById('voiceLottiePlayer');
        this.voiceStatusDisplay = document.getElementById('voiceStatusDisplay');
        this.voiceTimer = document.getElementById('voiceTimer');
        this.voiceMuteBtn = document.getElementById('voiceMuteBtn');
        this.voiceEndBtn = document.getElementById('voiceEndBtn');

        // 保留原有元素的引用
        this.voiceCallOverlay = document.getElementById('voiceCallOverlay');
        this.callStatus = document.getElementById('callStatus');
        this.voiceVisualizer = document.getElementById('voiceVisualizer');
        this.voiceStatusText = document.getElementById('voiceStatusText');
        this.callTimerElement = document.getElementById('callTimer');
        this.endCallButton = document.getElementById('endCallButton');
        this.callMinimize = document.getElementById('callMinimize');

        if (!this.voiceCallButton || !this.voiceCallFullscreen) {
            console.error('语音通话DOM元素未找到');
            return false;
        }

        return true;
    }

    bindEvents() {
        // 语音通话按钮事件
        if (this.voiceCallButton) {
            this.voiceCallButton.addEventListener('click', () => {
                this.startVoiceCall();
            });
        }

        // 新的全屏界面按钮事件
        if (this.voiceMuteBtn) {
            this.voiceMuteBtn.addEventListener('click', () => {
                this.toggleMute();
            });
        }

        if (this.voiceEndBtn) {
            this.voiceEndBtn.addEventListener('click', () => {
                this.endVoiceCall();
            });
        }

        // 保留原有按钮事件
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

        // 点击背景关闭通话
        if (this.voiceCallBackdrop) {
            this.voiceCallBackdrop.addEventListener('click', () => {
                this.endVoiceCall();
            });
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (this.isCallActive) {
                if (e.key === 'Escape') {
                    this.endVoiceCall();
                } else if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    this.toggleMute();
                }
            }
        });
    }

    initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('浏览器不支持语音识别');
            this.disableVoiceCall('浏览器不支持语音识别');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // 配置语音识别 - 改为连续识别以便快速检测用户说话
        this.recognition.continuous = true;  // 改为连续识别
        this.recognition.interimResults = true;  // 启用临时结果以快速检测
        this.recognition.lang = 'zh-CN';
        this.recognition.maxAlternatives = 1;

        // 添加中断控制变量
        this.speechStartTime = null;
        this.speechInterruptDelay = 800; // 延迟800ms再中断TTS
        this.speechTextThreshold = 3; // 文本长度阈值

        // 语音识别结果事件
        this.recognition.onresult = (event) => {
            // 检查是否有临时结果（表示用户开始说话）
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                
                // 只有当有实际文本内容且长度超过阈值时才考虑中断
                if (result[0].transcript.trim().length > this.speechTextThreshold) {
                    if (this.isPlaying && !this.speechStartTime) {
                        console.log('检测到有效语音输入，准备中断TTS');
                        this.speechStartTime = Date.now();
                        
                        // 延迟中断，避免误触发
                        setTimeout(() => {
                            if (this.speechStartTime && this.isPlaying) {
                                console.log('延迟后确认中断TTS');
                                this.stopAllAudio();
                            }
                        }, this.speechInterruptDelay);
                    }
                }
                
                // 处理最终结果
                if (result.isFinal && result[0].transcript.trim()) {
                    const transcript = result[0].transcript.trim();
                    console.log('语音识别最终结果:', transcript);
                    
                    // 重置中断计时
                    this.speechStartTime = null;
                    
                    this.sendVoiceMessage(transcript);
                    this.updateVoiceStatus('processing', '正在生成回复...');
                    
                    // 停止当前识别会话，等待AI回复
                    this.stopListening();
                    break;
                }
            }
        };

        // 语音识别开始事件
        this.recognition.onstart = () => {
            console.log('语音识别已开始');
            this.isListening = true;
            this.speechStartTime = null; // 重置中断计时
            this.updateVoiceStatus('listening', '正在聆听您的声音...');
        };

        // 语音识别结束事件
        this.recognition.onend = () => {
            console.log('语音识别已结束');
            this.isListening = false;
            this.speechStartTime = null; // 重置中断计时
            
            // 如果通话仍然活跃且没有在播放音频且没有静音，重新开始监听
            if (this.isCallActive && !this.isPlaying && !this.isMuted) {
                setTimeout(() => {
                    if (this.isCallActive && !this.isPlaying && !this.isMuted) {
                        this.startListening();
                    }
                }, 1000);
            }
        };

        // 语音识别错误事件
        this.recognition.onerror = (event) => {
            console.error('语音识别错误:', event.error);
            this.isListening = false;
            this.speechStartTime = null; // 重置中断计时
            
            switch (event.error) {
                case 'no-speech':
                    // 对于连续识别，no-speech是正常的，不需要提示
                    if (this.isCallActive && !this.isPlaying && !this.isMuted) {
                        setTimeout(() => this.startListening(), 500);
                    }
                    break;
                case 'audio-capture':
                    this.updateVoiceStatus('idle', '无法访问麦克风');
                    break;
                case 'not-allowed':
                    this.updateVoiceStatus('idle', '麦克风权限被拒绝');
                    break;
                case 'aborted':
                    // 主动停止的，不需要重启
                    break;
                default:
                    console.warn('语音识别错误:', event.error);
                    // 其他错误，尝试重新开始
                    if (this.isCallActive && !this.isMuted) {
                        setTimeout(() => {
                            if (this.isCallActive && !this.isPlaying && !this.isMuted) {
                                this.startListening();
                            }
                        }, 1000);
                    }
                    break;
            }
        };

        // 移除过于敏感的语音活动检测
        // 注释掉原来的onspeechstart和onspeechend事件
        /*
        this.recognition.onspeechstart = () => {
            console.log('检测到语音开始');
            if (this.isPlaying) {
                console.log('用户开始说话，中断TTS播放');
                this.stopAllAudio();
            }
        };

        this.recognition.onspeechend = () => {
            console.log('语音结束');
        };
        */
    }

    async startVoiceCall() {
        try {
            // 检查必要条件
            if (!this.recognition) {
                this.showError('语音识别未初始化');
                return;
            }

            // 请求麦克风权限，保留基本的音频优化
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,      // 保留基本回音消除
                    noiseSuppression: true,      // 保留噪音抑制
                    autoGainControl: true,       // 保留自动增益控制
                    sampleRate: 16000,
                    channelCount: 1
                }
            });
            
            // 连接音频流到分析器
            if (this.audioContext && this.audioAnalyser) {
                this.microphoneSource = this.audioContext.createMediaStreamSource(stream);
                this.microphoneSource.connect(this.audioAnalyser);
                
                // 简化的音频监控
                this.setupSimpleAudioMonitoring();
            }
            
            // 设置通话状态
            this.isCallActive = true;
            this.isListening = false;
            this.isPlaying = false;
            this.isMuted = false;
            this.callStartTime = Date.now();

            // 显示全屏通话界面
            this.showCallInterface();
            this.updateVoiceStatus('idle', '通话已连接，开始说话...');
            this.startCallTimer();
            this.startAudioVisualization();

            // 开始语音识别
            setTimeout(() => {
                if (this.isCallActive) {
                    this.startListening();
                }
            }, 500);

            console.log('语音通话已开始');

        } catch (error) {
            console.error('启动语音通话失败:', error);
            this.showError('无法启动语音通话：' + error.message);
            this.isCallActive = false;
        }
    }

    endVoiceCall() {
        console.log('结束语音通话');
        
        // 立即停止所有音频播放和TTS
        this.stopAllAudio();
        
        // 停止语音识别
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }

        // 重置状态
        this.isCallActive = false;
        this.isListening = false;
        this.isPlaying = false;
        this.isMuted = false;

        // 停止计时器和可视化
        this.stopCallTimer();
        this.stopAudioVisualization();

        // 隐藏通话界面
        this.hideCallInterface();

        // 重置语音状态
        this.updateVoiceStatus('idle', '通话已结束');

        console.log('语音通话已结束');
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.voiceMuteBtn) {
            if (this.isMuted) {
                this.voiceMuteBtn.classList.add('muted');
                this.stopListening();
                this.updateVoiceStatus('muted', '麦克风已静音');
            } else {
                this.voiceMuteBtn.classList.remove('muted');
                if (this.isCallActive && !this.isPlaying) {
                    this.startListening();
                }
                this.updateVoiceStatus('listening', '正在聆听您的声音...');
            }
        }
        
        console.log('麦克风静音状态:', this.isMuted);
    }

    showCallInterface() {
        if (this.voiceCallFullscreen) {
            this.voiceCallFullscreen.style.display = 'flex';
            
            // 添加页面模糊效果
            document.body.style.overflow = 'hidden';
            
            // 启动Lottie动画
            if (this.voiceLottiePlayer) {
                this.voiceLottiePlayer.play();
            }
        }
    }

    hideCallInterface() {
        if (this.voiceCallFullscreen) {
            this.voiceCallFullscreen.style.display = 'none';
            
            // 移除页面模糊效果
            document.body.style.overflow = '';
            
            // 停止Lottie动画
            if (this.voiceLottiePlayer) {
                this.voiceLottiePlayer.pause();
            }
        }
    }

    startCallTimer() {
        this.callTimer = setInterval(() => {
            if (this.callStartTime) {
                const elapsed = Date.now() - this.callStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                // 更新新界面的计时器
                if (this.voiceTimer) {
                    this.voiceTimer.textContent = timeString;
                }
                
                // 更新原界面的计时器（备用）
                if (this.callTimerElement) {
                    this.callTimerElement.textContent = timeString;
                }
            }
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    startAudioVisualization() {
        if (!this.audioAnalyser || !this.audioDataArray) return;
        
        const visualize = () => {
            if (!this.isCallActive) return;
            
            this.audioAnalyser.getByteFrequencyData(this.audioDataArray);
            
            // 计算平均音量
            let sum = 0;
            for (let i = 0; i < this.audioDataArray.length; i++) {
                sum += this.audioDataArray[i];
            }
            const average = sum / this.audioDataArray.length;
            
            // 根据音量调整动画大小
            this.updateAnimationScale(average);
            
            requestAnimationFrame(visualize);
        };
        
        visualize();
    }

    stopAudioVisualization() {
        // 重置动画大小
        if (this.voiceAnimationContainer) {
            this.voiceAnimationContainer.className = 'voice-animation-container';
        }
    }

    updateAnimationScale(volume) {
        if (!this.voiceAnimationContainer) return;
        
        // 移除所有缩放类
        this.voiceAnimationContainer.classList.remove('scale-small', 'scale-medium', 'scale-large', 'scale-xlarge', 'pulsing');
        
        // 根据音量设置缩放
        if (volume < 20) {
            this.voiceAnimationContainer.classList.add('scale-small');
        } else if (volume < 40) {
            this.voiceAnimationContainer.classList.add('scale-medium');
        } else if (volume < 60) {
            this.voiceAnimationContainer.classList.add('scale-large');
        } else {
            this.voiceAnimationContainer.classList.add('scale-xlarge', 'pulsing');
        }
    }

    updateVoiceStatus(status, text) {
        // 更新新界面的状态文本
        if (this.voiceStatusDisplay) {
            // 直接更新元素文本，因为voiceStatusDisplay就是p元素
            this.voiceStatusDisplay.textContent = text;
            
            // 移除所有状态类
            this.voiceStatusDisplay.classList.remove('listening', 'processing', 'speaking');
            
            // 添加对应状态类
            if (status !== 'idle' && status !== 'muted') {
                this.voiceStatusDisplay.classList.add(status);
            }
        }

        // 更新原界面的状态（备用）
        if (this.voiceStatusText) {
            this.voiceStatusText.textContent = text;
        }

        // 更新语音可视化状态
        if (this.voiceVisualizer) {
            const waveElement = this.voiceVisualizer.querySelector('.voice-wave');
            if (waveElement) {
                waveElement.classList.remove('active', 'listening', 'speaking');
                
                switch (status) {
                    case 'listening':
                        waveElement.classList.add('active', 'listening');
                        break;
                    case 'speaking':
                        waveElement.classList.add('active', 'speaking');
                        break;
                    case 'processing':
                        waveElement.classList.add('active');
                        break;
                }
            }
        }

        // 更新通话状态
        this.updateCallStatus(status, text);
    }

    startListening() {
        if (!this.recognition || this.isListening || !this.isCallActive || this.isMuted) {
            return;
        }

        // 如果TTS正在播放，先停止TTS
        if (this.isPlaying) {
            console.log('检测到用户想说话，停止当前TTS播放');
            this.stopAllAudio();
        }

        try {
            this.isListening = true;
            this.updateVoiceStatus('listening', '正在聆听您的声音...');
            this.recognition.start();
            console.log('开始语音识别');
        } catch (error) {
            console.error('启动语音识别失败:', error);
            this.isListening = false;
            this.updateVoiceStatus('idle', '语音识别启动失败');
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
                this.isListening = false;
                console.log('停止语音识别');
            } catch (error) {
                console.error('停止语音识别失败:', error);
            }
        }
    }

    minimizeCall() {
        // 最小化通话窗口（可以实现为缩小到角落的小窗口）
        this.hideCallInterface();
        // 这里可以添加最小化后的小窗口显示逻辑
    }

    sendVoiceMessage(message) {
        /**
         * 发送语音消息到后端
         * @param {string} message - 语音转换的文本消息
         */
        if (this.interviewApp && this.interviewApp.socket && this.interviewApp.socket.readyState === WebSocket.OPEN) {
            const messageData = {
                type: 'voice_message',
                content: message,
                timestamp: new Date().toISOString()
            };
            
            this.interviewApp.socket.send(JSON.stringify(messageData));
            console.log('发送语音消息:', message);
        } else {
            console.error('WebSocket连接不可用');
            this.showError('连接已断开，请刷新页面重试');
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

    // 处理来自AI的消息，接收音频流而不是使用浏览器TTS
    handleAIMessage(message, audioData = null) {
        if (this.isCallActive && message) {
            console.log('收到AI回复:', message);
            
            // 如果有音频数据，播放音频；否则使用浏览器TTS
            if (audioData) {
                this.playAudioChunk(audioData);
            } else {
                // 使用浏览器TTS播放AI回复
                this.playTextToSpeech(message);
            }
        }
    }

    async playTextToSpeech(text) {
        /**
         * 使用浏览器的语音合成API播放文本
         * @param {string} text - 要播放的文本
         */
        if (!this.isCallActive || !text) {
            return;
        }

        try {
            // 停止当前播放的语音
            this.stopAllAudio();

            // 在TTS播放期间暂停语音识别
            if (this.isListening) {
                this.stopListening();
            }

            // 标记TTS播放状态
            this.ttsPlaybackActive = true;

            // 创建语音合成utterance
            const utterance = new SpeechSynthesisUtterance(text);
            
            // 设置语音参数
            utterance.lang = 'zh-CN';
            utterance.rate = 1.5; // 提高语速到2倍
            utterance.pitch = 1.0;
            utterance.volume = 0.8; // 正常音量

            // 尝试选择中文语音
            const voices = speechSynthesis.getVoices();
            const chineseVoice = voices.find(voice => 
                voice.lang.includes('zh') || voice.name.includes('Chinese')
            );
            if (chineseVoice) {
                utterance.voice = chineseVoice;
            }

            // 设置事件监听器
            utterance.onstart = () => {
                this.isPlaying = true;
                this.ttsPlaybackActive = true;
                this.updateVoiceStatus('speaking', 'AI正在回答...');
                console.log('开始播放TTS（语音识别已暂停）');
            };

            utterance.onend = () => {
                this.isPlaying = false;
                this.ttsPlaybackActive = false;
                this.updateVoiceStatus('idle', '请继续说话...');
                console.log('TTS播放完成，恢复语音识别');
                
                // TTS播放完成后恢复语音识别
                if (this.isCallActive && !this.isMuted) {
                    setTimeout(() => {
                        if (this.isCallActive && !this.isMuted && !this.isListening) {
                            this.startListening();
                        }
                    }, 500);
                }
            };

            utterance.onerror = (event) => {
                console.error('TTS播放失败:', event.error);
                this.isPlaying = false;
                this.ttsPlaybackActive = false;
                
                // 只有非中断错误才提示
                if (event.error !== 'interrupted' && event.error !== 'canceled') {
                    this.updateVoiceStatus('idle', 'TTS播放失败，请重试');
                } else {
                    this.updateVoiceStatus('idle', '请继续说话...');
                    console.log('TTS被用户中断');
                }
                
                // 错误后恢复语音识别
                if (this.isCallActive && !this.isMuted) {
                    setTimeout(() => {
                        if (this.isCallActive && !this.isMuted && !this.isListening) {
                            this.startListening();
                        }
                    }, 300);
                }
            };

            // 保存当前的utterance引用
            this.currentUtterance = utterance;

            // 开始播放
            speechSynthesis.speak(utterance);

        } catch (error) {
            console.error('TTS初始化失败:', error);
            this.isPlaying = false;
            this.ttsPlaybackActive = false;
            this.updateVoiceStatus('idle', 'TTS不可用，请重试');
            
            // 错误后恢复语音识别
            if (this.isCallActive && !this.isMuted) {
                setTimeout(() => this.startListening(), 500);
            }
        }
    }

    async playAudioChunk(audioData) {
        /**
         * 播放音频数据块
         * @param {ArrayBuffer|Float32Array} audioData - 音频数据
         */
        if (!this.audioContext || !this.isCallActive) {
            return;
        }

        try {
            // 停止当前播放的音频
            this.stopAllAudio();

            // 在音频播放期间暂停语音识别
            if (this.isListening) {
                this.stopListening();
            }

            // 标记TTS播放状态
            this.ttsPlaybackActive = true;

            let audioBuffer;
            
            // 处理不同格式的音频数据
            if (audioData instanceof ArrayBuffer) {
                audioBuffer = await this.audioContext.decodeAudioData(audioData.slice());
            } else if (audioData instanceof Float32Array) {
                const sampleRate = 16000;
                audioBuffer = this.audioContext.createBuffer(1, audioData.length, sampleRate);
                audioBuffer.getChannelData(0).set(audioData);
            } else {
                console.error('不支持的音频数据格式:', typeof audioData);
                return;
            }

            // 创建音频源
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);

            // 播放状态管理
            source.onended = () => {
                this.isPlaying = false;
                this.ttsPlaybackActive = false;
                this.updateVoiceStatus('idle', '请继续说话...');
                console.log('音频播放完成，恢复语音识别');
                
                // 播放完成后恢复语音识别
                if (this.isCallActive && !this.isMuted) {
                    setTimeout(() => {
                        if (this.isCallActive && !this.isMuted && !this.isListening) {
                            this.startListening();
                        }
                    }, 500);
                }
            };

            // 开始播放
            this.isPlaying = true;
            this.ttsPlaybackActive = true;
            this.currentAudioSource = source;
            this.updateVoiceStatus('speaking', 'AI正在回答...');
            console.log('开始播放音频（语音识别已暂停）');
            
            source.start();

        } catch (error) {
            console.error('音频播放失败:', error);
            this.isPlaying = false;
            this.ttsPlaybackActive = false;
            this.updateVoiceStatus('idle', '音频播放失败，请重试');
            
            // 错误后恢复语音识别
            if (this.isCallActive && !this.isMuted) {
                setTimeout(() => this.startListening(), 500);
            }
        }
    }

    stopAllAudio() {
        /**
         * 停止所有音频播放
         */
        // 停止Web Audio API音频源
        if (this.currentAudioSource) {
            try {
                this.currentAudioSource.stop();
                this.currentAudioSource = null;
            } catch (error) {
                console.error('停止Web Audio源失败:', error);
            }
        }

        // 停止浏览器TTS
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }

        // 清除引用
        this.currentUtterance = null;

        // 重置TTS播放状态
        this.ttsPlaybackActive = false;

        // 清除用户打断检测计时器
        if (this.userInterruptTimer) {
            clearTimeout(this.userInterruptTimer);
            this.userInterruptTimer = null;
        }

        this.isPlaying = false;
        console.log('所有音频已停止');
    }

    setupSimpleAudioMonitoring() {
        // 简化的音频监控，只用于用户打断检测
        this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        this.audioProcessor.onaudioprocess = (event) => {
            if (!this.isCallActive || !this.ttsPlaybackActive) return;
            
            const inputBuffer = event.inputBuffer.getChannelData(0);
            
            // 计算输入音量
            let sum = 0;
            for (let i = 0; i < inputBuffer.length; i++) {
                sum += inputBuffer[i] * inputBuffer[i];
            }
            const rms = Math.sqrt(sum / inputBuffer.length);
            
            // 检测用户打断
            this.detectUserInterrupt(rms);
        };
        
        this.microphoneSource.connect(this.audioProcessor);
        this.audioProcessor.connect(this.audioContext.destination);
    }

    detectUserInterrupt(micVolume) {
        // 只在TTS播放期间检测用户打断
        if (!this.ttsPlaybackActive || !this.isPlaying) {
            return;
        }

        // 设置合理的音量阈值
        const volumeThreshold = 0.06;
        
        if (micVolume > volumeThreshold) {
            // 延迟检测，避免误触发
            if (!this.userInterruptTimer) {
                this.userInterruptTimer = setTimeout(() => {
                    if (this.isPlaying && this.ttsPlaybackActive) {
                        console.log('检测到用户打断，停止TTS');
                        this.stopAllAudio();
                        
                        // 立即开始语音识别
                        setTimeout(() => {
                            if (this.isCallActive && !this.isMuted && !this.isListening) {
                                this.startListening();
                            }
                        }, 200);
                    }
                    this.userInterruptTimer = null;
                }, 400);
            }
        } else {
            // 清除检测计时器
            if (this.userInterruptTimer) {
                clearTimeout(this.userInterruptTimer);
                this.userInterruptTimer = null;
            }
        }
    }

    updateCallStatus(statusClass, statusText) {
        if (this.callStatus) {
            this.callStatus.className = `call-status ${statusClass}`;
            this.callStatus.textContent = statusText;
        }
    }

    handleAudioStream(audioChunk) {
        /**
         * 处理来自后端的音频流数据
         * @param {ArrayBuffer|Float32Array} audioChunk - 音频数据块
         */
        if (this.isCallActive) {
            this.playAudioChunk(audioChunk);
        }
    }

    stopCurrentAudio() {
        /**
         * 停止当前播放的音频（保持向后兼容）
         */
        this.stopAllAudio();
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，初始化应用...');
    window.interviewApp = new InterviewApp();
}); 