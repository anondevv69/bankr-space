import { readImageDimensions } from './image-dimensions';
import {
  type ImageKind,
  validateImageDimensions,
} from './image-specs';

const PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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

export function assertImageFile(file: File, label = 'Image'): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`${label} must be PNG, JPG, WebP, or GIF`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${label} too large (max 4.5 MB)`);
  }
}

export async function assertImageBufferDimensions(
  buffer: ArrayBuffer,
  kind: ImageKind
): Promise<void> {
  const dimensions = readImageDimensions(buffer);
  if (!dimensions) {
    throw new Error('Could not read image dimensions — use PNG, JPG, WebP, or GIF');
  }
  validateImageDimensions(dimensions, kind);
}

export async function assertImageFileDimensions(
  file: File,
  kind: ImageKind
): Promise<void> {
  const label = kind === 'icon' ? 'Token icon' : 'Banner';
  assertImageFile(file, label);
  await assertImageBufferDimensions(await file.arrayBuffer(), kind);
}

/** @deprecated use assertImageFile */
export function assertBannerFile(file: File): void {
  assertImageFile(file, 'Banner');
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
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

/** Fetch a remote image URL and pin it to IPFS (for Bankr/Dex defaults or URL paste). */
export async function pinRemoteUrlToIpfs(
  sourceUrl: string,
  filename: string,
  metadata?: Record<string, string>,
  options?: { validateKind?: ImageKind }
): Promise<PinataPinResult> {
  const url = String(sourceUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Remote image URL must be https://');
  }

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Could not fetch image (${res.status})`);
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error('URL did not return an image');
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Remote image too large (max 4.5 MB)');
  }

  if (options?.validateKind) {
    await assertImageBufferDimensions(buffer, options.validateKind);
  }

  const ext = extensionForContentType(contentType);
  const blob = new Blob([buffer], { type: contentType.split(';')[0] });
  return pinFileToIpfs(blob, filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`, {
    ...metadata,
    sourceUrl: url.slice(0, 200),
  });
}
