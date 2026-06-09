'use client';

import Link from 'next/link';
import { Header, Footer } from '@/components/Header';
import { SkillInstallCard } from '@/components/SkillInstallCard';
import { useEmbeddedBankr } from '@/components/EmbeddedBankrProvider';

export default function SkillPage() {
  const embed = useEmbeddedBankr();

  return (
    <div className={`max-w-[720px] mx-auto px-5 pb-16 ${embed.isEmbedded ? 'pt-4' : ''}`}>
      <Header />
      <p className="text-sm text-muted mb-6">
        <Link href="/" className="text-accent-hover hover:underline">
          ← Back to spaces
        </Link>
      </p>
      <SkillInstallCard />
      <Footer />
    </div>
  );
}
