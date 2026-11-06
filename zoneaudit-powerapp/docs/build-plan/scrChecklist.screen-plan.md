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

---

# Screen Plan: Checklist

Read `canvas-app-shared.md` first — palette, typography, the App Header pattern, the
`colChecklist` schema, named formulas and YAML conventions live there and are not repeated
here.

## Assignment

- Action: Create
- Target file: `D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\scrChecklist.pa.yaml`
- YAML key: `scrChecklist`
- Control name prefix: `Chk`

This is the largest screen in the app (47 controls). Budget your time accordingly and build
it in the order below: root -> header -> progress -> gallery row -> footer -> fail overlay
-> camera overlay.

## Specification

### Purpose

Answer every question, capture a photo for anything that fails, and record the fail detail
(description, severity, assignee) without ever leaving the screen. `colChecklist` is the
source of truth; every interaction writes into it immediately.

### Screen properties

```yaml
Screens:
  scrChecklist:
    Properties:
      Fill: =RGBA(255, 255, 255, 1)
      OnVisible: |-
        =Set(gblHomeConfirm, false);
        Set(gblCancelConfirm, false);
        Set(gblShowFailPanel, false);
        Set(gblShowCamera, false)
    Children:
      - ChkRoot: ...
      - ChkFooter: ...
      - ChkFailOverlay: ...
      - ChkCamOverlay: ...
```

### Screen-level geometry — the documented exception

This screen has **four** screen-level children, not one. A sticky footer and two modal
overlays cannot be expressed inside a single scrolling AutoLayout root. Every one of them
carries explicit `X`, `Y`, `Width` and `Height`, and both overlays are `Visible`-gated off
by default, so nothing can cover content unintentionally.

| Screen child | X | Y | Width | Height | Visible |
|---|---|---|---|---|---|
| `ChkRoot` | `=0` | `=0` | `=Parent.Width` | `=Parent.Height - 92` | (unset) |
| `ChkFooter` | `=0` | `=Parent.Height - 92` | `=Parent.Width` | `=92` | (unset) |
| `ChkFailOverlay` | `=0` | `=0` | `=Parent.Width` | `=Parent.Height` | `=gblShowFailPanel` |
| `ChkCamOverlay` | `=0` | `=0` | `=Parent.Width` | `=Parent.Height` | `=gblShowCamera` |

All four are `GroupContainer` / `AutoLayout`. Declare them in exactly that order so the
overlays paint above the content and the footer.

### `ChkRoot` — scrolling content

```
LayoutDirection      =LayoutDirection.Vertical
LayoutAlignItems     =LayoutAlignItems.Stretch
LayoutOverflowY      =LayoutOverflow.Scroll
LayoutGap            =0
LayoutMinWidth       =0
LayoutMinHeight      =0
Fill                 =RGBA(255, 255, 255, 1)
```

Three direct children, each `FillPortions: =0`:

| Child | Height |
|---|---|
| `ChkHeader` (App Header pattern, prefix `Chk`) | `=64` |
| `ChkProgressSection` | `=52` |
| `ChkGallery` | `=Self.AllItemsCount * Self.TemplateHeight + ((Self.AllItemsCount + 1) * Self.TemplatePadding)` |

With 4 questions per template the gallery is 4 x 228 + 5 x 8 = 952px, so the root always
scrolls. That is correct and intended.

### `ChkProgressSection`

`GroupContainer` / `AutoLayout`, `LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutGap: =6`, `PaddingLeft: =16`,
`PaddingRight: =16`, `PaddingTop: =10`, `PaddingBottom: =10`, `Height: =52`,
`Width: =Parent.Width`, `FillPortions: =0`, `Fill: =RGBA(248, 248, 249, 1)`,
`LayoutMinWidth: =0`, `LayoutMinHeight: =0`.

Budget: 10 + 18 + 6 + 6 + 10 = 50, section 52.

- `ChkLblProgress` — `ModernText`, `Height: =18`, `FillPortions: =0`, `Size: =12`,
  `Color: =RGBA(120, 120, 125, 1)`, `Align: =Align.Left`, `Wrap: =false`,
  `PaddingTop: =0`, `PaddingBottom: =0`,
  `Text: =AnsweredCount & " / " & TotalCount & " câu hỏi"`,
  `AccessibleLabel: ="Tiến độ trả lời"`.
- `ChkProgTrack` — `GroupContainer` / `AutoLayout`,
  `LayoutDirection: =LayoutDirection.Horizontal`,
  `LayoutAlignItems: =LayoutAlignItems.Stretch`,
  `LayoutJustifyContent: =LayoutJustifyContent.Start`, `LayoutGap: =0`,
  `Height: =6`, `Width: =Parent.Width`, `FillPortions: =0`,
  `Fill: =RGBA(225, 227, 231, 1)`,
  `RadiusTopLeft/TopRight/BottomLeft/BottomRight: =3`,
  `LayoutMinWidth: =0`, `LayoutMinHeight: =0`, `PaddingTop: =0`, `PaddingBottom: =0`,
  `PaddingLeft: =0`, `PaddingRight: =0`.
  - `ChkProgFill` — `GroupContainer` / `AutoLayout`,
    `Width: =Parent.Width * (AnsweredCount / Max(TotalCount, 1))`, `Height: =6`,
    `FillPortions: =0`, `Fill: =RGBA(60, 74, 82, 1)`,
    `RadiusTopLeft/TopRight/BottomLeft/BottomRight: =3`,
    `LayoutMinWidth: =0`, `LayoutMinHeight: =0`,
    `LayoutDirection: =LayoutDirection.Horizontal`. No children.

