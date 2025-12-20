// ═══════════════════════════════════════════════════════════════
// 🤖 DRIVE SYNC BOT - Admin Dashboard
// Professional Telegram Bot for Google Drive Synchronization
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 📡 TELEGRAM API
// ═══════════════════════════════════════════════════════════════

async function sendMessage(token, chatId, text, options = {}) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...options
        })
    });
}

async function answerCallback(token, callbackId) {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackId })
    });
}

// ═══════════════════════════════════════════════════════════════
// 📊 GITHUB API
// ═══════════════════════════════════════════════════════════════

async function getState(repo) {
    try {
        const url = `https://raw.githubusercontent.com/${repo}/main/state.json?t=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) return await res.json();
    } catch (e) { }
    return { stats: { totalSyncs: 0, totalFiles: 0, lastSync: '' }, history: [] };
}

async function triggerSync(repo, token) {
    if (!token) return false;
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/sync.yml/dispatches`, {
        method: 'POST',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ref: 'main' })
    });
    return res.ok;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 MESSAGE TEMPLATES
// ═══════════════════════════════════════════════════════════════

function formatNumber(n) {
    return n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") || "0";
}

function formatUptime() {
    return "99.9%";
}

function getStatusEmoji(success, total) {
    if (total === 0) return "⚪";
    const rate = (success / total) * 100;
    if (rate >= 95) return "🟢";
    if (rate >= 80) return "🟡";
    return "🔴";
}

// ═══════════════════════════════════════════════════════════════
// 📱 COMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════

async function cmdStart(token, chatId) {
    const text = `🤖 <b>Drive Sync Bot</b>

📌 <b>Lệnh:</b>
/sync - 🔄 Đồng bộ ngay
/status - 📊 Xem trạng thái
/history - 📜 Lịch sử sync
/help - ❓ Trợ giúp

⏰ Auto-sync: 10 phút`;
    await sendMessage(token, chatId, text);
}

async function cmdDashboard(token, chatId, repo) {
    const state = await getState(repo);
    const s = state.stats;

    const text = `📊 <b>Dashboard</b>

🔄 Tổng sync: ${s.totalSyncs || 0}
📁 Files đã sync: ${s.totalFiles || 0}
⏰ Lần cuối: ${s.lastSync || 'Chưa có'}

⚙️ Chu kỳ: 10 phút | Mode: Copy`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔄 Sync', callback_data: 'sync' },
                { text: '📜 History', callback_data: 'history' }
            ]
        ]
    };

    await sendMessage(token, chatId, text, { reply_markup: keyboard });
}

async function cmdStatus(token, chatId, repo) {
    const state = await getState(repo);
    const s = state.stats;

    const text = `📈 <b>Status</b>

🟢 Trạng thái: Online
🔄 Tổng sync: ${s.totalSyncs || 0}
📁 Files: ${s.totalFiles || 0}
⏰ Lần cuối: ${s.lastSync || 'N/A'}
⚙️ Chu kỳ: 10 phút`;

    await sendMessage(token, chatId, text);
}

async function cmdStats(token, chatId, repo) {
    const state = await getState(repo);
    const s = state.stats;
    const avg = s.totalSyncs > 0 ? Math.round(s.totalFiles / s.totalSyncs * 10) / 10 : 0;

    const text = `📊 <b>Statistics</b>

🔄 Tổng sync: ${s.totalSyncs || 0}
📁 Tổng files: ${s.totalFiles || 0}
📈 TB/sync: ${avg} files
⚡ Mode: Copy 1 chiều`;

    await sendMessage(token, chatId, text);
}

async function cmdHistory(token, chatId, repo) {
    const state = await getState(repo);
    const history = state.history || [];

    let list = '📭 Chưa có lịch sử';
    if (history.length > 0) {
        list = history.slice(0, 10).map(h => {
            const icon = h.files > 0 ? '✅' : '⚪';
            return `${icon} ${h.time} - ${h.files || 0} files`;
        }).join('\n');
    }

    const text = `📜 <b>History</b>

${list}`;

    await sendMessage(token, chatId, text);
}

