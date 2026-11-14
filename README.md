# 我的旅行足迹 · Travel Journal

一本旅行手账风格的个人足迹地图：去过的城市标在世界地图上，配照片、短游记和旅行统计。

- 离线世界地图（Natural Earth），不依赖任何地图瓦片服务，部署后可直接打开
- 手账卡片列表：城市、日期、照片/渐变封面、短摘、标签
- 地图以芜湖（家）为中心，放射状连接各目的地
- 年份筛选：卡片、地图标记、路线和统计同步更新
- 旅行笔记详情：长文、具体位置、距上一站距离，支持上一站 / 下一站
- 地图与列表联动、URL 深链（`#kyoto-2024`）、键盘操作、移动端适配
- 零构建、零运行时依赖、无 API Key

![首页预览](screenshots/index-desktop.png)

## 本地预览

需要 Node.js 18+（只用于启动静态服务器，不需要安装任何依赖）：

```bash
node serve.js
# 打开 http://localhost:4173
```

也可以用：

```bash
npm start
```

> 请通过本地服务器访问，不要直接双击 `index.html`。页面使用 `fetch` 读取地图和旅行数据，`file://` 协议下会被浏览器拦截。

## 项目结构

```
index.html                  页面结构
css/style.css               样式（顶部 CSS 变量可改主题）
js/app.js                   地图、筛选、详情等全部逻辑
data/trips.json             你的旅行数据（主要编辑这个文件）
data/world-110m.json        Natural Earth 世界地图数据（离线）
vendor/leaflet/             Leaflet 1.9.4（本地化，不依赖 CDN）
vendor/topojson-client.min.js
assets/photos/              真实照片放这里
assets/favicon.svg          站点图标
serve.js                    零依赖本地预览服务器
mockups/                    三套风格样张（可删除）
screenshots/                预览截图（可删除）
```

## 添加或修改旅程

打开 `data/trips.json`，在 `trips` 数组里增删条目即可，刷新页面生效。

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 唯一标识，会出现在分享链接里，如 `kyoto-2024` |
| `city` | 是 | 城市中文名 |
| `cityEn` | 建议 | 城市英文名，用于封面小字 |
| `country` | 是 | 国家 / 地区中文名 |
| `countryEn` | 建议 | 国家英文名，用于详情页眉 |
| `region` | 否 | 省 / 州，未设置 `location` 时用于兜底显示 |
| `location` | 否 | 具体位置，显示在详情页，写到省 · 市即可，如 `云南省 · 丽江市` |
| `lat` / `lng` | 是 | 纬度 / 经度（WGS84） |
| `start` / `end` | 是 | 起止日期，格式 `YYYY-MM-DD` |
| `cover` | 否 | 封面图片路径；留空时会自动使用 `photos` 第一张，再没有则使用渐变色 |
| `coverGradient` | 否 | 无照片时的渐变，三个颜色值 |
| `photos` | 否 | 照片集数组，详情页显示缩略图画廊，每项包含 `src`、`thumb`、`caption` |
| `excerpt` | 是 | 卡片上的短摘（一两句话） |
| `story` | 是 | 详情页长文 |
| `tags` | 否 | 标签数组 |
| `labelSide` | 否 | 设为 `left` 可让地图标签显示在左侧，用于避免相邻城市标签重叠 |

最小示例：

```json
{
  "id": "kyoto-2024",
  "city": "京都",
  "cityEn": "Kyoto",
  "country": "日本",
  "countryEn": "Japan",
  "location": "日本 · 京都市",
  "lat": 35.0116,
  "lng": 135.7681,
  "start": "2024-04-02",
  "end": "2024-04-07",
  "cover": "",
  "coverGradient": ["#f3c3cb", "#d99aa6", "#7e8b6a"],
  "excerpt": "樱花落进哲学之道的溪水里，岚山的竹林比想象中更安静。",
  "story": "四月第一周赶上满开……",
  "tags": ["樱花", "寺庙"]
}
```

页面会自动完成这些计算：

- 年份筛选项从数据里自动生成
- 列表按时间倒序排列（最新在前）
- 地图路线以芜湖（家）为起点，向各目的地放射
- 统计自动计算：城市数、国家/地区数、从芜湖（家）到各目的地的直线距离之和
- 详情页「距上一站」仍按行程顺序计算

坐标可以在 OpenStreetMap 上右键「显示地址」获取；注意使用 WGS84 坐标。

## 换成真实照片

1. 按旅程建文件夹，例如 `assets/photos/dali-2026/`
2. 把照片放进去，建议长边压缩到 1600px、单张 500KB 以内；拍摄设备原图通常带 GPS/EXIF 信息，公开前建议清除
3. 在对应旅程里设置 `cover` 和 `photos`：

```json
"cover": "assets/photos/dali-2026/dali-town-dusk.jpg",
"photos": [
  {
    "src": "assets/photos/dali-2026/dali-town-dusk.jpg",
    "thumb": "assets/photos/dali-2026/dali-town-dusk-thumb.jpg",
    "caption": "大理古城 · 苍山日落"
  },
  {
    "src": "assets/photos/dali-2026/erhai-lake.jpg",
    "thumb": "assets/photos/dali-2026/erhai-lake-thumb.jpg",
    "caption": "洱海 · 水边的树"
  }
]
```

