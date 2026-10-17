import type { CardDef } from '@cartagraph/domain/card/model';
import { useState } from 'react';
import { GameCard } from '@/entities/card/ui/GameCard';
import s from '@/shared/ui/page.module.css';
import { Button, Field, Panel } from '@/shared/ui/ui';
import { loadCardImage } from '../api/cardImageStorage';

/** シーンのロケーション（1シーン1ロケーションを想定した暫定分類）の表示と、名前を付けての設定・差し替え */
export function LocationPanel({
  location,
  onConfirm,
}: {
  location: CardDef | undefined;
  /** 確定した名前（空白を除いたもの。空なら呼ばない） */
  onConfirm: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const confirm = () => {
    const name = newName.trim();
    if (!name) return;
    onConfirm(name);
    setEditing(false);
    setNewName('');
  };
  return (
    <Panel title="ロケーション" sub="1シーン1ロケーションを想定した暫定分類">
      {location ? (
        <GameCard
          card={{
            ...location,
            portraitUrl: location.portraitUrl ?? loadCardImage(location.id),
          }}
          portrait
        />
      ) : (
        <p className="u-small u-dim">ロケーションは未設定</p>
      )}
      {location && loadCardImage(location.id) && !location.portraitUrl && (
        <p className="u-small u-dim">保存済みの画像を表示中</p>
      )}
      {editing ? (
        <div className={s.form}>
          <Field label="新しいロケーション名">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </Field>
          <div className="u-row">
            <Button size="sm" onClick={confirm}>
              確定
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setNewName(location?.name ?? '');
            setEditing(true);
          }}
        >
          {location ? '差し替え' : 'ロケーションを設定'}
        </Button>
      )}
    </Panel>
  );
}
