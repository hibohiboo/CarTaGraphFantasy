---
name: transactional-edit-scripts
description: 複数ファイルを書き換えるスクリプトは、全部の置換を検査してから書き込む（途中で止まって半端に書き換えない）
metadata:
  node_type: memory
  type: feedback
  originSessionId: 372d9327-37f9-4207-9e68-7f4fa203e880
  modified: 2026-10-03T13:53:02.511Z
---

複数ファイルを書き換える Python スクリプト（スクラッチパッドの edit(path, old, new) 型）は、置換の対象がすべて想定どおりの件数見つかることを先に確かめてから、まとめて書き込む。

**Why:** 2026-10-03 の PR #14 で、1件目の書き込みのあと3件目の assert で止まり、半端に書き換わったファイルを手で辿って続きを流し直すことが2回あった（同じ文字列が書き換え後のコードにも現れて件数がずれた）。

**How to apply:** スクリプトは「読み込み→全置換を検査→全部書き込む」の順にする。同じ文字列が複数ある箇所は、前後の文脈ごと置換対象にする。関連：[[prefer-mechanisms]]
