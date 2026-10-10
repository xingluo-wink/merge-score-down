# 什么叫越合成分数越低了

[直接玩](https://xingluo-wink.github.io/merge-score-down/)

你和电脑轮流投球，同校徽接触就合成。堆过红线你赢，合成深圳大学电脑赢。

开局35,000分，每次合成倒扣。分数显示为“33,666（-1,334）”：前面是剩余分数，后面是累计扣分。最佳纪录保存获胜对局中保住的最高分，保存在当前浏览器里。

手机拖动、松手投球；电脑点击，或用方向键和空格。双方都能看到各自下一颗球。

## 本地运行

这是静态HTML、CSS和JavaScript游戏。用HTTP服务器打开本目录，例如`python -m http.server 8000`，再访问`http://localhost:8000`。不要直接双击HTML，模块和机器人Worker需要HTTP环境。

GitHub Pages使用`main`分支根目录发布，不需要安装依赖或设置API密钥。

## 素材与灵感

校徽及相关标识权利归各高校所有，大小不代表学校排名。本游戏为非官方创意项目。字体、校徽和图片的来源说明保存在[asset-sources.json](asset-sources.json)及assets内。

灵感来源兼友情链接：

- https://yhsome.github.io/BigNaiWa/
- https://plianasp-maker.github.io/scut-game/
