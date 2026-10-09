# -*- coding: utf-8 -*-
"""Sinh solution Dataverse (unmanaged) chua bang 'San xuat cao the'."""
import os, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))

PREFIX = "mfg"
ENTITY = "mfg_ProductionRecord"        # schema name
ELOGIC = "mfg_productionrecord"        # logical name
ESET = "mfg_productionrecords"         # entity set name (Web API)
TABLE_DISPLAY = "Sản xuất cao thế"
TABLE_PLURAL = "Sản xuất cao thế"

# (schema, display, kind, opts)
COLS = [
    ("mfg_Name",            "Mã bản ghi",       "text",    {"len": 120, "primary": True}),
    ("mfg_ProductionDate",  "Ngày sản xuất",    "date",    {}),
    ("mfg_Equipment",       "Thiết bị",         "text",    {"len": 100}),
    ("mfg_VoltageLevel",    "Cấp điện áp",      "int",     {"min": 0, "max": 1000}),
    ("mfg_Line",            "Dây chuyền",       "text",    {"len": 50}),
    ("mfg_PlannedQty",      "SL kế hoạch",      "int",     {"min": 0, "max": 1000000}),
    ("mfg_ActualQty",       "SL thực tế",       "int",     {"min": 0, "max": 1000000}),
    ("mfg_DefectQty",       "SP lỗi",           "int",     {"min": 0, "max": 1000000}),
    ("mfg_GoodQty",         "SP đạt",           "int",     {"min": 0, "max": 1000000}),
    ("mfg_RunHours",        "Giờ vận hành",     "dec",     {"acc": 2, "min": 0, "max": 100000}),
    ("mfg_DowntimeHours",   "Giờ dừng máy",     "dec",     {"acc": 2, "min": 0, "max": 100000}),
    ("mfg_EnergyKwh",       "Điện năng",        "dec",     {"acc": 2, "min": 0, "max": 100000000}),
    ("mfg_LaborHours",      "Giờ công",         "dec",     {"acc": 2, "min": 0, "max": 100000}),
    ("mfg_PlanAttainment",  "Hoàn thành KH",    "dec",     {"acc": 4, "min": 0, "max": 100}),
    ("mfg_DefectRate",      "Tỷ lệ lỗi",        "dec",     {"acc": 4, "min": 0, "max": 100}),
    ("mfg_Productivity",    "Năng suất",        "dec",     {"acc": 4, "min": 0, "max": 100000}),
    ("mfg_Status",          "Trạng thái",       "text",    {"len": 50}),
    ("mfg_Note",            "Ghi chú",          "memo",    {"len": 2000}),
]

COMMON = """      <RequiredLevel>{req}</RequiredLevel>
      <DisplayMask>{mask}</DisplayMask>
      <ImeMode>auto</ImeMode>
      <ValidForUpdateApi>1</ValidForUpdateApi>
      <ValidForReadApi>1</ValidForReadApi>
      <ValidForCreateApi>1</ValidForCreateApi>
      <IsCustomField>1</IsCustomField>
      <IsAuditEnabled>0</IsAuditEnabled>
      <IsSecured>0</IsSecured>
      <IntroducedVersion>1.0.0.0</IntroducedVersion>
      <IsCustomizable>1</IsCustomizable>
      <IsRenameable>1</IsRenameable>
      <CanModifySearchSettings>1</CanModifySearchSettings>
      <CanModifyRequirementLevelSettings>1</CanModifyRequirementLevelSettings>
      <CanModifyAdditionalSettings>1</CanModifyAdditionalSettings>
      <IsGlobalFilterEnabled>0</IsGlobalFilterEnabled>
      <IsSortableEnabled>0</IsSortableEnabled>
      <IsDataSourceSecret>0</IsDataSourceSecret>
      <SourceType>0</SourceType>
      <IsSearchable>0</IsSearchable>
      <IsFilterable>0</IsFilterable>
      <IsRetrievable>0</IsRetrievable>
      <IsLocalizable>0</IsLocalizable>"""


