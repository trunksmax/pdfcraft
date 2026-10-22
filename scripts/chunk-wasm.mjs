import fs from 'fs';
import path from 'path';

// 设定单文件分块大小为 15MB（低于 Cloudflare Pages 的 25MB 限制）
const CHUNK_SIZE = 15 * 1024 * 1024;

function splitFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const fileBuffer = fs.readFileSync(filePath);
  if (fileBuffer.length <= CHUNK_SIZE) return;

  const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE);
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath);

  console.log(`[Chunking] 正在切片超大文件: ${baseName} (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB) -> ${totalChunks} 个分块`);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileBuffer.length);
    const chunkBuffer = fileBuffer.subarray(start, end);
    fs.writeFileSync(path.join(dir, `${baseName}.part${i + 1}`), chunkBuffer);
  }

  // 保存清单文件供前端 Service Worker 获取配置
  fs.writeFileSync(
    path.join(dir, `${baseName}.manifest.json`),
    JSON.stringify({ totalChunks, originalSize: fileBuffer.length, chunkSize: CHUNK_SIZE })
  );

  // 删除超大原文件，防止 Cloudflare Pages 构建报错
  fs.unlinkSync(filePath);
  console.log(`[Chunking] 切片完成，已删除原文件: ${baseName}`);
}

const targetDir = path.join(process.cwd(), process.argv[2] || 'public', 'libreoffice-wasm');

// 1. 同时对解压前的大型 .gz 压缩包进行切片
splitFile(path.join(targetDir, 'soffice.data.bin.gz'));
splitFile(path.join(targetDir, 'soffice.wasm.bin.gz'));

// 2. 对解压后可能存在的大型 .bin 文件进行切片
splitFile(path.join(targetDir, 'soffice.data.bin'));
splitFile(path.join(targetDir, 'soffice.wasm.bin'));
