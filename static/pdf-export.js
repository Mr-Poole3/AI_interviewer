/**
 * PDF导出功能模块
 * 提供markdown内容导出为PDF的功能
 */

class PDFExporter {
    constructor() {
        this.isLibrariesLoaded = false;
        this.loadPromise = null;
    }

    /**
     * 加载PDF库
     */
    async loadLibraries() {
        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = new Promise(async (resolve, reject) => {
            try {
                // 检查是否已经加载
                if (typeof window.jsPDF !== 'undefined' && typeof html2canvas !== 'undefined') {
                    this.isLibrariesLoaded = true;
                    resolve();
                    return;
                }

                console.log('开始加载PDF库...');

                // 加载jsPDF
                try {
                    await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
                    console.log('jsPDF加载成功');
                } catch (error) {
                    console.warn('主CDN失败，尝试备用CDN加载jsPDF');
                    await this.loadScript('https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js');
                    console.log('jsPDF备用CDN加载成功');
                }

                // 加载html2canvas
                try {
                    await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
                    console.log('html2canvas加载成功');
                } catch (error) {
                    console.warn('主CDN失败，尝试备用CDN加载html2canvas');
                    await this.loadScript('https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js');
                    console.log('html2canvas备用CDN加载成功');
                }

                // 等待一小段时间让库完全初始化
                await new Promise(resolve => setTimeout(resolve, 100));

                // 验证库是否正确加载
                console.log('验证库加载状态:', {
                    'window.jsPDF': typeof window.jsPDF,
                    'window.jspdf': typeof window.jspdf,
                    'window.html2canvas': typeof window.html2canvas,
                    'global html2canvas': typeof html2canvas
                });

                // 使用testLibraries方法进行验证
                const librariesReady = this.testLibraries();

                if (librariesReady) {
                    this.isLibrariesLoaded = true;
                    console.log('PDF库全部加载完成');
                    resolve();
                } else {
                    throw new Error(`库加载后仍然不可用`);
                }

            } catch (error) {
                console.error('PDF库加载失败:', error);
                reject(error);
            }
        });

        return this.loadPromise;
    }

