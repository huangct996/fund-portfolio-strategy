/**
 * 测试Tushare公告接口（anns_d）
 * 查询601668.SH中国建筑的全部公告
 */

const fs = require('fs');
const path = require('path');

// Tushare配置
const TUSHARE_TOKEN = '8679563c9fe229e5d656c51fbab38ad90f93e9086adcc0b6acf6522d';
const TUSHARE_API_URL = 'http://api.tushare.pro';

/**
 * 调用Tushare API
 */
async function callTushareAPI(apiName, params) {
  const axios = require('axios');
  
  const requestData = {
    api_name: apiName,
    token: TUSHARE_TOKEN,
    params: params || {},
    fields: ''
  };
  
  console.log(`\n📡 调用Tushare API: ${apiName}`);
  console.log('请求参数:', JSON.stringify(params, null, 2));
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(TUSHARE_API_URL, requestData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ API调用成功，耗时: ${duration}ms`);
    
    if (response.data.code !== 0) {
      throw new Error(`API返回错误: ${response.data.msg}`);
    }
    
    return {
      request: requestData,
      response: response.data,
      duration: duration,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ API调用失败，耗时: ${duration}ms`);
    console.error('错误信息:', error.message);
    
    return {
      request: requestData,
      error: {
        message: error.message,
        stack: error.stack,
        response: error.response ? error.response.data : null
      },
      duration: duration,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 格式化公告数据
 */
function formatAnnouncementData(data) {
  if (!data || !data.data || !data.data.items) {
    return [];
  }
  
  const fields = data.data.fields;
  const items = data.data.items;
  
  return items.map(item => {
    const obj = {};
    fields.forEach((field, index) => {
      obj[field] = item[index];
    });
    return obj;
  });
}

/**
 * 主测试函数
 */
async function testAnnouncementAPI() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 测试Tushare公告接口（anns_d）');
  console.log('='.repeat(80));
  
  const tsCode = '601668.SH';  // 中国建筑
  const outputDir = './test-results';
  
  // 创建输出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const results = [];
  
  try {
    // 测试1: 查询最近的公告（不指定股票代码）
    console.log('\n\n【测试1】查询最近一天的全部公告');
    console.log('-'.repeat(80));
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const annDate = yesterday.toISOString().split('T')[0].replace(/-/g, '');
    
    const test1 = await callTushareAPI('anns_d', {
      ann_date: annDate
    });
    
    results.push({
      testName: '查询最近一天的全部公告',
      ...test1
    });
    
    if (test1.response && test1.response.data) {
      const announcements = formatAnnouncementData(test1.response);
      console.log(`\n📊 获取到 ${announcements.length} 条公告`);
      
      if (announcements.length > 0) {
        console.log('\n前3条公告示例:');
        announcements.slice(0, 3).forEach((ann, idx) => {
          console.log(`\n${idx + 1}. ${ann.name} (${ann.ts_code})`);
          console.log(`   标题: ${ann.title}`);
          console.log(`   日期: ${ann.ann_date}`);
        });
      }
    }
    
    // 等待1秒，避免频率限制
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试2: 查询中国建筑的公告（指定股票代码）
    console.log('\n\n【测试2】查询中国建筑(601668.SH)的公告');
    console.log('-'.repeat(80));
    
    const test2 = await callTushareAPI('anns_d', {
      ts_code: tsCode,
      start_date: '20240101',
      end_date: '20241231'
    });
    
    results.push({
      testName: '查询中国建筑2024年公告',
      ...test2
    });
    
    if (test2.response && test2.response.data) {
      const announcements = formatAnnouncementData(test2.response);
      console.log(`\n📊 获取到 ${announcements.length} 条公告`);
      
      if (announcements.length > 0) {
        console.log('\n公告列表:');
        announcements.forEach((ann, idx) => {
          console.log(`\n${idx + 1}. 日期: ${ann.ann_date}`);
          console.log(`   标题: ${ann.title}`);
        });
        
        // 保存详细数据
        const detailFile = path.join(outputDir, 'china_construction_2024_announcements.json');
        fs.writeFileSync(detailFile, JSON.stringify(announcements, null, 2), 'utf8');
        console.log(`\n💾 详细数据已保存到: ${detailFile}`);
      }
    }
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试3: 查询中国建筑的历史公告（更大范围）
    console.log('\n\n【测试3】查询中国建筑近3年的公告');
    console.log('-'.repeat(80));
    
    const test3 = await callTushareAPI('anns_d', {
      ts_code: tsCode,
      start_date: '20220101',
      end_date: '20241231'
    });
    
    results.push({
      testName: '查询中国建筑近3年公告',
      ...test3
    });
    
    if (test3.response && test3.response.data) {
      const announcements = formatAnnouncementData(test3.response);
      console.log(`\n📊 获取到 ${announcements.length} 条公告`);
      
      // 按年份统计
      const yearStats = {};
      announcements.forEach(ann => {
        const year = ann.ann_date.substring(0, 4);
        yearStats[year] = (yearStats[year] || 0) + 1;
      });
      
      console.log('\n按年份统计:');
      Object.keys(yearStats).sort().forEach(year => {
        console.log(`  ${year}年: ${yearStats[year]}条`);
      });
      
      // 按公告类型统计（从标题中提取关键词）
      const typeStats = {
        '年报': 0,
        '季报': 0,
        '半年报': 0,
        '业绩': 0,
        '分红': 0,
        '重组': 0,
        '其他': 0
      };
      
      announcements.forEach(ann => {
        const title = ann.title || '';
        if (title.includes('年度报告') || title.includes('年报')) typeStats['年报']++;
        else if (title.includes('季度报告') || title.includes('季报')) typeStats['季报']++;
        else if (title.includes('半年度报告') || title.includes('半年报')) typeStats['半年报']++;
        else if (title.includes('业绩')) typeStats['业绩']++;
        else if (title.includes('分红') || title.includes('股利')) typeStats['分红']++;
        else if (title.includes('重组') || title.includes('并购')) typeStats['重组']++;
        else typeStats['其他']++;
      });
      
      console.log('\n按公告类型统计:');
      Object.entries(typeStats).forEach(([type, count]) => {
        if (count > 0) {
          console.log(`  ${type}: ${count}条`);
        }
      });
      
      // 保存详细数据
      const detailFile = path.join(outputDir, 'china_construction_3years_announcements.json');
      fs.writeFileSync(detailFile, JSON.stringify(announcements, null, 2), 'utf8');
      console.log(`\n💾 详细数据已保存到: ${detailFile}`);
    }
    
    // 保存完整的请求和响应数据
    const fullResultFile = path.join(outputDir, 'tushare_announcement_test_full_results.json');
    fs.writeFileSync(fullResultFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n💾 完整测试结果已保存到: ${fullResultFile}`);
    
    // 生成测试报告
    const reportFile = path.join(outputDir, 'test_report.md');
    const report = generateTestReport(results);
    fs.writeFileSync(reportFile, report, 'utf8');
    console.log(`📄 测试报告已保存到: ${reportFile}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ 测试完成');
    console.log('='.repeat(80) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    
    // 保存错误信息
    const errorFile = path.join(outputDir, 'test_error.json');
    fs.writeFileSync(errorFile, JSON.stringify({
      error: error.message,
      stack: error.stack,
      results: results
    }, null, 2), 'utf8');
    
    process.exit(1);
  }
}

/**
 * 生成测试报告
 */
function generateTestReport(results) {
  let report = '# Tushare公告接口测试报告\n\n';
  report += `**测试时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
  report += `**测试股票**: 601668.SH 中国建筑\n\n`;
  report += '---\n\n';
  
  results.forEach((result, idx) => {
    report += `## 测试${idx + 1}: ${result.testName}\n\n`;
    
    if (result.error) {
      report += `**状态**: ❌ 失败\n\n`;
      report += `**错误信息**: ${result.error.message}\n\n`;
    } else if (result.response) {
      report += `**状态**: ✅ 成功\n\n`;
      report += `**耗时**: ${result.duration}ms\n\n`;
      
      if (result.response.data) {
        const announcements = formatAnnouncementData(result.response);
        report += `**获取公告数**: ${announcements.length}条\n\n`;
        
        if (announcements.length > 0) {
          report += '**示例数据**:\n\n';
          report += '```json\n';
          report += JSON.stringify(announcements.slice(0, 2), null, 2);
          report += '\n```\n\n';
        }
      }
    }
    
    report += '**请求参数**:\n\n';
    report += '```json\n';
    report += JSON.stringify(result.request.params, null, 2);
    report += '\n```\n\n';
    
    report += '---\n\n';
  });
  
  return report;
}

// 运行测试
testAnnouncementAPI();
