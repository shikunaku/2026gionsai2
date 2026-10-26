import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/** サポートする音声ファイルの拡張子 */
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac']);

/**
 * GET /api/audio-files
 * public/audio/ ディレクトリ内の音声ファイル名一覧を取得します。
 */
export async function GET() {
  try {
    const audioDir = path.join(process.cwd(), 'public', 'audio');

    if (!fs.existsSync(audioDir)) {
      return NextResponse.json({ files: [] });
    }

    const entries = await fs.promises.readdir(audioDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => {
        if (name.startsWith('.')) return false; // .gitkeep等を除外
        const ext = path.extname(name).toLowerCase();
        return AUDIO_EXTENSIONS.has(ext);
      })
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ files });
  } catch (error) {
    console.error('[API] /api/audio-files error:', error);
    return NextResponse.json({ files: [], error: 'Failed to read audio files' }, { status: 500 });
  }
}
