/**
 * 语音通话管理器 - Azure OpenAI Realtime API WebRTC版本
 * 
 * 基于Azure OpenAI Realtime API WebRTC官方实现
 * 移除了复杂的FastRTC音频处理逻辑，采用标准WebRTC通信
 * 
 * 主要功能：
 * - 直接连接Azure OpenAI Realtime API WebRTC
 * - 使用ephemeral API key进行安全认证
 * - 通过RTCPeerConnection进行音频通信
 * - 通过DataChannel进行事件通信
 * - 支持多区域WebRTC端点回退
 * - 实时事件处理和调试日志
 */
class VoiceCallManager {
    constructor(azureVoiceChat, storageManager) {
        this.azureVoiceChat = azureVoiceChat;
        this.storageManager = storageManager;
        // Azure配置
        this.SESSIONS_URL = "https://gpt-realtime-4o-mini.openai.azure.com/openai/realtimeapi/sessions?api-version=2025-04-01-preview";
        this.API_KEY = "1CPbxJPoYjJzTmG2296QXpJ8LT8jHJ0NmgKDv56sQ5tjonM6RXgOJQQJ99BEACHYHv6XJ3w3AAABACOG45bg";
        this.DEPLOYMENT = "gpt-4o-mini-realtime-preview";
        this.VOICE = "verse";
        
        // WebRTC端点配置（支持多区域回退）
        this.WEBRTC_CONFIGS = [
            // East US 2 (主要区域)
            { url: "https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc", useQuery: true },
            // Sweden Central (备用区域)
            { url: "https://swedencentral.realtimeapi-preview.ai.azure.com/v1/realtimertc", useQuery: true }
        ];
        
        // WebRTC连接相关
        this.peerConnection = null;
        this.dataChannel = null;
        this.audioElement = null;
        this.clientMedia = null;
        this.ephemeralKey = null;
        this.sessionId = null;
        
        this.currentInterviewMessages = []; // 用于存储当前通话的对话历史
        // 状态管理
        this.isConnected = false;
        this.isCallActive = false;
        this.callStartTime = null;
        this.callTimer = null;
        
        // 语音活动检测（VAD）配置
        this.vadConfig = {
            threshold: 0.5,              // 语音检测阈值 (0.0-1.0，越高越不敏感)
            prefix_padding_ms: 300,      // 语音开始前的缓冲时间
            silence_duration_ms: 1500,   // 静音持续时间（毫秒，用户停顿多久后AI开始回复）
            create_response: true,       // 检测到静音后自动创建响应
            interrupt_response: true     // 允许用户打断AI回复
        };
        
        // 调试日志
        this.debugMode = false;
        this.logContainer = null;
        
        this.initElements();
        this.bindEvents();
        this.setupDebugMode();
    }
    
