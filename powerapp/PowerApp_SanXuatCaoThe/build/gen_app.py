# -*- coding: utf-8 -*-
"""Sinh source canvas app "San xuat cao the" theo layout Experimental cua pac canvas pack.

    python gen_app.py
    pac canvas pack --sources src --msapp SanXuatCaoThe.msapp --layout Experimental --overwrite
"""
import json, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "src")
THEME = os.path.join(HERE, "DefaultTheme.json")

# Ten data source Dataverse = ten so nhieu (display collection name) cua bang.
DS = "'Sản xuất cao thế'"

# Ten cot Power Fx = display name cua cot trong Dataverse (xem gen_solution.py).
C_NGAY   = "'Ngày sản xuất'"
C_TB     = "'Thiết bị'"
C_KV     = "'Cấp điện áp'"
C_DC     = "'Dây chuyền'"
C_KH     = "'SL kế hoạch'"
C_TT     = "'SL thực tế'"
C_LOI    = "'SP lỗi'"
C_DAT    = "'SP đạt'"
C_VH     = "'Giờ vận hành'"
C_DM     = "'Giờ dừng máy'"
C_KWH    = "'Điện năng'"
C_GC     = "'Giờ công'"
C_HT     = "'Hoàn thành KH'"
C_TL     = "'Tỷ lệ lỗi'"
C_NS     = "'Năng suất'"
C_TT2    = "'Trạng thái'"
C_GHICHU = "'Ghi chú'"
C_MA     = "'Mã bản ghi'"

THIET_BI = ["Máy biến áp lực", "Máy cắt cao áp", "Dao cách ly",
            "Chống sét van", "Biến dòng điện", "Biến điện áp"]
DAY_CHUYEN = ["DC-MBA-01", "DC-MC-01", "DC-DCL-01", "DC-CSV-01", "DC-BI-01", "DC-BU-01"]
TRANG_THAI = ["Đạt", "Cần kiểm tra", "Dưới kế hoạch"]


def fxlist(items):
    return "[" + ",".join('"%s"' % i for i in items) + "]"


# ---------------------------------------------------------------- emitter
class Ctl:
    def __init__(self, name, type_, props=None, children=None):
        self.name, self.type = name, type_
        self.props = props or {}
        self.children = children or []


def emit(ctl, indent=0):
    pad = " " * indent
    lines = ["%s%s As %s:" % (pad, ctl.name, ctl.type)]
    ppad = " " * (indent + 4)
    for k in sorted(ctl.props.keys()):
        v = str(ctl.props[k]).strip("\n")
        # YamlLexer tu choi ky tu '#' trong bieu thuc mot dong -> dung khoi '|'
        if "\n" in v or "#" in v:
            lines.append("%s%s: |" % (ppad, k))
            body = v.split("\n")
            first = body[0].strip()
            lines.append("%s    =%s" % (ppad, first[1:] if first.startswith("=") else first))
            for l in body[1:]:
                lines.append("%s     %s" % (ppad, l.strip()))
        else:
            lines.append("%s%s: =%s" % (ppad, k, v.lstrip("=")))
    for c in ctl.children:
        lines.append("")
        lines.extend(emit(c, indent + 4))
    return lines


# ---------------------------------------------------------------- palette
PRIMARY   = "RGBA(11, 60, 109, 1)"
ACCENT    = "RGBA(0, 158, 204, 1)"
BG        = "RGBA(242, 245, 249, 1)"
CARD      = "RGBA(255, 255, 255, 1)"
LINE      = "RGBA(224, 230, 237, 1)"
TEXT      = "RGBA(28, 37, 48, 1)"
MUTED     = "RGBA(110, 122, 138, 1)"
GOOD      = "RGBA(22, 148, 84, 1)"
WARN      = "RGBA(214, 138, 12, 1)"
BAD       = "RGBA(203, 44, 49, 1)"
WHITE     = "RGBA(255, 255, 255, 1)"
TRANS     = "RGBA(0, 0, 0, 0)"
SUBTLE    = "RGBA(178, 205, 228, 1)"
TRACK     = "RGBA(236, 240, 245, 1)"
INPUTBG   = "RGBA(249, 250, 252, 1)"
FONT      = "Font.'Open Sans'"

W, H = 1366, 768

# ---------------------------------------------------------------- Power Fx
# Luu y quan trong: SortByColumns / GroupBy / Search nhan ten cot dang CHUOI va
# phan giai theo logical name cua Dataverse (mfg_productiondate...), khong nhan
# display name tieng Viet. Vi vay:
#   - dung Sort(...) thay SortByColumns(...)  -> nhan dinh danh 'Ngay san xuat'
#   - truoc khi GroupBy thi AddColumns de doi sang ten ASCII roi moi gom nhom
RECALC = """ClearCollect(
    colLoc,
    Filter(
        colSanXuat,
        (varThang = "Tất cả" || Text(Month({ngay})) = varThang) && (varThietBi = "Tất cả" || {tb} = varThietBi)
    )
);
ClearCollect(
    colTB,
    Sort(
        AddColumns(
            GroupBy(
                AddColumns(colLoc, TenTB, {tb}, SoLuong, {tt}, SoLoiTB, {loi}),
                TenTB,
                grp
            ),
            SanLuong, Sum(grp, SoLuong),
            SoLoi, Sum(grp, SoLoiTB)
        ),
        SanLuong,
        SortOrder.Descending
    )
);
ClearCollect(
    colThang,
    Sort(
        AddColumns(
            GroupBy(
                AddColumns(colLoc, ThangSo, Month({ngay}), SoLuong, {tt}),
                ThangSo,
                grp
            ),
            SanLuong, Sum(grp, SoLuong)
        ),
        ThangSo,
        SortOrder.Ascending
    )
)""".format(ngay=C_NGAY, tb=C_TB, tt=C_TT, loi=C_LOI)

