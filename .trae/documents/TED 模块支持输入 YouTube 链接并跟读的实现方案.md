## 目标与范围
- 在 TED 标签页支持输入 YouTube 链接 `URL(Uniform Resource Locator)`，解析 `videoId(Identifier)` 并导航到播放器。
- 服务端新增 `/api/youtube-captions`，优先使用 `timedtext` 接口获取字幕，在服务端解析为统一 `segments(JSON(JavaScript Object Notation))`：`{ start, end, original, translation? }`。
- 前端播放器复用现有跟读逻辑（叠加高亮、右侧列表、单句循环、点击跳句、查词、倍速等），仅将数据来源改为新接口。
- 若无可用字幕或抓取失败，给出提示并允许上传本地字幕继续学习。
- 不暴露任何密钥，所有调用均经服务端；为后续切换或混合 `YouTube Data Application Programming Interface v3` 预留结构。

## 技术方案
### 一、后端字幕抓取服务
- 新增服务模块：`api/lib/youtubeCaptions.js`
  - `getCaptions(videoId, lang='en')`：
    1. 请求列表：`https://www.youtube.com/api/timedtext?type=list&v={videoId}`，解析可用轨道与语言，选择优先语言或最匹配的英文轨道；记录是否为自动识别（`asr`）。
    2. 抓取字幕（优先）：`https://www.youtube.com/api/timedtext?lang={lang}&v={videoId}&fmt=srv3`；若失败或无 `srv3`，回退到 `XML(Extensible Markup Language)` 版本：`https://www.youtube.com/api/timedtext?lang={lang}&v={videoId}`。
    3. 解析输出统一结构：`[{ start:Number, end:Number, original:String }]`，保留 `meta:{ lang, hasAuto:Boolean }`。
  - 解析细节：
    - `srv3`：遍历 `events`，拼接 `segs[].utf8`；`start = tStartMs/1000`，`end = (tStartMs + dDurationMs)/1000`。
    - `XML`：解析 `<text start="..." dur="...">...</text>`，解码实体与换行。
- Serverless 接口：`api/youtube-captions.js`
  - 校验 `videoId(Identifier)` 与可选 `lang/targetLang` 参数。
  - 调用 `getCaptions` 并返回：`{ segments, meta }`。
  - 错误处理与缓存提示头；限制来源与速率（简易节流）。

### 二、前端页面改动
- TED 标签页：`src/components/UploadPage.jsx`
  - 在 TED 区块加入输入框与校验，支持多种链接形态（`watch?v=...`、`youtu.be/...`、`shorts/...`）。
  - 解析出 `videoId(Identifier)` 后，`navigate('/player', { state: { source: 'youtube', videoId } })`。
- 播放器页：`src/components/PlayerPage.jsx`
  - 增加 `source === 'youtube'` 的加载分支：
    - 进入页面后请求 `/api/youtube-captions`，将返回的 `segments` 映射到现有 `subtitles` 数据结构并设置。
    - 播放器渲染：新增 `YouTube` 嵌入容器与 `IFrame(Inline Frame)` 播放器脚本初始化；通过 `onStateChange` 与定时轮询 `getCurrentTime()` 更新 `currentTime`，实现与本地模式一致的时间同步与高亮匹配。
    - 将叠加字幕层显示在视频之上（容器内 `absolute + z-index`），保持可点击词与句子弹窗行为一致。
  - 交互复用：保持 `togglePlay / handleSubtitleClick / loopSentence / renderOriginalWithSpans / onWordClick` 等逻辑与样式不变。
  - 失败回退：若抓取失败或无字幕，显示提示，并允许用户上传字幕文件，复用本地模式的替换入口。

### 三、为后续 `YouTube Data Application Programming Interface v3` 预留
- 服务模块以 `provider` 可配置方式封装：`provider: 'timedtext' | 'youtube-data-api' | 'hybrid'`。
- 当后续接入 `YouTube Data Application Programming Interface v3`：
  - 从 `captions.list` 获取轨道，`captions.download` 拉取字幕文件；在服务端同样解析为统一 `segments` 并返回，前端无需改动。

## 代码定位与复用点
- 路由与导航：`src/App.jsx:16–18`。
- TED 页：`src/components/UploadPage.jsx:29–31, 132–151`（标签控制）；跳转示例：`src/components/UploadPage.jsx:48–52`。
- 播放器页：
  - 本地视频与 TED 嵌入处：`src/components/PlayerPage.jsx:1621–1639`。
  - 字幕解析与渲染与交互：`src/components/PlayerPage.jsx:66–330, 757–771, 824–851, 1673–1692, 1090–1161`。

## 验证与发布
- 新建分支：`feature/youtube-url`；仅在该分支开发提交。
- 推送后 Vercel 自动生成 Preview 部署链接，用于全面测试：
  - 多种 YouTube 链接解析、字幕抓取成功率、时间同步与高亮、单句循环与跳转、点击查词与倍速控制。
- 只有你在 GitHub 将 `feature/youtube-url` 合并到 `main` 后，Vercel 才会更新 Production（`https://www.speakduck.com`）。

## 风险与应对
- 视频无字幕或受限：提示并回退上传本地字幕继续学习。
- 自动语音识别质量：在界面上标记“自动字幕”，必要时建议用户上传更高质量字幕。
- 请求频率与延迟：对字幕抓取做服务端缓存；对句级翻译与查词做节流与缓存。

如确认，请授权我开始在 `feature/youtube-url` 分支实现上述改动并提供 Vercel Preview 链接。