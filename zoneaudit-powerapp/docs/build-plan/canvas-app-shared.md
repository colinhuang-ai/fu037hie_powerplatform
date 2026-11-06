## ⚠️ VERIFIED CONTROL CONTRACT — AUTHORITATIVE, OVERRIDES EVERYTHING BELOW

Every item in this section was confirmed against THIS app with `describe_control` plus a
throwaway screen that reached `✓ Validation PASSED` on `compile_canvas`. The rest of this
document was written without tool access and contains known errors. **Where this section
disagrees with anything below it, this section wins. Do not "correct" these back.**

### 1. Icons — `Control: Classic/Icon`, never `Icon`

The bare `Icon` type exists but has **no `Color`, no `OnSelect`, no `AccessibleLabel`** and
fails with `Unknown property`. Use `Classic/Icon`.

Verified properties: `Icon`, `Color`, `Fill`, `OnSelect`, `AccessibleLabel`, `Tooltip`,
`Width`, `Height`, `Padding*`, `Rotation`, `Visible`, `DisplayMode`, `BorderThickness`,
`HoverColor`, `PressedColor`, `DisabledColor`, `TabIndex`.

Enum name is `Icon`. Members available here include: `Icon.Home`, `Icon.Camera`,
`Icon.PaperClip`, `Icon.Edit`, `Icon.Cancel`, `Icon.Check`, `Icon.ChevronLeft`,
`Icon.ChevronRight`, `Icon.Trash`, `Icon.Warning`, `Icon.Add`, `Icon.Reload`.

### 2. `ModernTextInput` multiline — `Type`, not `Mode`

There is **no `Mode` property and no `TextMode` enum** on this control.

```yaml
Type: =TextInputType.Multiline      # enum name: TextInputType
Appearance: =Appearance.Outline     # enum name: Appearance
```

`TextInputType` members: `Multiline`, `Password`, `Search`, `SingleLine`.
`Appearance` members: `FilledDarker`, `FilledLighter`, `Outline`.
Read the typed value with `.Text` (there is no `.Value`). Placeholder is `Placeholder`.

### 3. `ModernDropdown` — no `DefaultSelectedItems`

It has **`Default: Record`**. Two rules, both compile-fatal if missed:

- When `Items` is a single-column table like `["Low", "Medium", "High", "Critical"]`, you
  MUST set `ItemDisplayText: =ThisItem.Value`. The control's built-in default is
  `ThisItem.Value1`, which does not exist and fails with
  `Name isn't valid. 'Value1' isn't recognized.`
- `Default` takes a record, not a table. A literal must be YAML-quoted:
  `Default: '={Value: "Critical"}'`. A dynamic one uses `LookUp`, never `Filter`:

```yaml
Items: |-
  =["Low", "Medium", "High", "Critical"]
ItemDisplayText: =ThisItem.Value
Default: =LookUp(["Low", "Medium", "High", "Critical"], Value = gblFailSeverity)
```

Read the selection with `.Selected.Value`.

### 4. `ModernRadio`

- `Layout: =OptionLayout.Horizontal` — enum name is `OptionLayout`.
- `Default` must be a **record compatible with `Items`**, never a bare text value.
  A text value fails with `Invalid formula. Expected a value compatible with 'Items'.`
  For the Yes/No/N/A group inside the checklist gallery, use exactly:

```yaml
Default: |-
  =LookUp(
      ["Yes", "No", "N/A"],
      Value = Switch(ThisItem.Result, "Pass", "Yes", "Fail", "No", "NA", "N/A", "")
  )
```

- Inside `OnChange`, read the chosen option with `Self.Selected.Value`.
- Other verified properties: `Items`, `ItemDisplayText`, `RadioSize`, `Size`, `Color`,
  `RadioSelectionFill`, `RadioBorderColor`, `RadioBackgroundFill`, `FontWeight`,
  `AccessibleLabel`, `Height`, `Width`, `Padding*`, `Radius*`, `DisplayMode`.