RELOAD = "ClearCollect(colSanXuat, %s);\n%s" % (DS, RECALC)

APP_ONSTART = """Set(varThang, "Tất cả");
Set(varThietBi, "Tất cả");
Set(varLaMoi, true);
Set(varReset, false);
Set(varBanGhi, Defaults(%s));
%s""" % (DS, RELOAD)


# Search() nhan ten cot dang chuoi nen khong phan giai duoc display name tieng
# Viet -> thay bang Filter + toan tu "in" (so khop chuoi con, khong phan biet hoa thuong).
SEARCH_ITEMS = """Sort(
    Filter(
        colSanXuat,
        IsBlank(txtTimKiem.Text) || txtTimKiem.Text in {tb} || txtTimKiem.Text in {dc}
    ),
    {ngay},
    SortOrder.Descending
)""".format(tb=C_TB, dc=C_DC, ngay=C_NGAY)


# ---------------------------------------------------------------- widgets
def rect(name, x, y, w, h, fill=CARD, border=None, extra=None):
    p = {"X": x, "Y": y, "Width": w, "Height": h, "Fill": fill}
    if border:
        p["BorderColor"] = border
        p["BorderThickness"] = 1
    if extra:
        p.update(extra)
    return Ctl(name, "rectangle", p)


def lbl(name, text, x, y, w, h, size=13, color=TEXT, weight="FontWeight.Normal",
        align="Align.Left", valign="VerticalAlign.Middle", extra=None):
    p = {"Text": text, "X": x, "Y": y, "Width": w, "Height": h, "Size": size,
         "Color": color, "FontWeight": weight, "Align": align, "VerticalAlign": valign,
         "Font": FONT, "Wrap": "false"}
    if extra:
        p.update(extra)
    return Ctl(name, "label", p)


def btn(name, text, x, y, w, h, onselect, fill=ACCENT, color=WHITE, size=13):
    return Ctl(name, "button", {
        "Text": text, "X": x, "Y": y, "Width": w, "Height": h, "Fill": fill,
        "Color": color, "Size": size, "Font": FONT, "FontWeight": "FontWeight.Semibold",
        "BorderThickness": 0, "RadiusTopLeft": 4, "RadiusTopRight": 4,
        "RadiusBottomLeft": 4, "RadiusBottomRight": 4,
        "HoverFill": "ColorFade(Self.Fill, -15%)",
        "PressedFill": "ColorFade(Self.Fill, -25%)",
        "HoverColor": "Self.Color", "PressedColor": "Self.Color",
        "OnSelect": onselect})