`LayoutMinWidth: =0` on `ChkProgFill` is load-bearing: at zero progress the default
minimum of 250 would render a full bar.

### `ChkGallery`

```yaml
Control: Gallery
Variant: Vertical
Properties:
  Items: =colChecklist
  TemplateSize: =228
  TemplatePadding: =8
  Width: =Parent.Width
  Height: =Self.AllItemsCount * Self.TemplateHeight + ((Self.AllItemsCount + 1) * Self.TemplatePadding)
  FillPortions: =0
  Fill: =RGBA(244, 245, 247, 1)
  ShowScrollbar: =false
  Selectable: =false
  TabIndex: =0
  AccessibleLabel: ="Danh sách câu hỏi kiểm tra"
```

`Selectable: =false` prevents row selection while leaving the gallery in
`DisplayMode.Edit`, so the radios and icons inside the row stay interactive. Do **not** set
`DisplayMode.View` on the gallery — it would disable every control inside it.

Give the gallery exactly **one** direct child, `ChkRowShell`. `Parent.TemplateWidth` and
`Parent.TemplateHeight` resolve only on that direct child; anywhere deeper in the row,
`Parent` means the shell.

#### Row budget (fixed, 228px)

| Band | Height |
|---|---|
| `PaddingTop` | 14 |
| `ChkLblQuestion` | 42 |
| gap | 10 |
| `ChkAnswerRow` | 48 |
| gap | 10 |
| `ChkPhotoRow` | 90 |
| `PaddingBottom` | 14 |

= **228**. The thumbnail band is reserved in every row because a `Vertical` gallery has one
fixed `TemplateSize`; when there is no photo the band shows the label "Chưa có ảnh" rather
than empty space.

Seeded questions are at most 56 characters, which is 2 lines at Size 14 inside the 326px
inner width — `ChkLblQuestion` at `Height: =42` fits both lines.

`ChkRowShell` — `GroupContainer` / `AutoLayout`:

```
Width                =Parent.TemplateWidth
Height               =Parent.TemplateHeight
LayoutDirection      =LayoutDirection.Vertical
LayoutAlignItems     =LayoutAlignItems.Stretch
LayoutGap            =10
PaddingTop           =14
PaddingBottom        =14
PaddingLeft          =16
PaddingRight         =16
LayoutMinWidth       =0
LayoutMinHeight      =0
Fill                 =RGBA(255, 255, 255, 1)
RadiusTopLeft        =6   (all four corners)
```

Inner content width at 390: 390 - 32 = 358. At 320: 288.

#### `ChkLblQuestion`

`ModernText`, `Text: =ThisItem.Question`, `Size: =14`, `Color: =RGBA(32, 31, 30, 1)`,
`FontWeight: =FontWeight.Normal`, `Wrap: =true`, `AutoHeight: =false`, `Height: =42`,
`PaddingTop: =0`, `PaddingBottom: =0`, `FillPortions: =0`,
`AlignInContainer: =AlignInContainer.Stretch`, `VerticalAlign: =VerticalAlign.Top`,
`Align: =Align.Left`.

#### `ChkAnswerRow` horizontal budget

`GroupContainer` / `AutoLayout`, `LayoutDirection: =LayoutDirection.Horizontal`,
`LayoutAlignItems: =LayoutAlignItems.Center`,
`LayoutJustifyContent: =LayoutJustifyContent.SpaceBetween`, `LayoutGap: =8`,
`Height: =48`, `FillPortions: =0`, `AlignInContainer: =AlignInContainer.Stretch`,
`LayoutMinWidth: =0`, `LayoutMinHeight: =0`, `PaddingTop: =0`, `PaddingBottom: =0`,
`PaddingLeft: =0`, `PaddingRight: =0`, `Fill: =RGBA(255, 255, 255, 1)`.

| Child | Width | FillPortions |
|---|---|---|
| `ChkRadioAnswer` | flexible, `LayoutMinWidth: =0` | `=1` |
| `ChkIconCamera` | `=44` | `=0` |
| `ChkIconDetail` | `=44` | `=0` |

Budget at 320: fixed 44 + 44 + 2 gaps x 8 = 104; the radio group gets 288 - 104 = 184px for
three options at 48px touch height. At 390 it gets 254. Three children only — no reflow
branch is needed and none should be added.

#### `ChkRadioAnswer`

