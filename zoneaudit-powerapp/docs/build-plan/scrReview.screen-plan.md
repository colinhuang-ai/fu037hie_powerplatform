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

# Screen Plan: Review

Read `canvas-app-shared.md` first — palette, typography, the App Header pattern, the
`colChecklist` / `colSubmitted` schemas, named formulas and YAML conventions live there and
are not repeated here.

## Assignment

- Action: Create
- Target file: `D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\scrReview.pa.yaml`
- YAML key: `scrReview`
- Control name prefix: `Rev`

## Specification

### Purpose

Show the compliance score and the recorded failures so the auditor can check the run before
it is sent, take a general note, and perform the **real** submit. This is the only screen
that writes `colSubmitted` and the only screen that clears `colChecklist` on success.

### Screen properties

```yaml
Screens:
  scrReview:
    Properties:
      Fill: =RGBA(255, 255, 255, 1)
      OnVisible: |-
        =Set(gblHomeConfirm, false);
        Set(gblSubmitting, false)
    Children:
      - RevRoot: ...
```

The screen-level `Children:` list contains **only** `RevRoot`.

Resetting `gblSubmitting` to `false` on entry is deliberate: if a previous submit attempt
left the lock set, navigating back here must not leave the button permanently dead.

### Layout

`RevRoot` — `GroupContainer` / `AutoLayout`, the scrolling root:
`LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`,
`LayoutOverflowY: =LayoutOverflow.Scroll`, `LayoutGap: =0`, `LayoutMinWidth: =0`,
`LayoutMinHeight: =0`, `Width: =Parent.Width`, `Height: =Parent.Height`,
`Fill: =RGBA(255, 255, 255, 1)`.

Direct children, every one `FillPortions: =0`:

| # | Child | Height |
|---|---|---|
| 1 | `RevHeader` (App Header pattern, prefix `Rev`) | `=64` |
| 2 | `RevScoreCard` | `=140` |
| 3 | `RevKpiRow` | `=78` |
| 4 | `RevLblFailHeading` | `=28` |
| 5 | `RevLblNoFail` | `=40` |
| 6 | `RevGalFailures` | gallery formula below |
| 7 | `RevNotes` | `=140` |
| 8 | `RevFooter` | `=80` |

With two failures the screen is 64 + 140 + 78 + 28 + 40 + 336 + 140 + 80 = 906px, so the
root scrolls. That is expected.

#### `RevScoreCard` — vertical budget 140

