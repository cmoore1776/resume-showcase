#!/bin/bash
# Cleanup script for old WebSocket session pods/jobs before deployment
# This ensures all session pods are using the latest image after a deployment

set -e

NAMESPACE="${NAMESPACE:-resume-showcase}"

echo "Cleaning up old WebSocket session pods in namespace: $NAMESPACE"

# Delete all jobs created by session provisioner
echo "Deleting session provisioner jobs..."
kubectl delete jobs -n "$NAMESPACE" -l managed-by=session-provisioner --ignore-not-found=true

# Delete any orphaned websocket-session pods
echo "Deleting websocket-session pods..."
kubectl delete pods -n "$NAMESPACE" -l app=websocket-server,session-id --ignore-not-found=true

# Delete any warm pool pods
echo "Deleting warm pool pods..."
kubectl delete pods -n "$NAMESPACE" -l pool=warm --ignore-not-found=true

echo "Cleanup complete!"
echo ""
echo "Waiting for any terminating pods to finish..."
kubectl wait --for=delete pod -n "$NAMESPACE" -l app=websocket-server,session-id --timeout=30s 2>/dev/null || true

echo "All old session pods have been cleaned up."