```yaml
Control: ModernRadio
Properties:
  Items: =["Yes", "No", "N/A"]
  Layout: =Layout.Horizontal
  Height: =48
  FillPortions: =1
  LayoutMinWidth: =0
  Size: =14
  Color: =RGBA(32, 31, 30, 1)
  AccessibleLabel: ="Kết quả kiểm tra cho câu hỏi này"
  Default: |-
    =Switch(
        ThisItem.Result,
        "Pass", "Yes",
        "Fail", "No",
        "NA",   "N/A",
        ""
    )
  OnChange: |-
    =With(
        {
            rowId: ThisItem.ItemId,
            ans: Switch(
                ChkRadioAnswer.Selected.Value,
                "Yes", "Pass",
                "No",  "Fail",
                "N/A", "NA",
                ""
            )
        },
        If(
            ans = "Fail",
            Patch(colChecklist, LookUp(colChecklist, ItemId = rowId), {Result: "Fail"});
            Set(gblCurrentItemId, rowId);
            Set(gblFailDesc, LookUp(colChecklist, ItemId = rowId).FailDesc);
            Set(
                gblFailSeverity,
                Coalesce(
                    LookUp(colChecklist, ItemId = rowId).FailSeverity,
                    If(LookUp(colChecklist, ItemId = rowId).IsCritical, "Critical", "Medium")
                )
            );
            Set(gblFailAssigneeName, LookUp(colChecklist, ItemId = rowId).FailAssigneeName);
            Reset(ChkFailTxtDesc);
            Reset(ChkFailDdSeverity);
            Reset(ChkFailCmbAssignee);
            Set(gblShowFailPanel, true),
            Patch(
                colChecklist,
                LookUp(colChecklist, ItemId = rowId),
                {
                    Result: ans,
                    FailDesc: "",
                    FailSeverity: "",
                    FailAssigneeName: "",
                    FailAssigneeEmail: ""
                }
            )
        )
    )
```

Three things here are load-bearing and must not be simplified:

1. **`Default` is bound to `ThisItem.Result`.** Gallery rows are recycled as the user
   scrolls; this is the only reason an answer reappears on a row that scrolled off screen
   and back. `OnChange` alone is not enough.
2. **The next answer is computed once, into `ans`, before any write**, and the same `ans`
   drives both the branch and the `Patch`. Do not re-read `ThisItem.Result` after patching
   to decide what happened.
3. **Choosing Yes or N/A clears the fail fields.** A question changed from No back to Yes
   must not leave a stale description, severity or assignee behind, or it will still appear
   in `FailList`-derived UI. The photo is deliberately *not* cleared here — use the explicit
   remove button for that.

`Coalesce` treats `""` as blank, so a row whose `FailSeverity` is still `""` falls through
to `"Critical"` when `IsCritical` is true and `"Medium"` otherwise — which is the required
"default to Critical when the question is critical" rule, while never overwriting a
severity the user already chose.

#### `ChkIconCamera`

`Icon`, `Icon: =Icon.Camera`, `Color: =RGBA(60, 74, 82, 1)`, `Width: =44`, `Height: =44`,
`FillPortions: =0`, `PaddingTop/Bottom/Left/Right: =10`,
`AccessibleLabel: ="Chụp ảnh cho câu hỏi này"`,

```yaml
OnSelect: |-
  =Set(gblCurrentItemId, ThisItem.ItemId);
  Set(gblShowCamera, true)
```

#### `ChkIconDetail`

`Icon`, `Icon: =Icon.Edit`, `Width: =44`, `Height: =44`, `FillPortions: =0`,
`PaddingTop/Bottom/Left/Right: =10`, `AccessibleLabel: ="Chi tiết lỗi"`,
`Color: =If(ThisItem.Result = "Fail", RGBA(184, 37, 30, 1), RGBA(200, 203, 206, 1))`,
`DisplayMode: =If(ThisItem.Result = "Fail", DisplayMode.Edit, DisplayMode.Disabled)`.

```yaml
OnSelect: |-
  =Set(gblCurrentItemId, ThisItem.ItemId);
  Set(gblFailDesc, LookUp(colChecklist, ItemId = ThisItem.ItemId).FailDesc);
  Set(
      gblFailSeverity,
      Coalesce(
          LookUp(colChecklist, ItemId = ThisItem.ItemId).FailSeverity,
          If(ThisItem.IsCritical, "Critical", "Medium")
      )
  );
  Set(gblFailAssigneeName, LookUp(colChecklist, ItemId = ThisItem.ItemId).FailAssigneeName);
  Reset(ChkFailTxtDesc);
  Reset(ChkFailDdSeverity);
  Reset(ChkFailCmbAssignee);
  Set(gblShowFailPanel, true)
```

This is the re-open affordance for the fail-detail panel. Its `AccessibleLabel` and its
enabled-only-on-Fail state must match that meaning. **Do not label it, or describe it
anywhere in the UI, as attaching or browsing device photos** — it does not do that.

#### `ChkPhotoRow` horizontal budget

`GroupContainer` / `AutoLayout`, `LayoutDirection: =LayoutDirection.Horizontal`,
`LayoutAlignItems: =LayoutAlignItems.Center`,
`LayoutJustifyContent: =LayoutJustifyContent.End`, `LayoutGap: =10`, `Height: =90`,
`FillPortions: =0`, `AlignInContainer: =AlignInContainer.Stretch`, `LayoutMinWidth: =0`,
`LayoutMinHeight: =0`, `PaddingTop: =0`, `PaddingBottom: =0`, `PaddingLeft: =0`,
`PaddingRight: =0`, `Fill: =RGBA(255, 255, 255, 1)`.

| Child | Width | Visible |
|---|---|---|
| `ChkLblNoPhoto` | `LayoutMinWidth: =120` | `=IsBlank(ThisItem.FailPhoto)` |
| `ChkRemoveCircle` | `=32` | `=!IsBlank(ThisItem.FailPhoto)` |
| `ChkImgThumb` | `=90` | `=!IsBlank(ThisItem.FailPhoto)` |

