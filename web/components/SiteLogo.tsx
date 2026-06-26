import Image from 'next/image';
import Link from 'next/link';

export function SiteLogo({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={`inline-flex shrink-0 rounded-lg overflow-hidden hover:opacity-90 transition-opacity ${className}`.trim()}
      aria-label="Bankr Space home"
    >
      <Image
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        priority
        className="block"
      />
    </Link>
  );
}
