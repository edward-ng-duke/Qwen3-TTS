# Qwen3-TTS deployment shortcuts.
# Run `make help` for the list of targets.

ENV_FILE ?= .env
ifneq (,$(wildcard $(ENV_FILE)))
include $(ENV_FILE)
export
endif

PORT       ?= 4967
WEB_PORT   ?= 4968
# Dev-only ports — keep make dev/api-dev/web-dev independent from PORT/WEB_PORT
# so `make deploy` (container on 4967) and `make dev` (local backend on 4970 +
# vite on 4971) can run side-by-side.
DEV_PORT     ?= 4970
DEV_WEB_PORT ?= 4971
IMAGE      ?= qwen3-tts:local
CONTAINER  ?= qwen3-tts
WEIGHTS_DIR := models/Qwen3-TTS-12Hz-1.7B-CustomVoice
# Force a clean docker build: NO_CACHE=1 make build / deploy / redeploy
NO_CACHE_FLAG := $(if $(NO_CACHE),--no-cache,)
# Local dev usually doesn't have flash-attn installed in the host venv. Override
# with `LOCAL_ATTN_IMPL=flash_attention_2 make dev` once you've pip-installed it.
LOCAL_ATTN_IMPL ?= sdpa
AUTH_TRUE_VALUES := true 1 yes on
AUTH_FALSE_VALUES := false 0 no off
AUTH_ON := $(filter $(AUTH_TRUE_VALUES),$(AUTH_ENABLED))
AUTH_OFF := $(filter $(AUTH_FALSE_VALUES),$(AUTH_ENABLED))
AUTH_AUTO_SIGNAL := $(or $(MONGO_URL),$(filter $(AUTH_TRUE_VALUES),$(MONGO_ENABLED)),$(filter $(AUTH_TRUE_VALUES),$(ES_AUTH_ENABLED)))
VITE_AUTH_REQUIRED ?= $(if $(AUTH_OFF),false,$(if $(or $(AUTH_ON),$(AUTH_AUTO_SIGNAL)),true,false))
export VITE_AUTH_REQUIRED

.PHONY: help download build up down restart logs ps health deploy redeploy test clean nuke web-dev web-build dev api-dev wait-ready stop stop-dev free-dev-port free-deploy-port

help:
	@echo "Qwen3-TTS — make targets:"
	@echo "  env: $(ENV_FILE)$(if $(wildcard $(ENV_FILE)), loaded, missing; copy .env.example to .env)"
	@echo "  make download   Download model weights to ./$(WEIGHTS_DIR) (HF; WEIGHT_SOURCE=ms for ModelScope)"
	@echo "  make build      Build the docker image ($(IMAGE))"
	@echo "  make up         Start the container in the background"
	@echo "  make down       Stop and remove the container"
	@echo "  make restart    down + up"
	@echo "  make logs       Tail container logs (Ctrl-C to detach)"
	@echo "  make ps         Show container status"
	@echo "  make health     curl /v1/health"
	@echo "  make deploy     download (if needed) + build + up + wait for ready  (NO_CACHE=1 to bust cache)"
	@echo "  make redeploy   down + build + up + wait for ready (skips download)  (NO_CACHE=1 to bust cache)"
	@echo "  make test       Run pytest"
	@echo "  make dev        Local backend on :$(DEV_PORT) + Vite on 0.0.0.0:$(DEV_WEB_PORT) (one-shot, trap-cleans)"
	@echo "  make api-dev    Local backend (uvicorn) on 0.0.0.0:$(DEV_PORT) — no docker"
	@echo "  make web-dev    Vite dev server on 0.0.0.0:$(DEV_WEB_PORT), proxies /v1 → http://localhost:$(DEV_PORT)"
	@echo "  make web-build  Build web/dist locally (Docker does this in its build stage)"
	@echo "  make stop-dev   Kill local backend + vite on :$(DEV_PORT)/:$(DEV_WEB_PORT) (does NOT touch docker)"
	@echo "  make stop       Everything off: stop-dev + docker compose down"
	@echo "  make clean      Remove container + image (keeps weights and preview cache)"
	@echo "  make nuke       Same as clean + deletes preview volume (keeps weights)"
	@echo ""
	@echo "Demo UI:  http://localhost:$(PORT)/"
	@echo "API:      http://localhost:$(PORT)/v1/*  (Swagger at /docs)"