Budget at 320: only one state is ever visible. Photo state = 32 + 10 + 90 = 132 <= 288.
Empty state = 120 <= 288. Right-aligned by `LayoutJustifyContent.End`.

- `ChkLblNoPhoto` — `ModernText`, `Text: ="Chưa có ảnh"`, `Size: =12`,
  `Color: =RGBA(120, 120, 125, 1)`, `Align: =Align.Right`,
  `VerticalAlign: =VerticalAlign.Middle`, `Wrap: =false`, `Height: =20`,
  `LayoutMinWidth: =120`, `FillPortions: =0`, `PaddingTop: =0`, `PaddingBottom: =0`.
- `ChkRemoveCircle` — `GroupContainer` / `AutoLayout`, `Width: =32`, `Height: =32`,
  `FillPortions: =0`, `Fill: =RGBA(184, 37, 30, 1)`,
  `RadiusTopLeft/TopRight/BottomLeft/BottomRight: =16`,
  `LayoutDirection: =LayoutDirection.Horizontal`,
  `LayoutAlignItems: =LayoutAlignItems.Center`,
  `LayoutJustifyContent: =LayoutJustifyContent.Center`, `LayoutMinWidth: =0`,
  `LayoutMinHeight: =0`, `PaddingTop/Bottom/Left/Right: =0`.
  - `ChkIconRemovePhoto` — `Icon`, `Icon: =Icon.Cancel`,
    `Color: =RGBA(255, 255, 255, 1)`, `Width: =32`, `Height: =32`, `FillPortions: =0`,
    `PaddingTop/Bottom/Left/Right: =9`, `AccessibleLabel: ="Xoá ảnh của câu hỏi này"`,
    ```yaml
    OnSelect: |-
      =Patch(
          colChecklist,
          LookUp(colChecklist, ItemId = ThisItem.ItemId),
          {FailPhoto: ""}
      );
      Notify("Đã xoá ảnh của câu hỏi này.", NotificationType.Success, 2000)
    ```
    `""` is required — a bare `Blank()` here changes the
    column's inferred type and breaks `ChkImgThumb.Image` on every row.
- `ChkImgThumb` — `Image`, `Image: =ThisItem.FailPhoto`, `Width: =90`, `Height: =90`,
  `FillPortions: =0`, `ImagePosition: =ImagePosition.Fill`,
  `RadiusTopLeft/TopRight/BottomLeft/BottomRight: =2`,
  `BorderColor: =RGBA(214, 214, 214, 1)`, `BorderStyle: =BorderStyle.Solid`,
  `BorderThickness: =1`, `AccessibleLabel: ="Ảnh đã chụp cho câu hỏi này"`.

### `ChkFooter` — sticky, screen-level

`GroupContainer` / `AutoLayout`, `X: =0`, `Y: =Parent.Height - 92`,
`Width: =Parent.Width`, `Height: =92`, `LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutGap: =6`, `PaddingTop: =8`,
`PaddingBottom: =16`, `PaddingLeft: =16`, `PaddingRight: =16`,
`Fill: =RGBA(255, 255, 255, 1)`, `BorderColor: =RGBA(214, 214, 214, 1)`,
`BorderStyle: =BorderStyle.Solid`, `BorderThickness: =1`, `LayoutMinWidth: =0`,
`LayoutMinHeight: =0`.

Budget: 8 + 18 + 6 + 44 + 16 = 92.

- `ChkLblHint` — `ModernText`, `Height: =18`, `FillPortions: =0`, `Size: =12`,
  `Color: =RGBA(184, 37, 30, 1)`, `Align: =Align.Right`, `Wrap: =false`,
  `PaddingTop: =0`, `PaddingBottom: =0`,
  `Text: =If(!IsAuditComplete, "Còn " & RemainingCount & " câu chưa trả lời", "")`.
  The string "Còn N câu chưa trả lời" is verbatim from the spec — do not reword it.
- `ChkFooterBtns` — `GroupContainer` / `AutoLayout`,
  `LayoutDirection: =LayoutDirection.Horizontal`,
  `LayoutAlignItems: =LayoutAlignItems.Center`,
  `LayoutJustifyContent: =LayoutJustifyContent.SpaceBetween`, `LayoutGap: =10`,
  `Height: =44`, `FillPortions: =0`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`,
  `PaddingTop/Bottom/Left/Right: =0`.

  | Child | Width | FillPortions |
  |---|---|---|
  | `ChkBtnCancel` | `=90` | `=0` |
  | `ChkBtnBack` | `=56` | `=0` |
  | `ChkBtnSubmit` | `LayoutMinWidth: =120` | `=1` |

  Budget at 320: 32 padding + 90 + 10 + 56 + 10 = 198; Submit gets 122, above its 120
  minimum. At 390 Submit gets 192. Three children, one row, no reflow branch.

`ChkBtnCancel`:

```yaml
Text: ="Huỷ"
Appearance: =ButtonAppearance.Secondary
Color: =RGBA(32, 31, 30, 1)
Size: =14
Width: =90
Height: =44
FillPortions: =0
AccessibleLabel: ="Huỷ phiên kiểm tra"
OnSelect: |-
  =If(
      !gblCancelConfirm,
      Set(gblCancelConfirm, true);
      Notify("Nhấn Huỷ lần nữa để xoá toàn bộ câu trả lời.", NotificationType.Warning, 4000),
      Clear(colChecklist);
      Set(gblCancelConfirm, false);
      Navigate(Screen1, ScreenTransition.Fade)
  )
