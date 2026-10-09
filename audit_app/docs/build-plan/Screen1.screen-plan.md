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

# Screen Plan: Site Inspection (scrSiteSelect)

Read `canvas-app-shared.md` first — palette, typography, the App Header pattern, named
state and YAML conventions live there and are not repeated here.

## Assignment

- Action: Create
- Target file: `D:\Training\2026-08_1dataplatform_hieu\audit_app\auditor-app\Screen1.pa.yaml`
- YAML key: `Screen1`
- Control name prefix: `Site`

This file already exists as the blank default screen. **Replace its contents wholesale and
keep the top-level key `Screen1`.**

## Specification

### Purpose

The auditor picks the production zone and the checklist template, confirms the zone's
address and description, then starts the survey. Nothing else happens on this screen.

### Screen properties

```yaml
Screens:
  Screen1:
    Properties:
      Fill: =RGBA(255, 255, 255, 1)
      OnVisible: |-
        =Set(gblHomeConfirm, false);
        Set(gblCancelConfirm, false)
    Children:
      - SiteRoot: ...
```

The screen-level `Children:` list contains **only** `SiteRoot`.

### Layout

`SiteRoot` — `GroupContainer` / `AutoLayout`, the scrolling root.

```
LayoutDirection      =LayoutDirection.Vertical
LayoutAlignItems     =LayoutAlignItems.Stretch
LayoutOverflowY      =LayoutOverflow.Scroll
LayoutGap            =0
LayoutMinWidth       =0
LayoutMinHeight      =0
Width                =Parent.Width
Height               =Parent.Height
Fill                 =RGBA(255, 255, 255, 1)
```

Three direct children, each `FillPortions: =0` with an explicit `Height`:

| # | Child | Height |
|---|---|---|
| 1 | `SiteHeader` (App Header pattern, prefix `Site`) | 64 |
| 2 | `SiteBody` | 568 |
| 3 | `SiteFooterRule` | 1 |
| 4 | `SiteFooter` | 76 |

Total 709px. On any phone shorter than that the root scrolls.

#### `SiteBody` vertical budget (this is the whole screen's layout budget)

`GroupContainer` / `AutoLayout`, `LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutGap: =14`,
`PaddingTop/Bottom/Left/Right: =16`, `Width: =Parent.Width`, `Height: =568`,
`FillPortions: =0`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`,
`Fill: =RGBA(255, 255, 255, 1)`.

| Child | Height | Notes |
|---|---|---|
| `SiteZoneImageBox` | 150 | grey placeholder block |
| `SiteFldZone` | 66 | label 16 + gap 6 + dropdown 44 |
| `SiteFldAddress` | 66 | label 16 + gap 6 + box 44 |
| `SiteFldDesc` | 132 | label 16 + gap 6 + box 110 |
| `SiteFldTemplate` | 66 | label 16 + gap 6 + dropdown 44 |

480 children + 4 gaps x 14 = 56 + 32 padding = **568**. Every child sets
`FillPortions: =0`.

Available inner width at 390: 390 - 32 = 358. At 320: 288. Every child is full width
(`Width: =Parent.Width`), so nothing can overflow horizontally. Nothing on this screen is a
multi-child horizontal row except the footer, budgeted below.

#### Field group pattern (`SiteFldZone`, `SiteFldAddress`, `SiteFldDesc`, `SiteFldTemplate`)

Each is a `GroupContainer` / `AutoLayout` holding **its own label and its own input**, so
the pair can never be separated:

```
LayoutDirection   =LayoutDirection.Vertical
LayoutAlignItems  =LayoutAlignItems.Stretch
LayoutGap         =6
LayoutMinWidth    =0
LayoutMinHeight   =0
Width             =Parent.Width
FillPortions      =0
Height            (66 / 66 / 132 / 66 as above)
```

Label child: `ModernText`, `Size: =12`, `Color: =RGBA(120, 120, 125, 1)`, `Height: =16`,
`PaddingTop: =0`, `PaddingBottom: =0`, `Wrap: =false`, `Align: =Align.Left`,
`FillPortions: =0`.

#### `SiteFooter` horizontal budget

`GroupContainer` / `AutoLayout`, `LayoutDirection: =LayoutDirection.Horizontal`,
`LayoutJustifyContent: =LayoutJustifyContent.End`, `LayoutAlignItems: =LayoutAlignItems.Center`,
`LayoutGap: =12`, `PaddingLeft: =16`, `PaddingRight: =16`, `PaddingTop: =12`,
`PaddingBottom: =20`, `Height: =76`, `Width: =Parent.Width`, `FillPortions: =0`,
`LayoutMinWidth: =0`, `LayoutMinHeight: =0`, `Fill: =RGBA(255, 255, 255, 1)`.

Two children only, both `FillPortions: =0`, both `Height: =44`:

| Child | Width |
|---|---|
| `SiteBtnCancel` | 110 |
| `SiteBtnSurvey` | 140 |

Budget at 320: 16 + 110 + 12 + 140 + 16 = **294 <= 320**. Fits without reflow; no
breakpoint branch is needed and none should be added.

`SiteFooterRule` is a 1px `GroupContainer` / `AutoLayout`,
`Fill: =RGBA(214, 214, 214, 1)`, `Height: =1`, `Width: =Parent.Width`,
`FillPortions: =0`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`, no children.

