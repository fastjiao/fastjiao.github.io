/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Hono } from 'hono'

// 初始化 Hono 应用
const app = new Hono()

// 1. 根路径：简单的欢迎语
app.get('/', (c) => {
  return c.json({ 
    message: 'Hello! Ljiao API is running with JavaScript.' 
  })
})

// 2. 测试数据库：查询 SQLite 版本
app.get('/test-db', async (c) => {
  try {
    // c.env.DB 就是我们在 wrangler.json 里配置的 ljiao_db
    // 执行一条简单的 SQL 查询
    const { results } = await c.env.ljiao_db.prepare('SELECT 1 as test').all()    
    return c.json({ 
      status: 'success', 
      data: results 
    })
  } catch (e) {
    return c.json({ 
      status: 'error', 
      message: e.message 
    }, 500)
  }
})

export default app