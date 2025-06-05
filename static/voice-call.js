/**
 * 语音通话管理器 - FastRTC增强版
 * 
 * 负责语音通话界面的交互逻辑，包括：
 * - 麦克风权限获取和控制
 * - FastRTC音频增强处理
 * - 专业音频预处理（降噪、回声消除、AGC）
 * - 智能语音活动检测（VAD）
 * - 语音可视化效果
 * - 通话状态管理
 * - 全屏语音界面的交互
 * - 智能打断机制
 */
class VoiceCallManager {
    constructor(azureVoiceChat) {
        this.azureVoiceChat = azureVoiceChat;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.isRecording = false;
        this.isMuted = false;
        this.callStartTime = null;
        this.callTimer = null;
        this.audioContext = null;
        this.analyser = null;
        this.animationId = null;
        
        // FastRTC音频增强相关
        this.audioProcessor = null;
        this.vadProcessor = null;
        this.noiseSuppressionNode = null;
        this.echoCancellationNode = null;
        this.gainNode = null;
        this.compressorNode = null;
        
        // VAD (Voice Activity Detection) 配置 - 优化阈值设置
        this.vadThreshold = 0.003; // 降低语音活动检测阈值，原值0.01过于严格
        this.vadSmoothingFactor = 0.6; // 降低平滑因子，提高响应速度，原值0.8过于平滑
        this.currentVadLevel = 0;
        
        // 新增：音频能量统计，用于动态调整阈值
        this.audioEnergyStats = {
            min: Infinity,
            max: 0,
            recent: [],
            avgNoise: 0.001 // 预估环境噪音水平
        };
        
        // 智能打断系统配置
        this.interruptionEnabled = true;
        this.isAIResponding = false;
        this.lastInterruptTime = 0;
        this.interruptCooldown = 2000; // 2秒冷却时间
        this.interruptDelay = 200; // 延迟200ms执行打断，避免误触发
        this.pendingInterrupt = null;
        this.interruptThreshold = 0.015; // 打断检测阈值，略高于VAD阈值
        
        // 音频质量优化
        this.audioChunks = [];
        this.chunkDuration = 50; // 音频块持续时间(ms)
        this.sampleRate = 24000; // 采样率
        this.bitDepth = 16; // 位深度
        
        this.initElements();
        this.bindEvents();
        this.initAudioVisualization();
    }
    
    /**
     * 初始化DOM元素
     */
    initElements() {
        // 语音通话按钮
        this.voiceCallButton = document.getElementById('voiceCallButton');
        
        // 全屏语音界面
        this.voiceCallFullscreen = document.getElementById('voiceCallFullscreen');
        this.voiceCallBackdrop = document.getElementById('voiceCallBackdrop');
        this.voiceAnimationContainer = document.getElementById('voiceAnimationContainer');
        this.voiceLottiePlayer = document.getElementById('voiceLottiePlayer');
        this.voiceStatusDisplay = document.getElementById('voiceStatusDisplay');
        this.voiceTimer = document.getElementById('voiceTimer');
        this.voiceMuteBtn = document.getElementById('voiceMuteBtn');
        this.voiceEndBtn = document.getElementById('voiceEndBtn');
        
        // 弹窗语音界面（备用）
        this.voiceCallOverlay = document.getElementById('voiceCallOverlay');
        this.callStatus = document.getElementById('callStatus');
        this.callTimer2 = document.getElementById('callTimer');
        this.endCallButton = document.getElementById('endCallButton');
        this.callMinimize = document.getElementById('callMinimize');
        this.voiceVisualizer = document.getElementById('voiceVisualizer');
        this.voiceStatusText = document.getElementById('voiceStatusText');
        
        // 创建打断按钮
        this.createInterruptButton();
        
        console.log('语音通话管理器 - DOM元素初始化完成');
    }
    
