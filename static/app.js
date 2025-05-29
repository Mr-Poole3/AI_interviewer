/**
 * LLM面试官前端应用
 * 
 * 实现WebSocket连接、流式消息显示、用户交互等功能
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
        
        // DOM元素 - 简历上传相关
        this.resumeUploadSection = document.getElementById('resumeUploadSection');
        this.fileUploadArea = document.getElementById('fileUploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.uploadResult = document.getElementById('uploadResult');
        this.resultDetails = document.getElementById('resultDetails');
        this.skipUploadBtn = document.getElementById('skipUploadBtn');
        this.startInterviewBtn = document.getElementById('startInterviewBtn');
        this.removeResumeBtn = document.getElementById('removeResumeBtn');
        
        // 状态管理
        this.socket = null;
        this.isConnected = false;
        this.isStreaming = false;
        this.currentMessageElement = null;
        this.currentMessageText = '';
        this.messageHistory = [];
        
        // 简历上传状态
        this.resumeSessionId = null;
        this.isResumeUploaded = false;
        this.uploadedFileName = '';
        
        // 初始化应用
        this.init();
    }
    
    init() {
        console.log('初始化LLM面试官应用...');
        
        // 绑定事件监听器
        this.bindEvents();
        
        // 连接WebSocket
        this.connectWebSocket();
        
        // 自动调整输入框高度
        this.setupAutoResizeTextarea();
        
        // 初始化文件上传功能
        this.initFileUpload();
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
        
        // 简历上传相关按钮事件
        this.skipUploadBtn.addEventListener('click', () => {
            this.skipResumeUpload();
        });
        
        this.startInterviewBtn.addEventListener('click', () => {
            this.startInterview();
        });
        
        this.removeResumeBtn.addEventListener('click', () => {
            this.removeResume();
        });
    }
    
    initFileUpload() {
        // 文件选择事件
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });
        
        // 拖拽上传事件
        this.fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.fileUploadArea.classList.add('drag-over');
        });
        
        this.fileUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.fileUploadArea.classList.remove('drag-over');
        });
        
        this.fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.fileUploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });
        
        // 点击上传区域选择文件
        this.fileUploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });
    }
    
    handleFileSelect(file) {
        console.log('选择文件:', file.name, file.size, file.type);
        
        // 验证文件
        if (!this.validateFile(file)) {
            return;
        }
        
        // 开始上传
        this.uploadFile(file);
    }
    
    validateFile(file) {
        // 检查文件大小 (最大10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showUploadError('文件大小不能超过10MB');
            return false;
        }
        
        // 检查文件类型
        const allowedTypes = ['application/pdf', 'application/msword', 
                             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const allowedExtensions = ['.pdf', '.doc', '.docx'];
        
        const fileName = file.name.toLowerCase();
        const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
        
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            this.showUploadError('只支持PDF和Word文档格式 (.pdf, .doc, .docx)');
            return false;
        }
        
        return true;
    }
    
    async uploadFile(file) {
        try {
            // 显示上传进度
            this.showUploadProgress();
            this.updateUploadProgress(0, '准备上传...');
            
            // 创建FormData
            const formData = new FormData();
            formData.append('file', file);
            
            // 创建XMLHttpRequest以支持进度监控
            const xhr = new XMLHttpRequest();
            
            // 监听上传进度
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    this.updateUploadProgress(percentComplete, `上传中... ${Math.round(percentComplete)}%`);
                }
            };
            
            // 处理响应
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
                this.handleUploadError('网络错误，上传失败');
            };
            
            // 发送请求
            xhr.open('POST', '/api/upload-resume');
            xhr.send(formData);
            
        } catch (error) {
            console.error('上传文件失败:', error);
            this.handleUploadError('上传失败: ' + error.message);
        }
    }
    
    showUploadProgress() {
        this.fileUploadArea.querySelector('.upload-content').style.display = 'none';
        this.uploadProgress.style.display = 'flex';
        this.uploadResult.style.display = 'none';
    }
    
    updateUploadProgress(percent, text) {
        this.progressFill.style.width = percent + '%';
        this.progressText.textContent = text;
    }
    
    handleUploadSuccess(response, fileName) {
        console.log('文件上传成功:', response);
        
        // 保存会话信息
        this.resumeSessionId = response.session_id;
        this.isResumeUploaded = true;
        this.uploadedFileName = fileName;
        
        // 显示成功结果
        this.showUploadSuccess(response);
        
        // 显示开始面试按钮
        this.skipUploadBtn.style.display = 'none';
        this.startInterviewBtn.style.display = 'inline-block';
    }
    
    handleUploadError(errorMessage) {
        console.error('文件上传失败:', errorMessage);
        this.showUploadError(errorMessage);
        
        // 重置上传区域
        this.resetUploadArea();
    }
    
    showUploadSuccess(response) {
        this.uploadProgress.style.display = 'none';
        this.uploadResult.style.display = 'flex';
        
        this.resultDetails.innerHTML = `
            <strong>文件名:</strong> ${this.uploadedFileName}<br>
            <strong>文本长度:</strong> ${response.text_length} 字符<br>
            <strong>预览:</strong> ${response.resume_preview}
        `;
    }
    
    showUploadError(message) {
        // 显示错误消息
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // 插入到上传区域前
        this.fileUploadArea.parentNode.insertBefore(errorDiv, this.fileUploadArea);
        
        // 3秒后自动移除错误消息
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }
    
    resetUploadArea() {
        this.fileUploadArea.querySelector('.upload-content').style.display = 'flex';
        this.uploadProgress.style.display = 'none';
        this.uploadResult.style.display = 'none';
        this.fileInput.value = '';
    }
    
    skipResumeUpload() {
        // 直接进入聊天界面
        this.showChatInterface();
    }
    
    startInterview() {
        // 通知后端简历已上传
        if (this.isResumeUploaded && this.resumeSessionId) {
            this.notifyResumeUploaded();
        }
        
        // 显示聊天界面
        this.showChatInterface();
    }
    
    removeResume() {
        // 重置状态
        this.resumeSessionId = null;
        this.isResumeUploaded = false;
        this.uploadedFileName = '';
        
        // 重置UI
        this.resetUploadArea();
        this.skipUploadBtn.style.display = 'inline-block';
        this.startInterviewBtn.style.display = 'none';
    }
    
    showChatInterface() {
        // 隐藏上传区域
        this.resumeUploadSection.style.display = 'none';
        
        // 显示聊天界面
        this.chatContainer.style.display = 'flex';
        
        // 聚焦输入框
        this.messageInput.focus();
    }
    
    notifyResumeUploaded() {
        if (this.socket && this.isConnected && this.resumeSessionId) {
            const message = {
                type: 'resume_uploaded',
                session_id: this.resumeSessionId
            };
            
            console.log('通知后端简历已上传:', message);
            this.socket.send(JSON.stringify(message));
        }
    }
    
    setupAutoResizeTextarea() {
        this.messageInput.addEventListener('input', () => {
            // 重置高度
            this.messageInput.style.height = 'auto';
            // 设置新高度
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        });
    }
    
    connectWebSocket() {
        console.log('正在连接WebSocket...');
        this.updateConnectionStatus('connecting', '连接中...');
        
        // 构建WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = (event) => {
                console.log('WebSocket连接已建立');
                this.isConnected = true;
                this.updateConnectionStatus('connected', '已连接');
                this.enableInput();
                this.hideLoadingOverlay();
            };
            
            this.socket.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };
            
            this.socket.onclose = (event) => {
                console.log('WebSocket连接已关闭', event);
                this.isConnected = false;
                this.updateConnectionStatus('error', '连接断开');
                this.disableInput();
                
                // 尝试重连
                if (!event.wasClean) {
                    setTimeout(() => {
                        console.log('尝试重新连接...');
                        this.connectWebSocket();
                    }, 3000);
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket错误:', error);
                this.updateConnectionStatus('error', '连接错误');
                this.showError('连接服务器失败，请刷新页面重试');
            };
            
        } catch (error) {
            console.error('创建WebSocket连接失败:', error);
            this.updateConnectionStatus('error', '连接失败');
            this.showError('无法连接到服务器');
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
        console.log('开始接收新消息');
        this.isStreaming = true;
        this.currentMessageText = '';
        
        // 隐藏欢迎消息
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
        
        // 创建新的消息元素
        this.currentMessageElement = this.createMessageElement('assistant', '');
        this.chatMessages.appendChild(this.currentMessageElement);
        
        // 滚动到底部
        this.scrollToBottom();
        
        // 显示打字指示器
        this.showTypingIndicator();
    }
    
    handleContentDelta(data) {
        if (!this.currentMessageElement || !data.content) {
            return;
        }
        
        // 隐藏打字指示器
        this.hideTypingIndicator();
        
        // 添加新内容
        this.currentMessageText += data.content;
        
        // 更新消息内容
        const messageBubble = this.currentMessageElement.querySelector('.message-bubble');
        if (messageBubble) {
            messageBubble.textContent = this.currentMessageText;
        }
        
        // 滚动到底部
        this.scrollToBottom();
    }
    
    handleMessageEnd(data) {
        console.log('消息接收完成');
        this.isStreaming = false;
        
        // 隐藏打字指示器
        this.hideTypingIndicator();
        
        // 添加时间戳
        if (this.currentMessageElement) {
            this.addMessageTimestamp(this.currentMessageElement);
        }
        
        // 清理当前消息状态
        this.currentMessageElement = null;
        this.currentMessageText = '';
        
        // 重新启用输入
        this.enableInput();
        
        // 滚动到底部
        this.scrollToBottom();
    }
    
    handleError(data) {
        console.error('收到错误消息:', data.message);
        this.showError(data.message);
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
        
        // 发送到服务器
        const messageData = {
            message: message
        };
        
        this.socket.send(JSON.stringify(messageData));
        
        // 清空输入框
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        
        // 禁用输入
        this.disableInput();
        
        // 更新发送按钮状态
        this.updateSendButton();
    }
    
    displayUserMessage(message) {
        const messageElement = this.createMessageElement('user', message);
        this.chatMessages.appendChild(messageElement);
        this.addMessageTimestamp(messageElement);
        this.scrollToBottom();
    }
    
    createMessageElement(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = role === 'assistant' ? '🤖' : '👤';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-bubble">${content}</div>
            </div>
        `;
        
        return messageDiv;
    }
    
    addMessageTimestamp(messageElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const messageContent = messageElement.querySelector('.message-content');
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = timeString;
        messageContent.appendChild(timeDiv);
    }
    
    showTypingIndicator() {
        if (!this.currentMessageElement) return;
        
        const messageBubble = this.currentMessageElement.querySelector('.message-bubble');
        if (messageBubble) {
            messageBubble.innerHTML = `
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            `;
        }
    }
    
    hideTypingIndicator() {
        if (!this.currentMessageElement) return;
        
        const typingIndicator = this.currentMessageElement.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    updateConnectionStatus(status, text) {
        const statusDot = this.connectionStatus.querySelector('.status-dot');
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        statusDot.className = `status-dot ${status}`;
        statusText.textContent = text;
    }
    
    enableInput() {
        this.messageInput.disabled = false;
        this.sendButton.disabled = false;
        this.messageInput.placeholder = '请输入您的回答...';
        this.inputHint.innerHTML = '<span>按Enter发送，Shift+Enter换行</span>';
    }
    
    disableInput() {
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;
        this.messageInput.placeholder = '面试官回复中...';
        this.inputHint.innerHTML = '<span>面试官正在思考...</span>';
    }
    
    updateSendButton() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendButton.disabled = !hasText || !this.isConnected || this.isStreaming;
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 50);
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        this.chatMessages.appendChild(errorDiv);
        this.scrollToBottom();
        
        // 5秒后自动移除错误消息
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
    
    hideLoadingOverlay() {
        this.loadingOverlay.classList.add('hidden');
    }
    
    showLoadingOverlay() {
        this.loadingOverlay.classList.remove('hidden');
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，启动应用...');
    window.interviewApp = new InterviewApp();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.interviewApp && window.interviewApp.socket) {
        window.interviewApp.socket.close();
    }
}); 