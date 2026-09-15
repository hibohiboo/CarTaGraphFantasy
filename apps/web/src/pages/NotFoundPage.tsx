import { Link } from 'react-router';
import { PageHeader } from '../components';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="ページが見つかりません" crumb="このカードはまだ場に出ていないようです。" />
      <p>
        <Link to="/">ホームへ戻る</Link> ／ <Link to="/admin/sitemap">サイトマップを見る</Link>
      </p>
    </>
  );
}
