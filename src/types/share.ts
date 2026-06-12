export interface ShareLink {
  projectId: string;
  token: string;
  isActive: boolean;
  pinHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShareLinksData {
  links: ShareLink[];
}
