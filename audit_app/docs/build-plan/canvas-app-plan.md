# Canvas App Plan

## Mode
CREATE

## Requirements

Mobile (phone, portrait) Canvas App for a factory "Production Zone Audit" — the AUDITOR
role only. A person walks the factory floor with a phone, picks a production zone, answers
a 5S/Safety checklist question by question, photographs anything that fails, assigns a
fixer, then submits.

Visual contract: `D:\Training\2026-08_1dataplatform_hieu\audit_app\docs\05-auditor-ui-spec.md`
Business context: `D:\Training\2026-08_1dataplatform_hieu\audit_app\docs\02-powerfx-auditor.md`

1. **Screen 1 "Site Inspection"** — zone image placeholder, Site Name (ModernDropdown over
   `colZones`), Address (read-only, auto-filled), Description (read-only multiline,
   auto-filled), Template dropdown (over `colTemplates`). Footer: Cancel (secondary) and
   Survey (primary, disabled until both dropdowns chosen). Survey builds `colChecklist`
   from `colItems` filtered by the chosen template and navigates.
2. **Screen 2 "Checklist"** — gallery of questions; per row: wrapping question text, a
   horizontal `ModernRadio` with Yes / No / N/A, a camera icon and a second icon on the
   right, and a thumbnail with a round remove button only when a photo exists. Answers
   persist into `colChecklist` via `OnChange` + `Patch`. Choosing "No" opens an in-screen
   fail-detail overlay (description, severity dropdown Low/Medium/High/Critical defaulting
   to Critical when `IsCritical`, assignee `ModernCombobox` over `colUsers`). The camera
   icon opens a full-screen camera overlay captioned "Click inside the frame to capture"
   with a Close button. Progress indicator answered/total. Sticky footer: Cancel, back, and
   Submit (disabled until every question is answered, with hint "Còn N câu chưa trả lời").
3. **Screen 3 "Review"** — compliance score big, pass/fail/NA counts, a gallery of recorded
   failures with a severity `Badge`, assignee and photo thumbnail, a general-notes input,
   and the real Submit button (guarded by `gblSubmitting`, `Notify` on success, writes
   `colSubmitted`, clears `colChecklist` only after success).
4. **Screen 4 "Done"** — confirmation with the score and failure count, plus a button to
   start a new audit that returns to Screen1.

Compliance score rule: N/A answers are EXCLUDED from the denominator.
`Score = passed / (passed + failed) * 100`, and 100 when nothing is applicable.

UI copy language: Vietnamese, except the header wordmark "Site Inspection" and the
Yes / No / N/A option labels, which stay in English exactly as the mock-up shows.

## Requirement Coverage

