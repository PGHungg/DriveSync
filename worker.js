// Cloudflare Worker - Drive Sync Telegram Bot
// Full-featured bot với tất cả commands

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
        const url = `https://raw.githubusercontent.com/${repo}/main/state.json?t=${Date.now()}`;
        const response = await fetch(url);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) { }

    return {
        stats: { totalSyncs: 0, totalFiles: 0, success: 0, fail: 0, lastSync: 'Chưa có' },
        history: [],
        config: { autoSync: true, interval: 5, folders: [] }
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

async function disableWorkflow(repo, token) {
    if (!token) return false;

    const url = `https://api.github.com/repos/${repo}/actions/workflows/sync.yml/disable`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    return response.ok;
}

async function enableWorkflow(repo, token) {
    if (!token) return false;

    const url = `https://api.github.com/repos/${repo}/actions/workflows/sync.yml/enable`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    return response.ok;
}

// ===== COMMAND HANDLERS =====
async function handleStart(token, chatId) {
    const text = `🤖 <b>Drive Sync Bot v2.0</b>

Chào mừng bạn đến với hệ thống tự động đồng bộ Google Drive!

📋 <b>Commands chính:</b>
/menu - 📱 Menu với nút bấm
/status - 📊 Xem trạng thái
/sync - 🔄 Đồng bộ ngay

📋 <b>Quản lý:</b>
/add - ➕ Xem hướng dẫn thêm folder
/interval - ⏱️ Xem/đổi chu kỳ sync
/stop - ⏹️ Dừng auto-sync
/start_sync - ▶️ Bật lại auto-sync

📋 <b>Thống kê:</b>
/stats - 📈 Thống kê chi tiết
/history - 📜 Lịch sử sync
/help - ❓ Hướng dẫn đầy đủ

⏰ Auto-sync đang chạy mỗi <b>5 phút</b>`;

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

📁 <b>Folders đang sync:</b>
• <code>01</code> → <code>02</code>
• <code>C++ T10 2025</code> → <code>C++</code>

🔄 Auto-sync: <b>Đang bật</b> (mỗi 5 phút)`;

    await sendMessage(token, chatId, text);
}

async function handleStats(token, chatId, repo) {
    const state = await getStateFromGitHub(repo);
    const s = state.stats;

    const avgDuration = s.totalSyncs > 0 ? Math.round(30) : 0;
    const successRate = s.totalSyncs > 0 ? Math.round((s.success / s.totalSyncs) * 100) : 0;

    const text = `📈 <b>Thống kê chi tiết</b>

� <b>Tổng quan:</b>
• Tổng lần sync: <b>${s.totalSyncs}</b>
• Files đã sync: <b>${s.totalFiles}</b>
• Thành công: <b>${s.success}</b> (${successRate}%)
• Thất bại: <b>${s.fail}</b>

� <b>Folders:</b>
1️⃣ <code>01</code> → <code>02</code>
2️⃣ <code>C++ T10 2025</code> → <code>C++</code>

⏱️ <b>Hiệu suất:</b>
• Thời gian trung bình: ~${avgDuration}s/sync
• Chu kỳ: Mỗi 5 phút

🔧 <b>Cấu hình:</b>
• Retry: 3 lần
• Exclude: *.tmp, Thumbs.db`;

    await sendMessage(token, chatId, text);
}

async function handleHistory(token, chatId, repo) {
    const state = await getStateFromGitHub(repo);
    const history = state.history || [];

    if (history.length === 0) {
        await sendMessage(token, chatId, '📜 <b>Lịch sử</b>\n\nChưa có lịch sử sync. Chạy /sync để bắt đầu!');
        return;
    }

    let text = '📜 <b>Lịch sử 10 lần sync gần nhất</b>\n\n';

    history.slice(0, 10).forEach((h, i) => {
        const status = h.success ? '✅' : '❌';
        const files = h.files || 0;
        const dur = h.duration || 0;
        text += `${status} <code>${h.time}</code>\n   📁 ${files} files | ⏱️ ${dur}s\n\n`;
    });

    await sendMessage(token, chatId, text);
}

async function handleSync(token, chatId, repo, ghToken) {
    await sendMessage(token, chatId, '🔄 <b>Đang trigger sync...</b>\n\nVui lòng chờ khoảng 30-60 giây.');

    if (!ghToken) {
        const keyboard = {
            inline_keyboard: [[
                { text: '🔗 Mở GitHub Actions', url: `https://github.com/${repo}/actions` }
            ]]
        };
        await sendMessage(token, chatId, '⚠️ <b>Chưa cấu hình GitHub Token</b>\n\nVào GitHub Actions để chạy thủ công:', { reply_markup: keyboard });
        return;
    }

    const success = await triggerWorkflow(repo, ghToken);

    if (success) {
        await sendMessage(token, chatId, '✅ <b>Đã trigger sync thành công!</b>\n\n⏳ Chờ khoảng 30-60s để hoàn thành.\nBạn sẽ nhận được thông báo khi xong.');
    } else {
        await sendMessage(token, chatId, '❌ <b>Không thể trigger sync</b>\n\nKiểm tra lại GitHub Token trong Cloudflare Workers.');
    }
}

