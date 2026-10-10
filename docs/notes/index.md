# デザイナーノート

[ゲームの仕様](../cartagraph/index.md)の各ページに1対1で対応する、設計の舞台裏のページ。仕様のページには「いまのルール」だけを端的に書き、次のものはここへ置く。

- そう決めた理由・動機
- 決まるまでの経緯（grilling でどう整理したか、など）
- 検討して採らなかった案
- 将来の拡張候補

ここは**正式仕様ではない**。仕様の正は対応する仕様のページで、ノートには仕様を書き写さない（食い違いの元になるため）。仕様を変えたら、理由をノートに足す。

ファイル名は仕様のページと同じにする（`docs/cartagraph/unlock.md` のノートは `docs/notes/unlock.md`）。仕様のページの末尾から、対応するノートへ1行でリンクする。

## 決着した論点

[未解決論点トラッカー](../open-questions.md)で扱い、決着した論点。記号は当時のトラッカーのもので、古いプラン（`docs/plans/`）が「論点D」のように参照している。

| 論点 | 仕様 | ノート |
|---|---|---|
| A. デッキとは何か | [カード・デッキの考え方](../cartagraph/card-and-deck.md) | [ノート](card-and-deck.md) |
| B. カード化の境界 | [カード化の判断基準](../cartagraph/card-and-deck.md#カード化の判断基準) | [ノート](card-and-deck.md) |
| C. グラフの役割 | [グラフの役割](../cartagraph/graph.md) | [ノート](graph.md) |
| D. カードの裏表 | [カードの裏表](../cartagraph/card-face-back.md) | [ノート](card-face-back.md) |
| E. 進化候補の評価 | [進化候補の評価](../concept/index.md#進化候補の評価) | （コンセプトのページに含む） |
| F. カードをプレイした結果として何が変化するのか | [場・手札・プレイ](../cartagraph/play-and-field.md#カードをプレイした結果として何が変化するのか) | [ノート](play-and-field.md) |
| G. 段階的な開示・習熟によるアンロック | [段階的な開示・習熟によるアンロック](../cartagraph/unlock.md) | [ノート](unlock.md) |
| H. セッション参加モデル | [パーティー編成と非同期セッション参加](../cartagraph/party-and-session.md) | [ノート](party-and-session.md) |
| I. PCのロールとシナリオタイプ | [PCのロールとシナリオタイプ](../cartagraph/role-and-scenario.md) | [ノート](role-and-scenario.md) |
| J. 戦闘ルール | [戦闘ルール](../cartagraph/combat.md) | [ノート](combat.md) |
| K. 探索者向けの判定ルール | [探索者向けの判定ルール](../cartagraph/exploration-check.md) | [ノート](exploration-check.md) |
| L. シナリオの構造とセッション開始までの流れ | [シナリオの構造とセッション開始までの流れ](../cartagraph/scenario-flow.md) | [ノート](scenario-flow.md) |
| M. 提案カードの運用中の状態遷移 | [提案の裁定待ちの間の状態遷移](../cartagraph/play-and-field.md#提案の裁定待ちの間の状態遷移)・[GMレスセッションでの提案の扱い](../cartagraph/play-and-field.md#gmレスセッションでの提案の扱い) | [ノート](play-and-field.md) |
| N. カード効果の「対象（Target）」指定方法 | [カード効果の「対象（Target）」指定方法](../cartagraph/play-and-field.md#カード効果の対象target指定方法) | [ノート](play-and-field.md) |
| O. 異なるPC・プレイヤー間での選択・結末比較体験 | [PC間の比較体験と称号タグ](../cartagraph/comparison-and-titles.md) | [ノート](comparison-and-titles.md) |
| P. キャラクターの成長とキャラメイク（CP制） | [キャラクターの成長とキャラメイク（CP制）](../cartagraph/character-growth.md) | [ノート](character-growth.md) |
| Q. 数値バランスの相場観 | [数値バランスの相場観](../cartagraph/balance.md) | [ノート](balance.md) |
| R. 技術スタック | [技術スタック](../architecture/index.md) | （開発のページ。ゲームの仕様ではない） |
| 無反応による中断の再開 | [非同期セッションの進行](../cartagraph/party-and-session.md#非同期セッションの進行) | [ノート](party-and-session.md#中断を終了から一時停止に変えた経緯) |

## ノートの一覧

- [カード・デッキの考え方](card-and-deck.md)
- [カードの裏表](card-face-back.md)
- [場・手札・プレイ](play-and-field.md)
- [グラフの役割](graph.md)
- [PCのロールとシナリオタイプ](role-and-scenario.md)
- [キャラクターの成長とキャラメイク（CP制）](character-growth.md)
- [PC間の比較体験と称号タグ](comparison-and-titles.md)
- [段階的な開示・習熟によるアンロック](unlock.md)
- [探索者向けの判定ルール](exploration-check.md)
- [戦闘ルール](combat.md)
- [数値バランスの相場観](balance.md)
- [シナリオの構造とセッション開始までの流れ](scenario-flow.md)
- [パーティー編成と非同期セッション参加](party-and-session.md)
- [GM不在のソロの進行（仮ルール）](solo-village.md)
- [自動戦闘（仮ルール）](auto-combat.md)
