import Image from 'next/image';
import Link from 'next/link';

export function SiteLogo({ size = 36 }: { size?: number }) {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
      aria-label="Bankr Space home"
    >
      <Image
        src="/logo.png"
        alt="Bankr Space"
        width={size}
        height={size}
        priority
        className="block"
      />
    </Link>
  );
}