### Controls

| Name | Control | Purpose |
|---|---|---|
| `SiteRoot` | GroupContainer / AutoLayout | scrolling root |
| `SiteHeader` | GroupContainer / AutoLayout | App Header pattern |
| `SiteHeaderHome` | Icon | header home glyph |
| `SiteHeaderTitle` | ModernText | wordmark "Site Inspection" |
| `SiteHeaderAvatar` | GroupContainer / AutoLayout | 44px amber circle |
| `SiteHeaderInitials` | ModernText | `=AppUserInitials` |
| `SiteBody` | GroupContainer / AutoLayout | form column |
| `SiteZoneImageBox` | GroupContainer / AutoLayout | grey zone-map placeholder |
| `SiteZonePlaceholder` | ModernText | "Chưa có sơ đồ khu vực" |
| `SiteFldZone` | GroupContainer / AutoLayout | label + dropdown |
| `SiteLblZone` | ModernText | "Site Name" label, Vietnamese: "Tên khu vực" |
| `SiteDdZone` | ModernDropdown | zone picker |
| `SiteFldAddress` | GroupContainer / AutoLayout | label + read-only box |
| `SiteLblAddress` | ModernText | "Địa chỉ" |
| `SiteAddressBox` | GroupContainer / AutoLayout | field surface |
| `SiteTxtAddress` | ModernText | address value |
| `SiteFldDesc` | GroupContainer / AutoLayout | label + read-only box |
| `SiteLblDesc` | ModernText | "Mô tả khu vực" |
| `SiteDescBox` | GroupContainer / AutoLayout | field surface, 110 tall |
| `SiteTxtDesc` | ModernText | description value, wraps |
| `SiteFldTemplate` | GroupContainer / AutoLayout | label + dropdown |
| `SiteLblTemplate` | ModernText | "Bộ tiêu chuẩn kiểm tra" |
| `SiteDdTemplate` | ModernDropdown | template picker |
| `SiteFooterRule` | GroupContainer / AutoLayout | 1px hairline |
| `SiteFooter` | GroupContainer / AutoLayout | action row |
| `SiteBtnCancel` | ModernButton | "Huỷ" |
| `SiteBtnSurvey` | ModernButton | "Khảo sát ›" |

27 controls.

### Exact inline values

`SiteZoneImageBox`: `Fill: =RGBA(233, 234, 236, 1)`, `Height: =150`,
`Width: =Parent.Width`, `FillPortions: =0`,
`RadiusTopLeft/TopRight/BottomLeft/BottomRight: =4`,
`LayoutDirection: =LayoutDirection.Horizontal`,
`LayoutAlignItems: =LayoutAlignItems.Center`,
`LayoutJustifyContent: =LayoutJustifyContent.Center`, `LayoutMinWidth: =0`,
`LayoutMinHeight: =0`.

`SiteZonePlaceholder`: `Text: ="Chưa có sơ đồ khu vực"`, `Size: =13`,
`Color: =RGBA(120, 120, 125, 1)`, `Align: =Align.Center`, `Height: =20`, `Wrap: =false`,
`FillPortions: =0`.

Labels: `SiteLblZone.Text: ="Tên khu vực"`, `SiteLblAddress.Text: ="Địa chỉ"`,
`SiteLblDesc.Text: ="Mô tả khu vực"`, `SiteLblTemplate.Text: ="Bộ tiêu chuẩn kiểm tra"`.

`SiteDdZone`:

```yaml
Items: =Sort(colZones, Title, SortOrder.Ascending)
ItemDisplayText: =ThisItem.Title
Height: =44
Width: =Parent.Width
FillPortions: =0
Color: =RGBA(32, 31, 30, 1)
Size: =14
AccessibleLabel: ="Chọn khu vực sản xuất"
OnChange: =Set(gblZone, SiteDdZone.Selected)
```

`SiteDdTemplate`:

```yaml
Items: =Sort(colTemplates, Title, SortOrder.Ascending)
ItemDisplayText: =ThisItem.Title
Height: =44
Width: =Parent.Width
FillPortions: =0
Color: =RGBA(32, 31, 30, 1)
Size: =14
AccessibleLabel: ="Chọn bộ tiêu chuẩn kiểm tra"
OnChange: =Set(gblTemplate, SiteDdTemplate.Selected)
```

