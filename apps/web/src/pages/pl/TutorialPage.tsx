import type { CardDef, Character } from '@cartagraph/domain';
import { ARCHETYPE_LABEL, deriveArchetype } from '@cartagraph/domain';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CardGrid, GameCard } from '../../components/GameCard';
import { NameProposal } from '../../components/NameProposal';
import { PlayMat, type PlayMatZone } from '../../components/PlayMat';
import { HandDock, Table } from '../../components/play';
import { Button, ErrorNote, Loading, PageHeader, Panel } from '../../components/ui';
import { useCardPool, useCreateCharacter, useUpdateCharacter } from '../../lib/queries';
import s from '../pages.module.css';

type Step = 'name' | 'training' | 'ability' | 'gear' | 'resolve' | 'done';

/** ステップ内の台詞カード1枚分。stepLinesとして並べ、1枚ずつクリックで進める */
type Line = {
  speaker?: string;
  speakerCard?: CardDef;
  flavor: string;
  hint?: string;
};

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

// 2026-09-22ユーザー指摘：離脱の選択肢（このまま身ひとつで旅立つ／まだ早い）は廃止し、
// 常に最後（冒険者登録）まで一本道で進める（docs/plans/2026-09-22-チュートリアル導線.md 1.の追記）。
// ただし台詞が問いかけの形である以上、返事のカードそのものは残す（単一の選択肢でもよい）
// ——地の文に変えて返事を消すと会話として不自然になる、という2026-09-22ユーザー指摘の反映
const TRAINING_CHOICES = [choiceCard('train', '腕試しをしていく')];
const RESOLVE_CHOICES = [choiceCard('commit', '冒険者として登録する')];

/**
 * 舞台となるロケーション・話し相手のNPC。実際のシーン進行画面（GmSessionManagePageの
 * 「場のゾーン」等）と同じ見た目（ロケーション／NPCカード）を、会話の間ずっと出しておく。
 * チュートリアル全体を通して同じ酒場・同じ主人なので、ステップが変わっても表示し続ける。
 */
/** プレイマットの「シーン・場所」ゾーンはシーンカード＋ロケーションカードの組（docs/cartagraph/
 * card-and-deck.md「シナリオデッキ」）。ロケーションカードだけでは片方欠けてしまう
 * （2026-09-22ユーザー指摘） */
const SCENE_CARD: CardDef = {
  id: 'scene-departure',
  kind: 'scene',
  name: '旅立ちの夜',
  description: '新しい旅人が名乗りを上げる、酒場の夜',
  tags: [],
};
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
 * ステップごとの台詞カード（1枚ずつクリックで進める）。'name'だけGMの情景描写→NPCの
 * 問いかけの2枚（いきなりNPCに話しかけられると唐突、という2026-09-22ユーザー指摘を反映）。
 * 他のステップは元々1枚だけなので、この仕組みに乗せても見え方は変わらない。
 */
const OPENING_LINES: Line[] = [
  {
    speaker: 'GM',
    flavor: '扉を潜ると、暖炉の火が揺れる酒場の中。カウンターでは、主人が静かにグラスを磨いている',
  },
  { speakerCard: NPC_CARD, flavor: '良い夜だ、旅の方。名を聞かせてくれないか' },
];
const TRAINING_LINES: Line[] = [
  { speakerCard: NPC_CARD, flavor: '腕に覚えはあるかい？なんなら少し鍛えてから旅立つのも悪くない' },
];
const ABILITY_LINES: Line[] = [
  {
    speakerCard: NPC_CARD,
    flavor: 'なら、お前さんの得意はどれだ',
    hint: '体技心の配分方法はここだけの仮ルール',
  },
];
const GEAR_LINES: Line[] = [{ speakerCard: NPC_CARD, flavor: '旅には何か持たせてやろう' }];
const GEAR_EMPTY_LINES: Line[] = [
  { speakerCard: NPC_CARD, flavor: '……すまん、渡せる荷物が今は無いようだ。話を進めよう' },
];
const RESOLVE_LINES: Line[] = [
  {
    speakerCard: NPC_CARD,
    flavor:
      '腕も荷物も揃ったな。ここいらじゃ、この酒場の元帳が冒険者名簿も兼ねている――名を刻んで、冒険者として旅立つといい',
  },
];

