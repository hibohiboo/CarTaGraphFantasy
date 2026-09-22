import { lazy, type ReactNode, Suspense } from 'react';
import { createHashRouter, type RouteObject } from 'react-router';
import { Loading } from '../components/ui';
import { EntrancePage } from '../pages/EntrancePage';
import { GmScenarioDetailPage } from '../pages/gm/GmScenarioDetailPage';
import { GmScenarioListPage } from '../pages/gm/GmScenarioListPage';
import { GmSessionListPage } from '../pages/gm/GmSessionListPage';
import { GmSessionManagePage } from '../pages/gm/GmSessionManagePage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { CharacterCreatePage } from '../pages/pl/CharacterCreatePage';
import { CharacterListPage } from '../pages/pl/CharacterListPage';
import { CharacterSheetPage } from '../pages/pl/CharacterSheetPage';
import { PlayPage } from '../pages/pl/PlayPage';
import { SessionBrowsePage } from '../pages/pl/SessionBrowsePage';
import { TutorialPage } from '../pages/pl/TutorialPage';
import { LibraryPage } from '../pages/rulebook/LibraryPage';
import { RulebookIndexPage } from '../pages/rulebook/RulebookIndexPage';
import { RulebookSectionPage } from '../pages/rulebook/RulebookSectionPage';
import { AppShell } from './AppShell';

// 通常のプレイヤー・GM導線では訪れないロール別ページ（管理者・シナリオ作成者）は
// 初期バンドルから外し、遅延importする（docs/plans/2026-09-22-react-best-practices適用.md 3.1）
const SitemapPage = lazy(() =>
  import('../pages/admin/SitemapPage').then((m) => ({ default: m.SitemapPage })),
);
const ComponentCatalogPage = lazy(() =>
  import('../pages/admin/ComponentCatalogPage').then((m) => ({ default: m.ComponentCatalogPage })),
);
const CreatorScenarioListPage = lazy(() =>
  import('../pages/creator/CreatorScenarioListPage').then((m) => ({
    default: m.CreatorScenarioListPage,
  })),
);
const CreatorScenarioEditPage = lazy(() =>
  import('../pages/creator/CreatorScenarioEditPage').then((m) => ({
    default: m.CreatorScenarioEditPage,
  })),
);
const CreatorSceneEditPage = lazy(() =>
  import('../pages/creator/CreatorSceneEditPage').then((m) => ({
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
