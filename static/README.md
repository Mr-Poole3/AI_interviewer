# Static 文件目录结构说明

## 📁 目录结构

```
static/
├── index.html                          # 主页面文件
├── README.md                           # 本说明文件
├── css/                                # 样式文件目录
│   ├── style.css                       # 主样式文件
│   ├── evaluation-styles.css           # 评估结果样式
│   ├── tutorial-guide.css              # 新手引导样式
│   └── notification-system.css         # 通知系统样式
└── js/                                 # JavaScript文件目录
    ├── core/                           # 核心功能模块
    │   ├── app.js                      # 主应用逻辑
    │   ├── voice-call.js               # 语音通话功能
    │   └── notification-system.js      # 统一通知系统
    ├── modules/                        # 功能增强模块
    │   ├── smart-tips.js               # 智能提示系统
    │   ├── tutorial-guide.js           # 新手引导系统
    │   └── pdf-export.js               # PDF导出功能
    └── utils/                          # 工具函数目录（预留）
```

## 📋 文件分类说明

### 🎨 样式文件 (css/)

| 文件名 | 功能描述 | 依赖关系 |
|--------|----------|----------|
| `style.css` | 主样式文件，包含全局样式和布局 | 基础样式，被其他样式文件依赖 |
| `evaluation-styles.css` | 面试评估结果的专用样式 | 依赖主样式文件 |
| `tutorial-guide.css` | 新手引导系统的样式 | 独立样式模块 |
| `notification-system.css` | 统一通知系统的样式 | 独立样式模块 |

### ⚙️ 核心功能模块 (js/core/)

| 文件名 | 功能描述 | 依赖关系 |
|--------|----------|----------|
| `app.js` | 主应用逻辑，包含路由、数据管理等核心功能 | 依赖通知系统 |
| `voice-call.js` | 语音通话功能，处理WebRTC和Azure语音服务 | 依赖主应用和通知系统 |
| `notification-system.js` | 统一通知系统，替换原生alert/confirm | 独立模块，被其他模块依赖 |

### 🔧 功能增强模块 (js/modules/)

| 文件名 | 功能描述 | 依赖关系 |
|--------|----------|----------|
| `smart-tips.js` | 智能提示系统，提供上下文相关的帮助信息 | 依赖主应用 |
| `tutorial-guide.js` | 新手引导系统，为新用户提供功能引导 | 依赖通知系统 |
| `pdf-export.js` | PDF导出功能，支持评估报告导出 | 依赖主应用 |

### 🛠️ 工具函数 (js/utils/)

此目录预留给未来的工具函数和辅助模块。

## 🔄 加载顺序

文件在 `index.html` 中的加载顺序：

1. **CSS文件** (并行加载)
   - style.css
   - evaluation-styles.css
   - tutorial-guide.css
   - notification-system.css

2. **JavaScript文件** (按依赖顺序)
   - notification-system.js (最先加载，被其他模块依赖)
   - tutorial-guide.js
   - smart-tips.js
   - voice-call.js
   - app.js (最后加载，整合所有功能)

## 📦 模块依赖关系

```
app.js
├── notification-system.js
├── voice-call.js
│   └── notification-system.js
├── smart-tips.js
└── tutorial-guide.js
    └── notification-system.js

pdf-export.js
└── app.js
```

## 🎯 设计原则

### 1. **分离关注点**
- 样式文件按功能模块分离
- JavaScript按职责分为核心功能和增强功能

### 2. **模块化设计**
- 每个文件职责单一明确
- 模块间依赖关系清晰
- 便于维护和扩展

### 3. **可扩展性**
- 预留utils目录用于工具函数
- 模块化结构便于添加新功能
- 清晰的依赖关系便于重构

## 🔧 维护指南

### 添加新的样式文件
1. 将CSS文件放入 `css/` 目录
2. 在 `index.html` 中添加引用
3. 更新本README文件

### 添加新的JavaScript模块
1. 根据功能类型选择目录：
   - 核心功能 → `js/core/`
   - 功能增强 → `js/modules/`
   - 工具函数 → `js/utils/`
2. 在 `index.html` 中按依赖顺序添加引用
3. 更新依赖关系图

### 修改文件路径
1. 移动文件到新位置
2. 更新 `index.html` 中的引用路径
3. 检查其他文件中的相对路径引用
4. 更新本README文件

## 🚀 性能优化建议

### 1. **文件压缩**
- 生产环境建议压缩CSS和JavaScript文件
- 可以考虑合并同类型文件减少HTTP请求

### 2. **缓存策略**
- 使用版本号参数控制缓存
- 静态资源设置适当的缓存头

### 3. **按需加载**
- 考虑将非核心功能模块改为按需加载
- 使用动态import()延迟加载大型模块

## 📝 更新日志

### v1.0.0 (2024-01-01)
- 初始文件结构重组
- 按功能模块分类所有文件
- 建立清晰的依赖关系
- 更新所有文件引用路径
