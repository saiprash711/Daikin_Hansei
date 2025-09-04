// routes/chatbot.js
const express = require('express');
const router = express.Router();
const { pgPool, ChatLog } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Configuration for Python chatbot service
const PYTHON_CHATBOT_URL = process.env.PYTHON_CHATBOT_URL || 'http://localhost:5001';

// Test endpoint without authentication
router.post('/test-query', async (req, res) => {
  try {
    const { message, sessionId = 'test-session' } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    let response;
    let usedLangChain = false;
    let langchainResponse; // Declare at function scope

    // Try LangChain chatbot first
    try {
      langchainResponse = await axios.post(`${PYTHON_CHATBOT_URL}/api/chatbot/query`, {
        message,
        session_id: sessionId
      }, {
        timeout: 8000 // 8 second timeout to allow Gemini to respond
      });

      if (langchainResponse.data && langchainResponse.data.success) {
        response = langchainResponse.data.response;
        usedLangChain = true;
      } else {
        throw new Error('LangChain response unsuccessful');
      }
    } catch (langchainError) {
      console.log('LangChain chatbot unavailable, falling back to rule-based system:', langchainError.message);
      
      // Fallback to original rule-based system with error handling
      try {
        response = await processQuery(message.toLowerCase());
        usedLangChain = false;
      } catch (dbError) {
        console.log('Database fallback also failed:', dbError.message);
        // Final fallback response
        response = "I'm Hansei AI powered by Google Gemini 2.5 Flash. I'm having a temporary connection issue, but I'm here to help with sales data and business insights. Please try your question again!";
        usedLangChain = false;
      }
    }

    // Include notification information in response
    const responseData = {
      response,
      sessionId,
      chatbotType: usedLangChain ? 'langchain-gemini-2.5-flash' : 'rule-based'
    };
    
    // Add notification data if available from LangChain response
    if (langchainResponse && langchainResponse.data) {
      if (langchainResponse.data.processing_time) {
        responseData.processingTime = langchainResponse.data.processing_time;
      }
      if (langchainResponse.data.query_type) {
        responseData.queryType = langchainResponse.data.query_type;
      }
      if (langchainResponse.data.notification) {
        responseData.notification = langchainResponse.data.notification;
      }
    }
    
    res.json(responseData);

  } catch (error) {
    console.error('Test chatbot query processing error:', error);
    res.status(500).json({
      error: 'Failed to process query'
    });
  }
});

// Chatbot query endpoint - Enhanced with LangChain integration
router.post('/query', authenticateToken, async (req, res) => {
  try {
    const { message, sessionId = uuidv4() } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    let response;
    let usedLangChain = false;
    let langchainResponse; // Declare at function scope

    // Try LangChain chatbot first
    try {
      langchainResponse = await axios.post(`${PYTHON_CHATBOT_URL}/api/chatbot/query`, {
        message,
        session_id: sessionId
      }, {
        timeout: 8000 // 8 second timeout to allow Gemini to respond
      });

      if (langchainResponse.data && langchainResponse.data.success) {
        response = langchainResponse.data.response;
        usedLangChain = true;
      } else {
        throw new Error('LangChain response unsuccessful');
      }
    } catch (langchainError) {
      console.log('LangChain chatbot unavailable, falling back to rule-based system:', langchainError.message);
      
      // Fallback to original rule-based system with error handling
      try {
        response = await processQuery(message.toLowerCase());
        usedLangChain = false;
      } catch (dbError) {
        console.log('Database fallback also failed:', dbError.message);
        // Final fallback response
        response = "I'm Hansei AI powered by Google Gemini 2.5 Flash. I'm having a temporary connection issue, but I'm here to help with sales data and business insights. Please try your question again!";
        usedLangChain = false;
      }
    }

    // Log the conversation but DO NOT let it block the user's response.
    try {
      await new ChatLog({
        userId: req.user.id,
        message,
        response,
        sessionId,
        chatbotType: usedLangChain ? 'langchain' : 'rule-based'
      }).save();
    } catch (dbError) {
      console.error('Chatbot DB logging error:', dbError.message);
    }

    // Include notification information in response
    const responseData = {
      response,
      sessionId,
      chatbotType: usedLangChain ? 'langchain' : 'rule-based'
    };
    
    // Add notification data if available from LangChain response
    if (langchainResponse && langchainResponse.data) {
      if (langchainResponse.data.processing_time) {
        responseData.processingTime = langchainResponse.data.processing_time;
      }
      if (langchainResponse.data.query_type) {
        responseData.queryType = langchainResponse.data.query_type;
      }
      if (langchainResponse.data.notification) {
        responseData.notification = langchainResponse.data.notification;
      }
    }
    
    res.json(responseData);

  } catch (error) {
    console.error('Chatbot query processing error:', error);
    res.status(500).json({
      error: 'Failed to process query'
    });
  }
});