`GroupContainer` / `AutoLayout`, `LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutGap: =6`,
`PaddingTop: =16`, `PaddingBottom: =16`, `PaddingLeft: =16`, `PaddingRight: =16`,
`Width: =Parent.Width`, `Height: =140`, `FillPortions: =0`,
`Fill: =RGBA(244, 245, 247, 1)`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`.

Budget: 16 + 16 + 6 + 56 + 6 + 18 + 16 = 134 within 140.

- `RevLblScoreCaption` — `ModernText`, `Text: ="Điểm tuân thủ"`, `Size: =12`,
  `Color: =RGBA(120, 120, 125, 1)`, `Align: =Align.Center`, `Height: =16`,
  `Wrap: =false`, `FillPortions: =0`, `PaddingTop: =0`, `PaddingBottom: =0`.
- `RevLblScore` — `ModernText`, `Size: =44`, `FontWeight: =FontWeight.Bold`,
  `Align: =Align.Center`, `VerticalAlign: =VerticalAlign.Middle`, `Height: =56`,
  `Wrap: =false`, `FillPortions: =0`, `PaddingTop: =0`, `PaddingBottom: =0`,
  ```yaml
  Text: =Text(ComplianceScore, "[$-en-US]0.0") & "%"
  Color: |-
    =If(
        ComplianceScore >= 90, RGBA(14, 116, 60, 1),
        ComplianceScore >= 75, RGBA(224, 164, 10, 1),
        RGBA(184, 37, 30, 1)
    )
  ```
  `"100.0%"` at Size 44 is about 150px wide — well inside the 288px minimum content width,
  so `Wrap: =false` cannot clip it.
- `RevLblZone` — `ModernText`, `Text: =gblZone.Title & " • " & gblTemplate.Title`,
  `Size: =13`, `Color: =RGBA(120, 120, 125, 1)`, `Align: =Align.Center`, `Height: =18`,
  `Wrap: =false`, `FillPortions: =0`, `PaddingTop: =0`, `PaddingBottom: =0`.

#### `RevKpiRow` — horizontal budget 78

`GroupContainer` / `AutoLayout`, `LayoutDirection: =LayoutDirection.Horizontal`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`,
`LayoutJustifyContent: =LayoutJustifyContent.SpaceBetween`, `LayoutGap: =10`,
`PaddingTop: =0`, `PaddingBottom: =12`, `PaddingLeft: =16`, `PaddingRight: =16`,
`Width: =Parent.Width`, `Height: =78`, `FillPortions: =0`,
`Fill: =RGBA(255, 255, 255, 1)`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`.

Three tiles, identical shape, each `FillPortions: =1`, `LayoutMinWidth: =84`,
`Height: =66`:

| Tile | Value formula | Caption | Value colour |
|---|---|---|---|
| `RevKpiPass` | `=PassCount` | `="Đạt"` | `RGBA(14, 116, 60, 1)` |
| `RevKpiFail` | `=FailCount` | `="Lỗi"` | `RGBA(184, 37, 30, 1)` |
| `RevKpiNa` | `=NACount` | `="N/A"` | `RGBA(134, 137, 143, 1)` |

Width budget at 320: 32 padding + 3 x 84 + 2 x 10 = 304 <= 320. At 390 each tile is 112.
Three children in one row, no wrap, no breakpoint branch.

Each tile is a `GroupContainer` / `AutoLayout`:
`LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`,
`LayoutJustifyContent: =LayoutJustifyContent.Center`, `LayoutGap: =4`,
`PaddingTop: =8`, `PaddingBottom: =8`, `PaddingLeft: =4`, `PaddingRight: =4`,
`Fill: =RGBA(244, 245, 247, 1)`,
`RadiusTopLeft/TopRight/BottomLeft/BottomRight: =6`, `LayoutMinWidth: =84`,
`LayoutMinHeight: =0`, `FillPortions: =1`, `Height: =66`.

Tile children (budget 8 + 30 + 4 + 16 + 8 = 66):

- value — `ModernText`, `Size: =22`, `FontWeight: =FontWeight.Bold`,
  `Align: =Align.Center`, `Height: =30`, `Wrap: =false`, `FillPortions: =0`,
  `PaddingTop: =0`, `PaddingBottom: =0`. Names: `RevLblPassValue`, `RevLblFailValue`,
  `RevLblNaValue`. `Text` must coerce the number to text — write
  `Text: =PassCount & ""` (and the same shape for the other two).
- caption — `ModernText`, `Size: =12`, `Color: =RGBA(120, 120, 125, 1)`,
  `Align: =Align.Center`, `Height: =16`, `Wrap: =false`, `FillPortions: =0`,
  `PaddingTop: =0`, `PaddingBottom: =0`. Names: `RevLblPassCaption`,
  `RevLblFailCaption`, `RevLblNaCaption`.

#### Failure list

- `RevLblFailHeading` — `ModernText`,
  `Text: ="Các lỗi đã ghi nhận (" & FailCount & ")"`, `Size: =14`,
  `FontWeight: =FontWeight.Semibold`, `Color: =RGBA(32, 31, 30, 1)`, `Height: =28`,
  `Wrap: =false`, `PaddingLeft: =16`, `PaddingTop: =0`, `PaddingBottom: =0`,
  `FillPortions: =0`, `AlignInContainer: =AlignInContainer.Stretch`.
- `RevLblNoFail` — `ModernText`,
  `Text: ="Không có lỗi nào được ghi nhận."`, `Size: =13`,
  `Color: =RGBA(120, 120, 125, 1)`, `Align: =Align.Center`,
  `VerticalAlign: =VerticalAlign.Middle`, `Height: =40`, `Wrap: =false`,
  `FillPortions: =0`, `Visible: =FailCount = 0`, `PaddingTop: =0`, `PaddingBottom: =0`.
- `RevGalFailures` — `Gallery`, `Variant: Vertical`:

  ```yaml
  Items: =FailList
  TemplateSize: =156
  TemplatePadding: =8
  Width: =Parent.Width
  Height: =Self.AllItemsCount * Self.TemplateHeight + ((Self.AllItemsCount + 1) * Self.TemplatePadding)
  FillPortions: =0
  Fill: =RGBA(244, 245, 247, 1)
  ShowScrollbar: =false
  Selectable: =false
  TabIndex: =0
  AccessibleLabel: ="Danh sách lỗi đã ghi nhận"
  ```

  With zero failures the height formula evaluates to 8px, and `RevLblNoFail` carries the
  empty state. Do not add a `Visible` formula to the gallery.

Exactly one direct child, `RevRowShell` — `GroupContainer` / `AutoLayout`:

```
Width                =Parent.TemplateWidth
Height               =Parent.TemplateHeight
LayoutDirection      =LayoutDirection.Horizontal
LayoutAlignItems     =LayoutAlignItems.Start
LayoutJustifyContent =LayoutJustifyContent.Start
LayoutGap            =10
PaddingTop           =12
PaddingBottom        =12
PaddingLeft          =16
PaddingRight         =16
LayoutMinWidth       =0
LayoutMinHeight      =0
Fill                 =RGBA(255, 255, 255, 1)
RadiusTopLeft        =6   (all four corners)
```

Row budget at 320: inner width 288, minus the 72px thumbnail and the 10px gap leaves 206
for the text column. At 390 it leaves 276. Two children only.

| Child | Width | FillPortions |
|---|---|---|
| `RevRowText` | flexible, `LayoutMinWidth: =0` | `=1` |
| `RevImgFailPhoto` | `=72` | `=0` |

`RevRowText` — `GroupContainer` / `AutoLayout`,
`LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutGap: =6`,
`Height: =Parent.Height - 24`, `FillPortions: =1`, `LayoutMinWidth: =0`,
`LayoutMinHeight: =0`, `PaddingTop/Bottom/Left/Right: =0`,
`Fill: =RGBA(255, 255, 255, 1)`.

Vertical budget inside the text column: 36 + 6 + 24 + 6 + 32 + 6 + 18 = 128, within the
132 available (156 template − 24 padding). Children, all `FillPortions: =0`:

- `RevLblFailQ` — `ModernText`, `Text: =ThisItem.Question`, `Size: =13`,
  `FontWeight: =FontWeight.Semibold`, `Color: =RGBA(32, 31, 30, 1)`, `Wrap: =true`,
  `Height: =36`, `PaddingTop: =0`, `PaddingBottom: =0`,
  `VerticalAlign: =VerticalAlign.Top`.
- `RevBadgeSeverity` — `Badge`:
  ```yaml
  Content: =ThisItem.FailSeverity
  Appearance: ='BadgeCanvas.Appearance'.Tint
  Shape: ='BadgeCanvas.Shape'.Rounded
  ThemeColor: |-
    =Switch(
        ThisItem.FailSeverity,
        "Critical", 'BadgeCanvas.ThemeColor'.Danger,
        "High",     'BadgeCanvas.ThemeColor'.Severe,
        "Medium",   'BadgeCanvas.ThemeColor'.Warning,
        'BadgeCanvas.ThemeColor'.Informative
    )
  FontColor: |-
    =Switch(
        ThisItem.FailSeverity,
        "Critical", RGBA(140, 25, 32, 1),
        "High",     RGBA(198, 86, 17, 1),
        "Medium",   RGBA(224, 164, 10, 1),
        RGBA(11, 106, 190, 1)
    )
  FontSize: =12
  Width: =96
  Height: =24
  FillPortions: =0
  AlignInContainer: =AlignInContainer.Start
  AccessibleLabel: ="Mức độ rủi ro"
  ```
  `Content` is the visible string — it is **required**. Without it the badge renders
  placeholder text. `Width: =96` fits the longest value, `"Critical"`, at FontSize 12.
  `Badge` spells its text properties `FontColor` and `FontSize`, not `Color` and `Size`,
  and it has no `Fill`.
- `RevLblFailDesc` — `ModernText`, `Text: =ThisItem.FailDesc`, `Size: =12`,
  `Color: =RGBA(120, 120, 125, 1)`, `Wrap: =true`, `Height: =32`, `PaddingTop: =0`,
  `PaddingBottom: =0`, `VerticalAlign: =VerticalAlign.Top`.
- `RevLblAssignee` — `ModernText`,
  `Text: ="Giao cho " & ThisItem.FailAssigneeName`, `Size: =12`,
  `Color: =RGBA(60, 74, 82, 1)`, `FontWeight: =FontWeight.Semibold`, `Wrap: =false`,
  `Height: =18`, `PaddingTop: =0`, `PaddingBottom: =0`.

`RevImgFailPhoto` — `Image`, `Image: =ThisItem.FailPhoto`, `Width: =72`, `Height: =72`,
`FillPortions: =0`, `Visible: =!IsBlank(ThisItem.FailPhoto)`,
`ImagePosition: =ImagePosition.Fill`,
`RadiusTopLeft/TopRight/BottomLeft/BottomRight: =2`,
`BorderColor: =RGBA(214, 214, 214, 1)`, `BorderStyle: =BorderStyle.Solid`,
`BorderThickness: =1`, `AlignInContainer: =AlignInContainer.Start`,
`AccessibleLabel: ="Ảnh của lỗi này"`.

#### `RevNotes` — vertical budget 140

`GroupContainer` / `AutoLayout`, `LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutGap: =6`, `PaddingTop: =12`,
`PaddingBottom: =12`, `PaddingLeft: =16`, `PaddingRight: =16`, `Width: =Parent.Width`,
`Height: =140`, `FillPortions: =0`, `Fill: =RGBA(255, 255, 255, 1)`,
`LayoutMinWidth: =0`, `LayoutMinHeight: =0`. Budget 12 + 16 + 6 + 90 + 12 = 136.

- `RevLblNotes` — `ModernText`, `Text: ="Ghi chú chung"`, `Size: =12`,
  `Color: =RGBA(120, 120, 125, 1)`, `Height: =16`, `Wrap: =false`, `FillPortions: =0`,
  `PaddingTop: =0`, `PaddingBottom: =0`.
- `RevTxtNotes` — `ModernTextInput`, `Default: =""`, `Type: =TextInputType.Multiline`,
  `Height: =90`, `Width: =Parent.Width`, `FillPortions: =0`, `Size: =14`,
  `Color: =RGBA(32, 31, 30, 1)`, `AccessibleLabel: ="Ghi chú chung cho lượt kiểm tra"`.
  Read it as `RevTxtNotes.Value`. Do not set `Appearance`.

#### `RevFooter` — horizontal budget 80

`GroupContainer` / `AutoLayout`, `LayoutDirection: =LayoutDirection.Horizontal`,
`LayoutAlignItems: =LayoutAlignItems.Center`,
`LayoutJustifyContent: =LayoutJustifyContent.SpaceBetween`, `LayoutGap: =10`,
`PaddingTop: =8`, `PaddingBottom: =20`, `PaddingLeft: =16`, `PaddingRight: =16`,
`Width: =Parent.Width`, `Height: =80`, `FillPortions: =0`,
`Fill: =RGBA(255, 255, 255, 1)`, `BorderColor: =RGBA(214, 214, 214, 1)`,
`BorderStyle: =BorderStyle.Solid`, `BorderThickness: =1`, `LayoutMinWidth: =0`,
`LayoutMinHeight: =0`.

| Child | Width | FillPortions |
|---|---|---|
| `RevBtnBack` | `=124` | `=0` |
| `RevBtnSubmit` | `LayoutMinWidth: =140` | `=1` |

Budget at 320: 32 + 124 + 10 = 166; Submit gets 154, above its 140 minimum. At 390 Submit
gets 224. `"Đang gửi…"` and `"Gửi audit"` both fit 140 at Size 14.

`RevBtnBack`:

```yaml
Text: ="‹ Quay lại"
Appearance: =ButtonAppearance.Secondary
Color: =RGBA(32, 31, 30, 1)
Size: =14
Width: =124
Height: =44
FillPortions: =0
AccessibleLabel: ="Quay lại danh sách câu hỏi"
OnSelect: =Navigate(scrChecklist, ScreenTransition.Fade)
```

`RevBtnSubmit` — the real submit:

```yaml
Appearance: =ButtonAppearance.Primary
Color: =RGBA(255, 255, 255, 1)
Size: =14
Height: =44
FillPortions: =1
LayoutMinWidth: =140
AccessibleLabel: ="Gửi kết quả kiểm tra"
Text: =If(gblSubmitting, "Đang gửi…", "Gửi audit")
BasePaletteColor: |-
  =If(
      gblSubmitting || !IsAuditComplete,
      RGBA(200, 203, 206, 1),
      RGBA(60, 74, 82, 1)
  )
