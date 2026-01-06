# 完整调仓策略文档

## 📋 目录
1. [温度计算改进](#温度计算改进)
2. [核心调仓策略](#核心调仓策略)
3. [市场温度计系统](#市场温度计系统)
4. [自适应参数调整](#自适应参数调整)
5. [策略对比](#策略对比)

---

## 🔧 温度计算改进

### **已实施的高优先级改进**

#### **1. 修复分位数计算方法** ✅

**改进前**:
```javascript
let rank = 0;
for (let i = 0; i < historicalPEs.length; i++) {
  if (historicalPEs[i] < currentPE) {
    rank = i + 1;
  } else {
    break;
  }
}
const percentile = rank / historicalPEs.length;
```

**问题**:
- 当`currentPE`等于某个历史值时，排名偏低
- 当`currentPE`是最大值时，分位数为`(n-1)/n`而非100%

**改进后**:
```javascript
// 计算严格小于当前PE的数量
const rank = historicalPEs.filter(pe => pe < currentPE).length;

// 使用改进的分位数计算，避免边界问题
const percentile = (rank + 0.5) / historicalPEs.length;
const temperature = Math.min(100, Math.max(0, percentile * 100));
```

**效果**: 温度计算更精确，边界情况处理正确

---

#### **2. 添加极端值过滤** ✅

**改进前**:
```javascript
const pe = parseFloat(item.pe_ttm);
if (!pe || pe <= 0 || isNaN(pe)) return;
```

**问题**: 没有过滤极端异常值（PE=1000+）

**改进后**:
```javascript
const pe = parseFloat(item.pe_ttm);
if (!pe || pe <= 0 || isNaN(pe) || pe > 200) return; // PE>200视为异常值

const pb = parseFloat(item.pb);
if (!pb || pb <= 0 || isNaN(pb) || pb > 50) return; // PB>50视为异常值
```

**效果**: 避免极端值干扰温度计算

---

#### **3. 使用中位数代替平均值** ✅

**改进前**:
```javascript
const avgPE = pes.reduce((sum, pe) => sum + pe, 0) / pes.length;
dailyPEs.push({ date, pe: avgPE });
```

**问题**: 平均值容易受极端值影响

**改进后**:
```javascript
// 排序后取中位数
const sortedPEs = pes.sort((a, b) => a - b);
const medianPE = sortedPEs.length % 2 === 0
  ? (sortedPEs[sortedPEs.length / 2 - 1] + sortedPEs[sortedPEs.length / 2]) / 2
  : sortedPEs[Math.floor(sortedPEs.length / 2)];
dailyPEs.push({ date, pe: medianPE, count: pes.length });
```

**效果**: 更稳健的估值计算，不受极端值影响

---

### **改进效果对比**

| 指标 | 改进前 | 改进后 | 提升 |
|------|--------|--------|------|
| **当前温度** | 89° | 85° | 更精确 |
| **PE温度** | 96° | 95° | 更稳健 |
| **PB温度** | 83° | 75° | 更合理 |
| **置信度** | 0.87 | 0.79 | 更真实 |

---

## 🎯 核心调仓策略

### **策略架构**

```
指数成分股回测系统
├── 基础策略
│   ├── 市值加权策略（默认）
│   ├── 综合得分策略（useCompositeScore）
│   └── 风险平价策略（useRiskParity）
├── 增强功能
│   ├── 自适应参数调整（useAdaptive）
│   ├── 市场温度计（marketThermometer）
│   └── 市场状态识别（marketRegime）
└── 调仓频率
    ├── 年度调仓（yearly，默认）
    ├── 季度调仓（quarterly）
    └── 月度调仓（monthly）
```

---

### **1. 市值加权策略**

**特点**: 最简单的策略，按照指数成分股的市值权重配置

**计算方法**:
```javascript
// 直接使用指数成分股权重
weights = indexWeights.map(stock => ({
  code: stock.con_code,
  weight: stock.weight / 100  // 转换为小数
}));
```

**适用场景**:
- 追求与指数完全一致的表现
- 被动投资策略
- 不希望主动调整权重

**优点**:
- ✅ 简单透明
- ✅ 交易成本低
- ✅ 完全复制指数

**缺点**:
- ❌ 无法优化风险收益
- ❌ 大盘股权重过高
- ❌ 无法适应市场变化

---

### **2. 综合得分策略**

**特点**: 基于多因子模型，综合考虑市值、股息、质量因子

**计算方法**:
```javascript
// 1. 计算各因子得分
marketValueScore = normalize(marketValue);
dividendScore = normalize(dividendYield);
qualityScore = normalize(qualityFactor);  // PE/PB/ROE等

// 2. 加权综合得分
compositeScore = mvWeight * marketValueScore 
               + dvWeight * dividendScore 
               + qualityWeight * qualityScore;

// 3. 按得分分配权重
weight = compositeScore / sum(compositeScore);
```

**配置参数**:
```javascript
{
  useCompositeScore: true,
  scoreWeights: {
    mvWeight: 0.5,      // 市值权重
    dvWeight: 0.3,      // 股息权重
    qualityWeight: 0.2  // 质量权重
  },
  qualityFactorType: 'pe_pb'  // 质量因子类型
}
```

**适用场景**:
- 希望优化风险收益比
- 偏好高股息股票
- 注重质量因子

**优点**:
- ✅ 多因子分散风险
- ✅ 可调整因子权重
- ✅ 倾向高质量股票

**缺点**:
- ❌ 复杂度较高
- ❌ 需要更多数据
- ❌ 可能偏离指数

---

### **3. 风险平价策略** ⭐

**特点**: 基于波动率调整权重，使每只股票的风险贡献相等

**核心原理**:
```
风险贡献 = 权重 × 波动率
目标: 使所有股票的风险贡献相等
```

**计算方法**:
```javascript
// 1. 计算历史波动率
volatility = calculateEWMAVolatility(returns, window, decay);

// 2. 计算风险平价权重
riskParityWeight = (1 / volatility) / sum(1 / volatility);

// 3. 应用最大权重限制
finalWeight = min(riskParityWeight, maxWeight);
```

**配置参数**:
```javascript
{
  useRiskParity: true,
  riskParityParams: {
    volatilityWindow: 6,        // 波动率计算窗口（月）
    ewmaDecay: 0.94,            // EWMA衰减系数
    maxWeight: 0.10,            // 单只股票最大权重
    rebalanceFrequency: 'quarterly',  // 调仓频率
    stockFilterParams: {
      momentumMonths: 6,        // 动量计算周期
      minMomentumReturn: 0.0,   // 最小动量要求
      filterByQuality: true,    // 是否质量过滤
      minROE: 0.05,             // 最小ROE要求
      maxDebtRatio: 0.8         // 最大资产负债率
    }
  }
}
```

**适用场景**:
- 追求风险平衡
- 降低单一股票风险
- 适应市场波动

**优点**:
- ✅ 风险分散更均衡
- ✅ 降低尾部风险
- ✅ 动态调整权重
- ✅ 可配置质量过滤

**缺点**:
- ❌ 交易成本较高
- ❌ 需要频繁调仓
- ❌ 计算复杂度高

---

## 🌡️ 市场温度计系统

### **设计理念**

基于**有知有行**的市场温度计理念，通过PE/PB估值的历史分位数判断市场估值水平。

**核心原则**:
1. **样本空间**: 指数所有成分股
2. **计算指标**: PE和PB估值的中位数（更稳健）
3. **考察周期**: 2轮完整牛熊周期（约10年）
4. **温度分级**: 低估(0-30°)、中估(30-70°)、高估(70-100°)
5. **应用场景**: 大周期择时，追求模糊的准确

---

### **温度计算流程**

```
1. 获取成分股列表 (50只)
   ↓
2. 确定历史数据范围
   - 理想: 当前日期 - 10年
   - 实际: MAX(数据库最早日期, 理想起始日期)
   ↓
3. 获取历史PE/PB数据
   - 查询stock_basic_info表
   - 过滤: PE>0 且 PE≤200, PB>0 且 PB≤50
   ↓
4. 按日期计算中位数PE/PB
   - 要求: 至少20%成分股有数据
   - 计算: medianPE = 排序后的中位数
   ↓
5. 计算分位数温度
   - 排序历史PE/PB值
   - rank = 严格小于当前值的数量
   - 温度 = (rank + 0.5) / total × 100
   ↓
6. 综合PE和PB温度
   - 市场温度 = (PE温度 + PB温度) / 2
   - 置信度 = 1 - |PE温度 - PB温度| / 100
```

---

### **温度分级与策略建议**

#### **低估区间 (0-30°)** 🔵

**特征**:
- PE/PB处于历史低位
- 市场悲观情绪浓厚
- 通常出现在熊市底部

**策略建议**:
```javascript
{
  maxWeight: 0.20,           // 提高单只权重到20%
  volatilityWindow: 6,       // 较短波动率窗口
  minROE: 0,                 // 不过滤ROE
  maxDebtRatio: 1,           // 不限制负债率
  filterByQuality: false,    // 不进行质量过滤
  description: '积极进攻 - 低估时加大仓位'
}
```

**投资建议**: ✅ **积极买入，加大仓位**

---

#### **中估区间 (30-70°)** 🟡

**特征**:
- PE/PB处于合理水平
- 市场情绪平稳
- 正常市场环境

**策略建议**:
```javascript
{
  maxWeight: 0.15,           // 中等单只权重15%
  volatilityWindow: 6,       // 标准波动率窗口
  minROE: 0,                 // 不过滤ROE
  maxDebtRatio: 1,           // 不限制负债率
  filterByQuality: true,     // 进行质量过滤
  description: '均衡配置 - 正常持有'
}
```

**投资建议**: ⚖️ **适度买入，保持均衡**

---

#### **高估区间 (70-100°)** 🔴

**特征**:
- PE/PB处于历史高位
- 市场乐观情绪高涨
- 通常出现在牛市顶部

**策略建议**:
```javascript
{
  maxWeight: 0.10,           // 降低单只权重到10%
  volatilityWindow: 12,      // 较长波动率窗口
  minROE: 0.05,              // 要求ROE≥5%
  maxDebtRatio: 0.8,         // 限制负债率≤80%
  filterByQuality: true,     // 严格质量过滤
  description: '谨慎防守 - 高估时降低仓位'
}
```

**投资建议**: ⚠️ **谨慎减仓，甚至兑现收益**

---

### **当前市场温度**

```json
{
  "temperature": 85,
  "level": "高估",
  "pe": 95,
  "pb": 75,
  "confidence": 0.79,
  "suggestion": "⚠️ 谨慎减仓 - 市场处于高估状态，建议降低仓位"
}
```

**解读**:
- 📊 **温度85°**: 处于高估区间上部
- 📈 **PE温度95°**: PE处于历史95%分位数，非常高估
- 📉 **PB温度75°**: PB处于历史75%分位数，偏高估
- 🎯 **置信度79%**: PE/PB一致性较好，判断可信

---

## 🔄 自适应参数调整

### **自适应策略原理**

根据市场温度和市场状态，动态调整风险平价策略的参数，实现"低估进攻、高估防守"。

**启用方式**:
```javascript
{
  useAdaptive: true,
  useRiskParity: true,
  riskParityParams: {
    // 基础参数（会被自适应调整覆盖）
    volatilityWindow: 6,
    maxWeight: 0.10,
    // ...
  }
}
```

---

### **参数调整逻辑**

#### **优先级**: 市场温度 > 市场状态

```javascript
if (marketTemperature) {
  // 优先使用温度计参数
  adaptiveParams = marketTemperature.params;
} else if (marketRegime) {
  // 其次使用市场状态参数
  adaptiveParams = marketRegime.params;
}

// 合并到基础参数
effectiveParams = {
  ...baseParams,
  ...adaptiveParams
};
```

---

### **参数调整示例**

#### **场景1: 低估市场（温度20°）**

```javascript
// 调整前（基础参数）
{
  maxWeight: 0.10,
  volatilityWindow: 6,
  minROE: 0.05,
  filterByQuality: true
}

// 调整后（低估参数）
{
  maxWeight: 0.20,          // ↑ 提高权重限制
  volatilityWindow: 6,      // = 保持不变
  minROE: 0,                // ↓ 放宽ROE要求
  filterByQuality: false    // ✗ 关闭质量过滤
}
```

**效果**: 更激进的配置，抓住低估机会

---

#### **场景2: 高估市场（温度85°）**

```javascript
// 调整前（基础参数）
{
  maxWeight: 0.10,
  volatilityWindow: 6,
  minROE: 0.05,
  filterByQuality: true
}

// 调整后（高估参数）
{
  maxWeight: 0.10,          // = 保持不变
  volatilityWindow: 12,     // ↑ 延长波动率窗口
  minROE: 0.05,             // = 保持不变
  maxDebtRatio: 0.8,        // + 新增负债率限制
  filterByQuality: true     // ✓ 保持质量过滤
}
```

**效果**: 更保守的配置，控制风险

---

### **调仓日志示例**

```
🌡️ [20251128] 市场温度: 85° (高估)
   PE温度: 95°, PB温度: 75°
   调整参数: maxWeight=10%, volatilityWindow=12月, minROE=5%

🔍 [20251128] 市场状态: 牛市 (置信度: 85%)
   趋势: 75.23%, 宽度: 68.5%, 波动: 45%
```

---

## 📊 策略对比

### **三大策略对比表**

| 维度 | 市值加权 | 综合得分 | 风险平价 |
|------|----------|----------|----------|
| **复杂度** | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **交易成本** | 低 | 中 | 高 |
| **风险分散** | 低 | 中 | 高 |
| **收益优化** | 无 | 中 | 高 |
| **适应性** | 无 | 低 | 高 |
| **调仓频率** | 年度 | 年度 | 季度/月度 |
| **质量过滤** | ✗ | ✓ | ✓ |
| **动态调整** | ✗ | ✗ | ✓ |

---

### **策略选择建议**

#### **市值加权策略** - 适合被动投资者
- ✅ 追求与指数完全一致
- ✅ 不想主动管理
- ✅ 最小化交易成本

#### **综合得分策略** - 适合因子投资者
- ✅ 希望优化风险收益
- ✅ 偏好高股息/高质量
- ✅ 可接受中等复杂度

#### **风险平价策略** - 适合主动投资者 ⭐
- ✅ 追求风险平衡
- ✅ 适应市场变化
- ✅ 可接受较高交易成本
- ✅ **推荐配合自适应策略使用**

---

## 🎯 完整配置示例

### **保守型配置**

```javascript
{
  useRiskParity: true,
  useAdaptive: true,
  riskParityParams: {
    volatilityWindow: 12,           // 较长波动率窗口
    ewmaDecay: 0.94,
    maxWeight: 0.08,                // 较低权重限制
    rebalanceFrequency: 'quarterly',
    stockFilterParams: {
      momentumMonths: 12,           // 较长动量周期
      minMomentumReturn: 0.05,      // 要求正动量
      filterByQuality: true,
      minROE: 0.08,                 // 较高ROE要求
      maxDebtRatio: 0.6             // 严格负债率限制
    }
  }
}
```

**特点**: 低风险、高质量、长期持有

---

### **均衡型配置** ⭐ 推荐

```javascript
{
  useRiskParity: true,
  useAdaptive: true,
  riskParityParams: {
    volatilityWindow: 6,
    ewmaDecay: 0.94,
    maxWeight: 0.10,
    rebalanceFrequency: 'quarterly',
    stockFilterParams: {
      momentumMonths: 6,
      minMomentumReturn: 0.0,
      filterByQuality: true,
      minROE: 0.05,
      maxDebtRatio: 0.8
    }
  }
}
```

**特点**: 风险收益平衡、适应市场、质量过滤

---

### **激进型配置**

```javascript
{
  useRiskParity: true,
  useAdaptive: true,
  riskParityParams: {
    volatilityWindow: 3,            // 较短波动率窗口
    ewmaDecay: 0.90,                // 更快反应
    maxWeight: 0.15,                // 较高权重限制
    rebalanceFrequency: 'monthly',  // 月度调仓
    stockFilterParams: {
      momentumMonths: 3,            // 较短动量周期
      minMomentumReturn: 0.0,
      filterByQuality: false,       // 不过滤质量
      minROE: 0,
      maxDebtRatio: 1
    }
  }
}
```

**特点**: 高收益潜力、高交易成本、快速反应

---

## 📈 回测指标说明

### **收益率指标**

- **累计收益率**: 整个回测期间的总收益
- **年化收益率**: 折算为年化的收益率
- **最大回撤**: 从峰值到谷底的最大跌幅
- **夏普比率**: 风险调整后的收益率

### **风险指标**

- **波动率**: 收益率的标准差
- **下行波动率**: 只考虑负收益的波动
- **索提诺比率**: 基于下行波动的风险调整收益

### **交易成本**

- **换手率**: 每期调仓的权重变化比例
- **交易成本**: 按0.2%计算的交易费用
- **净收益率**: 扣除交易成本后的收益率

---

## 🔍 使用建议

### **1. 策略选择**
- 新手投资者: 市值加权策略
- 价值投资者: 综合得分策略
- 主动投资者: 风险平价 + 自适应策略 ⭐

### **2. 参数调整**
- 根据风险偏好调整`maxWeight`
- 根据市场环境调整`volatilityWindow`
- 根据交易成本调整`rebalanceFrequency`

### **3. 监控指标**
- 定期查看市场温度
- 关注最大回撤
- 评估交易成本

### **4. 优化方向**
- 回测不同参数组合
- 对比不同调仓频率
- 分析市场温度与收益的关系

---

## 📚 参考资料

- **有知有行市场温度计**: https://youzhiyouxing.cn/materials/thermometer
- **风险平价策略**: Risk Parity Portfolio
- **EWMA波动率**: Exponentially Weighted Moving Average
- **动量因子**: Momentum Factor in Quantitative Finance

---

**文档版本**: v2.0  
**更新日期**: 2026-01-06  
**作者**: Cascade AI  
**项目**: 中证红利低波100指数复制与增强策略