# ================================================================ DASHBOARD
def dashboard():
    ch = []
    ch.append(rect("dbHeaderBar", 0, 0, W, 64, PRIMARY))
    ch.append(lbl("dbTitle", '"DASHBOARD SẢN XUẤT THIẾT BỊ ĐIỆN CAO THẾ"',
                  24, 10, 760, 26, size=17, color=WHITE, weight="FontWeight.Bold"))
    ch.append(lbl("dbSubTitle",
                  '"KPI sản lượng - giờ công - chất lượng  |  Cơ sở dữ liệu Dataverse"',
                  24, 34, 760, 20, size=11, color=SUBTLE))
    ch.append(btn("dbBtnNhap", '"Nhập số liệu sản xuất"', W - 250, 16, 226, 32,
                  "Navigate(scrNhapLieu, ScreenTransition.Fade)"))

    # ---------- thanh bo loc
    ch.append(rect("dbFilterCard", 24, 80, W - 48, 56, CARD, LINE))
    ch.append(lbl("dbLblThang", '"THÁNG"', 40, 90, 150, 14, size=9, color=MUTED,
                  weight="FontWeight.Semibold"))
    ch.append(Ctl("ddThang", "dropdown", {
        "Items": fxlist(["Tất cả", "1", "2", "3", "4", "5", "6", "7",
                         "8", "9", "10", "11", "12"]),
        "Default": "varThang", "X": 40, "Y": 105, "Width": 150, "Height": 26,
        "Size": 12, "Font": FONT, "Color": TEXT,
        "OnChange": "Set(varThang, ddThang.Selected.Value);\n" + RECALC}))
    ch.append(lbl("dbLblTB", '"LOẠI THIẾT BỊ"', 210, 90, 260, 14, size=9, color=MUTED,
                  weight="FontWeight.Semibold"))
    ch.append(Ctl("ddThietBi", "dropdown", {
        "Items": fxlist(["Tất cả"] + THIET_BI),
        "Default": "varThietBi", "X": 210, "Y": 105, "Width": 260, "Height": 26,
        "Size": 12, "Font": FONT, "Color": TEXT,
        "OnChange": "Set(varThietBi, ddThietBi.Selected.Value);\n" + RECALC}))
    ch.append(lbl("dbLblCount",
                  '"Đang hiển thị " & Text(CountRows(colLoc), "#,##0") & " / " '
                  '& Text(CountRows(colSanXuat), "#,##0") & " bản ghi"',
                  495, 98, 400, 20, size=12, color=MUTED))
    ch.append(Ctl("dbIcoRefresh", "icon.Reload", {
        "X": W - 76, "Y": 95, "Width": 26, "Height": 26, "Color": PRIMARY,
        "Tooltip": '"Tải lại dữ liệu từ Dataverse"',
        "OnSelect": RELOAD}))

    # ---------- the KPI
    kpis = [
        ("SẢN LƯỢNG THỰC TẾ",
         'Text(Sum(colLoc, %s), "#,##0")' % C_TT, '"chiếc"', PRIMARY),
        ("SẢN LƯỢNG KẾ HOẠCH",
         'Text(Sum(colLoc, %s), "#,##0")' % C_KH, '"chiếc"', PRIMARY),
        ("HOÀN THÀNH KẾ HOẠCH",
         'IfError(Text(Sum(colLoc, %s) / Sum(colLoc, %s), "0.0%%"), "-")'
         % (C_TT, C_KH), '"so với kế hoạch"', GOOD),
        ("TỶ LỆ LỖI",
         'IfError(Text(Sum(colLoc, %s) / Sum(colLoc, %s), "0.00%%"), "-")'
         % (C_LOI, C_TT), '"trên sản lượng thực tế"', BAD),
        ("GIỜ CÔNG",
         'Text(Sum(colLoc, %s), "#,##0.0")' % C_GC, '"giờ"', PRIMARY),
        ("GIỜ DỪNG MÁY",
         'Text(Sum(colLoc, %s), "#,##0.0")' % C_DM, '"giờ"', WARN),
        ("ĐIỆN NĂNG TIÊU THỤ",
         'Text(Sum(colLoc, %s), "#,##0")' % C_KWH, '"kWh"', ACCENT),
        ("SẢN PHẨM LỖI",
         'Text(Sum(colLoc, %s), "#,##0")' % C_LOI, '"chiếc"', BAD),
    ]
    cw, gap = 316, 18
    for i, (title, val, unit, col) in enumerate(kpis):
        r, c = divmod(i, 4)
        x = 24 + c * (cw + gap)
        y = 150 + r * 100
        ch.append(rect("kpiCard%d" % i, x, y, cw, 88, CARD, LINE))
        ch.append(rect("kpiBar%d" % i, x, y, 4, 88, col))
        ch.append(lbl("kpiT%d" % i, '"%s"' % title, x + 18, y + 12, cw - 32, 14,
                      size=9, color=MUTED, weight="FontWeight.Semibold"))
        ch.append(lbl("kpiV%d" % i, val, x + 18, y + 28, cw - 32, 36,
                      size=25, color=col, weight="FontWeight.Bold"))
        ch.append(lbl("kpiU%d" % i, unit, x + 18, y + 64, cw - 32, 14,
                      size=10, color=MUTED))

    # ---------- bieu do: theo thiet bi
    px, py, pw, ph = 24, 356, 660, 170
    ch.append(rect("chart1Card", px, py, pw, ph, CARD, LINE))
    ch.append(lbl("chart1Title", '"SẢN LƯỢNG THEO LOẠI THIẾT BỊ"',
                  px + 16, py + 10, pw - 32, 18, size=12, weight="FontWeight.Semibold"))
    g1 = Ctl("galThietBi", "gallery.galleryVertical", {
        "Items": "colTB", "X": px + 16, "Y": py + 36,
        "Width": pw - 32, "Height": ph - 48, "TemplateSize": 20,
        "TemplatePadding": 0, "ShowScrollbar": "false", "Selectable": "false",
        "TemplateFill": TRANS})
    g1.children = [
        lbl("g1Name", "ThisItem.TenTB", 0, 0, 150, 20, size=11),
        rect("g1Track", 156, 5, 330, 10, TRACK),
        rect("g1Bar", 156, 5, 0, 10, ACCENT, extra={
            "Width": "IfError(330 * ThisItem.SanLuong / Max(colTB, SanLuong), 0)"}),
        lbl("g1Val", 'Text(ThisItem.SanLuong, "#,##0")', 494, 0, 70, 20,
            size=11, weight="FontWeight.Semibold", align="Align.Right"),
        lbl("g1Loi", 'Text(ThisItem.SoLoi, "#,##0") & " lỗi"', 566, 0, 60, 20,
            size=10, color=BAD, align="Align.Right"),
    ]
    ch.append(g1)

    # ---------- bieu do: theo thang
    px2 = 702
    pw2 = W - 24 - px2
    ch.append(rect("chart2Card", px2, py, pw2, ph, CARD, LINE))
    ch.append(lbl("chart2Title", '"SẢN LƯỢNG THEO THÁNG"',
                  px2 + 16, py + 10, pw2 - 32, 18, size=12, weight="FontWeight.Semibold"))
    g2 = Ctl("galThang", "gallery.galleryVertical", {
        "Items": "colThang", "X": px2 + 16, "Y": py + 36,
        "Width": pw2 - 32, "Height": ph - 48, "TemplateSize": 17,
        "TemplatePadding": 0, "ShowScrollbar": "false", "Selectable": "false",
        "TemplateFill": TRANS})
    g2.children = [
        lbl("g2Name", '"Tháng " & Text(ThisItem.ThangSo)', 0, 0, 70, 17, size=11),
        rect("g2Track", 76, 4, 330, 9, TRACK),
        rect("g2Bar", 76, 4, 0, 9, PRIMARY, extra={
            "Width": "IfError(330 * ThisItem.SanLuong / Max(colThang, SanLuong), 0)"}),
        lbl("g2Val", 'Text(ThisItem.SanLuong, "#,##0")', 414, 0, 80, 17,
            size=11, weight="FontWeight.Semibold", align="Align.Right"),
    ]
    ch.append(g2)

    # ---------- bang chi tiet
    ty, th = 540, 208
    ch.append(rect("tblCard", 24, ty, W - 48, th, CARD, LINE))
    ch.append(lbl("tblTitle", '"CHI TIẾT SẢN XUẤT THEO NGÀY"', 40, ty + 10, 400, 18,
                  size=12, weight="FontWeight.Semibold"))
    ch.append(lbl("tblHint", '"Bấm vào một dòng để mở bản ghi ở màn hình nhập liệu"',
                  W - 460, ty + 10, 420, 18, size=10, color=MUTED, align="Align.Right"))
    cols = [("Ngày", 0, 90), ("Thiết bị", 92, 170), ("Dây chuyền", 264, 110),
            ("kV", 376, 50), ("Kế hoạch", 428, 70), ("Thực tế", 500, 70),
            ("Lỗi", 572, 50), ("Đạt", 624, 60), ("Giờ công", 686, 80),
            ("Hoàn thành", 768, 90), ("Tỷ lệ lỗi", 860, 80), ("Trạng thái", 944, 140)]
    ch.append(rect("tblHeadBg", 40, ty + 34, W - 80, 24, "RGBA(246, 248, 251, 1)"))
    for i, (t, cx, cw2) in enumerate(cols):
        al = "Align.Right" if 3 <= i <= 10 else "Align.Left"
        ch.append(lbl("th%d" % i, '"%s"' % t, 46 + cx, ty + 34, cw2, 24,
                      size=10, color=MUTED, weight="FontWeight.Semibold", align=al))
    g3 = Ctl("galChiTiet", "gallery.galleryVertical", {
        "Items": "Sort(colLoc, %s, SortOrder.Descending)" % C_NGAY,
        "X": 40, "Y": ty + 60, "Width": W - 80, "Height": th - 70,
        "TemplateSize": 26, "TemplatePadding": 0, "ShowScrollbar": "true",
        "Selectable": "true", "TemplateFill": TRANS,
        "OnSelect": "Set(varBanGhi, ThisItem);\n"
                    "Set(varLaMoi, false);\n"
                    "Set(varReset, !varReset);\n"
                    "Navigate(scrNhapLieu, ScreenTransition.Fade)"})
    cells = [
        ('Text(ThisItem.%s, "dd/mm/yyyy")' % C_NGAY, "Align.Left", TEXT),
        ("ThisItem." + C_TB, "Align.Left", TEXT),
        ("ThisItem." + C_DC, "Align.Left", MUTED),
        ("Text(ThisItem.%s)" % C_KV, "Align.Right", MUTED),
        ('Text(ThisItem.%s, "#,##0")' % C_KH, "Align.Right", TEXT),
        ('Text(ThisItem.%s, "#,##0")' % C_TT, "Align.Right", TEXT),
        ('Text(ThisItem.%s, "#,##0")' % C_LOI, "Align.Right", BAD),
        ('Text(ThisItem.%s, "#,##0")' % C_DAT, "Align.Right", GOOD),
        ('Text(ThisItem.%s, "#,##0.0")' % C_GC, "Align.Right", TEXT),
        ('Text(ThisItem.%s, "0.0%%")' % C_HT, "Align.Right", TEXT),
        ('Text(ThisItem.%s, "0.00%%")' % C_TL, "Align.Right", TEXT),
        ("ThisItem." + C_TT2, "Align.Left", TEXT),
    ]
    st_fill = ('If(ThisItem.%s = "Đạt", RGBA(228, 244, 235, 1), '
               'If(ThisItem.%s = "Dưới kế hoạch", RGBA(252, 231, 232, 1), '
               'RGBA(253, 243, 224, 1)))' % (C_TT2, C_TT2))
    st_color = ('If(ThisItem.%s = "Đạt", %s, '
                'If(ThisItem.%s = "Dưới kế hoạch", %s, %s))' % (C_TT2, GOOD, C_TT2, BAD, WARN))
    kids = [rect("tdLine", 0, 25, W - 84, 1, "RGBA(238, 241, 245, 1)")]
    for i, ((t, cx, cw2), (expr, al, col)) in enumerate(zip(cols, cells)):
        if t == "Trạng thái":
            kids.append(rect("tdStatusBg", cx + 6, 4, 120, 18, st_fill))
            kids.append(lbl("td%d" % i, expr, cx + 6, 4, 120, 18, size=10,
                            color=st_color, weight="FontWeight.Semibold",
                            align="Align.Center"))
        else:
            kids.append(lbl("td%d" % i, expr, cx + 6, 0, cw2, 25, size=11,
                            color=col, align=al))
    g3.children = kids
    ch.append(g3)

    return Ctl("scrDashboard", "screen",
               {"Fill": BG, "LoadingSpinner": "LoadingSpinner.None",
                "OnVisible": RECALC}, ch)


