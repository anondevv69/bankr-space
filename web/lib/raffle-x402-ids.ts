/** x402 accepts beneficiary `custom-*` campaigns — not `raffle-*`. */

export function raffleX402CampaignId(raffleId: string): string {
  const slug = raffleId.toLowerCase().replace(/_/g, '-');
  return `custom-${slug}`;
}

export function parseRaffleX402CampaignId(campaignId: string): string | null {
  const id = campaignId.trim().toLowerCase();
  if (!id.startsWith('custom-rfl-')) return null;
  const slug = id.slice('custom-'.length);
  return slug.length > 0 ? slug : null;
}

export function isRaffleX402CampaignId(campaignId: string): boolean {
  return parseRaffleX402CampaignId(campaignId) != null;
}