```

`ChkBtnBack`:

```yaml
Text: ="‹"
Appearance: =ButtonAppearance.Secondary
Color: =RGBA(32, 31, 30, 1)
Size: =18
Width: =56
Height: =44
FillPortions: =0
AccessibleLabel: ="Quay lại chọn khu vực"
OnSelect: =Navigate(Screen1, ScreenTransition.Fade)
```

Back keeps `colChecklist` intact — only Cancel and the header home icon discard it.

`ChkBtnSubmit`:

```yaml
Text: ="Gửi"
Appearance: =ButtonAppearance.Primary
Color: =RGBA(255, 255, 255, 1)
Size: =14
Height: =44
FillPortions: =1
LayoutMinWidth: =120
AccessibleLabel: ="Xem lại và gửi"
BasePaletteColor: =If(IsAuditComplete, RGBA(60, 74, 82, 1), RGBA(200, 203, 206, 1))
DisplayMode: =If(IsAuditComplete, DisplayMode.Edit, DisplayMode.Disabled)
OnSelect: =Navigate(scrReview, ScreenTransition.Fade)
```

This button does **not** submit anything — it goes to the review screen. The real submit is
`RevBtnSubmit`. Its availability comes straight from `IsAuditComplete`; do not add a flag.

### `ChkFailOverlay` — fail detail, screen-level modal

`GroupContainer` / `AutoLayout`, `X: =0`, `Y: =0`, `Width: =Parent.Width`,
`Height: =Parent.Height`, `Visible: =gblShowFailPanel`, `Fill: =RGBA(0, 0, 0, 0.55)`,
`LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`,
`LayoutJustifyContent: =LayoutJustifyContent.End`, `LayoutGap: =0`,
`PaddingTop/Bottom/Left/Right: =0`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`.

`ChkFailPanel` — `GroupContainer` / `AutoLayout`, `Width: =Parent.Width`,
`Height: =Min(Parent.Height - 40, 464)`, `FillPortions: =0`,
`Fill: =RGBA(255, 255, 255, 1)`, `RadiusTopLeft: =12`, `RadiusTopRight: =12`,
`RadiusBottomLeft: =0`, `RadiusBottomRight: =0`,
`LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutGap: =12`,
`LayoutOverflowY: =LayoutOverflow.Scroll`, `PaddingTop: =16`, `PaddingBottom: =20`,
`PaddingLeft: =16`, `PaddingRight: =16`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`.

Vertical budget: 16 + 24 + 40 + 16 + 88 + 16 + 44 + 16 + 44 + 44 + 8 gaps x 12 = 464. On a
viewport shorter than 504 the panel caps at `Parent.Height - 40` and scrolls internally —
that is the one place in the app where an inner scroll is correct, because the panel is a
modal and the root behind it is frozen.

Children in order, every one `FillPortions: =0`:

| # | Name | Control | Height |
|---|---|---|---|
| 1 | `ChkFailTitle` | ModernText | 24 |
| 2 | `ChkFailQuestion` | ModernText | 40 |
| 3 | `ChkFailLblDesc` | ModernText | 16 |
| 4 | `ChkFailTxtDesc` | ModernTextInput | 88 |
| 5 | `ChkFailLblSeverity` | ModernText | 16 |
| 6 | `ChkFailDdSeverity` | ModernDropdown | 44 |
| 7 | `ChkFailLblAssignee` | ModernText | 16 |
| 8 | `ChkFailCmbAssignee` | ModernCombobox | 44 |
| 9 | `ChkFailBtnRow` | GroupContainer / AutoLayout | 44 |

- `ChkFailTitle`: `Text: ="Chi tiết lỗi"`, `Size: =17`,
  `FontWeight: =FontWeight.Semibold`, `Color: =RGBA(32, 31, 30, 1)`, `Wrap: =false`,
  `PaddingTop: =0`, `PaddingBottom: =0`.
- `ChkFailQuestion`: `Text: =LookUp(colChecklist, ItemId = gblCurrentItemId).Question`,
  `Size: =13`, `Color: =RGBA(120, 120, 125, 1)`, `Wrap: =true`, `PaddingTop: =0`,
  `PaddingBottom: =0`, `VerticalAlign: =VerticalAlign.Top`.
- Labels 3 / 5 / 7: `Size: =12`, `Color: =RGBA(120, 120, 125, 1)`, `Wrap: =false`,
  `PaddingTop: =0`, `PaddingBottom: =0`. Texts, in order: `="Mô tả lỗi"`,
  `="Mức độ rủi ro"`, `="Người khắc phục"`.
- `ChkFailTxtDesc` — `ModernTextInput`:
  ```yaml
  Default: =gblFailDesc
  Type: =TextInputType.Multiline
  Height: =88
  Width: =Parent.Width
  FillPortions: =0
  Size: =14
  Color: =RGBA(32, 31, 30, 1)
  AccessibleLabel: ="Mô tả lỗi phát hiện"
  ```
  Read its text as `ChkFailTxtDesc.Value`. Do not set `Appearance`.
- `ChkFailDdSeverity` — `ModernDropdown`:
  ```yaml
  Items: =["Low", "Medium", "High", "Critical"]
  ItemDisplayText: =ThisItem.Value
  Default: =LookUp(["Low", "Medium", "High", "Critical"], Value = gblFailSeverity)
  Height: =44
  Width: =Parent.Width
  FillPortions: =0
  Size: =14
  Color: =RGBA(32, 31, 30, 1)
  AccessibleLabel: ="Chọn mức độ rủi ro"
  ```
  `Items` is a single-column table, so its rows have a `Value` field and no
  `ItemDisplayText` is needed. Read the choice as `ChkFailDdSeverity.Selected.Value`.
  Do **not** write an inline record literal such as `={Value: "Low"}` — the `Filter` form
  above avoids the YAML quoting trap entirely.
- `ChkFailCmbAssignee` — `ModernCombobox`:
  ```yaml
  Items: =colUsers
  ItemDisplayText: =ThisItem.Name
  DefaultSelectedItems: =Filter(colUsers, Name = gblFailAssigneeName)
  Height: =44
  Width: =Parent.Width
  FillPortions: =0
  Size: =14
  Color: =RGBA(32, 31, 30, 1)
  AccessibleLabel: ="Chọn người khắc phục"
  ```
  Read the choice as `ChkFailCmbAssignee.Selected.Name` and
  `ChkFailCmbAssignee.Selected.Email`.
- `ChkFailBtnRow` — `LayoutDirection: =LayoutDirection.Horizontal`,
  `LayoutAlignItems: =LayoutAlignItems.Center`,
  `LayoutJustifyContent: =LayoutJustifyContent.SpaceBetween`, `LayoutGap: =10`,
  `Height: =44`, `FillPortions: =0`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`,
  `PaddingTop/Bottom/Left/Right: =0`. Two children, both `FillPortions: =1`,
  `LayoutMinWidth: =100`, `Height: =44`. Budget at 320: 32 padding + 10 gap leaves 278 for
  two buttons, 139 each.

