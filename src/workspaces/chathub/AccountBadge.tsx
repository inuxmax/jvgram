import { memo } from '../../lib/teact/teact';

import styles from './ChatHub.module.scss';

type OwnProps = {
  name: string;
};

const AccountBadge = ({ name }: OwnProps) => {
  return <span className={styles.accountBadge}>{name}</span>;
};

export default memo(AccountBadge);
