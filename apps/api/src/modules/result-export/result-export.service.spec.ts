import {
  formatDateYYYYMMDD,
  generateFilename,
  generateSheetName,
  slugify,
  ResultExportService,
  RandomizationMapping,
} from "./result-export.service";

// Create a minimal mock of the service for testing the reverseRandomizationMapping method
const createService = (): ResultExportService => {
  // We only need to test the reverseRandomizationMapping method which doesn't use dependencies
  return new (ResultExportService as any)();
};

describe("slugify", () => {
  it("should convert string to lowercase", () => {
    expect(slugify("Matematika")).toBe("matematika");
    expect(slugify("BAHASA INDONESIA")).toBe("bahasa-indonesia");
  });

  it("should replace spaces with hyphens", () => {
    expect(slugify("bahasa indonesia")).toBe("bahasa-indonesia");
  });

  it("should replace special characters with hyphens", () => {
    expect(slugify("IPA/IPS")).toBe("ipa-ips");
    expect(slugify("Bahasa (Inggris)")).toBe("bahasa-inggris");
    expect(slugify("Seni & Budaya")).toBe("seni-budaya");
  });

  it("should handle Indonesian special characters (diacritics)", () => {
    // Diacritics are removed
    expect(slugify("café")).toBe("cafe");
    expect(slugify("naïve")).toBe("naive");
    expect(slugify("résumé")).toBe("resume");
  });

  it("should collapse multiple hyphens into one", () => {
    expect(slugify("bahasa -- indonesia")).toBe("bahasa-indonesia");
    expect(slugify("A   B   C")).toBe("a-b-c");
  });

  it("should trim leading and trailing hyphens", () => {
    expect(slugify("-test-")).toBe("test");
    expect(slugify("  test  ")).toBe("test");
    expect(slugify("---test---")).toBe("test");
  });

  it("should handle empty strings", () => {
    expect(slugify("")).toBe("");
  });

  it("should handle strings with only special characters", () => {
    expect(slugify("@#$%")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("should preserve numbers", () => {
    expect(slugify("Kelas 7A")).toBe("kelas-7a");
    expect(slugify("12 IPA 1")).toBe("12-ipa-1");
  });
});

describe("formatDateYYYYMMDD", () => {
  it("should format date as YYYYMMDD", () => {
    const date = new Date(2025, 0, 15); // January 15, 2025
    expect(formatDateYYYYMMDD(date)).toBe("20250115");
  });

  it("should pad single-digit months with leading zero", () => {
    const date = new Date(2025, 2, 5); // March 5, 2025
    expect(formatDateYYYYMMDD(date)).toBe("20250305");
  });

  it("should pad single-digit days with leading zero", () => {
    const date = new Date(2025, 11, 1); // December 1, 2025
    expect(formatDateYYYYMMDD(date)).toBe("20251201");
  });

  it("should handle year boundary correctly", () => {
    const date = new Date(2024, 11, 31); // December 31, 2024
    expect(formatDateYYYYMMDD(date)).toBe("20241231");
  });
});

describe("generateFilename", () => {
  it("should generate correct filename format", () => {
    const date = new Date(2025, 0, 15); // January 15, 2025
    const filename = generateFilename("Matematika", "7A", date);
    expect(filename).toBe("hasil-ujian_matematika_7a_20250115.xlsx");
  });

  it("should handle mapel names with spaces", () => {
    const date = new Date(2025, 0, 15);
    const filename = generateFilename("Bahasa Indonesia", "7A", date);
    expect(filename).toBe("hasil-ujian_bahasa-indonesia_7a_20250115.xlsx");
  });

  it("should handle kelas names with spaces", () => {
    const date = new Date(2025, 0, 15);
    const filename = generateFilename("Matematika", "12 IPA 1", date);
    expect(filename).toBe("hasil-ujian_matematika_12-ipa-1_20250115.xlsx");
  });

  it("should handle special characters in mapel name", () => {
    const date = new Date(2025, 0, 15);
    const filename = generateFilename("IPA/Biologi", "7A", date);
    expect(filename).toBe("hasil-ujian_ipa-biologi_7a_20250115.xlsx");
  });

  it("should handle special characters in kelas name", () => {
    const date = new Date(2025, 0, 15);
    const filename = generateFilename("Matematika", "7-A (Unggulan)", date);
    expect(filename).toBe("hasil-ujian_matematika_7-a-unggulan_20250115.xlsx");
  });

  it("should convert everything to lowercase", () => {
    const date = new Date(2025, 0, 15);
    const filename = generateFilename("MATEMATIKA", "VII-A", date);
    expect(filename).toBe("hasil-ujian_matematika_vii-a_20250115.xlsx");
  });

  it("should match the example from requirements", () => {
    // Example from requirements: hasil-ujian_matematika_7a_20250115.xlsx
    const date = new Date(2025, 0, 15);
    const filename = generateFilename("matematika", "7a", date);
    expect(filename).toBe("hasil-ujian_matematika_7a_20250115.xlsx");
  });
});

describe("reverseRandomizationMapping", () => {
  const service = createService();

  describe("null/undefined answers", () => {
    it("should return '-' for null selectedOption", () => {
      const mapping: RandomizationMapping = {
        questionOrder: ["q1"],
        optionMappings: {
          q1: {
            original: ["A", "B", "C", "D"],
            shuffled: ["C", "A", "D", "B"],
          },
        },
      };
      expect(service.reverseRandomizationMapping(mapping, null, "q1")).toBe(
        "-",
      );
    });

    it("should return '-' for undefined selectedOption", () => {
      const mapping: RandomizationMapping = {
        questionOrder: ["q1"],
        optionMappings: {
          q1: {
            original: ["A", "B", "C", "D"],
            shuffled: ["C", "A", "D", "B"],
          },
        },
      };
      expect(
        service.reverseRandomizationMapping(mapping, undefined, "q1"),
      ).toBe("-");
    });
  });

  describe("missing mapping (identity return)", () => {
    it("should return selectedOption when mapping is null", () => {
      expect(service.reverseRandomizationMapping(null, "B", "q1")).toBe("B");
    });

    it("should return selectedOption when mapping is undefined", () => {
      expect(service.reverseRandomizationMapping(undefined, "C", "q1")).toBe(
        "C",
      );
    });

    it("should return selectedOption when mapping has no optionMappings", () => {
      const mapping = {
        questionOrder: ["q1"],
        optionMappings: null,
      } as unknown as RandomizationMapping;
      expect(service.reverseRandomizationMapping(mapping, "A", "q1")).toBe("A");
    });

    it("should return selectedOption when question is not in optionMappings", () => {
      const mapping: RandomizationMapping = {
        questionOrder: ["q1"],
        optionMappings: {
          q2: {
            original: ["A", "B", "C", "D"],
            shuffled: ["C", "A", "D", "B"],
          },
        },
      };
      expect(service.reverseRandomizationMapping(mapping, "B", "q1")).toBe("B");
    });

    it("should return selectedOption when optionMapping has no shuffled array", () => {
      const mapping = {
        questionOrder: ["q1"],
        optionMappings: {
          q1: {
            original: ["A", "B", "C", "D"],
            shuffled: null,
          },
        },
      } as unknown as RandomizationMapping;
      expect(service.reverseRandomizationMapping(mapping, "B", "q1")).toBe("B");
    });

    it("should return selectedOption when optionMapping has no original array", () => {
      const mapping = {
        questionOrder: ["q1"],
        optionMappings: {
          q1: {
            original: null,
            shuffled: ["C", "A", "D", "B"],
          },
        },
      } as unknown as RandomizationMapping;
      expect(service.reverseRandomizationMapping(mapping, "B", "q1")).toBe("B");
    });
  });

  describe("4-option questions (A/B/C/D)", () => {
    const mapping: RandomizationMapping = {
      questionOrder: ["q1"],
      optionMappings: {
        q1: {
          original: ["A", "B", "C", "D"],
          shuffled: ["C", "A", "D", "B"], // C->A, A->B, D->C, B->D
        },
      },
    };

    it("should reverse map when student selected first shuffled option", () => {
      // Student selected 'C' which is at index 0 in shuffled
      // Index 0 in original is 'A'
      expect(service.reverseRandomizationMapping(mapping, "C", "q1")).toBe("A");
    });

    it("should reverse map when student selected second shuffled option", () => {
      // Student selected 'A' which is at index 1 in shuffled
      // Index 1 in original is 'B'
      expect(service.reverseRandomizationMapping(mapping, "A", "q1")).toBe("B");
    });

    it("should reverse map when student selected third shuffled option", () => {
      // Student selected 'D' which is at index 2 in shuffled
      // Index 2 in original is 'C'
      expect(service.reverseRandomizationMapping(mapping, "D", "q1")).toBe("C");
    });

    it("should reverse map when student selected fourth shuffled option", () => {
      // Student selected 'B' which is at index 3 in shuffled
      // Index 3 in original is 'D'
      expect(service.reverseRandomizationMapping(mapping, "B", "q1")).toBe("D");
    });
  });

  describe("5-option questions (A/B/C/D/E)", () => {
    const mapping: RandomizationMapping = {
      questionOrder: ["q1"],
      optionMappings: {
        q1: {
          original: ["A", "B", "C", "D", "E"],
          shuffled: ["D", "B", "A", "E", "C"], // D->A, B->B, A->C, E->D, C->E
        },
      },
    };

    it("should reverse map first option in 5-option question", () => {
      // Student selected 'D' which is at index 0 in shuffled
      // Index 0 in original is 'A'
      expect(service.reverseRandomizationMapping(mapping, "D", "q1")).toBe("A");
    });

    it("should handle identity mapping (option stays in same position)", () => {
      // Student selected 'B' which is at index 1 in shuffled
      // Index 1 in original is 'B' (same position)
      expect(service.reverseRandomizationMapping(mapping, "B", "q1")).toBe("B");
    });

    it("should reverse map last option in 5-option question", () => {
      // Student selected 'C' which is at index 4 in shuffled
      // Index 4 in original is 'E'
      expect(service.reverseRandomizationMapping(mapping, "C", "q1")).toBe("E");
    });

    it("should handle middle options correctly", () => {
      // Student selected 'A' which is at index 2 in shuffled
      // Index 2 in original is 'C'
      expect(service.reverseRandomizationMapping(mapping, "A", "q1")).toBe("C");

      // Student selected 'E' which is at index 3 in shuffled
      // Index 3 in original is 'D'
      expect(service.reverseRandomizationMapping(mapping, "E", "q1")).toBe("D");
    });
  });

  describe("edge cases", () => {
    it("should return identity when selectedOption not found in shuffled array", () => {
      const mapping: RandomizationMapping = {
        questionOrder: ["q1"],
        optionMappings: {
          q1: {
            original: ["A", "B", "C", "D"],
            shuffled: ["C", "A", "D", "B"],
          },
        },
      };
      // 'E' is not in the shuffled array for a 4-option question
      expect(service.reverseRandomizationMapping(mapping, "E", "q1")).toBe("E");
    });

    it("should handle multiple questions in mapping", () => {
      const mapping: RandomizationMapping = {
        questionOrder: ["q1", "q2", "q3"],
        optionMappings: {
          q1: {
            original: ["A", "B", "C", "D"],
            shuffled: ["B", "D", "A", "C"],
          },
          q2: {
            original: ["A", "B", "C", "D", "E"],
            shuffled: ["E", "C", "A", "B", "D"],
          },
          q3: {
            original: ["A", "B", "C", "D"],
            shuffled: ["A", "B", "C", "D"], // Identity mapping
          },
        },
      };

      // q1: Student selected 'B' at index 0, original index 0 is 'A'
      expect(service.reverseRandomizationMapping(mapping, "B", "q1")).toBe("A");

      // q2: Student selected 'E' at index 0, original index 0 is 'A'
      expect(service.reverseRandomizationMapping(mapping, "E", "q2")).toBe("A");

      // q3: Identity mapping - all options map to themselves
      expect(service.reverseRandomizationMapping(mapping, "A", "q3")).toBe("A");
      expect(service.reverseRandomizationMapping(mapping, "D", "q3")).toBe("D");
    });

    it("should match the example from the design document", () => {
      // From design doc Flow 3: Randomization Reversal
      // Given: Student selected 'C' for question Q1
      // Mapping: original=['A','B','C','D','E'], shuffled=['D','B','A','E','C']
      // Process: 'C' is at index 4 in shuffled, index 4 in original is 'E'
      const mapping: RandomizationMapping = {
        questionOrder: ["Q1"],
        optionMappings: {
          Q1: {
            original: ["A", "B", "C", "D", "E"],
            shuffled: ["D", "B", "A", "E", "C"],
          },
        },
      };
      expect(service.reverseRandomizationMapping(mapping, "C", "Q1")).toBe("E");
    });
  });
});

describe("generateSheetName", () => {
  describe("basic functionality", () => {
    it("should generate sheet name in format 'mapel - kelas'", () => {
      const names = new Set<string>();
      const result = generateSheetName("Matematika", "7A", names);
      expect(result).toBe("Matematika - 7A");
    });

    it("should add name to existingNames set", () => {
      const names = new Set<string>();
      generateSheetName("Matematika", "7A", names);
      expect(names.has("Matematika - 7A")).toBe(true);
    });

    it("should handle spaces in mapel and kelas names", () => {
      const names = new Set<string>();
      const result = generateSheetName("Bahasa Indonesia", "Kelas 7A", names);
      expect(result).toBe("Bahasa Indonesia - Kelas 7A");
    });
  });

  describe("forbidden character removal", () => {
    it("should remove colon character", () => {
      const names = new Set<string>();
      const result = generateSheetName("IPA: Fisika", "7A", names);
      expect(result).toBe("IPA Fisika - 7A");
    });

    it("should remove forward slash character", () => {
      const names = new Set<string>();
      const result = generateSheetName("IPA/Biologi", "7A", names);
      expect(result).toBe("IPABiologi - 7A");
    });

    it("should remove backslash character", () => {
      const names = new Set<string>();
      const result = generateSheetName("IPA\\Kimia", "7A", names);
      expect(result).toBe("IPAKimia - 7A");
    });

    it("should remove question mark character", () => {
      const names = new Set<string>();
      const result = generateSheetName("Matematika?", "7A", names);
      expect(result).toBe("Matematika - 7A");
    });

    it("should remove asterisk character", () => {
      const names = new Set<string>();
      const result = generateSheetName("Matematika*", "7A", names);
      expect(result).toBe("Matematika - 7A");
    });

    it("should remove square brackets", () => {
      const names = new Set<string>();
      const result = generateSheetName("Matematika", "Kelas [7]", names);
      expect(result).toBe("Matematika - Kelas 7");
    });

    it("should handle multiple forbidden characters", () => {
      const names = new Set<string>();
      const result = generateSheetName("IPA/Fisika*", "Kelas [7:A]", names);
      expect(result).toBe("IPAFisika - Kelas 7A");
    });
  });

  describe("truncation to 31 characters", () => {
    it("should truncate names longer than 31 characters", () => {
      const names = new Set<string>();
      const result = generateSheetName(
        "Pendidikan Agama Islam",
        "Kelas 10 MIPA 1",
        names,
      );
      expect(result.length).toBeLessThanOrEqual(31);
    });

    it("should truncate exactly at 31 characters", () => {
      const names = new Set<string>();
      // "Pendidikan Agama Islam - Kelas 10 MIPA 1" = 40 chars
      // Truncated to 31: "Pendidikan Agama Islam - Kelas " (with trailing space)
      const result = generateSheetName(
        "Pendidikan Agama Islam",
        "Kelas 10 MIPA 1",
        names,
      );
      expect(result.length).toBe(31);
      expect(result).toBe("Pendidikan Agama Islam - Kelas ");
    });

    it("should not truncate names exactly 31 characters", () => {
      const names = new Set<string>();
      // Create a name that is exactly 31 characters
      // "ABCDEFGHIJKLMNOPQRSTUV - 123456" = 31 chars (verified)
      const result = generateSheetName(
        "ABCDEFGHIJKLMNOPQRSTUV",
        "123456",
        names,
      );
      expect(result.length).toBe(31);
      expect(result).toBe("ABCDEFGHIJKLMNOPQRSTUV - 123456");
    });

    it("should not truncate names shorter than 31 characters", () => {
      const names = new Set<string>();
      const result = generateSheetName("Math", "7A", names);
      expect(result).toBe("Math - 7A");
      expect(result.length).toBeLessThan(31);
    });
  });

  describe("duplicate handling", () => {
    it("should add (2) suffix for first duplicate", () => {
      const names = new Set<string>();
      generateSheetName("Matematika", "7A", names);
      const result = generateSheetName("Matematika", "7A", names);
      expect(result).toBe("Matematika - 7A (2)");
    });

    it("should add (3) suffix for second duplicate", () => {
      const names = new Set<string>();
      generateSheetName("Matematika", "7A", names);
      generateSheetName("Matematika", "7A", names);
      const result = generateSheetName("Matematika", "7A", names);
      expect(result).toBe("Matematika - 7A (3)");
    });

    it("should handle many duplicates", () => {
      const names = new Set<string>();
      for (let i = 0; i < 10; i++) {
        generateSheetName("Matematika", "7A", names);
      }
      const result = generateSheetName("Matematika", "7A", names);
      expect(result).toBe("Matematika - 7A (11)");
    });

    it("should truncate base name to make room for suffix", () => {
      const names = new Set<string>();
      // First call creates the long name
      generateSheetName("Pendidikan Agama Islam", "Kelas 10 MIPA 1", names);
      // Second call should add suffix while keeping total <= 31
      const result = generateSheetName(
        "Pendidikan Agama Islam",
        "Kelas 10 MIPA 1",
        names,
      );
      expect(result.length).toBeLessThanOrEqual(31);
      expect(result).toContain(" (2)");
    });

    it("should track all unique names in the Set", () => {
      const names = new Set<string>();
      generateSheetName("Matematika", "7A", names);
      generateSheetName("Matematika", "7B", names);
      generateSheetName("Matematika", "7A", names);

      expect(names.size).toBe(3);
      expect(names.has("Matematika - 7A")).toBe(true);
      expect(names.has("Matematika - 7B")).toBe(true);
      expect(names.has("Matematika - 7A (2)")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty mapel name", () => {
      const names = new Set<string>();
      const result = generateSheetName("", "7A", names);
      expect(result).toBe(" - 7A");
    });

    it("should handle empty kelas name", () => {
      const names = new Set<string>();
      const result = generateSheetName("Matematika", "", names);
      expect(result).toBe("Matematika - ");
    });

    it("should handle both empty names", () => {
      const names = new Set<string>();
      const result = generateSheetName("", "", names);
      expect(result).toBe(" - ");
    });

    it("should handle mapel name with only forbidden characters", () => {
      const names = new Set<string>();
      const result = generateSheetName(":/\\?*[]", "7A", names);
      expect(result).toBe(" - 7A");
    });

    it("should handle different sessions with same truncated name", () => {
      const names = new Set<string>();
      // These two long names will truncate to the same string
      generateSheetName("Pendidikan Agama Islam", "Kelas 10 MIPA 1", names);
      const result = generateSheetName(
        "Pendidikan Agama Islam",
        "Kelas 10 MIPA 2",
        names,
      );
      expect(result).toContain(" (2)");
    });
  });
});