- `RadioSize` is the circle diameter (default 14); `Size` is the label font size.

### 5. `colChecklist.FailPhoto` is a TEXT column seeded with `""`

`SampleImage` does **not** exist in this app. Any use of it fails the whole App file with
`Name isn't valid. 'SampleImage' isn't recognized.` and takes every screen down with it.

- Clear a photo with `{FailPhoto: ""}`.
- Store a capture with `{FailPhoto: Self.Photo}` inside the Camera control's `OnSelect`.
  This is verified to compile — `Camera.Photo` coerces into the text column.
- Display with `Image: =ThisItem.FailPhoto` on an `Image` control.
- Test for a photo with `!IsBlank(ThisItem.FailPhoto)`.

### 6. `Camera` (Classic family)

Verified: `OnSelect`, `OnStream`, `StreamRate`, `Camera`, `Width`, `Height`,
`AccessibleLabel`, `Tooltip`, `BorderColor`, `BorderStyle`, `BorderThickness`,
`DisplayMode`, `Visible`. Output: `Self.Photo`, `Self.Stream`.

It has **no `Fill` and no radius properties** — put it inside a `GroupContainer` if you
need a rounded or filled frame. Its AutoLayout minimums default to
`LayoutMinWidth: 400` / `LayoutMinHeight: 300`; set both to `=0` and give explicit
`Width`/`Height` with `FillPortions: =0`, or it forces the phone layout wider than the
screen.

Capture happens on tap of the camera surface itself — that is what the mock-up caption
"Click inside the frame to capture" describes.

### 7. `Badge` (FluentV9)

Text is `Content`, colour is `FontColor`, size is `FontSize` — **not** `Text`/`Color`/`Size`.
It has **no `Fill`**.

```yaml
Content: =ThisItem.FailSeverity       # never leave unset: an empty Badge renders "AB"
Appearance: ='BadgeCanvas.Appearance'.Filled
Shape: ='BadgeCanvas.Shape'.Rounded
ThemeColor: ='BadgeCanvas.ThemeColor'.Severe
```

`BadgeCanvas.ThemeColor` members: `Brand`, `Danger`, `Important`, `Informative`, `Severe`,
`Subtle`, `Success`, `Warning`.
`BadgeCanvas.Appearance`: `Filled`, `Ghost`, `Outline`, `Tint`.
`BadgeCanvas.Shape`: `Circular`, `Rounded`, `Square`.

### 8. `ModernCombobox`

It **does** have `DefaultSelectedItems: Table` (unlike `ModernDropdown`). Like the
dropdown, its `ItemDisplayText` default is `ThisItem.Value1`, so set it explicitly.

```yaml
Items: =colUsers
ItemDisplayText: =ThisItem.Name
SelectMultiple: =false
DefaultSelectedItems: =Filter(colUsers, Name = gblFailAssigneeName)
InputTextPlaceholder: ="Tìm người khắc phục"
```

Read with `.Selected.Name` / `.Selected.Email`.

### 9. `Progress`

Verified with `Value` and `Max`. Styled through `BasePaletteColor` only — it has **no
`Fill`, no `Color`, no `Font*`**. If you need a two-tone bar in brand colours, build it
from two `GroupContainer`s instead.

### 10. AutoLayout sizing — applies to every control on every screen

Any control that sets a fixed `Width` or `Height` inside an AutoLayout parent must also set:

```yaml
FillPortions: =0
LayoutMinWidth: =0
LayoutMinHeight: =0
```

The modern React controls default `LayoutMinWidth` to 360–560 and `Camera` to 400. Those
minimums silently push containers wider than a 390px phone screen, and no diagnostic is
raised. Set all three on every sized control.

### 11. `GroupContainer` has NO `AccessibleLabel`

