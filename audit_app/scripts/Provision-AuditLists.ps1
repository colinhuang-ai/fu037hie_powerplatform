<#
.SYNOPSIS
    Tạo toàn bộ SharePoint list / column / index cho Production Zone Audit app.

.DESCRIPTION
    Script idempotent — chạy lại nhiều lần an toàn, list/column đã có sẽ bỏ qua.
    Tạo đúng thứ tự phụ thuộc Lookup: Zones → AuditTemplates → AuditItems
    → AuditRuns → AuditFindings → AuditPhotos.

.PREREQUISITES
    Install-Module PnP.PowerShell -Scope CurrentUser

    PnP.PowerShell 2.x trở lên BẮT BUỘC có Entra app registration riêng —
    app "PnP Management Shell" dùng chung đã bị Microsoft gỡ.
    Đăng ký một lần cho tenant:

        Register-PnPEntraIDAppForInteractiveLogin `
            -ApplicationName "PnP-Audit-Provisioning" `
            -Tenant contoso.onmicrosoft.com `
            -Interactive

    Lệnh trên trả về ClientId — truyền vào tham số -ClientId.

.EXAMPLE
    .\Provision-AuditLists.ps1 `
        -SiteUrl "https://contoso.sharepoint.com/sites/ProductionAudit" `
        -ClientId "11111111-2222-3333-4444-555555555555"

.EXAMPLE
    # Xem trước, không ghi gì
    .\Provision-AuditLists.ps1 -SiteUrl "..." -ClientId "..." -WhatIf
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string] $SiteUrl,

    [Parameter(Mandatory = $true)]
    [string] $ClientId,

    [Parameter()]
    [switch] $IncludeSampleData
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

#region ---------- Helpers ----------

function Write-Step {
    param([string] $Message)
    Write-Host "  → $Message" -ForegroundColor Cyan
}

function Write-Skip {
    param([string] $Message)
    Write-Host "  · $Message (đã có, bỏ qua)" -ForegroundColor DarkGray
}

function Ensure-List {
    <#  Tạo list nếu chưa có. Trả về đối tượng list.  #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory)] [string] $Title,
        [Parameter(Mandatory)] [string] $Template,
        [string] $Description = ''
    )

    $list = Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
    if ($list) {
        Write-Skip "List '$Title'"
        return $list
    }

    if ($PSCmdlet.ShouldProcess($Title, 'New-PnPList')) {
        Write-Step "Tạo list '$Title'"
        $list = New-PnPList -Title $Title -Template $Template `
                            -OnQuickLaunch -EnableVersioning:$false
        if ($Description) {
            Set-PnPList -Identity $Title -Description $Description
        }
    }
    return $list
}

function Ensure-Field {
    <#  Tạo column nếu chưa có trên list.  #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory)] [string] $List,
        [Parameter(Mandatory)] [string] $InternalName,
        [Parameter(Mandatory)] [string] $DisplayName,
        [Parameter(Mandatory)] [string] $Type,
        [string[]] $Choices,
        [hashtable] $Values,
        [switch] $Required,
        [switch] $NoDefaultView
    )

    $existing = Get-PnPField -List $List -Identity $InternalName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Skip "  $List.$InternalName"
        return
    }

    if (-not $PSCmdlet.ShouldProcess("$List.$InternalName", 'Add-PnPField')) { return }

    Write-Step "  + $List.$InternalName ($Type)"

    $addParams = @{
        List         = $List
        InternalName = $InternalName
        DisplayName  = $DisplayName
        Type         = $Type
    }
    if (-not $NoDefaultView) { $addParams['AddToDefaultView'] = $true }
    if ($Required)           { $addParams['Required']         = $true }
    if ($Choices)            { $addParams['Choices']          = $Choices }

    Add-PnPField @addParams | Out-Null

    if ($Values) {
        Set-PnPField -List $List -Identity $InternalName -Values $Values
    }
}