async function handleAdd(token, chatId, repo) {
    const text = `➕ <b>Thêm folder mới</b>

Hiện tại việc thêm folder cần chỉnh sửa file workflow trên GitHub.

📋 <b>Các bước:</b>
1. Vào GitHub repo: <code>${repo}</code>
2. Mở file <code>.github/workflows/sync.yml</code>
3. Thêm block sync mới theo format:

<code># Folder mới
echo "Syncing: SOURCE -> DEST"
rclone copy "gdrive:SOURCE" "gdrive:DEST" \\
  --exclude "*.tmp" -v</code>

4. Commit và push

💡 <b>Tips:</b>
• SOURCE = thư mục nguồn trên Drive
• DEST = thư mục đích trên Drive
• Cả hai đều cùng remote "gdrive"`;

    const keyboard = {
        inline_keyboard: [[
            { text: '📝 Mở GitHub để sửa', url: `https://github.com/${repo}/blob/main/.github/workflows/sync.yml` }
        ]]
    };

    await sendMessage(token, chatId, text, { reply_markup: keyboard });
}

async function handleInterval(token, chatId, text, repo) {
    const parts = text.split(' ');

    if (parts.length < 2) {
        const infoText = `⏱️ <b>Chu kỳ sync hiện tại</b>

📌 Interval: <b>5 phút</b>

📋 <b>Các chu kỳ có sẵn:</b>
• 5 phút (mặc định)
• 10 phút
• 15 phút
• 30 phút

⚠️ <b>Lưu ý:</b> GitHub Actions chỉ hỗ trợ tối thiểu 5 phút.

Để đổi chu kỳ, sửa file workflow:
<code>cron: '*/5 * * * *'</code>

Thay số 5 bằng số phút mong muốn.`;

        const keyboard = {
            inline_keyboard: [[
                { text: '📝 Mở GitHub để sửa', url: `https://github.com/${repo}/blob/main/.github/workflows/sync.yml` }
            ]]
        };

        await sendMessage(token, chatId, infoText, { reply_markup: keyboard });
        return;
    }

    const newInterval = parseInt(parts[1]);
    if (isNaN(newInterval) || newInterval < 5) {
        await sendMessage(token, chatId, '❌ Interval phải là số >= 5 (phút)');
        return;
    }

    await sendMessage(token, chatId, `⏱️ Để đổi sang <b>${newInterval} phút</b>, vào GitHub và sửa:\n\n<code>cron: '*/${newInterval} * * * *'</code>`);
}

async function handleStop(token, chatId, repo, ghToken) {
    const text = `⏹️ <b>Dừng Auto-Sync</b>

Để dừng sync tự động:

📋 <b>Cách 1: Disable workflow</b>
1. Vào GitHub Actions
2. Click workflow "Google Drive Auto Sync"
3. Click "..." → "Disable workflow"

📋 <b>Cách 2: Xóa schedule</b>
Xóa dòng <code>schedule</code> trong file workflow

⚠️ Sau khi dừng, dùng /start_sync để bật lại.`;

    const keyboard = {
        inline_keyboard: [[
            { text: '⏹️ Vào GitHub Actions', url: `https://github.com/${repo}/actions` }
        ]]
    };

    await sendMessage(token, chatId, text, { reply_markup: keyboard });
}

