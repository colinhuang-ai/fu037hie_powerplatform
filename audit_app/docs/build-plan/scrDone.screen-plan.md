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

# Screen Plan: Done

Read `canvas-app-shared.md` first — palette, typography, the App Header pattern, the
`colSubmitted` schema and YAML conventions live there and are not repeated here.

## Assignment

- Action: Create
- Target file: `D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\scrDone.pa.yaml`
- YAML key: `scrDone`
- Control name prefix: `Done`

## Specification

### Purpose

Confirm that the audit was sent, show the score and the number of failures that were
recorded, and offer one action — start a new audit.

### The one rule that matters on this screen

`colChecklist` has already been cleared by `RevBtnSubmit` before this screen renders.
**Every value here must come from `First(colSubmitted)`.** Reading `ComplianceScore`,
`FailCount` or anything else derived from `colChecklist` would show 100% and 0 failures on
every run.

### Screen properties

```yaml
Screens:
  scrDone:
    Properties:
      Fill: =RGBA(255, 255, 255, 1)
      OnVisible: =Set(gblHomeConfirm, false)
    Children:
      - DoneRoot: ...
```

The screen-level `Children:` list contains **only** `DoneRoot`.

### Layout

`DoneRoot` — `GroupContainer` / `AutoLayout`, the scrolling root:
`LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`,
`LayoutOverflowY: =LayoutOverflow.Scroll`, `LayoutGap: =0`, `LayoutMinWidth: =0`,
`LayoutMinHeight: =0`, `Width: =Parent.Width`, `Height: =Parent.Height`,
`Fill: =RGBA(255, 255, 255, 1)`.

Two direct children, both `FillPortions: =0`:

| Child | Height |
|---|---|
| `DoneHeader` (App Header pattern, prefix `Done`) | `=64` |
| `DoneBody` | `=460` |

#### `DoneBody` vertical budget

`GroupContainer` / `AutoLayout`, `LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`,
`LayoutJustifyContent: =LayoutJustifyContent.Start`, `LayoutGap: =14`,
`PaddingTop: =40`, `PaddingBottom: =24`, `PaddingLeft: =24`, `PaddingRight: =24`,
`Width: =Parent.Width`, `Height: =460`, `FillPortions: =0`,
`Fill: =RGBA(255, 255, 255, 1)`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`.

| Child | Height |
|---|---|
| `DoneIconCircle` | 88 |
| `DoneLblTitle` | 34 |
| `DoneLblZone` | 18 |
| `DoneScoreRow` | 96 |
| `DoneLblNotes` | 40 |
| `DoneBtnNew` | 48 |

324 children + 5 gaps x 14 = 70 + 64 padding = **458**, inside the 460 height.

Inner width at 390: 390 - 48 = 342. At 320: 272.

### Controls

- `DoneIconCircle` — `GroupContainer` / `AutoLayout`, `Width: =88`, `Height: =88`,
  `FillPortions: =0`, `AlignInContainer: =AlignInContainer.Center`,
  `Fill: =RGBA(14, 116, 60, 1)`,
  `RadiusTopLeft/TopRight/BottomLeft/BottomRight: =44`,
  `LayoutDirection: =LayoutDirection.Horizontal`,
  `LayoutAlignItems: =LayoutAlignItems.Center`,
  `LayoutJustifyContent: =LayoutJustifyContent.Center`,
  `PaddingTop/Bottom/Left/Right: =0`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`.
  - `DoneIconCheck` — `Icon`, `Icon: =Icon.Check`, `Color: =RGBA(255, 255, 255, 1)`,
    `Width: =48`, `Height: =48`, `FillPortions: =0`,
    `PaddingTop/Bottom/Left/Right: =4`, `AccessibleLabel: ="Đã gửi thành công"`.
- `DoneLblTitle` — `ModernText`, `Text: ="Đã gửi audit"`, `Size: =24`,
  `FontWeight: =FontWeight.Bold`, `Color: =RGBA(32, 31, 30, 1)`,
  `Align: =Align.Center`, `Height: =34`, `Wrap: =false`, `FillPortions: =0`,
  `PaddingTop: =0`, `PaddingBottom: =0`.
- `DoneLblZone` — `ModernText`,
  `Text: =First(colSubmitted).ZoneTitle & " • " & First(colSubmitted).TemplateTitle`,
  `Size: =13`, `Color: =RGBA(120, 120, 125, 1)`, `Align: =Align.Center`,
  `Height: =18`, `Wrap: =false`, `FillPortions: =0`, `PaddingTop: =0`,
  `PaddingBottom: =0`.