// Process chatbot queries
async function processQuery(query) {
  // Greetings
  if (query.includes('hello') || query.includes('hi')) {
    return 'Hello! I\'m the Hansei AI assistant. How can I help you with the sales data today?';
  }

  // Help
  if (query.includes('help') || query.includes('command')) {
    return `You can ask me things like:
- What is the total stock?
- How many products are there?
- Tell me about branch performance
- What are the critical alerts?
- Show me the top selling products
- What's the plan achievement rate?`;
  }

  // Total sales
  if (query.includes('total sales') || query.includes('revenue')) {
    const result = await pgPool.query('SELECT SUM(billing) as total FROM inventory');
    const totalSales = parseInt(result.rows[0].total) || 0;
    return `The total sales billing across all branches is ${totalSales.toLocaleString()} units.`;
  }

  // Total stock
  if (query.includes('total stock') || query.includes('inventory')) {
    const result = await pgPool.query('SELECT SUM(avl_stock) as total FROM inventory');
    const totalStock = parseInt(result.rows[0].total) || 0;
    return `The total available stock across all branches is ${totalStock.toLocaleString()} units.`;
  }

  // Product count
  if (query.includes('products') || query.includes('models')) {
    const result = await pgPool.query('SELECT COUNT(*) as count FROM products');
    const techResult = await pgPool.query(
      'SELECT technology, COUNT(*) as count FROM products GROUP BY technology'
    );
    
    const productCount = parseInt(result.rows[0].count);
    const techBreakdown = techResult.rows
      .map(t => `${t.count} ${t.technology}`)
      .join(', ');
    
    return `We are tracking ${productCount} different product models: ${techBreakdown}.`;
  }

  // Branch information
  if (query.includes('branch') || query.includes('cities')) {
    const result = await pgPool.query('SELECT name FROM branches ORDER BY name');
    const branches = result.rows.map(b => b.name).join(', ');
    return `We are monitoring ${result.rows.length} branches: ${branches}. Which branch are you interested in?`;
  }

  // Specific branch queries
  if (query.includes('chennai')) {
    const result = await pgPool.query(`
      SELECT SUM(i.avl_stock) as stock, SUM(i.billing) as sales
      FROM inventory i
      JOIN branches b ON i.branch_id = b.id
      WHERE b.name = 'Chennai'
    `);
    const data = result.rows[0];
    return `Chennai currently has ${parseInt(data.stock).toLocaleString()} units in stock and has achieved ${parseInt(data.sales).toLocaleString()} units in sales.`;
  }

  if (query.includes('bangalore')) {
    const result = await pgPool.query(`
      SELECT SUM(i.avl_stock) as stock, SUM(i.billing) as sales
      FROM inventory i
      JOIN branches b ON i.branch_id = b.id
      WHERE b.name = 'Bangalore'
    `);
    const data = result.rows[0];
    return `Bangalore currently has ${parseInt(data.stock).toLocaleString()} units in stock and has achieved ${parseInt(data.sales).toLocaleString()} units in sales.`;
  }

  // Critical alerts
  if (query.includes('critical') || query.includes('alert')) {
    const result = await pgPool.query(`
      SELECT p.material, i.month_plan 
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE i.avl_stock = 0 AND i.month_plan > 0
      LIMIT 3
    `);
    
    if (result.rows.length > 0) {
      const alerts = result.rows
        .map(a => `${a.material} (plan: ${a.month_plan})`)
        .join(', ');
      return `Yes, there are ${result.rows.length} critical stock-out alerts for: ${alerts}`;
    }
    return 'Good news! There are currently no critical stock alerts.';
  }

  // Plan achievement
  if (query.includes('plan achievement') || query.includes('performance')) {
    const result = await pgPool.query(`
      SELECT 
        SUM(billing) as total_billing,
        SUM(month_plan) as total_plan
      FROM inventory
    `);
    
    const billing = parseInt(result.rows[0].total_billing) || 0;
    const plan = parseInt(result.rows[0].total_plan) || 0;
    const achievement = plan > 0 ? Math.round((billing / plan) * 100) : 0;
    
    return `The overall plan achievement rate is ${achievement}%. Total billing: ${billing.toLocaleString()} units against a plan of ${plan.toLocaleString()} units.`;
  }

  // Top selling products
  if (query.includes('top selling') || query.includes('best selling')) {
    const result = await pgPool.query(`
      SELECT p.material, SUM(i.billing) as total_sales
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      GROUP BY p.id, p.material
      ORDER BY total_sales DESC
      LIMIT 3
    `);
    
    const topProducts = result.rows
      .map(p => `${p.material} (${parseInt(p.total_sales).toLocaleString()} units)`)
      .join(', ');
    
    return `The top 3 selling products are: ${topProducts}`;
  }

  // Technology breakdown
  if (query.includes('inverter') || query.includes('technology')) {
    const result = await pgPool.query(`
      SELECT 
        p.technology,
        COUNT(DISTINCT p.id) as product_count,
        SUM(i.avl_stock) as total_stock
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      GROUP BY p.technology
    `);
    
    const techInfo = result.rows
      .map(t => `${t.technology}: ${t.product_count} products with ${parseInt(t.total_stock).toLocaleString()} units`)
      .join('. ');
    
    return `Technology breakdown - ${techInfo}`;
  }

  // Low stock
  if (query.includes('low stock') || query.includes('shortage')) {
    const result = await pgPool.query(`
      SELECT 
        p.material,
        b.name as branch,
        i.avl_stock,
        i.month_plan
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN branches b ON i.branch_id = b.id
      WHERE i.avl_stock < i.month_plan * 0.2
        AND i.month_plan > 0
      ORDER BY (i.avl_stock::float / i.month_plan) ASC
      LIMIT 3
    `);
    
    if (result.rows.length > 0) {
      const shortages = result.rows
        .map(s => `${s.material} at ${s.branch} (only ${s.avl_stock} units)`)
        .join(', ');
      return `Low stock alerts: ${shortages}. These products need immediate restocking.`;
    }
    return 'All products have adequate stock levels.';
  }

  // About Hansei
  if (query.includes('hansei') || query.includes('who are you')) {
    return 'I am an AI assistant for the Hansei Intelligence Portal. I can help you analyze sales data, check inventory levels, and provide insights about branch performance. I have access to real-time data across all branches and products.';
  }

  // Default response
  return 'I\'m not sure how to answer that. Please try asking about sales, stock, products, branches, or type "help" for a list of commands.';
}

