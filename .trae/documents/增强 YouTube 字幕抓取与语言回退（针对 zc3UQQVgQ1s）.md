## 现象与推断
- 提供的链接：`https://www.youtube.com/watch?v=zc3UQQVgQ1s`（中文标题视频）。
- 预览环境仍无字幕：很可能该视频的可下载字幕轨不在 `en`，或只有自动语音识别轨道且需要带上 `name/kind` 才能命中；也可能只有中文轨或官方未开放下载。

## 服务端增强（/api/youtube-captions）
1. 轨道枚举返回：新增 `listTracks(videoId)`，将 `type=list` 的所有轨道原样返回到 `meta.tracks`（不包含任何密钥），便于在前端查看与选择。
2. 语言优先级与自动选择：
   - 若前端传 `lang` → 优先按此语言选择轨道；
   - 否则自动选择，顺序：`en` → `en-US` → `en-GB` → `zh-Hans` → `zh-Hant` → `zh` → 列表第一项；
   - 请求时携带 `lang/name/kind` 三个参数，提升命中率。
3. 多格式回退：尝试顺序 `fmt=srv3` → `fmt=vtt`（若可用）→ 无格式 `XML(Extensible Markup Language)`；解析为统一 `segments`。
4. 容错输出：失败时仍返回 200 与空 `segments`，并在 `meta` 附上 `tracks` 与 `reason` 便于定位。

## 前端增强（PlayerPage）
1. 自动加载：进入 `source === 'youtube'` 时，先请求 `/api/youtube-captions?videoId=...`（不带 `lang`），使用服务端自动选择语言；若 `segments` 为空但 `meta.tracks` 非空，显示“检测到可用轨道”提示 + 下拉选择框。
2. 语言切换：在提示中选择语言后，再次请求 `/api/youtube-captions?videoId=...&lang=xx` 并更新列表与叠加字幕层。
3. 交互保持一致：列表跳句、单句循环、叠加字幕点击查词、倍速等逻辑不变。

## 验证步骤（针对 zc3UQQVgQ1s）
1. 在 TED 页输入该链接，进入播放器；
2. 看右侧是否出现字幕；若仍为空，检查提示中的 `tracks` 列表并选择 `zh` 或 `zh-Hans/zh-Hant`（若英语轨不存在）；
3. 切换语言后应出现字幕并高亮同步。

## 发布
- 继续在分支：`feature/youtube-url`；推送后在 Vercel Preview 验证。
- Production 不受影响，只有当你合并到 `main` 后才会更新。

如确认，我将立即按上述增强实现并推送，随后提供 Preview 链接用于你验证该具体视频的字幕抓取。