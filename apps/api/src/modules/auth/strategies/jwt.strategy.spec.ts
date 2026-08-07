import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtStrategy, StaffJwtPayload } from "./jwt.strategy";
import { CbtRole } from "@/common/enums";

// Mock database query builder
const createMockDb = (users: Array<{ isActive: boolean }>) => ({
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(users),
});

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "app.jwtSecret") return "test-secret-key";
        if (key === "app.jwtExpiresIn") return "12h";
        return undefined;
      }),
    } as unknown as ConfigService;

    // Default mock returns an active user
    mockDb = createMockDb([{ isActive: true }]);
    strategy = new JwtStrategy(configService, mockDb as any);
  });

  describe("constructor", () => {
    it("should throw if JWT_SECRET is not configured", () => {
      const configService = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService;

      expect(() => new JwtStrategy(configService, mockDb as any)).toThrow(
        "JWT_SECRET environment variable is not configured",
      );
    });
  });

  describe("validate", () => {
    it("should return a JwtUser from a valid payload with CBT role", async () => {
      const payload: StaffJwtPayload = {
        sub: "user-123",
        tenantId: "tenant-456",
        role: "guru",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: "user-123",
        tenantId: "tenant-456",
        role: "guru",
        cbtRole: CbtRole.GURU,
      });
    });

    it("should handle null tenantId (super_admin)", async () => {
      const payload: StaffJwtPayload = {
        sub: "superadmin-1",
        tenantId: null,
        role: "super_admin",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: "superadmin-1",
        tenantId: null,
        role: "super_admin",
        cbtRole: CbtRole.SUPERADMIN,
      });
    });

    it("should throw UnauthorizedException for missing sub", async () => {
      const payload = {
        sub: "",
        tenantId: "tenant-1",
        role: "admin",
        iat: 0,
        exp: 0,
      } as StaffJwtPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for missing role", async () => {
      const payload = {
        sub: "user-1",
        tenantId: "tenant-1",
        role: "",
        iat: 0,
        exp: 0,
      } as unknown as StaffJwtPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw ForbiddenException for roles without CBT access (bendahara)", async () => {
      const payload: StaffJwtPayload = {
        sub: "user-bendahara",
        tenantId: "tenant-1",
        role: "bendahara",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw ForbiddenException for roles without CBT access (orang_tua)", async () => {
      const payload: StaffJwtPayload = {
        sub: "user-orangtua",
        tenantId: "tenant-1",
        role: "orang_tua",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw UnauthorizedException for deactivated user", async () => {
      // Mock returns a deactivated user
      mockDb = createMockDb([{ isActive: false }]);
      const configService = {
        get: jest.fn((key: string) => {
          if (key === "app.jwtSecret") return "test-secret-key";
          return undefined;
        }),
      } as unknown as ConfigService;
      strategy = new JwtStrategy(configService, mockDb as any);

      const payload: StaffJwtPayload = {
        sub: "user-deactivated",
        tenantId: "tenant-1",
        role: "guru",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for user not found in database", async () => {
      // Mock returns empty array (user not found)
      mockDb = createMockDb([]);
      const configService = {
        get: jest.fn((key: string) => {
          if (key === "app.jwtSecret") return "test-secret-key";
          return undefined;
        }),
      } as unknown as ConfigService;
      strategy = new JwtStrategy(configService, mockDb as any);

      const payload: StaffJwtPayload = {
        sub: "user-not-found",
        tenantId: "tenant-1",
        role: "guru",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
