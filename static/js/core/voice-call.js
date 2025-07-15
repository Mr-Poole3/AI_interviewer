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
        // audioElement 现在在 initElements() 中创建
        this.clientMedia = null;
        this.ephemeralKey = null;
        this.sessionId = null;
        
        this.currentInterviewMessages = []; // 用于存储当前通话的对话历史
        // 状态管理
        this.isConnected = false;
        this.isCallActive = false;
        this.callStartTime = null;
        this.callTimer = null;
        
        // 从设置管理器加载配置
        this.loadSettingsFromManager();

        // 音频设置
        this.audioSettings = {
            volume: 1.0,
            playbackRate: 1.0
        };
        
        // 调试日志
        this.debugMode = false;
        this.logContainer = null;
        
        this.initElements();
        this.bindEvents();
        this.setupDebugMode();
    }

    /**
     * 从设置管理器加载配置
     */
    loadSettingsFromManager() {
        if (this.azureVoiceChat && this.azureVoiceChat.settingsManager) {
            const settings = this.azureVoiceChat.settingsManager.getSettings();

            // 加载语音检测配置
            this.vadConfig = {
                threshold: settings.voice.threshold,
                prefix_padding_ms: settings.voice.prefix_padding_ms,
                silence_duration_ms: settings.voice.silence_duration_ms,
                create_response: true,       // 检测到静音后自动创建响应
                interrupt_response: true     // 允许用户打断AI回复
            };

            // 加载音频设置
            this.audioSettings = {
                volume: settings.audio.volume,
                playbackRate: settings.audio.playbackRate
            };

            this.logMessage(`从设置管理器加载配置: VAD阈值=${this.vadConfig.threshold}, 静音时长=${this.vadConfig.silence_duration_ms}ms, 音量=${this.audioSettings.volume}, 播放速度=${this.audioSettings.playbackRate}x`);
        } else {
            // 回退到默认配置
            this.vadConfig = {
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1500,
                create_response: true,
                interrupt_response: true
            };

            this.audioSettings = {
                volume: 1.0,
                playbackRate: 1.0
            };

            this.logMessage('设置管理器不可用，使用默认配置');
        }
    }
    
    /**
     * 初始化DOM元素
     */
    initElements() {
        // 语音通话相关元素
        this.voiceCallOverlay = document.getElementById('voiceCallFullscreen');
        this.voiceStatus = document.getElementById('voiceStatusDisplay');
        this.voiceTimer = document.getElementById('voiceTimer');
        this.endCallButton = document.getElementById('endCallButton');
        this.muteButton = document.getElementById('muteButton');
        this.vadSettingsButton = document.getElementById('vadSettingsButton');
        this.vadSettingsPanel = document.getElementById('vadSettingsPanel');
        this.voiceCallButton = document.getElementById('voiceCallButton');
        
        // 语音通话界面状态显示元素
        this.connectionQuality = document.getElementById('connectionQuality');
        this.callStatus = document.getElementById('callStatus');
        this.progressCount = document.getElementById('progressCount');
        this.currentStatus = document.getElementById('currentStatus');
        this.statusIcon = document.getElementById('statusIcon');
        this.statusMessage = document.getElementById('statusMessage');
        this.voiceLevelDisplay = document.getElementById('voiceLevelDisplay');
        this.levelText = document.getElementById('levelText');
        this.voiceTips = document.getElementById('voiceTips');
        
        // 保存面试确认对话框相关元素
        this.saveInterviewModal = document.getElementById('saveInterviewModal');
        this.confirmSaveButton = document.getElementById('saveInterviewBtn');
        this.confirmDiscardButton = document.getElementById('discardInterviewBtn');
        this.interviewDurationDisplay = document.getElementById('interviewDurationDisplay');
        this.interviewMessageCountDisplay = document.getElementById('interviewMessageCountDisplay');
        this.resumeStatusDisplay = document.getElementById('resumeStatusDisplay');
        
        // 状态面板相关元素已删除
        
        // VAD设置相关元素
        this.vadThresholdSlider = document.getElementById('vadThreshold');
        this.vadSilenceDurationSlider = document.getElementById('vadSilenceDuration');
        this.vadPrefixPaddingSlider = document.getElementById('vadPrefixPadding');
        this.closeVadSettingsButton = document.getElementById('closeVadSettings');
        this.resetVadSettingsButton = document.getElementById('resetVadSettings');
        this.applyVadSettingsButton = document.getElementById('applyVadSettings');
        
        // 初始化语音级别条
        this.voiceLevelBars = document.querySelectorAll('.voice-level-display .level-bar');
        
        // 创建音频播放元素（用于播放AI音频delta）
        this.audioPlayer = document.createElement('audio');
        this.audioPlayer.style.display = 'none';
        this.audioPlayer.volume = this.audioSettings.volume;
        this.audioPlayer.playbackRate = this.audioSettings.playbackRate;
        this.audioPlayer.preload = 'auto';
        this.audioPlayer.controls = false;
        document.body.appendChild(this.audioPlayer);

        // 创建远程音频流播放元素（用于WebRTC远程流）
        this.audioElement = document.createElement('audio');
        this.audioElement.style.display = 'none';
        this.audioElement.volume = this.audioSettings.volume;
        this.audioElement.playbackRate = this.audioSettings.playbackRate;
        this.audioElement.autoplay = true; // 自动播放远程流
        this.audioElement.controls = false;
        document.body.appendChild(this.audioElement);
        
        // 创建调试日志容器
        this.logContainer = document.createElement('div');
        this.logContainer.id = 'voiceCallDebugLog';
        this.logContainer.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 400px;
            max-height: 300px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            border-radius: 8px;
            overflow-y: auto;
            z-index: 10000;
            display: none;
        `;
        document.body.appendChild(this.logContainer);
        
        // 状态面板已删除
        
        // 初始化语音通话界面状态
        this.initVoiceCallStatus();
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
        if (this.vadSettingsButton) {
            this.vadSettingsButton.addEventListener('click', () => this.toggleVadSettings());
        }
        
        // 保存确认对话框事件
        if (this.confirmSaveButton) {
            this.confirmSaveButton.addEventListener('click', () => this.confirmSaveInterview());
        }
        
        if (this.confirmDiscardButton) {
            this.confirmDiscardButton.addEventListener('click', () => this.confirmDiscardInterview());
        }
        
        // 点击模态窗口背景关闭（保存确认对话框）
        if (this.saveInterviewModal) {
            this.saveInterviewModal.addEventListener('click', (e) => {
                if (e.target === this.saveInterviewModal) {
                    // 点击背景时不关闭，防止误操作
                    // this.hideSaveInterviewModal();
                }
            });
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
     * 更新音频设置
     * @param {Object} newAudioSettings - 新的音频设置
     * @param {number} newAudioSettings.volume - 音量 (0.0-1.0)
     * @param {number} newAudioSettings.playbackRate - 播放速度 (0.5-2.0)
     */
    updateAudioSettings(newAudioSettings) {
        const oldSettings = { ...this.audioSettings };

        // 更新配置
        if (newAudioSettings.volume !== undefined) {
            this.audioSettings.volume = Math.max(0.0, Math.min(1.0, newAudioSettings.volume));
        }
        if (newAudioSettings.playbackRate !== undefined) {
            this.audioSettings.playbackRate = Math.max(0.5, Math.min(2.0, newAudioSettings.playbackRate));
        }

        // 立即应用到音频元素
        if (this.audioPlayer) {
            this.audioPlayer.volume = this.audioSettings.volume;
            this.audioPlayer.playbackRate = this.audioSettings.playbackRate;
        }

        if (this.audioElement) {
            this.audioElement.volume = this.audioSettings.volume;
            this.audioElement.playbackRate = this.audioSettings.playbackRate;
        }

        this.logMessage(`音频设置已更新:`);
        this.logMessage(`  音量: ${oldSettings.volume} → ${this.audioSettings.volume}`);
        this.logMessage(`  播放速度: ${oldSettings.playbackRate}x → ${this.audioSettings.playbackRate}x`);
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
        if (this.closeVadSettingsButton) {
            this.closeVadSettingsButton.addEventListener('click', () => this.hideVadSettings());
        }
        
        // 滑块事件
        if (this.vadSilenceDurationSlider) {
            this.vadSilenceDurationSlider.addEventListener('input', (e) => {
                this.vadConfig.silence_duration_ms = parseInt(e.target.value);
            });
        }
        
        if (this.vadThresholdSlider) {
            this.vadThresholdSlider.addEventListener('input', (e) => {
                this.vadConfig.threshold = parseFloat(e.target.value);
            });
        }
        
        if (this.vadPrefixPaddingSlider) {
            this.vadPrefixPaddingSlider.addEventListener('input', (e) => {
                this.vadConfig.prefix_padding_ms = parseInt(e.target.value);
            });
        }
        
        // 重置按钮
        if (this.resetVadSettingsButton) {
            this.resetVadSettingsButton.addEventListener('click', () => this.resetVadSettingsToDefault());
        }
        
        // 应用按钮
        if (this.applyVadSettingsButton) {
            this.applyVadSettingsButton.addEventListener('click', () => this.applyVadSettingsFromPanel());
        }
        
        // 点击面板外部关闭
        document.addEventListener('click', (e) => {
            if (this.vadSettingsPanel && 
                this.vadSettingsPanel.style.display === 'block' &&
                !this.vadSettingsPanel.contains(e.target) &&
                !this.vadSettingsButton.contains(e.target)) {
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
        if (this.vadSilenceDurationSlider) {
            this.vadSilenceDurationSlider.value = this.vadConfig.silence_duration_ms;
        }
        
        if (this.vadThresholdSlider) {
            this.vadThresholdSlider.value = this.vadConfig.threshold;
        }
        
        if (this.vadPrefixPaddingSlider) {
            this.vadPrefixPaddingSlider.value = this.vadConfig.prefix_padding_ms;
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
        if (this.vadSilenceDurationSlider) {
            this.vadSilenceDurationSlider.value = defaultConfig.silence_duration_ms;
        }
        
        if (this.vadThresholdSlider) {
            this.vadThresholdSlider.value = defaultConfig.threshold;
        }
        
        if (this.vadPrefixPaddingSlider) {
            this.vadPrefixPaddingSlider.value = defaultConfig.prefix_padding_ms;
        }
        
        this.logMessage('VAD设置已重置为默认值');
    }
    
    /**
     * 从面板应用VAD设置
     */
    applyVadSettingsFromPanel() {
        const newConfig = {
            threshold: parseFloat(this.vadThresholdSlider.value),
            silence_duration_ms: parseInt(this.vadSilenceDurationSlider.value),
            prefix_padding_ms: parseInt(this.vadPrefixPaddingSlider.value)
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
                if (event.streams && event.streams.length > 0) {
                    this.logMessage(`设置远程音频流，流数量: ${event.streams.length}`);
                    this.audioElement.srcObject = event.streams[0];
                    
                    // 监听音频播放事件
                    this.audioElement.onloadedmetadata = () => {
                        this.logMessage('远程音频流元数据已加载');
                    };
                    
                    this.audioElement.onplay = () => {
                        this.logMessage('✅ 远程音频流开始播放');
                    };
                    
                    this.audioElement.onerror = (error) => {
                        this.logMessage(`❌ 远程音频流播放错误: ${error.message || error}`, 'error');
                    };
                } else {
                    this.logMessage('远程音频流事件但没有流数据', 'warning');
                }
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
            this.logMessage('数据通道打开，尝试触发AI首次发言...');
            await this.triggerAIInitialResponse();
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

    async triggerAIInitialResponse() {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            this.logMessage('数据通道未打开或未就绪，无法触发AI首次回复。');
            return;
        }
    
        this.logMessage('发送初始对话项以触发AI响应...');
    
 
        const initialUserPromptEvent = {
            type: "conversation.item.create",
            item: {
                type: "message",
                role: "user", // 模拟用户角色，让AI知道这是一个需要它回应的输入
                content: [{
                    type: "input_text",
                    text: "请开始面试。" 
                }]
            }
        };
    
        try {
            this.dataChannel.send(JSON.stringify(initialUserPromptEvent));
            this.logMessage('已发送 conversation.item.create (模拟用户开始) 事件。');
    
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 延时
    
            const triggerResponseEvent = {
                type: "response.create",
            };
            this.dataChannel.send(JSON.stringify(triggerResponseEvent));
            this.logMessage('已发送 response.create 事件以触发AI回复。');
    
        } catch (error) {
            this.logMessage(`发送初始AI触发事件失败: ${error.message}`);
            console.error("Failed to send initial AI trigger events:", error);
        }
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
                // this.saveCurrentInterview();
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
                // 音频数据流
                this.updateVoiceStatus('AI正在回复...', 'speaking');
                if (event.delta) {
                    this.logMessage(`收到音频delta，长度: ${event.delta.length}`);
                    this.playAudioDelta(event.delta);
                } else {
                    this.logMessage('收到空的音频delta');
                }
                break;
                
            case "response.audio_transcript.delta":
                // 音频转录增量，可以用于实时显示AI的回复文本
                if (event.delta) {
                    this.logMessage(`AI回复转录: ${event.delta}`);
                }
                break;
                
            case "response.audio.done":
                this.logMessage("AI音频回复完成");
                this.updateVoiceStatus('正在聆听...', 'listening');
                break;
                
            case "response.done":
                this.logMessage("AI回复完成");
                this.updateVoiceStatus('通话进行中', 'connected');
                break;
                
            case "response.created":
                this.logMessage("AI开始生成回复");
                this.updateVoiceStatus('AI正在思考...', 'processing');
                break;
                
            case "rate_limits.updated":
                if (event.rate_limits) {
                    this.logMessage(`速率限制更新: ${JSON.stringify(event.rate_limits)}`);
                }
                break;
                
            case "response.text.delta":
                if (event.delta) {
                    this.logMessage(`AI文本回复: ${event.delta}`);
                    // 这里可以添加实时显示文本的逻辑
                    this.handleTextResponse(event.delta);
                }
                break;
                
            case "response.text.done":
                this.logMessage("AI文本回复完成");
                break;
                
            case "response.audio_transcript.done":
                this.logMessage("AI音频转录完成");
                // 当AI音频转录完成时，保存完整的AI回复
                if (event.transcript) {
                    this.currentTurnAIText = event.transcript;
                    this.logMessage(`AI完整回复: "${this.currentTurnAIText}"`);
                    if (this.currentTurnAIText) {
                        this.currentInterviewMessages.push({ role: "assistant", content: this.currentTurnAIText });
                    }
                }
                break;
                
            case "response.content_part.done":
                this.logMessage("AI内容部分完成");
                break;
                
            case "response.output_item.done":
                this.logMessage("AI输出项完成");
                break;
                
            case "output_audio_buffer.stopped":
                this.logMessage("输出音频缓冲区已停止");
                break;
                
            case "conversation.item.created":
                this.logMessage("对话项已创建");
                break;
                
            case "conversation.item.truncated":
                this.logMessage("对话项被截断");
                break;
                
            case "error":
                this.logMessage(`错误: ${event.error?.message || '未知错误'}`, 'error');
                this.updateVoiceStatus('发生错误', 'error');
                break;
                
            default:
                // 对于未知事件类型，记录但不处理
                this.logMessage(`未处理的事件类型: ${event.type}`);
        }
        
        // 如果有音频级别数据，更新语音级别显示
        if (event.audio_level !== undefined) {
            this.updateVoiceLevelDisplay(event.audio_level);
        }
        
        // 模拟音频级别（用于演示，实际应该从音频流获取）
        if (event.type === "input_audio_buffer.speech_started" || 
            event.type === "response.audio.delta") {
            this.simulateAudioLevel();
        } else if (event.type === "input_audio_buffer.speech_stopped" || 
                   event.type === "response.audio.done") {
            this.updateVoiceLevelDisplay(0);
        }
    }
    
    /**
     * 更新会话指令
     */
    async updateSessionInstructions() {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            return;
        }
        
        // 获取简历信息和岗位偏好
        const resumeContext = await this.getResumeContext();
        const jobPreference = await this.getJobPreference();

        // 构建系统指令
        const instructions = await this.buildInstructions(resumeContext, jobPreference);

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
    async buildInstructions(resumeContext, jobPreference) {
        try {
            // 从后端获取prompt配置
            const response = await fetch('/api/prompts/voice-call', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    resume_context: resumeContext,
                    job_preference: jobPreference
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.logMessage(`从服务器获取prompt成功`);
                return data.instructions;
            } else {
                this.logMessage(`获取prompt失败: ${response.status}`);
                // 回退到默认prompt
                return await this.getDefaultInstructions(resumeContext, jobPreference);
            }
        } catch (error) {
            this.logMessage(`获取prompt错误: ${error.message}`);
            // 回退到默认prompt
            return await this.getDefaultInstructions(resumeContext, jobPreference);
        }
    }
    
    /**
     * 获取默认指令（回退方案）
     * 优先从API获取prompts.py中的配置，最后才使用硬编码
     */
    async getDefaultInstructions(resumeContext, jobPreference) {
        try {
            // 尝试从API获取默认prompt
            const response = await fetch('/api/prompts/voice-call-default');
            if (response.ok) {
                const data = await response.json();
                this.logMessage(`✅ 从API获取默认prompt成功: ${data.source}`);

                let instructions = data.instructions;

                // 添加简历信息
                if (resumeContext) {
                    instructions += `\n\n候选人简历信息：\n${resumeContext}`;
                }

                // 添加岗位偏好信息
                if (jobPreference) {
                    instructions += `\n\n候选人意向岗位：\n`;
                    instructions += `岗位类别: ${jobPreference.category_label || jobPreference.categoryLabel || ''}\n`;
                    instructions += `具体岗位: ${jobPreference.position_label || jobPreference.positionLabel || ''}\n`;
                    instructions += `完整岗位: ${jobPreference.full_label || (jobPreference.categoryLabel && jobPreference.positionLabel ? `${jobPreference.categoryLabel} - ${jobPreference.positionLabel}` : '')}`;
                }

                if (resumeContext || jobPreference) {
                    instructions += `\n\n请结合候选人的简历背景和意向岗位要求，进行针对性的面试提问和评估。`;
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
        let instructions = "你是一位专业的AI面试官，请用自然、友好的语调进行面试对话。根据候选人的简历内容，提出相关的技术和行为问题。保持对话流畅，适时给出反馈和鼓励。若未提供面试简历， 提醒候选人上传简历，并邀请候选人进行详细的自我介绍。";
        
        if (resumeContext) {
            instructions += `\n\n候选人简历信息：\n${resumeContext}\n\n请根据简历内容进行针对性的面试提问。`;
        }
        
        return instructions;
    }
    
    /**
     * 获取岗位偏好信息
     */
    async getJobPreference() {
        try {
            // 从localStorage获取当前简历（包含岗位偏好）
            const resumeData = localStorage.getItem('azure_current_resume');
            if (!resumeData) {
                return null;
            }

            const resume = JSON.parse(resumeData);
            if (resume && resume.jobPreference) {
                this.logMessage(`已获取岗位偏好: ${resume.jobPreference.full_label}`);
                return resume.jobPreference;
            }

            // 如果简历数据中没有，尝试从独立的岗位偏好存储获取
            const jobPreference = localStorage.getItem('job_preference');
            if (jobPreference) {
                const preference = JSON.parse(jobPreference);
                this.logMessage(`从独立存储获取岗位偏好: ${preference.categoryLabel} - ${preference.positionLabel}`);
                return preference;
            }

            return null;
        } catch (error) {
            this.logMessage(`获取岗位偏好失败: ${error.message}`);
            return null;
        }
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
            this.updateInterviewPhase('初始化中');
            
            // 测试音频播放权限（通过播放一个静音音频）
            await this.testAudioPlayback();
            
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
            
            // 更新状态面板
            this.updateConnectionStatus('connected', '已连接');
            this.updateInterviewPhase('进行中');
            this.updateVoiceStatus('通话进行中，可以开始说话', 'connected');
            this.addSystemTip('语音通话已启动，请开始对话', 'success');
            
            this.logMessage('语音通话启动成功，录制已开始');
            
        } catch (error) {
            this.logMessage(`语音通话启动失败: ${error.message}`);
            this.showError('无法开始语音通话: ' + error.message);
            this.updateConnectionStatus('disconnected', '连接失败');
            this.addSystemTip('语音通话启动失败: ' + error.message, 'error');
            this.endVoiceCall();
        }
    }
    
    /**
     * 结束语音通话
     */
    async endVoiceCall() {
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
            // 状态更新定时器已删除
            
            // 重置状态
            this.isCallActive = false;
            this.isConnected = false;
            this.ephemeralKey = null;
            this.sessionId = null;
            
            // 更新状态面板
            this.updateConnectionStatus('disconnected', '已断开');
            this.updateAudioStatus('pending', '音频待机');
            this.updateInterviewPhase('已结束');
            this.updateVoiceLevel(0);
            this.addSystemTip('语音通话已结束', 'info');
            
            // 隐藏语音通话界面
            this.hideVoiceCallInterface();
            
            this.logMessage('语音通话已结束');

            // 检查是否有面试内容需要保存
            if (this.currentInterviewMessages.length > 0) {
                // 显示保存确认对话框
                this.showSaveInterviewModal();
            } else {
                this.logMessage('当前面试无对话内容，无需保存。');
                // 清空当前面试历史，为下一次通话做准备
                this.currentInterviewMessages = [];
                // 重新启动状态更新定时器
                this.startStatusUpdateTimer();
            }
        } catch (error) {
            this.logMessage(`结束语音通话时出错: ${error.message}`);
            this.addSystemTip('结束通话时出现错误: ' + error.message, 'error');
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
    async saveCurrentInterview() {
        // 只有当有对话内容时才保存
        if (this.currentInterviewMessages.length > 0) {
            const resumeData = this.storageManager.getCurrentResume();
            if(!this.sessionId){
                this.sessionId = this.azureVoiceChat.currentSessionId || (resumeData && resumeData.sessionId) || Date.now().toString();
            }
            var interviewRecord = {
                id: this.sessionId, // 使用 Azure 会话ID 作为面试记录的ID
                createdAt: new Date().toISOString(),
                duration: this.azureVoiceChat.interviewStartTime ? Math.floor((Date.now() - this.azureVoiceChat.interviewStartTime) / 1000) : 0, // 从计时器获取时长
                messages: this.currentInterviewMessages,
                resumeFileName: resumeData ? resumeData.fileName : '无简历',
                // 可以添加其他元数据，例如面试状态、AI模型等
            };
            const resumeContext = await this.getResumeContext();
            try {
                // 获取岗位偏好信息
                const jobPreference = await this.getJobPreference();
                
                const extractionRequest = {
                    interview_id: interviewRecord.id,
                    messages: interviewRecord.messages,
                    resume_context: resumeContext || '',
                    job_preference: jobPreference
                };
                
                // 记录岗位偏好信息
                if (jobPreference) {
                    this.logMessage(`面试数据提取包含岗位偏好: ${jobPreference.full_label || jobPreference.fullLabel || 'N/A'}`);
                } else {
                    this.logMessage('面试数据提取未包含岗位偏好信息');
                }
                          
                // 调用提取API
                const response = await fetch('/api/interview/extract', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(extractionRequest)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        interviewRecord.title = result.extraction.title;
                        interviewRecord.summary = result.extraction.summary;
                    } else {
                        console.error('面试数据提取失败:', result.message);
                    }
                } else {
                    console.error('面试数据提取失败:', response.status);
                }
            } catch (error) {
                this.logMessage(`解析面试记录失败: ${error.message}`);
            }

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
        // 更新原有的语音状态显示
        if (this.voiceStatus) {
            this.voiceStatus.textContent = text;
            this.voiceStatus.className = `voice-status-text ${className}`;
        }
        
        // 同时更新状态面板
        switch (className) {
            case 'listening':
                this.updateAudioStatus('active', '正在聆听');
                break;
            case 'processing':
                this.updateAudioStatus('active', '正在处理');
                break;
            case 'speaking':
                this.updateAudioStatus('active', 'AI回复中');
                break;
            case 'connected':
                this.updateAudioStatus('connected', '通话进行中');
                break;
            case 'muted':
                this.updateAudioStatus('pending', '麦克风静音');
                break;
            case 'error':
                this.updateAudioStatus('disconnected', '音频错误');
                break;
            default:
                this.updateAudioStatus('pending', text);
        }
        
        // 更新语音通话界面状态
        this.updateVoiceCallStatus(text, className);
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
    
    /**
     * 显示保存面试确认对话框
     */
    showSaveInterviewModal() {
        if (!this.saveInterviewModal) {
            this.logMessage('保存确认对话框元素未找到');
            // 如果对话框不存在，直接保存
            this.saveCurrentInterview();
            return;
        }
        
        // 计算面试统计信息
        const duration = this.azureVoiceChat.interviewStartTime ? 
            Math.floor((Date.now() - this.azureVoiceChat.interviewStartTime) / 1000) : 0;
        const messageCount = this.currentInterviewMessages.length;
        const resumeData = this.storageManager.getCurrentResume();
        
        // 更新统计显示
        if (this.interviewDurationDisplay) {
            if (duration >= 60) {
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                this.interviewDurationDisplay.textContent = `${minutes}分${seconds}秒`;
            } else {
                this.interviewDurationDisplay.textContent = `${duration}秒`;
            }
        }
        
        if (this.interviewMessageCountDisplay) {
            this.interviewMessageCountDisplay.textContent = `${messageCount}轮`;
        }
        
        if (this.resumeStatusDisplay) {
            this.resumeStatusDisplay.textContent = resumeData ? resumeData.fileName : '未上传';
        }
        
        // 显示对话框
        this.saveInterviewModal.style.display = 'flex';
        this.logMessage('显示保存面试确认对话框');
    }
    
    /**
     * 隐藏保存面试确认对话框
     */
    hideSaveInterviewModal() {
        if (this.saveInterviewModal) {
            this.saveInterviewModal.style.display = 'none';
        }
    }
    
    /**
     * 确认保存面试记录
     */
    async confirmSaveInterview() {
        this.hideSaveInterviewModal();
        this.logMessage('用户选择保存面试记录');

        try {
            // 保存面试记录
            await this.saveCurrentInterview();
            this.logMessage('面试记录保存成功');

            // 立即刷新历史记录显示
            if (window.app && window.app.historyManager) {
                window.app.historyManager.refreshHistoryList();
            }

            // 显示后台评分处理提示
            this.showBackgroundEvaluationNotice();

            // 自动触发后台评分
            this.triggerBackgroundEvaluation();

        } catch (error) {
            this.logMessage(`保存面试记录失败: ${error.message}`);
            this.showError('保存面试记录失败: ' + error.message);
        } finally {
            // 清空当前面试历史，为下一次通话做准备
            this.currentInterviewMessages = [];
        }
    }
    
    /**
     * 确认丢弃面试记录
     */
    confirmDiscardInterview() {
        this.hideSaveInterviewModal();
        this.logMessage('用户选择不保存面试记录');

        // 清空当前面试历史
        this.currentInterviewMessages = [];
        this.logMessage('面试记录已丢弃');
    }

    /**
     * 显示后台评分处理提示
     */
    showBackgroundEvaluationNotice() {
        // 创建提示通知
        const notice = document.createElement('div');
        notice.className = 'background-evaluation-notice';
        notice.innerHTML = `
            <div class="notice-content">
                <div class="notice-icon">
                    <i class="fas fa-cogs"></i>
                </div>
                <div class="notice-text">
                    <h4>正在后台处理您的面试结果</h4>
                    <p>我们正在分析您的面试表现并生成详细评分，请稍后在历史记录中查看结果</p>
                </div>
                <button class="notice-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // 添加样式
        notice.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            max-width: 400px;
            animation: slideInRight 0.5s ease-out;
        `;

        // 添加到页面
        document.body.appendChild(notice);

        // 自动移除（10秒后）
        setTimeout(() => {
            if (notice.parentElement) {
                notice.style.animation = 'slideOutRight 0.5s ease-out';
                setTimeout(() => {
                    if (notice.parentElement) {
                        notice.remove();
                    }
                }, 500);
            }
        }, 10000);

        this.logMessage('显示后台评分处理提示');
    }

    /**
     * 触发后台评分
     */
    async triggerBackgroundEvaluation() {
        try {
            // 获取最新保存的面试记录
            const interviews = this.storageManager.getInterviews();
            const latestInterview = interviews[0]; // 最新的记录应该在第一个

            if (!latestInterview) {
                this.logMessage('未找到最新的面试记录，无法触发评分');
                return;
            }

            // 标记评分状态为处理中
            this.markInterviewAsEvaluating(latestInterview.id);

            // 获取简历上下文
            const resumeContext = await this.getResumeContext();
            
            // 获取岗位偏好信息
            const jobPreference = await this.getJobPreference();

            // 构建评分请求
            const evaluationRequest = {
                interview_id: latestInterview.id,
                messages: latestInterview.messages,
                resume_context: resumeContext || '',
                duration: latestInterview.duration || 0,
                job_preference: jobPreference
            };

            this.logMessage('开始后台评分处理...');

            // 异步调用评分API（不等待结果）
            this.performBackgroundEvaluation(evaluationRequest);

        } catch (error) {
            this.logMessage(`触发后台评分失败: ${error.message}`);
            console.error('后台评分触发失败:', error);
        }
    }

    /**
     * 执行后台评分（异步）
     */
    async performBackgroundEvaluation(evaluationRequest) {
        try {
            this.logMessage('发送评分请求到后台...');

            const response = await fetch('/api/interview/evaluate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(evaluationRequest)
            });

            if (response.ok) {
                const result = await response.json();
                this.logMessage('后台评分完成');

                if (result.success) {
                    // 更新面试记录的评分信息
                    this.updateInterviewEvaluation(evaluationRequest.interview_id, result.evaluation);

                    // 显示评分完成通知
                    this.showEvaluationCompleteNotice(evaluationRequest.interview_id);
                } else {
                    this.logMessage(`评分失败: ${result.message}`);
                    this.markInterviewEvaluationFailed(evaluationRequest.interview_id);
                }
            } else {
                this.logMessage(`评分API调用失败: ${response.status}`);
                this.markInterviewEvaluationFailed(evaluationRequest.interview_id);
            }

        } catch (error) {
            this.logMessage(`后台评分处理失败: ${error.message}`);
            this.markInterviewEvaluationFailed(evaluationRequest.interview_id);
            console.error('后台评分处理失败:', error);
        }
    }

    /**
     * 标记面试记录为评分中
     */
    markInterviewAsEvaluating(interviewId) {
        try {
            const interviews = this.storageManager.getInterviews();
            const interview = interviews.find(item => item.id === interviewId);

            if (interview) {
                interview.evaluationStatus = 'evaluating';
                interview.evaluationStartTime = new Date().toISOString();
                this.storageManager.saveInterview(interview);
                this.logMessage(`面试记录 ${interviewId} 标记为评分中`);
                
                // 🔥 关键修复：立即刷新历史记录显示，禁用按钮
                if (window.app && window.app.historyManager) {
                    window.app.historyManager.refreshHistoryList();
                }
            }
        } catch (error) {
            this.logMessage(`标记评分状态失败: ${error.message}`);
        }
    }

    /**
     * 标记面试记录评分失败
     */
    markInterviewEvaluationFailed(interviewId) {
        try {
            const interviews = this.storageManager.getInterviews();
            const interview = interviews.find(item => item.id === interviewId);

            if (interview) {
                interview.evaluationStatus = 'failed';
                interview.evaluationEndTime = new Date().toISOString();
                this.storageManager.saveInterview(interview);
                this.logMessage(`面试记录 ${interviewId} 标记为评分失败`);
                
                // 🔥 关键修复：刷新历史记录显示，显示重试按钮
                if (window.app && window.app.historyManager) {
                    window.app.historyManager.refreshHistoryList();
                }
            }
        } catch (error) {
            this.logMessage(`标记评分失败状态失败: ${error.message}`);
        }
    }

    /**
     * 更新面试记录的评分信息
     */
    updateInterviewEvaluation(interviewId, evaluation) {
        try {
            const interviews = this.storageManager.getInterviews();
            const interview = interviews.find(item => item.id === interviewId);

            if (interview) {
                interview.evaluation = evaluation;
                interview.score = evaluation.total_score;
                interview.evaluationStatus = 'completed';
                interview.evaluationEndTime = new Date().toISOString();

                // 只有在原来没有summary的情况下才设置评估总结
                if (!interview.summary && evaluation.summary) {
                    interview.summary = evaluation.summary;
                }

                this.storageManager.saveInterview(interview);
                this.logMessage(`面试记录 ${interviewId} 评分信息已更新`);

                // 立即刷新历史记录显示
                if (window.app && window.app.historyManager) {
                    window.app.historyManager.refreshHistoryList();
                }
                
                // 🔥 关键修复：显示评分完成通知
                if (window.notificationSystem) {
                    window.notificationSystem.success('评分完成', '面试评分已完成，可在历史记录中查看详细结果');
                }
            }
        } catch (error) {
            this.logMessage(`更新评分信息失败: ${error.message}`);
        }
    }

    /**
     * 显示评分完成通知
     */
    showEvaluationCompleteNotice(interviewId) {
        const notice = document.createElement('div');
        notice.className = 'evaluation-complete-notice';
        notice.innerHTML = `
            <div class="notice-content">
                <div class="notice-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="notice-text">
                    <h4>面试评分已完成！</h4>
                    <p>您的面试结果已生成，点击查看详细评分报告</p>
                </div>
                <div class="notice-actions">
                    <button class="btn-primary btn-sm" onclick="window.app.router.navigateTo('history')">
                        查看结果
                    </button>
                    <button class="notice-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

        // 添加样式
        notice.style.cssText = `
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
        document.body.appendChild(notice);

        // 自动移除（15秒后）
        setTimeout(() => {
            if (notice.parentElement) {
                notice.style.animation = 'slideOutRight 0.5s ease-out';
                setTimeout(() => {
                    if (notice.parentElement) {
                        notice.remove();
                    }
                }, 500);
            }
        }, 15000);

        this.logMessage('显示评分完成通知');
    }
    
    // ===== 状态面板管理方法 =====
    
    /**
     * 初始化状态面板
     */
    initStatusPanel() {
        // 绑定面板切换事件
        if (this.statusPanelToggle) {
            this.statusPanelToggle.addEventListener('click', () => this.toggleStatusPanel());
        }
        
        // 初始化状态
        this.updateConnectionStatus('connecting', '连接中...');
        this.updateAudioStatus('pending', '音频待机');
        this.updateInterviewPhase('准备中');
        this.updateConversationRounds(0);
        this.updateInterviewDuration(0);
        
        // 初始化语音级别
        this.initVoiceLevelMeter();
        
        // 添加初始提示
        this.addSystemTip('确保网络连接稳定，选择安静的环境进行面试', 'info');
        
        // 启动状态更新定时器
        this.startStatusUpdateTimer();
        
        this.logMessage('状态面板初始化完成');
    }
    
    /**
     * 切换状态面板显示/隐藏
     */
    toggleStatusPanel() {
        if (!this.statusPanelContent || !this.statusPanelToggle) return;
        
        const isCollapsed = this.statusPanelContent.classList.contains('collapsed');
        
        if (isCollapsed) {
            this.statusPanelContent.classList.remove('collapsed');
            this.statusPanelToggle.classList.remove('collapsed');
        } else {
            this.statusPanelContent.classList.add('collapsed');
            this.statusPanelToggle.classList.add('collapsed');
        }
        
        this.logMessage(`状态面板${isCollapsed ? '展开' : '收起'}`);
    }
    
    /**
     * 更新连接状态
     */
    updateConnectionStatus(status, text) {
        if (!this.connectionStatus) return;
        
        const statusDot = this.connectionStatus.querySelector('.status-dot');
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        if (statusDot) {
            statusDot.className = `status-dot ${status}`;
        }
        
        if (statusText) {
            statusText.textContent = text;
        }
        
        // 根据连接状态更新系统提示
        switch (status) {
            case 'connected':
                this.addSystemTip('连接已建立，可以开始面试', 'success');
                break;
            case 'connecting':
                this.addSystemTip('正在建立连接，请稍候...', 'info');
                break;
            case 'disconnected':
                this.addSystemTip('连接已断开，请检查网络', 'error');
                break;
        }
    }
    
    /**
     * 更新音频状态
     */
    updateAudioStatus(status, text) {
        if (!this.audioStatus) return;
        
        const statusDot = this.audioStatus.querySelector('.status-dot');
        const statusText = this.audioStatus.querySelector('.status-text');
        
        if (statusDot) {
            statusDot.className = `status-dot ${status}`;
        }
        
        if (statusText) {
            statusText.textContent = text;
        }
    }
    
    /**
     * 更新面试阶段
     */
    updateInterviewPhase(phase) {
        if (this.interviewPhase) {
            this.interviewPhase.textContent = phase;
        }
        
        // 根据阶段更新提示
        switch (phase) {
            case '准备中':
                this.addSystemTip('面试准备阶段，请确认设备正常', 'info');
                break;
            case '进行中':
                this.addSystemTip('面试进行中，请保持自然对话', 'success');
                break;
            case '已结束':
                this.addSystemTip('面试已结束，感谢您的参与', 'success');
                break;
        }
    }
    
    /**
     * 更新对话轮次
     */
    updateConversationRounds(rounds) {
        if (this.conversationRounds) {
            this.conversationRounds.textContent = rounds.toString();
        }
    }
    
    /**
     * 更新面试时长
     */
    updateInterviewDuration(seconds) {
        if (this.interviewDurationPanel) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            this.interviewDurationPanel.textContent = 
                `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }
    
    /**
     * 初始化语音级别计
     */
    initVoiceLevelMeter() {
        this.voiceLevelBars = document.querySelectorAll('.level-bar');
        this.currentVoiceLevel = 0;
        this.updateVoiceLevel(0);
    }
    
    /**
     * 更新语音级别显示
     */
    updateVoiceLevel(level) {
        if (!this.voiceLevelBars) return;
        
        // level 范围 0-1
        const normalizedLevel = Math.max(0, Math.min(1, level));
        const activeBarCount = Math.floor(normalizedLevel * this.voiceLevelBars.length);
        
        this.voiceLevelBars.forEach((bar, index) => {
            bar.classList.remove('active', 'high', 'peak');
            
            if (index < activeBarCount) {
                bar.classList.add('active');
                
                if (normalizedLevel > 0.7 && index >= 3) {
                    bar.classList.add('high');
                }
                
                if (normalizedLevel > 0.9 && index === 4) {
                    bar.classList.add('peak');
                }
            }
        });
        
        // 更新级别文本
        if (this.voiceLevelText) {
            if (normalizedLevel < 0.1) {
                this.voiceLevelText.textContent = '静音';
            } else if (normalizedLevel < 0.3) {
                this.voiceLevelText.textContent = '低';
            } else if (normalizedLevel < 0.7) {
                this.voiceLevelText.textContent = '中';
            } else if (normalizedLevel < 0.9) {
                this.voiceLevelText.textContent = '高';
            } else {
                this.voiceLevelText.textContent = '很高';
            }
        }
        
        this.currentVoiceLevel = normalizedLevel;
    }
    
    /**
     * 更新音频质量信息
     */
    updateAudioQuality(quality, latency) {
        if (this.audioQuality) {
            this.audioQuality.textContent = quality;
            this.audioQuality.className = 'quality-value';
            
            if (quality === '差') {
                this.audioQuality.classList.add('error');
            } else if (quality === '一般') {
                this.audioQuality.classList.add('warning');
            }
        }
        
        if (this.audioLatency) {
            this.audioLatency.textContent = latency;
            this.audioLatency.className = 'quality-value';
            
            const latencyMs = parseInt(latency);
            if (latencyMs > 300) {
                this.audioLatency.classList.add('error');
            } else if (latencyMs > 150) {
                this.audioLatency.classList.add('warning');
            }
        }
    }
    
    /**
     * 添加系统提示
     */
    addSystemTip(message, type = 'info', duration = 5000) {
        if (!this.systemTips) return;
        
        // 创建提示元素
        const tipElement = document.createElement('div');
        tipElement.className = `tip-item ${type}`;
        
        const iconMap = {
            info: 'fas fa-info-circle',
            success: 'fas fa-check-circle',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-times-circle'
        };
        
        tipElement.innerHTML = `
            <i class="${iconMap[type] || iconMap.info}"></i>
            <span>${message}</span>
        `;
        
        // 添加到容器顶部
        this.systemTips.insertBefore(tipElement, this.systemTips.firstChild);
        
        // 限制提示数量
        const tips = this.systemTips.querySelectorAll('.tip-item');
        if (tips.length > 3) {
            tips[tips.length - 1].remove();
        }
        
        // 自动移除（除了错误提示）
        if (type !== 'error' && duration > 0) {
            setTimeout(() => {
                if (tipElement.parentNode) {
                    tipElement.remove();
                }
            }, duration);
        }
    }
    
    /**
     * 启动状态更新定时器
     */
    startStatusUpdateTimer() {
        // 每秒更新一次时长和语音级别
        this.statusUpdateTimer = setInterval(() => {
            // 更新面试时长
            if (this.azureVoiceChat.interviewStartTime) {
                const duration = Math.floor((Date.now() - this.azureVoiceChat.interviewStartTime) / 1000);
                this.updateInterviewDuration(duration);
            }
            
            // 更新对话轮次
            if (this.currentInterviewMessages) {
                this.updateConversationRounds(this.currentInterviewMessages.length);
            }
            
            // 模拟语音级别（实际应该从音频分析器获取）
            if (this.isCallActive) {
                const randomLevel = Math.random() * 0.3 + (this.currentVoiceLevel * 0.7);
                this.updateVoiceLevel(randomLevel);
            } else {
                this.updateVoiceLevel(0);
            }
        }, 1000);
    }
    
    /**
     * 停止状态更新定时器
     */
    stopStatusUpdateTimer() {
        if (this.statusUpdateTimer) {
            clearInterval(this.statusUpdateTimer);
            this.statusUpdateTimer = null;
        }
    }
    
    // ===== 语音通话界面状态管理方法 =====
    
    /**
     * 初始化语音通话界面状态
     */
    initVoiceCallStatus() {
        // 初始化连接质量
        this.updateConnectionQuality('good');
        
        // 初始化通话状态
        this.updateCallStatus('准备中', 'pending');
        
        // 初始化进度计数
        this.updateProgressCount(0);
        
        // 初始化当前状态
        this.updateCurrentStatus('准备开始面试', 'microphone', 'pending');
        
        // 初始化语音级别
        this.updateVoiceLevelDisplay(0);
        
        // 添加初始提示
        this.addVoiceTip('确保麦克风权限已开启，环境安静', 'info');
        
        this.logMessage('语音通话界面状态初始化完成');
    }
    
    /**
     * 更新连接质量显示
     */
    updateConnectionQuality(quality) {
        if (!this.connectionQuality) return;
        
        const signalBars = this.connectionQuality.querySelector('.signal-bars');
        const qualityText = this.connectionQuality.querySelector('.quality-text');
        
        if (signalBars) {
            signalBars.className = `signal-bars ${quality}`;
        }
        
        if (qualityText) {
            const qualityMap = {
                excellent: '连接优秀',
                good: '连接良好',
                fair: '连接一般',
                poor: '连接较差'
            };
            qualityText.textContent = qualityMap[quality] || '连接状态';
        }
    }
    
    /**
     * 更新通话状态
     */
    updateCallStatus(text, status = 'active') {
        if (!this.callStatus) return;
        
        const statusDot = this.callStatus.querySelector('.status-indicator-dot');
        const statusText = this.callStatus.querySelector('.status-text');
        
        if (statusDot) {
            statusDot.className = `status-indicator-dot ${status}`;
        }
        
        if (statusText) {
            statusText.textContent = text;
        }
    }
    
    /**
     * 更新进度计数
     */
    updateProgressCount(count) {
        if (this.progressCount) {
            this.progressCount.textContent = count.toString();
        }
    }
    
    /**
     * 更新当前状态显示
     */
    updateCurrentStatus(message, iconClass = 'microphone', statusClass = 'pending') {
        // 图标已被隐藏，不再更新图标样式
        // if (this.statusIcon) {
        //     this.statusIcon.className = `fas fa-${iconClass}`;
        //     this.statusIcon.parentElement.className = `status-icon ${statusClass}`;
        // }
        
        if (this.statusMessage) {
            this.statusMessage.textContent = message;
        }
    }
    
    /**
     * 更新语音级别显示
     */
    updateVoiceLevelDisplay(level) {
        if (!this.voiceLevelBars || this.voiceLevelBars.length === 0) return;
        
        // level 范围 0-1
        const normalizedLevel = Math.max(0, Math.min(1, level));
        const activeBarCount = Math.floor(normalizedLevel * this.voiceLevelBars.length);
        
        this.voiceLevelBars.forEach((bar, index) => {
            bar.classList.remove('active', 'medium', 'high');
            
            if (index < activeBarCount) {
                bar.classList.add('active');
                
                // 根据级别添加不同颜色
                if (normalizedLevel > 0.8 && index >= 6) {
                    bar.classList.add('high');
                } else if (normalizedLevel > 0.5 && index >= 4) {
                    bar.classList.add('medium');
                }
            }
        });
        
        // 更新级别文本
        if (this.levelText) {
            if (normalizedLevel < 0.1) {
                this.levelText.textContent = '静音';
            } else if (normalizedLevel < 0.3) {
                this.levelText.textContent = '低';
            } else if (normalizedLevel < 0.6) {
                this.levelText.textContent = '中';
            } else if (normalizedLevel < 0.8) {
                this.levelText.textContent = '高';
            } else {
                this.levelText.textContent = '很高';
            }
        }
    }
    
    /**
     * 添加语音提示
     */
    addVoiceTip(message, type = 'info', duration = 5000) {
        if (!this.voiceTips) return;
        
        // 移除旧的提示
        const existingTips = this.voiceTips.querySelectorAll('.tip-item');
        existingTips.forEach(tip => tip.classList.remove('active'));
        
        // 创建新提示
        const tipElement = document.createElement('div');
        tipElement.className = 'tip-item';
        
        const iconMap = {
            info: 'fas fa-info-circle',
            success: 'fas fa-check-circle',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-times-circle'
        };
        
        tipElement.innerHTML = `
            <i class="${iconMap[type] || iconMap.info}"></i>
            <span>${message}</span>
        `;
        
        // 清空容器并添加新提示
        this.voiceTips.innerHTML = '';
        this.voiceTips.appendChild(tipElement);
        
        // 显示动画
        setTimeout(() => {
            tipElement.classList.add('active');
        }, 100);
        
        // 自动隐藏
        if (duration > 0) {
            setTimeout(() => {
                tipElement.classList.remove('active');
            }, duration);
        }
    }
    
    /**
     * 更新语音通话状态（集成方法）
     */
    updateVoiceCallStatus(text, className = '') {
        // 根据状态类更新各个组件
        switch (className) {
            case 'listening':
                this.updateCallStatus('正在聆听', 'listening');
                this.updateCurrentStatus('请说话，我在聆听...', 'microphone', 'listening');
                this.addVoiceTip('检测到您的声音，请继续说话', 'info', 3000);
                break;
                
            case 'processing':
                this.updateCallStatus('正在处理', 'processing');
                this.updateCurrentStatus('正在分析您的回答...', 'cog', 'processing');
                this.addVoiceTip('正在处理您的回答，请稍候', 'info', 3000);
                break;
                
            case 'speaking':
                this.updateCallStatus('AI回复中', 'speaking');
                this.updateCurrentStatus('AI正在回复...', 'volume-up', 'speaking');
                this.addVoiceTip('AI正在回复，请仔细聆听', 'success', 3000);
                break;
                
            case 'connected':
                this.updateCallStatus('通话进行中', 'active');
                this.updateCurrentStatus('通话进行中，可以开始对话', 'microphone', 'active');
                break;
                
            case 'muted':
                this.updateCallStatus('麦克风静音', 'muted');
                this.updateCurrentStatus('麦克风已静音', 'microphone-slash', 'muted');
                this.addVoiceTip('麦克风已静音，点击取消静音继续对话', 'warning', 0);
                break;
                
            case 'error':
                this.updateCallStatus('连接错误', 'error');
                this.updateCurrentStatus('连接出现问题', 'exclamation-triangle', 'error');
                this.addVoiceTip('连接出现问题：' + text, 'error', 0);
                break;
                
            case 'connecting':
                this.updateCallStatus('正在连接', 'connecting');
                this.updateCurrentStatus('正在建立连接...', 'spinner', 'connecting');
                this.addVoiceTip('正在建立连接，请稍候', 'info', 3000);
                break;
                
            default:
                this.updateCallStatus(text, 'active');
                this.updateCurrentStatus(text, 'microphone', 'active');
        }
        
        // 更新对话轮次
        if (this.currentInterviewMessages) {
            this.updateProgressCount(Math.floor(this.currentInterviewMessages.length / 2));
        }
    }
    
    /**
     * 模拟音频级别（用于演示）
     */
    simulateAudioLevel() {
        if (this.audioLevelInterval) {
            clearInterval(this.audioLevelInterval);
        }
        
        this.audioLevelInterval = setInterval(() => {
            // 生成随机音频级别
            const baseLevel = 0.3 + Math.random() * 0.5;
            const variation = Math.sin(Date.now() / 200) * 0.2;
            const level = Math.max(0, Math.min(1, baseLevel + variation));
            
            this.updateVoiceLevelDisplay(level);
        }, 100);
        
        // 3秒后停止模拟
        setTimeout(() => {
            if (this.audioLevelInterval) {
                clearInterval(this.audioLevelInterval);
                this.audioLevelInterval = null;
            }
        }, 3000);
    }
    
    /**
     * 播放音频数据
     */
    playAudioDelta(audioData) {
        try {
            if (!this.audioPlayer) {
                this.logMessage('音频播放器未初始化', 'error');
                return;
            }
            
            if (!audioData) {
                this.logMessage('音频数据为空', 'warning');
                return;
            }
            
            this.logMessage(`收到音频数据，长度: ${audioData.length} 字符`);
            
            // 将base64音频数据转换为ArrayBuffer
            try {
                const binaryString = atob(audioData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                this.logMessage(`音频数据转换完成，字节长度: ${bytes.length}`);
                
                // 创建音频blob，尝试PCM16格式（Azure OpenAI的默认格式）
                const blob = new Blob([bytes], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(blob);
                
                // 停止当前播放的音频
                if (!this.audioPlayer.paused) {
                    this.audioPlayer.pause();
                }
                
                this.audioPlayer.src = audioUrl;
                this.audioPlayer.currentTime = 0;
                
                // 尝试播放音频
                const playPromise = this.audioPlayer.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        this.logMessage('✅ 音频播放成功');
                    }).catch(error => {
                        this.logMessage(`❌ 音频播放失败: ${error.name} - ${error.message}`, 'error');
                        
                        // 如果是自动播放策略问题，提供解决方案
                        if (error.name === 'NotAllowedError') {
                            this.logMessage('浏览器阻止了自动播放，需要用户交互', 'warning');
                            this.addVoiceTip('音频被浏览器阻止，请点击页面任意位置启用声音', 'warning', 8000);
                        }
                        
                        // 清理资源
                        URL.revokeObjectURL(audioUrl);
                    });
                }
                
                // 音频播放结束时清理资源
                this.audioPlayer.onended = () => {
                    this.logMessage('音频播放完毕');
                    URL.revokeObjectURL(audioUrl);
                };
                
                // 音频加载错误处理
                this.audioPlayer.onerror = (event) => {
                    this.logMessage(`音频加载错误: ${event.target.error?.message || '未知错误'}`, 'error');
                    URL.revokeObjectURL(audioUrl);
                };
                
            } catch (decodeError) {
                this.logMessage(`Base64解码错误: ${decodeError.message}`, 'error');
            }
            
        } catch (error) {
            this.logMessage(`音频数据处理错误: ${error.message}`, 'error');
            this.logMessage(`错误堆栈: ${error.stack}`, 'error');
        }
    }
    
    /**
     * 处理文本回复
     */
    handleTextResponse(textDelta) {
        if (!this.currentTurnAIText) {
            this.currentTurnAIText = '';
        }
        
        this.currentTurnAIText += textDelta;
        
        // 可以在这里添加实时显示文本的逻辑
        // 例如更新某个显示区域显示正在生成的文本
    }
    
    /**
     * 测试音频播放权限
     */
    async testAudioPlayback() {
        try {
            if (!this.audioPlayer) {
                this.logMessage('音频播放器未初始化', 'error');
                return false;
            }
            
            this.logMessage('正在测试音频播放权限...');
            
            // 创建一个很短的静音音频文件 (WAV格式)
            // 这是一个44字节的WAV文件头 + 很短的静音数据
            const silentAudioData = new Uint8Array([
                0x52, 0x49, 0x46, 0x46, 0x28, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6D, 0x74, 0x20,
                0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x44, 0xAC, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
                0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ]);
            
            const blob = new Blob([silentAudioData], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(blob);
            
            this.audioPlayer.src = audioUrl;
            this.audioPlayer.volume = 0.01; // 设置很低的音量避免打扰
            
            try {
                await this.audioPlayer.play();
                this.logMessage('音频播放权限测试成功');
                this.audioPlayer.pause();
                this.audioPlayer.currentTime = 0;
                this.audioPlayer.volume = 1.0; // 恢复正常音量
                URL.revokeObjectURL(audioUrl);
                return true;
            } catch (error) {
                this.logMessage(`音频播放权限测试失败: ${error.name} - ${error.message}`, 'warning');
                
                if (error.name === 'NotAllowedError') {
                    this.addVoiceTip('请允许浏览器播放音频，或点击页面任意位置后重试', 'warning', 10000);
                    
                    // 等待用户交互
                    await this.waitForUserInteraction();
                    
                    // 重试
                    try {
                        await this.audioPlayer.play();
                        this.logMessage('音频播放权限测试重试成功');
                        this.audioPlayer.pause();
                        this.audioPlayer.currentTime = 0;
                        this.audioPlayer.volume = 1.0;
                        URL.revokeObjectURL(audioUrl);
                        return true;
                    } catch (retryError) {
                        this.logMessage(`音频播放权限重试失败: ${retryError.message}`, 'error');
                        URL.revokeObjectURL(audioUrl);
                        return false;
                    }
                }
                
                URL.revokeObjectURL(audioUrl);
                return false;
            }
            
        } catch (error) {
            this.logMessage(`测试音频播放权限时出错: ${error.message}`, 'error');
            return false;
        }
    }
    
    /**
     * 等待用户交互
     */
    async waitForUserInteraction() {
        return new Promise((resolve) => {
            this.logMessage('等待用户交互以启用音频播放...');
            
            const handleUserInteraction = () => {
                this.logMessage('检测到用户交互');
                document.removeEventListener('click', handleUserInteraction);
                document.removeEventListener('touchstart', handleUserInteraction);
                document.removeEventListener('keydown', handleUserInteraction);
                resolve();
            };
            
            document.addEventListener('click', handleUserInteraction);
            document.addEventListener('touchstart', handleUserInteraction);
            document.addEventListener('keydown', handleUserInteraction);
            
            // 5秒后自动继续
            setTimeout(() => {
                document.removeEventListener('click', handleUserInteraction);
                document.removeEventListener('touchstart', handleUserInteraction);
                document.removeEventListener('keydown', handleUserInteraction);
                resolve();
            }, 5000);
        });
    }
}

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceCallManager;
} 