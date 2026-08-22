# Import Soal Excel - Frontend Integration

## Overview

Integrasi komponen `ImportSoalModal.vue` dengan backend API yang sudah ada untuk fitur import soal dari file Excel ke Bank Soal.

## Current State

### Backend (Sudah Lengkap)
- `GET /api/bank-soal/template` - Download template Excel
- `POST /api/bank-soal/:id/soal/import?preview=true` - Preview parsing hasil
- `POST /api/bank-soal/:id/soal/import` - Commit import ke database

### Frontend API Client (Sudah Ada)
File: `apps/admin/src/api/bank-soal.ts`
- `downloadTemplate()` - Trigger download template
- `importSoalPreview(bankSoalId, file)` - Preview dengan validasi
- `importSoal(bankSoalId, file)` - Commit import

### Frontend Modal (Perlu Integrasi)
File: `apps/admin/src/views/cbt/components/ImportSoalModal.vue`
- UI 2-step sudah ada (Upload → Preview)
- Tombol download template pointing ke static file yang tidak exist
- Parsing dan import masih placeholder/TODO

## Requirements

### Functional
1. Download template Excel dari backend API
2. Upload file Excel untuk preview (server-side parsing)
3. Tampilkan hasil preview: valid rows + error rows dengan detail
4. Commit import untuk soal yang valid (partial import)
5. Emit event untuk refresh list soal di parent component

### Non-Functional
1. Loading states untuk setiap async operation
2. Error handling untuk network failure dan business logic errors
3. Clear state saat modal ditutup/dibuka ulang

## Data Flow

```
User clicks "Download Template"
    → downloadTemplate() API call
    → Browser downloads template_soal.xlsx

User drops/selects Excel file
    → validateAndSetFile() - check extension
    → importSoalPreview(bankSoalId, file) API call
    → Display validRows[] and errors[] in Step 2

User clicks "Import X Soal"
    → importSoal(bankSoalId, file) API call
    → Show success message with count
    → emit('imported', count)
    → Close modal
```

## API Response Types

```typescript
// Preview response
interface ImportPreviewResult {
  validRows: ParsedSoal[];
  errors: ImportError[];
}

interface ParsedSoal {
  nomorSoal: number;
  teksSoal: string;
  jawabanBenar: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string | null;
}

interface ImportError {
  row: number;
  message: string;
}

// Import response
interface ImportResult {
  imported: number;
  errors: ImportError[];
}
```

## Error Scenarios

| Scenario | API Response | UI Behavior |
|----------|--------------|-------------|
| File bukan Excel | 400 Bad Request | Show error banner, stay on Step 1 |
| File > 5MB | 400 Bad Request | Show error banner, stay on Step 1 |
| Required columns missing | 400 Bad Request | Show error banner, stay on Step 1 |
| Bank soal locked | 403 Forbidden | Show error banner with specific message |
| Network error | Network Error | Show generic error, allow retry |
| All rows invalid | 200 OK (empty validRows) | Show error list, disable import button |

## Implementation Changes

### ImportSoalModal.vue

1. **Add imports:**
```typescript
import { 
  downloadTemplate, 
  importSoalPreview, 
  importSoal,
  getErrorMessage 
} from '@/api/bank-soal';
```

2. **Replace downloadTemplate function:**
```typescript
async function downloadTemplate() {
  try {
    await downloadTemplateApi();
  } catch (e) {
    parseError.value = getErrorMessage(e);
  }
}
```

3. **Replace parseExcelFile function:**
```typescript
async function parseExcelFile(file: File) {
  parsing.value = true;
  parseError.value = '';
  
  try {
    const response = await importSoalPreview(props.bankSoalId, file);
    validRows.value = response.data.validRows;
    errors.value = response.data.errors;
    currentStep.value = 2;
  } catch (e) {
    parseError.value = getErrorMessage(e);
  } finally {
    parsing.value = false;
  }
}
```

4. **Replace confirmImport function:**
```typescript
async function confirmImport() {
  if (!selectedFile.value || !hasValidRows.value) return;
  
  importing.value = true;
  try {
    const response = await importSoal(props.bankSoalId, selectedFile.value);
    emit('imported', response.data.imported);
    handleClose();
  } catch (e) {
    parseError.value = getErrorMessage(e);
  } finally {
    importing.value = false;
  }
}
```

## Testing Checklist

- [ ] Download template triggers file download
- [ ] Valid Excel file shows preview with soal list
- [ ] Invalid Excel file shows error message
- [ ] Rows with validation errors shown in error list
- [ ] Import button disabled when no valid rows
- [ ] Successful import closes modal and emits count
- [ ] Locked bank soal shows appropriate error
- [ ] Modal state resets on close/reopen
