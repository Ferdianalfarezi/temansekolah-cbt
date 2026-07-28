import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtStrategy, StaffJwtPayload } from "./jwt.strategy";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "app.jwtSecret") return "test-secret-key";
        if (key === "app.jwtExpiresIn") return "12h";
        return undefined;
      }),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(configService);
  });

  describe("constructor", () => {
    it("should throw if JWT_SECRET is not configured", () => {
      const configService = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService;

      expect(() => new JwtStrategy(configService)).toThrow(
        "JWT_SECRET environment variable is not configured",
      );
    });
  });

  describe("validate", () => {
    it("should return a JwtUser from a valid payload", () => {
      const payload: StaffJwtPayload = {
        sub: "user-123",
        tenantId: "tenant-456",
        role: "guru",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        userId: "user-123",
        tenantId: "tenant-456",
        role: "guru",
      });
    });

    it("should handle null tenantId (super_admin)", () => {
      const payload: StaffJwtPayload = {
        sub: "superadmin-1",
        tenantId: null,
        role: "super_admin",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        userId: "superadmin-1",
        tenantId: null,
        role: "super_admin",
      });
    });

    it("should throw UnauthorizedException for missing sub", () => {
      const payload = {
        sub: "",
        tenantId: "tenant-1",
        role: "admin",
        iat: 0,
        exp: 0,
      } as StaffJwtPayload;

      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for missing role", () => {
      const payload = {
        sub: "user-1",
        tenantId: "tenant-1",
        role: "",
        iat: 0,
        exp: 0,
      } as unknown as StaffJwtPayload;

      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    });
  });
});
