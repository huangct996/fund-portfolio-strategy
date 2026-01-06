const dbService = require('./services/dbService');

async function checkIndexWeights() {
  try {
    await dbService.init();
    
    console.log('\n📊 检查index_weight表的数据...\n');
    
    // 先查看表结构
    const [columns] = await dbService.pool.execute(`
      SHOW COLUMNS FROM index_weight
    `);
    
    console.log('表结构:');
    columns.forEach(col => {
      console.log(`  ${col.Field} (${col.Type})`);
    });
    
    // 检查数据量
    const [count] = await dbService.pool.execute(`
      SELECT COUNT(*) as count FROM index_weight
    `);
    console.log(`\n总记录数: ${count[0].count}`);
    
    // 检查最近的数据
    const [recent] = await dbService.pool.execute(`
      SELECT * FROM index_weight 
      ORDER BY trade_date DESC 
      LIMIT 3
    `);
    
    console.log('\n最近的3条记录:');
    recent.forEach(row => {
      console.log(JSON.stringify(row, null, 2));
    });
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkIndexWeights();