| Requirement | Planned affordance | Fidelity |
|-------------|--------------------|----------|
| Zone image placeholder on Screen 1 | `SiteZoneImageBox` — 150px grey `GroupContainer` containing `SiteZonePlaceholder` ModernText "Chưa có sơ đồ khu vực" | Approximation: `colZones` carries no image field and no image source is connected, so the placeholder state specified in UI spec §3 row 1 is the only state that can render. No `Image` control is planned on Screen 1 rather than binding one to fake artwork. |
| Site Name = ModernDropdown over colZones | `SiteDdZone`, `Items: =Sort(colZones, Title, SortOrder.Ascending)`, `ItemDisplayText: =ThisItem.Title` | Exact |
| Address read-only, auto-filled from selected zone | `SiteTxtAddress` ModernText inside field-styled `SiteAddressBox`; `Text: =Coalesce(SiteDdZone.Selected.Address, "—")` | Approximation: rendered as non-editable text on a field surface rather than a `ModernTextInput` in `DisplayMode.View`. Reason — a `ModernTextInput.Default` only re-applies on `Reset()`, so it can show a stale address after the zone dropdown changes; ModernText re-evaluates immediately. Visually identical, and read-only is enforced by construction rather than by a mode. |
| Description read-only multiline, auto-filled | `SiteTxtDesc` ModernText (`Wrap: =true`) inside 110px `SiteDescBox` | Approximation: same reason as Address. |
| Template dropdown over colTemplates | `SiteDdTemplate`, `Items: =colTemplates`, `ItemDisplayText: =ThisItem.Title` | Exact |
| Footer Cancel (secondary) | `SiteBtnCancel`, text **"Huỷ"**, `Appearance: =ButtonAppearance.Secondary` | Approximation: label translated to Vietnamese per the stated copy rule (only the wordmark and Yes/No/N/A stay English). |
| Footer "Survey >" (primary, disabled until both dropdowns chosen) | `SiteBtnSurvey`, text **"Khảo sát ›"**, `Appearance: =ButtonAppearance.Primary`, `DisplayMode` derived from both `.Selected` values | Approximation on the label only (Vietnamese); the disabled rule is exact and derived from current selection, not from a flag. |
| Survey builds colChecklist and navigates | `SiteBtnSurvey.OnSelect` — `ClearCollect(colChecklist, ForAll(Sort(Filter(colItems, TemplateId = …), OrderNumber, …) As it, {…}))` then `Navigate(scrChecklist)` | Exact |
| Gallery of questions, question text wraps | `ChkGallery` (Variant Vertical) -> `ChkRowShell` AutoLayout -> `ChkLblQuestion` with `Wrap: =true` | Exact |
| Horizontal ModernRadio Yes / No / N/A | `ChkRadioAnswer`, `Items: =["Yes", "No", "N/A"]`, `Layout: =Layout.Horizontal`, 48px tall | Exact |
| Answer persists into colChecklist (rows keep the answer when scrolled) | `ChkRadioAnswer.OnChange` patches `colChecklist` by `ItemId`; `ChkRadioAnswer.Default` is bound to `ThisItem.Result` so a recycled row re-renders its stored answer | Exact |
| Camera icon on the right | `ChkIconCamera` — classic `Icon`, `Icon: =Icon.Camera`, 44x44 | Approximation on the control family: no `ModernIcon` type could be confirmed in this session, so the classic `Icon` control is used. The affordance, glyph and behaviour are as specified. |
| Paperclip icon on the right | `ChkIconDetail` — classic `Icon`, `Icon: =Icon.Edit`, opens the fail-detail overlay for that question; enabled only when `ThisItem.Result = "Fail"` | **Approximation**: the mock-up's paperclip opens a device photo-library picker (`Add picture`). No device-library picker control could be confirmed against the control catalog in this session, and shipping a second icon that silently re-opens the camera would be a false affordance. The slot is instead given the genuinely distinct action the design needs — re-opening the fail-detail panel after it has been closed. Its `AccessibleLabel` is "Chi tiết lỗi"; no copy anywhere promises browsing device photos. |
| Thumbnail with round remove button, only when a photo exists | `ChkImgThumb` (90x90) and `ChkRemoveCircle` (32px circle, `Radius* = 16`) containing `ChkIconRemovePhoto` (`Icon.Cancel`); both `Visible: =!IsBlank(ThisItem.FailPhoto)`. When no photo, `ChkLblNoPhoto` shows "Chưa có ảnh" in the same band | Exact affordance; the band itself is always reserved because a `Vertical` Gallery has one fixed `TemplateSize` — the empty state is labelled rather than left blank. |
| Choosing "No" opens an in-screen fail-detail overlay | `ChkFailOverlay` (scrim) + `ChkFailPanel`, `Visible: =gblShowFailPanel`; opened from `ChkRadioAnswer.OnChange` when the new answer is "Fail". Checklist state underneath is untouched. | Exact |
| Fail detail: description text input | `ChkFailTxtDesc` ModernTextInput, `Mode: =TextMode.MultiLine` | Exact |
| Fail detail: severity dropdown Low/Medium/High/Critical, default Critical when IsCritical | `ChkFailDdSeverity`, `Items: =["Low", "Medium", "High", "Critical"]`, seeded from `gblFailSeverity` which the open sequence computes as `Coalesce(row.FailSeverity, If(row.IsCritical, "Critical", "Medium"))` | Exact |
| Fail detail: assignee ModernCombobox over colUsers | `ChkFailCmbAssignee`, `Items: =colUsers`, `ItemDisplayText: =ThisItem.Name` | Exact |
| Camera overlay captioned "Click inside the frame to capture" with a Close button | `ChkCamOverlay` -> `ChkCamPanel` -> `ChkCamCaptionBar`/`ChkCamCaptionText` (English, verbatim) + `ChkCamera` (4:3) + `ChkCamBtnClose` ("Đóng") | Exact |
| Tapping the Camera control captures Camera.Photo into that row | `ChkCamera.OnSelect` patches `colChecklist` row `gblCurrentItemId` with `{FailPhoto: ChkCamera.Photo}`, closes the overlay and notifies | Exact |
| Progress indicator answered/total | `ChkLblProgress` (`AnsweredCount & " / " & TotalCount & " câu hỏi"`) over a two-container bar `ChkProgTrack`/`ChkProgFill` | Approximation on the control: a container-based bar rather than the `Progress` control, matching the `recProgressFill.Width` pattern already agreed in `02-powerfx-auditor.md` §3. The numeric answered/total readout is exact. |
| Sticky footer: Cancel, back "<", Submit | `ChkFooter` pinned as a screen-level sibling at `Y: =Parent.Height - 92`; `ChkBtnCancel` ("Huỷ"), `ChkBtnBack` ("‹"), `ChkBtnSubmit` ("Gửi") | Exact behaviour; Cancel/Submit labels translated per the copy rule. |
| Submit disabled until every question is answered, with hint "Còn N câu chưa trả lời" | `ChkBtnSubmit.DisplayMode: =If(IsAuditComplete, DisplayMode.Edit, DisplayMode.Disabled)`; `ChkLblHint.Text: =If(!IsAuditComplete, "Còn " & RemainingCount & " câu chưa trả lời", "")` — both derived from current answers, no flags | Exact (hint string verbatim) |
| Review: compliance score big | `RevLblScore`, Size 44 Bold, `Text: =Text(ComplianceScore, "[$-en-US]0.0") & "%"` | Exact |
| Review: pass / fail / NA counts | `RevKpiPass` / `RevKpiFail` / `RevKpiNa` tiles bound to named formulas `PassCount`, `FailCount`, `NACount` | Exact |
| Review: gallery of failures with severity Badge, assignee, photo thumbnail | `RevGalFailures` over `FailList`; `RevBadgeSeverity` (`Content: =ThisItem.FailSeverity`), `RevLblAssignee`, `RevImgFailPhoto` | Exact |
| Review: general-notes input | `RevTxtNotes` ModernTextInput, `Mode: =TextMode.MultiLine` | Exact |
| Review: real Submit guarded against double-tap, Notify on success, writes colSubmitted, clears colChecklist only after success | `RevBtnSubmit.OnSelect` — `If(gblSubmitting, Notify(warn), Set(gblSubmitting, true); With({…snapshot…}, ClearCollect(colSubmitted, {…}); Notify(success)); Clear(colChecklist); Set(gblSubmitting, false); Navigate(scrDone))`. `Clear(colChecklist)` runs strictly after the write; the score/count snapshot is taken once inside `With` and reused for both the record and the notification | Exact |
| Done: confirmation with score and failure count | `DoneLblScoreValue` / `DoneLblFailValue` read `First(colSubmitted).RunScore` and `.RunFailCount` (not the cleared `colChecklist`) | Exact |
| Done: button to start a new audit returning to Screen1 | `DoneBtnNew` ("Bắt đầu lượt mới") clears working state and `Navigate(Screen1, ScreenTransition.Fade)` | Exact |
| N/A excluded from the denominator; 100 when nothing applicable | Named formula `ComplianceScore` in `App.Formulas` | Exact |
| Header band identical on all four screens | Documented once as the **App Header pattern** in `canvas-app-shared.md` with pinned values (height 64, `Fill: =RGBA(0, 0, 0, 1)`, wordmark "Site Inspection", colours, sizes); each screen instantiates it under its own prefix | Exact |
| Header avatar showing user initials | `<P>HeaderAvatar` — 44px circle `GroupContainer` (`Radius* = 22`) containing `<P>HeaderInitials` ModernText bound to named formula `AppUserInitials` | Approximation: built from a circular container plus text rather than an `Avatar` control, whose property and enum names could not be confirmed in this session. The header appears on all four screens, so an unverifiable control there would break the whole app. Diameter is 44px rather than the spec's 36px to keep the touch target and the header's left/right symmetry. |

