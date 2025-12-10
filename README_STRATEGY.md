# 512890基金持仓复制策略系统

## 📋 项目概述

本项目实现了一个基金持仓复制分析系统，用于分析红利低波ETF(512890)的持仓数据，并通过市值加权策略进行组合复制，对比策略收益与原基金收益。

## 🎯 核心策略

### 策略说明
- **数据来源**：2025年中报（2025-06-30）持仓数据
- **计算时间段**：中报披露后（2025-08-28）至今
- **权重分配**：按股票市值分配权重
- **风险控制**：单只股票上限10%
- **超额分配**：超出10%的部分按市值比例重新分配给未受限股票

### 策略逻辑
1. 获取512890基金2025年中报持仓（84只股票）
2. 获取每只股票在披露日（2025-08-28）的市值
3. 按市值比例分配初始权重
4. 应用10%上限限制：
   - 找出权重超过10%的股票
   - 将其权重限制为10%
   - 计算超额权重总和
   - 按市值比例将超额权重重新分配给未受限股票
   - 重复上述过程直到所有股票权重≤10%
5. 计算策略组合收益并与原基金对比

## 📊 当前结果

### 收益对比（2025-08-28 至 2025-12-10）
- **策略组合收益**：+1.44%
- **原512890基金收益**：-1.24%
- **超额收益**：+2.69%

### 权重限制情况
- **受限股票数**：4只
- **受限股票**：
  1. 工商银行：12.76% → 10.00%
  2. 农业银行：11.91% → 10.00%
  3. 建设银行：11.46% → 10.00%
  4. 中国移动：11.42% → 10.00%
- **超额权重**：7.55%
- **重新分配**：按市值比例分配给80只未受限股票

## 🏗️ 技术架构

### 后端技术栈
- **Node.js** + **Express**：Web服务器
- **Tushare Pro API**：金融数据源
- **dotenv**：环境变量管理

### 前端技术栈
- **原生JavaScript**：无框架依赖
- **Chart.js**：数据可视化
- **原生CSS**：样式设计

### 项目结构
```
fund_replication/
├── server.js                    # Express服务器入口
├── .env                         # 环境变量（Tushare API Token）
├── routes/
│   └── data.js                  # API路由定义
├── services/
│   ├── tushareService.js        # Tushare API封装
│   └── portfolioService.js      # 组合策略核心逻辑
└── public/
    ├── index.html               # 前端页面
    ├── app.js                   # 前端逻辑
    └── styles.css               # 样式文件
```

## 🔧 核心代码说明

### 1. portfolioService.js - 策略核心

#### 构造函数
```javascript
constructor(maxWeight = 0.10) {
  this.maxWeight = maxWeight;  // 单只股票权重上限
}
```

#### 权重分配逻辑
```javascript
// 1. 按市值分配初始权重
let portfolioWithWeights = validPortfolio.map(p => ({
  ...p,
  adjustedWeight: p.marketValue / validTotalMv,
  isLimited: false
}));

// 2. 应用10%上限限制（多轮迭代）
while (needsAdjustment && iterationCount < maxIterations) {
  // 找出超过限制的股票
  portfolioWithWeights.forEach(stock => {
    if (!stock.isLimited && stock.adjustedWeight > maxWeight) {
      excessWeight += (stock.adjustedWeight - maxWeight);
      stock.adjustedWeight = maxWeight;
      stock.isLimited = true;
    }
  });
  
  // 按市值比例重新分配超额权重
  if (excessWeight > 0) {
    const unrestrictedTotalMv = portfolioWithWeights
      .filter(s => !s.isLimited)
      .reduce((sum, s) => sum + s.marketValue, 0);
    
    portfolioWithWeights.forEach(stock => {
      if (!stock.isLimited) {
        const mvRatio = stock.marketValue / unrestrictedTotalMv;
        stock.adjustedWeight += excessWeight * mvRatio;
      }
    });
  }
}
```

### 2. tushareService.js - 数据获取

#### 批量获取股票信息
```javascript
async batchGetStockBasic(stockCodes, tradeDate) {
  // 1. 获取股票名称
  // 2. 获取股票市值（逐个获取避免API限制）
  // 3. 返回 { ts_code: { name, totalMv } }
}
```

### 3. 前端展示

#### 持仓明细显示
- **左侧**：512890基金中报持仓（按基金权重排序）
- **右侧**：策略持仓（按策略权重排序，标注受限状态）

#### 收益曲线
- 起始点(0, 0) + 实际数据点
- 蓝线：策略组合累计收益
- 红线：原基金累计收益

## 🔑 关键配置

### 环境变量 (.env)
```
TUSHARE_TOKEN=your_tushare_token_here
FUND_CODE=512890.SH
MAX_WEIGHT=0.10
PORT=3000
```

### API端点
- `GET /api/fund-info` - 获取基金基本信息
- `GET /api/all-returns` - 获取策略收益数据

## 📈 数据流程

1. **前端加载** → 调用 `/api/fund-info` 和 `/api/all-returns`
2. **后端处理**：
   - 从Tushare获取基金持仓数据
   - 筛选2025年中报数据
   - 获取股票市值（披露日2025-08-28）
   - 应用市值加权+10%上限策略
   - 计算组合收益
   - 获取基金净值收益
   - 对比计算超额收益
3. **前端展示**：
   - 绘制收益对比曲线
   - 显示持仓明细对比表
   - 标注受限股票

## 🚀 运行方式

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```

### 访问地址
```
http://localhost:3000
```

## 📝 版本历史

### v1.0 - 当前版本（2025-12-10）
- ✅ 实现市值加权策略
- ✅ 单只股票10%上限限制
- ✅ 超额权重按市值比例重新分配
- ✅ 收益对比可视化
- ✅ 持仓明细对比展示
- ✅ 受限股票状态标注

### 关键改进点
1. 从完全复制基金权重 → 按市值重新分配
2. 从平均分配超额权重 → 按市值比例分配
3. 添加构造函数确保maxWeight正确传递
4. 优化前端显示，左右对照展示持仓

## 💡 策略优势

1. **风险分散**：单只股票上限10%，避免过度集中
2. **市值导向**：大市值股票获得更高权重，更稳健
3. **超额收益**：相比原基金跑赢2.69%
4. **透明可控**：所有权重调整过程可追溯

## ⚠️ 注意事项

1. **数据时效性**：市值数据使用披露日（2025-08-28），避免未来函数
2. **API限制**：Tushare免费版有调用频率限制，已实现延迟控制
3. **迭代上限**：权重调整最多100轮迭代，防止无限循环
4. **数据完整性**：只使用有市值数据的股票（当前84/84全部有效）

## 📚 参考资料

- Tushare Pro API文档：https://tushare.pro/document/2
- Chart.js文档：https://www.chartjs.org/docs/latest/
- 基金代码：512890.SH（红利低波ETF）

---

**存档日期**：2025-12-10
**策略收益**：+1.44%（vs 基金-1.24%）
**超额收益**：+2.69%