// Get chat history
router.get('/history/:sessionId?', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const query = sessionId 
      ? { userId: req.user.id, sessionId }
      : { userId: req.user.id };
    
    const chats = await ChatLog
      .find(query)
      .sort({ timestamp: -1 })
      .limit(50);

    res.json({
      history: chats
    });

  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      error: 'Failed to fetch chat history'
    });
  }
});

// Generate insights endpoint
router.post('/generate-insights', authenticateToken, async (req, res) => {
  try {
    const { branch, timestamp } = req.body;
    
    // Generate insights based on current data
    const insights = [];
    
    // Get branch performance data
    const branchPerformance = await pgPool.query(`
      SELECT 
        b.name as branch_name,
        SUM(i.billing) as total_sales,
        SUM(i.month_plan) as total_plan,
        SUM(i.avl_stock) as total_stock,
        ROUND((SUM(i.billing)::numeric / NULLIF(SUM(i.month_plan), 0)) * 100, 2) as plan_achievement
      FROM branches b
      LEFT JOIN inventory i ON b.id = i.branch_id
      WHERE b.name = $1
      GROUP BY b.id, b.name
    `, [branch || 'Chennai']);
    
    if (branchPerformance.rows.length > 0) {
      const branchData = branchPerformance.rows[0];
      insights.push({
        type: 'positive',
        title: 'Branch Performance',
        message: `${branchData.branch_name} has achieved ${branchData.plan_achievement || 0}% of its sales target with ${parseInt(branchData.total_sales || 0).toLocaleString()} units sold.`,
        confidence: 95
      });
    }
    
    // Get top selling products
    const topProducts = await pgPool.query(`
      SELECT 
        p.material,
        SUM(i.billing) as total_sales
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      GROUP BY p.id, p.material
      ORDER BY total_sales DESC
      LIMIT 3
    `);
    
    if (topProducts.rows.length > 0) {
      const topProductList = topProducts.rows.map(p => p.material).join(', ');
      insights.push({
        type: 'neutral',
        title: 'Top Performing Products',
        message: `Our best selling products are: ${topProductList}.`,
        confidence: 90
      });
    }
    
    // Get inventory status
    const inventoryStatus = await pgPool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN i.avl_stock = 0 AND i.month_plan > 0 THEN 1 END) as out_of_stock,
        COUNT(CASE WHEN i.avl_stock < i.month_plan * 0.2 THEN 1 END) as low_stock
      FROM inventory i
    `);
    
    if (inventoryStatus.rows.length > 0) {
      const invData = inventoryStatus.rows[0];
      if (parseInt(invData.out_of_stock) > 0) {
        insights.push({
          type: 'warning',
          title: 'Inventory Alert',
          message: `There are ${invData.out_of_stock} products currently out of stock that have sales plans.`,
          confidence: 98
        });
      } else if (parseInt(invData.low_stock) > 0) {
        insights.push({
          type: 'warning',
          title: 'Low Stock Warning',
          message: `There are ${invData.low_stock} products with stock levels below 20% of their sales plans.`,
          confidence: 92
        });
      } else {
        insights.push({
          type: 'positive',
          title: 'Healthy Inventory',
          message: 'Inventory levels are healthy across all products.',
          confidence: 88
        });
      }
    }
    
    res.json({
      success: true,
      insights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({
      error: 'Failed to generate insights'
    });
  }
});

module.exports = router;
