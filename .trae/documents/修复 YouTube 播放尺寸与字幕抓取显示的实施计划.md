## 目标
- 在 /player 检测到 `source === 'youtube'` 时，自动抓取并显示 YouTube 字幕，填充右侧字幕列表与视频叠加层；调用失败时回退到“上传字幕文件”。
- 让 YouTube IFrame(Inline Frame) 播放器在中间主区域按 16:9 尺寸自适配，宽度占满，效果与原生 `<video>` 基本一致。

## 实施要点
### 1. 路由与参数
- 在 TED 页导航：`navigate('/player', { state: { source: 'youtube', videoId } })`。
- 在 `src/components/PlayerPage.jsx` 中读取 `source、videoId` 并计算 `useYoutube = source === 'youtube'`。

### 2. 自动加载字幕
- `useEffect`（YouTube 分支）调用：`GET /api/youtube-captions?videoId=${videoId}&lang=en`。
- 返回结构：`{ segments: [{ start, end, original, translation? }], meta }`。
- 映射到现有字段：`{ id, startTime, endTime, text, original, translation }` 并 `setSubtitles([...])、setActiveIndex(0)`。
- 成功后：
  - 右侧“字幕列表”显示数据；
  - 叠加字幕层显示当前句（可点击查词）。
- 失败或列表为空：
  - 显示“当前未检测到可用字幕，请上传字幕文件”；
  - 保留上传入口（已有逻辑）。

### 3. 放大 YouTube 播放器
- 结构：在 `video-canvas` 中渲染 `yt-embed-wrapper` 容器包裹注入的 `#yt-player`。
- 样式（写入 `src/index.css` 或现有样式文件）：
  - `.yt-embed-wrapper`: `position: relative; width: 100%; height: 100%;`；
  - `.yt-embed-wrapper > iframe, #yt-player iframe`: `position: absolute; inset: 0; width: 100%; height: 100%;`；
  - `video-canvas` 若采用固定高度，补充 `aspect-ratio: 16 / 9` 或用 `padding-top: 56.25%` 技巧确保高度；
  - 保持与 `.video-player` 一致的边距与圆角（如项目中已有）。
- 初始化后添加 `ResizeObserver`：在容器尺寸变化时调用 `player.setSize(width, height)`，避免缩放后出现留白。

### 4. 交互一致性
- 列表点击：`YT.seekTo(startTime, true)`；
- 单句循环：在时间轮询中按当前句边界回退；
- 倍速/音量：`YT.setPlaybackRate(rate)`、`YT.setVolume(volume*100)`；
- 字幕叠加层与点击查词保留现有行为。

### 5. 测试与发布
- 新建功能分支：`feature/youtube-url`。
- 本地：尺寸与交互可用；若本地 `/api` 不可用，按项目规则在 Vercel Preview 上测试字幕抓取。
- 推送后在 Vercel Preview 验证：
  - YouTube 链接解析 → 自动加载字幕 → 高亮与列表滚动；
  - 失败回退上传逻辑；
  - 播放器尺寸填满中间区域，按 16:9 自适应。
- 由你决定何时将该分支合并到 `main`，Production 随后自动更新。

确认后我将按此方案在 `feature/youtube-url` 分支完成改动并提供 Preview 链接。