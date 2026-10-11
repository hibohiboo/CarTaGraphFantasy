import { Button } from '@/shared/ui/ui';

/**
 * シーン編集・結末のノードの編集の保存ボタン。製作者でない人に公開版を見せるとき（readOnly）は出さない
 * （docs/plans/2026-10-11-シナリオの下書きのAPI.md D7）
 */
export function SaveButton({
  readOnly,
  dirty,
  saving,
  onSave,
}: {
  readOnly: boolean;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  if (readOnly) return null;
  return (
    <Button disabled={!dirty || saving} onClick={onSave}>
      {saving ? '保存中…' : '保存'}
    </Button>
  );
}