# ================================================================ NHAP LIEU
def nhaplieu():
    ch = []
    ch.append(rect("nlHeaderBar", 0, 0, W, 64, PRIMARY))
    ch.append(Ctl("nlIcoBack", "icon.ChevronLeft", {
        "X": 20, "Y": 18, "Width": 28, "Height": 28, "Color": WHITE,
        "OnSelect": "Navigate(scrDashboard, ScreenTransition.Fade)"}))
    ch.append(lbl("nlTitle", '"NHẬP THÔNG TIN SẢN XUẤT"', 56, 10, 640, 26,
                  size=17, color=WHITE, weight="FontWeight.Bold"))
    ch.append(lbl("nlSub", '"Thêm mới hoặc cập nhật bản ghi sản xuất trong bảng Dataverse"',
                  56, 34, 640, 20, size=11, color=SUBTLE))
    ch.append(btn("nlBtnDash", '"Xem Dashboard"', W - 180, 16, 156, 32,
                  "Navigate(scrDashboard, ScreenTransition.Fade)",
                  fill="RGBA(255, 255, 255, 0.16)"))

    # ---------- cot trai: danh sach
    lx, lw = 24, 420
    ch.append(rect("nlListCard", lx, 80, lw, 664, CARD, LINE))
    ch.append(lbl("nlListTitle", '"DANH SÁCH BẢN GHI"', lx + 16, 92, 200, 18,
                  size=12, weight="FontWeight.Semibold"))
    ch.append(lbl("nlListCount", 'Text(CountRows(colSanXuat), "#,##0") & " bản ghi"',
                  lx + lw - 146, 92, 130, 18, size=11, color=MUTED, align="Align.Right"))
    ch.append(Ctl("txtTimKiem", "text", {
        "X": lx + 16, "Y": 118, "Width": lw - 32, "Height": 30,
        "HintText": '"Tìm theo thiết bị hoặc dây chuyền..."', "Default": '""',
        "Size": 12, "Font": FONT, "Color": TEXT, "BorderColor": LINE, "Fill": INPUTBG}))
    gl = Ctl("galDanhSach", "gallery.galleryVertical", {
        "Items": SEARCH_ITEMS,
        "X": lx + 16, "Y": 156, "Width": lw - 32, "Height": 574,
        "TemplateSize": 58, "TemplatePadding": 0, "ShowScrollbar": "true",
        "Selectable": "true", "TemplateFill": TRANS,
        "OnSelect": "Set(varBanGhi, ThisItem);\n"
                    "Set(varLaMoi, false);\n"
                    "Set(varReset, !varReset)"})
    gl.children = [
        rect("glSel", 0, 0, 4, 57,
             "If(!varLaMoi && varBanGhi.%s = ThisItem.%s, %s, %s)"
             % (C_MA, C_MA, ACCENT, TRANS)),
        lbl("glTB", "ThisItem." + C_TB, 14, 6, 240, 20, size=12,
            weight="FontWeight.Semibold"),
        lbl("glNgay", 'Text(ThisItem.%s, "dd/mm/yyyy")' % C_NGAY, 258, 6, 110, 20,
            size=11, color=MUTED, align="Align.Right"),
        lbl("glLine2", 'ThisItem.%s & "   |   " & Text(ThisItem.%s) & " kV"' % (C_DC, C_KV),
            14, 26, 240, 18, size=10, color=MUTED),
        lbl("glSL", '"KH " & Text(ThisItem.%s) & "  /  TT " & Text(ThisItem.%s)' % (C_KH, C_TT),
            258, 26, 110, 18, size=10, align="Align.Right"),
        rect("glLine", 0, 57, lw - 34, 1, "RGBA(238, 241, 245, 1)"),
    ]
    ch.append(gl)

    # ---------- cot phai: form
    fx, fw = 468, W - 24 - 468
    ch.append(rect("nlFormCard", fx, 80, fw, 664, CARD, LINE))
    ch.append(lbl("nlFormTitle", 'If(varLaMoi, "THÊM BẢN GHI MỚI", "CẬP NHẬT BẢN GHI")',
                  fx + 20, 94, 460, 20, size=13, weight="FontWeight.Bold"))
    ch.append(lbl("nlFormHint",
                  'If(varLaMoi, "Điền đầy đủ thông tin rồi bấm Lưu bản ghi", '
                  '"Đang sửa bản ghi " & varBanGhi.%s)' % C_MA,
                  fx + 20, 116, 560, 18, size=11, color=MUTED))
    ch.append(rect("nlFormLine", fx + 20, 142, fw - 40, 1, LINE))

    colw = (fw - 40 - 2 * 20) // 3

    def cx_of(i):
        return fx + 20 + i * (colw + 20)

    fields = [
        (0, 0, "NGÀY SẢN XUẤT *", "dpNgay", "date", {}),
        (0, 1, "THIẾT BỊ *", "ddFThietBi", "drop",
         {"Items": fxlist(THIET_BI), "Default": "varBanGhi." + C_TB}),
        (0, 2, "DÂY CHUYỀN *", "ddFDayChuyen", "drop",
         {"Items": fxlist(DAY_CHUYEN), "Default": "varBanGhi." + C_DC}),
        (1, 0, "CẤP ĐIỆN ÁP (KV) *", "ddFDienAp", "drop",
         {"Items": fxlist(["110", "220", "500"]),
          "Default": "Text(varBanGhi.%s)" % C_KV}),
        (1, 1, "SL KẾ HOẠCH *", "txtKeHoach", "num",
         {"Default": "Text(varBanGhi.%s)" % C_KH}),
        (1, 2, "SL THỰC TẾ *", "txtThucTe", "num",
         {"Default": "Text(varBanGhi.%s)" % C_TT}),
        (2, 0, "SỐ SẢN PHẨM LỖI", "txtLoi", "num",
         {"Default": "Text(varBanGhi.%s)" % C_LOI}),
        (2, 1, "GIỜ VẬN HÀNH", "txtVanHanh", "num",
         {"Default": "Text(varBanGhi.%s)" % C_VH}),
        (2, 2, "GIỜ DỪNG MÁY", "txtDungMay", "num",
         {"Default": "Text(varBanGhi.%s)" % C_DM}),
        (3, 0, "ĐIỆN NĂNG (KWH)", "txtDienNang", "num",
         {"Default": "Text(varBanGhi.%s)" % C_KWH}),
        (3, 1, "GIỜ CÔNG", "txtGioCong", "num",
         {"Default": "Text(varBanGhi.%s)" % C_GC}),
        (3, 2, "TRẠNG THÁI", "ddFTrangThai", "drop",
         {"Items": fxlist(TRANG_THAI), "Default": "varBanGhi." + C_TT2}),
    ]
    y0, rowh = 162, 68
    for r, c, caption, cname, kind, extra in fields:
        x, y = cx_of(c), y0 + r * rowh
        ch.append(lbl("cap" + cname, '"%s"' % caption, x, y, colw, 14, size=9,
                      color=MUTED, weight="FontWeight.Semibold"))
        if kind == "date":
            ch.append(Ctl(cname, "datepicker", {
                "X": x, "Y": y + 18, "Width": colw, "Height": 32,
                "DefaultDate": "If(varLaMoi, Today(), varBanGhi.%s)" % C_NGAY,
                "Format": "DateTimeFormat.ShortDate", "Size": 12, "Font": FONT,
                "Color": TEXT, "BorderColor": LINE, "Reset": "varReset"}))
        elif kind == "drop":
            p = {"X": x, "Y": y + 18, "Width": colw, "Height": 32, "Size": 12,
                 "Font": FONT, "Color": TEXT, "BorderColor": LINE, "Reset": "varReset"}
            p.update(extra)
            ch.append(Ctl(cname, "dropdown", p))
        else:
            p = {"X": x, "Y": y + 18, "Width": colw, "Height": 32, "Size": 12,
                 "Font": FONT, "Color": TEXT, "BorderColor": LINE, "Fill": INPUTBG,
                 "Format": "TextFormat.Number", "HintText": '"0"', "Reset": "varReset"}
            p.update(extra)
            ch.append(Ctl(cname, "text", p))

    gy = y0 + 4 * rowh
    ch.append(lbl("captxtGhiChu", '"GHI CHÚ"', fx + 20, gy, 200, 14, size=9,
                  color=MUTED, weight="FontWeight.Semibold"))
    ch.append(Ctl("txtGhiChu", "text", {
        "X": fx + 20, "Y": gy + 18, "Width": fw - 40, "Height": 56,
        "Mode": "TextMode.MultiLine", "Size": 12, "Font": FONT, "Color": TEXT,
        "BorderColor": LINE, "Fill": INPUTBG,
        "HintText": '"Ghi chú về ca sản xuất, sự cố, nguyên nhân..."',
        "Default": "varBanGhi." + C_GHICHU, "Reset": "varReset"}))

    # ---------- gia tri tu dong tinh
    cy = gy + 92
    ch.append(rect("nlCalcBg", fx + 20, cy, fw - 40, 76, "RGBA(246, 249, 252, 1)", LINE))
    ch.append(lbl("nlCalcTitle", '"CÁC CHỈ SỐ ĐƯỢC TÍNH TỰ ĐỘNG KHI LƯU"',
                  fx + 34, cy + 8, 400, 14, size=9, color=MUTED,
                  weight="FontWeight.Semibold"))
    calcs = [
        ("Sản phẩm đạt",
         'Text(Max(Coalesce(Value(txtThucTe.Text), 0) - Coalesce(Value(txtLoi.Text), 0), 0), "#,##0")', GOOD),
        ("Hoàn thành KH",
         'IfError(Text(Value(txtThucTe.Text) / Value(txtKeHoach.Text), "0.0%"), "-")', PRIMARY),
        ("Tỷ lệ lỗi",
         'IfError(Text(Value(txtLoi.Text) / Value(txtThucTe.Text), "0.00%"), "-")', BAD),
        ("Năng suất (SP/giờ)",
         'IfError(Text(Value(txtThucTe.Text) / Value(txtVanHanh.Text), "#,##0.00"), "-")', ACCENT),
    ]
    cwid = (fw - 68) // 4
    for i, (t, expr, col) in enumerate(calcs):
        x = fx + 34 + i * cwid
        ch.append(lbl("calcT%d" % i, '"%s"' % t, x, cy + 28, cwid - 8, 14,
                      size=10, color=MUTED))
        ch.append(lbl("calcV%d" % i, expr, x, cy + 44, cwid - 8, 24, size=15,
                      color=col, weight="FontWeight.Bold"))

    # ---------- nut lenh
    by = cy + 94
    reload_ind = RELOAD.replace("\n", "\n    ")
    save_fx = """If(
    IsBlank(dpNgay.SelectedDate) || IsBlank(ddFThietBi.Selected.Value) || IsBlank(ddFDayChuyen.Selected.Value) || IsBlank(txtThucTe.Text),
    Notify("Vui lòng nhập đầy đủ Ngày, Thiết bị, Dây chuyền và SL thực tế.", NotificationType.Error),
    Patch(
        {ds},
        If(varLaMoi, Defaults({ds}), varBanGhi),
        {{
            {ma}: "SX-" & Text(dpNgay.SelectedDate, "yyyymmdd") & "-" & ddFDayChuyen.Selected.Value,
            {ngay}: dpNgay.SelectedDate,
            {tb}: ddFThietBi.Selected.Value,
            {kv}: Coalesce(Value(ddFDienAp.Selected.Value), 0),
            {dc}: ddFDayChuyen.Selected.Value,
            {kh}: Coalesce(Value(txtKeHoach.Text), 0),
            {tt}: Coalesce(Value(txtThucTe.Text), 0),
            {loi}: Coalesce(Value(txtLoi.Text), 0),
            {dat}: Max(Coalesce(Value(txtThucTe.Text), 0) - Coalesce(Value(txtLoi.Text), 0), 0),
            {vh}: Coalesce(Value(txtVanHanh.Text), 0),
            {dm}: Coalesce(Value(txtDungMay.Text), 0),
            {kwh}: Coalesce(Value(txtDienNang.Text), 0),
            {gc}: Coalesce(Value(txtGioCong.Text), 0),
            {ht}: IfError(Value(txtThucTe.Text) / Value(txtKeHoach.Text), 0),
            {tl}: IfError(Value(txtLoi.Text) / Value(txtThucTe.Text), 0),
            {ns}: IfError(Value(txtThucTe.Text) / Value(txtVanHanh.Text), 0),
            {tt2}: Coalesce(ddFTrangThai.Selected.Value, "Đạt"),
            {ghichu}: txtGhiChu.Text
        }}
    );
    If(
        IsEmpty(Errors({ds})),
        Notify("Đã lưu bản ghi sản xuất thành công.", NotificationType.Success);
        {reload};
        Set(varLaMoi, true);
        Set(varBanGhi, Defaults({ds}));
        Set(varReset, !varReset),
        Notify("Lưu thất bại - " & First(Errors({ds})).Message, NotificationType.Error)
    )
)""".format(ds=DS, ma=C_MA, ngay=C_NGAY, tb=C_TB, kv=C_KV, dc=C_DC, kh=C_KH,
            tt=C_TT, loi=C_LOI, dat=C_DAT, vh=C_VH, dm=C_DM, kwh=C_KWH, gc=C_GC,
            ht=C_HT, tl=C_TL, ns=C_NS, tt2=C_TT2, ghichu=C_GHICHU, reload=reload_ind)

    new_fx = ("Set(varLaMoi, true);\n"
              "Set(varBanGhi, Defaults(%s));\n"
              "Set(varReset, !varReset)" % DS)

    del_fx = """If(
    varLaMoi,
    Notify("Chưa chọn bản ghi để xoá.", NotificationType.Warning),
    Remove({ds}, varBanGhi);
    Notify("Đã xoá bản ghi.", NotificationType.Success);
    {reload};
    Set(varLaMoi, true);
    Set(varBanGhi, Defaults({ds}));
    Set(varReset, !varReset)
)""".format(ds=DS, reload=reload_ind)

    ch.append(btn("btnMoi", '"Bản ghi mới"', fx + 20, by, 150, 38, new_fx,
                  fill="RGBA(238, 242, 247, 1)", color=PRIMARY))
    ch.append(btn("btnLuu", '"Lưu bản ghi"', fx + 182, by, 190, 38, save_fx, fill=GOOD))
    ch.append(btn("btnXoa", '"Xoá bản ghi"', fx + 384, by, 140, 38, del_fx, fill=BAD))
    ch.append(lbl("nlNote", '"Dữ liệu được ghi trực tiếp vào bảng Dataverse."',
                  fx + 536, by, fw - 556, 38, size=11, color=MUTED, align="Align.Right"))

    return Ctl("scrNhapLieu", "screen",
               {"Fill": BG, "LoadingSpinner": "LoadingSpinner.None"}, ch)


