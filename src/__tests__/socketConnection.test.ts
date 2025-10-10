import { SocketConnection } from "../connection/socketConnection";
import { Direction } from "../types";

describe("SocketConnection", () => {
  let socketConnection: SocketConnection;

  beforeEach(() => {
    // Use a production-like URL to avoid development mode auto-start
    socketConnection = new SocketConnection(
      "http://production-server.com",
      "test-token"
    );
  });

  afterEach(() => {
    if (socketConnection.isConnected()) {
      socketConnection.disconnect();
    }
  });

  describe("initialization", () => {
    it("should create a SocketConnection instance", () => {
      expect(socketConnection).toBeInstanceOf(SocketConnection);
    });

    it("should not be connected initially", () => {
      expect(socketConnection.isConnected()).toBe(false);
    });

    it("should not have game running initially in production mode", () => {
      expect(socketConnection.isGameRunning()).toBe(false);
    });

    it("should have game running initially in development mode", () => {
      const devConnection = new SocketConnection(
        "http://localhost:3000",
        "test-token"
      );
      expect(devConnection.isGameRunning()).toBe(true);
      devConnection.disconnect();
    });

    it("should return null for bomber info initially", () => {
      expect(socketConnection.getMyBomberInfo()).toBeNull();
    });
  });

  describe("callback registration", () => {
    it("should allow registering onGameData callback", () => {
      const callback = jest.fn();
      expect(() => socketConnection.onGameData(callback)).not.toThrow();
    });

    it("should allow registering onGameStart callback", () => {
      const callback = jest.fn();
      expect(() => socketConnection.onGameStart(callback)).not.toThrow();
    });

    it("should allow registering onGameEnd callback", () => {
      const callback = jest.fn();
      expect(() => socketConnection.onGameEnd(callback)).not.toThrow();
    });
  });

  describe("action methods when not connected", () => {
    it("should not throw when calling move without connection", () => {
      expect(() => socketConnection.move(Direction.UP)).not.toThrow();
    });

    it("should not throw when calling placeBomb without connection", () => {
      expect(() => socketConnection.placeBomb()).not.toThrow();
    });
  });
});
