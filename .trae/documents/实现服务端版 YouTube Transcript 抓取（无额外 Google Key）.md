## 目标
- 新增统一接口 `GET /api/youtube-transcript?videoId=...&lang=...`，所有抓取在服务端完成，不使用任何新的 Google Key。
- 实现“优先 YouTube Innertube(内部数据接口) → 回退公开 timedtext”的混合方案，返回统一的 `segments(JSON(JavaScript Object Notation))`：`[{ start, end, original, translation? }]`，并附带可选轨道列表供前端选择语言。

## 抓取流程（服务端）
1. 抓取 watch 页 HTML：`https://www.youtube.com/watch?v={videoId}`，设置仿浏览器的 `User-Agent(用户代理)` 与 `Accept-Language(接受语言)`。
2. 解析关键 JSON：
   - 从 `window.ytcfg.set({...})` 提取 `INNERTUBE_API_KEY` 与 `INNERTUBE_CONTEXT.client.clientVersion`；
   - 从 `ytInitialData` 找到 `engagementPanelSectionListRenderer` 中的 `transcriptEndpoint.params`（这是 IFrame 打开“字幕/转录面板”时前端使用的参数）；
   - 从 `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks` 收集轨道列表（语言代码、名字、kind、baseUrl），作为回退与前端选择依据。
3. 优先调用 Innertube：
   - `POST https://www.youtube.com/youtubei/v1/get_transcript?key={INNERTUBE_API_KEY}`
   - 请求体：`{ context: { client: { clientName: "WEB", clientVersion, hl, gl } }, params }`（params 来自 `transcriptEndpoint.params`）。
   - 解析响应：`actions[0].updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer.cueGroups[].cues[].transcriptCueRenderer`，提取 `startOffsetMs / durationMs / content.runs[].text` 并合并为句子。
4. 无 `params` 或调用失败 → 回退到公开 `timedtext`：
   - 使用 `captionTracks` 中与目标语言最匹配的轨道，携带 `lang/name/kind` 请求 `srv3`（优先）或 `vtt` 或 `XML(Extensible Markup Language)`，统一解析为 `segments`。
5. 输出：
   - 成功：`{ segments, meta: { lang, tracks, source: 'innertube'|'timedtext', hasAuto } }`
   - 失败：`{ segments: [], meta: { tracks }, error: 'fetch_failed', message }`（状态码仍为 200，便于前端兜底）。

## 前端使用
- 在 `source === 'youtube'` 时改为请求 `/api/youtube-transcript?videoId=...`（不带 `lang`），若 `segments` 为空但存在 `meta.tracks`，显示语言下拉，选择后再次请求 `/api/youtube-transcript?videoId=...&lang=xx`。
- 其余跟读逻辑保持不变（叠加字幕高亮、列表跳句、单句循环、点击查词、倍速等）。

## 安全与稳定
- 所有调用在服务端完成，不暴露任何密钥；仅返回解析后的纯文本与时间片段。
- 设置合理的 `Cache-Control(缓存控制)` 与简单速率限制；对错误统一容错返回，不影响前端交互。

## 里程碑
1. 新增 `api/youtube-transcript.js`，实现上述优先/回退逻辑与解析；
2. 前端 `PlayerPage` 切换到新接口，并保留语言选择与兜底上传字幕；
3. 在 `feature/youtube-url` 分支推送，提供 Vercel Preview 用于测试。

## 验证
- 使用你提供的链接 `zc3UQQVgQ1s` 验证：自动抓取 → 若为空，显示轨道选择（中文/英文）→ 选择后抓取成功并填充列表与叠加层。

如确认，我将按该方案在 `feature/youtube-url` 分支上实现并推送，随后返回 Preview 链接供你测试。