- `DoneScoreRow` — `GroupContainer` / `AutoLayout`,
  `LayoutDirection: =LayoutDirection.Horizontal`,
  `LayoutAlignItems: =LayoutAlignItems.Stretch`,
  `LayoutJustifyContent: =LayoutJustifyContent.SpaceBetween`, `LayoutGap: =12`,
  `Height: =96`, `FillPortions: =0`, `PaddingTop/Bottom/Left/Right: =0`,
  `LayoutMinWidth: =0`, `LayoutMinHeight: =0`, `Fill: =RGBA(255, 255, 255, 1)`.

  Two tiles, each `FillPortions: =1`, `LayoutMinWidth: =120`, `Height: =96`.
  Budget at 320: 48 padding + 2 x 120 + 12 gap = 300 <= 320. At 390 each tile is 165.
  Two children only — no reflow branch.

  Tile shape (`DoneScoreTile`, `DoneFailTile`): `GroupContainer` / `AutoLayout`,
  `LayoutDirection: =LayoutDirection.Vertical`,
  `LayoutAlignItems: =LayoutAlignItems.Stretch`,
  `LayoutJustifyContent: =LayoutJustifyContent.Center`, `LayoutGap: =4`,
  `PaddingTop: =14`, `PaddingBottom: =14`, `PaddingLeft: =6`, `PaddingRight: =6`,
  `Fill: =RGBA(244, 245, 247, 1)`,
  `RadiusTopLeft/TopRight/BottomLeft/BottomRight: =6`, `LayoutMinWidth: =120`,
  `LayoutMinHeight: =0`, `FillPortions: =1`, `Height: =96`.
  Budget: 14 + 38 + 4 + 16 + 14 = 86 within 96.

  | Tile | Value control | Value formula | Value colour | Caption control | Caption |
  |---|---|---|---|---|---|
  | `DoneScoreTile` | `DoneLblScoreValue` | `=Text(First(colSubmitted).RunScore, "[$-en-US]0.0") & "%"` | see ramp below | `DoneLblScoreCaption` | `="Điểm tuân thủ"` |
  | `DoneFailTile` | `DoneLblFailValue` | `=First(colSubmitted).RunFailCount & ""` | `RGBA(184, 37, 30, 1)` | `DoneLblFailCaption` | `="Lỗi cần khắc phục"` |

  Score colour ramp on `DoneLblScoreValue`:

  ```yaml
  Color: |-
    =If(
        First(colSubmitted).RunScore >= 90, RGBA(14, 116, 60, 1),
        First(colSubmitted).RunScore >= 75, RGBA(224, 164, 10, 1),
        RGBA(184, 37, 30, 1)
    )
  ```

  Value controls: `ModernText`, `Size: =28`, `FontWeight: =FontWeight.Bold`,
  `Align: =Align.Center`, `Height: =38`, `Wrap: =false`, `FillPortions: =0`,
  `PaddingTop: =0`, `PaddingBottom: =0`.

  Caption controls: `ModernText`, `Size: =12`, `Color: =RGBA(120, 120, 125, 1)`,
  `Align: =Align.Center`, `Height: =16`, `Wrap: =false`, `FillPortions: =0`,
  `PaddingTop: =0`, `PaddingBottom: =0`. `"Lỗi cần khắc phục"` is about 104px at Size 12,
  inside the 120px tile minimum, so `Wrap: =false` cannot clip it.

- `DoneLblNotes` — `ModernText`, `Size: =12`, `Color: =RGBA(120, 120, 125, 1)`,
  `Align: =Align.Center`, `Wrap: =true`, `Height: =40`, `FillPortions: =0`,
  `PaddingTop: =0`, `PaddingBottom: =0`, `VerticalAlign: =VerticalAlign.Top`,
  ```yaml
  Text: |-
    =If(
        IsBlank(First(colSubmitted).GeneralNotes),
        "",
        "Ghi chú — " & First(colSubmitted).GeneralNotes
    )
  ```
  The separator is an em dash, not a colon, so the value never contains `": "` and needs
  no YAML quoting.
- `DoneBtnNew` — `ModernButton`:
  ```yaml
  Text: ="Bắt đầu lượt mới"
  Appearance: =ButtonAppearance.Primary
  BasePaletteColor: =RGBA(60, 74, 82, 1)
  Color: =RGBA(255, 255, 255, 1)
  Size: =15
  Height: =48
  Width: =Parent.Width
  FillPortions: =0
  AccessibleLabel: ="Bắt đầu lượt kiểm tra mới"
  OnSelect: |-
    =Clear(colChecklist);
    Set(gblCurrentItemId, 0);
    Set(gblFailDesc, "");
    Set(gblFailSeverity, "Critical");
    Set(gblFailAssigneeName, "");
    Set(gblShowFailPanel, false);
    Set(gblShowCamera, false);
    Set(gblSubmitting, false);
    Set(gblCancelConfirm, false);
    Set(gblHomeConfirm, false);
    Navigate(Screen1, ScreenTransition.Fade)
  ```
  `Width: =Parent.Width` with `FillPortions: =0` inside a vertical `Stretch` parent is
  required — a `ModernButton` left to its own defaults renders at a small intrinsic width
  and this multiword label would be cramped.

