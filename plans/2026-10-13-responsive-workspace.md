# Responsive workspace

Register: Product. Scene: video editors on laptops, desktop displays and narrow windows.
Direction: preserve the existing docked editing workspace and make its density adaptive.
Color: restrained; existing dark/light surface, text and blue accent tokens.
Type: Inter UI and JetBrains Mono numeric readouts; bounded fluid size steps.
Signature: the composition canvas and timeline remain the focus.
Dials: variance 2/10, motion 1/10, density 7/10.

## Scope and acceptance

- Flexible desktop sidebars; compact panel navigation below 1200 CSS pixels.
- Bounded timeline height on short screens; keyboard and pointer resizing.
- Readable UI type scale, controls and overlays; retain scene text sizes and export output.
- Keep all workspace tools reachable and support dark/light themes.
- Fit dialogs to available width/height and reflow multi-column editors.
- Validate TypeScript, sizing regressions, build and live Electron screenshots.
- Do not restart or stop the user's running Electron session.

## Progress

- [x] Audit source, live app and local ak rules.
- [x] Implement responsive shell, typography and dialog layouts.
- [x] Verify live app, fix layout issues, document supported sizes.

## Kích thước màn hình hỗ trợ (Supported screen sizes)

1. **Màn hình lớn / Desktop chuẩn (>= 1200px):**
   - 3 cột dock đầy đủ: Thư viện tài nguyên (trái), Khung hình 3D/2.5D (giữa), Bảng thuộc tính Inspector (phải).
   - Thanh công cụ toolbar mở rộng với tên dự án, thông số resolution, MCP chip và đầy đủ nút bấm.

2. **Laptop nhỏ & Màn hình hẹp (< 1200px, 768px, 640px đến 444px):**
   - Tự động kích hoạt thanh điều hướng tab nhỏ gọn (Tài nguyên & Cảnh, Khung hình, Thuộc tính) phía dưới toolbar.
   - Giữ trọn vẹn không gian hiển thị cho khung hình và panel đang chọn, triệt tiêu co ép nội dung.
   - Thanh toolbar tự động thu gọn nhãn text, giữ lại icon rõ nghĩa và co cụm các nút thao tác (Lưu, Xuất MP4) trên cùng một hàng mượt mà, không bị nhảy dòng hay đè lên nhau.
   - Thước đo timeline tự động ẩn thanh trượt zoom dài (giữ nguyên các nút phóng to, thu nhỏ, Fit 1.0x và cuộn chuột), thu gọn toolbar timeline thành các hàng cân đối.

3. **Màn hình chiều cao thấp (< 540px hoặc tỷ lệ phóng to lớn 250%):**
   - Bảng điều hướng và toolbar tự thu nhỏ mật độ (`padding` và `height`), tối ưu chiều cao khả dụng cho canvas và timeline.
   - Splitter timeline cho phép kéo chỉnh chiều cao linh hoạt, hỗ trợ chuột và phím mũi tên.

4. **Hộp thoại & Cửa sổ nổi (Dialogs & Modals):**
   - Nâng `z-index` lên 10000, bảo đảm luôn hiển thị nổi trên thanh công cụ và dock làm việc.
   - Tự co giãn theo khung nhìn (`max-width: calc(100vw - 24px)`, `max-height: calc(100dvh - 24px)`), cuộn nội dung mượt mà với thanh cuộn chuẩn 60fps trên cả Dark Mode và Light Mode.
