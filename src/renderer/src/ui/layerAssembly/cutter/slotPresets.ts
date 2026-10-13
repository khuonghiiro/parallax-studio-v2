import type { TemplateSlotPreset } from './types'

export const SLOT_PRESETS: TemplateSlotPreset[] = [
  {
    id: 'humanoid_anime',
    name: 'Nhân vật Anime / Manga (Tóc, Mặt, Thân, Khớp tay & chân)',
    category: 'character',
    description: 'Khung mẫu giải phẫu đầy đủ cho nhân vật anime: Tóc trước, Tóc sau, Đầu trọc, Thân áo, Tay và Chân.',
    slots: [
      { id: 'hair_front', name: 'Tóc trước (Mái)', role: 'hair-front', x: 0, y: -160, width: 140, height: 100, z: -10 },
      { id: 'face_details', name: 'Lông mày / Râu', role: 'face', x: 0, y: -110, width: 70, height: 35, z: -5 },
      { id: 'head', name: 'Đầu (Khuôn mặt)', role: 'head', x: 0, y: -115, width: 110, height: 110, z: 0 },
      { id: 'hair_back', name: 'Tóc sau / Đuôi', role: 'hair-back', x: 0, y: -150, width: 130, height: 130, z: 25 },
      { id: 'torso', name: 'Thân áo / Ngực', role: 'torso', x: 0, y: 10, width: 105, height: 130, z: 5 },
      { id: 'arm_left', name: 'Cánh tay trái', role: 'arm-left', x: -70, y: -15, width: 50, height: 75, z: 8 },
      { id: 'forearm_left', name: 'Cẳng tay / Bàn tay trái', role: 'forearm-left', x: -90, y: 45, width: 50, height: 75, z: 6 },
      { id: 'arm_right', name: 'Cánh tay phải', role: 'arm-right', x: 70, y: -15, width: 50, height: 75, z: 8 },
      { id: 'forearm_right', name: 'Cẳng tay / Bàn tay phải', role: 'forearm-right', x: 90, y: 45, width: 50, height: 75, z: 6 },
      { id: 'leg_left', name: 'Chân trái', role: 'leg-left', x: -30, y: 145, width: 50, height: 120, z: 12 },
      { id: 'leg_right', name: 'Chân phải', role: 'leg-right', x: 30, y: 145, width: 50, height: 120, z: 12 }
    ]
  },
  {
    id: 'simple_puppet',
    name: 'Búp bê cơ bản (7 phần: Đầu, Tóc, Thân, 2 Tay, 2 Chân)',
    category: 'character',
    description: 'Cấu trúc tối giản, nhanh gọn cho mọi nhân vật hoạt hình đơn giản.',
    slots: [
      { id: 'hair', name: 'Tóc', role: 'hair', x: 0, y: -140, width: 130, height: 100, z: -5 },
      { id: 'head', name: 'Đầu', role: 'head', x: 0, y: -100, width: 110, height: 110, z: 0 },
      { id: 'torso', name: 'Thân', role: 'torso', x: 0, y: 15, width: 100, height: 120, z: 5 },
      { id: 'arm_left', name: 'Tay trái', role: 'arm-left', x: -75, y: 15, width: 45, height: 95, z: 8 },
      { id: 'arm_right', name: 'Tay phải', role: 'arm-right', x: 75, y: 15, width: 45, height: 95, z: 8 },
      { id: 'leg_left', name: 'Chân trái', role: 'leg-left', x: -30, y: 140, width: 45, height: 110, z: 10 },
      { id: 'leg_right', name: 'Chân phải', role: 'leg-right', x: 30, y: 140, width: 45, height: 110, z: 10 }
    ]
  },
  {
    id: 'freeform',
    name: 'Bố cục tự do (Không dùng khung cố định)',
    category: 'custom',
    description: 'Thoải mái dán và kéo thả các mảnh vào bất kỳ vị trí nào trên canvas.',
    slots: []
  }
]