/**
 * 入口からのチュートリアル（docs/plans/2026-09-22-チュートリアル導線.md）。
 * NPCとの短い問答を進めるうちに実際のキャラクターができる。セッションモデルは使わず、
 * ここだけで完結するローカルなstateマシン。常に最後（冒険者登録）まで一本道で進む
 * （2026-09-22ユーザー指摘：離脱の選択肢は廃止した）。各選択はステップごとにサーバーへ
 * 保存するため、ブラウザを閉じる等で途中離脱した場合は、それまでの入力だけが反映された
 * 「旅人」または「探索者」のキャラクターが結果的に残る。
 */
export function TutorialPage() {
  const pool = useCardPool();
  const create = useCreateCharacter();
  const update = useUpdateCharacter();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('name');
  // ロケーション／NPCカードは狭い画面でも邪魔にならないよう小さく出し、
  // タップで詳細（肖像・説明文）を見られるようにする
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [npcExpanded, setNpcExpanded] = useState(false);
  const [showMat, setShowMat] = useState(false);
  // 台詞カードは1枚ずつ出し、クリックで次へ進める。ステップが変わったら0枚目に戻す
  // （レンダー中にstepの変化を検知してリセットする、useEffectを使わないReact標準の書き方）
  const [lineIndex, setLineIndex] = useState(0);
  const [prevStep, setPrevStep] = useState<Step>(step);
  // 出てきた台詞カードの履歴（右下のログアイコンから見る）
  const [log, setLog] = useState<Line[]>([]);
  const [loggedLineKey, setLoggedLineKey] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
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

  const stepLines: Line[] =
    step === 'name'
      ? OPENING_LINES
      : step === 'training'
        ? TRAINING_LINES
        : step === 'ability'
          ? ABILITY_LINES
          : step === 'gear'
            ? gearCards.length > 0
              ? GEAR_LINES
              : GEAR_EMPTY_LINES
            : step === 'resolve'
              ? RESOLVE_LINES
              : [];

  // stepが変わったらレンダー中に0枚目へ戻す（Reactの「レンダー中に前回値の変化を検知して
  // stateを補正する」パターン。この描画は捨てられ、直後にlineIndex=0で再描画される）
  const stepChanged = step !== prevStep;
  if (stepChanged) {
    setPrevStep(step);
    setLineIndex(0);
  }
  const currentLineIndex = stepChanged ? 0 : lineIndex;
  const currentLine: Line | undefined =
    stepLines[Math.min(currentLineIndex, Math.max(stepLines.length - 1, 0))];
  const atLastLine = currentLineIndex >= stepLines.length - 1;

  // 今の台詞カードが表示された瞬間に一度だけ履歴へ積む（stepChanged中の使い捨てレンダーでは積まない）
  if (!stepChanged && currentLine) {
    const lineKey = `${step}:${currentLineIndex}`;
    if (loggedLineKey !== lineKey) {
      setLoggedLineKey(lineKey);
      setLog((prev) => [...prev, currentLine]);
    }
  }

  const advanceLine = () => {
    if (!atLastLine) setLineIndex((i) => i + 1);
  };

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
    { label: 'シーン・場所', cards: [SCENE_CARD, LOCATION_CARD] },
    { label: '話し相手', cards: [NPC_CARD] },
    { label: '選択肢（今の手札）', cards: stepChoices },
    {
      label: 'パーティー',
      cards: character
        ? [{ id: character.id, kind: 'character', name: character.name, tags: [] }]
        : [],
    },
  ];

  const startJourney = (name: string) => {
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
        {/* 展開時はカード自体に名前が出るので、アイコン表示のときだけ隣に添える
            （パッと見で今いる場所がわかるように、2026-09-22ユーザー指定） */}
        {!locationExpanded && <span className="u-serif">{LOCATION_CARD.name}</span>}
      </div>
      {/* 右下のボタンから開くが、ページ最下部のボタンと場の様子（ページ上部）が離れていて
          開いたことに気づきにくかったので、ログ履歴と同じ全画面オーバーレイにする
          （2026-09-22ユーザー指摘） */}
      {showMat && (
        <div className={s.sheetOverlay}>
          <button
            type="button"
            className={s.sheetBackdrop}
            aria-label="背景をクリックしてプレイマットを閉じる"
            onClick={() => setShowMat(false)}
          />
          <Panel className={s.sheet}>
            <div className={s.sheetHead}>
              <h3 className="u-serif">場の様子</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowMat(false)}>
                閉じる
              </Button>
            </div>
            <div className={s.sheetBody}>
              <PlayMat zones={matZones} />
            </div>
          </Panel>
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

        {/* 台詞カードは1枚だけ表示し、クリックで次へ進める。最後の1枚まで進むと
            そのステップの選択肢（HandDockなど）が現れる（2026-09-22ユーザー指定） */}
        {currentLine && (
          <Table
            speaker={currentLine.speaker}
            speakerCard={currentLine.speakerCard}
            flavor={currentLine.flavor}
            hint={currentLine.hint}
            onClick={atLastLine ? undefined : advanceLine}
          />
        )}

        {step === 'name' && atLastLine && (
          <div className={s.form}>
            <NameProposal busy={busy} error={create.error} onSubmit={startJourney} />
          </div>
        )}

        {step === 'training' && atLastLine && (
          <HandDock hand={TRAINING_CHOICES} onPlay={() => setStep('ability')} />
        )}

        {step === 'ability' && atLastLine && (
          <>
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
          atLastLine &&
          (gearCards.length > 0 ? (
            <>
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
              <Button onClick={() => setStep('resolve')}>先へ進む</Button>
            </div>
          ))}

        {step === 'resolve' && atLastLine && (
          <>
            <HandDock hand={RESOLVE_CHOICES} onPlay={() => becomeAdventurer()} disabled={busy} />
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
      {/* 開いたことが分かるよう、背景を暗くする全画面オーバーレイにする。台詞は台詞カードそのもの
          （Table）を積んで見せる（2026-09-22ユーザー指定） */}
      {showLog && (
        <div className={s.sheetOverlay}>
          <button
            type="button"
            className={s.sheetBackdrop}
            aria-label="背景をクリックして履歴を閉じる"
            onClick={() => setShowLog(false)}
          />
          <Panel className={s.sheet}>
            <div className={s.sheetHead}>
              <h3 className="u-serif">これまでの台詞</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowLog(false)}>
                閉じる
              </Button>
            </div>
            <div className={s.sheetBody} data-stack="true">
              {log.map((line) => (
                // 台詞の文面はステップごとに固定・一意なので、そのままkeyに使える
                <Table
                  key={line.flavor}
                  speaker={line.speaker}
                  speakerCard={line.speakerCard}
                  flavor={line.flavor}
                  hint={line.hint}
                />
              ))}
            </div>
          </Panel>
        </div>
      )}
      {/* position:fixedだと下にスクロールしたときページの内容（決定ボタン等）に
          覆いかぶさってしまうので、ページの最後に普通に流し込み右寄せするだけにする
          （2026-09-22ユーザー指摘：右下のカードが被る） */}
      <div className="u-mt" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <GameCard
          card={{ id: 'log', kind: 'info', name: '台詞の履歴', tags: [] }}
          width={44}
          portrait
          iconOnly
          selected={showLog}
          onClick={() => setShowLog((v) => !v)}
          title={showLog ? '履歴を閉じる' : 'これまでの台詞を見る'}
        />
        <GameCard
          card={{ id: 'play-mat', kind: 'scene', name: 'プレイマット', tags: [] }}
          width={44}
          portrait
          iconOnly
          selected={showMat}
          onClick={() => setShowMat((v) => !v)}
          title={showMat ? 'プレイマットを閉じる' : 'プレイマットで見る'}
        />
      </div>
    </>
  );
}
