import { createHashRouter, type RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SessionBrowsePage } from '../pages/pl/SessionBrowsePage';
import { PlayPage } from '../pages/pl/PlayPage';
import { CharacterListPage } from '../pages/pl/CharacterListPage';
import { CharacterCreatePage } from '../pages/pl/CharacterCreatePage';
import { CharacterSheetPage } from '../pages/pl/CharacterSheetPage';
import { GmScenarioListPage } from '../pages/gm/GmScenarioListPage';
import { GmScenarioDetailPage } from '../pages/gm/GmScenarioDetailPage';
import { GmSessionListPage } from '../pages/gm/GmSessionListPage';
import { GmSessionManagePage } from '../pages/gm/GmSessionManagePage';
import { CreatorScenarioListPage } from '../pages/creator/CreatorScenarioListPage';
import { CreatorScenarioEditPage } from '../pages/creator/CreatorScenarioEditPage';
import { RulebookIndexPage } from '../pages/rulebook/RulebookIndexPage';
import { RulebookSectionPage } from '../pages/rulebook/RulebookSectionPage';
import { LibraryPage } from '../pages/rulebook/LibraryPage';
import { SitemapPage } from '../pages/admin/SitemapPage';
import { ComponentCatalogPage } from '../pages/admin/ComponentCatalogPage';

// パスの一覧は routes.ts（サイトマップの情報源）と一致させる
export const routeObjects: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'pl/sessions', element: <SessionBrowsePage /> },
      { path: 'pl/sessions/:sessionId/play', element: <PlayPage /> },
      { path: 'pl/characters', element: <CharacterListPage /> },
      { path: 'pl/characters/new', element: <CharacterCreatePage /> },
      { path: 'pl/characters/:characterId', element: <CharacterSheetPage /> },
      { path: 'gm/scenarios', element: <GmScenarioListPage /> },
      { path: 'gm/scenarios/:scenarioId', element: <GmScenarioDetailPage /> },
      { path: 'gm/sessions', element: <GmSessionListPage /> },
      { path: 'gm/sessions/:sessionId', element: <GmSessionManagePage /> },
      { path: 'creator/scenarios', element: <CreatorScenarioListPage /> },
      { path: 'creator/scenarios/:scenarioId', element: <CreatorScenarioEditPage /> },
      { path: 'rulebook', element: <RulebookIndexPage /> },
      { path: 'rulebook/how-to-play', element: <RulebookSectionPage sectionId="how-to-play" /> },
      { path: 'rulebook/checks', element: <RulebookSectionPage sectionId="checks" /> },
      { path: 'rulebook/library', element: <LibraryPage /> },
      { path: 'admin/sitemap', element: <SitemapPage /> },
      { path: 'admin/components', element: <ComponentCatalogPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

// GitHub Pages（サブパス配下・SPAフォールバック無し）でも動くよう Hash ルーターを使う
export const router = createHashRouter(routeObjects);