def attr_xml(schema, display, kind, opts):
    logical = schema.lower()
    primary = opts.get("primary", False)
    mask = "ValidForAdvancedFind|ValidForForm|ValidForGrid"
    if primary:
        mask = "PrimaryName|ValidForAdvancedFind|ValidForForm|ValidForGrid"
    req = "none"
    head = ('    <attribute PhysicalName="%s">\n'
            '      <Type>%s</Type>\n'
            '      <Name>%s</Name>\n'
            '      <LogicalName>%s</LogicalName>\n')
    body = COMMON.format(req=req, mask=mask)
    if kind == "text":
        # Dataverse doc thuoc tinh do dai chuoi tu <MaxLength>, khong phai <Length>.
        x = head % (schema, "nvarchar", logical, logical) + body + (
            "\n      <MaxLength>%d</MaxLength>"
            "\n      <Format>text</Format>" % opts.get("len", 100))
    elif kind == "memo":
        x = head % (schema, "ntext", logical, logical) + body + (
            "\n      <MaxLength>%d</MaxLength>"
            "\n      <Format>textarea</Format>" % opts.get("len", 2000))
    elif kind == "int":
        x = head % (schema, "int", logical, logical) + body + (
            "\n      <MinValue>%d</MinValue>"
            "\n      <MaxValue>%d</MaxValue>"
            "\n      <Format>none</Format>" % (opts.get("min", -2147483648),
                                               opts.get("max", 2147483647)))
    elif kind == "dec":
        # Min/Max cua decimal ghi kem so le dung bang Accuracy, giong solution export that.
        acc = opts.get("acc", 2)
        fmt = "%%.%df" % acc
        x = head % (schema, "decimal", logical, logical) + body + (
            "\n      <MinValue>%s</MinValue>"
            "\n      <MaxValue>%s</MaxValue>"
            "\n      <Accuracy>%d</Accuracy>" % (fmt % opts.get("min", 0),
                                                 fmt % opts.get("max", 100000),
                                                 acc))
    elif kind == "date":
        # <Format> cua cot datetime chi nhan 'date' (Date Only) hoac 'datetime'.
        # <Behavior> 1=UserLocal, 2=DateOnly, 3=TimeZoneIndependent.
        x = head % (schema, "datetime", logical, logical) + body + (
            "\n      <Format>date</Format>"
            "\n      <Behavior>2</Behavior>"
            "\n      <CanChangeDateTimeBehavior>1</CanChangeDateTimeBehavior>")
    else:
        raise ValueError(kind)
    x += ("\n      <displaynames>"
          '\n        <displayname description="%s" languagecode="1033" />'
          "\n      </displaynames>"
          "\n      <Descriptions>"
          '\n        <Description description="" languagecode="1033" />'
          "\n      </Descriptions>"
          "\n    </attribute>" % display)
    return x


PK_ATTR = """    <attribute PhysicalName="{e}Id">
      <Type>primarykey</Type>
      <Name>{l}id</Name>
      <LogicalName>{l}id</LogicalName>
      <RequiredLevel>systemrequired</RequiredLevel>
      <DisplayMask>ValidForAdvancedFind|ValidForGrid</DisplayMask>
      <ImeMode>auto</ImeMode>
      <ValidForUpdateApi>0</ValidForUpdateApi>
      <ValidForReadApi>1</ValidForReadApi>
      <ValidForCreateApi>1</ValidForCreateApi>
      <IsCustomField>1</IsCustomField>
      <IsAuditEnabled>0</IsAuditEnabled>
      <IsSecured>0</IsSecured>
      <IntroducedVersion>1.0.0.0</IntroducedVersion>
      <IsCustomizable>1</IsCustomizable>
      <IsRenameable>1</IsRenameable>
      <CanModifySearchSettings>0</CanModifySearchSettings>
      <CanModifyRequirementLevelSettings>0</CanModifyRequirementLevelSettings>
      <CanModifyAdditionalSettings>1</CanModifyAdditionalSettings>
      <IsGlobalFilterEnabled>0</IsGlobalFilterEnabled>
      <IsSortableEnabled>0</IsSortableEnabled>
      <IsDataSourceSecret>0</IsDataSourceSecret>
      <SourceType>0</SourceType>
      <IsSearchable>0</IsSearchable>
      <IsFilterable>0</IsFilterable>
      <IsRetrievable>0</IsRetrievable>
      <IsLocalizable>0</IsLocalizable>
      <displaynames>
        <displayname description="{d}" languagecode="1033" />
      </displaynames>
      <Descriptions>
        <Description description="" languagecode="1033" />
      </Descriptions>
    </attribute>""".format(e=ENTITY, l=ELOGIC, d="Mã định danh")


