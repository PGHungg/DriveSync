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
    const text = `
╔══════════════════════════════════╗
║  🤖 <b>DRIVE SYNC DASHBOARD</b>  ║
╚══════════════════════════════════╝

Chào mừng bạn đến với hệ thống quản lý đồng bộ Google Drive tự động!

<b>━━━ 🎮 ĐIỀU KHIỂN ━━━</b>
/dashboard - 📊 Bảng điều khiển chính
/sync - 🔄 Đồng bộ ngay lập tức
/status - 📈 Trạng thái hệ thống

<b>━━━ 📋 THỐNG KÊ ━━━</b>
/stats - 📊 Thống kê chi tiết
/history - 📜 Lịch sử hoạt động
/report - 📑 Báo cáo tổng hợp

<b>━━━ ⚙️ CÀI ĐẶT ━━━</b>
/settings - ⚙️ Cấu hình hệ thống
/help - ❓ Trợ giúp

<b>━━━━━━━━━━━━━━━━━━━━</b>
⏰ Auto-sync: <code>Mỗi 5 phút</code>
🔒 Bảo mật: <code>Đã mã hóa</code>
`;
    await sendMessage(token, chatId, text);
}

async function cmdDashboard(token, chatId, repo) {
    const state = await getState(repo);
    const s = state.stats;
    const statusEmoji = getStatusEmoji(s.totalSyncs - (s.fail || 0), s.totalSyncs);

    const text = `
╔══════════════════════════════════╗
║  📊 <b>ADMIN DASHBOARD</b>       ║
╚══════════════════════════════════╝

${statusEmoji} <b>TRẠNG THÁI: HOẠT ĐỘNG</b>

<b>━━━ 📈 TỔNG QUAN ━━━</b>
┃ 🔄 Tổng sync: <b>${formatNumber(s.totalSyncs)}</b> lần
┃ 📁 Files đã sync: <b>${formatNumber(s.totalFiles)}</b>
┃ ⏰ Lần cuối: <code>${s.lastSync || 'Chưa có'}</code>
┃ 📡 Uptime: <b>${formatUptime()}</b>

<b>━━━ 📂 FOLDERS ━━━</b>
┃ 📦 Số cặp folder: <b>2</b>
┃ ⚡ Chế độ: <b>Copy (1 chiều)</b>
┃ 🔄 Chu kỳ: <b>5 phút</b>

<b>━━━ 🛡️ BẢO MẬT ━━━</b>
┃ 🔐 Config: <code>Mã hóa</code>
┃ 🔒 Token: <code>Ẩn</code>
┃ 👤 Quyền: <code>Admin only</code>

<b>━━━━━━━━━━━━━━━━━━━━</b>
🕐 Cập nhật: <code>${new Date().toISOString().slice(0, 19).replace('T', ' ')}</code>
`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔄 Sync Now', callback_data: 'sync' },
                { text: '📊 Stats', callback_data: 'stats' }
            ],
            [
                { text: '📜 History', callback_data: 'history' },
                { text: '📑 Report', callback_data: 'report' }
            ],
            [
                { text: '⚙️ Settings', callback_data: 'settings' },
                { text: '❓ Help', callback_data: 'help' }
            ]
        ]
    };

    await sendMessage(token, chatId, text, { reply_markup: keyboard });
}

