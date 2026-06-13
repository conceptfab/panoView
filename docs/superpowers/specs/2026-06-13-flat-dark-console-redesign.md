# Flat Dark Console Redesign

Date: 2026-06-13
Project: CONCEPTFAB Pano
Status: Approved direction, ready for implementation planning

## Goal

Redesign CONCEPTFAB Pano from a generic dark admin panel into a flat, modern SaaS console inspired by Vercel and Raycast. The product should feel like a precise work tool for managing panorama projects, public presentation links, imports, backups, and hotspot editing.

The approved visual reference during this design session was the local mockup:

`/.superpowers/brainstorm/41869-1781354251/content/command-center-flat-v3.html`

That mockup is a direction reference, not production code and not the source of truth. The implementation should follow the written visual rules and screen structure in this spec.

## Design Principles

The UI should feel flat, technical, focused, and current.

- Use the existing dark product DNA.
- Prefer dense console layouts over decorative dashboard cards.
- Use small radii, usually 3-4px for controls and rows, up to 8px for larger surfaces when needed.
- Avoid heavy shadows, glow, bokeh, decorative gradients, and glossy surfaces.
- Use thin separators and subtle surface differences instead of nested cards.
- Put command/search at the center of the workflow.
- Make project management feel operational: status, assets, next action, share state, and recent activity should be scannable.
- Keep Polish product text in the real app unless a label is a short technical convention already used consistently.

## Information Architecture

The app will be organized around a console shell:

- `Command Center`: default signed-in screen and main operational overview.
- `Projects`: full project management list/table.
- `Studio`: hotspot editing workspace for a selected project.
- `Share Links`: presentation links and PIN/revocation state.
- `Groups`: project access groups.
- `Users`: user access management.
- `Stats`: logs and usage events.
- `Data`: imports, rebuild, backups, storage operations.

The current top navigation should be replaced by a persistent console shell. The shell will use a compact left sidebar on desktop and a compact bottom navigation or menu trigger on small screens.

## App Shell

Create a reusable `ConsoleShell` for dashboard routes.

Desktop structure:

- Left navigation column, approximately 220-240px wide.
- Brand block at top with `CONCEPTFAB Pano` and version.
- Grouped navigation sections.
- Current workspace summary at bottom.
- Main area with a topbar and page content.

Topbar:

- Breadcrumb/path on the left.
- Page-level actions on the right.
- User avatar/account trigger.

Mobile structure:

- Hide full sidebar.
- Keep a compact topbar.
- Use a compact bottom navigation or menu trigger.
- Preserve command/search as a primary action.

The panorama viewer and hotspot studio must not inherit the full dashboard chrome.

## Command Center

The signed-in landing screen should become a command-first workbench.

Top strip:

- Page title: `Command Center`.
- Short operational description.
- Command input with shortcut affordance, for example `⌘ K`.
- Actions such as `Import ZIP` and `Nowy projekt`.

Main content:

- Primary area: recent project table/list.
- Secondary area: quick actions, attention items, and recent activity.

Project rows should show:

- Thumbnail preview.
- Project name and short description.
- Publication status.
- Panorama count.
- Share/link state.
- Last updated date.
- Suggested next action.
- Overflow menu for less common actions.

Quick actions should include:

- Import project ZIP.
- Create or open presentation link.
- Open hotspot studio.
- Download backup.
- Rebuild metadata.

Attention items should surface actionable states, for example:

- Draft project with complete panoramas.
- Public link active with PIN.
- Missing thumbnail.
- Failed or pending import, if available.

## Projects Screen

The full `Projects` screen should use the same flat table/list language as the Command Center, with richer controls.

Required controls:

- Search by project name and description.
- Filter by publication status.
- Filter by group when groups exist.
- Sort by updated date, name, panorama count, or status.
- Toggle between compact table and visual preview list only if both layouts are genuinely useful.

Avoid making project cards the default admin representation. Cards may remain useful for gallery/public browsing, but administration should prioritize scanning and operations.

## Gallery Screen

Gallery is not the same as Projects.

Gallery should remain optimized for opening and browsing panoramas:

- More visual than the admin Projects screen.
- Less administrative chrome.
- Clear project thumbnail, name, panorama count, and updated date.
- Admin-only management actions should not dominate the gallery.

The current grid-size preference can remain, but its controls should be integrated into a proper page toolbar rather than floating above the grid.

## Project Detail

The current long vertical project edit page should be split into a tabbed or segmented workflow.