Confirmed by a failed compile on three screens at once:
`Unknown property 'AccessibleLabel' for control type 'GroupContainer' and variant 'AutoLayout'.`

A `GroupContainer` is a layout box, not a content control. Put the `AccessibleLabel` on the
`ModernText`, `Classic/Icon`, `Image` or input control inside it. The same applies to every
`GroupContainer` variant — AutoLayout, ManualLayout and GridLayout.


---

# Canvas App Shared Plan

Target device: **phone, portrait only.** Factory floor auditors, one hand, gloves,
variable lighting. Design at 390x844; everything must still work at 320 wide.

## Aesthetic Direction

Industrial utilitarian. Solid near-black header band, white content surface, light-grey
canvas between cards, squared-off corners (4-6px), strong semantic colour, chunky
glove-friendly touch targets.

| Token | Value | Use |
|---|---|---|
| Header ink | `RGBA(0, 0, 0, 1)` | The 64px header band on every screen |
| Header text | `RGBA(255, 255, 255, 1)` | Wordmark and header icon glyph |
| Avatar amber | `RGBA(240, 214, 138, 1)` | Header avatar circle fill |
| Surface | `RGBA(255, 255, 255, 1)` | Screen root, cards, gallery rows |
| Canvas bg | `RGBA(244, 245, 247, 1)` | Gallery `Fill` behind rows, KPI tiles, score card |
| Field fill | `RGBA(242, 242, 242, 1)` | Read-only field surfaces |
| Border | `RGBA(214, 214, 214, 1)` | Field borders, hairline rules, thumbnail border |
| Text main | `RGBA(32, 31, 30, 1)` | Body and question text |
| Text muted | `RGBA(120, 120, 125, 1)` | 12px field labels, captions, secondary rows |
| Primary button | `RGBA(60, 74, 82, 1)` | `BasePaletteColor` of enabled primary buttons |
| Disabled button | `RGBA(200, 203, 206, 1)` | `BasePaletteColor` of disabled primary buttons |
| Pass | `RGBA(14, 116, 60, 1)` | Pass KPI, high score, Done check circle |
| Fail | `RGBA(184, 37, 30, 1)` | Fail KPI, hint line, remove-photo circle |
| N/A | `RGBA(134, 137, 143, 1)` | N/A KPI |
| Critical | `RGBA(140, 25, 32, 1)` | Severity badge font colour |
| High | `RGBA(198, 86, 17, 1)` | Severity badge font colour |
| Medium | `RGBA(224, 164, 10, 1)` | Severity badge font colour, mid score |
| Low | `RGBA(11, 106, 190, 1)` | Severity badge font colour |
| Track grey | `RGBA(225, 227, 231, 1)` | Progress bar track |
| Placeholder grey | `RGBA(233, 234, 236, 1)` | Zone image placeholder box |
| Caption bar grey | `RGBA(238, 238, 239, 1)` | Camera modal caption strip |
| Scrim | `RGBA(0, 0, 0, 0.55)` | Behind both overlays |

### Typography

Default app font. On `ModernText` the size property is `Size` and the colour property is
`Color`.

| Role | Size | FontWeight | Colour |
|---|---|---|---|
| Header wordmark | 17 | `FontWeight.Semibold` | Header text |
| Big score | 44 | `FontWeight.Bold` | Score colour ramp |
| KPI / tile value | 22-28 | `FontWeight.Bold` | Semantic |
| Screen / panel title | 17-24 | `FontWeight.Semibold` (24 -> Bold) | Text main |
| Body, question text | 14 | `FontWeight.Normal` | Text main |
| Row secondary, captions | 13 | `FontWeight.Normal` | Text muted |
| Field label, hint, KPI caption | 12 | `FontWeight.Normal` | Text muted |

**Set `Color` on every `ModernText` you place.** Nothing inherits a contrasting colour.

## UI Copy Language

Vietnamese everywhere, with exactly three English exceptions, all mandated by the mock-up:

1. The header wordmark `"Site Inspection"`.
2. The radio option labels `"Yes"`, `"No"`, `"N/A"`.
3. The camera-modal caption `"Click inside the frame to capture"`.

The stored `colChecklist.Result` values remain `"Pass"` / `"Fail"` / `"NA"` — never
`"Yes"` / `"No"` / `"N/A"`. The display-to-data mapping lives only in
`ChkRadioAnswer.Default` and `ChkRadioAnswer.OnChange`.

## Layout Strategy

- Phone portrait only. **AutoLayout everywhere.** No `ManualLayout` container anywhere in
  the app.
- Breakpoint constant for this app: **320**. Rows that would not fit below 320 must stack:
  `LayoutDirection: =If(Parent.Width < 320, LayoutDirection.Vertical, LayoutDirection.Horizontal)`.
  Every horizontal row in this plan has already been budgeted to fit at 320, so no screen
  actually needs that branch — but the budgets are written out in each brief and must not
  be widened without re-checking them.
- Responsive properties derive **directly** from `App.Width`, `Parent.Width` or
  `Self.Width`. Never initialize `varIsMobile`, `varColumns` or any layout variable in
  `OnVisible`.
- Every screen has one root `GroupContainer` / `AutoLayout`:
  `LayoutDirection: =LayoutDirection.Vertical`, `LayoutOverflowY: =LayoutOverflow.Scroll`,
  `LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutMinWidth: =0`,
  `LayoutMinHeight: =0`, `Width: =Parent.Width`, `Fill: =RGBA(255, 255, 255, 1)`.
- **Every direct child of a scrolling root sets `FillPortions: =0` and an explicit
  `Height`.** Without it the child is pinned to the viewport and content is clipped rather
  than scrolled.
- Set `LayoutMinWidth: =0` and `LayoutMinHeight: =0` on **every** `GroupContainer`; the
  defaults are 250 and 100 and will push containers wider than the phone.
- Any vertical container holding text uses `LayoutAlignItems: =LayoutAlignItems.Stretch`,
  or the text is sized to its intrinsic width and silently clipped.
- Interactive controls are **44px minimum**; the radio row is 48px.
- `Gallery` is a Classic control. Each gallery gets exactly **one** direct child — an
  AutoLayout `GroupContainer` row shell sized with `Width: =Parent.TemplateWidth` and
  `Height: =Parent.TemplateHeight`. Those two output properties resolve only on that direct
  child; deeper inside the row use `Parent.Width` / `FillPortions`.
- Bounded galleries size to all their rows and let the root scroll:
  `Height: =Self.AllItemsCount * Self.TemplateHeight + ((Self.AllItemsCount + 1) * Self.TemplatePadding)`.
  Do not put `LayoutOverflowY: =LayoutOverflow.Scroll` on a gallery's container.

### Screen-level children

Screen1, scrReview and scrDone each have **exactly one** screen-level child: their root.

`scrChecklist` is the one documented exception. A sticky footer and two modal overlays
cannot be expressed inside a single scrolling AutoLayout root, so that screen has four
screen-level children, each with an explicit `X`, `Y`, `Width` and `Height`, and both
overlays `Visible`-gated to false by default. The exact geometry is in
`scrChecklist.screen-plan.md`. Do not copy this pattern onto any other screen.

## App Header Pattern

The black band at the top of **all four screens**. It is a *pattern*, not a shared block of
names: each screen instantiates it under its own prefix (`SiteHeader`, `ChkHeader`,
`RevHeader`, `DoneHeader`). The control **names** vary; every value below is identical on
every screen and must be copied verbatim.

