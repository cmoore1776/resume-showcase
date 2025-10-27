#!/usr/bin/env python3
"""
Session provisioning service that creates dedicated Kubernetes pods for each WebSocket session.
This service listens on HTTP and creates a Kubernetes Job for each new session request.
"""

import asyncio
import os
import uuid
from datetime import datetime
from aiohttp import web
from aiohttp_cors import setup as cors_setup, ResourceOptions
from kubernetes import client, config
from kubernetes.client.rest import ApiException


class SessionProvisioner:
    """Provisions dedicated Kubernetes pods for WebSocket sessions."""

    def __init__(self, namespace=None, pool_size=None):
        self.namespace = namespace or os.getenv("NAMESPACE", "resume-showcase")
        self.pool_size = pool_size or int(os.getenv("POOL_SIZE", "4"))
        ecr_url = os.getenv("ECR_REPOSITORY_URL", "websocket-server")
        # Add :latest tag if not already present
        self.ecr_image = ecr_url if ":" in ecr_url else f"{ecr_url}:latest"
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        self.available_pods = []  # Pool of warm pods ready for assignment

        print(f"[{datetime.now().isoformat()}] Initializing SessionProvisioner")
        print(f"[{datetime.now().isoformat()}] Namespace: {self.namespace}")
        print(f"[{datetime.now().isoformat()}] ECR Image: {self.ecr_image}")
        print(f"[{datetime.now().isoformat()}] AWS Region: {self.aws_region}")

        # Load Kubernetes config
        try:
            print(
                f"[{datetime.now().isoformat()}] Loading in-cluster Kubernetes config..."
            )
            config.load_incluster_config()
            print(
                f"[{datetime.now().isoformat()}] Successfully loaded in-cluster config"
            )
        except config.ConfigException as e:
            print(
                f"[{datetime.now().isoformat()}] Failed to load in-cluster config: {e}"
            )
            print(f"[{datetime.now().isoformat()}] Falling back to kubeconfig...")
            try:
                config.load_kube_config()
                print(f"[{datetime.now().isoformat()}] Successfully loaded kubeconfig")
            except Exception as kube_err:
                print(
                    f"[{datetime.now().isoformat()}] ERROR: Failed to load any Kubernetes config: {kube_err}"
                )
                raise

        self.batch_v1 = client.BatchV1Api()
        self.core_v1 = client.CoreV1Api()
        print(f"[{datetime.now().isoformat()}] Kubernetes API clients initialized")

    async def initialize_pod_pool(self):
        """Initialize the pool of warm pods ready for sessions."""
        print(
            f"[{datetime.now().isoformat()}] Initializing pod pool with {self.pool_size} pods..."
        )

        # Check for existing warm pods
        try:
            pods = self.core_v1.list_namespaced_pod(
                namespace=self.namespace,
                label_selector="app=websocket-server,pool=warm,assigned=false",
            )
            for pod in pods.items:
                if (
                    pod.status.phase == "Running"
                    and pod.status.conditions
                    and any(
                        c.type == "Ready" and c.status == "True"
                        for c in pod.status.conditions
                    )
                ):
                    self.available_pods.append(
                        {
                            "pod_name": pod.metadata.name,
                            "pod_ip": pod.status.pod_ip,
                        }
                    )
            print(
                f"[{datetime.now().isoformat()}] Found {len(self.available_pods)} existing warm pods"
            )
        except Exception as e:
            print(f"[{datetime.now().isoformat()}] Error checking existing pods: {e}")

        # Create additional warm pods if needed
        while len(self.available_pods) < self.pool_size:
            try:
                session_id = self._generate_session_id()
                await self._create_warm_pod(session_id)
            except Exception as e:
                print(f"[{datetime.now().isoformat()}] Error creating warm pod: {e}")
                break

    async def _create_warm_pod(self, session_id):
        """Create a warm pod that's ready to be assigned to a session."""
        job_manifest = self._create_job_manifest(session_id)
        # Add pool labels
        job_manifest["metadata"]["labels"]["pool"] = "warm"
        job_manifest["metadata"]["labels"]["assigned"] = "false"
        job_manifest["spec"]["template"]["metadata"]["labels"]["pool"] = "warm"
        job_manifest["spec"]["template"]["metadata"]["labels"]["assigned"] = "false"

        print(
            f"[{datetime.now().isoformat()}] Creating warm pod for session: {session_id}"
        )

        # Create the job
        self.batch_v1.create_namespaced_job(namespace=self.namespace, body=job_manifest)

        # Wait for pod to be ready
        pod_details = await self._wait_for_pod_ready(session_id, timeout=90)

        if pod_details:
            self.available_pods.append(pod_details)
            print(
                f"[{datetime.now().isoformat()}] Warm pod ready: {pod_details['pod_name']}"
            )
        else:
            print(
                f"[{datetime.now().isoformat()}] Warm pod creation timed out for session: {session_id}"
            )

    async def maintain_pod_pool(self):
        """Background task to maintain the pool of warm pods."""
        while True:
            try:
                # Check pool size and replenish if needed
                if len(self.available_pods) < self.pool_size:
                    print(
                        f"[{datetime.now().isoformat()}] Pod pool below threshold ({len(self.available_pods)}/{self.pool_size}), creating new warm pod..."
                    )
                    session_id = self._generate_session_id()
                    await self._create_warm_pod(session_id)
            except Exception as e:
                print(f"[{datetime.now().isoformat()}] Error maintaining pod pool: {e}")

            # Wait before checking again
            await asyncio.sleep(5)

    def _generate_session_id(self):
        """Generate a unique session ID."""
        return str(uuid.uuid4())[:8]

    def _create_job_manifest(self, session_id):
        """Create a Kubernetes Job manifest for a WebSocket session pod."""
        job_name = f"websocket-session-{session_id}"

        return {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {
                "name": job_name,
                "namespace": self.namespace,
                "labels": {
                    "app": "websocket-server",
                    "session-id": session_id,
                    "managed-by": "session-provisioner",
                },
            },
            "spec": {
                "ttlSecondsAfterFinished": 300,  # Clean up 5 minutes after completion
                "backoffLimit": 0,  # Don't retry on failure
                "template": {
                    "metadata": {
                        "labels": {"app": "websocket-server", "session-id": session_id}
                    },
                    "spec": {
                        "restartPolicy": "Never",
                        "containers": [
                            {
                                "name": "websocket-server",
                                "image": self.ecr_image,
                                "imagePullPolicy": "IfNotPresent",
                                "ports": [{"containerPort": 8080, "name": "websocket"}],
                                "env": [
                                    {
                                        "name": "POD_NAME",
                                        "valueFrom": {
                                            "fieldRef": {"fieldPath": "metadata.name"}
                                        },
                                    },
                                    {"name": "AWS_REGION", "value": self.aws_region},
                                    {"name": "SESSION_ID", "value": session_id},
                                ],
                                "livenessProbe": {
                                    "httpGet": {"path": "/health", "port": 8080},
                                    "initialDelaySeconds": 5,
                                    "periodSeconds": 10,
                                },
                                "readinessProbe": {
                                    "httpGet": {"path": "/health", "port": 8080},
                                    "initialDelaySeconds": 2,
                                    "periodSeconds": 3,
                                },
                                "resources": {
                                    "requests": {"cpu": "50m", "memory": "64Mi"},
                                    "limits": {"cpu": "100m", "memory": "128Mi"},
                                },
                            }
                        ],
                    },
                },
            },
        }

    async def _wait_for_pod_ready(self, session_id, timeout=60):
        """Wait for the pod to be ready and return its details."""
        start_time = datetime.now()

        while (datetime.now() - start_time).total_seconds() < timeout:
            try:
                # Find pod with session label
                pods = self.core_v1.list_namespaced_pod(
                    namespace=self.namespace, label_selector=f"session-id={session_id}"
                )

                if pods.items:
                    pod = pods.items[0]

                    # Check if pod is ready
                    if pod.status.phase == "Running":
                        # Check if container is ready
                        if pod.status.container_statuses:
                            container_status = pod.status.container_statuses[0]
                            if container_status.ready:
                                return {
                                    "pod_name": pod.metadata.name,
                                    "pod_ip": pod.status.pod_ip,
                                    "node_name": pod.spec.node_name,
                                }

                await asyncio.sleep(1)

            except ApiException as e:
                print(f"Error checking pod status: {e}")
                await asyncio.sleep(1)

        raise TimeoutError(
            f"Pod for session {session_id} did not become ready within {timeout}s"
        )

    async def create_session(self, request):
        """Handle session creation request."""
        try:
            session_id = self._generate_session_id()
            print(f"[{datetime.now().isoformat()}] Creating session: {session_id}")

            # Try to get a warm pod from the pool
            pod_details = None
            if self.available_pods:
                pod_details = self.available_pods.pop(0)
                print(
                    f"[{datetime.now().isoformat()}] Assigned warm pod {pod_details['pod_name']} to session {session_id}"
                )

                # Update pod labels to mark it as assigned
                try:
                    pod = self.core_v1.read_namespaced_pod(
                        name=pod_details["pod_name"], namespace=self.namespace
                    )
                    pod.metadata.labels["assigned"] = "true"
                    pod.metadata.labels["session-id"] = session_id
                    self.core_v1.patch_namespaced_pod(
                        name=pod_details["pod_name"],
                        namespace=self.namespace,
                        body=pod,
                    )
                except Exception as e:
                    print(
                        f"[{datetime.now().isoformat()}] Warning: Failed to update pod labels: {e}"
                    )

                # Trigger pool replenishment asynchronously
                asyncio.create_task(self._replenish_pool())

            else:
                # No warm pods available, create one on-demand
                print(
                    f"[{datetime.now().isoformat()}] No warm pods available, creating new pod for session: {session_id}"
                )

                # Create Job
                job_manifest = self._create_job_manifest(session_id)

                self.batch_v1.create_namespaced_job(
                    namespace=self.namespace, body=job_manifest
                )

                print(
                    f"[{datetime.now().isoformat()}] Job created for session: {session_id}"
                )

                # Wait for pod to be ready
                pod_details = await self._wait_for_pod_ready(session_id)

                print(
                    f"[{datetime.now().isoformat()}] Pod ready for session: {session_id}"
                )

            # Return session details
            response = {
                "session_id": session_id,
                "status": "ready",
                "pod_name": pod_details["pod_name"],
                "websocket_url": f"wss://resume-showcase.k3s.christianmoore.me/ws/{session_id}",
                "node_name": pod_details.get("node_name"),
            }

            return web.json_response(response)

        except TimeoutError as e:
            print(f"[{datetime.now().isoformat()}] Session creation timeout: {e}")
            return web.json_response(
                {"error": "Session creation timeout", "message": str(e)}, status=504
            )

        except ApiException as e:
            print(f"[{datetime.now().isoformat()}] Kubernetes API error: {e}")
            return web.json_response(
                {"error": "Failed to create session", "message": str(e)}, status=500
            )

        except Exception as e:
            print(f"[{datetime.now().isoformat()}] Unexpected error: {e}")
            return web.json_response(
                {"error": "Internal server error", "message": str(e)}, status=500
            )

    async def _replenish_pool(self):
        """Replenish the pod pool in the background."""
        if len(self.available_pods) < self.pool_size:
            print(
                f"[{datetime.now().isoformat()}] Replenishing pod pool ({len(self.available_pods)}/{self.pool_size})..."
            )
            session_id = self._generate_session_id()
            await self._create_warm_pod(session_id)

    async def health_check(self, request):
        """Health check endpoint."""
        return web.Response(text="OK")

    def create_app(self):
        """Create the aiohttp web application."""
        app = web.Application()

        # Configure CORS
        cors = cors_setup(
            app,
            defaults={
                "*": ResourceOptions(
                    allow_credentials=True,
                    expose_headers="*",
                    allow_headers="*",
                    allow_methods="*",
                )
            },
        )

        # Add routes
        session_resource = cors.add(app.router.add_resource("/session"))
        cors.add(session_resource.add_route("POST", self.create_session))

        health_resource = cors.add(app.router.add_resource("/health"))
        cors.add(health_resource.add_route("GET", self.health_check))

        return app


async def main():
    provisioner = SessionProvisioner(pool_size=4)

    # Initialize the pod pool
    await provisioner.initialize_pod_pool()

    # Start background task to maintain pod pool
    asyncio.create_task(provisioner.maintain_pod_pool())

    app = provisioner.create_app()

    runner = web.AppRunner(app)
    await runner.setup()

    site = web.TCPSite(runner, "0.0.0.0", 8081)
    await site.start()

    print(
        f"[{datetime.now().isoformat()}] Session provisioner running on http://0.0.0.0:8081"
    )

    # Run forever
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
