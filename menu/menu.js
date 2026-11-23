// menu.js
const nwGui = require('nw.gui');
const { exec } = require('child_process');
const core = require('../core');

let rightClickedGamePath = null;

// 【状态锁】：标识当前是否正有解密任务在运行
let isDecrypting = false;

function openFolder(dir) {
    const cmd = process.platform === 'win32' ? 'explorer' : 'open';
    exec(`${cmd} "${dir}"`);
}

function showProgress(title) {
    const overlay = document.createElement('div');
    overlay.className = 'decrypt-progress-overlay';
    overlay.innerHTML = `
        <div class="decrypt-progress-box">
            <div class="decrypt-progress-title">${title}</div>
            <div class="decrypt-progress-bar-bg">
                <div id="decrypt-bar-fill" class="decrypt-progress-bar-fill"></div>
            </div>
            <div id="decrypt-bar-text" class="decrypt-progress-text">正在初始化列表...</div>
        </div>
    `;
    document.body.appendChild(overlay);
    const barFill = document.getElementById('decrypt-bar-fill');
    const barText = document.getElementById('decrypt-bar-text');
    return {
        update: function (current, total) {
            const percent = total > 0 ? Math.floor((current / total) * 100) : 0;
            barFill.style.width = `${percent}%`;
            barText.innerText = `当前进度：${percent}% (${current}/${total})`;
        },
        close: function () {
            if (overlay.isConnected) document.body.removeChild(overlay);
        }
    };
}

// ==========================================
// 功能一：解密 img 资产到 <game>/decrypt_img/
// ==========================================
async function startImageDecryption(gamePath) {
    if (isDecrypting) return;
    const imgDir = nodePath.join(gamePath, 'img');
    if (!nodeFs.existsSync(imgDir)) {
        alert("未找到该游戏的 img 资源文件夹！");
        return;
    }

    isDecrypting = true;
    const ui = showProgress('正在解密游戏图像资产...');
    try {
        const result = await core.decryptImages(gamePath, {
            onProgress: function (p) { ui.update(p.current, p.total); }
        });
        if (result.reason === 'missing-img' || result.reason === 'empty-img') {
            alert(result.reason === 'missing-img' ? '未找到该游戏的 img 资源文件夹！' : 'img 文件夹为空');
        } else if (result.reason === 'not-encrypted') {
            openFolder(imgDir);
        } else if (result.ok) {
            openFolder(result.outputDir);
        }
    } catch (err) {
        console.error('图片解密失败:', err);
        alert('图片解密失败: ' + err.message);
    } finally {
        ui.close();
        isDecrypting = false;
    }
}

// ==========================================
// 功能二：克隆一份完全解密的可玩游戏副本
// ==========================================
async function startFullGameDecryption(gamePath) {
    if (isDecrypting) return;

    isDecrypting = true;
    const ui = showProgress('正在解密并克隆完整可玩游戏副本...');
    try {
        const result = await core.cloneDecryptedGame(gamePath, {
            onProgress: function (p) { ui.update(p.current, p.total); }
        });
        if (!result.ok) {
            alert('未在游戏内检测到任何文件！');
            return;
        }
        if (typeof window.loadGameList === 'function') {
            window.loadGameList();
        }
        alert(`完整游戏解密完成！已作为独立解密版游戏克隆至同级目录。\n列表已自动更新。`);
    } catch (err) {
        console.error('完整解密失败:', err);
        alert('完整解密失败: ' + err.message);
    } finally {
        ui.close();
        isDecrypting = false;
    }
}

// 打开在线存档编辑器前自动备份
function backupSaveFiles(gamePath) {
    const savePath = nodePath.join(gamePath, 'save');
    if (!nodeFs.existsSync(savePath)) {
        nodeFs.mkdirSync(savePath);
        return;
    }
    try {
        const now = new Date();
        core.listSaves(gamePath)
            .filter(save => !save.name.includes('.backup_'))
            .forEach(save => {
                const backup = nodePath.join(savePath, core.backupSaveName(save.name, now));
                nodeFs.copyFileSync(save.path, backup);
            });
    } catch (e) {
        console.error("备份失败:", e);
    }
}

// ==========================================
// NW.js 原生上下文菜单配置
// ==========================================
const nativeMenu = new nwGui.Menu();

nativeMenu.append(new nwGui.MenuItem({
    label: '打开文件夹',
    click: () => {
        if (!rightClickedGamePath) return;
        openFolder(rightClickedGamePath);
    }
}));

nativeMenu.append(new nwGui.MenuItem({
    label: '打开存档',
    click: () => {
        if (!rightClickedGamePath) return;
        const savePath = nodePath.join(rightClickedGamePath, 'save');
        if (!nodeFs.existsSync(savePath)) nodeFs.mkdirSync(savePath);
        openFolder(savePath);
    }
}));

nativeMenu.append(new nwGui.MenuItem({ type: 'separator' }));

// 实例化菜单项一：仅解密图片
const decryptImgItem = new nwGui.MenuItem({
    label: '解密全部图片资产',
    click: () => {
        if (!rightClickedGamePath) return;
        startImageDecryption(rightClickedGamePath);
    }
});
nativeMenu.append(decryptImgItem);

// 实例化菜单项二：解密独立完整游戏并刷新列表
const decryptFullGameItem = new nwGui.MenuItem({
    label: '解密完整游戏 (还原原始资产)',
    click: () => {
        if (!rightClickedGamePath) return;
        startFullGameDecryption(rightClickedGamePath);
    }
});
nativeMenu.append(decryptFullGameItem);

nativeMenu.append(new nwGui.MenuItem({
    label: '编辑存档 (在线)',
    click: () => {
        if (!rightClickedGamePath) return;
        backupSaveFiles(rightClickedGamePath);
        const savePath = nodePath.join(rightClickedGamePath, 'save');
        openFolder(savePath);
        nwGui.Shell.openExternal('https://saveeditor.online/');
    }
}));

// 右键事件监听
document.getElementById('game-list').addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.game-card');
    if (!card) return;
    e.preventDefault();

    rightClickedGamePath = card.dataset.gamePath;

    if (isDecrypting) {
        decryptImgItem.enabled = false;
        decryptFullGameItem.enabled = false;
        decryptFullGameItem.label = '游戏解密中 (请稍候...)';
    } else {
        decryptImgItem.enabled = true;
        decryptFullGameItem.enabled = true;
        decryptFullGameItem.label = '解密完整游戏 (还原原始资产)';
    }

    nativeMenu.popup(e.clientX, e.clientY);
}, false);
// 屏蔽默认右键菜单：只有「游戏卡片」上保留（由上面的原生菜单接管）
document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest || !e.target.closest('.game-card')) {
        e.preventDefault();
    }
}, true);
