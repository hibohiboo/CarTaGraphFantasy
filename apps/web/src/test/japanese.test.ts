import { describe, expect, it } from 'vitest';
import { toDictionaryForm } from '../lib/japanese';

describe('toDictionaryForm', () => {
  it.each([
    ['扉を壊してみたい', '扉を壊す'],
    ['鎖を切って亡霊を海に落としたい', '鎖を切って亡霊を海に落とす'],
    ['壁を叩いて音を確かめたい', '壁を叩いて音を確かめる'],
    ['灯りを消してみたい', '灯りを消す'],
    ['本を読んでみたい', '本を読む'],
    ['扉を開けたい', '扉を開ける'],
    ['扉を破壊する', '扉を破壊する'],
  ])('%s → %s', (input, expected) => {
    expect(toDictionaryForm(input)).toBe(expected);
  });
});
