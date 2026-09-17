'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { logoutAdmin } from '@/lib/actions';

import BrandMark from './BrandMark';

const ITEMS = [
  { href: '/dashboard', label: 'Tổng quan', icon: GridIcon },
  { href: '/ai', label: 'AI', icon: SparkIcon },
  { href: '/translate', label: 'Dịch', icon: TranslateIcon },
  { href: '/quick-replies', label: 'Quick Reply', icon: ReplyIcon },
  { href: '/usernames', label: 'Username', icon: AtIcon },
  { href: '/upgrades', label: 'Nâng cấp', icon: StarIcon },
];

type Props = {
  name: string;
  email: string;
};

type Indicator = {
  top: number;
  height: number;
  ready: boolean;
};

function isItemActive(href: string, path: string) {
  return path === href || path.startsWith(`${href}/`);
}

export default function Sidebar({ name, email }: Props) {
  const pathname = usePathname();
  const [activeHref, setActiveHref] = useState(pathname);
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<Indicator>({ top: 0, height: 0, ready: false });
  const initial = name.trim().charAt(0).toUpperCase() || 'A';

  useEffect(() => {
    setActiveHref(pathname);
  }, [pathname]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('a.active');
    if (!nav || !active) {
      return;
    }

    setIndicator({
      top: active.offsetTop,
      height: active.offsetHeight,
      ready: true,
    });
  }, [activeHref]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return undefined;
    }

    const update = () => {
      const active = nav.querySelector<HTMLElement>('a.active');
      if (!active) {
        return;
      }

      setIndicator({
        top: active.offsetTop,
        height: active.offsetHeight,
        ready: true,
      });
    };

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <aside className="sidebar">
      <div className="brand">
        <BrandMark />
        <div>
          <h1>Telegram Air</h1>
          <p>Admin</p>
        </div>
      </div>
      <nav className="nav" ref={navRef}>
        <span
          className={`nav-indicator${indicator.ready ? ' is-ready' : ''}`}
          style={{
            transform: `translateY(${indicator.top}px)`,
            height: `${indicator.height}px`,
          }}
        />
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.href, activeHref);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? 'active' : undefined}
              onClick={() => setActiveHref(item.href)}
            >
              <span className="nav-icon">
                <Icon />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="account-card">
          <div className="account-user">
            <div className="avatar" aria-hidden="true">{initial}</div>
            <div className="account-meta">
              <strong title={name}>{name}</strong>
              <span title={email}>{email}</span>
            </div>
          </div>
          <form action={logoutAdmin}>
            <button className="logout-btn" type="submit">
              <LogoutIcon />
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 13.7 9l5.8 1.2L13.7 12 12 17.5 10.3 12 4.5 10.2 10.3 9 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TranslateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M4 6h9M8.5 6c0 6 4 10 8.5 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 10.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m13 18 2.2-5.5h.6L18 18M13.8 16h3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M6.5 8.5 4 12l2.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h9.5a5 5 0 0 1 5 5v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AtIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14.6 12v1.6a2 2 0 0 0 3.5 1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="m12 4.5 2.1 4.6 5 .6-3.7 3.4.9 5-4.3-2.5-4.3 2.5.9-5L4.9 9.7l5-.6L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M15 5h2.5A1.5 1.5 0 0 1 19 6.5v11a1.5 1.5 0 0 1-1.5 1.5H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.5 8.5 7 12l3.5 3.5M7 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
