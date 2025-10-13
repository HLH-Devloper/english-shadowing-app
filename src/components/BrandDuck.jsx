import React, { useState } from 'react'

// 品牌鸭子组件：支持自定义文件名，加载失败时回退到备用文件名。
export default function BrandDuck({ src = '/duck-follow-me.png', fallbackSrc = '/duck-follow-me2.png' }) {
  const [imgSrc, setImgSrc] = useState(src)
  return (
    <img
      src={imgSrc}
      alt="跟读鸭"
      className="duck-logo-img"
      width={48}
      height={48}
      loading="eager"
      onError={() => { if (imgSrc !== fallbackSrc) setImgSrc(fallbackSrc) }}
    />
  )
}