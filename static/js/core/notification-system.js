/**
 * 统一提醒UI系统
 * 替换浏览器原生的alert和confirm弹窗
 */

class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.notificationId = 0;
        this.init();
    }

    /**
     * 初始化通知系统
     */
    init() {
        // 创建通知容器
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }

    /**
     * 显示通知
     * @param {string} type - 通知类型 (success, error, warning, info)
     * @param {string} title - 标题
     * @param {string} message - 消息内容
     * @param {Object} options - 配置选项
     */
    show(type = 'info', title = '', message = '', options = {}) {
        const config = {
            duration: 5000,
            closable: true,
            showProgress: true,
            position: 'top-right',
            ...options
        };

        const id = ++this.notificationId;
        const notification = this.createNotification(id, type, title, message, config);
        
        this.notifications.set(id, {
            element: notification,
            config: config,
            timer: null
        });

        this.container.appendChild(notification);
        
        // 触发进入动画
        requestAnimationFrame(() => {
            notification.classList.add('entering');
        });

        // 设置自动关闭
        if (config.duration > 0) {
            this.setAutoClose(id, config.duration);
        }

        return id;
    }

    /**
     * 创建通知元素
     */
    createNotification(id, type, title, message, config) {
        const notification = document.createElement('div');
        notification.className = `notification-item ${type}`;
        notification.dataset.id = id;

        const icon = this.getIcon(type);
        
        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">
                    <div class="notification-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    ${title}
                </div>
                ${config.closable ? `
                    <button class="notification-close" onclick="window.notificationSystem.close(${id})">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </div>
            ${message ? `<div class="notification-content">${message}</div>` : ''}
            ${config.showProgress && config.duration > 0 ? `
                <div class="notification-progress" style="width: 100%"></div>
            ` : ''}
        `;

        return notification;
    }

    /**
     * 获取图标
     */
    getIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    /**
     * 设置自动关闭
     */
    setAutoClose(id, duration) {
        const notificationData = this.notifications.get(id);
        if (!notificationData) return;

        const progressBar = notificationData.element.querySelector('.notification-progress');
        
        if (progressBar) {
            // 动画进度条
            progressBar.style.transition = `width ${duration}ms linear`;
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });
        }

        notificationData.timer = setTimeout(() => {
            this.close(id);
        }, duration);
    }

    /**
     * 关闭通知
     */
    close(id) {
        const notificationData = this.notifications.get(id);
        if (!notificationData) return;

        const { element, timer } = notificationData;
        
        // 清除定时器
        if (timer) {
            clearTimeout(timer);
        }

        // 播放退出动画
        element.classList.remove('entering');
        element.classList.add('leaving');

        // 动画结束后移除元素
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.notifications.delete(id);
        }, 300);
    }

    /**
     * 清除所有通知
     */
    clearAll() {
        this.notifications.forEach((_, id) => {
            this.close(id);
        });
    }

    /**
     * 成功通知
     */
    success(title, message = '', options = {}) {
        return this.show('success', title, message, options);
    }

    /**
     * 错误通知
     */
    error(title, message = '', options = {}) {
        return this.show('error', title, message, { duration: 0, ...options });
    }

    /**
     * 警告通知
     */
    warning(title, message = '', options = {}) {
        return this.show('warning', title, message, { duration: 8000, ...options });
    }

    /**
     * 信息通知
     */
    info(title, message = '', options = {}) {
        return this.show('info', title, message, options);
    }

    /**
     * 确认对话框
     * @param {string} title - 标题
     * @param {string} message - 消息内容
     * @param {Object} options - 配置选项
     * @returns {Promise<boolean>} - 用户选择结果
     */
    confirm(title = '确认操作', message = '', options = {}) {
        return new Promise((resolve) => {
            const config = {
                type: 'warning',
                confirmText: '确认',
                cancelText: '取消',
                danger: false,
                ...options
            };

            const overlay = this.createConfirmDialog(title, message, config, resolve);
            document.body.appendChild(overlay);

            // 触发显示动画
            requestAnimationFrame(() => {
                const dialog = overlay.querySelector('.confirm-dialog');
                dialog.classList.add('show');
            });
        });
    }

    /**
     * 创建确认对话框
     */
    createConfirmDialog(title, message, config, resolve) {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        
        const dialogType = config.danger ? 'danger' : config.type;
        const icon = config.danger ? 'fa-exclamation-triangle' : this.getIcon(config.type);
        
        overlay.innerHTML = `
            <div class="confirm-dialog ${dialogType}">
                <div class="confirm-dialog-header">
                    <h3 class="confirm-dialog-title">
                        <div class="confirm-dialog-icon">
                            <i class="fas ${icon}"></i>
                        </div>
                        ${title}
                    </h3>
                </div>
                <div class="confirm-dialog-body">
                    <p class="confirm-dialog-message">${message}</p>
                </div>
                <div class="confirm-dialog-actions">
                    <button class="confirm-dialog-btn secondary" data-action="cancel">
                        ${config.cancelText}
                    </button>
                    <button class="confirm-dialog-btn ${config.danger ? 'danger' : 'primary'}" data-action="confirm">
                        ${config.confirmText}
                    </button>
                </div>
            </div>
        `;

        // 绑定事件
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeConfirmDialog(overlay, resolve, false);
            }
        });

        overlay.querySelectorAll('.confirm-dialog-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.closeConfirmDialog(overlay, resolve, action === 'confirm');
            });
        });

        // ESC键关闭
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                this.closeConfirmDialog(overlay, resolve, false);
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);

        return overlay;
    }

    /**
     * 关闭确认对话框
     */
    closeConfirmDialog(overlay, resolve, result) {
        const dialog = overlay.querySelector('.confirm-dialog');
        dialog.classList.remove('show');
        
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            resolve(result);
        }, 300);
    }
}

