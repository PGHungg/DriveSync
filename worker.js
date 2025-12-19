// Cloudflare Worker - Drive Sync Telegram Bot
// Deploy này lên Cloudflare Workers để bot trả lời ngay lập tức

// ===== CẤU HÌNH =====
const CONFIG = {
  BOT_TOKEN: '', // Sẽ lấy từ environment variable
  CHAT_ID: '',   // Sẽ lấy từ environment variable
  GITHUB_REPO: 'PGHungg/DriveSync',
  GITHUB_TOKEN: '' // Optional: để trigger workflow
};

// ===== TELEGRAM API =====
async function sendMessage(token, chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    ...options
  };
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// ===== GITHUB API =====
async function getStateFromGitHub(repo) {
  try {
    const url = `https://raw.githubusercontent.com/${repo}/main/state.json`;
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {}
  
  return {
    stats: { totalSyncs: 0, totalFiles: 0, success: 0, fail: 0, lastSync: 'Chưa có' },
    history: []
  };
}

async function triggerWorkflow(repo, token) {
  if (!token) return false;
  
  const url = `https://api.github.com/repos/${repo}/actions/workflows/sync.yml/dispatches`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ref: 'main' })
  });
  
  return response.ok;
}

// ===== COMMAND HANDLERS =====
async function handleStart(token, chatId) {
  const text = `🤖 <b>Drive Sync Bot</b>

Chào mừng bạn đến với hệ thống tự động đồng bộ Google Drive!

📋 <b>Commands:</b>
/status - Xem trạng thái
/stats - Thống kê chi tiết
/history - Lịch sử sync
/sync - Đồng bộ ngay
/help - Hướng dẫn

⏰ Auto-sync: Mỗi 5 phút`;
  
  await sendMessage(token, chatId, text);
}

async function handleStatus(token, chatId, repo) {
  const state = await getStateFromGitHub(repo);
  const s = state.stats;
  
  const successRate = s.totalSyncs > 0 
    ? Math.round((s.success / s.totalSyncs) * 100) 
    : 0;
  
  const text = `📊 <b>Trạng thái hệ thống</b>

🕐 Lần sync cuối: <code>${s.lastSync || 'Chưa có'}</code>
📈 Tổng số lần sync: <b>${s.totalSyncs}</b>
✅ Thành công: ${s.success} (${successRate}%)
❌ Thất bại: ${s.fail}

🔄 Auto-sync: <b>Đang bật</b> (mỗi 5 phút)`;
  
  await sendMessage(token, chatId, text);
}

async function handleStats(token, chatId, repo) {
  const state = await getStateFromGitHub(repo);
  const s = state.stats;
  
  const text = `📈 <b>Thống kê chi tiết</b>

📁 Tổng files đã sync: <b>${s.totalFiles}</b>
🔄 Tổng lần sync: <b>${s.totalSyncs}</b>
✅ Thành công: <b>${s.success}</b>
❌ Thất bại: <b>${s.fail}</b>

📅 Folders đang sync:
• <code>01</code> → <code>02</code>
• <code>C++ T10 2025</code> → <code>C++</code>

⏰ Chu kỳ: Mỗi <b>5 phút</b>`;
  
  await sendMessage(token, chatId, text);
}

async function handleHistory(token, chatId, repo) {
  const state = await getStateFromGitHub(repo);
  const history = state.history || [];
  
  if (history.length === 0) {
    await sendMessage(token, chatId, '📜 <b>Lịch sử</b>\n\nChưa có lịch sử sync.');
    return;
  }
  
  let text = '📜 <b>Lịch sử 10 lần sync gần nhất</b>\n\n';
  
  history.slice(0, 10).forEach((h, i) => {
    const status = h.success ? '✅' : '❌';
    const files = h.files || 0;
    const dur = h.duration || 0;
    text += `${status} <code>${h.time}</code> - ${files} files (${dur}s)\n`;
  });
  
  await sendMessage(token, chatId, text);
}

