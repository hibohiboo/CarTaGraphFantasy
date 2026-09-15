import type { ParticipantRole, ProposalStatus, UserRole } from '@cartagraph/domain';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import s from './ui.module.css';

// ---------- Panel ----------
export function Panel({
  title,
  sub,
  children,
  className,
  actions,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={[s.panel, className].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <div className={s.pageActions} style={{ justifyContent: 'space-between' }}>
          {title && <h2 className={s.panelTitle}>{title}</h2>}
          {actions}
        </div>
      )}
      {sub && <p className={s.panelSub}>{sub}</p>}
      {children && <div className={s.panelBody}>{children}</div>}
    </section>
  );
}

// ---------- Badge ----------
export type BadgeRole = ParticipantRole | UserRole | 'mode' | 'library';

export function RoleBadge({ role, children }: { role: BadgeRole; children: ReactNode }) {
  return (
    <span className={s.badge} data-role={role}>
      {children}
    </span>
  );
}

// ---------- Chip ----------
export function Chip({ children, tone }: { children: ReactNode; tone?: 'off' | 'ink' }) {
  return (
    <span className={s.chip} data-tone={tone}>
      {children}
    </span>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <div className={s.chipGroup}>{children}</div>;
}

// ---------- Pill ----------
export type PillStatus = ProposalStatus | 'neutral' | 'good' | 'warn';

export function StatusPill({ status, children }: { status: PillStatus; children: ReactNode }) {
  return (
    <span className={s.pill} data-status={status}>
      {children}
    </span>
  );
}

export function ZonePill({ zone }: { zone: 'gm' | 'pl' }) {
  return (
    <span className={s.zonePill} data-zone={zone}>
      {zone === 'gm' ? 'GM専用' : 'PL可視'}
    </span>
  );
}

// ---------- Button ----------
export type ButtonVariant = 'primary' | 'ink' | 'approve' | 'danger' | 'ghost' | 'link';

export function Button({
  variant = 'primary',
  size,
  block,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm';
  block?: boolean;
}) {
  return (
    <button
      type="button"
      className={s.btn}
      data-variant={variant}
      data-size={size}
      data-block={block ? 'true' : undefined}
      {...rest}
    />
  );
}

// ---------- StatTile ----------
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={s.stats}>{children}</div>;
}

export function StatTile({
  value,
  label,
  tone,
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: 'pending' | 'approved' | 'rejected' | 'neutral';
}) {
  return (
    <div className={s.stat} data-tone={tone}>
      <div className={s.statNum}>{value}</div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}

// ---------- PageHeader ----------
export function PageHeader({
  title,
  crumb,
  actions,
}: {
  title: ReactNode;
  crumb?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={s.pageHead}>
      <div>
        <h1 className={s.pageTitle}>{title}</h1>
        {crumb && <p className={s.pageCrumb}>{crumb}</p>}
      </div>
      {actions && <div className={s.pageActions}>{actions}</div>}
    </header>
  );
}

// ---------- Pips（能力値の丸） ----------
export function Pips({ value, max = 5, label }: { value: number; max?: number; label: string }) {
  return (
    <div className={s.pips} role="img" aria-label={`${label} ${value}`}>
      {Array.from({ length: max }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: max個の無名の丸を並べるだけで、並び替え・増減はしない
        <span key={i} className={s.pip} data-on={i < value ? 'true' : 'false'} />
      ))}
    </div>
  );
}

// ---------- 状態表示 ----------
export function Loading({ what = '読み込み中' }: { what?: string }) {
  return (
    <p className={s.note} role="status">
      {what}…
    </p>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <p className={s.error} role="alert">
      {message}
    </p>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className={s.note}>{children}</p>;
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: children は常にフォームコントロール（input/select/textarea）で、label に包まれる形で関連付く。children は ReactNode 型のため静的解析では検出できない
    <label className={s.field}>
      <span className={s.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

export function Avatar({ name, role }: { name: string; role?: ParticipantRole }) {
  return (
    <span className={s.avatar} data-role={role} aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}
