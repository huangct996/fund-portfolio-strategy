const express = require('express');
const path = require('path');
require('dotenv').config();

const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 3000;

// 静态文件
app.use(express.static('public'));

// API路由
app.use('/api', dataRoutes);

// 启动服务器
app.listen(PORT, () => {
  console.log('============================================================');
  console.log('🚀 服务器已启动');
  console.log(`📊 基金代码: ${process.env.FUND_CODE}`);
  console.log(`🌐 访问地址: http://localhost:${PORT}`);
  console.log(`⚙️  最大单只权重限制: ${(parseFloat(process.env.MAX_WEIGHT) * 100).toFixed(0)}%`);
  console.log('============================================================');
});
