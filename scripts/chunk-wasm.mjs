import fs from 'fs';
import path from 'path';

const CHUNK_SIZE = 15 * 1024 * 1024; // 15MB/块

function splitFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const fileBuffer = fs.readFileSync(filePath);
  if (fileBuffer.length <= CHUNK_SIZE) return;

  const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE);
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = fileBuffer.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    fs.writeFileSync(path.join(dir, `${baseName}.part${i + 1}`), chunk);
  }

  // 生成 manifest 并删除超大原文件
  fs.writeFileSync(
    path.join(dir, `${baseName}.manifest.json`),
    JSON.stringify({ totalChunks, originalSize: fileBuffer.length })
  );
  fs.unlinkSync(filePath);
  console.log(`[Chunking] 已切片并清除大文件: ${baseName}`);
}

const targetDir = path.join(process.cwd(), process.argv[2] || 'public', 'libreoffice-wasm');
splitFile(path.join(targetDir, 'soffice.data.bin'));
splitFile(path.join(targetDir, 'soffice.wasm.bin'));