    /**
     * 创建打断按钮
     */
    createInterruptButton() {
        // 在全屏界面添加打断按钮
        if (this.voiceCallFullscreen) {
            const voiceControls = this.voiceCallFullscreen.querySelector('.voice-controls');
            if (voiceControls) {
                const interruptBtn = document.createElement('button');
                interruptBtn.id = 'voiceInterruptBtn';
                interruptBtn.className = 'voice-control-btn interrupt-btn';
                interruptBtn.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 6h12v12H6z"/>
                    </svg>
                `;
                interruptBtn.title = '打断AI回复';
                interruptBtn.style.display = 'none'; // 默认隐藏
                
                // 插入到静音按钮和结束按钮之间
                const muteBtn = voiceControls.querySelector('.mute-btn');
                if (muteBtn) {
                    voiceControls.insertBefore(interruptBtn, muteBtn.nextSibling);
                } else {
                    voiceControls.appendChild(interruptBtn);
                }
                
                this.voiceInterruptBtn = interruptBtn;
            }
        }
    }
    
    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 语音通话按钮点击
        if (this.voiceCallButton) {
            this.voiceCallButton.addEventListener('click', () => {
                this.startVoiceCall();
            });
        }
        
        // 全屏界面控制按钮
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
        
        // 打断按钮事件
        if (this.voiceInterruptBtn) {
            this.voiceInterruptBtn.addEventListener('click', () => {
                this.manualInterrupt();
            });
        }
        
        // 弹窗界面控制按钮
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
        
        // 背景点击关闭（可选）
        if (this.voiceCallBackdrop) {
            this.voiceCallBackdrop.addEventListener('click', () => {
                // 可以选择是否允许点击背景关闭
                // this.endVoiceCall();
            });
        }
        
        // 监听AI回复状态变化
        this.bindAIResponseEvents();
        
        console.log('语音通话管理器 - 事件绑定完成');
    }
    
    /**
     * 绑定AI回复状态事件
     */
    bindAIResponseEvents() {
        // 监听AI开始回复
        window.addEventListener('aiResponseStart', () => {
            this.onAIResponseStart();
        });
        
        // 监听AI回复结束
        window.addEventListener('aiResponseEnd', () => {
            this.onAIResponseEnd();
        });
        
        // 监听音频播放开始
        window.addEventListener('audioPlaybackStart', () => {
            this.onAudioPlaybackStart();
        });
        
        // 监听音频播放结束
        window.addEventListener('audioPlaybackEnd', () => {
            this.onAudioPlaybackEnd();
        });
    }
    
    /**
     * 初始化音频可视化和FastRTC音频处理
     */
    async initAudioVisualization() {
        try {
            // 创建高质量音频上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate,
                latencyHint: 'interactive' // 优化延迟
            });
            
            console.log('语音通话管理器 - FastRTC音频上下文初始化完成');
        } catch (error) {
            console.error('语音通话管理器 - 音频上下文初始化失败:', error);
        }
    }
    
    /**
     * 请求麦克风权限 - FastRTC增强版
     */
    async requestMicrophonePermission() {
        try {
            // FastRTC优化的音频约束
            const audioConstraints = {
                audio: {
                    // 基础音频处理
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    
                    // FastRTC音频质量优化
                    sampleRate: this.sampleRate,
                    sampleSize: this.bitDepth,
                    channelCount: 1, // 单声道，减少带宽
                    
                    // 延迟优化
                    latency: 0.01, // 10ms延迟
                    
                    // 高级音频处理
                    googEchoCancellation: true,
                    googAutoGainControl: true,
                    googNoiseSuppression: true,
                    googHighpassFilter: true,
                    googTypingNoiseDetection: true,
                    googAudioMirroring: false,
                    
                    // 音频质量设置
                    googAGCGain: 15,
                    googNoiseReduction: true
                }
            };
            
            this.audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
            
            // 初始化FastRTC音频处理管道
            await this.initFastRTCAudioPipeline();
            
            console.log('语音通话管理器 - FastRTC增强麦克风权限获取成功');
            return this.audioStream;
            
        } catch (error) {
            console.error('语音通话管理器 - 麦克风权限获取失败:', error);
            
            let errorMessage = '无法访问麦克风';
            if (error.name === 'NotAllowedError') {
                errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问';
            } else if (error.name === 'NotFoundError') {
                errorMessage = '未找到麦克风设备';
            } else if (error.name === 'NotReadableError') {
                errorMessage = '麦克风设备被其他应用占用';
            }
            
            throw new Error(errorMessage);
        }
    }
    
    /**
     * 初始化FastRTC音频处理管道
     */
    async initFastRTCAudioPipeline() {
        if (!this.audioContext || !this.audioStream) {
            throw new Error('音频上下文或音频流未初始化');
        }
        
        try {
            // 创建音频源节点
            const sourceNode = this.audioContext.createMediaStreamSource(this.audioStream);
            
            // 创建分析器节点（用于VAD和可视化）
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // 创建增益控制节点
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0;
            
            // 创建动态压缩器（改善音频动态范围）
            this.compressorNode = this.audioContext.createDynamicsCompressor();
            this.compressorNode.threshold.value = -24;
            this.compressorNode.knee.value = 30;
            this.compressorNode.ratio.value = 12;
            this.compressorNode.attack.value = 0.003;
            this.compressorNode.release.value = 0.25;
            
            // 创建高通滤波器（去除低频噪音）
            const highPassFilter = this.audioContext.createBiquadFilter();
            highPassFilter.type = 'highpass';
            highPassFilter.frequency.value = 80; // 80Hz高通
            highPassFilter.Q.value = 0.7;
            
            // 创建低通滤波器（去除高频噪音）
            const lowPassFilter = this.audioContext.createBiquadFilter();
            lowPassFilter.type = 'lowpass';
            lowPassFilter.frequency.value = 8000; // 8kHz低通
            lowPassFilter.Q.value = 0.7;
            
            // 创建音频处理器节点（用于VAD和实时处理）
            this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            this.audioProcessor.onaudioprocess = (event) => {
                this.processAudioWithVAD(event);
            };
            
            // 连接音频处理管道
            sourceNode
                .connect(highPassFilter)
                .connect(lowPassFilter)
                .connect(this.compressorNode)
                .connect(this.gainNode)
                .connect(this.analyser)
                .connect(this.audioProcessor);
            
            // 连接到目标（用于录音）
            this.audioProcessor.connect(this.audioContext.destination);
            
            console.log('语音通话管理器 - FastRTC音频处理管道初始化完成');
            
        } catch (error) {
            console.error('语音通话管理器 - FastRTC音频处理管道初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 音频处理与语音活动检测（VAD）- 增强打断机制
     */
    processAudioWithVAD(event) {
        if (!this.isRecording || this.isMuted) {
            return;
        }
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // 改进的音频能量计算（使用更敏感的检测方法）
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < inputData.length; i++) {
            const sample = Math.abs(inputData[i]);
            sum += sample * sample; // RMS计算
            peak = Math.max(peak, sample); // 峰值检测
        }
        const rms = Math.sqrt(sum / inputData.length);
        
        // 结合RMS和峰值的综合能量指标
        const combinedEnergy = rms * 0.7 + peak * 0.3;
        
        // 更新音频能量统计信息
        this.updateAudioEnergyStats(combinedEnergy);
        
        // 动态调整VAD阈值
        const adaptiveThreshold = this.calculateAdaptiveThreshold();
        
        // 平滑VAD级别（降低平滑因子，提高响应速度）
        this.currentVadLevel = this.vadSmoothingFactor * this.currentVadLevel + 
                              (1 - this.vadSmoothingFactor) * combinedEnergy;
        
        // 语音活动检测（使用动态阈值）
        const wasSpeaking = this.isSpeaking;
        this.isSpeaking = this.currentVadLevel > adaptiveThreshold;
        
        // 记录检测状态（调试用）
        if (this.isSpeaking !== wasSpeaking) {
            console.log(`VAD状态变化: ${wasSpeaking ? '说话' : '静音'} -> ${this.isSpeaking ? '说话' : '静音'}, 
                        能量: ${combinedEnergy.toFixed(4)}, 阈值: ${adaptiveThreshold.toFixed(4)}, 
                        VAD级别: ${this.currentVadLevel.toFixed(4)}`);
        }
        
        // 智能打断检测
        if (this.interruptionEnabled && this.isAIResponding && this.isSpeaking && !wasSpeaking) {
            this.detectInterruption();
        }
        
        // 处理语音状态变化
        if (this.isSpeaking && !wasSpeaking) {
            // 开始说话
            this.onSpeechStart();
        } else if (!this.isSpeaking && wasSpeaking) {
            // 停止说话
            this.onSpeechEnd();
        }
        
        // 如果正在说话，处理音频数据
        if (this.isSpeaking) {
            this.processAudioChunk(inputData);
        }
        
        // 更新可视化
        this.updateVoiceVisualization(this.currentVadLevel);
    }
    
    /**
     * 更新音频能量统计信息
     */
    updateAudioEnergyStats(energy) {
        const stats = this.audioEnergyStats;
        
        // 更新最小值和最大值
        stats.min = Math.min(stats.min, energy);
        stats.max = Math.max(stats.max, energy);
        
        // 维护最近的能量值（用于计算噪音基线）
        stats.recent.push(energy);
        if (stats.recent.length > 100) { // 保持最近100个样本
            stats.recent.shift();
        }
        
        // 计算平均噪音水平（取最近样本的较低百分位）
        if (stats.recent.length >= 20) {
            const sorted = [...stats.recent].sort((a, b) => a - b);
            const percentile20 = sorted[Math.floor(sorted.length * 0.2)];
            stats.avgNoise = percentile20 * 1.2; // 略高于20%百分位作为噪音基线
        }
    }
    
    /**
     * 计算自适应VAD阈值
     */
    calculateAdaptiveThreshold() {
        const stats = this.audioEnergyStats;
        
        // 基础阈值
        let threshold = this.vadThreshold;
        
        // 根据环境噪音调整阈值
        if (stats.avgNoise > 0) {
            threshold = Math.max(threshold, stats.avgNoise * 2.5); // 阈值至少是噪音的2.5倍
        }
        
        // 限制阈值范围
        threshold = Math.max(0.001, Math.min(0.02, threshold));
        
        return threshold;
    }
    
    /**
     * 检测打断意图
     */
    detectInterruption() {
        const now = Date.now();
        
        // 检查冷却时间
        if (now - this.lastInterruptTime < this.interruptCooldown) {
            return;
        }
        
        // 检查打断阈值
        if (this.currentVadLevel > this.interruptThreshold) {
            // 设置延迟打断，避免误触发
            if (this.pendingInterrupt) {
                clearTimeout(this.pendingInterrupt);
            }
            
            this.pendingInterrupt = setTimeout(() => {
                this.executeInterruption('auto');
                this.pendingInterrupt = null;
            }, this.interruptDelay);
            
            console.log('语音通话管理器 - 检测到打断意图，延迟执行');
        }
    }
    
    /**
     * 执行打断操作
     */
    executeInterruption(type = 'auto') {
        if (!this.isAIResponding) {
            return;
        }
        
        const now = Date.now();
        this.lastInterruptTime = now;
        
        console.log(`语音通话管理器 - 执行${type === 'auto' ? '自动' : '手动'}打断`);
        
        // 1. 立即停止AI音频播放
        this.stopAIAudioPlayback();
        
        // 2. 清理音频队列和缓冲区
        this.clearAudioBuffers();
        
        // 3. 中断服务器端连接
        this.interruptServerConnection();
        
        // 4. 更新UI状态
        this.updateInterruptionUI(type);
        
        // 5. 重置AI回复状态
        this.isAIResponding = false;
        
        // 6. 触发打断事件
        this.dispatchInterruptEvent(type);
    }
    
    /**
     * 停止AI音频播放
     */
    stopAIAudioPlayback() {
        // 停止所有正在播放的音频源
        if (this.azureVoiceChat && this.azureVoiceChat.audioSources) {
            this.azureVoiceChat.audioSources.forEach(source => {
                try {
                    source.stop();
                    console.log('语音通话管理器 - 停止音频源播放');
                } catch (e) {
                    // 忽略已停止的音频源
                }
            });
            this.azureVoiceChat.audioSources = [];
        }
        
        // 重置播放时间
        if (this.azureVoiceChat) {
            this.azureVoiceChat.lastPlayTime = 0;
        }
    }
    
    /**
     * 清理音频队列和缓冲区
     */
    clearAudioBuffers() {
        if (this.azureVoiceChat) {
            // 清理音频队列
            this.azureVoiceChat.audioQueue = [];
            
            // 清理音频数据缓存
            this.azureVoiceChat.allAudioData = [];
            
            // 重置流式音频状态
            this.azureVoiceChat.isStreamingAudio = false;
            
            console.log('语音通话管理器 - 清理音频缓冲区完成');
        }
    }
    
    /**
     * 中断服务器端连接
     */
    interruptServerConnection() {
        if (this.azureVoiceChat && this.azureVoiceChat.ws && 
            this.azureVoiceChat.ws.readyState === WebSocket.OPEN) {
            
            // 发送打断信号到服务器
            this.azureVoiceChat.ws.send(JSON.stringify({
                type: 'interrupt_request',
                timestamp: Date.now(),
                session_id: this.azureVoiceChat.currentSessionId,
                reason: 'user_speech_detected'
            }));
            
            console.log('语音通话管理器 - 发送打断信号到服务器');
        }
    }
    
    /**
     * 更新打断UI状态
     */
    updateInterruptionUI(type) {
        // 更新状态显示
        this.updateVoiceStatus('已打断AI回复', 'interrupted');
        
        // 隐藏打断按钮
        this.hideInterruptButton();
        
        // 显示打断反馈
        this.showInterruptionFeedback(type);
        
        // 更新动画状态
        if (this.voiceAnimationContainer) {
            this.voiceAnimationContainer.classList.add('interrupted');
            setTimeout(() => {
                this.voiceAnimationContainer.classList.remove('interrupted');
            }, 1000);
        }
    }
    
    /**
     * 显示打断反馈
     */
    showInterruptionFeedback(type) {
        // 创建打断提示
        const feedback = document.createElement('div');
        feedback.className = 'interruption-feedback';
        feedback.innerHTML = `
            <div class="feedback-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h12v12H6z"/>
                </svg>
                <span>${type === 'auto' ? '检测到您的声音，已停止AI回复' : '已手动停止AI回复'}</span>
            </div>
        `;
        
        // 添加到界面
        if (this.voiceCallFullscreen) {
            this.voiceCallFullscreen.appendChild(feedback);
            
            // 3秒后自动移除
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 3000);
        }
    }
    
    /**
     * 手动打断
     */
    manualInterrupt() {
        if (this.isAIResponding) {
            this.executeInterruption('manual');
        }
    }
    
    /**
     * AI开始回复事件
     */
    onAIResponseStart() {
        this.isAIResponding = true;
        this.showInterruptButton();
        console.log('语音通话管理器 - AI开始回复，启用打断机制');
    }
    
    /**
     * AI回复结束事件
     */
    onAIResponseEnd() {
        this.isAIResponding = false;
        this.hideInterruptButton();
        
        // 清除待处理的打断
        if (this.pendingInterrupt) {
            clearTimeout(this.pendingInterrupt);
            this.pendingInterrupt = null;
        }
        
        console.log('语音通话管理器 - AI回复结束，禁用打断机制');
    }
    
    /**
     * 音频播放开始事件
     */
    onAudioPlaybackStart() {
        this.isAIResponding = true;
        this.showInterruptButton();
    }
    
    /**
     * 音频播放结束事件
     */
    onAudioPlaybackEnd() {
        this.isAIResponding = false;
        this.hideInterruptButton();
    }
    
    /**
     * 显示打断按钮
     */
    showInterruptButton() {
        if (this.voiceInterruptBtn && this.interruptionEnabled) {
            this.voiceInterruptBtn.style.display = 'flex';
            this.voiceInterruptBtn.classList.add('show');
        }
    }
    
    /**
     * 隐藏打断按钮
     */
    hideInterruptButton() {
        if (this.voiceInterruptBtn) {
            this.voiceInterruptBtn.style.display = 'none';
            this.voiceInterruptBtn.classList.remove('show');
        }
    }
    
    /**
     * 触发打断事件
     */
    dispatchInterruptEvent(type) {
        const event = new CustomEvent('voiceInterruption', {
            detail: {
                type: type,
                timestamp: Date.now(),
                vadLevel: this.currentVadLevel
            }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * 启用/禁用打断功能
     */
    toggleInterruption(enabled) {
        this.interruptionEnabled = enabled;
        
        if (!enabled) {
            this.hideInterruptButton();
            
            // 清除待处理的打断
            if (this.pendingInterrupt) {
                clearTimeout(this.pendingInterrupt);
                this.pendingInterrupt = null;
            }
        }
        
        console.log(`语音通话管理器 - 打断功能${enabled ? '启用' : '禁用'}`);
    }
    
    /**
     * 设置打断参数
     */
    setInterruptionParams(params) {
        if (params.threshold !== undefined) {
            this.interruptThreshold = params.threshold;
        }
        if (params.delay !== undefined) {
            this.interruptDelay = params.delay;
        }
        if (params.cooldown !== undefined) {
            this.interruptCooldown = params.cooldown;
        }
        
        console.log('语音通话管理器 - 更新打断参数:', params);
    }
    
    /**
     * 语音开始事件 - 增强打断检测
     */
    onSpeechStart() {
        this.speechStartTime = Date.now();
        this.audioChunks = []; // 重置音频缓冲区
        
        // 清除静音超时
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null;
        }
        
        // 如果AI正在回复且启用了打断，立即检测打断
        if (this.interruptionEnabled && this.isAIResponding) {
            this.detectInterruption();
        }
        
        // 更新UI状态
        this.updateVoiceStatus('正在聆听...', 'listening');
        
        console.log('语音通话管理器 - 检测到语音开始');
    }
    
    /**
     * 语音结束事件
     */
    onSpeechEnd() {
        const speechDuration = Date.now() - this.speechStartTime;
        
        // 只有当语音持续时间足够长时才处理
        if (speechDuration >= this.minSpeechDuration && this.audioChunks.length > 0) {
            // 设置静音超时，延迟发送音频数据
            this.silenceTimeout = setTimeout(() => {
                this.sendAudioChunks();
                this.updateVoiceStatus('处理中...', 'processing');
            }, 500); // 500ms静音后发送
        }
        
        console.log(`语音通话管理器 - 检测到语音结束，持续时间: ${speechDuration}ms`);
    }
    
    /**
     * 处理音频块
     */
    processAudioChunk(audioData) {
        // 将Float32Array转换为Int16Array（PCM格式）
        const pcmData = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            // 限制在-1到1之间，然后转换为16位整数
            const sample = Math.max(-1, Math.min(1, audioData[i]));
            pcmData[i] = sample * 0x7FFF;
        }
        
        // 添加到音频缓冲区
        this.audioChunks.push(pcmData);
        
        // 限制缓冲区大小，避免内存过度使用
        const maxChunks = 100; // 最多保留100个音频块
        if (this.audioChunks.length > maxChunks) {
            // 移除最旧的音频块
            this.audioChunks.shift();
            console.debug('语音通话管理器 - 音频缓冲区已满，移除最旧的音频块');
        }
        
        // 检查总音频数据大小
        const totalSamples = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const maxTotalSamples = 1024 * 1024; // 1M samples (2MB)
        
        if (totalSamples > maxTotalSamples) {
            // 如果总数据量过大，移除一半的旧数据
            const chunksToRemove = Math.floor(this.audioChunks.length / 2);
            this.audioChunks.splice(0, chunksToRemove);
            console.debug(`语音通话管理器 - 音频数据过大，移除 ${chunksToRemove} 个旧音频块`);
        }
    }
    
    /**
     * 发送音频块到服务器
     */
    async sendAudioChunks() {
        if (this.audioChunks.length === 0) {
            return;
        }
        
        try {
            // 合并所有音频块
            const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            
            // 限制单次发送的音频数据大小（最大1MB）
            const maxAudioSize = 1024 * 1024 / 2; // 512K samples (1MB bytes)
            if (totalLength > maxAudioSize) {
                console.warn(`语音通话管理器 - 音频数据过大 (${totalLength} samples)，截取前 ${maxAudioSize} samples`);
                // 只保留最新的音频数据
                let currentLength = 0;
                const filteredChunks = [];
                
                for (let i = this.audioChunks.length - 1; i >= 0; i--) {
                    const chunk = this.audioChunks[i];
                    if (currentLength + chunk.length <= maxAudioSize) {
                        filteredChunks.unshift(chunk);
                        currentLength += chunk.length;
                    } else {
                        break;
                    }
                }
                
                this.audioChunks = filteredChunks;
            }
            
            const mergedAudio = new Int16Array(this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0));
            
            let offset = 0;
            for (const chunk of this.audioChunks) {
                mergedAudio.set(chunk, offset);
                offset += chunk.length;
            }
            
            // 使用更高效的base64转换方式
            const uint8Array = new Uint8Array(mergedAudio.buffer);
            let base64Audio;
            
            try {
                // 尝试使用现代浏览器的高效方法
                if (typeof FileReader !== 'undefined' && uint8Array.length > 32768) {
                    // 对于大数据使用 FileReader (异步但更高效)
                    base64Audio = await this.arrayBufferToBase64(uint8Array.buffer);
                } else {
                    // 对于小数据使用分块处理
                    base64Audio = this.uint8ArrayToBase64(uint8Array);
                }
            } catch (conversionError) {
                console.warn('语音通话管理器 - base64转换失败，使用备用方法:', conversionError);
                base64Audio = this.uint8ArrayToBase64(uint8Array);
            }
            
            // 发送到服务器
            if (this.azureVoiceChat.ws && this.azureVoiceChat.ws.readyState === WebSocket.OPEN) {
                this.azureVoiceChat.ws.send(JSON.stringify({
                    type: 'voice_input',
                    audio_data: base64Audio,
                    audio_format: 'pcm_s16le',
                    sample_rate: this.sampleRate,
                    channels: 1,
                    session_id: this.azureVoiceChat.currentSessionId,
                    vad_confidence: this.currentVadLevel
                }));
                
                console.log(`语音通话管理器 - 发送音频数据，长度: ${mergedAudio.length} samples (${(mergedAudio.length * 2 / 1024).toFixed(1)}KB), VAD置信度: ${this.currentVadLevel.toFixed(3)}`);
            }
            
            // 清空缓冲区
            this.audioChunks = [];
            
        } catch (error) {
            console.error('语音通话管理器 - 发送音频数据失败:', error);
            
            // 清空缓冲区，避免重复错误
            this.audioChunks = [];
        }
    }
    
    /**
     * 将Uint8Array转换为base64字符串（分块处理）
     */
    uint8ArrayToBase64(uint8Array) {
        let binaryString = '';
        const chunkSize = 8192; // 8KB chunks
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, chunk);
        }
        
        return btoa(binaryString);
    }
    
    /**
     * 将ArrayBuffer转换为base64字符串（异步方法）
     */
    arrayBufferToBase64(buffer) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([buffer]);
            const reader = new FileReader();
            
            reader.onload = () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            
            reader.onerror = () => {
                reject(new Error('FileReader转换失败'));
            };
            
            reader.readAsDataURL(blob);
        });
    }
    
    /**
     * 开始录音 - FastRTC增强版
     */
    async startRecording() {
        if (!this.audioStream) {
            throw new Error('音频流未初始化');
        }
        
        try {
            // 使用FastRTC音频处理管道，不再使用MediaRecorder
            this.isRecording = true;
            
            // 启动音频上下文（如果被暂停）
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            console.log('语音通话管理器 - FastRTC增强录音开始');
            
        } catch (error) {
            console.error('语音通话管理器 - 开始录音失败:', error);
            throw new Error('无法开始录音: ' + error.message);
        }
    }
    
    /**
     * 更新语音可视化
     */
    updateVoiceVisualization(vadLevel) {
        // 更新动画容器的缩放
        if (this.voiceAnimationContainer) {
            let scaleClass = 'scale-small';
            
            if (vadLevel > 0.1) {
                scaleClass = 'scale-xlarge';
            } else if (vadLevel > 0.05) {
                scaleClass = 'scale-large';
            } else if (vadLevel > 0.02) {
                scaleClass = 'scale-medium';
            }
            
            // 移除所有缩放类
            this.voiceAnimationContainer.classList.remove('scale-small', 'scale-medium', 'scale-large', 'scale-xlarge');
            // 添加新的缩放类
            this.voiceAnimationContainer.classList.add(scaleClass);
        }
        
        // 更新波形可视化
        this.updateWaveVisualization(vadLevel * 100); // 转换为0-100范围
    }
    
    /**
     * 开始语音通话
     */
    async startVoiceCall() {
        try {
            console.log('语音通话管理器 - 开始语音通话');
            
            // 检查WebSocket连接状态
            if (!this.azureVoiceChat.ws || this.azureVoiceChat.ws.readyState !== WebSocket.OPEN) {
                this.showError('请等待连接建立后再开始语音通话');
                return;
            }
            
            // 请求麦克风权限
            await this.requestMicrophonePermission();
            
            // 显示全屏语音界面
            this.showVoiceCallInterface();
            
            // 开始录音
            await this.startRecording();
            
            // 开始计时
            this.startCallTimer();
            
            // 更新状态
            this.updateVoiceStatus('正在聆听您的声音...', 'listening');
            
            // 启动语音可视化
            this.startVoiceVisualization();
            
        } catch (error) {
            console.error('语音通话管理器 - 开始语音通话失败:', error);
            this.showError('无法开始语音通话: ' + error.message);
        }
    }
    
    /**
     * 显示语音通话界面
     */
    showVoiceCallInterface() {
        if (this.voiceCallFullscreen) {
            // 直接显示，CSS动画会自动触发
            this.voiceCallFullscreen.style.display = 'flex';
            
            // 移除hiding类（如果存在）
            this.voiceCallFullscreen.classList.remove('hiding');
        }
        
        // 启动Lottie动画
        if (this.voiceLottiePlayer) {
            this.voiceLottiePlayer.play();
        }
        
        console.log('语音通话管理器 - 显示语音通话界面');
    }
    
    /**
     * 隐藏语音通话界面
     */
    hideVoiceCallInterface() {
        if (this.voiceCallFullscreen) {
            // 添加hiding类触发隐藏动画
            this.voiceCallFullscreen.classList.add('hiding');
            
            // 等待动画完成后隐藏元素
            setTimeout(() => {
                this.voiceCallFullscreen.style.display = 'none';
                this.voiceCallFullscreen.classList.remove('hiding');
            }, 300);
        }
        
        // 停止Lottie动画
        if (this.voiceLottiePlayer) {
            this.voiceLottiePlayer.pause();
        }
        
        console.log('语音通话管理器 - 隐藏语音通话界面');
    }
    
    /**
     * 开始通话计时
     */
    startCallTimer() {
        this.callStartTime = Date.now();
        
        this.callTimer = setInterval(() => {
            const elapsed = Date.now() - this.callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // 更新全屏界面计时器
            if (this.voiceTimer) {
                this.voiceTimer.textContent = timeString;
            }
            
            // 更新弹窗界面计时器
            if (this.callTimer2) {
                this.callTimer2.textContent = timeString;
            }
            
        }, 1000);
        
        console.log('语音通话管理器 - 开始通话计时');
    }
    
    /**
     * 停止通话计时
     */
    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        
        console.log('语音通话管理器 - 停止通话计时');
    }
    
    /**
     * 更新语音状态显示
     */
    updateVoiceStatus(text, status = '') {
        // 更新全屏界面状态
        if (this.voiceStatusDisplay) {
            this.voiceStatusDisplay.textContent = text;
        }
        
        // 更新弹窗界面状态
        if (this.voiceStatusText) {
            this.voiceStatusText.textContent = text;
        }
        
        if (this.callStatus) {
            this.callStatus.textContent = text;
        }
        
        console.log('语音通话管理器 - 更新状态:', text, status);
    }
    
    /**
     * 切换静音状态
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        
        // 更新按钮图标
        if (this.voiceMuteBtn) {
            const micIcon = this.voiceMuteBtn.querySelector('.mic-icon');
            const micOffIcon = this.voiceMuteBtn.querySelector('.mic-off-icon');
            
            if (this.isMuted) {
                if (micIcon) micIcon.style.display = 'none';
                if (micOffIcon) micOffIcon.style.display = 'block';
                this.voiceMuteBtn.classList.add('muted');
                this.updateVoiceStatus('已静音', 'muted');
            } else {
                if (micIcon) micIcon.style.display = 'block';
                if (micOffIcon) micOffIcon.style.display = 'none';
                this.voiceMuteBtn.classList.remove('muted');
                this.updateVoiceStatus('正在聆听您的声音...', 'listening');
            }
        }
        
        console.log('语音通话管理器 - 切换静音状态:', this.isMuted);
    }
    
    /**
     * 最小化通话窗口
     */
    minimizeCall() {
        // 隐藏弹窗界面，显示最小化指示器
        if (this.voiceCallOverlay) {
            this.voiceCallOverlay.style.display = 'none';
        }
        
        // 可以在这里添加最小化指示器的逻辑
        console.log('语音通话管理器 - 最小化通话窗口');
    }
    
    /**
     * 开始语音可视化
     */
    startVoiceVisualization() {
        if (!this.audioStream || !this.audioContext) {
            return;
        }
        
        try {
            // 创建音频分析器
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            
            // 开始可视化动画
            this.animateVoiceVisualization();
            
            console.log('语音通话管理器 - 开始语音可视化');
            
        } catch (error) {
            console.error('语音通话管理器 - 语音可视化启动失败:', error);
        }
    }
    
    /**
     * 语音可视化动画
     */
    animateVoiceVisualization() {
        if (!this.analyser) {
            return;
        }
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const animate = () => {
            if (!this.isRecording) {
                return;
            }
            
            this.analyser.getByteFrequencyData(dataArray);
            
            // 计算音量级别
            const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
            const volumeLevel = average / 255;
            
            // 更新波形可视化
            this.updateWaveVisualization(volumeLevel * 100);
            
            // 更新Lottie动画速度
            if (this.voiceLottiePlayer && volumeLevel > 0.1) {
                this.voiceLottiePlayer.setSpeed(1 + volumeLevel * 2);
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    /**
     * 更新波形可视化
     */
    updateWaveVisualization(volumeLevel) {
        // 更新弹窗界面的波形
        if (this.voiceVisualizer) {
            const waveBars = this.voiceVisualizer.querySelectorAll('.wave-bar');
            waveBars.forEach((bar, index) => {
                const height = Math.random() * volumeLevel * 100 + 10;
                bar.style.height = `${height}%`;
                bar.style.animationDelay = `${index * 0.1}s`;
            });
        }
    }
    
    /**
     * 停止语音可视化
     */
    stopVoiceVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        console.log('语音通话管理器 - 停止语音可视化');
    }
    
    /**
     * 结束语音通话 - 增强版，包含打断机制清理
     */
    async endVoiceCall() {
        try {
            console.log('语音通话管理器 - 结束语音通话');
            
            // 清理打断机制
            this.cleanupInterruptionSystem();
            
            // 停止录音
            this.stopRecording();
            
            // 停止计时
            this.stopCallTimer();
            
            // 停止可视化
            this.stopVoiceVisualization();
            
            // 清理FastRTC音频处理管道
            this.cleanupFastRTCAudioPipeline();
            
            // 释放音频流
            this.releaseAudioStream();
            
            // 隐藏界面
            this.hideVoiceCallInterface();
            
            // 重置状态
            this.resetCallState();
            
            // 更新UI状态
            this.updateVoiceStatus('通话已结束', '');
            
        } catch (error) {
            console.error('语音通话管理器 - 结束语音通话失败:', error);
            this.showError('结束通话时发生错误');
        }
    }
    
    /**
     * 清理打断系统
     */
    cleanupInterruptionSystem() {
        // 清除待处理的打断
        if (this.pendingInterrupt) {
            clearTimeout(this.pendingInterrupt);
            this.pendingInterrupt = null;
        }
        
        // 重置打断状态
        this.isAIResponding = false;
        this.lastInterruptTime = 0;
        
        // 隐藏打断按钮
        this.hideInterruptButton();
        
        // 清理音频缓冲区
        this.clearAudioBuffers();
        
        console.log('语音通话管理器 - 打断系统清理完成');
    }
    
    /**
     * 停止录音 - FastRTC增强版
     */
    stopRecording() {
        this.isRecording = false;
        
        // 清除静音超时
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null;
        }
        
        // 发送剩余的音频数据
        if (this.audioChunks.length > 0) {
            this.sendAudioChunks();
        }
        
        // 停止MediaRecorder（如果存在）
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        console.log('语音通话管理器 - FastRTC增强录音停止');
    }
    
    /**
     * 清理FastRTC音频处理管道
     */
    cleanupFastRTCAudioPipeline() {
        try {
            // 断开音频处理器连接
            if (this.audioProcessor) {
                this.audioProcessor.disconnect();
                this.audioProcessor.onaudioprocess = null;
                this.audioProcessor = null;
            }
            
            // 断开分析器连接
            if (this.analyser) {
                this.analyser.disconnect();
                this.analyser = null;
            }
            
            // 断开增益节点
            if (this.gainNode) {
                this.gainNode.disconnect();
                this.gainNode = null;
            }
            
            // 断开压缩器节点
            if (this.compressorNode) {
                this.compressorNode.disconnect();
                this.compressorNode = null;
            }
            
            // 清理VAD相关状态
            this.currentVadLevel = 0;
            this.isSpeaking = false;
            this.speechStartTime = null;
            this.audioChunks = [];
            
            console.log('语音通话管理器 - FastRTC音频处理管道清理完成');
            
        } catch (error) {
            console.error('语音通话管理器 - 清理FastRTC音频处理管道失败:', error);
        }
    }
    
    /**
     * 释放音频流 - FastRTC增强版
     */
    releaseAudioStream() {
        if (this.audioStream) {
            // 停止所有音频轨道
            this.audioStream.getTracks().forEach(track => {
                track.stop();
                console.log('语音通话管理器 - 音频轨道已停止:', track.kind);
            });
            this.audioStream = null;
        }
        
        // 关闭音频上下文（可选，根据需要）
        if (this.audioContext && this.audioContext.state !== 'closed') {
            // 暂停而不是关闭，以便后续重用
            this.audioContext.suspend();
        }
        
        console.log('语音通话管理器 - FastRTC音频流释放完成');
    }
    
    /**
     * 重置通话状态 - 增强版
     */
    resetCallState() {
        this.isRecording = false;
        this.isMuted = false;
        this.callStartTime = null;
        this.audioChunks = [];
        this.currentVadLevel = 0;
        this.isSpeaking = false;
        this.speechStartTime = null;
        
        // 重置打断机制状态
        this.isAIResponding = false;
        this.lastInterruptTime = 0;
        this.pendingInterrupt = null;
        
        // 清除所有超时
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null;
        }
        
        if (this.pendingInterrupt) {
            clearTimeout(this.pendingInterrupt);
            this.pendingInterrupt = null;
        }
        
        console.log('语音通话管理器 - 通话状态重置完成');
    }
    
    /**
     * 获取FastRTC音频质量统计
     */
    getAudioQualityStats() {
        return {
            sampleRate: this.sampleRate,
            bitDepth: this.bitDepth,
            vadThreshold: this.vadThreshold,
            currentVadLevel: this.currentVadLevel,
            isSpeaking: this.isSpeaking,
            audioChunksCount: this.audioChunks.length,
            audioContextState: this.audioContext ? this.audioContext.state : 'not_initialized'
        };
    }
    
    /**
     * 显示错误信息
     */
    showError(message) {
        console.error('语音通话管理器 - 错误:', message);
        
        // 可以在这里添加错误提示UI
        alert(message);
        
        // 更新状态显示
        this.updateVoiceStatus('发生错误: ' + message, 'error');
    }
    
    /**
     * 检查浏览器兼容性
     */
    checkBrowserSupport() {
        const support = {
            mediaDevices: !!navigator.mediaDevices,
            getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            mediaRecorder: !!window.MediaRecorder,
            audioContext: !!(window.AudioContext || window.webkitAudioContext),
            webSocket: !!window.WebSocket
        };
        
        const unsupported = Object.keys(support).filter(key => !support[key]);
        
        if (unsupported.length > 0) {
            console.warn('语音通话管理器 - 浏览器不支持以下功能:', unsupported);
            return false;
        }
        
        console.log('语音通话管理器 - 浏览器兼容性检查通过');
        return true;
    }
    
    /**
     * 获取通话状态
     */
    getCallStatus() {
        return {
            isRecording: this.isRecording,
            isMuted: this.isMuted,
            callDuration: this.callStartTime ? Date.now() - this.callStartTime : 0,
            hasAudioStream: !!this.audioStream
        };
    }
}

// 导出类以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceCallManager;
} 