## Working Directory

`D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app`

## Discovery Summary

- **Controls used:** `GroupContainer` (AutoLayout), `Gallery` (Vertical), `ModernText`,
  `ModernButton`, `ModernTextInput`, `ModernDropdown`, `ModernCombobox`, `ModernRadio`,
  `Badge`, `Image`, `Camera`, `Icon` (classic).
- **Data sources:** none connected. All data is mock collections seeded in `App.OnStart`
  (`colZones`, `colTemplates`, `colItems`, `colUsers`) plus two working collections
  (`colChecklist`, `colSubmitted`) whose schemas are seeded then cleared in `App.OnStart`.
- **Connectors:** none. `Office365Users`, `SaveAuditPhoto` and `NotifyNewFindings` from
  `02-powerfx-auditor.md` are deliberately **not** used — they are not connected in this
  app. `colUsers` stands in for `Office365Users`, and the captured photo is held in the
  `colChecklist.FailPhoto` column instead of being uploaded.
- ⚠️ **Discovery tooling was unavailable in this planning session.** `list_controls`,
  `describe_control`, `list_apis`, `list_data_sources`, `get_data_source_schema` and
  `compile_canvas` were not reachable. Every control definition recorded in the screen
  briefs is derived from `references/ControlGuide.md`, `references/LayoutGuide.md` and the
  approved specs, not from `describe_control`. The orchestrator must run `compile_canvas`
  after the builders; see the handoff for the specific properties that carry residual risk.

## Dispatch

| Action | Screen | Target File | YAML Key | Name Prefix | Screen Brief |
|--------|--------|-------------|----------|-------------|--------------|
| Create | Site Inspection (scrSiteSelect) | D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\Screen1.pa.yaml | Screen1 | Site | D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\Screen1.screen-plan.md |
| Create | Checklist | D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\scrChecklist.pa.yaml | scrChecklist | Chk | D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\scrChecklist.screen-plan.md |
| Create | Review | D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\scrReview.pa.yaml | scrReview | Rev | D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\scrReview.screen-plan.md |
| Create | Done | D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\scrDone.pa.yaml | scrDone | Done | D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\scrDone.screen-plan.md |
