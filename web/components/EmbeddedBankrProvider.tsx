'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  Suspense,
} from 'react';
import { useSearchParams } from 'next/navigation';

export const BANKR_WALLET_MESSAGE = 'BANKR_WALLET';
export const BANKR_EMBED_READY_MESSAGE = 'BANKR_EMBED_READY';
export const BANKR_REQUIRE_SIGNIN_MESSAGE = 'BANKR_REQUIRE_SIGNIN';

type EmbedContextValue = {
  isEmbedded: boolean;
  walletAddress: string | null;
  authenticated: boolean;
  ready: boolean;
  requestSignIn: () => void;
};

const EmbedContext = createContext<EmbedContextValue>({
  isEmbedded: false,
  walletAddress: null,
  authenticated: false,
  ready: false,
  requestSignIn: () => {},
});

function EmbeddedBankrProviderInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get('embed') === 'bankr';
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [ready, setReady] = useState(!isEmbedded);

  const requestSignIn = useCallback(() => {
    if (!isEmbedded || typeof window === 'undefined') return;
    window.parent.postMessage({ type: BANKR_REQUIRE_SIGNIN_MESSAGE }, '*');
  }, [isEmbedded]);

  useEffect(() => {
    if (!isEmbedded || typeof window === 'undefined') return;

    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.type !== BANKR_WALLET_MESSAGE) return;
      setWalletAddress(
        typeof data.address === 'string' ? data.address.toLowerCase() : null
      );
      setAuthenticated(!!data.authenticated);
      setReady(true);
    }

    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: BANKR_EMBED_READY_MESSAGE }, '*');

    return () => window.removeEventListener('message', onMessage);
  }, [isEmbedded]);

  return (
    <EmbedContext.Provider
      value={{ isEmbedded, walletAddress, authenticated, ready, requestSignIn }}
    >
      {children}
    </EmbedContext.Provider>
  );
}

export function EmbeddedBankrProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <EmbeddedBankrProviderInner>{children}</EmbeddedBankrProviderInner>
    </Suspense>
  );
}

export function useEmbeddedBankr() {
  return useContext(EmbedContext);
}
