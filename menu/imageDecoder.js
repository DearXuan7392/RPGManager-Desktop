const nodeFs = require('fs');
const nodePath = require('path');
const core = require('../core');

/** 兼容旧调用：解密逻辑已收敛到 RPGManager-Core */
function superDecryptImage(encryptedBuffer, keyHex) {
    return core.decrypt(encryptedBuffer, keyHex);
}

/**
 * 找游戏标题图并转成可用于 CSS background 的 URL。
 * 定位与解密规则全部来自 Core，本文件只负责拼 file:/// 或 data: URL。
 */
function getTrueGameBackgroundImage(gamePath) {
    const file = core.findTitleImage(gamePath);
    if (!file) return null;

    const ext = nodePath.extname(file).toLowerCase();
    try {
        if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
            const key = core.readGameInfo(gamePath).encryptionKey;
            const raw = core.decrypt(nodeFs.readFileSync(file), key);
            return `data:image/png;base64,${raw.toString('base64')}`;
        }
        return 'file:///' + file.replace(/\\/g, '/');
    } catch (err) {
        console.error('[解密器] 背景图处理失败:', err);
        return null;
    }
}

module.exports = { getTrueGameBackgroundImage, superDecryptImage };
