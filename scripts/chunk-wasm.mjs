import fs from 'fs';
import path from 'path';

const CHUNK_SIZE = 15 * 1024 * 1024; // 每块 15MB（低于 Cloudflare 25MB 限制）

function splitFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const fileBuffer = fs.readFileSync(filePath);
  const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE);
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath);

  console.log(`[Chunking] 切片 ${baseName} (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB) -> ${totalChunks} 个分块...`);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileBuffer.length);
    const chunkBuffer = fileBuffer.subarray(start, end);
    const chunkPath = path.join(dir, `${baseName}.part${i + 1}`);
    
    fs.writeFileSync(chunkPath, chunkBuffer);
  }

  // 生成配置清单，供前端获取分块总数
  const manifestPath = path.join(dir, `${baseName}.manifest.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({
    totalChunks,
    originalSize: fileBuffer.length,
    chunkSize: CHUNK_SIZE
  }));

  // 删除原超大文件，避免被 Cloudflare Pages 校验拦截
  fs.unlinkSync(filePath);
  console.log(`[Chunking] 完成并已删除原文件: ${baseName}`);
}

const publicDir = process.argv[2] || 'public';
const wasmDir = path.join(process.cwd(), publicDir, 'libreoffice-wasm');

splitFile(path.join(wasmDir, 'soffice.data.bin'));
splitFile(path.join(wasmDir, 'soffice.wasm.bin'));
