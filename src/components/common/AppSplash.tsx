import { memo } from '../../lib/teact/teact';

import { APP_NAME, PAGE_TITLE, PAGE_TITLE_TAURI } from '../../config';
import { IS_TAURI } from '../../util/browser/globalEnvironment';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import styles from './AppSplash.module.scss';

import telegramLogoPath from '../../assets/telegram-logo.svg';

type OwnProps = {
  className?: string;
};

const HTML_SPLASH_ID = 'app-splash';
const HTML_SPLASH_HIDE_MS = 220;
const CUBE_FACES = ['front', 'back', 'right', 'left', 'top', 'bottom'] as const;
const SPARK_ANGLES = [0, 90, 180, 270];
const APP_BRAND = IS_TAURI ? PAGE_TITLE_TAURI : (PAGE_TITLE || APP_NAME);

export function hideHtmlAppSplash() {
  const el = document.getElementById(HTML_SPLASH_ID);
  if (!el) return;

  el.classList.add('is-leaving');
  window.setTimeout(() => {
    el.remove();
  }, HTML_SPLASH_HIDE_MS);
}

const AppSplash = ({ className }: OwnProps) => {
  const lang = useLang();

  return (
    <div
      className={buildClassName(styles.root, className)}
      role="status"
      aria-live="polite"
      aria-label={lang('AccAppSplash', { app: APP_BRAND })}
    >
      <div className={styles.aura} />
      <div className={styles.stage}>
        <div className={styles.ring} />
        <div className={styles.ringMid} />
        <div className={styles.ringInner} />
        <div className={styles.cube}>
          {CUBE_FACES.map((face) => (
            <div key={face} className={buildClassName(styles.face, styles[face])} />
          ))}
        </div>
        <div className={styles.sparks}>
          {SPARK_ANGLES.map((angle) => (
            <span
              key={angle}
              className={styles.spark}
              style={`transform: rotateY(${angle}deg) rotateX(68deg) translateZ(5.75rem)`}
            />
          ))}
        </div>
        <div className={styles.logoWrap}>
          <img
            src={telegramLogoPath}
            alt=""
            draggable={false}
            className={styles.logo}
          />
        </div>
        <div className={styles.floor} />
      </div>
      <div className={styles.meta}>
        <span className={styles.brand}>{APP_BRAND}</span>
        <span className={styles.dots} aria-hidden={true}>
          <span className={styles.dot} />
          <span className={buildClassName(styles.dot, styles.dotSecond)} />
          <span className={buildClassName(styles.dot, styles.dotThird)} />
        </span>
      </div>
    </div>
  );
};

export default memo(AppSplash);
