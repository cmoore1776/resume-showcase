#!/usr/bin/env python3
"""
WebSocket server for latency monitoring.
Each pod instance handles ping/pong messages from a single client.
"""

import asyncio
import json
import os
import random
import signal
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from websockets.server import serve
import websockets

# Lists for generating friendly pod names
ADJECTIVES = [
    "Swift",
    "Brave",
    "Cosmic",
    "Quantum",
    "Electric",
    "Turbo",
    "Stellar",
    "Neon",
    "Cyber",
    "Atomic",
    "Mystic",
    "Golden",
    "Silver",
    "Crystal",
    "Thunder",
    "Lightning",
    "Blaze",
    "Frost",
    "Storm",
    "Shadow",
    "Phoenix",
    "Dragon",
    "Tiger",
    "Eagle",
    "Falcon",
    "Nova",
    "Solar",
    "Lunar",
    "Nebula",
]

NOUNS = [
    "Falcon",
    "Phoenix",
    "Dragon",
    "Tiger",
    "Eagle",
    "Panther",
    "Wolf",
    "Bear",
    "Shark",
    "Hawk",
    "Lion",
    "Cobra",
    "Viper",
    "Raptor",
    "Lynx",
    "Puma",
    "Jaguar",
    "Condor",
    "Raven",
    "Owl",
    "Sparrow",
    "Swift",
    "Kite",
    "Albatross",
    "Penguin",
    "Dolphin",
    "Orca",
    "Kraken",
    "Leviathan",
]