```
<P>Header            GroupContainer / AutoLayout
  Fill                  =RGBA(0, 0, 0, 1)
  LayoutDirection       =LayoutDirection.Horizontal
  LayoutAlignItems      =LayoutAlignItems.Center
  LayoutJustifyContent  =LayoutJustifyContent.SpaceBetween
  LayoutGap             =8
  PaddingLeft           =16
  PaddingRight          =16
  Width                 =Parent.Width
  Height                =64
  FillPortions          =0
  LayoutMinWidth        =0
  LayoutMinHeight       =0

  <P>HeaderHome      Icon
    Icon                =Icon.Home
    Color               =RGBA(255, 255, 255, 1)
    Width               =44
    Height              =44
    FillPortions        =0
    PaddingTop          =10
    PaddingBottom       =10
    PaddingLeft         =10
    PaddingRight        =10
    AccessibleLabel     ="Về màn hình đầu"
    OnSelect            (see below)

  <P>HeaderTitle     ModernText
    Text                ="Site Inspection"
    Color               =RGBA(255, 255, 255, 1)
    Size                =17
    FontWeight          =FontWeight.Semibold
    Align               =Align.Center
    VerticalAlign       =VerticalAlign.Middle
    Wrap                =false
    Height              =28
    PaddingTop          =0
    PaddingBottom       =0
    FillPortions        =1
    LayoutMinWidth      =0

  <P>HeaderAvatar    GroupContainer / AutoLayout
    Fill                =RGBA(240, 214, 138, 1)
    Width               =44
    Height              =44
    FillPortions        =0
    RadiusTopLeft       =22
    RadiusTopRight      =22
    RadiusBottomLeft    =22
    RadiusBottomRight   =22
    LayoutDirection     =LayoutDirection.Horizontal
    LayoutAlignItems    =LayoutAlignItems.Center
    LayoutJustifyContent =LayoutJustifyContent.Center
    LayoutMinWidth      =0
    LayoutMinHeight     =0
    AccessibleLabel     =AppUserName

    <P>HeaderInitials  ModernText
      Text              =AppUserInitials
      Color             =RGBA(32, 31, 30, 1)
      Size              =14
      FontWeight        =FontWeight.Semibold
      Align             =Align.Center
      VerticalAlign     =VerticalAlign.Middle
      Wrap              =false
      Height            =20
      PaddingTop        =0
      PaddingBottom     =0
      FillPortions      =0
```

`<P>HeaderHome.OnSelect` — identical on all four screens. Two-tap confirmation so a
half-finished audit is never discarded by one mis-tap:

```yaml
OnSelect: |-
  =If(
      CountRows(colChecklist) > 0 && !gblHomeConfirm,
      Set(gblHomeConfirm, true);
      Notify("Nhấn biểu tượng nhà lần nữa để huỷ phiên kiểm tra.", NotificationType.Warning, 4000),
      Clear(colChecklist);
      Set(gblHomeConfirm, false);
      Navigate(Screen1, ScreenTransition.Fade)
  )
```

Every screen's `OnVisible` must contain `Set(gblHomeConfirm, false)` so the confirmation
never leaks across a navigation.

Header width budget at 320: 16 + 44 + 8 + flexible title + 8 + 44 + 16 = 136 fixed,
title gets 184. The wordmark at Size 17 is ~120px, so it never clips.

## Named State

All of this is created in `App.pa.yaml` and is already written. Screens **consume** it.

### Seed collections (read-only to screens)

| Collection | Columns |
|---|---|
| `colZones` | `ZoneId` (n), `Title`, `ZoneCode`, `Address`, `Description` — 5 rows |
| `colTemplates` | `TemplateId` (n), `Title` — 2 rows |
| `colItems` | `ItemId` (n), `TemplateId` (n), `OrderNumber` (n), `IsCritical` (bool), `Question` — 8 rows |
| `colUsers` | `UserId` (n), `Name`, `Email` — 5 rows |

### Working collections

`colChecklist` — the source of truth while an audit is in progress. Schema is seeded and
then cleared in `App.OnStart`, so the column types are fixed app-wide:

