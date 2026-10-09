# 体制の進化のタイムライン

開発体制（ルール・仕組み・置き場所）が、いつ・何をきっかけに・どう変わってきたかを辿るページ。とくに、同じ失敗を人の注意ではなく機械で止められるようになった割合を見る。

中身は[体制の進化ログ](evolution.md)の「採用済み」「却下」から、ビルド時に自動で組み立てている（書き写さない）。進化ログに項目を足すと、ここにも出る。各項目の「きっかけ」「止め方」が読めないとビルドが止まる（`scripts/evolution-timeline.mjs`）。

<script setup>
import EvolutionTimeline from '../.vitepress/components/EvolutionTimeline.vue';
</script>

<EvolutionTimeline />
