import { EmptyNote } from '@/shared/ui/ui';
import type { ScenarioFileResult } from '../api/types';

/**
 * 保存・公開でファイル（scenarios/<id>.json）に書いたかの知らせ（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md D5）。
 * 書き込みの対象外（下書きの保存＝null）なら何も出さない
 */
export function ScenarioFileNote({ file }: { file: ScenarioFileResult | undefined }) {
  if (!file) return null;
  return (
    <EmptyNote>
      {file.saved
        ? `${file.path} に保存しました`
        : 'デモのため保存されません（リロードで消えます）'}
    </EmptyNote>
  );
}
