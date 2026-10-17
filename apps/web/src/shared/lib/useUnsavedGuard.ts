import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

/** 保存していない編集を捨てて移るときの確かめの文面（リンクで移る場合もコピーの場合も同じ） */
export const UNSAVED_CONFIRM_MESSAGE = '保存していない編集があります。移ると消えます。移りますか？';

/**
 * 保存していない編集があるとき、画面内の移動（リンク・戻る）の前に確かめる（docs/plans/2026-10-17-シナリオ製作の導線.md G6）。
 * 同じパスのまま検索・ハッシュだけが変わる移動は止めない（useBlocker 自身は同じパスを除かない）。
 * リロード・タブを閉じる（beforeunload）は対象にしない。
 *
 * 返す `allowNavigationTo(pathname)` は、自分で確かめ済みの移動（例：コピーを作ってから移る）の先を、次の1回だけ通す。
 * 先を指定するので、その間に押された別の移動は許可を使わず、確かめに止められる
 */
export function useUnsavedGuard(dirty: boolean) {
  const allowedPath = useRef<string | null>(null);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowedPath.current !== null && allowedPath.current === nextLocation.pathname) {
      allowedPath.current = null;
      return false;
    }
    return dirty && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(UNSAVED_CONFIRM_MESSAGE)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  const allowNavigationTo = useCallback((pathname: string) => {
    allowedPath.current = pathname;
  }, []);
  return { allowNavigationTo };
}
