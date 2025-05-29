/**
 * LLM面试官前端应用
 * 
 * 实现WebSocket连接、流式消息显示、用户交互等功能
 */

class InterviewApp {
    constructor() {
        // DOM元素
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.inputHint = document.getElementById('inputHint');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // 状态管理
        this.socket = null;
        this.isConnected = false;
        this.isStreaming = false;
        this.currentMessageElement = null;
        this.currentMessageText = '';
        this.messageHistory = [];
        
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
            messageBubble.innerHTML = this.formatMessageContent(this.currentMessageText);
            
            // 添加流式动画效果
            const lastChar = messageBubble.lastChild;
            if (lastChar && lastChar.nodeType === Node.TEXT_NODE) {
                const span = document.createElement('span');
                span.className = 'streaming-text';
                span.textContent = data.content;
                messageBubble.appendChild(span);
            }
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
        
        // 保存到历史记录
        this.messageHistory.push({
            role: 'assistant',
            content: this.currentMessageText,
            timestamp: new Date()
        });
        
        // 重新启用输入
        this.enableInput();
        
        // 清理当前消息状态
        this.currentMessageElement = null;
        this.currentMessageText = '';
    }
    
    handleError(data) {
        console.error('收到错误消息:', data.message);
        this.isStreaming = false;
        this.enableInput();
        this.showError(data.message || '发生未知错误');
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
        try {
            this.socket.send(JSON.stringify({
                message: message
            }));
            
            // 清空输入框
            this.messageInput.value = '';
            this.messageInput.style.height = 'auto';
            
            // 禁用输入直到收到回复
            this.disableInput();
            
            // 保存到历史记录
            this.messageHistory.push({
                role: 'user',
                content: message,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('发送消息失败:', error);
            this.showError('发送消息失败，请重试');
            this.enableInput();
        }
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
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = role === 'user' ? '👤' : '🤖';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = this.formatMessageContent(content);
        
        contentDiv.appendChild(bubble);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        
        return messageDiv;
    }
    
    formatMessageContent(content) {
        // 简单的文本格式化（支持换行）
        return content.replace(/\n/g, '<br>');
    }
    
    addMessageTimestamp(messageElement) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const contentDiv = messageElement.querySelector('.message-content');
        if (contentDiv) {
            contentDiv.appendChild(timeDiv);
        }
    }
    
    showTypingIndicator() {
        if (!this.currentMessageElement) return;
        
        const messageBubble = this.currentMessageElement.querySelector('.message-bubble');
        if (messageBubble && !messageBubble.querySelector('.typing-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            indicator.innerHTML = `
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            `;
            messageBubble.appendChild(indicator);
        }
    }
    
    hideTypingIndicator() {
        if (!this.currentMessageElement) return;
        
        const indicator = this.currentMessageElement.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    updateConnectionStatus(status, text) {
        const statusDot = this.connectionStatus.querySelector('.status-dot');
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        // 清除所有状态类
        statusDot.className = 'status-dot';
        
        // 添加新状态类
        if (status !== 'connecting') {
            statusDot.classList.add(status);
        }
        
        statusText.textContent = text;
    }
    
    enableInput() {
        this.messageInput.disabled = false;
        this.sendButton.disabled = false;
        this.messageInput.placeholder = '请输入您的回答...';
        this.inputHint.textContent = 'Enter 发送 • Shift+Enter 换行';
        this.messageInput.focus();
        this.updateSendButton();
    }
    
    disableInput() {
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;
        this.messageInput.placeholder = '面试官正在回复中...';
        this.inputHint.textContent = '请等待面试官回复...';
    }
    
    updateSendButton() {
        const hasMessage = this.messageInput.value.trim().length > 0;
        const canSend = hasMessage && this.isConnected && !this.isStreaming;
        this.sendButton.disabled = !canSend;
    }
    
    scrollToBottom() {
        // 使用 requestAnimationFrame 确保 DOM 更新完成后再滚动
        requestAnimationFrame(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        });
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

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成，初始化应用...');
    window.interviewApp = new InterviewApp();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.interviewApp && window.interviewApp.socket) {
        window.interviewApp.socket.close();
    }
}); 