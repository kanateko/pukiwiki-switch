# Switch Plugin Specification

プルダウン、スライダー、数値入力、または平文の切り替えによって、同一グループに属する表示要素の内容を動的に変更するPukiWikiプラグイン。

## 概要

- **プラグイン名**: `switch`
- **種別**: ブロック型 (`#switch`)、インライン型 (`&switch;`)
- **主な機能**:
    - `select`: プルダウンメニューによる選択
    - `range`: スライダーによる数値選択
    - `number`: 数値入力による選択
    - `linear`: 他のコントロールに連動して計算された値（線形）を表示
    - `exponential`: 他のコントロールに連動して計算された値（指数）を表示
    - `calc`: 他のコントロールに連動して指定された計算式で計算された値を表示
    - `default`: 他のコントロールに連動して表示要素を切り替え

## 構文

### インライン型
`&switch(options){items};`
`&switch(options):items;`

### ブロック型
`#switch(options){{
items
}}`

## 引数 (options)

- **表示タイプ**: `select`, `range`, `number`, `linear`, `exponential`, `calc`, `default` (省略時は `default`)
- **グループ**: `group=NAME` または `~NAME` (省略時は `default`)
- **開始位置**: `start=N` (1から始まるインデックス)
- **セパレータ**: `separator=CHAR` (インラインのデフォルトは `:`, ブロックのデフォルトは `#-`)
- **ラベル**: `label=TEXT`
- **クラス**: `class=CLASSNAME`
- **幅指定**: `input-width=WIDTH` または `slider-width=WIDTH` (例: `100px`, `50%`)
- **フラグ**:
    - `transparent`: select時、背景を透明にする
    - `disable`: select時、操作を無効化する
    - `rtl`: select時、右から左の方向に表示する

## 構造

### PHP (src/switch.php)
- `plugin_switch_init`: CSS/JSの読み込み
- `plugin_switch_convert`: ブロック型のエントリポイント
- `plugin_switch_inline`: インライン型のエントリポイント
- `SwitchPlugin`: ロジックを管理するメインクラス

### TypeScript (src/ts/switch.ts)
- 各コントローラー/表示要素を `SwitchInstance` として管理
- グループ内での連動ロジックの実装
- `toLocaleString()` による数値フォーマット

### SCSS (src/css/switch.scss)
- `.plugin-switch` スコープ内でのスタイル定義
- CSS変数を用いたテーマ対応
- ダークモード (`.plugin-switch--dark`) 対応
