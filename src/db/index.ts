export interface DownloadRecord {
  id?: string;
  sourceUrl: string;
  provider: string;
  mediaType: string;
  filename?: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

export interface DatabaseAdapter {
  saveDownloadRecord(record: DownloadRecord): Promise<DownloadRecord>;
  getRecentDownloads(limit?: number): Promise<DownloadRecord[]>;
}

export class InMemoryDatabase implements DatabaseAdapter {
  private records: DownloadRecord[] = [];

  async saveDownloadRecord(record: DownloadRecord): Promise<DownloadRecord> {
    const saved: DownloadRecord = {
      ...record,
      id: `dl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
    this.records.unshift(saved);
    if (this.records.length > 500) {
      this.records.pop();
    }
    return saved;
  }

  async getRecentDownloads(limit: number = 20): Promise<DownloadRecord[]> {
    return this.records.slice(0, limit);
  }
}

export const db: DatabaseAdapter = new InMemoryDatabase();