async function cmdReport(token, chatId, repo) {
    const state = await getState(repo);
    const s = state.stats;
    const history = state.history || [];

    const last24h = history.filter(h => {
        const hTime = new Date(h.time).getTime();
        return Date.now() - hTime < 24 * 60 * 60 * 1000;
    });
    const files24h = last24h.reduce((sum, h) => sum + (h.files || 0), 0);

    const text = `📑 <b>Report 24h</b>

🔄 Sync hôm nay: ${last24h.length} lần
📁 Files hôm nay: ${files24h}
📊 Tổng sync: ${s.totalSyncs || 0}
📂 Tổng files: ${s.totalFiles || 0}`;

    await sendMessage(token, chatId, text);
}

async function cmdSync(token, chatId, repo, ghToken) {
    if (!ghToken) {
        await sendMessage(token, chatId, '⚠️ Cần GITHUB_TOKEN để trigger.');
        return;
    }
    await sendMessage(token, chatId, '⏳ Đang trigger sync...');
    const ok = await triggerSync(repo, ghToken);
    await sendMessage(token, chatId, ok ? '✅ Đã trigger! Chờ 30-60s.' : '❌ Lỗi. Check token.');
}

async function cmdSettings(token, chatId, repo) {
    const text = `⚙️ <b>Settings</b>

⏱️ Interval: 10 phút
📤 Mode: Copy 1 chiều
🔔 Notify: Khi có file mới

📝 Sửa: GitHub Secrets`;

    const keyboard = {
        inline_keyboard: [[
            { text: '🔗 GitHub', url: `https://github.com/${repo}` }
        ]]
    };
    await sendMessage(token, chatId, text, { reply_markup: keyboard });
}

async function cmdHelp(token, chatId) {
    const text = `❓ <b>Help</b>

📌 <b>Lệnh:</b>
/sync - 🔄 Đồng bộ ngay
/status - 📊 Trạng thái
/history - 📜 Lịch sử
/stats - 📈 Thống kê
/settings - ⚙️ Cài đặt

⏰ Auto-sync mỗi 10 phút`;
    await sendMessage(token, chatId, text);
}

// ═══════════════════════════════════════════════════════════════
// � GOOGLE DRIVE WEBHOOK
// ═══════════════════════════════════════════════════════════════

async function getAccessToken(env) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            refresh_token: env.GOOGLE_REFRESH_TOKEN,
            grant_type: 'refresh_token'
        })
    });
    const data = await res.json();
    return data.access_token;
}

