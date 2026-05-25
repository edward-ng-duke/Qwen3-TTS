# Qwen3-TTS deployment shortcuts.
# Run `make help` for the list of targets.

ENV_FILE ?= .env
ifneq (,$(wildcard $(ENV_FILE)))
include $(ENV_FILE)
export
endif

PORT       ?= 4967
WEB_PORT   ?= 4968
IMAGE      ?= qwen3-tts:local
CONTAINER  ?= qwen3-tts
WEIGHTS_DIR := models/Qwen3-TTS-12Hz-1.7B-CustomVoice

.PHONY: help download build up down restart logs ps health deploy redeploy test clean nuke web-dev web-build dev

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
	@echo "  make deploy     download (if needed) + build + up + wait for ready"
	@echo "  make redeploy   down + build + up + wait for ready (skips download)"
	@echo "  make test       Run pytest"
	@echo "  make dev        Run Vite dev server on 0.0.0.0:$(WEB_PORT), reuse running API at :$(PORT)"
	@echo "  make web-dev    Alias of 'make dev' (always runs npm install first)"
	@echo "  make web-build  Build web/dist locally (Docker does this in its build stage)"
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
	docker compose build

up:
	docker compose up -d
	@echo "[make] container starting; demo UI: http://localhost:$(PORT)/"

down:
	-docker compose down

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

deploy: download build up wait-ready
	@echo "[make] deploy complete → http://localhost:$(PORT)/"

redeploy: down build up wait-ready
	@echo "[make] redeploy complete → http://localhost:$(PORT)/"

test:
	pytest -q

dev:
	@command -v npm >/dev/null 2>&1 || { echo "[make] npm not found — install Node.js first"; exit 1; }
	@echo "[make] env: $(ENV_FILE)$(if $(wildcard $(ENV_FILE)), loaded, missing)"
	@echo "[make] auth: AUTH_ENABLED=$${AUTH_ENABLED:-auto} MONGO_URL=$${MONGO_URL:+set} ES_AUTH_ENABLED=$${ES_AUTH_ENABLED:-false}"
	@if [ ! -d web/node_modules ]; then \
		echo "[make] web/node_modules missing → npm install"; \
		cd web && npm install; \
	fi
	@printf "[make] checking API at http://localhost:%s/v1/health … " $(PORT); \
	if curl -fsS -m 2 "http://localhost:$(PORT)/v1/health" >/dev/null 2>&1; then \
		echo "OK"; \
	else \
		echo "MISSING"; \
		echo "[make] tip: in another shell run 'make up' (or 'make deploy') to start the API"; \
		echo "[make] starting Vite anyway — front-end will work, API calls will 502 until backend is up"; \
	fi
	@echo "[make] vite dev → http://0.0.0.0:$(WEB_PORT)  (proxies /v1 → http://localhost:$(PORT))"
	@cd web && npm run dev -- --host 0.0.0.0 --port $(WEB_PORT) --strictPort

web-dev:
	@cd web && npm install && npm run dev -- --host 0.0.0.0 --port $(WEB_PORT) --strictPort

web-build:
	@cd web && npm install && npm run build

clean: down
	-docker image rm $(IMAGE)

nuke: clean
	-docker volume rm qwen3-tts_qwen-tts-previews
