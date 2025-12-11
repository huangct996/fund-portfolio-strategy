# 基金持仓复制策略系统

一个基于市值加权的基金持仓复制分析系统，用于分析红利低波ETF(512890)的持仓数据并对比策略收益。

## ✨ 特性

- 📊 基于市值加权的持仓复制策略
- 🎯 单只股票10%权重上限风险控制
- 📈 实时收益对比可视化
- 🔄 智能超额权重重新分配
- 💡 持仓明细对比展示

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并填入您的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```
TUSHARE_TOKEN=your_tushare_token_here
FUND_CODE=512890.SH
MAX_WEIGHT=0.10
PORT=3001
```

> 💡 获取 Tushare Token：访问 [Tushare Pro](https://tushare.pro/) 注册并获取API Token

### 启动服务

```bash
npm start
```

访问 `http://localhost:3001` 查看结果

## 📊 策略说明

### 核心逻辑

1. 获取基金中报持仓数据
2. 按股票市值分配初始权重
3. 应用10%上限限制
4. 超额权重按市值比例重新分配
5. 计算策略收益并与原基金对比

### 当前结果（2025-08-28 至 2025-12-10）

- **策略组合收益**：+1.44%
- **原512890基金收益**：-1.24%
- **超额收益**：+2.69%

## 🏗️ 技术栈

- **后端**：Node.js + Express
- **数据源**：Tushare Pro API
- **前端**：原生JavaScript + Chart.js
- **环境管理**：dotenv

## 📁 项目结构

```
fund_replication/
├── server.js                 # Express服务器
├── .env                      # 环境变量（不上传）
├── .env.example              # 环境变量模板
├── routes/
│   └── data.js              # API路由
├── services/
│   ├── tushareService.js    # Tushare API封装
│   └── portfolioService.js  # 策略核心逻辑
└── public/
    ├── index.html           # 前端页面
    ├── app.js              # 前端逻辑
    └── styles.css          # 样式
```

## 📡 API端点

- `GET /api/fund-info` - 获取基金基本信息
- `GET /api/all-returns` - 获取策略收益数据

## 📝 详细文档

查看 [README_STRATEGY.md](./README_STRATEGY.md) 了解完整的策略说明和技术细节。

## ⚠️ 注意事项

- 需要有效的 Tushare Pro API Token
- 免费版API有调用频率限制
- 数据仅供学习研究使用

## 📄 License

ISC
