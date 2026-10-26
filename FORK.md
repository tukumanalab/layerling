# tukumanalab/layerling の運用

この fork は [henmedia/layerling](https://github.com/henmedia/layerling)（upstream）へ PR を出すための場所と、
fork 独自の機能（GitHub Pages 配信・base path 対応など）を置く場所を兼ねています。経緯は tukumanalab/layerling#9 を参照してください。

## ブランチ

| ブランチ | 役割 |
|---|---|
| `main` | **upstream/main のミラー**。直接コミットしない、PR もマージしない |
| `tukumana` | **既定ブランチ**。fork 独自の機能。GitHub Pages はこのブランチへの push で配信される |
| topic ブランチ | upstream 向けの作業。`upstream/main` から切る |

## upstream と同期する

毎日 06:00 JST に [Sync upstream](.github/workflows/sync-upstream.yml) ワークフローが動きます。

1. `gh repo sync -b main` で `main` を upstream/main に fast-forward する。
   `main` に独自コミットがあると失敗します（それが正しい状態です）
2. `tukumana` に無いコミットがあれば `main → tukumana` の PR を 1 本開き、auto-merge を有効にする。
   PR が既に開いていればそのまま使う（`main` が進めば同じ PR が更新される）
3. ruleset「tukumana: CI required」の必須チェック `Typecheck and unit tests` が通ると、GitHub が merge commit でマージする。
   マージされた push で Pages が配信される

今すぐ同期したいときは Actions > Sync upstream > Run workflow で起動します。

### 自動で済まないとき

CI が赤い、またはコンフリクトしている（コンフリクト中は CI 自体が走らない）と PR が開いたまま残るので、手元で片付けます。
push されると PR は自動で閉じます。

```bash
git fetch origin
git switch tukumana
git merge origin/main   # 衝突したら origin/main 側を優先して解決
npm run ci
git push origin tukumana
```

管理者は ruleset を bypass できるので直接 push できます。

### ワークフローが使うトークン

リポジトリシークレット `SYNC_TOKEN` は、このリポジトリだけを対象にした fine-grained PAT
（Contents: Read and write、Pull requests: Read and write）です。`GITHUB_TOKEN` だと作った PR で CI が走らず、
マージ後の Pages も配信されません。期限が切れたら同じ権限で発行し直して `SYNC_TOKEN` を更新してください。

## upstream へ PR を出す

1. `git fetch upstream && git switch -c <topic> upstream/main`
2. 作業して `git push -u origin <topic>`
3. fork 内でレビューする場合は `main` 宛ての PR を作る。`main` はミラーなので、差分がそのまま upstream PR の差分になる
4. `gh pr create -R henmedia/layerling --base main --head tukumanalab:<topic>`
5. fork 内 PR はマージせず close。upstream でマージされたら topic ブランチを削除する

## upstream でマージされる前に `tukumana` で使う

upstream 向けの topic を先に Pages で使いたいときは、topic ブランチを `tukumana` へ merge で取り込みます（cherry-pick はしない）。

1. 上の手順で topic を作って upstream へ PR を出す
2. 同じ topic で `tukumana` 宛ての PR を作り、**Create a merge commit** でマージする（squash / rebase マージは使わない）

   ```bash
   gh pr create -R tukumanalab/layerling --base tukumana --head <topic>
   ```

3. upstream のレビューで直すときは topic に追加コミットを積み、もう一度 `tukumana` へ merge する。`tukumana` に入れた後の topic は rebase や force-push で書き換えない
4. upstream でマージされたら、翌朝の Sync upstream が `origin/main` を `tukumana` に merge する。中身が同じなら衝突しない。upstream のレビューで内容が変わってコンフリクトしたら、「自動で済まないとき」の手順で `origin/main` 側を採用して解決する
5. topic ブランチを削除する

## fork 独自の機能

`tukumana` から切って、`tukumana` 宛ての PR にします。upstream に出せるものになったら、
そのコミットを `upstream/main` 上の topic ブランチに cherry-pick して上の手順で出します。

## 古いブランチ

整理の前の `main` や削除したブランチは `archive/<ブランチ名>` タグで残っています（`git tag -l 'archive/*'`）。