function Ensure-LookupField {
    <#
        Add-PnPField không tạo được Lookup — phải dùng field XML.
        Cần GUID của list đích.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory)] [string] $List,
        [Parameter(Mandatory)] [string] $InternalName,
        [Parameter(Mandatory)] [string] $DisplayName,
        [Parameter(Mandatory)] [string] $TargetList,
        [string] $ShowField = 'Title'
    )

    $existing = Get-PnPField -List $List -Identity $InternalName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Skip "  $List.$InternalName"
        return
    }

    $target = Get-PnPList -Identity $TargetList
    if (-not $target) {
        throw "List đích '$TargetList' chưa tồn tại — sai thứ tự tạo list."
    }

    if (-not $PSCmdlet.ShouldProcess("$List.$InternalName", 'Add-PnPFieldFromXml')) { return }

    Write-Step "  + $List.$InternalName (Lookup → $TargetList)"

    $xml = @"
<Field Type="Lookup"
       DisplayName="$DisplayName"
       Name="$InternalName"
       StaticName="$InternalName"
       List="{$($target.Id)}"
       ShowField="$ShowField"
       Required="FALSE" />
"@

    Add-PnPFieldFromXml -List $List -FieldXml $xml | Out-Null
}

function Ensure-Index {
    <#
        Index PHẢI tạo trước khi list vượt 5000 item.
        Tối đa 20 indexed column / list.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory)] [string] $List,
        [Parameter(Mandatory)] [string[]] $Fields
    )

    foreach ($f in $Fields) {
        if ($PSCmdlet.ShouldProcess("$List.$f", 'Index')) {
            try {
                Set-PnPField -List $List -Identity $f -Values @{ Indexed = $true }
                Write-Step "  ⚑ index $List.$f"
            }
            catch {
                Write-Warning "Không index được $List.$f : $($_.Exception.Message)"
            }
        }
    }
}

# DisplayFormat cho DateTime: 0 = Date only, 1 = Date & Time
$DateOnly = @{ DisplayFormat = 0 }
$DateTime = @{ DisplayFormat = 1 }
# Note field: tắt Rich text — Power Apps xử lý HTML rất tệ
$PlainNote = @{ RichText = $false; NumberOfLines = 6 }

#endregion

#region ---------- Connect ----------

Write-Host "`nKết nối $SiteUrl" -ForegroundColor Yellow
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId
Write-Host "Đã kết nối: $((Get-PnPSite).Url)`n" -ForegroundColor Green

#endregion

#region ---------- 1. Zones ----------

Write-Host "[1/6] Zones" -ForegroundColor Yellow
Ensure-List -Title 'Zones' -Template GenericList `
            -Description 'Danh mục khu vực sản xuất'

Ensure-Field -List 'Zones' -InternalName 'ZoneCode'    -DisplayName 'Zone Code'   -Type Text -Required
Ensure-Field -List 'Zones' -InternalName 'Description' -DisplayName 'Description' -Type Note -Values $PlainNote
Ensure-Field -List 'Zones' -InternalName 'Building'    -DisplayName 'Building'    -Type Choice `
             -Choices 'Factory 1','Factory 2','Warehouse','Utility'
Ensure-Field -List 'Zones' -InternalName 'ZoneManager'      -DisplayName 'Zone Manager'       -Type User
Ensure-Field -List 'Zones' -InternalName 'ZoneManagerEmail' -DisplayName 'Zone Manager Email' -Type Text
Ensure-Field -List 'Zones' -InternalName 'IsActive'         -DisplayName 'Is Active'          -Type Boolean `
             -Values @{ DefaultValue = '1' }

Ensure-Index -List 'Zones' -Fields 'ZoneCode','IsActive'

#endregion

#region ---------- 2. AuditTemplates ----------

Write-Host "`n[2/6] AuditTemplates" -ForegroundColor Yellow
Ensure-List -Title 'AuditTemplates' -Template GenericList `
            -Description 'Bộ tiêu chuẩn kiểm tra (5S, Safety, …)'

Ensure-Field -List 'AuditTemplates' -InternalName 'Category' -DisplayName 'Category' -Type Choice `
             -Choices '5S','Safety','Quality','Environment','Maintenance'
