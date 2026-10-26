import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/** サポートする動画ファイルの拡張子 */
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov']);

/**
 * GET /api/video-files
 * public/videos/ ディレクトリ内の動画ファイル名一覧を取得します。
 */
export async function GET() {
  try {
    const videoDir = path.join(process.cwd(), 'public', 'videos');

    if (!fs.existsSync(videoDir)) {
      return NextResponse.json({ files: [] });
    }

    const entries = await fs.promises.readdir(videoDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => {
        if (name.startsWith('.')) return false;
        const ext = path.extname(name).toLowerCase();
        return VIDEO_EXTENSIONS.has(ext);
      })
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ files });
  } catch (error) {
    console.error('[API] /api/video-files error:', error);
    return NextResponse.json({ files: [], error: 'Failed to read video files' }, { status: 500 });
  }
}