- `cover` 用于首页卡片和详情页大图；`photos` 至少两张时，详情页会显示照片集缩略图
- 点击缩略图打开灯箱，可用左右方向键切换，Esc 关闭
- 没有 `thumb` 时会直接用 `src`；没有照片时自动使用 `coverGradient` 渐变封面
- 建议尺寸 1200×800 左右，横图效果最好；文件名使用英文、数字和短横线，部署到 Linux 时注意大小写

## 部署到公网

这是纯静态站点，不需要构建命令，也没有服务端依赖，所有地图数据都打包在项目里。

项目根目录已经准备好一个干净的部署包：

```
travel-site.zip
```

它只包含 `index.html`、`css/`、`js/`、`data/trips.json`、`data/world-110m.json`、`vendor/`、`assets/`，不包含 `mockups/`、`screenshots/`、`.mimosa/` 和示例数据。

### 方案一：Netlify Drop（最快）

1. 打开 [app.netlify.com/drop](https://app.netlify.com/drop)
2. 把 `travel-site.zip` 直接拖进去
3. 等待上传完成，会得到一个 `https://xxx.netlify.app` 的公开地址
4. 注册/登录后可以保留站点、改名字、绑定自己的域名

### 方案二：Cloudflare Pages（推荐长期使用）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Workers & Pages → Create → Pages → Upload assets
3. 项目名随意填写，上传 `travel-site.zip`
4. Deploy 后得到 `https://xxx.pages.dev` 地址
5. 后续更新时重新上传新的 zip 即可

### 方案三：GitHub Pages

1. 新建一个 GitHub 仓库，把站点文件推上去（`.gitignore` 已排除开发目录）
2. 仓库 Settings → Pages → Build and deployment → 选择分支根目录
3. 发布后得到 `https://<用户名>.github.io/<仓库名>/`

### 方案四：自己的服务器 / 国内云

- 上传解压后的站点文件到任意静态托管（阿里云 OSS、腾讯云 COS、轻量服务器 + Nginx 等）
- 国内服务器绑定自定义域名通常需要 ICP 备案；香港/海外服务器不需要备案，但访问速度可能不稳定

### 关于访问速度

Cloudflare Pages / Netlify / Vercel 的免费域名在中国大陆的访问速度不稳定，有时会较慢。如果主要给国内朋友看，优先考虑国内云静态托管 + 备案域名；如果只是个人分享，先用 `*.pages.dev` 或 `*.netlify.app` 测试即可。

### 临时演示（不推荐长期用）

如果只是想临时把本机页面发给别人看，可以在本机运行：

```bash
cloudflared tunnel --url http://localhost:4173
```

会得到一个临时公网地址，但需要本机、`serve.js` 和网络一直保持运行，地址也会变化。长期使用请用上面的静态托管。

> 不要把 `mockups/`、`screenshots/`、`.mimosa/` 上传到公网；部署包已经自动排除。

### 更新站点

仓库已连接到 GitHub 后，修改数据或照片后提交并推送：

```bash
git add .
git commit -m "更新旅行数据"
git push
```

如果使用 GitHub Pages，推送后会自动更新；如果使用 Cloudflare Pages / 妙搭，按平台设置自动部署或手动重新发布一次。

## 自定义

- **配色 / 字体**：修改 `css/style.css` 顶部的 `:root` CSS 变量（纸张色、印章红、衬线字体等）
- **站点标题**：修改 `index.html` 里的 `<h1>` 与 `<title>`；页眉小字会从 `data/trips.json` 的 `site.subtitle` 自动生成
- **地图范围**：在 `js/app.js` 的 `initMap()` 中调整 `minZoom` / `maxZoom`
- **家的位置**：`js/app.js` 顶部的 `HOME` 常量（默认芜湖），放射路线和「家」标记都以它为准
- **默认视野**：`fitMap()` 会自动适配当前筛选出的城市；单座城市时使用 5 级缩放
- **减少动画**：系统开启「减少动态效果」后，飞行动画会自动关闭

## 技术说明

- [Leaflet](https://leafletjs.com/) 1.9.4（BSD-2-Clause），已本地化到 `vendor/leaflet/`
- [topojson-client](https://github.com/topojson/topojson-client)（ISC）
- 世界地图数据：[Natural Earth](https://www.naturalearthdata.com/)（公有领域），地图内已保留数据署名
- 示例旅程与文字均为演示数据，请替换成你自己的故事

## 常见问题

**地图是空白的？**
确认通过 `node serve.js` 访问，并且 `vendor/leaflet/leaflet.js`、`data/world-110m.json` 均存在。打开浏览器控制台可看到具体错误。

**添加城市后地图标签挤在一起？**
给其中一座城市加 `"labelSide": "left"`，让它的标签显示在左侧；或调整 `fitMap()` 的 padding。

**照片不显示？**
检查路径是否相对项目根目录、文件名大小写是否一致（部署到 Linux 服务器时大小写敏感）。

**想换回深色或杂志风？**
`mockups/style-b.html`、`mockups/style-c.html` 保留了另外两套视觉样张，可参考其样式迁移。