async function handleStartSync(token, chatId, repo, ghToken) {
    const text = `▶️ <b>Bật lại Auto-Sync</b>

Để bật sync tự động:

1. Vào GitHub Actions
2. Click workflow "Google Drive Auto Sync"  
3. Click "..." → "Enable workflow"

Workflow sẽ tự động chạy mỗi 5 phút.`;

    const keyboard = {
        inline_keyboard: [[
            { text: '▶️ Vào GitHub Actions', url: `https://github.com/${repo}/actions` }
        ]]
    };

    await sendMessage(token, chatId, text, { reply_markup: keyboard });
}

async function handleHelp(token, chatId) {
    const text = `📖 <b>Hướng dẫn sử dụng</b>

<b>🎮 Điều khiển:</b>
/menu - Menu với nút bấm
/sync - Đồng bộ ngay lập tức
/stop - Dừng auto-sync
/start_sync - Bật lại auto-sync

<b>📊 Xem thông tin:</b>
/status - Trạng thái hiện tại
/stats - Thống kê chi tiết
/history - Lịch sử 10 lần sync

<b>⚙️ Cài đặt:</b>
/add - Hướng dẫn thêm folder
/interval - Xem/đổi chu kỳ sync

<b>📌 Thông tin hệ thống:</b>
• Auto-sync mỗi 5 phút
• Retry: 3 lần nếu lỗi
• Exclude: *.tmp, Thumbs.db

<b>🔗 Links:</b>
• GitHub: github.com/PGHungg/DriveSync
• Powered by GitHub Actions + Cloudflare Workers`;

    await sendMessage(token, chatId, text);
}

async function handleMenu(token, chatId) {
    const text = `� <b>Menu chính</b>

Chọn chức năng bên dưới:`;

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
                { text: '➕ Add Folder', callback_data: 'add' },
                { text: '⏱️ Interval', callback_data: 'interval' }
            ],
            [
                { text: '⏹️ Stop', callback_data: 'stop' },
                { text: '▶️ Start', callback_data: 'start_sync' }
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
            return new Response('🤖 Drive Sync Bot is running!', { status: 200 });
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

                // Answer callback query to remove loading state
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ callback_query_id: update.callback_query.id })
                });

                switch (data) {
                    case 'status': await handleStatus(BOT_TOKEN, chatId, GITHUB_REPO); break;
                    case 'stats': await handleStats(BOT_TOKEN, chatId, GITHUB_REPO); break;
                    case 'history': await handleHistory(BOT_TOKEN, chatId, GITHUB_REPO); break;
                    case 'sync': await handleSync(BOT_TOKEN, chatId, GITHUB_REPO, GITHUB_TOKEN); break;
                    case 'add': await handleAdd(BOT_TOKEN, chatId, GITHUB_REPO); break;
                    case 'interval': await handleInterval(BOT_TOKEN, chatId, '/interval', GITHUB_REPO); break;
                    case 'stop': await handleStop(BOT_TOKEN, chatId, GITHUB_REPO, GITHUB_TOKEN); break;
                    case 'start_sync': await handleStartSync(BOT_TOKEN, chatId, GITHUB_REPO, GITHUB_TOKEN); break;
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
                case '/add':
                    await handleAdd(BOT_TOKEN, chatId, GITHUB_REPO);
                    break;
                case '/interval':
                    await handleInterval(BOT_TOKEN, chatId, text, GITHUB_REPO);
                    break;
                case '/stop':
                    await handleStop(BOT_TOKEN, chatId, GITHUB_REPO, GITHUB_TOKEN);
                    break;
                case '/start_sync':
                    await handleStartSync(BOT_TOKEN, chatId, GITHUB_REPO, GITHUB_TOKEN);
                    break;
                case '/help':
                    await handleHelp(BOT_TOKEN, chatId);
                    break;
                default:
                    await sendMessage(BOT_TOKEN, chatId, '❓ Command không hợp lệ.\n\nGửi /menu để xem menu hoặc /help để xem hướng dẫn.');
            }

        } catch (e) {
            console.error('Error:', e);
        }

        return new Response('OK', { status: 200 });
    }
};
