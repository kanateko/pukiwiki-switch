# Switch Plugin for PukiWiki

プルダウン、スライダー、数値入力、または平文の切り替えによって、同一グループに属する表示要素の内容を動的に変更するPukiWikiプラグインです。

## 特徴

- **多様なコントロール**: `select` (プルダウン), `range` (スライダー), `number` (数値入力) に対応。
- **動的計算**: `linear` タイプにより、入力値に基づいた線形補間計算結果を表示可能。
- **コンテンツ切り替え**: `default` タイプにより、ブロックまたはインライン要素を動的に切り替え。
- **グループ連動**: グループ名を指定することで、ページ内の複数の要素を同期。

## インストール

1. [Releases](https://github.com/kanateko/pukiwiki-switch/releases) から最新の `plugin.zip` をダウンロードします。
2. 解凍して得られた `switch.inc.php` を PukiWiki の `plugin/` ディレクトリに設置します。

## 使い方

### インライン型
`&switch(select,group=g1){項目1:項目2:項目3};`

### ブロック型
```
#switch(range,group=g2,start=5,label=レベル){{
1
#-
10
#-
1
}}
```

詳細な使い方や表示例は[自作プラグイン/switch](https://jpngamerswiki.com/?dcfd0a4724)を参照してください。

## 開発者向け

### ビルド
```bash
npm install
npm run build
```
`dist/switch.inc.php` が生成されます。

## ライセンス
GPL v3 or later
