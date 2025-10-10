/**
 * Latency Tracker - Theo dõi và tính toán độ trễ kết nối
 * Giúp AI điều chỉnh quyết định dựa trên độ trễ mạng
 */

export interface LatencyMeasurement {
  timestamp: number;
  latency: number;
}

export class LatencyTracker {
  private measurements: LatencyMeasurement[] = [];
  private maxMeasurements: number = 20; // Giữ 20 lần đo gần nhất
  private pingInterval: NodeJS.Timeout | null = null;
  private socket: any = null;

  /**
   * Bắt đầu theo dõi latency
   * @param socket Socket.IO instance
   * @param intervalMs Khoảng thời gian giữa các lần ping (mặc định 5000ms)
   */
  public startTracking(socket: any, intervalMs: number = 5000): void {
    this.socket = socket;

    // Clear interval cũ nếu có
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Ping ngay lập tức
    this.ping();

    // Setup interval để ping định kỳ
    this.pingInterval = setInterval(() => {
      this.ping();
    }, intervalMs);
  }

  /**
   * Dừng theo dõi latency
   */
  public stopTracking(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Ping server để đo latency
   */
  private ping(): void {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    const startTime = Date.now();

    // Sử dụng Socket.IO ping hoặc custom event
    this.socket.emit("ping", {}, (response: any) => {
      const latency = Date.now() - startTime;
      this.addMeasurement(latency);
    });
  }

  /**
   * Thêm một lần đo latency
   */
  private addMeasurement(latency: number): void {
    this.measurements.push({
      timestamp: Date.now(),
      latency,
    });

    // Giữ chỉ N lần đo gần nhất
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }

    console.log(
      `📡 Latency: ${latency}ms (Avg: ${this.getAverageLatency()}ms)`
    );
  }

  /**
   * Lấy latency trung bình
   */
  public getAverageLatency(): number {
    if (this.measurements.length === 0) {
      return 0;
    }

    const sum = this.measurements.reduce((acc, m) => acc + m.latency, 0);
    return Math.round(sum / this.measurements.length);
  }

  /**
   * Lấy latency gần nhất
   */
  public getLatestLatency(): number {
    if (this.measurements.length === 0) {
      return 0;
    }

    const latest = this.measurements[this.measurements.length - 1];
    return latest ? latest.latency : 0;
  }

  /**
   * Lấy latency tối đa trong N lần đo gần nhất
   */
  public getMaxLatency(count: number = 5): number {
    if (this.measurements.length === 0) {
      return 0;
    }

    const recent = this.measurements.slice(-count);
    return Math.max(...recent.map((m) => m.latency));
  }

  /**
   * Lấy latency tối thiểu trong N lần đo gần nhất
   */
  public getMinLatency(count: number = 5): number {
    if (this.measurements.length === 0) {
      return 0;
    }

    const recent = this.measurements.slice(-count);
    return Math.min(...recent.map((m) => m.latency));
  }

  /**
   * Kiểm tra xem latency có cao bất thường không
   * @param threshold Ngưỡng latency (ms), mặc định 200ms
   */
  public isHighLatency(threshold: number = 200): boolean {
    const avg = this.getAverageLatency();
    return avg > threshold;
  }

  /**
   * Lấy trạng thái kết nối dựa trên latency
   */
  public getConnectionQuality(): "excellent" | "good" | "fair" | "poor" {
    const avg = this.getAverageLatency();

    if (avg < 50) return "excellent";
    if (avg < 100) return "good";
    if (avg < 200) return "fair";
    return "poor";
  }

  /**
   * Lấy độ trễ dự kiến cho quyết định AI
   * (Sử dụng max của 3 lần đo gần nhất để an toàn)
   */
  public getExpectedLatency(): number {
    return this.getMaxLatency(3);
  }

  /**
   * Reset tất cả measurements
   */
  public reset(): void {
    this.measurements = [];
  }

  /**
   * Lấy thống kê chi tiết
   */
  public getStats(): {
    average: number;
    latest: number;
    min: number;
    max: number;
    quality: string;
    sampleCount: number;
  } {
    return {
      average: this.getAverageLatency(),
      latest: this.getLatestLatency(),
      min: this.getMinLatency(),
      max: this.getMaxLatency(),
      quality: this.getConnectionQuality(),
      sampleCount: this.measurements.length,
    };
  }
}
