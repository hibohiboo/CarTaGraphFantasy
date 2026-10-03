import { lazy, type ReactNode, Suspense } from 'react';
import { createHashRouter, type RouteObject } from 'react-router';
import { EntrancePage } from '@/pages/entrance/ui/EntrancePage';
import { GmScenarioDetailPage } from '@/pages/gm/scenario-detail/ui/GmScenarioDetailPage';
import { GmScenarioListPage } from '@/pages/gm/scenario-list/ui/GmScenarioListPage';
import { GmSessionListPage } from '@/pages/gm/session-list/ui/GmSessionListPage';
import { GmSessionManagePage } from '@/pages/gm/session-manage/ui/GmSessionManagePage';
import { HomePage } from '@/pages/home/ui/HomePage';
import { NotFoundPage } from '@/pages/not-found/ui/NotFoundPage';
import { CharacterCreatePage } from '@/pages/pl/character-create/ui/CharacterCreatePage';
import { CharacterListPage } from '@/pages/pl/character-list/ui/CharacterListPage';
import { CharacterSheetPage } from '@/pages/pl/character-sheet/ui/CharacterSheetPage';
import { PlayPage } from '@/pages/pl/play/ui/PlayPage';
import { SessionBrowsePage } from '@/pages/pl/session-browse/ui/SessionBrowsePage';
import { TutorialPage } from '@/pages/pl/tutorial/ui/TutorialPage';
import { VillageStartPage } from '@/pages/pl/village-start/ui/VillageStartPage';
import { LibraryPage } from '@/pages/rulebook/library/ui/LibraryPage';
import { RulebookSectionPage } from '@/pages/rulebook/section/ui/RulebookSectionPage';
import { RulebookIndexPage } from '@/pages/rulebook/toc/ui/RulebookIndexPage';
import { Loading } from '@/shared/ui/ui';
import { AppShell } from './AppShell';

// 通常のプレイヤー・GM導線では訪れないロール別ページ（管理者・シナリオ作成者）は
// 初期バンドルから外し、遅延importする（docs/plans/2026-09-22-react-best-practices適用.md 3.1）
const SitemapPage = lazy(() =>
  import('@/pages/admin/sitemap/ui/SitemapPage').then((m) => ({ default: m.SitemapPage })),
);
const ComponentCatalogPage = lazy(() =>
  import('@/pages/admin/component-catalog/ui/ComponentCatalogPage').then((m) => ({
    default: m.ComponentCatalogPage,
  })),
);
const CreatorScenarioListPage = lazy(() =>
  import('@/pages/creator/scenario-list/ui/CreatorScenarioListPage').then((m) => ({
    default: m.CreatorScenarioListPage,
  })),
);
const CreatorScenarioEditPage = lazy(() =>
  import('@/pages/creator/scenario-edit/ui/CreatorScenarioEditPage').then((m) => ({
    default: m.CreatorScenarioEditPage,
  })),
);
const CreatorSceneEditPage = lazy(() =>
  import('@/pages/creator/scene-edit/ui/CreatorSceneEditPage').then((m) => ({
    default: m.CreatorSceneEditPage,
  })),
);

const lazyPage = (element: ReactNode) => <Suspense fallback={<Loading />}>{element}</Suspense>;

// パスの一覧は routes.ts（サイトマップの情報源）と一致させる
export const routeObjects: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <EntrancePage /> },
      { path: 'home', element: <HomePage /> },
      { path: 'pl/sessions', element: <SessionBrowsePage /> },
      { path: 'pl/sessions/:sessionId/play', element: <PlayPage /> },
      { path: 'pl/characters', element: <CharacterListPage /> },
      { path: 'pl/characters/new', element: <CharacterCreatePage /> },
      { path: 'pl/tutorial', element: <TutorialPage /> },
      { path: 'pl/village-start', element: <VillageStartPage /> },
      { path: 'pl/characters/:characterId', element: <CharacterSheetPage /> },
      { path: 'gm/scenarios', element: <GmScenarioListPage /> },
      { path: 'gm/scenarios/:scenarioId', element: <GmScenarioDetailPage /> },
      { path: 'gm/sessions', element: <GmSessionListPage /> },
      { path: 'gm/sessions/:sessionId', element: <GmSessionManagePage /> },
      { path: 'creator/scenarios', element: lazyPage(<CreatorScenarioListPage />) },
      { path: 'creator/scenarios/:scenarioId', element: lazyPage(<CreatorScenarioEditPage />) },
      {
        path: 'creator/scenarios/:scenarioId/scenes/:sceneId',
        element: lazyPage(<CreatorSceneEditPage />),
      },
      { path: 'rulebook', element: <RulebookIndexPage /> },
      { path: 'rulebook/how-to-play', element: <RulebookSectionPage sectionId="how-to-play" /> },
      { path: 'rulebook/checks', element: <RulebookSectionPage sectionId="checks" /> },
      { path: 'rulebook/library', element: <LibraryPage /> },
      { path: 'admin/sitemap', element: lazyPage(<SitemapPage />) },
      { path: 'admin/components', element: lazyPage(<ComponentCatalogPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

// GitHub Pages（サブパス配下・SPAフォールバック無し）でも動くよう Hash ルーターを使う
export const router = createHashRouter(routeObjects);