download:
	@if [ -f "$(WEIGHTS_DIR)/model.safetensors" ]; then \
		echo "[make] weights already at $(WEIGHTS_DIR) — skip"; \
	else \
		./scripts/download-weights.sh; \
	fi

build:
	docker compose build $(NO_CACHE_FLAG)

up:
	docker compose up -d
	@echo "[make] container starting; demo UI: http://localhost:$(PORT)/"

down:
	-docker compose down

# Two-tier stop semantics (single-container project — `stop-deploy` would equal
# `stop`, so it's intentionally omitted). `stop-dev` MUST NOT touch docker; it
# only kills the local Python + Vite holding DEV_PORT / DEV_WEB_PORT. `stop` is
# the umbrella: kill local dev, then bring docker down.
stop-dev:
	@for p in $(DEV_PORT) $(DEV_WEB_PORT); do \
		pids=$$(lsof -ti tcp:$$p -sTCP:LISTEN 2>/dev/null || true); \
		if [ -n "$$pids" ]; then echo "[make] stopping local on :$$p ($$pids)"; kill $$pids 2>/dev/null || true; fi; \
	done

stop: stop-dev down

restart: down up

logs:
	docker compose logs -f --tail=200

ps:
	@docker ps --filter name=$(CONTAINER) --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

health:
	@curl -fsS http://localhost:$(PORT)/v1/health && echo

wait-ready:
	@echo "[make] waiting for model_ready=true (up to 300s)…"
	@for i in $$(seq 1 150); do \
		r=$$(curl -fsS http://localhost:$(PORT)/v1/health 2>/dev/null || true); \
		case "$$r" in *'"model_ready":true'*) echo "[make] READY ($${i}x2s): $$r"; exit 0;; esac; \
		if ! docker ps --filter name=$(CONTAINER) --format '{{.Names}}' | grep -q $(CONTAINER); then \
			echo "[make] container exited; logs:"; docker logs $(CONTAINER) --tail 40; exit 1; \
		fi; \
		sleep 2; \
	done; \
	echo "[make] timeout"; docker logs $(CONTAINER) --tail 40; exit 1

deploy: free-deploy-port download build up wait-ready
	@echo "[make] deploy complete → http://localhost:$(PORT)/"

redeploy: down build up wait-ready
	@echo "[make] redeploy complete → http://localhost:$(PORT)/"

test:
	pytest -q

# Auto-release a port before `dev`/`deploy` binds to it. Stops any docker
# container publishing the port (except KEEP, the project's own container so
# `compose up -d` can reuse it without a model reload), then kills local
# listeners (TERM, then KILL). Shared recipe via target-specific variables.
free-dev-port:    PORT_LIST := $(DEV_PORT) $(DEV_WEB_PORT)
free-dev-port:    KEEP :=
free-deploy-port: PORT_LIST := $(PORT)
free-deploy-port: KEEP := $(CONTAINER)
free-dev-port free-deploy-port:
	@keep_cid=""; \
	if [ -n "$(KEEP)" ]; then keep_cid=$$(docker ps -q --filter "name=^$(KEEP)$$" 2>/dev/null); fi; \
	for p in $(PORT_LIST); do \
		cids=$$(docker ps -q --filter "publish=$$p" 2>/dev/null); \
		if [ -n "$$keep_cid" ] && [ -n "$$cids" ]; then \
			cids=$$(printf '%s\n' $$cids | grep -v "^$$keep_cid$$" || true); \
		fi; \
		if [ -n "$$cids" ]; then echo "[make] stopping docker on :$$p ($$cids)"; docker stop $$cids >/dev/null; fi; \
		pids=$$(lsof -ti tcp:$$p -sTCP:LISTEN 2>/dev/null || true); \
		if [ -n "$$pids" ]; then \
			echo "[make] killing pids on :$$p ($$pids)"; \
			kill $$pids 2>/dev/null || true; sleep 1; \
			pids=$$(lsof -ti tcp:$$p -sTCP:LISTEN 2>/dev/null || true); \
			if [ -n "$$pids" ]; then echo "[make] force-kill on :$$p ($$pids)"; kill -9 $$pids 2>/dev/null || true; fi; \
		fi; \
	done