DisplayMode: |-
  =If(
      gblSubmitting || !IsAuditComplete,
      DisplayMode.Disabled,
      DisplayMode.Edit
  )
OnSelect: |-
  =If(
      gblSubmitting,
      Notify("Đang gửi, vui lòng đợi…", NotificationType.Warning, 2000),
      Set(gblSubmitting, true);
      With(
          {
              runScore: ComplianceScore,
              runPass: PassCount,
              runFail: FailCount,
              runNa: NACount,
              runTotal: TotalCount
          },
          ClearCollect(
              colSubmitted,
              {
                  RunId: Text(Now(), "yyyymmddhhmmss"),
                  ZoneTitle: gblZone.Title,
                  ZoneCode: gblZone.ZoneCode,
                  TemplateTitle: gblTemplate.Title,
                  SubmittedAt: Now(),
                  RunScore: runScore,
                  RunPassCount: runPass,
                  RunFailCount: runFail,
                  RunNACount: runNa,
                  RunTotalItems: runTotal,
                  GeneralNotes: Trim(RevTxtNotes.Value)
              }
          );
          Notify(
              "Đã gửi audit. Điểm " & Text(runScore, "[$-en-US]0.0") & "% — " & runFail & " lỗi cần khắc phục.",
              NotificationType.Success,
              4000
          )
      );
      Clear(colChecklist);
      Set(gblSubmitting, false);
      Navigate(scrDone, ScreenTransition.Fade)
  )
