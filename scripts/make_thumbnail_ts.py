import base64

with open('asset-3ds/tudor_cottage/thumb.webp', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

with open('src/renderer/src/ui/assets/models3d/cottageThumbnail.ts', 'w', encoding='utf-8') as f:
    f.write(f'export const COTTAGE_THUMBNAIL = "data:image/webp;base64,{b64}"\n')

print('Success: wrote cottageThumbnail.ts, size:', len(b64))