// 创建全局实例
window.notificationSystem = new NotificationSystem();

// 兼容性函数 - 替换原生alert和confirm
window.showAlert = function(message, title = '提示') {
    return window.notificationSystem.info(title, message);
};

window.showConfirm = function(message, title = '确认操作') {
    return window.notificationSystem.confirm(title, message);
};

// 增强的showNotification函数
window.showNotification = function(title, message, type = 'info', duration = 5000) {
    const options = duration > 0 ? { duration } : { duration: 0 };
    return window.notificationSystem.show(type, title, message, options);
};

// 便捷方法 - 直接替换alert和confirm的使用
window.alert = function(message) {
    console.warn('使用了原生alert，建议使用NotificationSystem');
    return window.notificationSystem.info('提示', message, { duration: 0 });
};

window.confirm = function(message) {
    console.warn('使用了原生confirm，建议使用NotificationSystem.confirm');
    return window.notificationSystem.confirm('确认操作', message);
};

// 特殊类型的通知方法
window.notificationSystem.toast = function(message, type = 'info') {
    return this.show(type, '', message, {
        duration: 3000,
        showProgress: false,
        closable: false
    });
};

window.notificationSystem.persistent = function(type, title, message) {
    return this.show(type, title, message, {
        duration: 0,
        closable: true
    });
};

// 批量操作方法
window.notificationSystem.confirmDelete = function(itemName = '此项') {
    return this.confirm(
        '确认删除',
        `确定要删除${itemName}吗？此操作不可恢复。`,
        {
            danger: true,
            confirmText: '删除',
            cancelText: '取消'
        }
    );
};

window.notificationSystem.confirmClear = function(itemName = '所有数据') {
    return this.confirm(
        '确认清空',
        `确定要清空${itemName}吗？此操作不可恢复。`,
        {
            danger: true,
            confirmText: '清空',
            cancelText: '取消'
        }
    );
};

// 网络状态通知
window.notificationSystem.networkOnline = function() {
    return this.success('网络连接', '网络连接已恢复', { duration: 3000 });
};

window.notificationSystem.networkOffline = function() {
    return this.warning('网络断开', '网络连接已断开，请检查网络设置', { duration: 0 });
};

// 文件操作通知
window.notificationSystem.fileUploadSuccess = function(fileName) {
    return this.success('上传成功', `文件 ${fileName} 已成功上传`, { duration: 4000 });
};

window.notificationSystem.fileUploadError = function(error) {
    return this.error('上传失败', error, { duration: 0 });
};

window.notificationSystem.fileDownloadSuccess = function(fileName) {
    return this.success('下载成功', `文件 ${fileName} 已保存`, { duration: 3000 });
};

// 操作状态通知
window.notificationSystem.operationSuccess = function(operation) {
    return this.success('操作成功', `${operation}已完成`, { duration: 3000 });
};

window.notificationSystem.operationError = function(operation, error) {
    return this.error('操作失败', `${operation}失败：${error}`, { duration: 0 });
};

// 权限相关通知
window.notificationSystem.permissionDenied = function(permission) {
    return this.warning(
        '权限被拒绝',
        `需要${permission}权限才能使用此功能，请在浏览器设置中允许权限`,
        { duration: 8000 }
    );
};

window.notificationSystem.permissionGranted = function(permission) {
    return this.success('权限已授予', `${permission}权限已获得`, { duration: 3000 });
};

// 服务状态通知
window.notificationSystem.serviceConnecting = function(serviceName) {
    return this.info('正在连接', `正在连接${serviceName}服务...`, { duration: 0 });
};

window.notificationSystem.serviceConnected = function(serviceName) {
    return this.success('连接成功', `${serviceName}服务已连接`, { duration: 3000 });
};

window.notificationSystem.serviceDisconnected = function(serviceName) {
    return this.error('连接断开', `${serviceName}服务连接已断开`, { duration: 0 });
};

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationSystem;
}
