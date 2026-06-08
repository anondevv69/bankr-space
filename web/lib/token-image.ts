const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

/** Turn Bankr `imageUri` (ipfs://… or https) into a browser-loadable URL. */
export function resolveTokenImageUrl(imageUri?: string | null): string | null {
  if (!imageUri?.trim()) return null;
  const uri = imageUri.trim();
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  if (uri.startsWith('ipfs://')) {
    return `${IPFS_GATEWAY}${uri.slice(7)}`;
  }
  if (uri.startsWith('baf') || uri.startsWith('Qm')) {
    return `${IPFS_GATEWAY}${uri}`;
  }
  return null;
}
