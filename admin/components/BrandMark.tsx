type Props = {
  className?: string;
};

export default function BrandMark({ className }: Props) {
  return (
    <div className={className || 'brand-mark'} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
        <path
          d="M3.2 11.1 20.1 4.4c.8-.3 1.5.5 1.2 1.3l-4.1 14.2c-.3.9-1.5 1-1.9.2l-3.4-6.4-6.5 2.2c-.8.3-1.6-.5-1.3-1.3l.1-.3Z"
          fill="currentColor"
        />
        <path d="m10.6 12.8 8.4-7.2-5.9 9.4-2.5 4.7V12.8Z" fill="#fff" opacity="0.35" />
      </svg>
    </div>
  );
}