Ensure-Field -List 'AuditTemplates' -InternalName 'Version'  -DisplayName 'Version'  -Type Text
Ensure-Field -List 'AuditTemplates' -InternalName 'IsActive' -DisplayName 'Is Active' -Type Boolean `
             -Values @{ DefaultValue = '1' }

#endregion

#region ---------- 3. AuditItems ----------

Write-Host "`n[3/6] AuditItems" -ForegroundColor Yellow
Ensure-List -Title 'AuditItems' -Template GenericList `
            -Description 'Câu hỏi checklist'

# Title mặc định là Text 255 ký tự — câu hỏi dài hơn thế là bình thường.
# Không đổi được kiểu của Title, nên thêm cột Note riêng nếu cần câu hỏi dài.
Ensure-LookupField -List 'AuditItems' -InternalName 'Template' -DisplayName 'Template' -TargetList 'AuditTemplates'
Ensure-Field -List 'AuditItems' -InternalName 'TemplateId'  -DisplayName 'Template Id'  -Type Number
Ensure-Field -List 'AuditItems' -InternalName 'OrderNumber' -DisplayName 'Order Number' -Type Number
Ensure-Field -List 'AuditItems' -InternalName 'Guidance'    -DisplayName 'Guidance'     -Type Note -Values $PlainNote
Ensure-Field -List 'AuditItems' -InternalName 'IsCritical'  -DisplayName 'Is Critical'  -Type Boolean
Ensure-Field -List 'AuditItems' -InternalName 'IsActive'    -DisplayName 'Is Active'    -Type Boolean `
             -Values @{ DefaultValue = '1' }

Ensure-Index -List 'AuditItems' -Fields 'TemplateId','OrderNumber'

#endregion

#region ---------- 4. AuditRuns ----------

Write-Host "`n[4/6] AuditRuns" -ForegroundColor Yellow
Ensure-List -Title 'AuditRuns' -Template GenericList `
            -Description 'Mỗi lần đi audit một Zone'

Ensure-LookupField -List 'AuditRuns' -InternalName 'Zone'     -DisplayName 'Zone'     -TargetList 'Zones'
Ensure-LookupField -List 'AuditRuns' -InternalName 'Template' -DisplayName 'Template' -TargetList 'AuditTemplates'

Ensure-Field -List 'AuditRuns' -InternalName 'ZoneId'       -DisplayName 'Zone Id'       -Type Number
Ensure-Field -List 'AuditRuns' -InternalName 'ZoneCode'     -DisplayName 'Zone Code'     -Type Text
Ensure-Field -List 'AuditRuns' -InternalName 'TemplateId'   -DisplayName 'Template Id'   -Type Number
Ensure-Field -List 'AuditRuns' -InternalName 'Auditor'      -DisplayName 'Auditor'       -Type User
Ensure-Field -List 'AuditRuns' -InternalName 'AuditorEmail' -DisplayName 'Auditor Email' -Type Text
Ensure-Field -List 'AuditRuns' -InternalName 'AuditDate'    -DisplayName 'Audit Date'    -Type DateTime -Values $DateTime
Ensure-Field -List 'AuditRuns' -InternalName 'TotalItems'   -DisplayName 'Total Items'   -Type Number
Ensure-Field -List 'AuditRuns' -InternalName 'PassCount'    -DisplayName 'Pass Count'    -Type Number
Ensure-Field -List 'AuditRuns' -InternalName 'FailCount'    -DisplayName 'Fail Count'    -Type Number
Ensure-Field -List 'AuditRuns' -InternalName 'NACount'      -DisplayName 'NA Count'      -Type Number
Ensure-Field -List 'AuditRuns' -InternalName 'Score'        -DisplayName 'Score'         -Type Number `
             -Values @{ DisplayFormat = 2 }   # 2 chữ số thập phân
