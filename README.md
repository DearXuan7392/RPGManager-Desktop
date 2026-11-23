# RPG Maker 游戏启动器（Desktop）

基于 NW.js 的 RPG Maker 游戏启动工具。公共逻辑在 [RPGManager-Core](https://github.com/DearXuan7392/RPGManager-Core) 子模块 `core/`。

## 功能

- 游戏启动与管理
- 控制台调试
- 资源解密与完整解密副本
- 存档备份与在线编辑

## 获取与使用

```bash
git clone --recurse-submodules git@github.com:DearXuan7392/RPGManager-Desktop.git
```

已克隆但未带子模块时：

```bash
git submodule update --init --recursive
```

1. 下载 NW.js SDK 版，解压到项目根目录，使 `nw.exe` 与 `package.json`、`menu/` 同级。
2. 启动 `nw.exe`，生成 `games` 目录。可用 `mklink /J games D:\path\to\games` 指向其他位置。
3. 将游戏目录复制到 `games/<游戏名>/`，目录需包含 `index.html`（或 `www/index.html`）。
4. 重新启动 `nw.exe`，从列表打开游戏。

## 常见问题

### 没有 www 文件夹

部分游戏资源直接在根目录。只要包含 `index.html`、`data/`、`img/`、`js/` 等，可直接复制为 `games/<游戏名>/`。

### 提示文件不存在

部分游戏带反调试检测，通常调用 `process.exit`。检索相关代码后删除检测逻辑。