GALLERY_XML = """<?xml version="1.0" encoding="utf-8"?>
<widget xmlns="http://openajax.org/metadata" xmlns:appMagic="http://schemas.microsoft.com/appMagic" name="gallery" id="http://microsoft.com/appmagic/gallery" version="2.15.0">
  <properties />
  <appMagic:nestedWidgets>
    <appMagic:dataControlWidget name="galleryTemplate" id="http://microsoft.com/appmagic/galleryTemplate" version="1.0">
      <properties>
        <property name="TemplateFill" />
      </properties>
    </appMagic:dataControlWidget>
  </appMagic:nestedWidgets>
</widget>
"""


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    for d in ["Src", "Entropy", "pkgs"]:
        os.makedirs(os.path.join(OUT, d))

    app = Ctl("App", "appinfo", {"OnStart": APP_ONSTART})
    write(os.path.join(OUT, "Src", "App.fx.yaml"), "\n".join(emit(app)) + "\n")
    write(os.path.join(OUT, "Src", "scrDashboard.fx.yaml"),
          "\n".join(emit(dashboard())) + "\n")
    write(os.path.join(OUT, "Src", "scrNhapLieu.fx.yaml"),
          "\n".join(emit(nhaplieu())) + "\n")
    shutil.copy(THEME, os.path.join(OUT, "Src", "Themes.json"))
    write(os.path.join(OUT, "Entropy", "Entropy.json"), "{}")
    write(os.path.join(OUT, "pkgs", "gallery_2.15.0.xml"), GALLERY_XML)

    manifest = {
        "FormatVersion": "0.30",
        "ScreenOrder": ["scrDashboard", "scrNhapLieu"],
        "ComponentIndexes": {},
        "Header": {
            "DocVersion": "1.331",
            "MinVersionToLoad": "1.317",
            "MSAppStructureVersion": "2.0",
            "Name": "Sản xuất cao thế",
            "AnalysisOptions": {"DataflowAnalysisEnabled": True,
                                "IsDataflowAnalysisSupported": True,
                                "IsMidBuild": False},
        },
        "Properties": {
            "Author": "",
            "Name": "Sản xuất cao thế",
            "Id": "1d0a6f2c-7c41-4a58-9a1e-3f2b8c7d0011",
            "FileID": "5e2b91d7-0c34-4a1f-88b2-6d4c9e7f0022",
            "DocumentLayoutWidth": W,
            "DocumentLayoutHeight": H,
            "DocumentLayoutOrientation": "landscape",
            "DocumentLayoutScaleToFit": True,
            "DocumentLayoutMaintainAspectRatio": True,
            "DocumentLayoutLockOrientation": True,
            "DocumentAppType": "DesktopOrTablet",
            "DocumentType": "App",
            "AppCreationSource": "AppFromScratch",
            "AppDescription": "Quản lý và theo dõi sản xuất thiết bị điện cao thế",
            "DefaultConnectedDataSourceMaxGetRowsCount": 2000,
            "ContainsThirdPartyPcfControls": False,
            "OriginatingVersion": "1.331",
            # Thieu khoi nay thi Power Apps Studio dung connector "Common Data
            # Service" doi cu (hop thoai "Choose an entity") thay vi Dataverse goc.
            # nativecdsexperimental  -> dung Dataverse goc
            # usedisplaynamemetadata -> tham chieu cot bang display name
            "AppPreviewFlagsMap": {
                "nativecdsexperimental": True,
                "usedisplaynamemetadata": True,
                "useguiddatatypes": True,
                "enablerowscopeonetomany": True,
                "enhanceddelegation": True,
                "errorhandling": True,
                "reliableconcurrent": True,
                "projectionmapping": True,
                "usenonblockingonstartrule": True,
                "delayloadscreens": True,
                "enableappembedding": True,
                "improvedwarningexperience": True,
            },
        },
        "PublishInfo": {"AppName": "Sản xuất cao thế",
                        "BackgroundColor": "RGBA(11,60,109,1)"},
        "AppCheckerResult": None,
    }
    write(os.path.join(OUT, "CanvasManifest.json"),
          json.dumps(manifest, indent=2, ensure_ascii=False))
    print("sources ->", OUT)


if __name__ == "__main__":
    main()
