# Makefile for ASOS-Lab

# Fix for missing Docker PATH on some Macs (ensures we find the Docker binary)
export PATH := /Applications/Docker.app/Contents/Resources/bin:$(PATH)

# Variables
CLUSTER_NAME := asos-lab
# Point kubectl to the k3d config so we can run commands against it
KUBECONFIG := $(shell k3d kubeconfig write $(CLUSTER_NAME) 2>/dev/null || echo ~/.kube/config)

.PHONY: up down logs chaos rescue attack help build-api setup-k3d deploy reload

help:
	@echo "ASOS-Lab Makefile"
	@echo "  make up      - Full bring-up: create cluster, build images, deploy"
	@echo "  make down    - Destroy the cluster"
	@echo "  make logs    - Tail logs for all services"
	@echo "  make reload  - Rebuild app, re-import, and restart pods (Quick Dev Loop)"

# --- Individual steps ---

setup-k3d:
	@echo "🚀 Starting k3d cluster..."
	# --api-port 6550: Fixed port for the Kubernetes API
	# -p "3000:3000@loadbalancer": Tunnel port 3000 from inside the cluster to localhost:3000
	# --agents 1: Create 1 worker node
	# --registry-create: Create a local registry (optional but good practice)
	k3d cluster create $(CLUSTER_NAME) --api-port 6550 -p "3000:3000@loadbalancer" --agents 1 --registry-create $(CLUSTER_NAME)-registry || echo "Cluster already exists"
	@echo "⏳ Waiting for cluster to be ready..."
	kubectl wait --for=condition=Ready nodes --all --timeout=60s

# --- Build & Run ---

build-api:
	@echo "🐳 Building api-service..."
	# Build the docker image locally using the recipe in specific Dockerfile
	docker build -t api-service:local services/api

build-brain:
	@echo "🧠 Building brain-service..."
	docker build -t brain-service:local apps/brain

# Build everything
build: build-api build-brain

import-images: build
	@echo "📦 Importing images into k3d..."
	# Transfer the image from your Mac's Docker to inside the k3d cluster's Docker
	k3d image import api-service:local brain-service:local -c $(CLUSTER_NAME)

deploy:
	@echo "☸️  Deploying manifests..."
	# Tell Kubernetes (Manager) to hire the employees defined in the YAML files
	kubectl apply -f infra/k8s/

# "The Master Switch" - Runs everything in order
up: setup-k3d import-images deploy
	@echo "✅ System is up! Access via http://localhost:3000"

# --- Dev Helpers ---

reload: import-images
	@echo "🔄 Restarting pods..."
	kubectl rollout restart deployment/api-service
	kubectl rollout restart deployment/brain-service
	@echo "⏳ Waiting for rollout..."
	kubectl rollout status deployment/api-service
	kubectl rollout status deployment/brain-service
	@echo "✅ Reloaded!"

down:
	@echo "💥 Destroying cluster..."
	k3d cluster delete $(CLUSTER_NAME)

logs:
	kubectl logs -l app=api-service -f
