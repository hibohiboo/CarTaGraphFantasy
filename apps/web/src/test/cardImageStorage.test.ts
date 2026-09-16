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
});
