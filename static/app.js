/**
 * Azure语音面试官前端应用
 * 
 * 基于Azure OpenAI实时语音模型的智能面试系统
 * 支持WebSocket流式通信、语音输出播放、简历上传等功能
 */

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

        
        // 面试记录相关
        this.currentInterviewMessages = [];
        this.interviewStartTime = null;
        this.isInterviewActive = false;
        this.currentInterviewId = null;
        
        this.initElements();
        this.bindEvents();
        this.initAudio();
        this.setInitialStatus();
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
    
    bindEvents() {
        // 语音通话按钮事件
        if (this.voiceCallButton) {
            this.voiceCallButton.addEventListener('click', () => {
                this.startInterview();
            });
        }
        
        // 欢迎界面开始面试按钮事件
        if (this.heroStartButton) {
            this.heroStartButton.addEventListener('click', () => {
                this.startInterview();
            });
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
        
        // 开始记录面试
        this.startInterviewRecording();
        
        // 切换到聊天界面
        const welcomeSection = document.querySelector('.interview-welcome');
        const chatSection = document.querySelector('.interview-chat');
        
        if (welcomeSection && chatSection) {
            console.log('切换到聊天界面');
            welcomeSection.style.display = 'none';
            chatSection.style.display = 'flex';
            chatSection.classList.add('active');
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
        console.log('更新状态:', text, className);
        
        // 更新导航栏状态
        const navStatus = document.getElementById('connectionStatus');
        if (navStatus) {
            const statusText = navStatus.querySelector('.status-text');
            const statusDot = navStatus.querySelector('.status-dot');
            if (statusText) {
                statusText.textContent = text;
            }
            navStatus.className = `connection-indicator ${className}`;
            if (statusDot) {
                statusDot.className = `status-dot ${className}`;
                // 根据状态更新点的样式
                if (className === 'connected') {
                    statusDot.classList.add('connected');
                } else if (className === 'error') {
                    statusDot.classList.add('error');
                } else {
                    statusDot.classList.remove('connected', 'error');
                }
            }
        }
        
        // 更新语音提示
        if (this.voiceHint) {
            this.voiceHint.textContent = text;
        }
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
    
    /**
     * 触发面试评分
     */
    async triggerInterviewEvaluation(interview) {
        try {
            console.log('开始面试评分...');
            
            // 获取简历上下文
            const resumeContext = await this.getResumeContext();
            
            // 构建评分请求
            const evaluationRequest = {
                interview_id: interview.id,
                messages: interview.messages,
                resume_context: resumeContext || '',
                duration: interview.duration,
                session_id: interview.sessionId || ''
            };
            
            // 显示评分进度
            this.showEvaluationProgress();
            
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
                console.log('面试评分完成:', result);
                
                // 显示评分结果
                this.showEvaluationResult(result.evaluation);
                
                // 更新本地存储的面试记录
                this.updateInterviewWithEvaluation(interview.id, result.evaluation);
                
            } else {
                console.error('面试评分失败:', response.status);
                this.showEvaluationError('评分服务暂时不可用，请稍后查看面试记录');
            }
            
        } catch (error) {
            console.error('面试评分错误:', error);
            this.showEvaluationError('评分过程中出现错误: ' + error.message);
        } finally {
            this.hideEvaluationProgress();
        }
    }
    
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
     * 显示评分结果
     */
    showEvaluationResult(evaluation) {
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
                                    <span class="score-number">${evaluation.total_score || 75}</span>
                                    <span class="score-label">总分</span>
                                </div>
                            </div>
                            <div class="score-summary">
                                <h3>评估总结</h3>
                                <p>${evaluation.summary || '面试表现良好，具备基本的专业素养和沟通能力。'}</p>
                            </div>
                        </div>
                        
                        ${evaluation.dimension_scores ? this.createDimensionScoresHTML(evaluation.dimension_scores) : ''}
                        
                        <div class="evaluation-details">
                            <div class="detail-section">
                                <h4><i class="fas fa-thumbs-up"></i> 优势表现</h4>
                                <ul>
                                    ${(evaluation.strengths || ['表现积极', '回答完整']).map(strength => `<li>${strength}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="detail-section">
                                <h4><i class="fas fa-lightbulb"></i> 改进建议</h4>
                                <ul>
                                    ${(evaluation.improvements || ['继续保持', '深入学习']).map(improvement => `<li>${improvement}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                        
                        <div class="evaluation-meta">
                            <small>
                                评估时间: ${new Date().toLocaleString('zh-CN')} | 
                                评估模型: ${evaluation.model_used || 'DeepSeek-V3'}
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.evaluation-result-modal').remove()">
                            关闭
                        </button>
                        <button class="btn btn-primary" onclick="window.app.router.navigateTo('history')">
                            查看历史记录
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(resultDiv);
    }
    
    /**
     * 创建维度评分HTML
     */
    createDimensionScoresHTML(dimensionScores) {
        const dimensions = {
            'technical_skills': '技术能力',
            'communication': '沟通表达',
            'problem_solving': '问题解决',
            'learning_adaptability': '学习适应',
            'professional_attitude': '职业素养'
        };
        
        return `
            <div class="dimension-scores">
                <h4>各维度评分</h4>
                <div class="score-bars">
                    ${Object.entries(dimensions).map(([key, name]) => {
                        const score = dimensionScores[key] || 7;
                        const percentage = (score / 10) * 100;
                        return `
                            <div class="score-bar">
                                <div class="score-label">${name}</div>
                                <div class="score-progress">
                                    <div class="score-fill" style="width: ${percentage}%"></div>
                                </div>
                                <div class="score-value">${score}/10</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
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
                interview.summary = evaluation.summary;
                
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

        // 获取模态窗口元素
        this.evaluationModal = null;
        this.modalCloseButton = null; // 明确命名为 modalCloseButton
        this.modalEvaluationContent = null;
        this.modalLoadingSpinner = null;
        this.modalActualContent = null;

        this.init();
    }

    init() {
        this.historyList = document.getElementById('historyList');
        this.emptyHistory = document.getElementById('emptyHistory');
        this.sortBy = document.getElementById('sortBy');
        
        this.evaluationModal = document.getElementById('evaluationModal');
        this.modalEvaluationContent = document.getElementById('modalEvaluationContent');
        this.modalLoadingSpinner = this.modalEvaluationContent?.querySelector('.loading-spinner');
        this.modalActualContent = this.modalEvaluationContent?.querySelector('.evaluation-actual-content');
        this.modalCloseButton = this.evaluationModal?.querySelector('.close-button');
        
        this.bindHistoryEvents();
        this.bindModalEvents();
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

    // 新增方法：绑定模态窗口的关闭事件
    bindModalEvents() {
        if (this.evaluationModal && this.modalCloseButton) {
            // 点击关闭按钮时关闭模态窗口
            this.modalCloseButton.addEventListener('click', () => {
                this.evaluationModal.style.display = 'none';
            });

            // 点击模态窗口外部区域时关闭模态窗口
            // 注意：这里事件监听器应该绑定到整个 window，但逻辑判断要精确到点击区域
            window.addEventListener('click', (event) => {
                // 确保点击事件的目标是模态窗口的背景本身，而不是模态内容
                if (event.target === this.evaluationModal) {
                    this.evaluationModal.style.display = 'none';
                }
            });

            // 监听 Escape 键关闭模态窗口
            window.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.evaluationModal.style.display === 'flex') {
                    this.evaluationModal.style.display = 'none';
                }
            });
        } else {
            console.warn("模态窗口或关闭按钮元素未找到，无法绑定关闭事件。请检查HTML结构和ID/类名。");
        }
    }
    
    refreshHistoryList() {
        const interviews = this.storageManager.getInterviews();
        
        if (interviews.length === 0) {
            this.showEmptyState();
        } else {
            this.showHistoryList(interviews);
        }
    }

    showEmptyState() {
        if (this.emptyHistory) {
            this.emptyHistory.style.display = 'block';
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
        
        return `
            <div class="history-item" data-id="${interview.id}">
                <div class="history-icon">
                    <i class="fas fa-microphone"></i>
                </div>
                <div class="history-content">
                    <div class="history-title">
                        ${interview.title || 'AI语音面试记录'}
                        <span class="history-badge ${hasEvaluation ? 'evaluated' : 'completed'}">
                            ${hasEvaluation ? '已评分' : '完成'}
                        </span>
                        ${score ? `<span class="history-score">${score}分</span>` : ''}
                    </div>
                    <div class="history-meta">
                        <span><i class="fas fa-clock"></i> ${date}</span>
                        <span><i class="fas fa-stopwatch"></i> ${duration}</span>
                        <span><i class="fas fa-comments"></i> ${messageCount}条对话</span>
                        ${hasEvaluation ? `<span><i class="fas fa-chart-bar"></i> 已评分</span>` : ''}
                    </div>
                    <div class="history-summary">
                        ${interview.summary || '本次面试涵盖了技术能力、项目经验等多个方面的深入交流...'}
                    </div>
                </div>
                <div class="history-actions">
                    ${hasEvaluation ? `
                        <button class="history-action-btn" onclick="historyManager.viewEvaluation('${interview.id}')" title="查看评分">
                            <i class="fas fa-chart-bar"></i>
                        </button>
                    ` : ''}
                    <button class="history-action-btn" onclick="historyManager.continueInterview('${interview.id}')" title="继续面试">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="history-action-btn evaluate-btn" data-id="${interview.id}" onclick="historyManager.startEvaluation('${interview.id}')" title="开始评估">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="history-action-btn" onclick="historyManager.deleteInterview('${interview.id}')" title="删除记录">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
                // <div class="evaluation-display" id="evaluation-${interview.id}" style="display:none; margin-top: 10px; padding: 10px; background-color: #f0f0f0; border-radius: 5px;">
                //     <div class="loading-spinner" style="display:none;">加载中...</div>
                //     <div class="evaluation-content"></div>
                // </div>
    bindHistoryItemEvents() {
        // 事件已在HTML中绑定
            this.historyList.querySelectorAll('.evaluate-btn').forEach(button => {
            button.onclick = () => this.startEvaluation(button.dataset.id);
        });
    }

    continueInterview(id) {
        const interviews = this.storageManager.getInterviews();
        const interview = interviews.find(item => item.id === id);
        
        if (interview) {
            // 触发继续面试事件
            window.dispatchEvent(new CustomEvent('continueInterview', { 
                detail: { interview } 
            }));
            this.router.navigateTo('interview');
        }
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


        // 检查是否已缓存评估结果
        if (interviewToEvaluate.evaluationMarkdown) {
            console.log(`从缓存加载评估结果，面试ID: ${interviewId}`);
            if (this.modalLoadingSpinner) {
                this.modalLoadingSpinner.style.display = 'none'; // 隐藏加载指示
            }
            if (this.modalActualContent) {
                this.modalActualContent.innerHTML = this.renderMarkdownToHtml(interviewToEvaluate.evaluationMarkdown);
            }
            return; // 结束函数，不再重新生成
        }

        // 如果没有缓存，则调用后端生成
        try {
            console.log(`调用后端生成评估结果，面试ID: ${interviewId}`);

            const resumeData = this.storageManager.getCurrentResume();
            const resumeText = resumeData ? resumeData.fullText : '';

            const requestData = {
                interviewMessages: interviewToEvaluate.messages,
                resumeText: resumeText,
                interviewId: interviewToEvaluate.id
            };

            const response = await fetch('/api/evaluate-interview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorDetail = await response.text();
                throw new Error(`后端评估API请求失败: ${response.status} ${response.statusText} - ${errorDetail}`);
            }

            const data = await response.json();
            const markdownResult = data.evaluationMarkdown;

            if (markdownResult) {
                // 缓存评估结果到 interview 对象
                interviewToEvaluate.evaluationMarkdown = markdownResult;
                this.storageManager.saveInterview(interviewToEvaluate); // 更新 localStorage 中的记录

                if (this.modalActualContent) {
                    this.modalActualContent.innerHTML = this.renderMarkdownToHtml(markdownResult);
                }
            } else {
                if (this.modalActualContent) {
                    this.modalActualContent.innerHTML = '<p>未收到评估结果。</p>';
                }
            }

        } catch (error) {
            console.error('面试评估失败:', error);
            if (this.modalActualContent) {
                this.modalActualContent.innerHTML = `<p>评估失败: ${error.message}</p>`;
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

    continueInterviewFromHistory(interview) {
        // 这里可以实现从历史记录继续面试的逻辑
        console.log('继续面试:', interview);
        // 暂时只是切换到面试页面
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
    showNotification('设置', '设置功能开发中，敬请期待！', 'info', 3000);
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