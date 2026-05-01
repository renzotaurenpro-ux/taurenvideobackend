import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

@Injectable()
export class BunnyService {
  private readonly libraryId: string;
  private readonly apiKey: string;
  private readonly cdnHostname: string;
  private readonly baseUrl = 'https://video.bunnycdn.com';

  constructor(private config: ConfigService) {
    this.libraryId = this.config.get<string>('BUNNY_LIBRARY_ID')!;
    this.apiKey = this.config.get<string>('BUNNY_API_KEY')!;
    this.cdnHostname = this.config.get<string>('BUNNY_CDN_HOSTNAME')!;
  }

  async createVideoSlot(title: string): Promise<{ videoId: string; embedUrl: string }> {
    const res = await fetch(`${this.baseUrl}/library/${this.libraryId}/videos`, {
      method: 'POST',
      headers: {
        AccessKey: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      throw new Error(`Bunny create video failed: ${res.status} ${await res.text()}`);
    }

    const { guid } = (await res.json()) as { guid: string };

    return {
      videoId: guid,
      embedUrl: `https://iframe.mediadelivery.net/embed/${this.libraryId}/${guid}`,
    };
  }

  generateUploadHeaders(videoId: string): {
    uploadUrl: string;
    headers: {
      AuthorizationSignature: string;
      AuthorizationExpire: number;
      VideoId: string;
      LibraryId: string;
    };
  } {
    const expirationTime = Math.floor(Date.now() / 1000) + 3600;
    const signature = createHash('sha256')
      .update(this.libraryId + this.apiKey + expirationTime + videoId)
      .digest('hex');

    return {
      uploadUrl: 'https://video.bunnycdn.com/tusupload',
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: expirationTime,
        VideoId: videoId,
        LibraryId: this.libraryId,
      },
    };
  }

  async deleteVideo(videoId: string): Promise<void> {
    await fetch(`${this.baseUrl}/library/${this.libraryId}/videos/${videoId}`, {
      method: 'DELETE',
      headers: { AccessKey: this.apiKey },
    });
  }
}
