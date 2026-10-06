# GujRERA public data used by the banner generator

These are all public calls with no login. The server allows cross-origin requests (`Access-Control-Allow-Origin: *`), so the local HTML tool can call them directly. The base URL is `https://gujrera.gujarat.gov.in`. Checked on 30-09-2026.

| Purpose | Call | Fields used |
|---|---|---|
| Find project by reg. no. or name | `POST /project_reg/public/global-search` with body `{"query": "...", "startWith": 0, "dataSize": 25}` | `data[].entityId` (project ID), `entityName`, `regNo`, `entityType == "PROJECT"`, `ptype`, `pdate` |
| Core details | `GET /project_reg/public/alldatabyprojectid/{id}` | `projRegNo`, `projectName`, `promoterName`, `promoterEmailId`, `promoterMobileNo`, `projectType`, `promoterId`, `formOneId`, `formThreeId`, `certificateUid` |
| RERA collection account | `GET /project_reg/public/bank/get_col_account/{id}` | `accountName`, `accountNumber` |
| Dates / blocks | `GET /project_reg/public/project-app/get-project-details-for-qpr/{id}` | `endDateAsPerExtension`, `endDateAtTimeOfRegistrationStr`, `inventoryCountDetails[]`, `internalDevDetails[]` |
| Authorised signatory | `GET /user_reg/promoter/promoter{promoterId}` (promoterId from the core details) | `authorizedSignatoryList[]` → `authsignFirstName`, `authsignMiddleName`, `authsignLastName` (names only; PAN and address are not used) |
| Units per block and use | `GET /formthree/public/getform-three-byid/{formThreeId}` | `formThreeAList[]` → `blockName`, `usage` (Flat / Residential / Shop / Office) |
| Project loan | `GET /formthree/public/getform-three-loan-details/{formThreeId}` | `data[].lenderName`; an empty list means no loan |
| Amenities | `GET /formone/public/getfrom-one-byformone-id/{formOneId}` | `formOneB.*YesNo` facility flags (e.g. `internalRoadYesNo`, `landscapingYesNo`, `fireFightingYesNo`) |
| Specification figures | `GET /project_reg/public/getproject-details/{id}` and `GET /project_reg/project-app/getproject-blocklist/{id}` | `projectDetail` (type, description, land / carpet area, parking); blocks (`height`, `builtupArea`) |
| Promoter's specification PDF | `GET /project_reg/public/getproject-doc/{id}` | `projectSpecificDocUId`, opened via `/vdms/download/{uid}` |
| Registration certificate PDF | `GET /vdms/download/{certificateUid}` | Official certificate with its QR code |
| Public project page (QR link) | `https://gujrera.gujarat.gov.in/#/project-preview?id=` followed by base64(project ID) | Same link that is embedded in the certificate QR |

All 15 Annexure fields come from these sources. The promoter's own specification document is only a PDF (often scanned), so the specifications are compiled from the registered figures above.