def customizations():
    attrs = [PK_ATTR] + [attr_xml(*c) for c in COLS]
    return """<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml version="9.2.23064.176" SolutionPackageVersion="9.2" languagecode="1033" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Entities>
    <Entity>
      <Name LocalizedName="{disp}" OriginalName="{disp}">{schema}</Name>
      <EntityInfo>
        <entity Name="{schema}">
          <LocalizedNames>
            <LocalizedName description="{disp}" languagecode="1033" />
          </LocalizedNames>
          <LocalizedCollectionNames>
            <LocalizedCollectionName description="{plural}" languagecode="1033" />
          </LocalizedCollectionNames>
          <Descriptions>
            <Description description="Dữ liệu sản xuất thiết bị điện cao thế theo ngày" languagecode="1033" />
          </Descriptions>
          <attributes>
{attrs}
          </attributes>
          <EntitySetName>{eset}</EntitySetName>
          <IsDuplicateCheckSupported>1</IsDuplicateCheckSupported>
          <IsRenameable>1</IsRenameable>
          <IsCustomizable>1</IsCustomizable>
          <IsMappable>1</IsMappable>
          <IsCustomEntity>1</IsCustomEntity>
          <IsAuditEnabled>0</IsAuditEnabled>
          <IsRetrieveAuditEnabled>0</IsRetrieveAuditEnabled>
          <IsRetrieveMultipleAuditEnabled>0</IsRetrieveMultipleAuditEnabled>
          <IsActivity>0</IsActivity>
          <IsAvailableOffline>1</IsAvailableOffline>
          <IsChildEntity>0</IsChildEntity>
          <IsDocumentManagementEnabled>0</IsDocumentManagementEnabled>
          <IsConnectionsEnabled>0</IsConnectionsEnabled>
          <IsAvailableOfflineSyncEnabled>0</IsAvailableOfflineSyncEnabled>
          <IsMailMergeEnabled>0</IsMailMergeEnabled>
          <IsVisibleInMobile>1</IsVisibleInMobile>
          <IsVisibleInMobileClient>1</IsVisibleInMobileClient>
          <IsReadOnlyInMobileClient>0</IsReadOnlyInMobileClient>
          <IsOfflineInMobileClient>1</IsOfflineInMobileClient>
          <IsQuickCreateEnabled>1</IsQuickCreateEnabled>
          <IsBusinessProcessEnabled>0</IsBusinessProcessEnabled>
          <IsEnabledForCharts>1</IsEnabledForCharts>
          <IsEnabledForTrace>0</IsEnabledForTrace>
          <IsValidForAdvancedFind>1</IsValidForAdvancedFind>
          <OwnershipTypeMask>UserOwned</OwnershipTypeMask>
          <IsInteractionCentricEnabled>0</IsInteractionCentricEnabled>
          <IsKnowledgeManagementEnabled>0</IsKnowledgeManagementEnabled>
          <IsSLAEnabled>0</IsSLAEnabled>
          <AutoRouteToOwnerQueue>0</AutoRouteToOwnerQueue>
          <IsMSTeamsIntegrationEnabled>0</IsMSTeamsIntegrationEnabled>
          <IntroducedVersion>1.0.0.0</IntroducedVersion>
          <HasRelatedNotes>0</HasRelatedNotes>
          <HasRelatedActivities>0</HasRelatedActivities>
          <IsSolutionAware>0</IsSolutionAware>
          <EnforceStateTransitions>0</EnforceStateTransitions>
          <IconSmallName>/WebResources/msdyn_/Icons/SVG/Entity/Table.svg</IconSmallName>
        </entity>
      </EntityInfo>
    </Entity>
  </Entities>
  <Roles />
  <Workflows />
  <FieldSecurityProfiles />
  <Templates />
  <EntityMaps />
  <EntityRelationships />
  <OrganizationSettings />
  <optionsets />
  <CustomControls />
  <SolutionPluginAssemblies />
  <EntityDataProviders />
  <Languages>
    <Language>1033</Language>
  </Languages>
</ImportExportXml>
""".format(disp=TABLE_DISPLAY, plural=TABLE_PLURAL, schema=ENTITY, eset=ESET,
           attrs="\n".join(attrs))