Ensure-Field -List 'AuditRuns' -InternalName 'Status'       -DisplayName 'Status'        -Type Choice `
             -Choices 'Draft','Submitted','Completed' -Values @{ DefaultValue = 'Draft' }
Ensure-Field -List 'AuditRuns' -InternalName 'GeneralNotes' -DisplayName 'General Notes' -Type Note -Values $PlainNote

Ensure-Index -List 'AuditRuns' -Fields 'ZoneId','AuditorEmail','AuditDate','Status'

#endregion

#region ---------- 5. AuditFindings ----------

Write-Host "`n[5/6] AuditFindings" -ForegroundColor Yellow
Ensure-List -Title 'AuditFindings' -Template GenericList `
            -Description 'Lỗi phát hiện khi audit — list lớn nhất'

Ensure-LookupField -List 'AuditFindings' -InternalName 'AuditRun'  -DisplayName 'Audit Run'  -TargetList 'AuditRuns'
Ensure-LookupField -List 'AuditFindings' -InternalName 'AuditItem' -DisplayName 'Audit Item' -TargetList 'AuditItems'

Ensure-Field -List 'AuditFindings' -InternalName 'AuditRunId'      -DisplayName 'Audit Run Id'      -Type Number
Ensure-Field -List 'AuditFindings' -InternalName 'AuditItemId'     -DisplayName 'Audit Item Id'     -Type Number
Ensure-Field -List 'AuditFindings' -InternalName 'QuestionText'    -DisplayName 'Question Text'     -Type Note -Values $PlainNote
Ensure-Field -List 'AuditFindings' -InternalName 'ZoneCode'        -DisplayName 'Zone Code'         -Type Text
Ensure-Field -List 'AuditFindings' -InternalName 'Description'     -DisplayName 'Description'       -Type Note -Values $PlainNote
Ensure-Field -List 'AuditFindings' -InternalName 'Severity'        -DisplayName 'Severity'          -Type Choice `
             -Choices 'Low','Medium','High','Critical' -Values @{ DefaultValue = 'Medium' }
Ensure-Field -List 'AuditFindings' -InternalName 'Status'          -DisplayName 'Status'            -Type Choice `
             -Choices 'Open','In Progress','Resolved','Closed','Rejected' -Values @{ DefaultValue = 'Open' }
Ensure-Field -List 'AuditFindings' -InternalName 'AssignedTo'      -DisplayName 'Assigned To'       -Type User
Ensure-Field -List 'AuditFindings' -InternalName 'AssignedToEmail' -DisplayName 'Assigned To Email' -Type Text
Ensure-Field -List 'AuditFindings' -InternalName 'DueDate'         -DisplayName 'Due Date'          -Type DateTime -Values $DateOnly
Ensure-Field -List 'AuditFindings' -InternalName 'BeforeImageUrl'  -DisplayName 'Before Image Url'  -Type Text -NoDefaultView
Ensure-Field -List 'AuditFindings' -InternalName 'AfterImageUrl'   -DisplayName 'After Image Url'   -Type Text -NoDefaultView
Ensure-Field -List 'AuditFindings' -InternalName 'ResolutionNotes' -DisplayName 'Resolution Notes'  -Type Note -Values $PlainNote
Ensure-Field -List 'AuditFindings' -InternalName 'ResolvedDate'    -DisplayName 'Resolved Date'     -Type DateTime -Values $DateTime
Ensure-Field -List 'AuditFindings' -InternalName 'ClosedBy'        -DisplayName 'Closed By'         -Type User
Ensure-Field -List 'AuditFindings' -InternalName 'ClosedDate'      -DisplayName 'Closed Date'       -Type DateTime -Values $DateTime
Ensure-Field -List 'AuditFindings' -InternalName 'RejectReason'    -DisplayName 'Reject Reason'     -Type Note -Values $PlainNote

Ensure-Index -List 'AuditFindings' `
             -Fields 'AuditRunId','AssignedToEmail','Status','DueDate','ZoneCode','Severity'

#endregion

#region ---------- 6. AuditPhotos (Document Library) ----------

Write-Host "`n[6/6] AuditPhotos" -ForegroundColor Yellow
Ensure-List -Title 'AuditPhotos' -Template DocumentLibrary `
            -Description 'Ảnh Before/After của findings'

Ensure-Field -List 'AuditPhotos' -InternalName 'FindingId' -DisplayName 'Finding Id' -Type Number
Ensure-Field -List 'AuditPhotos' -InternalName 'Phase'     -DisplayName 'Phase'      -Type Choice `
             -Choices 'Before','After'

Ensure-Index -List 'AuditPhotos' -Fields 'FindingId'

#endregion

#region ---------- Sample data ----------