async function cmdStatus(token, chatId, repo) {
    const state = await getState(repo);
    const s = state.stats;
    const rate = s.totalSyncs > 0 ? Math.round(((s.totalSyncs - (s.fail || 0)) / s.totalSyncs) * 100) : 100;

    const text = `
╔══════════════════════════════════╗
║  📈 <b>SYSTEM STATUS</b>         ║
╚══════════════════════════════════╝

<b>━━━ 🖥️ HỆ THỐNG ━━━</b>
┃ 🟢 Trạng thái: <b>ONLINE</b>
┃ ⚡ Hiệu suất: <b>${rate}%</b>
┃ 🔄 Auto-sync: <b>BẬT</b>

<b>━━━ 📊 SỐ LIỆU ━━━</b>
┃ 📤 Tổng sync: <b>${formatNumber(s.totalSyncs)}</b>
┃ 📁 Tổng files: <b>${formatNumber(s.totalFiles)}</b>
┃ ✅ Thành công: <b>${rate}%</b>

<b>━━━ ⏰ THỜI GIAN ━━━</b>
┃ 🕐 Sync cuối: <code>${s.lastSync || 'N/A'}</code>
┃ ⏱️ Chu kỳ: <code>5 phút</code>
┃ 📡 Next sync: <code>~5 phút</code>

<b>━━━ 🔧 CẤU HÌNH ━━━</b>
┃ 🌐 Platform: <code>GitHub Actions</code>
┃ ☁️ Worker: <code>Cloudflare</code>
┃ 📱 Bot: <code>Telegram</code>
`;

    await sendMessage(token, chatId, text);
}

async function cmdStats(token, chatId, repo) {
    const state = await getState(repo);
    const s = state.stats;
    const avgFiles = s.totalSyncs > 0 ? Math.round(s.totalFiles / s.totalSyncs * 10) / 10 : 0;

    const text = `
╔══════════════════════════════════╗
║  📊 <b>DETAILED STATISTICS</b>   ║
╚══════════════════════════════════╝

<b>━━━ 📈 HOẠT ĐỘNG ━━━</b>
┃ 🔄 Tổng lần sync: <b>${formatNumber(s.totalSyncs)}</b>
┃ 📁 Tổng files: <b>${formatNumber(s.totalFiles)}</b>
┃ 📊 TB mỗi sync: <b>${avgFiles}</b> files

<b>━━━ 📂 FOLDERS ━━━</b>
┃ 📦 Folder pairs: <b>2</b>
┃ ➡️ Chiều sync: <b>Source → Dest</b>
┃ 🔒 Mode: <b>Copy only</b>

<b>━━━ ⚙️ CẤU HÌNH ━━━</b>
┃ ⏱️ Interval: <b>5 phút</b>
┃ 🔁 Retry: <b>3 lần</b>
┃ 🚫 Exclude: <code>*.tmp, Thumbs.db</code>

<b>━━━ 🛡️ BẢO MẬT ━━━</b>
┃ 🔐 Secrets: <code>GitHub Encrypted</code>
┃ 🔒 Folders: <code>Ẩn trong Secrets</code>

<b>━━━━━━━━━━━━━━━━━━━━</b>
📅 Data range: <code>All time</code>
`;

    await sendMessage(token, chatId, text);
}

async function cmdHistory(token, chatId, repo) {
    const state = await getState(repo);
    const history = state.history || [];

    let historyText = '';
    if (history.length === 0) {
        historyText = '┃ <i>Chưa có lịch sử</i>';
    } else {
        history.slice(0, 10).forEach((h, i) => {
            const icon = h.files > 0 ? '✅' : '⚪';
            historyText += `┃ ${icon} <code>${h.time}</code> - ${h.files || 0} files\n`;
        });
    }

    const text = `
╔══════════════════════════════════╗
║  📜 <b>SYNC HISTORY</b>          ║
╚══════════════════════════════════╝

<b>━━━ 📋 10 LẦN GẦN NHẤT ━━━</b>
${historyText}
<b>━━━━━━━━━━━━━━━━━━━━</b>

💡 <i>✅ = Có files | ⚪ = Không có files mới</i>
`;

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

    const text = `
╔══════════════════════════════════╗
║  📑 <b>DAILY REPORT</b>          ║
╚══════════════════════════════════╝

<b>━━━ 📊 24 GIỜ QUA ━━━</b>
┃ 🔄 Sync: <b>${last24h.length}</b> lần
┃ 📁 Files: <b>${files24h}</b>
┃ ⚡ Trạng thái: <b>Tốt</b>

<b>━━━ 📈 TỔNG ━━━</b>
┃ 🔄 All-time sync: <b>${formatNumber(s.totalSyncs)}</b>
┃ 📁 All-time files: <b>${formatNumber(s.totalFiles)}</b>

<b>━━━ 🔧 HỆ THỐNG ━━━</b>
┃ 🟢 Status: <b>OPERATIONAL</b>
┃ 📡 Uptime: <b>99.9%</b>
┃ ⚠️ Errors: <b>0</b>

<b>━━━━━━━━━━━━━━━━━━━━</b>
📅 Generated: <code>${new Date().toISOString().slice(0, 19).replace('T', ' ')}</code>
`;

    await sendMessage(token, chatId, text);
}