async function setupDriveWatch(env, folderId, webhookUrl) {
    const accessToken = await getAccessToken(env);
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}/watch`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: 'drive-sync-' + Date.now(),
                type: 'web_hook',
                address: webhookUrl,
                expiration: Date.now() + (7 * 24 * 60 * 60 * 1000)
            })
        }
    );
    return res.json();
}

// ═══════════════════════════════════════════════════════════════
// �🚀 MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Google Drive Webhook endpoint
        if (url.pathname === '/drive-webhook') {
            const resourceState = request.headers.get('X-Goog-Resource-State');
            if (resourceState === 'change' || resourceState === 'update') {
                const REPO = env.GITHUB_REPO || 'GiaHung07/DriveSync';
                if (env.GITHUB_TOKEN) {
                    await triggerSync(REPO, env.GITHUB_TOKEN);
                    console.log('Drive webhook: sync triggered!');
                }
            }
            return new Response('OK', { status: 200 });
        }

        // Setup watch endpoint
        if (url.pathname === '/setup-watch' && request.method === 'POST') {
            try {
                const { folderId } = await request.json();
                const result = await setupDriveWatch(env, folderId, url.origin + '/drive-webhook');
                return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500 });
            }
        }

        // Status page
        if (request.method === 'GET') {
            return new Response('🤖 Drive Sync Bot v4.0 - Webhook Active', { status: 200 });
        }

        // Telegram handler (POST to root)

        const TOKEN = env.BOT_TOKEN;
        const CHAT_ID = env.CHAT_ID;
        const GH_TOKEN = env.GITHUB_TOKEN || '';
        const REPO = env.GITHUB_REPO || 'PGHungg/DriveSync';

        try {
            const update = await request.json();

            // Callback queries
            if (update.callback_query) {
                const chatId = update.callback_query.message.chat.id.toString();
                if (chatId !== CHAT_ID) return new Response('OK');

                await answerCallback(TOKEN, update.callback_query.id);

                const action = update.callback_query.data;
                switch (action) {
                    case 'dashboard': await cmdDashboard(TOKEN, chatId, REPO); break;
                    case 'status': await cmdStatus(TOKEN, chatId, REPO); break;
                    case 'stats': await cmdStats(TOKEN, chatId, REPO); break;
                    case 'history': await cmdHistory(TOKEN, chatId, REPO); break;
                    case 'report': await cmdReport(TOKEN, chatId, REPO); break;
                    case 'sync': await cmdSync(TOKEN, chatId, REPO, GH_TOKEN); break;
                    case 'settings': await cmdSettings(TOKEN, chatId, REPO); break;
                    case 'help': await cmdHelp(TOKEN, chatId); break;
                }
                return new Response('OK');
            }

            // Messages
            const msg = update.message;
            if (!msg || !msg.text) return new Response('OK');

            const chatId = msg.chat.id.toString();
            if (chatId !== CHAT_ID) return new Response('OK');

            const cmd = msg.text.split(' ')[0].toLowerCase().replace(/@\w+/, '');

            switch (cmd) {
                case '/start': await cmdStart(TOKEN, chatId); break;
                case '/dashboard':
                case '/menu': await cmdDashboard(TOKEN, chatId, REPO); break;
                case '/status': await cmdStatus(TOKEN, chatId, REPO); break;
                case '/stats': await cmdStats(TOKEN, chatId, REPO); break;
                case '/history': await cmdHistory(TOKEN, chatId, REPO); break;
                case '/report': await cmdReport(TOKEN, chatId, REPO); break;
                case '/sync': await cmdSync(TOKEN, chatId, REPO, GH_TOKEN); break;
                case '/settings': await cmdSettings(TOKEN, chatId, REPO); break;
                case '/help': await cmdHelp(TOKEN, chatId); break;
                default:
                    await sendMessage(TOKEN, chatId, '❓ Lệnh không hợp lệ. Gửi /help để xem hướng dẫn.');
            }

        } catch (e) {
            console.error('Error:', e);
        }

        return new Response('OK', { status: 200 });
    },

    // Cron Trigger: Auto sync mỗi 2 phút (Turbo Mode)
    async scheduled(event, env, ctx) {
        // Load Balancing với Smart Failover
        // 1. Randomize thứ tự để chia tải
        let repos = [
            env.GITHUB_REPO || 'GiaHung07/DriveSync',
            'PGHungg/DriveSync'
        ];

        // Shuffle array
        repos = repos.sort(() => Math.random() - 0.5);
        // Lọc trùng
        repos = [...new Set(repos)];

        const GH_TOKEN = env.GITHUB_TOKEN;
        if (!GH_TOKEN) return;

        // 2. Try từng repo, nếu lỗi thử cái tiếp theo
        for (const repo of repos) {
            try {
                const ok = await triggerSync(repo, GH_TOKEN);
                if (ok) {
                    console.log(`Turbo Sync: Triggered SUCCESS on ${repo}`);
                    break; // Thành công thì dừng, không spam repo kia
                } else {
                    console.log(`Turbo Sync: Failed on ${repo}, trying next...`);
                }
            } catch (e) {
                console.error(`Turbo Sync: Error on ${repo}:`, e);
            }
        }
    }
};