`ChkFailBtnCancel`:

```yaml
Text: ="Huỷ"
Appearance: =ButtonAppearance.Secondary
Color: =RGBA(32, 31, 30, 1)
Size: =14
FillPortions: =1
LayoutMinWidth: =100
Height: =44
AccessibleLabel: ="Đóng chi tiết lỗi"
OnSelect: |-
  =With(
      {row: LookUp(colChecklist, ItemId = gblCurrentItemId)},
      If(IsBlank(row.FailDesc), Patch(colChecklist, row, {Result: ""}))
  );
  Set(gblShowFailPanel, false)
```

Closing without a description returns the question to unanswered, so `IsAuditComplete`
stays honest and the radio clears itself (its `Default` is bound to `ThisItem.Result`).

`ChkFailBtnSave`:

```yaml
Text: ="Lưu lỗi"
Appearance: =ButtonAppearance.Primary
Color: =RGBA(255, 255, 255, 1)
Size: =14
FillPortions: =1
LayoutMinWidth: =100
Height: =44
AccessibleLabel: ="Lưu chi tiết lỗi"
BasePaletteColor: |-
  =If(
      IsBlank(Trim(ChkFailTxtDesc.Value))
          || IsBlank(ChkFailDdSeverity.Selected.Value)
          || IsBlank(ChkFailCmbAssignee.Selected.Name),
      RGBA(200, 203, 206, 1),
      RGBA(60, 74, 82, 1)
  )
DisplayMode: |-
  =If(
      IsBlank(Trim(ChkFailTxtDesc.Value))
          || IsBlank(ChkFailDdSeverity.Selected.Value)
          || IsBlank(ChkFailCmbAssignee.Selected.Name),
      DisplayMode.Disabled,
      DisplayMode.Edit
  )
OnSelect: |-
  =Patch(
      colChecklist,
      LookUp(colChecklist, ItemId = gblCurrentItemId),
      {
          Result: "Fail",
          FailDesc: Trim(ChkFailTxtDesc.Value),
          FailSeverity: ChkFailDdSeverity.Selected.Value,
          FailAssigneeName: ChkFailCmbAssignee.Selected.Name,
          FailAssigneeEmail: ChkFailCmbAssignee.Selected.Email
      }
  );
  Set(gblShowFailPanel, false);
  Notify("Đã lưu chi tiết lỗi.", NotificationType.Success, 2000)
```

Availability is derived entirely from the three current input values. There is no
"attempted" flag and no per-input `OnChange` validity bookkeeping on this panel.

### `ChkCamOverlay` — camera modal, screen-level

`GroupContainer` / `AutoLayout`, `X: =0`, `Y: =0`, `Width: =Parent.Width`,
`Height: =Parent.Height`, `Visible: =gblShowCamera`, `Fill: =RGBA(0, 0, 0, 0.55)`,
`LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Center`,
`LayoutJustifyContent: =LayoutJustifyContent.Center`, `LayoutGap: =0`,
`PaddingLeft: =16`, `PaddingRight: =16`, `PaddingTop: =0`, `PaddingBottom: =0`,
`LayoutMinWidth: =0`, `LayoutMinHeight: =0`.