Do **not** set `Appearance` on either dropdown — leave the control's default appearance.

Read-only field surfaces `SiteAddressBox` and `SiteDescBox`:

```
Fill                =RGBA(242, 242, 242, 1)
BorderColor         =RGBA(214, 214, 214, 1)
BorderStyle         =BorderStyle.Solid
BorderThickness     =1
RadiusTopLeft       =4      (all four corners)
LayoutDirection     =LayoutDirection.Vertical
LayoutAlignItems    =LayoutAlignItems.Stretch
LayoutGap           =0
PaddingLeft         =12
PaddingRight        =12
PaddingTop          =10
PaddingBottom       =10
LayoutMinWidth      =0
LayoutMinHeight     =0
Width               =Parent.Width
FillPortions        =0
Height              =44   (SiteAddressBox)  /  =110 (SiteDescBox)
```

`SiteTxtAddress`:

```yaml
Text: =Coalesce(SiteDdZone.Selected.Address, "—")
Size: =14
Color: =RGBA(32, 31, 30, 1)
Wrap: =false
Height: =24
PaddingTop: =0
PaddingBottom: =0
FillPortions: =0
VerticalAlign: =VerticalAlign.Middle
AccessibleLabel: ="Địa chỉ khu vực đã chọn"
```

`SiteTxtDesc`:

```yaml
Text: =Coalesce(SiteDdZone.Selected.Description, "Chưa có mô tả cho khu vực này.")
Size: =14
Color: =RGBA(32, 31, 30, 1)
Wrap: =true
Height: =90
PaddingTop: =0
PaddingBottom: =0
FillPortions: =0
VerticalAlign: =VerticalAlign.Top
AccessibleLabel: ="Mô tả khu vực đã chọn"
```

Seeded descriptions are at most 48 characters, which is 2 lines at Size 14 in the 334px
inner width — comfortably inside the 90px text height. Do not shrink `SiteDescBox`.

`SiteBtnCancel`:

```yaml
Text: ="Huỷ"
Appearance: =ButtonAppearance.Secondary
Color: =RGBA(32, 31, 30, 1)
Size: =14
Width: =110
Height: =44
FillPortions: =0
AccessibleLabel: ="Huỷ lựa chọn"
OnSelect: |-
  =Reset(SiteDdZone);
  Reset(SiteDdTemplate);
  Clear(colChecklist);
  Notify("Đã xoá lựa chọn khu vực và bộ tiêu chuẩn.", NotificationType.Information, 2000)
```

`SiteBtnSurvey`:

```yaml
Text: ="Khảo sát ›"
Appearance: =ButtonAppearance.Primary
Color: =RGBA(255, 255, 255, 1)
Size: =14
Width: =140
Height: =44
FillPortions: =0
AccessibleLabel: ="Bắt đầu khảo sát"
BasePaletteColor: |-
  =If(
      IsBlank(SiteDdZone.Selected.Title) || IsBlank(SiteDdTemplate.Selected.Title),
      RGBA(200, 203, 206, 1),
      RGBA(60, 74, 82, 1)
  )
DisplayMode: |-
  =If(
      IsBlank(SiteDdZone.Selected.Title) || IsBlank(SiteDdTemplate.Selected.Title),
      DisplayMode.Disabled,
      DisplayMode.Edit
  )
OnSelect: |-
  =Set(gblZone, SiteDdZone.Selected);
  Set(gblTemplate, SiteDdTemplate.Selected);
  ClearCollect(
      colChecklist,
      ForAll(
          Sort(
              Filter(colItems, TemplateId = SiteDdTemplate.Selected.TemplateId),
              OrderNumber,
              SortOrder.Ascending
          ) As it,
          {
              ItemId: it.ItemId,
              OrderNumber: it.OrderNumber,
              Question: it.Question,
              IsCritical: it.IsCritical,
              Result: "",
              FailDesc: "",
              FailSeverity: "",
              FailAssigneeName: "",
              FailAssigneeEmail: "",
              FailPhoto: ""
          }
      )
  );
  Set(gblAuditStart, Now());
  Set(gblCurrentItemId, 0);
  Set(gblShowFailPanel, false);
  Set(gblShowCamera, false);
  Navigate(scrChecklist, ScreenTransition.Fade)
```

The disabled state is derived from the two current `.Selected` values — **do not** add a
`varReady` flag or set anything in `OnChange` to track it.

The record shape inside `ForAll` must match the `colChecklist` schema in `App.OnStart`
column for column, including `FailPhoto: ""`. A bare
`Blank()` there leaves the column untyped and breaks the photo binding on `scrChecklist`.

### Data binding