SOLUTION = """<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml version="9.2.23064.176" SolutionPackageVersion="9.2" languagecode="1033" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SolutionManifest>
    <UniqueName>SanXuatCaoThe</UniqueName>
    <LocalizedNames>
      <LocalizedName description="Sản xuất cao thế" languagecode="1033" />
    </LocalizedNames>
    <Descriptions>
      <Description description="Bảng Dataverse cho ứng dụng theo dõi sản xuất thiết bị điện cao thế" languagecode="1033" />
    </Descriptions>
    <Version>1.0.0.2</Version>
    <Managed>0</Managed>
    <Publisher>
      <UniqueName>manufacturingdemo</UniqueName>
      <LocalizedNames>
        <LocalizedName description="Manufacturing Demo" languagecode="1033" />
      </LocalizedNames>
      <Descriptions>
        <Description description="Publisher cho demo san xuat" languagecode="1033" />
      </Descriptions>
      <EMailAddress xsi:nil="true"></EMailAddress>
      <SupportingWebsiteUrl xsi:nil="true"></SupportingWebsiteUrl>
      <CustomizationPrefix>mfg</CustomizationPrefix>
      <CustomizationOptionValuePrefix>39420</CustomizationOptionValuePrefix>
      <Addresses>
        <Address>
          <AddressNumber>1</AddressNumber>
          <AddressTypeCode>1</AddressTypeCode>
          <City xsi:nil="true"></City>
          <County xsi:nil="true"></County>
          <Country xsi:nil="true"></Country>
          <Fax xsi:nil="true"></Fax>
          <FreightTermsCode xsi:nil="true"></FreightTermsCode>
          <ImportSequenceNumber xsi:nil="true"></ImportSequenceNumber>
          <Latitude xsi:nil="true"></Latitude>
          <Line1 xsi:nil="true"></Line1>
          <Line2 xsi:nil="true"></Line2>
          <Line3 xsi:nil="true"></Line3>
          <Longitude xsi:nil="true"></Longitude>
          <Name xsi:nil="true"></Name>
          <PostalCode xsi:nil="true"></PostalCode>
          <PostOfficeBox xsi:nil="true"></PostOfficeBox>
          <PrimaryContactName xsi:nil="true"></PrimaryContactName>
          <ShippingMethodCode>1</ShippingMethodCode>
          <StateOrProvince xsi:nil="true"></StateOrProvince>
          <Telephone1 xsi:nil="true"></Telephone1>
          <Telephone2 xsi:nil="true"></Telephone2>
          <Telephone3 xsi:nil="true"></Telephone3>
          <TimeZoneRuleVersionNumber xsi:nil="true"></TimeZoneRuleVersionNumber>
          <UPSZone xsi:nil="true"></UPSZone>
          <UTCOffset xsi:nil="true"></UTCOffset>
          <UTCConversionTimeZoneCode xsi:nil="true"></UTCConversionTimeZoneCode>
        </Address>
        <Address>
          <AddressNumber>2</AddressNumber>
          <AddressTypeCode>1</AddressTypeCode>
          <City xsi:nil="true"></City>
          <County xsi:nil="true"></County>
          <Country xsi:nil="true"></Country>
          <Fax xsi:nil="true"></Fax>
          <FreightTermsCode xsi:nil="true"></FreightTermsCode>
          <ImportSequenceNumber xsi:nil="true"></ImportSequenceNumber>
          <Latitude xsi:nil="true"></Latitude>
          <Line1 xsi:nil="true"></Line1>
          <Line2 xsi:nil="true"></Line2>
          <Line3 xsi:nil="true"></Line3>
          <Longitude xsi:nil="true"></Longitude>
          <Name xsi:nil="true"></Name>
          <PostalCode xsi:nil="true"></PostalCode>
          <PostOfficeBox xsi:nil="true"></PostOfficeBox>
          <PrimaryContactName xsi:nil="true"></PrimaryContactName>
          <ShippingMethodCode>1</ShippingMethodCode>
          <StateOrProvince xsi:nil="true"></StateOrProvince>
          <Telephone1 xsi:nil="true"></Telephone1>
          <Telephone2 xsi:nil="true"></Telephone2>
          <Telephone3 xsi:nil="true"></Telephone3>
          <TimeZoneRuleVersionNumber xsi:nil="true"></TimeZoneRuleVersionNumber>
          <UPSZone xsi:nil="true"></UPSZone>
          <UTCOffset xsi:nil="true"></UTCOffset>
          <UTCConversionTimeZoneCode xsi:nil="true"></UTCConversionTimeZoneCode>
        </Address>
      </Addresses>
    </Publisher>
    <RootComponents>
      <RootComponent type="1" schemaName="{schema}" behavior="0" />
    </RootComponents>
    <MissingDependencies />
  </SolutionManifest>
</ImportExportXml>
""".format(schema=ENTITY)

CONTENT_TYPES = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="text/xml" />
</Types>
"""


def main():
    out = os.path.join(HERE, "SanXuatCaoThe_Solution_1_0_0_2.zip")
    files = {
        "solution.xml": SOLUTION,
        "customizations.xml": customizations(),
        "[Content_Types].xml": CONTENT_TYPES,
    }
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for name, text in files.items():
            z.writestr(name, text.encode("utf-8"))
    print("solution ->", out)


if __name__ == "__main__":
    main()