`ChkCamPanel` — `GroupContainer` / `AutoLayout`, `Width: =Parent.Width * 0.88`,
`Height: =34 + (Parent.Width * 0.88 * 0.75) + 52`, `FillPortions: =0`,
`Fill: =RGBA(255, 255, 255, 1)`,
`RadiusTopLeft/TopRight/BottomLeft/BottomRight: =6`,
`LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutGap: =0`,
`PaddingTop/Bottom/Left/Right: =0`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`.

At 390 wide the panel is 343 wide and 343 + 34 + 52 x 0.75... concretely: caption 34 +
camera 257 (4:3 of 343) + close 52 = **343 tall**. At 320 wide: 281 wide, 211 camera, 297
tall. Both fit any phone viewport with the scrim visible around them.

- `ChkCamCaptionBar` — `GroupContainer` / `AutoLayout`, `Height: =34`,
  `Width: =Parent.Width`, `FillPortions: =0`, `Fill: =RGBA(238, 238, 239, 1)`,
  `LayoutDirection: =LayoutDirection.Horizontal`,
  `LayoutAlignItems: =LayoutAlignItems.Center`,
  `LayoutJustifyContent: =LayoutJustifyContent.Center`, `LayoutGap: =0`,
  `PaddingLeft: =8`, `PaddingRight: =8`, `PaddingTop: =0`, `PaddingBottom: =0`,
  `LayoutMinWidth: =0`, `LayoutMinHeight: =0`.
  - `ChkCamCaptionText` — `ModernText`,
    `Text: ="Click inside the frame to capture"`, `Size: =13`,
    `Color: =RGBA(32, 31, 30, 1)`, `Align: =Align.Center`,
    `VerticalAlign: =VerticalAlign.Middle`, `Wrap: =false`, `Height: =20`,
    `FillPortions: =0`, `PaddingTop: =0`, `PaddingBottom: =0`.
    **This caption stays in English, verbatim.** It is one of the three English strings the
    spec mandates.
- `ChkCamera` — `Camera`, `Width: =Parent.Width`, `Height: =Parent.Width * 0.75`,
  `FillPortions: =0`, `AccessibleLabel: ="Khung chụp ảnh - chạm để chụp"`,
  ```yaml
  OnSelect: |-
    =Patch(
        colChecklist,
        LookUp(colChecklist, ItemId = gblCurrentItemId),
        {FailPhoto: ChkCamera.Photo}
    );
    Set(gblShowCamera, false);
    Notify("Đã lưu ảnh cho câu hỏi này.", NotificationType.Success, 2000)
  ```
  `ChkCamera.Photo` holds the frame captured by this very `OnSelect`; that is the
  documented behaviour of the control and the reason the panel body itself is the shutter.
- `ChkCamBtnClose` — `ModernButton`, `Text: ="Đóng"`,
  `Appearance: =ButtonAppearance.Secondary`, `Color: =RGBA(32, 31, 30, 1)`, `Size: =14`,
  `Width: =Parent.Width`, `Height: =52`, `FillPortions: =0`,
  `AccessibleLabel: ="Đóng khung chụp ảnh"`, `OnSelect: =Set(gblShowCamera, false)`.

### Data binding

- `colChecklist` is the only mutable source on this screen. `ItemId` is the row key for
  every `Patch` and `LookUp` — never patch by position or by `Question` text.
- `colUsers` feeds the assignee combobox; the screen stores the flat `Name` and `Email`,
  not a record, so the column types stay stable.
- `colChecklist.Result` stores `"Pass"` / `"Fail"` / `"NA"`. The radio shows
  `"Yes"` / `"No"` / `"N/A"`. The mapping exists in exactly two places: `Default` and
  `OnChange` of `ChkRadioAnswer`.
- `FailPhoto` is the only image-typed column. Clear it only with
  `""`.
- The progress readout, the footer hint and the Submit availability all derive from
  `AnsweredCount`, `RemainingCount`, `TotalCount` and `IsAuditComplete` — the named
  formulas in `App.Formulas`. Do not recompute them locally and do not cache them.

### Navigation

- `ChkBtnSubmit` -> `scrReview`
- `ChkBtnBack` -> `Screen1` (state preserved)
- `ChkBtnCancel` -> `Screen1` after a two-tap confirm (state cleared)
- `ChkHeaderHome` -> `Screen1` per the shared App Header pattern

### State

`OnVisible` sets `gblHomeConfirm`, `gblCancelConfirm`, `gblShowFailPanel` and
`gblShowCamera` to `false`, so neither overlay can be open on arrival. Nothing else.

## Required Variants

| Control type | Variant |
|---|---|
| `GroupContainer` | `AutoLayout` |
| `Gallery` | `Vertical` |

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
`LayoutAlignItems.Stretch`, `LayoutAlignItems.Center`, `LayoutAlignItems.Start`,
`LayoutJustifyContent.Start`, `LayoutJustifyContent.Center`,
`LayoutJustifyContent.End`, `LayoutJustifyContent.SpaceBetween`,
`LayoutOverflow.Scroll`, `LayoutOverflow.Hidden`,
`AlignInContainer.Stretch`, `AlignInContainer.Center`,
`BorderStyle.Solid`, `BorderStyle.None`,
`DisplayMode.Edit`, `DisplayMode.View`, `DisplayMode.Disabled`.

`GroupContainer` has no `OnSelect`.

### `Gallery` (Variant `Vertical`)

`Items`, `TemplateSize`, `TemplatePadding`, `Default`, `Selectable`, `ShowScrollbar`,
`ShowNavigation`, `DelayItemLoading`, `LoadingSpinner`, `TabIndex`, `Fill`, `Width`,
`Height`, `X`, `Y`, `Visible`, `DisplayMode`, `AccessibleLabel`, `OnSelect`,
`FillPortions`, `AlignInContainer`, `LayoutMinWidth`, `LayoutMinHeight`.

Output properties used: `Self.AllItemsCount`, `Self.TemplateHeight`,
`Self.TemplatePadding`; and on the single direct child, `Parent.TemplateWidth` and
`Parent.TemplateHeight`.

`Gallery` has `Fill` but **no** text properties. Style text on the controls inside the row.

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

### `ModernRadio`

`Items`, `Default`, `Layout`, `OnChange`, `OnSelect`, `Color`, `Size`, `FontWeight`,
`BasePaletteColor`, `Width`, `Height`, `X`, `Y`, `Visible`, `DisplayMode`,
`AccessibleLabel`, `FillPortions`, `AlignInContainer`, `LayoutMinWidth`,
`LayoutMinHeight`.

Output property: `Selected` — for a single-column `Items` table, read
`ChkRadioAnswer.Selected.Value`.

Enum name for `Layout` is **`Layout`**.
Compile-ready literals: `Layout.Horizontal`, `Layout.Vertical`.
This screen sets `Layout: =Layout.Horizontal`.

### `ModernTextInput`

`Default`, `Mode`, `MaxLength`, `OnChange`, `Appearance`, `Color`, `Size`, `FontWeight`,
`BasePaletteColor`, `Width`, `Height`, `X`, `Y`, `Visible`, `DisplayMode`,
`AccessibleLabel`, `FillPortions`, `AlignInContainer`, `LayoutMinWidth`,
`LayoutMinHeight`.

Output property: `Value` (the current text). `Default` is the input property; `Value` is
the output. Never bind `Default` to `Self.Value`.

Enum name for `Type` is **`TextInputType`** (there is no `Mode` property).
Compile-ready literals: `TextInputType.SingleLine`, `TextInputType.Multiline`, `TextInputType.Password`, `TextInputType.Search`.
This screen sets `Type: =TextInputType.Multiline` on `ChkFailTxtDesc`.
This screen does **not** set `Appearance` — leave it off.

### `ModernDropdown`

`Items`, `ItemDisplayText`, `DefaultSelectedItems`, `OnChange`, `OnSelect`, `Color`,
`Size`, `FontWeight`, `BasePaletteColor`, `Appearance`, `Width`, `Height`, `X`, `Y`,
`Visible`, `DisplayMode`, `AccessibleLabel`, `FillPortions`, `AlignInContainer`,
`LayoutMinWidth`, `LayoutMinHeight`.

Output property: `Selected`. `ItemDisplayText` is a per-row formula with `ThisItem` in
scope. This screen does not set `Appearance`.

### `ModernCombobox`

`Items`, `ItemDisplayText`, `DefaultSelectedItems`, `OnChange`, `OnSelect`, `Color`,
`Size`, `FontWeight`, `BasePaletteColor`, `Appearance`, `Width`, `Height`, `X`, `Y`,
`Visible`, `DisplayMode`, `AccessibleLabel`, `FillPortions`, `AlignInContainer`,
`LayoutMinWidth`, `LayoutMinHeight`.

Output property: `Selected` (a record of the `Items` row shape — here a `colUsers` row, so
`.Name` and `.Email` are available). `ItemDisplayText` is a per-row formula with `ThisItem`
in scope. This screen does not set `Appearance` and does not enable multi-select.

### `Classic/Icon`

`Icon`, `Color`, `Fill`, `OnSelect`, `Width`, `Height`, `X`, `Y`, `Visible`,
`DisplayMode`, `AccessibleLabel`, `Tooltip`, `Rotation`, `Transparency`, `BorderColor`,
`BorderStyle`, `BorderThickness`, `PaddingTop`, `PaddingBottom`, `PaddingLeft`,
`PaddingRight`, `FillPortions`, `AlignInContainer`, `LayoutMinWidth`, `LayoutMinHeight`.

Compile-ready enum literals used on this screen: `Icon.Home`, `Icon.Camera`, `Icon.Edit`,
`Icon.Cancel`.

### `Image`

`Image`, `ImagePosition`, `Width`, `Height`, `X`, `Y`, `Fill`, `Transparency`,
`RadiusTopLeft`, `RadiusTopRight`, `RadiusBottomLeft`, `RadiusBottomRight`,
`BorderColor`, `BorderStyle`, `BorderThickness`, `Visible`, `DisplayMode`, `OnSelect`,
`AccessibleLabel`, `PaddingTop`, `PaddingBottom`, `PaddingLeft`, `PaddingRight`,
`FillPortions`, `AlignInContainer`, `LayoutMinWidth`, `LayoutMinHeight`.

Compile-ready enum literals: `ImagePosition.Fill`, `ImagePosition.Fit`,
`ImagePosition.Stretch`, `ImagePosition.Tile`, `ImagePosition.Center`.

### `Camera`

`OnSelect`, `Camera`, `Brightness`, `Contrast`, `Zoom`, `StreamRate`, `Width`, `Height`,
`X`, `Y`, `Visible`, `DisplayMode`, `AccessibleLabel`, `FillPortions`,
`AlignInContainer`, `LayoutMinWidth`, `LayoutMinHeight`.

Output properties: `Photo` (the last captured still) and `Stream`. Read `ChkCamera.Photo`
inside `ChkCamera.OnSelect`.
