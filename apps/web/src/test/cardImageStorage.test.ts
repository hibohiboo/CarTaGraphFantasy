import { afterEach, describe, expect, it } from 'vitest';
import { loadCardImage, removeCardImage, saveCardImage } from '../lib/cardImageStorage';

afterEach(() => {
  window.localStorage.clear();
});

describe('cardImageStorage', () => {
  it('保存した画像を同じcardIdで読み込める', () => {
    saveCardImage('card-1', 'data:image/png;base64,AAAA');
    expect(loadCardImage('card-1')).toBe('data:image/png;base64,AAAA');
  });

  it('保存していないcardIdはundefinedを返す', () => {
    expect(loadCardImage('unknown')).toBeUndefined();
  });

  it('削除後はundefinedを返す', () => {
    saveCardImage('card-2', 'data:image/png;base64,BBBB');
    removeCardImage('card-2');
    expect(loadCardImage('card-2')).toBeUndefined();
  });

  it('別のcardIdの値は上書きしない', () => {
    saveCardImage('card-3', 'data:image/png;base64,CCCC');
    saveCardImage('card-4', 'data:image/png;base64,DDDD');
    expect(loadCardImage('card-3')).toBe('data:image/png;base64,CCCC');
    expect(loadCardImage('card-4')).toBe('data:image/png;base64,DDDD');
  });

  it('保存すると、localStorageの生の値はバージョン付きJSONになる', () => {
    saveCardImage('card-5', 'data:image/png;base64,EEEE');
    const raw = window.localStorage.getItem('cartagraph:cardImage:card-5');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      version: 1,
      dataUrl: 'data:image/png;base64,EEEE',
    });
  });

  it('JSON構文として壊れたデータ（旧形式の生data URL文字列を含む）はundefinedを返す', () => {
    window.localStorage.setItem('cartagraph:cardImage:card-6', 'data:image/png;base64,LEGACY');
    expect(loadCardImage('card-6')).toBeUndefined();
  });

  it('JSON構文としては正しいが期待した形でないデータはundefinedを返す', () => {
    window.localStorage.setItem('cartagraph:cardImage:card-7', JSON.stringify(null));
    expect(loadCardImage('card-7')).toBeUndefined();
  });
});