- `colZones` and `colTemplates` are seeded in `App.OnStart` and are read-only here.
- `colItems.TemplateId` is the join key to `colTemplates.TemplateId`.
- `colChecklist.ItemId` becomes the row key used by every `Patch` on `scrChecklist`.
- Address and Description are properties of the **zone**, not of the audit run, which is
  why they render as non-editable text. Do not add any control that lets the user type
  into them.

### Navigation

- `SiteBtnSurvey` -> `scrChecklist` (`ScreenTransition.Fade`), only when enabled.
- `SiteHeaderHome` -> `Screen1` per the shared App Header pattern.

### State

`OnVisible` sets `gblHomeConfirm` and `gblCancelConfirm` to `false`. Nothing else. Do not
initialize any layout variable.

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

Compile-ready enum literals:
`LayoutDirection.Vertical`, `LayoutDirection.Horizontal`,
`LayoutAlignItems.Stretch`, `LayoutAlignItems.Center`, `LayoutAlignItems.Start`,
`LayoutJustifyContent.Center`, `LayoutJustifyContent.SpaceBetween`,
`LayoutJustifyContent.End`, `LayoutJustifyContent.Start`,
`LayoutOverflow.Scroll`, `LayoutOverflow.Hidden`,
`AlignInContainer.Stretch`, `AlignInContainer.Center`,
`BorderStyle.Solid`, `BorderStyle.None`,
`DisplayMode.Edit`, `DisplayMode.View`, `DisplayMode.Disabled`,
`DropShadow.Semilight`.

`GroupContainer` has **no** `OnSelect`. Nothing on this screen depends on tapping one.

### `ModernText`

`Text`, `Color`, `Size`, `FontWeight`, `Align`, `VerticalAlign`, `Wrap`, `AutoHeight`,
`Width`, `Height`, `X`, `Y`, `Visible`, `DisplayMode`, `AccessibleLabel`, `PaddingTop`,
`PaddingBottom`, `PaddingLeft`, `PaddingRight`, `FillPortions`, `AlignInContainer`,
`LayoutMinWidth`, `LayoutMinHeight`.

Compile-ready enum literals:
`FontWeight.Bold`, `FontWeight.Semibold`, `FontWeight.Normal`, `FontWeight.Lighter`,
`Align.Left`, `Align.Center`, `Align.Right`,
`VerticalAlign.Top`, `VerticalAlign.Middle`, `VerticalAlign.Bottom`.

Text colour is `Color` and font size is `Size`. There is no `FontColor` and no `FontSize`
on this control.

### `ModernButton`

`Text`, `OnSelect`, `Appearance`, `BasePaletteColor`, `Color`, `Size`, `FontWeight`,
`DisplayMode`, `Visible`, `Width`, `Height`, `X`, `Y`, `AccessibleLabel`,
`AlignInContainer`, `FillPortions`, `LayoutMinWidth`, `LayoutMinHeight`,
`RadiusTopLeft`, `RadiusTopRight`, `RadiusBottomLeft`, `RadiusBottomRight`.

Enum name for `Appearance` is **`ButtonAppearance`**, not `Appearance`.
Compile-ready literals: `ButtonAppearance.Primary`, `ButtonAppearance.Secondary`,
`ButtonAppearance.Outline`, `ButtonAppearance.Subtle`, `ButtonAppearance.Transparent`.

Do not set `Fill` on a `ModernButton` — a Secondary/Outline/Subtle appearance owns its own
surface and will ignore it. Use `Appearance` plus `BasePaletteColor`.

### `ModernDropdown`

`Items`, `ItemDisplayText`, `DefaultSelectedItems`, `OnChange`, `OnSelect`, `Color`,
`Size`, `FontWeight`, `BasePaletteColor`, `Appearance`, `Width`, `Height`, `X`, `Y`,
`Visible`, `DisplayMode`, `AccessibleLabel`, `FillPortions`, `AlignInContainer`,
`LayoutMinWidth`, `LayoutMinHeight`.

Output property: `Selected` (a record of the `Items` row shape).

`ItemDisplayText` is evaluated once per row with `ThisItem` in scope — write
`ItemDisplayText: =ThisItem.Title`, never `ItemDisplayText: ="Title"`.

The enum name for `Appearance` on this control is plain `Appearance`. **This screen does
not set it** — leave the property off entirely.

### `Classic/Icon`

`Icon`, `Color`, `Fill`, `OnSelect`, `Width`, `Height`, `X`, `Y`, `Visible`,
`DisplayMode`, `AccessibleLabel`, `Tooltip`, `Rotation`, `Transparency`, `BorderColor`,
`BorderStyle`, `BorderThickness`, `PaddingTop`, `PaddingBottom`, `PaddingLeft`,
`PaddingRight`, `FillPortions`, `AlignInContainer`, `LayoutMinWidth`, `LayoutMinHeight`.

Compile-ready enum literal used on this screen: `Icon.Home`.