```

Four things here are load-bearing:

1. **`gblSubmitting` is the double-tap guard.** The `If` reads it first and the button's
   `DisplayMode` also reads it, so a second tap during the write is inert either way.
2. **The score and counts are snapshotted once, inside `With`, before anything is
   cleared**, and the same `runScore` / `runFail` values feed both the `colSubmitted`
   record and the `Notify` text. Do not read `ComplianceScore` again after the write — by
   then `colChecklist` is empty and it would report 100.
3. **`Clear(colChecklist)` runs strictly after the `ClearCollect` that writes
   `colSubmitted`.** Never move it earlier. Losing a half-hour walk-around because the
   clear ran first is the single worst failure this screen can have.
4. `Notify` fires on success, before navigation.

`ClearCollect(colSubmitted, ...)` writes exactly one row and the field names must match the
`colSubmitted` schema seeded in `App.OnStart` exactly — `RunScore`, `RunPassCount`,
`RunFailCount`, `RunNACount`, `RunTotalItems`, not `Score` / `PassCount` / `FailCount`.
Those shorter names are **named formulas** and reusing them as column names invites a
resolution clash.

### Data binding

- `ComplianceScore`, `PassCount`, `FailCount`, `NACount`, `FailList`, `TotalCount` and
  `IsAuditComplete` are named formulas in `App.Formulas`. Read them directly; never
  recompute the score on this screen and never store it in a variable before submit.
- N/A rows are excluded from the score denominator — that rule lives inside
  `ComplianceScore` and must not be duplicated here.
- `FailList` rows are `colChecklist` rows, so `ThisItem` exposes `Question`, `FailDesc`,
  `FailSeverity`, `FailAssigneeName`, `FailAssigneeEmail` and `FailPhoto`.
- `gblZone` and `gblTemplate` were set by `Screen1`; they are read-only here.
- `colSubmitted` is written here and read by `scrDone`.

### Navigation

- `RevBtnBack` -> `scrChecklist`
- `RevBtnSubmit` -> `scrDone` after a successful write
- `RevHeaderHome` -> `Screen1` per the shared App Header pattern

### State

`OnVisible` sets `gblHomeConfirm` and `gblSubmitting` to `false`. Nothing else.

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
`AlignInContainer.Stretch`, `AlignInContainer.Start`, `AlignInContainer.Center`,
`BorderStyle.Solid`, `BorderStyle.None`,
`DisplayMode.Edit`, `DisplayMode.View`, `DisplayMode.Disabled`.

`GroupContainer` has no `OnSelect`.

### `Gallery` (Variant `Vertical`)

`Items`, `TemplateSize`, `TemplatePadding`, `Default`, `Selectable`, `ShowScrollbar`,
`ShowNavigation`, `DelayItemLoading`, `LoadingSpinner`, `TabIndex`, `Fill`, `Width`,
`Height`, `X`, `Y`, `Visible`, `DisplayMode`, `AccessibleLabel`, `OnSelect`,
`FillPortions`, `AlignInContainer`, `LayoutMinWidth`, `LayoutMinHeight`.

Outputs used: `Self.AllItemsCount`, `Self.TemplateHeight`, `Self.TemplatePadding`; and on
the single direct child, `Parent.TemplateWidth` / `Parent.TemplateHeight`.

### `ModernText`

`Text`, `Color`, `Size`, `FontWeight`, `Align`, `VerticalAlign`, `Wrap`, `AutoHeight`,
`Width`, `Height`, `X`, `Y`, `Visible`, `DisplayMode`, `AccessibleLabel`, `PaddingTop`,
`PaddingBottom`, `PaddingLeft`, `PaddingRight`, `FillPortions`, `AlignInContainer`,
`LayoutMinWidth`, `LayoutMinHeight`.

Enum literals: `FontWeight.Normal`, `FontWeight.Semibold`, `FontWeight.Bold`,
`Align.Left`, `Align.Center`, `Align.Right`,
`VerticalAlign.Top`, `VerticalAlign.Middle`, `VerticalAlign.Bottom`.

Colour is `Color`, size is `Size`.

### `ModernButton`

`Text`, `OnSelect`, `Appearance`, `BasePaletteColor`, `Color`, `Size`, `FontWeight`,
`DisplayMode`, `Visible`, `Width`, `Height`, `X`, `Y`, `AccessibleLabel`,
`AlignInContainer`, `FillPortions`, `LayoutMinWidth`, `LayoutMinHeight`,
`RadiusTopLeft`, `RadiusTopRight`, `RadiusBottomLeft`, `RadiusBottomRight`.

Enum name for `Appearance` is **`ButtonAppearance`**.
Literals: `ButtonAppearance.Primary`, `ButtonAppearance.Secondary`,
`ButtonAppearance.Outline`, `ButtonAppearance.Subtle`, `ButtonAppearance.Transparent`.
Do not set `Fill`.

### `ModernTextInput`

`Default`, `Mode`, `MaxLength`, `OnChange`, `Appearance`, `Color`, `Size`, `FontWeight`,
`BasePaletteColor`, `Width`, `Height`, `X`, `Y`, `Visible`, `DisplayMode`,
`AccessibleLabel`, `FillPortions`, `AlignInContainer`, `LayoutMinWidth`,
`LayoutMinHeight`.

Output property: `Value`.
Enum name for `Type` is **`TextInputType`** (there is no `Mode` property).
Compile-ready literals: `TextInputType.SingleLine`, `TextInputType.Multiline`, `TextInputType.Password`, `TextInputType.Search`.
This screen sets `Type: =TextInputType.Multiline` and does **not** set `Appearance`.

### `Badge`

`Content`, `Appearance`, `Shape`, `ThemeColor`, `FontColor`, `FontSize`, `Icon`,
`Width`, `Height`, `X`, `Y`, `Visible`, `DisplayMode`, `AccessibleLabel`,
`FillPortions`, `AlignInContainer`, `LayoutMinWidth`, `LayoutMinHeight`.

`Badge` has **no** `Fill`, **no** `Color`, **no** `Size` and **no** radius properties.
Its visible string is `Content`; its text colour is `FontColor`; its font size is
`FontSize`.

Enum names contain a dot, so the **name** is single-quoted and the member is appended
plain. Compile-ready literals for every enum this screen sets:

- `Appearance: ='BadgeCanvas.Appearance'.Tint`
  (also available: `.Filled`, `.Ghost`, `.Outline`)
- `Shape: ='BadgeCanvas.Shape'.Rounded`
  (also available: `.Circular`, `.Square`)
- `ThemeColor: ='BadgeCanvas.ThemeColor'.Danger`
  (also available: `.Brand`, `.Important`, `.Informative`, `.Severe`, `.Subtle`,
  `.Success`, `.Warning`)

### `Image`

`Image`, `ImagePosition`, `Width`, `Height`, `X`, `Y`, `Fill`, `Transparency`,
`RadiusTopLeft`, `RadiusTopRight`, `RadiusBottomLeft`, `RadiusBottomRight`,
`BorderColor`, `BorderStyle`, `BorderThickness`, `Visible`, `DisplayMode`, `OnSelect`,
`AccessibleLabel`, `PaddingTop`, `PaddingBottom`, `PaddingLeft`, `PaddingRight`,
`FillPortions`, `AlignInContainer`, `LayoutMinWidth`, `LayoutMinHeight`.

Compile-ready enum literals: `ImagePosition.Fill`, `ImagePosition.Fit`,
`ImagePosition.Stretch`, `ImagePosition.Tile`, `ImagePosition.Center`.

### `Classic/Icon`

`Icon`, `Color`, `Fill`, `OnSelect`, `Width`, `Height`, `X`, `Y`, `Visible`,
`DisplayMode`, `AccessibleLabel`, `Tooltip`, `Rotation`, `Transparency`, `BorderColor`,
`BorderStyle`, `BorderThickness`, `PaddingTop`, `PaddingBottom`, `PaddingLeft`,
`PaddingRight`, `FillPortions`, `AlignInContainer`, `LayoutMinWidth`, `LayoutMinHeight`.

Compile-ready enum literal used on this screen: `Icon.Home`.
