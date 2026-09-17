import { memo } from '../../../lib/teact/teact';

import type { TabWithProperties } from '../../ui/TabList';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import TabList from '../../ui/TabList';

import styles from './ChatFolderTabList.module.scss';

type OwnProps = {
  tabs: readonly TabWithProperties[];
  activeTab: number;
  className?: string;
  onSwitchTab: (index: number) => void;
  onFileHoverOpen: (index: number) => void;
};

const ChatFolderTabList = ({
  tabs,
  activeTab,
  className,
  onSwitchTab,
  onFileHoverOpen,
}: OwnProps) => {
  const renderExtra = useLastCallback((tab: TabWithProperties) => {
    if (!tab.badgeCount) return undefined;
    return (
      <span className={buildClassName(styles.badge, tab.isBadgeActive && styles.badgeActive)}>
        {tab.badgeCount}
      </span>
    );
  });

  return (
    <div className={styles.root}>
      <TabList
        layout="vertical"
        itemAlignment="vertical"
        tabs={tabs}
        activeTab={activeTab}
        renderExtra={renderExtra}
        className={buildClassName(styles.tabList, className)}
        tabClassName={styles.tab}
        onSwitchTab={onSwitchTab}
        onFileHoverOpen={onFileHoverOpen}
      />
    </div>
  );
};

export default memo(ChatFolderTabList);
