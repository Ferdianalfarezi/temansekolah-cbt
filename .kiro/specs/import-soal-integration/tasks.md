# Implementation Plan: Import Soal Excel Integration

## Overview

This implementation integrates the existing `ImportSoalModal.vue` component with backend APIs for importing soal from Excel files. The backend endpoints and frontend API client already exist; this task focuses on wiring them together in the Vue component.

The component currently has placeholder code with TODO comments. We will replace these with actual API calls to `downloadTemplate()`, `importSoalPreview()`, and `importSoal()` from `@/api/bank-soal.ts`.

## Tasks

- [ ] 1. Integrate Download Template Function
  - [ ] 1.1 Add API imports and replace downloadTemplate function
    - Import `downloadTemplate as downloadTemplateApi` and `getErrorMessage` from `@/api/bank-soal`
    - Replace local `downloadTemplate()` function body to call the API
    - Add try-catch wrapper to handle errors and display in `parseError.value`
    - Remove the old static file URL approach
    - _Requirements: 1_

- [ ] 2. Integrate Preview API Call
  - [ ] 2.1 Replace parseExcelFile with actual API call
    - Import `importSoalPreview` from `@/api/bank-soal`
    - Remove the simulated delay (`await new Promise...`)
    - Call `importSoalPreview(props.bankSoalId, file)` with the uploaded file
    - Map API response `response.data.validRows` to `validRows.value`
    - Map API response `response.data.errors` to `errors.value`
    - Handle API errors with `getErrorMessage()` and display in `parseError.value`
    - Only transition to Step 2 (`currentStep.value = 2`) on successful parsing
    - _Requirements: 2, 5_

- [ ] 3. Integrate Import Commit API Call
  - [ ] 3.1 Replace confirmImport with actual API call
    - Import `importSoal` from `@/api/bank-soal`
    - Remove the simulated delay
    - Call `importSoal(props.bankSoalId, selectedFile.value)` to commit import
    - On success: emit `imported` event with `response.data.imported` count
    - On success: call `handleClose()` to close modal
    - On failure: display error in `parseError.value` using `getErrorMessage()`
    - Keep `importing.value` loading state management as-is
    - _Requirements: 3, 4_

- [ ] 4. Verify State Reset and Error Display
  - [ ] 4.1 Verify modal state reset behavior
    - Confirm `resetState()` is called when modal closes (via watch on props.show)
    - Confirm all state variables are properly reset: currentStep, selectedFile, validRows, errors, parseError, parsing, importing
    - Test flow: open modal → upload file → go to step 2 → close → reopen → verify step 1 with clean state
    - _Requirements: 6_

  - [ ] 4.2 Verify error banner displays correctly for all scenarios
    - Test file type validation error (client-side)
    - Test backend validation errors (missing columns, etc)
    - Test bank soal locked error (403)
    - Test network error handling
    - _Requirements: 5_

- [ ] 5. End-to-End Manual Testing
  - [ ] 5.1 Test complete happy path flow
    - Download template: verify file downloads with correct name
    - Upload valid Excel: verify preview shows soal list with correct data
    - Confirm import: verify success message and modal closes
    - Verify parent component receives `imported` event and refreshes soal list
    - _Requirements: 1, 2, 3, 4_

  - [ ] 5.2 Test error scenarios
    - Upload Excel with some invalid rows: verify both valid rows and errors are displayed
    - Upload non-Excel file: verify error message
    - Upload to locked bank soal: verify appropriate error message
    - Simulate network error: verify generic error message
    - _Requirements: 4, 5_

## Notes

- Backend APIs are already implemented and tested
- Frontend API client functions are already implemented in `@/api/bank-soal.ts`
- UI components (modal layout, table, error banner) are already implemented
- This is primarily a wiring task with minimal logic changes
- The component already has proper TypeScript interfaces defined for ParsedSoal and ImportError

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["5.1", "5.2"] }
  ]
}
```