20 controls in total.

### Data binding

- `colSubmitted` holds exactly one row, written by `RevBtnSubmit`. Read it with
  `First(colSubmitted)`.
- Fields read here: `ZoneTitle`, `TemplateTitle`, `RunScore`, `RunFailCount`,
  `GeneralNotes`.
- Do **not** reference `colChecklist`, `ComplianceScore`, `FailCount` or any other
  checklist-derived named formula on this screen.

### Navigation

- `DoneBtnNew` -> `Screen1`, after clearing the working state.
- `DoneHeaderHome` -> `Screen1` per the shared App Header pattern. Because `colChecklist`
  is already empty when this screen is reached, the pattern's confirmation branch is not
  triggered and the icon navigates directly — which is correct here. Still write the shared
  formula verbatim; do not special-case it.

### State

`OnVisible` sets `gblHomeConfirm` to `false`. Nothing else.

## Required Variants

| Control type | Variant |
|---|---|
| `GroupContainer` | `AutoLayout` |

## Control Definitions

Only the properties this screen may write.

### `GroupContainer` (Variant `AutoLayout`)

`LayoutDirection`, `LayoutAlignItems`, `LayoutJustifyContent`, `LayoutGap`, `LayoutWrap`,
`LayoutOverflowY`, `LayoutOverflowX`, `LayoutMinWidth`, `LayoutMinHeight`,
`LayoutMaxWidth`, `LayoutMaxHeight`, `FillPortions`, `AlignInContainer`, `PaddingTop`,
`PaddingBottom`, `PaddingLeft`, `PaddingRight`, `Fill`, `Width`, `Height`, `X`, `Y`,
`Visible`, `DisplayMode`, `RadiusTopLeft`, `RadiusTopRight`, `RadiusBottomLeft`,
`RadiusBottomRight`, `BorderColor`, `BorderStyle`, `BorderThickness`, `DropShadow`,
`AccessibleLabel`.

Enum literals: `LayoutDirection.Vertical`, `LayoutDirection.Horizontal`,
`LayoutAlignItems.Stretch`, `LayoutAlignItems.Center`,
`LayoutJustifyContent.Start`, `LayoutJustifyContent.Center`,
`LayoutJustifyContent.SpaceBetween`,
`LayoutOverflow.Scroll`,
`AlignInContainer.Center`, `AlignInContainer.Stretch`,
`BorderStyle.Solid`, `BorderStyle.None`,
`DisplayMode.Edit`, `DisplayMode.View`, `DisplayMode.Disabled`.

`GroupContainer` has no `OnSelect`.

### `ModernText`

`Text`, `Color`, `Size`, `FontWeight`, `Align`, `VerticalAlign`, `Wrap`, `AutoHeight`,
`Width`, `Height`, `X`, `Y`, `Visible`, `DisplayMode`, `AccessibleLabel`, `PaddingTop`,
`PaddingBottom`, `PaddingLeft`, `PaddingRight`, `FillPortions`, `AlignInContainer`,
`LayoutMinWidth`, `LayoutMinHeight`.

Enum literals: `FontWeight.Normal`, `FontWeight.Semibold`, `FontWeight.Bold`,
`Align.Left`, `Align.Center`, `Align.Right`,
`VerticalAlign.Top`, `VerticalAlign.Middle`, `VerticalAlign.Bottom`.

Colour is `Color`, size is `Size`. No `FontColor`, no `FontSize`.

### `ModernButton`

`Text`, `OnSelect`, `Appearance`, `BasePaletteColor`, `Color`, `Size`, `FontWeight`,
`DisplayMode`, `Visible`, `Width`, `Height`, `X`, `Y`, `AccessibleLabel`,
`AlignInContainer`, `FillPortions`, `LayoutMinWidth`, `LayoutMinHeight`,
`RadiusTopLeft`, `RadiusTopRight`, `RadiusBottomLeft`, `RadiusBottomRight`.

Enum name for `Appearance` is **`ButtonAppearance`**.
Literals: `ButtonAppearance.Primary`, `ButtonAppearance.Secondary`,
`ButtonAppearance.Outline`, `ButtonAppearance.Subtle`, `ButtonAppearance.Transparent`.
Do not set `Fill`.

### `Classic/Icon`

`Icon`, `Color`, `Fill`, `OnSelect`, `Width`, `Height`, `X`, `Y`, `Visible`,
`DisplayMode`, `AccessibleLabel`, `Tooltip`, `Rotation`, `Transparency`, `BorderColor`,
`BorderStyle`, `BorderThickness`, `PaddingTop`, `PaddingBottom`, `PaddingLeft`,
`PaddingRight`, `FillPortions`, `AlignInContainer`, `LayoutMinWidth`, `LayoutMinHeight`.

Compile-ready enum literals used on this screen: `Icon.Home`, `Icon.Check`.