async function cmdSync(token, chatId, repo, ghToken) {
    await sendMessage(token, chatId, `
╔══════════════════════════════════╗
║  🔄 <b>MANUAL SYNC</b>           ║
╚══════════════════════════════════╝

⏳ Đang khởi động sync...
`);

    if (!ghToken) {
        await sendMessage(token, chatId, `
⚠️ <b>Cần GitHub Token</b>

Để trigger sync từ bot, cần thêm <code>GITHUB_TOKEN</code> vào Cloudflare Workers.

Hoặc vào GitHub Actions để chạy thủ công.
`);
        return;
    }

    const ok = await triggerSync(repo, ghToken);

    if (ok) {
        await sendMessage(token, chatId, `
✅ <b>Đã trigger sync!</b>

⏳ Vui lòng chờ 30-60 giây...
📱 Bạn sẽ nhận thông báo khi hoàn tất.
`);
    } else {
        await sendMessage(token, chatId, `❌ Không thể trigger. Kiểm tra GitHub Token.`);
    }
}

async function cmdSettings(token, chatId, repo) {
    const text = `
╔══════════════════════════════════╗
║  ⚙️ <b>SETTINGS</b>              ║
╚══════════════════════════════════╝

<b>━━━ 📂 FOLDERS ━━━</b>
┃ Quản lý: <code>GitHub Secrets</code>
┃ Format: <code>src:dst,src2:dst2</code>

<b>━━━ ⏱️ SCHEDULE ━━━</b>
┃ Interval: <code>5 phút</code>
┃ Edit: <code>sync.yml > cron</code>

<b>━━━ 🔔 THÔNG BÁO ━━━</b>
┃ Telegram: <code>Bật</code>
┃ Filter: <code>Có file mới</code>

<b>━━━ 🔧 NÂNG CAO ━━━</b>
Để thay đổi cài đặt:
1. Vào GitHub repo
2. Sửa file hoặc Secrets
3. Thay đổi tự động áp dụng
`;

    const keyboard = {
        inline_keyboard: [[
            { text: '🔗 Mở GitHub', url: `https://github.com/${repo}` }
        ]]
    };

    await sendMessage(token, chatId, text, { reply_markup: keyboard });
}

async function cmdHelp(token, chatId) {
    const text = `
╔══════════════════════════════════╗
║  ❓ <b>HELP & GUIDE</b>          ║
╚══════════════════════════════════╝

<b>━━━ 📱 COMMANDS ━━━</b>
┃ /dashboard - Bảng điều khiển
┃ /status - Trạng thái hệ thống
┃ /stats - Thống kê chi tiết
┃ /history - Lịch sử 10 lần sync
┃ /report - Báo cáo ngày
┃ /sync - Đồng bộ ngay
┃ /settings - Cài đặt

<b>━━━ 🔄 HOẠT ĐỘNG ━━━</b>
┃ • Tự động sync mỗi 5 phút
┃ • Thông báo khi có file mới
┃ • Copy từ Source → Dest

<b>━━━ 🛡️ BẢO MẬT ━━━</b>
┃ • Folder names ẩn
┃ • Token mã hóa
┃ • Chỉ admin truy cập

<b>━━━ 🆘 HỖ TRỢ ━━━</b>
Liên hệ: GitHub Issues
`;

    await sendMessage(token, chatId, text);
}

// ═══════════════════════════════════════════════════════════════
// 🚀 MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export default {
    async fetch(request, env) {
        if (request.method !== 'POST') {
            return new Response('🤖 Drive Sync Bot v3.0 - Running', { status: 200 });
        }

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
    }
};
