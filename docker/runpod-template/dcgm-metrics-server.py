#!/usr/bin/env python3
"""
DCGM Metrics Exporter for Prometheus
=====================================
A lightweight HTTP server that exposes NVIDIA GPU metrics in Prometheus format.
Uses nvidia-smi for compatibility with RunPod environments.

Metrics exposed on port 9400 at /metrics endpoint.
"""
import subprocess
import http.server
import socketserver
import signal
import sys

PORT = 9400


def get_gpu_metrics():
    """Get GPU metrics using nvidia-smi and format for Prometheus."""
    metrics = []
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=index,utilization.gpu,utilization.memory,memory.used,memory.free,memory.total,temperature.gpu,power.draw,clocks.sm,clocks.mem,name",
                "--format=csv,noheader,nounits"
            ],
            capture_output=True,
            text=True,
            timeout=5
        )

        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 11:
                gpu = parts[0]
                gpu_name = parts[10].replace(" ", "_")
                labels = f'gpu="{gpu}",gpu_name="{gpu_name}"'

                # GPU Utilization
                metrics.append('# HELP DCGM_FI_DEV_GPU_UTIL GPU utilization percentage')
                metrics.append('# TYPE DCGM_FI_DEV_GPU_UTIL gauge')
                metrics.append(f'DCGM_FI_DEV_GPU_UTIL{{{labels}}} {parts[1]}')

                # Memory Utilization
                metrics.append('# HELP DCGM_FI_DEV_MEM_COPY_UTIL Memory utilization percentage')
                metrics.append('# TYPE DCGM_FI_DEV_MEM_COPY_UTIL gauge')
                metrics.append(f'DCGM_FI_DEV_MEM_COPY_UTIL{{{labels}}} {parts[2]}')

                # Memory Used (MB)
                metrics.append('# HELP DCGM_FI_DEV_FB_USED Framebuffer memory used in MB')
                metrics.append('# TYPE DCGM_FI_DEV_FB_USED gauge')
                metrics.append(f'DCGM_FI_DEV_FB_USED{{{labels}}} {parts[3]}')

                # Memory Free (MB)
                metrics.append('# HELP DCGM_FI_DEV_FB_FREE Framebuffer memory free in MB')
                metrics.append('# TYPE DCGM_FI_DEV_FB_FREE gauge')
                metrics.append(f'DCGM_FI_DEV_FB_FREE{{{labels}}} {parts[4]}')

                # Memory Total (MB)
                metrics.append('# HELP DCGM_FI_DEV_FB_TOTAL Framebuffer memory total in MB')
                metrics.append('# TYPE DCGM_FI_DEV_FB_TOTAL gauge')
                metrics.append(f'DCGM_FI_DEV_FB_TOTAL{{{labels}}} {parts[5]}')

                # Temperature (C)
                metrics.append('# HELP DCGM_FI_DEV_GPU_TEMP GPU temperature in Celsius')
                metrics.append('# TYPE DCGM_FI_DEV_GPU_TEMP gauge')
                metrics.append(f'DCGM_FI_DEV_GPU_TEMP{{{labels}}} {parts[6]}')

                # Power Usage (W)
                metrics.append('# HELP DCGM_FI_DEV_POWER_USAGE Power usage in Watts')
                metrics.append('# TYPE DCGM_FI_DEV_POWER_USAGE gauge')
                power = parts[7].replace("[Not Supported]", "0").replace("[N/A]", "0")
                try:
                    power = float(power)
                except ValueError:
                    power = 0
                metrics.append(f'DCGM_FI_DEV_POWER_USAGE{{{labels}}} {power}')

                # SM Clock (MHz)
                metrics.append('# HELP DCGM_FI_DEV_SM_CLOCK SM clock frequency in MHz')
                metrics.append('# TYPE DCGM_FI_DEV_SM_CLOCK gauge')
                metrics.append(f'DCGM_FI_DEV_SM_CLOCK{{{labels}}} {parts[8]}')

                # Memory Clock (MHz)
                metrics.append('# HELP DCGM_FI_DEV_MEM_CLOCK Memory clock frequency in MHz')
                metrics.append('# TYPE DCGM_FI_DEV_MEM_CLOCK gauge')
                metrics.append(f'DCGM_FI_DEV_MEM_CLOCK{{{labels}}} {parts[9]}')

    except subprocess.TimeoutExpired:
        metrics.append("# Error: nvidia-smi timeout")
    except FileNotFoundError:
        metrics.append("# Error: nvidia-smi not found")
    except Exception as e:
        metrics.append(f"# Error: {e}")

    return "\n".join(metrics)


class MetricsHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler for Prometheus metrics."""

    def do_GET(self):
        if self.path == "/metrics":
            content = get_gpu_metrics()
            self.send_response(200)
            self.send_header("Content-type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(content.encode())
        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b'<html><body><h1>GPU Metrics Exporter</h1><p><a href="/metrics">Metrics</a></p></body></html>')

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass


def signal_handler(sig, frame):
    """Handle shutdown signals gracefully."""
    print("\nShutting down metrics server...")
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print(f"Starting GPU metrics exporter on port {PORT}")
    print(f"Metrics available at http://localhost:{PORT}/metrics")

    with socketserver.TCPServer(("", PORT), MetricsHandler) as httpd:
        httpd.serve_forever()
