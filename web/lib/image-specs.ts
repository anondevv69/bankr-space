/** Bankr launch token images are square 1024×1024 (1:1). */
export const ICON_MAX_SIZE = 1024;
export const ICON_MIN_SIZE = 64;
export const ICON_ASPECT_LABEL = '1:1';
export const ICON_SIZE_LABEL = `${ICON_MAX_SIZE}×${ICON_MAX_SIZE}px`;

export const BANNER_WIDTH = 1500;
export const BANNER_HEIGHT = 500;
export const BANNER_ASPECT_LABEL = '3:1';
export const BANNER_SIZE_LABEL = `${BANNER_WIDTH}×${BANNER_HEIGHT}px`;

export type ImageKind = 'icon' | 'banner';

export type ImageDimensions = { width: number; height: number };

export function validateImageDimensions(
  dimensions: ImageDimensions,
  kind: ImageKind
): void {
  const { width, height } = dimensions;
  if (!width || !height) {
    throw new Error('Could not read image dimensions');
  }

  if (kind === 'icon') {
    if (width !== height) {
      throw new Error(
        `Token icon must be square (${ICON_ASPECT_LABEL}). Got ${width}×${height}px.`
      );
    }
    if (width < ICON_MIN_SIZE || height < ICON_MIN_SIZE) {
      throw new Error(
        `Token icon too small — minimum ${ICON_MIN_SIZE}×${ICON_MIN_SIZE}px (Bankr standard max ${ICON_SIZE_LABEL}).`
      );
    }
    if (width > ICON_MAX_SIZE || height > ICON_MAX_SIZE) {
      throw new Error(
        `Token icon too large — maximum ${ICON_SIZE_LABEL} (matches Bankr launch images).`
      );
    }
    return;
  }

  if (width !== BANNER_WIDTH || height !== BANNER_HEIGHT) {
    throw new Error(
      `Banner must be exactly ${BANNER_SIZE_LABEL} (${BANNER_ASPECT_LABEL}). Got ${width}×${height}px.`
    );
  }
}
