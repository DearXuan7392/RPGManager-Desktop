// saveEditor.js
// core 由 index.html 内联脚本统一声明，避免多个经典脚本重复 const 冲突

let currentGamePath = null;       // 当前游戏根目录
let currentSavePath = null;       // 当前正在编辑的游戏 save 文件夹绝对路径
let activeSaveFileName = null;    // 当前选中的存档文件名 (例如 file1.rpgsave)
let currentDecryptedData = null;  // 当前解密后的 JSON 对象

const modal = document.getElementById('save-editor-modal');
const modalTitle = document.getElementById('modal-game-title');
const modalSaveList = document.getElementById('modal-save-list');
const modalEditForm = document.getElementById('modal-edit-form');
const confirmBtn = document.getElementById('btn-confirm-save');

// 关闭弹窗
document.getElementById('close-modal').onclick = () => modal.style.display = 'none';
document.getElementById('btn-cancel-save').onclick = () => modal.style.display = 'none';

// 打开编辑器主入口
function openSaveEditor(gameName, gamePath) {
    modalTitle.innerText = `存档编辑器 - ${gameName}`;
    currentGamePath = gamePath;
    currentSavePath = nodePath.join(gamePath, 'save');
    activeSaveFileName = null;
    currentDecryptedData = null;
    confirmBtn.disabled = true;
    
    if (!nodeFs.existsSync(currentSavePath)) {
        nodeFs.mkdirSync(currentSavePath);
    }
    
    modal.style.display = 'flex';
    refreshSaveFileList();
}

// 扫描并刷新左侧存档列表
function refreshSaveFileList() {
    modalSaveList.innerHTML = '';
    modalEditForm.innerHTML = '<p style="color: #888;">请在左侧选择要编辑的存档文件...</p>';
    
    try {
        const saveFiles = core.listSaves(currentGamePath);

        if (saveFiles.length === 0) {
            modalSaveList.innerHTML = '<p style="color:#666;font-size:12px;">暂无存档</p>';
            return;
        }

        saveFiles.forEach(save => {
            const btn = document.createElement('button');
            btn.className = 'save-item-btn';
            // 精简显示名称，如 file1.rpgsave -> 存档 1
            btn.innerText = save.name.replace(/file/i, '存档 ').replace('.rpgsave', '');
            btn.onclick = () => loadSaveFile(save.name, btn);
            modalSaveList.appendChild(btn);
        });
    } catch (e) {
        console.error("扫描存档失败:", e);
    }
}

// 加载并解密选中的存档 (强力兼容 MV/MZ 版)
function loadSaveFile(fileName, btnElement) {
    document.querySelectorAll('.save-item-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    
    activeSaveFileName = fileName;
    const fullPath = nodePath.join(currentSavePath, fileName);
    
    try {
        const rawContent = nodeFs.readFileSync(fullPath, 'utf8').trim();
        const decompress = window.LZString && typeof window.LZString.decompressFromBase64 === 'function'
            ? window.LZString.decompressFromBase64.bind(window.LZString)
            : null;

        // 解码规则统一由 Core 提供；MV 旧存档的 LZString 由游戏页面注入
        currentDecryptedData = core.decodeSave(rawContent, decompress);
        renderEditForm();
        confirmBtn.disabled = false;
    } catch (err) {
        console.error("解密调试错误日志:", err);
        modalEditForm.innerHTML = `<p style="color: #ff5252;">解析存档失败。<br>报错信息: ${err.message}<br><br><span style="color:#aaa;font-size:12px;">提示：请确认该游戏是否使用了特殊的外部加密插件。</span></p>`;
        confirmBtn.disabled = true;
    }
}

// 可视化渲染常用游戏变量
function renderEditForm() {
    modalEditForm.innerHTML = '';
    if (!currentDecryptedData) return;

    // 适配 RPG Maker MV/MZ 的标准存档数据结构
    // 1. 金币 (Gold) 通常在 party 对象中
    const party = currentDecryptedData.party || {};
    const gold = party._gold !== undefined ? party._gold : 0;

    // 2. 变量与开关 (Variables / Switches)
    const variables = currentDecryptedData.variables || { _data: [] };
    
    // 创建金币编辑项
    modalEditForm.appendChild(createFormInput('金币 (Gold)', 'gold', gold, 'number'));

    // 3. 动态渲染部分主要角色等级 (Actors)
    const actors = currentDecryptedData.actors || { _data: [] };
    if (actors._data && actors._data.length > 0) {
        actors._data.forEach((actor, index) => {
            if (actor && actor._name) {
                modalEditForm.appendChild(createFormInput(`${actor._name} (等级)`, `actor_level_${index}`, actor._level || 1, 'number'));
            }
        });
    }
    
    // 如果想要修改特定变量，可以追加：
    // modalEditForm.appendChild(createFormInput('游戏变量[1]', 'var_1', variables._data[1] || 0, 'number'));
}

// 工具函数：生成输入框 HTML
function createFormInput(labelText, id, value, type = 'text') {
    const div = document.createElement('div');
    div.className = 'form-group';
    
    const label = document.createElement('label');
    label.innerText = labelText;
    
    const input = document.createElement('input');
    input.type = type;
    input.id = `edit-${id}`;
    input.value = value;
    
    div.appendChild(label);
    div.appendChild(input);
    return div;
}

// 保存修改：执行备份并覆盖源文件
confirmBtn.onclick = () => {
    if (!currentSavePath || !activeSaveFileName || !currentDecryptedData) return;
    
    const srcFullPath = nodePath.join(currentSavePath, activeSaveFileName);
    
    try {
        // 1. 备份（命名规则来自 Core）
        const backupFileName = core.backupSaveName(activeSaveFileName);
        const backupFullPath = nodePath.join(currentSavePath, backupFileName);

        // 复制源文件到备份路径
        nodeFs.copyFileSync(srcFullPath, backupFullPath);
        console.log(`[存档器] 备份创建成功: ${backupFileName}`);

        // 2. 回写用户修改的数据到内存中的 JSON 对象
        // 回写金币
        if (currentDecryptedData.party && currentDecryptedData.party._gold !== undefined) {
            const goldInput = document.getElementById('edit-gold');
            if (goldInput) currentDecryptedData.party._gold = parseInt(goldInput.value) || 0;
        }
        // 回写角色等级
        if (currentDecryptedData.actors && currentDecryptedData.actors._data) {
            currentDecryptedData.actors._data.forEach((actor, index) => {
                if (actor) {
                    const levelInput = document.getElementById(`edit-actor_level_${index}`);
                    if (levelInput) actor._level = parseInt(levelInput.value) || 1;
                }
            });
        }

        // 3. 重新编码并覆盖写入（编码规则来自 Core）
        const encodedData = core.encodeSave(currentDecryptedData);

        nodeFs.writeFileSync(srcFullPath, encodedData, 'utf-8');
        
        alert(`存档保存成功！\n原文件已覆盖，备份已建立：\n${backupFileName}`);
        modal.style.display = 'none';
    } catch (err) {
        alert(`保存失败: ${err.message}`);
    }
};