if ($IncludeSampleData) {
    Write-Host "`n[+] Nạp dữ liệu mẫu" -ForegroundColor Yellow

    if ($PSCmdlet.ShouldProcess('Sample data', 'Add-PnPListItem')) {

        $zones = @(
            @{ Title = 'Zone A — Assembly Line 1'; ZoneCode = 'ZA-01'; Building = 'Factory 1' }
            @{ Title = 'Zone B — Injection Molding'; ZoneCode = 'ZB-02'; Building = 'Factory 1' }
            @{ Title = 'Zone C — Packing & Labeling'; ZoneCode = 'ZC-03'; Building = 'Factory 2' }
            @{ Title = 'Zone D — Raw Material Store'; ZoneCode = 'ZD-04'; Building = 'Warehouse' }
            @{ Title = 'Zone E — Compressor Room'; ZoneCode = 'ZE-05'; Building = 'Utility' }
        )
        foreach ($z in $zones) {
            if (-not (Get-PnPListItem -List 'Zones' -Query "<View><Query><Where><Eq><FieldRef Name='ZoneCode'/><Value Type='Text'>$($z.ZoneCode)</Value></Eq></Where></Query></View>")) {
                Add-PnPListItem -List 'Zones' -Values ($z + @{ IsActive = $true }) | Out-Null
                Write-Step "Zone $($z.ZoneCode)"
            }
        }

        $tplTitle = '5S Daily Checklist'
        $tpl = Get-PnPListItem -List 'AuditTemplates' `
                 -Query "<View><Query><Where><Eq><FieldRef Name='Title'/><Value Type='Text'>$tplTitle</Value></Eq></Where></Query></View>"
        if (-not $tpl) {
            $tpl = Add-PnPListItem -List 'AuditTemplates' -Values @{
                Title = $tplTitle; Category = '5S'; Version = 'v1.0'; IsActive = $true
            }
            Write-Step "Template '$tplTitle'"
        }
        $tplId = $tpl.Id

        $questions = @(
            @{ q = 'Toàn bộ thiết bị an toàn có được lắp đặt đúng và ở tình trạng tốt?'; crit = $true }
            @{ q = 'Lối thoát hiểm có thông thoáng, không bị vật cản?';                   crit = $true }
            @{ q = 'Khu vực làm việc có sạch, không có vật liệu rơi vãi hay rác thải?';   crit = $false }
            @{ q = 'Hệ thống điện hoạt động bình thường, không có dây hở hay ổ cắm quá tải?'; crit = $true }
            @{ q = 'Dụng cụ và đồ nghề có được cất đúng vị trí quy định sau khi dùng?';   crit = $false }
            @{ q = 'Biển báo và vạch kẻ sàn còn rõ ràng, dễ đọc?';                        crit = $false }
            @{ q = 'Bình chữa cháy còn hạn kiểm định và không bị chắn lối tiếp cận?';     crit = $true }
            @{ q = 'Nhân viên trong khu vực có mang đầy đủ PPE theo quy định?';           crit = $true }
        )

        $order = 10
        foreach ($item in $questions) {
            $exists = Get-PnPListItem -List 'AuditItems' `
                        -Query "<View><Query><Where><And><Eq><FieldRef Name='TemplateId'/><Value Type='Number'>$tplId</Value></Eq><Eq><FieldRef Name='OrderNumber'/><Value Type='Number'>$order</Value></Eq></And></Where></Query></View>"
            if (-not $exists) {
                Add-PnPListItem -List 'AuditItems' -Values @{
                    Title       = $item.q
                    Template    = $tplId
                    TemplateId  = $tplId
                    OrderNumber = $order
                    IsCritical  = $item.crit
                    IsActive    = $true
                } | Out-Null
                Write-Step "Q$order"
            }
            $order += 10
        }
    }
}

#endregion

Write-Host "`n✅ Hoàn tất." -ForegroundColor Green
Write-Host @"

Bước tiếp theo:
  1. Mở $SiteUrl kiểm tra các list vừa tạo.
  2. Tạo 3 SharePoint group: 'Audit - Auditors', 'Audit - Fixers', 'Audit - Managers'
     và gán quyền theo docs/01-schema-sharepoint.md §8.
  3. Trong Power Apps, thêm data source SharePoint trỏ tới site này.

"@ -ForegroundColor Gray

Disconnect-PnPOnline
