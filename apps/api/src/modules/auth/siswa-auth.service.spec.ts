import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

import { SiswaAuthService } from "./siswa-auth.service";
import { DRIZZLE } from "../../drizzle/drizzle.module";

// Mock bcrypt
jest.mock("bcrypt");

describe("SiswaAuthService", () => {
  let service: SiswaAuthService;
  let mockDb: any;
  let mockJwtService: any;

  const mockAccount = {
    id: "account-uuid-1",
    tenantId: "tenant-uuid-1",
    siswaId: "siswa-uuid-1",
    nisn: "1234567890",
    passwordHash: "$2b$10$hashedpassword",
    mustChangePassword: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
    needsReview: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Setup mock chainable drizzle query builder
    mockDb = {
      select: jest.fn(),
      update: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue("mock-jwt-token"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiswaAuthService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<SiswaAuthService>(SiswaAuthService);
  });

  // Helper to set up chainable select mock
  function setupSelectMock(results: any[]) {
    const chain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(results),
    };
    mockDb.select.mockReturnValue(chain);
    return chain;
  }

  // Helper to set up chainable update mock
  function setupUpdateMock() {
    const chain = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
    };
    mockDb.update.mockReturnValue(chain);
    return chain;
  }

  describe("login", () => {
    it("should throw UnauthorizedException when no account found", async () => {
      setupSelectMock([]);

      await expect(service.login("9999999999", "password")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when account is locked", async () => {
      const lockedAccount = {
        ...mockAccount,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
      };
      setupSelectMock([lockedAccount]);

      await expect(service.login("1234567890", "password")).rejects.toThrow(
        /Akun terkunci/,
      );
    });

    it("should throw UnauthorizedException on wrong password and increment attempts", async () => {
      setupSelectMock([mockAccount]);
      const updateChain = setupUpdateMock();
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login("1234567890", "wrong")).rejects.toThrow(
        UnauthorizedException,
      );

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginAttempts: 1 }),
      );
    });

    it("should lock account after 5 failed attempts", async () => {
      const accountWith4Failures = {
        ...mockAccount,
        failedLoginAttempts: 4,
      };
      setupSelectMock([accountWith4Failures]);
      const updateChain = setupUpdateMock();
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login("1234567890", "wrong")).rejects.toThrow(
        UnauthorizedException,
      );

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      );
    });

    it("should return account on successful login and reset attempts", async () => {
      setupSelectMock([mockAccount]);
      const updateChain = setupUpdateMock();
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login("1234567890", "correct");

      expect(result).toEqual(mockAccount);
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      );
    });

    it("should allow login when lockout has expired", async () => {
      const expiredLockAccount = {
        ...mockAccount,
        lockedUntil: new Date(Date.now() - 1000), // expired
      };
      setupSelectMock([expiredLockAccount]);
      setupUpdateMock();
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login("1234567890", "correct");
      expect(result).toEqual(expiredLockAccount);
    });
  });

  describe("changePassword", () => {
    it("should throw UnauthorizedException if account not found", async () => {
      setupSelectMock([]);

      await expect(
        service.changePassword("nonexistent", "old", "new123"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if current password is wrong", async () => {
      setupSelectMock([mockAccount]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(mockAccount.id, "wrong", "new123"),
      ).rejects.toThrow(/Password lama salah/);
    });

    it("should update password and set mustChangePassword to false", async () => {
      setupSelectMock([mockAccount]);
      const updateChain = setupUpdateMock();
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue("$2b$10$newhashedpw");

      const result = await service.changePassword(
        mockAccount.id,
        "current",
        "newpass123",
      );

      expect(result.message).toBe("Password berhasil diubah");
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: "$2b$10$newhashedpw",
          mustChangePassword: false,
        }),
      );
    });
  });

  describe("resetPassword", () => {
    it("should throw UnauthorizedException if account not found", async () => {
      setupSelectMock([]);

      await expect(
        service.resetPassword("9999999999", "2005-03-15"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if tanggal_lahir does not match", async () => {
      // First call: find account
      const selectChain1 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockAccount]),
      };
      // Second call: find siswa DOB
      const selectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ tanggalLahir: "2005-06-20" }]),
      };
      mockDb.select
        .mockReturnValueOnce(selectChain1)
        .mockReturnValueOnce(selectChain2);

      await expect(
        service.resetPassword("1234567890", "2005-03-15"),
      ).rejects.toThrow(/Verifikasi gagal/);
    });

    it("should reset password to DDMMYYYY format of DOB on success", async () => {
      const selectChain1 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockAccount]),
      };
      const selectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ tanggalLahir: "2005-03-15" }]),
      };
      mockDb.select
        .mockReturnValueOnce(selectChain1)
        .mockReturnValueOnce(selectChain2);

      const updateChain = setupUpdateMock();
      (bcrypt.hash as jest.Mock).mockResolvedValue("$2b$10$resethashedpw");

      const result = await service.resetPassword("1234567890", "2005-03-15");

      expect(result.message).toContain("Password berhasil direset");
      // Verify bcrypt.hash called with DDMMYYYY format: "15032005"
      expect(bcrypt.hash).toHaveBeenCalledWith("15032005", 10);
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: "$2b$10$resethashedpw",
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      );
    });
  });

  describe("issueToken", () => {
    it("should sign JWT with correct payload and 12h expiry", () => {
      const result = service.issueToken({
        id: "account-id",
        tenantId: "tenant-id",
        mustChangePassword: true,
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: "account-id", tenantId: "tenant-id", role: "siswa" },
        { expiresIn: "12h" },
      );
      expect(result).toEqual({
        accessToken: "mock-jwt-token",
        mustChangePassword: true,
      });
    });

    it("should include mustChangePassword=false when password already changed", () => {
      const result = service.issueToken({
        id: "account-id",
        tenantId: "tenant-id",
        mustChangePassword: false,
      });

      expect(result.mustChangePassword).toBe(false);
    });
  });
});