    /**
     * 初始化DOM元素
     */
    initElements() {
        // 语音通话界面元素
        this.voiceCallOverlay = document.getElementById('voiceCallFullscreen');
        this.voiceStatus = document.getElementById('voiceStatusDisplay');
        this.voiceTimer = document.getElementById('voiceTimer');
        this.endCallButton = document.getElementById('voiceEndBtn');
        this.muteButton = document.getElementById('voiceMuteBtn');
        this.settingsButton = document.getElementById('voiceSettingsBtn');
        this.voiceVisualization = document.getElementById('voiceAnimationContainer');
        
        // VAD设置面板元素
        this.vadSettingsPanel = document.getElementById('vadSettingsPanel');
        this.closeVadSettings = document.getElementById('closeVadSettings');
        this.silenceDurationSlider = document.getElementById('silenceDurationSlider');
        this.silenceDurationValue = document.getElementById('silenceDurationValue');
        this.thresholdSlider = document.getElementById('thresholdSlider');
        this.thresholdValue = document.getElementById('thresholdValue');
        this.prefixPaddingSlider = document.getElementById('prefixPaddingSlider');
        this.prefixPaddingValue = document.getElementById('prefixPaddingValue');
        this.resetVadSettings = document.getElementById('resetVadSettings');
        this.applyVadSettings = document.getElementById('applyVadSettings');
        
        // 创建音频播放元素
        this.audioElement = document.createElement('audio');
        this.audioElement.autoplay = true;
        this.audioElement.style.display = 'none';
        document.body.appendChild(this.audioElement);
        
        // 创建调试日志容器
        this.logContainer = document.createElement('div');
        this.logContainer.id = 'debugLogContainer';
        this.logContainer.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 400px;
            height: 300px;
            background: rgba(0,0,0,0.9);
            color: #00ff00;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            border-radius: 5px;
            overflow-y: auto;
            z-index: 10000;
            display: none;
        `;
        document.body.appendChild(this.logContainer);
    }
    
    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 结束通话按钮
        if (this.endCallButton) {
            this.endCallButton.addEventListener('click', () => this.endVoiceCall());
        }
        
        // 静音按钮
        if (this.muteButton) {
            this.muteButton.addEventListener('click', () => this.toggleMute());
        }
        
        // 设置按钮
        if (this.settingsButton) {
            this.settingsButton.addEventListener('click', () => this.toggleVadSettings());
        }
        
        // VAD设置面板事件
        this.bindVadSettingsEvents();
        
        // 快捷键绑定
        document.addEventListener('keydown', (e) => {
            // 调试模式快捷键 (Ctrl+Shift+L)
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                this.toggleDebugMode();
            }
            
            // VAD配置快捷键（仅在语音通话期间有效）
            if (this.isCallActive) {
                // Ctrl+Shift+1: 减少静音时长 (更敏感)
                if (e.ctrlKey && e.shiftKey && e.key === '1') {
                    e.preventDefault();
                    const currentDuration = this.vadConfig.silence_duration_ms;
                    const newDuration = Math.max(500, currentDuration - 250);
                    this.updateVADConfig({ silence_duration_ms: newDuration });
                }
                
                // Ctrl+Shift+2: 增加静音时长 (更不敏感)
                if (e.ctrlKey && e.shiftKey && e.key === '2') {
                    e.preventDefault();
                    const currentDuration = this.vadConfig.silence_duration_ms;
                    const newDuration = Math.min(3000, currentDuration + 250);
                    this.updateVADConfig({ silence_duration_ms: newDuration });
                }
                
                // Ctrl+Shift+3: 重置为默认配置
                if (e.ctrlKey && e.shiftKey && e.key === '3') {
                    e.preventDefault();
                    this.updateVADConfig({
                        threshold: 0.5,
                        silence_duration_ms: 1500,
                        prefix_padding_ms: 300
                    });
                }
            }
        });
    }
    
    /**
     * 设置调试模式
     */
    setupDebugMode() {
        this.logMessage('Azure OpenAI Realtime API WebRTC 语音通话管理器已初始化');
        this.logMessage('快捷键说明:');
        this.logMessage('  Ctrl+Shift+L: 切换调试日志显示');
        this.logMessage('  Ctrl+Shift+1: 减少静音时长 (通话中)');
        this.logMessage('  Ctrl+Shift+2: 增加静音时长 (通话中)');
        this.logMessage('  Ctrl+Shift+3: 重置VAD配置 (通话中)');
        this.logMessage(`当前VAD配置: 静音时长=${this.vadConfig.silence_duration_ms}ms, 阈值=${this.vadConfig.threshold}`);
    }
    
    /**
     * 切换调试模式
     */
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        this.logContainer.style.display = this.debugMode ? 'block' : 'none';
        this.logMessage(`调试模式: ${this.debugMode ? '开启' : '关闭'}`);
    }
    
    /**
     * 更新VAD配置
     * @param {Object} newConfig - 新的VAD配置
     * @param {number} newConfig.threshold - 语音检测阈值 (0.0-1.0)
     * @param {number} newConfig.silence_duration_ms - 静音持续时间（毫秒）
     * @param {number} newConfig.prefix_padding_ms - 语音开始前的缓冲时间
     */
    updateVADConfig(newConfig) {
        const oldConfig = { ...this.vadConfig };
        
        // 更新配置
        if (newConfig.threshold !== undefined) {
            this.vadConfig.threshold = Math.max(0.0, Math.min(1.0, newConfig.threshold));
        }
        if (newConfig.silence_duration_ms !== undefined) {
            this.vadConfig.silence_duration_ms = Math.max(200, Math.min(5000, newConfig.silence_duration_ms));
        }
        if (newConfig.prefix_padding_ms !== undefined) {
            this.vadConfig.prefix_padding_ms = Math.max(0, Math.min(1000, newConfig.prefix_padding_ms));
        }
        
        this.logMessage(`VAD配置已更新:`);
        this.logMessage(`  阈值: ${oldConfig.threshold} → ${this.vadConfig.threshold}`);
        this.logMessage(`  静音时长: ${oldConfig.silence_duration_ms}ms → ${this.vadConfig.silence_duration_ms}ms`);
        this.logMessage(`  前缀缓冲: ${oldConfig.prefix_padding_ms}ms → ${this.vadConfig.prefix_padding_ms}ms`);
        
        // 如果当前有活跃连接，立即应用新配置
        if (this.isConnected && this.dataChannel && this.dataChannel.readyState === 'open') {
            this.updateSessionInstructions();
        }
    }
    
    /**
     * 获取当前VAD配置
     */
    getVADConfig() {
        return { ...this.vadConfig };
    }
    
    /**
     * 绑定VAD设置面板事件
     */
    bindVadSettingsEvents() {
        // 关闭设置面板
        if (this.closeVadSettings) {
            this.closeVadSettings.addEventListener('click', () => this.hideVadSettings());
        }
        
        // 滑块事件
        if (this.silenceDurationSlider) {
            this.silenceDurationSlider.addEventListener('input', (e) => {
                this.silenceDurationValue.textContent = `${e.target.value}ms`;
            });
        }
        
        if (this.thresholdSlider) {
            this.thresholdSlider.addEventListener('input', (e) => {
                this.thresholdValue.textContent = e.target.value;
            });
        }
        
        if (this.prefixPaddingSlider) {
            this.prefixPaddingSlider.addEventListener('input', (e) => {
                this.prefixPaddingValue.textContent = `${e.target.value}ms`;
            });
        }
        
        // 重置按钮
        if (this.resetVadSettings) {
            this.resetVadSettings.addEventListener('click', () => this.resetVadSettingsToDefault());
        }
        
        // 应用按钮
        if (this.applyVadSettings) {
            this.applyVadSettings.addEventListener('click', () => this.applyVadSettingsFromPanel());
        }
        
        // 点击面板外部关闭
        document.addEventListener('click', (e) => {
            if (this.vadSettingsPanel && 
                this.vadSettingsPanel.style.display === 'block' &&
                !this.vadSettingsPanel.contains(e.target) &&
                !this.settingsButton.contains(e.target)) {
                this.hideVadSettings();
            }
        });
    }
    
    /**
     * 切换VAD设置面板显示
     */
    toggleVadSettings() {
        if (this.vadSettingsPanel.style.display === 'block') {
            this.hideVadSettings();
        } else {
            this.showVadSettings();
        }
    }
    
    /**
     * 显示VAD设置面板
     */
    showVadSettings() {
        // 更新滑块值为当前配置
        this.updateVadSettingsPanel();
        this.vadSettingsPanel.style.display = 'block';
        this.logMessage('显示VAD设置面板');
    }
    
    /**
     * 隐藏VAD设置面板
     */
    hideVadSettings() {
        this.vadSettingsPanel.style.display = 'none';
        this.logMessage('隐藏VAD设置面板');
    }
    
    /**
     * 更新VAD设置面板的值
     */
    updateVadSettingsPanel() {
        if (this.silenceDurationSlider) {
            this.silenceDurationSlider.value = this.vadConfig.silence_duration_ms;
            this.silenceDurationValue.textContent = `${this.vadConfig.silence_duration_ms}ms`;
        }
        
        if (this.thresholdSlider) {
            this.thresholdSlider.value = this.vadConfig.threshold;
            this.thresholdValue.textContent = this.vadConfig.threshold;
        }
        
        if (this.prefixPaddingSlider) {
            this.prefixPaddingSlider.value = this.vadConfig.prefix_padding_ms;
            this.prefixPaddingValue.textContent = `${this.vadConfig.prefix_padding_ms}ms`;
        }
    }
    
    /**
     * 重置VAD设置为默认值
     */
    resetVadSettingsToDefault() {
        const defaultConfig = {
            threshold: 0.5,
            silence_duration_ms: 1500,
            prefix_padding_ms: 300
        };
        
        // 更新滑块显示
        if (this.silenceDurationSlider) {
            this.silenceDurationSlider.value = defaultConfig.silence_duration_ms;
            this.silenceDurationValue.textContent = `${defaultConfig.silence_duration_ms}ms`;
        }
        
        if (this.thresholdSlider) {
            this.thresholdSlider.value = defaultConfig.threshold;
            this.thresholdValue.textContent = defaultConfig.threshold;
        }
        
        if (this.prefixPaddingSlider) {
            this.prefixPaddingSlider.value = defaultConfig.prefix_padding_ms;
            this.prefixPaddingValue.textContent = `${defaultConfig.prefix_padding_ms}ms`;
        }
        
        this.logMessage('VAD设置已重置为默认值');
    }
    
    /**
     * 从面板应用VAD设置
     */
    applyVadSettingsFromPanel() {
        const newConfig = {
            threshold: parseFloat(this.thresholdSlider.value),
            silence_duration_ms: parseInt(this.silenceDurationSlider.value),
            prefix_padding_ms: parseInt(this.prefixPaddingSlider.value)
        };
        
        this.updateVADConfig(newConfig);
        this.hideVadSettings();
        this.logMessage('VAD设置已从面板应用');
    }
    
    /**
     * 记录调试日志
     */
    logMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        console.log(logEntry);
        
        if (this.logContainer) {
            const p = document.createElement('p');
            p.textContent = logEntry;
            p.style.margin = '2px 0';
            this.logContainer.appendChild(p);
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
    }
    
    /**
     * 检查浏览器兼容性
     */
    checkBrowserCompatibility() {
        const checks = {
            webrtc: !!window.RTCPeerConnection,
            getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            audioContext: !!(window.AudioContext || window.webkitAudioContext)
        };
        
        const incompatible = Object.entries(checks)
            .filter(([key, supported]) => !supported)
            .map(([key]) => key);
        
        if (incompatible.length > 0) {
            throw new Error(`浏览器不支持以下功能: ${incompatible.join(', ')}`);
        }
        
        this.logMessage('浏览器兼容性检查通过');
        return true;
    }
    
    /**
     * 获取临时密钥
     */
    async getEphemeralKey() {
        this.logMessage('正在获取临时密钥...');
        
        try {
            const response = await fetch(this.SESSIONS_URL, {
                method: "POST",
                headers: {
                    "api-key": this.API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: this.DEPLOYMENT,
                    voice: this.VOICE
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logMessage(`API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
                throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            this.sessionId = data.id;
            this.ephemeralKey = data.client_secret?.value;
            
            this.logMessage(`临时密钥获取成功: ***`);
            this.logMessage(`WebRTC会话ID: ${this.sessionId}`);
            
            return this.ephemeralKey;
            
        } catch (error) {
            this.logMessage(`获取临时密钥失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 初始化WebRTC连接
     */
    async initWebRTCConnection() {
        this.logMessage('初始化WebRTC连接...');
        
        try {
            // 创建RTCPeerConnection
            this.peerConnection = new RTCPeerConnection();
            
            // 设置音频播放
            this.peerConnection.ontrack = (event) => {
                this.logMessage('收到远程音频流');
                this.audioElement.srcObject = event.streams[0];
            };
            
            // 获取用户媒体 - 根据官方文档配置音频参数
            this.clientMedia = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 24000,  // Azure OpenAI Realtime API 推荐采样率
                    channelCount: 1     // 单声道
                }
            });
            
            const audioTrack = this.clientMedia.getAudioTracks()[0];
            // 立即启用音频轨道开始录制
            audioTrack.enabled = true;
            this.peerConnection.addTrack(audioTrack);
            this.logMessage('用户音频轨道已添加并启用');
            
            // 创建数据通道
            this.dataChannel = this.peerConnection.createDataChannel('realtime-channel');
            this.setupDataChannelEvents();
            
            this.logMessage('WebRTC连接初始化完成');
            
        } catch (error) {
            this.logMessage(`WebRTC连接初始化失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 设置数据通道事件
     */
    setupDataChannelEvents() {
        this.dataChannel.addEventListener('open', async () => {
            this.logMessage('数据通道已打开');
            this.isConnected = true;
            await this.updateSessionInstructions();
        });

        this.dataChannel.addEventListener('message', (event) => {
            const realtimeEvent = JSON.parse(event.data);
            this.handleRealtimeEvent(realtimeEvent);
        });

        this.dataChannel.addEventListener('close', () => {
            this.logMessage('数据通道已关闭');
            this.isConnected = false;
        });

        this.dataChannel.addEventListener('error', (error) => {
            this.logMessage(`数据通道错误: ${error}`);
            if (error.error) {
                this.logMessage(`详细错误信息: ${error.error.message || error.error}`);
            }
        });
    }
    
    /**
     * 处理实时事件
     */
    handleRealtimeEvent(event) {
        this.logMessage(`收到服务器事件: ${JSON.stringify(event, null, 2)}`);
        if (!this.currentTurnUserText) this.currentTurnUserText = "";
        if (!this.currentTurnAIText) this.currentTurnAIText = "";        
        switch (event.type) {
            case "session.created":
                this.logMessage("会话已创建");
                break;
                
            case "session.updated":
                this.logMessage("会话已更新");
                if (event.session.instructions) {
                    this.logMessage(`指令: ${event.session.instructions}`);
                }
                break;
                
            case "session.error":
                this.logMessage(`会话错误: ${event.error.message}`);
                this.showError(`会话错误: ${event.error.message}`);
                break;
                
            case "session.end":
                this.logMessage("会话已结束");
                this.saveCurrentInterview();
                this.endVoiceCall();
                break;
                
            case "conversation.item.created":
                this.logMessage("对话项已创建");
                this.currentTurnUserText = "";
                this.currentTurnAIText = "";
                break;
                
            case "conversation.item.input_audio_transcription.completed":
                this.logMessage(`用户输入transcript: "${event.transcript}"`);
                this.currentTurnUserText = event.transcript; 
                if (this.currentTurnUserText) {
                    this.logMessage(`用户输入提交: "${this.currentTurnUserText}"`);
                    this.currentInterviewMessages.push({ role: "user", content: this.currentTurnUserText });
                }
                break;

            case "input_audio_buffer.speech_started":
                this.logMessage("检测到用户开始说话");
                this.updateVoiceStatus('正在聆听...', 'listening');
                break;
                
            case "input_audio_buffer.speech_stopped":
                this.logMessage(`用户停止说话 (静音时长阈值: ${this.vadConfig.silence_duration_ms}ms)`);
                this.updateVoiceStatus('正在处理...', 'processing');
                break;
                
            case "input_audio_buffer.committed":
                this.logMessage("音频输入已提交");
                break;
                
            case "response.audio.delta":
                // 音频数据流，不记录详细日志避免刷屏
                this.updateVoiceStatus('AI正在回复...', 'speaking');
                break;

            case "response.audio_transcript.done":
                this.currentTurnAIText = event.transcript;
                break;

            case "response.done":
                this.logMessage("响应完成");
                if (this.currentTurnAIText && this.currentTurnAIText.trim() !== "") {
                    this.logMessage(`AI回复完成: "${this.currentTurnAIText}"`);
                    this.currentInterviewMessages.push({ role: "assistant", content: this.currentTurnAIText });
                    // 每次AI回复后保存当前面试，确保数据不丢失
                    // this.saveCurrentInterview(); // 可以考虑在通话结束时统一保存
                    this.currentTurnAIText = "";
                }
                this.updateVoiceStatus('通话进行中...', 'connected');
                break;
                
            default:
                this.logMessage(`未处理的事件类型: ${event.type}`);
        }
    }
    
    /**
     * 更新会话指令
     */
    async updateSessionInstructions() {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            return;
        }
        
        // 获取简历信息
        const resumeContext = await this.getResumeContext();
        
        // 构建系统指令
        const instructions = await this.buildInstructions(resumeContext);

        const event = {
            type: "session.update",
            session: {
                instructions: instructions,
                // 配置语音活动检测（VAD）参数
                input_audio_transcription: {
                    model: "whisper-1"
                },
                turn_detection: {
                    type: "server_vad",
                    threshold: this.vadConfig.threshold,
                    prefix_padding_ms: this.vadConfig.prefix_padding_ms,
                    silence_duration_ms: this.vadConfig.silence_duration_ms,
                    create_response: this.vadConfig.create_response,
                    interrupt_response: this.vadConfig.interrupt_response
                }
            }
        };
        
        this.dataChannel.send(JSON.stringify(event));
        this.logMessage(`发送会话更新: ${JSON.stringify(event, null, 2)}`);
        
        if (resumeContext) {
            this.logMessage(`已包含简历信息，长度: ${resumeContext.length} 字符`);
        } else {
            this.logMessage('未找到简历信息，使用默认面试指令');
        }
    }
    
    /**
     * 构建系统指令
     */
    async buildInstructions(resumeContext) {
        try {
            // 从后端获取prompt配置
            const response = await fetch('/api/prompts/voice-call', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    resume_context: resumeContext
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.logMessage(`从服务器获取prompt成功`);
                return data.instructions;
            } else {
                this.logMessage(`获取prompt失败: ${response.status}`);
                // 回退到默认prompt
                return await this.getDefaultInstructions(resumeContext);
            }
        } catch (error) {
            this.logMessage(`获取prompt错误: ${error.message}`);
            // 回退到默认prompt
            return await this.getDefaultInstructions(resumeContext);
        }
    }
    
    /**
     * 获取默认指令（回退方案）
     * 优先从API获取prompts.py中的配置，最后才使用硬编码
     */
    async getDefaultInstructions(resumeContext) {
        try {
            // 尝试从API获取默认prompt
            const response = await fetch('/api/prompts/voice-call-default');
            if (response.ok) {
                const data = await response.json();
                this.logMessage(`✅ 从API获取默认prompt成功: ${data.source}`);
                
                let instructions = data.instructions;
                if (resumeContext) {
                    instructions += `\n\n候选人简历信息：\n${resumeContext}\n\n请根据简历内容进行针对性的面试提问。`;
                }
                return instructions;
            } else {
                this.logMessage(`❌ API获取默认prompt失败: ${response.status}`);
            }
        } catch (error) {
            this.logMessage(`❌ API请求错误: ${error.message}`);
        }
        
        // 最后的硬编码回退方案
        this.logMessage('⚠️ 使用硬编码回退prompt，建议检查prompts.py配置和API连接');
        
        // 从prompts.py的VOICE_CALL_INTERVIEWER获取的内容（硬编码备份）
        let instructions = "你是一位专业的AI面试官，请用自然、友好的语调进行面试对话。根据候选人的简历内容，提出相关的技术和行为问题。保持对话流畅，适时给出反馈和鼓励。";
        
        if (resumeContext) {
            instructions += `\n\n候选人简历信息：\n${resumeContext}\n\n请根据简历内容进行针对性的面试提问。`;
        }
        
        return instructions;
    }
    
    /**
     * 获取简历上下文信息
     */
    async getResumeContext() {
        try {
            // 从localStorage获取当前简历
            const resumeData = localStorage.getItem('azure_current_resume');
            this.logMessage(`localStorage简历数据: ${resumeData ? '存在' : '不存在'}`);
            
            if (!resumeData) {
                this.logMessage('未找到localStorage中的简历数据');
                return null;
            }
            
            const resume = JSON.parse(resumeData);
            if (!resume || !resume.sessionId) {
                this.logMessage('简历数据格式无效或缺少sessionId');
                return null;
            }
            
            // 从azureVoiceChat获取session_id对应的简历内容
            const sessionId = this.azureVoiceChat.currentSessionId;
            this.logMessage(`当前会话ID: ${sessionId}, 简历会话ID: ${resume.sessionId}`);
            
            if (!sessionId) {
                this.logMessage('当前会话ID为空，使用简历会话ID');
                // 如果当前会话ID为空，使用简历的会话ID
                const resumeSessionId = resume.sessionId;
                
                // 通过API获取完整简历内容
                try {
                    const response = await fetch(`/api/resume/${resumeSessionId}`);
                    if (response.ok) {
                        const data = await response.json();
                        this.logMessage(`成功获取简历内容，长度: ${data.content.length}`);
                        return data.content;
                    } else {
                        this.logMessage(`获取简历API失败: ${response.status}`);
                        // 回退到使用预览内容
                        return resume.preview || null;
                    }
                } catch (apiError) {
                    this.logMessage(`简历API请求错误: ${apiError.message}`);
                    // 回退到使用预览内容
                    return resume.preview || null;
                }
            } else if (sessionId !== resume.sessionId) {
                this.logMessage('会话ID不匹配，可能是不同的简历');
                return null;
            } else {
                // 会话ID匹配，获取完整简历内容
                try {
                    const response = await fetch(`/api/resume/${sessionId}`);
                    if (response.ok) {
                        const data = await response.json();
                        this.logMessage(`成功获取简历内容，长度: ${data.content.length}`);
                        return data.content;
                    } else {
                        this.logMessage(`获取简历API失败: ${response.status}`);
                        // 回退到使用预览内容
                        return resume.preview || null;
                    }
                } catch (apiError) {
                    this.logMessage(`简历API请求错误: ${apiError.message}`);
                    // 回退到使用预览内容
                    return resume.preview || null;
                }
            }
            
        } catch (error) {
            this.logMessage(`获取简历上下文失败: ${error.message}`);
            return null;
        }
    }
    
    /**
     * 建立WebRTC连接
     */
    async establishWebRTCConnection() {
        this.logMessage('建立WebRTC连接...');
        
        try {
            // 创建SDP offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.logMessage('SDP offer已创建');
            
            // 尝试连接不同的WebRTC端点
            let sdpResponse = null;
            let successfulUrl = null;
            
            for (const config of this.WEBRTC_CONFIGS) {
                try {
                    const webrtcUrl = config.useQuery ? `${config.url}?model=${this.DEPLOYMENT}` : config.url;
                    this.logMessage(`尝试连接: ${webrtcUrl}`);
                    
                    sdpResponse = await fetch(webrtcUrl, {
                        method: "POST",
                        body: offer.sdp,
                        headers: {
                            Authorization: `Bearer ${this.ephemeralKey}`,
                            "Content-Type": "application/sdp",
                        },
                    });

                    this.logMessage(`SDP响应状态: ${sdpResponse.status} ${sdpResponse.statusText}`);
                    
                    if (sdpResponse.ok) {
                        successfulUrl = webrtcUrl;
                        this.logMessage(`✅ 成功连接到: ${webrtcUrl}`);
                        break;
                    } else {
                        const errorText = await sdpResponse.text();
                        this.logMessage(`❌ 连接失败 ${config.url}: ${sdpResponse.status} - ${errorText}`);
                    }
                } catch (error) {
                    this.logMessage(`❌ 连接错误 ${config.url}: ${error.message}`);
                }
            }
            
            if (!sdpResponse || !sdpResponse.ok) {
                throw new Error("无法连接到任何WebRTC端点，请检查Azure资源区域配置");
            }

            const sdpText = await sdpResponse.text();
            this.logMessage(`收到SDP: ${sdpText.substring(0, 100)}...`);
            
            const answer = { type: "answer", sdp: sdpText };
            await this.peerConnection.setRemoteDescription(answer);
            
            this.logMessage('WebRTC连接建立成功');
            
        } catch (error) {
            this.logMessage(`WebRTC连接建立失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 开始语音通话
     */
    async startVoiceCall(initialInterviewId = null) {
        try {
            this.logMessage('开始语音通话...');
            
            // 检查浏览器兼容性
            this.checkBrowserCompatibility();
            
            // 检查WebSocket连接状态
            if (!this.azureVoiceChat.ws || this.azureVoiceChat.ws.readyState !== WebSocket.OPEN) {
                this.showError('请等待连接建立后再开始语音通话');
            return;
        }
        
            // 显示语音通话界面
            this.showVoiceCallInterface();
            this.updateVoiceStatus('正在初始化...', 'connecting');
            // 重置当前通话历史
            this.currentInterviewMessages = [];

            // 如果提供了 interviewId，尝试加载该历史记录
            if (initialInterviewId) {
                const interviews = this.storageManager.getInterviews();
                const historicalInterview = interviews.find(int => int.id === initialInterviewId);
                if (historicalInterview && historicalInterview.messages) {
                    this.currentInterviewMessages = historicalInterview.messages;
                    this.logMessage(`已加载历史面试 '${initialInterviewId}' 的 ${this.currentInterviewMessages.length} 条消息。`);
                } else {
                    this.logMessage(`未找到历史面试 '${initialInterviewId}' 或其没有消息历史。`);
                }
            } else {
                this.logMessage("开始新面试，对话历史已清空。");
            }            
            // 获取临时密钥
            await this.getEphemeralKey();
            
            // 初始化WebRTC连接
            await this.initWebRTCConnection();
            
            // 建立WebRTC连接
            await this.establishWebRTCConnection();
            
            // 开始通话
            this.isCallActive = true;
            this.callStartTime = Date.now();
            this.startCallTimer();
            
            this.updateVoiceStatus('通话进行中，可以开始说话', 'connected');
            this.logMessage('语音通话启动成功，录制已开始');
            
        } catch (error) {
            this.logMessage(`语音通话启动失败: ${error.message}`);
            this.showError('无法开始语音通话: ' + error.message);
            this.endVoiceCall();
        }
    }
    
    /**
     * 结束语音通话
     */
    endVoiceCall() {
        this.logMessage('结束语音通话...');
        
        try {
            // 关闭数据通道
            if (this.dataChannel) {
                this.dataChannel.close();
                this.dataChannel = null;
            }
            
            // 关闭RTCPeerConnection
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            // 停止用户媒体流
            if (this.clientMedia) {
                this.clientMedia.getTracks().forEach(track => track.stop());
                this.clientMedia = null;
            }
            
            // 停止计时器
            this.stopCallTimer();
            
            // 重置状态
            this.isCallActive = false;
            this.isConnected = false;
            this.ephemeralKey = null;
            this.sessionId = null;
            
            // 隐藏语音通话界面
            this.hideVoiceCallInterface();
            
            this.logMessage('语音通话已结束');

            // // Retrieve session messages
            // const sessionId = this.azureVoiceChat.currentSessionId;
            // const messages = this.azureVoiceChat.getSessionMessages(sessionId);

            // // Prepare interview data
            // const interviewData = {
            //     id: sessionId,
            //     createdAt: new Date().toISOString(),
            //     messages: messages,
            //     duration: this.callDuration, // Example: duration of the call
            //     // Add other relevant data
            // };

            // // Save the interview
            // this.storageManager.saveInterview(interviewData);

            this.logMessage('Interview has been saved successfully.');
            // **在通话结束后统一保存面试记录**
            this.saveCurrentInterview();
            // 清空当前面试历史，为下一次通话做准备
            this.currentInterviewMessages = [];
        } catch (error) {
            this.logMessage(`结束语音通话时出错: ${error.message}`);
        }
    }
    
    /**
     * 切换静音状态
     */
    toggleMute() {
        if (!this.clientMedia) return;
        
        const audioTrack = this.clientMedia.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const isMuted = !audioTrack.enabled;
            
            this.logMessage(`麦克风${isMuted ? '已静音' : '已取消静音'}`);
            
            // 更新UI
            if (this.muteButton) {
                this.muteButton.classList.toggle('muted', isMuted);
                
                const micIcon = this.muteButton.querySelector('.mic-icon');
                const micOffIcon = this.muteButton.querySelector('.mic-off-icon');
                
                if (micIcon && micOffIcon) {
                    micIcon.style.display = isMuted ? 'none' : 'inline';
                    micOffIcon.style.display = isMuted ? 'inline' : 'none';
                }
            }
            
            // 更新状态显示
            if (isMuted) {
                this.updateVoiceStatus('麦克风已静音', 'muted');
            } else {
                this.updateVoiceStatus('通话进行中，可以开始说话', 'connected');
            }
        }
    }
    saveCurrentInterview() {
        // 只有当有对话内容时才保存
        if (this.currentInterviewMessages.length > 0) {
            const resumeData = this.storageManager.getCurrentResume();
            const interviewRecord = {
                id: this.sessionId, // 使用 Azure 会话ID 作为面试记录的ID
                createdAt: new Date().toISOString(),
                duration: this.callTimer ? this.voiceTimer.textContent : 'N/A', // 从计时器获取时长
                messages: this.currentInterviewMessages,
                resumeFileName: resumeData ? resumeData.fileName : '无简历',
                // 可以添加其他元数据，例如面试状态、AI模型等
            };
            this.logMessage(`面试记录 '${interviewRecord}' 已保存到本地存储。`);
            this.storageManager.saveInterview(interviewRecord);
            this.logMessage(`面试记录 '${interviewRecord.id}' 已保存到本地存储。`);
        } else {
            this.logMessage('当前面试无对话内容，不保存记录。');
        }
    }    
    /**
     * 显示语音通话界面
     */
    showVoiceCallInterface() {
        if (this.voiceCallOverlay) {
            this.voiceCallOverlay.style.display = 'flex';
            document.body.classList.add('voice-call-active');
        }
    }
    
    /**
     * 隐藏语音通话界面
     */
    hideVoiceCallInterface() {
        if (this.voiceCallOverlay) {
            this.voiceCallOverlay.style.display = 'none';
            document.body.classList.remove('voice-call-active');
        }
    }
    
    /**
     * 更新语音状态
     */
    updateVoiceStatus(text, className = '') {
        if (this.voiceStatus) {
            this.voiceStatus.textContent = text;
            this.voiceStatus.className = `voice-status ${className}`;
        }
    }
    
    /**
     * 开始通话计时
     */
    startCallTimer() {
        this.callTimer = setInterval(() => {
            if (this.callStartTime && this.voiceTimer) {
            const elapsed = Date.now() - this.callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
                this.voiceTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    /**
     * 停止通话计时
     */
    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        if (this.voiceTimer) {
            this.voiceTimer.textContent = '00:00';
        }
    }
    
    /**
     * 显示错误信息
     */
    showError(message) {
        this.logMessage(`错误: ${message}`);
        
        // 更新状态显示
        this.updateVoiceStatus(message, 'error');
        
        // 可以添加更多的错误处理逻辑，如显示toast通知等
        if (typeof this.azureVoiceChat.showError === 'function') {
            this.azureVoiceChat.showError(message);
        }
    }
}

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceCallManager;
} 