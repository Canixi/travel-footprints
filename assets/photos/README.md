# 照片目录

建议按旅程建子文件夹，例如 `assets/photos/dali-2026/`，然后在 `data/trips.json` 中引用：

```json
"cover": "assets/photos/dali-2026/dali-town-dusk.jpg",
"photos": [
  {
    "src": "assets/photos/dali-2026/dali-town-dusk.jpg",
    "thumb": "assets/photos/dali-2026/dali-town-dusk-thumb.jpg",
    "caption": "大理古城 · 苍山日落"
  }
]
```

建议：

- 原图先压缩：长边 1600px 左右，JPEG 质量 80–85，单张 500KB 以内
- 同时生成一张 560px 左右的缩略图用于详情页照片集
- 手机原图通常带 GPS/EXIF 信息，公开前建议清除
- 尺寸 1200×800 左右的横图效果最好
- 文件名使用英文、数字和短横线，避免空格与中文；部署到 Linux 时注意大小写
- 不设置 `cover` 时会自动使用 `photos` 第一张；连照片都没有时使用 `coverGradient` 渐变封面
- `photos` 至少两张时，详情页会显示照片集；点击缩略图可打开灯箱，方向键切换、Esc 关闭
