import os

def write_png(filepath, size):
    """Генерирует PNG-иконку вручную (без внешних библиотек)."""
    import struct, zlib

    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

    rows = []
    cx, cy = size // 2, size // 2
    r1, g1, b1 = 230, 57, 70    # красный
    r2, g2, b2 = 29, 53, 87     # тёмно-синий

    for y in range(size):
        row = bytearray()
        for x in range(size):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            t = min(dist / (size * 0.47), 1.0)
            r = int(r1 + (r2 - r1) * t)
            g = int(g1 + (g2 - g1) * t)
            b = int(b1 + (b2 - b1) * t)

            if dist > size * 0.48:
                row.extend([0, 0, 0, 0])  # прозрачный
            else:
                # Рисуем белую букву «W»
                scale = size / 48
                px, py = int(x / scale), int(y / scale)
                is_w = (
                    (16 <= px <= 32 and 10 <= py <= 14) or
                    (14 <= px <= 18 and 14 <= py <= 38) or
                    (22 <= px <= 26 and 28 <= py <= 38) or
                    (30 <= px <= 34 and 14 <= py <= 38) or
                    (30 <= px <= 34 and 10 <= py <= 14)
                )
                if is_w:
                    row.extend([255, 255, 255, 255])
                else:
                    row.extend([r, g, b, 255])
        rows.append(bytes(row))

    raw = b''.join(rows)
    compressed = zlib.compress(raw)
    sig   = b'\x89PNG\r\n\x1a\n'
    ihdr  = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    idat  = chunk(b'IDAT', compressed)
    iend  = chunk(b'IEND', b'')

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'wb') as f:
        f.write(sig + ihdr + idat + iend)


for s in [16, 48, 128]:
    write_png(f'icons/icon{s}.png', s)
    print(f'✅ icons/icon{s}.png')