Proposed tabs:

- `Overview`: name, description, status, groups, optimization setting.
- `Panoramas`: upload, panorama list, thumbnails, replacement flow.
- `Share`: public presentation link, active state, PIN, copy action.
- `Files`: download ZIP, storage size, backup-related actions.
- `Settings`: destructive or less common project-level settings.

Header:

- Back breadcrumb.
- Project name.
- Publication status.
- Primary action based on state.
- Secondary actions in an overflow menu.

Do not stack all project operations as full-width cards on one long page.

## Studio Mode

Hotspot editing should become a distinct full-screen workspace.

Studio shell:

- No normal dashboard sidebar/topbar.
- Full canvas area for the panorama.
- Compact top bar with back action, project name, save state, and critical viewer actions.
- Right inspector panel for panorama selection, hotspots, and selected hotspot properties.
- Optional command palette for actions like add hotspot, switch panorama, save, screenshot, generate thumbnail.

Interaction principles:

- Adding mode must be visually clear.
- Selected hotspot state must be obvious.
- Save state should be visible: unchanged, unsaved changes, saving, saved, error.
- On mobile, inspector opens as a drawer and the canvas remains primary.

The current `HotspotEditor` file is large and should be split during implementation into focused components.

## Viewer

The immersive viewer should keep full-screen presentation behavior.

Improvements:

- Keep controls flat and minimal.
- Add a loading timeout/fallback state if panorama loading stalls.
- Add clearer error state when scripts or assets fail to load.
- Keep admin-only controls visually separated from viewer controls.
- Do not show dashboard navigation inside viewer.

## Visual System

Core visual rules:

- Background: near black.
- Surfaces: small steps above background.
- Borders: thin separators.
- Radius: 3-4px for rows and controls, up to 8px for major containers.
- Shadows: avoid by default.
- Gradients: avoid; only subtle thumbnail/image treatment may use natural gradients from imagery.
- Accent: white for primary actions, muted cyan/green/amber only for status and attention.
- Typography: compact, readable, no oversized hero typography inside operational screens.
- Icons: use lucide where available, but keep icon treatment restrained.

## Components To Introduce

New shared layout components:

- `ConsoleShell`
- `ConsoleSidebar`
- `ConsoleTopbar`
- `PagePath`
- `CommandBar`
- `ConsoleSection`
- `ProjectOperationsTable`
- `QuickActionList`
- `AttentionList`
- `ActivityList`
- `ProjectHeader`
- `ProjectTabs`
- `StudioShell`
- `StudioTopbar`
- `StudioInspector`

Existing shadcn/ui primitives can remain, but card usage should be reduced on operational screens.

## Data And Behavior

The redesign should not require backend schema changes.

Existing server data is enough for the first pass:

- Projects and configs.
- Groups.
- Users.
- Stats.
- Share link state.
- Project size.

New client behavior can be added incrementally:

- Search/filter/sort within loaded project lists.
- Local command palette for navigation/actions.
- Better loading and error states for viewer/studio.

## Accessibility

Requirements:

- Preserve skip link behavior.
- Command bar and command palette must be keyboard accessible.
- Navigation active states must not depend on color alone.
- Table/list rows need accessible action labels.
- Studio controls need tooltips or aria labels.
- Focus states must remain visible in dark UI.

## Implementation Scope

Recommended implementation phases:

1. Build `ConsoleShell` and replace the dashboard layout/navigation.
2. Build `Command Center` and flat project list/table.
3. Refactor `Projects` and `Gallery` into distinct admin and browsing experiences.
4. Split `Project Detail` into a tabbed workflow.
5. Redesign Studio Mode and split `HotspotEditor` into focused components.
6. Improve Viewer loading/error states.

The first implementation plan should cover phases 1 and 2 only. Later phases should be planned separately to reduce risk.

## Non-Goals

- No public marketing landing page.
- No light theme redesign.
- No decorative hero imagery in admin screens.
- No large brand rework.
- No database schema changes for the first pass.
- No full rewrite of the viewer or Panolens integration.

## Success Criteria

The redesign is successful when:

- The app no longer feels like a generic admin template.
- The first signed-in screen feels like a modern work console.
- Projects can be scanned faster than in the current card grid.
- Common actions are reachable from the command/search workflow.
- Project detail no longer feels like one long stacked settings page.
- Studio feels like a separate editor workspace.
- The dark theme remains recognizably CONCEPTFAB Pano, but flatter and more precise.
