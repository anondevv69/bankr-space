const PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const MAX_BANNER_BYTES = 4.5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type PinataPinResult = {
  cid: string;
  ipfsUri: string;
  gatewayUrl: string;
};

export function ipfsUriFromCid(cid: string): string {
  return `ipfs://${cid}`;
}

export function pinataGatewayUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

export function assertBannerFile(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Banner must be PNG, JPG, or WebP');
  }
  if (file.size > MAX_BANNER_BYTES) {
    throw new Error('Banner too large (max 4.5 MB)');
  }
}

export async function pinFileToIpfs(
  file: Blob,
  filename: string,
  metadata?: Record<string, string>
): Promise<PinataPinResult> {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    throw new Error('Image upload is not configured (PINATA_JWT missing)');
  }

  const form = new FormData();
  form.append('file', file, filename);
  form.append(
    'pinataMetadata',
    JSON.stringify({
      name: filename,
      keyvalues: metadata || {},
    })
  );
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(PINATA_PIN_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  const data = (await res.json().catch(() => ({}))) as {
    IpfsHash?: string;
    error?: string;
  };

  if (!res.ok || !data.IpfsHash) {
    throw new Error(data.error || 'Pinata upload failed');
  }

  const cid = data.IpfsHash;
  return {
    cid,
    ipfsUri: ipfsUriFromCid(cid),
    gatewayUrl: pinataGatewayUrl(cid),
  };
}
