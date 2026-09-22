import type { CardDef, Character } from '@cartagraph/domain';
import { ARCHETYPE_LABEL, deriveArchetype } from '@cartagraph/domain';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CardGrid, GameCard } from '../../components/GameCard';
import { PlayMat, type PlayMatZone } from '../../components/PlayMat';
import { HandDock, ProposeForm, Table } from '../../components/play';
import { Button, ErrorNote, Loading, PageHeader, Panel } from '../../components/ui';
import { useCardPool, useCreateCharacter, useUpdateCharacter } from '../../lib/queries';
import s from '../pages.module.css';

type Step = 'name' | 'training' | 'ability' | 'gear' | 'resolve' | 'done';

/**
 * 体技心の配分方法は正式仕様として未決（docs/open-questions.md「次に詰める候補」）。
 * ここでは3択の固定プリセットという、このチュートリアル固有の仮ルールで進める
 * （CharacterCreatePageの「合計9・1〜5で自由配分」とは別の仮ルール。合計9は揃えている）。
 */
const ABILITY_PRESETS: {
  id: string;
  name: string;
  abilities: NonNullable<Character['abilities']>;
}[] = [
  { id: 'preset-body', name: '力自慢', abilities: { body: 5, skill: 2, mind: 2 } },
  { id: 'preset-skill', name: '身軽さ', abilities: { body: 2, skill: 5, mind: 2 } },
  { id: 'preset-mind', name: '知恵者', abilities: { body: 2, skill: 2, mind: 5 } },
];

/** 基本カードプールの既存カードから、旅装として渡す3枚（いずれもCP1） */
const GEAR_CARD_IDS = ['c-lantern', 'c-lockpick', 'c-charm'];
/** 「戦う覚悟」を選んだときに渡す戦闘スキルカード（このカードを持つとderiveArchetypeが'adventurer'を返す） */
const COMBAT_CARD_ID = 'c-slash';

const choiceCard = (id: string, name: string): CardDef => ({ id, kind: 'choice', name, tags: [] });

const TRAINING_CHOICES = [
  choiceCard('skip', 'このまま身ひとつで旅立つ'),
  choiceCard('train', '腕試しをしていく'),
];
const RESOLVE_CHOICES = [
  choiceCard('hold-back', 'まだ早い、今日はここまでにしておく'),
  choiceCard('commit', '覚悟はできている'),
];

/**
 * 舞台となるロケーション・話し相手のNPC。実際のシーン進行画面（GmSessionManagePageの
 * 「場のゾーン」等）と同じ見た目（ロケーション／NPCカード）を、会話の間ずっと出しておく。
 * チュートリアル全体を通して同じ酒場・同じ主人なので、ステップが変わっても表示し続ける。
 */
const LOCATION_CARD: CardDef = {
  id: 'loc-tavern-counter',
  kind: 'location',
  name: '酒場のカウンター',
  description: '灯りの下のカウンター席。今夜はここで旅の話を聞いてもらえそうだ',
  tags: [],
};
const NPC_CARD: CardDef = {
  id: 'npc-tavern-master',
  kind: 'npc',
  name: '酒場の主人',
  description: '長年この酒場を切り盛りしてきた、口数少ない主人',
  tags: [],
};

/**
 * 名乗りは自由入力なので、実際のプレイ画面と同じ「新たな選択肢を提案」の操作感
 * （提案カードを選ぶ→自由入力欄が開く→GMへの提案として送る）で練習させる。
 */
const INTRODUCE_CARD: CardDef = {
  id: 'introduce',
  kind: 'choice',
  name: '＋\n名を名乗る',
  tags: [],
};

/**
 * 入口からのチュートリアル（docs/plans/2026-09-22-チュートリアル導線.md）。
 * NPCとの短い問答を進めるうちに実際のキャラクターができる。セッションモデルは使わず、
 * ここだけで完結するローカルなstateマシン。各選択はステップごとにサーバーへ保存するため、
 * 途中で離脱してもその時点のキャラクターがそのまま「旅人」または「探索者」として残る。
 */