| Column | Type | Meaning |
|---|---|---|
| `ItemId` | Number | Copied from `colItems.ItemId`. **The row key for every `Patch`/`LookUp`.** |
| `OrderNumber` | Number | Display order |
| `Question` | Text | Question text |
| `IsCritical` | Boolean | Drives the default severity only |
| `Result` | Text | `""` = unanswered, `"Pass"`, `"Fail"`, `"NA"` |
| `FailDesc` | Text | `""` when not a failure |
| `FailSeverity` | Text | `""`, `"Low"`, `"Medium"`, `"High"`, `"Critical"` |
| `FailAssigneeName` | Text | Display name from `colUsers` |
| `FailAssigneeEmail` | Text | Email from `colUsers` |
| `FailPhoto` | Image | Seeded as `""` so the column is image-typed but blank. **Always use that exact literal to clear it — never a bare `Blank()`.** |

`colSubmitted` — one row, written only by `RevBtnSubmit`. Columns: `RunId`, `ZoneTitle`,
`ZoneCode`, `TemplateTitle`, `SubmittedAt`, `RunScore`, `RunPassCount`, `RunFailCount`,
`RunNACount`, `RunTotalItems`, `GeneralNotes`. `scrDone` reads it via `First(colSubmitted)`
because `colChecklist` has been cleared by then.

### Global variables (all typed in `App.OnStart`)

| Variable | Type | Owner | Meaning |
|---|---|---|---|
| `gblZone` | Record | Screen1 | Selected zone record |
| `gblTemplate` | Record | Screen1 | Selected template record |
| `gblAuditStart` | DateTime | Screen1 | Set when the checklist is built |
| `gblCurrentItemId` | Number | scrChecklist | `ItemId` of the row whose overlay is open |
| `gblFailDesc` | Text | scrChecklist | Seed for `ChkFailTxtDesc.Default` |
| `gblFailSeverity` | Text | scrChecklist | Seed for `ChkFailDdSeverity` |
| `gblFailAssigneeName` | Text | scrChecklist | Seed for `ChkFailCmbAssignee` |
| `gblShowFailPanel` | Boolean | scrChecklist | Fail-detail overlay visibility |
| `gblShowCamera` | Boolean | scrChecklist | Camera overlay visibility |
| `gblSubmitting` | Boolean | scrReview | Double-tap lock on the real Submit |
| `gblCancelConfirm` | Boolean | scrChecklist | Two-tap confirm on footer Cancel |
| `gblHomeConfirm` | Boolean | all | Two-tap confirm on the header home icon |

### Named formulas (`App.Formulas`) — use these, never recompute them

| Formula | Value |
|---|---|
| `AppUserName` | `Coalesce(User().FullName, "Auditor Factory")` |
| `AppUserInitials` | Up to two initials from `AppUserName`, upper-cased |
| `TotalCount` | `CountRows(colChecklist)` |
| `AnsweredCount` | rows with a non-blank `Result` |
| `RemainingCount` | `TotalCount - AnsweredCount` |
| `PassCount` / `FailCount` / `NACount` | rows by `Result` |
| `FailList` | `Filter(colChecklist, Result = "Fail")` |
| `ComplianceScore` | `passed / (passed + failed) * 100`, rounded to 1 dp; **100 when nothing is applicable**; N/A rows are excluded from the denominator |
| `IsAuditComplete` | `TotalCount > 0` and every row answered |

`IsAuditComplete`, `RemainingCount` and `ComplianceScore` are derived from the current
contents of `colChecklist`. **Never introduce a "validity" or "answered" flag variable** —
correcting an answer must make these formulas change on their own.

## Control Naming

`<type abbreviation><ScreenPrefix><Role>`, e.g. `btnSiteSurvey` — but this app uses the
shorter, equally unambiguous form already fixed in the briefs: **`<ScreenPrefix><Role>`
with the type implied by the role word**, e.g. `SiteBtnSurvey`, `ChkRadioAnswer`,
`RevBadgeSeverity`, `DoneBtnNew`.

