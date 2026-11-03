import { describe, expect, it } from 'vitest'
import {
  calculateMultiFrameGrid,
  extractFrameNumberFromTitle,
  sortAndAssignFrameFiles
} from './loopMultiFrameImporter'

describe('loopMultiFrameImporter', () => {
  describe('extractFrameNumberFromTitle', () => {
    it('trích xuất chính xác số thứ tự frame từ các định dạng tên cơ bản', () => {
      expect(extractFrameNumberFromTitle('1.png')).toBe(1)
      expect(extractFrameNumberFromTitle('1.jpg')).toBe(1)
      expect(extractFrameNumberFromTitle('2')).toBe(2)
      expect(extractFrameNumberFromTitle('3.png')).toBe(3)
      expect(extractFrameNumberFromTitle('4.webp')).toBe(4)
      expect(extractFrameNumberFromTitle('5.png')).toBe(5)
      expect(extractFrameNumberFromTitle('9.gif')).toBe(9)
      expect(extractFrameNumberFromTitle('12.bmp')).toBe(12)
    })

    it('xử lý số có số 0 ở đầu (leading zeros)', () => {
      expect(extractFrameNumberFromTitle('01.png')).toBe(1)
      expect(extractFrameNumberFromTitle('005.jpg')).toBe(5)
      expect(extractFrameNumberFromTitle('0009.webp')).toBe(9)
    })

    it('trích xuất số ở cuối sau dấu gạch dưới, gạch ngang hoặc dấu cách', () => {
      expect(extractFrameNumberFromTitle('frame_1.png')).toBe(1)
      expect(extractFrameNumberFromTitle('frame-05.png')).toBe(5)
      expect(extractFrameNumberFromTitle('dragon_attack_08.png')).toBe(8)
      expect(extractFrameNumberFromTitle('step 3.png')).toBe(3)
      expect(extractFrameNumberFromTitle('layer.4.png')).toBe(4)
    })

    it('trích xuất số ở đầu trước dấu phân cách', () => {
      expect(extractFrameNumberFromTitle('1_walk.png')).toBe(1)
      expect(extractFrameNumberFromTitle('05-run.png')).toBe(5)
      expect(extractFrameNumberFromTitle('3 step.png')).toBe(3)
    })

    it('trích xuất số trong dấu ngoặc đơn (định dạng bản sao Windows)', () => {
      expect(extractFrameNumberFromTitle('character (1).png')).toBe(1)
      expect(extractFrameNumberFromTitle('anim (5).png')).toBe(5)
    })

    it('tự động bỏ qua nhãn độ phân giải 2K, 4K, 8K, 1080p để lấy đúng số frame', () => {
      expect(extractFrameNumberFromTitle('character_4k_5.png')).toBe(5)
      expect(extractFrameNumberFromTitle('frame_1_2k.png')).toBe(1)
      expect(extractFrameNumberFromTitle('4k_frame_3.png')).toBe(3)
      expect(extractFrameNumberFromTitle('4k_5.png')).toBe(5)
      expect(extractFrameNumberFromTitle('hero_1080p_2.png')).toBe(2)
    })

    it('trả về null nếu tên tệp không chứa số hợp lệ hoặc là ngày tháng năm lớn', () => {
      expect(extractFrameNumberFromTitle('idle.png')).toBeNull()
      expect(extractFrameNumberFromTitle('cat_walk.jpg')).toBeNull()
      expect(extractFrameNumberFromTitle('')).toBeNull()
      expect(extractFrameNumberFromTitle('photo_20261103.png')).toBeNull()
    })
  })

  describe('sortAndAssignFrameFiles', () => {
    it('sắp xếp theo đúng số frame title khi chọn nhiều ảnh theo thứ tự ngẫu nhiên trong Windows Explorer', () => {
      const files = [
        { name: '5.png' },
        { name: '1.png' },
        { name: '2.png' },
        { name: '4.png' },
        { name: '3.png' }
      ]

      const { assignments, useTitleNumbers } = sortAndAssignFrameFiles(files)
      expect(useTitleNumbers).toBe(true)
      expect(assignments).toHaveLength(5)

      // 1.png -> Frame 1 (index 0)
      expect(assignments[0].file.name).toBe('1.png')
      expect(assignments[0].targetFrameIndex).toBe(0)

      // 2.png -> Frame 2 (index 1)
      expect(assignments[1].file.name).toBe('2.png')
      expect(assignments[1].targetFrameIndex).toBe(1)

      // 3.png -> Frame 3 (index 2)
      expect(assignments[2].file.name).toBe('3.png')
      expect(assignments[2].targetFrameIndex).toBe(2)

      // 4.png -> Frame 4 (index 3)
      expect(assignments[3].file.name).toBe('4.png')
      expect(assignments[3].targetFrameIndex).toBe(3)

      // 5.png -> Frame 5 (index 4) - đúng theo yêu cầu: "5.png thì là frame 5"
      expect(assignments[4].file.name).toBe('5.png')
      expect(assignments[4].targetFrameIndex).toBe(4)
    })

    it('gán đúng vị trí frame khi nâng cấp frame lẻ cho hoạt ảnh đã có 5 frame (5.png -> frame 5)', () => {
      const files = [{ name: '5.png' }]
      const { assignments, useTitleNumbers } = sortAndAssignFrameFiles(files, 5)
      expect(useTitleNumbers).toBe(true)
      expect(assignments[0].file.name).toBe('5.png')
      expect(assignments[0].targetFrameIndex).toBe(4) // frame 5 là index 4
    })

    it('gán đúng vị trí khi nâng cấp 2 frame chỉ định (2.png -> frame 2, 5.png -> frame 5)', () => {
      const files = [{ name: '5.png' }, { name: '2.png' }]
      const { assignments, useTitleNumbers } = sortAndAssignFrameFiles(files, 5)
      expect(useTitleNumbers).toBe(true)
      expect(assignments[0].file.name).toBe('2.png')
      expect(assignments[0].targetFrameIndex).toBe(1) // frame 2 là index 1
      expect(assignments[1].file.name).toBe('5.png')
      expect(assignments[1].targetFrameIndex).toBe(4) // frame 5 là index 4
    })

    it('fallback lấy theo thứ tự chọn ban đầu khi title ảnh không chứa số hợp lệ', () => {
      const files = [
        { name: 'jump.png' },
        { name: 'fall.png' },
        { name: 'land.png' }
      ]

      const { assignments, useTitleNumbers } = sortAndAssignFrameFiles(files)
      expect(useTitleNumbers).toBe(false)
      expect(assignments).toHaveLength(3)

      expect(assignments[0].file.name).toBe('jump.png')
      expect(assignments[0].targetFrameIndex).toBe(0)

      expect(assignments[1].file.name).toBe('fall.png')
      expect(assignments[1].targetFrameIndex).toBe(1)

      expect(assignments[2].file.name).toBe('land.png')
      expect(assignments[2].targetFrameIndex).toBe(2)
    })

    it('fallback lấy theo thứ tự chọn khi các tệp có title không nhất quán (1 có số, 1 không)', () => {
      const files = [{ name: '1.png' }, { name: 'jump.png' }]
      const { assignments, useTitleNumbers } = sortAndAssignFrameFiles(files)
      expect(useTitleNumbers).toBe(false)
      expect(assignments[0].file.name).toBe('1.png')
      expect(assignments[0].targetFrameIndex).toBe(0)
      expect(assignments[1].file.name).toBe('jump.png')
      expect(assignments[1].targetFrameIndex).toBe(1)
    })

    it('fallback lấy theo thứ tự chọn khi bị trùng lặp số title (ví dụ 1.png và 1.jpg)', () => {
      const files = [{ name: '1.png' }, { name: '1.jpg' }]
      const { assignments, useTitleNumbers } = sortAndAssignFrameFiles(files)
      expect(useTitleNumbers).toBe(false)
      expect(assignments[0].file.name).toBe('1.png')
      expect(assignments[0].targetFrameIndex).toBe(0)
      expect(assignments[1].file.name).toBe('1.jpg')
      expect(assignments[1].targetFrameIndex).toBe(1)
    })
  })

  describe('calculateMultiFrameGrid', () => {
    it('trả về 1x1 cho 1 frame', () => {
      expect(calculateMultiFrameGrid(1, 1024, 1024)).toEqual({ cols: 1, rows: 1 })
    })

    it('trả về 1 hàng ngang nếu không vượt quá giới hạn texture', () => {
      expect(calculateMultiFrameGrid(4, 512, 512)).toEqual({ cols: 4, rows: 1 })
      expect(calculateMultiFrameGrid(4, 2048, 2048)).toEqual({ cols: 4, rows: 1 })
    })

    it('chia lưới hàng x cột cân bằng khi tổng chiều ngang vượt quá ngưỡng texture', () => {
      // 8 frame 2048px = 16384px > 8192px
      const grid = calculateMultiFrameGrid(8, 2048, 2048, 8192)
      expect(grid.cols * 2048).toBeLessThanOrEqual(8192)
      expect(grid.cols * grid.rows).toBeGreaterThanOrEqual(8)
    })
  })
})