export function TutorialPage() {
  const pool = useCardPool();
  const create = useCreateCharacter();
  const update = useUpdateCharacter();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('name');
  const [introducing, setIntroducing] = useState(false);
  const [name, setName] = useState('');
  // ロケーション／NPCカードは狭い画面でも邪魔にならないよう小さく出し、
  // タップで詳細（肖像・説明文）を見られるようにする
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [npcExpanded, setNpcExpanded] = useState(false);
  const [showMat, setShowMat] = useState(false);
  // 完了時のロール（旅人／探索者／冒険者）は専用の状態フラグを持たず、サーバーが返した実際の
  // Character（abilities・deck）から都度 deriveArchetype で導出する（docs/cartagraph/role-and-scenario.md）。
  const [character, setCharacter] = useState<Character | null>(null);
  // 選択のたびにサーバーへ保存するため、応答が返るまで次の選択を受け付けない
  // （connectedな連打でも二重に mutate が発火しないようにする、React の再描画を待たない同期ガード）。
  const [busy, setBusy] = useState(false);

  if (pool.isPending) return <Loading />;
  if (pool.error) return <ErrorNote error={pool.error} />;

  const gearCards = GEAR_CARD_IDS.map((id) => pool.data.basic.find((c) => c.id === id)).filter(
    (c): c is CardDef => !!c,
  );

  // 今のステップの手札（選択肢）。プレイマットの「選択肢（今の手札）」ゾーンに出す
  const stepChoices: CardDef[] =
    step === 'training'
      ? TRAINING_CHOICES
      : step === 'ability'
        ? ABILITY_PRESETS.map((p) => choiceCard(p.id, p.name))
        : step === 'gear'
          ? gearCards
          : step === 'resolve'
            ? RESOLVE_CHOICES
            : [];
  const matZones: PlayMatZone[] = [
    { label: 'シーン・場所', note: 'GMが用意', cards: [LOCATION_CARD] },
    { label: '話し相手', note: 'GMが用意', cards: [NPC_CARD] },
    { label: '選択肢（今の手札）', note: 'PLが選ぶ', cards: stepChoices },
    {
      label: 'パーティー',
      note: 'PLが置く・最前面',
      cards: character
        ? [{ id: character.id, kind: 'character', name: character.name, tags: [] }]
        : [],
    },
  ];

  const startJourney = () => {
    if (busy) return;
    setBusy(true);
    create.mutate(
      { name, abilities: undefined, cardIds: [] },
      {
        onSuccess: (ch) => {
          setCharacter(ch);
          setStep('training');
          setBusy(false);
        },
        onError: () => setBusy(false),
      },
    );
  };

  const choosePreset = (preset: (typeof ABILITY_PRESETS)[number]) => {
    if (!character || busy) return;
    setBusy(true);
    update.mutate(
      { id: character.id, patch: { abilities: preset.abilities } },
      {
        onSuccess: (ch) => {
          setCharacter(ch);
          setStep('gear');
          setBusy(false);
        },
        onError: () => setBusy(false),
      },
    );
  };

  const chooseGear = (card: CardDef) => {
    if (!character || busy) return;
    setBusy(true);
    update.mutate(
      { id: character.id, patch: { addCardIds: [card.id] } },
      {
        onSuccess: (ch) => {
          setCharacter(ch);
          setStep('resolve');
          setBusy(false);
        },
        onError: () => setBusy(false),
      },
    );
  };

  const becomeAdventurer = () => {
    if (!character || busy) return;
    setBusy(true);
    update.mutate(
      { id: character.id, patch: { addCardIds: [COMBAT_CARD_ID] } },
      {
        onSuccess: (ch) => {
          setCharacter(ch);
          setStep('done');
          setBusy(false);
        },
        onError: () => setBusy(false),
      },
    );
  };

  return (
    <>
      <PageHeader title="旅立ちの酒場" />
      <div className="u-row">
        <GameCard
          card={LOCATION_CARD}
          width={locationExpanded ? 190 : 44}
          portrait
          iconOnly={!locationExpanded}
          showDescription={locationExpanded}
          selected={locationExpanded}
          onClick={() => setLocationExpanded((v) => !v)}
          title={
            locationExpanded
              ? '小さくする'
              : `ロケーション：${LOCATION_CARD.name}（タップして詳しく見る）`
          }
        />
      </div>
      <p className="u-small u-dim">
        1枚で場の全体が見える簡易表示。
        <Button size="sm" variant="ghost" onClick={() => setShowMat((v) => !v)}>
          {showMat ? 'プレイマットを閉じる' : 'プレイマットで見る'}
        </Button>
      </p>
      {showMat && (
        <div className="u-mt">
          <PlayMat zones={matZones} />
        </div>
      )}
      <Panel>
        <GameCard
          card={NPC_CARD}
          width={npcExpanded ? 190 : 96}
          portrait
          hideMeta={!npcExpanded}
          showDescription={npcExpanded}
          selected={npcExpanded}
          onClick={() => setNpcExpanded((v) => !v)}
          title={npcExpanded ? '小さくする' : 'タップして詳しく見る'}
        />

        {step === 'name' && (
          <div className={s.form}>
            <Table flavor="良い夜だ、旅の方。ここは旅立ちの酒場。名を聞かせてくれないか" />
            <HandDock
              hand={[]}
              onPlay={() => {}}
              extra={
                <GameCard
                  card={INTRODUCE_CARD}
                  variant="propose"
                  width={110}
                  centerName
                  selected={introducing}
                  onClick={() => setIntroducing((v) => !v)}
                />
              }
            />
            {introducing && (
              <ProposeForm>
                <input
                  type="text"
                  aria-label="名前"
                  placeholder="例：迅"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startJourney()}
                  // biome-ignore lint/a11y/noAutofocus: 提案カードを選んだ直後の主操作なので意図的にフォーカスする
                  autoFocus
                />
                <Button size="sm" onClick={startJourney} disabled={busy || !name.trim()}>
                  {busy ? '名乗っている…' : '名乗る'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIntroducing(false)}>
                  やめる
                </Button>
              </ProposeForm>
            )}
            {create.error && <ErrorNote error={create.error} />}
          </div>
        )}

        {step === 'training' && (
          <>
            <Table flavor="腕に覚えはあるかい？なんなら少し鍛えてから旅立つのも悪くない" />
            <HandDock
              hand={TRAINING_CHOICES}
              onPlay={(c) => setStep(c.id === 'train' ? 'ability' : 'done')}
            />
          </>
        )}

        {step === 'ability' && (
          <>
            <Table
              flavor="なら、お前さんの得意はどれだ"
              hint="体技心の配分方法はここだけの仮ルール"
            />
            <HandDock
              hand={ABILITY_PRESETS.map((p) => choiceCard(p.id, p.name))}
              onPlay={(c) => {
                const preset = ABILITY_PRESETS.find((p) => p.id === c.id);
                if (preset) choosePreset(preset);
              }}
              disabled={busy}
            />
            {update.error && <ErrorNote error={update.error} />}
          </>
        )}

        {step === 'gear' &&
          (gearCards.length > 0 ? (
            <>
              <Table flavor="旅には何か持たせてやろう" />
              <CardGrid min={130}>
                {gearCards.map((card) => (
                  <GameCard
                    key={card.id}
                    card={card}
                    fluid
                    portrait
                    showDescription
                    showCost="cp"
                    disabled={busy}
                    onClick={() => chooseGear(card)}
                  />
                ))}
              </CardGrid>
              {update.error && <ErrorNote error={update.error} />}
            </>
          ) : (
            <div className={s.form}>
              <Table flavor="……すまん、渡せる荷物が今は無いようだ。話を進めよう" />
              <Button onClick={() => setStep('resolve')}>先へ進む</Button>
            </div>
          ))}

        {step === 'resolve' && (
          <>
            <Table flavor="最後に聞くが……戦う覚悟はあるか" />
            <HandDock
              hand={RESOLVE_CHOICES}
              onPlay={(c) => (c.id === 'commit' ? becomeAdventurer() : setStep('done'))}
              disabled={busy}
            />
            {update.error && <ErrorNote error={update.error} />}
          </>
        )}

        {step === 'done' && character && (
          <div className={s.form}>
            <p>
              あなたは<strong>{ARCHETYPE_LABEL[deriveArchetype(character)]}</strong>として旅立った。
            </p>
            <Button onClick={() => navigate(`/pl/characters/${character.id}`)}>
              キャラクターシートへ
            </Button>
          </div>
        )}
      </Panel>
    </>
  );
}
