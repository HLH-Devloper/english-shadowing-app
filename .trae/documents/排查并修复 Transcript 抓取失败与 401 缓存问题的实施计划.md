## 现象复盘
- 前端在最新 Preview 环境仍显示“当前未检测到可用字幕”，Network 中出现旧接口或新接口返回空。
- Vercel Logs 中对 `GET /api/youtube-transcript` 显示 `Cache Unauthorized 401`，疑似边缘缓存/防火墙标记，或返回的 HTML 为同意页/区域化替代页导致解析失败。

## 目标
- 彻底确认服务端抓取流程每一步的状态（watch HTML、ytcfg、params、captionTracks、Innertube 调用、timedtext 回退）。
- 避免边缘缓存对 `/api/youtube-transcript` 的干扰，确保每次请求都是新鲜抓取。
- 增强解析与回退：多标记位提取、直接使用 `captionTracks.baseUrl`、地区同意页规避。

## 服务端改动
1. `/api/youtube-transcript` 增加详细日志：
   - 打点输出：watch 状态码、是否解析到 `INNERTUBE_API_KEY`、`clientVersion`、`params`、轨道数量；Innertube 调用状态码与段数；timedtext 回退段数。
   - 使用结构化 `console.log`，便于在 Vercel Logs 中筛选。
2. 关闭缓存：
   - 将 `Cache-Control` 改为 `no-store` 暂时绕过边缘缓存，根据日志定位后再恢复合理缓存。
3. 解析增强：
   - ytcfg 提取除 `ytcfg.set` 外，同时尝试 `window["ytcfg"] = {...}` 等变体；
   - `ytInitialData`/`ytInitialPlayerResponse` 解析尝试多种标记组合（`var ... =` 与 `window[...] =`）。
4. 轨道直接回退：
   - 若存在 `captionTracks.baseUrl`，优先直接请求 `baseUrl`（包含已签名 query），避免自行拼装参数失败。
   - 继续保留 `srv3 → vtt → XML(Extensible Markup Language)` 的多格式解析。
5. 同意页规避：
   - 请求 watch 页时附带 `Referer` 与 `CONSENT=YES+` 的轻量 Cookie（不涉及密钥），配合 `Accept-Language: en-US`，降低返回同意页概率。

## 前端核验
- 保持现有逻辑：先自动请求 `/api/youtube-transcript`；若 `segments` 为空但 `meta.tracks` 非空，展示语言下拉并重试抓取。
- 在右侧面板显示抓取来源与提示（`source: innertube/timedtext`），帮助定位具体问题（可选）。

## 验证路径
- 使用你提供的链接与一个确认有 `Closed Caption` 的对照视频同时测试：
  - 查看 Vercel Logs：各阶段打点与最终 `segments` 计数；
  - 前端：轨道选择是否出现，选择后是否成功。

## 发布
- 在 `feature/youtube-url` 分支完成上述改动并推送，等待最新 Preview 构建；
- 你用最新 Preview 链接测试；若仍失败，我将根据日志继续定向修复直至稳定抓取或明确判定该视频无轨。

如确认，开始实施上述排查与修复流程，并在完成后提供新的 Preview 链接与日志摘要供你验证。