async function handleSync(token, chatId, repo, ghToken) {
  await sendMessage(token, chatId, '🔄 Đang trigger sync...');
  
  if (!ghToken) {
    await sendMessage(token, chatId, '⚠️ Chưa cấu hình GitHub Token. Vào GitHub Actions để chạy thủ công:\nhttps://github.com/' + repo + '/actions');
    return;
  }
  
  const success = await triggerWorkflow(repo, ghToken);
  
  if (success) {
    await sendMessage(token, chatId, '✅ Đã trigger sync thành công! Chờ khoảng 30s để hoàn thành.');
  } else {
    await sendMessage(token, chatId, '❌ Không thể trigger sync. Kiểm tra GitHub Token.');
  }
}

async function handleHelp(token, chatId) {
  const text = `📖 <b>Hướng dẫn sử dụng</b>

<b>Commands:</b>
/start - Bắt đầu
/status - Xem trạng thái hiện tại
/stats - Xem thống kê chi tiết
/history - Xem 10 lần sync gần nhất
/sync - Trigger sync ngay (cần GitHub Token)
/help - Hiển thị hướng dẫn này

<b>Tự động:</b>
• Sync chạy tự động mỗi 5 phút
• Nhận thông báo khi có thay đổi

<b>Thông tin:</b>
• Repo: github.com/PGHungg/DriveSync
• Powered by GitHub Actions + Cloudflare Workers`;
  
  await sendMessage(token, chatId, text);
}

async function handleMenu(token, chatId) {
  const text = `📋 <b>Menu chính</b>

Chọn chức năng:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📊 Status', callback_data: 'status' },
        { text: '📈 Stats', callback_data: 'stats' }
      ],
      [
        { text: '📜 History', callback_data: 'history' },
        { text: '🔄 Sync Now', callback_data: 'sync' }
      ],
      [
        { text: '❓ Help', callback_data: 'help' }
      ]
    ]
  };
  
  await sendMessage(token, chatId, text, { reply_markup: keyboard });
}

// ===== MAIN HANDLER =====
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }
    
    const BOT_TOKEN = env.BOT_TOKEN;
    const CHAT_ID = env.CHAT_ID;
    const GITHUB_TOKEN = env.GITHUB_TOKEN || '';
    const GITHUB_REPO = env.GITHUB_REPO || 'PGHungg/DriveSync';
    
    try {
      const update = await request.json();
      
      // Handle callback queries (button clicks)
      if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id.toString();
        const data = update.callback_query.data;
        
        if (chatId !== CHAT_ID) return new Response('OK');
        
        switch (data) {
          case 'status': await handleStatus(BOT_TOKEN, chatId, GITHUB_REPO); break;
          case 'stats': await handleStats(BOT_TOKEN, chatId, GITHUB_REPO); break;
          case 'history': await handleHistory(BOT_TOKEN, chatId, GITHUB_REPO); break;
          case 'sync': await handleSync(BOT_TOKEN, chatId, GITHUB_REPO, GITHUB_TOKEN); break;
          case 'help': await handleHelp(BOT_TOKEN, chatId); break;
        }
        
        return new Response('OK');
      }
      
      // Handle messages
      const message = update.message;
      if (!message || !message.text) return new Response('OK');
      
      const chatId = message.chat.id.toString();
      const text = message.text.trim();
      
      // Security: Only respond to configured chat ID
      if (chatId !== CHAT_ID) {
        console.log(`Ignored message from ${chatId}`);
        return new Response('OK');
      }
      
      // Parse command
      const command = text.split(' ')[0].toLowerCase().replace('@drivehihi_bot', '');
      
      switch (command) {
        case '/start':
          await handleStart(BOT_TOKEN, chatId);
          break;
        case '/menu':
          await handleMenu(BOT_TOKEN, chatId);
          break;
        case '/status':
          await handleStatus(BOT_TOKEN, chatId, GITHUB_REPO);
          break;
        case '/stats':
          await handleStats(BOT_TOKEN, chatId, GITHUB_REPO);
          break;
        case '/history':
          await handleHistory(BOT_TOKEN, chatId, GITHUB_REPO);
          break;
        case '/sync':
          await handleSync(BOT_TOKEN, chatId, GITHUB_REPO, GITHUB_TOKEN);
          break;
        case '/help':
          await handleHelp(BOT_TOKEN, chatId);
          break;
        default:
          await sendMessage(BOT_TOKEN, chatId, '❓ Command không hợp lệ. Gửi /help để xem hướng dẫn.');
      }
      
    } catch (e) {
      console.error('Error:', e);
    }
    
    return new Response('OK', { status: 200 });
  }
};
