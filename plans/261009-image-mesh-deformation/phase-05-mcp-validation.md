# Phase 5 — MCP, regression và bàn giao

Status: completed · Priority: P1 · Depends on: 1–4 · Estimate: 8–14h.

Mỗi phase trước phải có MCP tối thiểu cùng implementation. Phase này kiểm tra UI/MCP đạt cùng năng lực, không chờ tới cuối mới thiết kế API.

## Công cụ MCP dự kiến

- [x] Mở rộng `get_assembly_template`: recipeVersion, image contract, source references/mask guide, root anchors, geometry generator parameters, modifier capabilities, allowed ranges.
- [x] `validate_assembly_images`: kết quả per-slot, dimensions/alpha/bounds/anchor coverage và các cảnh báo; không tự sửa ảnh nếu chưa có tham số hành động.
- [x] `set_assembly_template_params`: cập nhật mật độ cỏ, seed, hình học hoa/calla và variant; giữ image bindings qua slot ID, không làm mất sửa tay ngoài phạm vi được reset rõ.
- [x] Nhóm modifier: get/upsert/remove/reorder với ID ổn định, schema discriminated union; có batch transaction. Tên chính xác chốt sau rà catalog để tránh tool trùng.
- [x] Nhóm soft edit: stroke UV + radius/falloff/strength, pin/mask, curve control points, lattice control points. AI dùng cùng evaluator và command reducer với UI; không code path giả.
- [x] Headless và realtime có cùng kết quả; realtime vào `session.setModel`/useAssemblyHistory; insert vào project qua `useEditor.update`. Preview-only không persist; save/discard rõ.
- [x] Zod ranges, max modifier/stroke/sample/mesh/image sizes, finite numbers, path resolver hiện có và không raw eval từ payload. Reject trước mutate; lỗi không làm ghi nửa model. Chặn ảnh decode quá lớn theo pixel budget.
- [x] Catalogue song ngữ, CLI tự sinh, guide toolCount và `pnpm mcp:schemas`; cập nhật README, AGENTS và các tài liệu bridge nếu thay quy chuẩn/quy trình.

## Ma trận regression bắt buộc

| Phạm vi | Ca kiểm tra |
|---|---|
| Prompt | Tỷ lệ + anchor + padding + alpha + mặt sau không mâu thuẫn; mask reference khớp generator |
| Geometry | Từng modifier, phối hợp/thứ tự, root pins, curve/lattice, cực trị, alpha holes |
| Template | Hoa, trumpet, calla, grass; hai bộ texture và ba cấu hình/mẫu; 360° contact sheet |
| Data | Legacy, migration, duplicate/compose, save/reopen, project import/export |
| UI | Một gesture/một undo; Escape; pointercancel; bật/tắt stack; Dark/Light |
| MCP | UI cùng payload cho kết quả cùng geometry; invalid input atomic; replay deterministic |
| Render | Xưởng = scene = exported frames; motion theo thời gian; đúng alpha/backface/normals |
| Performance | Frame/update p95, peak memory, GPU dispose, nhiều model khác seed |

## Lệnh và bàn giao

Chạy test mục tiêu sau mỗi phase; cuối cùng `pnpm test --maxWorkers=1`, `pnpm typecheck`, `pnpm build`, `pnpm mcp:schemas`, `pnpm mcp:schemas --check`, `git diff --check`. Không bỏ qua test lỗi baseline; phân loại và xử lý công khai.

Review bằng `pnpm pxs status`, `get_assembly_state`, `get_assembly_screenshot`, `pnpm pxs review --view app --out D:/_tmp/...`; controller kết thúc kết nối khi xong. Save trạng thái thử bằng ID riêng, không xóa tài nguyên người dùng. Nếu xóa asset thử trong assets, prune manifest theo AGENTS.

Bàn giao: bộ prompt/mask mẫu, hướng dẫn cọ/uốn/ghim, ví dụ JSON MCP, contact sheets trước/sau, video orbit/export ngắn, báo cáo hiệu năng thật và giới hạn được biết. Commit tiếng Việt có dấu, push nhánh đã xác nhận; stage đúng file của phase, không gộp thay đổi đang có của người dùng.

Chỉ đánh dấu hoàn thành sau khi dữ liệu xuất video giữ đúng hình dạng và review trực quan đạt. Không lấy số test pass thay cho kiểm tra hình ảnh.