api-dev: free-dev-port
	@command -v python >/dev/null 2>&1 || { echo "[make] python not found — activate your venv first"; exit 1; }
	@echo "[make] env: $(ENV_FILE)$(if $(wildcard $(ENV_FILE)), loaded, missing)"
	@echo "[make] auth: AUTH_ENABLED=$${AUTH_ENABLED:-auto} MONGO_URL=$${MONGO_URL:+set} ES_AUTH_ENABLED=$${ES_AUTH_ENABLED:-false}"
	@echo "[make] api-dev → http://0.0.0.0:$(DEV_PORT)  (local uvicorn, no docker)"
	@PORT=$(DEV_PORT) MODELS_ROOT=$(CURDIR)/models ATTN_IMPL=$(LOCAL_ATTN_IMPL) PREVIEW_CACHE_DIR=$(CURDIR)/.cache/previews python -m qwen_tts.serve --host 0.0.0.0 --port $(DEV_PORT)

dev: free-dev-port
	@command -v npm >/dev/null 2>&1 || { echo "[make] npm not found — install Node.js first"; exit 1; }
	@command -v python >/dev/null 2>&1 || { echo "[make] python not found — activate your venv first"; exit 1; }
	@echo "[make] env: $(ENV_FILE)$(if $(wildcard $(ENV_FILE)), loaded, missing)"
	@echo "[make] auth: AUTH_ENABLED=$${AUTH_ENABLED:-auto} MONGO_URL=$${MONGO_URL:+set} ES_AUTH_ENABLED=$${ES_AUTH_ENABLED:-false} VITE_AUTH_REQUIRED=$(VITE_AUTH_REQUIRED)"
	@if [ ! -d web/node_modules ]; then \
		echo "[make] web/node_modules missing → npm install"; \
		cd web && npm install; \
	fi
	@echo "[make] starting local backend on :$(DEV_PORT) (background) + vite on :$(DEV_WEB_PORT) (foreground)"
	@set -e; \
	PORT=$(DEV_PORT) MODELS_ROOT=$(CURDIR)/models ATTN_IMPL=$(LOCAL_ATTN_IMPL) PREVIEW_CACHE_DIR=$(CURDIR)/.cache/previews python -m qwen_tts.serve --host 0.0.0.0 --port $(DEV_PORT) > /tmp/qwen3-tts-api-dev.log 2>&1 & \
	api_pid=$$!; \
	echo "[make] api-dev pid=$$api_pid  log=/tmp/qwen3-tts-api-dev.log"; \
	trap 'echo "[make] stopping api-dev (pid=$$api_pid)"; kill $$api_pid 2>/dev/null || true; wait $$api_pid 2>/dev/null || true' EXIT INT TERM; \
	printf "[make] waiting for backend at :$(DEV_PORT) (up to 300s) "; \
	ready=0; \
	for i in $$(seq 1 150); do \
		if curl -fsS -m 1 "http://localhost:$(DEV_PORT)/v1/health" >/dev/null 2>&1; then echo " OK"; ready=1; break; fi; \
		if ! kill -0 $$api_pid 2>/dev/null; then echo " FAILED"; echo "[make] backend exited; tail of log:"; tail -n 40 /tmp/qwen3-tts-api-dev.log; exit 1; fi; \
		printf "."; sleep 2; \
	done; \
	if [ "$$ready" != "1" ]; then echo " TIMEOUT"; echo "[make] backend not healthy after 300s; tail of log:"; tail -n 40 /tmp/qwen3-tts-api-dev.log; exit 1; fi; \
	echo "[make] vite dev → http://0.0.0.0:$(DEV_WEB_PORT)  (proxies /v1 → http://localhost:$(DEV_PORT))"; \
	cd web && VITE_PROXY_TARGET=http://localhost:$(DEV_PORT) npm run dev -- --host 0.0.0.0 --port $(DEV_WEB_PORT) --strictPort

web-dev:
	@cd web && npm install && VITE_PROXY_TARGET=http://localhost:$(DEV_PORT) npm run dev -- --host 0.0.0.0 --port $(DEV_WEB_PORT) --strictPort

web-build:
	@cd web && npm install && npm run build

clean: down
	-docker image rm $(IMAGE)

nuke: clean
	-docker volume rm qwen3-tts_qwen-tts-previews