class WebSocketServer:
    # Security limits
    MAX_MESSAGE_SIZE = 1024  # 1KB max message size
    MAX_CONNECTIONS = 100  # Max concurrent connections
    RATE_LIMIT_WINDOW = 1  # seconds
    RATE_LIMIT_MAX_REQUESTS = 2  # max requests per window (2 pings/sec max)
    TERMINATE_COOLDOWN = 30  # seconds between terminate requests

    def __init__(self, host="0.0.0.0", port=8080):
        self.host = host
        self.port = port
        self.k8s_pod_name = os.getenv("POD_NAME", "unknown-pod")
        self.session_id = os.getenv("SESSION_ID", None)
        self.friendly_name = self._generate_friendly_name()
        self.region = os.getenv("AWS_REGION", "unknown-region")
        self.shutdown_event = asyncio.Event()
        self.active_connections = 0
        self.rate_limiter = defaultdict(list)  # Track request timestamps per client
        self.last_terminate_time = None

    def _generate_friendly_name(self):
        """Generate a friendly, memorable pod name."""
        adjective = random.choice(ADJECTIVES)
        noun = random.choice(NOUNS)
        # Add a random number for extra uniqueness
        number = random.randint(100, 999)
        return f"{adjective}-{noun}-{number}"

    def _check_rate_limit(self, client_id):
        """Check if client has exceeded rate limit."""
        now = datetime.now()
        # Clean old requests outside the window
        cutoff = now - timedelta(seconds=self.RATE_LIMIT_WINDOW)
        self.rate_limiter[client_id] = [
            ts for ts in self.rate_limiter[client_id] if ts > cutoff
        ]

        # Check if limit exceeded
        if len(self.rate_limiter[client_id]) >= self.RATE_LIMIT_MAX_REQUESTS:
            return False

        # Add current request
        self.rate_limiter[client_id].append(now)
        return True

    def _can_terminate(self):
        """Check if terminate request is allowed (cooldown period)."""
        if self.last_terminate_time is None:
            return True
        elapsed = (datetime.now() - self.last_terminate_time).total_seconds()
        return elapsed >= self.TERMINATE_COOLDOWN

    async def handle_client(self, websocket):
        """Handle WebSocket connection from a client."""
        client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"

        # Connection limit check
        if self.active_connections >= self.MAX_CONNECTIONS:
            print(
                f"[{datetime.now().isoformat()}] Connection rejected: max connections reached"
            )
            await websocket.close(1008, "Too many connections")
            return

        self.active_connections += 1
        print(
            f"[{datetime.now().isoformat()}] Client connected: {client_id} ({self.active_connections} active)"
        )

        try:
            async for message in websocket:
                # Message size validation
                if len(message) > self.MAX_MESSAGE_SIZE:
                    error_response = {"type": "error", "message": "Message too large"}
                    await websocket.send(json.dumps(error_response))
                    continue

                # Rate limiting
                if not self._check_rate_limit(client_id):
                    error_response = {
                        "type": "error",
                        "message": "Rate limit exceeded. Max 2 requests per second.",
                    }
                    await websocket.send(json.dumps(error_response))
                    continue

                try:
                    data = json.loads(message)

                    # Input validation - only allow known message types
                    message_type = data.get("type")
                    if message_type not in ["ping", "terminate"]:
                        error_response = {
                            "type": "error",
                            "message": "Invalid message type",
                        }
                        await websocket.send(json.dumps(error_response))
                        continue

                    if message_type == "ping":
                        # Validate timestamp format
                        timestamp = data.get("timestamp")
                        if not isinstance(timestamp, str):
                            error_response = {
                                "type": "error",
                                "message": "Invalid timestamp",
                            }
                            await websocket.send(json.dumps(error_response))
                            continue

                        # Respond with pong including pod information
                        response = {
                            "type": "pong",
                            "timestamp": datetime.now().isoformat(),
                            "pod_name": self.friendly_name,
                            "region": self.region,
                            "client_timestamp": timestamp,
                            "session_id": self.session_id,
                        }
                        await websocket.send(json.dumps(response))

                    elif message_type == "terminate":
                        # Check cooldown period
                        if not self._can_terminate():
                            remaining = (
                                self.TERMINATE_COOLDOWN
                                - (
                                    datetime.now() - self.last_terminate_time
                                ).total_seconds()
                            )
                            error_response = {
                                "type": "error",
                                "message": f"Terminate cooldown active. Wait {int(remaining)}s",
                            }
                            await websocket.send(json.dumps(error_response))
                            continue

                        # Client requested pod termination
                        self.last_terminate_time = datetime.now()
                        print(
                            f"[{datetime.now().isoformat()}] Termination requested by client {client_id}"
                        )
                        response = {
                            "type": "terminating",
                            "message": "Pod termination initiated",
                            "pod_name": self.friendly_name,
                            "region": self.region,
                        }
                        await websocket.send(json.dumps(response))
                        # Trigger graceful shutdown
                        self.shutdown_event.set()

                except json.JSONDecodeError:
                    error_response = {"type": "error", "message": "Invalid JSON format"}
                    await websocket.send(json.dumps(error_response))
                except Exception as e:
                    print(
                        f"[{datetime.now().isoformat()}] Error processing message: {e}"
                    )
                    error_response = {"type": "error", "message": "Internal error"}
                    await websocket.send(json.dumps(error_response))

        except websockets.exceptions.ConnectionClosed:
            print(f"[{datetime.now().isoformat()}] Client disconnected: {client_id}")
        except Exception as e:
            print(
                f"[{datetime.now().isoformat()}] Error handling client {client_id}: {e}"
            )
        finally:
            # Decrement connection count
            self.active_connections -= 1
            # Clean up rate limiter entry
            if client_id in self.rate_limiter:
                del self.rate_limiter[client_id]
            print(
                f"[{datetime.now().isoformat()}] Client cleanup: {client_id} ({self.active_connections} active)"
            )

    async def health_check_handler(self, path, request_headers):
        """Health check endpoint for Kubernetes probes."""
        if path == "/health":
            # Security headers
            headers = [
                ("X-Content-Type-Options", "nosniff"),
                ("X-Frame-Options", "DENY"),
                ("X-XSS-Protection", "1; mode=block"),
                ("Content-Security-Policy", "default-src 'none'"),
            ]
            return (200, headers, b"OK")
        return None

    async def run(self):
        """Start the WebSocket server."""
        print(
            f"[{datetime.now().isoformat()}] Starting WebSocket server on {self.host}:{self.port}"
        )
        print(f"[{datetime.now().isoformat()}] K8s Pod: {self.k8s_pod_name}")
        print(f"[{datetime.now().isoformat()}] Session ID: {self.session_id or 'N/A'}")
        print(f"[{datetime.now().isoformat()}] Friendly Name: {self.friendly_name}")
        print(f"[{datetime.now().isoformat()}] Region: {self.region}")

        async with serve(
            self.handle_client,
            self.host,
            self.port,
            process_request=self.health_check_handler,
            max_size=self.MAX_MESSAGE_SIZE,  # Enforce max message size at protocol level
            ping_interval=None,  # Disable server-initiated pings (client controls timing)
            ping_timeout=None,
        ):
            print(f"[{datetime.now().isoformat()}] WebSocket server running")
            await self.shutdown_event.wait()
            print(f"[{datetime.now().isoformat()}] Shutting down gracefully...")


def signal_handler(server):
    """Handle shutdown signals."""

    def handler(signum, frame):
        print(
            f"\n[{datetime.now().isoformat()}] Received signal {signum}, initiating shutdown..."
        )
        server.shutdown_event.set()

    return handler


async def main():
    server = WebSocketServer()

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, signal_handler(server))
    signal.signal(signal.SIGINT, signal_handler(server))

    await server.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n[{datetime.now().isoformat()}] Server stopped")
        sys.exit(0)
