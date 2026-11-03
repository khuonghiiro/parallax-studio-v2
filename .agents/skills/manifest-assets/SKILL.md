---
name: manifest-assets
description: Manage dynamic categories, workshop topics, custom icon links with broken-link fallback, soft-delete trash recovery (assets/_temp_deleted), and modular JSON sub-manifests (assets/manifest.json + assets/manifests/*.json) in Parallax Studio V2.
---

# Dynamic Asset Manifest & Modular Coordinator Skill (`manifest-assets`)

Use this skill whenever adding, renaming, reorganizing, soft-deleting, restoring, or pruning assets and workshop categories/topics in **Parallax Studio V2**.

---

## 1. Modular Manifest Architecture

Instead of a single monolithic file, `assets/manifest.json` acts as the **central v2.0 coordinator** that routes to 5 focused sub-manifests inside `assets/manifests/`:

| Module ID | Sub-Manifest File | Physical Folder in `assets/` | Target UI / Workshop |
| :--- | :--- | :--- | :--- |
| `builtin` | `./assets/manifests/builtin.json` | `characters/`, `animals/`, `nature/`, `plants/`, `architecture/`, `interiors/`, `props/`, `weather/`, `effects/` | Public 2D Asset Library (`AssetPanel`, `BuiltInAssetBar`) |
| `layer_25d` | `./assets/manifests/layer-25d.json` | `layer-assemblies/<category>/` | 2.5D Layer Assembly Workshop (`LayerAssemblyCategoryBar`, `LayerAssemblySidebar`, `CreateLayerAssemblyModal`) |
| `loop_animator` | `./assets/manifests/loop-animator.json` | `loop-animations/<category>/` | Loop Sprite Animator Workshop (`LoopAnimatorDialog`, `LoopAnimationList`, `WorkshopLoopAssetTab`) |
| `model_3d` | `./assets/manifests/model-3d.json` | `models-3d/<category>/` | 3D Model Workshop (`Model3DCategoryBar`, `Model3DList`, `AssemblyAssetSidebar`) |
| `audio` | `./assets/manifests/audio.json` | `audio/<category>/` | Audio Studio & Music Library (`MusicCategoryBar`) |

- **Temporary Trash Folder:** `./assets/_temp_deleted/` (configured via `"tempTrashFolder": "_temp_deleted"` in `./assets/manifest.json`).
- **Custom Icons Folder:** `./assets/icons/` (configured via `"iconsFolder": "icons"` in `./assets/manifest.json`).

---

## 2. Category & Icon Fallback Rules

Each category entry in `./assets/manifests/*.json` supports:

```json
{
  "id": "characters",
  "title": "Nhân vật",
  "shortTitle": "Nhân vật",
  "folder": "characters",
  "icon": "user-male",
  "iconUrl": "icons/default-topic.svg",
  "iconText": "NV",
  "accent": "#ec4899",
  "order": 1,
  "status": "active"
}
```

### Icon Resolution & Broken-Link Fallback (`./src/renderer/src/ui/assets/categoryIcons.tsx`)
1. **`iconUrl` (Highest priority when set):** Resolves relative to `./assets/` (e.g., `icons/default-topic.svg` via `customIcons` map) or a `data:` / `http` URL.
2. **Broken `iconUrl` Warning Fallback:** If `iconUrl` is specified in JSON but the file or `./assets/icons/` folder was accidentally deleted or fails to load, `renderCategoryIcon` automatically renders `IconBrokenIconFallback` (`data-icon-fallback="broken"`) with a warning tooltip so the user immediately knows the icon link is missing.
3. **`icon` (Built-in SVG key):** Renders the matching vector icon (`user-male`, `user-female`, `paw-animal`, `tree-nature`, `flower-lotus`, `home`, `armchair`, `prop-lamp`, `flame`, `lightning`, `weather-cloud`, `sparkles`, `loop-motion`, `car-vehicle`, `cube`, `music`, `voice-mic`, `folder`).
4. **`iconText` (Text Icon Pill):** When `icon` is omitted or set to `text`, renders a compact 1–3 character badge (e.g., `NV`, `FX`, `3D`).

---

## 3. Soft Delete (`_temp_deleted`) vs. Permanent Delete & Prune

1. **Soft Delete (Default when deleting in UI or via `restore_deleted_asset` with `action: "soft_delete"`):**
   - Moves the physical file from `./assets/<relativePath>` to `./assets/_temp_deleted/<relativePath>`.
   - Updates the asset's metadata in `./assets/manifests/builtin.json` and `./assets/manifest.json`:
     ```json
     {
       "name": "Cậu bé nhảy",
       "category": "characters",
       "status": "deleted",
       "tempPath": "_temp_deleted/characters/chibi_boy_jump.png",
       "deletedAt": "2026-11-03T14:00:00.000Z"
     }
     ```
   - The asset is hidden from active grids and placed in the **Kho tạm đã xoá** tab of the Manifest Dialog (`#manifest-assets-btn`).
2. **Restore (`restore_deleted_asset` with `action: "restore"`):**
   - Moves the file from `./assets/_temp_deleted/<relativePath>` back to `./assets/<relativePath>` and sets `"status": "active"`.
3. **Permanent Delete & Batch Prune (`./assets/prune-manifest.bat` or `prune_assets_manifest`):**
   - If you delete physical files directly in Explorer or permanently delete an item, run `./assets/prune-manifest.bat` (or `pnpm assets:prune`, or MCP tool `prune_assets_manifest`).
   - `./scripts/prune-assets-manifest.mjs` scans both `./assets/` and `./assets/_temp_deleted/` and synchronizes `./assets/manifest.json` and `./assets/manifests/*.json`.

---

## 4. MCP & CLI Commands (Dual-Shell PowerShell & CMD)

- **Inspect manifest & soft-deleted trash:**
  - `[PowerShell]` `pnpm pxs call get_assets_manifest '{"module_id":"loop_animator"}'`
  - `[CMD]` `pnpm pxs call get_assets_manifest "{\"module_id\":\"loop_animator\"}"`
  - `[Flags]` `pnpm pxs call get_assets_manifest --module_id loop_animator`
- **Add or update a category/topic dynamically:**
  - `[PowerShell]` `pnpm pxs call update_assets_manifest '{"module_id":"layer_25d","action":"upsert_category","category_id":"dragons","title":"Rồng & Linh thú","folder":"layer-assemblies/dragons","icon":"paw-animal","icon_text":"RG"}'`
  - `[CMD]` `pnpm pxs call update_assets_manifest "{\"module_id\":\"layer_25d\",\"action\":\"upsert_category\",\"category_id\":\"dragons\",\"title\":\"Rồng & Linh thú\",\"folder\":\"layer-assemblies/dragons\",\"icon\":\"paw-animal\",\"icon_text\":\"RG\"}"`
- **Soft-delete, restore, or permanently delete an asset:**
  - `[PowerShell]` `pnpm pxs call restore_deleted_asset '{"relative_path":"characters/chibi_boy_jump.png","action":"restore"}'`
  - `[CMD]` `pnpm pxs call restore_deleted_asset "{\"relative_path\":\"characters/chibi_boy_jump.png\",\"action\":\"restore\"}"`
  - `[Flags]` `pnpm pxs call restore_deleted_asset --relative_path characters/chibi_boy_jump.png --action restore`
- **Prune orphaned entries across all manifest JSON files:**
  - `[PowerShell]` `pnpm pxs call prune_assets_manifest '{}'`
  - `[CMD]` `pnpm pxs call prune_assets_manifest "{}"`
- **Open & inspect the visual Manifest Manager Dialog (`#manifest-assets-btn`, next to `#perf-settings-btn`):**
  - `[PowerShell]` `pnpm pxs call set_ui_dialog '{"dialog":"manifest"}'`
  - `[Regions]` `manifest_chip`, `manifest_dialog`, `manifest_sidebar`, `manifest_categories`, `manifest_assets`, `manifest_trash`, `manifest_json_editor`.