Prefixes are unique across the whole app and must never be reused:

| Screen | Prefix |
|---|---|
| Screen1 (Site Inspection) | `Site` |
| scrChecklist | `Chk` |
| scrReview | `Rev` |
| scrDone | `Done` |

Control names must be unique app-wide. Builders cannot see each other's files, so the
prefix is the only thing preventing a collision. Repeated blocks (the header) are
instantiated under each screen's own prefix — never write a bare `Header` or `BtnCancel`.

## Cross-Screen Contracts

```
Screen1  --[SiteBtnSurvey: builds colChecklist, Set gblZone/gblTemplate/gblAuditStart]-->  scrChecklist
scrChecklist --[ChkBtnSubmit, enabled only when IsAuditComplete]-->  scrReview
scrChecklist --[ChkBtnBack]-->  Screen1            (colChecklist preserved)
scrChecklist --[ChkBtnCancel, two-tap]-->  Screen1 (colChecklist cleared)
scrReview    --[RevBtnBack]-->  scrChecklist
scrReview    --[RevBtnSubmit: writes colSubmitted, then Clear(colChecklist)]-->  scrDone
scrDone      --[DoneBtnNew]-->  Screen1
any screen   --[<P>HeaderHome, two-tap when colChecklist is non-empty]-->  Screen1
```

- All navigation uses `Navigate(<Screen>, ScreenTransition.Fade)`.
- All cross-screen navigation is a direct `ModernButton.OnSelect` or `Icon.OnSelect`. There
  is no `ModernTabList` anywhere in this app.
- `scrReview` is the **only** place that writes `colSubmitted` and the **only** place that
  calls `Clear(colChecklist)` on success. `scrChecklist`'s Cancel and the header home icon
  also clear it, but only as an explicit discard.
- `scrDone` must read `First(colSubmitted)`, never `colChecklist` or `ComplianceScore` —
  the checklist is empty by the time it renders.

## YAML Conventions

- Every property value starts with `=`. `Text: ="Huỷ"`, `Width: =44`, `Visible: =true`.
- Multi-line formulas use the `|-` block scalar, with the `=` on the first content line,
  never on the `|-` line.
- **Any inline value containing `: ` must be single-quoted**, e.g.
  `Text: '="Khu vực: " & gblZone.Title'`, or converted to a `|-` block. None of the copy in
  these briefs contains `: ` — all captions use `—`, `•` or `/` instead. Keep it that way.
- Power Fx record literals inline must be quoted: `Default: '={Value: "Low"}'`. The briefs
  avoid inline record literals entirely; option lists are written as single-column tables
  such as `Items: =["Low", "Medium", "High", "Critical"]`, which need no quoting.
- Never write an `@version` suffix on `Control:`. Write `Control: ModernText`, never
  `Control: ModernText@1.5.0`. One suffix anywhere breaks every screen.
- `Variant:` is mandatory on `GroupContainer` (`AutoLayout` everywhere in this app) and on
  `Gallery` (`Vertical` everywhere in this app). Omitting it fails the compile with a
  message that names no control.
- Enum type names are copied verbatim, quoted with `'` when they contain a dot:
  `Appearance: ='BadgeCanvas.Appearance'.Tint`.
- Text styling is spelled per control family: `ModernText` / `ModernButton` /
  `ModernDropdown` / `ModernTextInput` use `Color` and `Size`; **`Badge` uses `FontColor`
  and `FontSize` and its visible string is `Content`.**
- `Rectangle` has no radius properties and is not used in this app. Rounded filled surfaces
  are `GroupContainer` with the four `Radius*` properties.
- Vietnamese text is written directly in UTF-8 with full diacritics. Do not strip accents.
- Give every interactive control an `AccessibleLabel` and every gallery a `TabIndex: =0`.