    /**
     * 动态加载脚本
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.onload = resolve;
            script.onerror = reject;
            script.src = src;
            document.head.appendChild(script);
        });
    }

    /**
     * 导出HTML内容为PDF
     */
    async exportToPDF(element, filename = 'document.pdf') {
        try {
            console.log('开始PDF导出...');

            // 确保库已加载
            if (!this.isLibrariesLoaded) {
                console.log('库未加载，开始加载...');
                await this.loadLibraries();
            }

            // 检查库是否可用 - 使用testLibraries的结果
            const librariesReady = this.testLibraries();

            console.log('检查库可用性:', {
                'window.jsPDF': typeof window.jsPDF,
                'window.jspdf': typeof window.jspdf,
                'window.html2canvas': typeof window.html2canvas,
                'global html2canvas': typeof html2canvas,
                'librariesReady': librariesReady,
                'jsPDFRef': !!this.jsPDFRef
            });

            if (!librariesReady) {
                throw new Error(`PDF库未正确加载 - 请检查网络连接`);
            }

            // 获取正确的html2canvas引用
            const html2canvasFunc = window.html2canvas || html2canvas;

            // 显示加载提示
            const loadingDiv = this.showLoading();

            // 获取要导出的内容
            const contentElement = element.querySelector('.modal-content') || element;

            // 创建一个临时容器来渲染完整内容
            const tempContainer = document.createElement('div');
            tempContainer.style.cssText = `
                position: absolute;
                top: -9999px;
                left: -9999px;
                width: 800px;
                background: #ffffff;
                padding: 30px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                overflow: visible;
                height: auto;
                box-sizing: border-box;
                border: none;
                outline: none;
                margin: 0;
            `;

            // 克隆内容到临时容器
            const clonedContent = contentElement.cloneNode(true);

            // 移除可能影响渲染的样式
            this.cleanElementForPDF(clonedContent);

            tempContainer.appendChild(clonedContent);
            document.body.appendChild(tempContainer);

            try {
                // 等待内容完全渲染
                await new Promise(resolve => setTimeout(resolve, 100));

                // 使用html2canvas截图完整内容
                const canvas = await html2canvasFunc(tempContainer, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    width: 800,
                    height: tempContainer.scrollHeight,
                    scrollX: 0,
                    scrollY: 0,
                    removeContainer: false,
                    foreignObjectRendering: false,
                    imageTimeout: 0,
                    ignoreElements: (element) => {
                        // 忽略可能导致问题的元素
                        return element.classList && (
                            element.classList.contains('modal-overlay') ||
                            element.classList.contains('loading') ||
                            element.classList.contains('spinner')
                        );
                    }
                });

                // 创建PDF - 使用正确的引用
                let pdf;
                if (this.jsPDFRef) {
                    if (this.jsPDFRef.jsPDF) {
                        pdf = new this.jsPDFRef.jsPDF('p', 'mm', 'a4');
                    } else if (typeof this.jsPDFRef === 'function') {
                        pdf = new this.jsPDFRef('p', 'mm', 'a4');
                    } else {
                        pdf = new this.jsPDFRef.default('p', 'mm', 'a4');
                    }
                } else {
                    // 回退到传统方式
                    const { jsPDF } = window.jsPDF || window.jspdf || {};
                    pdf = new jsPDF('p', 'mm', 'a4');
                }

                // 计算PDF页面尺寸
                const imgWidth = 210; // A4宽度 (mm)
                const pageHeight = 297; // A4高度 (mm)
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                // 如果图片高度小于页面高度，直接添加
                if (imgHeight <= pageHeight) {
                    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
                } else {
                    // 图片需要分页
                    let position = 0;
                    let heightLeft = imgHeight;

                    // 第一页
                    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;

                    // 后续页面
                    while (heightLeft >= 0) {
                        position = heightLeft - imgHeight;
                        pdf.addPage();
                        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
                        heightLeft -= pageHeight;
                    }
                }

                // 下载PDF
                pdf.save(filename);

                // 移除加载提示
                this.hideLoading(loadingDiv);

                return true;

            } finally {
                // 清理临时容器
                if (tempContainer && tempContainer.parentElement) {
                    document.body.removeChild(tempContainer);
                }
            }

        } catch (error) {
            console.error('PDF导出失败:', error);
            throw error;
        }
    }

    /**
     * 显示加载提示
     */
    showLoading() {
        const loadingDiv = document.createElement('div');
        loadingDiv.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                       background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
                       z-index: 10000; text-align: center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #007bff; margin-bottom: 10px;"></i>
                <div>正在生成PDF...</div>
            </div>
        `;
        document.body.appendChild(loadingDiv);
        return loadingDiv;
    }

    /**
     * 隐藏加载提示
     */
    hideLoading(loadingDiv) {
        if (loadingDiv && loadingDiv.parentElement) {
            document.body.removeChild(loadingDiv);
        }
    }

    /**
     * 测试PDF库是否可用
     */
    testLibraries() {
        // 检查多种可能的jsPDF访问方式
        const jsPDFMethods = [
            () => window.jsPDF,
            () => window.jspdf,
            () => window.JSPDF,
            () => jsPDF,
            () => jspdf
        ];

        let jsPDFRef = null;
        let jsPDFAvailable = false;

        for (const method of jsPDFMethods) {
            try {
                const ref = method();
                if (ref && typeof ref === 'object') {
                    jsPDFRef = ref;
                    jsPDFAvailable = true;
                    console.log('找到jsPDF引用:', method.toString());
                    break;
                }
            } catch (e) {
                // 忽略错误，继续尝试下一个
            }
        }

        const html2canvasAvailable = typeof window.html2canvas !== 'undefined' || typeof html2canvas !== 'undefined';

        console.log('PDF库状态检查:');
        console.log('- window.jsPDF:', typeof window.jsPDF);
        console.log('- window.jspdf:', typeof window.jspdf);
        console.log('- window.JSPDF:', typeof window.JSPDF);
        console.log('- global jsPDF:', typeof jsPDF);
        console.log('- global jspdf:', typeof jspdf);
        console.log('- window.html2canvas:', typeof window.html2canvas);
        console.log('- global html2canvas:', typeof html2canvas);
        console.log('- jsPDFAvailable:', jsPDFAvailable);
        console.log('- html2canvasAvailable:', html2canvasAvailable);
        console.log('- isLibrariesLoaded:', this.isLibrariesLoaded);

        if (jsPDFAvailable && jsPDFRef) {
            try {
                // 尝试不同的实例化方式
                let testPdf = null;
                if (jsPDFRef.jsPDF) {
                    testPdf = new jsPDFRef.jsPDF();
                } else if (typeof jsPDFRef === 'function') {
                    testPdf = new jsPDFRef();
                } else {
                    testPdf = new jsPDFRef.default();
                }
                console.log('- jsPDF实例化测试: 成功');

                // 保存正确的引用
                this.jsPDFRef = jsPDFRef;
            } catch (e) {
                console.error('- jsPDF实例化测试: 失败', e);
                return false;
            }
        }

        return jsPDFAvailable && html2canvasAvailable;
    }

    /**
     * 清理元素样式以适合PDF渲染
     */
    cleanElementForPDF(element) {
        // 设置根元素样式
        element.style.cssText = `
            background: #ffffff !important;
            color: #333 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            line-height: 1.6 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            position: static !important;
            transform: none !important;
        `;

        // 处理所有子元素
        const allElements = element.querySelectorAll('*');
        allElements.forEach(el => {
            // 重置基本样式
            el.style.position = 'static';
            el.style.transform = 'none';
            el.style.transition = 'none';
            el.style.animation = 'none';
            el.style.overflow = 'visible';
            el.style.maxHeight = 'none';
            el.style.border = 'none';
            el.style.outline = 'none';

            // 移除可能影响布局的类
            if (el.classList) {
                el.classList.remove('modal', 'modal-overlay', 'fade-in', 'modal-content');
            }
        });

        // 特殊处理评分卡片 - 保持渐变背景
        const scoreCards = element.querySelectorAll('.evaluation-score-card');
        scoreCards.forEach(card => {
            card.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                color: white !important;
                padding: 20px !important;
                margin-bottom: 20px !important;
                border-radius: 8px !important;
                border: none !important;
                box-shadow: none !important;
                width: 100% !important;
                box-sizing: border-box !important;
                position: relative !important;
            `;

            // 强制设置评分卡片内所有元素为白色文字
            const allCardElements = card.querySelectorAll('*');
            allCardElements.forEach(el => {
                el.style.setProperty('color', '#ffffff', 'important');
                el.style.setProperty('opacity', '1', 'important');
            });

            // 特别处理常见的文本元素
            const textElements = card.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, strong, em, small');
            textElements.forEach(el => {
                el.style.setProperty('color', '#ffffff', 'important');
                el.style.setProperty('opacity', '1', 'important');
            });

            // 处理score-summary特殊样式
            const scoreSummary = card.querySelectorAll('.score-summary, .score-summary p, .score-summary span');
            scoreSummary.forEach(el => {
                el.style.setProperty('color', '#ffffff', 'important');
                el.style.setProperty('opacity', '1', 'important');
            });
        });

        // 处理标题
        const titles = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
        titles.forEach(title => {
            title.style.color = '#333';
            title.style.marginBottom = '15px';
            title.style.marginTop = '20px';
            title.style.fontWeight = 'bold';
        });

        // 处理表格
        const tables = element.querySelectorAll('table');
        tables.forEach(table => {
            table.style.cssText = `
                width: 100% !important;
                border-collapse: collapse !important;
                margin-bottom: 20px !important;
                background: white !important;
                border: 1px solid #ddd !important;
            `;
        });

        // 处理表格头部
        const tableHeaders = element.querySelectorAll('th');
        tableHeaders.forEach(th => {
            th.style.cssText = `
                background: #f8f9fa !important;
                color: #333 !important;
                padding: 12px 8px !important;
                border: 1px solid #ddd !important;
                font-weight: bold !important;
                text-align: left !important;
            `;
        });

        // 处理表格单元格
        const tableCells = element.querySelectorAll('td');
        tableCells.forEach(td => {
            td.style.cssText = `
                padding: 8px !important;
                border: 1px solid #ddd !important;
                color: #333 !important;
                background: white !important;
                text-align: left !important;
            `;
        });

        // 处理段落
        const paragraphs = element.querySelectorAll('p');
        paragraphs.forEach(p => {
            p.style.marginBottom = '10px';
            p.style.color = '#333';
            p.style.lineHeight = '1.6';
        });

        // 处理列表
        const lists = element.querySelectorAll('ul, ol');
        lists.forEach(list => {
            list.style.marginBottom = '15px';
            list.style.paddingLeft = '20px';
        });

        const listItems = element.querySelectorAll('li');
        listItems.forEach(li => {
            li.style.marginBottom = '5px';
            li.style.color = '#333';
        });
    }
}

// 创建全局实例
window.pdfExporter = new PDFExporter();

// 页面加载完成后检查库状态
document.addEventListener('DOMContentLoaded', () => {
    // 等待一下让库完全加载
    setTimeout(() => {
        console.log('检查PDF库加载状态...');
        if (window.pdfExporter) {
            const isReady = window.pdfExporter.testLibraries();
            console.log('PDF库就绪状态:', isReady);
            if (isReady) {
                window.pdfExporter.isLibrariesLoaded = true;
            }
        }
    }, 1000);
});
